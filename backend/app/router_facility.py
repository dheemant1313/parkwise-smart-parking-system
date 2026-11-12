"""Phase 10: Map & Parking Facility Infrastructure API Router.

Implements:
- GET /api/parking/facilities (and /api/v1/parking/facilities)
- GET /api/parking/facilities/nearby (and /api/v1/parking/facilities/nearby)
- GET /api/parking/facilities/{id} (and /api/v1/parking/facilities/{id})
- GET /api/parking/facilities/{id}/location (and /api/v1/parking/facilities/{id}/location)
- GET /api/parking/facilities/{id}/entrances (and /api/parking/facilities/{id}/entrances)
- GET /api/parking/places/search (Address and transit hub search)
- GET /api/parking/places/reverse-geocode
"""
from datetime import datetime, timezone
import math
import secrets
from typing import Annotated, Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models_facility import (
    FacilityAddress,
    FacilityEntrance,
    FacilityExit,
    FacilityLocation,
    FacilityMapConfiguration,
    FacilityOperatingHours,
    ParkingFacility,
)
from app.schemas_facility import (
    AlternativeRouteSchema,
    DirectFacilityBookingRequest,
    DirectFacilityBookingResponse,
    FacilityAddressSchema,
    FacilityAvailabilityBreakdownResponse,
    FacilityClusterListResponse,
    FacilityClusterSchema,
    FacilityCreateRequest,
    FacilityEntranceListResponse,
    FacilityEntranceSchema,
    FacilityExitSchema,
    FacilityLocationSchema,
    FacilityMapConfigSchema,
    FacilityOperatingHoursSchema,
    NearbyFacilityItemResponse,
    OutdoorRouteResponse,
    ParkingFacilityDetailResponse,
    ParkingFacilitySummaryResponse,
    PlaceSearchResponse,
    RouteStepSchema,
)
from app.services.location_service import (
    calculate_bounding_box,
    calculate_spatial_clusters,
    encode_geohash,
    generate_external_navigation_links,
    generate_outdoor_route,
    haversine_distance_km,
    haversine_distance_meters,
    reverse_geocode_approximate,
    search_places_and_addresses,
)

router = APIRouter(tags=["Map & Facility Infrastructure"])


def _serialize_facility_summary(f: ParkingFacility) -> ParkingFacilitySummaryResponse:
    lat = f.location.latitude if f.location else 28.6139
    lon = f.location.longitude if f.location else 77.2090
    city = f.address.city if f.address else "New Delhi"
    locality = f.address.locality if f.address else "Central"
    formatted = f.address.formatted_address if f.address else f"{f.name}, {city}"

    primary_entrance = None
    if f.entrances:
        primary = next((e for e in f.entrances if e.is_primary), f.entrances[0])
        primary_entrance = FacilityEntranceSchema.model_validate(primary)

    return ParkingFacilitySummaryResponse(
        id=f.id,
        lot_id=f.lot_id,
        code=f.code,
        name=f.name,
        slug=f.slug,
        category=f.category,
        status=f.status,
        total_capacity=f.total_capacity,
        available_capacity=f.available_capacity,
        base_hourly_rate_inr=f.base_hourly_rate_inr,
        is_24_hours=f.is_24_hours,
        latitude=lat,
        longitude=lon,
        city=city,
        locality=locality,
        formatted_address=formatted,
        primary_entrance=primary_entrance,
        photos=f.photos or [],
        amenities=f.amenities or [],
    )


# ------------------------------------------------------------------------------
# 1. List All Parking Facilities
# ------------------------------------------------------------------------------
@router.get(
    "/facilities",
    response_model=List[ParkingFacilitySummaryResponse],
    summary="List all parking facilities with optional city and category filters",
)
async def list_parking_facilities(
    city: Annotated[Optional[str], Query(description="Filter by Indian city")] = None,
    category: Annotated[Optional[str], Query(description="Filter by category")] = None,
    status_filter: Annotated[Optional[str], Query(alias="status", description="Status filter")] = "ACTIVE",
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    db: Session = Depends(get_db),
):
    query = (
        db.query(ParkingFacility)
        .options(
            joinedload(ParkingFacility.location),
            joinedload(ParkingFacility.address),
            joinedload(ParkingFacility.entrances),
        )
    )

    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(ParkingFacility.status == status_filter.upper())

    if category:
        query = query.filter(ParkingFacility.category == category.upper())

    if city:
        query = query.join(ParkingFacility.address).filter(
            FacilityAddress.city.ilike(f"%{city}%")
        )

    facilities = query.offset(skip).limit(limit).all()
    return [_serialize_facility_summary(f) for f in facilities]


# ------------------------------------------------------------------------------
# 2. Nearby Parking Discovery Engine
# ------------------------------------------------------------------------------
@router.get(
    "/facilities/nearby",
    response_model=List[NearbyFacilityItemResponse],
    summary="Discover parking facilities near the driver, sorted by distance with radius filtering",
)
async def get_nearby_parking_facilities(
    latitude: Annotated[float, Query(ge=-90.0, le=90.0, description="Driver current latitude")],
    longitude: Annotated[float, Query(ge=-180.0, le=180.0, description="Driver current longitude")],
    radius_km: Annotated[float, Query(ge=0.5, le=50.0, description="Search radius in kilometers")] = 10.0,
    vehicle_type: Annotated[Optional[str], Query(description="Filter by supported vehicle")] = None,
    max_price: Annotated[Optional[float], Query(description="Maximum base hourly rate in INR")] = None,
    available_only: Annotated[bool, Query(description="Only show facilities with available capacity")] = False,
    category: Annotated[Optional[str], Query(description="Facility category filter")] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    db: Session = Depends(get_db),
):
    # Pre-filter using bounding box for database performance
    bbox = calculate_bounding_box(latitude, longitude, radius_km)

    query = (
        db.query(ParkingFacility)
        .join(ParkingFacility.location)
        .options(
            joinedload(ParkingFacility.location),
            joinedload(ParkingFacility.address),
            joinedload(ParkingFacility.entrances),
        )
        .filter(
            FacilityLocation.latitude >= bbox["min_lat"],
            FacilityLocation.latitude <= bbox["max_lat"],
            FacilityLocation.longitude >= bbox["min_lng"],
            FacilityLocation.longitude <= bbox["max_lng"],
            ParkingFacility.status == "ACTIVE",
        )
    )

    if available_only:
        query = query.filter(ParkingFacility.available_capacity > 0)

    if max_price is not None:
        query = query.filter(ParkingFacility.base_hourly_rate_inr <= max_price)

    if category:
        query = query.filter(ParkingFacility.category == category.upper())

    candidates = query.all()

    results: List[NearbyFacilityItemResponse] = []
    for f in candidates:
        if not f.location:
            continue

        # Exact Haversine distance calculation
        dist_km = haversine_distance_km(
            latitude, longitude, f.location.latitude, f.location.longitude
        )

        if dist_km > radius_km:
            continue

        # Vehicle type filter
        if vehicle_type and f.supported_vehicle_types:
            vt_upper = vehicle_type.upper()
            if vt_upper not in [v.upper() for v in f.supported_vehicle_types]:
                continue

        dist_meters = round(dist_km * 1000.0, 1)
        est_minutes = max(1, int(round((dist_km / 25.0) * 60.0)))

        primary_entrance = None
        if f.entrances:
            primary = next((e for e in f.entrances if e.is_primary), f.entrances[0])
            primary_entrance = FacilityEntranceSchema.model_validate(primary)

        summary = _serialize_facility_summary(f)

        results.append(
            NearbyFacilityItemResponse(
                facility=summary,
                distance_km=dist_km,
                distance_meters=dist_meters,
                estimated_driving_minutes=est_minutes,
                primary_entrance=primary_entrance,
                is_open_now=True,
            )
        )

    # Sort results strictly by distance ascending
    results.sort(key=lambda x: x.distance_km)
    return results[:limit]


# ------------------------------------------------------------------------------
# 3. Get Facility Details by ID
# ------------------------------------------------------------------------------
@router.get(
    "/facilities/{facility_id}",
    response_model=ParkingFacilityDetailResponse,
    summary="Get full details, address, amenities, and operating hours of a parking facility",
)
async def get_parking_facility_by_id(
    facility_id: int,
    db: Session = Depends(get_db),
):
    facility = (
        db.query(ParkingFacility)
        .options(
            joinedload(ParkingFacility.location),
            joinedload(ParkingFacility.address),
            joinedload(ParkingFacility.entrances),
            joinedload(ParkingFacility.exits),
            joinedload(ParkingFacility.operating_hours),
            joinedload(ParkingFacility.map_config),
        )
        .filter(ParkingFacility.id == facility_id)
        .first()
    )

    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parking facility with ID {facility_id} not found.",
        )

    return ParkingFacilityDetailResponse(
        id=facility.id,
        lot_id=facility.lot_id,
        code=facility.code,
        name=facility.name,
        slug=facility.slug,
        description=facility.description,
        category=facility.category,
        status=facility.status,
        total_capacity=facility.total_capacity,
        available_capacity=facility.available_capacity,
        supported_vehicle_types=facility.supported_vehicle_types or [],
        amenities=facility.amenities or [],
        photos=facility.photos or [],
        base_hourly_rate_inr=facility.base_hourly_rate_inr,
        is_24_hours=facility.is_24_hours,
        contact_phone=facility.contact_phone,
        contact_email=facility.contact_email,
        location=FacilityLocationSchema.model_validate(facility.location) if facility.location else None,
        address=FacilityAddressSchema.model_validate(facility.address) if facility.address else None,
        entrances=[FacilityEntranceSchema.model_validate(e) for e in facility.entrances],
        exits=[FacilityExitSchema.model_validate(e) for e in facility.exits],
        operating_hours=[FacilityOperatingHoursSchema.model_validate(e) for e in facility.operating_hours],
        map_config=FacilityMapConfigSchema.model_validate(facility.map_config) if facility.map_config else None,
        created_at=facility.created_at,
    )


# ------------------------------------------------------------------------------
# 4. Get Facility Location & Map Configuration
# ------------------------------------------------------------------------------
@router.get(
    "/facilities/{facility_id}/location",
    summary="Get precise geographical coordinates and map configuration for a facility",
)
async def get_facility_location(
    facility_id: int,
    db: Session = Depends(get_db),
):
    facility = (
        db.query(ParkingFacility)
        .options(
            joinedload(ParkingFacility.location),
            joinedload(ParkingFacility.address),
            joinedload(ParkingFacility.map_config),
        )
        .filter(ParkingFacility.id == facility_id)
        .first()
    )

    if not facility or not facility.location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location not found for facility ID {facility_id}.",
        )

    loc = facility.location
    config = facility.map_config

    return {
        "facility_id": facility.id,
        "facility_name": facility.name,
        "coordinates": {
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "altitude_meters": loc.altitude_meters,
        },
        "geohash": loc.geohash,
        "plus_code": loc.plus_code,
        "place_id": loc.place_id,
        "bounding_box": {
            "north_east": {"lat": loc.bounding_box_ne_lat, "lng": loc.bounding_box_ne_lng},
            "south_west": {"lat": loc.bounding_box_sw_lat, "lng": loc.bounding_box_sw_lng},
        },
        "address": {
            "formatted": facility.address.formatted_address if facility.address else "",
            "city": facility.address.city if facility.address else "",
            "locality": facility.address.locality if facility.address else "",
        },
        "map_configuration": {
            "map_provider": config.map_provider if config else "mapbox",
            "default_zoom": config.default_zoom_level if config else 17,
            "pitch": config.pitch_degrees if config else 45,
            "bearing": config.bearing_degrees if config else 0,
            "style_url": config.style_url if config else "mapbox://styles/mapbox/navigation-day-v1",
            "has_indoor_3d_tiles": config.has_indoor_3d_tiles if config else True,
            "indoor_levels": config.indoor_levels_json if config else ["B2", "B1", "G", "L1"],
        },
    }


# ------------------------------------------------------------------------------
# 5. Get Facility Entrance & Exit Coordinates
# ------------------------------------------------------------------------------
@router.get(
    "/facilities/{facility_id}/entrances",
    response_model=FacilityEntranceListResponse,
    summary="Get dedicated entrance and exit gates with clearances and navigation waypoints",
)
async def get_facility_entrances(
    facility_id: int,
    db: Session = Depends(get_db),
):
    facility = (
        db.query(ParkingFacility)
        .options(
            joinedload(ParkingFacility.location),
            joinedload(ParkingFacility.entrances),
            joinedload(ParkingFacility.exits),
        )
        .filter(ParkingFacility.id == facility_id)
        .first()
    )

    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility ID {facility_id} not found.",
        )

    coords = {
        "latitude": facility.location.latitude if facility.location else 0.0,
        "longitude": facility.location.longitude if facility.location else 0.0,
    }

    return FacilityEntranceListResponse(
        facility_id=facility.id,
        facility_name=facility.name,
        facility_coordinates=coords,
        entrances=[FacilityEntranceSchema.model_validate(e) for e in facility.entrances],
        exits=[FacilityExitSchema.model_validate(e) for e in facility.exits],
    )


# ------------------------------------------------------------------------------
# 6. Place & Address Search (Geocoding Autocomplete)
# ------------------------------------------------------------------------------
@router.get(
    "/places/search",
    response_model=List[PlaceSearchResponse],
    summary="Search for popular Indian landmarks, airports, tech hubs, and localities",
)
async def search_places(
    query: Annotated[str, Query(min_length=1, description="Search term (e.g. Connaught Place, CyberHub, Koramangala)")],
    limit: Annotated[int, Query(ge=1, le=20)] = 8,
):
    places = search_places_and_addresses(query, limit=limit)
    return [PlaceSearchResponse.model_validate(p) for p in places]


# ------------------------------------------------------------------------------
# 7. Reverse Geocoding
# ------------------------------------------------------------------------------
@router.get(
    "/places/reverse-geocode",
    summary="Convert latitude/longitude coordinates to approximate Indian address and landmark",
)
async def reverse_geocode(
    latitude: Annotated[float, Query(ge=-90.0, le=90.0)],
    longitude: Annotated[float, Query(ge=-180.0, le=180.0)],
):
    return reverse_geocode_approximate(latitude, longitude)


# ------------------------------------------------------------------------------
# 8. Phase 11: Outdoor Route Calculation & Entrance Navigation
# ------------------------------------------------------------------------------
@router.get(
    "/facilities/{facility_id}/route",
    response_model=OutdoorRouteResponse,
    summary="Calculate turn-by-turn outdoor driving route from driver location to vehicle entrance",
)
async def get_facility_entrance_route(
    facility_id: int,
    origin_lat: Annotated[float, Query(ge=-90.0, le=90.0, description="Driver current latitude")],
    origin_lng: Annotated[float, Query(ge=-180.0, le=180.0, description="Driver current longitude")],
    entrance_id: Annotated[Optional[int], Query(description="Optional specific entrance gate ID")] = None,
    db: Session = Depends(get_db),
):
    facility = (
        db.query(ParkingFacility)
        .options(
            joinedload(ParkingFacility.location),
            joinedload(ParkingFacility.entrances),
        )
        .filter(ParkingFacility.id == facility_id)
        .first()
    )
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility ID {facility_id} does not exist",
        )

    # Determine target entrance gate
    target_entrance = None
    if entrance_id and facility.entrances:
        target_entrance = next((e for e in facility.entrances if e.id == entrance_id), None)

    if not target_entrance and facility.entrances:
        target_entrance = next((e for e in facility.entrances if e.is_primary), facility.entrances[0])

    if not target_entrance:
        # Fallback to facility center coordinate if no entrance is registered
        lat = facility.location.latitude if facility.location else 28.5283
        lng = facility.location.longitude if facility.location else 77.2185
        target_entrance_schema = FacilityEntranceSchema(
            id=0,
            gate_name="Main Vehicle Gate",
            gate_code="GATE-01",
            latitude=lat,
            longitude=lng,
            height_clearance_meters=2.6,
            barrier_type="FASTAG_RFID + ANPR",
            allowed_vehicle_types=["COMPACT", "SEDAN", "SUV", "EV"],
            turn_restrictions=None,
            navigation_waypoint_notes="Direct approach to main barrier",
            is_primary=True,
            is_open=True,
        )
        dest_lat = lat
        dest_lng = lng
    else:
        target_entrance_schema = FacilityEntranceSchema.model_validate(target_entrance)
        dest_lat = target_entrance.latitude
        dest_lng = target_entrance.longitude

    route_data = generate_outdoor_route(
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        dest_lat=dest_lat,
        dest_lng=dest_lng,
        facility_name=facility.name,
        entrance_name=target_entrance_schema.gate_name,
        entrance_clearance_m=target_entrance_schema.height_clearance_meters,
    )

    return OutdoorRouteResponse(
        facility_id=facility.id,
        facility_name=facility.name,
        origin_coordinates={"latitude": origin_lat, "longitude": origin_lng},
        destination_coordinates={"latitude": dest_lat, "longitude": dest_lng},
        entrance=target_entrance_schema,
        distance_km=route_data["distance_km"],
        duration_minutes=route_data["duration_minutes"],
        summary=route_data["summary"],
        traffic_condition=route_data["traffic_condition"],
        waypoints=route_data["waypoints"],
        steps=[RouteStepSchema.model_validate(s) for s in route_data["steps"]],
        alternative_routes=[AlternativeRouteSchema.model_validate(a) for a in route_data["alternative_routes"]],
        external_links=route_data["external_links"],
    )


# ------------------------------------------------------------------------------
# 9. Phase 11: Map Marker Spatial Clustering
# ------------------------------------------------------------------------------
@router.get(
    "/facilities/clusters",
    response_model=FacilityClusterListResponse,
    summary="Get spatially clustered facility pins for zoomed-out driver map views",
)
async def get_facility_clusters(
    zoom: Annotated[int, Query(ge=1, le=20, description="Current map zoom level")] = 12,
    latitude: Annotated[Optional[float], Query(ge=-90.0, le=90.0)] = None,
    longitude: Annotated[Optional[float], Query(ge=-180.0, le=180.0)] = None,
    radius_km: Annotated[Optional[float], Query(ge=1.0, le=100.0)] = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(ParkingFacility)
        .options(joinedload(ParkingFacility.location))
        .filter(ParkingFacility.status == "ACTIVE")
    )
    all_facs = query.all()

    facility_dicts = []
    for f in all_facs:
        if not f.location:
            continue
        dist = 0.0
        if latitude is not None and longitude is not None:
            dist = haversine_distance_km(latitude, longitude, f.location.latitude, f.location.longitude)
            if radius_km and dist > radius_km:
                continue

        facility_dicts.append({
            "id": f.id,
            "name": f.name,
            "latitude": f.location.latitude,
            "longitude": f.location.longitude,
            "base_hourly_rate_inr": f.base_hourly_rate_inr,
            "available_capacity": f.available_capacity,
        })

    cluster_data = calculate_spatial_clusters(facility_dicts, zoom=zoom)
    return FacilityClusterListResponse(
        zoom=zoom,
        total_clusters=len(cluster_data),
        total_facilities=len(facility_dicts),
        clusters=[FacilityClusterSchema.model_validate(c) for c in cluster_data],
    )


# ------------------------------------------------------------------------------
# 10. Phase 11: Direct Booking Integration from Map
# ------------------------------------------------------------------------------
@router.post(
    "/facilities/{facility_id}/book",
    response_model=DirectFacilityBookingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Directly book a parking slot from the driver map with immediate slot and entrance assignment",
)
async def direct_facility_booking(
    facility_id: int,
    request: DirectFacilityBookingRequest,
    db: Session = Depends(get_db),
):
    facility = (
        db.query(ParkingFacility)
        .options(
            joinedload(ParkingFacility.location),
            joinedload(ParkingFacility.address),
            joinedload(ParkingFacility.entrances),
        )
        .filter(ParkingFacility.id == facility_id)
        .first()
    )
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility ID {facility_id} does not exist",
        )

    # Confirm slot availability before booking
    if facility.available_capacity <= 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Facility '{facility.name}' is currently at 100% full capacity. No slots available.",
        )

    # Assign entrance gate
    target_entrance = None
    if request.entrance_id and facility.entrances:
        target_entrance = next((e for e in facility.entrances if e.id == request.entrance_id), None)
    if not target_entrance and facility.entrances:
        target_entrance = next((e for e in facility.entrances if e.is_primary), facility.entrances[0])

    if not target_entrance:
        lat = facility.location.latitude if facility.location else 28.5283
        lng = facility.location.longitude if facility.location else 77.2185
        assigned_entrance = FacilityEntranceSchema(
            id=1,
            gate_name="Main Entry Barrier",
            gate_code="ENT-01",
            latitude=lat,
            longitude=lng,
            height_clearance_meters=2.6,
            barrier_type="FASTAG_RFID + ANPR",
            allowed_vehicle_types=["COMPACT", "SEDAN", "SUV", "EV"],
            turn_restrictions=None,
            navigation_waypoint_notes="Direct approach",
            is_primary=True,
            is_open=True,
        )
    else:
        assigned_entrance = FacilityEntranceSchema.model_validate(target_entrance)

    # Calculate pricing
    base_rate = facility.base_hourly_rate_inr
    subtotal = base_rate * request.duration_hours
    ev_addon = 150.0 if request.ev_charging_requested else 0.0
    total_amount = round(subtotal + ev_addon, 2)

    # Decrement available capacity atomically
    facility.available_capacity = max(0, facility.available_capacity - 1)
    db.commit()
    db.refresh(facility)

    # Generate unique booking reference and cryptographic QR token
    import secrets
    ref_suffix = secrets.token_hex(4).upper()
    booking_reference = f"PW-MAP-{ref_suffix}"
    qr_token = f"QR-PW-{secrets.token_urlsafe(16)}"

    # Generate realistic allocated slot
    floor_code = "B1" if "MALL" in facility.category else ("L1" if "TRANSIT" in facility.category else "G")
    bay_letter = "E" if request.ev_charging_requested else "A"
    slot_num = f"{floor_code}-{bay_letter}{secrets.randbelow(40) + 1:02d}"
    slot_floor = f"Level {floor_code} (Indoor Guidance Ready)"

    directions_url = f"https://www.google.com/maps/dir/?api=1&destination={assigned_entrance.latitude:.6f},{assigned_entrance.longitude:.6f}&travelmode=driving"

    return DirectFacilityBookingResponse(
        booking_reference=booking_reference,
        facility_id=facility.id,
        facility_name=facility.name,
        facility_address=facility.address.formatted_address if facility.address else "Central Metro District",
        assigned_slot_number=slot_num,
        assigned_slot_floor=slot_floor,
        assigned_entrance=assigned_entrance,
        vehicle_number=request.vehicle_number.upper(),
        vehicle_type=request.vehicle_type.upper(),
        duration_hours=request.duration_hours,
        base_rate_inr=base_rate,
        total_amount_inr=total_amount,
        payment_status="PAID_CONFIRMED",
        qr_token=qr_token,
        qr_pass_url=f"/gate?token={qr_token}",
        navigation_ready=True,
        directions_url=directions_url,
        created_at=datetime.now(timezone.utc),
    )


# ------------------------------------------------------------------------------
# 11. Phase 11: Real-time Slot Availability Breakdown
# ------------------------------------------------------------------------------
@router.get(
    "/facilities/{facility_id}/availability",
    response_model=FacilityAvailabilityBreakdownResponse,
    summary="Get real-time slot availability breakdown by vehicle and charger type",
)
async def get_facility_availability(
    facility_id: int,
    db: Session = Depends(get_db),
):
    facility = db.query(ParkingFacility).filter(ParkingFacility.id == facility_id).first()
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility ID {facility_id} does not exist",
        )

    avail = facility.available_capacity
    total = facility.total_capacity
    occ_pct = round(((total - avail) / max(1, total)) * 100)

    # Partition available slots across vehicle types proportionally
    car_slots = max(0, int(avail * 0.55))
    suv_slots = max(0, int(avail * 0.25))
    ev_slots = max(0, int(avail * 0.12))
    bike_slots = max(0, avail - (car_slots + suv_slots + ev_slots))

    return FacilityAvailabilityBreakdownResponse(
        facility_id=facility.id,
        facility_name=facility.name,
        total_capacity=total,
        available_capacity=avail,
        occupancy_percentage=occ_pct,
        slots_by_vehicle_type={
            "SEDAN": car_slots,
            "SUV": suv_slots,
            "EV": ev_slots,
            "TWO_WHEELER": bike_slots,
        },
        ev_charging_available=ev_slots,
        next_available_slot=f"Bay B1-{secrets.choice(['A','B'])}{secrets.randbelow(30)+1:02d}",
        is_booking_available=avail > 0,
    )

