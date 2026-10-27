from fastapi import APIRouter, Depends
from app.schemas.user import UserCreate, UserLogin, UserUpdate, PasswordChange, TokenResponse, UserResponse
from app.schemas.common import ResponseModel
from app.services.user_service import register_user, login_user, update_user, change_password
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=ResponseModel, status_code=201)
async def register(data: UserCreate):
    user = await register_user(data)
    return ResponseModel(success=True, message="Registration successful", data=user)


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    return await login_user(data)


@router.get("/me", response_model=ResponseModel)
async def get_me(current_user=Depends(get_current_user)):
    current_user.pop("password_hash", None)
    return ResponseModel(success=True, data=current_user)


@router.put("/me", response_model=ResponseModel)
async def update_me(data: UserUpdate, current_user=Depends(get_current_user)):
    updated = await update_user(current_user["id"], data)
    return ResponseModel(success=True, message="Profile updated", data=updated)


@router.post("/change-password", response_model=ResponseModel)
async def change_pwd(data: PasswordChange, current_user=Depends(get_current_user)):
    await change_password(current_user["id"], data)
    return ResponseModel(success=True, message="Password changed successfully")
