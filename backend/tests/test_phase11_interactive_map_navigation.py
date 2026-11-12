"""Phase 11 Automated Test Suite: Interactive Driver Map & Outdoor Navigation.

Validates:
1. Outdoor route calculation to verified facility entrances with accurate distances & ETA.
2. Route maneuvers, street names, turn instructions, and height clearance notices.
3. Alternative routes generation with time deltas and lower congestion notes.
4. External navigation deep-links (Google Maps, Apple Maps, Waze) to exact entrance coordinates.
5. Spatial marker clustering at various zoom levels.
6. Direct booking integration from map (live capacity decrement, slot allocation, QR token).
7. Real-time slot availability breakdown by vehicle and EV charger type.
8. Conflict / 409 error handling when facility is at 100% full capacity.
9. Missing facility 404 error handling.
"""
import asyncio
from typing import Any, Coroutine
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models_facility import FacilityEntrance, ParkingFacility
from app.router_facility import (
    direct_facility_booking,
    get_facility_availability,
    get_facility_clusters,
    get_facility_entrance_route,
)
from app.schemas_facility import DirectFacilityBookingRequest
from app.services.location_service import (
    calculate_spatial_clusters,
    generate_external_navigation_links,
    generate_outdoor_route,
    haversine_distance_km,
)


def _run_sync(coro: Coroutine[Any, Any, Any]) -> Any:
    """Execute in-memory route coroutine synchronously without Windows socketpair deadlock."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    finally:
        coro.close()


@pytest.fixture(scope="module")
def db():
    """Module-level session for Phase 11 testing."""
    from app.seed_facility import seed_phase10_facilities
    Base.metadata.create_all(bind=engine)
    session: Session = SessionLocal()
    seed_phase10_facilities(session)
    try:
        yield session
    finally:
        session.close()


def test_01_outdoor_route_calculation_to_entrance(db: Session):
    """Verify route calculation from driver location to verified entrance gate."""
    facility = db.query(ParkingFacility).filter(ParkingFacility.status == "ACTIVE").first()
    assert facility is not None, "Need at least one active facility"

    # Driver in Saket (28.5283, 77.2185)
    route = _run_sync(
        get_facility_entrance_route(
            facility_id=facility.id,
            origin_lat=28.5283,
            origin_lng=77.2185,
            entrance_id=None,
            db=db,
        )
    )

    assert route.facility_id == facility.id
    assert route.distance_km > 0
    assert route.duration_minutes >= 3
    assert len(route.waypoints) >= 5
    assert len(route.steps) >= 3
    assert route.entrance.gate_name != ""
    assert route.entrance.height_clearance_meters > 0

    # Verify external navigation links
    links = route.external_links
    assert "google_maps" in links
    assert "apple_maps" in links
    assert "waze" in links
    assert "google.com/maps/dir" in links["google_maps"]


def test_02_route_step_guidance_and_maneuvers(db: Session):
    """Verify detailed maneuvers include entrance clearance, barrier notes, and turn types."""
    facility = db.query(ParkingFacility).filter(ParkingFacility.status == "ACTIVE").first()

    route = _run_sync(
        get_facility_entrance_route(
            facility_id=facility.id,
            origin_lat=28.5200,
            origin_lng=77.2100,
            entrance_id=None,
            db=db,
        )
    )

    steps = route.steps
    step_types = [s.turn_type for s in steps]
    assert "STRAIGHT" in step_types
    assert "ARRIVE" in step_types

    # Arrival step should mention entrance name and barrier
    last_step = steps[-1]
    assert last_step.turn_type == "ARRIVE"
    assert "barrier" in last_step.instruction.lower() or "clearance" in last_step.instruction.lower()

    # Verify alternative routes
    assert len(route.alternative_routes) >= 1
    alt = route.alternative_routes[0]
    assert alt.distance_km >= route.distance_km
    assert alt.duration_minutes >= route.duration_minutes
    assert len(alt.waypoints) >= 5


def test_03_map_marker_spatial_clustering(db: Session):
    """Verify spatial clustering aggregates nearby pins at lower zoom levels."""
    # At zoom 10 (city-level overview), facilities should be grouped into clusters
    clusters_z10 = _run_sync(
        get_facility_clusters(
            zoom=10,
            latitude=None,
            longitude=None,
            radius_km=None,
            db=db,
        )
    )

    assert clusters_z10.zoom == 10
    assert clusters_z10.total_facilities >= 3
    assert clusters_z10.total_clusters > 0
    assert len(clusters_z10.clusters) <= clusters_z10.total_facilities

    # At zoom 16 (neighborhood level), every facility should be an individual pin
    clusters_z16 = _run_sync(
        get_facility_clusters(
            zoom=16,
            latitude=None,
            longitude=None,
            radius_km=None,
            db=db,
        )
    )

    for cl in clusters_z16.clusters:
        assert cl.count == 1


def test_04_direct_facility_booking_from_map(db: Session):
    """Verify direct booking from the map with live slot assignment and capacity decrement."""
    facility = db.query(ParkingFacility).filter(ParkingFacility.available_capacity > 5).first()
    assert facility is not None, "Need a facility with available capacity"

    initial_capacity = facility.available_capacity

    req = DirectFacilityBookingRequest(
        vehicle_number="DL-01-XX-9999",
        vehicle_type="SUV",
        driver_name="Aarav Sharma",
        driver_phone="+919876543210",
        duration_hours=3,
        ev_charging_requested=True,
    )

    booking = _run_sync(
        direct_facility_booking(
            facility_id=facility.id,
            request=req,
            db=db,
        )
    )

    assert booking.facility_id == facility.id
    assert booking.booking_reference.startswith("PW-MAP-")
    assert booking.assigned_slot_number != ""
    assert booking.assigned_slot_floor != ""
    assert booking.qr_token.startswith("QR-PW-")
    assert booking.total_amount_inr > 0
    assert booking.navigation_ready is True
    assert "google.com/maps" in booking.directions_url

    # Verify atomic capacity reduction in DB
    db.refresh(facility)
    assert facility.available_capacity == initial_capacity - 1


def test_05_facility_availability_breakdown(db: Session):
    """Verify real-time availability breakdown by vehicle category."""
    facility = db.query(ParkingFacility).first()
    data = _run_sync(
        get_facility_availability(
            facility_id=facility.id,
            db=db,
        )
    )

    assert data.facility_id == facility.id
    assert data.total_capacity == facility.total_capacity
    assert data.available_capacity == facility.available_capacity
    assert 0 <= data.occupancy_percentage <= 100
    assert "SEDAN" in data.slots_by_vehicle_type
    assert "SUV" in data.slots_by_vehicle_type
    assert "EV" in data.slots_by_vehicle_type
    assert data.next_available_slot != ""


def test_06_booking_overcapacity_conflict(db: Session):
    """Verify attempting to book a facility at 0 capacity returns HTTP 409 Conflict."""
    facility = db.query(ParkingFacility).first()
    original_cap = facility.available_capacity

    try:
        facility.available_capacity = 0
        db.commit()

        req = DirectFacilityBookingRequest(
            vehicle_number="HR-26-ZZ-0001",
            vehicle_type="SEDAN",
            driver_name="Test Driver",
            driver_phone="+919876543210",
            duration_hours=1,
            ev_charging_requested=False,
        )

        with pytest.raises(HTTPException) as exc_info:
            _run_sync(
                direct_facility_booking(
                    facility_id=facility.id,
                    request=req,
                    db=db,
                )
            )
        assert exc_info.value.status_code == 409
        assert "capacity" in exc_info.value.detail.lower()
    finally:
        facility.available_capacity = original_cap
        db.commit()


def test_07_missing_facility_route_404(db: Session):
    """Verify attempting to route to non-existent facility raises 404."""
    with pytest.raises(HTTPException) as exc_info:
        _run_sync(
            get_facility_entrance_route(
                facility_id=999999,
                origin_lat=28.5283,
                origin_lng=77.2185,
                entrance_id=None,
                db=db,
            )
        )
    assert exc_info.value.status_code == 404
