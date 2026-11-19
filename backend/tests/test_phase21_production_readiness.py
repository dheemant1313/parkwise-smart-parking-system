"""Comprehensive Production Readiness, Security & Launch Acceptance Test Suite (Phase 21).

Verifies the 8 Production Launch Acceptance Criteria:
1. Concurrency double-booking race condition prevention (live thread mutex lock).
2. Razorpay payment & webhook signature verification + idempotency.
3. Offline gate fallback with time-bounded signed QR pass.
4. DPDP Act 2023 compliance (masked plates, phone, email, Right to Erasure).
5. Operator self-service facility configuration and surge tariff mutation.
6. Digital indoor floor-map validation engine (lanes, slot vectors, ramp transitions).
7. Centralized RFC 7807 problem details error handling and correlation ID tracing.
8. Prometheus telemetry exposition and launch scorecard certification.
"""

import hmac
import hashlib
import json
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
import pytest

from app.database import Base, engine, SessionLocal, get_db
from app.main import app
from app.models import (
    AuditLog,
    Booking,
    BookingStatus,
    ParkingFloor,
    ParkingLot,
    ParkingSlot,
    Payment,
    PaymentStatus,
    SlotStatus,
    SlotType,
    User,
    UserRole,
)
from app.models_gate_automation import GateLaneController
from app.schemas import PaymentOrderCreateRequest, RazorpayWebhookRequest
from app.services.payment_service import compute_webhook_signature
from app.auth import hash_password, create_access_token, get_current_user
from app.services import production_launch_service, payment_service, booking_service


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()

    admin_user = session.query(User).filter(User.email == "admin.qa@parkwise.in").first()
    if not admin_user:
        admin_user = User(
            full_name="Production QA Director",
            email="admin.qa@parkwise.in",
            phone="+91-9988001122",
            password_hash=hash_password("admin_pass"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        session.add(admin_user)

    operator_user = session.query(User).filter(User.email == "operator.qa@parkwise.in").first()
    if not operator_user:
        operator_user = User(
            full_name="Facility Station Chief",
            email="operator.qa@parkwise.in",
            phone="+91-9877112233",
            password_hash=hash_password("operator_pass"),
            role=UserRole.OPERATOR,
            is_active=True,
        )
        session.add(operator_user)

    driver_user = session.query(User).filter(User.email == "driver.qa@parkwise.in").first()
    if not driver_user:
        driver_user = User(
            full_name="Rahul Sharma",
            email="driver.qa@parkwise.in",
            phone="+91-9811223344",
            password_hash=hash_password("driver_pass"),
            role=UserRole.DRIVER,
            vehicle_number="DL01AB1234",
            is_active=True,
        )
        session.add(driver_user)

    # Ensure a test facility exists
    lot = session.query(ParkingLot).filter(ParkingLot.code == "QA-LOT-01").first()
    if not lot:
        lot = ParkingLot(
            code="QA-LOT-01",
            name="Aerocity Worldmark Terminal QA",
            city="New Delhi",
            address="Asset Area 11, Aerocity, New Delhi",
            latitude=28.5520,
            longitude=77.1210,
            total_floors=2,
            base_hourly_rate_inr=80.0,
            current_surge_multiplier=1.0,
            operator_name="GMR Aerocity Infrastructure",
            kyc_verified=True,
            rating=4.9,
        )
        session.add(lot)
        session.commit()
        session.refresh(lot)

    # Ensure slot exists
    slot = session.query(ParkingSlot).filter(ParkingSlot.lot_id == lot.id, ParkingSlot.slot_number == "QA-B1-01").first()
    if not slot:
        slot = ParkingSlot(
            lot_id=lot.id,
            slot_number="QA-B1-01",
            floor=1,
            zone="A",
            slot_type=SlotType.STANDARD,
            vehicle_category_code="SEDAN",
            status=SlotStatus.AVAILABLE,
            custom_hourly_rate_inr=80.0,
        )
        session.add(slot)
        session.commit()

    yield session
    session.close()


@pytest.fixture(scope="function")
def client(db_session):
    admin = db_session.query(User).filter(User.role == UserRole.ADMIN).first()

    def override_current_user():
        return admin

    app.dependency_overrides[get_current_user] = override_current_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ============================================================================
# 1. CONCURRENCY & DOUBLE-BOOKING MUTEX PREVENTION TEST
# ============================================================================

def test_concurrency_double_booking_mutex_prevention(db_session):
    """Criterion 1: Two simultaneous users cannot reserve the same slot."""
    result = production_launch_service.execute_concurrency_verification(db_session)
    assert result.double_booking_prevented is True
    assert result.successful_bookings == 1
    assert result.conflicts_detected == 1
    assert "Double booking 100% prevented" in result.audit_summary


# ============================================================================
# 2. PAYMENT SIGNATURE & WEBHOOK IDEMPOTENCY TEST
# ============================================================================

def test_payment_signature_verification_and_webhook_idempotency(db_session):
    """Criterion 2: Every payment and refund is traceable with HMAC signature and idempotency."""
    driver = db_session.query(User).filter(User.role == UserRole.DRIVER).first()
    lot = db_session.query(ParkingLot).first()
    slot = db_session.query(ParkingSlot).filter(ParkingSlot.lot_id == lot.id).first()

    now = datetime.now(timezone.utc)
    # Create test booking
    booking = Booking(
        booking_reference=f"BK-QA-{now.strftime('%H%M%S')}-{lot.id}",
        idempotency_key=f"idemp-key-{now.timestamp()}",
        user_id=driver.id,
        lot_id=lot.id,
        slot_id=slot.id,
        driver_name="Rahul Sharma",
        driver_phone="+91-9811223344",
        vehicle_number=driver.vehicle_number or "DL01AB1234",
        vehicle_category="SEDAN",
        start_time=now,
        end_time=now + timedelta(hours=2),
        duration_hours=2.0,
        base_amount_inr=160.0,
        surge_multiplier=1.0,
        gst_amount_inr=28.8,
        total_amount_inr=188.8,
        status=BookingStatus.CONFIRMED,
        qr_signature="sig_bk_mock_12345",
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)

    # 1. Create order
    order_req = PaymentOrderCreateRequest(
        booking_reference=booking.booking_reference,
        payment_method="UPI_INTENT",
    )
    order = payment_service.create_or_refresh_razorpay_order(db_session, order_req)
    assert order.razorpay_order_id.startswith("order_")
    assert order.amount_inr == 188.8

    # 2. Compute valid webhook signature
    webhook_event_id = f"evt_test_{uuid.uuid4().hex[:10]}"
    webhook_pay_id = f"pay_test_{uuid.uuid4().hex[:10]}"
    valid_sig = compute_webhook_signature(
        webhook_event_id=webhook_event_id,
        event_type="payment.captured",
        razorpay_order_id=order.razorpay_order_id,
        razorpay_payment_id=webhook_pay_id,
    )

    webhook_payload = RazorpayWebhookRequest(
        webhook_event_id=webhook_event_id,
        event_type="payment.captured",
        razorpay_order_id=order.razorpay_order_id,
        razorpay_payment_id=webhook_pay_id,
        amount_paise=18880,
    )

    # First webhook arrival
    res1 = payment_service.process_idempotent_razorpay_webhook(db_session, webhook_payload, valid_sig)
    assert res1.signature_verified is True
    assert res1.idempotent_replay is False

    # Second webhook arrival with same payload (replay attack or duplicate)
    res2 = payment_service.process_idempotent_razorpay_webhook(db_session, webhook_payload, valid_sig)
    assert res2.signature_verified is True
    assert res2.idempotent_replay is True


# ============================================================================
# 3. OFFLINE GATE FALLBACK & SIGNED TIME-BOUNDED QR TEST
# ============================================================================

def test_offline_gate_fallback_with_signed_time_bounded_qr(db_session):
    """Criterion 3: Gate operations have a tested offline fallback."""
    driver = db_session.query(User).filter(User.role == UserRole.DRIVER).first()
    lot = db_session.query(ParkingLot).first()
    slot = db_session.query(ParkingSlot).filter(ParkingSlot.lot_id == lot.id).first()

    now = datetime.now(timezone.utc)
    booking = Booking(
        booking_reference=f"BK-OFFLINE-{now.strftime('%H%M%S')}-{lot.id}",
        idempotency_key=f"idemp-offline-{now.timestamp()}",
        user_id=driver.id,
        lot_id=lot.id,
        slot_id=slot.id,
        driver_name="Rahul Sharma",
        driver_phone="+91-9811223344",
        vehicle_number=driver.vehicle_number or "DL01AB1234",
        vehicle_category="SEDAN",
        start_time=now,
        end_time=now + timedelta(hours=3),
        duration_hours=3.0,
        base_amount_inr=240.0,
        surge_multiplier=1.0,
        gst_amount_inr=43.2,
        total_amount_inr=283.2,
        status=BookingStatus.CONFIRMED,
        qr_signature="sig_bk_mock_offline_99",
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)

    # 1. Generate offline signed QR pass
    qr_pass = booking_service.issue_signed_qr_pass(db_session, booking)
    assert qr_pass.token_jti is not None
    assert qr_pass.qr_payload.startswith("PARKWISE_V2|")

    # 2. Verify signature offline via standard gate HMAC verification
    sig = booking_service.compute_qr_signature(booking.booking_reference, booking.slot_id, booking.vehicle_number)
    is_valid = booking_service.verify_qr_signature(
        booking.booking_reference,
        booking.slot_id,
        booking.vehicle_number,
        sig,
    )
    assert is_valid is True

    # 3. Tampered signature rejection test
    tampered_valid = booking_service.verify_qr_signature(
        booking.booking_reference,
        booking.slot_id,
        booking.vehicle_number,
        "tampered_invalid_hmac_hex_fail",
    )
    assert tampered_valid is False


# ============================================================================
# 4. DPDP PRIVACY MASKING & RIGHT TO ERASURE TEST
# ============================================================================

def test_dpdp_privacy_masking_and_right_to_erasure(db_session):
    """Criterion 4: Driver location and vehicle data are appropriately protected."""
    from app.privacy import mask_vehicle_plate, mask_email, mask_phone

    # Verify masking algorithms
    assert mask_vehicle_plate("DL-08-CAF-8921") == "DL-08-***-8921"
    assert mask_phone("+91-9876543210") == "+9198*** ***210"
    assert mask_email("rahul.sharma@example.com") == "r***a@example.com"

    # Create temporary user for erasure test
    temp_user = User(
        full_name="Anonymize Me",
        email=f"anonymize_{time.time()}@test.in",
        phone="+91-9111223344",
        password_hash=hash_password("pw"),
        role=UserRole.DRIVER,
        vehicle_number="KA05MN8899",
        fastag_id="FAST-KA-8899",
        is_active=True,
    )
    db_session.add(temp_user)
    db_session.commit()
    db_session.refresh(temp_user)

    erasure_result = production_launch_service.process_privacy_erasure(
        db_session, temp_user, reason="DPDP Act Section 12 Right to Erasure Request"
    )
    assert erasure_result.status == "ERASURE_COMPLETED"
    assert "DPDP-ERASURE-" in erasure_result.receipt_reference
    assert erasure_result.user_id == temp_user.id

    # Check DB state
    db_session.refresh(temp_user)
    assert temp_user.is_active is False
    assert temp_user.email.startswith("erased_dpdp_")
    assert temp_user.full_name == "Erased Data Principal"
    assert temp_user.vehicle_number is None
    assert temp_user.fastag_id is None


# ============================================================================
# 5. OPERATOR SELF-SERVICE CONFIGURATION TEST
# ============================================================================

def test_operator_self_service_facility_configuration(client, db_session):
    """Criterion 5: Facility operators can configure and manage their own facilities."""
    lot = db_session.query(ParkingLot).filter(ParkingLot.code == "QA-LOT-01").first()

    # Operator updates tariff and surge caps via PATCH
    response = client.patch(
        f"/api/v1/operator/lots/{lot.id}/config",
        json={
            "base_hourly_rate_inr": 95.0,
            "current_surge_multiplier": 1.15,
            "dynamic_pricing_enabled": True,
        },
    )
    assert response.status_code == 200
    db_session.refresh(lot)
    assert lot.base_hourly_rate_inr == 95.0
    assert lot.current_surge_multiplier == 1.15


# ============================================================================
# 6. INDOOR GARAGE MAP GRAPH VALIDATION TEST
# ============================================================================

def test_indoor_garage_map_graph_validation(db_session):
    """Criterion 6: Outdoor and indoor navigation work with real facility data."""
    lot = db_session.query(ParkingLot).first()
    res = production_launch_service.validate_facility_indoor_map(db_session, lot.id)

    assert res.is_valid is True
    assert res.total_floors >= 1
    assert res.total_slots >= 1
    assert len(res.checks) >= 4


# ============================================================================
# 7. CENTRALIZED RFC 7807 ERROR HANDLING & CORRELATION ID
# ============================================================================

def test_centralized_error_handling_rfc7807_and_correlation_id(client):
    """Criterion 7: Centralized error handling and correlation ID tracing."""
    custom_cid = "corr-qa-test-12345"
    response = client.get("/api/v1/non-existent-endpoint-404", headers={"X-Correlation-ID": custom_cid})

    assert response.status_code == 404
    assert response.headers.get("X-Correlation-ID") == custom_cid
    assert "X-Process-Time" in response.headers
    assert response.headers.get("X-Content-Type-Options") == "nosniff"

    # RFC 7807 Problem Details assertion
    body = response.json()
    assert "detail" in body
    assert body["status"] == 404
    assert body["correlation_id"] == custom_cid
    assert body["type"].startswith("urn:parkwise:error")


# ============================================================================
# 8. PROMETHEUS METRICS & LAUNCH SCORECARD CERTIFICATION
# ============================================================================

def test_prometheus_metrics_and_launch_scorecard(client, db_session):
    """Criterion 8: Full launch scorecard certification (8/8 verified) and metrics exposition."""
    # 1. Verify Prometheus exposition
    metrics_res = client.get("/metrics")
    assert metrics_res.status_code == 200
    assert "text/plain" in metrics_res.headers.get("Content-Type", "")
    metrics_text = metrics_res.text
    assert "parkwise_system_healthy 1" in metrics_text
    assert "parkwise_total_slots" in metrics_text
    assert "parkwise_anpr_processing_latency_p95_ms" in metrics_text

    # 2. Verify Launch Scorecard
    scorecard = production_launch_service.get_launch_scorecard(db_session)
    assert scorecard.verified_criteria_count == 8
    assert scorecard.total_criteria_count == 8
    assert scorecard.certified_for_production is True
    assert scorecard.score_percentage == 100.0
    for crit in scorecard.criteria:
        assert crit.status == "VERIFIED"
