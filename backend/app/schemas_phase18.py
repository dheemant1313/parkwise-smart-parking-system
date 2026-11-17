"""Phase 18: Pydantic Schemas for Flexible Parking & Advanced Driver Needs."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# EV Charging Schemas
# ---------------------------------------------------------------------------

class EVChargerResponse(BaseModel):
    id: int
    facility_id: int
    slot_id: int
    slot_number: str
    charger_code: str
    manufacturer: str
    model_name: str
    connector_types: List[str]
    max_power_kw: float
    status: str
    energy_tariff_per_kwh_inr: float
    idle_fee_per_min_inr: float
    firmware_version: str
    last_heartbeat_at: Optional[datetime] = None


class EVChargingReserveRequest(BaseModel):
    facility_id: int
    slot_id: int
    vehicle_number: str
    connector_type: str = "CCS2"
    target_soc_percent: int = Field(90, ge=20, le=100)
    initial_soc_percent: int = Field(20, ge=0, le=95)


class EVChargingTelemetryUpdateRequest(BaseModel):
    session_reference: str
    current_soc_percent: int
    energy_delivered_kwh: float
    charging_rate_kw: float
    is_completed: bool = False
    hardware_fault: bool = False


class EVChargingSessionResponse(BaseModel):
    session_reference: str
    charger_code: str
    vehicle_number: str
    connector_used: str
    initial_soc_percent: int
    current_soc_percent: int
    target_soc_percent: int
    energy_delivered_kwh: float
    charging_rate_kw: float
    energy_cost_inr: float
    idle_cost_inr: float
    total_charging_cost_inr: float
    status: str
    ocpp_transaction_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    message: str


# ---------------------------------------------------------------------------
# Accessibility Schemas
# ---------------------------------------------------------------------------

class AccessibilityVerifyRequest(BaseModel):
    user_id: int
    badge_number: str
    holder_name: str
    disability_type: str = "LOCOMOTOR"


class AccessibilityCredentialResponse(BaseModel):
    badge_number: str
    holder_name: str
    disability_type: str
    is_verified: bool
    expires_at: datetime
    message: str


class AccessibleStepInstruction(BaseModel):
    step_index: int
    instruction: str
    mode: str  # ELEVATOR, RAMP, WIDE_CORRIDOR, BAY_ARRIVAL
    distance_meters: float
    has_elevator: bool
    has_ramp: bool


class AccessibleRouteResponse(BaseModel):
    facility_id: int
    destination_slot: str
    is_step_free: bool
    total_distance_meters: float
    estimated_time_minutes: float
    elevators_used: List[str]
    steps: List[AccessibleStepInstruction]
    accessibility_notes: str


# ---------------------------------------------------------------------------
# Group Booking Schemas
# ---------------------------------------------------------------------------

class GroupMemberInput(BaseModel):
    vehicle_number: str
    driver_name: str
    driver_phone: str


class GroupBookingCreateRequest(BaseModel):
    facility_id: int
    group_name: str
    start_time: datetime
    end_time: datetime
    members: List[GroupMemberInput] = Field(..., min_items=2, max_items=10)
    notes: Optional[str] = None


class GroupMemberResponse(BaseModel):
    member_id: int
    slot_number: str
    vehicle_number: str
    driver_name: str
    driver_phone: str
    qr_token_jti: str
    status: str
    checked_in_at: Optional[datetime] = None


class GroupBookingResponse(BaseModel):
    group_reference: str
    facility_name: str
    group_name: str
    start_time: datetime
    end_time: datetime
    total_spaces_reserved: int
    total_amount_inr: float
    status: str
    members: List[GroupMemberResponse]


class GroupMemberCheckInRequest(BaseModel):
    group_reference: str
    vehicle_number: str
    qr_token_jti: str


class GroupMemberCancelRequest(BaseModel):
    group_reference: str
    vehicle_number: str
    reason: str


# ---------------------------------------------------------------------------
# Smart Waiting List Schemas
# ---------------------------------------------------------------------------

class WaitlistJoinRequest(BaseModel):
    facility_id: int
    vehicle_plate: str
    driver_name: str
    driver_phone: str
    required_slot_type: str = "STANDARD"
    requested_start_time: datetime
    requested_end_time: datetime


class WaitlistEntryResponse(BaseModel):
    waitlist_reference: str
    facility_id: int
    facility_name: str
    vehicle_plate: str
    required_slot_type: str
    queue_position: int
    status: str
    offered_slot_number: Optional[str] = None
    offer_expires_at: Optional[datetime] = None
    created_at: datetime


class WaitlistClaimRequest(BaseModel):
    waitlist_reference: str
    payment_method: str = "FASTAG_AUTO_DEBIT"


class WaitlistClaimResponse(BaseModel):
    waitlist_reference: str
    booking_reference: str
    slot_number: str
    status: str
    message: str
