from datetime import datetime, timezone
from typing import Optional, Dict, Any
from bson import ObjectId
from app.database import get_db
from app.schemas.notification import NotificationType
import logging

logger = logging.getLogger(__name__)


async def create_notification(
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    reference_id: Optional[str] = None,
    reference_type: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    db = get_db()
    doc = {
        "user_id": user_id,
        "notification_type": notification_type.value,
        "title": title,
        "message": message,
        "is_read": False,
        "reference_id": reference_id,
        "reference_type": reference_type,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.notifications.insert_one(doc)
    doc["_id"] = result.inserted_id
    doc["id"] = str(doc["_id"])
    return doc


async def get_user_notifications(
    user_id: str,
    page: int = 1,
    per_page: int = 20,
    unread_only: bool = False,
) -> dict:
    db = get_db()
    query: dict = {"user_id": user_id}
    if unread_only:
        query["is_read"] = False

    total = await db.notifications.count_documents(query)
    skip = (page - 1) * per_page
    cursor = db.notifications.find(query).sort("created_at", -1).skip(skip).limit(per_page)
    notifications = []
    async for n in cursor:
        n["id"] = str(n["_id"])
        n.pop("_id", None)
        notifications.append(n)

    unread_count = await db.notifications.count_documents({"user_id": user_id, "is_read": False})

    return {
        "data": notifications,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
        "unread_count": unread_count,
    }


async def mark_notifications_read(user_id: str, notification_ids: list[str]) -> int:
    db = get_db()
    object_ids = [ObjectId(nid) for nid in notification_ids]
    result = await db.notifications.update_many(
        {"_id": {"$in": object_ids}, "user_id": user_id},
        {"$set": {"is_read": True}},
    )
    return result.modified_count


async def mark_all_read(user_id: str) -> int:
    db = get_db()
    result = await db.notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}},
    )
    return result.modified_count


async def send_urgent_donation_alerts():
    """
    Find donations expiring within 2 hours and notify eligible verified recipient orgs.
    Prevents duplicate notifications using a metadata flag.
    """
    from datetime import timedelta
    db = get_db()
    now = datetime.now(timezone.utc)
    soon = now + timedelta(hours=2)

    urgent_donations = await db.donations.find({
        "status": "available",
        "pickup_deadline": {"$gt": now, "$lte": soon},
        "urgent_alert_sent": {"$ne": True},
    }).to_list(length=100)

    for donation in urgent_donations:
        # Find nearby verified recipient orgs
        recip_orgs = await db.organizations.find({
            "org_type": {"$in": ["ngo", "shelter", "community_kitchen"]},
            "verification_status": "verified",
        }).to_list(length=50)

        for org in recip_orgs:
            user = await db.users.find_one({"_id": ObjectId(org["user_id"])})
            if user:
                # Check if already notified
                already = await db.notifications.find_one({
                    "user_id": str(user["_id"]),
                    "reference_id": str(donation["_id"]),
                    "notification_type": NotificationType.DONATION_EXPIRING.value,
                })
                if not already:
                    await create_notification(
                        user_id=str(user["_id"]),
                        notification_type=NotificationType.DONATION_EXPIRING,
                        title="⚠️ Urgent: Food Donation Expiring Soon",
                        message=f"{donation['food_name']} ({donation['quantity']} {donation['unit']}) expires in under 2 hours. Act now!",
                        reference_id=str(donation["_id"]),
                        reference_type="donation",
                    )

        # Mark donation as having had urgent alert sent
        await db.donations.update_one(
            {"_id": donation["_id"]},
            {"$set": {"urgent_alert_sent": True}},
        )

    logger.info(f"Urgent alerts sent for {len(urgent_donations)} donations")
