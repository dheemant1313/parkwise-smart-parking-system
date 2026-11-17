"""Phase 17: Models for Automatic Exit, Payment Reconciliation & GST Audit.

Provides persistent data structures for:
- Real-time exit settlement sessions and overstay tariff tracking
- Payment settlement states and boom barrier interlock status
- Operator-authorized refund auditing and idempotency tracking
- Gateway reconciliation ledger (Razorpay, UPI, FASTag NETC protocol)
- Financial reporting and GST tax invoices (SAC 9967)
"""

import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SettlementStatus(str, enum.Enum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    SETTLED = "SETTLED"
    WAIVED_BY_OPERATOR = "WAIVED_BY_OPERATOR"
    FAILED = "FAILED"
    UNVERIFIED_ENTRY_HOLD = "UNVERIFIED_ENTRY_HOLD"


class ExitPaymentMethod(str, enum.Enum):
    ZERO_BALANCE = "ZERO_BALANCE"
    FASTAG_AUTO_DEBIT = "FASTAG_AUTO_DEBIT"
    RAZORPAY_UPI = "RAZORPAY_UPI"
    CARD = "CARD"
    NETBANKING = "NETBANKING"
    OPERATOR_WAIVED = "OPERATOR_WAIVED"


class ExitBarrierStatus(str, enum.Enum):
    LOCKED = "LOCKED"
    RELEASED = "RELEASED"
    FAULT = "FAULT"


class RefundStatus(str, enum.Enum):
    INITIATED = "INITIATED"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"


class ReconciliationStatus(str, enum.Enum):
    BALANCED = "BALANCED"
    DISCREPANCY_DETECTED = "DISCREPANCY_DETECTED"
    RESOLVED = "RESOLVED"


class ExitSettlementSession(Base):
    """Exit settlement record tracking entry-to-exit duration, overstay fees, and barrier release."""
    __tablename__ = "exit_settlement_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_reference = Column(String(40), unique=True, index=True, nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id"), index=True, nullable=False)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), index=True, nullable=False)
    slot_id = Column(Integer, ForeignKey("parking_slots.id"), index=True, nullable=False)
    vehicle_number = Column(String(30), index=True, nullable=False)
    lane_id = Column(Integer, ForeignKey("gate_lane_controllers.id"), nullable=True)

    entry_time = Column(DateTime(timezone=True), nullable=False)
    exit_time = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=0, nullable=False)
    booked_duration_minutes = Column(Integer, default=0, nullable=False)
    grace_period_minutes = Column(Integer, default=15, nullable=False)
    overstay_minutes = Column(Integer, default=0, nullable=False)

    base_booking_amount_inr = Column(Float, default=0.0, nullable=False)
    overstay_rate_per_hour_inr = Column(Float, default=0.0, nullable=False)
    overstay_amount_inr = Column(Float, default=0.0, nullable=False)
    gst_rate_percent = Column(Float, default=18.0, nullable=False)
    gst_amount_inr = Column(Float, default=0.0, nullable=False)
    total_settlement_inr = Column(Float, default=0.0, nullable=False)

    settlement_status = Column(
        SQLEnum(SettlementStatus),
        default=SettlementStatus.PENDING_PAYMENT,
        index=True,
        nullable=False,
    )
    payment_method = Column(SQLEnum(ExitPaymentMethod), nullable=True)
    idempotency_key = Column(String(80), unique=True, index=True, nullable=True)
    gateway_order_id = Column(String(80), index=True, nullable=True)
    gateway_payment_id = Column(String(80), index=True, nullable=True)

    barrier_status = Column(
        SQLEnum(ExitBarrierStatus), default=ExitBarrierStatus.LOCKED, nullable=False
    )
    receipt_number = Column(String(48), unique=True, index=True, nullable=True)
    tax_invoice_json = Column(Text, nullable=True)
    failure_reason = Column(Text, nullable=True)

    is_verified_entry = Column(Boolean, default=True, nullable=False)
    waiver_reason = Column(Text, nullable=True)
    waived_by = Column(String(160), nullable=True)
    settled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    booking = relationship("Booking")
    facility = relationship("ParkingLot")
    slot = relationship("ParkingSlot")
    lane = relationship("GateLaneController")
    refunds = relationship(
        "PaymentRefund", back_populates="settlement_session", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_settlement_booking_status", "booking_id", "settlement_status"),
    )


class PaymentRefund(Base):
    """Audited operator-authorized refund transaction with gateway reference."""
    __tablename__ = "payment_refunds"

    id = Column(Integer, primary_key=True, index=True)
    refund_reference = Column(String(40), unique=True, index=True, nullable=False)
    session_id = Column(
        Integer, ForeignKey("exit_settlement_sessions.id"), nullable=True, index=True
    )
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True, index=True)

    amount_inr = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(SQLEnum(RefundStatus), default=RefundStatus.PROCESSED, nullable=False)
    initiated_by = Column(String(160), nullable=False)
    gateway_refund_id = Column(String(80), nullable=True)
    idempotency_key = Column(String(80), unique=True, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    settlement_session = relationship("ExitSettlementSession", back_populates="refunds")
    booking = relationship("Booking")
    payment = relationship("Payment")


class GatewayReconciliationLog(Base):
    """Audit log for automated payment gateway reconciliation runs."""
    __tablename__ = "gateway_reconciliation_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_reference = Column(String(40), unique=True, index=True, nullable=False)
    total_gateway_records = Column(Integer, default=0, nullable=False)
    total_internal_records = Column(Integer, default=0, nullable=False)
    matched_records_count = Column(Integer, default=0, nullable=False)
    mismatch_count = Column(Integer, default=0, nullable=False)

    gateway_total_amount_inr = Column(Float, default=0.0, nullable=False)
    internal_total_amount_inr = Column(Float, default=0.0, nullable=False)
    discrepancy_amount_inr = Column(Float, default=0.0, nullable=False)
    discrepancies_json = Column(Text, nullable=True)

    status = Column(
        SQLEnum(ReconciliationStatus),
        default=ReconciliationStatus.BALANCED,
        nullable=False,
    )
    performed_by = Column(String(160), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
