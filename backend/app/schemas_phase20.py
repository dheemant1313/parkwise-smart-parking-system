"""Phase 20: Pydantic Schemas for Corporate Parking, Subscriptions & Multi-City Business Intelligence."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ============================================================================
# CORPORATE ACCOUNTS & EMPLOYEES
# ============================================================================

class CorporateAccountCreate(BaseModel):
    company_name: str = Field(..., max_length=160, example="Infosys Tech Limited")
    gstin: str = Field(..., max_length=32, example="06AAACI1122D1Z5")
    domain: Optional[str] = Field(None, max_length=100, example="infosys.com")
    contact_email: str = Field(..., max_length=160, example="fleet@infosys.com")
    contact_phone: str = Field(..., max_length=30, example="+91-124-4900111")
    billing_address: str = Field(..., max_length=255, example="Plot 44, Electronic City, Gurugram, HR")
    monthly_quota_slots: int = Field(50, ge=1, le=1000)
    billing_cycle_day: int = Field(1, ge=1, le=28)


class CorporateQuotaUpdateRequest(BaseModel):
    monthly_quota_slots: Optional[int] = Field(None, ge=1, le=1000)
    status: Optional[str] = Field(None, example="ACTIVE")


class CorporateAccountResponse(BaseModel):
    id: int
    company_name: str
    gstin: str
    domain: Optional[str]
    contact_email: str
    contact_phone: str
    billing_address: str
    monthly_quota_slots: int
    allocated_slots: int
    remaining_slots: int
    billing_cycle_day: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class CorporateEmployeeInvite(BaseModel):
    employee_id_code: str = Field(..., max_length=50, example="EMP-8021")
    full_name: str = Field(..., max_length=120, example="Arjun Malhotra")
    email: str = Field(..., max_length=160, example="arjun.m@infosys.com")
    department: str = Field("Engineering", max_length=80, example="Cloud Infrastructure")
    vehicle_plate: str = Field(..., max_length=30, example="HR26DK9001")
    parking_policy: str = Field("SHARED_POOL", example="SHARED_POOL")  # SHARED_POOL, RESERVED_BAY, EXECUTIVE_VIP
    reserved_slot_code: Optional[str] = Field(None, max_length=30, example="B1-A04")
    monthly_allowance_hours: int = Field(160, ge=10, le=720)


class CorporateEmployeeStatusUpdate(BaseModel):
    status: Optional[str] = Field(None, example="ACTIVE")  # ACTIVE, SUSPENDED, OFFBOARDED
    parking_policy: Optional[str] = Field(None, example="RESERVED_BAY")
    reserved_slot_code: Optional[str] = Field(None, example="B1-A05")
    monthly_allowance_hours: Optional[int] = Field(None, ge=10, le=720)


class CorporateEmployeeResponse(BaseModel):
    id: int
    corporate_id: int
    user_id: Optional[int]
    employee_id_code: str
    full_name: str
    email: str
    department: str
    vehicle_plate: str
    parking_policy: str
    reserved_slot_code: Optional[str]
    monthly_allowance_hours: int
    used_hours_current_month: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# CORPORATE INVOICES & BILLING
# ============================================================================

class CorporateInvoiceGenerateRequest(BaseModel):
    billing_period: str = Field(..., max_length=30, example="November 2026")


class CorporateInvoicePayRequest(BaseModel):
    payment_reference: str = Field(..., max_length=100, example="NEFT-HDFC-994820124")


class CorporateInvoiceResponse(BaseModel):
    id: int
    corporate_id: int
    company_name: str
    invoice_number: str
    billing_period: str
    total_active_employees: int
    total_park_sessions: int
    total_hours_consumed: float
    subtotal_inr: float
    gst_amount_inr: float
    discount_inr: float
    total_payable_inr: float
    payment_status: str
    payment_reference: Optional[str]
    issued_at: datetime
    due_date: datetime
    paid_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============================================================================
# PARKING SUBSCRIPTIONS
# ============================================================================

class ParkingSubscriptionPlanCreate(BaseModel):
    code: str = Field(..., max_length=50, example="SUB-GOLD-CYBER-M")
    name: str = Field(..., max_length=100, example="CyberHub Unlimited Gold Pass")
    tier: str = Field("UNLIMITED_GOLD", example="UNLIMITED_GOLD")
    facility_id: Optional[int] = Field(None, example=1)
    price_monthly_inr: float = Field(..., gt=0, example=2999.0)
    validity_days: int = Field(30, ge=7, le=365)
    access_hours_start: str = Field("00:00", max_length=10, example="07:00")
    access_hours_end: str = Field("23:59", max_length=10, example="22:00")
    allowed_days: List[str] = Field(default_factory=lambda: ["MON", "TUE", "WED", "THU", "FRI"])
    multi_facility: bool = Field(False)
    features: List[str] = Field(default_factory=list)


class ParkingSubscriptionPlanResponse(BaseModel):
    id: int
    code: str
    name: str
    tier: str
    facility_id: Optional[int]
    facility_name: Optional[str]
    price_monthly_inr: float
    validity_days: int
    access_hours_start: str
    access_hours_end: str
    allowed_days: List[str]
    multi_facility: bool
    is_active: bool
    features: List[str]

    class Config:
        from_attributes = True


class UserSubscriptionPurchaseRequest(BaseModel):
    plan_id: int
    vehicle_plate: str = Field(..., max_length=30, example="DL3CCB4019")
    auto_renew: bool = Field(True)


class UserSubscriptionResponse(BaseModel):
    id: int
    plan_id: int
    plan_name: str
    tier: str
    user_id: int
    vehicle_plate: str
    facility_name: str
    start_date: datetime
    end_date: datetime
    auto_renew: bool
    renewal_status: str
    days_remaining: int
    total_sessions_used: int
    grace_period_until: Optional[datetime]
    last_payment_reference: Optional[str]
    failed_payment_reason: Optional[str]
    access_hours_start: str
    access_hours_end: str
    allowed_days: List[str]
    multi_facility: bool
    is_valid_now: bool

    class Config:
        from_attributes = True


class SubscriptionCancelRequest(BaseModel):
    reason: str = Field("Driver requested cancellation", max_length=200)


class SubscriptionPaymentFailureSimulateRequest(BaseModel):
    failure_reason: str = Field("Insufficient credit card limit during auto-debit", max_length=255)


# ============================================================================
# MULTI-LOCATION & OPERATOR BUSINESS INTELLIGENCE
# ============================================================================

class MultiCityFacilityConfigResponse(BaseModel):
    id: int
    facility_id: int
    facility_code: str
    facility_name: str
    city: str
    regional_cluster: str
    enterprise_group: str
    manager_name: str
    manager_contact: str
    base_daily_cap_inr: float
    overstay_penalty_per_hour_inr: float
    corporate_quota_reserved: int

    class Config:
        from_attributes = True


class MultiCitySummaryMetric(BaseModel):
    city: str
    total_facilities: int
    total_slots: int
    active_bookings: int
    occupancy_rate: float
    today_revenue_inr: float
    leakage_amount_inr: float


class PeakHourMetric(BaseModel):
    hour: str
    occupancy_pct: float
    status: str  # PEAK, NORMAL, LOW


class UnderusedZoneMetric(BaseModel):
    facility: str
    city: str
    zone: str
    level: str
    total_slots: int
    occupancy_pct: float
    recommendation: str


class RevenueLeakageMetric(BaseModel):
    category: str
    incident_count: int
    loss_inr: float
    status: str
    remedy: str


class ForecastedDemandDay(BaseModel):
    date: str
    day_name: str
    predicted_occupancy_pct: float
    confidence: float
    factor: str


class FacilityComparisonItem(BaseModel):
    facility_id: int
    facility_name: str
    city: str
    total_slots: int
    current_occupancy_pct: float
    monthly_revenue_inr: float
    overstay_count: int
    corporate_subscribers: int
    efficiency_score: float


class MultiFacilityBIAnalyticsResponse(BaseModel):
    consolidated_total_facilities: int
    consolidated_total_slots: int
    consolidated_occupancy_pct: float
    consolidated_monthly_revenue_inr: float
    consolidated_active_bookings: int
    consolidated_overstay_rate_pct: float
    consolidated_no_show_rate_pct: float
    consolidated_conversion_rate_pct: float
    consolidated_leakage_inr: float
    city_summaries: List[MultiCitySummaryMetric]
    peak_hours: List[PeakHourMetric]
    underused_zones: List[UnderusedZoneMetric]
    revenue_leakages: List[RevenueLeakageMetric]
    forecasted_demand_7d: List[ForecastedDemandDay]
    facility_comparisons: List[FacilityComparisonItem]


# ============================================================================
# AI BUSINESS INTELLIGENCE & OPERATOR GUARDRAILS
# ============================================================================

class AIBusinessInsightResponse(BaseModel):
    id: int
    facility_id: Optional[int]
    facility_name: Optional[str]
    city: str
    category: str
    title: str
    plain_language_summary: str
    data_assumptions: List[str]
    projected_impact: str
    confidence_score: float
    action_proposed: str
    action_payload: Optional[Dict[str, Any]]
    requires_operator_approval: bool
    approval_status: str
    operator_notes: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


class AIInsightApprovalRequest(BaseModel):
    decision: str = Field(..., example="APPROVED")  # APPROVED or REJECTED
    operator_notes: Optional[str] = Field("Approved by lead fleet & revenue controller", max_length=500)
