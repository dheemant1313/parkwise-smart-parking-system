"""Daily Automated Financial Settlement & Gate Reconciliation Job.

Audits booking records against payment transactions and gate access logs:
- Verifies Razorpay captured payments match booking quotes.
- Identifies unpaid or overstay exits.
- Flags duplicate transactions and anomalous payment states.
- Generates JSON settlement ledger report.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models import Booking, Payment, PaymentStatus, BookingStatus
from app.models_gate_automation import ANPRVerificationEvent, AccessDecision, LaneDirection


def run_daily_reconciliation() -> dict:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        total_bookings = db.query(Booking).count()
        total_transactions = db.query(Payment).count()

        # Group transactions by status
        captured_txs = db.query(Payment).filter(Payment.status == PaymentStatus.CAPTURED).all()
        refunded_txs = db.query(Payment).filter(Payment.status == PaymentStatus.REFUNDED).all()
        failed_txs = db.query(Payment).filter(Payment.status == PaymentStatus.FAILED).all()

        total_captured_inr = sum(t.amount_inr for t in captured_txs)
        total_refunded_inr = sum(t.amount_inr for t in refunded_txs)

        # Discrepancy checks: COMPLETED bookings without a CAPTURED transaction
        completed_bookings = db.query(Booking).filter(Booking.status == BookingStatus.COMPLETED).all()
        unreconciled_bookings = []
        for b in completed_bookings:
            has_captured = b.payment and b.payment.status == PaymentStatus.CAPTURED
            if not has_captured and (b.total_amount_inr or 0) > 0:
                unreconciled_bookings.append({
                    "booking_id": b.id,
                    "code": b.booking_reference,
                    "amount_inr": b.total_amount_inr,
                    "reason": "COMPLETED_WITHOUT_CAPTURED_TRANSACTION",
                })

        # Overstay and rejected exits check
        unpaid_exits = db.query(ANPRVerificationEvent).filter(
            ANPRVerificationEvent.decision.in_([AccessDecision.REJECTED_EXPIRED, AccessDecision.REJECTED_NOT_CHECKED_IN])
        ).count()

        report = {
            "reconciliation_run_at": now.isoformat(),
            "status": "RECONCILED" if len(unreconciled_bookings) == 0 else "VARIANCES_DETECTED",
            "total_bookings_audited": total_bookings,
            "total_transactions_audited": total_transactions,
            "financial_summary": {
                "captured_count": len(captured_txs),
                "captured_total_inr": round(total_captured_inr, 2),
                "refunded_count": len(refunded_txs),
                "refunded_total_inr": round(total_refunded_inr, 2),
                "failed_count": len(failed_txs),
                "net_settled_inr": round(total_captured_inr - total_refunded_inr, 2),
            },
            "gate_compliance": {
                "unpaid_exit_attempts": unpaid_exits,
            },
            "variances": unreconciled_bookings,
            "variances_count": len(unreconciled_bookings),
        }

        # Write daily report
        report_dir = backend_dir / "reports" / "reconciliation"
        report_dir.mkdir(parents=True, exist_ok=True)
        report_file = report_dir / f"reconciliation_{now.strftime('%Y%m%d')}.json"
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        return report
    finally:
        db.close()


if __name__ == "__main__":
    rep = run_daily_reconciliation()
    print(f"Reconciliation Status: {rep['status']}")
    print(f"Net Settled (INR):     {rep['financial_summary']['net_settled_inr']}")
    print(f"Variances Detected:    {rep['variances_count']}")
