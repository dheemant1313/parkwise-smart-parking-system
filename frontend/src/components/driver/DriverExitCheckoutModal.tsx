"use client";

import React, { useState } from "react";
import {
  Car,
  Clock,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Zap,
  ArrowRight,
  ShieldCheck,
  X,
  FileText,
  Lock,
  Unlock,
} from "lucide-react";
import {
  ExitQuoteBreakdown,
  ExitSettlementResponse,
  fetchExitQuote,
  settleExit,
} from "@/lib/reconciliationApi";

interface DriverExitCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBookingRef?: string;
  initialPlate?: string;
}

export function DriverExitCheckoutModal({
  isOpen,
  onClose,
  initialBookingRef = "",
  initialPlate = "",
}: DriverExitCheckoutModalProps) {
  const [bookingRef, setBookingRef] = useState(initialBookingRef);
  const [vehiclePlate, setVehiclePlate] = useState(initialPlate);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<ExitQuoteBreakdown | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"FASTAG_AUTO_DEBIT" | "RAZORPAY_UPI" | "CARD">("FASTAG_AUTO_DEBIT");
  const [settlementResult, setSettlementResult] = useState<ExitSettlementResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFetchQuote = async () => {
    if (!bookingRef && !vehiclePlate) {
      setError("Please provide your booking reference or vehicle registration plate.");
      return;
    }
    setError(null);
    setLoading(true);
    setSettlementResult(null);
    try {
      const q = await fetchExitQuote({
        booking_reference: bookingRef || undefined,
        vehicle_plate: vehiclePlate || undefined,
      });
      setQuote(q);
    } catch (e: any) {
      setError(e.message || "Failed to calculate exit quote. Please verify details.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmExit = async () => {
    if (!quote) return;
    setError(null);
    setLoading(true);
    try {
      const res = await settleExit({
        booking_reference: quote.booking_reference,
        payment_method: quote.total_payable_inr === 0 ? "ZERO_BALANCE" : selectedMethod,
        idempotency_key: `DRV-EXT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        fastag_tag_id: "FTG-NETC-DRIVER-8891",
      });
      setSettlementResult(res);
    } catch (e: any) {
      setError(e.message || "Payment settlement failed. Please retry or contact gate attendant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b1329] border border-cyan-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Express Parking Exit & Checkout
            </h2>
            <p className="text-xs text-slate-400">
              Automated barrier actuation via FASTag NETC & UPI
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Search Form if quote not fetched */}
        {!quote && !settlementResult && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-300">Vehicle Registration Number</label>
              <input
                type="text"
                placeholder="e.g. KA 01 MJ 5544"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="w-full mt-1 p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold tracking-wider text-white uppercase placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="text-center text-xs text-slate-500 uppercase tracking-widest font-semibold">
              — or —
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">Booking Reference</label>
              <input
                type="text"
                placeholder="e.g. BK-20261117-XXXX"
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                className="w-full mt-1 p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-white uppercase placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={handleFetchQuote}
              disabled={loading}
              className="w-full mt-2 py-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 transition disabled:opacity-50"
            >
              <Clock className="w-4 h-4" />
              {loading ? "Checking Duration..." : "Check Parking Duration & Exit Charges"}
            </button>
          </div>
        )}

        {/* Step 2: Quote Breakdown Review */}
        {quote && !settlementResult && (
          <div className="mt-5 space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400 font-medium">Vehicle / Booking:</span>
                <span className="font-mono font-bold text-cyan-300">
                  {quote.vehicle_plate} ({quote.booking_reference})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Facility / Bay:</span>
                <span className="text-white font-medium">{quote.facility_name} • {quote.slot_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Duration:</span>
                <span className="text-white font-mono">{quote.duration_minutes} minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Overstay (Grace Period: {quote.grace_period_minutes}m):</span>
                <span className={quote.is_overstay ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                  {quote.overstay_minutes > 0 ? `${quote.overstay_minutes} minutes excess` : "Within booking window"}
                </span>
              </div>

              {quote.is_overstay && (
                <>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-slate-400">
                    <span>Overstay Tariff:</span>
                    <span className="font-mono text-white">₹{quote.overstay_charge_inr.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>GST (18% SAC 9967):</span>
                    <span className="font-mono text-white">₹{quote.gst_amount_inr.toFixed(2)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center border-t border-slate-800 pt-2 text-sm font-bold">
                <span className="text-white">Additional Payable at Exit:</span>
                <span className={`font-mono text-base ${quote.total_payable_inr === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  ₹{quote.total_payable_inr.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Guardrail: Unverified Check */}
            {!quote.is_verified_entry ? (
              <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-rose-300">
                  <Lock className="w-4 h-4" /> Unverified Entry - Barrier Locked
                </div>
                <p>
                  No ANPR or gate check-in record was verified for this vehicle. For garage safety and anti-passback integrity, please press the gate intercom or ask a parking attendant for supervisor clearance.
                </p>
              </div>
            ) : quote.total_payable_inr > 0 ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Select Settlement Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("FASTAG_AUTO_DEBIT")}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition ${
                      selectedMethod === "FASTAG_AUTO_DEBIT"
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    FASTag Debit
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod("RAZORPAY_UPI")}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition ${
                      selectedMethod === "RAZORPAY_UPI"
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    UPI / QR
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod("CARD")}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition ${
                      selectedMethod === "CARD"
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-indigo-400" />
                    Credit/Debit
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Zero Balance Exit: Your parking was completed within your reserved schedule.
              </div>
            )}

            {quote.is_verified_entry && (
              <button
                onClick={handleConfirmExit}
                disabled={loading}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition disabled:opacity-50"
              >
                <Unlock className="w-4 h-4" />
                {loading
                  ? "Authorizing..."
                  : quote.total_payable_inr === 0
                  ? "Authorize Exit & Open Barrier"
                  : `Pay ₹${quote.total_payable_inr.toFixed(2)} & Open Barrier`}
              </button>
            )}
          </div>
        )}

        {/* Step 3: Success Receipt */}
        {settlementResult && (
          <div className="mt-5 space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Boom Barrier Actuated OPEN</h3>
              <p className="text-xs text-slate-400 mt-1">
                Your exit has been settled and verified. Have a safe journey!
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Receipt No:</span>
                <span className="font-mono font-bold text-cyan-300">{settlementResult.receipt_number || "REC-2026-OK"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Paid:</span>
                <span className="font-mono font-bold text-emerald-400">₹{settlementResult.amount_paid_inr.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Channel:</span>
                <span className="text-white font-medium">{settlementResult.payment_method}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
