"""Phase 14: Complete Indoor Parking Navigation Pydantic Schemas."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# -----------------------------------------------------------------------------
# Nodes & Edges
# -----------------------------------------------------------------------------
class MapNodeBase(BaseModel):
    facility_id: int
    floor_id: Optional[int] = None
    floor_level: int = 0
    floor_name: str = "Ground Floor"
    zone_code: Optional[str] = None
    node_code: str
    label: Optional[str] = None
    node_type: str = "INTERSECTION"
    x_coord: float
    y_coord: float
    z_coord: float = 0.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    slot_id: Optional[int] = None
    slot_number: Optional[str] = None
    is_accessible: bool = True
    is_active: bool = True


class MapNodeCreate(MapNodeBase):
    pass


class MapNodeUpdate(BaseModel):
    label: Optional[str] = None
    node_type: Optional[str] = None
    x_coord: Optional[float] = None
    y_coord: Optional[float] = None
    z_coord: Optional[float] = None
    slot_id: Optional[int] = None
    slot_number: Optional[str] = None
    is_accessible: Optional[bool] = None
    is_active: Optional[bool] = None


class MapNodeItem(MapNodeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MapEdgeBase(BaseModel):
    facility_id: int
    from_node_id: int
    to_node_id: int
    edge_type: str = "LANE_SEGMENT"
    lane_code: Optional[str] = None
    length_meters: float
    speed_limit_kmh: float = 10.0
    is_one_way: bool = False
    is_blocked: bool = False
    block_reason: Optional[str] = None
    is_restricted: bool = False
    restriction_notes: Optional[str] = None
    max_height_meters: float = 2.4
    max_weight_tons: float = 3.5
    is_pedestrian_accessible: bool = True
    polyline_coords: List[List[float]] = []
    is_active: bool = True


class MapEdgeCreate(MapEdgeBase):
    pass


class MapEdgeUpdate(BaseModel):
    is_blocked: Optional[bool] = None
    block_reason: Optional[str] = None
    is_restricted: Optional[bool] = None
    restriction_notes: Optional[str] = None
    speed_limit_kmh: Optional[float] = None
    is_active: Optional[bool] = None


class MapEdgeItem(MapEdgeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Restrictions
# -----------------------------------------------------------------------------
class RouteRestrictionCreate(BaseModel):
    facility_id: int
    edge_id: Optional[int] = None
    node_id: Optional[int] = None
    restriction_type: str = "BLOCKED_LANE"
    reason: str
    floor_level: int = 0
    end_time: Optional[datetime] = None


class RouteRestrictionItem(BaseModel):
    id: int
    facility_id: int
    edge_id: Optional[int] = None
    node_id: Optional[int] = None
    restriction_type: str
    reason: str
    floor_level: int
    start_time: datetime
    end_time: Optional[datetime] = None
    is_active: bool
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Checkpoints & Devices
# -----------------------------------------------------------------------------
class IndoorCheckpointCreate(BaseModel):
    facility_id: int
    node_id: int
    checkpoint_code: str
    checkpoint_type: str = "QR_CODE"
    floor_level: int = 0
    floor_name: str = "Ground Floor"
    zone_code: Optional[str] = None
    label: str
    instruction_hint: Optional[str] = None


class IndoorCheckpointItem(BaseModel):
    id: int
    facility_id: int
    node_id: int
    checkpoint_code: str
    checkpoint_type: str
    qr_token_payload: str
    floor_level: int
    floor_name: str
    zone_code: Optional[str] = None
    label: str
    instruction_hint: Optional[str] = None
    scan_count: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CheckpointVerifyRequest(BaseModel):
    facility_id: int
    qr_token_payload: str
    booking_id: Optional[int] = None


class CheckpointVerifyResponse(BaseModel):
    success: bool
    checkpoint_id: int
    checkpoint_code: str
    node_id: int
    floor_level: int
    floor_name: str
    zone_code: Optional[str]
    label: str
    x_coord: float
    y_coord: float
    message: str
    verified_at: datetime


class PositioningDeviceCreate(BaseModel):
    facility_id: int
    node_id: Optional[int] = None
    device_type: str = "BLE_BEACON"
    hardware_id: str
    label: str
    floor_level: int = 0
    x_coord: float
    y_coord: float
    z_coord: float = 2.8
    uuid: Optional[str] = None
    major: Optional[int] = None
    minor: Optional[int] = None
    tx_power: int = -59
    accuracy_radius_meters: float = 1.8


class PositioningDeviceItem(BaseModel):
    id: int
    facility_id: int
    node_id: Optional[int] = None
    device_type: str
    hardware_id: str
    label: str
    floor_level: int
    x_coord: float
    y_coord: float
    z_coord: float
    uuid: Optional[str] = None
    major: Optional[int] = None
    minor: Optional[int] = None
    tx_power: int
    status: str
    battery_percentage: int
    accuracy_radius_meters: float
    is_active: bool
    last_heartbeat_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Positioning Events
# -----------------------------------------------------------------------------
class IndoorPositionUpdateRequest(BaseModel):
    facility_id: int
    booking_id: Optional[int] = None
    source_type: str = "BLE_TRILATERATION"  # QR_CHECKPOINT_SCAN, BLE_TRILATERATION, UWB_PRECISE, SENSOR_DEAD_RECKONING, MANUAL_CORRECTION
    checkpoint_token: Optional[str] = None
    device_hardware_id: Optional[str] = None
    raw_rssi: Optional[int] = None
    raw_heading_deg: Optional[float] = None
    raw_step_count: Optional[int] = None
    reported_floor_level: Optional[int] = None
    reported_x: Optional[float] = None
    reported_y: Optional[float] = None


class IndoorPositionEstimateResponse(BaseModel):
    facility_id: int
    floor_level: int
    floor_name: str
    estimated_x: float
    estimated_y: float
    estimated_z: float
    nearest_node_id: int
    nearest_node_code: str
    zone_code: Optional[str]
    confidence_score: float  # 0.0 - 1.0
    accuracy_radius_meters: float
    source_type: str
    timestamp: datetime
    is_exact_gps_disclaimer: str = (
        "Indoor position is an algorithmic estimate based on sensor/beacon telemetry. "
        "Ordinary GPS is not used inside multilevel garages."
    )


# -----------------------------------------------------------------------------
# Turn-by-Turn Navigation & Routing
# -----------------------------------------------------------------------------
class TurnByTurnStepItem(BaseModel):
    step_number: int
    maneuver: str  # DEPART, STRAIGHT, TURN_LEFT, TURN_RIGHT, RAMP_DOWN, RAMP_UP, ENTER_ZONE, ARRIVE_SLOT, etc.
    instruction: str
    floor_level: int
    floor_name: str
    distance_meters: float
    cumulative_distance_meters: float
    zone_code: Optional[str] = None
    target_node_id: int
    icon_type: str  # arrow-up, corner-up-left, corner-up-right, ramp, parking, check-circle
    waypoint: List[float]  # [x, y]


class FloorSegmentItem(BaseModel):
    floor_level: int
    floor_name: str
    distance_meters: float
    polyline_points: List[List[float]]  # [[x1, y1], [x2, y2], ...]
    transition_to_floor: Optional[int] = None  # if ramp down to B2, transition_to_floor = -2
    transition_type: Optional[str] = None  # RAMP, ELEVATOR, STAIRS


class RouteCalculateRequest(BaseModel):
    facility_id: int
    booking_id: Optional[int] = None
    origin_node_id: Optional[int] = None
    destination_slot_number: Optional[str] = None
    route_type: str = "VEHICLE"  # VEHICLE, PEDESTRIAN_RETURN, ACCESSIBLE_PEDESTRIAN
    driver_latitude: Optional[float] = None
    driver_longitude: Optional[float] = None


class RouteRecalculateRequest(BaseModel):
    route_code: str
    current_floor_level: int
    current_x: float
    current_y: float
    blocked_edge_id: Optional[int] = None
    reassigned_slot_number: Optional[str] = None
    reason: str = "OBSTACLE_DETECTED"


class IndoorRouteResponse(BaseModel):
    route_code: str
    facility_id: int
    facility_name: str
    booking_id: Optional[int] = None
    assigned_slot_id: Optional[int] = None
    assigned_slot_number: str
    destination_zone_code: str
    route_type: str
    start_floor_level: int
    end_floor_level: int
    total_distance_meters: float
    estimated_duration_seconds: int
    node_path_ids: List[int]
    edge_path_ids: List[int]
    floor_segments: List[FloorSegmentItem]
    turn_by_turn_steps: List[TurnByTurnStepItem]
    is_recalculated: bool
    recalculation_reason: Optional[str] = None
    arrival_status: str
    generated_at: datetime


class ArrivalConfirmRequest(BaseModel):
    route_code: str
    final_x: float
    final_y: float
    final_floor_level: int
    checkpoint_qr_token: Optional[str] = None


class ArrivalConfirmResponse(BaseModel):
    success: bool
    route_code: str
    assigned_slot_number: str
    floor_name: str
    zone_code: str
    arrival_confirmed: bool
    arrival_timestamp: datetime
    message: str


# -----------------------------------------------------------------------------
# Find My Car (Pedestrian Navigation)
# -----------------------------------------------------------------------------
class FindMyCarResponse(BaseModel):
    booking_id: int
    facility_id: int
    facility_name: str
    assigned_slot_number: str
    floor_level: int
    floor_name: str
    zone_code: str
    slot_x: float
    slot_y: float
    parked_at: Optional[datetime] = None
    nearest_elevator_code: Optional[str] = None
    nearest_stairs_code: Optional[str] = None
    pedestrian_route: Optional[IndoorRouteResponse] = None


# -----------------------------------------------------------------------------
# Facility Indoor Map Packaging
# -----------------------------------------------------------------------------
class SlotLocationItem(BaseModel):
    slot_id: int
    slot_number: str
    floor_level: int
    floor_name: str
    zone_code: str
    slot_type: str
    status: str
    x_coord: float
    y_coord: float
    width_m: float = 2.5
    length_m: float = 5.0
    heading_deg: float = 90.0
    has_ev: bool = False
    is_accessible: bool = False


class ZoneSummaryItem(BaseModel):
    zone_code: str
    zone_name: str
    floor_level: int
    color_hex: str
    total_slots: int
    available_slots: int
    polygon_points: List[List[float]] = []


class FloorMapLayerItem(BaseModel):
    floor_level: int
    floor_name: str
    clearance_height_m: float
    total_slots: int
    available_slots: int
    zones: List[ZoneSummaryItem]
    nodes: List[MapNodeItem]
    edges: List[MapEdgeItem]
    slots: List[SlotLocationItem]
    checkpoints: List[IndoorCheckpointItem]
    devices: List[PositioningDeviceItem]


class FacilityFloorMapResponse(BaseModel):
    facility_id: int
    facility_name: str
    facility_code: str
    current_map_version: str
    floors: List[FloorMapLayerItem]
    total_nodes: int
    total_edges: int
    total_slots: int
    generated_at: datetime


# -----------------------------------------------------------------------------
# Operator Map Versioning & Publishing
# -----------------------------------------------------------------------------
class MapValidationReport(BaseModel):
    is_valid: bool
    connectivity_score: float
    disconnected_node_codes: List[str]
    unreachable_slots: List[str]
    zero_length_edges: List[int]
    dead_end_lanes: List[str]
    warnings: List[str]
    errors: List[str]


class PublishMapVersionRequest(BaseModel):
    facility_id: int
    version_code: str = "v1.1.0"
    notes: Optional[str] = None
