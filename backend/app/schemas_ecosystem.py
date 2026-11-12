"""Pydantic request & response schemas for Phase 08 Advanced Parkwise Ecosystem."""
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from app.models_ecosystem import (
    EVConnectorType,
    EVChargingStatus,
    SubscriptionPlanType,
    SubscriptionStatus,
    GroupPaymentMode,
    MarketplaceListingStatus,
    ValetTicketStatus,
)


# ----------------------------------------------------------------------------
# 1. EV Charging Bay Reservations
# ----------------------------------------------------------------------------
class EVReservationCreateRequest(BaseModel):
    lot_id: int
    slot_id: int
    user_email: str
    connector_type: EVConnectorType = EVConnectorType.CCS2
    target_soc_pct: float = Field(80.0, ge=30.0, le=100.0)
    initial_soc_pct: float = Field(20.0, ge=5.0, le=90.0)
    scheduled_start: datetime
    duration_hours: float = Field(2.0, ge=0.5, le=12.0)
    energy_kwh_requested: Optional[float] = Field(35.0, ge=1.0, le=150.0)


class EVChargingSessionResponse(BaseModel):
    id: int
    session_code: str
    booking_id: Optional[int] = None
    slot_id: int
    lot_id: int
    user_email: str
    connector_type: str
    power_rating_kw: float
    initial_soc_pct: float
    target_soc_pct: float
    current_soc_pct: float
    energy_consumed_kwh: float
    energy_tariff_per_kwh_inr: float
    charging_fee_inr: float
    idle_overstay_fee_inr: float
    charging_status: str
    scheduled_start: datetime
    scheduled_end: datetime
    created_at: datetime


class EVStatusUpdateRequest(BaseModel):
    status: EVChargingStatus
    current_soc_pct: Optional[float] = None
    energy_consumed_kwh: Optional[float] = None


# ----------------------------------------------------------------------------
# 2. Monthly Parking Subscriptions
# ----------------------------------------------------------------------------
class SubscriptionCreateRequest(BaseModel):
    lot_id: int
    user_email: str
    plan_type: SubscriptionPlanType = SubscriptionPlanType.COMMUTER_WEEKDAY
    primary_vehicle_plate: str
    secondary_vehicle_plate: Optional[str] = None
    dedicated_slot_id: Optional[int] = None
    auto_renew: bool = True

    @field_validator("primary_vehicle_plate")
    @classmethod
    def clean_plate(cls, v: str) -> str:
        return v.strip().upper().replace(" ", "")


class ParkingSubscriptionResponse(BaseModel):
    id: int
    subscription_code: str
    user_email: str
    lot_id: int
    dedicated_slot_id: Optional[int] = None
    plan_type: str
    title: str
    primary_vehicle_plate: str
    secondary_vehicle_plate: Optional[str] = None
    monthly_fee_inr: float
    gst_inr: float
    total_fee_inr: float
    start_date: datetime
    end_date: datetime
    next_billing_date: datetime
    auto_renew: bool
    status: str
    pass_qr_code: str
    rfid_card_tag: Optional[str] = None
    created_at: datetime


# ----------------------------------------------------------------------------
# 3. Corporate Parking Accounts
# ----------------------------------------------------------------------------
class CorporateAccountCreateRequest(BaseModel):
    company_name: str
    corporate_code: str
    authorized_domain: str  # e.g., "infosys.com"
    gst_number: Optional[str] = None
    billing_contact_email: str
    monthly_credit_limit_inr: float = 250000.0
    allocated_daily_slots: int = 50


class CorporateAccountResponse(BaseModel):
    id: int
    company_name: str
    corporate_code: str
    authorized_domain: str
    gst_number: Optional[str] = None
    billing_contact_email: str
    monthly_credit_limit_inr: float
    current_month_spend_inr: float
    is_postpaid: bool
    allocated_daily_slots: int
    is_active: bool
    created_at: datetime


class CorporateMemberAddRequest(BaseModel):
    corporate_id: int
    employee_email: str
    employee_name: str
    employee_id_tag: str
    vehicle_plate: str
    monthly_stipend_inr: float = 5000.0


class CorporateMemberResponse(BaseModel):
    id: int
    corporate_id: int
    employee_email: str
    employee_name: str
    employee_id_tag: str
    monthly_stipend_inr: float
    current_month_used_inr: float
    vehicle_plate: str
    is_approved: bool
    created_at: datetime


# ----------------------------------------------------------------------------
# 4. Fleet Wallets
# ----------------------------------------------------------------------------
class FleetAccountCreateRequest(BaseModel):
    fleet_code: str
    fleet_name: str
    operator_email: str
    initial_deposit_inr: float = 50000.0
    auto_recharge_threshold_inr: float = 10000.0
    auto_recharge_amount_inr: float = 25000.0


class FleetAccountResponse(BaseModel):
    id: int
    fleet_code: str
    fleet_name: str
    operator_email: str
    wallet_balance_inr: float
    auto_recharge_threshold_inr: float
    auto_recharge_amount_inr: float
    is_active: bool
    created_at: datetime


class FleetVehicleRegisterRequest(BaseModel):
    fleet_id: int
    plate_number: str
    driver_name: str
    driver_phone: str
    daily_spend_limit_inr: float = 1500.0
    fastag_tag_id: Optional[str] = None


class FleetVehicleResponse(BaseModel):
    id: int
    fleet_id: int
    plate_number: str
    driver_name: str
    driver_phone: str
    daily_spend_limit_inr: float
    today_spent_inr: float
    fastag_tag_id: Optional[str] = None
    is_active: bool
    created_at: datetime


class FleetRechargeRequest(BaseModel):
    fleet_id: int
    amount_inr: float = Field(..., gt=0)
    description: str = "Corporate wallet top-up"


# ----------------------------------------------------------------------------
# 5. Group Parking Reservations
# ----------------------------------------------------------------------------
class GroupReservationCreateRequest(BaseModel):
    title: str
    host_email: str
    host_phone: str
    lot_id: int
    start_time: datetime
    end_time: datetime
    target_slots_count: int = Field(..., ge=2, le=100)
    payment_mode: GroupPaymentMode = GroupPaymentMode.HOST_PAYS_ALL


class GroupReservationResponse(BaseModel):
    id: int
    group_code: str
    title: str
    host_email: str
    host_phone: str
    lot_id: int
    start_time: datetime
    end_time: datetime
    target_slots_count: int
    confirmed_slots_count: int
    payment_mode: str
    total_estimated_amount_inr: float
    status: str
    created_at: datetime


class GroupGuestJoinRequest(BaseModel):
    guest_name: str
    guest_phone: str
    vehicle_plate: str


class GroupGuestResponse(BaseModel):
    id: int
    group_reservation_id: int
    guest_name: str
    guest_phone: str
    vehicle_plate: str
    assigned_slot_number: Optional[str] = None
    invitation_token: str
    has_checked_in: bool
    created_at: datetime


# ----------------------------------------------------------------------------
# 6. Event Parking
# ----------------------------------------------------------------------------
class ParkingEventCreateRequest(BaseModel):
    event_name: str
    venue_name: str
    lot_id: int
    event_date: datetime
    gates_open_time: datetime
    event_end_time: datetime
    total_allocated_bays: int = 200
    flat_event_fee_inr: float = 250.0
    shuttle_service_included: bool = True
    traffic_advisory: Optional[str] = "Heavy traffic expected. Please arrive 45 mins prior."


class ParkingEventResponse(BaseModel):
    id: int
    event_code: str
    event_name: str
    venue_name: str
    lot_id: int
    event_date: datetime
    gates_open_time: datetime
    event_end_time: datetime
    total_allocated_bays: int
    booked_bays_count: int
    flat_event_fee_inr: float
    shuttle_service_included: bool
    traffic_advisory: Optional[str] = None
    status: str
    created_at: datetime


class EventPassBookRequest(BaseModel):
    event_id: int
    user_email: str
    vehicle_plate: str
    assigned_entry_gate: str = "GATE-NORTH-A"


class EventPassResponse(BaseModel):
    id: int
    pass_code: str
    event_id: int
    user_email: str
    vehicle_plate: str
    assigned_entry_gate: str
    fee_paid_inr: float
    shuttle_pass_token: Optional[str] = None
    is_scanned: bool
    created_at: datetime


# ----------------------------------------------------------------------------
# 7. WhatsApp Booking Notifications
# ----------------------------------------------------------------------------
class WhatsAppSendNotificationRequest(BaseModel):
    recipient_phone: str
    template_name: str  # BOOKING_CONFIRMATION, ARRIVAL_REMINDER, OVERSTAY_ALERT, EXIT_RECEIPT
    language_code: str = "en"
    booking_reference: Optional[str] = None
    custom_params: Dict[str, str] = {}


class WhatsAppNotificationResponse(BaseModel):
    id: int
    message_sid: str
    booking_reference: Optional[str] = None
    recipient_phone: str
    template_name: str
    language_code: str
    message_body: str
    provider: str
    delivery_status: str
    is_mock_provider: bool
    disclaimer: str
    delivered_at: datetime
    created_at: datetime


# ----------------------------------------------------------------------------
# 8. Hindi and Regional Language Support
# ----------------------------------------------------------------------------
class LocalizationDictionaryResponse(BaseModel):
    locale: str
    translations_count: int
    strings: Dict[str, str]


# ----------------------------------------------------------------------------
# 9. Shared Parking Marketplace
# ----------------------------------------------------------------------------
class MarketplaceListingCreateRequest(BaseModel):
    host_name: str
    host_email: str
    host_phone: str
    title: str
    address: str
    city: str
    latitude: float
    longitude: float
    space_type: str = "RESIDENTIAL_DRIVEWAY"
    hourly_rate_inr: float = 40.0
    daily_rate_inr: float = 250.0
    access_instructions: Optional[str] = None
    is_ev_ready: bool = False


class MarketplaceListingResponse(BaseModel):
    id: int
    listing_code: str
    host_name: str
    host_email: str
    host_phone: str
    title: str
    address: str
    city: str
    latitude: float
    longitude: float
    space_type: str
    hourly_rate_inr: float
    daily_rate_inr: float
    platform_commission_pct: float
    access_instructions: Optional[str] = None
    is_ev_ready: bool
    kyc_verified: bool
    status: str
    created_at: datetime


class MarketplaceBookRequest(BaseModel):
    listing_id: int
    renter_name: str
    renter_email: str
    vehicle_plate: str
    start_time: datetime
    end_time: datetime


class MarketplaceBookingResponse(BaseModel):
    id: int
    booking_code: str
    listing_id: int
    renter_name: str
    renter_email: str
    vehicle_plate: str
    start_time: datetime
    end_time: datetime
    gross_amount_inr: float
    platform_fee_inr: float
    host_payout_inr: float
    status: str
    created_at: datetime


# ----------------------------------------------------------------------------
# 10. Parking Operator Multi-Location Management
# ----------------------------------------------------------------------------
class MultiLocationOverviewResponse(BaseModel):
    total_regions: int
    total_facilities: int
    total_network_slots: int
    occupied_network_slots: int
    network_occupancy_pct: float
    total_revenue_inr: float
    active_pricing_overrides: int
    regions: List[Dict[str, object]]


class RegionalPricingOverrideRequest(BaseModel):
    region_id: int
    global_surge_cap: float = Field(..., ge=1.0, le=3.0)
    activate_override: bool = True


# ----------------------------------------------------------------------------
# 11 & 13. Camera Streams & YOLO Occupancy Detection
# ----------------------------------------------------------------------------
class CameraStreamCreateRequest(BaseModel):
    lot_id: int
    camera_code: str
    zone_name: str = "Zone A"
    stream_url: str = "rtsp://cctv.local:8554/cam01"
    stream_protocol: str = "RTSP"
    resolution: str = "1080p"
    fps: int = 15
    privacy_redaction_enabled: bool = True


class CameraStreamResponse(BaseModel):
    id: int
    camera_code: str
    lot_id: int
    zone_name: str
    stream_url: str
    stream_protocol: str
    resolution: str
    fps: int
    status: str
    privacy_redaction_enabled: bool
    monitored_slots_json: Optional[str] = None
    last_heartbeat_at: datetime
    created_at: datetime


class YOLORunInferenceRequest(BaseModel):
    camera_id: int
    synthetic_benchmark: bool = True


class YOLODetectionResponse(BaseModel):
    id: int
    camera_id: int
    model_version: str
    inference_latency_ms: float
    detected_vehicles_count: int
    occupied_slots_count: int
    vacant_slots_count: int
    bounding_boxes: List[Dict[str, object]]
    privacy_audit_status: str
    is_synthetic_test: bool
    disclaimer: str
    created_at: datetime


# ----------------------------------------------------------------------------
# 12 & 14. ANPR & OCR Recognition Architecture
# ----------------------------------------------------------------------------
class ANPRScanRequest(BaseModel):
    lot_id: int
    camera_id: Optional[int] = None
    gate_lane: str = "LANE-ENTRY-01"
    lane_type: str = "ENTRY"
    captured_plate_raw: str
    confidence_override: Optional[float] = None


class ANPRScanResponse(BaseModel):
    id: int
    scan_code: str
    lot_id: int
    gate_lane: str
    lane_type: str
    captured_plate_raw: str
    normalized_plate: str
    confidence_score: float
    ocr_engine: str
    is_hsrp_compliant: bool
    decision: str
    human_verified: bool
    verified_by_staff_email: Optional[str] = None
    human_review_required: bool
    privacy_plate_hash: str
    disclaimer: str
    created_at: datetime


class ANPRHumanReviewResolveRequest(BaseModel):
    review_id: int
    action: str  # "APPROVE", "CORRECT", "REJECT"
    corrected_plate: Optional[str] = None
    reviewer_email: str
    notes: Optional[str] = None


# ----------------------------------------------------------------------------
# 15. Valet Service Support
# ----------------------------------------------------------------------------
class ValetCheckInRequest(BaseModel):
    lot_id: int
    customer_name: str
    customer_phone: str
    vehicle_plate: str
    vehicle_model: str = "Sedan"
    key_locker_tag: str = "LOCKER-B-14"
    assigned_slot_number: Optional[str] = "B-04"
    odometer_reading_km: float = 12450.0
    fuel_or_battery_level_pct: float = 75.0
    pre_existing_damage_notes: Optional[str] = "Minor front bumper scratch"


class ValetTicketResponse(BaseModel):
    id: int
    ticket_code: str
    lot_id: int
    booking_id: Optional[int] = None
    customer_name: str
    customer_phone: str
    vehicle_plate: str
    vehicle_model: str
    assigned_valet_name: str
    key_locker_tag: str
    assigned_slot_number: Optional[str] = None
    valet_fee_inr: float
    status: str
    odometer_reading_km: float
    fuel_or_battery_level_pct: float
    pre_existing_damage_notes: Optional[str] = None
    dropoff_time: datetime
    retrieval_requested_at: Optional[datetime] = None
    delivery_time: Optional[datetime] = None
    created_at: datetime


class ValetActionRequest(BaseModel):
    action: str  # "PARK", "REQUEST_RETRIEVAL", "START_TRANSIT", "DELIVER"
    notes: Optional[str] = None
