from fastapi import APIRouter, Depends, Query
from app.schemas.pickup import PickupCreate, DonorHandoverConfirm, RecipientCollectionConfirm, PickupCancellation
from app.schemas.common import ResponseModel, PaginatedResponse
from app.services.pickup_service import (
    create_pickup, donor_confirm_handover, recipient_confirm_collection,
    cancel_pickup, get_pickup, list_pickups,
)
from app.services.organization_service import get_organization_by_user
from app.auth.dependencies import get_current_user, require_donor, require_recipient
from fastapi import HTTPException

router = APIRouter(prefix="/pickups", tags=["Pickups"])


@router.post("", response_model=ResponseModel, status_code=201)
async def schedule_pickup(data: PickupCreate, current_user=Depends(require_donor())):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    pickup = await create_pickup(org["id"], data)
    return ResponseModel(success=True, message="Pickup scheduled", data=pickup)


@router.get("", response_model=PaginatedResponse)
async def list_my_pickups(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    role = current_user["role"]
    result = await list_pickups(org["id"], role, page, per_page)
    return PaginatedResponse(success=True, **result)


@router.get("/{pickup_id}", response_model=ResponseModel)
async def get_one(pickup_id: str, current_user=Depends(get_current_user)):
    pickup = await get_pickup(pickup_id)
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    # Only participants can view details
    authorized = org["id"] in [pickup["donor_org_id"], pickup["recipient_org_id"]]
    if not authorized and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return ResponseModel(success=True, data=pickup)


@router.post("/{pickup_id}/confirm-handover", response_model=ResponseModel)
async def confirm_handover(pickup_id: str, data: DonorHandoverConfirm, current_user=Depends(require_donor())):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    pickup = await donor_confirm_handover(pickup_id, org["id"], data)
    return ResponseModel(success=True, message="Handover confirmed", data=pickup)


@router.post("/{pickup_id}/confirm-collection", response_model=ResponseModel)
async def confirm_collection(pickup_id: str, data: RecipientCollectionConfirm, current_user=Depends(require_recipient())):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    pickup = await recipient_confirm_collection(pickup_id, org["id"], data)
    return ResponseModel(success=True, message="Collection confirmed", data=pickup)


@router.post("/{pickup_id}/cancel", response_model=ResponseModel)
async def cancel(pickup_id: str, data: PickupCancellation, current_user=Depends(get_current_user)):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    pickup = await cancel_pickup(pickup_id, org["id"], data)
    return ResponseModel(success=True, message="Pickup cancelled", data=pickup)
