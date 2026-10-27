"""
Password hashing using bcrypt directly.
passlib is incompatible with bcrypt >= 4.0 due to the 72-byte wrap-bug check.
"""
import bcrypt


def hash_password(password: str) -> str:
    """Hash a plain-text password and return the bcrypt hash as a string."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if plain_password matches the stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False
