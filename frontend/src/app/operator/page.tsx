"use client";

import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Building2,
  Cpu,
  Gauge,
  IndianRupee,
  Sliders,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { formatINR } from "@/lib/utils";
import { SlotStatus } from "@/types";
import { ProtectedRouteGate } from "@/components/auth/ProtectedRouteGate";

export default function OperatorDashboardPage() {
  const {
    lots,
    bookings,
    updateSlotStatus,
    updateLotSurge,
    getAIForecast,
  } = useParkwise();

  const [selectedLotId, setSelectedLotId] = useState<number>(lots[0]?.id || 1);

  const activeLot = useMemo(
    () => lots.find((l) => l.id === selectedLotId) || lots[0],
    [lots, selectedLotId]
  );

  const aiForecast = useMemo(
    () => getAIForecast(activeLot.id),
    [getAIForecast, activeLot.id]
  );

  const lotBookings = useMemo(
    () => bookings.filter((b) => b.lot_id === activeLot.id),
    [bookings, activeLot.id]
  );

  const lotRevenue = useMemo(
    () =>
      lotBookings.reduce(
        (acc, b) => acc + b.total_amount_inr + b.overstay_fee_inr,
        0
      ) + 18450,
    [lotBookings]
  );

  const occupancyPct = useMemo(() => {
    const active = activeLot.occupied_slots + activeLot.reserved_slots;
    return Math.round((active / Math.max(1, activeLot.total_slots)) * 100);
  }, [activeLot]);

  return (
    <ProtectedRouteGate
      allowedRoles={["OPERATOR", "ADMIN"]}
      requiredPermission="slot:override"
      applicationName="Parking Operator SaaS Dashboard"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {/* Header & Facility Selector */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Application 03 • B2B Parking Operator SaaS
          </span>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
            Facility Telemetry, AI Surge &amp; Bay Operations
          </h1>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <Building2 className="h-4 w-4 text-brand-600" />
          <select
            aria-label="Select Operator Facility"
            value={selectedLotId}
            onChange={(e) => setSelectedLotId(Number(e.target.value))}
            className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none"
          >
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.city} — {l.name} ({l.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-apple">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Today&apos;s Gross Revenue</span>
            <IndianRupee className="h-4 w-4 text-brand-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {formatINR(lotRevenue)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-emerald-600">
            +24.8% vs 7-day rolling average
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-apple">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Live Bay Occupancy</span>
            <Gauge className="h-4 w-4 text-brand-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {occupancyPct}%
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            {activeLot.available_slots} of {activeLot.total_slots} bays free
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-apple">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Active Surge Multiplier</span>
            <Sparkles className="h-4 w-4 text-brand-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-brand-600">
            {activeLot.dynamic_pricing_enabled
              ? `${activeLot.current_surge_multiplier.toFixed(2)}x`
              : "1.00x (Fixed)"}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            AI Recommended: {aiForecast.recommended_surge_multiplier.toFixed(2)}x
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-apple">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>EV 50kW Chargers Ready</span>
            <Activity className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-600">
            {activeLot.ev_slots_available} Bays
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            Surcharge: +₹{activeLot.ev_surcharge_inr}/hr
          </p>
        </div>
      </div>

      {/* AI Insight Banner + Dynamic Pricing Control */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-3xl border border-brand-200 bg-gradient-to-r from-brand-50/80 via-white to-blue-50/50 p-6 shadow-sm lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold text-white">
              <Cpu className="h-3.5 w-3.5" />
              {aiForecast.model_architecture}
            </span>
            <span className="font-mono text-xs font-bold text-brand-700">
              LIVE ML INFERENCE
            </span>
          </div>
          <p className="text-sm font-medium leading-relaxed text-slate-700">
            {aiForecast.insight_summary}
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() =>
                updateLotSurge(
                  activeLot.id,
                  true,
                  aiForecast.recommended_surge_multiplier
                )
              }
              className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700"
            >
              Apply AI Recommended Tariff (
              {aiForecast.recommended_surge_multiplier.toFixed(2)}x)
            </button>
          </div>
        </div>

        {/* Manual Surge Controller */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Dynamic Surge Tariff Policy
              </h2>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={activeLot.dynamic_pricing_enabled}
                onChange={(e) =>
                  updateLotSurge(
                    activeLot.id,
                    e.target.checked,
                    activeLot.current_surge_multiplier
                  )
                }
                className="h-4 w-4 accent-brand-600 rounded"
              />
              <span>Enabled</span>
            </label>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-600">
              <span>Surge Multiplier</span>
              <span className="font-mono font-bold text-brand-600">
                {activeLot.current_surge_multiplier.toFixed(2)}x (₹
                {Math.round(
                  activeLot.base_hourly_rate_inr *
                    activeLot.current_surge_multiplier
                )}
                /hr)
              </span>
            </div>
            <input
              type="range"
              aria-label="Surge Multiplier Slider"
              min={1.0}
              max={2.25}
              step={0.05}
              value={activeLot.current_surge_multiplier}
              onChange={(e) =>
                updateLotSurge(
                  activeLot.id,
                  true,
                  Number(e.target.value)
                )
              }
              className="mt-2 w-full accent-brand-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Recharts Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
          <h3 className="text-sm font-bold text-slate-900">
            12-Hour AI Occupancy Forecast (%)
          </h3>
          <p className="text-xs text-slate-500">
            Predicted bay utilization curve across IST commercial rush hours
          </p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={aiForecast.hourly_forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="hour_label" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="predicted_occupancy_pct"
                  stroke="#0052FF"
                  fill="#DBEAFE"
                  strokeWidth={2.5}
                  name="Predicted Occupancy %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
          <h3 className="text-sm font-bold text-slate-900">
            Recommended Dynamic Multiplier Curve (x)
          </h3>
          <p className="text-xs text-slate-500">
            Automated surge elasticity calibrated to prevent 100% bay saturation
          </p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aiForecast.hourly_forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="hour_label" tick={{ fontSize: 10 }} />
                <YAxis domain={[0.8, 2.0]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar
                  dataKey="recommended_multiplier"
                  fill="#2563EB"
                  radius={[6, 6, 0, 0]}
                  name="Surge Multiplier (x)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Bay Matrix Override Controller */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-brand-600" />
            <h3 className="text-base font-bold text-slate-900">
              Live IoT Bay Status Controller ({activeLot.code})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Click any bay status dropdown to override state (syncs immediately to
            Driver &amp; Gate apps)
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {activeLot.slots.map((slot) => (
            <div
              key={slot.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-extrabold text-slate-900">
                  {slot.slot_number}
                </span>
                <span className="text-[9px] font-bold text-slate-400">
                  {slot.slot_type.slice(0, 3)}
                </span>
              </div>
              <select
                aria-label={`Change status for ${slot.slot_number}`}
                value={slot.status}
                onChange={(e) =>
                  updateSlotStatus(
                    activeLot.id,
                    slot.id,
                    e.target.value as SlotStatus
                  )
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-800"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="RESERVED">RESERVED</option>
                <option value="OCCUPIED">OCCUPIED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
    </ProtectedRouteGate>
  );
}
