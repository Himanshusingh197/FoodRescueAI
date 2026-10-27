from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class FoodCategory(str, Enum):
    COOKED_MEALS = "cooked_meals"
    BAKERY = "bakery"
    DAIRY = "dairy"
    FRUITS_VEGETABLES = "fruits_vegetables"
    GRAINS_CEREALS = "grains_cereals"
    BEVERAGES = "beverages"
    PACKAGED_FOOD = "packaged_food"
    SNACKS = "snacks"
    OTHER = "other"


class DonationStatus(str, Enum):
    AVAILABLE = "available"
    REQUESTED = "requested"
    ACCEPTED = "accepted"
    READY_FOR_PICKUP = "ready_for_pickup"
    COLLECTED = "collected"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class StorageCondition(str, Enum):
    ROOM_TEMPERATURE = "room_temperature"
    REFRIGERATED = "refrigerated"
    FROZEN = "frozen"
    HOT = "hot"


class DonationCreate(BaseModel):
    food_name: str = Field(..., min_length=2, max_length=200)
    food_category: FoodCategory
    description: Optional[str] = Field(None, max_length=1000)
    quantity: float = Field(..., gt=0, le=10000)
    unit: str = Field(..., min_length=1, max_length=20)
    serves_people: Optional[int] = Field(None, ge=1)
    preparation_time: Optional[datetime] = None
    storage_condition: StorageCondition = StorageCondition.ROOM_TEMPERATURE
    storage_notes: Optional[str] = Field(None, max_length=500)
    allergens: Optional[List[str]] = None
    pickup_address: str = Field(..., min_length=5, max_length=500)
    pickup_city: str = Field(..., min_length=2, max_length=100)
    pickup_latitude: float = Field(..., ge=-90, le=90)
    pickup_longitude: float = Field(..., ge=-180, le=180)
    pickup_instructions: Optional[str] = Field(None, max_length=500)
    collection_start_time: datetime
    pickup_deadline: datetime
    is_vegetarian: bool = False
    is_vegan: bool = False
    is_halal: bool = False
    is_kosher: bool = False
    donor_confirms_accuracy: bool = Field(..., description="Donor must confirm food info accuracy")

    @field_validator("pickup_deadline")
    @classmethod
    def deadline_must_be_future(cls, v):
        from datetime import timezone as tz
        now = datetime.now(tz.utc)
        # Normalise naive datetimes to UTC
        if v.tzinfo is None:
            v = v.replace(tzinfo=tz.utc)
        if v <= now:
            raise ValueError("Pickup deadline must be in the future")
        return v

    @field_validator("donor_confirms_accuracy")
    @classmethod
    def must_confirm(cls, v):
        if not v:
            raise ValueError("Donor must confirm accuracy of food information")
        return v


class DonationUpdate(BaseModel):
    food_name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    quantity: Optional[float] = Field(None, gt=0, le=10000)
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    serves_people: Optional[int] = Field(None, ge=1)
    storage_notes: Optional[str] = Field(None, max_length=500)
    allergens: Optional[List[str]] = None
    pickup_instructions: Optional[str] = Field(None, max_length=500)
    pickup_deadline: Optional[datetime] = None


class DonationResponse(BaseModel):
    id: str
    donor_org_id: str
    donor_org_name: Optional[str] = None
    food_name: str
    food_category: FoodCategory
    description: Optional[str] = None
    quantity: float
    unit: str
    serves_people: Optional[int] = None
    preparation_time: Optional[datetime] = None
    storage_condition: StorageCondition
    storage_notes: Optional[str] = None
    allergens: Optional[List[str]] = None
    pickup_address: str
    pickup_city: str
    pickup_latitude: float
    pickup_longitude: float
    pickup_instructions: Optional[str] = None
    collection_start_time: datetime
    pickup_deadline: datetime
    status: DonationStatus
    image_url: Optional[str] = None
    is_vegetarian: bool
    is_vegan: bool
    is_halal: bool
    is_kosher: bool
    created_at: datetime
    updated_at: datetime


class DonationFilter(BaseModel):
    status: Optional[DonationStatus] = None
    food_category: Optional[FoodCategory] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = Field(None, ge=0.1, le=500)
    is_vegetarian: Optional[bool] = None
    is_vegan: Optional[bool] = None
    is_halal: Optional[bool] = None


class RequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class DonationRequestCreate(BaseModel):
    donation_id: str
    message: Optional[str] = Field(None, max_length=500)
    proposed_pickup_time: Optional[datetime] = None


class DonationRequestResponse(BaseModel):
    id: str
    donation_id: str
    recipient_org_id: str
    recipient_org_name: Optional[str] = None
    status: RequestStatus
    message: Optional[str] = None
    proposed_pickup_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
