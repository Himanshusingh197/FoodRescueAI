from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import HTTPException
from app.database import get_db
from app.schemas.pickup import PickupStatus, PickupCreate, DonorHandoverConfirm, RecipientCollectionConfirm, PickupCancellation
from app.schemas.donation import DonationStatus, RequestStatus
from app.services.notification_service import create_notification
from app.schemas.notification import NotificationType
import logging
import string
import random

logger = logging.getLogger(__name__)


def _gen_ref() -> str:
    return "PKP-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc["_id"])
    doc.pop("_id", None)
    return doc


async def create_pickup(donor_org_id: str, data: PickupCreate) -> dict:
    db = get_db()
    donation = await db.donations.find_one({"_id": ObjectId(data.donation_id)})
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if str(donation["donor_org_id"]) != donor_org_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if donation["status"] != DonationStatus.ACCEPTED.value:
        raise HTTPException(status_code=400, detail="Donation must be in ACCEPTED status")

    req = await db.donation_requests.find_one({"_id": ObjectId(data.request_id)})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    now = datetime.now(timezone.utc)
    pickup_doc = {
        "donation_id": data.donation_id,
        "donor_org_id": donor_org_id,
        "recipient_org_id": req["recipient_org_id"],
        "request_id": data.request_id,
        "reference_code": _gen_ref(),
        "status": PickupStatus.SCHEDULED.value,
        "agreed_pickup_time": data.agreed_pickup_time,
        "pickup_instructions": donation.get("pickup_instructions"),
        "donor_confirmed_at": None,
        "actual_quantity_handed": None,
        "recipient_confirmed_at": None,
        "actual_quantity_received": None,
        "quantity_discrepancy": None,
        "quality_rating": None,
        "collection_notes": None,
        "cancellation_reason": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.pickups.insert_one(pickup_doc)
    pickup_doc["_id"] = result.inserted_id

    # Update donation status
    await db.donations.update_one(
        {"_id": ObjectId(data.donation_id)},
        {"$set": {"status": DonationStatus.READY_FOR_PICKUP.value, "updated_at": now}},
    )

    # Notify recipient
    recip_org = await db.organizations.find_one({"_id": ObjectId(req["recipient_org_id"])})
    if recip_org:
        recip_user = await db.users.find_one({"_id": ObjectId(recip_org["user_id"])})
        if recip_user:
            await create_notification(
                user_id=str(recip_user["_id"]),
                notification_type=NotificationType.PICKUP_SCHEDULED,
                title="Pickup Scheduled",
                message=f"Pickup for {donation['food_name']} is scheduled. Reference: {pickup_doc['reference_code']}",
                reference_id=str(result.inserted_id),
                reference_type="pickup",
            )

    return _serialize(pickup_doc)


async def donor_confirm_handover(pickup_id: str, donor_org_id: str, data: DonorHandoverConfirm) -> dict:
    db = get_db()
    pickup = await db.pickups.find_one({"_id": ObjectId(pickup_id)})
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup not found")
    if str(pickup["donor_org_id"]) != donor_org_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if pickup["status"] not in [PickupStatus.SCHEDULED.value, PickupStatus.IN_PROGRESS.value]:
        raise HTTPException(status_code=400, detail="Pickup not in confirmable state")

    now = datetime.now(timezone.utc)
    await db.pickups.update_one(
        {"_id": ObjectId(pickup_id)},
        {"$set": {
            "status": PickupStatus.DONOR_CONFIRMED.value,
            "donor_confirmed_at": now,
            "actual_quantity_handed": data.actual_quantity_handed,
            "handover_notes": data.handover_notes,
            "updated_at": now,
        }},
    )
    await db.donations.update_one(
        {"_id": ObjectId(pickup["donation_id"])},
        {"$set": {"status": DonationStatus.COLLECTED.value, "updated_at": now}},
    )
    return await get_pickup(pickup_id)


async def recipient_confirm_collection(pickup_id: str, recipient_org_id: str, data: RecipientCollectionConfirm) -> dict:
    db = get_db()
    pickup = await db.pickups.find_one({"_id": ObjectId(pickup_id)})
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup not found")
    if str(pickup["recipient_org_id"]) != recipient_org_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if pickup["status"] != PickupStatus.DONOR_CONFIRMED.value:
        raise HTTPException(status_code=400, detail="Donor must confirm handover first")

    now = datetime.now(timezone.utc)
    discrepancy = None
    if pickup.get("actual_quantity_handed") is not None:
        discrepancy = round(data.actual_quantity_received - pickup["actual_quantity_handed"], 3)

    await db.pickups.update_one(
        {"_id": ObjectId(pickup_id)},
        {"$set": {
            "status": PickupStatus.COMPLETED.value,
            "recipient_confirmed_at": now,
            "actual_quantity_received": data.actual_quantity_received,
            "quantity_discrepancy": discrepancy,
            "quality_rating": data.quality_rating,
            "collection_notes": data.collection_notes,
            "updated_at": now,
        }},
    )
    await db.donations.update_one(
        {"_id": ObjectId(pickup["donation_id"])},
        {"$set": {"status": DonationStatus.DELIVERED.value, "updated_at": now}},
    )

    # Record impact
    await _record_impact(pickup, data.actual_quantity_received)

    return await get_pickup(pickup_id)


async def cancel_pickup(pickup_id: str, org_id: str, data: PickupCancellation) -> dict:
    db = get_db()
    pickup = await db.pickups.find_one({"_id": ObjectId(pickup_id)})
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup not found")

    authorized = str(pickup["donor_org_id"]) == org_id or str(pickup["recipient_org_id"]) == org_id
    if not authorized:
        raise HTTPException(status_code=403, detail="Not authorized")

    if pickup["status"] in [PickupStatus.COMPLETED.value, PickupStatus.CANCELLED.value]:
        raise HTTPException(status_code=400, detail="Cannot cancel a completed or already-cancelled pickup")

    now = datetime.now(timezone.utc)
    await db.pickups.update_one(
        {"_id": ObjectId(pickup_id)},
        {"$set": {
            "status": PickupStatus.CANCELLED.value,
            "cancellation_reason": data.reason,
            "cancelled_by": data.cancelled_by,
            "updated_at": now,
        }},
    )
    await db.donations.update_one(
        {"_id": ObjectId(pickup["donation_id"])},
        {"$set": {"status": DonationStatus.AVAILABLE.value, "updated_at": now}},
    )
    return await get_pickup(pickup_id)


async def get_pickup(pickup_id: str) -> dict:
    db = get_db()
    pickup = await db.pickups.find_one({"_id": ObjectId(pickup_id)})
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup not found")
    return _serialize(pickup)


async def list_pickups(org_id: str, role: str, page: int = 1, per_page: int = 20) -> dict:
    db = get_db()
    if role == "donor":
        query = {"donor_org_id": org_id}
    else:
        query = {"recipient_org_id": org_id}

    total = await db.pickups.count_documents(query)
    skip = (page - 1) * per_page
    cursor = db.pickups.find(query).sort("created_at", -1).skip(skip).limit(per_page)
    pickups = [_serialize(p) async for p in cursor]
    return {
        "data": pickups,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }


async def _record_impact(pickup: dict, quantity_received: float):
    """Record an impact entry when a pickup is completed."""
    db = get_db()
    # Assumption: 1 kg of food ≈ 2 meals (clearly documented)
    MEALS_PER_KG = 2.0
    now = datetime.now(timezone.utc)
    impact_doc = {
        "donation_id": pickup["donation_id"],
        "donor_org_id": pickup["donor_org_id"],
        "recipient_org_id": pickup["recipient_org_id"],
        "pickup_id": str(pickup["_id"]),
        "quantity_kg": quantity_received,
        "estimated_meals": round(quantity_received * MEALS_PER_KG),
        "meals_per_kg_assumption": MEALS_PER_KG,
        "recorded_at": now,
    }
    await db.impact_records.insert_one(impact_doc)
