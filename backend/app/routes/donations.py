from fastapi import APIRouter, Depends, Query, UploadFile, File
from typing import Optional
from app.schemas.donation import DonationCreate, DonationUpdate, DonationRequestCreate
from app.schemas.common import ResponseModel, PaginatedResponse
from app.services.donation_service import (
    create_donation, get_donation, update_donation, cancel_donation,
    list_donations, create_donation_request, respond_to_request,
)
from app.services.organization_service import get_organization_by_user
from app.auth.dependencies import get_current_user, require_donor, require_recipient
from app.matching.engine import get_recommendations
from fastapi import HTTPException
import os, aiofiles
from app.config import settings
from bson import ObjectId
from app.database import get_db

router = APIRouter(prefix="/donations", tags=["Donations"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("", response_model=ResponseModel, status_code=201)
async def create(data: DonationCreate, current_user=Depends(require_donor())):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="Register an organization first")
    if org["verification_status"] != "verified":
        raise HTTPException(status_code=403, detail="Organization must be verified to create donations")
    donation = await create_donation(org["id"], data)
    return ResponseModel(success=True, message="Donation created", data=donation)


@router.get("", response_model=PaginatedResponse)
async def list_all(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    food_category: Optional[str] = None,
    city: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: Optional[float] = Query(None, ge=0.1, le=500),
    is_vegetarian: Optional[bool] = None,
    is_vegan: Optional[bool] = None,
    is_halal: Optional[bool] = None,
    current_user=Depends(get_current_user),
):
    result = await list_donations(
        page=page, per_page=per_page, status=status, food_category=food_category,
        city=city, latitude=latitude, longitude=longitude, radius_km=radius_km,
        is_vegetarian=is_vegetarian, is_vegan=is_vegan, is_halal=is_halal,
    )
    return PaginatedResponse(success=True, **result)


@router.get("/my", response_model=PaginatedResponse)
async def my_donations(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    current_user=Depends(require_donor()),
):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    result = await list_donations(page=page, per_page=per_page, status=status, donor_org_id=org["id"])
    return PaginatedResponse(success=True, **result)


@router.get("/{donation_id}", response_model=ResponseModel)
async def get_one(donation_id: str, current_user=Depends(get_current_user)):
    donation = await get_donation(donation_id)
    return ResponseModel(success=True, data=donation)


@router.put("/{donation_id}", response_model=ResponseModel)
async def update(donation_id: str, data: DonationUpdate, current_user=Depends(require_donor())):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    donation = await update_donation(donation_id, org["id"], data)
    return ResponseModel(success=True, message="Donation updated", data=donation)


@router.delete("/{donation_id}", response_model=ResponseModel)
async def cancel(donation_id: str, current_user=Depends(require_donor())):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    donation = await cancel_donation(donation_id, org["id"])
    return ResponseModel(success=True, message="Donation cancelled", data=donation)


@router.post("/{donation_id}/upload-image", response_model=ResponseModel)
async def upload_image(
    donation_id: str,
    file: UploadFile = File(...),
    current_user=Depends(require_donor()),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed")

    # Read and validate size
    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Image too large. Max {settings.MAX_UPLOAD_SIZE_MB} MB")

    org = await get_organization_by_user(current_user["id"])
    donation = await get_donation(donation_id)
    if donation["donor_org_id"] != org["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    filename = f"{donation_id}.{ext}"
    upload_path = os.path.join(settings.UPLOAD_DIR, filename)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    async with aiofiles.open(upload_path, "wb") as f:
        await f.write(content)

    db = get_db()
    image_url = f"/uploads/{filename}"
    await db.donations.update_one(
        {"_id": ObjectId(donation_id)},
        {"$set": {"image_url": image_url}},
    )
    return ResponseModel(success=True, message="Image uploaded", data={"image_url": image_url})


@router.get("/{donation_id}/recommendations", response_model=ResponseModel)
async def recommendations(donation_id: str, current_user=Depends(get_current_user)):
    recs = await get_recommendations(donation_id)
    return ResponseModel(success=True, data={"recommendations": recs, "count": len(recs)})


@router.post("/{donation_id}/request", response_model=ResponseModel, status_code=201)
async def request_donation(donation_id: str, data: DonationRequestCreate, current_user=Depends(require_recipient())):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="Register an organization first")
    if org["verification_status"] != "verified":
        raise HTTPException(status_code=403, detail="Organization must be verified to request donations")
    data.donation_id = donation_id
    req = await create_donation_request(org["id"], data)
    return ResponseModel(success=True, message="Request submitted", data=req)


@router.post("/requests/{request_id}/respond", response_model=ResponseModel)
async def respond_request(
    request_id: str,
    action: str = Query(..., pattern="^(accept|decline)$"),
    reason: Optional[str] = None,
    current_user=Depends(require_donor()),
):
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    req = await respond_to_request(request_id, org["id"], action, reason)
    return ResponseModel(success=True, message=f"Request {action}d", data=req)


@router.get("/{donation_id}/requests", response_model=ResponseModel)
async def get_donation_requests(donation_id: str, current_user=Depends(require_donor())):
    db = get_db()
    org = await get_organization_by_user(current_user["id"])
    if not org:
        raise HTTPException(status_code=400, detail="No organization registered")
    donation = await get_donation(donation_id)
    if donation["donor_org_id"] != org["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    cursor = db.donation_requests.find({"donation_id": donation_id})
    requests = []
    async for r in cursor:
        r["id"] = str(r["_id"])
        r.pop("_id", None)
        # Enrich with recipient org name
        try:
            recip_org = await db.organizations.find_one({"_id": ObjectId(r["recipient_org_id"])})
            r["recipient_org_name"] = recip_org["org_name"] if recip_org else ""
        except Exception:
            r["recipient_org_name"] = ""
        requests.append(r)
    return ResponseModel(success=True, data=requests)
