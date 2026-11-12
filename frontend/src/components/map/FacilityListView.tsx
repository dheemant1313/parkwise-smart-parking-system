"use client";

import React from "react";
import {
  Car,
  Clock,
  Compass,
  MapPin,
  Navigation,
  ShieldCheck,
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";
import { NearbyFacilityItem, ParkingFacilitySummary } from "@/lib/facilityApi";

interface FacilityListViewProps {
  facilities: NearbyFacilityItem[];
  selectedFacility: ParkingFacilitySummary | null;
  onSelectFacility: (facility: ParkingFacilitySummary) => void;
  onBookFacility: (facility: ParkingFacilitySummary) => void;
  onNavigateFacility: (facility: ParkingFacilitySummary) => void;
  isLoading?: boolean;
}

export function FacilityListView({
  facilities,
  selectedFacility,
  onSelectFacility,
  onBookFacility,
  onNavigateFacility,
  isLoading = false,
}: FacilityListViewProps) {
  if (isLoading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-xs font-semibold text-slate-400">
            Finding nearby smart parking hubs...
          </span>
        </div>
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <div className="flex h-96 w-full flex-col items-center justify-center p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-400">
          <Compass className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-bold text-slate-200">No Facilities in this Range</h3>
        <p className="mt-1 max-w-sm text-xs text-slate-400">
          Try expanding your search radius slider or adjusting the price and vehicle filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 max-w-7xl mx-auto">
      {facilities.map((item) => {
        const fac = item.facility;
        const isSelected = selectedFacility?.id === fac.id;
        const isAvailable = fac.available_capacity > 0;
        const occupancyPct = Math.round(
          ((fac.total_capacity - fac.available_capacity) / Math.max(1, fac.total_capacity)) * 100
        );

        return (
          <div
            key={fac.id}
            onClick={() => onSelectFacility(fac)}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border transition-all duration-300 cursor-pointer ${
              isSelected
                ? "border-blue-500 bg-slate-900/90 shadow-2xl shadow-blue-500/20 ring-1 ring-blue-500"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/80 shadow-lg"
            }`}
          >
            {/* Top Photo & Badges */}
            <div className="relative h-44 w-full overflow-hidden bg-slate-800">
              <img
                src={
                  fac.photos && fac.photos.length > 0
                    ? fac.photos[0]
                    : "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80"
                }
                alt={fac.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

              {/* Category & 24/7 Badges */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <span className="rounded-full bg-slate-900/80 px-2.5 py-0.5 text-[10px] font-bold text-blue-400 border border-slate-700 backdrop-blur">
                  {fac.category}
                </span>
                {fac.is_24_hours && (
                  <span className="rounded-full bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-700/50 backdrop-blur">
                    24/7 Open
                  </span>
                )}
              </div>

              {/* Rate & Distance Overlay */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <span className="rounded-xl bg-slate-900/90 px-2.5 py-1 font-mono text-xs font-black text-emerald-400 border border-slate-700/80 backdrop-blur">
                  ₹{fac.base_hourly_rate_inr}/hour
                </span>
                <span className="rounded-xl bg-slate-900/90 px-2.5 py-1 text-xs font-medium text-slate-200 border border-slate-700/80 backdrop-blur flex items-center gap-1">
                  <Navigation className="h-3 w-3 text-blue-400" />
                  {item.distance_km < 1
                    ? `${item.distance_meters}m`
                    : `${item.distance_km.toFixed(1)} km`}{" "}
                  • ~{item.estimated_driving_minutes} mins
                </span>
              </div>
            </div>

            {/* Facility Body */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition">
                  {fac.name}
                </h3>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">{fac.formatted_address}</span>
                </p>

                {/* Live Availability Bar */}
                <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300">Live Bay Availability</span>
                    <span
                      className={`font-mono font-bold ${
                        isAvailable ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {fac.available_capacity} / {fac.total_capacity} Slots Free
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        occupancyPct > 90
                          ? "bg-rose-500"
                          : occupancyPct > 70
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                      }`}
                      style={{ width: `${occupancyPct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                    <span>{occupancyPct}% Occupied</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Feed
                    </span>
                  </div>
                </div>

                {/* Ingress Gate Clearance */}
                {fac.primary_entrance && (
                  <div className="mt-3 flex items-center justify-between text-xs rounded-xl bg-slate-800/40 px-3 py-1.5 text-slate-300 border border-slate-800">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="truncate">{fac.primary_entrance.gate_name}</span>
                    </span>
                    <span className="font-mono text-slate-400 shrink-0">
                      Clearance: {fac.primary_entrance.height_clearance_meters}m
                    </span>
                  </div>
                )}

                {/* Amenities Pills */}
                {fac.amenities && fac.amenities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {fac.amenities.slice(0, 4).map((a) => (
                      <span
                        key={a}
                        className="rounded-lg border border-slate-800 bg-slate-800/50 px-2 py-0.5 text-[10px] font-semibold text-slate-400"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateFacility(fac);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition"
                >
                  <Navigation className="h-3.5 w-3.5 text-blue-400" />
                  <span>Navigate</span>
                </button>
                <button
                  type="button"
                  disabled={!isAvailable}
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookFacility(fac);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 shadow-md shadow-blue-600/30 transition disabled:opacity-40"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Book Now</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
