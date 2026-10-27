"""
Donor-Recipient Matching Engine
Uses a transparent weighted scoring system.
Weights are configurable. Scores are NOT calibrated probabilities.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from math import radians, sin, cos, sqrt, atan2
from bson import ObjectId
from app.database import get_db
import logging

logger = logging.getLogger(__name__)

# Configurable weights (must sum to 1.0)
WEIGHTS = {
    "distance": 0.30,
    "capacity": 0.20,
    "food_compatibility": 0.20,
    "urgency": 0.15,
    "verification": 0.10,
    "history": 0.05,
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS points in km."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def normalize(value: float, min_val: float, max_val: float) -> float:
    if max_val == min_val:
        return 1.0
    return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))


def score_distance(distance_km: float) -> float:
    """Closer = higher score. Max useful range = 50 km."""
    if distance_km <= 0:
        return 1.0
    if distance_km >= 50:
        return 0.0
    return 1.0 - normalize(distance_km, 0, 50)


def score_capacity(org_capacity_kg: Optional[float], donation_qty: float) -> float:
    if org_capacity_kg is None:
        return 0.5  # Neutral if unknown
    if org_capacity_kg <= 0:
        return 0.0
    ratio = donation_qty / org_capacity_kg
    if ratio <= 1.0:
        return 1.0
    # Can accept partial? Give partial credit
    return max(0.0, 1.0 - (ratio - 1.0) * 0.5)


def score_food_compatibility(org_food_types: Optional[List[str]], donation_category: str) -> float:
    if not org_food_types:
        return 0.7  # No restriction = moderately compatible
    category_lower = donation_category.lower()
    for ft in org_food_types:
        if ft.lower() in category_lower or category_lower in ft.lower():
            return 1.0
    return 0.2  # Category not listed


def score_urgency(pickup_deadline: datetime) -> float:
    """Higher score for more urgent (sooner-expiring) donations."""
    now = datetime.now(timezone.utc)
    if pickup_deadline.tzinfo is None:
        pickup_deadline = pickup_deadline.replace(tzinfo=timezone.utc)
    hours_left = (pickup_deadline - now).total_seconds() / 3600
    if hours_left <= 0:
        return 0.0
    if hours_left <= 2:
        return 1.0
    if hours_left <= 6:
        return 0.8
    if hours_left <= 24:
        return 0.5
    return 0.2


def score_verification(verification_status: str) -> float:
    return 1.0 if verification_status == "verified" else 0.0


async def score_history(recipient_org_id: str) -> float:
    """Score based on past successful collections (0-1)."""
    db = get_db()
    total = await db.donation_requests.count_documents({"recipient_org_id": recipient_org_id})
    completed = await db.pickups.count_documents({
        "recipient_org_id": recipient_org_id,
        "status": "completed",
    })
    if total == 0:
        return 0.5  # Neutral for new orgs
    success_rate = completed / total
    return success_rate


def compute_score(components: Dict[str, float]) -> float:
    total = sum(WEIGHTS[k] * components[k] for k in WEIGHTS if k in components)
    return round(total, 4)


def build_explanation(components: Dict[str, float], distance_km: float) -> List[Dict[str, Any]]:
    explanations = []
    if "distance" in components:
        explanations.append({
            "factor": "Distance",
            "score": round(components["distance"], 3),
            "weight": WEIGHTS["distance"],
            "detail": f"{distance_km:.1f} km away",
        })
    if "capacity" in components:
        explanations.append({
            "factor": "Capacity Match",
            "score": round(components["capacity"], 3),
            "weight": WEIGHTS["capacity"],
            "detail": "Organization can accommodate this donation quantity",
        })
    if "food_compatibility" in components:
        explanations.append({
            "factor": "Food Type Compatibility",
            "score": round(components["food_compatibility"], 3),
            "weight": WEIGHTS["food_compatibility"],
            "detail": "Food category aligns with recipient preferences",
        })
    if "urgency" in components:
        explanations.append({
            "factor": "Urgency",
            "score": round(components["urgency"], 3),
            "weight": WEIGHTS["urgency"],
            "detail": "Time-sensitivity of the donation",
        })
    if "verification" in components:
        explanations.append({
            "factor": "Verification Status",
            "score": round(components["verification"], 3),
            "weight": WEIGHTS["verification"],
            "detail": "Organization is verified by admin",
        })
    if "history" in components:
        explanations.append({
            "factor": "Track Record",
            "score": round(components["history"], 3),
            "weight": WEIGHTS["history"],
            "detail": "Past successful collection rate",
        })
    return explanations


async def get_recommendations(donation_id: str, max_results: int = 10) -> List[Dict[str, Any]]:
    """
    Returns ranked recipient organizations for a given donation.
    Excludes unverified orgs and those that cannot meet basic requirements.
    Score is a weighted composite — not a calibrated probability.
    """
    db = get_db()
    donation = await db.donations.find_one({"_id": ObjectId(donation_id)})
    if not donation:
        return []

    deadline = donation["pickup_deadline"]
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if deadline <= datetime.now(timezone.utc):
        return []

    # Fetch all verified recipient orgs
    cursor = db.organizations.find({
        "org_type": {"$in": ["ngo", "shelter", "community_kitchen"]},
        "verification_status": "verified",
    })

    results = []
    async for org in cursor:
        org_id = str(org["_id"])

        # Skip if already has active request/accepted for this donation
        active = await db.donation_requests.find_one({
            "donation_id": donation_id,
            "recipient_org_id": org_id,
            "status": {"$in": ["accepted", "pending"]},
        })
        if active:
            continue

        distance_km = haversine_km(
            donation["pickup_latitude"], donation["pickup_longitude"],
            org.get("latitude", 0), org.get("longitude", 0),
        )

        # Hard exclusion: more than 100 km away
        if distance_km > 100:
            continue

        components = {
            "distance": score_distance(distance_km),
            "capacity": score_capacity(org.get("max_capacity_kg"), donation["quantity"]),
            "food_compatibility": score_food_compatibility(
                org.get("food_types_accepted"), donation["food_category"]
            ),
            "urgency": score_urgency(deadline),
            "verification": score_verification(org.get("verification_status", "")),
            "history": await score_history(org_id),
        }

        total_score = compute_score(components)
        explanation = build_explanation(components, distance_km)

        results.append({
            "org_id": org_id,
            "org_name": org.get("org_name", ""),
            "org_type": org.get("org_type", ""),
            "city": org.get("city", ""),
            "address": org.get("address", ""),
            "distance_km": round(distance_km, 2),
            "match_score": total_score,
            "score_components": components,
            "explanation": explanation,
            "score_disclaimer": "This score is a weighted composite and does not represent a statistically validated probability.",
            "max_capacity_kg": org.get("max_capacity_kg"),
            "food_types_accepted": org.get("food_types_accepted", []),
            "verification_status": org.get("verification_status"),
        })

    # Sort by score descending
    results.sort(key=lambda x: x["match_score"], reverse=True)
    return results[:max_results]
