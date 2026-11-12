"""Phase 14: Complete Indoor Parking Navigation System Database Models.

Covers:
1. MapNode - Intersections, slot entries, ramps, gates, elevators, pedestrian junctions
2. MapEdge - Lane segments, ramps, one-way constraints, height limits, blocked status
3. RouteRestriction - Dynamic obstacles, roadwork closures, height/weight exceptions
4. IndoorCheckpoint - Physical QR code checkpoint points with cryptographically signed tokens
5. PositioningDevice - BLE beacons, UWB anchors, WiFi APs, optical sensors
6. IndoorPositionEvent - Position establishment, trilateration, QR scan updates, confidence levels
7. NavigationRoute - Multi-floor graph route with turn-by-turn maneuvers, recalculation flags
8. FacilityMapVersion - Semantic versioning, graph connectivity validation, operator publishing
"""
import enum
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class NodeType(str, enum.Enum):
    INTERSECTION = "INTERSECTION"
    SLOT_ENTRY = "SLOT_ENTRY"
    RAMP_UP = "RAMP_UP"
    RAMP_DOWN = "RAMP_DOWN"
    ENTRY_GATE = "ENTRY_GATE"
    EXIT_GATE = "EXIT_GATE"
    ELEVATOR = "ELEVATOR"
    STAIRS = "STAIRS"
    PEDESTRIAN_JUNCTION = "PEDESTRIAN_JUNCTION"
    WAYPOINT = "WAYPOINT"


class EdgeType(str, enum.Enum):
    LANE_SEGMENT = "LANE_SEGMENT"
    RAMP_TRANSITION = "RAMP_TRANSITION"
    ELEVATOR_PATH = "ELEVATOR_PATH"
    STAIRS_PATH = "STAIRS_PATH"
    SLOT_CONNECTOR = "SLOT_CONNECTOR"
    PEDESTRIAN_WALKWAY = "PEDESTRIAN_WALKWAY"


class PositioningDeviceType(str, enum.Enum):
    BLE_BEACON = "BLE_BEACON"
    UWB_ANCHOR = "UWB_ANCHOR"
    WIFI_AP = "WIFI_AP"
    CAMERA_ANPR = "CAMERA_ANPR"


class ManeuverType(str, enum.Enum):
    DEPART = "DEPART"
    STRAIGHT = "STRAIGHT"
    TURN_LEFT = "TURN_LEFT"
    TURN_RIGHT = "TURN_RIGHT"
    SLIGHT_LEFT = "SLIGHT_LEFT"
    SLIGHT_RIGHT = "SLIGHT_RIGHT"
    U_TURN = "U_TURN"
    RAMP_DOWN = "RAMP_DOWN"
    RAMP_UP = "RAMP_UP"
    ENTER_ZONE = "ENTER_ZONE"
    TAKE_ELEVATOR = "TAKE_ELEVATOR"
    TAKE_STAIRS = "TAKE_STAIRS"
    ARRIVE_SLOT = "ARRIVE_SLOT"
    ARRIVE_EXIT = "ARRIVE_EXIT"


class MapNode(Base):
    """Represents a graph vertex inside a multilevel parking facility."""
    __tablename__ = "indoor_map_nodes"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_facilities.id"), nullable=False, index=True)
    floor_id = Column(Integer, ForeignKey("parking_floors.id"), nullable=True, index=True)
    floor_level = Column(Integer, default=0, nullable=False, index=True)  # 0=G, -1=B1, -2=B2, -3=B3
    floor_name = Column(String(40), default="Ground Floor", nullable=False)
    zone_code = Column(String(32), nullable=True, index=True)  # e.g. "Zone A", "Zone C"
    
    node_code = Column(String(48), index=True, nullable=False)  # e.g. "B1-INT-04", "B2-SLOT-C142"
    label = Column(String(120), nullable=True)  # "Entrance Gate 1", "Pillar B2-18", "Slot C-142 Entry"
    node_type = Column(String(32), default=NodeType.INTERSECTION.value, nullable=False, index=True)

    # Spatial coordinates inside indoor reference frame (meters from origin)
    x_coord = Column(Float, nullable=False)
    y_coord = Column(Float, nullable=False)
    z_coord = Column(Float, default=0.0, nullable=False)  # Relative height

    # Optional real-world WGS84 coordinates if available
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Slot association
    slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=True, index=True)
    slot_number = Column(String(32), nullable=True, index=True)

    # Physical properties
    is_accessible = Column(Boolean, default=True, nullable=False)  # ADA / wheelchair compatible
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    outgoing_edges = relationship("MapEdge", foreign_keys="MapEdge.from_node_id", back_populates="from_node", cascade="all, delete-orphan")
    incoming_edges = relationship("MapEdge", foreign_keys="MapEdge.to_node_id", back_populates="to_node")
    checkpoint = relationship("IndoorCheckpoint", back_populates="node", uselist=False)

    __table_args__ = (
        Index("ix_indoor_node_facility_code", "facility_id", "node_code", unique=True),
        Index("ix_indoor_node_floor_coords", "facility_id", "floor_level", "x_coord", "y_coord"),
    )


class MapEdge(Base):
    """Represents a navigable driving lane or walkway connection in the indoor graph."""
    __tablename__ = "indoor_map_edges"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_facilities.id"), nullable=False, index=True)
    from_node_id = Column(Integer, ForeignKey("indoor_map_nodes.id"), nullable=False, index=True)
    to_node_id = Column(Integer, ForeignKey("indoor_map_nodes.id"), nullable=False, index=True)

    edge_type = Column(String(32), default=EdgeType.LANE_SEGMENT.value, nullable=False)
    lane_code = Column(String(48), nullable=True)  # e.g. "LANE-B1-NORTH-01"
    length_meters = Column(Float, nullable=False)
    speed_limit_kmh = Column(Float, default=10.0, nullable=False)

    # Navigation rules & restrictions
    is_one_way = Column(Boolean, default=False, nullable=False)
    is_blocked = Column(Boolean, default=False, nullable=False, index=True)
    block_reason = Column(String(160), nullable=True)
    is_restricted = Column(Boolean, default=False, nullable=False)  # EV only, VIP only, Staff only
    restriction_notes = Column(String(160), nullable=True)

    # Clearances
    max_height_meters = Column(Float, default=2.4, nullable=False)
    max_weight_tons = Column(Float, default=3.5, nullable=False)
    is_pedestrian_accessible = Column(Boolean, default=True, nullable=False)

    # Intermediate polyline coordinates for curved driving lanes: [[x1, y1], [x2, y2], ...]
    polyline_coords = Column(JSON, default=list, nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    from_node = relationship("MapNode", foreign_keys=[from_node_id], back_populates="outgoing_edges")
    to_node = relationship("MapNode", foreign_keys=[to_node_id], back_populates="incoming_edges")

    __table_args__ = (
        Index("ix_indoor_edge_nodes", "facility_id", "from_node_id", "to_node_id"),
    )


class RouteRestriction(Base):
    """Dynamic operational restrictions created by operators (roadwork, blocked lanes)."""
    __tablename__ = "indoor_route_restrictions"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_facilities.id"), nullable=False, index=True)
    edge_id = Column(Integer, ForeignKey("indoor_map_edges.id"), nullable=True, index=True)
    node_id = Column(Integer, ForeignKey("indoor_map_nodes.id"), nullable=True, index=True)

    restriction_type = Column(String(48), default="BLOCKED_LANE", nullable=False)  # BLOCKED_LANE, SPILL_CLEANUP, REPAIR, VIP_HOLD
    reason = Column(String(255), nullable=False)
    floor_level = Column(Integer, default=0, nullable=False)
    
    start_time = Column(DateTime, default=utc_now, nullable=False)
    end_time = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(String(100), default="operator@parkwise.io", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class IndoorCheckpoint(Base):
    """Physical checkpoints (QR markers, pillar signs) for ground-truth position synchronization."""
    __tablename__ = "indoor_checkpoints"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_facilities.id"), nullable=False, index=True)
    node_id = Column(Integer, ForeignKey("indoor_map_nodes.id"), nullable=False, unique=True, index=True)

    checkpoint_code = Column(String(64), unique=True, index=True, nullable=False)  # e.g. "CHK-CITYWALK-B1-ENT"
    checkpoint_type = Column(String(32), default="QR_CODE", nullable=False)
    qr_token_payload = Column(String(128), unique=True, index=True, nullable=False)
    
    floor_level = Column(Integer, default=0, nullable=False)
    floor_name = Column(String(40), default="Ground Floor", nullable=False)
    zone_code = Column(String(32), nullable=True)
    
    label = Column(String(120), nullable=False)  # "Entrance Gate Checkpoint 1"
    instruction_hint = Column(String(200), nullable=True)  # "Scan at Pillar B1-04 to align navigation"
    scan_count = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    node = relationship("MapNode", back_populates="checkpoint")


class PositioningDevice(Base):
    """Hardware infrastructure devices for indoor trilateration and beacon detection."""
    __tablename__ = "indoor_positioning_devices"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_facilities.id"), nullable=False, index=True)
    node_id = Column(Integer, ForeignKey("indoor_map_nodes.id"), nullable=True, index=True)

    device_type = Column(String(32), default=PositioningDeviceType.BLE_BEACON.value, nullable=False)
    hardware_id = Column(String(80), unique=True, index=True, nullable=False)  # e.g. "BLE-PW-B2-014"
    label = Column(String(120), nullable=False)

    floor_level = Column(Integer, default=0, nullable=False)
    x_coord = Column(Float, nullable=False)
    y_coord = Column(Float, nullable=False)
    z_coord = Column(Float, default=2.8, nullable=False)

    # BLE specific
    uuid = Column(String(64), nullable=True)
    major = Column(Integer, nullable=True)
    minor = Column(Integer, nullable=True)
    tx_power = Column(Integer, default=-59, nullable=False)

    status = Column(String(32), default="ONLINE", nullable=False)
    battery_percentage = Column(Integer, default=95, nullable=False)
    accuracy_radius_meters = Column(Float, default=1.8, nullable=False)  # BLE: 1.5-3m, UWB: 0.15m

    is_active = Column(Boolean, default=True, nullable=False)
    last_heartbeat_at = Column(DateTime, default=utc_now, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class IndoorPositionEvent(Base):
    """Position establishment and continuous updates from driver devices."""
    __tablename__ = "indoor_position_events"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_facilities.id"), nullable=False, index=True)
    
    source_type = Column(String(40), default="QR_CHECKPOINT_SCAN", nullable=False)
    checkpoint_id = Column(Integer, ForeignKey("indoor_checkpoints.id"), nullable=True)
    device_id = Column(Integer, ForeignKey("indoor_positioning_devices.id"), nullable=True)

    detected_floor_level = Column(Integer, default=0, nullable=False)
    detected_x = Column(Float, nullable=False)
    detected_y = Column(Float, nullable=False)
    detected_z = Column(Float, default=0.0, nullable=False)
    
    confidence_score = Column(Float, default=1.0, nullable=False)  # 0.0 - 1.0
    accuracy_meters = Column(Float, default=0.5, nullable=False)
    raw_telemetry = Column(JSON, default=dict, nullable=False)

    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)


class NavigationRoute(Base):
    """Active or historical indoor turn-by-turn navigation session."""
    __tablename__ = "indoor_navigation_routes"

    id = Column(Integer, primary_key=True, index=True)
    route_code = Column(String(64), unique=True, index=True, nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_facilities.id"), nullable=False, index=True)

    origin_node_id = Column(Integer, ForeignKey("indoor_map_nodes.id"), nullable=False)
    destination_node_id = Column(Integer, ForeignKey("indoor_map_nodes.id"), nullable=False)
    
    assigned_slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=True, index=True)
    assigned_slot_number = Column(String(32), nullable=False)
    destination_zone_code = Column(String(32), default="Zone C", nullable=False)

    route_type = Column(String(32), default="VEHICLE", nullable=False)  # VEHICLE, PEDESTRIAN_RETURN, ACCESSIBLE_PEDESTRIAN
    start_floor_level = Column(Integer, default=0, nullable=False)
    end_floor_level = Column(Integer, default=-2, nullable=False)

    total_distance_meters = Column(Float, default=0.0, nullable=False)
    estimated_duration_seconds = Column(Integer, default=120, nullable=False)

    node_path_ids = Column(JSON, default=list, nullable=False)  # [1, 2, 4, 7, 12]
    edge_path_ids = Column(JSON, default=list, nullable=False)
    
    # Waypoints grouped by floor for multi-floor map layers
    # [{"floor_level": -1, "floor_name": "Basement 1", "points": [[x, y], ...]}, ...]
    floor_segments = Column(JSON, default=list, nullable=False)

    # Structured turn-by-turn steps
    # [{"step_number": 1, "maneuver": "STRAIGHT", "instruction": "...", "distance_meters": 25, "floor_level": -1}, ...]
    turn_by_turn_steps = Column(JSON, default=list, nullable=False)

    # Dynamic updates
    is_active = Column(Boolean, default=True, nullable=False)
    is_recalculated = Column(Boolean, default=False, nullable=False)
    recalculation_reason = Column(String(200), nullable=True)

    arrival_status = Column(String(32), default="IN_TRANSIT", nullable=False)  # IN_TRANSIT, ARRIVED_CONFIRMED, REROUTED, CANCELLED
    arrived_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=utc_now, nullable=False)


class FacilityMapVersion(Base):
    """Semantic versioning and validation reports for indoor garage maps."""
    __tablename__ = "indoor_facility_map_versions"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_facilities.id"), nullable=False, index=True)
    version_code = Column(String(32), default="v1.0.0", nullable=False)
    version_number = Column(Integer, default=1, nullable=False)
    status = Column(String(32), default="PUBLISHED", nullable=False)  # DRAFT, VALIDATED, PUBLISHED, ARCHIVED

    floors_count = Column(Integer, default=3, nullable=False)
    nodes_count = Column(Integer, default=0, nullable=False)
    edges_count = Column(Integer, default=0, nullable=False)
    slots_mapped_count = Column(Integer, default=0, nullable=False)
    checkpoints_count = Column(Integer, default=0, nullable=False)
    devices_count = Column(Integer, default=0, nullable=False)

    connectivity_score = Column(Float, default=1.0, nullable=False)  # 1.0 = fully connected
    validation_report = Column(JSON, default=dict, nullable=False)

    published_by = Column(String(100), default="operator@parkwise.io", nullable=False)
    published_at = Column(DateTime, default=utc_now, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
