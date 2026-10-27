from datetime import datetime, timezone
from typing import Optional, List
from bson import ObjectId
from fastapi import HTTPException, status
from app.database import get_db
from app.schemas.donation import DonationCreate, DonationUpdate, DonationStatus, RequestStatus
from app.services.notification_service import create_notification
from app.schemas.notification import NotificationType
import logging
import string
import random

logger = logging.getLogger(__name__)


def _gen_ref() -> str:
    return "FRA-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _serialize_donation(d: dict) -> dict:
    d["id"] = str(d["_id"])
    d.pop("_id", None)
    if "pickup_location" in d:
        coords = d["pickup_location"].get("coordinates", [0, 0])
        d["pickup_longitude"] = coords[0]
        d["pickup_latitude"] = coords[1]
    return d


def _serialize_request(r: dict) -> dict:
    r["id"] = str(r["_id"])
    r.pop("_id", None)
    return r


async def create_donation(donor_org_id: str, data: DonationCreate) -> dict:
    db = get_db()
    now = datetime.now(timezone.utc)

    # Normalize deadline timezone
    deadline = data.pickup_deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)

    start = data.collection_start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    if deadline <= now:
        raise HTTPException(status_code=400, detail="Pickup deadline must be in the future")

    doc = {
        "donor_org_id": donor_org_id,
        "food_name": data.food_name,
        "food_category": data.food_category.value,
        "description": data.description,
        "quantity": data.quantity,
        "unit": data.unit,
        "serves_people": data.serves_people,
        "preparation_time": data.preparation_time,
        "storage_condition": data.storage_condition.value,
        "storage_notes": data.storage_notes,
        "allergens": data.allergens or [],
        "pickup_address": data.pickup_address,
        "pickup_city": data.pickup_city,
        "pickup_location": {
            "type": "Point",
            "coordinates": [data.pickup_longitude, data.pickup_latitude],
        },
        "pickup_latitude": data.pickup_latitude,
        "pickup_longitude": data.pickup_longitude,
        "pickup_instructions": data.pickup_instructions,
        "collection_start_time": start,
        "pickup_deadline": deadline,
        "status": DonationStatus.AVAILABLE.value,
        "image_url": None,
        "is_vegetarian": data.is_vegetarian,
        "is_vegan": data.is_vegan,
        "is_halal": data.is_halal,
        "is_kosher": data.is_kosher,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.donations.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_donation(doc)


async def get_donation(donation_id: str) -> dict:
    db = get_db()
    d = await db.donations.find_one({"_id": ObjectId(donation_id)})
    if not d:
        raise HTTPException(status_code=404, detail="Donation not found")
    return _serialize_donation(d)


async def update_donation(donation_id: str, donor_org_id: str, data: DonationUpdate) -> dict:
    db = get_db()
    donation = await db.donations.find_one({"_id": ObjectId(donation_id)})
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if str(donation["donor_org_id"]) != donor_org_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if donation["status"] not in [DonationStatus.AVAILABLE.value]:
        raise HTTPException(status_code=400, detail="Can only edit AVAILABLE donations")

    updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.donations.update_one({"_id": ObjectId(donation_id)}, {"$set": updates})
    return await get_donation(donation_id)


async def cancel_donation(donation_id: str, donor_org_id: str, reason: Optional[str] = None) -> dict:
    db = get_db()
    donation = await db.donations.find_one({"_id": ObjectId(donation_id)})
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if str(donation["donor_org_id"]) != donor_org_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    cancelable = [DonationStatus.AVAILABLE.value, DonationStatus.REQUESTED.value, DonationStatus.ACCEPTED.value]
    if donation["status"] not in cancelable:
        raise HTTPException(status_code=400, detail="Donation cannot be cancelled in its current status")

    await db.donations.update_one(
        {"_id": ObjectId(donation_id)},
        {"$set": {
            "status": DonationStatus.CANCELLED.value,
            "cancellation_reason": reason,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return await get_donation(donation_id)


async def list_donations(
    page: int = 1,
    per_page: int = 20,
    status: Optional[str] = None,
    food_category: Optional[str] = None,
    city: Optional[str] = None,
    donor_org_id: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: Optional[float] = None,
    is_vegetarian: Optional[bool] = None,
    is_vegan: Optional[bool] = None,
    is_halal: Optional[bool] = None,
) -> dict:
    db = get_db()
    query: dict = {}

    if status:
        query["status"] = status
    if food_category:
        query["food_category"] = food_category
    if city:
        query["pickup_city"] = {"$regex": city, "$options": "i"}
    if donor_org_id:
        query["donor_org_id"] = donor_org_id
    if is_vegetarian is not None:
        query["is_vegetarian"] = is_vegetarian
    if is_vegan is not None:
        query["is_vegan"] = is_vegan
    if is_halal is not None:
        query["is_halal"] = is_halal

    # Exclude expired donations from public listing
    now = datetime.now(timezone.utc)
    if not status:
        query["status"] = {"$nin": [DonationStatus.EXPIRED.value, DonationStatus.CANCELLED.value]}

    if latitude and longitude and radius_km:
        query["pickup_location"] = {
            "$near": {
                "$geometry": {"type": "Point", "coordinates": [longitude, latitude]},
                "$maxDistance": radius_km * 1000,
            }
        }

    total = await db.donations.count_documents(query)
    skip = (page - 1) * per_page
    cursor = db.donations.find(query).sort("pickup_deadline", 1).skip(skip).limit(per_page)
    donations = [_serialize_donation(d) async for d in cursor]

    # Enrich with org names
    org_ids = list({d["donor_org_id"] for d in donations})
    orgs = {}
    for oid in org_ids:
        try:
            org = await db.organizations.find_one({"_id": ObjectId(oid)})
            if org:
                orgs[oid] = org.get("org_name", "")
        except Exception:
            pass
    for d in donations:
        d["donor_org_name"] = orgs.get(d["donor_org_id"], "")

    return {
        "data": donations,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }


async def create_donation_request(recipient_org_id: str, data) -> dict:
    db = get_db()
    donation = await db.donations.find_one({"_id": ObjectId(data.donation_id)})
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation["status"] != DonationStatus.AVAILABLE.value:
        raise HTTPException(status_code=400, detail="Donation is not available for requests")

    # Check deadline
    deadline = donation["pickup_deadline"]
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if deadline <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Donation has passed its pickup deadline")

    # Prevent duplicate active request
    existing = await db.donation_requests.find_one({
        "donation_id": data.donation_id,
        "recipient_org_id": recipient_org_id,
        "status": {"$in": [RequestStatus.PENDING.value, RequestStatus.ACCEPTED.value]},
    })
    if existing:
        raise HTTPException(status_code=409, detail="You already have an active request for this donation")

    now = datetime.now(timezone.utc)
    req_doc = {
        "donation_id": data.donation_id,
        "recipient_org_id": recipient_org_id,
        "status": RequestStatus.PENDING.value,
        "message": data.message,
        "proposed_pickup_time": data.proposed_pickup_time,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.donation_requests.insert_one(req_doc)
    req_doc["_id"] = result.inserted_id

    # Update donation status to REQUESTED
    await db.donations.update_one(
        {"_id": ObjectId(data.donation_id)},
        {"$set": {"status": DonationStatus.REQUESTED.value, "updated_at": now}},
    )

    # Notify donor
    donor_org = await db.organizations.find_one({"_id": ObjectId(donation["donor_org_id"])})
    if donor_org:
        donor_user = await db.users.find_one({"_id": ObjectId(donor_org["user_id"])})
        if donor_user:
            await create_notification(
                user_id=str(donor_user["_id"]),
                notification_type=NotificationType.DONATION_REQUESTED,
                title="New Pickup Request",
                message=f"A recipient has requested your donation: {donation['food_name']}",
                reference_id=data.donation_id,
                reference_type="donation",
            )

    return _serialize_request(req_doc)


async def respond_to_request(
    request_id: str,
    donor_org_id: str,
    action: str,
    reason: Optional[str] = None,
) -> dict:
    db = get_db()
    req = await db.donation_requests.find_one({"_id": ObjectId(request_id)})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    donation = await db.donations.find_one({"_id": ObjectId(req["donation_id"])})
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if str(donation["donor_org_id"]) != donor_org_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    now = datetime.now(timezone.utc)
    if action == "accept":
        new_req_status = RequestStatus.ACCEPTED.value
        new_don_status = DonationStatus.ACCEPTED.value
        notif_type = NotificationType.DONATION_ACCEPTED
        notif_title = "Donation Request Accepted"
        notif_msg = f"Your request for {donation['food_name']} has been accepted!"
    elif action == "decline":
        new_req_status = RequestStatus.DECLINED.value
        new_don_status = DonationStatus.AVAILABLE.value
        notif_type = NotificationType.DONATION_DECLINED
        notif_title = "Donation Request Declined"
        notif_msg = f"Your request for {donation['food_name']} was declined."
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use accept or decline")

    await db.donation_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": new_req_status, "decline_reason": reason, "updated_at": now}},
    )
    await db.donations.update_one(
        {"_id": ObjectId(req["donation_id"])},
        {"$set": {"status": new_don_status, "updated_at": now}},
    )

    # Notify recipient
    recip_org = await db.organizations.find_one({"_id": ObjectId(req["recipient_org_id"])})
    if recip_org:
        recip_user = await db.users.find_one({"_id": ObjectId(recip_org["user_id"])})
        if recip_user:
            await create_notification(
                user_id=str(recip_user["_id"]),
                notification_type=notif_type,
                title=notif_title,
                message=notif_msg,
                reference_id=req["donation_id"],
                reference_type="donation",
            )

    return _serialize_request({**req, "status": new_req_status, "_id": req["_id"]})


async def expire_overdue_donations():
    """Called by a background task to expire past-deadline donations."""
    db = get_db()
    now = datetime.now(timezone.utc)
    result = await db.donations.update_many(
        {
            "status": {"$in": [DonationStatus.AVAILABLE.value, DonationStatus.REQUESTED.value]},
            "pickup_deadline": {"$lt": now},
        },
        {"$set": {"status": DonationStatus.EXPIRED.value, "updated_at": now}},
    )
    if result.modified_count:
        logger.info(f"Expired {result.modified_count} donations")
