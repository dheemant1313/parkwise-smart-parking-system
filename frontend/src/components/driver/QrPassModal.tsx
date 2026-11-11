"use client";

import React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Printer,
  QrCode,
  ShieldCheck,
  X,
} from "lucide-react";
import { Booking } from "@/types";
import { formatINRPrecise } from "@/lib/utils";

interface QrPassModalProps {
  booking: Booking | null;
  onClose: () => void;
}

export function QrPassModal({ booking, onClose }: QrPassModalProps) {
  if (!booking) return null;

  // Deterministic 7x7 visual QR matrix pattern from booking signature
  const cells = Array.from({ length: 49 }, (_, idx) => {
    const ch = booking.qr_signature.charCodeAt(
      idx % booking.qr_signature.length
    );
    return (ch + idx * 7) % 2 === 0;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`QR Parking Pass and GST Receipt for ${booking.booking_reference}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-stripe">
        {/* Top Banner */}
        <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider">
                PARKWISE CRYPTOGRAPHIC GATE PASS &amp; GST RECEIPT
              </p>
              <p className="font-mono text-[11px] text-slate-400">
                Ref: {booking.booking_reference} • Status: {booking.status}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Pass Modal"
            className="rounded-xl bg-slate-800 p-1.5 text-slate-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Visual QR Code + Primary Bay Info */}
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <div className="flex h-36 w-36 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-slate-900 bg-white p-3 shadow-sm">
              <div className="grid grid-cols-7 gap-1 w-full h-full">
                {cells.map((filled, idx) => (
                  <div
                    key={idx}
                    className={`rounded-[2px] ${
                      filled ? "bg-slate-900" : "bg-slate-100"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                HMAC-SHA256 VERIFIED
              </span>
              <h3 className="text-base font-extrabold text-slate-900">
                {booking.lot_name}
              </h3>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200/70">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">
                    Assigned Bay
                  </span>
                  <p className="font-mono text-sm font-black text-brand-600">
                    {booking.slot_number}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200/70">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">
                    Vehicle RTO Plate
                  </span>
                  <p className="font-mono text-sm font-black text-slate-900">
                    {booking.vehicle_number}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Time & Tax Receipt Breakdown */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Driver Name &amp; Mobile</span>
              <span className="font-bold text-slate-900">
                {booking.driver_name} ({booking.driver_phone})
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Arrival Window</span>
              <span className="font-mono font-semibold text-slate-800">
                {new Date(booking.start_time).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Valid Until ({booking.duration_hours}h)</span>
              <span className="font-mono font-semibold text-slate-800">
                {new Date(booking.end_time).toLocaleString()}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between text-slate-600">
              <span>Base + Surge ({booking.surge_multiplier}x)</span>
              <span className="font-semibold">
                {formatINRPrecise(booking.base_amount_inr)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>18% GST (CGST 9% + SGST 9%)</span>
              <span className="font-semibold">
                {formatINRPrecise(booking.gst_amount_inr)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
              <span>Total Paid ({booking.payment.payment_method})</span>
              <span className="text-brand-600">
                {formatINRPrecise(booking.total_amount_inr)}
              </span>
            </div>
          </div>

          {/* Cryptographic Payload */}
          <div className="rounded-xl border border-slate-200 bg-slate-100/80 p-2.5 font-mono text-[10px] text-slate-600 break-all">
            {booking.qr_payload}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print GST Receipt</span>
            </button>
            <Link
              href="/gate"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white shadow-stripe hover:bg-brand-700"
            >
              <QrCode className="h-4 w-4" />
              <span>Scan Pass at Gate Terminal →</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
