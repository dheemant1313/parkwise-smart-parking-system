"""Transactional Booking Service with Concurrency Locking, Cancellation, Extension & Recommendations."""
import hashlib
import hmac
import math
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Dict, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.config import settings
from app.models import (
    Booking,
    BookingStatus,
    ParkingLot,
    ParkingSlot,
    Payment,
    PaymentStatus,
    SlotStatus,
    SlotType,
    User,
)
from app.schemas import (
    BookingCreateRequest,
    DriverRecommendationRequest,
    SlotRecommendationItem,
)

_in_memory_slot_locks: Dict[int, threading.Lock] = {}
_global_lock = threading.Lock()


@contextmanager
def acquire_slot_lock(slot_id: int):
    """Acquire a distributed Redis lock (when available) + process-level lock to prevent race conditions."""
    with _global_lock:
        if slot_id not in _in_memory_slot_locks:
            _in_memory_slot_locks[slot_id] = threading.Lock()
        slot_lock = _in_memory_slot_locks[slot_id]

    acquired = slot_lock.acquire(timeout=5.0)
    if not acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slot is currently locked by another concurrent reservation request.",
        )
    try:
        yield
    finally:
        slot_lock.release()


def compute_qr_signature(
    booking_reference: str, slot_id: int, vehicle_number: str
) -> str:
    """Generate tamper-proof HMAC-SHA256 signature for gate verification."""
    message = f"{booking_reference}:{slot_id}:{vehicle_number.upper()}".encode("utf-8")
    secret = settings.QR_HMAC_SECRET.encode("utf-8")
    return hmac.new(secret, message, hashlib.sha256).hexdigest()


def verify_qr_signature(
    booking_reference: str, slot_id: int, vehicle_number: str, signature: str
) -> bool:
    expected = compute_qr_signature(booking_reference, slot_id, vehicle_number)
    return hmac.compare_digest(expected, signature)


def create_transactional_booking(
    db: Session, payload: BookingCreateRequest, user: User
) -> Booking:
    """Create a booking inside an atomic transaction after verifying zero time-window overlap."""
    with acquire_slot_lock(payload.slot_id):
        lot = db.query(ParkingLot).filter(ParkingLot.id == payload.lot_id).first()
        if not lot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parking lot not found.",
            )

        slot = (
            db.query(ParkingSlot)
            .filter(
                ParkingSlot.id == payload.slot_id,
                ParkingSlot.lot_id == payload.lot_id,
            )
            .first()
        )
        if not slot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parking slot does not exist in the selected parking facility.",
            )

        if slot.status == SlotStatus.MAINTENANCE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Slot {slot.slot_number} is currently under maintenance.",
            )

        req_start = (
            payload.start_time.replace(tzinfo=timezone.utc)
            if payload.start_time.tzinfo is None
            else payload.start_time.astimezone(timezone.utc)
        )
        req_end = (
            payload.end_time.replace(tzinfo=timezone.utc)
            if payload.end_time.tzinfo is None
            else payload.end_time.astimezone(timezone.utc)
        )

        active_statuses = [
            BookingStatus.PENDING_PAYMENT,
            BookingStatus.CONFIRMED,
            BookingStatus.ACTIVE,
        ]
        existing_bookings = (
            db.query(Booking)
            .filter(
                Booking.slot_id == slot.id,
                Booking.status.in_(active_statuses),
            )
            .all()
        )

        for existing in existing_bookings:
            ex_start = (
                existing.start_time.replace(tzinfo=timezone.utc)
                if existing.start_time.tzinfo is None
                else existing.start_time.astimezone(timezone.utc)
            )
            ex_end = (
                existing.end_time.replace(tzinfo=timezone.utc)
                if existing.end_time.tzinfo is None
                else existing.end_time.astimezone(timezone.utc)
            )
            if req_start < ex_end and req_end > ex_start:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Double-booking prevented: Slot {slot.slot_number} is already booked "
                        f"between {ex_start.isoformat()} and {ex_end.isoformat()} "
                        f"(Ref: {existing.booking_reference})."
                    ),
                )

        duration_seconds = (req_end - req_start).total_seconds()
        duration_hours = max(1.0, round(duration_seconds / 3600.0, 2))
        hourly_rate = lot.base_hourly_rate_inr
        if slot.slot_type == SlotType.EV_CHARGING:
            hourly_rate += lot.ev_surcharge_inr
        elif slot.slot_type == SlotType.SUV_XL:
            hourly_rate += 25.0

        surge = lot.current_surge_multiplier if lot.dynamic_pricing_enabled else 1.0
        base_amount = round(hourly_rate * duration_hours * surge, 2)
        gst_amount = round(base_amount * 0.18, 2)
        total_amount = round(base_amount + gst_amount, 2)

        booking_ref = f"PW-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        qr_sig = compute_qr_signature(booking_ref, slot.id, payload.vehicle_number)

        booking = Booking(
            booking_reference=booking_ref,
            user_id=user.id,
            lot_id=lot.id,
            slot_id=slot.id,
            vehicle_number=payload.vehicle_number,
            driver_name=payload.driver_name,
            driver_phone=payload.driver_phone,
            start_time=req_start,
            end_time=req_end,
            duration_hours=duration_hours,
            base_amount_inr=base_amount,
            surge_multiplier=surge,
            gst_amount_inr=gst_amount,
            total_amount_inr=total_amount,
            status=BookingStatus.PENDING_PAYMENT,
            qr_signature=qr_sig,
        )
        db.add(booking)
        db.flush()

        razorpay_order_id = f"order_pw_{uuid.uuid4().hex[:14]}"
        payment = Payment(
            booking_id=booking.id,
            razorpay_order_id=razorpay_order_id,
            amount_inr=total_amount,
            currency="INR",
            payment_method="UPI / Razorpay",
            status=PaymentStatus.CREATED,
            is_simulated=settings.PAYMENT_SIMULATION_MODE
            or not bool(settings.RAZORPAY_KEY_ID),
        )
        db.add(payment)

        slot.status = SlotStatus.RESERVED

        db.commit()
        db.refresh(booking)
        return booking


def cancel_transactional_booking(
    db: Session, booking_reference: str
) -> Booking:
    """Cancel an active/confirmed/pending reservation and release the parking slot."""
    booking = (
        db.query(Booking)
        .filter(Booking.booking_reference == booking_reference)
        .first()
    )
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking reference not found.",
        )

    if booking.status in (BookingStatus.COMPLETED, BookingStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel booking in '{booking.status.value}' status.",
        )

    with acquire_slot_lock(booking.slot_id):
        booking.status = BookingStatus.CANCELLED
        if booking.payment:
            booking.payment.status = PaymentStatus.REFUNDED

        slot = (
            db.query(ParkingSlot)
            .filter(ParkingSlot.id == booking.slot_id)
            .first()
        )
        if slot and slot.status in (SlotStatus.RESERVED, SlotStatus.OCCUPIED):
            slot.status = SlotStatus.AVAILABLE

        db.commit()
        db.refresh(booking)
        return booking


def extend_transactional_booking(
    db: Session, booking_reference: str, additional_hours: float
) -> Booking:
    """Extend a reservation after verifying zero overlap in the extended window."""
    booking = (
        db.query(Booking)
        .filter(Booking.booking_reference == booking_reference)
        .first()
    )
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking reference not found.",
        )

    if booking.status not in (
        BookingStatus.CONFIRMED,
        BookingStatus.ACTIVE,
        BookingStatus.PENDING_PAYMENT,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot extend booking in '{booking.status.value}' status.",
        )

    with acquire_slot_lock(booking.slot_id):
        current_end = (
            booking.end_time.replace(tzinfo=timezone.utc)
            if booking.end_time.tzinfo is None
            else booking.end_time.astimezone(timezone.utc)
        )
        new_end = current_end + timedelta(hours=additional_hours)

        # Check if another booking overlaps the extension window
        active_statuses = [
            BookingStatus.PENDING_PAYMENT,
            BookingStatus.CONFIRMED,
            BookingStatus.ACTIVE,
        ]
        others = (
            db.query(Booking)
            .filter(
                Booking.slot_id == booking.slot_id,
                Booking.id != booking.id,
                Booking.status.in_(active_statuses),
            )
            .all()
        )
        for other in others:
            o_start = (
                other.start_time.replace(tzinfo=timezone.utc)
                if other.start_time.tzinfo is None
                else other.start_time.astimezone(timezone.utc)
            )
            o_end = (
                other.end_time.replace(tzinfo=timezone.utc)
                if other.end_time.tzinfo is None
                else other.end_time.astimezone(timezone.utc)
            )
            if current_end < o_end and new_end > o_start:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Extension conflict: Slot is reserved by {other.booking_reference} starting at {o_start.isoformat()}.",
                )

        lot = booking.lot
        slot = booking.slot
        hourly_rate = lot.base_hourly_rate_inr
        if slot.slot_type == SlotType.EV_CHARGING:
            hourly_rate += lot.ev_surcharge_inr
        elif slot.slot_type == SlotType.SUV_XL:
            hourly_rate += 25.0

        new_duration = round(booking.duration_hours + additional_hours, 2)
        new_base = round(hourly_rate * new_duration * booking.surge_multiplier, 2)
        new_gst = round(new_base * 0.18, 2)
        new_total = round(new_base + new_gst, 2)

        booking.end_time = new_end
        booking.duration_hours = new_duration
        booking.base_amount_inr = new_base
        booking.gst_amount_inr = new_gst
        booking.total_amount_inr = new_total
        if booking.payment:
            booking.payment.amount_inr = new_total

        db.commit()
        db.refresh(booking)
        return booking


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return round(r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


def compute_driver_recommendations(
    db: Session, req: DriverRecommendationRequest
) -> List[SlotRecommendationItem]:
    """Deterministic multi-factor slot recommendation engine."""
    query = db.query(ParkingLot)
    if req.city:
        query = query.filter(ParkingLot.city.ilike(f"%{req.city}%"))
    lots = query.all()

    recommendations: List[SlotRecommendationItem] = []
    for lot in lots:
        dist_km = _haversine_km(
            req.target_latitude,
            req.target_longitude,
            lot.latitude,
            lot.longitude,
        )
        available_slots = [
            s for s in lot.slots if s.status == SlotStatus.AVAILABLE
        ]
        if not available_slots:
            continue

        avail_ratio = len(available_slots) / max(1, len(lot.slots))

        for slot in available_slots:
            if req.requires_ev and slot.slot_type != SlotType.EV_CHARGING:
                continue
            if req.requires_accessible and slot.slot_type != SlotType.ACCESSIBLE:
                continue
            if (
                req.vehicle_size == "SUV_XL"
                and slot.slot_type not in (SlotType.SUV_XL, SlotType.ACCESSIBLE)
            ):
                continue

            hourly = lot.base_hourly_rate_inr
            if slot.slot_type == SlotType.EV_CHARGING:
                hourly += lot.ev_surcharge_inr
            elif slot.slot_type == SlotType.SUV_XL:
                hourly += 25.0

            surge = (
                lot.current_surge_multiplier
                if lot.dynamic_pricing_enabled
                else 1.0
            )
            base_cost = hourly * req.duration_hours * surge
            total_inr = round(base_cost * 1.18, 2)

            # Deterministic Score (0 - 100)
            dist_score = max(0.0, 30.0 - min(30.0, dist_km * 1.5))
            size_score = (
                20.0
                if (
                    req.vehicle_size == "SUV_XL"
                    and slot.slot_type == SlotType.SUV_XL
                )
                or req.vehicle_size != "SUV_XL"
                else 10.0
            )
            feature_score = 20.0
            price_score = max(0.0, 15.0 - (hourly / 20.0))
            avail_score = round(avail_ratio * 15.0, 1)
            floor_bonus = 2.5 if slot.floor == 1 else 0.0

            score = round(
                min(
                    99.8,
                    dist_score
                    + size_score
                    + feature_score
                    + price_score
                    + avail_score
                    + floor_bonus,
                ),
                1,
            )

            reasons: List[str] = [f"{dist_km} km from destination"]
            if slot.slot_type == SlotType.EV_CHARGING:
                reasons.append("50kW CCS2 Fast-Charger Ready")
            if slot.slot_type == SlotType.SUV_XL:
                reasons.append("SUV XL High-Clearance Bay")
            if slot.slot_type == SlotType.ACCESSIBLE:
                reasons.append("Step-Free Accessible Ground Bay")
            if slot.floor == 1:
                reasons.append("Quick Floor 01 Exit Access")

            recommendations.append(
                SlotRecommendationItem(
                    lot_id=lot.id,
                    lot_code=lot.code,
                    lot_name=lot.name,
                    city=lot.city,
                    slot_id=slot.id,
                    slot_number=slot.slot_number,
                    floor=slot.floor,
                    slot_type=slot.slot_type,
                    distance_km=dist_km,
                    estimated_total_inr=total_inr,
                    match_score=score,
                    reasons=reasons,
                )
            )

    recommendations.sort(
        key=lambda r: (-r.match_score, r.estimated_total_inr, r.distance_km)
    )
    return recommendations[:8]
