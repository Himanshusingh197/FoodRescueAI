from fastapi import APIRouter, Depends, Query
from app.schemas.notification import NotificationMarkRead
from app.schemas.common import ResponseModel, PaginatedResponse
from app.services.notification_service import (
    get_user_notifications, mark_notifications_read, mark_all_read,
)
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=PaginatedResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    current_user=Depends(get_current_user),
):
    result = await get_user_notifications(current_user["id"], page, per_page, unread_only)
    return PaginatedResponse(success=True, **result)


@router.post("/mark-read", response_model=ResponseModel)
async def mark_read(data: NotificationMarkRead, current_user=Depends(get_current_user)):
    count = await mark_notifications_read(current_user["id"], data.notification_ids)
    return ResponseModel(success=True, message=f"{count} notifications marked as read")


@router.post("/mark-all-read", response_model=ResponseModel)
async def mark_all(current_user=Depends(get_current_user)):
    count = await mark_all_read(current_user["id"])
    return ResponseModel(success=True, message=f"{count} notifications marked as read")
