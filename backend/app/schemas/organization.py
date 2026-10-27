from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class OrgType(str, Enum):
    RESTAURANT = "restaurant"
    CANTEEN = "canteen"
    BAKERY = "bakery"
    HOTEL = "hotel"
    EVENT_ORGANIZER = "event_organizer"
    NGO = "ngo"
    SHELTER = "shelter"
    COMMUNITY_KITCHEN = "community_kitchen"
    OTHER = "other"


class VerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class GeoLocation(BaseModel):
    type: str = "Point"
    coordinates: List[float] = Field(..., description="[longitude, latitude]")

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(cls, v):
        if len(v) != 2:
            raise ValueError("Coordinates must be [longitude, latitude]")
        lon, lat = v
        if not (-180 <= lon <= 180):
            raise ValueError("Longitude must be between -180 and 180")
        if not (-90 <= lat <= 90):
            raise ValueError("Latitude must be between -90 and 90")
        return v


class OperatingHours(BaseModel):
    monday: Optional[str] = None
    tuesday: Optional[str] = None
    wednesday: Optional[str] = None
    thursday: Optional[str] = None
    friday: Optional[str] = None
    saturday: Optional[str] = None
    sunday: Optional[str] = None


class OrganizationCreate(BaseModel):
    org_name: str = Field(..., min_length=2, max_length=200)
    org_type: OrgType
    description: Optional[str] = Field(None, max_length=1000)
    address: str = Field(..., min_length=5, max_length=500)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    country: str = Field(..., min_length=2, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    website: Optional[str] = Field(None, max_length=200)
    registration_number: Optional[str] = Field(None, max_length=100)
    # recipient-specific
    food_types_accepted: Optional[List[str]] = None
    max_capacity_kg: Optional[float] = Field(None, ge=0)
    operating_hours: Optional[OperatingHours] = None
    # donor-specific
    avg_daily_surplus_kg: Optional[float] = Field(None, ge=0)


class OrganizationUpdate(BaseModel):
    org_name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    address: Optional[str] = Field(None, min_length=5, max_length=500)
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    state: Optional[str] = Field(None, min_length=2, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    website: Optional[str] = Field(None, max_length=200)
    food_types_accepted: Optional[List[str]] = None
    max_capacity_kg: Optional[float] = Field(None, ge=0)
    operating_hours: Optional[OperatingHours] = None
    avg_daily_surplus_kg: Optional[float] = Field(None, ge=0)


class OrganizationResponse(BaseModel):
    id: str
    user_id: str
    org_name: str
    org_type: OrgType
    description: Optional[str] = None
    address: str
    city: str
    state: str
    country: str
    postal_code: Optional[str] = None
    latitude: float
    longitude: float
    website: Optional[str] = None
    registration_number: Optional[str] = None
    verification_status: VerificationStatus
    food_types_accepted: Optional[List[str]] = None
    max_capacity_kg: Optional[float] = None
    operating_hours: Optional[OperatingHours] = None
    avg_daily_surplus_kg: Optional[float] = None
    created_at: datetime
    updated_at: datetime


class VerificationAction(BaseModel):
    action: str = Field(..., pattern="^(verify|reject|suspend)$")
    reason: Optional[str] = Field(None, max_length=500)
