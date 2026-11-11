"""Server-Side Razorpay Payment Verification & Availability Revalidation Service."""
import hashlib
import hmac
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.config import settings
from app.models import (
    Booking,
    BookingEvent,
    BookingStatus,
    ParkingSlot,
    Payment,
    PaymentStatus,
    SlotStatus,
)
from app.schemas import PaymentVerifyRequest
from app.services.booking_service import acquire_slot_lock, reservation_lock_manager


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def compute_razorpay_signature(order_id: str, payment_id: str) -> str:
    secret = (settings.RAZORPAY_KEY_SECRET or "parkwise-razorpay-sim-secret").encode(
        "utf-8"
    )
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def verify_and_capture_payment(
    db: Session, payload: PaymentVerifyRequest
) -> Booking:
    """Revalidate slot availability inside a lock, verify payment authenticity, and confirm booking."""
    booking = (
        db.query(Booking)
        .filter(Booking.booking_reference == payload.booking_reference)
        .first()
    )
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking reference not found.",
        )

    with acquire_slot_lock(booking.slot_id):
        if booking.status == BookingStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot confirm a cancelled or expired reservation.",
            )

        now = datetime.now(timezone.utc)
        if booking.reservation_expires_at and booking.status == BookingStatus.PENDING_PAYMENT:
            exp_utc = _to_utc(booking.reservation_expires_at)
            if now > exp_utc:
                booking.status = BookingStatus.CANCELLED
                slot_exp = (
                    db.query(ParkingSlot)
                    .filter(ParkingSlot.id == booking.slot_id)
                    .first()
                )
                if slot_exp and slot_exp.status == SlotStatus.RESERVED:
                    slot_exp.status = SlotStatus.AVAILABLE
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Reservation hold expired before payment confirmation.",
                )

        # Revalidate slot availability against Maintenance and overlapping Confirmed/Active bookings
        slot = (
            db.query(ParkingSlot)
            .filter(ParkingSlot.id == booking.slot_id)
            .first()
        )
        if not slot or slot.status == SlotStatus.MAINTENANCE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Availability revalidation failed: bay is currently in maintenance.",
            )

        req_start = _to_utc(booking.start_time)
        req_end = _to_utc(booking.end_time)
        conflicting = (
            db.query(Booking)
            .filter(
                Booking.slot_id == booking.slot_id,
                Booking.id != booking.id,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
            )
            .all()
        )
        for other in conflicting:
            o_start = _to_utc(other.start_time)
            o_end = _to_utc(other.end_time)
            if req_start < o_end and req_end > o_start:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Availability revalidation failed: bay was confirmed by "
                        f"{other.booking_reference} during checkout."
                    ),
                )

        db.add(
            BookingEvent(
                booking_id=booking.id,
                booking_reference=booking.booking_reference,
                event_type="AVAILABILITY_REVALIDATED",
                previous_status=booking.status.value,
                new_status=booking.status.value,
                details=f"Revalidated zero overlap on Bay {slot.slot_number} prior to payment capture.",
            )
        )

        payment = (
            db.query(Payment).filter(Payment.booking_id == booking.id).first()
        )
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment record not found for booking.",
            )

        if payment.razorpay_order_id != payload.razorpay_order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order ID mismatch during payment verification.",
            )

        expected_signature = compute_razorpay_signature(
            payload.razorpay_order_id, payload.razorpay_payment_id
        )

        if not payment.is_simulated:
            if not payload.razorpay_signature or not hmac.compare_digest(
                expected_signature, payload.razorpay_signature
            ):
                payment.status = PaymentStatus.FAILED
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Razorpay payment cryptographic signature.",
                )

        payment.razorpay_payment_id = payload.razorpay_payment_id
        payment.razorpay_signature = payload.razorpay_signature or expected_signature
        payment.payment_method = payload.payment_method
        payment.status = PaymentStatus.CAPTURED
        payment.verified_at = now

        prev_status = booking.status.value
        booking.status = BookingStatus.CONFIRMED
        slot.status = SlotStatus.RESERVED
        reservation_lock_manager.release_hold(
            booking.slot_id, booking.booking_reference
        )

        db.add(
            BookingEvent(
                booking_id=booking.id,
                booking_reference=booking.booking_reference,
                event_type="PAYMENT_CONFIRMED",
                previous_status=prev_status,
                new_status="CONFIRMED",
                details=f"Verified Razorpay order {payment.razorpay_order_id} via {payload.payment_method}.",
            )
        )
        db.commit()
        db.refresh(booking)
        return booking
