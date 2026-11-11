"""Server-Side Razorpay Payment Verification Service."""
import hashlib
import hmac
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.config import settings
from app.models import Booking, BookingStatus, Payment, PaymentStatus
from app.schemas import PaymentVerifyRequest


def compute_razorpay_signature(order_id: str, payment_id: str) -> str:
    secret = (settings.RAZORPAY_KEY_SECRET or "parkwise-razorpay-sim-secret").encode(
        "utf-8"
    )
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def verify_and_capture_payment(
    db: Session, payload: PaymentVerifyRequest
) -> Booking:
    """Verify payment authenticity on the backend and transition booking to CONFIRMED."""
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

    # In production mode (when simulation is disabled), strictly require valid HMAC signature
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
    payment.verified_at = datetime.now(timezone.utc)

    booking.status = BookingStatus.CONFIRMED
    db.commit()
    db.refresh(booking)
    return booking
