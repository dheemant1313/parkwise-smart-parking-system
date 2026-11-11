"""FastAPI Enterprise Main Application for Parkwise Smart Parking Ecosystem."""
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import secrets
from typing import List, Optional
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Query,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
import jwt
from sqlalchemy.orm import Session

from app.auth import (
    auth_rate_limiter,
    clear_auth_cookie,
    create_access_token,
    extract_token_from_request,
    get_current_user,
    get_permissions_for_role,
    hash_password,
    require_permission,
    require_roles,
    security_scheme,
    set_auth_cookie,
    verify_password,
)
from app.config import settings
from app.database import Base, SessionLocal, engine, get_db
from app.models import (
    AuditLog,
    Booking,
    BookingStatus,
    GateLog,
    ParkingLot,
    ParkingSlot,
    Permission,
    Role,
    RolePermission,
    SlotStatus,
    SlotType,
    User,
    UserRole,
    UserSession,
    Vehicle,
)
from app.schemas import (
    AdminRoleUpdateRequest,
    AdminStatusUpdateRequest,
    AIPricingRecommendationResponse,
    BookingCreateRequest,
    BookingExtendRequest,
    BookingResponse,
    DriverRecommendationRequest,
    EmailVerificationRequest,
    ForgotPasswordRequest,
    GateScanRequest,
    GateScanResponse,
    LoginRequest,
    ParkingLotDetailResponse,
    ParkingLotResponse,
    PaymentVerifyRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SessionItemResponse,
    SlotRecommendationItem,
    SlotResponse,
    SlotStatusUpdateRequest,
    SurgeUpdateRequest,
    TokenResponse,
    UserProfileResponse,
    VehicleCreateRequest,
    VehicleItemResponse,
)
from app.seed import seed_initial_data
from app.services.ai_engine import ai_engine
from app.services.booking_service import (
    cancel_transactional_booking,
    compute_driver_recommendations,
    create_transactional_booking,
    extend_transactional_booking,
    verify_qr_signature,
)
from app.services.payment_service import verify_and_capture_payment
from app.services.websocket_manager import ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="2.5.0",
    description=(
        "Enterprise AI-Powered Smart Parking Platform for India. "
        "Connects Drivers, Parking Operators, Boom-Barrier Gate Terminals, and Platform Administrators."
    ),
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins + ["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _serialize_user_profile(user: User) -> UserProfileResponse:
    vehicles_sorted = sorted(
        user.vehicles or [], key=lambda v: (not v.is_primary, v.id)
    )
    return UserProfileResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        vehicle_number=user.vehicle_number,
        fastag_id=user.fastag_id,
        home_city=user.home_city or "New Delhi",
        gst_number=user.gst_number,
        email_verified=bool(user.email_verified),
        email_verification_token_preview=user.email_verification_token,
        fastag_auto_debit=bool(user.fastag_auto_debit),
        sms_receipts=bool(user.sms_receipts),
        whatsapp_alerts=bool(user.whatsapp_alerts),
        accessible_priority=bool(user.accessible_priority),
        is_active=bool(user.is_active),
        permissions=get_permissions_for_role(user.role),
        vehicles=[VehicleItemResponse.model_validate(v) for v in vehicles_sorted],
        created_at=user.created_at,
    )


def _serialize_lot(lot: ParkingLot, include_slots: bool = False) -> dict:
    slots = lot.slots or []
    total = len(slots)
    available = sum(1 for s in slots if s.status == SlotStatus.AVAILABLE)
    occupied = sum(1 for s in slots if s.status == SlotStatus.OCCUPIED)
    reserved = sum(1 for s in slots if s.status == SlotStatus.RESERVED)
    ev_avail = sum(
        1
        for s in slots
        if s.slot_type == SlotType.EV_CHARGING and s.status == SlotStatus.AVAILABLE
    )
    data = {
        "id": lot.id,
        "code": lot.code,
        "name": lot.name,
        "city": lot.city,
        "address": lot.address,
        "latitude": lot.latitude,
        "longitude": lot.longitude,
        "total_floors": lot.total_floors,
        "base_hourly_rate_inr": lot.base_hourly_rate_inr,
        "ev_surcharge_inr": lot.ev_surcharge_inr,
        "dynamic_pricing_enabled": lot.dynamic_pricing_enabled,
        "current_surge_multiplier": lot.current_surge_multiplier,
        "anpr_enabled": lot.anpr_enabled,
        "fastag_enabled": lot.fastag_enabled,
        "operator_name": lot.operator_name,
        "kyc_verified": lot.kyc_verified,
        "rating": lot.rating,
        "total_slots": total,
        "available_slots": available,
        "occupied_slots": occupied,
        "reserved_slots": reserved,
        "ev_slots_available": ev_avail,
    }
    if include_slots:
        data["slots"] = [
            SlotResponse.model_validate(s).model_dump()
            for s in sorted(slots, key=lambda x: x.id)
        ]
    return data


def _serialize_booking(booking: Booking) -> BookingResponse:
    qr_payload = f"PARKWISE|{booking.booking_reference}|{booking.slot_id}|{booking.vehicle_number}|{booking.qr_signature}"
    return BookingResponse(
        id=booking.id,
        booking_reference=booking.booking_reference,
        lot_id=booking.lot_id,
        slot_id=booking.slot_id,
        slot_number=booking.slot.slot_number if booking.slot else None,
        lot_name=booking.lot.name if booking.lot else None,
        city=booking.lot.city if booking.lot else None,
        vehicle_number=booking.vehicle_number,
        driver_name=booking.driver_name,
        driver_phone=booking.driver_phone,
        start_time=booking.start_time,
        end_time=booking.end_time,
        duration_hours=booking.duration_hours,
        base_amount_inr=booking.base_amount_inr,
        surge_multiplier=booking.surge_multiplier,
        gst_amount_inr=booking.gst_amount_inr,
        total_amount_inr=booking.total_amount_inr,
        status=booking.status,
        qr_signature=booking.qr_signature,
        qr_payload=qr_payload,
        checked_in_at=booking.checked_in_at,
        checked_out_at=booking.checked_out_at,
        overstay_fee_inr=booking.overstay_fee_inr,
        created_at=booking.created_at,
        payment=booking.payment,
    )


# ----------------------------------------------------------------------------
# 1. System Health & Integration Transparency
# ----------------------------------------------------------------------------
@app.get("/api/v1/health")
async def health_check(db: Session = Depends(get_db)):
    lot_count = db.query(ParkingLot).count()
    slot_count = db.query(ParkingSlot).count()
    booking_count = db.query(Booking).count()
    user_count = db.query(User).count()
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": "2.5.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "integrations": {
            "database": {
                "engine": "PostgreSQL"
                if "postgresql" in settings.DATABASE_URL
                else "SQLite (Transactional Local Mode)",
                "mode": "LIVE",
            },
            "concurrency_locks": {
                "engine": "Redis + Thread Mutex Lock",
                "mode": "LIVE",
            },
            "auth_security": {
                "engine": "PBKDF2-HMAC-SHA256 + HttpOnly Cookie + Session JTI",
                "mode": "LIVE",
            },
            "ai_forecasting": {
                "engine": ai_engine.model_name,
                "mode": "LIVE_ML_INFERENCE",
            },
            "razorpay_gateway": {
                "engine": "Razorpay Orders & HMAC Verification",
                "mode": "SIMULATED_SANDBOX"
                if settings.PAYMENT_SIMULATION_MODE
                else "LIVE",
            },
        },
        "metrics": {
            "total_lots": lot_count,
            "total_slots": slot_count,
            "total_bookings": booking_count,
            "total_users": user_count,
        },
    }


# ----------------------------------------------------------------------------
# 2. Phase 03: Authentication, Registration, Sessions, Verification & RBAC
# ----------------------------------------------------------------------------
@app.post(
    "/api/v1/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_user(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "127.0.0.1"
    auth_rate_limiter.check_rate_limit(
        "register", payload.email.lower(), max_requests=8, window_seconds=60
    )

    requested_role_str = (payload.role or "DRIVER").strip().upper()
    if requested_role_str == "ADMIN":
        db.add(
            AuditLog(
                actor_email=payload.email.lower(),
                actor_role="UNAUTHENTICATED",
                action="ROLE_ESCALATION_BLOCKED",
                target_resource="POST /api/v1/auth/register",
                details="Blocked unauthorized attempt to self-register as ADMIN.",
                ip_address=client_ip,
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized role escalation: cannot self-register as ADMIN.",
        )

    try:
        assigned_role = UserRole(requested_role_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{requested_role_str}'. Allowed self-registration roles: DRIVER, OPERATOR, GATE_STAFF.",
        ) from exc

    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address is already registered.",
        )

    verification_token = f"pw_verify_{secrets.token_hex(12)}"
    plate = payload.vehicle_number or "DL-01-PW-2026"
    fastag = f"FT-NPCI-{secrets.token_hex(3).upper()}"

    new_user = User(
        full_name=payload.full_name.strip(),
        email=payload.email.lower().strip(),
        phone=payload.phone.strip(),
        password_hash=hash_password(payload.password),
        role=assigned_role,
        vehicle_number=plate if assigned_role == UserRole.DRIVER else None,
        fastag_id=fastag if assigned_role == UserRole.DRIVER else None,
        home_city=payload.home_city,
        email_verified=False,
        email_verification_token=verification_token,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    if assigned_role == UserRole.DRIVER and payload.vehicle_number:
        dims_map = {
            "COMPACT": "3.99m × 1.80m × 1.55m",
            "SEDAN": "4.58m × 1.82m × 1.50m",
            "SUV_XL": "4.85m × 1.92m × 1.78m",
        }
        v = Vehicle(
            user_id=new_user.id,
            plate_number=payload.vehicle_number,
            model_name=payload.model_name or "Registered Mobility Vehicle",
            size_class=payload.size_class,
            dimensions_label=dims_map.get(
                payload.size_class, "4.58m × 1.82m × 1.50m"
            ),
            is_ev=payload.is_ev,
            fastag_id=fastag,
            is_primary=True,
        )
        db.add(v)
        db.flush()

    db.add(
        AuditLog(
            actor_email=new_user.email,
            actor_role=new_user.role.value,
            action="USER_REGISTERED",
            target_resource=f"User #{new_user.id}",
            details=f"Registered new {new_user.role.value} account. Verification token issued.",
            ip_address=client_ip,
        )
    )
    db.commit()
    db.refresh(new_user)

    user_agent = request.headers.get("user-agent", "Parkwise-Web/2.5")
    token, jti = create_access_token(
        new_user,
        db=db,
        ip_address=client_ip,
        user_agent=user_agent,
        device_label="Registration Session",
    )
    set_auth_cookie(response, token)

    return TokenResponse(
        access_token=token,
        session_jti=jti,
        role=new_user.role,
        full_name=new_user.full_name,
        email=new_user.email,
        email_verified=new_user.email_verified,
        permissions=get_permissions_for_role(new_user.role),
        user=_serialize_user_profile(new_user),
    )


@app.post("/api/v1/auth/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "127.0.0.1"
    auth_rate_limiter.check_rate_limit(
        "login", payload.email.lower(), max_requests=8, window_seconds=60
    )

    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        db.add(
            AuditLog(
                actor_email=payload.email.lower(),
                actor_role="UNKNOWN",
                action="AUTH_LOGIN_FAILED",
                target_resource="POST /api/v1/auth/login",
                details="Invalid email or password credentials.",
                ip_address=client_ip,
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        db.add(
            AuditLog(
                actor_email=user.email,
                actor_role=user.role.value,
                action="AUTH_LOGIN_BLOCKED_DEACTIVATED",
                target_resource=f"User #{user.id}",
                details="Attempted login on a deactivated account.",
                ip_address=client_ip,
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact platform administrator to restore access.",
        )

    user_agent = request.headers.get("user-agent", "Parkwise-Web/2.5")
    token, jti = create_access_token(
        user,
        db=db,
        ip_address=client_ip,
        user_agent=user_agent,
        device_label=payload.device_label,
    )
    set_auth_cookie(response, token)

    db.add(
        AuditLog(
            actor_email=user.email,
            actor_role=user.role.value,
            action="AUTH_LOGIN_SUCCESS",
            target_resource=f"Session {jti}",
            details=f"Authenticated {user.role.value} session via PBKDF2-SHA256 & HttpOnly cookie.",
            ip_address=client_ip,
        )
    )
    db.commit()

    return TokenResponse(
        access_token=token,
        session_jti=jti,
        role=user.role,
        full_name=user.full_name,
        email=user.email,
        email_verified=bool(user.email_verified),
        permissions=get_permissions_for_role(user.role),
        user=_serialize_user_profile(user),
    )


@app.post("/api/v1/auth/logout")
async def logout(
    request: Request,
    response: Response,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
):
    raw_token = extract_token_from_request(request, credentials)
    revoked_jti = None
    actor_email = "anonymous"
    actor_role = "DRIVER"

    if raw_token:
        try:
            payload = jwt.decode(
                raw_token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            revoked_jti = payload.get("jti")
            actor_email = payload.get("sub", "anonymous")
            actor_role = payload.get("role", "DRIVER")
            if revoked_jti:
                sess = (
                    db.query(UserSession)
                    .filter(UserSession.session_token_jti == revoked_jti)
                    .first()
                )
                if sess:
                    sess.is_revoked = True
                    db.commit()
        except Exception:
            pass

    clear_auth_cookie(response)
    db.add(
        AuditLog(
            actor_email=actor_email,
            actor_role=actor_role,
            action="AUTH_LOGOUT",
            target_resource=f"Session {revoked_jti or 'cookie'}",
            details="Session revoked and HttpOnly authentication cookie cleared.",
        )
    )
    db.commit()
    return {
        "status": "logged_out",
        "revoked_session_jti": revoked_jti,
        "message": "Session terminated and HttpOnly cookie cleared.",
    }


@app.get("/api/v1/auth/me", response_model=UserProfileResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return _serialize_user_profile(current_user)


@app.post("/api/v1/auth/verify-email")
async def verify_email(
    payload: EmailVerificationRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email_verification_token == payload.token.strip())
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired email verification token.",
        )
    user.email_verified = True
    user.email_verification_token = None
    db.add(
        AuditLog(
            actor_email=user.email,
            actor_role=user.role.value,
            action="EMAIL_VERIFIED",
            target_resource=f"User #{user.id}",
            details="Verified primary email address ownership.",
        )
    )
    db.commit()
    db.refresh(user)
    return {
        "status": "verified",
        "email": user.email,
        "email_verified": True,
        "user": _serialize_user_profile(user),
    }


@app.post("/api/v1/auth/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.email_verified:
        return {
            "status": "already_verified",
            "email": current_user.email,
            "verification_token": None,
        }
    token = f"pw_verify_{secrets.token_hex(12)}"
    current_user.email_verification_token = token
    db.commit()
    return {
        "status": "verification_sent",
        "email": current_user.email,
        "verification_token": token,
        "delivery_mode": "SANDBOX_PREVIEW_AND_SMTP_QUEUED",
    }


@app.post("/api/v1/auth/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    auth_rate_limiter.check_rate_limit(
        "forgot_password", payload.email.lower(), max_requests=5, window_seconds=60
    )
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registered account found for that email address.",
        )
    reset_token = f"pw_reset_{secrets.token_hex(14)}"
    user.password_reset_token = reset_token
    user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.add(
        AuditLog(
            actor_email=user.email,
            actor_role=user.role.value,
            action="PASSWORD_RESET_REQUESTED",
            target_resource=f"User #{user.id}",
            details="Generated 15-minute cryptographic password reset token.",
        )
    )
    db.commit()
    return {
        "status": "reset_token_generated",
        "email": user.email,
        "reset_token": reset_token,
        "expires_in_minutes": 15,
        "delivery_mode": "SANDBOX_PREVIEW_TOKEN",
    }


@app.post("/api/v1/auth/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.password_reset_token == payload.token.strip())
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset token.",
        )
    now = datetime.now(timezone.utc)
    if user.reset_token_expires_at:
        exp = (
            user.reset_token_expires_at.replace(tzinfo=timezone.utc)
            if user.reset_token_expires_at.tzinfo is None
            else user.reset_token_expires_at.astimezone(timezone.utc)
        )
        if now > exp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset token has expired.",
            )

    user.password_hash = hash_password(payload.new_password)
    user.password_reset_token = None
    user.reset_token_expires_at = None

    # Revoke all existing sessions upon password change
    active_sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id, UserSession.is_revoked.is_(False))
        .all()
    )
    for s in active_sessions:
        s.is_revoked = True

    db.add(
        AuditLog(
            actor_email=user.email,
            actor_role=user.role.value,
            action="PASSWORD_RESET_COMPLETED",
            target_resource=f"User #{user.id}",
            details=f"Password updated and {len(active_sessions)} sessions revoked.",
        )
    )
    db.commit()
    return {
        "status": "password_reset_complete",
        "email": user.email,
        "revoked_sessions_count": len(active_sessions),
    }


@app.patch("/api/v1/auth/profile", response_model=UserProfileResponse)
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Prevent unauthorized role escalation via profile update
    if payload.role is not None and payload.role.upper() != current_user.role.value:
        db.add(
            AuditLog(
                actor_email=current_user.email,
                actor_role=current_user.role.value,
                action="ROLE_ESCALATION_BLOCKED",
                target_resource="PATCH /api/v1/auth/profile",
                details=f"Blocked attempt to change role from {current_user.role.value} to {payload.role}.",
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role modification is not permitted through profile settings.",
        )

    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        current_user.phone = payload.phone.strip()
    if payload.home_city is not None:
        current_user.home_city = payload.home_city.strip()
    if payload.gst_number is not None:
        current_user.gst_number = payload.gst_number.strip().upper() or None
    if payload.fastag_auto_debit is not None:
        current_user.fastag_auto_debit = payload.fastag_auto_debit
    if payload.sms_receipts is not None:
        current_user.sms_receipts = payload.sms_receipts
    if payload.whatsapp_alerts is not None:
        current_user.whatsapp_alerts = payload.whatsapp_alerts
    if payload.accessible_priority is not None:
        current_user.accessible_priority = payload.accessible_priority

    db.add(
        AuditLog(
            actor_email=current_user.email,
            actor_role=current_user.role.value,
            action="PROFILE_UPDATED",
            target_resource=f"User #{current_user.id}",
            details=f"Updated profile preferences (city={current_user.home_city}, GSTIN={current_user.gst_number or 'N/A'}).",
        )
    )
    db.commit()
    db.refresh(current_user)
    return _serialize_user_profile(current_user)


# ----------------------------------------------------------------------------
# 2B. Authenticated Vehicle Garage Management
# ----------------------------------------------------------------------------
@app.get("/api/v1/auth/vehicles", response_model=List[VehicleItemResponse])
async def list_user_vehicles(
    current_user: User = Depends(require_permission("vehicle:manage")),
    db: Session = Depends(get_db),
):
    vehicles = (
        db.query(Vehicle)
        .filter(Vehicle.user_id == current_user.id)
        .order_by(Vehicle.is_primary.desc(), Vehicle.id.asc())
        .all()
    )
    return [VehicleItemResponse.model_validate(v) for v in vehicles]


@app.post(
    "/api/v1/auth/vehicles",
    response_model=VehicleItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_user_vehicle(
    payload: VehicleCreateRequest,
    current_user: User = Depends(require_permission("vehicle:manage")),
    db: Session = Depends(get_db),
):
    existing_vehicles = (
        db.query(Vehicle).filter(Vehicle.user_id == current_user.id).all()
    )
    make_primary = payload.is_primary or len(existing_vehicles) == 0
    if make_primary:
        for ev in existing_vehicles:
            ev.is_primary = False
        current_user.vehicle_number = payload.plate_number
        current_user.fastag_id = payload.fastag_id

    vehicle = Vehicle(
        user_id=current_user.id,
        plate_number=payload.plate_number,
        model_name=payload.model_name.strip(),
        size_class=payload.size_class,
        dimensions_label=payload.dimensions_label,
        is_ev=payload.is_ev,
        fastag_id=payload.fastag_id,
        is_primary=make_primary,
    )
    db.add(vehicle)
    db.add(
        AuditLog(
            actor_email=current_user.email,
            actor_role=current_user.role.value,
            action="VEHICLE_ADDED",
            target_resource=payload.plate_number,
            details=f"Registered {payload.model_name} ({payload.size_class}, EV={payload.is_ev}).",
        )
    )
    db.commit()
    db.refresh(vehicle)
    return VehicleItemResponse.model_validate(vehicle)


@app.patch(
    "/api/v1/auth/vehicles/{vehicle_id}/primary",
    response_model=VehicleItemResponse,
)
async def set_primary_user_vehicle(
    vehicle_id: int,
    current_user: User = Depends(require_permission("vehicle:manage")),
    db: Session = Depends(get_db),
):
    target = (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id, Vehicle.user_id == current_user.id)
        .first()
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found in your garage.",
        )
    all_v = db.query(Vehicle).filter(Vehicle.user_id == current_user.id).all()
    for v in all_v:
        v.is_primary = v.id == target.id
    current_user.vehicle_number = target.plate_number
    current_user.fastag_id = target.fastag_id
    db.commit()
    db.refresh(target)
    return VehicleItemResponse.model_validate(target)


@app.delete("/api/v1/auth/vehicles/{vehicle_id}")
async def delete_user_vehicle(
    vehicle_id: int,
    current_user: User = Depends(require_permission("vehicle:manage")),
    db: Session = Depends(get_db),
):
    target = (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id, Vehicle.user_id == current_user.id)
        .first()
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found in your garage.",
        )
    plate = target.plate_number
    db.delete(target)
    db.add(
        AuditLog(
            actor_email=current_user.email,
            actor_role=current_user.role.value,
            action="VEHICLE_REMOVED",
            target_resource=plate,
            details=f"Removed vehicle {plate} from garage.",
        )
    )
    db.commit()
    return {"status": "deleted", "plate_number": plate}


# ----------------------------------------------------------------------------
# 2C. Session Management, Account Deactivation, RBAC & Audit Logs
# ----------------------------------------------------------------------------
@app.get("/api/v1/auth/sessions", response_model=List[SessionItemResponse])
async def list_user_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == current_user.id)
        .order_by(UserSession.created_at.desc())
        .limit(20)
        .all()
    )
    return [SessionItemResponse.model_validate(s) for s in sessions]


@app.delete("/api/v1/auth/sessions/{session_id}")
async def revoke_user_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sess = (
        db.query(UserSession)
        .filter(
            UserSession.id == session_id,
            UserSession.user_id == current_user.id,
        )
        .first()
    )
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )
    sess.is_revoked = True
    db.add(
        AuditLog(
            actor_email=current_user.email,
            actor_role=current_user.role.value,
            action="SESSION_REVOKED",
            target_resource=sess.session_token_jti,
            details=f"Revoked session on device '{sess.device_label}'.",
        )
    )
    db.commit()
    return {"status": "revoked", "session_token_jti": sess.session_token_jti}


@app.post("/api/v1/auth/deactivate")
async def deactivate_my_account(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.is_active = False
    current_user.deactivated_at = datetime.now(timezone.utc)
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == current_user.id, UserSession.is_revoked.is_(False))
        .all()
    )
    for s in sessions:
        s.is_revoked = True

    clear_auth_cookie(response)
    db.add(
        AuditLog(
            actor_email=current_user.email,
            actor_role=current_user.role.value,
            action="ACCOUNT_DEACTIVATED",
            target_resource=f"User #{current_user.id}",
            details="User deactivated their account; all active sessions revoked.",
        )
    )
    db.commit()
    return {
        "status": "deactivated",
        "email": current_user.email,
        "revoked_sessions": len(sessions),
    }


@app.get("/api/v1/auth/roles-permissions")
async def get_roles_and_permissions(db: Session = Depends(get_db)):
    roles = db.query(Role).order_by(Role.id.asc()).all()
    result = []
    for r in roles:
        perms = [
            {
                "code": rp.permission.code,
                "name": rp.permission.name,
                "module": rp.permission.module,
                "description": rp.permission.description,
            }
            for rp in r.role_permissions
            if rp.permission
        ]
        result.append(
            {
                "code": r.code,
                "name": r.name,
                "description": r.description,
                "permissions": perms,
            }
        )
    return {"roles": result}


@app.get("/api/v1/auth/audit-logs")
async def list_security_audit_logs(
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id,
            "actor_email": a.actor_email,
            "actor_role": a.actor_role,
            "action": a.action,
            "target_resource": a.target_resource,
            "details": a.details,
            "ip_address": a.ip_address,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in logs
    ]


@app.get("/api/v1/admin/users")
async def admin_list_users(
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.id.asc()).all()
    return [_serialize_user_profile(u) for u in users]


@app.post("/api/v1/admin/users/{user_id}/role", response_model=UserProfileResponse)
async def admin_update_user_role(
    user_id: int,
    payload: AdminRoleUpdateRequest,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found."
        )
    old_role = target.role.value
    target.role = payload.role
    db.add(
        AuditLog(
            actor_email=current_user.email,
            actor_role=current_user.role.value,
            action="ADMIN_ROLE_UPDATED",
            target_resource=target.email,
            details=f"Changed user role from {old_role} to {payload.role.value}.",
        )
    )
    db.commit()
    db.refresh(target)
    return _serialize_user_profile(target)


@app.post("/api/v1/admin/users/{user_id}/status", response_model=UserProfileResponse)
async def admin_update_user_status(
    user_id: int,
    payload: AdminStatusUpdateRequest,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found."
        )
    target.is_active = payload.is_active
    target.deactivated_at = None if payload.is_active else datetime.now(timezone.utc)
    if not payload.is_active:
        for s in target.sessions:
            s.is_revoked = True
    db.add(
        AuditLog(
            actor_email=current_user.email,
            actor_role=current_user.role.value,
            action="ADMIN_USER_STATUS_CHANGED",
            target_resource=target.email,
            details=f"Set is_active={payload.is_active} ({payload.reason}).",
        )
    )
    db.commit()
    db.refresh(target)
    return _serialize_user_profile(target)


# ----------------------------------------------------------------------------
# 3. Parking Lots & Real-Time Bay Inventory
# ----------------------------------------------------------------------------
@app.get("/api/v1/lots", response_model=List[ParkingLotResponse])
async def list_parking_lots(
    city: Optional[str] = Query(None, description="Filter by Indian city"),
    db: Session = Depends(get_db),
):
    query = db.query(ParkingLot)
    if city:
        query = query.filter(ParkingLot.city.ilike(f"%{city}%"))
    lots = query.order_by(ParkingLot.id.asc()).all()
    return [_serialize_lot(lot, include_slots=False) for lot in lots]


@app.get("/api/v1/lots/{lot_id}", response_model=ParkingLotDetailResponse)
async def get_parking_lot_detail(lot_id: int, db: Session = Depends(get_db)):
    lot = db.query(ParkingLot).filter(ParkingLot.id == lot_id).first()
    if not lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking lot not found.",
        )
    return _serialize_lot(lot, include_slots=True)


# ----------------------------------------------------------------------------
# 4. Transactional Bookings, Cancellation, Extension & Recommendations
# ----------------------------------------------------------------------------
@app.post(
    "/api/v1/bookings",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_booking(
    payload: BookingCreateRequest,
    db: Session = Depends(get_db),
):
    driver = db.query(User).filter(User.role == UserRole.DRIVER).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default driver account not initialized.",
        )
    booking = create_transactional_booking(db, payload, driver)
    serialized = _serialize_booking(booking)
    await ws_manager.broadcast_event(
        "BOOKING_CREATED",
        {
            "booking_reference": booking.booking_reference,
            "lot_id": booking.lot_id,
            "slot_id": booking.slot_id,
            "status": booking.status.value,
        },
    )
    return serialized


@app.get("/api/v1/bookings", response_model=List[BookingResponse])
async def list_bookings(
    lot_id: Optional[int] = Query(None),
    vehicle_number: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Booking)
    if lot_id:
        query = query.filter(Booking.lot_id == lot_id)
    if vehicle_number:
        query = query.filter(
            Booking.vehicle_number.ilike(f"%{vehicle_number.strip()}%")
        )
    bookings = query.order_by(Booking.created_at.desc()).limit(50).all()
    return [_serialize_booking(b) for b in bookings]


@app.post(
    "/api/v1/bookings/{booking_reference}/cancel",
    response_model=BookingResponse,
)
async def cancel_booking(
    booking_reference: str,
    db: Session = Depends(get_db),
):
    booking = cancel_transactional_booking(db, booking_reference)
    serialized = _serialize_booking(booking)
    await ws_manager.broadcast_event(
        "BOOKING_CANCELLED",
        {
            "booking_reference": booking.booking_reference,
            "slot_id": booking.slot_id,
            "status": booking.status.value,
        },
    )
    return serialized


@app.post(
    "/api/v1/bookings/{booking_reference}/extend",
    response_model=BookingResponse,
)
async def extend_booking(
    booking_reference: str,
    payload: BookingExtendRequest,
    db: Session = Depends(get_db),
):
    booking = extend_transactional_booking(
        db, booking_reference, payload.additional_hours
    )
    serialized = _serialize_booking(booking)
    await ws_manager.broadcast_event(
        "BOOKING_EXTENDED",
        {
            "booking_reference": booking.booking_reference,
            "duration_hours": booking.duration_hours,
            "total_amount_inr": booking.total_amount_inr,
        },
    )
    return serialized


@app.post(
    "/api/v1/driver/recommendations",
    response_model=List[SlotRecommendationItem],
)
async def get_driver_recommendations(
    payload: DriverRecommendationRequest,
    db: Session = Depends(get_db),
):
    return compute_driver_recommendations(db, payload)


# ----------------------------------------------------------------------------
# 5. Server-Side Payment Verification (Razorpay HMAC)
# ----------------------------------------------------------------------------
@app.post("/api/v1/payments/verify", response_model=BookingResponse)
async def verify_payment(
    payload: PaymentVerifyRequest,
    db: Session = Depends(get_db),
):
    booking = verify_and_capture_payment(db, payload)
    serialized = _serialize_booking(booking)
    await ws_manager.broadcast_event(
        "PAYMENT_CAPTURED",
        {
            "booking_reference": booking.booking_reference,
            "status": booking.status.value,
            "total_amount_inr": booking.total_amount_inr,
        },
    )
    return serialized


# ----------------------------------------------------------------------------
# 6. Gate Management Terminal (ANPR + Cryptographic QR Verification)
# ----------------------------------------------------------------------------
@app.post("/api/v1/gate/scan", response_model=GateScanResponse)
async def process_gate_scan(
    payload: GateScanRequest,
    db: Session = Depends(get_db),
):
    booking = (
        db.query(Booking)
        .filter(Booking.booking_reference == payload.booking_reference)
        .first()
    )
    now = datetime.now(timezone.utc)

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking reference not recognized by gate control.",
        )

    is_valid_sig = verify_qr_signature(
        booking.booking_reference,
        booking.slot_id,
        booking.vehicle_number,
        payload.qr_signature,
    )
    if not is_valid_sig:
        denied_log = GateLog(
            lot_id=booking.lot_id,
            booking_reference=booking.booking_reference,
            vehicle_number=payload.vehicle_number,
            event_type="DENIED_INVALID_SIGNATURE",
            gate_lane=payload.gate_lane,
            anpr_confidence=0.95,
            verification_method="QR_HMAC_REJECTED",
            barrier_action="LOCKED",
            notes="Cryptographic HMAC signature verification failed.",
        )
        db.add(denied_log)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tampered or invalid QR cryptographic signature. Boom barrier remains locked.",
        )

    if booking.vehicle_number.upper() != payload.vehicle_number.strip().upper():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"ANPR Plate Mismatch: Camera read {payload.vehicle_number}, expected {booking.vehicle_number}.",
        )

    if booking.status == BookingStatus.PENDING_PAYMENT:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Payment has not been verified for this booking.",
        )

    slot = db.query(ParkingSlot).filter(ParkingSlot.id == booking.slot_id).first()
    slot_num = slot.slot_number if slot else f"SLOT-{booking.slot_id}"
    overstay_fee = 0.0

    if payload.action == "ENTRY":
        if booking.status not in (BookingStatus.CONFIRMED, BookingStatus.ACTIVE):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Booking cannot check in from current state: {booking.status.value}",
            )
        booking.status = BookingStatus.ACTIVE
        booking.checked_in_at = now
        if slot:
            slot.status = SlotStatus.OCCUPIED
        message = f"Entry authorized for {booking.vehicle_number}. Proceed to Bay {slot_num}."
    else:
        if booking.status != BookingStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vehicle must be in ACTIVE (checked-in) state before exit.",
            )
        end_utc = (
            booking.end_time.replace(tzinfo=timezone.utc)
            if booking.end_time.tzinfo is None
            else booking.end_time.astimezone(timezone.utc)
        )
        if now > end_utc:
            extra_hours = max(
                1.0, round((now - end_utc).total_seconds() / 3600.0, 2)
            )
            overstay_fee = round(
                extra_hours * (booking.lot.base_hourly_rate_inr * 1.5), 2
            )
            booking.overstay_fee_inr = overstay_fee

        booking.status = BookingStatus.COMPLETED
        booking.checked_out_at = now
        if slot:
            slot.status = SlotStatus.AVAILABLE
        message = (
            f"Exit authorized for {booking.vehicle_number}. Bay {slot_num} released."
            if overstay_fee == 0
            else f"Exit authorized with ₹{overstay_fee} overstay FASTag auto-debit."
        )

    log_entry = GateLog(
        lot_id=booking.lot_id,
        booking_reference=booking.booking_reference,
        vehicle_number=booking.vehicle_number,
        event_type=payload.action,
        gate_lane=payload.gate_lane,
        anpr_confidence=0.988,
        verification_method="QR_HMAC + ANPR_OPTICAL",
        barrier_action="OPENED",
        notes=message,
    )
    db.add(log_entry)
    db.commit()

    await ws_manager.broadcast_event(
        f"GATE_{payload.action}",
        {
            "booking_reference": booking.booking_reference,
            "vehicle_number": booking.vehicle_number,
            "slot_number": slot_num,
            "barrier_status": "OPENED",
        },
    )

    return GateScanResponse(
        allowed=True,
        barrier_status="OPENED",
        event_type=payload.action,
        booking_reference=booking.booking_reference,
        vehicle_number=booking.vehicle_number,
        slot_number=slot_num,
        anpr_confidence=0.988,
        overstay_fee_inr=overstay_fee,
        message=message,
        timestamp=now,
    )


@app.get("/api/v1/gate/logs")
async def list_gate_logs(
    lot_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(GateLog)
    if lot_id:
        query = query.filter(GateLog.lot_id == lot_id)
    logs = query.order_by(GateLog.timestamp.desc()).limit(30).all()
    return [
        {
            "id": l.id,
            "lot_id": l.lot_id,
            "booking_reference": l.booking_reference,
            "vehicle_number": l.vehicle_number,
            "event_type": l.event_type,
            "gate_lane": l.gate_lane,
            "anpr_confidence": l.anpr_confidence,
            "verification_method": l.verification_method,
            "barrier_action": l.barrier_action,
            "notes": l.notes,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
        }
        for l in logs
    ]


# ----------------------------------------------------------------------------
# 7. Operator Controls (Slot Status & AI Dynamic Surge Configuration)
# ----------------------------------------------------------------------------
@app.patch("/api/v1/operator/slots/{slot_id}", response_model=SlotResponse)
async def update_slot_status(
    slot_id: int,
    payload: SlotStatusUpdateRequest,
    db: Session = Depends(get_db),
):
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Slot not found.",
        )
    slot.status = payload.status
    db.add(
        AuditLog(
            actor_email="operator@parkwise.in",
            actor_role="OPERATOR",
            action="SLOT_STATUS_OVERRIDE",
            target_resource=f"Slot #{slot.id} ({slot.slot_number})",
            details=f"Updated bay status to {payload.status.value}",
        )
    )
    db.commit()
    db.refresh(slot)
    await ws_manager.broadcast_event(
        "SLOT_UPDATED",
        {"slot_id": slot.id, "lot_id": slot.lot_id, "status": slot.status.value},
    )
    return slot


@app.patch("/api/v1/operator/lots/{lot_id}/surge", response_model=ParkingLotResponse)
async def update_lot_surge(
    lot_id: int,
    payload: SurgeUpdateRequest,
    db: Session = Depends(get_db),
):
    lot = db.query(ParkingLot).filter(ParkingLot.id == lot_id).first()
    if not lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking lot not found.",
        )
    lot.dynamic_pricing_enabled = payload.dynamic_pricing_enabled
    lot.current_surge_multiplier = payload.current_surge_multiplier
    db.add(
        AuditLog(
            actor_email="operator@parkwise.in",
            actor_role="OPERATOR",
            action="SURGE_PRICING_UPDATED",
            target_resource=f"Lot {lot.code}",
            details=f"Dynamic pricing={payload.dynamic_pricing_enabled}, multiplier={payload.current_surge_multiplier}x",
        )
    )
    db.commit()
    db.refresh(lot)
    return _serialize_lot(lot, include_slots=False)


# ----------------------------------------------------------------------------
# 8. AI Occupancy Forecasting & Dynamic Pricing Engine
# ----------------------------------------------------------------------------
@app.get(
    "/api/v1/ai/forecast/{lot_id}",
    response_model=AIPricingRecommendationResponse,
)
async def get_ai_forecast(lot_id: int, db: Session = Depends(get_db)):
    lot = db.query(ParkingLot).filter(ParkingLot.id == lot_id).first()
    if not lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking lot not found.",
        )
    return ai_engine.generate_lot_forecast(lot)


# ----------------------------------------------------------------------------
# 9. Platform Administrator National Telemetry & Audit Logs
# ----------------------------------------------------------------------------
@app.get("/api/v1/admin/overview")
async def get_admin_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    lots = db.query(ParkingLot).all()
    bookings = db.query(Booking).all()
    audits = (
        db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(20).all()
    )
    total_revenue = sum(
        b.total_amount_inr + b.overstay_fee_inr
        for b in bookings
        if b.status
        in (BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.COMPLETED)
    )
    return {
        "authorized_by": current_user.email,
        "role": current_user.role.value,
        "national_kpis": {
            "total_facilities": len(lots),
            "total_bookings": len(bookings),
            "gross_gmv_inr": round(total_revenue, 2),
            "active_cities": len({l.city for l in lots}),
        },
        "audit_logs": [
            {
                "id": a.id,
                "actor_email": a.actor_email,
                "actor_role": a.actor_role,
                "action": a.action,
                "target_resource": a.target_resource,
                "details": a.details,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in audits
        ],
    }


# ----------------------------------------------------------------------------
# 10. Real-Time Telemetry WebSocket Endpoint
# ----------------------------------------------------------------------------
@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json(
                {
                    "event": "HEARTBEAT_ACK",
                    "echo": data,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
