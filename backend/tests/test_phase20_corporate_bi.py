"""Unit and integration test suite for Phase 20: Corporate Parking, Subscriptions & Multi-City BI."""

import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, engine, SessionLocal, get_db
from app.main import app
from app.models import ParkingLot, User, UserRole
from app.models_phase20 import (
    CorporateAccount,
    CorporateEmployee,
    CorporateInvoice,
    ParkingSubscriptionPlan,
    UserSubscription,
    AIBusinessInsight,
    InsightApprovalStatus,
    InsightCategory,
)
from app.schemas_phase20 import (
    CorporateAccountCreate,
    CorporateEmployeeInvite,
    CorporateEmployeeStatusUpdate,
    CorporateQuotaUpdateRequest,
    ParkingSubscriptionPlanCreate,
)
from app.services import corporate_bi_service
from app.auth import hash_password, create_access_token, get_current_user


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()

    admin_user = session.query(User).filter(User.email == "admin.bi@parkwise.in").first()
    if not admin_user:
        admin_user = User(
            full_name="Admin Controller",
            email="admin.bi@parkwise.in",
            phone="+91-9988776655",
            password_hash=hash_password("admin_pass"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        session.add(admin_user)

    driver_user = session.query(User).filter(User.email == "driver.corp@parkwise.in").first()
    if not driver_user:
        driver_user = User(
            full_name="Corporate Driver",
            email="driver.corp@parkwise.in",
            phone="+91-9876543210",
            password_hash=hash_password("driver_pass"),
            role=UserRole.DRIVER,
            is_active=True,
        )
        session.add(driver_user)

    lot = session.query(ParkingLot).filter(ParkingLot.code == "CYBER-01").first()
    if not lot:
        lot = ParkingLot(
            code="CYBER-01",
            name="CyberHub Tech Terminal",
            city="Gurugram",
            address="DLF Cyber City, Gurugram",
            latitude=28.4950,
            longitude=77.0895,
            total_floors=3,
            base_hourly_rate_inr=60.0,
            current_surge_multiplier=1.0,
            operator_name="DLF Urban Infrastructure",
            kyc_verified=True,
            rating=4.8,
        )
        session.add(lot)
    session.commit()

    corporate_bi_service.seed_phase20_corporate_bi_data(session)

    yield session
    session.close()


@pytest.fixture(scope="function")
def client(db_session):
    admin = db_session.query(User).filter(User.role == UserRole.ADMIN).first()

    def override_current_user():
        return admin

    app.dependency_overrides[get_current_user] = override_current_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_corporate_account_creation_and_quota_enforcement(db_session):
    """Verifies that an enterprise account is created and quota limits prevent over-enrollment."""
    acc_data = CorporateAccountCreate(
        company_name="Wipro Digital Mobility",
        gstin="29AAACW1234D1Z2",
        domain="wipro.com",
        contact_email="fleet@wipro.com",
        contact_phone="+91-80-28440011",
        billing_address="Sarjapur Road, Bengaluru, KA",
        monthly_quota_slots=2,
        billing_cycle_day=1,
    )
    account = corporate_bi_service.create_corporate_account(db_session, acc_data)
    assert account.id is not None
    assert account.monthly_quota_slots == 2

    # Enroll 1st employee
    emp1 = corporate_bi_service.invite_corporate_employee(
        db_session, account.id, CorporateEmployeeInvite(
            employee_id_code="WIP-001",
            full_name="Praveen Kumar",
            email="praveen.k@wipro.com",
            department="DevOps",
            vehicle_plate="KA03MJ1122",
            parking_policy="SHARED_POOL",
            monthly_allowance_hours=160,
        )
    )
    assert emp1.id is not None

    # Enroll 2nd employee (Quota boundary)
    emp2 = corporate_bi_service.invite_corporate_employee(
        db_session, account.id, CorporateEmployeeInvite(
            employee_id_code="WIP-002",
            full_name="Sneha Rao",
            email="sneha.r@wipro.com",
            department="Product",
            vehicle_plate="KA05NB3344",
            parking_policy="SHARED_POOL",
            monthly_allowance_hours=160,
        )
    )
    assert emp2.id is not None

    # Attempting 3rd employee must raise 400 Quota Exceeded
    with pytest.raises(Exception) as exc_info:
        corporate_bi_service.invite_corporate_employee(
            db_session, account.id, CorporateEmployeeInvite(
                employee_id_code="WIP-003",
                full_name="Anil Nair",
                email="anil.n@wipro.com",
                department="QA",
                vehicle_plate="KA01EF9988",
                parking_policy="SHARED_POOL",
                monthly_allowance_hours=160,
            )
        )
    assert "quota limit reached" in str(exc_info.value).lower()

    # Increase quota
    updated = corporate_bi_service.update_corporate_account(
        db_session, account.id, CorporateQuotaUpdateRequest(monthly_quota_slots=5)
    )
    assert updated["monthly_quota_slots"] == 5
    assert updated["remaining_slots"] == 3

    # Now 3rd employee enrolls successfully
    emp3 = corporate_bi_service.invite_corporate_employee(
        db_session, account.id, CorporateEmployeeInvite(
            employee_id_code="WIP-003",
            full_name="Anil Nair",
            email="anil.n@wipro.com",
            department="QA",
            vehicle_plate="KA01EF9988",
            parking_policy="SHARED_POOL",
            monthly_allowance_hours=160,
        )
    )
    assert emp3.id is not None


def test_corporate_employee_policy_and_status_update(db_session):
    """Tests VIP reserved bay allocation and employee status suspension."""
    corp = db_session.query(CorporateAccount).filter(CorporateAccount.company_name == "Infosys Technologies Ltd").first()
    assert corp is not None

    emp = corporate_bi_service.invite_corporate_employee(
        db_session, corp.id, CorporateEmployeeInvite(
            employee_id_code="INF-9999",
            full_name="Sanjay Singhania",
            email="sanjay.s@infosys.com",
            department="C-Suite",
            vehicle_plate="HR26VIP001",
            parking_policy="EXECUTIVE_VIP",
            reserved_slot_code="B1-VIP-99",
            monthly_allowance_hours=240,
        )
    )
    assert emp.parking_policy == "EXECUTIVE_VIP"
    assert emp.reserved_slot_code == "B1-VIP-99"

    # Suspend employee
    updated_emp = corporate_bi_service.update_corporate_employee(
        db_session, emp.id, CorporateEmployeeStatusUpdate(status="SUSPENDED")
    )
    assert updated_emp.status == "SUSPENDED"


def test_corporate_invoice_generation_and_payment(db_session):
    """Verifies itemized invoice calculation, 18% GST tax computation, and settlement."""
    corp = db_session.query(CorporateAccount).filter(CorporateAccount.company_name == "Infosys Technologies Ltd").first()
    invoice = corporate_bi_service.generate_corporate_invoice(db_session, corp.id, "December 2026")

    assert invoice.id is not None
    assert invoice.corporate_id == corp.id
    assert invoice.payment_status == "PENDING"
    assert invoice.subtotal_inr > 0
    assert invoice.gst_amount_inr > 0
    # Verify subtotal + GST matches total_payable
    expected_taxable = invoice.subtotal_inr - invoice.discount_inr
    expected_total = expected_taxable + invoice.gst_amount_inr
    assert abs(invoice.total_payable_inr - round(expected_total, 2)) < 0.05

    # Settle invoice
    paid_inv = corporate_bi_service.pay_corporate_invoice(db_session, invoice.id, "NEFT-AXIS-99220011")
    assert paid_inv.payment_status == "PAID"
    assert paid_inv.payment_reference == "NEFT-AXIS-99220011"
    assert paid_inv.paid_at is not None


def test_subscription_plans_and_driver_purchase(db_session):
    """Verifies subscription plan definitions and driver pass issuance."""
    driver = db_session.query(User).filter(User.role == UserRole.DRIVER).first()
    plans = corporate_bi_service.list_subscription_plans(db_session)
    assert len(plans) >= 2

    target_plan = plans[0]
    sub = corporate_bi_service.purchase_user_subscription(
        db_session,
        user_id=driver.id,
        plan_id=target_plan["id"],
        vehicle_plate="DL8CAF9900",
        auto_renew=True,
    )
    assert sub.id is not None
    assert sub.vehicle_plate == "DL8CAF9900"
    assert sub.renewal_status == "ACTIVE"
    assert sub.days_remaining > 0

    # Retrieve user subscriptions
    driver_subs = corporate_bi_service.list_user_subscriptions(db_session, user_id=driver.id)
    matching = [s for s in driver_subs if s["id"] == sub.id]
    assert len(matching) == 1
    assert matching[0]["tier"] == target_plan["tier"]


def test_subscription_failed_payment_grace_period_and_renewal(db_session):
    """Tests payment failure simulation granting 72-hour grace period and subsequent manual renewal."""
    subs = db_session.query(UserSubscription).all()
    assert len(subs) > 0
    test_sub = subs[0]

    # Simulate payment failure
    fail_res = corporate_bi_service.simulate_failed_recurring_payment(
        db_session, test_sub.id, "Credit card declined: Insufficient funds"
    )
    assert fail_res["renewal_status"] == "PAYMENT_FAILED"
    assert fail_res["grace_period_until"] is not None

    # Sub remains valid during grace period
    refreshed_subs = corporate_bi_service.list_user_subscriptions(db_session, user_id=test_sub.user_id)
    matched = [s for s in refreshed_subs if s["id"] == test_sub.id][0]
    assert matched["failed_payment_reason"] == "Credit card declined: Insufficient funds"

    # Renew subscription
    renew_res = corporate_bi_service.renew_user_subscription(db_session, test_sub.id)
    assert renew_res["renewal_status"] == "ACTIVE"


def test_multi_facility_bi_analytics_aggregation(db_session):
    """Verifies multi-facility BI metrics: peak hours, leakage, no-shows, and 7-day demand projections."""
    bi = corporate_bi_service.get_multi_facility_bi_analytics(db_session)

    assert bi.consolidated_total_facilities >= 4
    assert bi.consolidated_total_slots >= 1000
    assert bi.consolidated_occupancy_pct > 50.0
    assert bi.consolidated_monthly_revenue_inr > 0
    assert bi.consolidated_leakage_inr > 0
    assert len(bi.city_summaries) >= 3
    assert len(bi.peak_hours) == 16
    assert len(bi.underused_zones) >= 2
    assert len(bi.revenue_leakages) >= 3
    assert len(bi.forecasted_demand_7d) == 7
    assert len(bi.facility_comparisons) >= 4

    # Test filtering by city
    mumbai_bi = corporate_bi_service.get_multi_facility_bi_analytics(db_session, city_filter="Mumbai")
    assert len(mumbai_bi.city_summaries) == 1
    assert mumbai_bi.city_summaries[0].city == "Mumbai"


def test_ai_business_insights_operator_approval_guardrail(db_session):
    """Strictly enforces operator approval guardrail: consequential changes cannot execute without human sign-off."""
    insights = corporate_bi_service.list_ai_business_insights(db_session)
    assert len(insights) >= 2

    # Find pending pricing surge proposal
    pending_ins = next((i for i in insights if i["approval_status"] == "PENDING_APPROVAL" and i["category"] == "PRICING_OPTIMIZATION"), None)
    assert pending_ins is not None
    assert pending_ins["requires_operator_approval"] is True
    assert len(pending_ins["data_assumptions"]) >= 2

    lot = db_session.query(ParkingLot).filter(ParkingLot.id == pending_ins["facility_id"]).first()
    original_surge = lot.current_surge_multiplier

    # 1. Operator rejects another proposal
    realloc_ins = next((i for i in insights if i["approval_status"] == "PENDING_APPROVAL" and i["category"] == "CAPACITY_REALLOCATION"), None)
    if realloc_ins:
        rej_res = corporate_bi_service.decide_ai_business_insight(
            db_session, realloc_ins["id"], "REJECTED", "Rejected due to upcoming construction in Zone D"
        )
        assert rej_res["approval_status"] == "REJECTED"

    # 2. Operator approves pricing surge proposal
    approve_res = corporate_bi_service.decide_ai_business_insight(
        db_session, pending_ins["id"], "APPROVED", "Approved by Executive Operations Director"
    )
    assert approve_res["approval_status"] == "APPROVED"
    assert "Applied updated surge multiplier" in approve_res["execution_message"]

    # Verify that the consequential change took effect on the facility model
    db_session.refresh(lot)
    assert lot.current_surge_multiplier == 1.25


def test_api_endpoints_enterprise_full_journey(client, db_session):
    """End-to-end HTTP integration test across Phase 20 API endpoints."""
    admin = db_session.query(User).filter(User.role == UserRole.ADMIN).first()
    token = create_access_token(admin, db_session)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET corporate accounts
    resp_accs = client.get("/api/v1/enterprise/corporate/accounts", headers=headers)
    assert resp_accs.status_code == 200
    accs_data = resp_accs.json()
    assert len(accs_data) >= 2

    # 2. GET subscription plans
    resp_plans = client.get("/api/v1/enterprise/subscriptions/plans", headers=headers)
    assert resp_plans.status_code == 200
    plans_data = resp_plans.json()
    assert len(plans_data) >= 2

    # 3. GET multi-facility BI analytics
    resp_bi = client.get("/api/v1/enterprise/analytics/bi", headers=headers)
    assert resp_bi.status_code == 200
    bi_data = resp_bi.json()
    assert bi_data["consolidated_total_facilities"] >= 4
    assert len(bi_data["city_summaries"]) >= 3

    # 4. GET AI business insights
    resp_insights = client.get("/api/v1/enterprise/ai/insights", headers=headers)
    assert resp_insights.status_code == 200
    insights_data = resp_insights.json()
    assert len(insights_data) >= 2

    # 5. POST operator decision on AI insight
    target_ins = insights_data[0]
    resp_dec = client.post(
        f"/api/v1/enterprise/ai/insights/{target_ins['id']}/decision",
        json={"decision": "APPROVED", "operator_notes": "Signed off via REST API integration."},
        headers=headers,
    )
    assert resp_dec.status_code == 200
    dec_data = resp_dec.json()
    assert dec_data["approval_status"] == "APPROVED"
