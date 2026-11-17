/**
 * Phase 17: Typed API Client for Automatic Exit, Payment & Reconciliation.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export type SettlementStatus =
  | "PENDING_PAYMENT"
  | "SETTLED"
  | "WAIVED_BY_OPERATOR"
  | "FAILED"
  | "UNVERIFIED_ENTRY_HOLD";

export type ExitPaymentMethod =
  | "ZERO_BALANCE"
  | "FASTAG_AUTO_DEBIT"
  | "RAZORPAY_UPI"
  | "CARD"
  | "NETBANKING"
  | "OPERATOR_WAIVED";

export type ExitBarrierStatus = "LOCKED" | "RELEASED" | "FAULT";

export interface ExitQuoteRequest {
  booking_reference?: string;
  vehicle_plate?: string;
  exit_time?: string;
  lane_code?: string;
}

export interface ExitQuoteBreakdown {
  session_reference?: string;
  booking_reference: string;
  vehicle_plate: string;
  facility_id: number;
  facility_name: string;
  slot_number: string;
  entry_time: string;
  exit_time: string;
  duration_minutes: number;
  booked_duration_minutes: number;
  grace_period_minutes: number;
  overstay_minutes: number;
  is_overstay: boolean;
  is_verified_entry: boolean;
  base_rate_per_hour_inr: number;
  multiplier_applied: number;
  base_booking_paid_inr: number;
  overstay_charge_inr: number;
  gst_amount_inr: number;
  total_payable_inr: number;
  action_required: "ZERO_BALANCE_EXIT" | "PAYMENT_REQUIRED" | "UNVERIFIED_ENTRY_HOLD";
}

export interface ExitSettlementRequest {
  booking_reference: string;
  payment_method: string;
  idempotency_key: string;
  fastag_tag_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  lane_code?: string;
  simulate_failure?: boolean;
}

export interface TaxInvoiceItem {
  hsn_sac: string;
  description: string;
  taxable_value: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  total_amount: number;
}

export interface TaxInvoiceData {
  invoice_number: string;
  invoice_date: string;
  facility_name: string;
  facility_gstin: string;
  recipient_name: string;
  recipient_vehicle: string;
  items: TaxInvoiceItem[];
  total_taxable_value: number;
  total_tax: number;
  grand_total_inr: number;
}

export interface ExitSettlementResponse {
  session_reference: string;
  booking_reference: string;
  settlement_status: SettlementStatus;
  barrier_status: ExitBarrierStatus;
  amount_paid_inr: number;
  payment_method: string;
  receipt_number?: string;
  tax_invoice?: TaxInvoiceData;
  slot_released: boolean;
  message: string;
}

export interface ExitWaiverRequest {
  booking_reference: string;
  reason: string;
  operator_notes?: string;
}

export interface UnpaidExitSessionItem {
  session_reference: string;
  booking_reference: string;
  vehicle_number: string;
  facility_name: string;
  slot_number: string;
  entry_time: string;
  duration_minutes: number;
  overstay_minutes: number;
  total_due_inr: number;
  settlement_status: SettlementStatus;
  barrier_status: ExitBarrierStatus;
  created_at: string;
}

export interface PaymentLedgerItem {
  id: number;
  booking_reference: string;
  vehicle_plate: string;
  amount_inr: number;
  payment_method: string;
  status: string;
  receipt_number?: string;
  created_at: string;
  refund_amount_inr: number;
}

export interface RefundIssueRequest {
  booking_reference: string;
  amount_inr: number;
  reason: string;
  idempotency_key: string;
}

export interface RefundResponse {
  refund_reference: string;
  booking_reference: string;
  amount_inr: number;
  status: string;
  initiated_by: string;
  created_at: string;
  message: string;
}

export interface GatewayRecordInput {
  gateway_order_id: string;
  gateway_payment_id: string;
  booking_reference: string;
  amount_inr: number;
  currency?: string;
  status?: string;
  payment_method?: string;
  created_at?: string;
}

export interface GatewayReconciliationRequest {
  gateway_records: GatewayRecordInput[];
}

export interface GatewayReconciliationResponse {
  batch_reference: string;
  total_gateway_records: number;
  total_internal_records: number;
  matched_records_count: number;
  mismatch_count: number;
  gateway_total_amount_inr: number;
  internal_total_amount_inr: number;
  discrepancy_amount_inr: number;
  status: "BALANCED" | "DISCREPANCY_DETECTED" | "RESOLVED";
  discrepancies: Array<{
    type: string;
    order_id?: string;
    booking_reference?: string;
    amount_inr?: number;
    gateway_amount?: number;
    internal_amount?: number;
    delta?: number;
    detail: string;
  }>;
}

export interface FinancialSummaryResponse {
  total_gross_volume_inr: number;
  base_reservation_revenue_inr: number;
  overstay_surcharge_revenue_inr: number;
  total_gst_collected_inr: number;
  total_refunds_inr: number;
  net_settled_revenue_inr: number;
  settlement_count: number;
  unpaid_exit_count: number;
  fastag_share_percent: number;
  upi_card_share_percent: number;
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

export async function fetchExitQuote(req: ExitQuoteRequest): Promise<ExitQuoteBreakdown> {
  const res = await fetch(`${API_BASE}/reconciliation/exit/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to calculate quote" }));
    throw new Error(err.detail || "Exit quote calculation failed");
  }
  return res.json();
}

export async function settleExit(req: ExitSettlementRequest): Promise<ExitSettlementResponse> {
  const res = await fetch(`${API_BASE}/reconciliation/exit/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Settlement failed" }));
    throw new Error(err.detail || "Exit settlement failed");
  }
  return res.json();
}

export async function waiveExitFee(req: ExitWaiverRequest, token?: string): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/reconciliation/exit/waive`, {
    method: "POST",
    headers,
    credentials: "omit",
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Fee waiver failed" }));
    throw new Error(err.detail || "Fee waiver failed");
  }
  return res.json();
}

export async function fetchUnpaidExits(token?: string): Promise<UnpaidExitSessionItem[]> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/reconciliation/exit/unpaid`, {
    headers,
    credentials: "omit",
  });
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function fetchPaymentLedger(limit = 50, token?: string): Promise<PaymentLedgerItem[]> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/reconciliation/payments?limit=${limit}`, {
    headers,
    credentials: "omit",
  });
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function issueRefund(req: RefundIssueRequest, token?: string): Promise<RefundResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/reconciliation/refunds`, {
    method: "POST",
    headers,
    credentials: "omit",
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Refund failed" }));
    throw new Error(err.detail || "Refund failed");
  }
  return res.json();
}

export async function runGatewayReconciliation(
  req: GatewayReconciliationRequest,
  token?: string
): Promise<GatewayReconciliationResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/reconciliation/reconcile`, {
    method: "POST",
    headers,
    credentials: "omit",
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Reconciliation failed" }));
    throw new Error(err.detail || "Reconciliation failed");
  }
  return res.json();
}

export async function fetchFinancialSummary(token?: string): Promise<FinancialSummaryResponse> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/reconciliation/reports/summary`, {
    headers,
    credentials: "omit",
  });
  if (!res.ok) {
    return {
      total_gross_volume_inr: 0,
      base_reservation_revenue_inr: 0,
      overstay_surcharge_revenue_inr: 0,
      total_gst_collected_inr: 0,
      total_refunds_inr: 0,
      net_settled_revenue_inr: 0,
      settlement_count: 0,
      unpaid_exit_count: 0,
      fastag_share_percent: 65,
      upi_card_share_percent: 35,
    };
  }
  return res.json();
}

export async function exportFinancialReport(format: "csv" | "json" = "json", token?: string): Promise<string> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/reconciliation/reports/export?format=${format}`, {
    headers,
    credentials: "omit",
  });
  if (!res.ok) {
    throw new Error("Export failed");
  }
  return res.text();
}
