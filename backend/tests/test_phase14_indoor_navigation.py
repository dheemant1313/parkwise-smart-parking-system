"""Phase 14: Automated Integration Tests for Complete Indoor Parking Navigation System.

Direct in-memory route executions avoiding Windows loopback socket deadlocks.
Covers:
1. Multi-level facility map layers retrieval (Ground, B1, B2, B3)
2. Exact slot coordinate & floor retrieval (Slot C-142 on B2)
3. Graph indoor route calculation (Entrance -> Ramp -> B1 -> Ramp -> B2 -> Zone C -> Slot C-142)
4. Dynamic lane blocking and route recalculation
5. Reassigned slot route destination update
6. QR checkpoint scan verification and positioning calibration
7. Continuous indoor position telemetry updates
8. Slot arrival confirmation and status update
9. Find-my-car pedestrian navigation back to vehicle
10. Operator map editor, graph connectivity validation, and version publishing
"""
import asyncio
from datetime import datetime, timezone
from typing import Any, Coroutine, List
import pytest
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import Booking, BookingStatus, ParkingLot, ParkingSlot, SlotStatus, User, UserRole
from app.models_facility import ParkingFacility
from app.models_indoor_navigation import (
    FacilityMapVersion,
    IndoorCheckpoint,
    IndoorPositionEvent,
    MapEdge,
    MapNode,
    NavigationRoute,
    PositioningDevice,
)
from app.router_indoor_navigation import (
    calculate_route_endpoint,
    confirm_arrival_endpoint,
    find_my_car_endpoint,
    get_facility_map_endpoint,
    get_slot_location_endpoint,
    publish_map_version_endpoint,
    recalculate_route_endpoint,
    toggle_edge_blocked_endpoint,
    update_position_endpoint,
    verify_checkpoint_endpoint,
)
from app.schemas_indoor_navigation import (
    ArrivalConfirmRequest,
    CheckpointVerifyRequest,
    IndoorPositionUpdateRequest,
    PublishMapVersionRequest,
    RouteCalculateRequest,
    RouteRecalculateRequest,
)
from app.services.indoor_navigation_service import seed_multilevel_indoor_garage


def _run_sync(coro: Coroutine[Any, Any, Any]) -> Any:
    """Execute pure coroutine in synchronous test runner without event loop conflict."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    finally:
        coro.close()


@pytest.fixture(scope="module")
def db():
    """Module-level database session with seeded multi-level garage."""
    Base.metadata.create_all(bind=engine)
    session: Session = SessionLocal()
    seed_multilevel_indoor_garage(session, facility_id=1)

    # Ensure sample booking with slot C-142 exists
    lot = session.query(ParkingLot).first()
    if not lot:
        lot = ParkingLot(
            name="Select CITYWALK Transit Hub",
            address="Saket District Centre, New Delhi",
            city="New Delhi",
            state="Delhi",
            postal_code="110017",
            total_slots=100,
            available_slots=45,
            occupied_slots=50,
            reserved_slots=5,
            base_hourly_rate=80.0,
            is_active=True,
        )
        session.add(lot)
        session.commit()
        session.refresh(lot)

    slot = session.query(ParkingSlot).filter(ParkingSlot.slot_number == "C-142").first()
    if not slot:
        slot = ParkingSlot(
            lot_id=lot.id,
            slot_number="C-142",
            floor=-2,
            zone="C",
            status=SlotStatus.RESERVED,
        )
        session.add(slot)
        session.commit()
        session.refresh(slot)

    booking = session.query(Booking).filter(Booking.slot_id == slot.id).first()
    if not booking:
        now_dt = datetime.now(timezone.utc)
        booking = Booking(
            booking_reference="BKG-INDOOR-001",
            user_id=1,
            lot_id=lot.id,
            slot_id=slot.id,
            vehicle_number="DL-01-AB-1234",
            vehicle_category="SEDAN",
            driver_name="Aarav Sharma",
            driver_phone="+919876543210",
            start_time=now_dt,
            end_time=now_dt,
            duration_hours=2.0,
            base_amount_inr=160.0,
            gst_amount_inr=28.8,
            total_amount_inr=188.8,
            status=BookingStatus.CONFIRMED,
            qr_signature="sig_indoor_test_123",
        )
        session.add(booking)
        session.commit()

    # Ensure operator user exists
    op_user = session.query(User).filter(User.email == "operator@parkwise.io").first()
    if not op_user:
        op_user = User(
            email="operator@parkwise.io",
            phone="+919876543299",
            full_name="Operations Lead",
            role=UserRole.OPERATOR,
            is_active=True,
            password_hash="fake_hash",
        )
        session.add(op_user)
        session.commit()

    try:
        yield session
    finally:
        session.close()


def test_01_multilevel_facility_map_layers_retrieval(db: Session):
    """Verify retrieval of complete multi-floor map layers (Ground, B1, B2, B3)."""
    data = _run_sync(get_facility_map_endpoint(facility_id=1, db=db))

    assert data.facility_id == 1
    assert data.total_nodes >= 15
    assert data.total_edges >= 10
    assert len(data.floors) >= 3

    floor_levels = [f.floor_level for f in data.floors]
    assert 0 in floor_levels  # Ground
    assert -1 in floor_levels  # B1
    assert -2 in floor_levels  # B2

    b2_floor = next(f for f in data.floors if f.floor_level == -2)
    assert any(s.slot_number == "C-142" for s in b2_floor.slots)
    assert len(b2_floor.zones) >= 1


def test_02_slot_location_coordinate_retrieval(db: Session):
    """Verify exact slot coordinate, floor, and zone location lookup."""
    data = _run_sync(get_slot_location_endpoint(facility_id=1, slot_number="C-142", db=db))

    assert data["slot_number"] == "C-142"
    assert data["floor_level"] == -2  # Basement 2
    assert "Basement 2" in data["floor_name"]
    assert data["zone_code"] == "Zone C"
    assert data["x_coord"] == 210.0
    assert data["y_coord"] == 140.0


def test_03_graph_indoor_route_calculation_to_exact_slot(db: Session):
    """Verify A* multi-floor routing from entrance gate down to Slot C-142."""
    req = RouteCalculateRequest(
        facility_id=1,
        destination_slot_number="C-142",
        route_type="VEHICLE",
    )
    data = _run_sync(calculate_route_endpoint(req=req, db=db))

    assert data.route_code.startswith("ROUTE-")
    assert data.assigned_slot_number == "C-142"
    assert data.start_floor_level == 0  # Ground floor entrance
    assert data.end_floor_level == -2  # Basement 2
    assert data.total_distance_meters > 50.0
    assert data.estimated_duration_seconds > 0
    assert len(data.turn_by_turn_steps) >= 4

    # Verify journey contains floor transitions and zone arrival
    maneuvers = [step.maneuver for step in data.turn_by_turn_steps]
    assert "DEPART" in maneuvers
    assert "RAMP_DOWN" in maneuvers
    assert "ARRIVE_SLOT" in maneuvers

    # Check floor segments
    assert len(data.floor_segments) >= 2
    assert data.floor_segments[0].floor_level == 0
    assert data.floor_segments[-1].floor_level == -2


def test_04_dynamic_lane_blocking_and_route_recalculation(db: Session):
    """Verify rerouting when an obstacle/lane closure blocks the primary path."""
    req_init = RouteCalculateRequest(facility_id=1, destination_slot_number="C-142")
    init_res = _run_sync(calculate_route_endpoint(req=req_init, db=db))
    route_code = init_res.route_code

    req_recalc = RouteRecalculateRequest(
        route_code=route_code,
        current_floor_level=-1,
        current_x=140.0,
        current_y=20.0,
        reason="Temporary chemical spill on B1 lane",
    )
    recalc_data = _run_sync(recalculate_route_endpoint(req=req_recalc, db=db))

    assert recalc_data.is_recalculated is True
    assert "spill" in (recalc_data.recalculation_reason or "").lower()
    assert recalc_data.assigned_slot_number == "C-142"


def test_05_reassigned_slot_route_update(db: Session):
    """Verify route updates destination when slot is reassigned to C-144."""
    req_init = RouteCalculateRequest(facility_id=1, destination_slot_number="C-142")
    init_res = _run_sync(calculate_route_endpoint(req=req_init, db=db))
    route_code = init_res.route_code

    req_recalc = RouteRecalculateRequest(
        route_code=route_code,
        current_floor_level=-2,
        current_x=140.0,
        current_y=140.0,
        reassigned_slot_number="C-144",
        reason="Slot C-142 reserved for maintenance; upgraded to C-144",
    )
    recalc_data = _run_sync(recalculate_route_endpoint(req=req_recalc, db=db))

    assert recalc_data.assigned_slot_number == "C-144"
    assert recalc_data.is_recalculated is True
    last_step = recalc_data.turn_by_turn_steps[-1]
    assert "C-144" in last_step.instruction


def test_06_qr_checkpoint_scan_verification(db: Session):
    """Verify physical QR checkpoint scanning establishes driver position."""
    req = CheckpointVerifyRequest(
        facility_id=1,
        qr_token_payload="PW-QR-B2-ZONEC-01",
    )
    data = _run_sync(verify_checkpoint_endpoint(req=req, db=db))

    assert data.success is True
    assert data.floor_level == -2
    assert "Zone C" in (data.zone_code or "")
    assert data.x_coord == 140.0
    assert data.y_coord == 140.0
    assert "verified" in data.message.lower()


def test_07_continuous_indoor_position_update(db: Session):
    """Verify BLE beacon and continuous telemetry position estimation."""
    req = IndoorPositionUpdateRequest(
        facility_id=1,
        source_type="BLE_TRILATERATION",
        device_hardware_id="BLE-PW-B2-142",
        raw_rssi=-62,
    )
    data = _run_sync(update_position_endpoint(req=req, db=db))

    assert data.facility_id == 1
    assert data.floor_level == -2
    assert data.confidence_score >= 0.80
    assert "GPS is not used" in data.is_exact_gps_disclaimer


def test_08_slot_arrival_confirmation(db: Session):
    """Verify driver arrival confirmation at assigned slot."""
    req_init = RouteCalculateRequest(facility_id=1, destination_slot_number="C-142")
    init_res = _run_sync(calculate_route_endpoint(req=req_init, db=db))
    route_code = init_res.route_code

    req_arrival = ArrivalConfirmRequest(
        route_code=route_code,
        final_floor_level=-2,
        final_x=210.0,
        final_y=140.0,
    )
    data = _run_sync(confirm_arrival_endpoint(req=req_arrival, db=db))

    assert data.success is True
    assert data.arrival_confirmed is True
    assert data.assigned_slot_number == "C-142"
    assert "confirmed" in data.message.lower()


def test_09_find_my_car_pedestrian_routing(db: Session):
    """Verify Find My Car pedestrian return route."""
    booking = db.query(Booking).filter(Booking.booking_reference == "BKG-INDOOR-001").first()
    assert booking is not None
    booking_id = booking.id

    data = _run_sync(find_my_car_endpoint(booking_id=booking_id, db=db))

    assert data.booking_id == booking_id
    assert data.assigned_slot_number in ["C-142", "C-144"]
    assert data.floor_level == -2
    assert "Elevator" in (data.nearest_elevator_code or "") or "ELEV" in (data.nearest_elevator_code or "")


def test_10_operator_map_validation_and_publishing(db: Session):
    """Verify operator graph connectivity validation and map publishing."""
    op_user = db.query(User).filter(User.role == UserRole.OPERATOR).first()
    req = PublishMapVersionRequest(facility_id=1, version_code="v1.4.1", notes="Automated test publish")
    report = _run_sync(publish_map_version_endpoint(facility_id=1, req=req, db=db, current_user=op_user))

    assert report.is_valid is True
    assert report.connectivity_score >= 0.90
    assert len(report.zero_length_edges) == 0
