from datetime import datetime, timezone
from typing import Optional, List
from bson import ObjectId
from fastapi import HTTPException, status
from app.database import get_db
from app.schemas.organization import OrganizationCreate, OrganizationUpdate, VerificationStatus
import logging

logger = logging.getLogger(__name__)


def _serialize_org(org: dict) -> dict:
    org["id"] = str(org["_id"])
    org.pop("_id", None)
    if "location" in org:
        coords = org["location"].get("coordinates", [0, 0])
        org["longitude"] = coords[0]
        org["latitude"] = coords[1]
    return org


async def create_organization(user_id: str, data: OrganizationCreate) -> dict:
    db = get_db()
    existing = await db.organizations.find_one({"user_id": user_id})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization already registered for this user",
        )

    org_doc = {
        "user_id": user_id,
        "org_name": data.org_name,
        "org_type": data.org_type.value,
        "description": data.description,
        "address": data.address,
        "city": data.city,
        "state": data.state,
        "country": data.country,
        "postal_code": data.postal_code,
        "location": {
            "type": "Point",
            "coordinates": [data.longitude, data.latitude],
        },
        "latitude": data.latitude,
        "longitude": data.longitude,
        "website": data.website,
        "registration_number": data.registration_number,
        "verification_status": VerificationStatus.PENDING.value,
        "food_types_accepted": data.food_types_accepted,
        "max_capacity_kg": data.max_capacity_kg,
        "operating_hours": data.operating_hours.model_dump() if data.operating_hours else None,
        "avg_daily_surplus_kg": data.avg_daily_surplus_kg,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await db.organizations.insert_one(org_doc)
    org_doc["_id"] = result.inserted_id
    return _serialize_org(org_doc)


async def get_organization_by_user(user_id: str) -> Optional[dict]:
    db = get_db()
    org = await db.organizations.find_one({"user_id": user_id})
    if not org:
        return None
    return _serialize_org(org)


async def get_organization_by_id(org_id: str) -> dict:
    db = get_db()
    org = await db.organizations.find_one({"_id": ObjectId(org_id)})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return _serialize_org(org)


async def update_organization(org_id: str, user_id: str, data: OrganizationUpdate) -> dict:
    db = get_db()
    org = await db.organizations.find_one({"_id": ObjectId(org_id)})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if str(org["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this organization")

    updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if "latitude" in updates or "longitude" in updates:
        lat = updates.pop("latitude", org["latitude"])
        lon = updates.pop("longitude", org["longitude"])
        updates["location"] = {"type": "Point", "coordinates": [lon, lat]}
        updates["latitude"] = lat
        updates["longitude"] = lon
    if "operating_hours" in updates and updates["operating_hours"]:
        updates["operating_hours"] = updates["operating_hours"].model_dump() if hasattr(updates["operating_hours"], "model_dump") else updates["operating_hours"]
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.organizations.update_one({"_id": ObjectId(org_id)}, {"$set": updates})
    return await get_organization_by_id(org_id)


async def admin_verify_organization(org_id: str, action: str, reason: Optional[str] = None) -> dict:
    db = get_db()
    status_map = {
        "verify": VerificationStatus.VERIFIED.value,
        "reject": VerificationStatus.REJECTED.value,
        "suspend": VerificationStatus.SUSPENDED.value,
    }
    new_status = status_map.get(action)
    if not new_status:
        raise HTTPException(status_code=400, detail="Invalid action")

    await db.organizations.update_one(
        {"_id": ObjectId(org_id)},
        {"$set": {
            "verification_status": new_status,
            "verification_reason": reason,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return await get_organization_by_id(org_id)


async def list_organizations(
    page: int = 1,
    per_page: int = 20,
    org_type: Optional[str] = None,
    verification_status: Optional[str] = None,
    city: Optional[str] = None,
) -> dict:
    db = get_db()
    query = {}
    if org_type:
        query["org_type"] = org_type
    if verification_status:
        query["verification_status"] = verification_status
    if city:
        query["city"] = {"$regex": city, "$options": "i"}

    total = await db.organizations.count_documents(query)
    skip = (page - 1) * per_page
    cursor = db.organizations.find(query).skip(skip).limit(per_page)
    orgs = [_serialize_org(o) async for o in cursor]

    return {
        "data": orgs,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }
