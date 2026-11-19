"""Phase 20: FastAPI Router for Corporate Parking, Subscriptions & Multi-City Business Intelligence."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import User, UserRole
from app.schemas_phase20 import (
    CorporateAccountCreate,
    CorporateAccountResponse,
    CorporateEmployeeInvite,
    CorporateEmployeeResponse,
    CorporateEmployeeStatusUpdate,
    CorporateInvoiceGenerateRequest,
    CorporateInvoicePayRequest,
    CorporateInvoiceResponse,
    CorporateQuotaUpdateRequest,
    ParkingSubscriptionPlanCreate,
    ParkingSubscriptionPlanResponse,
    UserSubscriptionPurchaseRequest,
    UserSubscriptionResponse,
    SubscriptionCancelRequest,
    SubscriptionPaymentFailureSimulateRequest,
    MultiFacilityBIAnalyticsResponse,
    AIBusinessInsightResponse,
    AIInsightApprovalRequest,
)
from app.services import corporate_bi_service

corporate_bi_router = APIRouter(tags=["Enterprise Corporate & Multi-City BI"])


# ============================================================================
# 1. CORPORATE ACCOUNTS & EMPLOYEES
# ============================================================================

@corporate_bi_router.post("/api/v1/enterprise/corporate/accounts", response_model=CorporateAccountResponse)
@corporate_bi_router.post("/api/enterprise/corporate/accounts", response_model=CorporateAccountResponse)
def create_account(
    data: CorporateAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    acc = corporate_bi_service.create_corporate_account(db, data)
    return corporate_bi_service.get_corporate_account(db, acc.id)


@corporate_bi_router.get("/api/v1/enterprise/corporate/accounts", response_model=List[CorporateAccountResponse])
@corporate_bi_router.get("/api/enterprise/corporate/accounts", response_model=List[CorporateAccountResponse])
def get_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    return corporate_bi_service.list_corporate_accounts(db)


@corporate_bi_router.get("/api/v1/enterprise/corporate/accounts/{corporate_id}", response_model=CorporateAccountResponse)
@corporate_bi_router.get("/api/enterprise/corporate/accounts/{corporate_id}", response_model=CorporateAccountResponse)
def get_account_detail(
    corporate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    return corporate_bi_service.get_corporate_account(db, corporate_id)


@corporate_bi_router.patch("/api/v1/enterprise/corporate/accounts/{corporate_id}/quota", response_model=CorporateAccountResponse)
@corporate_bi_router.patch("/api/enterprise/corporate/accounts/{corporate_id}/quota", response_model=CorporateAccountResponse)
def update_quota(
    corporate_id: int,
    data: CorporateQuotaUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    return corporate_bi_service.update_corporate_account(db, corporate_id, data)


@corporate_bi_router.post("/api/v1/enterprise/corporate/accounts/{corporate_id}/employees", response_model=CorporateEmployeeResponse)
@corporate_bi_router.post("/api/enterprise/corporate/accounts/{corporate_id}/employees", response_model=CorporateEmployeeResponse)
def invite_employee(
    corporate_id: int,
    data: CorporateEmployeeInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    return corporate_bi_service.invite_corporate_employee(db, corporate_id, data)


@corporate_bi_router.get("/api/v1/enterprise/corporate/accounts/{corporate_id}/employees", response_model=List[CorporateEmployeeResponse])
@corporate_bi_router.get("/api/enterprise/corporate/accounts/{corporate_id}/employees", response_model=List[CorporateEmployeeResponse])
def list_employees(
    corporate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    return corporate_bi_service.list_corporate_employees(db, corporate_id)


@corporate_bi_router.patch("/api/v1/enterprise/corporate/employees/{employee_id}", response_model=CorporateEmployeeResponse)
@corporate_bi_router.patch("/api/enterprise/corporate/employees/{employee_id}", response_model=CorporateEmployeeResponse)
def update_employee(
    employee_id: int,
    data: CorporateEmployeeStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    return corporate_bi_service.update_corporate_employee(db, employee_id, data)


# ============================================================================
# 2. CORPORATE INVOICES & BILLING
# ============================================================================

@corporate_bi_router.post("/api/v1/enterprise/corporate/accounts/{corporate_id}/invoices/generate", response_model=CorporateInvoiceResponse)
@corporate_bi_router.post("/api/enterprise/corporate/accounts/{corporate_id}/invoices/generate", response_model=CorporateInvoiceResponse)
def generate_invoice(
    corporate_id: int,
    data: CorporateInvoiceGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    inv = corporate_bi_service.generate_corporate_invoice(db, corporate_id, data.billing_period)
    invoices = corporate_bi_service.list_corporate_invoices(db, corporate_id)
    for i in invoices:
        if i["id"] == inv.id:
            return i
    raise HTTPException(status_code=500, detail="Could not format generated invoice.")


@corporate_bi_router.get("/api/v1/enterprise/corporate/invoices", response_model=List[CorporateInvoiceResponse])
@corporate_bi_router.get("/api/enterprise/corporate/invoices", response_model=List[CorporateInvoiceResponse])
def get_invoices(
    corporate_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    return corporate_bi_service.list_corporate_invoices(db, corporate_id)


@corporate_bi_router.post("/api/v1/enterprise/corporate/invoices/{invoice_id}/pay", response_model=CorporateInvoiceResponse)
@corporate_bi_router.post("/api/enterprise/corporate/invoices/{invoice_id}/pay", response_model=CorporateInvoiceResponse)
def pay_invoice(
    invoice_id: int,
    data: CorporateInvoicePayRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    inv = corporate_bi_service.pay_corporate_invoice(db, invoice_id, data.payment_reference)
    invoices = corporate_bi_service.list_corporate_invoices(db, inv.corporate_id)
    for i in invoices:
        if i["id"] == inv.id:
            return i
    raise HTTPException(status_code=500, detail="Invoice record missing after payment.")


# ============================================================================
# 3. RECURRING PARKING SUBSCRIPTIONS
# ============================================================================

@corporate_bi_router.post("/api/v1/enterprise/subscriptions/plans", response_model=ParkingSubscriptionPlanResponse)
@corporate_bi_router.post("/api/enterprise/subscriptions/plans", response_model=ParkingSubscriptionPlanResponse)
def create_plan(
    data: ParkingSubscriptionPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    plan = corporate_bi_service.create_subscription_plan(db, data)
    plans = corporate_bi_service.list_subscription_plans(db, active_only=False)
    for p in plans:
        if p["id"] == plan.id:
            return p
    raise HTTPException(status_code=500, detail="Plan record missing after creation.")


@corporate_bi_router.get("/api/v1/enterprise/subscriptions/plans", response_model=List[ParkingSubscriptionPlanResponse])
@corporate_bi_router.get("/api/enterprise/subscriptions/plans", response_model=List[ParkingSubscriptionPlanResponse])
def get_plans(
    db: Session = Depends(get_db),
):
    return corporate_bi_service.list_subscription_plans(db, active_only=True)


@corporate_bi_router.post("/api/v1/enterprise/subscriptions/purchase", response_model=UserSubscriptionResponse)
@corporate_bi_router.post("/api/enterprise/subscriptions/purchase", response_model=UserSubscriptionResponse)
def purchase_subscription(
    data: UserSubscriptionPurchaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = corporate_bi_service.purchase_user_subscription(
        db, current_user.id, data.plan_id, data.vehicle_plate, data.auto_renew
    )
    subs = corporate_bi_service.list_user_subscriptions(db, current_user.id)
    for s in subs:
        if s["id"] == sub.id:
            return s
    raise HTTPException(status_code=500, detail="Subscription purchase record missing.")


@corporate_bi_router.get("/api/v1/enterprise/subscriptions", response_model=List[UserSubscriptionResponse])
@corporate_bi_router.get("/api/enterprise/subscriptions", response_model=List[UserSubscriptionResponse])
def list_subscriptions(
    all_users: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Operators and Admins can view all subscriptions when requested
    if all_users and current_user.role in [UserRole.ADMIN, UserRole.OPERATOR]:
        return corporate_bi_service.list_user_subscriptions(db, user_id=None)
    return corporate_bi_service.list_user_subscriptions(db, user_id=current_user.id)


@corporate_bi_router.post("/api/v1/enterprise/subscriptions/{subscription_id}/cancel")
@corporate_bi_router.post("/api/enterprise/subscriptions/{subscription_id}/cancel")
def cancel_sub(
    subscription_id: int,
    data: SubscriptionCancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return corporate_bi_service.cancel_subscription(db, subscription_id, data.reason)


@corporate_bi_router.post("/api/v1/enterprise/subscriptions/{subscription_id}/renew")
@corporate_bi_router.post("/api/enterprise/subscriptions/{subscription_id}/renew")
def renew_sub(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return corporate_bi_service.renew_user_subscription(db, subscription_id)


@corporate_bi_router.post("/api/v1/enterprise/subscriptions/{subscription_id}/simulate-payment-failure")
@corporate_bi_router.post("/api/enterprise/subscriptions/{subscription_id}/simulate-payment-failure")
def simulate_failure(
    subscription_id: int,
    data: SubscriptionPaymentFailureSimulateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    return corporate_bi_service.simulate_failed_recurring_payment(db, subscription_id, data.failure_reason)


# ============================================================================
# 4. MULTI-CITY & CONSOLIDATED OPERATOR BI
# ============================================================================

@corporate_bi_router.get("/api/v1/enterprise/analytics/bi", response_model=MultiFacilityBIAnalyticsResponse)
@corporate_bi_router.get("/api/enterprise/analytics/bi", response_model=MultiFacilityBIAnalyticsResponse)
def get_bi_analytics(
    city: Optional[str] = Query(None),
    facility_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    return corporate_bi_service.get_multi_facility_bi_analytics(db, city, facility_id)


# ============================================================================
# 5. STRATEGIC AI BUSINESS INTELLIGENCE & OPERATOR GUARDRAILS
# ============================================================================

@corporate_bi_router.get("/api/v1/enterprise/ai/insights", response_model=List[AIBusinessInsightResponse])
@corporate_bi_router.get("/api/enterprise/ai/insights", response_model=List[AIBusinessInsightResponse])
def get_ai_insights(
    city: Optional[str] = Query(None),
    approval_status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    return corporate_bi_service.list_ai_business_insights(db, city, approval_status)


@corporate_bi_router.post("/api/v1/enterprise/ai/insights/{insight_id}/decision")
@corporate_bi_router.post("/api/enterprise/ai/insights/{insight_id}/decision")
def decide_insight(
    insight_id: int,
    data: AIInsightApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    return corporate_bi_service.decide_ai_business_insight(
        db, insight_id, data.decision, data.operator_notes
    )
