"""Phase 20: SQLAlchemy Models for Corporate Parking, Subscriptions & Multi-City Business Intelligence.

Entities:
1. EnterpriseCorporateAccount: Company profile with quotas, corporate domain, billing cycles & enterprise status.
2. EnterpriseCorporateEmployee: Employee roster linking users with corporate allowance, vehicle plate, policy (shared vs reserved).
3. EnterpriseCorporateInvoice: Monthly enterprise bill itemizing employee sessions, consumed hours, GST, discounts, and payment status.
4. ParkingSubscriptionPlan: Tiered recurring parking passes with access hours, validity days, days of week, and multi-facility rules.
5. EnterpriseUserSubscription: Driver/employee active subscriptions with auto-renew, expiry alerts, and payment failure handling.
6. MultiCityFacilityConfig: Regional cluster mappings, facility-level RBAC, and regional policy configurations.
7. AIBusinessInsight: Plain-language operational recommendations with explicit assumptions, impact projections, and mandatory operator approval guardrail.
"""

from datetime import datetime, timezone
import enum
from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import relationship

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class CorporateStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    DELINQUENT = "DELINQUENT"


class EmployeePolicyType(str, enum.Enum):
    SHARED_POOL = "SHARED_POOL"
    RESERVED_BAY = "RESERVED_BAY"
    EXECUTIVE_VIP = "EXECUTIVE_VIP"


class CorporateInvoiceStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    OVERDUE = "OVERDUE"
    FAILED = "FAILED"


class SubscriptionTier(str, enum.Enum):
    COMMUTER_SILVER = "COMMUTER_SILVER"
    UNLIMITED_GOLD = "UNLIMITED_GOLD"
    EXECUTIVE_PLATINUM = "EXECUTIVE_PLATINUM"
    ALL_CITY_ENTERPRISE = "ALL_CITY_ENTERPRISE"


class SubscriptionRenewalStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    RENEWED = "RENEWED"


class InsightCategory(str, enum.Enum):
    PRICING_OPTIMIZATION = "PRICING_OPTIMIZATION"
    CAPACITY_REALLOCATION = "CAPACITY_REALLOCATION"
    REVENUE_LEAKAGE_ALERT = "REVENUE_LEAKAGE_ALERT"
    SUB_UPSELL_OPPORTUNITY = "SUB_UPSELL_OPPORTUNITY"


class InsightApprovalStatus(str, enum.Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"


class EnterpriseCorporateAccount(Base):
    """Enterprise company account managing multi-employee parking quotas and billing."""
    __tablename__ = "enterprise_corporate_accounts"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(160), unique=True, index=True, nullable=False)
    gstin = Column(String(32), nullable=False)
    domain = Column(String(100), nullable=True)  # e.g. "infosys.com", "tcs.com"
    contact_email = Column(String(160), nullable=False)
    contact_phone = Column(String(30), nullable=False)
    billing_address = Column(String(255), nullable=False)
    monthly_quota_slots = Column(Integer, default=50, nullable=False)
    allocated_slots = Column(Integer, default=0, nullable=False)
    billing_cycle_day = Column(Integer, default=1, nullable=False)
    status = Column(String(30), default=CorporateStatus.ACTIVE.value, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    employees = relationship("EnterpriseCorporateEmployee", back_populates="corporate_account", cascade="all, delete-orphan")
    invoices = relationship("EnterpriseCorporateInvoice", back_populates="corporate_account", cascade="all, delete-orphan")


class EnterpriseCorporateEmployee(Base):
    """Enrolled corporate employee with assigned parking policy and monthly allowances."""
    __tablename__ = "enterprise_corporate_employees"

    id = Column(Integer, primary_key=True, index=True)
    corporate_id = Column(Integer, ForeignKey("enterprise_corporate_accounts.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    employee_id_code = Column(String(50), nullable=False)
    full_name = Column(String(120), nullable=False)
    email = Column(String(160), nullable=False)
    department = Column(String(80), default="Engineering", nullable=False)
    vehicle_plate = Column(String(30), nullable=False)
    parking_policy = Column(String(40), default=EmployeePolicyType.SHARED_POOL.value, nullable=False)
    reserved_slot_code = Column(String(30), nullable=True)
    monthly_allowance_hours = Column(Integer, default=160, nullable=False)
    used_hours_current_month = Column(Float, default=0.0, nullable=False)
    status = Column(String(30), default="ACTIVE", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    corporate_account = relationship("EnterpriseCorporateAccount", back_populates="employees")


class EnterpriseCorporateInvoice(Base):
    """Monthly corporate billing statement with itemized parking consumption and tax reconciliation."""
    __tablename__ = "enterprise_corporate_invoices"

    id = Column(Integer, primary_key=True, index=True)
    corporate_id = Column(Integer, ForeignKey("enterprise_corporate_accounts.id"), index=True, nullable=False)
    invoice_number = Column(String(50), unique=True, index=True, nullable=False)
    billing_period = Column(String(30), nullable=False)  # e.g. "November 2026"
    total_active_employees = Column(Integer, default=0, nullable=False)
    total_park_sessions = Column(Integer, default=0, nullable=False)
    total_hours_consumed = Column(Float, default=0.0, nullable=False)
    subtotal_inr = Column(Float, default=0.0, nullable=False)
    gst_amount_inr = Column(Float, default=0.0, nullable=False)
    discount_inr = Column(Float, default=0.0, nullable=False)
    total_payable_inr = Column(Float, default=0.0, nullable=False)
    payment_status = Column(String(30), default=CorporateInvoiceStatus.PENDING.value, nullable=False)
    payment_reference = Column(String(100), nullable=True)
    issued_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    corporate_account = relationship("EnterpriseCorporateAccount", back_populates="invoices")


class ParkingSubscriptionPlan(Base):
    """Recurring subscription tier defining access hours, validity, and multi-facility rules."""
    __tablename__ = "enterprise_subscription_plans"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    tier = Column(String(30), default=SubscriptionTier.UNLIMITED_GOLD.value, nullable=False)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=True)  # Nullable if multi-facility
    price_monthly_inr = Column(Float, nullable=False)
    validity_days = Column(Integer, default=30, nullable=False)
    access_hours_start = Column(String(10), default="00:00", nullable=False)
    access_hours_end = Column(String(10), default="23:59", nullable=False)
    allowed_days_json = Column(JSON, default=list, nullable=False)
    multi_facility = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    features_json = Column(JSON, default=list, nullable=False)

    facility = relationship("ParkingLot")
    subscriptions = relationship("EnterpriseUserSubscription", back_populates="plan")


class EnterpriseUserSubscription(Base):
    """Active or historical recurring parking subscription held by an individual driver or corporate user."""
    __tablename__ = "enterprise_user_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("enterprise_subscription_plans.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    vehicle_plate = Column(String(30), nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    auto_renew = Column(Boolean, default=True, nullable=False)
    renewal_status = Column(String(30), default=SubscriptionRenewalStatus.ACTIVE.value, nullable=False)
    days_remaining = Column(Integer, default=30, nullable=False)
    total_sessions_used = Column(Integer, default=0, nullable=False)
    grace_period_until = Column(DateTime(timezone=True), nullable=True)
    last_payment_reference = Column(String(100), nullable=True)
    failed_payment_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    plan = relationship("ParkingSubscriptionPlan", back_populates="subscriptions")
    user = relationship("User")


class MultiCityFacilityConfig(Base):
    """Regional and enterprise grouping configuration for multi-location facility administration."""
    __tablename__ = "enterprise_multicity_configs"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), unique=True, nullable=False)
    enterprise_group = Column(String(80), default="Parkwise National Grid", nullable=False)
    regional_cluster = Column(String(80), nullable=False)  # e.g. "Delhi-NCR", "Mumbai-Metropolitan", "Bengaluru-TechZone"
    manager_name = Column(String(120), default="Regional Operations Lead", nullable=False)
    manager_contact = Column(String(50), default="+91-9811002233", nullable=False)
    base_daily_cap_inr = Column(Float, default=500.0, nullable=False)
    overstay_penalty_per_hour_inr = Column(Float, default=100.0, nullable=False)
    corporate_quota_reserved = Column(Integer, default=40, nullable=False)

    facility = relationship("ParkingLot")


class AIBusinessInsight(Base):
    """Strategic AI operational recommendation with explicit assumptions and mandatory operator approval."""
    __tablename__ = "enterprise_ai_insights"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=True)
    city = Column(String(80), default="ALL", nullable=False)  # "Gurugram", "Delhi", "Mumbai", "Bengaluru", "ALL"
    category = Column(String(40), default=InsightCategory.PRICING_OPTIMIZATION.value, nullable=False)
    title = Column(String(160), nullable=False)
    plain_language_summary = Column(Text, nullable=False)
    data_assumptions = Column(JSON, default=list, nullable=False)
    projected_impact = Column(String(200), nullable=False)
    confidence_score = Column(Float, default=0.90, nullable=False)
    action_proposed = Column(String(160), nullable=False)
    action_payload = Column(JSON, default=dict, nullable=True)
    requires_operator_approval = Column(Boolean, default=True, nullable=False)
    approval_status = Column(String(30), default=InsightApprovalStatus.PENDING_APPROVAL.value, nullable=False)
    operator_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    facility = relationship("ParkingLot")


# Aliases for clean backward and forward compatibility
CorporateAccount = EnterpriseCorporateAccount
CorporateEmployee = EnterpriseCorporateEmployee
CorporateInvoice = EnterpriseCorporateInvoice
UserSubscription = EnterpriseUserSubscription
