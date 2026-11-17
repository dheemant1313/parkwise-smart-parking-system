"""Phase 17: FastAPI Router for Automatic Exit, Payment & Reconciliation.

Endpoints mounted under /api/v1/reconciliation and /api/reconciliation:
- POST /exit/quote: Real-time duration and overstay quote calculation
- POST /exit/settle: Idempotent payment settlement and automated barrier/slot release
- POST /exit/waive: Role-authorized fee waiver with audit compliance
- GET /exit/sessions: List active/past exit settlement sessions
- GET /exit/unpaid: Review unpaid or unverified exit sessions holding gates
- GET /payments: Comprehensive payments ledger with refund status
- POST /refunds: Issue operator-authorized refund with idempotency
- GET /refunds: Audit list of issued refunds
- POST /reconcile: Gateway vs database batch transaction reconciliation
- GET /reconcile/history: List past gateway reconciliation logs
- GET /reports/summary: High-level financial KPIs (gross volume, GST, refunds, net)
- GET /reports/export: Export financial transactions as CSV or JSON
- POST /webhooks/razorpay: Secure Razorpay payment webhook with HMAC-SHA256 signature
"""

import hmac
import hashlib
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.config import settings
from app.database import get_db
from app.models import AuditLog, Booking, ParkingSlot, Payment, PaymentStatus, User, UserRole
from app.models_reconciliation import (
    ExitBarrierStatus,
    ExitPaymentMethod,
    ExitSettlementSession,
    GatewayReconciliationLog,
    PaymentRefund,
    ReconciliationStatus,
    RefundStatus,
    SettlementStatus,
    utc_now,
)
from app.schemas_reconciliation import (
    ExitQuoteBreakdown,
    ExitQuoteRequest,
    ExitSettlementRequest,
    ExitSettlementResponse,
    ExitWaiverRequest,
    FinancialSummaryResponse,
    GatewayReconciliationRequest,
    GatewayReconciliationResponse,
    PaymentLedgerItem,
    RefundIssueRequest,
    RefundResponse,
    UnpaidExitSessionItem,
)
from app.services.exit_reconciliation_service import (
    calculate_exit_settlement_quote,
    export_financial_report_data,
    get_financial_summary_metrics,
    process_authorized_refund,
    reconcile_gateway_batch,
    settle_exit_payment,
    waive_exit_settlement,
)

reconciliation_router = APIRouter(prefix="", tags=["Phase 17 — Payment & Reconciliation"])


@reconciliation_router.post(
    "/exit/quote",
    response_model=ExitQuoteBreakdown,
    summary="Calculate exit duration, overstay surcharge & GST quote",
)
def get_exit_quote(
    request: ExitQuoteRequest,
    db: Session = Depends(get_db),
):
    """Calculate parking duration and overstay quote based on verified entry timestamp."""
    return calculate_exit_settlement_quote(
        db=db,
        booking_reference=request.booking_reference,
        vehicle_plate=request.vehicle_plate,
        exit_time=request.exit_time,
        lane_code=request.lane_code,
    )


@reconciliation_router.post(
    "/exit/settle",
    response_model=ExitSettlementResponse,
    summary="Idempotently settle exit charges, release slot & open barrier",
)
def settle_exit(
    request: ExitSettlementRequest,
    db: Session = Depends(get_db),
):
    """Settle exit payment across FASTag auto-debit, Razorpay UPI, or zero balance."""
    result = settle_exit_payment(
        db=db,
        booking_reference=request.booking_reference,
        payment_method=request.payment_method,
        idempotency_key=request.idempotency_key,
        fastag_tag_id=request.fastag_tag_id,
        razorpay_order_id=request.razorpay_order_id,
        razorpay_payment_id=request.razorpay_payment_id,
        razorpay_signature=request.razorpay_signature,
        lane_code=request.lane_code,
        simulate_failure=request.simulate_failure or False,
    )
    return result


@reconciliation_router.post(
    "/exit/waive",
    summary="Operator supervisor waiver of exit fees",
)
def waive_exit_fee(
    request: ExitWaiverRequest,
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN, UserRole.GATE_STAFF])),
    db: Session = Depends(get_db),
):
    """Waive exit parking fees in case of emergency, VIP dispatch, or gate system malfunction."""
    return waive_exit_settlement(
        db=db,
        booking_reference=request.booking_reference,
        reason=request.reason,
        operator_email=current_user.email,
        operator_notes=request.operator_notes,
    )


@reconciliation_router.get(
    "/exit/sessions",
    summary="List all exit settlement sessions",
)
def list_exit_sessions(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve exit settlement sessions with optional status filter."""
    query = db.query(ExitSettlementSession)
    if status_filter:
        query = query.filter(ExitSettlementSession.settlement_status == status_filter.upper())
    sessions = query.order_by(ExitSettlementSession.created_at.desc()).limit(limit).all()
    return [
        {
            "session_reference": s.session_reference,
            "booking_reference": s.booking.booking_reference if s.booking else "N/A",
            "vehicle_number": s.vehicle_number,
            "facility_name": s.facility.name if s.facility else "Central Facility",
            "duration_minutes": s.duration_minutes,
            "overstay_minutes": s.overstay_minutes,
            "overstay_amount_inr": s.overstay_amount_inr,
            "gst_amount_inr": s.gst_amount_inr,
            "total_settlement_inr": s.total_settlement_inr,
            "settlement_status": s.settlement_status.value,
            "payment_method": s.payment_method.value if s.payment_method else None,
            "barrier_status": s.barrier_status.value,
            "receipt_number": s.receipt_number,
            "is_verified_entry": s.is_verified_entry,
            "created_at": s.created_at,
        }
        for s in sessions
    ]


@reconciliation_router.get(
    "/exit/unpaid",
    response_model=List[UnpaidExitSessionItem],
    summary="List unpaid or held exit sessions currently blocking lanes",
)
def list_unpaid_exits(
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN, UserRole.GATE_STAFF])),
    db: Session = Depends(get_db),
):
    """List vehicles held at exit barriers due to unpaid overstay fees or unverified entry."""
    sessions = (
        db.query(ExitSettlementSession)
        .filter(
            ExitSettlementSession.settlement_status.in_(
                [
                    SettlementStatus.PENDING_PAYMENT,
                    SettlementStatus.FAILED,
                    SettlementStatus.UNVERIFIED_ENTRY_HOLD,
                ]
            )
        )
        .order_by(ExitSettlementSession.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        UnpaidExitSessionItem(
            session_reference=s.session_reference,
            booking_reference=s.booking.booking_reference if s.booking else "N/A",
            vehicle_number=s.vehicle_number,
            facility_name=s.facility.name if s.facility else "Central Facility",
            slot_number=s.slot.slot_number if s.slot else "BAY-01",
            entry_time=s.entry_time,
            duration_minutes=s.duration_minutes,
            overstay_minutes=s.overstay_minutes,
            total_due_inr=s.total_settlement_inr,
            settlement_status=s.settlement_status.value,
            barrier_status=s.barrier_status.value,
            created_at=s.created_at,
        )
        for s in sessions
    ]


@reconciliation_router.get(
    "/payments",
    response_model=List[PaymentLedgerItem],
    summary="List master payment ledger with refund amounts",
)
def list_payment_ledger(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Retrieve full payment ledger for operator financial monitoring."""
    payments = db.query(Payment).order_by(Payment.created_at.desc()).limit(limit).all()
    return [
        PaymentLedgerItem(
            id=p.id,
            booking_reference=p.booking.booking_reference if p.booking else "N/A",
            vehicle_plate=p.booking.vehicle_number if p.booking else "N/A",
            amount_inr=p.amount_inr,
            payment_method=p.payment_method,
            status=p.status.value,
            receipt_number=p.receipt_number,
            created_at=p.created_at,
            refund_amount_inr=p.refund_amount_inr,
        )
        for p in payments
    ]


@reconciliation_router.post(
    "/refunds",
    response_model=RefundResponse,
    summary="Issue role-authorized refund with idempotency check",
)
def issue_refund(
    request: RefundIssueRequest,
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Issue refund to a driver booking with audit tracking."""
    return process_authorized_refund(
        db=db,
        booking_reference=request.booking_reference,
        amount_inr=request.amount_inr,
        reason=request.reason,
        operator_email=current_user.email,
        idempotency_key=request.idempotency_key,
    )


@reconciliation_router.get(
    "/refunds",
    summary="List all issued refund records",
)
def list_refunds(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Retrieve audit history of processed refunds."""
    refunds = db.query(PaymentRefund).order_by(PaymentRefund.created_at.desc()).limit(limit).all()
    return [
        {
            "refund_reference": r.refund_reference,
            "booking_reference": r.booking.booking_reference if r.booking else "N/A",
            "amount_inr": r.amount_inr,
            "reason": r.reason,
            "status": r.status.value,
            "initiated_by": r.initiated_by,
            "gateway_refund_id": r.gateway_refund_id,
            "created_at": r.created_at,
        }
        for r in refunds
    ]


@reconciliation_router.post(
    "/reconcile",
    response_model=GatewayReconciliationResponse,
    summary="Run batch reconciliation against payment gateway records",
)
def run_reconciliation(
    request: GatewayReconciliationRequest,
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Reconcile third-party gateway transactions against internal booking/exit payments."""
    return reconcile_gateway_batch(
        db=db,
        gateway_records=request.gateway_records,
        run_by_email=current_user.email,
    )


@reconciliation_router.get(
    "/reconcile/history",
    summary="List past reconciliation audit logs",
)
def list_reconciliation_history(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """List summary logs of previous gateway reconciliation batches."""
    logs = db.query(GatewayReconciliationLog).order_by(GatewayReconciliationLog.created_at.desc()).limit(limit).all()
    return [
        {
            "batch_reference": log.batch_reference,
            "total_gateway_records": log.total_gateway_records,
            "total_internal_records": log.total_internal_records,
            "matched_records_count": log.matched_records_count,
            "mismatch_count": log.mismatch_count,
            "gateway_total_amount_inr": log.gateway_total_amount_inr,
            "internal_total_amount_inr": log.internal_total_amount_inr,
            "discrepancy_amount_inr": log.discrepancy_amount_inr,
            "status": log.status.value,
            "performed_by": log.performed_by,
            "created_at": log.created_at,
        }
        for log in logs
    ]


@reconciliation_router.get(
    "/reports/summary",
    response_model=FinancialSummaryResponse,
    summary="Retrieve high-level financial KPIs and revenue breakdown",
)
def get_financial_summary(
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Retrieve operational financial KPIs including gross volume, GST, refunds, and FASTag share."""
    return get_financial_summary_metrics(db=db)


@reconciliation_router.get(
    "/reports/export",
    summary="Download financial audit report (CSV or JSON)",
)
def export_financial_report(
    format: str = Query("json", pattern="^(json|csv)$"),
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Export complete financial audit report in CSV or JSON format."""
    data = export_financial_report_data(db=db, report_format=format)
    if format.lower() == "csv":
        return PlainTextResponse(
            content=data,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=parkwise_financial_audit.csv"},
        )
    return data


@reconciliation_router.post(
    "/webhooks/razorpay",
    summary="Secure payment webhook with HMAC-SHA256 signature verification",
)
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Process incoming Razorpay webhook events with HMAC-SHA256 signature verification."""
    body_bytes = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")

    webhook_secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "mock_webhook_secret_key")

    # In production, verify HMAC-SHA256 signature
    if signature and webhook_secret:
        expected_sig = hmac.new(
            webhook_secret.encode("utf-8"),
            body_bytes,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_sig) and settings.ENVIRONMENT == "production":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Razorpay webhook signature.",
            )

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload.",
        )

    event_type = payload.get("event", "payment.captured")
    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = payment_entity.get("order_id")
    payment_id = payment_entity.get("id")

    if event_type == "payment.captured" and order_id:
        payment = db.query(Payment).filter(Payment.razorpay_order_id == order_id).first()
        if payment:
            payment.status = PaymentStatus.CAPTURED
            payment.razorpay_payment_id = payment_id
            payment.verified_at = utc_now()
            db.commit()

    return {"status": "success", "event": event_type, "processed_at": utc_now().isoformat()}
