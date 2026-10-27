from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import IndexModel, ASCENDING, DESCENDING, GEOSPHERE
from app.config import settings
import logging

logger = logging.getLogger(__name__)

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    await create_indexes()
    logger.info("Connected to MongoDB")


async def close_db():
    global client
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")


def get_db():
    return db


async def create_indexes():
    """Create indexes for all collections."""
    # users
    await db.users.create_index([("email", ASCENDING)], unique=True)
    await db.users.create_index([("role", ASCENDING)])

    # organizations
    await db.organizations.create_index([("user_id", ASCENDING)])
    await db.organizations.create_index([("org_type", ASCENDING)])
    await db.organizations.create_index([("verification_status", ASCENDING)])
    await db.organizations.create_index([("location", GEOSPHERE)])

    # donations
    await db.donations.create_index([("donor_org_id", ASCENDING)])
    await db.donations.create_index([("status", ASCENDING)])
    await db.donations.create_index([("food_category", ASCENDING)])
    await db.donations.create_index([("pickup_deadline", ASCENDING)])
    await db.donations.create_index([("created_at", DESCENDING)])
    await db.donations.create_index([("pickup_location", GEOSPHERE)])

    # donation_requests
    await db.donation_requests.create_index([("donation_id", ASCENDING)])
    await db.donation_requests.create_index([("recipient_org_id", ASCENDING)])
    await db.donation_requests.create_index([("status", ASCENDING)])

    # pickups
    await db.pickups.create_index([("donation_id", ASCENDING)])
    await db.pickups.create_index([("donor_org_id", ASCENDING)])
    await db.pickups.create_index([("recipient_org_id", ASCENDING)])

    # notifications
    await db.notifications.create_index([("user_id", ASCENDING)])
    await db.notifications.create_index([("is_read", ASCENDING)])
    await db.notifications.create_index([("created_at", DESCENDING)])

    # surplus_predictions
    await db.surplus_predictions.create_index([("org_id", ASCENDING)])
    await db.surplus_predictions.create_index([("prediction_date", DESCENDING)])

    # impact_records
    await db.impact_records.create_index([("org_id", ASCENDING)])
    await db.impact_records.create_index([("recorded_at", DESCENDING)])

    logger.info("Database indexes created")
