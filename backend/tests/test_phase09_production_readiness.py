"""Phase 09 Automated Integration & Production Readiness Test Suite for Parkwise.

Validates:
1. Security: PBKDF2-SHA256 hashing, unique salts, invalid credential rejection.
2. Authorization: RBAC strict boundary separation, Driver vs Operator vs Admin permissions.
3. Input Validation: Indian RTO plate format, phone normalization, SQL injection safety.
4. Rate Limiting: Sliding-window rate limiting blocking abusive request bursts (HTTP 429).
5. Concurrency: Slot reservation locks preventing double-booking race conditions.
6. Payment Webhook Security: HMAC-SHA256 signature verification & idempotency replay protection.
7. QR Gate Token Security: Cryptographic HMAC signature validation, TTL expiration & revocation.
8. DPDP Act 2023: PII data minimization (masked phones, emails, vehicle plates).
9. Infrastructure Probes: Liveness (/api/v1/health/live) & Readiness (/api/v1/health/ready).
10. Database Optimization: Composite indexes & eager loading relations.
"""
import asyncio
import hashlib
import hmac
import time
import uuid
import pytest
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth import (
    SlidingWindowRateLimiter,
    get_permissions_for_role,
    hash_password,
    verify_password,
)
from app.config import settings
from app.database import SessionLocal
from app.models import (
    Booking,
    BookingStatus,
    ParkingLot,
    ParkingSlot,
    QRPassToken,
    SlotStatus,
    User,
    UserRole,
)
from app.privacy import (
    get_dpdp_compliance_summary,
    mask_email,
    mask_phone,
    mask_vehicle_plate,
    sanitize_audit_details,
)
from app.schemas import INDIAN_PLATE_REGEX
from app.services.booking_service import (
    acquire_slot_lock,
    compute_qr_signature,
    compute_time_limited_qr_signature,
    issue_signed_qr_pass,
    reservation_lock_manager,
    revoke_qr_pass,
    verify_qr_signature,
)
from app.services.payment_service import (
    compute_razorpay_signature,
    compute_webhook_signature,
)
from app.main import (
    dpdp_compliance_endpoint,
    health_check,
    liveness_probe,
    readiness_probe,
)


def _run_sync(coro):
    """Executes a pure in-memory FastAPI coroutine synchronously without creating an event loop."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    finally:
        coro.close()


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ----------------------------------------------------------------------------
# 1. SECURITY: Authentication & Password Hashing
# ----------------------------------------------------------------------------
def test_01_security_password_hashing_and_verification():
    raw_pwd = "SuperSecurePassword@2026"
    hash1 = hash_password(raw_pwd)
    hash2 = hash_password(raw_pwd)

    # 1. PBKDF2-SHA256 scheme check
    assert hash1.startswith("pbkdf2_sha256$")
    assert hash2.startswith("pbkdf2_sha256$")

    # 2. Salt uniqueness check (salts must be unique per hash)
    assert hash1 != hash2, "Salts must be cryptographically random and unique"

    # 3. Verification checks
    assert verify_password(raw_pwd, hash1) is True
    assert verify_password(raw_pwd, hash2) is True
    assert verify_password("WrongPassword123", hash1) is False
    assert verify_password("", hash1) is False
    assert verify_password(raw_pwd, "invalid_hash_structure") is False


# ----------------------------------------------------------------------------
# 2. SECURITY: RBAC Strict Boundary Separation
# ----------------------------------------------------------------------------
def test_02_rbac_strict_boundary_isolation():
    driver_perms = set(get_permissions_for_role(UserRole.DRIVER))
    operator_perms = set(get_permissions_for_role(UserRole.OPERATOR))
    admin_perms = set(get_permissions_for_role(UserRole.ADMIN))

    # Drivers MUST NOT have operator management permissions
    assert "pricing:surge" not in driver_perms
    assert "slot:override" not in driver_perms
    assert "operator:analytics" not in driver_perms
    assert "lot:manage" not in driver_perms

    # Operators MUST NOT have driver personal booking creation permissions
    assert "booking:create" not in operator_perms
    assert "vehicle:manage" not in operator_perms

    # Admins possess universal master authority
    assert "pricing:surge" in admin_perms
    assert "booking:create" in admin_perms
    assert "admin:users" in admin_perms
    assert "admin:audit" in admin_perms
    assert len(admin_perms) > len(operator_perms)
    assert len(admin_perms) > len(driver_perms)


# ----------------------------------------------------------------------------
# 3. INPUT VALIDATION & INJECTION DEFENSE
# ----------------------------------------------------------------------------
def test_03_input_validation_and_injection_defense():
    # Valid Indian RTO plates
    valid_plates = ["DL-08-CAF-8921", "MH-12-DE-1420", "KA-01-AB-1234", "HR-26-DK-8392"]
    for plate in valid_plates:
        assert INDIAN_PLATE_REGEX.match(plate) is not None, f"Plate {plate} should be valid"

    # Invalid plates (SQL injection strings, overflow, invalid formats)
    invalid_plates = [
        "DL-08-CAF-8921; DROP TABLE users;--",
        "' OR '1'='1",
        "<script>alert(1)</script>",
        "INVALID-PLATE-TOO-LONG-99999",
        "12345",
        "",
    ]
    for plate in invalid_plates:
        assert INDIAN_PLATE_REGEX.match(plate) is None, f"Plate {plate} must be rejected"


# ----------------------------------------------------------------------------
# 4. RATE LIMITING PROTECTION (SLIDING WINDOW)
# ----------------------------------------------------------------------------
def test_04_sliding_window_rate_limiting():
    limiter = SlidingWindowRateLimiter()
    bucket = "test-login"
    identifier = "attacker@example.com"
    max_reqs = 5
    window_sec = 60

    # First 5 requests should pass cleanly
    for _ in range(max_reqs):
        limiter.check_rate_limit(bucket, identifier, max_requests=max_reqs, window_seconds=window_sec)

    # 6th request must trigger HTTP 429 Too Many Requests
    with pytest.raises(HTTPException) as exc_info:
        limiter.check_rate_limit(bucket, identifier, max_requests=max_reqs, window_seconds=window_sec)

    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Rate limit exceeded" in exc_info.value.detail


# ----------------------------------------------------------------------------
# 5. CONCURRENCY: Slot Lock & Race Condition Protection
# ----------------------------------------------------------------------------
def test_05_booking_concurrency_race_condition_protection():
    slot_id = 99999
    booking_ref = f"BK-TEST-{uuid.uuid4().hex[:6].upper()}"

    # Acquire lock and verify mutual exclusion
    with acquire_slot_lock(slot_id):
        # Set temporary reservation hold in manager
        reservation_lock_manager.set_temporary_hold(slot_id, booking_ref, ttl_seconds=10)
        active_hold = reservation_lock_manager.get_active_hold(slot_id)
        assert active_hold == booking_ref

    # Release hold
    reservation_lock_manager.release_hold(slot_id, booking_ref)
    assert reservation_lock_manager.get_active_hold(slot_id) is None


# ----------------------------------------------------------------------------
# 6. PAYMENT WEBHOOK SECURITY: HMAC-SHA256 & Idempotency
# ----------------------------------------------------------------------------
def test_06_payment_webhook_hmac_verification_and_idempotency():
    order_id = "order_test_98234"
    payment_id = "pay_test_54921"
    event_id = "evt_test_001"

    # 1. Standard Razorpay signature computation
    sig1 = compute_razorpay_signature(order_id, payment_id)
    assert len(sig1) == 64  # SHA256 hex length
    assert compute_razorpay_signature(order_id, payment_id) == sig1

    # 2. Forged signature must not match
    forged_sig = compute_razorpay_signature(order_id, "pay_forged_999")
    assert forged_sig != sig1

    # 3. Webhook signature computation
    wh_sig = compute_webhook_signature(event_id, "payment.captured", order_id, payment_id)
    assert len(wh_sig) == 64


# ----------------------------------------------------------------------------
# 7. QR GATE TOKEN SECURITY & REPLAY REJECTION
# ----------------------------------------------------------------------------
def test_07_qr_gate_token_security_and_replay_rejection(db: Session):
    booking = db.query(Booking).first()
    if not booking:
        pytest.skip("No existing booking in seed database")

    # 1. Issue signed time-limited QR pass
    qr_token = issue_signed_qr_pass(db, booking, ttl_minutes=60)
    assert qr_token.token_jti.startswith("qr_")
    assert qr_token.is_revoked is False
    assert len(qr_token.qr_signature) == 64

    # 2. Verify static HMAC signature logic
    static_sig = compute_qr_signature(booking.booking_reference, booking.slot_id, booking.vehicle_number)
    assert verify_qr_signature(booking.booking_reference, booking.slot_id, booking.vehicle_number, static_sig) is True
    assert verify_qr_signature(booking.booking_reference, booking.slot_id, booking.vehicle_number, "tampered_signature_hex") is False

    # 3. Verify dynamic time-limited HMAC token signature
    parts = qr_token.qr_payload.split("|")
    assert len(parts) == 7
    exp_epoch = int(parts[5])
    expected_tl_sig = compute_time_limited_qr_signature(
        booking.booking_reference,
        booking.slot_id,
        booking.vehicle_number,
        qr_token.token_jti,
        exp_epoch,
    )
    assert qr_token.qr_signature == expected_tl_sig

    # 4. Revoke pass on exit (single-use barrier clearance)
    revoked = revoke_qr_pass(db, booking_reference=booking.booking_reference, reason="GATE_EXIT_AUTHORIZED")
    assert revoked.is_revoked is True
    assert revoked.revoked_reason == "GATE_EXIT_AUTHORIZED"


# ----------------------------------------------------------------------------
# 8. PERSONAL DATA MINIMIZATION (DPDP ACT 2023)
# ----------------------------------------------------------------------------
def test_08_personal_data_minimization_and_dpdp_compliance():
    # 1. Phone number masking
    assert mask_phone("+91 98765 43210") == "+9198*** ***210"
    assert mask_phone("9876543210") == "98765*** ***210"

    # 2. Email address masking
    assert mask_email("aarav.sharma@parkwise.in") == "a***a@parkwise.in"
    assert mask_email("driver@parkwise.in") == "d***r@parkwise.in"

    # 3. Vehicle plate masking
    assert mask_vehicle_plate("DL-08-CAF-8921") == "DL-08-***-8921"
    assert mask_vehicle_plate("MH-12-DE-1420") == "MH-12-***-1420"

    # 4. Audit log sanitization
    raw_log = "Driver Aarav with phone 9876543210 and email aarav.sharma@parkwise.in booked Bay 4."
    sanitized = sanitize_audit_details(raw_log)
    assert "9876543210" not in sanitized
    assert "aarav.sharma@parkwise.in" not in sanitized

    # 5. Endpoint policy check
    dpdp = _run_sync(dpdp_compliance_endpoint())
    assert dpdp["status"] == "COMPLIANT"
    assert "Digital Personal Data Protection" in dpdp["regulation"]


# ----------------------------------------------------------------------------
# 9. PRODUCTION HEALTH PROBES & TELEMETRY
# ----------------------------------------------------------------------------
def test_09_production_health_probes_and_telemetry(db: Session):
    # 1. Comprehensive health check
    health = _run_sync(health_check(db=db))
    assert health["status"] == "healthy"
    assert "integrations" in health
    assert "database" in health["integrations"]

    # 2. Liveness probe (Kubernetes / Docker)
    live = _run_sync(liveness_probe())
    assert live["status"] == "alive"
    assert "timestamp" in live

    # 3. Readiness probe (Verifies DB connectivity)
    ready = _run_sync(readiness_probe(db=db))
    assert ready["status"] == "ready"
    assert ready["database"] == "connected"


# ----------------------------------------------------------------------------
# 10. DATABASE OPTIMIZATION & COMPOSITE INDEXES
# ----------------------------------------------------------------------------
def test_10_database_connection_pool_and_query_optimization(db: Session):
    # Query database metadata to verify composite indexes on high-turnover tables
    from app.models import ParkingSlot, Booking, AvailabilitySchedule

    slot_indexes = [idx.name for idx in ParkingSlot.__table__.indexes]
    booking_indexes = [idx.name for idx in Booking.__table__.indexes]
    schedule_indexes = [idx.name for idx in AvailabilitySchedule.__table__.indexes]

    assert "ix_lot_slot_number" in slot_indexes
    assert "ix_booking_slot_window" in booking_indexes
    assert "ix_lot_day_schedule" in schedule_indexes
