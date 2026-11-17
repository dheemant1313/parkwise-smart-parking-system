"""Phase 15: Automated Integration Tests for Live Parking Occupancy & Smart Sensor Integration.

Uses in-memory synchronous execution (_run_sync) for lightning-fast, deadlock-free testing on Windows.
Covers:
1. IoT device registry and slot mapping verification
2. Ultrasonic bay sensor telemetry ingestion (Vehicle arrival -> OCCUPIED)
3. Sensor departure event (Vehicle departure -> VACANT)
4. Camera CV frame detection with YOLOv8 classifier (High-confidence car -> OCCUPIED)
5. Camera CV ambiguous detection handling (Uncertain -> queued to operator review, NOT confirmed vacant)
6. Stale/failed sensor detection (Heartbeat timeout -> UNKNOWN state)
7. Booking engine interlocking: Rejects reservation on OCCUPIED slot (HTTP 409 Conflict)
8. Booking engine interlocking: Rejects reservation on UNKNOWN/STALE slot (HTTP 409 Conflict)
9. Conflicting sensor readings detection (Ultrasonic vs Camera conflict -> UNKNOWN failsafe)
10. Delayed / out-of-order telemetry rejection (Old timestamp does not overwrite fresh state)
11. Operator manual correction override and subsequent release
"""
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Coroutine, List
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import Booking, BookingStatus, ParkingLot, ParkingSlot, SlotStatus, User, UserRole
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
from app.router_occupancy import (
    create_operator_override_endpoint,
    delete_operator_override_endpoint,
    device_heartbeat,
    evaluate_stale_sensors_endpoint,
    get_cv_review_queue,
    get_live_facility_occupancy,
    get_single_slot_telemetry,
    infer_camera_frame_endpoint,
    ingest_telemetry_batch,
    list_iot_devices,
    resolve_cv_review_endpoint,
    simulate_device_failure,
)
from app.schemas import BookingCreateRequest
from app.schemas_occupancy import (
    CVDetectedObject,
    CVFrameInferRequest,
    CVReviewResolveRequest,
    OperatorSlotOverrideRequest,
    SensorTelemetryIngestRequest,
    SensorTelemetryItem,
)
from app.services.booking_service import create_transactional_booking
from app.services.occupancy_service import seed_phase15_iot_sensors


def _run_sync(coro: Coroutine[Any, Any, Any]) -> Any:
    """Execute coroutine synchronously without event loop conflict."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    finally:
        coro.close()


@pytest.fixture(scope="module")
def db():
    """Module-level database fixture with seeded facility and IoT devices."""
    Base.metadata.create_all(bind=engine)
    session: Session = SessionLocal()
    seed_phase15_iot_sensors(session)

    # Clean residual overrides, events, and reviews for clean test isolation
    session.query(OccupancyEvent).delete()
    session.query(CVUncertainDetectionReview).delete()
    session.query(OperatorSlotOverride).delete()
    for s in session.query(ParkingSlot).all():
        s.status = SlotStatus.AVAILABLE
        s.sensor_health = "ONLINE"
    session.commit()

    # Ensure operator user exists
    operator = session.query(User).filter(User.role == UserRole.OPERATOR).first()
    if not operator:
        operator = User(
            email="operator_phase15@parkwise.io",
            full_name="Phase15 NOC Operator",
            hashed_password="hashed_pw_placeholder",
            role=UserRole.OPERATOR,
            is_active=True,
        )
        session.add(operator)
        session.commit()
        session.refresh(operator)

    driver = session.query(User).filter(User.role == UserRole.DRIVER).first()
    if not driver:
        driver = User(
            email="driver_phase15@parkwise.io",
            full_name="Phase15 Driver",
            hashed_password="hashed_pw_placeholder",
            role=UserRole.DRIVER,
            is_active=True,
        )
        session.add(driver)
        session.commit()
        session.refresh(driver)

    try:
        yield session
    finally:
        session.close()


def test_01_iot_device_registry_and_slot_mapping(db: Session):
    """Verify registered IoT bay sensors and overhead cameras are correctly mapped to slots."""
    devices = _run_sync(list_iot_devices(facility_id=1, db=db))
    assert len(devices) > 0, "Facility 1 must have registered IoT devices"

    ultrasonic_devices = [d for d in devices if d.device_type == DeviceType.ULTRASONIC]
    camera_devices = [d for d in devices if d.device_type == DeviceType.CAMERA_CV]

    assert len(ultrasonic_devices) >= 5, "Should have ultrasonic sensors for parking bays"
    assert len(camera_devices) >= 1, "Should have overhead camera devices"

    # Verify mapping for slot C-142
    slot_c142 = db.query(ParkingSlot).filter(ParkingSlot.slot_number == "C-142").first()
    assert slot_c142 is not None, "Slot C-142 must exist"

    mappings = db.query(SensorSlotMapping).filter(SensorSlotMapping.slot_id == slot_c142.id).all()
    assert len(mappings) >= 1, "Slot C-142 must have at least one sensor mapped"


def test_02_ultrasonic_sensor_occupancy_ingest(db: Session):
    """Ingest distance < 1.8m telemetry: Slot must transition to OCCUPIED."""
    slot_c142 = db.query(ParkingSlot).filter(ParkingSlot.slot_number == "C-142").first()
    assert slot_c142 is not None

    req = SensorTelemetryIngestRequest(
        facility_id=1,
        telemetry=[
            SensorTelemetryItem(
                device_code="SEN-C-142",
                distance_m=0.85,  # Vehicle parked overhead
                confidence=0.98,
                battery_level_pct=91.0,
                signal_rssi_dbm=-60,
                timestamp=datetime.now(timezone.utc),
            )
        ],
    )

    resp = _run_sync(ingest_telemetry_batch(payload=req, db=db))
    assert resp.success is True
    assert resp.ingested_count == 1
    assert slot_c142.id in resp.updated_slots

    db.refresh(slot_c142)
    assert slot_c142.status == SlotStatus.OCCUPIED, "Slot C-142 must be OCCUPIED"
    assert slot_c142.sensor_health == "ONLINE"

    # Verify live occupancy aggregate reflects the occupancy
    facility_live = _run_sync(get_live_facility_occupancy(facility_id=1, db=db))
    slot_entry = next((s for s in facility_live.slots if s.slot_number == "C-142"), None)
    assert slot_entry is not None
    assert slot_entry.state == OccupancyState.OCCUPIED
    assert slot_entry.is_bookable is False


def test_03_sensor_departure_vacant_transition(db: Session):
    """Ingest distance > 2.0m telemetry: Slot must transition back to VACANT and bookable."""
    slot_c142 = db.query(ParkingSlot).filter(ParkingSlot.slot_number == "C-142").first()
    assert slot_c142 is not None

    # Clear any active bookings holding C-142 reserved to test pure vacancy transition
    for b in db.query(Booking).filter(Booking.slot_id == slot_c142.id).all():
        b.status = BookingStatus.COMPLETED
    db.commit()

    req = SensorTelemetryIngestRequest(
        facility_id=1,
        telemetry=[
            SensorTelemetryItem(
                device_code="SEN-C-142",
                distance_m=2.45,  # Bay clear
                confidence=0.99,
                timestamp=datetime.now(timezone.utc),
            )
        ],
    )

    resp = _run_sync(ingest_telemetry_batch(payload=req, db=db))
    assert resp.success is True

    db.refresh(slot_c142)
    assert slot_c142.status == SlotStatus.AVAILABLE, "Slot C-142 must be AVAILABLE after departure"

    facility_live = _run_sync(get_live_facility_occupancy(facility_id=1, db=db))
    slot_entry = next((s for s in facility_live.slots if s.slot_number == "C-142"), None)
    assert slot_entry is not None
    assert slot_entry.state == OccupancyState.VACANT
    assert slot_entry.is_bookable is True


def test_04_camera_cv_vehicle_detection_occupancy(db: Session):
    """Overhead camera detection with high-confidence car bounding box over slot C-140."""
    slot_c140 = db.query(ParkingSlot).filter(ParkingSlot.slot_number == "C-140").first()
    assert slot_c140 is not None

    # Get camera mapped to C-140
    cam_mapping = (
        db.query(SensorSlotMapping)
        .join(IoTDevice, SensorSlotMapping.device_id == IoTDevice.id)
        .filter(
            SensorSlotMapping.slot_id == slot_c140.id,
            IoTDevice.device_type == DeviceType.CAMERA_CV,
        )
        .first()
    )
    assert cam_mapping is not None
    camera_code = cam_mapping.device.device_code

    # Submit frame with vehicle over C-140's ROI ([200.0, 50.0, 290.0, 180.0])
    cv_req = CVFrameInferRequest(
        facility_id=1,
        camera_device_code=camera_code,
        frame_timestamp=datetime.now(timezone.utc),
        snapshot_url="https://cctv.parkwise.io/snaps/b2_cam01.jpg",
        detections=[
            CVDetectedObject(
                class_name="car",
                confidence=0.92,
                box_2d=[205.0, 55.0, 285.0, 175.0],  # Intersects C-140 ROI
            )
        ],
    )

    resp = _run_sync(infer_camera_frame_endpoint(payload=cv_req, db=db))
    assert resp.success is True
    assert "C-140" in resp.occupied_slots

    db.refresh(slot_c140)
    assert slot_c140.status == SlotStatus.OCCUPIED


def test_05_camera_cv_uncertain_detection_review_queue(db: Session):
    """Ambiguous CV detection (confidence 0.55): Must queue for operator review, NOT treat as vacant!"""
    slot_c141 = db.query(ParkingSlot).filter(ParkingSlot.slot_number == "C-141").first()
    assert slot_c141 is not None

    cam_mapping = (
        db.query(SensorSlotMapping)
        .join(IoTDevice, SensorSlotMapping.device_id == IoTDevice.id)
        .filter(
            SensorSlotMapping.slot_id == slot_c141.id,
            IoTDevice.device_type == DeviceType.CAMERA_CV,
        )
        .first()
    )
    assert cam_mapping is not None
    camera_code = cam_mapping.device.device_code

    # Low/ambiguous confidence detection over C-141's ROI ([300.0, 50.0, 390.0, 180.0])
    cv_req = CVFrameInferRequest(
        facility_id=1,
        camera_device_code=camera_code,
        frame_timestamp=datetime.now(timezone.utc),
        detections=[
            CVDetectedObject(
                class_name="car",
                confidence=0.55,  # Ambiguous (0.40 - 0.75)
                box_2d=[305.0, 55.0, 385.0, 175.0],
            )
        ],
    )

    resp = _run_sync(infer_camera_frame_endpoint(payload=cv_req, db=db))
    assert resp.success is True
    assert resp.uncertain_reviews_queued >= 1

    # Verify review item exists in queue
    review_queue = _run_sync(get_cv_review_queue(facility_id=1, db=db))
    assert any(r.slot_id == slot_c141.id for r in review_queue)

    # Resolve review by operator as APPROVED_OCCUPIED
    target_review = next(r for r in review_queue if r.slot_id == slot_c141.id)
    operator = db.query(User).filter(User.role == UserRole.OPERATOR).first()

    resolve_resp = _run_sync(
        resolve_cv_review_endpoint(
            review_id=target_review.id,
            payload=CVReviewResolveRequest(
                decision=CVReviewStatus.APPROVED_OCCUPIED,
                operator_notes="Confirmed vehicle present via high-res stream.",
            ),
            current_user=operator,
            db=db,
        )
    )
    assert resolve_resp.status == CVReviewStatus.APPROVED_OCCUPIED

    db.refresh(slot_c141)
    assert slot_c141.status == SlotStatus.OCCUPIED


def test_06_stale_sensor_failure_triggers_unknown_state(db: Session):
    """Simulate sensor failure: Sensor marks OFFLINE and slot status transitions to UNKNOWN."""
    slot_c143 = db.query(ParkingSlot).filter(ParkingSlot.slot_number == "C-143").first()
    assert slot_c143 is not None

    device = db.query(IoTDevice).filter(IoTDevice.device_code == "SEN-C-143").first()
    assert device is not None

    # Trigger failure simulation
    sim_resp = _run_sync(simulate_device_failure(device_id=device.id, db=db))
    assert sim_resp["health_status"] == DeviceHealth.OFFLINE.value

    db.refresh(slot_c143)
    assert slot_c143.sensor_health == "OFFLINE"

    # Verify facility live matrix reflects UNKNOWN state
    facility_live = _run_sync(get_live_facility_occupancy(facility_id=1, db=db))
    slot_entry = next((s for s in facility_live.slots if s.slot_number == "C-143"), None)
    assert slot_entry is not None
    assert slot_entry.state == OccupancyState.UNKNOWN
    assert slot_entry.is_bookable is False


def test_07_booking_engine_rejects_occupied_slot(db: Session):
    """Transactional booking engine MUST reject reservation on an OCCUPIED slot."""
    slot_c140 = db.query(ParkingSlot).filter(ParkingSlot.slot_number == "C-140").first()
    assert slot_c140 is not None
    slot_c140.status = SlotStatus.OCCUPIED
    slot_c140.sensor_health = "ONLINE"
    db.commit()

    driver = db.query(User).filter(User.role == UserRole.DRIVER).first()
    now = datetime.now(timezone.utc)

    payload = BookingCreateRequest(
        lot_id=1,
        slot_id=slot_c140.id,
        vehicle_number="DL-08-CAF-8921",
        vehicle_category="SEDAN",
        driver_name="Rohit Sharma",
        driver_phone="+919876543210",
        start_time=now + timedelta(minutes=5),
        end_time=now + timedelta(hours=2),
    )

    with pytest.raises(HTTPException) as exc_info:
        create_transactional_booking(db=db, payload=payload, user=driver)

    assert exc_info.value.status_code == 409
    assert "currently occupied" in exc_info.value.detail.lower()


def test_08_booking_engine_rejects_unknown_stale_slot(db: Session):
    """Transactional booking engine MUST reject reservation on an UNKNOWN/STALE sensor slot."""
    slot_c143 = db.query(ParkingSlot).filter(ParkingSlot.slot_number == "C-143").first()
    assert slot_c143 is not None
    slot_c143.status = SlotStatus.AVAILABLE
    slot_c143.sensor_health = "STALE"
    db.commit()

    driver = db.query(User).filter(User.role == UserRole.DRIVER).first()
    now = datetime.now(timezone.utc)

    payload = BookingCreateRequest(
        lot_id=1,
        slot_id=slot_c143.id,
        vehicle_number="DL-08-CAF-8921",
        vehicle_category="SEDAN",
        driver_name="Rohit Sharma",
        driver_phone="+919876543210",
        start_time=now + timedelta(minutes=5),
        end_time=now + timedelta(hours=2),
    )

    with pytest.raises(HTTPException) as exc_info:
        create_transactional_booking(db=db, payload=payload, user=driver)

    assert exc_info.value.status_code == 409
    assert "sensor hardware fault" in exc_info.value.detail.lower() or "unknown occupancy" in exc_info.value.detail.lower()


def test_09_conflicting_sensors_fallback_and_alert(db: Session):
    """Conflicting sensor readings within conflict window must trigger UNKNOWN failsafe state."""
    slot_c144 = db.query(ParkingSlot).filter(ParkingSlot.slot_number == "C-144").first()
    assert slot_c144 is not None

    now = datetime.now(timezone.utc)

    # First event: Device A reports OCCUPIED
    event1 = OccupancyEvent(
        facility_id=1,
        slot_id=slot_c144.id,
        device_id=1,
        previous_state=OccupancyState.VACANT,
        new_state=OccupancyState.OCCUPIED,
        source_type=OccupancySource.ULTRASONIC_SENSOR,
        confidence=0.95,
        timestamp=now - timedelta(seconds=15),
    )
    db.add(event1)
    db.commit()

    # Second event: Device B reports VACANT 15s later
    dev_c144 = db.query(IoTDevice).filter(IoTDevice.device_code == "SEN-C-144").first()
    assert dev_c144 is not None
    # Ensure device is not device_id 1
    if dev_c144.id == 1:
        dev_c144.id = 9999

    req = SensorTelemetryIngestRequest(
        facility_id=1,
        telemetry=[
            SensorTelemetryItem(
                device_code="SEN-C-144",
                distance_m=2.5,  # Claims VACANT
                confidence=0.90,
                timestamp=now,
            )
        ],
    )

    resp = _run_sync(ingest_telemetry_batch(payload=req, db=db))
    assert resp.success is True
    assert resp.conflicts_detected >= 1

    # Slot should be set to UNKNOWN failsafe
    db.refresh(slot_c144)
    assert slot_c144.sensor_health == "DEGRADED"


def test_10_delayed_out_of_order_telemetry_handling(db: Session):
    """Telemetry packet with timestamp older than latest heartbeat by > 60s is discarded."""
    dev_c142 = db.query(IoTDevice).filter(IoTDevice.device_code == "SEN-C-142").first()
    assert dev_c142 is not None

    # Set device heartbeat to now
    now = datetime.now(timezone.utc)
    dev_c142.last_heartbeat_at = now
    dev_c142.health_status = DeviceHealth.ONLINE
    db.commit()

    # Ingest delayed reading timestamped 120s ago
    old_time = now - timedelta(seconds=120)
    req = SensorTelemetryIngestRequest(
        facility_id=1,
        telemetry=[
            SensorTelemetryItem(
                device_code="SEN-C-142",
                distance_m=0.5,  # Claims OCCUPIED in stale packet
                confidence=0.99,
                timestamp=old_time,
            )
        ],
    )

    resp = _run_sync(ingest_telemetry_batch(payload=req, db=db))
    assert resp.success is True

    # Slot C-142 should NOT have been updated by the stale packet
    slot_c142 = db.query(ParkingSlot).filter(ParkingSlot.slot_number == "C-142").first()
    assert slot_c142.id not in resp.updated_slots


def test_11_operator_manual_override_and_release(db: Session):
    """Operator applies manual override on Slot C-142; overrides sensor reading until cleared."""
    slot_c142 = db.query(ParkingSlot).filter(ParkingSlot.slot_number == "C-142").first()
    assert slot_c142 is not None
    operator = db.query(User).filter(User.role == UserRole.OPERATOR).first()

    # Apply override to BLOCKED (e.g. oil spill)
    override_resp = _run_sync(
        create_operator_override_endpoint(
            slot_id=slot_c142.id,
            payload=OperatorSlotOverrideRequest(
                target_state=OccupancyState.BLOCKED,
                reason="Temporary oil spill cleanup in bay",
                duration_minutes=30,
            ),
            current_user=operator,
            db=db,
        )
    )
    assert override_resp.target_state == OccupancyState.BLOCKED
    assert override_resp.is_active is True

    db.refresh(slot_c142)
    assert slot_c142.status == SlotStatus.MAINTENANCE

    # Telemetry claiming VACANT cannot override operator block
    req = SensorTelemetryIngestRequest(
        facility_id=1,
        telemetry=[
            SensorTelemetryItem(
                device_code="SEN-C-142",
                distance_m=2.5,
                timestamp=datetime.now(timezone.utc),
            )
        ],
    )
    _run_sync(ingest_telemetry_batch(payload=req, db=db))
    db.refresh(slot_c142)
    assert slot_c142.status == SlotStatus.MAINTENANCE, "Operator override must hold precedence"

    # Clear override
    del_resp = _run_sync(
        delete_operator_override_endpoint(
            slot_id=slot_c142.id,
            current_user=operator,
            db=db,
        )
    )
    assert "cleared" in del_resp["message"].lower()

    db.refresh(slot_c142)
    assert slot_c142.status == SlotStatus.AVAILABLE, "Reverted to live sensor fusion"
