"""Strict Pydantic v2 Validation Schemas for Parkwise API."""
import re
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models import BookingStatus, PaymentStatus, SlotStatus, SlotType, UserRole

INDIAN_PLATE_REGEX = re.compile(r"^[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4}$")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    full_name: str
    email: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=4)


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
