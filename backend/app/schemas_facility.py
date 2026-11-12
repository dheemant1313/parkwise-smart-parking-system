"""Pydantic Request & Response Schemas for Phase 10: Map & Facility Infrastructure."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ------------------------------------------------------------------------------
# 1. Sub-Entity Schemas
# ------------------------------------------------------------------------------
class FacilityLocationSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    altitude_meters: float = 0.0
    geohash: Optional[str] = None
    bounding_box_ne_lat: Optional[float] = None
    bounding_box_ne_lng: Optional[float] = None
    bounding_box_sw_lat: Optional[float] = None
    bounding_box_sw_lng: Optional[float] = None
    place_id: Optional[str] = None
    plus_code: Optional[str] = None


class FacilityAddressSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    street_line1: str
    street_line2: Optional[str] = None
    locality: str
    city: str
    state: str
    postal_code: str
    country: str = "India"
    landmark: Optional[str] = None
    formatted_address: str


class FacilityEntranceSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    gate_name: str
    gate_code: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    height_clearance_meters: float = 2.4
    barrier_type: str = "FASTAG_RFID + ANPR"
    allowed_vehicle_types: List[str] = ["COMPACT", "SEDAN", "SUV", "EV"]
    turn_restrictions: Optional[str] = None
    navigation_waypoint_notes: Optional[str] = None
    is_primary: bool = False
    is_open: bool = True


class FacilityExitSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    gate_name: str
    gate_code: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    barrier_type: str = "AUTOMATIC_BOOM_BARRIER"
    merge_instructions: Optional[str] = None
    is_open: bool = True


class FacilityOperatingHoursSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    open_time: str = "06:00"
    close_time: str = "23:59"
    is_24_hours: bool = False
    is_closed: bool = False


class FacilityMapConfigSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    map_provider: str = "mapbox"
    default_zoom_level: int = 17
    pitch_degrees: int = 45
    bearing_degrees: int = 0
    style_url: str = "mapbox://styles/mapbox/navigation-day-v1"
    has_indoor_3d_tiles: bool = True
    indoor_levels_json: List[str] = ["B2", "B1", "G", "L1", "L2"]
    custom_marker_svg: Optional[str] = None


# ------------------------------------------------------------------------------
# 2. Main Facility Responses & Requests
# ------------------------------------------------------------------------------
class ParkingFacilityDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lot_id: Optional[int] = None
    code: str
    name: str
    slug: str
    description: Optional[str] = None
    category: str
    status: str
    total_capacity: int
    available_capacity: int
    supported_vehicle_types: List[str]
    amenities: List[str]
    photos: List[str]
    base_hourly_rate_inr: float
    is_24_hours: bool
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    location: Optional[FacilityLocationSchema] = None
    address: Optional[FacilityAddressSchema] = None
    entrances: List[FacilityEntranceSchema] = []
    exits: List[FacilityExitSchema] = []
    operating_hours: List[FacilityOperatingHoursSchema] = []
    map_config: Optional[FacilityMapConfigSchema] = None
    created_at: Optional[datetime] = None


class ParkingFacilitySummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lot_id: Optional[int] = None
    code: str
    name: str
    slug: str
    category: str
    status: str
    total_capacity: int
    available_capacity: int
    base_hourly_rate_inr: float
    is_24_hours: bool
    latitude: float
    longitude: float
    city: str
    locality: str
    formatted_address: str
    primary_entrance: Optional[FacilityEntranceSchema] = None
    photos: List[str] = []
    amenities: List[str] = []


class NearbyFacilityItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    facility: ParkingFacilitySummaryResponse
    distance_km: float
    distance_meters: float
    estimated_driving_minutes: int
    primary_entrance: Optional[FacilityEntranceSchema] = None
    is_open_now: bool = True


class NearbyFacilitiesQuery(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    radius_km: float = Field(default=10.0, ge=0.5, le=50.0)
    vehicle_type: Optional[str] = None
    max_hourly_rate_inr: Optional[float] = None
    available_only: bool = False
    category: Optional[str] = None
    limit: int = Field(default=20, ge=1, le=100)


class PlaceSearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    place_id: str
    name: str
    locality: str
    city: str
    state: str
    latitude: float
    longitude: float
    type: str


class FacilityEntranceListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    facility_id: int
    facility_name: str
    facility_coordinates: Dict[str, float]
    entrances: List[FacilityEntranceSchema]
    exits: List[FacilityExitSchema]


class FacilityCreateRequest(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    category: str = "COMMERCIAL"
    lot_id: Optional[int] = None
    total_capacity: int = 100
    base_hourly_rate_inr: float = 60.0
    is_24_hours: bool = False
    latitude: float
    longitude: float
    street_line1: str
    locality: str
    city: str
    state: str
    postal_code: str
    landmark: Optional[str] = None
    supported_vehicle_types: Optional[List[str]] = None
    amenities: Optional[List[str]] = None
    photos: Optional[List[str]] = None


# ------------------------------------------------------------------------------
# 3. Phase 11: Navigation, Clustering & Direct Booking Schemas
# ------------------------------------------------------------------------------
class RouteStepSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    step_number: int
    instruction: str
    distance_meters: int
    duration_seconds: int
    turn_type: str = "STRAIGHT"  # STRAIGHT, TURN_RIGHT, TURN_LEFT, RAMP_ENTRY, MERGE, ARRIVE
    street_name: str


class AlternativeRouteSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    route_id: str
    name: str
    distance_km: float
    duration_minutes: int
    time_diff_minutes: int
    summary: str
    waypoints: List[Dict[str, float]]


class OutdoorRouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    facility_id: int
    facility_name: str
    origin_coordinates: Dict[str, float]
    destination_coordinates: Dict[str, float]
    entrance: FacilityEntranceSchema
    distance_km: float
    duration_minutes: int
    summary: str
    traffic_condition: str = "MODERATE"
    waypoints: List[Dict[str, float]]
    steps: List[RouteStepSchema]
    alternative_routes: List[AlternativeRouteSchema]
    external_links: Dict[str, str]


class DirectFacilityBookingRequest(BaseModel):
    vehicle_number: str = Field(..., min_length=4, max_length=20, description="e.g. DL-01-AB-1234")
    vehicle_type: str = Field("SEDAN", description="SUV, SEDAN, HATCHBACK, EV, TWO_WHEELER")
    driver_name: str = Field("Aarav Sharma", min_length=2, max_length=100)
    driver_phone: str = Field("+919876543210", min_length=10, max_length=20)
    duration_hours: int = Field(2, ge=1, le=72)
    ev_charging_requested: bool = False
    entrance_id: Optional[int] = None


class DirectFacilityBookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    booking_reference: str
    facility_id: int
    facility_name: str
    facility_address: str
    assigned_slot_number: str
    assigned_slot_floor: str
    assigned_entrance: FacilityEntranceSchema
    vehicle_number: str
    vehicle_type: str
    duration_hours: int
    base_rate_inr: float
    total_amount_inr: float
    payment_status: str = "PAID"
    qr_token: str
    qr_pass_url: str
    navigation_ready: bool = True
    directions_url: str
    created_at: datetime


class FacilityClusterSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cluster_id: str
    latitude: float
    longitude: float
    count: int
    min_price: float
    max_price: float
    total_available_slots: int
    facility_ids: List[int]
    facility_names: List[str]


class FacilityClusterListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    zoom: int
    total_clusters: int
    total_facilities: int
    clusters: List[FacilityClusterSchema]


class FacilityAvailabilityBreakdownResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    facility_id: int
    facility_name: str
    total_capacity: int
    available_capacity: int
    occupancy_percentage: int
    slots_by_vehicle_type: Dict[str, int]
    ev_charging_available: int
    next_available_slot: str
    is_booking_available: bool

