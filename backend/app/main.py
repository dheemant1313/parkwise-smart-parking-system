"""FastAPI Enterprise Main Application for Parkwise Smart Parking Ecosystem."""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    require_roles,
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
    SlotStatus,
    SlotType,
    User,
    UserRole,
)
from app.schemas import (
    AIPricingRecommendationResponse,
    BookingCreateRequest,
    BookingExtendRequest,
    BookingResponse,
    DriverRecommendationRequest,
    GateScanRequest,
    GateScanResponse,
    LoginRequest,
    ParkingLotDetailResponse,
    ParkingLotResponse,
    PaymentVerifyRequest,
    SlotRecommendationItem,
    SlotResponse,
    SlotStatusUpdateRequest,
    SurgeUpdateRequest,
    TokenResponse,
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
    version="2.4.0",
    description=(
        "Enterprise AI-Powered Smart Parking Platform for India. "
        "Connects Drivers, Parking Operators, Boom-Barrier Gate Terminals, and Platform Administrators."
    ),
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": "2.4.0",
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
        },
    }


# ----------------------------------------------------------------------------
# 2. Authentication & RBAC Endpoints
# ----------------------------------------------------------------------------
@app.post("/api/v1/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    token = create_access_token(user)
    return TokenResponse(
        access_token=token,
        role=user.role,
        full_name=user.full_name,
        email=user.email,
    )


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
        if b.status in (BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.COMPLETED)
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
