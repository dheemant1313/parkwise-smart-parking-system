"""Phase 15: Sensor Fusion & Live Occupancy Resolution Service.
Integrates:
- Multi-source sensor telemetry ingestion (Ultrasonic, Magnetic, Radar, Camera CV)
- IoT Device registry, heartbeats, and stale sensor health monitoring
- Conflict resolution and out-of-order/delayed packet handling
- Operator manual overrides with audit trail
- Real-time WebSocket broadcasting and database synchronization
- Interlocking with actual booking and inventory engine
"""
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, ParkingLot, ParkingSlot, SlotStatus
from app.models_occupancy import (
    CVReviewStatus,
    CVUncertainDetectionReview,
    DeviceHealth,
    DeviceType,
    IoTDevice,
    OccupancyEvent,
    OccupancySource,
    OccupancyState,
    OperatorSlotOverride,
    SensorSlotMapping,
)
from app.schemas_occupancy import (
    CVFrameInferRequest,
    CVFrameInferResponse,
    CVReviewResolveRequest,
    CVUncertainReviewItem,
    FacilityLiveOccupancyResponse,
    LiveSlotOccupancyItem,
    OperatorSlotOverrideRequest,
    OperatorSlotOverrideResponse,
    SensorTelemetryIngestRequest,
    SensorTelemetryItem,
    TelemetryIngestResponse,
)
from app.services.cv_occupancy_service import (
    BoundingBox,
    ParkingSlotROI,
    cv_detector,
)
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

STALE_HEARTBEAT_THRESHOLD_SECONDS = 120
CONFLICT_WINDOW_SECONDS = 45
DELAYED_TELEMETRY_MAX_AGE_SECONDS = 60


def _to_utc(dt: Optional[datetime]) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def get_active_operator_override(db: Session, slot_id: int) -> Optional[OperatorSlotOverride]:
    """Retrieve active unexpired manual operator override for a slot."""
    now = datetime.now(timezone.utc)
    override = (
        db.query(OperatorSlotOverride)
        .filter(
            OperatorSlotOverride.slot_id == slot_id,
            OperatorSlotOverride.is_active == True,
        )
        .order_by(OperatorSlotOverride.id.desc())
        .first()
    )
    if override and override.expires_at:
        exp = _to_utc(override.expires_at)
        if exp < now:
            override.is_active = False
            db.commit()
            return None
    return override


def ingest_sensor_telemetry(
    db: Session, request: SensorTelemetryIngestRequest
) -> TelemetryIngestResponse:
    """Ingest live sensor telemetry from ultrasonic, magnetic, or radar bay sensors."""
    now = datetime.now(timezone.utc)
    updated_slots: List[int] = []
    conflicts_detected = 0

    for item in request.telemetry:
        device = (
            db.query(IoTDevice)
            .filter(
                IoTDevice.device_code == item.device_code,
                IoTDevice.facility_id == request.facility_id,
            )
            .first()
        )
        if not device:
            logger.warning(f"Device {item.device_code} not found in facility {request.facility_id}")
            continue

        item_time = _to_utc(item.timestamp)

        # Delayed / out-of-order check: if reading is older than device's latest heartbeat by > 60s, reject overwrite
        if device.last_heartbeat_at:
            last_hb = _to_utc(device.last_heartbeat_at)
            if (last_hb - item_time).total_seconds() > DELAYED_TELEMETRY_MAX_AGE_SECONDS:
                logger.warning(
                    f"Discarding delayed telemetry for {item.device_code}: reading time {item_time} "
                    f"is older than last heartbeat {last_hb}"
                )
                continue

        # Update device health & telemetry
        device.last_heartbeat_at = item_time
        device.health_status = DeviceHealth.ONLINE
        if item.battery_level_pct is not None:
            device.battery_level_pct = item.battery_level_pct
        if item.signal_rssi_dbm is not None:
            device.signal_rssi_dbm = item.signal_rssi_dbm

        # Determine physical occupancy reading
        raw_is_occupied: bool
        source_type: OccupancySource
        if item.is_occupied is not None:
            raw_is_occupied = item.is_occupied
        elif item.distance_m is not None:
            # Ultrasonic or Radar: Distance < 1.8m means vehicle is present
            raw_is_occupied = item.distance_m < 1.8
        elif item.magnetic_deviation_ut is not None:
            # Magnetic sensor: Deviation > 25 microTesla means ferromagnetic vehicle present
            raw_is_occupied = abs(item.magnetic_deviation_ut) > 25.0
        else:
            raw_is_occupied = False

        if device.device_type == DeviceType.ULTRASONIC:
            source_type = OccupancySource.ULTRASONIC_SENSOR
        elif device.device_type == DeviceType.MAGNETIC:
            source_type = OccupancySource.MAGNETIC_SENSOR
        elif device.device_type == DeviceType.RADAR:
            source_type = OccupancySource.RADAR_SENSOR
        else:
            source_type = OccupancySource.ULTRASONIC_SENSOR

        sensor_state = OccupancyState.OCCUPIED if raw_is_occupied else OccupancyState.VACANT

        # Find mapped slots
        mappings = (
            db.query(SensorSlotMapping)
            .filter(SensorSlotMapping.device_id == device.id)
            .all()
        )

        for mapping in mappings:
            slot = db.query(ParkingSlot).filter(ParkingSlot.id == mapping.slot_id).first()
            if not slot:
                continue

            previous_state = (
                OccupancyState.OCCUPIED
                if slot.status == SlotStatus.OCCUPIED
                else (
                    OccupancyState.RESERVED
                    if slot.status == SlotStatus.RESERVED
                    else (
                        OccupancyState.BLOCKED
                        if slot.status == SlotStatus.MAINTENANCE
                        else OccupancyState.VACANT
                    )
                )
            )

            # Check for active operator override
            active_override = get_active_operator_override(db, slot.id)
            if active_override:
                resolved_state = active_override.target_state
                override_active = True
            else:
                override_active = False

                # Check for recent conflicting sensor readings from other devices mapped to this slot
                recent_conflicting_event = (
                    db.query(OccupancyEvent)
                    .filter(
                        OccupancyEvent.slot_id == slot.id,
                        OccupancyEvent.device_id != device.id,
                        OccupancyEvent.timestamp >= now - timedelta(seconds=CONFLICT_WINDOW_SECONDS),
                    )
                    .order_by(OccupancyEvent.timestamp.desc())
                    .first()
                )

                if recent_conflicting_event and recent_conflicting_event.new_state != sensor_state and recent_conflicting_event.new_state in (OccupancyState.VACANT, OccupancyState.OCCUPIED):
                    # Sensor conflict detected!
                    conflicts_detected += 1
                    logger.warning(
                        f"Sensor conflict on slot {slot.slot_number}: device {device.device_code} "
                        f"reports {sensor_state} but recent event reports {recent_conflicting_event.new_state}. "
                        f"Setting to UNKNOWN failsafe."
                    )
                    resolved_state = OccupancyState.UNKNOWN
                else:
                    resolved_state = sensor_state

            # Sync with ParkingSlot model
            if resolved_state == OccupancyState.OCCUPIED:
                slot.status = SlotStatus.OCCUPIED
                slot.sensor_health = "ONLINE"
            elif resolved_state == OccupancyState.VACANT:
                # If slot has an active confirmed booking in progress, keep RESERVED/OCCUPIED
                active_booking = (
                    db.query(Booking)
                    .filter(
                        Booking.slot_id == slot.id,
                        Booking.status.in_([BookingStatus.ACTIVE, BookingStatus.CONFIRMED]),
                    )
                    .first()
                )
                if active_booking:
                    slot.status = SlotStatus.OCCUPIED if active_booking.status == BookingStatus.ACTIVE else SlotStatus.RESERVED
                    resolved_state = OccupancyState.OCCUPIED if active_booking.status == BookingStatus.ACTIVE else OccupancyState.RESERVED
                else:
                    slot.status = SlotStatus.AVAILABLE
                slot.sensor_health = "ONLINE"
            elif resolved_state == OccupancyState.BLOCKED:
                slot.status = SlotStatus.MAINTENANCE
            elif resolved_state == OccupancyState.UNKNOWN:
                slot.sensor_health = "DEGRADED"

            # Create immutable audit event
            event = OccupancyEvent(
                facility_id=request.facility_id,
                slot_id=slot.id,
                device_id=device.id,
                previous_state=previous_state,
                new_state=resolved_state,
                source_type=source_type if not override_active else OccupancySource.OPERATOR_OVERRIDE,
                confidence=item.confidence if not override_active else 1.0,
                distance_m=item.distance_m,
                magnetic_deviation_ut=item.magnetic_deviation_ut,
                raw_payload_json=json.dumps(item.raw_payload) if item.raw_payload else None,
                timestamp=item_time,
            )
            db.add(event)
            updated_slots.append(slot.id)

    db.commit()

    return TelemetryIngestResponse(
        success=True,
        ingested_count=len(request.telemetry),
        updated_slots=list(set(updated_slots)),
        conflicts_detected=conflicts_detected,
        message=f"Successfully processed {len(request.telemetry)} telemetry records.",
    )


def infer_camera_frame(
    db: Session, request: CVFrameInferRequest
) -> CVFrameInferResponse:
    """Classify vehicle parking occupancy from camera detections and ROI bounding boxes."""
    now = _to_utc(request.frame_timestamp)

    camera_device = (
        db.query(IoTDevice)
        .filter(
            IoTDevice.device_code == request.camera_device_code,
            IoTDevice.facility_id == request.facility_id,
        )
        .first()
    )
    if not camera_device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera device {request.camera_device_code} not found.",
        )

    camera_device.last_heartbeat_at = now
    camera_device.health_status = DeviceHealth.ONLINE

    # Retrieve all slot mappings for this camera
    mappings = (
        db.query(SensorSlotMapping)
        .filter(SensorSlotMapping.device_id == camera_device.id)
        .all()
    )

    if not mappings:
        return CVFrameInferResponse(
            success=True,
            facility_id=request.facility_id,
            camera_device_code=request.camera_device_code,
            evaluated_slots=0,
            occupied_slots=[],
            vacant_slots=[],
            uncertain_reviews_queued=0,
        )

    # Build ROIs
    rois: List[ParkingSlotROI] = []
    slot_map: Dict[int, ParkingSlot] = {}
    for m in mappings:
        slot = db.query(ParkingSlot).filter(ParkingSlot.id == m.slot_id).first()
        if not slot:
            continue
        slot_map[slot.id] = slot

        # Parse ROI
        if m.roi_polygon_json:
            try:
                roi_data = json.loads(m.roi_polygon_json)
                rois.append(
                    ParkingSlotROI(
                        slot_id=slot.id,
                        slot_number=slot.slot_number,
                        x1=float(roi_data.get("x1", 0)),
                        y1=float(roi_data.get("y1", 0)),
                        x2=float(roi_data.get("x2", 100)),
                        y2=float(roi_data.get("y2", 100)),
                    )
                )
            except Exception:
                rois.append(
                    ParkingSlotROI(
                        slot_id=slot.id,
                        slot_number=slot.slot_number,
                        x1=0.0,
                        y1=0.0,
                        x2=100.0,
                        y2=100.0,
                    )
                )
        else:
            rois.append(
                ParkingSlotROI(
                    slot_id=slot.id,
                    slot_number=slot.slot_number,
                    x1=0.0,
                    y1=0.0,
                    x2=100.0,
                    y2=100.0,
                )
            )

    # Convert detections to BoundingBoxes
    det_boxes: List[BoundingBox] = []
    for d in request.detections:
        # box_2d: [x1, y1, x2, y2]
        if len(d.box_2d) >= 4:
            det_boxes.append(
                BoundingBox(
                    x1=float(d.box_2d[0]),
                    y1=float(d.box_2d[1]),
                    x2=float(d.box_2d[2]),
                    y2=float(d.box_2d[3]),
                    class_name=d.class_name,
                    confidence=d.confidence,
                )
            )

    # Classify via computer vision service
    classifications = cv_detector.classify_slots(rois, det_boxes)

    occupied_slots: List[str] = []
    vacant_slots: List[str] = []
    uncertain_reviews_queued = 0

    for cls in classifications:
        slot = slot_map.get(cls.slot_id)
        if not slot:
            continue

        previous_state = (
            OccupancyState.OCCUPIED
            if slot.status == SlotStatus.OCCUPIED
            else (
                OccupancyState.RESERVED
                if slot.status == SlotStatus.RESERVED
                else (
                    OccupancyState.BLOCKED
                    if slot.status == SlotStatus.MAINTENANCE
                    else OccupancyState.VACANT
                )
            )
        )

        active_override = get_active_operator_override(db, slot.id)

        if cls.is_uncertain:
            # RULE: Do not automatically treat uncertain detections as confirmed vacancies!
            uncertain_reviews_queued += 1
            review_item = CVUncertainDetectionReview(
                facility_id=request.facility_id,
                slot_id=slot.id,
                device_id=camera_device.id,
                frame_timestamp=now,
                bounding_box_json=json.dumps(
                    {
                        "x1": cls.matched_box.x1 if cls.matched_box else 0,
                        "y1": cls.matched_box.y1 if cls.matched_box else 0,
                        "x2": cls.matched_box.x2 if cls.matched_box else 0,
                        "y2": cls.matched_box.y2 if cls.matched_box else 0,
                    }
                ),
                detected_class=cls.matched_box.class_name if cls.matched_box else "unknown",
                confidence=cls.confidence,
                snapshot_url=request.snapshot_url,
                status=CVReviewStatus.PENDING_REVIEW,
            )
            db.add(review_item)

            # Keep safe status: mark sensor health as DEGRADED, do not confirm vacancy
            slot.sensor_health = "DEGRADED"

            event = OccupancyEvent(
                facility_id=request.facility_id,
                slot_id=slot.id,
                device_id=camera_device.id,
                previous_state=previous_state,
                new_state=OccupancyState.UNKNOWN,
                source_type=OccupancySource.CAMERA_CV,
                confidence=cls.confidence,
                raw_payload_json=json.dumps({"reason": cls.reason, "overlap": cls.overlap_ratio}),
                timestamp=now,
            )
            db.add(event)
        elif cls.is_occupied:
            occupied_slots.append(slot.slot_number)
            if not active_override:
                slot.status = SlotStatus.OCCUPIED
                slot.sensor_health = "ONLINE"

            event = OccupancyEvent(
                facility_id=request.facility_id,
                slot_id=slot.id,
                device_id=camera_device.id,
                previous_state=previous_state,
                new_state=OccupancyState.OCCUPIED if not active_override else active_override.target_state,
                source_type=OccupancySource.CAMERA_CV if not active_override else OccupancySource.OPERATOR_OVERRIDE,
                confidence=cls.confidence,
                raw_payload_json=json.dumps({"reason": cls.reason, "overlap": cls.overlap_ratio}),
                timestamp=now,
            )
            db.add(event)
        else:
            vacant_slots.append(slot.slot_number)
            if not active_override:
                # Check for active bookings
                active_booking = (
                    db.query(Booking)
                    .filter(
                        Booking.slot_id == slot.id,
                        Booking.status.in_([BookingStatus.ACTIVE, BookingStatus.CONFIRMED]),
                    )
                    .first()
                )
                if not active_booking:
                    slot.status = SlotStatus.AVAILABLE
                slot.sensor_health = "ONLINE"

            event = OccupancyEvent(
                facility_id=request.facility_id,
                slot_id=slot.id,
                device_id=camera_device.id,
                previous_state=previous_state,
                new_state=OccupancyState.VACANT if not active_override else active_override.target_state,
                source_type=OccupancySource.CAMERA_CV if not active_override else OccupancySource.OPERATOR_OVERRIDE,
                confidence=cls.confidence,
                raw_payload_json=json.dumps({"reason": cls.reason}),
                timestamp=now,
            )
            db.add(event)

    db.commit()

    return CVFrameInferResponse(
        success=True,
        facility_id=request.facility_id,
        camera_device_code=request.camera_device_code,
        evaluated_slots=len(classifications),
        occupied_slots=occupied_slots,
        vacant_slots=vacant_slots,
        uncertain_reviews_queued=uncertain_reviews_queued,
    )


def detect_and_flag_stale_sensors(
    db: Session,
    facility_id: Optional[int] = None,
    stale_threshold_seconds: int = STALE_HEARTBEAT_THRESHOLD_SECONDS,
) -> int:
    """Scan all IoT devices for stale/failed heartbeats. Mark failed sensors and set slot occupancy to UNKNOWN."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=stale_threshold_seconds)

    query = db.query(IoTDevice).filter(
        IoTDevice.last_heartbeat_at < cutoff,
        IoTDevice.health_status.in_([DeviceHealth.ONLINE, DeviceHealth.DEGRADED]),
    )
    if facility_id:
        query = query.filter(IoTDevice.facility_id == facility_id)

    stale_devices = query.all()
    flagged_slots_count = 0

    for dev in stale_devices:
        dev.health_status = DeviceHealth.STALE

        # Update mapped slots
        for mapping in dev.mappings:
            slot = mapping.slot
            if not slot:
                continue

            active_override = get_active_operator_override(db, slot.id)
            if active_override:
                continue

            # Check if there are other ONLINE devices mapped to this slot
            other_healthy = (
                db.query(SensorSlotMapping)
                .join(IoTDevice, SensorSlotMapping.device_id == IoTDevice.id)
                .filter(
                    SensorSlotMapping.slot_id == slot.id,
                    SensorSlotMapping.device_id != dev.id,
                    IoTDevice.health_status == DeviceHealth.ONLINE,
                )
                .first()
            )
            if not other_healthy:
                previous_state = (
                    OccupancyState.OCCUPIED
                    if slot.status == SlotStatus.OCCUPIED
                    else (
                        OccupancyState.RESERVED
                        if slot.status == SlotStatus.RESERVED
                        else (
                            OccupancyState.BLOCKED
                            if slot.status == SlotStatus.MAINTENANCE
                            else OccupancyState.VACANT
                        )
                    )
                )

                slot.sensor_health = "STALE"
                flagged_slots_count += 1

                event = OccupancyEvent(
                    facility_id=dev.facility_id,
                    slot_id=slot.id,
                    device_id=dev.id,
                    previous_state=previous_state,
                    new_state=OccupancyState.UNKNOWN,
                    source_type=OccupancySource.ULTRASONIC_SENSOR,
                    confidence=0.0,
                    raw_payload_json=json.dumps(
                        {"error": "STALE_SENSOR_HEARTBEAT_TIMEOUT", "device_code": dev.device_code}
                    ),
                    timestamp=now,
                    is_stale_cleared=True,
                )
                db.add(event)

    db.commit()
    return flagged_slots_count


def apply_operator_override(
    db: Session,
    slot_id: int,
    request: OperatorSlotOverrideRequest,
    operator_user_id: int,
) -> OperatorSlotOverrideResponse:
    """Apply manual operator correction to a slot's occupancy state."""
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Slot ID {slot_id} not found.",
        )

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=request.duration_minutes or 60)

    # Deactivate existing active overrides for this slot
    existing = (
        db.query(OperatorSlotOverride)
        .filter(OperatorSlotOverride.slot_id == slot_id, OperatorSlotOverride.is_active == True)
        .all()
    )
    for ex in existing:
        ex.is_active = False

    override = OperatorSlotOverride(
        slot_id=slot.id,
        facility_id=slot.lot_id,
        target_state=request.target_state,
        reason=request.reason,
        operator_user_id=operator_user_id,
        expires_at=expires_at,
        is_active=True,
        created_at=now,
    )
    db.add(override)

    # Update slot status
    previous_state = (
        OccupancyState.OCCUPIED
        if slot.status == SlotStatus.OCCUPIED
        else (
            OccupancyState.RESERVED
            if slot.status == SlotStatus.RESERVED
            else (
                OccupancyState.BLOCKED
                if slot.status == SlotStatus.MAINTENANCE
                else OccupancyState.VACANT
            )
        )
    )

    if request.target_state == OccupancyState.OCCUPIED:
        slot.status = SlotStatus.OCCUPIED
    elif request.target_state == OccupancyState.VACANT:
        slot.status = SlotStatus.AVAILABLE
    elif request.target_state == OccupancyState.BLOCKED:
        slot.status = SlotStatus.MAINTENANCE
    elif request.target_state == OccupancyState.RESERVED:
        slot.status = SlotStatus.RESERVED

    event = OccupancyEvent(
        facility_id=slot.lot_id,
        slot_id=slot.id,
        device_id=None,
        previous_state=previous_state,
        new_state=request.target_state,
        source_type=OccupancySource.OPERATOR_OVERRIDE,
        confidence=1.0,
        raw_payload_json=json.dumps({"operator_override_id": override.id, "reason": request.reason}),
        timestamp=now,
    )
    db.add(event)
    db.commit()
    db.refresh(override)

    return OperatorSlotOverrideResponse(
        id=override.id,
        slot_id=slot.id,
        slot_number=slot.slot_number,
        facility_id=slot.lot_id,
        target_state=override.target_state,
        reason=override.reason,
        operator_user_id=override.operator_user_id,
        expires_at=override.expires_at,
        is_active=override.is_active,
        created_at=override.created_at,
    )


def clear_operator_override(db: Session, slot_id: int) -> bool:
    """Clear active manual operator override and revert to live sensor fusion."""
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Slot ID {slot_id} not found.",
        )

    overrides = (
        db.query(OperatorSlotOverride)
        .filter(OperatorSlotOverride.slot_id == slot_id, OperatorSlotOverride.is_active == True)
        .all()
    )
    for ov in overrides:
        ov.is_active = False

    # Restore from latest sensor event if available
    latest_sensor_event = (
        db.query(OccupancyEvent)
        .filter(
            OccupancyEvent.slot_id == slot_id,
            OccupancyEvent.source_type.in_([
                OccupancySource.ULTRASONIC_SENSOR,
                OccupancySource.MAGNETIC_SENSOR,
                OccupancySource.RADAR_SENSOR,
                OccupancySource.CAMERA_CV,
            ]),
        )
        .order_by(OccupancyEvent.timestamp.desc())
        .first()
    )
    if latest_sensor_event and latest_sensor_event.new_state == OccupancyState.OCCUPIED:
        slot.status = SlotStatus.OCCUPIED
    else:
        slot.status = SlotStatus.AVAILABLE
        slot.sensor_health = "ONLINE"

    db.commit()
    return True


def resolve_cv_review(
    db: Session,
    review_id: int,
    request: CVReviewResolveRequest,
    operator_user_id: int,
) -> CVUncertainReviewItem:
    """Operator resolves an uncertain CV detection from the review queue."""
    review = (
        db.query(CVUncertainDetectionReview)
        .filter(CVUncertainDetectionReview.id == review_id)
        .first()
    )
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review ID {review_id} not found.",
        )

    now = datetime.now(timezone.utc)
    review.status = request.decision
    review.reviewed_by_user_id = operator_user_id
    review.reviewed_at = now
    review.operator_notes = request.operator_notes

    slot = review.slot
    if slot:
        previous_state = (
            OccupancyState.OCCUPIED
            if slot.status == SlotStatus.OCCUPIED
            else (
                OccupancyState.RESERVED
                if slot.status == SlotStatus.RESERVED
                else (
                    OccupancyState.BLOCKED
                    if slot.status == SlotStatus.MAINTENANCE
                    else OccupancyState.VACANT
                )
            )
        )

        if request.decision == CVReviewStatus.APPROVED_OCCUPIED:
            slot.status = SlotStatus.OCCUPIED
            slot.sensor_health = "ONLINE"
            new_st = OccupancyState.OCCUPIED
        elif request.decision == CVReviewStatus.APPROVED_VACANT:
            slot.status = SlotStatus.AVAILABLE
            slot.sensor_health = "ONLINE"
            new_st = OccupancyState.VACANT
        else:
            new_st = previous_state

        event = OccupancyEvent(
            facility_id=review.facility_id,
            slot_id=slot.id,
            device_id=review.device_id,
            previous_state=previous_state,
            new_state=new_st,
            source_type=OccupancySource.OPERATOR_OVERRIDE,
            confidence=1.0,
            raw_payload_json=json.dumps(
                {"cv_review_id": review.id, "decision": request.decision.value}
            ),
            timestamp=now,
        )
        db.add(event)

    db.commit()
    db.refresh(review)

    return CVUncertainReviewItem(
        id=review.id,
        facility_id=review.facility_id,
        slot_id=review.slot_id,
        slot_number=slot.slot_number if slot else "",
        camera_device_code=review.device.device_code if review.device else None,
        frame_timestamp=review.frame_timestamp,
        bounding_box_json=review.bounding_box_json,
        detected_class=review.detected_class,
        confidence=review.confidence,
        snapshot_url=review.snapshot_url,
        status=review.status,
        created_at=review.created_at,
    )


def get_facility_live_occupancy(
    db: Session, facility_id: int
) -> FacilityLiveOccupancyResponse:
    """Retrieve full real-time slot occupancy matrix and statistics for a facility."""
    facility = db.query(ParkingLot).filter(ParkingLot.id == facility_id).first()
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility ID {facility_id} not found.",
        )

    slots = db.query(ParkingSlot).filter(ParkingSlot.lot_id == facility_id).all()

    total_slots = len(slots)
    vacant_slots = 0
    occupied_slots = 0
    reserved_slots = 0
    blocked_slots = 0
    unknown_slots = 0

    sensor_health_summary = {"ONLINE": 0, "OFFLINE": 0, "DEGRADED": 0, "STALE": 0}

    slot_items: List[LiveSlotOccupancyItem] = []
    now = datetime.now(timezone.utc)

    for slot in slots:
        override = get_active_operator_override(db, slot.id)

        # Determine resolved state
        if override:
            state = override.target_state
        elif slot.sensor_health in ("STALE", "OFFLINE"):
            state = OccupancyState.UNKNOWN
        elif slot.status == SlotStatus.OCCUPIED:
            state = OccupancyState.OCCUPIED
        elif slot.status == SlotStatus.RESERVED:
            state = OccupancyState.RESERVED
        elif slot.status == SlotStatus.MAINTENANCE:
            state = OccupancyState.BLOCKED
        elif slot.status == SlotStatus.AVAILABLE:
            state = OccupancyState.VACANT
        else:
            state = OccupancyState.UNKNOWN

        # Tally counts
        if state == OccupancyState.VACANT:
            vacant_slots += 1
        elif state == OccupancyState.OCCUPIED:
            occupied_slots += 1
        elif state == OccupancyState.RESERVED:
            reserved_slots += 1
        elif state == OccupancyState.BLOCKED:
            blocked_slots += 1
        else:
            unknown_slots += 1

        # Sensor health
        h_str = (slot.sensor_health or "ONLINE").upper()
        if h_str not in sensor_health_summary:
            h_str = "ONLINE"
        sensor_health_summary[h_str] += 1

        # Get latest event for source and confidence
        latest_event = (
            db.query(OccupancyEvent)
            .filter(OccupancyEvent.slot_id == slot.id)
            .order_by(OccupancyEvent.timestamp.desc())
            .first()
        )

        active_bkg = (
            db.query(Booking)
            .filter(
                Booking.slot_id == slot.id,
                Booking.status.in_([BookingStatus.ACTIVE, BookingStatus.CONFIRMED]),
            )
            .first()
        )

        # Slot is bookable ONLY if it is VACANT and sensor is healthy
        is_bookable = (state == OccupancyState.VACANT) and (slot.sensor_health == "ONLINE")

        slot_items.append(
            LiveSlotOccupancyItem(
                slot_id=slot.id,
                slot_number=slot.slot_number,
                floor=slot.floor,
                zone=slot.zone,
                slot_type=slot.slot_type.value,
                state=state,
                is_bookable=is_bookable,
                confidence=latest_event.confidence if latest_event else 1.0,
                source_type=latest_event.source_type if latest_event else None,
                last_device_code=latest_event.device.device_code if latest_event and latest_event.device else None,
                sensor_health=DeviceHealth(h_str) if h_str in DeviceHealth.__members__ else DeviceHealth.ONLINE,
                last_updated_at=latest_event.timestamp if latest_event else now,
                has_active_override=override is not None,
                active_booking_reference=active_bkg.booking_reference if active_bkg else None,
            )
        )

    occupancy_rate_pct = (
        round((occupied_slots + reserved_slots) / total_slots * 100.0, 1)
        if total_slots > 0
        else 0.0
    )

    return FacilityLiveOccupancyResponse(
        facility_id=facility.id,
        facility_name=facility.name,
        total_slots=total_slots,
        vacant_slots=vacant_slots,
        occupied_slots=occupied_slots,
        reserved_slots=reserved_slots,
        blocked_slots=blocked_slots,
        unknown_slots=unknown_slots,
        occupancy_rate_pct=occupancy_rate_pct,
        sensor_health_summary=sensor_health_summary,
        slots=slot_items,
    )


def seed_phase15_iot_sensors(db: Session) -> None:
    """Idempotently seed IoT devices and mappings for the sample facility (Bangalore Cyber Gateway)."""
    facility = db.query(ParkingLot).first()
    if not facility:
        return

    now = datetime.now(timezone.utc)

    # Ensure Zone C slots (C-140, C-141, C-142, C-143, C-144) exist as ParkingSlot records
    from app.models import SlotType
    zone_c_specs = [
        ("C-140", SlotType.STANDARD, 2, "C"),
        ("C-141", SlotType.STANDARD, 2, "C"),
        ("C-142", SlotType.STANDARD, 2, "C"),
        ("C-143", SlotType.STANDARD, 2, "C"),
        ("C-144", SlotType.EV_CHARGING, 2, "C"),
    ]
    for s_num, s_type, fl, zn in zone_c_specs:
        existing_slot = (
            db.query(ParkingSlot)
            .filter(ParkingSlot.lot_id == facility.id, ParkingSlot.slot_number == s_num)
            .first()
        )
        if not existing_slot:
            db.add(
                ParkingSlot(
                    lot_id=facility.id,
                    slot_number=s_num,
                    floor=fl,
                    zone=zn,
                    slot_type=s_type,
                    status=SlotStatus.AVAILABLE,
                    sensor_health="ONLINE",
                )
            )
    db.commit()

    # 1. Ultrasonic bay sensors
    slots = db.query(ParkingSlot).filter(ParkingSlot.lot_id == facility.id).all()
    for s in slots:
        device_code = f"SEN-{s.slot_number}"
        dev = db.query(IoTDevice).filter(IoTDevice.device_code == device_code).first()
        if not dev:
            dev = IoTDevice(
                facility_id=facility.id,
                device_code=device_code,
                device_type=DeviceType.ULTRASONIC,
                ip_address=f"192.168.10.{100 + (s.id % 150)}",
                mac_address=f"00:1B:44:11:3A:{s.id:02X}",
                firmware_version="v2.4.1",
                battery_level_pct=92.5 if s.id % 2 == 0 else 88.0,
                signal_rssi_dbm=-62,
                health_status=DeviceHealth.ONLINE,
                last_heartbeat_at=now,
                registered_at=now,
            )
            db.add(dev)
            db.flush()

        mapping = (
            db.query(SensorSlotMapping)
            .filter(SensorSlotMapping.device_id == dev.id, SensorSlotMapping.slot_id == s.id)
            .first()
        )
        if not mapping:
            mapping = SensorSlotMapping(
                device_id=dev.id,
                slot_id=s.id,
                facility_id=facility.id,
                is_primary=True,
                created_at=now,
            )
            db.add(mapping)

    # 2. Overhead computer vision cameras covering groups of slots
    cameras_spec = [
        {"code": "CAM-L0-01", "slots": ["F1-A01", "F1-A02"], "ip": "192.168.20.11"},
        {"code": "CAM-B1-01", "slots": ["B1-A01", "B1-A02"], "ip": "192.168.20.21"},
        {"code": "CAM-B2-01", "slots": ["C-140", "C-141", "C-142"], "ip": "192.168.20.31"},
        {"code": "CAM-B2-02", "slots": ["C-143", "C-144"], "ip": "192.168.20.32"},
    ]

    for cam in cameras_spec:
        cam_dev = db.query(IoTDevice).filter(IoTDevice.device_code == cam["code"]).first()
        if not cam_dev:
            cam_dev = IoTDevice(
                facility_id=facility.id,
                device_code=cam["code"],
                device_type=DeviceType.CAMERA_CV,
                ip_address=cam["ip"],
                mac_address="00:1B:44:AA:BB:CC",
                firmware_version="v3.0.0-rtsp",
                battery_level_pct=None,  # Hardwired PoE
                signal_rssi_dbm=-48,
                health_status=DeviceHealth.ONLINE,
                last_heartbeat_at=now,
                registered_at=now,
            )
            db.add(cam_dev)
            db.flush()

        for slot_num in cam["slots"]:
            s_obj = db.query(ParkingSlot).filter(ParkingSlot.lot_id == facility.id, ParkingSlot.slot_number == slot_num).first()
            if s_obj:
                mapping = (
                    db.query(SensorSlotMapping)
                    .filter(SensorSlotMapping.device_id == cam_dev.id, SensorSlotMapping.slot_id == s_obj.id)
                    .first()
                )
                if not mapping:
                    roi_box = {
                        "x1": 100.0 * (s_obj.id % 5),
                        "y1": 50.0,
                        "x2": 100.0 * (s_obj.id % 5) + 90.0,
                        "y2": 180.0,
                    }
                    mapping = SensorSlotMapping(
                        device_id=cam_dev.id,
                        slot_id=s_obj.id,
                        facility_id=facility.id,
                        roi_polygon_json=json.dumps(roi_box),
                        is_primary=False,
                        created_at=now,
                    )
                    db.add(mapping)

    db.commit()
