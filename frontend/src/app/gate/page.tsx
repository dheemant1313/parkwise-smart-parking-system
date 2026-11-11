"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  KeyRound,
  Lock,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { OfflineSyncReportItem } from "@/types";
import { ProtectedRouteGate } from "@/components/auth/ProtectedRouteGate";

type GateTab =
  | "SCANNER_AND_QR"
  | "MANUAL_OVERRIDE"
  | "OFFLINE_WORKFLOW"
  | "PAYMENTS_AND_WEBHOOKS";

export default function GateManagementPage() {
  const {
    lots,
    bookings,
    gateLogs,
    authUser,
    activeRole,
    hasPermission,
    processGateScan,
    issueOrRotateQRPass,
    revokeQRPass,
    expireQRPassForDemo,
    manualGateOverride,
    offlineMode,
    setOfflineMode,
    offlineGateQueue,
    queueOfflineGateScan,
    syncOfflineGateQueue,
    webhookLogs,
    triggerRazorpayWebhook,
    refundBookingPayment,
    getPaymentReceipt,
  } = useParkwise();

  const defaultBooking = bookings[0];
  const [activeTab, setActiveTab] = useState<GateTab>("SCANNER_AND_QR");

  // Scanner state
  const [bookingRef, setBookingRef] = useState<string>(
    defaultBooking?.booking_reference || "PW-DEMO-9012"
  );
  const [vehiclePlate, setVehiclePlate] = useState<string>(
    defaultBooking?.vehicle_number || "DL-08-CAF-8921"
  );
  const [qrSignature, setQrSignature] = useState<string>(
    defaultBooking?.qr_signature || ""
  );
  const [gateAction, setGateAction] = useState<"ENTRY" | "EXIT">("ENTRY");
  const [gateLane, setGateLane] = useState<string>("LANE-01 (ANPR+FASTag)");
  const [simulateOverstayMins, setSimulateOverstayMins] = useState<number>(0);
  const [barrierState, setBarrierState] = useState<
    "STANDBY" | "OPENED" | "LOCKED"
  >("STANDBY");
  const [statusFeedback, setStatusFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Manual Override state
  const [overrideLotId, setOverrideLotId] = useState<number>(1);
  const [overrideBookingRef, setOverrideBookingRef] = useState<string>(
    defaultBooking?.booking_reference || "PW-DEMO-9012"
  );
  const [overridePlate, setOverridePlate] = useState<string>(
    defaultBooking?.vehicle_number || "DL-08-CAF-8921"
  );
  const [overrideAction, setOverrideAction] = useState<
    "OPEN_ENTRY" | "OPEN_EXIT" | "LOCK_LANE"
  >("OPEN_ENTRY");
  const [overrideReason, setOverrideReason] = useState<string>(
    "Emergency medical convoy / diplomatic supervisor clearance"
  );
  const [overrideFeedback, setOverrideFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Offline Sync state
  const [syncReports, setSyncReports] = useState<OfflineSyncReportItem[]>([]);
  const [offlineFeedback, setOfflineFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Payments, Webhooks & Refunds state
  const [selectedPaymentRef, setSelectedPaymentRef] = useState<string>(
    defaultBooking?.booking_reference || "PW-DEMO-9012"
  );
  const [webhookEventId, setWebhookEventId] = useState<string>(
    "evt_rzp_live_2026_001"
  );
  const [webhookEventType, setWebhookEventType] = useState<
    "payment.captured" | "payment.failed" | "refund.processed"
  >("payment.captured");
  const [refundReason, setRefundReason] = useState<string>(
    "Customer flight rescheduled — full pre-check-in refund"
  );
  const [paymentFeedback, setPaymentFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const currentBooking =
    bookings.find(
      (b) => b.booking_reference.toUpperCase() === bookingRef.toUpperCase()
    ) || bookings[0];

  const selectedPaymentBooking =
    bookings.find(
      (b) =>
        b.booking_reference.toUpperCase() === selectedPaymentRef.toUpperCase()
    ) || bookings[0];

  const activeReceipt = selectedPaymentBooking
    ? getPaymentReceipt(selectedPaymentBooking.booking_reference)
    : null;

  function loadBookingIntoScanner(ref: string) {
    const found = bookings.find((b) => b.booking_reference === ref);
    if (!found) return;
    setBookingRef(found.booking_reference);
    setVehiclePlate(found.vehicle_number);
    setQrSignature(found.qr_pass?.qr_signature || found.qr_signature);
    setGateAction(found.status === "ACTIVE" ? "EXIT" : "ENTRY");
    setStatusFeedback(null);
  }

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusFeedback(null);

    if (offlineMode) {
      const queued = queueOfflineGateScan({
        bookingReference: bookingRef,
        qrSignature,
        vehicleNumber: vehiclePlate,
        action: gateAction,
        gateLane,
      });
      setBarrierState("OPENED");
      setStatusFeedback({
        type: "success",
        text: `OFFLINE EDGE MODE: Signed QR pass queued locally (${queued.offline_event_id}) for ${queued.booking_reference} [${queued.action}]. Synchronize in the Offline Workflow tab to commit and verify against replay conflicts.`,
      });
      return;
    }

    try {
      const result = await processGateScan({
        bookingReference: bookingRef,
        qrSignature,
        vehicleNumber: vehiclePlate,
        action: gateAction,
        gateLane,
        simulateOverstayMinutes:
          gateAction === "EXIT" ? simulateOverstayMins : 0,
      });
      setBarrierState("OPENED");
      setStatusFeedback({
        type: "success",
        text: result.message,
      });
    } catch (err: unknown) {
      setBarrierState("LOCKED");
      setStatusFeedback({
        type: "error",
        text:
          err instanceof Error ? err.message : "Gate verification rejected.",
      });
    }
  }

  async function handleRotatePass() {
    if (!currentBooking) return;
    try {
      const rotated = await issueOrRotateQRPass(
        currentBooking.booking_reference,
        180
      );
      setQrSignature(rotated.qr_signature);
      setStatusFeedback({
        type: "success",
        text: `Issued fresh signed time-limited QR pass (${rotated.token_jti}) valid until ${new Date(rotated.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Previous token revoked.`,
      });
    } catch (err: unknown) {
      setStatusFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to rotate QR pass.",
      });
    }
  }

  async function handleExpirePass() {
    if (!currentBooking) return;
    try {
      const exp = await expireQRPassForDemo(currentBooking.booking_reference);
      setStatusFeedback({
        type: "error",
        text: `Simulated token expiration for ${exp.token_jti} (expired 15 minutes ago). Try scanning now to verify DENIED_EXPIRED_QR_PASS enforcement.`,
      });
    } catch (err: unknown) {
      setStatusFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to expire QR pass.",
      });
    }
  }

  async function handleRevokePass() {
    if (!currentBooking) return;
    try {
      const rev = await revokeQRPass(
        currentBooking.booking_reference,
        "Revoked by gate security supervisor"
      );
      setStatusFeedback({
        type: "error",
        text: `Revoked QR pass token ${rev.token_jti}. Any scan attempt with this token will now be blocked (DENIED_REVOKED_QR_PASS).`,
      });
    } catch (err: unknown) {
      setStatusFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to revoke QR pass.",
      });
    }
  }

  async function handleManualOverrideSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOverrideFeedback(null);
    try {
      const log = await manualGateOverride({
        lotId: overrideLotId,
        bookingReference: overrideBookingRef,
        vehicleNumber: overridePlate,
        action: overrideAction,
        gateLane,
        overrideReason,
      });
      setBarrierState(log.barrier_action);
      setOverrideFeedback({
        type: "success",
        text: `Supervisor Override Executed (${overrideAction}) by ${log.staff_override_by} — Barrier is now ${log.barrier_action}. Logged to immutable audit trail.`,
      });
    } catch (err: unknown) {
      setOverrideFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Manual override rejected.",
      });
    }
  }

  async function handleRunOfflineSync() {
    setOfflineFeedback(null);
    try {
      const reports = await syncOfflineGateQueue();
      setSyncReports(reports);
      const applied = reports.filter(
        (r) => r.resolution === "SYNCED_APPLIED"
      ).length;
      const conflicts = reports.filter(
        (r) => r.resolution !== "SYNCED_APPLIED"
      ).length;
      setOfflineFeedback({
        type: "success",
        text: `Offline batch synchronization complete: ${applied} event(s) applied to cloud ledger, ${conflicts} conflict/rejected/idempotent event(s) handled safely.`,
      });
    } catch (err: unknown) {
      setOfflineFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Offline sync failed.",
      });
    }
  }

  async function handleTriggerWebhook(tamperSignature: boolean) {
    setPaymentFeedback(null);
    try {
      const result = await triggerRazorpayWebhook({
        webhookEventId,
        eventType: webhookEventType,
        bookingReference: selectedPaymentRef,
        tamperSignature,
      });
      setPaymentFeedback({
        type: "success",
        text: result.idempotent_replay
          ? `Idempotent Webhook Replay Guard: Event '${result.webhook_event_id}' was already processed earlier. Duplicate state mutation prevented (idempotent_replay=true).`
          : `Verified X-Razorpay-Signature HMAC & processed webhook '${result.webhook_event_id}' (${result.event_type} -> ${result.status_applied}).`,
      });
    } catch (err: unknown) {
      setPaymentFeedback({
        type: "error",
        text:
          err instanceof Error ? err.message : "Webhook verification rejected.",
      });
    }
  }

  async function handleRefundPayment() {
    setPaymentFeedback(null);
    try {
      const updated = await refundBookingPayment(
        selectedPaymentRef,
        refundReason
      );
      setPaymentFeedback({
        type: "success",
        text: `Refunded ₹${updated.payment.refund_amount_inr} for ${updated.booking_reference} (Refund ID: ${updated.payment.refund_id}). Associated QR pass revoked and bay released.`,
      });
    } catch (err: unknown) {
      setPaymentFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Refund failed.",
      });
    }
  }

  return (
    <ProtectedRouteGate
      allowedRoles={["GATE_STAFF", "OPERATOR", "ADMIN"]}
      requiredPermission="gate:scan"
      applicationName="Gate Boom-Barrier & Razorpay Payment Terminal"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Phase 05 • Payments, Signed QR Passes, Gate Control &amp; Offline Sync
            </span>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
              Zero-Trust Gate Terminal &amp; Razorpay Verification Hub
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Signed time-limited QR passes, anti-replay entry/exit guard, overstay calculation, RBAC supervisor override, offline event synchronization, and idempotent Razorpay webhooks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Offline Edge Mode Switch */}
            <button
              type="button"
              onClick={() => setOfflineMode(!offlineMode)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-extrabold transition-all ${
                offlineMode
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {offlineMode ? (
                <>
                  <WifiOff className="h-4 w-4 text-amber-600" />
                  <span>OFFLINE EDGE QUEUE: ACTIVE ({offlineGateQueue.filter((q) => q.queued_status === "PENDING_SYNC").length} pending)</span>
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 text-emerald-600" />
                  <span>ONLINE CLOUD VERIFICATION</span>
                </>
              )}
            </button>

            {/* Live Boom Barrier Status Pill */}
            <div
              className={`flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-xs font-extrabold ${
                barrierState === "OPENED"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : barrierState === "LOCKED"
                  ? "border-red-300 bg-red-50 text-red-800"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {barrierState === "OPENED" ? (
                <Unlock className="h-4 w-4 text-emerald-600" />
              ) : (
                <Lock className="h-4 w-4 text-red-600" />
              )}
              <span>BOOM BARRIER: {barrierState}</span>
            </div>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab("SCANNER_AND_QR")}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === "SCANNER_AND_QR"
                ? "bg-brand-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>1. QR Scanner, Anti-Replay &amp; Overstay</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("MANUAL_OVERRIDE")}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === "MANUAL_OVERRIDE"
                ? "bg-brand-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <KeyRound className="h-4 w-4" />
            <span>2. Manual Staff Override (RBAC)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("OFFLINE_WORKFLOW")}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === "OFFLINE_WORKFLOW"
                ? "bg-brand-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <RefreshCw className="h-4 w-4" />
            <span>
              3. Offline Edge Queue &amp; Conflict Sync ({offlineGateQueue.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("PAYMENTS_AND_WEBHOOKS")}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === "PAYMENTS_AND_WEBHOOKS"
                ? "bg-brand-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>4. Razorpay Orders, Webhooks, Refunds &amp; GST Receipts</span>
          </button>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: QR SCANNER, SIGNED PASS LIFECYCLE, ANTI-REPLAY & OVERSTAY    */}
        {/* =================================================================== */}
        {activeTab === "SCANNER_AND_QR" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* LEFT COLUMN: Optical ANPR + Signed QR Pass Token Inspector */}
            <div className="space-y-6 lg:col-span-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-apple space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                    <Camera className="h-3.5 w-3.5" />
                    OPTICAL ANPR + QR VERIFIER • {gateLane}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    Confidence: 99.1%
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/90 py-8 px-4 text-center space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    Optical License Plate Recognition (IND RTO)
                  </p>
                  <div className="inline-flex items-center gap-2 rounded-xl border-2 border-amber-400 bg-white px-5 py-2.5 font-mono text-2xl font-black tracking-wider text-slate-950 shadow-lg">
                    <span className="text-[10px] font-bold text-blue-700">
                      IND
                    </span>
                    <span>{vehiclePlate || "DL-08-CAF-8921"}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Active Reservation:{" "}
                    <strong className="text-white">{bookingRef}</strong> • Status:{" "}
                    <strong className="text-emerald-400">
                      {currentBooking?.status || "CONFIRMED"}
                    </strong>
                  </p>
                </div>

                {/* Signed Time-Limited QR Pass Telemetry Card */}
                {currentBooking && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider text-brand-400">
                        Signed Time-Limited QR Pass Token
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                          currentBooking.qr_pass?.is_revoked
                            ? "bg-red-500/20 text-red-300 border border-red-500/40"
                            : currentBooking.qr_pass?.expires_at &&
                              new Date(
                                currentBooking.qr_pass.expires_at
                              ).getTime() < Date.now()
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        }`}
                      >
                        {currentBooking.qr_pass?.is_revoked
                          ? "REVOKED"
                          : currentBooking.qr_pass?.expires_at &&
                            new Date(
                              currentBooking.qr_pass.expires_at
                            ).getTime() < Date.now()
                          ? "EXPIRED"
                          : "ACTIVE & SIGNED"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-[11px] text-slate-300">
                      <div>
                        <span className="text-slate-500">Token JTI:</span>{" "}
                        <span className="font-mono font-bold text-white">
                          {currentBooking.qr_pass?.token_jti || "qr_jti_v2"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Expires At:</span>{" "}
                        <span className="font-mono text-white">
                          {currentBooking.qr_pass?.expires_at
                            ? new Date(
                                currentBooking.qr_pass.expires_at
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "2h post-slot"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Entry Timestamp:</span>{" "}
                        <span className="font-mono text-emerald-300">
                          {currentBooking.checked_in_at
                            ? new Date(
                                currentBooking.checked_in_at
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            : "Not Checked In"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Exit Timestamp:</span>{" "}
                        <span className="font-mono text-sky-300">
                          {currentBooking.checked_out_at
                            ? new Date(
                                currentBooking.checked_out_at
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            : "Not Checked Out"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleRotatePass}
                        className="rounded-xl bg-brand-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-brand-500"
                      >
                        Issue / Rotate Fresh QR Pass
                      </button>
                      <button
                        type="button"
                        onClick={handleExpirePass}
                        className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20"
                      >
                        Simulate Expired Pass
                      </button>
                      <button
                        type="button"
                        onClick={handleRevokePass}
                        className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-500/20"
                      >
                        Revoke QR Pass
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Active Reservations Quick-Load List */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-4">
                <h2 className="text-sm font-bold text-slate-900">
                  Active Reservations (Click to Load into Gate Scanner)
                </h2>
                <div className="space-y-2.5">
                  {bookings.map((b) => (
                    <button
                      key={b.booking_reference}
                      type="button"
                      onClick={() => loadBookingIntoScanner(b.booking_reference)}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-left hover:border-brand-500 hover:bg-white transition-all"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-slate-900">
                            {b.booking_reference}
                          </span>
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                            {b.status}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            Payment: {b.payment.status}
                          </span>
                          {b.overstay_fee_inr > 0 && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              Overstay: ₹{b.overstay_fee_inr}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Plate: <strong>{b.vehicle_number}</strong> • Bay:{" "}
                          <strong>{b.slot_number}</strong> • Entry:{" "}
                          <strong>
                            {b.checked_in_at ? "Stamped" : "Pending"}
                          </strong>{" "}
                          • Exit:{" "}
                          <strong>
                            {b.checked_out_at ? "Stamped" : "Pending"}
                          </strong>
                        </p>
                      </div>
                      <span className="text-xs font-bold text-brand-600">
                        Load Pass →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Cryptographic QR & ANPR Verification Form + Gate Event Stream */}
            <div className="space-y-6 lg:col-span-6">
              <form
                onSubmit={handleScanSubmit}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-5"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                      Zero-Trust Gate Controller
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      Verify HMAC-SHA256 QR, Anti-Replay &amp; Trigger Barrier
                    </h2>
                  </div>
                  <QrCode className="h-6 w-6 text-brand-600" />
                </div>

                {statusFeedback && (
                  <div
                    role="alert"
                    className={`flex items-start gap-2.5 rounded-2xl border p-4 text-xs font-semibold ${
                      statusFeedback.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    {statusFeedback.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    )}
                    <span>{statusFeedback.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGateAction("ENTRY")}
                    className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                      gateAction === "ENTRY"
                        ? "bg-brand-600 text-white shadow-sm"
                        : "border border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    GATE ENTRY (Stamp Entry &amp; Occupy Bay)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGateAction("EXIT")}
                    className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                      gateAction === "EXIT"
                        ? "bg-brand-600 text-white shadow-sm"
                        : "border border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    GATE EXIT (Calculate Overstay &amp; Release)
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="gate-booking-ref"
                      className="block text-xs font-bold text-slate-700"
                    >
                      Booking Reference Code
                    </label>
                    <input
                      id="gate-booking-ref"
                      type="text"
                      required
                      value={bookingRef}
                      onChange={(e) =>
                        setBookingRef(e.target.value.toUpperCase())
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="gate-lane-select"
                      className="block text-xs font-bold text-slate-700"
                    >
                      Gate Lane Terminal
                    </label>
                    <select
                      id="gate-lane-select"
                      value={gateLane}
                      onChange={(e) => setGateLane(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-900"
                    >
                      <option value="LANE-01 (ANPR+FASTag)">
                        LANE-01 (ANPR+FASTag)
                      </option>
                      <option value="LANE-02 (EV Priority Entry)">
                        LANE-02 (EV Priority Entry)
                      </option>
                      <option value="LANE-03 (Exit Express)">
                        LANE-03 (Exit Express)
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="gate-plate"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Optical ANPR Detected Vehicle Plate
                  </label>
                  <input
                    id="gate-plate"
                    type="text"
                    required
                    value={vehiclePlate}
                    onChange={(e) =>
                      setVehiclePlate(e.target.value.toUpperCase())
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="gate-hmac"
                      className="block text-xs font-bold text-slate-700"
                    >
                      Cryptographic QR Signature (HMAC-SHA256)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setQrSignature("tampered_forged_signature_0x000")
                      }
                      className="text-[11px] font-bold text-red-600 hover:underline"
                    >
                      Simulate Forged QR Attack
                    </button>
                  </div>
                  <input
                    id="gate-hmac"
                    type="text"
                    required
                    value={qrSignature}
                    onChange={(e) => setQrSignature(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-700"
                  />
                </div>

                {gateAction === "EXIT" && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Clock className="h-3.5 w-3.5 text-brand-600" />
                        Overstay Simulation on EXIT (Grace Period: 15 mins)
                      </span>
                      <span className="font-mono text-xs font-extrabold text-brand-700">
                        +{simulateOverstayMins} mins
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      {[0, 10, 45, 90].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setSimulateOverstayMins(mins)}
                          className={`rounded-xl px-3 py-1 text-[11px] font-bold ${
                            simulateOverstayMins === mins
                              ? "bg-brand-600 text-white"
                              : "border border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          {mins === 0
                            ? "On-Time Exit (0m)"
                            : `+${mins}m (${mins <= 15 ? "Within Grace" : "1.5x Overstay"})`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3.5 text-sm font-bold text-white shadow-stripe hover:bg-brand-700"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>
                    {offlineMode
                      ? `Queue Signed ${gateAction} Scan in Offline Storage`
                      : `Verify Cryptographic Pass & Execute ${gateAction}`}
                  </span>
                </button>
              </form>

              {/* Live Gate Event History Stream */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Gate Event History (Entry/Exit, Anti-Replay &amp; Rejections)
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                    {gateLogs.length} events
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {gateLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-slate-900">
                          {log.event_type} • {log.vehicle_number} (
                          {log.booking_reference})
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            log.barrier_action === "OPENED"
                              ? "bg-emerald-100 text-emerald-800"
                              : log.barrier_action === "LOCKED"
                              ? "bg-red-100 text-red-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {log.barrier_action}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600">{log.notes}</p>
                      <div className="mt-1 flex flex-wrap items-center justify-between text-[10px] text-slate-400">
                        <span>
                          Method: {log.verification_method} • Lane:{" "}
                          {log.gate_lane}
                        </span>
                        <span>
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: MANUAL STAFF BARRIER OVERRIDE WITH PERMISSIONS               */}
        {/* =================================================================== */}
        {activeTab === "MANUAL_OVERRIDE" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <form
                onSubmit={handleManualOverrideSubmit}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-5"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                      RBAC Permission-Gated (`gate:override`)
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      Manual Staff Boom-Barrier Override Console
                    </h2>
                  </div>
                  <KeyRound className="h-6 w-6 text-brand-600" />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 flex items-center justify-between">
                  <div>
                    Authenticated Operator:{" "}
                    <strong>{authUser?.email || "gate@parkwise.in"}</strong> (
                    Role: <strong>{authUser?.role || activeRole}</strong>)
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                      hasPermission("gate:override")
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {hasPermission("gate:override")
                      ? "gate:override GRANTED"
                      : "gate:override DENIED"}
                  </span>
                </div>

                {overrideFeedback && (
                  <div
                    role="alert"
                    className={`flex items-start gap-2.5 rounded-2xl border p-4 text-xs font-semibold ${
                      overrideFeedback.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    {overrideFeedback.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    )}
                    <span>{overrideFeedback.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Facility Location
                    </label>
                    <select
                      value={overrideLotId}
                      onChange={(e) => setOverrideLotId(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-900"
                    >
                      {lots.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code} • {l.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Override Command
                    </label>
                    <select
                      value={overrideAction}
                      onChange={(e) =>
                        setOverrideAction(
                          e.target.value as
                            | "OPEN_ENTRY"
                            | "OPEN_EXIT"
                            | "LOCK_LANE"
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-900"
                    >
                      <option value="OPEN_ENTRY">
                        OPEN_ENTRY (Emergency / Supervisor Check-In)
                      </option>
                      <option value="OPEN_EXIT">
                        OPEN_EXIT (Supervisor Check-Out &amp; Release Bay)
                      </option>
                      <option value="LOCK_LANE">
                        LOCK_LANE (Security Lockdown)
                      </option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Associated Booking Ref (Optional)
                    </label>
                    <input
                      type="text"
                      value={overrideBookingRef}
                      onChange={(e) =>
                        setOverrideBookingRef(e.target.value.toUpperCase())
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Vehicle Registration Plate
                    </label>
                    <input
                      type="text"
                      required
                      value={overridePlate}
                      onChange={(e) =>
                        setOverridePlate(e.target.value.toUpperCase())
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Mandatory Supervisor Justification (Audit Logged)
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>Execute Authorized Manual Barrier Override</span>
                </button>
              </form>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Manual Supervisor Overrides
                </h3>
                <div className="space-y-2.5">
                  {gateLogs
                    .filter((g) => g.event_type === "MANUAL_OVERRIDE")
                    .map((g) => (
                      <div
                        key={g.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900">
                            {g.vehicle_number} • {g.booking_reference}
                          </span>
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                            {g.barrier_action}
                          </span>
                        </div>
                        <p className="text-slate-600">{g.notes}</p>
                        <p className="text-[10px] text-slate-400">
                          Authorized by: {g.staff_override_by}
                        </p>
                      </div>
                    ))}
                  {gateLogs.filter((g) => g.event_type === "MANUAL_OVERRIDE")
                    .length === 0 && (
                    <p className="text-xs text-slate-500">
                      No manual overrides executed in this session yet. Submit the form on the left to record a supervisor override.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: SECURE OFFLINE-CAPABLE WORKFLOW & CONFLICT SYNCHRONIZATION   */}
        {/* =================================================================== */}
        {activeTab === "OFFLINE_WORKFLOW" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-6 space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                      Signed Edge Token Manifest &amp; Local Queue
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      Offline Gate Event Queue ({offlineGateQueue.length} items)
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunOfflineSync}
                    className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Synchronize Offline Queue</span>
                  </button>
                </div>

                <p className="text-xs text-slate-600">
                  When network connectivity drops at an underground parking ramp, the gate controller verifies the cryptographic HMAC signature locally and queues the timestamped event. During synchronization, the backend re-verifies every signature, rejects expired/revoked/unpaid passes, and prevents duplicate entry/exit replays.
                </p>

                {offlineFeedback && (
                  <div
                    role="alert"
                    className={`rounded-2xl border p-3.5 text-xs font-semibold ${
                      offlineFeedback.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    {offlineFeedback.text}
                  </div>
                )}

                {/* Quick Test Queue Buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentBooking) return;
                      queueOfflineGateScan({
                        bookingReference: currentBooking.booking_reference,
                        qrSignature:
                          currentBooking.qr_pass?.qr_signature ||
                          currentBooking.qr_signature,
                        vehicleNumber: currentBooking.vehicle_number,
                        action: "ENTRY",
                        gateLane: "LANE-01 (OFFLINE EDGE)",
                      });
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                  >
                    + Queue Valid Offline ENTRY
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!currentBooking) return;
                      queueOfflineGateScan({
                        bookingReference: currentBooking.booking_reference,
                        qrSignature:
                          currentBooking.qr_pass?.qr_signature ||
                          currentBooking.qr_signature,
                        vehicleNumber: currentBooking.vehicle_number,
                        action: "ENTRY",
                        gateLane: "LANE-02 (OFFLINE REPLAY)",
                      });
                    }}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                  >
                    + Queue Duplicate Offline ENTRY (Conflict Test)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!currentBooking) return;
                      queueOfflineGateScan({
                        bookingReference: currentBooking.booking_reference,
                        qrSignature: "forged_offline_signature_0xdeadbeef",
                        vehicleNumber: currentBooking.vehicle_number,
                        action: "ENTRY",
                        gateLane: "LANE-01 (OFFLINE TAMPERED)",
                      });
                    }}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-100"
                  >
                    + Queue Tampered Signature Scan
                  </button>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto">
                  {offlineGateQueue.map((item) => (
                    <div
                      key={item.offline_event_id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">
                          {item.action} • {item.booking_reference} (
                          {item.vehicle_number})
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.queued_status === "SYNCED"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.queued_status === "CONFLICT"
                              ? "bg-amber-100 text-amber-800"
                              : item.queued_status === "REJECTED"
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {item.queued_status}
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-slate-500">
                        Event ID: {item.offline_event_id} • Sig:{" "}
                        {item.qr_signature.slice(0, 22)}...
                      </p>
                      {item.resolution_detail && (
                        <p className="text-slate-700 font-medium">
                          Resolution ({item.resolution_code}):{" "}
                          {item.resolution_detail}
                        </p>
                      )}
                    </div>
                  ))}
                  {offlineGateQueue.length === 0 && (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      Offline queue is empty. Use the buttons above to queue valid, duplicate, or tampered offline scans and test batch synchronization.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Cloud Synchronization &amp; Conflict Resolution Report
                </h3>
                <div className="space-y-2.5">
                  {syncReports.map((rep) => (
                    <div
                      key={rep.offline_event_id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">
                          {rep.booking_reference} • {rep.action}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                            rep.resolution === "SYNCED_APPLIED" ||
                            rep.resolution === "IDEMPOTENT_ALREADY_SYNCED"
                              ? "bg-emerald-100 text-emerald-800"
                              : rep.resolution === "CONFLICT_DUPLICATE_REPLAY"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {rep.resolution}
                        </span>
                      </div>
                      <p className="text-slate-600">{rep.detail}</p>
                    </div>
                  ))}
                  {syncReports.length === 0 && (
                    <p className="text-xs text-slate-500">
                      Click &ldquo;Synchronize Offline Queue&rdquo; to inspect per-event conflict handling and cryptographic verification results.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: RAZORPAY TEST MODE, IDEMPOTENT WEBHOOKS, REFUNDS & RECEIPTS  */}
        {/* =================================================================== */}
        {activeTab === "PAYMENTS_AND_WEBHOOKS" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* LEFT COLUMN: Webhook Simulator & Refund Controls */}
            <div className="lg:col-span-6 space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                      Razorpay Test Mode (`rzp_test_*`) + UPI Intent
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      Idempotent Webhook Verifier &amp; Refund Engine
                    </h2>
                  </div>
                  <CreditCard className="h-6 w-6 text-brand-600" />
                </div>

                {paymentFeedback && (
                  <div
                    role="alert"
                    className={`rounded-2xl border p-3.5 text-xs font-semibold ${
                      paymentFeedback.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    {paymentFeedback.text}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Select Booking Payment Order
                  </label>
                  <select
                    value={selectedPaymentRef}
                    onChange={(e) => setSelectedPaymentRef(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs font-bold text-slate-900"
                  >
                    {bookings.map((b) => (
                      <option
                        key={b.booking_reference}
                        value={b.booking_reference}
                      >
                        {b.booking_reference} • {b.payment.razorpay_order_id} •
                        ₹{b.total_amount_inr} ({b.payment.status})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Webhook Simulator Box */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Trusted Razorpay Webhook Simulator (`X-Razorpay-Signature`)
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">
                        Webhook Event ID (Idempotency Key)
                      </label>
                      <input
                        type="text"
                        value={webhookEventId}
                        onChange={(e) => setWebhookEventId(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">
                        Webhook Event Type
                      </label>
                      <select
                        value={webhookEventType}
                        onChange={(e) =>
                          setWebhookEventType(
                            e.target.value as
                              | "payment.captured"
                              | "payment.failed"
                              | "refund.processed"
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900"
                      >
                        <option value="payment.captured">
                          payment.captured
                        </option>
                        <option value="payment.failed">payment.failed</option>
                        <option value="refund.processed">
                          refund.processed
                        </option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleTriggerWebhook(false)}
                      className="rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-700"
                    >
                      Send Signed Webhook (Test Idempotency on 2nd Click)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTriggerWebhook(true)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                    >
                      Simulate Untrusted Webhook Signature
                    </button>
                  </div>
                </div>

                {/* Refund Workflow Box */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Instant Razorpay Refund Workflow
                  </h3>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleRefundPayment}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Issue Full Refund &amp; Revoke QR Pass</span>
                  </button>
                </div>

                {/* Webhook Event Log */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-900">
                    Processed Webhook Ledger
                  </h3>
                  {webhookLogs.map((wh) => (
                    <div
                      key={wh.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900">
                          {wh.webhook_event_id}
                        </span>{" "}
                        • <span className="text-brand-700">{wh.event_type}</span>
                        <p className="text-[11px] text-slate-500">
                          Order: {wh.razorpay_order_id} ({wh.booking_reference})
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                          wh.idempotent_replay
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {wh.idempotent_replay
                          ? "IDEMPOTENT REPLAY"
                          : wh.status_applied}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: GST Tax Invoice & Cryptographic Receipt */}
            <div className="lg:col-span-6 space-y-6">
              {activeReceipt && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                        GST Tax Invoice • SAC {activeReceipt.sac_code}
                      </span>
                      <h2 className="text-lg font-bold text-slate-900">
                        Receipt {activeReceipt.receipt_number}
                      </h2>
                    </div>
                    <FileText className="h-6 w-6 text-brand-600" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">Booking Ref:</span>
                      <p className="font-mono font-bold text-slate-900">
                        {activeReceipt.booking_reference}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Payment Status:</span>
                      <p className="font-bold text-emerald-700">
                        {activeReceipt.payment_status}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Razorpay Order ID:</span>
                      <p className="font-mono text-slate-800">
                        {activeReceipt.razorpay_order_id}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Payment Rail / VPA:</span>
                      <p className="font-semibold text-slate-800">
                        {activeReceipt.payment_method} ({activeReceipt.upi_vpa})
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Facility &amp; Bay:</span>
                      <p className="font-semibold text-slate-800">
                        {activeReceipt.lot_name} ({activeReceipt.slot_number})
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Operator GSTIN:</span>
                      <p className="font-mono text-slate-800">
                        {activeReceipt.gstin_operator}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">
                        Base Parking Tariff ({activeReceipt.duration_hours}h @{" "}
                        {activeReceipt.surge_multiplier}x)
                      </span>
                      <span className="font-mono font-semibold text-slate-900">
                        ₹{activeReceipt.base_amount_inr.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">
                        Overstay Charges
                      </span>
                      <span className="font-mono font-semibold text-slate-900">
                        ₹{activeReceipt.overstay_fee_inr.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">CGST (9%)</span>
                      <span className="font-mono text-slate-700">
                        ₹{activeReceipt.cgst_9_pct_inr.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">SGST (9%)</span>
                      <span className="font-mono text-slate-700">
                        ₹{activeReceipt.sgst_9_pct_inr.toFixed(2)}
                      </span>
                    </div>
                    {activeReceipt.refunded_amount_inr > 0 && (
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Refunded Amount</span>
                        <span className="font-mono">
                          -₹{activeReceipt.refunded_amount_inr.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
                      <span>Net Settled Amount (INR)</span>
                      <span className="font-mono text-brand-700">
                        ₹{activeReceipt.net_paid_inr.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {selectedPaymentBooking?.payment.upi_intent_uri && (
                    <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-3.5 text-[11px] text-slate-700">
                      <span className="font-bold text-brand-700">
                        NPCI UPI Intent Checkout URI:
                      </span>
                      <p className="mt-1 break-all font-mono text-[10px] text-slate-600">
                        {selectedPaymentBooking.payment.upi_intent_uri}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRouteGate>
  );
}
