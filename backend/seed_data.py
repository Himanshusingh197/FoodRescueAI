"""
Seed script — creates demo data for development.
Run ONCE after starting the backend with MongoDB running.
Usage: python seed_data.py
"""
import asyncio
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.auth.hashing import hash_password

USERS = [
    {"email": "admin@foodrescue.ai",  "full_name": "Platform Admin",    "role": "admin",     "password": "Admin@1234"},
    {"email": "donor@greencanteen.in","full_name": "Priya Sharma",       "role": "donor",     "password": "Donor@1234"},
    {"email": "ngo@helphand.org",     "full_name": "Rohan Verma",        "role": "recipient", "password": "Recip@1234"},
]

ORGS = [
    {
        "user_email": "donor@greencanteen.in",
        "org_name": "Green Canteen CU",
        "org_type": "canteen",
        "description": "Chandigarh University main canteen with daily surplus meals.",
        "address": "Chandigarh University, NH-05, Ludhiana Highway",
        "city": "Mohali", "state": "Punjab", "country": "India",
        "postal_code": "140413",
        "latitude": 30.7691, "longitude": 76.5741,
        "verification_status": "verified",
        "avg_daily_surplus_kg": 20.0,
    },
    {
        "user_email": "ngo@helphand.org",
        "org_name": "Help Hand Foundation",
        "org_type": "ngo",
        "description": "NGO serving underprivileged communities in Mohali.",
        "address": "Phase 7, Industrial Area",
        "city": "Mohali", "state": "Punjab", "country": "India",
        "postal_code": "160055",
        "latitude": 30.7046, "longitude": 76.7179,
        "verification_status": "verified",
        "food_types_accepted": ["cooked_meals", "grains_cereals", "bakery"],
        "max_capacity_kg": 50.0,
    },
]


async def seed():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    now = datetime.now(timezone.utc)

    print("Seeding users…")
    user_ids = {}
    for u in USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            user_ids[u["email"]] = str(existing["_id"])
            print(f"  ↳ {u['email']} already exists")
            continue
        doc = {
            "email": u["email"],
            "password_hash": hash_password(u["password"]),
            "full_name": u["full_name"],
            "role": u["role"],
            "phone": None,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            "last_login": None,
        }
        res = await db.users.insert_one(doc)
        user_ids[u["email"]] = str(res.inserted_id)
        print(f"  ✓ Created {u['email']} ({u['role']})")

    print("\nSeeding organizations…")
    org_ids = {}
    for o in ORGS:
        uid = user_ids[o["user_email"]]
        existing = await db.organizations.find_one({"user_id": uid})
        if existing:
            org_ids[o["user_email"]] = str(existing["_id"])
            print(f"  ↳ Org for {o['user_email']} already exists")
            continue
        doc = {
            "user_id": uid,
            "org_name": o["org_name"],
            "org_type": o["org_type"],
            "description": o.get("description"),
            "address": o["address"],
            "city": o["city"],
            "state": o["state"],
            "country": o["country"],
            "postal_code": o.get("postal_code"),
            "location": {"type": "Point", "coordinates": [o["longitude"], o["latitude"]]},
            "latitude": o["latitude"],
            "longitude": o["longitude"],
            "website": None,
            "registration_number": None,
            "verification_status": o.get("verification_status", "pending"),
            "food_types_accepted": o.get("food_types_accepted"),
            "max_capacity_kg": o.get("max_capacity_kg"),
            "operating_hours": None,
            "avg_daily_surplus_kg": o.get("avg_daily_surplus_kg"),
            "created_at": now,
            "updated_at": now,
        }
        res = await db.organizations.insert_one(doc)
        org_ids[o["user_email"]] = str(res.inserted_id)
        print(f"  ✓ Created org: {o['org_name']}")

    print("\nSeeding sample donations…")
    donor_org_id = org_ids.get("donor@greencanteen.in")
    if donor_org_id:
        sample_donations = [
            {
                "food_name": "Dal Makhani & Rice",
                "food_category": "cooked_meals",
                "quantity": 15.0, "unit": "kg",
                "serves_people": 42,
                "storage_condition": "hot",
                "pickup_deadline": now + timedelta(hours=4),
                "collection_start_time": now + timedelta(minutes=30),
                "is_vegetarian": True, "is_vegan": False, "is_halal": False, "is_kosher": False,
            },
            {
                "food_name": "Assorted Bread Loaves",
                "food_category": "bakery",
                "quantity": 8.0, "unit": "kg",
                "serves_people": 30,
                "storage_condition": "room_temperature",
                "pickup_deadline": now + timedelta(hours=12),
                "collection_start_time": now + timedelta(hours=1),
                "is_vegetarian": True, "is_vegan": True, "is_halal": False, "is_kosher": False,
            },
        ]
        for d in sample_donations:
            exists = await db.donations.find_one({"food_name": d["food_name"], "donor_org_id": donor_org_id})
            if exists:
                print(f"  ↳ Donation '{d['food_name']}' already exists")
                continue
            doc = {
                "donor_org_id": donor_org_id,
                "status": "available",
                "pickup_address": "Chandigarh University, NH-05",
                "pickup_city": "Mohali",
                "pickup_location": {"type": "Point", "coordinates": [76.5741, 30.7691]},
                "pickup_latitude": 30.7691,
                "pickup_longitude": 76.5741,
                "pickup_instructions": "Ask for kitchen manager at back entrance.",
                "allergens": [],
                "storage_notes": None,
                "description": None,
                "image_url": None,
                "created_at": now,
                "updated_at": now,
                **d,
            }
            await db.donations.insert_one(doc)
            print(f"  ✓ Created donation: {d['food_name']}")

    client.close()
    print("\n✅ Seed complete!")
    print("\nDemo credentials:")
    print("  Admin:     admin@foodrescue.ai  / Admin@1234")
    print("  Donor:     donor@greencanteen.in / Donor@1234")
    print("  Recipient: ngo@helphand.org     / Recip@1234")


if __name__ == "__main__":
    asyncio.run(seed())
