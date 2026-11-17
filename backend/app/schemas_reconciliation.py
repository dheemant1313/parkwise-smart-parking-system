"""Phase 17: Pydantic Schemas for Automatic Exit, Payment Reconciliation & GST Audit."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ExitQuoteRequest(BaseModel):
    booking_reference: Optional[str] = None
    vehicle_plate: Optional[str] = None
    exit_time: Optional[datetime] = None
    lane_code: Optional[str] = None


class ExitQuoteBreakdown(BaseModel):
    session_reference: Optional[str] = None
    booking_reference: str
    vehicle_plate: str
    facility_id: int
    facility_name: str
    slot_number: str
    entry_time: datetime
    exit_time: datetime
    duration_minutes: int
    booked_duration_minutes: int
    grace_period_minutes: int
    overstay_minutes: int
    is_overstay: bool
    is_verified_entry: bool
    base_rate_per_hour_inr: float
    multiplier_applied: float
    base_booking_paid_inr: float
    overstay_charge_inr: float
    gst_amount_inr: float
    total_payable_inr: float
    action_required: str  # ZERO_BALANCE_EXIT, PAYMENT_REQUIRED, UNVERIFIED_ENTRY_HOLD


class ExitSettlementRequest(BaseModel):
    booking_reference: str
    payment_method: str = Field(..., description="ZERO_BALANCE, FASTAG_AUTO_DEBIT, RAZORPAY_UPI, CARD")
    idempotency_key: str = Field(..., description="Unique UUID to prevent duplicate billing")
    fastag_tag_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    lane_code: Optional[str] = None
    simulate_failure: Optional[bool] = False


class TaxInvoiceItem(BaseModel):
    hsn_sac: str = "9967"
    description: str
    taxable_value: float
    cgst_rate: float = 9.0
    cgst_amount: float
    sgst_rate: float = 9.0
    sgst_amount: float
    total_amount: float


class TaxInvoiceData(BaseModel):
    invoice_number: str
    invoice_date: datetime
    facility_name: str
    facility_gstin: str
    recipient_name: str
    recipient_vehicle: str
    items: List[TaxInvoiceItem]
    total_taxable_value: float
    total_tax: float
    grand_total_inr: float


class ExitSettlementResponse(BaseModel):
    session_reference: str
    booking_reference: str
    settlement_status: str
    barrier_status: str
    amount_paid_inr: float
    payment_method: str
    receipt_number: Optional[str] = None
    tax_invoice: Optional[Dict[str, Any]] = None
    slot_released: bool
    message: str


class ExitWaiverRequest(BaseModel):
    booking_reference: str
    reason: str
    operator_notes: Optional[str] = None


class RefundIssueRequest(BaseModel):
    booking_reference: str
    amount_inr: float
    reason: str
    idempotency_key: str


class RefundResponse(BaseModel):
    refund_reference: str
    booking_reference: str
    amount_inr: float
    status: str
    initiated_by: str
    created_at: datetime
    message: str


class GatewayRecordInput(BaseModel):
    gateway_order_id: str
    gateway_payment_id: str
    booking_reference: str
    amount_inr: float
    currency: str = "INR"
    status: str = "captured"
    payment_method: str = "UPI"
    created_at: Optional[str] = None


class GatewayReconciliationRequest(BaseModel):
    gateway_records: List[GatewayRecordInput]


class GatewayReconciliationResponse(BaseModel):
    batch_reference: str
    total_gateway_records: int
    total_internal_records: int
    matched_records_count: int
    mismatch_count: int
    gateway_total_amount_inr: float
    internal_total_amount_inr: float
    discrepancy_amount_inr: float
    status: str
    discrepancies: List[Dict[str, Any]]


class FinancialSummaryResponse(BaseModel):
    total_gross_volume_inr: float
    base_reservation_revenue_inr: float
    overstay_surcharge_revenue_inr: float
    total_gst_collected_inr: float
    total_refunds_inr: float
    net_settled_revenue_inr: float
    settlement_count: int
    unpaid_exit_count: int
    fastag_share_percent: float
    upi_card_share_percent: float


class PaymentLedgerItem(BaseModel):
    id: int
    booking_reference: str
    vehicle_plate: str
    amount_inr: float
    payment_method: str
    status: str
    receipt_number: Optional[str] = None
    created_at: datetime
    refund_amount_inr: float = 0.0


class UnpaidExitSessionItem(BaseModel):
    session_reference: str
    booking_reference: str
    vehicle_number: str
    facility_name: str
    slot_number: str
    entry_time: datetime
    duration_minutes: int
    overstay_minutes: int
    total_due_inr: float
    settlement_status: str
    barrier_status: str
    created_at: datetime
