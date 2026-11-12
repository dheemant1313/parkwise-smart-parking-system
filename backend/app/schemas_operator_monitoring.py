"""Pydantic Request & Response Schemas for Phase 12 Live Operator Map & Monitoring."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FacilityOccupancySummary(BaseModel):
    """Granular live occupancy telemetry breakdown for a parking facility."""
    total_spaces: int = Field(..., ge=0)
    available_spaces: int = Field(..., ge=0)
    occupied_spaces: int = Field(..., ge=0)
    reserved_spaces: int = Field(..., ge=0)
    blocked_spaces: int = Field(..., ge=0)
    stale_spaces: int = Field(0, ge=0)
    occupancy_percentage: float = Field(..., ge=0.0, le=100.0)
    peak_indicator: str = Field("NORMAL")  # LOW, NORMAL, HIGH, CRITICAL_PEAK


class OperatorFacilityListItem(BaseModel):
    """Facility overview item for the multi-facility operator map."""
    facility_id: int
    lot_id: int
    code: str
    name: str
    slug: str
    category: str
    status: str
    city: str
    latitude: float
    longitude: float
    formatted_address: str
    base_hourly_rate_inr: float
    is_24_hours: bool
    amenities: List[str]
    occupancy: FacilityOccupancySummary
    zones_count: int
    gates_count: int
    active_alerts_count: int
    critical_alerts_count: int
    last_telemetry_at: datetime


class OperatorGateItem(BaseModel):
    """Entry and exit barrier gate telemetry item."""
    id: int
    gate_name: str
    gate_code: str
    gate_type: str  # ENTRANCE or EXIT
    latitude: float
    longitude: float
    barrier_type: str
    height_clearance_meters: Optional[float] = None
    status: str = "OPERATIONAL"  # OPERATIONAL, DEGRADED, OFFLINE


class OperatorSlotItem(BaseModel):
    """Single parking bay live state for zone inspections."""
    id: int
    slot_number: str
    floor: int
    zone: str
    slot_type: str
    status: str
    sensor_health: str
    power_kw: Optional[float] = None


class OperatorZoneDetail(BaseModel):
    """Granular zone-level occupancy, restriction state, and slot inventory."""
    zone_id: int
    floor_id: int
    floor_name: str
    zone_code: str
    zone_name: str
    dedicated_category: str
    is_restricted: bool
    restriction_reason: str
    total_bays: int
    available_bays: int
    occupied_bays: int
    reserved_bays: int
    blocked_bays: int
    stale_bays: int
    utilization_pct: float
    operational_status: str  # OPTIMAL, MODERATE, NEAR_CAPACITY, RESTRICTED
    slots: List[OperatorSlotItem] = []


class OperationalAlertItem(BaseModel):
    """Facility alert item for live operator telemetry feeds."""
    id: int
    facility_id: Optional[int] = None
    lot_id: Optional[int] = None
    zone_code: Optional[str] = None
    severity: str  # INFO, WARNING, CRITICAL
    alert_type: str
    title: str
    message: str
    is_acknowledged: bool
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime


class FacilityMonitoringDetailResponse(BaseModel):
    """Complete live monitoring payload for a selected facility on the operator map."""
    facility_id: int
    lot_id: int
    code: str
    name: str
    slug: str
    category: str
    status: str
    city: str
    latitude: float
    longitude: float
    formatted_address: str
    occupancy: FacilityOccupancySummary
    gates: List[OperatorGateItem]
    zones: List[OperatorZoneDetail]
    alerts: List[OperationalAlertItem]
    booking_volume_today: int
    active_dwell_count: int
    estimated_revenue_today_inr: float
    current_surge_multiplier: float
    occupancy_velocity_30m: float  # Percentage change over last 30 minutes (positive = filling up)
    telemetry_source: str = "Parkwise IoT Edge v2.8 (WebSocket Sync)"
    last_updated_at: datetime


class ZoneRestrictionUpdateRequest(BaseModel):
    """Operator payload to toggle a zone restriction."""
    is_restricted: bool
    restriction_reason: str = Field(
        "MAINTENANCE",
        description="Reason code: NONE, VIP_RESERVE, MAINTENANCE, STAFF_ONLY, CLEANING, FIRE_LANE",
    )
    notes: Optional[str] = None


class SlotStatusOverrideRequest(BaseModel):
    """Operator payload to manually override bay status from the live map."""
    status: str = Field(
        ...,
        description="Target status: AVAILABLE, OCCUPIED, MAINTENANCE",
    )
    reason: Optional[str] = None


class AlertAcknowledgeResponse(BaseModel):
    """Confirmation of alert acknowledgment."""
    alert_id: int
    is_acknowledged: bool
    acknowledged_by: str
    acknowledged_at: datetime
    message: str
