"""Phase 05 Server-Side Razorpay Payment Gateway, Webhook Verification, Refunds & GST Receipts Service."""
import hashlib
import hmac
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.config import settings
from app.models import (
    AuditLog,
    Booking,
    BookingEvent,
    BookingStatus,
    ParkingLot,
    ParkingSlot,
    Payment,
    PaymentStatus,
    PaymentWebhookEvent,
    QRPassToken,
    SlotStatus,
)
from app.schemas import (
    PaymentOrderCreateRequest,
    PaymentOrderResponse,
    PaymentReceiptResponse,
    PaymentRefundRequest,
    PaymentVerifyRequest,
    RazorpayWebhookRequest,
    RazorpayWebhookResponse,
)
from app.services.booking_service import (
    acquire_slot_lock,
    issue_signed_qr_pass,
    reservation_lock_manager,
)


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def compute_razorpay_signature(order_id: str, payment_id: str) -> str:
    """Compute Razorpay standard HMAC-SHA256 signature over order_id|payment_id."""
    secret = (
        settings.RAZORPAY_KEY_SECRET or "parkwise-razorpay-sim-secret"
    ).encode("utf-8")
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def compute_webhook_signature(
    webhook_event_id: str,
    event_type: str,
    razorpay_order_id: str,
    razorpay_payment_id: str,
) -> str:
    """Compute Razorpay webhook HMAC-SHA256 signature over canonical webhook fields."""
    secret = (
        settings.RAZORPAY_WEBHOOK_SECRET or "parkwise-razorpay-webhook-secret"
    ).encode("utf-8")
    msg = (
        f"{webhook_event_id}|{event_type}|"
        f"{razorpay_order_id}|{razorpay_payment_id}"
    ).encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def create_or_refresh_razorpay_order(
    db: Session, payload: PaymentOrderCreateRequest
) -> PaymentOrderResponse:
    """Create or retrieve a Razorpay Test Mode order for a booking with UPI Intent URI."""
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
    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot create payment order for a cancelled booking.",
        )

    payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()
    if not payment:
        payment = Payment(
            booking_id=booking.id,
            razorpay_order_id=f"order_pw_{uuid.uuid4().hex[:14]}",
            amount_inr=booking.total_amount_inr,
            currency="INR",
            payment_method=payload.payment_method,
            upi_vpa=payload.upi_vpa,
            status=PaymentStatus.CREATED,
            is_simulated=True,
        )
        db.add(payment)
    else:
        payment.amount_inr = booking.total_amount_inr
        payment.payment_method = payload.payment_method
        if payload.upi_vpa:
            payment.upi_vpa = payload.upi_vpa

    db.add(
        BookingEvent(
            booking_id=booking.id,
            booking_reference=booking.booking_reference,
            event_type="PAYMENT_ORDER_CREATED",
            previous_status=booking.status.value,
            new_status=booking.status.value,
            details=(
                f"Prepared Razorpay order {payment.razorpay_order_id} "
                f"for ₹{payment.amount_inr} ({payload.payment_method})."
            ),
        )
    )
    db.commit()
    db.refresh(payment)

    amount_paise = int(round(payment.amount_inr * 100))
    sample_pay_id = (
        payment.razorpay_payment_id or f"pay_test_{booking.id}_{booking.slot_id}"
    )
    preview_sig = compute_razorpay_signature(
        payment.razorpay_order_id, sample_pay_id
    )
    upi_uri = (
        f"upi://pay?pa=parkwise.rzp@icici"
        f"&pn={quote('Parkwise Smart Parking')}"
        f"&tr={quote(payment.razorpay_order_id)}"
        f"&tn={quote(f'Booking {booking.booking_reference}')}"
        f"&am={payment.amount_inr:.2f}&cu=INR"
    )

    return PaymentOrderResponse(
        booking_reference=booking.booking_reference,
        razorpay_key_id=settings.RAZORPAY_KEY_ID or "rzp_test_parkwise_in_2026",
        razorpay_order_id=payment.razorpay_order_id,
        amount_inr=payment.amount_inr,
        amount_paise=amount_paise,
        currency=payment.currency,
        payment_method=payment.payment_method,
        upi_vpa=payment.upi_vpa,
        upi_intent_uri=upi_uri,
        status=payment.status,
        is_test_mode=True,
        test_payment_id_suggestion=sample_pay_id,
        test_signature_preview=preview_sig,
    )


def verify_and_capture_payment(
    db: Session, payload: PaymentVerifyRequest
) -> Booking:
    """Revalidate slot availability inside a lock, verify payment signature, and confirm booking."""
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
        if (
            booking.reservation_expires_at
            and booking.status == BookingStatus.PENDING_PAYMENT
        ):
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
                Booking.status.in_(
                    [BookingStatus.CONFIRMED, BookingStatus.ACTIVE]
                ),
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

        # Always verify signature when provided (or when not in simulation mode)
        if payload.razorpay_signature is not None or not payment.is_simulated:
            provided_sig = (payload.razorpay_signature or "").strip()
            if not provided_sig or not hmac.compare_digest(
                expected_signature, provided_sig
            ):
                payment.status = PaymentStatus.FAILED
                db.add(
                    AuditLog(
                        actor_email=booking.driver_name,
                        actor_role="DRIVER",
                        action="PAYMENT_SIGNATURE_REJECTED",
                        target_resource=booking.booking_reference,
                        details=f"Rejected tampered Razorpay signature for order {payload.razorpay_order_id}.",
                    )
                )
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Razorpay payment cryptographic signature.",
                )

        payment.razorpay_payment_id = payload.razorpay_payment_id
        payment.razorpay_signature = (
            payload.razorpay_signature or expected_signature
        )
        payment.payment_method = payload.payment_method
        if payload.upi_vpa:
            payment.upi_vpa = payload.upi_vpa
        if not payment.receipt_number:
            payment.receipt_number = (
                f"PW-GST-{now.strftime('%Y%m%d')}-{booking.id:04d}"
            )
        payment.status = PaymentStatus.CAPTURED
        payment.verified_at = now

        prev_status = booking.status.value
        booking.status = BookingStatus.CONFIRMED
        slot.status = SlotStatus.RESERVED
        reservation_lock_manager.release_hold(
            booking.slot_id, booking.booking_reference
        )

        # Ensure signed time-limited QR pass token exists upon payment confirmation
        if not booking.qr_passes:
            issue_signed_qr_pass(db, booking, ttl_minutes=None, commit=False)

        db.add(
            BookingEvent(
                booking_id=booking.id,
                booking_reference=booking.booking_reference,
                event_type="PAYMENT_CONFIRMED",
                previous_status=prev_status,
                new_status="CONFIRMED",
                details=(
                    f"Verified Razorpay order {payment.razorpay_order_id} "
                    f"via {payload.payment_method} (Receipt {payment.receipt_number})."
                ),
            )
        )
        db.commit()
        db.refresh(booking)
        return booking


def process_idempotent_razorpay_webhook(
    db: Session,
    payload: RazorpayWebhookRequest,
    signature_header: Optional[str],
) -> RazorpayWebhookResponse:
    """Verify trusted Razorpay webhook signature and process event idempotently."""
    expected_sig = compute_webhook_signature(
        payload.webhook_event_id,
        payload.event_type,
        payload.razorpay_order_id,
        payload.razorpay_payment_id,
    )
    if not signature_header or not hmac.compare_digest(
        expected_sig, signature_header.strip()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Untrusted webhook rejected: invalid X-Razorpay-Signature HMAC.",
        )

    payment = (
        db.query(Payment)
        .filter(Payment.razorpay_order_id == payload.razorpay_order_id)
        .first()
    )
    if not payment or not payment.booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment order referenced by webhook not found.",
        )
    booking = payment.booking

    # Idempotency check: has this webhook_event_id already been processed?
    existing_event = (
        db.query(PaymentWebhookEvent)
        .filter(
            PaymentWebhookEvent.webhook_event_id == payload.webhook_event_id
        )
        .first()
    )
    if existing_event:
        return RazorpayWebhookResponse(
            webhook_event_id=existing_event.webhook_event_id,
            event_type=existing_event.event_type,
            idempotent_replay=True,
            signature_verified=True,
            booking_reference=booking.booking_reference,
            booking_status=booking.status.value,
            payment_status=payment.status.value,
            processed_at=existing_event.processed_at,
        )

    now = datetime.now(timezone.utc)
    if payload.event_type == "payment.captured":
        payment.razorpay_payment_id = payload.razorpay_payment_id
        payment.razorpay_signature = compute_razorpay_signature(
            payload.razorpay_order_id, payload.razorpay_payment_id
        )
        payment.payment_method = payload.payment_method
        if payload.upi_vpa:
            payment.upi_vpa = payload.upi_vpa
        if not payment.receipt_number:
            payment.receipt_number = (
                f"PW-GST-{now.strftime('%Y%m%d')}-{booking.id:04d}"
            )
        payment.status = PaymentStatus.CAPTURED
        payment.verified_at = now
        if booking.status == BookingStatus.PENDING_PAYMENT:
            booking.status = BookingStatus.CONFIRMED
            if not booking.qr_passes:
                issue_signed_qr_pass(db, booking, ttl_minutes=None, commit=False)
        status_applied = "CAPTURED"
    elif payload.event_type == "payment.failed":
        payment.status = PaymentStatus.FAILED
        status_applied = "FAILED"
    else:  # refund.processed
        refund_amt = payload.refund_amount_inr or payment.amount_inr
        payment.status = PaymentStatus.REFUNDED
        payment.refund_id = f"rfnd_wh_{uuid.uuid4().hex[:10]}"
        payment.refund_amount_inr = refund_amt
        payment.refund_reason = "Processed via Razorpay refund.processed webhook"
        payment.refunded_at = now
        if booking.status in (
            BookingStatus.PENDING_PAYMENT,
            BookingStatus.CONFIRMED,
        ):
            booking.status = BookingStatus.CANCELLED
            slot = (
                db.query(ParkingSlot)
                .filter(ParkingSlot.id == booking.slot_id)
                .first()
            )
            if slot and slot.status == SlotStatus.RESERVED:
                slot.status = SlotStatus.AVAILABLE
        status_applied = "REFUNDED"

    webhook_record = PaymentWebhookEvent(
        webhook_event_id=payload.webhook_event_id,
        event_type=payload.event_type,
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        signature_verified=True,
        status_applied=status_applied,
        payload_summary=f"{payload.event_type} for {booking.booking_reference}",
        processed_at=now,
    )
    db.add(webhook_record)
    db.add(
        BookingEvent(
            booking_id=booking.id,
            booking_reference=booking.booking_reference,
            event_type=f"WEBHOOK_{payload.event_type.upper().replace('.', '_')}",
            previous_status=None,
            new_status=booking.status.value,
            details=f"Processed idempotent webhook {payload.webhook_event_id} ({status_applied}).",
        )
    )
    db.commit()
    db.refresh(webhook_record)

    return RazorpayWebhookResponse(
        webhook_event_id=webhook_record.webhook_event_id,
        event_type=webhook_record.event_type,
        idempotent_replay=False,
        signature_verified=True,
        booking_reference=booking.booking_reference,
        booking_status=booking.status.value,
        payment_status=payment.status.value,
        processed_at=webhook_record.processed_at,
    )


def process_payment_refund(
    db: Session, booking_reference: str, payload: PaymentRefundRequest
) -> Booking:
    """Execute a full or partial Razorpay refund workflow and revoke QR passes if cancelled."""
    booking = (
        db.query(Booking)
        .filter(Booking.booking_reference == booking_reference)
        .first()
    )
    if not booking or not booking.payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking or payment record not found.",
        )

    payment = booking.payment
    if payment.status == PaymentStatus.REFUNDED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment has already been refunded.",
        )
    if payment.status != PaymentStatus.CAPTURED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only CAPTURED payments can be refunded (current status: {payment.status.value}).",
        )

    refund_amt = (
        round(min(payload.refund_amount_inr, payment.amount_inr), 2)
        if payload.refund_amount_inr
        else payment.amount_inr
    )
    now = datetime.now(timezone.utc)
    payment.status = PaymentStatus.REFUNDED
    payment.refund_id = f"rfnd_pw_{uuid.uuid4().hex[:12]}"
    payment.refund_amount_inr = refund_amt
    payment.refund_reason = payload.reason.strip()
    payment.refunded_at = now

    prev_status = booking.status.value
    if (
        refund_amt >= payment.amount_inr
        and booking.status
        in (BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED)
    ):
        booking.status = BookingStatus.CANCELLED
        slot = (
            db.query(ParkingSlot)
            .filter(ParkingSlot.id == booking.slot_id)
            .first()
        )
        if slot and slot.status == SlotStatus.RESERVED:
            slot.status = SlotStatus.AVAILABLE
        for qp in booking.qr_passes or []:
            qp.is_revoked = True
            qp.revoked_reason = "Payment refunded and booking cancelled"
            qp.revoked_at = now

    db.add(
        BookingEvent(
            booking_id=booking.id,
            booking_reference=booking.booking_reference,
            event_type="PAYMENT_REFUNDED",
            previous_status=prev_status,
            new_status=booking.status.value,
            details=(
                f"Refunded ₹{refund_amt} ({payment.refund_id}): {payment.refund_reason}"
            ),
        )
    )
    db.add(
        AuditLog(
            actor_email=booking.driver_name,
            actor_role="DRIVER",
            action="PAYMENT_REFUND_PROCESSED",
            target_resource=f"{booking.booking_reference} ({payment.refund_id})",
            details=f"Refunded ₹{refund_amt} on order {payment.razorpay_order_id}.",
        )
    )
    db.commit()
    db.refresh(booking)
    return booking


def generate_payment_receipt(
    db: Session, booking_reference: str
) -> PaymentReceiptResponse:
    """Generate a GST-compliant tax invoice receipt with cryptographic hash."""
    booking = (
        db.query(Booking)
        .filter(Booking.booking_reference == booking_reference)
        .first()
    )
    if not booking or not booking.payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking or payment record not found.",
        )

    payment = booking.payment
    lot = db.query(ParkingLot).filter(ParkingLot.id == booking.lot_id).first()
    slot = (
        db.query(ParkingSlot).filter(ParkingSlot.id == booking.slot_id).first()
    )

    receipt_no = (
        payment.receipt_number
        or f"PW-GST-{booking.created_at.strftime('%Y%m%d')}-{booking.id:04d}"
    )
    cgst = round(booking.gst_amount_inr / 2.0, 2)
    sgst = round(booking.gst_amount_inr - cgst, 2)

    hash_input = (
        f"{receipt_no}|{booking.booking_reference}|"
        f"{payment.razorpay_order_id}|{booking.total_amount_inr}"
    ).encode("utf-8")
    receipt_hash = hmac.new(
        settings.QR_HMAC_SECRET.encode("utf-8"), hash_input, hashlib.sha256
    ).hexdigest()[:24]

    return PaymentReceiptResponse(
        receipt_number=receipt_no,
        booking_reference=booking.booking_reference,
        issued_at=payment.verified_at or booking.created_at,
        lot_name=lot.name if lot else "Parkwise Smart Facility",
        lot_code=lot.code if lot else "PW-IN-01",
        city=lot.city if lot else "New Delhi",
        slot_number=slot.slot_number if slot else f"SLOT-{booking.slot_id}",
        driver_name=booking.driver_name,
        driver_phone=booking.driver_phone,
        vehicle_number=booking.vehicle_number,
        sac_code="996749",
        base_amount_inr=booking.base_amount_inr,
        additional_charges_inr=booking.additional_charges_inr or 0.0,
        overstay_fee_inr=booking.overstay_fee_inr or 0.0,
        cgst_9_pct_inr=cgst,
        sgst_9_pct_inr=sgst,
        gst_total_inr=booking.gst_amount_inr,
        total_paid_inr=booking.total_amount_inr,
        refund_amount_inr=payment.refund_amount_inr or 0.0,
        payment_method=payment.payment_method,
        upi_vpa=payment.upi_vpa,
        razorpay_order_id=payment.razorpay_order_id,
        razorpay_payment_id=payment.razorpay_payment_id,
        payment_status=payment.status.value,
        cryptographic_receipt_hash=receipt_hash,
    )
