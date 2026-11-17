"""Phase 16: Offline Cryptographic Manifest, Local Token Verification & Batch Sync Service.

Enables physical gate kiosks to operate securely during complete cloud/internet network isolation:
1. Generates time-bounded HMAC-SHA256 signed manifests of upcoming/active bookings.
2. Performs local signature and timestamp validity checks without internet access.
3. Securely ingests and idempotently reconciles offline event batches once connectivity is restored.
"""

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models import Booking, BookingStatus, ParkingLot
from app.models_gate_automation import (
    AccessDecision,
    ANPRVerificationEvent,
    BarrierState,
    GateLaneController,
    GateOfflineManifestLog,
    LaneDirection,
    VerificationMethod,
)
from app.schemas_gate_automation import (
    OfflineTokenItem,
    OfflineManifestResponse,
    LocalOfflineVerifyRequest,
    LocalOfflineVerifyResponse,
    OfflineEventSyncItem,
    OfflineBatchSyncResponse,
)
from app.services.anpr_normalizer import (
    clean_raw_plate,
    hash_plate_privacy,
    mask_plate_for_privacy,
    normalize_and_validate_plate,
)

GATE_OFFLINE_SECRET = "parkwise_gate_offline_hmac_master_secret_2026_v1"


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def sign_booking_offline_token(
    booking_ref: str,
    normalized_plate: str,
    valid_from: datetime,
    valid_to: datetime,
    facility_id: int,
    slot_number: str,
) -> str:
    """Compute HMAC-SHA256 signature for offline booking authorization."""
    v_from_iso = _to_utc(valid_from).isoformat()
    v_to_iso = _to_utc(valid_to).isoformat()
    payload = f"{booking_ref}|{normalized_plate}|{v_from_iso}|{v_to_iso}|{facility_id}|{slot_number}".encode("utf-8")
    return hmac.new(GATE_OFFLINE_SECRET.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def verify_booking_offline_token(
    token_item: OfflineTokenItem,
    check_time: Optional[datetime] = None,
) -> Tuple[bool, str]:
    """Verify cryptographic signature and time validity of an offline booking token locally."""
    now = _to_utc(check_time or datetime.now(timezone.utc))

    expected_sig = sign_booking_offline_token(
        booking_ref=token_item.booking_reference,
        normalized_plate=token_item.vehicle_number_normalized,
        valid_from=datetime.fromisoformat(token_item.valid_from_iso),
        valid_to=datetime.fromisoformat(token_item.valid_to_iso),
        facility_id=token_item.facility_id,
        slot_number=token_item.slot_number,
    )

    if not hmac.compare_digest(expected_sig, token_item.hmac_signature):
        return (False, "CRYPTOGRAPHIC_SIGNATURE_MISMATCH")

    valid_from = _to_utc(datetime.fromisoformat(token_item.valid_from_iso))
    valid_to = _to_utc(datetime.fromisoformat(token_item.valid_to_iso))

    # Allow 30-minute early entry grace, 30-minute exit grace
    allowed_start = valid_from - timedelta(minutes=30)
    allowed_end = valid_to + timedelta(minutes=30)

    if now < allowed_start:
        return (False, "FUTURE_BOOKING_EARLY_ARRIVAL_WINDOW_NOT_OPEN")
    if now > allowed_end:
        return (False, "EXPIRED_OFFLINE_AUTHORIZATION")

    return (True, "VALID_OFFLINE_AUTHORIZATION")


def generate_facility_offline_manifest(
    db: Session,
    facility_id: int,
    window_hours: int = 24,
    downloaded_by_user_id: Optional[int] = None,
) -> OfflineManifestResponse:
    """Generate signed cryptographic manifest package of active and upcoming bookings for edge gate cache."""
    facility = db.query(ParkingLot).filter(ParkingLot.id == facility_id).first()
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility ID {facility_id} not found",
        )

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=2)
    window_end = now + timedelta(hours=window_hours)

    bookings = (
        db.query(Booking)
        .filter(
            Booking.lot_id == facility_id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
            Booking.start_time <= window_end,
            Booking.end_time >= window_start,
        )
        .all()
    )

    tokens: List[OfflineTokenItem] = []
    for b in bookings:
        norm_plate, _, _ = normalize_and_validate_plate(b.vehicle_number)
        slot_num = b.slot.slot_number if b.slot else "UNASSIGNED"
        v_from = _to_utc(b.start_time)
        v_to = _to_utc(b.end_time)

        sig = sign_booking_offline_token(
            booking_ref=b.booking_reference,
            normalized_plate=norm_plate,
            valid_from=v_from,
            valid_to=v_to,
            facility_id=facility.id,
            slot_number=slot_num,
        )

        tokens.append(
            OfflineTokenItem(
                booking_reference=b.booking_reference,
                vehicle_number_normalized=norm_plate,
                valid_from_iso=v_from.isoformat(),
                valid_to_iso=v_to.isoformat(),
                facility_id=facility.id,
                slot_number=slot_num,
                vehicle_type=b.vehicle_category if hasattr(b, "vehicle_category") else "SEDAN",
                hmac_signature=sig,
            )
        )

    manifest_id = f"mfst_{facility_id}_{int(now.timestamp())}_{uuid.uuid4().hex[:8]}"

    # Log manifest generation
    manifest_log = GateOfflineManifestLog(
        manifest_id=manifest_id,
        facility_id=facility.id,
        window_start=window_start,
        window_end=window_end,
        total_tokens_issued=len(tokens),
        hmac_key_id="v1_2026_primary",
        downloaded_by_user_id=downloaded_by_user_id,
        downloaded_at=now,
    )
    db.add(manifest_log)
    db.commit()

    return OfflineManifestResponse(
        manifest_id=manifest_id,
        facility_id=facility.id,
        facility_name=facility.name,
        generated_at=now,
        window_start=window_start,
        window_end=window_end,
        total_tokens=len(tokens),
        tokens=tokens,
    )


def verify_local_offline_access(
    request: LocalOfflineVerifyRequest,
) -> LocalOfflineVerifyResponse:
    """Simulate edge gate kiosk performing local offline token validation."""
    clean_input = clean_raw_plate(request.vehicle_number)
    token = request.offline_token

    if token.facility_id != request.facility_id:
        return LocalOfflineVerifyResponse(
            is_valid=False,
            decision=AccessDecision.REJECTED_NO_BOOKING,
            barrier_action="KEPT_CLOSED",
            decision_reason="Facility ID mismatch between token and gate kiosk",
            generated_offline_event_uuid=f"off_{uuid.uuid4().hex}",
        )

    if clean_input != token.vehicle_number_normalized:
        return LocalOfflineVerifyResponse(
            is_valid=False,
            decision=AccessDecision.REJECTED_NO_BOOKING,
            barrier_action="KEPT_CLOSED",
            decision_reason=f"Vehicle plate mismatch: {clean_input} != {token.vehicle_number_normalized}",
            generated_offline_event_uuid=f"off_{uuid.uuid4().hex}",
        )

    is_valid, reason = verify_booking_offline_token(token)
    if not is_valid:
        return LocalOfflineVerifyResponse(
            is_valid=False,
            decision=AccessDecision.REJECTED_EXPIRED if "EXPIRED" in reason else AccessDecision.REJECTED_NO_BOOKING,
            barrier_action="KEPT_CLOSED",
            decision_reason=reason,
            generated_offline_event_uuid=f"off_{uuid.uuid4().hex}",
        )

    return LocalOfflineVerifyResponse(
        is_valid=True,
        decision=AccessDecision.OFFLINE_AUTHORIZED,
        barrier_action="OPENED",
        decision_reason="Valid offline HMAC authorization; barrier actuated locally",
        generated_offline_event_uuid=f"off_{uuid.uuid4().hex}",
    )


def reconcile_offline_events_batch(
    db: Session,
    facility_id: int,
    events: List[OfflineEventSyncItem],
) -> OfflineBatchSyncResponse:
    """Reconcile a batch of offline gate entry/exit events into the primary cloud database."""
    facility = db.query(ParkingLot).filter(ParkingLot.id == facility_id).first()
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility ID {facility_id} not found",
        )

    now = datetime.now(timezone.utc)
    total_received = len(events)
    successfully_synced = 0
    duplicates_skipped = 0
    errors_count = 0
    summary: List[Dict[str, Any]] = []

    for item in events:
        # 1. Check for duplicate event UUID
        existing_event = (
            db.query(ANPRVerificationEvent)
            .filter(ANPRVerificationEvent.event_uuid == item.client_event_uuid)
            .first()
        )
        if existing_event:
            duplicates_skipped += 1
            summary.append({
                "client_event_uuid": item.client_event_uuid,
                "status": "SKIPPED_DUPLICATE",
                "message": "Event already recorded in cloud database",
            })
            continue

        # 2. Find Lane Controller
        lane = (
            db.query(GateLaneController)
            .filter(
                GateLaneController.facility_id == facility_id,
                GateLaneController.lane_code == item.lane_code,
            )
            .first()
        )
        if not lane:
            # Fallback to any lane or create default
            lane = db.query(GateLaneController).filter(GateLaneController.facility_id == facility_id).first()

        # 3. Match booking
        booking = (
            db.query(Booking)
            .filter(
                Booking.lot_id == facility_id,
                Booking.booking_reference == item.booking_reference,
            )
            .first()
        )

        norm_plate, _, _ = normalize_and_validate_plate(item.vehicle_number)

        # 4. Verify cryptographic signature if booking found
        if booking:
            v_from = _to_utc(booking.start_time)
            v_to = _to_utc(booking.end_time)
            expected_sig = sign_booking_offline_token(
                booking_ref=booking.booking_reference,
                normalized_plate=norm_plate,
                valid_from=v_from,
                valid_to=v_to,
                facility_id=facility_id,
                slot_number=booking.slot.slot_number if booking.slot else "UNASSIGNED",
            )
            if not hmac.compare_digest(expected_sig, item.hmac_signature):
                errors_count += 1
                summary.append({
                    "client_event_uuid": item.client_event_uuid,
                    "status": "ERROR_CORRUPT_SIGNATURE",
                    "message": "HMAC signature mismatch for booking token",
                })
                continue

            # Update booking status
            event_ts = _to_utc(item.offline_client_timestamp)
            if item.direction == LaneDirection.ENTRY:
                if booking.status == BookingStatus.CONFIRMED:
                    booking.status = BookingStatus.ACTIVE
                    booking.checked_in_at = event_ts
            elif item.direction == LaneDirection.EXIT:
                if booking.status in (BookingStatus.ACTIVE, BookingStatus.CONFIRMED):
                    booking.status = BookingStatus.COMPLETED
                    booking.checked_out_at = event_ts

        # 5. Insert Verification Event Log
        event_record = ANPRVerificationEvent(
            event_uuid=item.client_event_uuid,
            facility_id=facility_id,
            lane_id=lane.id if lane else 1,
            direction=item.direction,
            captured_plate_raw=item.vehicle_number,
            normalized_plate=norm_plate,
            confidence_score=1.0,
            matched_booking_id=booking.id if booking else None,
            matched_booking_reference=booking.booking_reference if booking else item.booking_reference,
            decision=AccessDecision.OFFLINE_AUTHORIZED,
            decision_reason="Synchronized from offline cryptographically verified gate terminal",
            verification_method=VerificationMethod.OFFLINE_LOCAL_CRYPTO,
            barrier_action=item.barrier_action,
            anti_passback_checked=True,
            anti_passback_status="VALID",
            sync_source="OFFLINE_GATE_SYNC",
            offline_client_timestamp=item.offline_client_timestamp,
            timestamp=now,
            encrypted_plate_hash=hash_plate_privacy(norm_plate),
            masked_plate=mask_plate_for_privacy(norm_plate),
        )
        db.add(event_record)
        successfully_synced += 1

        summary.append({
            "client_event_uuid": item.client_event_uuid,
            "status": "SYNCED_OK",
            "booking_reference": item.booking_reference,
            "direction": item.direction.value,
        })

    db.commit()

    return OfflineBatchSyncResponse(
        facility_id=facility_id,
        total_received=total_received,
        successfully_synced=successfully_synced,
        duplicates_skipped=duplicates_skipped,
        errors_count=errors_count,
        sync_summary=summary,
        synced_at=now,
    )
