from fastapi import APIRouter, Depends, Query, HTTPException
from app.schemas.common import ResponseModel
from app.services.analytics_service import get_donor_analytics, get_recipient_analytics, get_admin_analytics
from app.services.organization_service import get_organization_by_user
from app.auth.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/donor", response_model=ResponseModel)
async def donor_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user=Depends(get_current_user),
):
    if current_user["role"] not in ["donor", "admin"]:
        raise HTTPException(status_code=403, detail="Donor or admin access required")
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    data = await get_donor_analytics(org["id"], days)
    return ResponseModel(success=True, data=data)


@router.get("/recipient", response_model=ResponseModel)
async def recipient_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user=Depends(get_current_user),
):
    if current_user["role"] not in ["recipient", "admin"]:
        raise HTTPException(status_code=403, detail="Recipient or admin access required")
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    data = await get_recipient_analytics(org["id"], days)
    return ResponseModel(success=True, data=data)


@router.get("/admin", response_model=ResponseModel)
async def admin_analytics(
    days: int = Query(30, ge=1, le=365),
    _=Depends(require_admin()),
):
    data = await get_admin_analytics(days)
    return ResponseModel(success=True, data=data)
