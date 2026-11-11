"use client";

import React, { useState } from "react";
import {
  Camera,
  CheckCircle2,
  Lock,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { ProtectedRouteGate } from "@/components/auth/ProtectedRouteGate";

export default function GateManagementPage() {
  const { bookings, gateLogs, processGateScan } = useParkwise();

  const defaultBooking = bookings[0];
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
  const [barrierState, setBarrierState] = useState<
    "STANDBY" | "OPENED" | "LOCKED"
  >("STANDBY");
  const [statusFeedback, setStatusFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function loadBookingIntoScanner(ref: string) {
    const found = bookings.find((b) => b.booking_reference === ref);
    if (!found) return;
    setBookingRef(found.booking_reference);
    setVehiclePlate(found.vehicle_number);
    setQrSignature(found.qr_signature);
    setGateAction(found.status === "ACTIVE" ? "EXIT" : "ENTRY");
    setStatusFeedback(null);
  }

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusFeedback(null);
    try {
      const result = await processGateScan({
        bookingReference: bookingRef,
        qrSignature,
        vehicleNumber: vehiclePlate,
        action: gateAction,
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
          err instanceof Error
            ? err.message
            : "Gate verification rejected.",
      });
    }
  }

  return (
    <ProtectedRouteGate
      allowedRoles={["GATE_STAFF", "OPERATOR", "ADMIN"]}
      requiredPermission="gate:scan"
      applicationName="Gate Boom-Barrier Terminal"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Application 04 • Edge Boom-Barrier &amp; ANPR Terminal
          </span>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
            Optical ANPR &amp; Cryptographic QR Gate Verification
          </h1>
        </div>

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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* LEFT COLUMN: Simulated Optical ANPR Feed + Quick Pass Selector */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-apple space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                <Camera className="h-3.5 w-3.5" />
                SIMULATED ANPR CAMERA FEED • LANE-01
              </span>
              <span className="font-mono text-xs text-slate-400">
                Confidence: 98.8%
              </span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/90 py-10 px-4 text-center space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Optical License Plate Recognition (IND RTO)
              </p>
              <div className="inline-flex items-center gap-2 rounded-xl border-2 border-amber-400 bg-white px-5 py-2.5 font-mono text-2xl font-black tracking-wider text-slate-950 shadow-lg">
                <span className="text-[10px] font-bold text-blue-700">IND</span>
                <span>{vehiclePlate || "DL-08-CAF-8921"}</span>
              </div>
              <p className="text-xs text-slate-400">
                Matched against active booking:{" "}
                <strong className="text-white">{bookingRef}</strong>
              </p>
            </div>
          </div>

          {/* Active Reservations Quick-Load List */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              Active Reservations (Click to Load into Scanner)
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-slate-900">
                        {b.booking_reference}
                      </span>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                        {b.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Plate: <strong>{b.vehicle_number}</strong> • Bay:{" "}
                      <strong>{b.slot_number}</strong>
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

        {/* RIGHT COLUMN: Cryptographic QR & ANPR Verification Form */}
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
                  Verify HMAC-SHA256 QR &amp; Trigger Barrier
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
                GATE ENTRY (Check-In)
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
                GATE EXIT (Release Bay)
              </button>
            </div>

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
                onChange={(e) => setBookingRef(e.target.value.toUpperCase())}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs font-bold text-slate-900"
              />
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
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
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

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3.5 text-sm font-bold text-white shadow-stripe hover:bg-brand-700"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Verify Cryptographic Pass &amp; Execute {gateAction}</span>
            </button>
          </form>

          {/* Live Gate Event Stream */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Real-Time Boom-Barrier Audit Log
            </h3>
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {gateLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">
                      {log.event_type} • {log.vehicle_number}
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
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRouteGate>
  );
}
