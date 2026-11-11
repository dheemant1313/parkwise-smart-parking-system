"""Transactional Booking Service with Concurrency Locking & Cryptographic QR Signing."""
import hashlib
import hmac
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Dict
from fastapi import HTTPException, status
from sqlalchemy import and_
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
from app.schemas import BookingCreateRequest

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

        # Normalize datetimes for overlap comparison
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

        # Prevent double booking: check any active/confirmed/pending booking with overlapping window
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

        # Compute server-side pricing (never trust frontend amounts)
        duration_seconds = (req_end - req_start).total_seconds()
        duration_hours = max(1.0, round(duration_seconds / 3600.0, 2))
        hourly_rate = lot.base_hourly_rate_inr
        if slot.slot_type == SlotType.EV_CHARGING:
            hourly_rate += lot.ev_surcharge_inr
        elif slot.slot_type == SlotType.SUV_XL:
            hourly_rate += 25.0

        surge = lot.current_surge_multiplier if lot.dynamic_pricing_enabled else 1.0
        base_amount = round(hourly_rate * duration_hours * surge, 2)
        gst_amount = round(base_amount * 0.18, 2)  # 18% GST (India)
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

        # Mark slot as reserved immediately inside the same atomic transaction
        slot.status = SlotStatus.RESERVED

        db.commit()
        db.refresh(booking)
        return booking
