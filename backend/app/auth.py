"""Role-Based Access Control (RBAC), Password Hashing, and JWT Verification."""
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
from typing import List, Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User, UserRole

security_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    ).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        scheme, salt, expected_digest = hashed_password.split("$", 2)
        if scheme != "pbkdf2_sha256":
            return False
        computed = hashlib.pbkdf2_hmac(
            "sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100_000
        ).hex()
        return hmac.compare_digest(computed, expected_digest)
    except Exception:
        return False


def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": user.email,
        "user_id": user.id,
        "role": user.role.value,
        "name": user.full_name,
        "exp": expire,
    }
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required.",
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        email: Optional[str] = payload.get("sub")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload.",
            )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        ) from exc

    user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or inactive.",
        )
    return user


def require_roles(allowed_roles: List[UserRole]):
    """Enforce Role-Based Access Control (RBAC) on protected endpoints."""

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role.value}' is not authorized. Required: {[r.value for r in allowed_roles]}",
            )
        return current_user

    return role_checker
