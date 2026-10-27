from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class PickupStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    DONOR_CONFIRMED = "donor_confirmed"
    RECIPIENT_CONFIRMED = "recipient_confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PickupCreate(BaseModel):
    donation_id: str
    request_id: str
    agreed_pickup_time: datetime


class PickupUpdate(BaseModel):
    agreed_pickup_time: Optional[datetime] = None
    pickup_instructions: Optional[str] = Field(None, max_length=500)


class DonorHandoverConfirm(BaseModel):
    actual_quantity_handed: float = Field(..., gt=0)
    handover_notes: Optional[str] = Field(None, max_length=500)


class RecipientCollectionConfirm(BaseModel):
    actual_quantity_received: float = Field(..., gt=0)
    collection_notes: Optional[str] = Field(None, max_length=500)
    quality_rating: Optional[int] = Field(None, ge=1, le=5)


class PickupCancellation(BaseModel):
    cancelled_by: str
    reason: str = Field(..., min_length=5, max_length=500)


class PickupResponse(BaseModel):
    id: str
    donation_id: str
    donor_org_id: str
    recipient_org_id: str
    request_id: str
    reference_code: str
    status: PickupStatus
    agreed_pickup_time: datetime
    pickup_instructions: Optional[str] = None
    donor_confirmed_at: Optional[datetime] = None
    actual_quantity_handed: Optional[float] = None
    recipient_confirmed_at: Optional[datetime] = None
    actual_quantity_received: Optional[float] = None
    quantity_discrepancy: Optional[float] = None
    quality_rating: Optional[int] = None
    collection_notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
