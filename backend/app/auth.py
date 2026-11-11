"""Role-Based Access Control (RBAC), Password Hashing, Rate Limiting, Session Management, and JWT/Cookie Verification."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
import time
from typing import Dict, List, Optional, Tuple
import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import AuditLog, User, UserRole, UserSession

COOKIE_NAME = "parkwise_session"
security_scheme = HTTPBearer(auto_error=False)

ROLE_PERMISSIONS_MAP: Dict[UserRole, List[str]] = {
    UserRole.DRIVER: [
        "booking:create",
        "booking:read",
        "booking:cancel",
        "booking:extend",
        "vehicle:manage",
        "profile:manage",
    ],
    UserRole.OPERATOR: [
        "booking:read",
        "slot:override",
        "pricing:surge",
        "ai:forecast",
        "lot:manage",
        "profile:manage",
    ],
    UserRole.GATE_STAFF: [
        "gate:scan",
        "gate:logs",
        "gate:override",
        "booking:read",
        "profile:manage",
    ],
    UserRole.ADMIN: [
        "booking:create",
        "booking:read",
        "booking:cancel",
        "booking:extend",
        "vehicle:manage",
        "profile:manage",
        "slot:override",
        "pricing:surge",
        "ai:forecast",
        "lot:manage",
        "gate:scan",
        "gate:logs",
        "gate:override",
        "admin:users",
        "admin:roles",
        "admin:audit",
        "admin:deactivate",
    ],
}


def get_permissions_for_role(role: UserRole) -> List[str]:
    return list(ROLE_PERMISSIONS_MAP.get(role, []))


class SlidingWindowRateLimiter:
    """In-memory sliding-window rate limiter for brute-force & abuse protection."""

    def __init__(self) -> None:
        self._buckets: Dict[str, List[float]] = defaultdict(list)

    def check_rate_limit(
        self,
        bucket: str,
        identifier: str,
        max_requests: int = 8,
        window_seconds: int = 60,
    ) -> None:
        now = time.monotonic()
        key = f"{bucket}:{identifier.lower().strip()}"
        cutoff = now - window_seconds
        timestamps = [t for t in self._buckets[key] if t > cutoff]
        if len(timestamps) >= max_requests:
            self._buckets[key] = timestamps
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Rate limit exceeded for {bucket}. Maximum {max_requests} requests "
                    f"per {window_seconds} seconds. Please wait before retrying."
                ),
            )
        timestamps.append(now)
        self._buckets[key] = timestamps

    def reset(self) -> None:
        self._buckets.clear()


auth_rate_limiter = SlidingWindowRateLimiter()


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


def create_access_token(
    user: User,
    db: Optional[Session] = None,
    ip_address: str = "127.0.0.1",
    user_agent: str = "Parkwise-Enterprise-Web/2.4",
    device_label: str = "Web Browser Session",
) -> Tuple[str, str]:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    jti = f"sess_{secrets.token_hex(16)}"

    if db is not None:
        session_record = UserSession(
            user_id=user.id,
            session_token_jti=jti,
            ip_address=ip_address,
            user_agent=user_agent[:250],
            device_label=device_label[:115],
            is_revoked=False,
            created_at=now,
            expires_at=expire,
            last_active_at=now,
        )
        db.add(session_record)
        db.commit()

    payload = {
        "sub": user.email,
        "user_id": user.id,
        "role": user.role.value,
        "name": user.full_name,
        "jti": jti,
        "permissions": get_permissions_for_role(user.role),
        "exp": expire,
    }
    encoded = jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded, jti


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")


def extract_token_from_request(
    request: Optional[Request],
    credentials: Optional[HTTPAuthorizationCredentials],
) -> Optional[str]:
    if credentials and credentials.credentials:
        return credentials.credentials
    if request is not None:
        cookie_token = request.cookies.get(COOKIE_NAME)
        if cookie_token:
            return cookie_token
    return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    raw_token = extract_token_from_request(request, credentials)
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required.",
        )
    try:
        payload = jwt.decode(
            raw_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        email: Optional[str] = payload.get("sub")
        jti: Optional[str] = payload.get("jti")
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

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated.",
        )

    if jti:
        session_row = (
            db.query(UserSession)
            .filter(UserSession.session_token_jti == jti)
            .first()
        )
        if session_row and session_row.is_revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has been logged out or revoked.",
            )
        if session_row:
            session_row.last_active_at = datetime.now(timezone.utc)
            db.commit()

    return user


def require_roles(allowed_roles: List[UserRole]):
    """Enforce Role-Based Access Control (RBAC) on protected endpoints."""

    async def role_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if current_user.role not in allowed_roles:
            db.add(
                AuditLog(
                    actor_email=current_user.email,
                    actor_role=current_user.role.value,
                    action="RBAC_ACCESS_DENIED",
                    target_resource=f"Required Roles: {[r.value for r in allowed_roles]}",
                    details=f"User with role {current_user.role.value} was denied access.",
                )
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role.value}' is not authorized. Required: {[r.value for r in allowed_roles]}",
            )
        return current_user

    return role_checker


def require_permission(permission_code: str):
    """Enforce granular permission check on protected endpoints."""

    async def permission_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        granted = get_permissions_for_role(current_user.role)
        if permission_code not in granted:
            db.add(
                AuditLog(
                    actor_email=current_user.email,
                    actor_role=current_user.role.value,
                    action="PERMISSION_DENIED",
                    target_resource=permission_code,
                    details=f"Role {current_user.role.value} lacks permission '{permission_code}'.",
                )
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: '{permission_code}'.",
            )
        return current_user

    return permission_checker
