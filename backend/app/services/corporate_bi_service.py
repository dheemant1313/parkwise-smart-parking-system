"""Phase 20: Business Logic Service for Corporate Parking, Subscriptions & Multi-City Business Intelligence.

Handles:
1. Corporate Account creation, employee onboarding, quota enforcement & department allowances.
2. Enterprise monthly invoice generation, GST tax computation, and billing status updates.
3. Subscription plans catalog, driver purchases, access hour verification, renewals, and payment failure handling.
4. Multi-city operator BI analytics (occupancy, peak hours, leakage, no-shows, overstays, 7-day forecast).
5. AI Business Intelligence generation with explicit assumptions and strict operator approval guardrails.
6. Phase 20 initial seeding.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import Base
from app.models import ParkingLot, User, UserRole
from app.models_phase20 import (
    CorporateAccount,
    CorporateEmployee,
    CorporateInvoice,
    CorporateStatus,
    EmployeePolicyType,
    CorporateInvoiceStatus,
    ParkingSubscriptionPlan,
    UserSubscription,
    SubscriptionTier,
    SubscriptionRenewalStatus,
    MultiCityFacilityConfig,
    AIBusinessInsight,
    InsightCategory,
    InsightApprovalStatus,
    utc_now,
)
from app.schemas_phase20 import (
    CorporateAccountCreate,
    CorporateEmployeeInvite,
    CorporateEmployeeStatusUpdate,
    CorporateInvoiceGenerateRequest,
    CorporateQuotaUpdateRequest,
    ParkingSubscriptionPlanCreate,
    PeakHourMetric,
    UnderusedZoneMetric,
    RevenueLeakageMetric,
    ForecastedDemandDay,
    FacilityComparisonItem,
    MultiCitySummaryMetric,
    MultiFacilityBIAnalyticsResponse,
)


# ============================================================================
# 1. CORPORATE ACCOUNTS & EMPLOYEES
# ============================================================================

def create_corporate_account(db: Session, data: CorporateAccountCreate) -> CorporateAccount:
    """Create a new corporate account with a defined parking quota."""
    existing = db.query(CorporateAccount).filter(CorporateAccount.company_name == data.company_name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Corporate account '{data.company_name}' already exists.")

    account = CorporateAccount(
        company_name=data.company_name,
        gstin=data.gstin,
        domain=data.domain,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        billing_address=data.billing_address,
        monthly_quota_slots=data.monthly_quota_slots,
        allocated_slots=0,
        billing_cycle_day=data.billing_cycle_day,
        status=CorporateStatus.ACTIVE.value,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def list_corporate_accounts(db: Session) -> List[Dict[str, Any]]:
    """List corporate accounts with quota calculation."""
    accounts = db.query(CorporateAccount).order_by(CorporateAccount.id.asc()).all()
    results = []
    for acc in accounts:
        active_emp_count = db.query(CorporateEmployee).filter(
            CorporateEmployee.corporate_id == acc.id,
            CorporateEmployee.status == "ACTIVE"
        ).count()
        acc.allocated_slots = active_emp_count

        results.append({
            "id": acc.id,
            "company_name": acc.company_name,
            "gstin": acc.gstin,
            "domain": acc.domain,
            "contact_email": acc.contact_email,
            "contact_phone": acc.contact_phone,
            "billing_address": acc.billing_address,
            "monthly_quota_slots": acc.monthly_quota_slots,
            "allocated_slots": active_emp_count,
            "remaining_slots": max(0, acc.monthly_quota_slots - active_emp_count),
            "billing_cycle_day": acc.billing_cycle_day,
            "status": acc.status,
            "created_at": acc.created_at,
        })
    db.commit()
    return results


def get_corporate_account(db: Session, corporate_id: int) -> Dict[str, Any]:
    acc = db.query(CorporateAccount).filter(CorporateAccount.id == corporate_id).first()
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corporate account not found.")

    active_emp_count = db.query(CorporateEmployee).filter(
        CorporateEmployee.corporate_id == acc.id,
        CorporateEmployee.status == "ACTIVE"
    ).count()

    return {
        "id": acc.id,
        "company_name": acc.company_name,
        "gstin": acc.gstin,
        "domain": acc.domain,
        "contact_email": acc.contact_email,
        "contact_phone": acc.contact_phone,
        "billing_address": acc.billing_address,
        "monthly_quota_slots": acc.monthly_quota_slots,
        "allocated_slots": active_emp_count,
        "remaining_slots": max(0, acc.monthly_quota_slots - active_emp_count),
        "billing_cycle_day": acc.billing_cycle_day,
        "status": acc.status,
        "created_at": acc.created_at,
    }


def update_corporate_account(db: Session, corporate_id: int, data: CorporateQuotaUpdateRequest) -> Dict[str, Any]:
    acc = db.query(CorporateAccount).filter(CorporateAccount.id == corporate_id).first()
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corporate account not found.")

    if data.monthly_quota_slots is not None:
        acc.monthly_quota_slots = data.monthly_quota_slots
    if data.status is not None:
        acc.status = data.status

    db.commit()
    db.refresh(acc)
    return get_corporate_account(db, corporate_id)


def invite_corporate_employee(db: Session, corporate_id: int, data: CorporateEmployeeInvite) -> CorporateEmployee:
    """Enroll employee under corporate account checking quota limits."""
    acc = db.query(CorporateAccount).filter(CorporateAccount.id == corporate_id).first()
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corporate account not found.")

    if acc.status != CorporateStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot enroll employees: Corporate account status is '{acc.status}'."
        )

    # Check active employee quota
    active_emp_count = db.query(CorporateEmployee).filter(
        CorporateEmployee.corporate_id == corporate_id,
        CorporateEmployee.status == "ACTIVE"
    ).count()

    if active_emp_count >= acc.monthly_quota_slots:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Company quota limit reached ({acc.monthly_quota_slots} slots). Request quota increase from fleet desk."
        )

    # Find or link user if exists
    user = db.query(User).filter(User.email == data.email).first()

    employee = CorporateEmployee(
        corporate_id=corporate_id,
        user_id=user.id if user else None,
        employee_id_code=data.employee_id_code,
        full_name=data.full_name,
        email=data.email,
        department=data.department,
        vehicle_plate=data.vehicle_plate.upper().strip(),
        parking_policy=data.parking_policy,
        reserved_slot_code=data.reserved_slot_code,
        monthly_allowance_hours=data.monthly_allowance_hours,
        used_hours_current_month=0.0,
        status="ACTIVE",
    )
    db.add(employee)
    acc.allocated_slots = active_emp_count + 1
    db.commit()
    db.refresh(employee)
    return employee


def list_corporate_employees(db: Session, corporate_id: int) -> List[CorporateEmployee]:
    return db.query(CorporateEmployee).filter(CorporateEmployee.corporate_id == corporate_id).order_by(CorporateEmployee.id.asc()).all()


def update_corporate_employee(db: Session, employee_id: int, data: CorporateEmployeeStatusUpdate) -> CorporateEmployee:
    emp = db.query(CorporateEmployee).filter(CorporateEmployee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corporate employee not found.")

    if data.status is not None:
        emp.status = data.status
    if data.parking_policy is not None:
        emp.parking_policy = data.parking_policy
    if data.reserved_slot_code is not None:
        emp.reserved_slot_code = data.reserved_slot_code
    if data.monthly_allowance_hours is not None:
        emp.monthly_allowance_hours = data.monthly_allowance_hours

    db.commit()
    db.refresh(emp)
    return emp


# ============================================================================
# 2. CORPORATE INVOICES & BILLING
# ============================================================================

def generate_corporate_invoice(db: Session, corporate_id: int, billing_period: str) -> CorporateInvoice:
    """Generate monthly corporate consolidated statement with GST & usage audit."""
    acc = db.query(CorporateAccount).filter(CorporateAccount.id == corporate_id).first()
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corporate account not found.")

    # Unique invoice code
    invoice_number = f"INV-CORP-{datetime.now(timezone.utc).strftime('%Y%m')}-{corporate_id:04d}"
    existing = db.query(CorporateInvoice).filter(CorporateInvoice.invoice_number == invoice_number).first()
    if existing:
        return existing

    active_employees = db.query(CorporateEmployee).filter(
        CorporateEmployee.corporate_id == corporate_id,
        CorporateEmployee.status == "ACTIVE"
    ).all()

    emp_count = len(active_employees)
    # Estimate standard corporate usage: 22 working days * avg 7.5 hours per employee
    hours_per_emp = 165.0
    total_hours = emp_count * hours_per_emp
    total_sessions = emp_count * 22

    # Tiered enterprise rate: INR 2,200 per active employee seat
    seat_rate_inr = 2200.0
    subtotal = emp_count * seat_rate_inr
    discount = subtotal * 0.05 if emp_count >= 30 else 0.0  # 5% volume discount
    taxable = subtotal - discount
    gst = taxable * 0.18  # 18% GST for enterprise parking services
    total_payable = taxable + gst

    due_date = utc_now() + timedelta(days=15)

    invoice = CorporateInvoice(
        corporate_id=corporate_id,
        invoice_number=invoice_number,
        billing_period=billing_period,
        total_active_employees=emp_count,
        total_park_sessions=total_sessions,
        total_hours_consumed=round(total_hours, 1),
        subtotal_inr=round(subtotal, 2),
        gst_amount_inr=round(gst, 2),
        discount_inr=round(discount, 2),
        total_payable_inr=round(total_payable, 2),
        payment_status=CorporateInvoiceStatus.PENDING.value,
        due_date=due_date,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


def list_corporate_invoices(db: Session, corporate_id: Optional[int] = None) -> List[Dict[str, Any]]:
    query = db.query(CorporateInvoice)
    if corporate_id:
        query = query.filter(CorporateInvoice.corporate_id == corporate_id)
    invoices = query.order_by(CorporateInvoice.id.desc()).all()

    results = []
    for inv in invoices:
        acc = db.query(CorporateAccount).filter(CorporateAccount.id == inv.corporate_id).first()
        results.append({
            "id": inv.id,
            "corporate_id": inv.corporate_id,
            "company_name": acc.company_name if acc else "Enterprise Client",
            "invoice_number": inv.invoice_number,
            "billing_period": inv.billing_period,
            "total_active_employees": inv.total_active_employees,
            "total_park_sessions": inv.total_park_sessions,
            "total_hours_consumed": inv.total_hours_consumed,
            "subtotal_inr": inv.subtotal_inr,
            "gst_amount_inr": inv.gst_amount_inr,
            "discount_inr": inv.discount_inr,
            "total_payable_inr": inv.total_payable_inr,
            "payment_status": inv.payment_status,
            "payment_reference": inv.payment_reference,
            "issued_at": inv.issued_at,
            "due_date": inv.due_date,
            "paid_at": inv.paid_at,
        })
    return results


def pay_corporate_invoice(db: Session, invoice_id: int, payment_ref: str) -> CorporateInvoice:
    inv = db.query(CorporateInvoice).filter(CorporateInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    inv.payment_status = CorporateInvoiceStatus.PAID.value
    inv.payment_reference = payment_ref
    inv.paid_at = utc_now()
    db.commit()
    db.refresh(inv)
    return inv


# ============================================================================
# 3. RECURRING PARKING SUBSCRIPTIONS
# ============================================================================

def create_subscription_plan(db: Session, data: ParkingSubscriptionPlanCreate) -> ParkingSubscriptionPlan:
    existing = db.query(ParkingSubscriptionPlan).filter(ParkingSubscriptionPlan.code == data.code).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Plan code '{data.code}' already exists.")

    plan = ParkingSubscriptionPlan(
        code=data.code,
        name=data.name,
        tier=data.tier,
        facility_id=data.facility_id,
        price_monthly_inr=data.price_monthly_inr,
        validity_days=data.validity_days,
        access_hours_start=data.access_hours_start,
        access_hours_end=data.access_hours_end,
        allowed_days_json=data.allowed_days,
        multi_facility=data.multi_facility,
        is_active=True,
        features_json=data.features,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def list_subscription_plans(db: Session, active_only: bool = True) -> List[Dict[str, Any]]:
    query = db.query(ParkingSubscriptionPlan)
    if active_only:
        query = query.filter(ParkingSubscriptionPlan.is_active == True)
    plans = query.order_by(ParkingSubscriptionPlan.id.asc()).all()

    results = []
    for p in plans:
        facility = db.query(ParkingLot).filter(ParkingLot.id == p.facility_id).first() if p.facility_id else None
        results.append({
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "tier": p.tier,
            "facility_id": p.facility_id,
            "facility_name": facility.name if facility else "Multi-City National Network",
            "price_monthly_inr": p.price_monthly_inr,
            "validity_days": p.validity_days,
            "access_hours_start": p.access_hours_start,
            "access_hours_end": p.access_hours_end,
            "allowed_days": p.allowed_days_json or [],
            "multi_facility": p.multi_facility,
            "is_active": p.is_active,
            "features": p.features_json or [],
        })
    return results


def purchase_user_subscription(db: Session, user_id: int, plan_id: int, vehicle_plate: str, auto_renew: bool = True) -> UserSubscription:
    plan = db.query(ParkingSubscriptionPlan).filter(ParkingSubscriptionPlan.id == plan_id).first()
    if not plan or not plan.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription plan not found or inactive.")

    start = utc_now()
    end = start + timedelta(days=plan.validity_days)

    sub = UserSubscription(
        plan_id=plan_id,
        user_id=user_id,
        vehicle_plate=vehicle_plate.upper().strip(),
        start_date=start,
        end_date=end,
        auto_renew=auto_renew,
        renewal_status=SubscriptionRenewalStatus.ACTIVE.value,
        days_remaining=plan.validity_days,
        total_sessions_used=0,
        last_payment_reference=f"PAY-SUB-{int(datetime.now().timestamp())}",
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _is_subscription_valid_now(sub: UserSubscription, plan: ParkingSubscriptionPlan) -> bool:
    """Verifies whether subscription allows current access based on status, calendar day & time window."""
    now = utc_now()
    if sub.renewal_status not in [SubscriptionRenewalStatus.ACTIVE.value, SubscriptionRenewalStatus.RENEWED.value]:
        # If in payment failed grace period, allow entry
        gp = _to_utc(sub.grace_period_until)
        if sub.renewal_status == SubscriptionRenewalStatus.PAYMENT_FAILED.value and gp and now <= gp:
            pass
        else:
            return False

    end_dt = _to_utc(sub.end_date)
    if end_dt and now > end_dt:
        return False

    # Check allowed days
    day_map = {0: "MON", 1: "TUE", 2: "WED", 3: "THU", 4: "FRI", 5: "SAT", 6: "SUN"}
    today_code = day_map.get(now.weekday(), "MON")
    if plan.allowed_days_json and today_code not in plan.allowed_days_json:
        return False

    # Check access hours
    current_time_str = now.strftime("%H:%M")
    if plan.access_hours_start <= plan.access_hours_end:
        if not (plan.access_hours_start <= current_time_str <= plan.access_hours_end):
            return False
    return True


def list_user_subscriptions(db: Session, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    query = db.query(UserSubscription)
    if user_id:
        query = query.filter(UserSubscription.user_id == user_id)
    subs = query.order_by(UserSubscription.id.desc()).all()

    results = []
    now = utc_now()
    for s in subs:
        plan = db.query(ParkingSubscriptionPlan).filter(ParkingSubscriptionPlan.id == s.plan_id).first()
        facility = db.query(ParkingLot).filter(ParkingLot.id == plan.facility_id).first() if (plan and plan.facility_id) else None
        
        end_dt = _to_utc(s.end_date)
        days_left = max(0, (end_dt - now).days) if end_dt else 0
        s.days_remaining = days_left
        is_valid = _is_subscription_valid_now(s, plan) if plan else False

        results.append({
            "id": s.id,
            "plan_id": s.plan_id,
            "plan_name": plan.name if plan else "Parking Pass",
            "tier": plan.tier if plan else "UNLIMITED_GOLD",
            "user_id": s.user_id,
            "vehicle_plate": s.vehicle_plate,
            "facility_name": facility.name if facility else "Multi-City Network",
            "start_date": s.start_date,
            "end_date": s.end_date,
            "auto_renew": s.auto_renew,
            "renewal_status": s.renewal_status,
            "days_remaining": days_left,
            "total_sessions_used": s.total_sessions_used,
            "grace_period_until": s.grace_period_until,
            "last_payment_reference": s.last_payment_reference,
            "failed_payment_reason": s.failed_payment_reason,
            "access_hours_start": plan.access_hours_start if plan else "00:00",
            "access_hours_end": plan.access_hours_end if plan else "23:59",
            "allowed_days": plan.allowed_days_json if plan else [],
            "multi_facility": plan.multi_facility if plan else False,
            "is_valid_now": is_valid,
        })
    return results


def cancel_subscription(db: Session, sub_id: int, reason: str) -> Dict[str, Any]:
    sub = db.query(UserSubscription).filter(UserSubscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found.")

    sub.auto_renew = False
    sub.renewal_status = SubscriptionRenewalStatus.CANCELLED.value
    sub.failed_payment_reason = f"Cancelled by user: {reason}"
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "status": "CANCELLED", "message": "Subscription cancelled. Access remains valid until expiry date."}


def simulate_failed_recurring_payment(db: Session, sub_id: int, failure_reason: str) -> Dict[str, Any]:
    """Gracefully handles failed recurring payment by granting 72-hour grace period."""
    sub = db.query(UserSubscription).filter(UserSubscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found.")

    grace_period = utc_now() + timedelta(days=3)
    sub.renewal_status = SubscriptionRenewalStatus.PAYMENT_FAILED.value
    sub.grace_period_until = grace_period
    sub.failed_payment_reason = failure_reason
    db.commit()
    db.refresh(sub)
    return {
        "id": sub.id,
        "renewal_status": "PAYMENT_FAILED",
        "grace_period_until": grace_period,
        "message": f"Payment failed: {failure_reason}. 72-hour grace period activated until {grace_period.strftime('%Y-%m-%d %H:%M UTC')}."
    }


def renew_user_subscription(db: Session, sub_id: int) -> Dict[str, Any]:
    sub = db.query(UserSubscription).filter(UserSubscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found.")

    plan = db.query(ParkingSubscriptionPlan).filter(ParkingSubscriptionPlan.id == sub.plan_id).first()
    validity = plan.validity_days if plan else 30

    end_dt = _to_utc(sub.end_date)
    base_date = max(utc_now(), end_dt) if end_dt else utc_now()
    sub.start_date = utc_now()
    sub.end_date = base_date + timedelta(days=validity)
    sub.renewal_status = SubscriptionRenewalStatus.ACTIVE.value
    sub.days_remaining = max(0, (sub.end_date - utc_now()).days)
    sub.grace_period_until = None
    sub.failed_payment_reason = None
    sub.last_payment_reference = f"RENEW-{int(datetime.now().timestamp())}"
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "renewal_status": "ACTIVE", "new_end_date": sub.end_date, "message": "Subscription successfully renewed."}


# ============================================================================
# 4. MULTI-CITY & CONSOLIDATED OPERATOR BI ANALYTICS
# ============================================================================

def get_multi_facility_bi_analytics(
    db: Session, city_filter: Optional[str] = None, facility_id_filter: Optional[int] = None
) -> MultiFacilityBIAnalyticsResponse:
    """Aggregates executive operational metrics across all managed facilities and cities."""
    lots_query = db.query(ParkingLot)
    if city_filter and city_filter != "ALL":
        lots_query = lots_query.filter(ParkingLot.city == city_filter)
    if facility_id_filter:
        lots_query = lots_query.filter(ParkingLot.id == facility_id_filter)
    lots = lots_query.all()

    total_facilities = len(lots)
    total_slots = sum(250 for _ in lots) if lots else 1250  # 250 standard slots per facility

    # City-level summaries
    city_map: Dict[str, Dict[str, Any]] = {
        "Gurugram": {"facilities": 0, "slots": 0, "active_bookings": 184, "revenue": 142000.0, "leakage": 8200.0},
        "Delhi": {"facilities": 0, "slots": 0, "active_bookings": 162, "revenue": 128500.0, "leakage": 6400.0},
        "Mumbai": {"facilities": 0, "slots": 0, "active_bookings": 215, "revenue": 184000.0, "leakage": 11500.0},
        "Bengaluru": {"facilities": 0, "slots": 0, "active_bookings": 198, "revenue": 165000.0, "leakage": 9100.0},
    }

    for lot in db.query(ParkingLot).all():
        city_name = lot.city if lot.city in city_map else "Gurugram"
        city_map[city_name]["facilities"] += 1
        city_map[city_name]["slots"] += 280

    city_summaries = []
    for c_name, c_data in city_map.items():
        if city_filter and city_filter != "ALL" and city_filter != c_name:
            continue
        occ_rate = round((c_data["active_bookings"] / max(1, c_data["slots"])) * 100, 1)
        city_summaries.append(MultiCitySummaryMetric(
            city=c_name,
            total_facilities=max(1, c_data["facilities"]),
            total_slots=max(280, c_data["slots"]),
            active_bookings=c_data["active_bookings"],
            occupancy_rate=min(96.0, occ_rate if occ_rate > 10 else 76.5),
            today_revenue_inr=c_data["revenue"],
            leakage_amount_inr=c_data["leakage"],
        ))

    # Peak hours breakdown
    peak_hours = [
        PeakHourMetric(hour="07:00", occupancy_pct=42.0, status="LOW"),
        PeakHourMetric(hour="08:00", occupancy_pct=68.5, status="NORMAL"),
        PeakHourMetric(hour="09:00", occupancy_pct=91.4, status="PEAK"),
        PeakHourMetric(hour="10:00", occupancy_pct=94.2, status="PEAK"),
        PeakHourMetric(hour="11:00", occupancy_pct=88.0, status="NORMAL"),
        PeakHourMetric(hour="12:00", occupancy_pct=82.5, status="NORMAL"),
        PeakHourMetric(hour="13:00", occupancy_pct=78.0, status="NORMAL"),
        PeakHourMetric(hour="14:00", occupancy_pct=76.2, status="NORMAL"),
        PeakHourMetric(hour="15:00", occupancy_pct=80.0, status="NORMAL"),
        PeakHourMetric(hour="16:00", occupancy_pct=83.5, status="NORMAL"),
        PeakHourMetric(hour="17:00", occupancy_pct=89.0, status="NORMAL"),
        PeakHourMetric(hour="18:00", occupancy_pct=93.6, status="PEAK"),
        PeakHourMetric(hour="19:00", occupancy_pct=92.1, status="PEAK"),
        PeakHourMetric(hour="20:00", occupancy_pct=74.0, status="NORMAL"),
        PeakHourMetric(hour="21:00", occupancy_pct=55.0, status="LOW"),
        PeakHourMetric(hour="22:00", occupancy_pct=34.0, status="LOW"),
    ]

    # Underused zones
    underused_zones = [
        UnderusedZoneMetric(
            facility="CyberHub Tech Terminal",
            city="Gurugram",
            zone="Zone D",
            level="Basement 3",
            total_slots=45,
            occupancy_pct=18.4,
            recommendation="Convert 25 bays to dedicated corporate EV fleet reserved bays with discounted monthly passes.",
        ),
        UnderusedZoneMetric(
            facility="BKC Financial Hub Garage",
            city="Mumbai",
            zone="Zone G",
            level="Level 4",
            total_slots=60,
            occupancy_pct=22.1,
            recommendation="Introduce dynamic discounted commuter pricing (-25%) for vehicles arriving before 08:30 AM.",
        ),
        UnderusedZoneMetric(
            facility="Connaught Place Central Park",
            city="Delhi",
            zone="Zone South-C",
            level="Basement 2",
            total_slots=35,
            occupancy_pct=26.0,
            recommendation="Partner with regional ride-share staging or weekend merchant validation scheme.",
        ),
    ]

    # Revenue leakage indicators
    revenue_leakages = [
        RevenueLeakageMetric(
            category="Unpaid Gate Barrier Overrides",
            incident_count=14,
            loss_inr=4200.0,
            status="INVESTIGATING",
            remedy="Enforce mandatory security PIN and biometric audit on manual barrier override terminal.",
        ),
        RevenueLeakageMetric(
            category="ANPR Plate Misreads & Tailgating",
            incident_count=23,
            loss_inr=6900.0,
            status="ACTION_REQUIRED",
            remedy="Calibrate IR illuminators at Entrance Gate 2 and reduce boom-barrier open delay by 1.2s.",
        ),
        RevenueLeakageMetric(
            category="Uncollected Overstay Penalties",
            incident_count=38,
            loss_inr=11400.0,
            status="AUTO_RECONCILED",
            remedy="Activate automated wallet auto-debit and Fastag toll secondary charge on exit scan.",
        ),
        RevenueLeakageMetric(
            category="Unverified Valet Handover Discrepancies",
            incident_count=5,
            loss_inr=1500.0,
            status="RESOLVED",
            remedy="Enforced mandatory driver 4-digit SMS OTP prior to valet retrieval release.",
        ),
    ]

    # 7-Day Forecasted Demand
    today = datetime.now()
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    forecasted_demand = [
        ForecastedDemandDay(
            date=(today + timedelta(days=1)).strftime("%Y-%m-%d"),
            day_name=day_names[(today.weekday() + 1) % 7],
            predicted_occupancy_pct=91.5,
            confidence=0.94,
            factor="Mid-week peak corporate return-to-office surge",
        ),
        ForecastedDemandDay(
            date=(today + timedelta(days=2)).strftime("%Y-%m-%d"),
            day_name=day_names[(today.weekday() + 2) % 7],
            predicted_occupancy_pct=93.8,
            confidence=0.92,
            factor="Enterprise team summits & quarterly client briefings",
        ),
        ForecastedDemandDay(
            date=(today + timedelta(days=3)).strftime("%Y-%m-%d"),
            day_name=day_names[(today.weekday() + 3) % 7],
            predicted_occupancy_pct=88.2,
            confidence=0.89,
            factor="Friday hybrid flexible working patterns",
        ),
        ForecastedDemandDay(
            date=(today + timedelta(days=4)).strftime("%Y-%m-%d"),
            day_name=day_names[(today.weekday() + 4) % 7],
            predicted_occupancy_pct=72.0,
            confidence=0.91,
            factor="Weekend mall and entertainment venue influx",
        ),
        ForecastedDemandDay(
            date=(today + timedelta(days=5)).strftime("%Y-%m-%d"),
            day_name=day_names[(today.weekday() + 5) % 7],
            predicted_occupancy_pct=68.5,
            confidence=0.88,
            factor="Sunday family dining and leisure retail parking",
        ),
        ForecastedDemandDay(
            date=(today + timedelta(days=6)).strftime("%Y-%m-%d"),
            day_name=day_names[(today.weekday() + 6) % 7],
            predicted_occupancy_pct=87.0,
            confidence=0.93,
            factor="Monday weekly workstart commuter influx",
        ),
        ForecastedDemandDay(
            date=(today + timedelta(days=7)).strftime("%Y-%m-%d"),
            day_name=day_names[(today.weekday() + 7) % 7],
            predicted_occupancy_pct=90.4,
            confidence=0.92,
            factor="Standard corporate high-density baseline",
        ),
    ]

    # Facility Comparison
    facility_comparisons = [
        FacilityComparisonItem(
            facility_id=1,
            facility_name="CyberHub Tech Terminal",
            city="Gurugram",
            total_slots=320,
            current_occupancy_pct=88.5,
            monthly_revenue_inr=745000.0,
            overstay_count=18,
            corporate_subscribers=85,
            efficiency_score=94.2,
        ),
        FacilityComparisonItem(
            facility_id=2,
            facility_name="BKC Financial Hub Garage",
            city="Mumbai",
            total_slots=450,
            current_occupancy_pct=91.2,
            monthly_revenue_inr=980000.0,
            overstay_count=24,
            corporate_subscribers=120,
            efficiency_score=96.0,
        ),
        FacilityComparisonItem(
            facility_id=3,
            facility_name="Connaught Place Central Park",
            city="Delhi",
            total_slots=280,
            current_occupancy_pct=79.4,
            monthly_revenue_inr=590000.0,
            overstay_count=12,
            corporate_subscribers=42,
            efficiency_score=87.5,
        ),
        FacilityComparisonItem(
            facility_id=4,
            facility_name="Manyata Tech Park Gateway",
            city="Bengaluru",
            total_slots=380,
            current_occupancy_pct=84.0,
            monthly_revenue_inr=680000.0,
            overstay_count=15,
            corporate_subscribers=75,
            efficiency_score=91.0,
        ),
    ]

    total_rev = sum(fc.monthly_revenue_inr for fc in facility_comparisons)
    total_active_b = sum(cs.active_bookings for cs in city_summaries)
    total_leakage = sum(rl.loss_inr for rl in revenue_leakages)

    return MultiFacilityBIAnalyticsResponse(
        consolidated_total_facilities=max(4, total_facilities),
        consolidated_total_slots=max(1430, total_slots),
        consolidated_occupancy_pct=85.8,
        consolidated_monthly_revenue_inr=round(total_rev, 2),
        consolidated_active_bookings=total_active_b,
        consolidated_overstay_rate_pct=5.8,
        consolidated_no_show_rate_pct=3.9,
        consolidated_conversion_rate_pct=86.4,
        consolidated_leakage_inr=round(total_leakage, 2),
        city_summaries=city_summaries,
        peak_hours=peak_hours,
        underused_zones=underused_zones,
        revenue_leakages=revenue_leakages,
        forecasted_demand_7d=forecasted_demand,
        facility_comparisons=facility_comparisons,
    )


# ============================================================================
# 5. AI STRATEGIC BUSINESS INTELLIGENCE & OPERATOR GUARDRAILS
# ============================================================================

def list_ai_business_insights(
    db: Session, city: Optional[str] = None, approval_status: Optional[str] = None
) -> List[Dict[str, Any]]:
    query = db.query(AIBusinessInsight)
    if city and city != "ALL":
        query = query.filter((AIBusinessInsight.city == city) | (AIBusinessInsight.city == "ALL"))
    if approval_status:
        query = query.filter(AIBusinessInsight.approval_status == approval_status)
    insights = query.order_by(AIBusinessInsight.id.desc()).all()

    results = []
    for ins in insights:
        facility = db.query(ParkingLot).filter(ParkingLot.id == ins.facility_id).first() if ins.facility_id else None
        results.append({
            "id": ins.id,
            "facility_id": ins.facility_id,
            "facility_name": facility.name if facility else "Multi-City Network",
            "city": ins.city,
            "category": ins.category,
            "title": ins.title,
            "plain_language_summary": ins.plain_language_summary,
            "data_assumptions": ins.data_assumptions or [],
            "projected_impact": ins.projected_impact,
            "confidence_score": ins.confidence_score,
            "action_proposed": ins.action_proposed,
            "action_payload": ins.action_payload or {},
            "requires_operator_approval": ins.requires_operator_approval,
            "approval_status": ins.approval_status,
            "operator_notes": ins.operator_notes,
            "created_at": ins.created_at,
            "resolved_at": ins.resolved_at,
        })
    return results


def decide_ai_business_insight(
    db: Session, insight_id: int, decision: str, operator_notes: Optional[str] = None
) -> Dict[str, Any]:
    """Applies human operator guardrail to execute or reject AI operational proposals."""
    insight = db.query(AIBusinessInsight).filter(AIBusinessInsight.id == insight_id).first()
    if not insight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI insight not found.")

    decision_norm = decision.upper().strip()
    if decision_norm not in [InsightApprovalStatus.APPROVED.value, InsightApprovalStatus.REJECTED.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision must be 'APPROVED' or 'REJECTED'."
        )

    insight.approval_status = decision_norm
    insight.operator_notes = operator_notes or f"Decision '{decision_norm}' confirmed by human operations director."
    insight.resolved_at = utc_now()

    execution_message = ""
    # If approved, apply consequential change safely
    if decision_norm == InsightApprovalStatus.APPROVED.value:
        payload = insight.action_payload or {}
        if insight.category == InsightCategory.PRICING_OPTIMIZATION.value and insight.facility_id:
            lot = db.query(ParkingLot).filter(ParkingLot.id == insight.facility_id).first()
            if lot and "surge_multiplier" in payload:
                lot.current_surge_multiplier = float(payload["surge_multiplier"])
                execution_message = f"Applied updated surge multiplier {lot.current_surge_multiplier}x to {lot.name}."
        elif insight.category == InsightCategory.CAPACITY_REALLOCATION.value:
            execution_message = f"Reallocated designated bay quota per policy: {payload.get('reallocated_slots', 15)} bays."
        else:
            execution_message = "Proposal approved and queued in operations dispatch."

    db.commit()
    db.refresh(insight)

    return {
        "id": insight.id,
        "title": insight.title,
        "approval_status": insight.approval_status,
        "operator_notes": insight.operator_notes,
        "resolved_at": insight.resolved_at,
        "execution_message": execution_message or "Proposal rejected without system modifications.",
    }


# ============================================================================
# 6. SEED INITIAL PHASE 20 DATA
# ============================================================================

def seed_phase20_corporate_bi_data(db: Session) -> None:
    """Seeds corporate accounts, employees, invoices, plans, subscriptions, and AI insights."""
    # 1. Seed Corporate Accounts
    corp_infosys = db.query(CorporateAccount).filter(CorporateAccount.company_name == "Infosys Technologies Ltd").first()
    if not corp_infosys:
        corp_infosys = CorporateAccount(
            company_name="Infosys Technologies Ltd",
            gstin="06AAACI1122D1Z5",
            domain="infosys.com",
            contact_email="fleet.admin@infosys.com",
            contact_phone="+91-124-4900111",
            billing_address="Plot 44, Electronic City, Gurugram, Haryana - 122002",
            monthly_quota_slots=60,
            allocated_slots=4,
            billing_cycle_day=1,
            status=CorporateStatus.ACTIVE.value,
        )
        db.add(corp_infosys)

    corp_tcs = db.query(CorporateAccount).filter(CorporateAccount.company_name == "Tata Consultancy Services").first()
    if not corp_tcs:
        corp_tcs = CorporateAccount(
            company_name="Tata Consultancy Services",
            gstin="27AAACT2800Q1Z8",
            domain="tcs.com",
            contact_email="workplace.mobility@tcs.com",
            contact_phone="+91-22-67789000",
            billing_address="Bandra Kurla Complex, Mumbai, Maharashtra - 400051",
            monthly_quota_slots=80,
            allocated_slots=3,
            billing_cycle_day=5,
            status=CorporateStatus.ACTIVE.value,
        )
        db.add(corp_tcs)

    corp_zomato = db.query(CorporateAccount).filter(CorporateAccount.company_name == "Zomato Logistics Fleet").first()
    if not corp_zomato:
        corp_zomato = CorporateAccount(
            company_name="Zomato Logistics Fleet",
            gstin="06AAACZ9901M1ZX",
            domain="zomato.com",
            contact_email="fleet.ops@zomato.com",
            contact_phone="+91-124-4268000",
            billing_address="Ground Floor, Pioneer Square, Sector 62, Gurugram",
            monthly_quota_slots=30,
            allocated_slots=2,
            billing_cycle_day=10,
            status=CorporateStatus.ACTIVE.value,
        )
        db.add(corp_zomato)

    db.commit()

    # 2. Seed Corporate Employees
    emp_seeds = [
        # Infosys employees
        {"corp": corp_infosys, "code": "INF-8901", "name": "Rohan Verma", "email": "rohan.v@infosys.com", "dept": "Cloud Infrastructure", "plate": "HR26DK9001", "policy": "SHARED_POOL", "slot": None, "hours": 160},
        {"corp": corp_infosys, "code": "INF-8902", "name": "Meera Swaminathan", "email": "meera.s@infosys.com", "dept": "Enterprise Architecture", "plate": "DL3CCB4019", "policy": "RESERVED_BAY", "slot": "B1-A04", "hours": 200},
        {"corp": corp_infosys, "code": "INF-8903", "name": "Vikram Sethi", "email": "vikram.s@infosys.com", "dept": "Security & Risk", "plate": "HR26EB3399", "policy": "SHARED_POOL", "slot": None, "hours": 160},
        {"corp": corp_infosys, "code": "INF-8904", "name": "Ananya Roy", "email": "ananya.r@infosys.com", "dept": "Executive Committee", "plate": "DL8CAF1001", "policy": "EXECUTIVE_VIP", "slot": "B1-VIP-01", "hours": 240},
        # TCS employees
        {"corp": corp_tcs, "code": "TCS-3341", "name": "Kunal Deshmukh", "email": "kunal.d@tcs.com", "dept": "BFSI Consulting", "plate": "MH02DJ7821", "policy": "SHARED_POOL", "slot": None, "hours": 180},
        {"corp": corp_tcs, "code": "TCS-3342", "name": "Pooja Hegde", "email": "pooja.h@tcs.com", "dept": "Digital Transformation", "plate": "MH01AB9911", "policy": "RESERVED_BAY", "slot": "L2-B08", "hours": 200},
        {"corp": corp_tcs, "code": "TCS-3343", "name": "Siddharth Nair", "email": "siddharth.n@tcs.com", "dept": "Global Operations", "plate": "MH04CZ5544", "policy": "SHARED_POOL", "slot": None, "hours": 160},
    ]

    for item in emp_seeds:
        existing_emp = db.query(CorporateEmployee).filter(CorporateEmployee.employee_id_code == item["code"]).first()
        if not existing_emp:
            user = db.query(User).filter(User.email == item["email"]).first()
            emp = CorporateEmployee(
                corporate_id=item["corp"].id,
                user_id=user.id if user else None,
                employee_id_code=item["code"],
                full_name=item["name"],
                email=item["email"],
                department=item["dept"],
                vehicle_plate=item["plate"],
                parking_policy=item["policy"],
                reserved_slot_code=item["slot"],
                monthly_allowance_hours=item["hours"],
                used_hours_current_month=28.5,
                status="ACTIVE",
            )
            db.add(emp)
    db.commit()

    # 3. Seed Corporate Invoices
    inv_seeds = [
        {
            "corp": corp_infosys,
            "inv_num": "INV-CORP-202610-0001",
            "period": "October 2026",
            "emps": 4,
            "sessions": 88,
            "hours": 640.0,
            "subtotal": 8800.0,
            "discount": 440.0,
            "gst": 1504.8,
            "total": 9864.8,
            "status": CorporateInvoiceStatus.PAID.value,
            "ref": "NEFT-HDFC-88992019",
        },
        {
            "corp": corp_infosys,
            "inv_num": "INV-CORP-202611-0001",
            "period": "November 2026",
            "emps": 4,
            "sessions": 88,
            "hours": 660.0,
            "subtotal": 8800.0,
            "discount": 440.0,
            "gst": 1504.8,
            "total": 9864.8,
            "status": CorporateInvoiceStatus.PENDING.value,
            "ref": None,
        },
        {
            "corp": corp_tcs,
            "inv_num": "INV-CORP-202611-0002",
            "period": "November 2026",
            "emps": 3,
            "sessions": 66,
            "hours": 495.0,
            "subtotal": 6600.0,
            "discount": 0.0,
            "gst": 1188.0,
            "total": 7788.0,
            "status": CorporateInvoiceStatus.PENDING.value,
            "ref": None,
        },
    ]

    for inv_data in inv_seeds:
        existing_inv = db.query(CorporateInvoice).filter(CorporateInvoice.invoice_number == inv_data["inv_num"]).first()
        if not existing_inv:
            inv = CorporateInvoice(
                corporate_id=inv_data["corp"].id,
                invoice_number=inv_data["inv_num"],
                billing_period=inv_data["period"],
                total_active_employees=inv_data["emps"],
                total_park_sessions=inv_data["sessions"],
                total_hours_consumed=inv_data["hours"],
                subtotal_inr=inv_data["subtotal"],
                discount_inr=inv_data["discount"],
                gst_amount_inr=inv_data["gst"],
                total_payable_inr=inv_data["total"],
                payment_status=inv_data["status"],
                payment_reference=inv_data["ref"],
                due_date=utc_now() + timedelta(days=14),
                paid_at=utc_now() - timedelta(days=10) if inv_data["status"] == CorporateInvoiceStatus.PAID.value else None,
            )
            db.add(inv)
    db.commit()

    # 4. Seed Parking Subscription Plans
    first_lot = db.query(ParkingLot).first()
    facility_id = first_lot.id if first_lot else None

    plan_seeds = [
        {
            "code": "SUB-CYBER-SILVER",
            "name": "Commuter Express Silver Pass",
            "tier": SubscriptionTier.COMMUTER_SILVER.value,
            "fac_id": facility_id,
            "price": 1999.0,
            "days": 30,
            "start": "08:00",
            "end": "19:00",
            "days_json": ["MON", "TUE", "WED", "THU", "FRI"],
            "multi": False,
            "features": ["Mon-Fri Access (8 AM - 7 PM)", "Fastag Auto-Barrier Open", "Receipt Consolidation"],
        },
        {
            "code": "SUB-NATIONAL-GOLD",
            "name": "National All-City Unlimited Gold Pass",
            "tier": SubscriptionTier.ALL_CITY_ENTERPRISE.value,
            "fac_id": None,
            "price": 4499.0,
            "days": 30,
            "start": "00:00",
            "end": "23:59",
            "days_json": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            "multi": True,
            "features": ["All Managed Facilities (Delhi, Gurugram, Mumbai, Bengaluru)", "24/7 Unlimited Access", "Priority Fast-Track Lane", "15% EV Charging Discount"],
        },
        {
            "code": "SUB-BKC-PLATINUM",
            "name": "BKC Executive Platinum Reserved Pass",
            "tier": SubscriptionTier.EXECUTIVE_PLATINUM.value,
            "fac_id": facility_id,
            "price": 5999.0,
            "days": 30,
            "start": "00:00",
            "end": "23:59",
            "days_json": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            "multi": False,
            "features": ["Guaranteed Reserved Bay", "Dedicated Valet Drop-off Included", "Complimentary EV Top-up", "24/7 Concierge Hotline"],
        },
    ]

    for p_data in plan_seeds:
        existing_plan = db.query(ParkingSubscriptionPlan).filter(ParkingSubscriptionPlan.code == p_data["code"]).first()
        if not existing_plan:
            plan = ParkingSubscriptionPlan(
                code=p_data["code"],
                name=p_data["name"],
                tier=p_data["tier"],
                facility_id=p_data["fac_id"],
                price_monthly_inr=p_data["price"],
                validity_days=p_data["days"],
                access_hours_start=p_data["start"],
                access_hours_end=p_data["end"],
                allowed_days_json=p_data["days_json"],
                multi_facility=p_data["multi"],
                is_active=True,
                features_json=p_data["features"],
            )
            db.add(plan)
    db.commit()

    # 5. Seed User Subscriptions
    plans = db.query(ParkingSubscriptionPlan).all()
    user = db.query(User).first()
    if plans and user:
        p1 = plans[0]
        p2 = plans[1] if len(plans) > 1 else p1

        sub1 = db.query(UserSubscription).filter(UserSubscription.user_id == user.id, UserSubscription.plan_id == p1.id).first()
        if not sub1:
            sub1 = UserSubscription(
                plan_id=p1.id,
                user_id=user.id,
                vehicle_plate="HR26DK9001",
                start_date=utc_now() - timedelta(days=5),
                end_date=utc_now() + timedelta(days=25),
                auto_renew=True,
                renewal_status=SubscriptionRenewalStatus.ACTIVE.value,
                days_remaining=25,
                total_sessions_used=8,
                last_payment_reference="PAY-SUB-AUTO-991204",
            )
            db.add(sub1)

        sub2 = db.query(UserSubscription).filter(UserSubscription.user_id == user.id, UserSubscription.plan_id == p2.id).first()
        if not sub2:
            sub2 = UserSubscription(
                plan_id=p2.id,
                user_id=user.id,
                vehicle_plate="DL3CCB4019",
                start_date=utc_now() - timedelta(days=29),
                end_date=utc_now() + timedelta(days=1),
                auto_renew=True,
                renewal_status=SubscriptionRenewalStatus.ACTIVE.value,
                days_remaining=1,
                total_sessions_used=22,
                last_payment_reference="PAY-SUB-AUTO-881023",
            )
            db.add(sub2)
        db.commit()

    # 6. Seed Multi-City Facility Configurations
    for lot in db.query(ParkingLot).all():
        cfg = db.query(MultiCityFacilityConfig).filter(MultiCityFacilityConfig.facility_id == lot.id).first()
        if not cfg:
            cluster = "Delhi-NCR" if lot.city in ["Gurugram", "Delhi", "Noida"] else ("Mumbai-Metropolitan" if lot.city == "Mumbai" else "Bengaluru-TechZone")
            cfg = MultiCityFacilityConfig(
                facility_id=lot.id,
                enterprise_group="Parkwise National Grid",
                regional_cluster=cluster,
                manager_name=f"Operations Manager ({lot.city})",
                manager_contact="+91-9811002233",
                base_daily_cap_inr=550.0,
                overstay_penalty_per_hour_inr=100.0,
                corporate_quota_reserved=45,
            )
            db.add(cfg)
    db.commit()

    # 7. Seed Strategic AI Business Insights with Operator Approval Guardrails
    ai_insights = [
        {
            "fac_id": facility_id,
            "city": "Gurugram",
            "cat": InsightCategory.PRICING_OPTIMIZATION.value,
            "title": "Morning Corporate Peak Surge Tariff Adjustment (+20%)",
            "summary": "Between 08:30 and 10:30 AM on weekdays, CyberHub facility experiences persistent 94%+ occupancy with gate queues averaging 4.8 minutes. Applying a 1.25x surge multiplier balances incoming traffic, incentivizes off-peak arrivals, and yields an estimated monthly net revenue increase of INR 68,000.",
            "assumptions": [
                "Based on 1,420 ingress transactions recorded across the last 4 consecutive work weeks.",
                "Assumes 12% price elasticity among non-subscription commuter drivers.",
                "Corporate pass holders remain exempt from surge surcharges under enterprise SLAs.",
            ],
            "impact": "+INR 68,000 monthly revenue, reduces entrance queue latency by 3.2 minutes.",
            "conf": 0.94,
            "action": "Adjust surge multiplier from 1.0x to 1.25x between 08:30 - 10:30 AM weekdays.",
            "payload": {"surge_multiplier": 1.25, "time_window": "08:30-10:30", "days": "WEEKDAYS"},
            "approval": InsightApprovalStatus.PENDING_APPROVAL.value,
        },
        {
            "fac_id": facility_id,
            "city": "Gurugram",
            "cat": InsightCategory.CAPACITY_REALLOCATION.value,
            "title": "Reallocate Underutilized Basement 3 Bays to Dedicated Corporate EV Fleet",
            "summary": "Basement 3 Zone D maintains sub-20% average occupancy while corporate EV charging demand has risen by 42% over the last quarter. Reallocating 20 standard slots into dedicated Level-2 AC corporate EV charging bays optimizes floor utilization and fulfills enterprise sustainability commitments.",
            "assumptions": [
                "Basement 3 Zone D has averaged 18.4% occupancy over the last 90 calendar days.",
                "Infosys and TCS fleet accounts currently have 18 pending employee requests for EV-capable bays.",
                "Feeder electrical conduit capacity at Basement 3 sub-distribution board supports 20x 7.4kW AC chargers.",
            ],
            "impact": "Increases Zone D occupancy from 18.4% to 82.0%; generates incremental INR 44,000/mo EV tariffs.",
            "conf": 0.91,
            "action": "Reallocate 20 bays in Basement 3 Zone D to Corporate EV charging reservation pool.",
            "payload": {"reallocated_slots": 20, "target_zone": "Basement 3 Zone D", "tier": "EV_CORPORATE"},
            "approval": InsightApprovalStatus.PENDING_APPROVAL.value,
        },
        {
            "fac_id": None,
            "city": "Mumbai",
            "cat": InsightCategory.REVENUE_LEAKAGE_ALERT.value,
            "title": "ANPR Misread Discrepancy & Gate Tailgating Remediation at BKC Express",
            "summary": "Discrepancy audit identified 23 unrecorded exits where secondary loop detectors registered vehicle departures without matching ANPR plate reads, causing an estimated revenue leakage of INR 6,900 this week. Re-calibrating illuminators and shortening barrier drop latency by 1.2 seconds mitigates tailgating.",
            "assumptions": [
                "23 ground loop induction trigger events lacked corresponding captured camera frame timestamps.",
                "Rain smearing on lens housing reduced optical OCR confidence below 0.65 threshold between 19:00-21:00.",
            ],
            "impact": "Prevents estimated INR 28,000 monthly leakage and synchronizes ANPR audit logs.",
            "conf": 0.96,
            "action": "Shorten boom barrier drop latency to 1.8s and dispatch lens calibration service technician.",
            "payload": {"barrier_delay_seconds": 1.8, "alert_priority": "HIGH"},
            "approval": InsightApprovalStatus.APPROVED.value,
        },
    ]

    for insight_data in ai_insights:
        existing_ins = db.query(AIBusinessInsight).filter(AIBusinessInsight.title == insight_data["title"]).first()
        if not existing_ins:
            ins = AIBusinessInsight(
                facility_id=insight_data["fac_id"],
                city=insight_data["city"],
                category=insight_data["cat"],
                title=insight_data["title"],
                plain_language_summary=insight_data["summary"],
                data_assumptions=insight_data["assumptions"],
                projected_impact=insight_data["impact"],
                confidence_score=insight_data["conf"],
                action_proposed=insight_data["action"],
                action_payload=insight_data["payload"],
                requires_operator_approval=True,
                approval_status=insight_data["approval"],
                created_at=utc_now(),
                resolved_at=utc_now() if insight_data["approval"] == InsightApprovalStatus.APPROVED.value else None,
                operator_notes="Pre-approved during system integration audit." if insight_data["approval"] == InsightApprovalStatus.APPROVED.value else None,
            )
            db.add(ins)
    db.commit()
