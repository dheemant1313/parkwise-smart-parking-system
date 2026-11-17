"""Phase 19: Pydantic Schemas for Driver Convenience, Valet, Venues & Assistance."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Pillar A: Find My Car & Pedestrian Navigation Schemas
# ---------------------------------------------------------------------------

class SavedVehicleLocationCreate(BaseModel):
    facility_id: int = Field(..., description="ID of parking facility")
    floor: str = Field(..., description="Parking floor e.g. B1, B2")
    zone: str = Field(..., description="Parking zone e.g. Zone Green")
    slot_number: str = Field(..., description="Exact slot code e.g. B2-142")
    pillar_reference: Optional[str] = Field(None, description="Nearby pillar or landmark e.g. Pillar 4B")
    photo_url: Optional[str] = Field(None, description="Optional photo URL or data URI")
    driver_notes: Optional[str] = Field(None, description="Notes e.g. Near lift lobby")
    booking_id: Optional[int] = Field(None, description="Optional associated booking ID")


class SavedVehicleLocationResponse(BaseModel):
    id: int
    user_id: int
    facility_id: int
    facility_name: str
    floor: str
    zone: str
    slot_number: str
    pillar_reference: Optional[str] = None
    photo_url: Optional[str] = None
    driver_notes: Optional[str] = None
    saved_at: datetime
    is_active: bool
    retention_expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PedestrianRouteStep(BaseModel):
    step_number: int
    instruction: str
    floor: str
    step_type: str  # e.g. WALKWAY, ELEVATOR, ESCALATOR, RAMP, ARRIVED
    distance_meters: int
    notes: Optional[str] = None


class PedestrianRouteResponse(BaseModel):
    origin: str
    destination: str
    total_distance_meters: int
    estimated_walk_minutes: int
    is_pedestrian_only: bool = True
    steps: List[PedestrianRouteStep]


# ---------------------------------------------------------------------------
# Pillar B: Valet Parking Schemas
# ---------------------------------------------------------------------------

class ValetRequestCreate(BaseModel):
    facility_id: int
    vehicle_plate: str
    vehicle_model: str
    driver_name: str
    driver_phone: str
    booking_id: Optional[int] = None
    pre_inspection_notes: Optional[str] = None


class ValetHandoverRequest(BaseModel):
    valet_ticket_number: str
    attendant_name: str
    inspection_notes: Optional[str] = None
    fuel_level_percent: Optional[int] = None
    odometer_km: Optional[int] = None


class ValetParkRequest(BaseModel):
    valet_ticket_number: str
    storage_slot: str  # e.g. Valet Vault V-04
    attendant_name: str


class ValetReturnVerifyRequest(BaseModel):
    valet_ticket_number: str
    handover_otp: str  # 6-digit PIN
    attendant_name: str


class ValetIncidentReportRequest(BaseModel):
    valet_ticket_number: str
    incident_description: str
    reported_by: str


class ValetBookingResponse(BaseModel):
    id: int
    valet_ticket_number: str
    facility_id: int
    facility_name: str
    driver_name: str
    driver_phone: str
    vehicle_plate: str
    vehicle_model: str
    status: str
    assigned_attendant_name: Optional[str] = None
    assigned_storage_slot: Optional[str] = None
    handover_otp: str
    handover_time: Optional[datetime] = None
    parked_time: Optional[datetime] = None
    retrieval_requested_time: Optional[datetime] = None
    returned_time: Optional[datetime] = None
    pre_inspection_notes: Optional[str] = None
    incident_reported: bool = False
    incident_description: Optional[str] = None
    custody_logs: List[Dict[str, Any]] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Pillar C: Mall & Venue Integration Schemas
# ---------------------------------------------------------------------------

class VenueDestinationCreate(BaseModel):
    facility_id: int
    name: str
    category: str  # SHOPPING, DINING, CINEMA, SERVICES, OFFICES, EVENTS
    floor: str
    unit_number: str
    opening_hours: str = "10:00 AM - 11:00 PM"
    nearest_parking_zone: str
    nearest_elevator_bank: str = "Elevator Bank B"
    description: Optional[str] = None
    logo_icon: Optional[str] = None


class VenueDestinationResponse(BaseModel):
    id: int
    facility_id: int
    facility_name: str
    name: str
    category: str
    floor: str
    unit_number: str
    opening_hours: str
    nearest_parking_zone: str
    nearest_elevator_bank: str
    description: Optional[str] = None
    logo_icon: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Pillar D: Driver Assistance & Incident Reporting Schemas
# ---------------------------------------------------------------------------

class AssistanceRequestCreate(BaseModel):
    facility_id: int
    driver_name: str
    driver_phone: str
    vehicle_plate: Optional[str] = None
    slot_number: Optional[str] = None
    category: str  # BLOCKED_SLOT, DAMAGED_EQUIPMENT, NAVIGATION_ISSUE, PAYMENT_DISPUTE, EMERGENCY_SOS, OTHER
    urgency: str = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL_SOS
    description: str


class AssistanceStatusUpdateRequest(BaseModel):
    ticket_number: str
    status: str  # SUBMITTED, ACKNOWLEDGED, STAFF_DISPATCHED, RESOLVED, CLOSED
    staff_name: str
    notes: Optional[str] = None


class AssistanceRequestResponse(BaseModel):
    id: int
    ticket_number: str
    facility_id: int
    facility_name: str
    driver_name: str
    driver_phone: str
    vehicle_plate: Optional[str] = None
    slot_number: Optional[str] = None
    category: str
    urgency: str
    description: str
    status: str
    assigned_staff_name: Optional[str] = None
    staff_resolution_notes: Optional[str] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    status_history: List[Dict[str, Any]] = []

    class Config:
        from_attributes = True
