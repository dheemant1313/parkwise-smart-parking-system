"""Pydantic schemas for Phase 15: Live Parking Occupancy & Smart Sensor Integration."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.models_occupancy import (
    CVReviewStatus,
    DeviceHealth,
    DeviceType,
    OccupancySource,
    OccupancyState,
)


class IoTDeviceCreate(BaseModel):
    facility_id: int
    device_code: str
    device_type: DeviceType
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    firmware_version: str = "v2.1.0"
    battery_level_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    signal_rssi_dbm: int = -65
    config_json: Optional[str] = None


class IoTDeviceResponse(BaseModel):
    id: int
    facility_id: int
    device_code: str
    device_type: DeviceType
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    firmware_version: str
    battery_level_pct: Optional[float] = None
    signal_rssi_dbm: int
    health_status: DeviceHealth
    last_heartbeat_at: datetime
    registered_at: datetime
    config_json: Optional[str] = None

    class Config:
        from_attributes = True


class SensorSlotMappingCreate(BaseModel):
    device_id: int
    slot_id: int
    facility_id: int
    zone_id: Optional[int] = None
    roi_polygon_json: Optional[str] = None
    is_primary: bool = True


class SensorSlotMappingResponse(BaseModel):
    id: int
    device_id: int
    slot_id: int
    facility_id: int
    zone_id: Optional[int] = None
    roi_polygon_json: Optional[str] = None
    is_primary: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SensorTelemetryItem(BaseModel):
    device_code: str
    timestamp: Optional[datetime] = None
    distance_m: Optional[float] = None
    magnetic_deviation_ut: Optional[float] = None
    is_occupied: Optional[bool] = None
    confidence: float = Field(1.0, ge=0.0, le=1.0)
    battery_level_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    signal_rssi_dbm: Optional[int] = None
    raw_payload: Optional[Dict[str, Any]] = None


class SensorTelemetryIngestRequest(BaseModel):
    facility_id: int
    telemetry: List[SensorTelemetryItem]


class TelemetryIngestResponse(BaseModel):
    success: bool
    ingested_count: int
    updated_slots: List[int]
    conflicts_detected: int = 0
    message: str


class CVDetectedObject(BaseModel):
    class_name: str = "car"  # car, truck, bus, motorcycle, empty
    confidence: float = Field(..., ge=0.0, le=1.0)
    box_2d: List[float] = Field(..., description="[ymin, xmin, ymax, xmax] or [x1, y1, x2, y2]")


class CVFrameInferRequest(BaseModel):
    facility_id: int
    camera_device_code: str
    frame_timestamp: Optional[datetime] = None
    snapshot_url: Optional[str] = None
    detections: List[CVDetectedObject]


class CVFrameInferResponse(BaseModel):
    success: bool
    facility_id: int
    camera_device_code: str
    evaluated_slots: int
    occupied_slots: List[str]
    vacant_slots: List[str]
    uncertain_reviews_queued: int


class CVUncertainReviewItem(BaseModel):
    id: int
    facility_id: int
    slot_id: int
    slot_number: str
    camera_device_code: Optional[str] = None
    frame_timestamp: datetime
    bounding_box_json: str
    detected_class: str
    confidence: float
    snapshot_url: Optional[str] = None
    status: CVReviewStatus
    created_at: datetime

    class Config:
        from_attributes = True


class CVReviewResolveRequest(BaseModel):
    decision: CVReviewStatus = Field(..., description="APPROVED_OCCUPIED, APPROVED_VACANT, or DISMISSED")
    operator_notes: Optional[str] = None


class OperatorSlotOverrideRequest(BaseModel):
    target_state: OccupancyState = Field(..., description="VACANT, OCCUPIED, BLOCKED")
    reason: str = Field(..., min_length=3, max_length=255)
    duration_minutes: Optional[int] = Field(60, ge=1, le=1440)


class OperatorSlotOverrideResponse(BaseModel):
    id: int
    slot_id: int
    slot_number: str
    facility_id: int
    target_state: OccupancyState
    reason: str
    operator_user_id: int
    expires_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime


class LiveSlotOccupancyItem(BaseModel):
    slot_id: int
    slot_number: str
    floor: int
    zone: str
    slot_type: str
    state: OccupancyState
    is_bookable: bool
    confidence: float
    source_type: Optional[OccupancySource] = None
    last_device_code: Optional[str] = None
    sensor_health: DeviceHealth
    last_updated_at: datetime
    has_active_override: bool = False
    active_booking_reference: Optional[str] = None


class FacilityLiveOccupancyResponse(BaseModel):
    facility_id: int
    facility_name: str
    total_slots: int
    vacant_slots: int
    occupied_slots: int
    reserved_slots: int
    blocked_slots: int
    unknown_slots: int
    occupancy_rate_pct: float
    sensor_health_summary: Dict[str, int]
    slots: List[LiveSlotOccupancyItem]


class OccupancyEventResponse(BaseModel):
    id: int
    facility_id: int
    slot_id: int
    slot_number: str
    device_id: Optional[int] = None
    device_code: Optional[str] = None
    previous_state: OccupancyState
    new_state: OccupancyState
    source_type: OccupancySource
    confidence: float
    license_plate: Optional[str] = None
    distance_m: Optional[float] = None
    timestamp: datetime

    class Config:
        from_attributes = True
