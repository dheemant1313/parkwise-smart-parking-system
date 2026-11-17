"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Receipt,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Lock,
  Unlock,
  Building,
  Zap,
  Sliders,
  Filter,
  Eye,
  FileText,
  Clock,
  Car,
} from "lucide-react";
import {
  ExitQuoteBreakdown,
  ExitSettlementResponse,
  FinancialSummaryResponse,
  GatewayReconciliationResponse,
  GatewayRecordInput,
  PaymentLedgerItem,
  TaxInvoiceData,
  UnpaidExitSessionItem,
  exportFinancialReport,
  fetchExitQuote,
  fetchFinancialSummary,
  fetchPaymentLedger,
  fetchUnpaidExits,
  issueRefund,
  runGatewayReconciliation,
  settleExit,
  waiveExitFee,
} from "@/lib/reconciliationApi";

export function FinancialReconciliationConsole() {
  const [activeTab, setActiveTab] = useState<"unpaid" | "ledger" | "reconciliation" | "invoices">("unpaid");

  // Summary Metrics
  const [summary, setSummary] = useState<FinancialSummaryResponse>({
    total_gross_volume_inr: 0,
    base_reservation_revenue_inr: 0,
    overstay_surcharge_revenue_inr: 0,
    total_gst_collected_inr: 0,
    total_refunds_inr: 0,
    net_settled_revenue_inr: 0,
    settlement_count: 0,
    unpaid_exit_count: 0,
    fastag_share_percent: 68.4,
    upi_card_share_percent: 31.6,
  });

  // Data states
  const [unpaidExits, setUnpaidExits] = useState<UnpaidExitSessionItem[]>([]);
  const [ledger, setLedger] = useState<PaymentLedgerItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Modals & Active Items
  const [selectedInvoice, setSelectedInvoice] = useState<TaxInvoiceData | null>(null);
  const [refundBookingRef, setRefundBookingRef] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("Customer rate discrepancy adjustment");
  const [waiverBookingRef, setWaiverBookingRef] = useState<string | null>(null);
  const [waiverReason, setWaiverReason] = useState<string>("Gate sensor malfunction / VIP clearance");

  // Gateway Recon state
  const [reconciliationResult, setReconciliationResult] = useState<GatewayReconciliationResponse | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sum, unpaid, led] = await Promise.all([
        fetchFinancialSummary(),
        fetchUnpaidExits(),
        fetchPaymentLedger(50),
      ]);
      setSummary(sum);
      setUnpaidExits(unpaid);
      setLedger(led);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (msg: string, type: "success" | "error" | "info" = "success") => {
    setFeedback({ message: msg, type });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Handlers
  const handleSettle = async (bookingRef: string, method: string) => {
    try {
      setLoading(true);
      const res = await settleExit({
        booking_reference: bookingRef,
        payment_method: method,
        idempotency_key: `IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        fastag_tag_id: "FTG-ICICI-NETC-8829",
      });
      showNotification(`Settlement complete: ${res.message}. Barrier released!`, "success");
      if (res.tax_invoice) {
        setSelectedInvoice(res.tax_invoice);
      }
      await loadData();
    } catch (e: any) {
      showNotification(e.message || "Settlement failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleWaive = async () => {
    if (!waiverBookingRef) return;
    try {
      setLoading(true);
      const res = await waiveExitFee({
        booking_reference: waiverBookingRef,
        reason: waiverReason,
      });
      showNotification(`Exit fee waived: ${res.message}`, "info");
      setWaiverBookingRef(null);
      await loadData();
    } catch (e: any) {
      showNotification(e.message || "Waiver failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRefundSubmit = async () => {
    if (!refundBookingRef || !refundAmount) return;
    try {
      setLoading(true);
      const res = await issueRefund({
        booking_reference: refundBookingRef,
        amount_inr: parseFloat(refundAmount),
        reason: refundReason,
        idempotency_key: `RFND-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      });
      showNotification(`Refund issued: INR ${res.amount_inr} (${res.refund_reference})`, "success");
      setRefundBookingRef(null);
      setRefundAmount("");
      await loadData();
    } catch (e: any) {
      showNotification(e.message || "Refund failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (format: "csv" | "json") => {
    try {
      const data = await exportFinancialReport(format);
      const blob = new Blob([data], { type: format === "csv" ? "text/csv" : "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `parkwise_financial_audit_${Date.now()}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      showNotification(`Exported financial report (${format.toUpperCase()}) successfully.`, "success");
    } catch (e: any) {
      showNotification(e.message || "Export failed", "error");
    }
  };

  const handleRunReconciliationSim = async () => {
    setLoading(true);
    try {
      const sampleGatewayRecords: GatewayRecordInput[] = [
        {
          gateway_order_id: ledger[0]?.receipt_number || "order_live_01",
          gateway_payment_id: "pay_gw_01",
          booking_reference: ledger[0]?.booking_reference || "BK-TEST-01",
          amount_inr: ledger[0]?.amount_inr || 118.0,
          currency: "INR",
          status: "captured",
          payment_method: "UPI",
        },
        {
          gateway_order_id: "order_delta_discrepancy_99",
          gateway_payment_id: "pay_delta_99",
          booking_reference: ledger[1]?.booking_reference || "BK-TEST-02",
          amount_inr: (ledger[1]?.amount_inr || 100) + 45.0, // Delta mismatch
          currency: "INR",
          status: "captured",
          payment_method: "CARD",
        },
        {
          gateway_order_id: "order_orphan_unlinked_33",
          gateway_payment_id: "pay_orphan_33",
          booking_reference: "BK-ORPHANED-NO-DB-RECORD",
          amount_inr: 350.0,
          currency: "INR",
          status: "captured",
          payment_method: "NETBANKING",
        },
        {
          gateway_order_id: ledger[0]?.receipt_number || "order_live_01",
          gateway_payment_id: "pay_dup_gw_01",
          booking_reference: ledger[0]?.booking_reference || "BK-TEST-01",
          amount_inr: ledger[0]?.amount_inr || 118.0,
          currency: "INR",
          status: "captured",
          payment_method: "UPI",
        },
      ];

      const res = await runGatewayReconciliation({ gateway_records: sampleGatewayRecords });
      setReconciliationResult(res);
      showNotification(`Batch reconciliation completed with status: ${res.status}`, "info");
      setActiveTab("reconciliation");
    } catch (e: any) {
      showNotification(e.message || "Reconciliation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredLedger = ledger.filter(
    (item) =>
      item.booking_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.vehicle_plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.receipt_number && item.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#060a14] text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border transition-all duration-300 ${
            feedback.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
              : feedback.type === "error"
              ? "bg-rose-950/90 border-rose-500/50 text-rose-200"
              : "bg-cyan-950/90 border-cyan-500/50 text-cyan-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : feedback.type === "error" ? (
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
          )}
          <span className="text-sm font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Automatic Exit, Payment & Reconciliation
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Phase 17 Live
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                GST Tax Invoicing (SAC 9967) • FASTag NETC Auto-Debit • Gateway Ledger Audit
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => handleDownloadReport("csv")}
            className="px-3.5 py-2 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 text-xs font-medium flex items-center gap-2 border border-emerald-700/50 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => handleDownloadReport("json")}
            className="px-3.5 py-2 rounded-lg bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-300 text-xs font-medium flex items-center gap-2 border border-cyan-700/50 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export JSON
          </button>
          <button
            onClick={handleRunReconciliationSim}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
          >
            <Zap className="w-3.5 h-3.5" />
            Run Gateway Recon
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">Gross Volume</span>
            <DollarSign className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-white tracking-tight">
            ₹{summary.total_gross_volume_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-cyan-400 font-medium">All completed checkouts</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">Overstay Surcharges</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-amber-300 tracking-tight">
            ₹{summary.overstay_surcharge_revenue_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium">Post-grace tariffs</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">GST Collected</span>
            <Receipt className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-indigo-300 tracking-tight">
            ₹{summary.total_gst_collected_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium">18% GST (SAC 9967)</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">Refunds Issued</span>
            <RotateCcw className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-rose-300 tracking-tight">
            ₹{summary.total_refunds_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium">Authorized returns</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">Net Settled</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-300 tracking-tight">
            ₹{summary.net_settled_revenue_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400/80 font-medium">Net realization</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">FASTag Share</span>
            <Zap className="w-4 h-4 text-amber-300" />
          </div>
          <div className="mt-2 text-xl font-bold text-white tracking-tight">
            {summary.fastag_share_percent}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium">
            UPI/Cards: {summary.upi_card_share_percent}%
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 mt-8 border-b border-slate-800">
        <button
          onClick={() => setActiveTab("unpaid")}
          className={`pb-3 px-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === "unpaid"
              ? "border-cyan-400 text-cyan-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Lock className="w-4 h-4" />
          Unpaid Exit Barrier Queue
          {unpaidExits.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
              {unpaidExits.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("ledger")}
          className={`pb-3 px-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === "ledger"
              ? "border-cyan-400 text-cyan-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          Payment Ledger & Refunds
        </button>

        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`pb-3 px-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === "reconciliation"
              ? "border-cyan-400 text-cyan-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Gateway Reconciliation Batch
          {reconciliationResult?.status === "DISCREPANCY_DETECTED" && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              Discrepancies
            </span>
          )}
        </button>
      </div>

      {/* TAB CONTENT: UNPAID EXIT QUEUE */}
      {activeTab === "unpaid" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <p>
              Vehicles currently held at boom barrier exit lanes awaiting payment clearance or supervisor verification.
            </p>
            <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300">
              Failsafe: Barrier remains locked until verified settlement
            </span>
          </div>

          {unpaidExits.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-80" />
              <h3 className="text-lg font-semibold text-white">All Exit Lanes Clear</h3>
              <p className="text-sm text-slate-400 mt-1">
                Zero vehicles currently held at exit boom barriers. All egress events successfully settled.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {unpaidExits.map((item) => (
                <div
                  key={item.session_reference}
                  className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-xl border ${
                        item.settlement_status === "UNVERIFIED_ENTRY_HOLD"
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      }`}
                    >
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-white tracking-wider">
                          {item.vehicle_number}
                        </span>
                        <span className="text-xs font-mono text-slate-400">({item.booking_reference})</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                            item.settlement_status === "UNVERIFIED_ENTRY_HOLD"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          }`}
                        >
                          {item.settlement_status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>Facility: <strong className="text-slate-200">{item.facility_name}</strong></span>
                        <span>Bay: <strong className="text-slate-200">{item.slot_number}</strong></span>
                        <span>Duration: <strong className="text-slate-200">{item.duration_minutes} min</strong></span>
                        <span>Overstay: <strong className="text-amber-400">{item.overstay_minutes} min</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-slate-400 uppercase font-medium">Overstay Due</div>
                      <div className="text-lg font-bold text-amber-400 font-mono">
                        ₹{item.total_due_inr.toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.settlement_status !== "UNVERIFIED_ENTRY_HOLD" && (
                        <>
                          <button
                            onClick={() => handleSettle(item.booking_reference, "FASTAG_AUTO_DEBIT")}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            FASTag Debit
                          </button>
                          <button
                            onClick={() => handleSettle(item.booking_reference, "RAZORPAY_UPI")}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            UPI Settle
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setWaiverBookingRef(item.booking_reference)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-200 text-xs font-medium border border-slate-700 hover:border-rose-700/50 transition flex items-center gap-1"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Waive Fee
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: MASTER PAYMENT LEDGER */}
      {activeTab === "ledger" && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by plate, booking ref, or receipt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
            <div className="text-xs text-slate-400">
              Showing <strong>{filteredLedger.length}</strong> transactions
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-4">Vehicle Plate</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Receipt</th>
                  <th className="py-3 px-4">Refunded</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLedger.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-300">{row.booking_reference}</td>
                    <td className="py-3 px-4 font-mono font-medium text-white">{row.vehicle_plate}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-100">₹{row.amount_inr.toFixed(2)}</td>
                    <td className="py-3 px-4 text-slate-300">{row.payment_method}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          row.status === "CAPTURED" || row.status === "SETTLED"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : row.status === "REFUNDED"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            : "bg-slate-700 text-slate-300 border-slate-600"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{row.receipt_number || "—"}</td>
                    <td className="py-3 px-4 font-mono text-rose-400">
                      {row.refund_amount_inr > 0 ? `₹${row.refund_amount_inr.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setRefundBookingRef(row.booking_reference);
                          setRefundAmount(row.amount_inr.toString());
                        }}
                        disabled={row.refund_amount_inr >= row.amount_inr}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/50 text-[11px] font-medium transition disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Refund
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: GATEWAY RECONCILIATION */}
      {activeTab === "reconciliation" && (
        <div className="mt-6 space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              Automated Gateway Reconciliation Batch
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Cross-validates external payment gateway statements (Razorpay / FASTag NETC clearing house) against Parkwise internal ledger. Flags amount discrepancies, duplicate debits, and orphaned settlement entries.
            </p>

            {reconciliationResult ? (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400">Batch Reference</span>
                    <div className="font-mono text-sm font-bold text-white mt-1">
                      {reconciliationResult.batch_reference}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400">Total Gateway Rows</span>
                    <div className="text-sm font-bold text-white mt-1">
                      {reconciliationResult.total_gateway_records}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400">Matched Valid</span>
                    <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      {reconciliationResult.matched_records_count} Records
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400">Mismatches / Deltas</span>
                    <div className="text-sm font-bold text-rose-400 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      {reconciliationResult.mismatch_count} Detected
                    </div>
                  </div>
                </div>

                {/* Discrepancies List */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                    Discrepancy Audit Log
                  </h4>
                  {reconciliationResult.discrepancies.length === 0 ? (
                    <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/30 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      100% Balanced: Zero settlement discrepancies detected between gateway statement and database.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reconciliationResult.discrepancies.map((d, i) => (
                        <div
                          key={i}
                          className="bg-slate-800/70 border border-amber-500/30 rounded-lg p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-[10px]">
                              {d.type}
                            </span>
                            <span className="font-mono text-slate-200">
                              Order: {d.order_id || "N/A"} • Booking: {d.booking_reference || "N/A"}
                            </span>
                          </div>
                          <div className="text-slate-300 font-medium">{d.detail}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-8 text-center py-8">
                <button
                  onClick={handleRunReconciliationSim}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                >
                  <Zap className="w-4 h-4" />
                  Initiate Gateway Reconciliation Run
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WAIVER MODAL */}
      {waiverBookingRef && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Unlock className="w-5 h-5 text-amber-400" />
              Operator Exit Fee Waiver
            </h3>
            <p className="text-xs text-slate-400">
              Waiver for booking <strong className="text-white font-mono">{waiverBookingRef}</strong>. This bypasses payment requirements, marks the session waived, logs an immutable compliance audit record, and actuates the exit boom barrier.
            </p>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Justification Reason</label>
              <textarea
                value={waiverReason}
                onChange={(e) => setWaiverReason(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setWaiverBookingRef(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleWaive}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-600/30 transition"
              >
                <Unlock className="w-4 h-4" />
                Confirm Waiver & Release Barrier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REFUND MODAL */}
      {refundBookingRef && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-rose-400" />
              Authorize Customer Refund
            </h3>
            <p className="text-xs text-slate-400">
              Issue an authorized refund for booking <strong className="text-white font-mono">{refundBookingRef}</strong>.
            </p>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Refund Amount (INR)</label>
              <input
                type="number"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full p-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Audit Reason</label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={2}
                className="w-full p-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setRefundBookingRef(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundSubmit}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition"
              >
                <RotateCcw className="w-4 h-4" />
                Process Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAX INVOICE MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">GST Tax Invoice (SAC 9967)</h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-2 text-slate-300">
              <div className="flex justify-between">
                <span>Invoice No:</span>
                <span className="font-mono font-bold text-white">{selectedInvoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Facility:</span>
                <span className="font-medium text-white">{selectedInvoice.facility_name}</span>
              </div>
              <div className="flex justify-between">
                <span>GSTIN:</span>
                <span className="font-mono text-cyan-300">{selectedInvoice.facility_gstin}</span>
              </div>
              <div className="flex justify-between">
                <span>Recipient Vehicle:</span>
                <span className="font-mono font-bold text-white">{selectedInvoice.recipient_vehicle}</span>
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden my-3">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-800 text-slate-400 font-semibold uppercase">
                  <tr>
                    <th className="p-2">Description</th>
                    <th className="p-2">SAC</th>
                    <th className="p-2 text-right">Taxable</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {selectedInvoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2 text-slate-200">{item.description}</td>
                      <td className="p-2 font-mono text-slate-400">{item.hsn_sac}</td>
                      <td className="p-2 font-mono text-right">₹{item.taxable_value.toFixed(2)}</td>
                      <td className="p-2 font-mono text-right font-bold text-emerald-300">
                        ₹{item.total_amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-sm font-bold text-white border-t border-slate-800 pt-3">
              <span>Grand Total Settled:</span>
              <span className="text-emerald-400 font-mono text-base">₹{selectedInvoice.grand_total_inr.toFixed(2)}</span>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
