"use client";

import React, { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Building2,
  CarFront,
  CheckCircle2,
  Lock,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { formatINR } from "@/lib/utils";

const SmartParkingCanvas = dynamic(
  () =>
    import("@/components/three/SmartParkingCanvas").then(
      (m) => m.SmartParkingCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[380px] w-full items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
        Initializing Three.js 3D Spatial Parking Twin...
      </div>
    ),
  }
);

export default function MarketingHomePage() {
  const { lots, bookings, getAIForecast } = useParkwise();
  const [selectedHeroLotId, setSelectedHeroLotId] = useState<number>(1);
  const [roiBays, setRoiBays] = useState<number>(150);
  const [roiBaseRate, setRoiBaseRate] = useState<number>(80);

  const activeLot =
    lots.find((l) => l.id === selectedHeroLotId) || lots[0];
  const aiForecast = getAIForecast(activeLot.id);

  const totalBaysAcrossIndia = lots.reduce((acc, l) => acc + l.total_slots, 0);
  const totalAvailableAcrossIndia = lots.reduce(
    (acc, l) => acc + l.available_slots,
    0
  );

  // Operator ROI calculation
  const baselineMonthlyInr = roiBays * roiBaseRate * 6.5 * 30;
  const parkwiseMonthlyInr = Math.round(baselineMonthlyInr * 1.34);
  const incrementalAnnualInr = (parkwiseMonthlyInr - baselineMonthlyInr) * 12;

  return (
    <div className="space-y-24 pb-24">
      {/* 1. HERO SECTION — APPLE MINIMALISM + TESLA SPATIAL TWIN */}
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/70 to-white pt-12 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Left Copy */}
            <div className="space-y-6 lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1.5 text-xs font-semibold text-brand-700">
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI-Powered Smart Parking Infrastructure for India</span>
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[54px] lg:leading-[1.08]">
                Zero-Friction Urban Mobility.{" "}
                <span className="bg-gradient-to-r from-brand-600 to-blue-500 bg-clip-text text-transparent">
                  Engineered for Scale.
                </span>
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Parkwise connects Indian drivers, commercial parking operators,
                NPCI FASTag lanes, and optical ANPR boom-barriers into a single
                sub-second transactional cloud.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/driver"
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-stripe transition-all hover:bg-brand-700 hover:-translate-y-0.5"
                >
                  <span>Reserve a Parking Bay</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/operator"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:border-brand-400 hover:text-brand-600"
                >
                  <Building2 className="h-4 w-4 text-brand-600" />
                  <span>Operator SaaS Console</span>
                </Link>
                <Link
                  href="/gate"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3.5 text-xs font-semibold text-slate-700 transition-all hover:bg-white"
                >
                  <QrCode className="h-4 w-4 text-brand-600" />
                  <span>Launch Gate Scanner</span>
                </Link>
              </div>

              {/* Trust Telemetry Strip */}
              <div className="grid grid-cols-3 gap-4 border-t border-slate-200/80 pt-6">
                <div>
                  <p className="text-2xl font-extrabold text-slate-900">
                    {lots.length} Metros
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    Delhi • Mumbai • BLR • GGN • HYD
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-brand-600">
                    {totalAvailableAcrossIndia}/{totalBaysAcrossIndia}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    Live IoT Bays Available Now
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-slate-900">
                    98.8%
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    ANPR + HMAC QR Accuracy
                  </p>
                </div>
              </div>
            </div>

            {/* Right Interactive 3D Twin Showcase */}
            <div className="space-y-4 lg:col-span-6">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-600" />
                  <span className="text-xs font-bold text-slate-800">
                    {activeLot.name} ({activeLot.city})
                  </span>
                </div>
                <select
                  aria-label="Select 3D Preview Facility"
                  value={selectedHeroLotId}
                  onChange={(e) => setSelectedHeroLotId(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.city} — {lot.code}
                    </option>
                  ))}
                </select>
              </div>

              <SmartParkingCanvas slots={activeLot.slots} activeFloor={1} />

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    AI Surge Tariff
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {activeLot.current_surge_multiplier.toFixed(2)}x{" "}
                    <span className="text-xs font-medium text-brand-600">
                      ({formatINR(aiForecast.recommended_hourly_rate_inr)}/hr)
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    EV 50kW Bays
                  </p>
                  <p className="mt-1 text-lg font-bold text-emerald-600">
                    {activeLot.ev_slots_available} Available
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    Gate Protocol
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    FASTag + QR
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FIVE CORE APPLICATIONS SUITE */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Unified Enterprise Architecture
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Five Core Applications. One Synchronized Ledger.
            </h2>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-slate-500">
            Every booking, payment signature, slot state change, and gate barrier
            scan propagates across all five applications in real time.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/driver"
            className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-apple transition-all hover:border-brand-500 hover:shadow-stripe"
          >
            <div className="space-y-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <CarFront className="h-5 w-5" />
              </div>
              <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                App 02 • B2C Driver
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Driver Booking App
              </h3>
              <p className="text-xs leading-relaxed text-slate-500">
                Interactive 2D &amp; 3D bay selection, Indian vehicle plate
                validation, dynamic surge pricing, Razorpay checkout, and
                cryptographically signed QR Gate Pass.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-brand-600">
              <span>Open Driver App</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/operator"
            className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-apple transition-all hover:border-brand-500 hover:shadow-stripe"
          >
            <div className="space-y-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                App 03 • B2B Operator
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Operator SaaS Console
              </h3>
              <p className="text-xs leading-relaxed text-slate-500">
                Recharts occupancy &amp; revenue curves, XGBoost 12-hour demand
                forecasting, live bay maintenance switches, and dynamic surge
                pricing controls.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-brand-600">
              <span>Open Operator Console</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/gate"
            className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-apple transition-all hover:border-brand-500 hover:shadow-stripe"
          >
            <div className="space-y-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <QrCode className="h-5 w-5" />
              </div>
              <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                App 04 • Edge Hardware
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Gate Management Terminal
              </h3>
              <p className="text-xs leading-relaxed text-slate-500">
                Optical ANPR license plate recognition, HMAC-SHA256 QR token
                scanner, boom-barrier controller, and automated FASTag overstay
                fee calculation.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-brand-600">
              <span>Open Gate Terminal</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/admin"
            className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-apple transition-all hover:border-brand-500 hover:shadow-stripe"
          >
            <div className="space-y-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                App 05 • Governance
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Platform Admin Command
              </h3>
              <p className="text-xs leading-relaxed text-slate-500">
                National multi-city GMV telemetry, RBAC role enforcement,
                operator KYC onboarding verification, and immutable security
                audit logs.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-brand-600">
              <span>Open Admin Command</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </section>

      {/* 3. ENGINEERING GUARANTEES & AI TELEMETRY */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-apple lg:p-12">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600">
                <Lock className="h-3.5 w-3.5" />
                Zero-Trust Financial &amp; Concurrency Architecture
              </span>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Built with Stripe-Grade Transactional Integrity.
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Superficial prototypes fail under concurrent traffic. Parkwise
                enforces strict database transactions, distributed slot locking,
                and cryptographic signature verification at every layer.
              </p>
              <ul className="space-y-3 text-xs font-medium text-slate-700">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <strong>Zero Double-Booking Guarantee:</strong> Atomic
                    time-window overlap verification + Redis/mutex concurrency
                    locks reject conflicting reservations with HTTP 409.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <strong>Cryptographic Gate Verification:</strong> Every QR
                    pass is signed with server-side{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">
                      HMAC-SHA256
                    </code>
                    . Tampered payloads immediately lock the boom barrier.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <strong>XGBoost + GradientBoosting AI Engine:</strong>{" "}
                    Forecasts 12-hour metro congestion and dynamically calibrates
                    bay tariffs.
                  </span>
                </li>
              </ul>
            </div>

            {/* Interactive Operator Revenue & ROI Simulator */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 lg:col-span-7">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                    Interactive Financial Model
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    Operator Dynamic Yield Calculator (INR)
                  </h3>
                </div>
                <TrendingUp className="h-6 w-6 text-brand-600" />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <label htmlFor="roi-bays">Total Parking Bays</label>
                    <span className="font-mono text-brand-600">
                      {roiBays} Bays
                    </span>
                  </div>
                  <input
                    id="roi-bays"
                    type="range"
                    min={40}
                    max={500}
                    step={10}
                    value={roiBays}
                    onChange={(e) => setRoiBays(Number(e.target.value))}
                    className="mt-2 w-full accent-brand-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <label htmlFor="roi-rate">Base Hourly Tariff (₹)</label>
                    <span className="font-mono text-brand-600">
                      ₹{roiBaseRate}/hr
                    </span>
                  </div>
                  <input
                    id="roi-rate"
                    type="range"
                    min={40}
                    max={200}
                    step={10}
                    value={roiBaseRate}
                    onChange={(e) => setRoiBaseRate(Number(e.target.value))}
                    className="mt-2 w-full accent-brand-600 cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-medium text-slate-500">
                    Legacy Static Yield / Mo
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-700">
                    {formatINR(baselineMonthlyInr)}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
                  <p className="text-[11px] font-semibold text-brand-700">
                    Parkwise AI Yield / Mo (+34%)
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-brand-600">
                    {formatINR(parkwiseMonthlyInr)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <p className="text-[11px] font-semibold text-emerald-800">
                    Net Annual Uplift
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-emerald-700">
                    +{formatINR(incrementalAnnualInr)}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-slate-500">
                * Based on 34% average revPAB (Revenue Per Available Bay) uplift
                from AI dynamic surge pricing, zero ticket leakage, and automated
                FASTag/QR gate turnover. Verified bookings in current session:{" "}
                <strong>{bookings.length}</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
