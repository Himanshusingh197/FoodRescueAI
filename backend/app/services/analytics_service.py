"""
Analytics and impact dashboard service.
Clearly distinguishes between listed, accepted, collected, and delivered food.
Never counts a listing as rescued merely because it was created.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId
from app.database import get_db
import logging

logger = logging.getLogger(__name__)

# Impact assumption — documented clearly
MEALS_PER_KG = 2.0  # 1 kg ≈ 2 meals (approximate industry estimate)


async def get_donor_analytics(org_id: str, days: int = 30) -> dict:
    db = get_db()
    since = datetime.now(timezone.utc) - timedelta(days=days)

    total_listed = await db.donations.count_documents({
        "donor_org_id": org_id,
        "created_at": {"$gte": since},
    })
    total_collected = await db.donations.count_documents({
        "donor_org_id": org_id,
        "status": "delivered",
        "updated_at": {"$gte": since},
    })
    total_cancelled = await db.donations.count_documents({
        "donor_org_id": org_id,
        "status": "cancelled",
        "updated_at": {"$gte": since},
    })
    total_expired = await db.donations.count_documents({
        "donor_org_id": org_id,
        "status": "expired",
        "updated_at": {"$gte": since},
    })

    # Actual food rescued (only from impact_records, not listings)
    pipeline_kg = [
        {"$match": {"donor_org_id": org_id, "recorded_at": {"$gte": since}}},
        {"$group": {"_id": None, "total_kg": {"$sum": "$quantity_kg"}, "total_meals": {"$sum": "$estimated_meals"}}},
    ]
    kg_result = await db.impact_records.aggregate(pipeline_kg).to_list(1)
    total_rescued_kg = kg_result[0]["total_kg"] if kg_result else 0.0
    total_meals = kg_result[0]["total_meals"] if kg_result else 0

    # Monthly trend
    monthly = await _monthly_trend(db, "donor_org_id", org_id, days)

    # Category breakdown
    category_pipeline = [
        {"$match": {"donor_org_id": org_id, "status": "delivered", "updated_at": {"$gte": since}}},
        {"$group": {"_id": "$food_category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    categories = await db.donations.aggregate(category_pipeline).to_list(20)

    success_rate = round(total_collected / total_listed * 100, 1) if total_listed > 0 else 0.0

    return {
        "period_days": days,
        "total_listed": total_listed,
        "total_collected": total_collected,
        "total_cancelled": total_cancelled,
        "total_expired": total_expired,
        "success_rate_pct": success_rate,
        "total_rescued_kg": round(total_rescued_kg, 2),
        "total_meals_enabled": total_meals,
        "meals_per_kg_assumption": MEALS_PER_KG,
        "monthly_trend": monthly,
        "category_breakdown": [{"category": c["_id"], "count": c["count"]} for c in categories],
        "note": "Only food with confirmed delivery (DELIVERED status) is counted as rescued.",
    }


async def get_recipient_analytics(org_id: str, days: int = 30) -> dict:
    db = get_db()
    since = datetime.now(timezone.utc) - timedelta(days=days)

    total_requested = await db.donation_requests.count_documents({
        "recipient_org_id": org_id,
        "created_at": {"$gte": since},
    })
    completed_pickups = await db.pickups.count_documents({
        "recipient_org_id": org_id,
        "status": "completed",
        "updated_at": {"$gte": since},
    })

    pipeline_kg = [
        {"$match": {"recipient_org_id": org_id, "recorded_at": {"$gte": since}}},
        {"$group": {"_id": None, "total_kg": {"$sum": "$quantity_kg"}, "total_meals": {"$sum": "$estimated_meals"}}},
    ]
    kg_result = await db.impact_records.aggregate(pipeline_kg).to_list(1)
    total_received_kg = kg_result[0]["total_kg"] if kg_result else 0.0
    total_meals = kg_result[0]["total_meals"] if kg_result else 0

    monthly = await _monthly_trend(db, "recipient_org_id", org_id, days)

    return {
        "period_days": days,
        "total_requested": total_requested,
        "completed_pickups": completed_pickups,
        "total_received_kg": round(total_received_kg, 2),
        "total_meals_enabled": total_meals,
        "meals_per_kg_assumption": MEALS_PER_KG,
        "monthly_trend": monthly,
        "note": "Only confirmed collections are counted.",
    }


async def get_admin_analytics(days: int = 30) -> dict:
    db = get_db()
    since = datetime.now(timezone.utc) - timedelta(days=days)

    total_users = await db.users.count_documents({})
    total_orgs = await db.organizations.count_documents({})
    pending_verifications = await db.organizations.count_documents({"verification_status": "pending"})
    verified_orgs = await db.organizations.count_documents({"verification_status": "verified"})

    total_donations = await db.donations.count_documents({"created_at": {"$gte": since}})
    delivered_donations = await db.donations.count_documents({"status": "delivered", "updated_at": {"$gte": since}})
    cancelled_donations = await db.donations.count_documents({"status": "cancelled", "updated_at": {"$gte": since}})
    expired_donations = await db.donations.count_documents({"status": "expired", "updated_at": {"$gte": since}})

    pipeline_impact = [
        {"$match": {"recorded_at": {"$gte": since}}},
        {"$group": {"_id": None, "total_kg": {"$sum": "$quantity_kg"}, "total_meals": {"$sum": "$estimated_meals"}}},
    ]
    impact_result = await db.impact_records.aggregate(pipeline_impact).to_list(1)
    total_rescued_kg = impact_result[0]["total_kg"] if impact_result else 0.0
    total_meals = impact_result[0]["total_meals"] if impact_result else 0

    # Platform-wide monthly trend
    monthly_pipeline = [
        {"$match": {"recorded_at": {"$gte": since}}},
        {"$group": {
            "_id": {"year": {"$year": "$recorded_at"}, "month": {"$month": "$recorded_at"}},
            "kg": {"$sum": "$quantity_kg"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1}},
    ]
    monthly = await db.impact_records.aggregate(monthly_pipeline).to_list(24)

    return {
        "period_days": days,
        "total_users": total_users,
        "total_organizations": total_orgs,
        "pending_verifications": pending_verifications,
        "verified_organizations": verified_orgs,
        "total_donations_listed": total_donations,
        "delivered_donations": delivered_donations,
        "cancelled_donations": cancelled_donations,
        "expired_donations": expired_donations,
        "platform_success_rate_pct": round(delivered_donations / total_donations * 100, 1) if total_donations > 0 else 0.0,
        "total_rescued_kg": round(total_rescued_kg, 2),
        "total_meals_enabled": total_meals,
        "meals_per_kg_assumption": MEALS_PER_KG,
        "monthly_impact": [
            {
                "month": f"{m['_id']['year']}-{m['_id']['month']:02d}",
                "kg_rescued": round(m["kg"], 2),
                "deliveries": m["count"],
            }
            for m in monthly
        ],
        "note": "Only confirmed deliveries are counted as rescued food.",
    }


async def _monthly_trend(db, field: str, org_id: str, days: int) -> list:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    pipeline = [
        {"$match": {field: org_id, "recorded_at": {"$gte": since}}},
        {"$group": {
            "_id": {"year": {"$year": "$recorded_at"}, "month": {"$month": "$recorded_at"}},
            "kg": {"$sum": "$quantity_kg"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1}},
    ]
    results = await db.impact_records.aggregate(pipeline).to_list(24)
    return [
        {"month": f"{r['_id']['year']}-{r['_id']['month']:02d}", "kg": round(r["kg"], 2), "count": r["count"]}
        for r in results
    ]
