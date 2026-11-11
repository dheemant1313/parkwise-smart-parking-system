"""Comprehensive Integration Test Suite for Parkwise Enterprise Backend."""
from datetime import datetime, timedelta, timezone
from typing import Any, Coroutine
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from app.database import Base, SessionLocal, engine
from app.main import (
    create_booking,
    get_admin_overview,
    get_ai_forecast,
    get_parking_lot_detail,
    health_check,
    list_parking_lots,
    login,
    process_gate_scan,
    update_lot_surge,
    update_slot_status,
    verify_payment,
)
from app.models import SlotStatus, User, UserRole
from app.schemas import (
    BookingCreateRequest,
    GateScanRequest,
    LoginRequest,
    PaymentVerifyRequest,
    SlotStatusUpdateRequest,
    SurgeUpdateRequest,
)
from app.seed import seed_initial_data


def _run_sync(coro: Coroutine[Any, Any, Any]) -> Any:
    """Execute a pure in-memory FastAPI route coroutine without Windows loopback socketpair."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    finally:
        coro.close()


def test_enterprise_parkwise_lifecycle():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)

        # 1. Health & Integration Transparency Check
        h_data = _run_sync(health_check(db=db))
        assert h_data["status"] == "healthy"
        assert h_data["metrics"]["total_lots"] >= 5

        # 2. List Indian Metro Parking Lots & Inspect Slots
        lots = _run_sync(list_parking_lots(city=None, db=db))
        assert len(lots) >= 5
        lot_id = lots[1]["id"]  # Mumbai BKC

        lot_detail = _run_sync(get_parking_lot_detail(lot_id=lot_id, db=db))
        available_slots = [
            s for s in lot_detail["slots"] if s["status"].value == "AVAILABLE"
        ]
        assert len(available_slots) > 0
        target_slot_id = available_slots[0]["id"]

        # 3. Validate Strict Indian Vehicle Plate Format (Reject Invalid Plate)
        now = datetime.now(timezone.utc)
        with pytest.raises(ValidationError):
            BookingCreateRequest(
                lot_id=lot_id,
                slot_id=target_slot_id,
                vehicle_number="INVALID-PLATE",
                driver_name="Rohan Verma",
                driver_phone="+919811223344",
                start_time=now + timedelta(hours=1),
                end_time=now + timedelta(hours=3),
            )

        # 4. Create Transactional Booking
        valid_req = BookingCreateRequest(
            lot_id=lot_id,
            slot_id=target_slot_id,
            vehicle_number="MH-01-AB-4589",
            driver_name="Rohan Verma",
            driver_phone="+919811223344",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=3),
        )
        booking = _run_sync(create_booking(payload=valid_req, db=db))
        assert booking.status.value == "PENDING_PAYMENT"
        assert booking.total_amount_inr > booking.base_amount_inr
        booking_ref = booking.booking_reference
        order_id = booking.payment.razorpay_order_id
        qr_signature = booking.qr_signature

        # 5. Double-Booking Prevention Test (Overlapping Window -> 409 Conflict)
        overlap_req = BookingCreateRequest(
            lot_id=lot_id,
            slot_id=target_slot_id,
            vehicle_number="KA-03-MN-1122",
            driver_name="Priya Nair",
            driver_phone="+919899887766",
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=4),
        )
        with pytest.raises(HTTPException) as exc_info:
            _run_sync(create_booking(payload=overlap_req, db=db))
        assert exc_info.value.status_code == 409
        assert "Double-booking prevented" in exc_info.value.detail

        # 6. Server-Side Payment Verification (Razorpay Order Capture)
        pay_req = PaymentVerifyRequest(
            booking_reference=booking_ref,
            razorpay_order_id=order_id,
            razorpay_payment_id="pay_test_9988776655",
            payment_method="UPI / FASTag Auto-Debit",
        )
        paid_booking = _run_sync(verify_payment(payload=pay_req, db=db))
        assert paid_booking.status.value == "CONFIRMED"

        # 7. Gate Terminal Cryptographic Verification (Reject Tampered Signature)
        forged_req = GateScanRequest(
            lot_id=lot_id,
            booking_reference=booking_ref,
            qr_signature="forged_invalid_signature_000000",
            vehicle_number="MH-01-AB-4589",
            action="ENTRY",
        )
        with pytest.raises(HTTPException) as gate_exc:
            _run_sync(process_gate_scan(payload=forged_req, db=db))
        assert gate_exc.value.status_code == 403

        # 8. Gate Terminal Valid ENTRY & EXIT
        entry_req = GateScanRequest(
            lot_id=lot_id,
            booking_reference=booking_ref,
            qr_signature=qr_signature,
            vehicle_number="MH-01-AB-4589",
            action="ENTRY",
        )
        entry_res = _run_sync(process_gate_scan(payload=entry_req, db=db))
        assert entry_res.barrier_status == "OPENED"

        exit_req = GateScanRequest(
            lot_id=lot_id,
            booking_reference=booking_ref,
            qr_signature=qr_signature,
            vehicle_number="MH-01-AB-4589",
            action="EXIT",
        )
        exit_res = _run_sync(process_gate_scan(payload=exit_req, db=db))
        assert exit_res.event_type == "EXIT"

        # 9. Role-Based Access Control (RBAC) & Operator Controls
        login_res = _run_sync(
            login(
                payload=LoginRequest(
                    email="admin@parkwise.in", password="parkwise123"
                ),
                db=db,
            )
        )
        assert login_res.role == UserRole.ADMIN

        admin_user = (
            db.query(User).filter(User.email == "admin@parkwise.in").first()
        )
        admin_overview = _run_sync(
            get_admin_overview(db=db, current_user=admin_user)
        )
        assert admin_overview["national_kpis"]["total_facilities"] >= 5

        updated_slot = _run_sync(
            update_slot_status(
                slot_id=target_slot_id,
                payload=SlotStatusUpdateRequest(status=SlotStatus.MAINTENANCE),
                db=db,
            )
        )
        assert updated_slot.status == SlotStatus.MAINTENANCE

        updated_lot = _run_sync(
            update_lot_surge(
                lot_id=lot_id,
                payload=SurgeUpdateRequest(
                    dynamic_pricing_enabled=True, current_surge_multiplier=1.55
                ),
                db=db,
            )
        )
        assert updated_lot["current_surge_multiplier"] == 1.55

        # 10. AI Forecasting Engine Verification
        ai_data = _run_sync(get_ai_forecast(lot_id=lot_id, db=db))
        assert ai_data.is_live_ml_inference is True
        assert len(ai_data.hourly_forecast) == 12
    finally:
        db.close()
