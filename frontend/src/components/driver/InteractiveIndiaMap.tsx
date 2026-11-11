"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Compass,
  MapPin,
  Navigation,
  Zap,
} from "lucide-react";
import { ParkingLot } from "@/types";

interface InteractiveIndiaMapProps {
  lots: ParkingLot[];
  selectedLotId: number;
  onSelectLot: (lotId: number) => void;
}

const PIN_POSITIONS: Record<number, { xPct: number; yPct: number; area: string }> = {
  1: { xPct: 44, yPct: 26, area: "Connaught Place, Central Delhi" },
  4: { xPct: 37, yPct: 34, area: "NH-48 CyberCity, Gurugram" },
  2: { xPct: 23, yPct: 58, area: "Bandra Kurla Complex, Mumbai" },
  5: { xPct: 48, yPct: 63, area: "Madhapur HITEC City, Hyderabad" },
  3: { xPct: 44, yPct: 81, area: "100ft Rd Indiranagar, Bengaluru" },
};

export function InteractiveIndiaMap({
  lots,
  selectedLotId,
  onSelectLot,
}: InteractiveIndiaMapProps) {
  const activeLot = lots.find((l) => l.id === selectedLotId) || lots[0];

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-apple">
      {/* Top Map Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-brand-600" />
          <span className="text-xs font-bold text-slate-900">
            Interactive Smart Parking Telemetry Map
          </span>
        </div>
        <span className="font-mono text-[11px] font-semibold text-slate-500">
          GPS: {activeLot.latitude.toFixed(4)}° N, {activeLot.longitude.toFixed(4)}° E
        </span>
      </div>

      {/* Stylized Vector Map Canvas */}
      <div className="relative h-[300px] w-full bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-5 text-white overflow-hidden">
        {/* Subtle Coordinate Grid Lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #60A5FA 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Route Connection Polylines SVG */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polyline
            fill="none"
            stroke="#38BDF8"
            strokeWidth="0.4"
            strokeDasharray="1.5 1.5"
            points="44,26 37,34 23,58 48,63 44,81"
          />
        </svg>

        {/* Interactive Facility Pins */}
        {lots.map((lot) => {
          const pos = PIN_POSITIONS[lot.id] || {
            xPct: 50,
            yPct: 50,
            area: lot.city,
          };
          const isSelected = lot.id === selectedLotId;

          return (
            <button
              key={lot.id}
              type="button"
              onClick={() => onSelectLot(lot.id)}
              style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%` }}
              className={`group absolute -translate-x-1/2 -translate-y-1/2 transition-all ${
                isSelected ? "z-20 scale-110" : "z-10 hover:scale-105"
              }`}
            >
              <div
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-left shadow-lg backdrop-blur-md transition-all ${
                  isSelected
                    ? "border-white bg-brand-600 text-white ring-4 ring-brand-500/40"
                    : "border-slate-700 bg-slate-900/90 text-slate-200 hover:border-brand-400"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-extrabold leading-none">
                    {lot.city}
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] opacity-90">
                    {lot.available_slots} free • ₹{lot.base_hourly_rate_inr}/h
                  </p>
                </div>
              </div>
            </button>
          );
        })}

        {/* Active Lot Overlay Card inside Map */}
        <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/90 bg-slate-950/90 px-4 py-3 backdrop-blur-md">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-brand-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                {activeLot.code}
              </span>
              <span className="text-xs font-extrabold text-white">
                {activeLot.name}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{activeLot.address}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
              <Zap className="h-3 w-3" />
              {activeLot.ev_slots_available} EV Ready
            </span>
            <Link
              href={`/driver/lots/${activeLot.id}`}
              className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-900 hover:bg-brand-50"
            >
              <span>Lot Details</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
