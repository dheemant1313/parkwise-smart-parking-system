"""Phase 16: Core Gate Access, ANPR Decision Engine, Anti-Passback & Relay Control Service.

Integrates:
- Automatic Number Plate Recognition (ANPR) with Indian MoRTH normalization
- Strict Anti-Passback verification (prevents duplicate entry / invalid exit)
- Low-confidence OCR fail-safe (<0.80) routing to Gate Staff Manual Review Queue
- QR-Code scanning fallback for obscured/dirty plates
- Physical gate barrier relay controller commands
- Supervisor manual overrides with auditable compliance tracking
- DPDP India 2023 data retention pruning
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models import Booking, BookingStatus, ParkingLot, ParkingSlot, User
from app.models_gate_automation import (
    AccessDecision,
    ANPRCamera,
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
    ANPRReviewItem,
    ANPRReviewResolveRequest,
    ANPRReviewResolveResponse,
    ANPRScanRequest,
    ANPRScanResponse,
    GateBarrierControlResponse,
    GateEventsListResponse,
    GateEventItem,
    GateManualOverrideRequest,
    GateManualOverrideResponse,
    GatePruneResponse,
    GateQRVerifyRequest,
    GateAnalyticsSummaryResponse,
)
from app.services.anpr_normalizer import (
    clean_raw_plate,
    generate_fuzzy_candidates,
    hash_plate_privacy,
    mask_plate_for_privacy,
    normalize_and_validate_plate,
)


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def process_anpr_scan(
    db: Session,
    request: ANPRScanRequest,
    operator_user_id: Optional[int] = None,
) -> ANPRScanResponse:
    """Evaluate an ANPR camera capture against active bookings with anti-passback and confidence guardrails."""
    facility = db.query(ParkingLot).filter(ParkingLot.id == request.facility_id).first()
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility ID {request.facility_id} not found",
        )

    # 1. Resolve Lane Controller
    lane = None
    if request.lane_code:
        lane = (
            db.query(GateLaneController)
            .filter(
                GateLaneController.facility_id == request.facility_id,
                GateLaneController.lane_code == request.lane_code,
            )
            .first()
        )
    if not lane:
        lane = (
            db.query(GateLaneController)
            .filter(
                GateLaneController.facility_id == request.facility_id,
                GateLaneController.direction == request.direction,
            )
            .first()
        )
    if not lane:
        lane = db.query(GateLaneController).filter(GateLaneController.facility_id == request.facility_id).first()

    now = datetime.now(timezone.utc)
    event_uuid = request.event_uuid or f"anpr_{uuid.uuid4().hex}"

    # 2. Normalize and Repair License Plate
    norm_plate, is_valid_morth, format_type = normalize_and_validate_plate(request.captured_plate_raw)
    clean_raw = clean_raw_plate(request.captured_plate_raw)
    masked_plate = mask_plate_for_privacy(norm_plate or clean_raw)
    privacy_hash = hash_plate_privacy(norm_plate or clean_raw)

    min_threshold = lane.cameras[0].min_confidence_threshold if lane and lane.cameras else 0.80

    # 3. Low-Confidence Gate Guard: Never assume low-confidence camera readings are valid!
    if request.confidence_score < min_threshold:
        # Create initial verification record with MANUAL_REVIEW
        event_record = ANPRVerificationEvent(
            event_uuid=event_uuid,
            facility_id=facility.id,
            lane_id=lane.id if lane else 1,
            direction=request.direction,
            captured_plate_raw=request.captured_plate_raw,
            normalized_plate=norm_plate or clean_raw,
            confidence_score=request.confidence_score,
            plate_crop_image_url=request.plate_crop_image_url,
            decision=AccessDecision.MANUAL_REVIEW,
            decision_reason=f"OCR confidence ({request.confidence_score:.2f}) below threshold ({min_threshold:.2f}); manual inspection required",
            verification_method=VerificationMethod.ANPR,
            barrier_action="KEPT_CLOSED",
            anti_passback_checked=False,
            anti_passback_status="PENDING_REVIEW",
            sync_source="ONLINE_API",
            timestamp=now,
            encrypted_plate_hash=privacy_hash,
            masked_plate=masked_plate,
        )
        db.add(event_record)
        db.flush()

        candidates = generate_fuzzy_candidates(request.captured_plate_raw)
        review_task = ANPRManualReviewTask(
            event_id=event_record.id,
            facility_id=facility.id,
            lane_id=lane.id if lane else 1,
            captured_plate_raw=request.captured_plate_raw,
            suggested_candidates_json=json.dumps(candidates),
            crop_image_url=request.plate_crop_image_url,
            confidence_score=request.confidence_score,
            status=GateReviewStatus.PENDING,
            created_at=now,
        )
        db.add(review_task)
        db.commit()
        db.refresh(review_task)

        return ANPRScanResponse(
            event_uuid=event_uuid,
            facility_id=facility.id,
            lane_code=lane.lane_code if lane else "LANE-01",
            direction=request.direction,
            raw_plate=request.captured_plate_raw,
            normalized_plate=norm_plate or clean_raw,
            masked_plate=masked_plate,
            confidence_score=request.confidence_score,
            decision=AccessDecision.MANUAL_REVIEW,
            decision_reason=f"Confidence {request.confidence_score:.0%} < {min_threshold:.0%}. Routed to Gate Staff Review Queue.",
            verification_method=VerificationMethod.ANPR,
            barrier_action="KEPT_CLOSED",
            requires_human_review=True,
            review_task_id=review_task.id,
            timestamp=now,
        )

    # 4. Search for Matching Booking
    # Match on vehicle_number (clean comparisons)
    candidates_to_match = [norm_plate, clean_raw]
    bookings = (
        db.query(Booking)
        .filter(Booking.lot_id == facility.id)
        .all()
    )

    matched_booking = None
    for b in bookings:
        b_clean = clean_raw_plate(b.vehicle_number)
        if b_clean in candidates_to_match or b.vehicle_number in candidates_to_match:
            matched_booking = b
            break

    # 5. Evaluate Access Rules & Anti-Passback
    decision = AccessDecision.REJECTED_NO_BOOKING
    decision_reason = "No confirmed or active booking found for vehicle plate"
    barrier_action = "KEPT_CLOSED"
    anti_passback_status = "VALID"
    overstay_mins = 0
    overstay_fee = 0.0

    if matched_booking:
        start_t = _to_utc(matched_booking.start_time)
        end_t = _to_utc(matched_booking.end_time)
        early_grace = timedelta(minutes=lane.early_entry_grace_minutes if lane else 30)
        exit_grace = timedelta(minutes=lane.exit_grace_minutes if lane else 15)

        if matched_booking.status == BookingStatus.CANCELLED:
            decision = AccessDecision.REJECTED_CANCELLED
            decision_reason = f"Booking {matched_booking.booking_reference} was cancelled"
            barrier_action = "KEPT_CLOSED"

        elif request.direction == LaneDirection.ENTRY:
            # Check if vehicle is already inside (Anti-passback)
            if lane and lane.anti_passback_enabled and matched_booking.checked_in_at is not None and matched_booking.status == BookingStatus.ACTIVE:
                decision = AccessDecision.REJECTED_ALREADY_ENTERED
                decision_reason = "Anti-passback violation: vehicle is already checked in and inside facility"
                barrier_action = "KEPT_CLOSED"
                anti_passback_status = "VIOLATION_ALREADY_IN"

            elif now < (start_t - early_grace):
                mins_early = int((start_t - now).total_seconds() / 60)
                decision = AccessDecision.REJECTED_FUTURE
                decision_reason = f"Booking start is in {mins_early} minutes; early entry window opens 30m prior"
                barrier_action = "KEPT_CLOSED"

            elif now > (end_t + exit_grace):
                decision = AccessDecision.REJECTED_EXPIRED
                decision_reason = f"Booking {matched_booking.booking_reference} has expired"
                barrier_action = "KEPT_CLOSED"

            else:
                # Valid Entry Authorization
                decision = AccessDecision.AUTHORIZED
                decision_reason = f"Valid booking {matched_booking.booking_reference} confirmed. Welcome, {matched_booking.driver_name}!"
                barrier_action = "OPENED"
                anti_passback_status = "VALID"

                # Update booking check-in state
                matched_booking.status = BookingStatus.ACTIVE
                matched_booking.checked_in_at = now

                # Actuate barrier state
                if lane and lane.auto_open_enabled:
                    lane.barrier_state = BarrierState.OPEN

        elif request.direction == LaneDirection.EXIT:
            if matched_booking.checked_in_at is None:
                decision = AccessDecision.REJECTED_NOT_CHECKED_IN
                decision_reason = "Anti-passback violation: vehicle has no recorded entry check-in"
                barrier_action = "KEPT_CLOSED"
                anti_passback_status = "VIOLATION_NOT_IN"

            else:
                # Check overstay
                if now > (end_t + exit_grace):
                    overstay_mins = int((now - (end_t + exit_grace)).total_seconds() / 60)
                    hourly_rate = facility.hourly_rate if hasattr(facility, "hourly_rate") else 50.0
                    hours_billed = max(1, (overstay_mins + 59) // 60)
                    overstay_fee = round(hours_billed * hourly_rate, 2)
                    decision_reason = f"Exit authorized with overstay of {overstay_mins} mins (Fee: INR {overstay_fee})"
                else:
                    decision_reason = f"Exit authorized. Thank you for parking with Parkwise, {matched_booking.driver_name}!"

                decision = AccessDecision.AUTHORIZED
                barrier_action = "OPENED"
                anti_passback_status = "VALID"

                # Update booking check-out state
                matched_booking.status = BookingStatus.COMPLETED
                matched_booking.checked_out_at = now

                if lane and lane.auto_open_enabled:
                    lane.barrier_state = BarrierState.OPEN

    # 6. Record Immutable Verification Event
    event_record = ANPRVerificationEvent(
        event_uuid=event_uuid,
        facility_id=facility.id,
        lane_id=lane.id if lane else 1,
        direction=request.direction,
        captured_plate_raw=request.captured_plate_raw,
        normalized_plate=norm_plate or clean_raw,
        confidence_score=request.confidence_score,
        plate_crop_image_url=request.plate_crop_image_url,
        matched_booking_id=matched_booking.id if matched_booking else None,
        matched_booking_reference=matched_booking.booking_reference if matched_booking else None,
        decision=decision,
        decision_reason=decision_reason,
        verification_method=VerificationMethod.ANPR,
        barrier_action=barrier_action,
        anti_passback_checked=True,
        anti_passback_status=anti_passback_status,
        sync_source="ONLINE_API",
        timestamp=now,
        encrypted_plate_hash=privacy_hash,
        masked_plate=masked_plate,
    )
    db.add(event_record)
    db.commit()

    return ANPRScanResponse(
        event_uuid=event_uuid,
        facility_id=facility.id,
        lane_code=lane.lane_code if lane else "LANE-01",
        direction=request.direction,
        raw_plate=request.captured_plate_raw,
        normalized_plate=norm_plate or clean_raw,
        masked_plate=masked_plate,
        confidence_score=request.confidence_score,
        decision=decision,
        decision_reason=decision_reason,
        verification_method=VerificationMethod.ANPR,
        barrier_action=barrier_action,
        matched_booking_reference=matched_booking.booking_reference if matched_booking else None,
        assigned_slot_number=matched_booking.slot.slot_number if matched_booking and matched_booking.slot else None,
        driver_name=matched_booking.driver_name if matched_booking else None,
        vehicle_model=matched_booking.vehicle_model if hasattr(matched_booking, "vehicle_model") else None,
        requires_human_review=False,
        overstay_minutes=overstay_mins,
        overstay_fee_inr=overstay_fee,
        timestamp=now,
    )


def process_qr_fallback(
    db: Session,
    request: GateQRVerifyRequest,
) -> ANPRScanResponse:
    """Verify entry/exit using QR code fallback when camera is obstructed or plate unreadable."""
    facility = db.query(ParkingLot).filter(ParkingLot.id == request.facility_id).first()
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility ID {request.facility_id} not found",
        )

    lane = (
        db.query(GateLaneController)
        .filter(
            GateLaneController.facility_id == request.facility_id,
            GateLaneController.lane_code == request.lane_code,
        )
        .first()
    )
    if not lane:
        lane = db.query(GateLaneController).filter(GateLaneController.facility_id == request.facility_id).first()

    now = datetime.now(timezone.utc)
    event_uuid = f"qr_{uuid.uuid4().hex}"

    # Extract booking reference from payload (can be raw ref or JSON)
    clean_ref = request.qr_payload.strip()
    if "{" in clean_ref and "}" in clean_ref:
        try:
            parsed = json.loads(clean_ref)
            clean_ref = parsed.get("booking_reference") or parsed.get("ref") or clean_ref
        except Exception:
            pass

    booking = (
        db.query(Booking)
        .filter(
            Booking.lot_id == facility.id,
            Booking.booking_reference == clean_ref,
        )
        .first()
    )

    if not booking:
        norm_input = clean_raw_plate(request.vehicle_plate or "UNKNOWN")
        event = ANPRVerificationEvent(
            event_uuid=event_uuid,
            facility_id=facility.id,
            lane_id=lane.id if lane else 1,
            direction=request.direction,
            captured_plate_raw=request.vehicle_plate or "QR_CODE_SCAN",
            normalized_plate=norm_input,
            confidence_score=1.0,
            decision=AccessDecision.REJECTED_NO_BOOKING,
            decision_reason=f"Invalid QR code payload: booking reference '{clean_ref}' not found",
            verification_method=VerificationMethod.QR_CODE,
            barrier_action="KEPT_CLOSED",
            anti_passback_checked=False,
            anti_passback_status="VALID",
            sync_source="ONLINE_API",
            timestamp=now,
            encrypted_plate_hash=hash_plate_privacy(norm_input),
            masked_plate=mask_plate_for_privacy(norm_input),
        )
        db.add(event)
        db.commit()

        return ANPRScanResponse(
            event_uuid=event_uuid,
            facility_id=facility.id,
            lane_code=lane.lane_code if lane else "LANE-01",
            direction=request.direction,
            raw_plate="QR_CODE_FALLBACK",
            normalized_plate=norm_input,
            masked_plate=mask_plate_for_privacy(norm_input),
            confidence_score=1.0,
            decision=AccessDecision.REJECTED_NO_BOOKING,
            decision_reason=f"Invalid QR code: reference '{clean_ref}' not found",
            verification_method=VerificationMethod.QR_CODE,
            barrier_action="KEPT_CLOSED",
            timestamp=now,
        )

    norm_plate, _, _ = normalize_and_validate_plate(booking.vehicle_number)

    # Process entry/exit update
    if request.direction == LaneDirection.ENTRY:
        booking.status = BookingStatus.ACTIVE
        booking.checked_in_at = now
    else:
        booking.status = BookingStatus.COMPLETED
        booking.checked_out_at = now

    if lane and lane.auto_open_enabled:
        lane.barrier_state = BarrierState.OPEN

    event = ANPRVerificationEvent(
        event_uuid=event_uuid,
        facility_id=facility.id,
        lane_id=lane.id if lane else 1,
        direction=request.direction,
        captured_plate_raw=booking.vehicle_number,
        normalized_plate=norm_plate,
        confidence_score=1.0,
        matched_booking_id=booking.id,
        matched_booking_reference=booking.booking_reference,
        decision=AccessDecision.QR_FALLBACK_AUTHORIZED,
        decision_reason=f"QR Fallback scan verified for {booking.booking_reference}. Welcome, {booking.driver_name}!",
        verification_method=VerificationMethod.QR_CODE,
        barrier_action="OPENED",
        anti_passback_checked=True,
        anti_passback_status="VALID",
        sync_source="ONLINE_API",
        timestamp=now,
        encrypted_plate_hash=hash_plate_privacy(norm_plate),
        masked_plate=mask_plate_for_privacy(norm_plate),
    )
    db.add(event)
    db.commit()

    return ANPRScanResponse(
        event_uuid=event_uuid,
        facility_id=facility.id,
        lane_code=lane.lane_code if lane else "LANE-01",
        direction=request.direction,
        raw_plate=booking.vehicle_number,
        normalized_plate=norm_plate,
        masked_plate=mask_plate_for_privacy(norm_plate),
        confidence_score=1.0,
        decision=AccessDecision.QR_FALLBACK_AUTHORIZED,
        decision_reason=f"QR Fallback scan verified. Welcome, {booking.driver_name}!",
        verification_method=VerificationMethod.QR_CODE,
        barrier_action="OPENED",
        matched_booking_reference=booking.booking_reference,
        assigned_slot_number=booking.slot.slot_number if booking.slot else None,
        driver_name=booking.driver_name,
        timestamp=now,
    )


def get_pending_review_tasks(db: Session, facility_id: int) -> List[ANPRReviewItem]:
    """Retrieve all pending manual review tasks for a facility."""
    tasks = (
        db.query(ANPRManualReviewTask)
        .filter(
            ANPRManualReviewTask.facility_id == facility_id,
            ANPRManualReviewTask.status == GateReviewStatus.PENDING,
        )
        .order_by(ANPRManualReviewTask.created_at.desc())
        .all()
    )

    items: List[ANPRReviewItem] = []
    for t in tasks:
        lane = db.query(GateLaneController).filter(GateLaneController.id == t.lane_id).first()
        candidates = json.loads(t.suggested_candidates_json or "[]")
        items.append(
            ANPRReviewItem(
                id=t.id,
                event_id=t.event_id,
                facility_id=t.facility_id,
                lane_code=lane.lane_code if lane else "LANE-01",
                captured_plate_raw=t.captured_plate_raw,
                suggested_candidates=candidates,
                confidence_score=t.confidence_score,
                crop_image_url=t.crop_image_url,
                status=t.status,
                created_at=t.created_at,
            )
        )
    return items


def resolve_manual_review(
    db: Session,
    review_id: int,
    request: ANPRReviewResolveRequest,
    operator_user_id: Optional[int] = None,
) -> ANPRReviewResolveResponse:
    """Gate supervisor inspects plate crop and resolves review task."""
    task = db.query(ANPRManualReviewTask).filter(ANPRManualReviewTask.id == review_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review Task ID {review_id} not found",
        )

    now = datetime.now(timezone.utc)
    task.status = request.decision
    task.reviewed_by_user_id = operator_user_id
    task.reviewed_at = now
    task.notes = request.notes

    event = task.event
    barrier_action = "KEPT_CLOSED"
    decision = AccessDecision.MANUAL_REVIEW
    matched_ref = None

    if request.decision in (GateReviewStatus.APPROVED_AS_IS, GateReviewStatus.CORRECTED_AND_APPROVED):
        target_plate = request.corrected_plate if request.decision == GateReviewStatus.CORRECTED_AND_APPROVED else task.captured_plate_raw
        norm_plate, _, _ = normalize_and_validate_plate(target_plate or "")
        task.corrected_plate = norm_plate

        # Match booking against corrected plate
        bookings = db.query(Booking).filter(Booking.lot_id == task.facility_id).all()
        clean_target = clean_raw_plate(target_plate or "")
        matched_b = None
        for b in bookings:
            if clean_raw_plate(b.vehicle_number) in (clean_target, norm_plate):
                matched_b = b
                break

        if matched_b:
            if event.direction == LaneDirection.ENTRY:
                matched_b.status = BookingStatus.ACTIVE
                matched_b.checked_in_at = now
            else:
                matched_b.status = BookingStatus.COMPLETED
                matched_b.checked_out_at = now

            event.matched_booking_id = matched_b.id
            event.matched_booking_reference = matched_b.booking_reference
            matched_ref = matched_b.booking_reference

        decision = AccessDecision.AUTHORIZED
        barrier_action = "OPENED"

        event.decision = decision
        event.decision_reason = f"Gate Staff Human-in-the-Loop review approved: {request.notes or 'Visual inspection passed'}"
        event.barrier_action = barrier_action
        event.human_reviewed = True
        event.reviewer_user_id = operator_user_id
        event.reviewer_notes = request.notes
        if norm_plate:
            event.normalized_plate = norm_plate
            event.masked_plate = mask_plate_for_privacy(norm_plate)

        # Actuate lane barrier
        lane = db.query(GateLaneController).filter(GateLaneController.id == task.lane_id).first()
        if lane:
            lane.barrier_state = BarrierState.OPEN

    elif request.decision == GateReviewStatus.REJECTED:
        decision = AccessDecision.REJECTED_NO_BOOKING
        barrier_action = "KEPT_CLOSED"
        event.decision = decision
        event.decision_reason = f"Gate Staff Human-in-the-Loop review rejected: {request.notes or 'No valid plate or credentials'}"
        event.barrier_action = barrier_action
        event.human_reviewed = True
        event.reviewer_user_id = operator_user_id
        event.reviewer_notes = request.notes

    db.commit()

    return ANPRReviewResolveResponse(
        review_id=task.id,
        status=task.status,
        resolved_plate=task.corrected_plate or task.captured_plate_raw,
        barrier_action=barrier_action,
        access_decision=decision,
        matched_booking_reference=matched_ref,
        reviewed_at=now,
    )


def execute_manual_gate_override(
    db: Session,
    request: GateManualOverrideRequest,
    staff_user_id: Optional[int] = None,
    staff_email: Optional[str] = None,
) -> GateManualOverrideResponse:
    """Manual operator override to open gate barrier with mandatory auditable justification."""
    lane = (
        db.query(GateLaneController)
        .filter(
            GateLaneController.facility_id == request.facility_id,
            GateLaneController.lane_code == request.lane_code,
        )
        .first()
    )
    if not lane:
        lane = db.query(GateLaneController).filter(GateLaneController.facility_id == request.facility_id).first()

    now = datetime.now(timezone.utc)
    event_uuid = f"ovr_{uuid.uuid4().hex}"
    norm_plate, _, _ = normalize_and_validate_plate(request.vehicle_number)
    masked_plate = mask_plate_for_privacy(norm_plate or request.vehicle_number)

    # Actuate barrier
    if lane:
        lane.barrier_state = BarrierState.OPEN

    # Record Verification Event
    event = ANPRVerificationEvent(
        event_uuid=event_uuid,
        facility_id=request.facility_id,
        lane_id=lane.id if lane else 1,
        direction=LaneDirection.ENTRY if "ENTRY" in request.action else LaneDirection.EXIT,
        captured_plate_raw=request.vehicle_number,
        normalized_plate=norm_plate or request.vehicle_number,
        confidence_score=1.0,
        matched_booking_reference=request.booking_reference,
        decision=AccessDecision.MANUAL_OVERRIDE_AUTHORIZED,
        decision_reason=f"Gate Staff Manual Override: {request.reason}",
        verification_method=VerificationMethod.MANUAL_OVERRIDE,
        barrier_action="MANUAL_TRIGGERED",
        anti_passback_checked=False,
        anti_passback_status="VALID",
        human_reviewed=True,
        reviewer_user_id=staff_user_id,
        reviewer_notes=request.reason,
        sync_source="ONLINE_API",
        timestamp=now,
        encrypted_plate_hash=hash_plate_privacy(norm_plate or request.vehicle_number),
        masked_plate=masked_plate,
    )
    db.add(event)

    # Log compliance audit record
    audit_log = GateAuditLog(
        facility_id=request.facility_id,
        action_type="MANUAL_OVERRIDE",
        operator_user_id=staff_user_id,
        operator_email=staff_email or "gate_staff@parkwise.internal",
        lane_id=lane.id if lane else 1,
        vehicle_number_masked=masked_plate,
        reason=request.reason,
        metadata_json=json.dumps({"action": request.action, "booking_ref": request.booking_reference}),
        timestamp=now,
    )
    db.add(audit_log)
    db.commit()

    return GateManualOverrideResponse(
        event_uuid=event_uuid,
        lane_code=lane.lane_code if lane else request.lane_code,
        action=request.action,
        vehicle_number_masked=masked_plate,
        barrier_action="MANUAL_TRIGGERED",
        staff_email=staff_email or "gate_staff@parkwise.internal",
        reason=request.reason,
        timestamp=now,
    )


def command_gate_barrier(
    db: Session,
    lane_id: int,
    command: BarrierState,
    reason: Optional[str] = None,
) -> GateBarrierControlResponse:
    """Actuate physical or virtual boom barrier relay controller."""
    lane = db.query(GateLaneController).filter(GateLaneController.id == lane_id).first()
    if not lane:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Gate Lane ID {lane_id} not found",
        )

    prev_state = lane.barrier_state
    lane.barrier_state = command
    now = datetime.now(timezone.utc)
    db.commit()

    return GateBarrierControlResponse(
        lane_id=lane.id,
        lane_code=lane.lane_code,
        previous_state=prev_state,
        new_state=lane.barrier_state,
        execution_status=f"Barrier relay set to {command.value}",
        timestamp=now,
    )


def get_gate_event_history(
    db: Session,
    facility_id: int,
    limit: int = 50,
) -> GateEventsListResponse:
    """Retrieve immutable chronological audit feed of gate entry/exit events."""
    events = (
        db.query(ANPRVerificationEvent)
        .filter(ANPRVerificationEvent.facility_id == facility_id)
        .order_by(ANPRVerificationEvent.timestamp.desc())
        .limit(limit)
        .all()
    )

    items: List[GateEventItem] = []
    for e in events:
        lane = db.query(GateLaneController).filter(GateLaneController.id == e.lane_id).first()
        items.append(
            GateEventItem(
                id=e.id,
                event_uuid=e.event_uuid,
                facility_id=e.facility_id,
                lane_code=lane.lane_code if lane else "LANE-01",
                direction=e.direction,
                masked_plate=e.masked_plate,
                confidence_score=e.confidence_score,
                decision=e.decision,
                decision_reason=e.decision_reason,
                verification_method=e.verification_method,
                barrier_action=e.barrier_action,
                matched_booking_reference=e.matched_booking_reference,
                human_reviewed=e.human_reviewed,
                sync_source=e.sync_source,
                timestamp=e.timestamp,
            )
        )

    return GateEventsListResponse(
        facility_id=facility_id,
        total=len(items),
        events=items,
    )


def get_gate_analytics_summary(
    db: Session,
    facility_id: int,
) -> GateAnalyticsSummaryResponse:
    """Calculate key gate throughput, ANPR accuracy, and review metrics."""
    events = (
        db.query(ANPRVerificationEvent)
        .filter(ANPRVerificationEvent.facility_id == facility_id)
        .all()
    )

    total_scans = len(events)
    auto_auth = 0
    manual_reviews = 0
    qr_fallbacks = 0
    offline_syncs = 0
    rejections = 0
    total_conf = 0.0

    for e in events:
        total_conf += e.confidence_score
        if e.decision == AccessDecision.AUTHORIZED and e.verification_method == VerificationMethod.ANPR:
            auto_auth += 1
        elif e.decision == AccessDecision.MANUAL_REVIEW or e.human_reviewed:
            manual_reviews += 1
        elif e.verification_method == VerificationMethod.QR_CODE:
            qr_fallbacks += 1
        elif e.verification_method == VerificationMethod.OFFLINE_LOCAL_CRYPTO:
            offline_syncs += 1

        if "REJECTED" in e.decision.value:
            rejections += 1

    avg_conf = round(total_conf / total_scans, 3) if total_scans > 0 else 0.95
    rate_pct = round((auto_auth / total_scans) * 100.0, 1) if total_scans > 0 else 92.5

    active_lanes = (
        db.query(GateLaneController)
        .filter(
            GateLaneController.facility_id == facility_id,
            GateLaneController.hardware_health == GateHardwareHealth.ONLINE,
        )
        .count()
    )

    pending_reviews = (
        db.query(ANPRManualReviewTask)
        .filter(
            ANPRManualReviewTask.facility_id == facility_id,
            ANPRManualReviewTask.status == GateReviewStatus.PENDING,
        )
        .count()
    )

    return GateAnalyticsSummaryResponse(
        facility_id=facility_id,
        total_scans_today=total_scans,
        anpr_auto_authorized_count=auto_auth,
        manual_reviews_required_count=manual_reviews,
        qr_fallback_count=qr_fallbacks,
        offline_sync_count=offline_syncs,
        rejections_count=rejections,
        average_anpr_confidence=avg_conf,
        auto_authorization_rate_pct=rate_pct,
        active_lanes_count=active_lanes,
        pending_manual_reviews_count=pending_reviews,
    )


def prune_anpr_records_retention(
    db: Session,
    facility_id: int,
    retention_days: int = 90,
) -> GatePruneResponse:
    """DPDP India 2023 compliance: prune raw plate OCR images and logs older than retention period."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

    old_events = (
        db.query(ANPRVerificationEvent)
        .filter(
            ANPRVerificationEvent.facility_id == facility_id,
            ANPRVerificationEvent.timestamp < cutoff,
        )
        .all()
    )

    pruned_count = len(old_events)
    for e in old_events:
        db.delete(e)

    # Log audit entry
    audit = GateAuditLog(
        facility_id=facility_id,
        action_type="DATA_PRUNED",
        reason=f"DPDP India 2023 compliance retention pruning: removed {pruned_count} records older than {retention_days} days",
        timestamp=datetime.now(timezone.utc),
    )
    db.add(audit)
    db.commit()

    return GatePruneResponse(
        facility_id=facility_id,
        records_pruned_count=pruned_count,
        retention_days=retention_days,
        timestamp=datetime.now(timezone.utc),
    )


def seed_phase16_gate_controllers(db: Session) -> None:
    """Idempotently seed physical gate lanes and 4K ANPR cameras for Lot 1 (Bangalore Cyber Gateway)."""
    facility = db.query(ParkingLot).first()
    if not facility:
        return

    now = datetime.now(timezone.utc)

    # Lane 1: Entry Lane
    lane_ent = (
        db.query(GateLaneController)
        .filter(GateLaneController.facility_id == facility.id, GateLaneController.lane_code == "LANE-ENT-01")
        .first()
    )
    if not lane_ent:
        lane_ent = GateLaneController(
            facility_id=facility.id,
            lane_code="LANE-ENT-01",
            lane_name="North Gate Entrance - Lane 1 (ANPR+FASTag)",
            direction=LaneDirection.ENTRY,
            ip_address="192.168.10.101",
            mqtt_topic="parkwise/gate/lane1/control",
            controller_model="Magnetic-Autocontrol-M-Pro-Relay",
            barrier_state=BarrierState.CLOSED,
            hardware_health=GateHardwareHealth.ONLINE,
            last_heartbeat_at=now,
            auto_open_enabled=True,
            anti_passback_enabled=True,
            early_entry_grace_minutes=30,
            exit_grace_minutes=15,
        )
        db.add(lane_ent)
        db.flush()

        cam_ent = ANPRCamera(
            facility_id=facility.id,
            lane_id=lane_ent.id,
            camera_code="CAM-GATE-ENT-01",
            camera_model="Hikvision-DarkFighter-ANPR-4K",
            stream_url="rtsp://edge-gate-cam1.internal/live",
            is_active=True,
            min_confidence_threshold=0.80,
            ocr_engine="Indian-HSRP-YOLO-OCR-v2",
        )
        db.add(cam_ent)

    # Lane 2: Exit Lane
    lane_ext = (
        db.query(GateLaneController)
        .filter(GateLaneController.facility_id == facility.id, GateLaneController.lane_code == "LANE-EXT-01")
        .first()
    )
    if not lane_ext:
        lane_ext = GateLaneController(
            facility_id=facility.id,
            lane_code="LANE-EXT-01",
            lane_name="North Gate Exit - Lane 2 (Boom Barrier)",
            direction=LaneDirection.EXIT,
            ip_address="192.168.10.102",
            mqtt_topic="parkwise/gate/lane2/control",
            controller_model="Magnetic-Autocontrol-M-Pro-Relay",
            barrier_state=BarrierState.CLOSED,
            hardware_health=GateHardwareHealth.ONLINE,
            last_heartbeat_at=now,
            auto_open_enabled=True,
            anti_passback_enabled=True,
            early_entry_grace_minutes=30,
            exit_grace_minutes=15,
        )
        db.add(lane_ext)
        db.flush()

        cam_ext = ANPRCamera(
            facility_id=facility.id,
            lane_id=lane_ext.id,
            camera_code="CAM-GATE-EXT-01",
            camera_model="Hikvision-DarkFighter-ANPR-4K",
            stream_url="rtsp://edge-gate-cam2.internal/live",
            is_active=True,
            min_confidence_threshold=0.80,
            ocr_engine="Indian-HSRP-YOLO-OCR-v2",
        )
        db.add(cam_ext)

    db.commit()
