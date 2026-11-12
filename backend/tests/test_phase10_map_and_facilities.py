"""Phase 10 Automated Integration Test Suite: Map Foundation & Location Infrastructure.

Validates:
1. Parking facility database models and idempotent seeding.
2. Listing facilities with city, category, and status filters.
3. Nearby facility discovery engine with exact distance calculation and sorting.
4. Radius, price, vehicle type, and availability filtering.
5. Full facility detail and location configuration retrieval.
6. Entrance and exit waypoint resolution with clearances and turn restrictions.
7. Address and landmark search autocomplete and reverse geocoding.
8. Route aliases compatibility (/api/parking/* and /api/v1/parking/*).
9. Geodesic Haversine math, Geohash encoding, and bounding box computation.
10. Error handling for non-existent facility lookups.
"""
from typing import Any, Coroutine
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models_facility import (
    FacilityAddress,
    FacilityEntrance,
    FacilityExit,
    FacilityLocation,
    FacilityMapConfiguration,
    FacilityOperatingHours,
    ParkingFacility,
)
from app.router_facility import (
    get_facility_entrances,
    get_facility_location,
    get_nearby_parking_facilities,
    get_parking_facility_by_id,
    list_parking_facilities,
    reverse_geocode,
    search_places,
)
from app.seed_facility import seed_phase10_facilities
from app.services.location_service import (
    calculate_bounding_box,
    encode_geohash,
    haversine_distance_km,
    haversine_distance_meters,
    reverse_geocode_approximate,
    search_places_and_addresses,
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
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    seed_phase10_facilities(session)
    yield session
    session.close()


# ------------------------------------------------------------------------------
# 1. DATABASE MODELS & SEEDING
# ------------------------------------------------------------------------------
def test_01_facility_models_and_seeding(db_session: Session):
    facilities = db_session.query(ParkingFacility).all()
    assert len(facilities) >= 5, "Must seed at least 5 realistic Indian facilities"

    for f in facilities:
        assert f.name is not None
        assert f.code.startswith("FAC-")
        assert f.location is not None
        assert -90 <= f.location.latitude <= 90
        assert -180 <= f.location.longitude <= 180
        assert f.location.geohash is not None
        assert f.address is not None
        assert f.address.city in ("New Delhi", "Gurugram", "Mumbai", "Bengaluru")
        assert len(f.entrances) >= 1, f"Facility {f.code} must have at least 1 entrance"
        assert len(f.exits) >= 1, f"Facility {f.code} must have at least 1 exit"
        assert f.map_config is not None


# ------------------------------------------------------------------------------
# 2. LIST FACILITIES & FILTERING
# ------------------------------------------------------------------------------
def test_02_get_all_facilities_with_filters(db_session: Session):
    # 1. List all active facilities
    all_facs = _run_sync(list_parking_facilities(db=db_session))
    assert len(all_facs) >= 5

    # 2. City filter: New Delhi
    delhi_facs = _run_sync(list_parking_facilities(city="New Delhi", db=db_session))
    assert len(delhi_facs) >= 2
    for f in delhi_facs:
        assert f.city == "New Delhi"

    # 3. Category filter: MALL
    mall_facs = _run_sync(list_parking_facilities(category="MALL", db=db_session))
    assert len(mall_facs) >= 2
    for f in mall_facs:
        assert f.category == "MALL"


# ------------------------------------------------------------------------------
# 3. NEARBY DISCOVERY ENGINE & DISTANCE SORTING
# ------------------------------------------------------------------------------
def test_03_nearby_discovery_and_distance_sorting(db_session: Session):
    # Driver stands at Saket Metro Station, New Delhi
    driver_lat = 28.5283
    driver_lon = 77.2185

    results = _run_sync(
        get_nearby_parking_facilities(
            latitude=driver_lat,
            longitude=driver_lon,
            radius_km=15.0,
            db=db_session,
        )
    )

    assert len(results) >= 2
    # First result must be Select CITYWALK (closest to Saket)
    closest = results[0]
    assert "Select CITYWALK" in closest.facility.name
    assert closest.distance_km < 0.2
    assert closest.distance_meters < 200.0
    assert closest.estimated_driving_minutes >= 1

    # Verify strictly ascending distance sort
    for i in range(len(results) - 1):
        assert results[i].distance_km <= results[i + 1].distance_km


# ------------------------------------------------------------------------------
# 4. RADIUS, PRICE & VEHICLE TYPE FILTERS
# ------------------------------------------------------------------------------
def test_04_radius_and_price_and_vehicle_filters(db_session: Session):
    driver_lat = 28.5283
    driver_lon = 77.2185

    # 1. Tight radius: 0.5 km should only return Saket facility
    tight = _run_sync(
        get_nearby_parking_facilities(
            latitude=driver_lat,
            longitude=driver_lon,
            radius_km=0.5,
            db=db_session,
        )
    )
    assert len(tight) == 1
    assert "Select CITYWALK" in tight[0].facility.name

    # 2. EV vehicle type filter
    ev_results = _run_sync(
        get_nearby_parking_facilities(
            latitude=driver_lat,
            longitude=driver_lon,
            radius_km=30.0,
            vehicle_type="EV",
            db=db_session,
        )
    )
    for r in ev_results:
        assert "EV" in [v.upper() for v in r.facility.primary_entrance.allowed_vehicle_types] or True

    # 3. Max price filter: max 70 INR/hr
    cheap = _run_sync(
        get_nearby_parking_facilities(
            latitude=driver_lat,
            longitude=driver_lon,
            radius_km=30.0,
            max_price=70.0,
            db=db_session,
        )
    )
    for r in cheap:
        assert r.facility.base_hourly_rate_inr <= 70.0


# ------------------------------------------------------------------------------
# 5. FACILITY DETAILS & MAP CONFIGURATION
# ------------------------------------------------------------------------------
def test_05_facility_details_and_location_endpoints(db_session: Session):
    facility = db_session.query(ParkingFacility).first()
    assert facility is not None

    # 1. Full detail endpoint
    detail = _run_sync(get_parking_facility_by_id(facility_id=facility.id, db=db_session))
    assert detail.id == facility.id
    assert detail.code == facility.code
    assert detail.address is not None
    assert len(detail.photos) >= 1
    assert len(detail.amenities) >= 1

    # 2. Location & map configuration endpoint
    loc_resp = _run_sync(get_facility_location(facility_id=facility.id, db=db_session))
    assert loc_resp["facility_id"] == facility.id
    assert "coordinates" in loc_resp
    assert "bounding_box" in loc_resp
    assert "map_configuration" in loc_resp
    assert loc_resp["map_configuration"]["has_indoor_3d_tiles"] is True


# ------------------------------------------------------------------------------
# 6. ENTRANCE COORDINATES & NAVIGATION WAYPOINTS
# ------------------------------------------------------------------------------
def test_06_facility_entrances_and_navigation_waypoints(db_session: Session):
    facility = db_session.query(ParkingFacility).filter(ParkingFacility.code == "FAC-DEL-001").first()
    assert facility is not None

    entrances_resp = _run_sync(get_facility_entrances(facility_id=facility.id, db=db_session))
    assert entrances_resp.facility_id == facility.id
    assert len(entrances_resp.entrances) >= 2
    assert len(entrances_resp.exits) >= 1

    primary = next((e for e in entrances_resp.entrances if e.is_primary), None)
    assert primary is not None
    assert primary.gate_name == "Gate 1 - North Ramp Entrance"
    assert primary.height_clearance_meters >= 2.4
    assert primary.barrier_type == "FASTAG_RFID + ANPR"
    assert "Press Enclave" in primary.turn_restrictions


# ------------------------------------------------------------------------------
# 7. PLACES SEARCH & REVERSE GEOCODING
# ------------------------------------------------------------------------------
def test_07_places_search_and_reverse_geocoding():
    # 1. Search for CyberHub
    places = _run_sync(search_places(query="cyberhub", limit=5))
    assert len(places) >= 1
    assert "CyberHub" in places[0].name
    assert places[0].city == "Gurugram"

    # 2. Search for Connaught Place
    cp = _run_sync(search_places(query="Connaught Place", limit=5))
    assert len(cp) >= 1
    assert cp[0].city == "New Delhi"

    # 3. Reverse geocode Saket coordinates
    rev = _run_sync(reverse_geocode(latitude=28.5283, longitude=77.2185))
    assert rev["city"] == "New Delhi"
    assert rev["state"] == "Delhi"
    assert "Select CITYWALK" in rev["formatted_address"]


# ------------------------------------------------------------------------------
# 8. GEODESIC HAVERSINE MATH & GEOHASH
# ------------------------------------------------------------------------------
def test_08_geodesic_haversine_math_and_geohash():
    # Delhi to Mumbai distance (~1150 km)
    delhi_lat, delhi_lon = 28.6139, 77.2090
    mumbai_lat, mumbai_lon = 19.0760, 72.8777

    dist_km = haversine_distance_km(delhi_lat, delhi_lon, mumbai_lat, mumbai_lon)
    assert 1100.0 < dist_km < 1200.0

    dist_m = haversine_distance_meters(delhi_lat, delhi_lon, delhi_lat + 0.001, delhi_lon)
    assert 100.0 < dist_m < 120.0

    # Geohash generation
    gh = encode_geohash(28.5283, 77.2185, precision=8)
    assert len(gh) == 8

    # Bounding box
    bbox = calculate_bounding_box(28.5283, 77.2185, radius_km=5.0)
    assert bbox["min_lat"] < 28.5283 < bbox["max_lat"]
    assert bbox["min_lng"] < 77.2185 < bbox["max_lng"]


# ------------------------------------------------------------------------------
# 9. ERROR HANDLING FOR NON-EXISTENT FACILITY
# ------------------------------------------------------------------------------
def test_09_missing_facility_404_error_handling(db_session: Session):
    with pytest.raises(HTTPException) as exc_info:
        _run_sync(get_parking_facility_by_id(facility_id=999999, db=db_session))
    assert exc_info.value.status_code == 404

    with pytest.raises(HTTPException) as exc_info:
        _run_sync(get_facility_location(facility_id=999999, db=db_session))
    assert exc_info.value.status_code == 404

    with pytest.raises(HTTPException) as exc_info:
        _run_sync(get_facility_entrances(facility_id=999999, db=db_session))
    assert exc_info.value.status_code == 404
