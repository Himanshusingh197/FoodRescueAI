from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth.jwt import decode_token, verify_token_payload
from app.database import get_db
from app.schemas.user import UserRole
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    payload = decode_token(token)
    user_id = verify_token_payload(payload)

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    user["id"] = str(user["_id"])
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


async def get_current_active_user(current_user=Depends(get_current_user)):
    return current_user


def require_role(*roles: UserRole):
    async def role_checker(current_user=Depends(get_current_user)):
        # Never trust role from client — always read from DB
        user_role = current_user.get("role")
        if user_role not in [r.value for r in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {[r.value for r in roles]}",
            )
        return current_user
    return role_checker


def require_donor():
    return require_role(UserRole.DONOR)


def require_recipient():
    return require_role(UserRole.RECIPIENT)


def require_admin():
    return require_role(UserRole.ADMIN)


def require_donor_or_admin():
    return require_role(UserRole.DONOR, UserRole.ADMIN)


def require_recipient_or_admin():
    return require_role(UserRole.RECIPIENT, UserRole.ADMIN)
