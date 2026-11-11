"""Strict Pydantic v2 Validation Schemas for Parkwise API."""
import re
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models import BookingStatus, PaymentStatus, SlotStatus, SlotType, UserRole

INDIAN_PLATE_REGEX = re.compile(
    r"^[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4}$"
)


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
    role: Optional[str] = None  # Explicitly checked to block unauthorized role escalation


class AdminRoleUpdateRequest(BaseModel):
    role: UserRole


class AdminStatusUpdateRequest(BaseModel):
    is_active: bool
    reason: str = "Administrative status update"


class SlotResponse(BaseModel):
    id: int
    lot_id: int
    slot_number: str
    floor: int
    zone: str
    slot_type: SlotType
    status: SlotStatus
    sensor_health: str
    power_kw: Optional[float] = None

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


class BookingCreateRequest(BaseModel):
    lot_id: int = Field(..., gt=0)
    slot_id: int = Field(..., gt=0)
    vehicle_number: str = Field(..., min_length=6, max_length=20)
    driver_name: str = Field(..., min_length=2, max_length=120)
    driver_phone: str = Field(..., min_length=10, max_length=16)
    start_time: datetime
    end_time: datetime

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
    amount_inr: float
    currency: str
    payment_method: str
    status: PaymentStatus
    is_simulated: bool

    model_config = {"from_attributes": True}


class BookingResponse(BaseModel):
    id: int
    booking_reference: str
    lot_id: int
    slot_id: int
    slot_number: Optional[str] = None
    lot_name: Optional[str] = None
    city: Optional[str] = None
    vehicle_number: str
    driver_name: str
    driver_phone: str
    start_time: datetime
    end_time: datetime
    duration_hours: float
    base_amount_inr: float
    surge_multiplier: float
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

    model_config = {"from_attributes": True}


class PaymentVerifyRequest(BaseModel):
    booking_reference: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: Optional[str] = None
    payment_method: str = "UPI / FASTag Auto-Debit"


class GateScanRequest(BaseModel):
    lot_id: int
    booking_reference: str
    qr_signature: str
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
    message: str
    timestamp: datetime


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
