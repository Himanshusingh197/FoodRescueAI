from pydantic import BaseModel, Field
from typing import Optional, Any, Dict
from datetime import datetime
from enum import Enum


class NotificationType(str, Enum):
    DONATION_AVAILABLE = "donation_available"
    DONATION_REQUESTED = "donation_requested"
    DONATION_ACCEPTED = "donation_accepted"
    DONATION_DECLINED = "donation_declined"
    PICKUP_SCHEDULED = "pickup_scheduled"
    PICKUP_CONFIRMED = "pickup_confirmed"
    DONATION_URGENT = "donation_urgent"
    DONATION_EXPIRING = "donation_expiring"
    ORG_VERIFIED = "org_verified"
    ORG_REJECTED = "org_rejected"
    SYSTEM = "system"


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    notification_type: NotificationType
    title: str
    message: str
    is_read: bool
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


class NotificationMarkRead(BaseModel):
    notification_ids: list[str]
