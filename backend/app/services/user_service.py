from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import HTTPException, status
from app.database import get_db
from app.auth.hashing import hash_password, verify_password
from app.auth.jwt import create_access_token
from app.schemas.user import UserCreate, UserLogin, UserUpdate, PasswordChange
import logging

logger = logging.getLogger(__name__)


def _serialize_user(user: dict) -> dict:
    user["id"] = str(user["_id"])
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


async def register_user(data: UserCreate) -> dict:
    db = get_db()
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user_doc = {
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "full_name": data.full_name,
        "role": data.role.value,
        "phone": data.phone,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "last_login": None,
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return _serialize_user(user_doc)


async def login_user(data: UserLogin) -> dict:
    db = get_db()
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}},
    )

    token = create_access_token({"sub": str(user["_id"]), "role": user["role"]})
    user["last_login"] = datetime.now(timezone.utc)
    return {"access_token": token, "token_type": "bearer", "user": _serialize_user(user)}


async def get_user_by_id(user_id: str) -> dict:
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _serialize_user(user)


async def update_user(user_id: str, data: UserUpdate) -> dict:
    db = get_db()
    updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if not updates:
        return await get_user_by_id(user_id)
    updates["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    return await get_user_by_id(user_id)


async def change_password(user_id: str, data: PasswordChange) -> bool:
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(data.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password_hash": hash_password(data.new_password), "updated_at": datetime.now(timezone.utc)}},
    )
    return True
