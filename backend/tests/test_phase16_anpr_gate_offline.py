"""Comprehensive automated tests for Phase 16: ANPR, Automated Gate & Offline Operations.

Covers:
1. Indian plate normalization, MoRTH validation & OCR heuristic repair
2. Valid ANPR camera scan auto-authorizes booking and opens barrier
3. Anti-passback prevents duplicate entry for already checked-in vehicle
4. Low-confidence ANPR scan (<0.80) triggers human review task and holds barrier
5. Gate staff resolves manual review with plate correction and opens barrier
6. QR-code fallback entry when plate camera is unreadable
7. Gate lane controller barrier commands and supervisor manual override
8. Offline manifest generation with cryptographic HMAC-SHA256 tokens
9. Local offline token verification at edge gate kiosk without internet
10. Batch offline event synchronization, booking state reconciliation & deduplication
11. Privacy plate data masking and DPDP retention pruning
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import (
    Booking,
    BookingStatus,
    ParkingLot,
    ParkingSlot,
    SlotStatus,
    SlotType,
    User,
    UserRole,
)
from app.models_gate_automation import (
    AccessDecision,
    ANPRManualReviewTask,
    ANPRVerificationEvent,
    BarrierState,
    GateAuditLog,
    GateHardwareHealth,
    GateLaneController,
    GateReviewStatus,
    LaneDirection,
    VerificationMethod,
)
from app.schemas_gate_automation import (
    ANPRReviewResolveRequest,
    ANPRScanRequest,
    GateBarrierControlRequest,
    GateManualOverrideRequest,
    GatePruneRequest,
    GateQRVerifyRequest,
    LocalOfflineVerifyRequest,
    OfflineEventSyncItem,
    OfflineBatchSyncRequest,
)
from app.services.anpr_normalizer import (
    clean_raw_plate,
    generate_fuzzy_candidates,
    hash_plate_privacy,
    mask_plate_for_privacy,
    normalize_and_validate_plate,
    repair_ocr_confusions,
)
from app.services.gate_access_service import (
    command_gate_barrier,
    execute_manual_gate_override,
    get_gate_analytics_summary,
    get_gate_event_history,
    get_pending_review_tasks,
    process_anpr_scan,
    process_qr_fallback,
    prune_anpr_records_retention,
    resolve_manual_review,
    seed_phase16_gate_controllers,
)
from app.services.gate_offline_service import (
    generate_facility_offline_manifest,
    reconcile_offline_events_batch,
    sign_booking_offline_token,
    verify_booking_offline_token,
    verify_local_offline_access,
)


@pytest.fixture(scope="module")
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    seed_phase16_gate_controllers(session)
    yield session
    session.close()


def test_01_indian_plate_normalization_and_ocr_repair():
    """Test 1: Normalization, MoRTH validation, OCR repair, and privacy masking."""
    # Standard format
    p1, v1, t1 = normalize_and_validate_plate("DL-08-CAF-8921")
    assert p1 == "DL08CAF8921"
    assert v1 is True
    assert t1 == "STANDARD_MORTH"

    # Karnataka standard with spaces
    p2, v2, t2 = normalize_and_validate_plate("KA 01 AB 1234")
    assert p2 == "KA01AB1234"
    assert v2 is True

    # Bharat (BH) series
    p3, v3, t3 = normalize_and_validate_plate("22-BH-1234-AA")
    assert p3 == "22BH1234AA"
    assert v3 is True

    # OCR confusion in last 4 digits (letter O instead of zero)
    repaired = repair_ocr_confusions("DL08CAF892O")
    assert repaired == "DL08CAF8920"

    # OCR confusion in district digits (letter O instead of zero)
    repaired2 = repair_ocr_confusions("DLO8CAF8921")
    assert repaired2 == "DL08CAF8921"

    # Privacy masking
    masked = mask_plate_for_privacy("KA01AB1234")
    assert "KA 01" in masked
    assert "1234" in masked
    assert "*" in masked

    # Salted hash
    h1 = hash_plate_privacy("KA01AB1234")
    assert len(h1) == 64


def test_02_anpr_camera_scan_auto_authorizes_valid_booking(db: Session):
    """Test 2: ANPR camera scan with high confidence matches active booking and opens barrier."""
    facility = db.query(ParkingLot).first()
    assert facility is not None

    now = datetime.now(timezone.utc)
    slot = db.query(ParkingSlot).filter(ParkingSlot.lot_id == facility.id).first()

    # Create test booking
    booking = Booking(
        booking_reference=f"PW-ANPR-{uuid.uuid4().hex[:6].upper()}",
        user_id=1,
        lot_id=facility.id,
        slot_id=slot.id if slot else 1,
        vehicle_number="KA-05-MH-9999",
        vehicle_category="SEDAN",
        driver_name="Aditya Verma",
        driver_phone="+919876543210",
        start_time=now - timedelta(minutes=10),
        end_time=now + timedelta(hours=2),
        duration_hours=2.0,
        base_amount_inr=120.0,
        surge_multiplier=1.0,
        additional_charges_inr=0.0,
        gst_amount_inr=21.6,
        total_amount_inr=141.6,
        status=BookingStatus.CONFIRMED,
        qr_signature="sig_dummy_test_02",
        checked_in_at=None,
    )
    db.add(booking)
    db.commit()

    req = ANPRScanRequest(
        facility_id=facility.id,
        camera_code="CAM-GATE-ENT-01",
        lane_code="LANE-ENT-01",
        captured_plate_raw="KA 05 MH 9999",
        confidence_score=0.96,
        direction=LaneDirection.ENTRY,
    )
    resp = process_anpr_scan(db, req)

    assert resp.decision == AccessDecision.AUTHORIZED
    assert resp.barrier_action == "OPENED"
    assert resp.matched_booking_reference == booking.booking_reference
    assert resp.driver_name == "Aditya Verma"
    assert resp.requires_human_review is False

    # Check booking status transitioned to ACTIVE
    db.refresh(booking)
    assert booking.status == BookingStatus.ACTIVE
    assert booking.checked_in_at is not None


def test_03_anti_passback_prevents_duplicate_entry(db: Session):
    """Test 3: Anti-passback prevents vehicle already inside from entering again."""
    facility = db.query(ParkingLot).first()

    # Re-scan same vehicle that is already marked checked_in and ACTIVE
    req = ANPRScanRequest(
        facility_id=facility.id,
        camera_code="CAM-GATE-ENT-01",
        lane_code="LANE-ENT-01",
        captured_plate_raw="KA 05 MH 9999",
        confidence_score=0.95,
        direction=LaneDirection.ENTRY,
    )
    resp = process_anpr_scan(db, req)

    assert resp.decision == AccessDecision.REJECTED_ALREADY_ENTERED
    assert resp.barrier_action == "KEPT_CLOSED"
    assert "Anti-passback" in resp.decision_reason


def test_04_low_confidence_anpr_scan_triggers_manual_review(db: Session):
    """Test 4: Low-confidence OCR scan (<0.80) does not open barrier; creates review task."""
    facility = db.query(ParkingLot).first()

    req = ANPRScanRequest(
        facility_id=facility.id,
        camera_code="CAM-GATE-ENT-01",
        lane_code="LANE-ENT-01",
        captured_plate_raw="MH-12-??-7777",
        confidence_score=0.62,  # Low confidence!
        direction=LaneDirection.ENTRY,
    )
    resp = process_anpr_scan(db, req)

    assert resp.decision == AccessDecision.MANUAL_REVIEW
    assert resp.barrier_action == "KEPT_CLOSED"
    assert resp.requires_human_review is True
    assert resp.review_task_id is not None

    # Verify task exists in database
    task = db.query(ANPRManualReviewTask).filter(ANPRManualReviewTask.id == resp.review_task_id).first()
    assert task is not None
    assert task.status == GateReviewStatus.PENDING
    assert task.confidence_score == 0.62


def test_05_gate_staff_resolves_manual_review_and_opens_barrier(db: Session):
    """Test 5: Gate supervisor inspects ambiguous scan, corrects plate, and approves entry."""
    facility = db.query(ParkingLot).first()
    now = datetime.now(timezone.utc)
    slot = db.query(ParkingSlot).filter(ParkingSlot.lot_id == facility.id).first()

    # Pre-create valid booking for MH-12-DE-7777
    booking = Booking(
        booking_reference=f"PW-REVIEW-{uuid.uuid4().hex[:6].upper()}",
        user_id=1,
        lot_id=facility.id,
        slot_id=slot.id if slot else 1,
        vehicle_number="MH-12-DE-7777",
        vehicle_category="SEDAN",
        driver_name="Vikram Joshi",
        driver_phone="+919876543211",
        start_time=now - timedelta(minutes=5),
        end_time=now + timedelta(hours=3),
        duration_hours=3.0,
        base_amount_inr=150.0,
        surge_multiplier=1.0,
        additional_charges_inr=0.0,
        gst_amount_inr=27.0,
        total_amount_inr=177.0,
        status=BookingStatus.CONFIRMED,
        qr_signature="sig_dummy_test_05",
        checked_in_at=None,
    )
    db.add(booking)
    db.commit()

    # Trigger ambiguous scan
    req = ANPRScanRequest(
        facility_id=facility.id,
        camera_code="CAM-GATE-ENT-01",
        lane_code="LANE-ENT-01",
        captured_plate_raw="MH-12-D0-7777",  # Ambiguous OCR
        confidence_score=0.65,
        direction=LaneDirection.ENTRY,
    )
    scan_resp = process_anpr_scan(db, req)
    review_id = scan_resp.review_task_id
    assert review_id is not None

    # Supervisor resolves review with corrected plate
    resolve_req = ANPRReviewResolveRequest(
        decision=GateReviewStatus.CORRECTED_AND_APPROVED,
        corrected_plate="MH-12-DE-7777",
        notes="Staff verified plate visually from high-res CCTV stream",
    )
    resolve_resp = resolve_manual_review(db, review_id, resolve_req, operator_user_id=1)

    assert resolve_resp.status == GateReviewStatus.CORRECTED_AND_APPROVED
    assert resolve_resp.barrier_action == "OPENED"
    assert resolve_resp.access_decision == AccessDecision.AUTHORIZED
    assert resolve_resp.matched_booking_reference == booking.booking_reference


def test_06_qr_code_fallback_entry(db: Session):
    """Test 6: QR code fallback opens gate when camera is obscured."""
    facility = db.query(ParkingLot).first()
    now = datetime.now(timezone.utc)
    slot = db.query(ParkingSlot).filter(ParkingSlot.lot_id == facility.id).first()

    booking = Booking(
        booking_reference=f"PW-QR-{uuid.uuid4().hex[:6].upper()}",
        user_id=1,
        lot_id=facility.id,
        slot_id=slot.id if slot else 1,
        vehicle_number="KA-03-NC-4321",
        vehicle_category="HATCHBACK",
        driver_name="Pooja Rao",
        driver_phone="+919876543212",
        start_time=now - timedelta(minutes=15),
        end_time=now + timedelta(hours=2),
        duration_hours=2.0,
        base_amount_inr=100.0,
        surge_multiplier=1.0,
        additional_charges_inr=0.0,
        gst_amount_inr=18.0,
        total_amount_inr=118.0,
        status=BookingStatus.CONFIRMED,
        qr_signature="sig_dummy_test_06",
        checked_in_at=None,
    )
    db.add(booking)
    db.commit()

    req = GateQRVerifyRequest(
        facility_id=facility.id,
        lane_code="LANE-ENT-01",
        qr_payload=booking.booking_reference,
        direction=LaneDirection.ENTRY,
    )
    resp = process_qr_fallback(db, req)

    assert resp.decision == AccessDecision.QR_FALLBACK_AUTHORIZED
    assert resp.barrier_action == "OPENED"
    assert resp.verification_method == VerificationMethod.QR_CODE
    assert resp.matched_booking_reference == booking.booking_reference

    # Verify check-in recorded
    db.refresh(booking)
    assert booking.status == BookingStatus.ACTIVE
    assert booking.checked_in_at is not None


def test_07_gate_lane_controller_barrier_commands_and_manual_override(db: Session):
    """Test 7: Direct relay command and auditable supervisor manual barrier override."""
    lane = db.query(GateLaneController).first()
    assert lane is not None

    # Actuate relay
    ctrl_resp = command_gate_barrier(db, lane.id, BarrierState.HOLD_OPEN, reason="Fire drill inspection")
    assert ctrl_resp.new_state == BarrierState.HOLD_OPEN

    # Manual Supervisor Override
    override_req = GateManualOverrideRequest(
        facility_id=lane.facility_id,
        lane_code=lane.lane_code,
        action="OVERRIDE_ENTRY",
        vehicle_number="KA-01-VIP-0001",
        booking_reference=None,
        reason="Official state convoy / ambulance emergency transit",
    )
    ovr_resp = execute_manual_gate_override(db, override_req, staff_user_id=1, staff_email="supervisor@parkwise.internal")

    assert ovr_resp.barrier_action == "MANUAL_TRIGGERED"
    assert "convoy" in ovr_resp.reason

    # Verify compliance audit entry
    audit = db.query(GateAuditLog).filter(GateAuditLog.action_type == "MANUAL_OVERRIDE").first()
    assert audit is not None
    assert audit.vehicle_number_masked is not None


def test_08_offline_manifest_generation_with_cryptographic_hmac(db: Session):
    """Test 8: Generate signed offline manifest containing HMAC-SHA256 tokens."""
    facility = db.query(ParkingLot).first()

    manifest = generate_facility_offline_manifest(db, facility.id, window_hours=24)
    assert manifest.facility_id == facility.id
    assert manifest.total_tokens >= 1
    assert len(manifest.tokens) >= 1

    first_token = manifest.tokens[0]
    assert len(first_token.hmac_signature) == 64  # SHA-256 hex length

    # Verify signature
    is_valid, reason = verify_booking_offline_token(first_token)
    assert is_valid is True
    assert reason == "VALID_OFFLINE_AUTHORIZATION"


def test_09_local_offline_verification_at_edge_gate(db: Session):
    """Test 9: Simulate edge gate kiosk performing local HMAC verification without internet."""
    facility = db.query(ParkingLot).first()
    manifest = generate_facility_offline_manifest(db, facility.id, window_hours=24)
    token = manifest.tokens[0]

    # Valid local verification
    req_valid = LocalOfflineVerifyRequest(
        facility_id=facility.id,
        vehicle_number=token.vehicle_number_normalized,
        offline_token=token,
        direction=LaneDirection.ENTRY,
    )
    resp_valid = verify_local_offline_access(req_valid)
    assert resp_valid.is_valid is True
    assert resp_valid.decision == AccessDecision.OFFLINE_AUTHORIZED
    assert resp_valid.barrier_action == "OPENED"

    # Plate mismatch
    req_mismatch = LocalOfflineVerifyRequest(
        facility_id=facility.id,
        vehicle_number="DL99ZZ9999",  # Wrong vehicle
        offline_token=token,
        direction=LaneDirection.ENTRY,
    )
    resp_mismatch = verify_local_offline_access(req_mismatch)
    assert resp_mismatch.is_valid is False
    assert resp_mismatch.barrier_action == "KEPT_CLOSED"


def test_10_offline_batch_sync_reconciliation_and_deduplication(db: Session):
    """Test 10: Batch synchronize offline gate events and perform idempotent deduplication."""
    facility = db.query(ParkingLot).first()
    now = datetime.now(timezone.utc)
    slot = db.query(ParkingSlot).filter(ParkingSlot.lot_id == facility.id).first()

    booking = Booking(
        booking_reference=f"PW-SYNC-{uuid.uuid4().hex[:6].upper()}",
        user_id=1,
        lot_id=facility.id,
        slot_id=slot.id if slot else 1,
        vehicle_number="KA-04-AB-5555",
        vehicle_category="SUV",
        driver_name="Rohan Mehra",
        driver_phone="+919876543213",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=3),
        duration_hours=4.0,
        base_amount_inr=200.0,
        surge_multiplier=1.0,
        additional_charges_inr=0.0,
        gst_amount_inr=36.0,
        total_amount_inr=236.0,
        status=BookingStatus.CONFIRMED,
        qr_signature="sig_dummy_test_10",
        checked_in_at=None,
    )
    db.add(booking)
    db.commit()

    sig = sign_booking_offline_token(
        booking_ref=booking.booking_reference,
        normalized_plate="KA04AB5555",
        valid_from=booking.start_time,
        valid_to=booking.end_time,
        facility_id=facility.id,
        slot_number=slot.slot_number if slot else "UNASSIGNED",
    )

    ev_uuid = f"offline_ev_{uuid.uuid4().hex}"
    sync_event = OfflineEventSyncItem(
        client_event_uuid=ev_uuid,
        facility_id=facility.id,
        lane_code="LANE-ENT-01",
        direction=LaneDirection.ENTRY,
        vehicle_number="KA04AB5555",
        booking_reference=booking.booking_reference,
        verification_method=VerificationMethod.OFFLINE_LOCAL_CRYPTO,
        offline_client_timestamp=now - timedelta(minutes=25),
        hmac_signature=sig,
        barrier_action="OPENED",
    )

    sync_req = OfflineBatchSyncRequest(
        facility_id=facility.id,
        events=[sync_event],
    )
    sync_resp = reconcile_offline_events_batch(db, facility.id, sync_req.events)

    assert sync_resp.successfully_synced == 1
    assert sync_resp.duplicates_skipped == 0

    # Booking state should now be reconciled to ACTIVE
    db.refresh(booking)
    assert booking.status == BookingStatus.ACTIVE
    assert booking.checked_in_at is not None

    # Resend same batch to test idempotent deduplication
    sync_resp_dup = reconcile_offline_events_batch(db, facility.id, sync_req.events)
    assert sync_resp_dup.successfully_synced == 0
    assert sync_resp_dup.duplicates_skipped == 1


def test_11_privacy_masking_and_retention_pruning(db: Session):
    """Test 11: Gate event history masks vehicle plates; retention pruning functions cleanly."""
    facility = db.query(ParkingLot).first()

    # List events
    history = get_gate_event_history(db, facility.id, limit=20)
    assert history.total > 0
    for e in history.events:
        # Every plate shown to gate staff is masked for privacy
        assert "*" in e.masked_plate or len(e.masked_plate) <= 4

    # Analytics summary
    stats = get_gate_analytics_summary(db, facility.id)
    assert stats.total_scans_today > 0
    assert stats.average_anpr_confidence > 0.0

    # Prune retention data older than 365 days (safe test)
    prune_res = prune_anpr_records_retention(db, facility.id, retention_days=365)
    assert prune_res.facility_id == facility.id
    assert prune_res.records_pruned_count >= 0
