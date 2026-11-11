"""Strict Pydantic v2 Validation Schemas for Parkwise API (Phases 01–04)."""
import re
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models import BookingStatus, PaymentStatus, SlotStatus, SlotType, UserRole

INDIAN_PLATE_REGEX = re.compile(
    r"^[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4}$"
)
TIME_HHMM_REGEX = re.compile(r"^([01][0-9]|2[0-3]):[0-5][0-9]$")


class VehicleItemResponse(BaseModel):
    id: int
    plate_number: str
    model_name: str
    size_class: str
    dimensions_label: str
    is_ev: bool
    fastag_id: str
    is_primary: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VehicleCreateRequest(BaseModel):
    plate_number: str = Field(..., min_length=6, max_length=24)
    model_name: str = Field(..., min_length=2, max_length=120)
    size_class: str = Field("SEDAN", pattern="^(COMPACT|SEDAN|SUV_XL)$")
    dimensions_label: str = Field("4.58m × 1.82m × 1.50m", max_length=64)
    is_ev: bool = False
    fastag_id: str = Field("FT-NPCI-ICICI-892104", max_length=60)
    is_primary: bool = False

    @field_validator("plate_number")
    @classmethod
    def validate_plate(cls, v: str) -> str:
        normalized = v.strip().upper()
        if not INDIAN_PLATE_REGEX.match(normalized):
            raise ValueError(
                "Invalid Indian vehicle registration format (e.g., MH-01-AB-1234 or DL-08-CAF-8921)"
            )
        return normalized


class SessionItemResponse(BaseModel):
    id: int
    session_token_jti: str
    ip_address: str
    user_agent: str
    device_label: str
    is_revoked: bool
    created_at: datetime
    expires_at: datetime
    last_active_at: datetime

    model_config = {"from_attributes": True}


class UserProfileResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str
    role: UserRole
    vehicle_number: Optional[str] = None
    fastag_id: Optional[str] = None
    home_city: str = "New Delhi"
    gst_number: Optional[str] = None
    email_verified: bool
    email_verification_token_preview: Optional[str] = None
    fastag_auto_debit: bool = True
    sms_receipts: bool = True
    whatsapp_alerts: bool = True
    accessible_priority: bool = False
    is_active: bool = True
    permissions: List[str] = []
    vehicles: List[VehicleItemResponse] = []
    created_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    session_jti: Optional[str] = None
    role: UserRole
    full_name: str
    email: str
    email_verified: bool = True
    permissions: List[str] = []
    user: Optional[UserProfileResponse] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=4, max_length=128)
    device_label: str = Field("Web Browser Session", max_length=120)


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field("DRIVER")
    vehicle_number: Optional[str] = None
    model_name: Optional[str] = "Tata Nexon EV Empowered+"
    size_class: str = Field("SEDAN", pattern="^(COMPACT|SEDAN|SUV_XL)$")
    is_ev: bool = False
    home_city: str = Field("New Delhi", max_length=80)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not any(ch.isdigit() for ch in v) or not any(ch.isalpha() for ch in v):
            raise ValueError("Password must contain both letters and numbers.")
        return v

    @field_validator("vehicle_number")
    @classmethod
    def validate_optional_plate(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        normalized = v.strip().upper()
        if not INDIAN_PLATE_REGEX.match(normalized):
            raise ValueError(
                "Invalid Indian RTO vehicle registration plate (e.g. DL-08-CAF-8921)."
            )
        return normalized


class EmailVerificationRequest(BaseModel):
    token: str = Field(..., min_length=6, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=6, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if not any(ch.isdigit() for ch in v) or not any(ch.isalpha() for ch in v):
            raise ValueError("New password must contain both letters and numbers.")
        return v


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    home_city: Optional[str] = Field(None, max_length=80)
    gst_number: Optional[str] = Field(None, max_length=32)
    fastag_auto_debit: Optional[bool] = None
    sms_receipts: Optional[bool] = None
    whatsapp_alerts: Optional[bool] = None
    accessible_priority: Optional[bool] = None
    role: Optional[str] = None


class AdminRoleUpdateRequest(BaseModel):
    role: UserRole


class AdminStatusUpdateRequest(BaseModel):
    is_active: bool
    reason: str = "Administrative status update"


# ----------------------------------------------------------------------------
# Phase 04 Inventory & Booking Engine Schemas
# ----------------------------------------------------------------------------
class ParkingOperatorResponse(BaseModel):
    id: int
    company_name: str
    gstin: str
    contact_email: str
    contact_phone: str
    kyc_verified: bool
    settlement_account: str

    model_config = {"from_attributes": True}


class VehicleCategoryResponse(BaseModel):
    id: int
    code: str
    name: str
    max_length_m: float
    max_width_m: float
    max_height_m: float
    rate_multiplier: float
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class ParkingFloorCreateRequest(BaseModel):
    floor_number: int = Field(..., ge=-5, le=20)
    floor_name: str = Field(..., min_length=2, max_length=80)
    clearance_height_m: float = Field(2.4, ge=1.8, le=5.0)
    total_bays: int = Field(8, ge=1, le=200)
    has_ev_chargers: bool = True


class ParkingFloorResponse(BaseModel):
    id: int
    lot_id: int
    floor_number: int
    floor_name: str
    clearance_height_m: float
    total_bays: int
    has_ev_chargers: bool

    model_config = {"from_attributes": True}


class ParkingZoneCreateRequest(BaseModel):
    floor_id: int = Field(..., gt=0)
    zone_code: str = Field(..., min_length=1, max_length=24)
    zone_name: str = Field(..., min_length=2, max_length=100)
    dedicated_category: str = Field("ALL", max_length=32)


class ParkingZoneResponse(BaseModel):
    id: int
    lot_id: int
    floor_id: int
    zone_code: str
    zone_name: str
    dedicated_category: str
    is_active: bool

    model_config = {"from_attributes": True}


class ParkingBayCreateRequest(BaseModel):
    slot_number: str = Field(..., min_length=2, max_length=24)
    floor: int = Field(1, ge=-5, le=20)
    zone: str = Field("A", min_length=1, max_length=24)
    slot_type: SlotType = SlotType.STANDARD
    vehicle_category_code: str = Field(
        "SEDAN", pattern="^(TWO_WHEELER|COMPACT|SEDAN|SUV_XL|EV_FOUR_WHEELER)$"
    )
    power_kw: Optional[float] = None
    custom_hourly_rate_inr: Optional[float] = Field(None, ge=10, le=2000)


class BayTypeAssignRequest(BaseModel):
    slot_type: SlotType
    vehicle_category_code: str = Field(
        "SEDAN", pattern="^(TWO_WHEELER|COMPACT|SEDAN|SUV_XL|EV_FOUR_WHEELER)$"
    )
    power_kw: Optional[float] = None
    custom_hourly_rate_inr: Optional[float] = Field(None, ge=10, le=2000)


class AvailabilityScheduleResponse(BaseModel):
    id: int
    lot_id: int
    day_of_week: int
    open_time: str
    close_time: str
    is_24_hours: bool
    is_closed: bool
    peak_start_time: str
    peak_end_time: str

    model_config = {"from_attributes": True}


class LocationOpeningHoursUpdateRequest(BaseModel):
    opening_time: str = Field("06:00", max_length=8)
    closing_time: str = Field("23:59", max_length=8)
    is_24_hours: bool = False
    grace_period_minutes: int = Field(15, ge=0, le=60)
    reservation_hold_minutes: int = Field(15, ge=5, le=60)
    peak_start_time: str = Field("09:00", max_length=8)
    peak_end_time: str = Field("20:00", max_length=8)

    @field_validator("opening_time", "closing_time", "peak_start_time", "peak_end_time")
    @classmethod
    def validate_hhmm(cls, v: str) -> str:
        if not TIME_HHMM_REGEX.match(v.strip()):
            raise ValueError("Time must be in HH:MM 24-hour format (e.g. 06:00 or 23:30).")
        return v.strip()


class PricingRuleCreateRequest(BaseModel):
    rule_name: str = Field(..., min_length=3, max_length=120)
    rule_type: str = Field(
        ...,
        pattern="^(PEAK_HOUR|WEEKEND_SURGE|EV_FAST_CHARGE|SUV_OVERSIZE|EARLY_BIRD_DISCOUNT|OVERSTAY_PENALTY)$",
    )
    multiplier: float = Field(1.0, ge=0.5, le=3.5)
    flat_surcharge_inr: float = Field(0.0, ge=0.0, le=2000.0)
    min_duration_hours: float = Field(0.0, ge=0.0, le=24.0)
    applies_to_slot_type: str = Field("ALL", max_length=32)


class PricingRuleResponse(BaseModel):
    id: int
    lot_id: int
    rule_name: str
    rule_type: str
    multiplier: float
    flat_surcharge_inr: float
    min_duration_hours: float
    applies_to_slot_type: str
    is_active: bool

    model_config = {"from_attributes": True}


class ParkingLocationCreateRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=32)
    name: str = Field(..., min_length=3, max_length=160)
    city: str = Field(..., min_length=2, max_length=80)
    address: str = Field(..., min_length=5, max_length=255)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    total_floors: int = Field(2, ge=1, le=15)
    base_hourly_rate_inr: float = Field(80.0, ge=10.0, le=1000.0)
    ev_surcharge_inr: float = Field(45.0, ge=0.0, le=500.0)
    operator_name: str = Field("Parkwise Metro Partner Pvt. Ltd.", max_length=140)
    is_24_hours: bool = True
    opening_time: str = "00:00"
    closing_time: str = "23:59"


class SlotResponse(BaseModel):
    id: int
    lot_id: int
    slot_number: str
    floor: int
    zone: str
    slot_type: SlotType
    vehicle_category_code: str = "SEDAN"
    status: SlotStatus
    sensor_health: str
    power_kw: Optional[float] = None
    custom_hourly_rate_inr: Optional[float] = None

    model_config = {"from_attributes": True}


class ParkingLotResponse(BaseModel):
    id: int
    code: str
    name: str
    city: str
    address: str
    latitude: float
    longitude: float
    total_floors: int
    base_hourly_rate_inr: float
    ev_surcharge_inr: float
    dynamic_pricing_enabled: bool
    current_surge_multiplier: float
    opening_time: str = "00:00"
    closing_time: str = "23:59"
    is_24_hours: bool = True
    grace_period_minutes: int = 15
    reservation_hold_minutes: int = 15
    anpr_enabled: bool
    fastag_enabled: bool
    operator_name: str
    kyc_verified: bool
    rating: float
    total_slots: int = 0
    available_slots: int = 0
    occupied_slots: int = 0
    reserved_slots: int = 0
    ev_slots_available: int = 0

    model_config = {"from_attributes": True}


class ParkingLotDetailResponse(ParkingLotResponse):
    slots: List[SlotResponse] = []
    floors: List[ParkingFloorResponse] = []
    zones: List[ParkingZoneResponse] = []
    pricing_rules: List[PricingRuleResponse] = []
    schedules: List[AvailabilityScheduleResponse] = []


class TimeRangeAvailabilityRequest(BaseModel):
    lot_id: int = Field(..., gt=0)
    start_time: datetime
    end_time: datetime
    slot_type: Optional[SlotType] = None
    vehicle_category: Optional[str] = None

    @field_validator("end_time")
    @classmethod
    def validate_range(cls, end_time: datetime, info) -> datetime:
        start_time = info.data.get("start_time")
        if start_time and end_time <= start_time:
            raise ValueError("end_time must be strictly after start_time")
        return end_time


class TimeRangeAvailabilityResponse(BaseModel):
    lot_id: int
    lot_code: str
    lot_name: str
    start_time: datetime
    end_time: datetime
    duration_hours: float
    is_within_opening_hours: bool
    total_matching_bays: int
    available_bay_count: int
    conflicting_bay_count: int
    available_bays: List[SlotResponse]
    conflicting_slot_ids: List[int]


class DurationAndQuoteRequest(BaseModel):
    lot_id: int = Field(..., gt=0)
    slot_id: int = Field(..., gt=0)
    start_time: datetime
    end_time: datetime
    vehicle_category: str = Field("SEDAN")
    include_valet_service: bool = False
    include_ev_fast_charge: bool = False
    overstay_minutes: int = Field(0, ge=0, le=1440)


class DurationAndQuoteResponse(BaseModel):
    lot_id: int
    slot_id: int
    slot_number: str
    duration_hours: float
    billable_hours: float
    base_hourly_rate_inr: float
    surge_multiplier: float
    base_tariff_inr: float
    ev_charging_fee_inr: float
    suv_oversize_fee_inr: float
    valet_or_amenity_fee_inr: float
    overstay_penalty_inr: float
    additional_charges_total_inr: float
    subtotal_before_tax_inr: float
    gst_18_pct_inr: float
    grand_total_inr: float
    applied_pricing_rules: List[str]


class AdditionalChargesRequest(BaseModel):
    actual_checkout_time: Optional[datetime] = None
    overstay_minutes: int = Field(0, ge=0, le=1440)
    ev_kwh_consumed: float = Field(0.0, ge=0.0, le=200.0)
    valet_cleaning_requested: bool = False
    lost_ticket_or_override_fee: bool = False


class BookingEventResponse(BaseModel):
    id: int
    booking_id: int
    booking_reference: str
    event_type: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BookingCreateRequest(BaseModel):
    lot_id: int = Field(..., gt=0)
    slot_id: int = Field(..., gt=0)
    vehicle_number: str = Field(..., min_length=6, max_length=20)
    vehicle_category: str = Field("SEDAN")
    driver_name: str = Field(..., min_length=2, max_length=120)
    driver_phone: str = Field(..., min_length=10, max_length=16)
    start_time: datetime
    end_time: datetime
    idempotency_key: Optional[str] = Field(None, min_length=4, max_length=80)

    @field_validator("vehicle_number")
    @classmethod
    def validate_indian_vehicle_plate(cls, v: str) -> str:
        normalized = v.strip().upper()
        if not INDIAN_PLATE_REGEX.match(normalized):
            raise ValueError(
                "Invalid Indian vehicle registration format (e.g., MH-01-AB-1234 or DL-08-CAF-8921)"
            )
        return normalized

    @field_validator("end_time")
    @classmethod
    def validate_time_order(cls, end_time: datetime, info) -> datetime:
        start_time = info.data.get("start_time")
        if start_time and end_time <= start_time:
            raise ValueError("end_time must be strictly after start_time")
        return end_time


class BookingExtendRequest(BaseModel):
    additional_hours: float = Field(..., gt=0, le=24)


class DriverRecommendationRequest(BaseModel):
    city: Optional[str] = None
    target_latitude: float = 28.6315
    target_longitude: float = 77.2167
    vehicle_size: str = Field("SEDAN", pattern="^(COMPACT|SEDAN|SUV_XL)$")
    requires_ev: bool = False
    requires_accessible: bool = False
    duration_hours: float = Field(2.0, gt=0, le=24)


class SlotRecommendationItem(BaseModel):
    lot_id: int
    lot_code: str
    lot_name: str
    city: str
    slot_id: int
    slot_number: str
    floor: int
    slot_type: SlotType
    distance_km: float
    estimated_total_inr: float
    match_score: float
    reasons: List[str]


class PaymentSummary(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    amount_inr: float
    currency: str
    payment_method: str
    upi_vpa: Optional[str] = None
    receipt_number: Optional[str] = None
    status: PaymentStatus
    is_simulated: bool
    refund_id: Optional[str] = None
    refund_amount_inr: float = 0.0
    refund_reason: Optional[str] = None
    refunded_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class QRPassResponse(BaseModel):
    id: int
    booking_id: int
    booking_reference: str
    token_jti: str
    qr_signature: str
    qr_payload: str
    issued_at: datetime
    expires_at: datetime
    entry_used_at: Optional[datetime] = None
    exit_used_at: Optional[datetime] = None
    is_revoked: bool
    revoked_reason: Optional[str] = None
    revoked_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BookingResponse(BaseModel):
    id: int
    booking_reference: str
    idempotency_key: Optional[str] = None
    lot_id: int
    slot_id: int
    slot_number: Optional[str] = None
    lot_name: Optional[str] = None
    city: Optional[str] = None
    vehicle_number: str
    vehicle_category: str = "SEDAN"
    driver_name: str
    driver_phone: str
    start_time: datetime
    end_time: datetime
    reservation_expires_at: Optional[datetime] = None
    duration_hours: float
    base_amount_inr: float
    surge_multiplier: float
    additional_charges_inr: float = 0.0
    gst_amount_inr: float
    total_amount_inr: float
    status: BookingStatus
    qr_signature: str
    qr_payload: str
    checked_in_at: Optional[datetime] = None
    checked_out_at: Optional[datetime] = None
    overstay_fee_inr: float = 0.0
    created_at: datetime
    payment: Optional[PaymentSummary] = None
    events: List[BookingEventResponse] = []
    qr_pass: Optional[QRPassResponse] = None

    model_config = {"from_attributes": True}


class PaymentOrderCreateRequest(BaseModel):
    booking_reference: str
    payment_method: str = Field("UPI / Razorpay Checkout", max_length=64)
    upi_vpa: Optional[str] = Field("driver.okaxis@upi", max_length=80)


class PaymentOrderResponse(BaseModel):
    booking_reference: str
    razorpay_key_id: str
    razorpay_order_id: str
    amount_inr: float
    amount_paise: int
    currency: str
    payment_method: str
    upi_vpa: Optional[str] = None
    upi_intent_uri: str
    status: PaymentStatus
    is_test_mode: bool = True
    test_payment_id_suggestion: str
    test_signature_preview: str


class PaymentVerifyRequest(BaseModel):
    booking_reference: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: Optional[str] = None
    payment_method: str = "UPI / FASTag Auto-Debit"
    upi_vpa: Optional[str] = None


class RazorpayWebhookRequest(BaseModel):
    webhook_event_id: str = Field(..., min_length=4, max_length=80)
    event_type: str = Field(
        ...,
        pattern="^(payment\\.captured|payment\\.failed|refund\\.processed)$",
    )
    razorpay_order_id: str
    razorpay_payment_id: str
    payment_method: str = "UPI / Webhook Auto-Capture"
    upi_vpa: Optional[str] = "npci.fastag@icici"
    refund_amount_inr: Optional[float] = None


class RazorpayWebhookResponse(BaseModel):
    webhook_event_id: str
    event_type: str
    idempotent_replay: bool
    signature_verified: bool
    booking_reference: str
    booking_status: str
    payment_status: str
    processed_at: datetime


class PaymentRefundRequest(BaseModel):
    refund_amount_inr: Optional[float] = Field(None, gt=0)
    reason: str = Field(
        "Customer requested cancellation / slot release refund",
        min_length=3,
        max_length=240,
    )


class PaymentReceiptResponse(BaseModel):
    receipt_number: str
    booking_reference: str
    issued_at: datetime
    lot_name: str
    lot_code: str
    city: str
    slot_number: str
    driver_name: str
    driver_phone: str
    vehicle_number: str
    sac_code: str = "996749"
    base_amount_inr: float
    additional_charges_inr: float
    overstay_fee_inr: float
    cgst_9_pct_inr: float
    sgst_9_pct_inr: float
    gst_total_inr: float
    total_paid_inr: float
    refund_amount_inr: float
    payment_method: str
    upi_vpa: Optional[str] = None
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    payment_status: str
    cryptographic_receipt_hash: str


class QRPassIssueRequest(BaseModel):
    ttl_minutes: int = Field(180, ge=5, le=1440)


class QRPassRevokeRequest(BaseModel):
    reason: str = Field(
        "Revoked by driver or security administrator",
        min_length=3,
        max_length=160,
    )


class QRPassVerifyRequest(BaseModel):
    booking_reference: str
    qr_signature: str
    token_jti: Optional[str] = None
    vehicle_number: Optional[str] = None
    action: str = Field("ENTRY", pattern="^(ENTRY|EXIT)$")


class GateScanRequest(BaseModel):
    lot_id: int
    booking_reference: str
    qr_signature: str
    token_jti: Optional[str] = None
    vehicle_number: str
    action: str = Field(..., pattern="^(ENTRY|EXIT)$")
    gate_lane: str = "LANE-01 (ANPR+FASTag)"


class GateScanResponse(BaseModel):
    allowed: bool
    barrier_status: str
    event_type: str
    booking_reference: str
    vehicle_number: str
    slot_number: str
    anpr_confidence: float
    overstay_fee_inr: float
    checked_in_at: Optional[datetime] = None
    checked_out_at: Optional[datetime] = None
    token_jti: Optional[str] = None
    message: str
    timestamp: datetime


class GateManualOverrideRequest(BaseModel):
    lot_id: int = Field(..., gt=0)
    booking_reference: Optional[str] = None
    vehicle_number: str = Field(..., min_length=6, max_length=20)
    barrier_action: str = Field("OPENED", pattern="^(OPENED|LOCKED)$")
    gate_lane: str = "LANE-01 (Manual Supervisor Override)"
    reason: str = Field(..., min_length=5, max_length=240)


class GateManualOverrideResponse(BaseModel):
    log_id: int
    lot_id: int
    booking_reference: Optional[str] = None
    vehicle_number: str
    barrier_action: str
    authorized_by_email: str
    authorized_by_role: str
    reason: str
    timestamp: datetime


class OfflineGateEventItem(BaseModel):
    client_event_id: str = Field(..., min_length=4, max_length=80)
    lot_id: int = Field(..., gt=0)
    booking_reference: str
    qr_signature: str
    token_jti: Optional[str] = None
    vehicle_number: str
    action: str = Field(..., pattern="^(ENTRY|EXIT)$")
    gate_lane: str = "LANE-01 (OFFLINE_QUEUE)"
    recorded_at: datetime


class OfflineGateSyncRequest(BaseModel):
    terminal_id: str = Field("GATE-TERM-DEL-01", max_length=64)
    events: List[OfflineGateEventItem]


class OfflineGateSyncResultItem(BaseModel):
    client_event_id: str
    booking_reference: str
    action: str
    sync_outcome: str  # SYNCED_APPLIED, IDEMPOTENT_ALREADY_SYNCED, CONFLICT_DUPLICATE_REPLAY, REJECTED_INVALID_SIGNATURE, REJECTED_EXPIRED_OR_REVOKED, REJECTED_UNPAID_BOOKING
    overstay_fee_inr: float = 0.0
    details: str


class OfflineGateSyncResponse(BaseModel):
    terminal_id: str
    total_submitted: int
    synced_count: int
    conflict_count: int
    rejected_count: int
    results: List[OfflineGateSyncResultItem]
    synced_at: datetime


class SlotStatusUpdateRequest(BaseModel):
    status: SlotStatus


class SurgeUpdateRequest(BaseModel):
    dynamic_pricing_enabled: bool
    current_surge_multiplier: float = Field(..., ge=1.0, le=3.0)


class AIForecastPoint(BaseModel):
    hour_label: str
    predicted_occupancy_pct: float
    recommended_multiplier: float
    confidence_score: float


class AIPricingRecommendationResponse(BaseModel):
    lot_id: int
    lot_name: str
    city: str
    model_architecture: str
    is_live_ml_inference: bool
    current_occupancy_pct: float
    recommended_surge_multiplier: float
    recommended_hourly_rate_inr: float
    anpr_readiness_score: float
    insight_summary: str
    hourly_forecast: List[AIForecastPoint]


# ----------------------------------------------------------------------------
# Phase 06: Parking Operator Dashboard, Staff Management & Reservation Control
# ----------------------------------------------------------------------------
class OperatorLotConfigUpdateRequest(BaseModel):
    base_hourly_rate_inr: Optional[float] = Field(None, ge=10.0, le=5000.0)
    ev_surcharge_inr: Optional[float] = Field(None, ge=0.0, le=2000.0)
    dynamic_pricing_enabled: Optional[bool] = None
    current_surge_multiplier: Optional[float] = Field(None, ge=1.0, le=3.0)
    opening_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    closing_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    is_24_hours: Optional[bool] = None
    grace_period_minutes: Optional[int] = Field(None, ge=0, le=180)
    reservation_hold_minutes: Optional[int] = Field(None, ge=5, le=120)


class OperatorReservationActionRequest(BaseModel):
    action: str = Field(
        ...,
        pattern="^(MARK_NO_SHOW|FORCE_CHECK_IN|FORCE_CHECK_OUT|CANCEL_AND_RELEASE|RECORD_OVERSTAY)$",
    )
    overstay_minutes: int = Field(0, ge=0, le=1440)
    notes: str = Field("Operator desk action", max_length=240)


class FacilityStaffCreateRequest(BaseModel):
    lot_id: int = Field(..., gt=0)
    employee_code: str = Field(..., min_length=4, max_length=32)
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(..., min_length=8, max_length=24)
    role_title: str = Field(..., min_length=3, max_length=80)
    shift_window: str = Field("08:00–16:00 IST (Day Shift)", max_length=64)
    assigned_zone: str = Field("All Floors & Gate Lanes", max_length=80)
    is_on_duty: bool = True


class FacilityStaffUpdateRequest(BaseModel):
    role_title: Optional[str] = Field(None, max_length=80)
    shift_window: Optional[str] = Field(None, max_length=64)
    assigned_zone: Optional[str] = Field(None, max_length=80)
    is_on_duty: Optional[bool] = None
    is_active: Optional[bool] = None


class FacilityStaffResponse(BaseModel):
    id: int
    lot_id: int
    lot_name: str
    employee_code: str
    full_name: str
    email: str
    phone: str
    role_title: str
    shift_window: str
    assigned_zone: str
    is_on_duty: bool
    is_active: bool
    created_at: datetime

