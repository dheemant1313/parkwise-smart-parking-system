"""Phase 15: Live Parking Occupancy & Smart Sensor Integration Models.
Defines:
- IoTDevice: Physical IoT devices (ultrasonic, magnetic, radar, optical, camera CV, gateways)
- SensorSlotMapping: Maps sensors and cameras to parking slots/zones with ROI polygons
- OccupancyEvent: Immutable audit event history of every occupancy transition
- CVUncertainDetectionReview: Operator queue for uncertain computer vision detections
- OperatorSlotOverride: Manual operator corrections with audit trail and expiration
"""
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.database import Base


class DeviceType(str, enum.Enum):
    ULTRASONIC = "ULTRASONIC"
    MAGNETIC = "MAGNETIC"
    RADAR = "RADAR"
    OPTICAL = "OPTICAL"
    CAMERA_CV = "CAMERA_CV"
    GATEWAY = "GATEWAY"


class DeviceHealth(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    DEGRADED = "DEGRADED"
    STALE = "STALE"


class OccupancyState(str, enum.Enum):
    VACANT = "VACANT"
    OCCUPIED = "OCCUPIED"
    RESERVED = "RESERVED"
    BLOCKED = "BLOCKED"
    UNKNOWN = "UNKNOWN"


class OccupancySource(str, enum.Enum):
    ULTRASONIC_SENSOR = "ULTRASONIC_SENSOR"
    MAGNETIC_SENSOR = "MAGNETIC_SENSOR"
    RADAR_SENSOR = "RADAR_SENSOR"
    CAMERA_CV = "CAMERA_CV"
    OPERATOR_OVERRIDE = "OPERATOR_OVERRIDE"
    GATE_EVENT = "GATE_EVENT"
    BOOKING_ENGINE = "BOOKING_ENGINE"


class CVReviewStatus(str, enum.Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED_OCCUPIED = "APPROVED_OCCUPIED"
    APPROVED_VACANT = "APPROVED_VACANT"
    DISMISSED = "DISMISSED"


class IoTDevice(Base):
    """IoT sensing device installed in a facility (bay sensor, camera, or gateway)."""
    __tablename__ = "iot_devices"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    device_code = Column(String(64), unique=True, nullable=False, index=True)
    device_type = Column(Enum(DeviceType), nullable=False)
    ip_address = Column(String(45), nullable=True)
    mac_address = Column(String(32), nullable=True)
    firmware_version = Column(String(32), default="v2.1.0", nullable=False)
    battery_level_pct = Column(Float, nullable=True)  # None for wired devices, 0.0 - 100.0 for wireless
    signal_rssi_dbm = Column(Integer, default=-65, nullable=False)
    health_status = Column(Enum(DeviceHealth), default=DeviceHealth.ONLINE, nullable=False, index=True)
    last_heartbeat_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    registered_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    config_json = Column(Text, nullable=True)

    mappings = relationship("SensorSlotMapping", back_populates="device", cascade="all, delete-orphan")
    events = relationship("OccupancyEvent", back_populates="device")


class SensorSlotMapping(Base):
    """Associates an IoT device (or a specific camera ROI) with a parking slot."""
    __tablename__ = "sensor_slot_mappings"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("iot_devices.id"), nullable=False, index=True)
    slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=False, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    zone_id = Column(Integer, ForeignKey("parking_zones.id"), nullable=True, index=True)
    roi_polygon_json = Column(Text, nullable=True)  # JSON representation of camera ROI bounding box/polygon
    is_primary = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    device = relationship("IoTDevice", back_populates="mappings")
    slot = relationship("ParkingSlot")

    __table_args__ = (
        Index("ix_sensor_slot_unique", "device_id", "slot_id", unique=True),
    )


class OccupancyEvent(Base):
    """Historical record of slot occupancy state changes, source, and sensor readings."""
    __tablename__ = "occupancy_events"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=False, index=True)
    device_id = Column(Integer, ForeignKey("iot_devices.id"), nullable=True, index=True)
    previous_state = Column(Enum(OccupancyState), nullable=False)
    new_state = Column(Enum(OccupancyState), nullable=False, index=True)
    source_type = Column(Enum(OccupancySource), nullable=False, index=True)
    confidence = Column(Float, default=1.0, nullable=False)
    license_plate = Column(String(32), nullable=True, index=True)
    distance_m = Column(Float, nullable=True)
    magnetic_deviation_ut = Column(Float, nullable=True)
    raw_payload_json = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    is_stale_cleared = Column(Boolean, default=False, nullable=False)

    device = relationship("IoTDevice", back_populates="events")
    slot = relationship("ParkingSlot")


class CVUncertainDetectionReview(Base):
    """Operator review queue for computer vision detections with ambiguous confidence."""
    __tablename__ = "cv_uncertain_detection_reviews"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=False, index=True)
    device_id = Column(Integer, ForeignKey("iot_devices.id"), nullable=True, index=True)
    frame_timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    bounding_box_json = Column(Text, nullable=False)
    detected_class = Column(String(32), default="car", nullable=False)
    confidence = Column(Float, nullable=False)
    snapshot_url = Column(String(255), nullable=True)
    status = Column(Enum(CVReviewStatus), default=CVReviewStatus.PENDING_REVIEW, nullable=False, index=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    operator_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    slot = relationship("ParkingSlot")
    device = relationship("IoTDevice")
    reviewer = relationship("User")


class OperatorSlotOverride(Base):
    """Manual operator status correction overriding automated sensor telemetry."""
    __tablename__ = "operator_slot_overrides"

    id = Column(Integer, primary_key=True, index=True)
    slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=False, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    target_state = Column(Enum(OccupancyState), nullable=False)
    reason = Column(String(255), nullable=False)
    operator_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    slot = relationship("ParkingSlot")
    operator = relationship("User")
