from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from app.schemas.common import ResponseModel, PaginatedResponse
from app.auth.dependencies import require_admin
from app.database import get_db
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=PaginatedResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    _=Depends(require_admin()),
):
    db = get_db()
    query = {}
    if role:
        query["role"] = role
    if is_active is not None:
        query["is_active"] = is_active
    total = await db.users.count_documents(query)
    skip = (page - 1) * per_page
    users = []
    async for u in db.users.find(query, {"password_hash": 0}).skip(skip).limit(per_page):
        u["id"] = str(u["_id"])
        u.pop("_id", None)
        users.append(u)
    return PaginatedResponse(success=True, data=users, total=total, page=page, per_page=per_page,
                             total_pages=max(1, (total + per_page - 1) // per_page))


@router.post("/users/{user_id}/suspend", response_model=ResponseModel)
async def suspend_user(user_id: str, _=Depends(require_admin())):
    db = get_db()
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return ResponseModel(success=True, message="User suspended")


@router.post("/users/{user_id}/activate", response_model=ResponseModel)
async def activate_user(user_id: str, _=Depends(require_admin())):
    db = get_db()
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return ResponseModel(success=True, message="User activated")


@router.get("/donations", response_model=PaginatedResponse)
async def all_donations(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    _=Depends(require_admin()),
):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    total = await db.donations.count_documents(query)
    skip = (page - 1) * per_page
    donations = []
    async for d in db.donations.find(query).sort("created_at", -1).skip(skip).limit(per_page):
        d["id"] = str(d["_id"])
        d.pop("_id", None)
        donations.append(d)
    return PaginatedResponse(success=True, data=donations, total=total, page=page, per_page=per_page,
                             total_pages=max(1, (total + per_page - 1) // per_page))


@router.delete("/donations/{donation_id}", response_model=ResponseModel)
async def admin_cancel_donation(donation_id: str, reason: str = "Removed by admin", _=Depends(require_admin())):
    db = get_db()
    result = await db.donations.update_one(
        {"_id": ObjectId(donation_id)},
        {"$set": {"status": "cancelled", "cancellation_reason": reason, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Donation not found")
    return ResponseModel(success=True, message="Donation cancelled by admin")
