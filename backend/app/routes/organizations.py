from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.schemas.organization import OrganizationCreate, OrganizationUpdate, VerificationAction
from app.schemas.common import ResponseModel, PaginatedResponse
from app.services.organization_service import (
    create_organization, get_organization_by_user, get_organization_by_id,
    update_organization, admin_verify_organization, list_organizations,
)
from app.auth.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.post("", response_model=ResponseModel, status_code=201)
async def register_org(data: OrganizationCreate, current_user=Depends(get_current_user)):
    org = await create_organization(current_user["id"], data)
    return ResponseModel(success=True, message="Organization registered. Pending admin verification.", data=org)


@router.get("/my", response_model=ResponseModel)
async def get_my_org(current_user=Depends(get_current_user)):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        return ResponseModel(success=False, message="No organization registered", data=None)
    return ResponseModel(success=True, data=org)


@router.get("", response_model=PaginatedResponse)
async def list_orgs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    org_type: Optional[str] = None,
    verification_status: Optional[str] = None,
    city: Optional[str] = None,
    _=Depends(require_admin()),
):
    result = await list_organizations(page, per_page, org_type, verification_status, city)
    return PaginatedResponse(success=True, **result)


@router.get("/{org_id}", response_model=ResponseModel)
async def get_org(org_id: str, current_user=Depends(get_current_user)):
    org = await get_organization_by_id(org_id)
    return ResponseModel(success=True, data=org)


@router.put("/{org_id}", response_model=ResponseModel)
async def update_org(org_id: str, data: OrganizationUpdate, current_user=Depends(get_current_user)):
    org = await update_organization(org_id, current_user["id"], data)
    return ResponseModel(success=True, message="Organization updated", data=org)


@router.post("/{org_id}/verify", response_model=ResponseModel)
async def verify_org(org_id: str, data: VerificationAction, _=Depends(require_admin())):
    org = await admin_verify_organization(org_id, data.action, data.reason)
    return ResponseModel(success=True, message=f"Organization {data.action}d successfully", data=org)
