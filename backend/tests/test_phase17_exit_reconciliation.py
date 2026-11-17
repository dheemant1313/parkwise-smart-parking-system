"""Comprehensive automated tests for Phase 17: Automatic Exit, Payment & Reconciliation.

Covers:
1. Normal Exit without Overstay (Zero-balance, slot released, barrier actuated OPEN)
2. Overstay Exit Tariff & GST Calculation (18% tax, SAC 9967, FASTag auto-debit)
3. Payment Idempotency Protection (replay with same key returns cached response without duplicate charges)
4. Simulated Payment Failure Holds Barrier (barrier locked, slot remains occupied)
5. CORE GUARDRAIL: Unverified Entry blocks automatic exit and routes to supervisor review
6. Operator Supervisor Fee Waiver (audit logged, slot released, barrier opened)
7. Operator Authorized Refund Lifecycle (partial refund, over-refund prevention, idempotency)
8. Gateway Batch Reconciliation (detects matched, mismatched amounts, duplicate charges, orphaned records)
9. Financial KPI Summary & RFC 4180 CSV Export
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import (
    AuditLog,
    Booking,
    BookingStatus,
    ParkingLot,
    ParkingSlot,
    Payment,
    PaymentStatus,
    SlotStatus,
    SlotType,
    User,
    UserRole,
)
from app.models_gate_automation import BarrierState, GateLaneController, LaneDirection
from app.models_reconciliation import (
    ExitBarrierStatus,
    ExitPaymentMethod,
    ExitSettlementSession,
    GatewayReconciliationLog,
    PaymentRefund,
    ReconciliationStatus,
    RefundStatus,
    SettlementStatus,
)
from app.schemas_reconciliation import GatewayRecordInput
from app.services.exit_reconciliation_service import (
    calculate_exit_settlement_quote,
    export_financial_report_data,
    get_financial_summary_metrics,
    process_authorized_refund,
    reconcile_gateway_batch,
    settle_exit_payment,
    waive_exit_settlement,
)


@pytest.fixture
def db():
    """Ensure database schema is created and provide isolated test session."""
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def test_context(db: Session):
    """Seed test operator, lot, slot, lane, and driver."""
    suffix = uuid.uuid4().hex[:6].upper()

    driver = User(
        full_name=f"Test Driver {suffix}",
        email=f"driver_{suffix}@example.com",
        phone=f"+9198765{suffix[:5]}",
        password_hash="argon2_hash_mock",
        role=UserRole.DRIVER,
        vehicle_number=f"DL01AB{suffix[:4]}",
        is_active=True,
    )
    db.add(driver)

    lot = ParkingLot(
        code=f"LOT-P17-{suffix}",
        name=f"P17 Test Hub {suffix}",
        city="Bengaluru",
        address="100 Outer Ring Road",
        latitude=12.9279,
        longitude=77.6271,
        total_floors=2,
        base_hourly_rate_inr=50.0,
        grace_period_minutes=15,
        operator_name="Parkwise Test Corp",
        kyc_verified=True,
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)

    slot = ParkingSlot(
        lot_id=lot.id,
        slot_number=f"P17-S-{suffix}",
        floor=1,
        zone="A",
        slot_type=SlotType.STANDARD,
        status=SlotStatus.OCCUPIED,
        sensor_health="ONLINE",
    )
    db.add(slot)

    exit_lane = GateLaneController(
        facility_id=lot.id,
        lane_code=f"EXIT-LANE-{suffix}",
        lane_name=f"Exit Lane {suffix}",
        direction=LaneDirection.EXIT,
        barrier_state=BarrierState.CLOSED,
    )
    db.add(exit_lane)
    db.commit()
    db.refresh(slot)
    db.refresh(exit_lane)

    def create_booking(checked_in: bool = True, overstay_hours: float = 0.0):
        book_suffix = uuid.uuid4().hex[:6].upper()
        now = datetime.now(timezone.utc)
        start_time = now - timedelta(hours=3 + overstay_hours)
        end_time = now - timedelta(hours=1 + overstay_hours)

        booking = Booking(
            booking_reference=f"BK-P17-{book_suffix}",
            user_id=driver.id,
            lot_id=lot.id,
            slot_id=slot.id,
            vehicle_number=driver.vehicle_number,
            vehicle_category="SEDAN",
            driver_name=driver.full_name,
            driver_phone=driver.phone,
            start_time=start_time,
            end_time=end_time,
            duration_hours=2.0,
            base_amount_inr=100.0,
            gst_amount_inr=18.0,
            total_amount_inr=118.0,
            status=BookingStatus.ACTIVE if checked_in else BookingStatus.CONFIRMED,
            qr_signature=f"SIG_{book_suffix}",
            checked_in_at=start_time if checked_in else None,
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)

        payment = Payment(
            booking_id=booking.id,
            razorpay_order_id=f"order_{book_suffix}",
            razorpay_payment_id=f"pay_{book_suffix}",
            amount_inr=118.0,
            currency="INR",
            payment_method="UPI / Razorpay",
            receipt_number=f"REC-INIT-{book_suffix}",
            status=PaymentStatus.CAPTURED,
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)

        return booking, payment

    return {
        "driver": driver,
        "lot": lot,
        "slot": slot,
        "lane": exit_lane,
        "create_booking": create_booking,
    }


def test_exit_quote_zero_balance_normal_exit(db: Session, test_context):
    """Test 1: Driver exits within scheduled booking window + grace period (0 additional charge)."""
    booking, _ = test_context["create_booking"](checked_in=True)
    slot = test_context["slot"]
    lane = test_context["lane"]

    # Exit 5 minutes before scheduled end
    exit_time = booking.end_time - timedelta(minutes=5)
    quote = calculate_exit_settlement_quote(
        db, booking_reference=booking.booking_reference, exit_time=exit_time
    )

    assert quote.is_verified_entry is True
    assert quote.is_overstay is False
    assert quote.overstay_minutes == 0
    assert quote.total_payable_inr == 0.0
    assert quote.action_required == "ZERO_BALANCE_EXIT"

    # Settle zero balance exit
    settle_res = settle_exit_payment(
        db=db,
        booking_reference=booking.booking_reference,
        payment_method="ZERO_BALANCE",
        idempotency_key=str(uuid.uuid4()),
    )

    assert settle_res["settlement_status"] == "SETTLED"
    assert settle_res["barrier_status"] == "RELEASED"
    assert settle_res["amount_paid_inr"] == 0.0
    assert settle_res["slot_released"] is True

    # Verify database state updates
    db.refresh(slot)
    db.refresh(booking)
    db.refresh(lane)
    assert slot.status == SlotStatus.AVAILABLE
    assert booking.status == BookingStatus.COMPLETED
    assert lane.barrier_state == BarrierState.OPEN


def test_exit_quote_and_settlement_with_overstay(db: Session, test_context):
    """Test 2: Driver overstays beyond grace period, calculates tariff + 18% GST, settles via FASTag."""
    booking, _ = test_context["create_booking"](checked_in=True)
    slot = test_context["slot"]
    slot.status = SlotStatus.OCCUPIED
    db.commit()

    # Exit 75 minutes after scheduled end (exceeds 15 min grace period)
    exit_time = booking.end_time + timedelta(minutes=75)
    quote = calculate_exit_settlement_quote(
        db, booking_reference=booking.booking_reference, exit_time=exit_time
    )

    assert quote.is_verified_entry is True
    assert quote.is_overstay is True
    assert quote.overstay_minutes == 75
    # 75 mins -> 2 billable hours. 2 * 50 = 100 base. 100 * 18% = 18 GST -> 118 total
    assert quote.overstay_charge_inr == 100.0
    assert quote.gst_amount_inr == 18.0
    assert quote.total_payable_inr == 118.0
    assert quote.action_required == "PAYMENT_REQUIRED"

    # Settle via FASTag Auto-Debit
    idemp_key = str(uuid.uuid4())
    settle_res = settle_exit_payment(
        db=db,
        booking_reference=booking.booking_reference,
        payment_method="FASTAG_AUTO_DEBIT",
        idempotency_key=idemp_key,
        fastag_tag_id="FTG-ICICI-998877",
    )

    assert settle_res["settlement_status"] == "SETTLED"
    assert settle_res["barrier_status"] == "RELEASED"
    assert settle_res["amount_paid_inr"] == 118.0
    assert settle_res["receipt_number"] is not None
    assert settle_res["tax_invoice"]["items"][0]["hsn_sac"] == "9967"
    assert settle_res["tax_invoice"]["grand_total_inr"] == 118.0


def test_exit_payment_idempotency_protection(db: Session, test_context):
    """Test 3: Replaying settlement with identical idempotency_key returns cached response without duplicate debits."""
    booking, _ = test_context["create_booking"](checked_in=True)

    idemp_key = f"IDEMP-TEST-{uuid.uuid4().hex[:8]}"

    res1 = settle_exit_payment(
        db=db,
        booking_reference=booking.booking_reference,
        payment_method="FASTAG_AUTO_DEBIT",
        idempotency_key=idemp_key,
    )
    assert res1["settlement_status"] == "SETTLED"

    # Second call with same idempotency key
    res2 = settle_exit_payment(
        db=db,
        booking_reference=booking.booking_reference,
        payment_method="FASTAG_AUTO_DEBIT",
        idempotency_key=idemp_key,
    )

    assert res2["settlement_status"] == "SETTLED"
    assert res2["receipt_number"] == res1["receipt_number"]
    assert "Idempotent response" in res2["message"]


def test_exit_payment_simulated_failure_holds_barrier(db: Session, test_context):
    """Test 4: Payment failure keeps barrier locked and slot occupied."""
    booking, _ = test_context["create_booking"](checked_in=True)
    slot = test_context["slot"]
    slot.status = SlotStatus.OCCUPIED
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        settle_exit_payment(
            db=db,
            booking_reference=booking.booking_reference,
            payment_method="CARD",
            idempotency_key=str(uuid.uuid4()),
            simulate_failure=True,
        )

    assert exc_info.value.status_code == 402
    assert "failed" in exc_info.value.detail.lower()

    # Verify session and barrier state
    session = (
        db.query(ExitSettlementSession)
        .filter(ExitSettlementSession.booking_id == booking.id)
        .order_by(ExitSettlementSession.created_at.desc())
        .first()
    )
    assert session.settlement_status == SettlementStatus.FAILED
    assert session.barrier_status == ExitBarrierStatus.LOCKED


def test_unverified_entry_guardrail_blocks_exit(db: Session, test_context):
    """Test 5: CORE GUARDRAIL - Booking with NO verified check_in blocks exit & releases no barrier."""
    booking, _ = test_context["create_booking"](checked_in=False)

    # 1. Quote calculation flags unverified entry
    quote = calculate_exit_settlement_quote(db, booking_reference=booking.booking_reference)
    assert quote.is_verified_entry is False
    assert quote.action_required == "UNVERIFIED_ENTRY_HOLD"

    # 2. Settle attempt is forbidden
    with pytest.raises(HTTPException) as exc_info:
        settle_exit_payment(
            db=db,
            booking_reference=booking.booking_reference,
            payment_method="FASTAG_AUTO_DEBIT",
            idempotency_key=str(uuid.uuid4()),
        )

    assert exc_info.value.status_code == 403
    assert "not verified" in exc_info.value.detail.lower()


def test_operator_fee_waiver(db: Session, test_context):
    """Test 6: Operator supervisor fee waiver overrides payment, opens barrier, and records audit trail."""
    booking, _ = test_context["create_booking"](checked_in=True)

    waiver_res = waive_exit_settlement(
        db=db,
        booking_reference=booking.booking_reference,
        reason="VIP Delegated Exit / Barrier Malfunction Test",
        operator_email="supervisor@parkwise.in",
        operator_notes="Approved by Duty Manager",
    )

    assert waiver_res["settlement_status"] == "WAIVED_BY_OPERATOR"
    assert waiver_res["barrier_status"] == "RELEASED"
    assert waiver_res["waived_by"] == "supervisor@parkwise.in"

    # Verify audit log was recorded
    audit = (
        db.query(AuditLog)
        .filter(AuditLog.actor_email == "supervisor@parkwise.in")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert audit is not None
    assert audit.action == "EXIT_FEE_WAIVED"


def test_operator_authorized_refund_lifecycle(db: Session, test_context):
    """Test 7: Operator issues partial refund, verifies idempotency, and prevents over-refunding."""
    booking, payment = test_context["create_booking"](checked_in=True)

    refund_key = f"RFND-IDEMP-{uuid.uuid4().hex[:6]}"

    # 1. Partial refund of INR 50
    refund1 = process_authorized_refund(
        db=db,
        booking_reference=booking.booking_reference,
        amount_inr=50.0,
        reason="Customer overpaid during peak rate transition",
        operator_email="finance_ops@parkwise.in",
        idempotency_key=refund_key,
    )

    assert refund1["status"] == "PROCESSED"
    assert refund1["amount_inr"] == 50.0

    db.refresh(payment)
    assert payment.refund_amount_inr == 50.0

    # 2. Idempotent repeat call returns identical refund
    refund_replay = process_authorized_refund(
        db=db,
        booking_reference=booking.booking_reference,
        amount_inr=50.0,
        reason="Customer overpaid during peak rate transition",
        operator_email="finance_ops@parkwise.in",
        idempotency_key=refund_key,
    )
    assert refund_replay["refund_reference"] == refund1["refund_reference"]

    # 3. Attempting refund exceeding remaining balance (118 - 50 = 68 max) raises 400
    with pytest.raises(HTTPException) as exc_info:
        process_authorized_refund(
            db=db,
            booking_reference=booking.booking_reference,
            amount_inr=100.0,
            reason="Exceeding refund attempt",
            operator_email="finance_ops@parkwise.in",
            idempotency_key=str(uuid.uuid4()),
        )
    assert exc_info.value.status_code == 400
    assert "exceeds available balance" in exc_info.value.detail.lower()


def test_gateway_batch_reconciliation(db: Session, test_context):
    """Test 8: Batch gateway reconciliation flags matched, mismatched, duplicate, and orphaned records."""
    booking, payment = test_context["create_booking"](checked_in=True)

    records = [
        # 1. Perfectly matched transaction
        GatewayRecordInput(
            gateway_order_id=payment.razorpay_order_id,
            gateway_payment_id=payment.razorpay_payment_id or "pay_01",
            booking_reference=booking.booking_reference,
            amount_inr=payment.amount_inr,
            currency="INR",
            status="captured",
            payment_method="UPI",
        ),
        # 2. Amount mismatch transaction
        GatewayRecordInput(
            gateway_order_id=f"order_mismatch_{uuid.uuid4().hex[:6]}",
            gateway_payment_id="pay_mismatch_02",
            booking_reference=booking.booking_reference,
            amount_inr=999.0,  # Deliberate discrepancy
            currency="INR",
            status="captured",
            payment_method="CARD",
        ),
        # 3. Orphaned transaction (exists only on gateway)
        GatewayRecordInput(
            gateway_order_id=f"order_orphaned_{uuid.uuid4().hex[:6]}",
            gateway_payment_id="pay_orphaned_03",
            booking_reference="BK-NON-EXISTENT-999",
            amount_inr=250.0,
            currency="INR",
            status="captured",
            payment_method="NETBANKING",
        ),
        # 4. Duplicate gateway charge
        GatewayRecordInput(
            gateway_order_id=payment.razorpay_order_id,  # Duplicate of record 1
            gateway_payment_id="pay_duplicate_04",
            booking_reference=booking.booking_reference,
            amount_inr=payment.amount_inr,
            currency="INR",
            status="captured",
            payment_method="UPI",
        ),
    ]

    result = reconcile_gateway_batch(
        db=db,
        gateway_records=records,
        run_by_email="auditor@parkwise.in",
    )

    assert result["total_gateway_records"] == 4
    assert result["matched_records_count"] == 1
    assert result["mismatch_count"] == 3
    assert result["status"] == "DISCREPANCY_DETECTED"
    assert len(result["discrepancies"]) == 3

    types = [d["type"] for d in result["discrepancies"]]
    assert "DUPLICATE_GATEWAY_CHARGE" in types
    assert "AMOUNT_MISMATCH" in types
    assert "UNMATCHED_GATEWAY_TRANSACTION" in types


def test_financial_kpi_summary_and_csv_export(db: Session, test_context):
    """Test 9: Financial KPI summary calculations and CSV audit report export."""
    summary = get_financial_summary_metrics(db)

    assert "total_gross_volume_inr" in summary
    assert "base_reservation_revenue_inr" in summary
    assert "total_gst_collected_inr" in summary
    assert "net_settled_revenue_inr" in summary
    assert summary["total_gross_volume_inr"] >= 0.0

    csv_data = export_financial_report_data(db, report_format="csv")
    assert isinstance(csv_data, str)
    assert "Transaction Type" in csv_data
    assert "Amount (INR)" in csv_data
    assert "Receipt No" in csv_data


def test_razorpay_webhook_event_processing(db: Session, test_context):
    """Test 10: Razorpay payment.captured webhook captures pending payment."""
    from fastapi.testclient import TestClient
    from app.main import app

    booking, payment = test_context["create_booking"](checked_in=True)
    payment.status = PaymentStatus.AUTHORIZED
    db.commit()

    client = TestClient(app)
    webhook_payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_hook_{uuid.uuid4().hex[:8]}",
                    "order_id": payment.razorpay_order_id,
                    "amount": 11800,  # 118.00 in paise
                    "currency": "INR",
                    "status": "captured",
                }
            }
        },
    }

    response = client.post(
        "/api/v1/reconciliation/webhooks/razorpay",
        json=webhook_payload,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    db.refresh(payment)
    assert payment.status == PaymentStatus.CAPTURED
    assert payment.verified_at is not None

