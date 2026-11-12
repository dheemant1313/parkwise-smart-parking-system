"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  BatteryCharging,
  CarFront,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  FacilityEntrance,
  NearbyFacilityItem,
  ParkingFacilityDetail,
  ParkingFacilitySummary,
} from "@/lib/facilityApi";

interface FacilityCardDrawerProps {
  facility: ParkingFacilitySummary | NearbyFacilityItem | ParkingFacilityDetail | null;
  onClose: () => void;
  selectedEntrance: FacilityEntrance | null;
  onSelectEntrance: (entrance: FacilityEntrance) => void;
  onReserveClick: (facilityId: number, lotId?: number) => void;
  onStartNavigation?: (facility: ParkingFacilitySummary, entrance?: FacilityEntrance) => void;
  onBookDirect?: (facility: ParkingFacilitySummary) => void;
}

export function FacilityCardDrawer({
  facility,
  onClose,
  selectedEntrance,
  onSelectEntrance,
  onReserveClick,
  onStartNavigation,
  onBookDirect,
}: FacilityCardDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [showNavDropdown, setShowNavDropdown] = useState(false);

  if (!facility) return null;

  const summary: ParkingFacilitySummary = "facility" in facility ? facility.facility : facility;
  const distanceKm = "distance_km" in facility ? facility.distance_km : null;
  const drivingMins =
    "estimated_driving_minutes" in facility ? facility.estimated_driving_minutes : null;

  const isAvailable = summary.available_capacity > 0;
  const occupancyPct = Math.round(
    ((summary.total_capacity - summary.available_capacity) / Math.max(1, summary.total_capacity)) *
      100
  );

  const activeEntrance = selectedEntrance || summary.primary_entrance;

  const handleCopyAddress = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(summary.formatted_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBookClick = () => {
    if (onBookDirect) {
      onBookDirect(summary);
    } else {
      onReserveClick(summary.id, summary.lot_id);
    }
  };

  const handleNavClick = () => {
    if (onStartNavigation) {
      onStartNavigation(summary, activeEntrance);
    }
  };

  // External Maps Links for Entrance
  const entLat = activeEntrance?.latitude || summary.latitude;
  const entLng = activeEntrance?.longitude || summary.longitude;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${entLat},${entLng}&travelmode=driving`;
  const appleMapsUrl = `https://maps.apple.com/?daddr=${entLat},${entLng}&dirflg=d`;
  const wazeUrl = `https://waze.com/ul?ll=${entLat},${entLng}&navigate=yes`;

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:top-20 md:bottom-auto md:w-[420px] z-30 max-h-[calc(100vh-210px)] overflow-y-auto rounded-3xl border border-slate-700/80 bg-slate-900/95 p-5 text-white shadow-2xl backdrop-blur-xl transition-all">
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/30">
              {summary.category}
            </span>
            {summary.is_24_hours && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                24/7 Open
              </span>
            )}
            {distanceKm !== null && (
              <span className="font-mono text-xs text-slate-400">
                {distanceKm < 1
                  ? `${Math.round(distanceKm * 1000)}m away`
                  : `${distanceKm.toFixed(1)} km`}
              </span>
            )}
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-100">{summary.name}</h2>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate">{summary.formatted_address}</span>
            <button
              onClick={handleCopyAddress}
              title="Copy address"
              className="text-slate-500 hover:text-slate-300 transition"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          aria-label="Close drawer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Facility Image Carousel / Photo */}
      {summary.photos && summary.photos.length > 0 && (
        <div className="relative mt-4 h-40 w-full overflow-hidden rounded-2xl bg-slate-800">
          <img
            src={summary.photos[0]}
            alt={summary.name}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs">
            <span className="rounded-lg bg-black/60 px-2 py-1 font-mono text-[11px] font-bold text-emerald-400 backdrop-blur">
              ₹{summary.base_hourly_rate_inr}/hour
            </span>
            {drivingMins && (
              <span className="rounded-lg bg-black/60 px-2 py-1 text-[11px] font-medium text-slate-300 backdrop-blur">
                ~{drivingMins} mins drive
              </span>
            )}
          </div>
        </div>
      )}

      {/* Live Capacity & Occupancy Bar */}
      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">Live Bay Availability</span>
          <span
            className={`font-mono font-bold ${
              isAvailable ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {summary.available_capacity} / {summary.total_capacity} Slots Free
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              occupancyPct > 85
                ? "bg-rose-500"
                : occupancyPct > 60
                ? "bg-amber-400"
                : "bg-emerald-400"
            }`}
            style={{ width: `${occupancyPct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>{occupancyPct}% Occupied</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Verified Live
          </span>
        </div>
      </div>

      {/* Primary Entrance & Waypoint Information */}
      {activeEntrance && (
        <div className="mt-3 rounded-2xl border border-blue-500/30 bg-blue-950/20 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-blue-300 font-bold">
              <ShieldCheck className="h-4 w-4" />
              <span>Assigned Entrance Gate</span>
            </div>
            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-mono text-blue-300 font-bold">
              {activeEntrance.gate_code}
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-200">
            {activeEntrance.gate_name}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
            <span className="rounded bg-slate-800 px-2 py-0.5">
              Clearance: {activeEntrance.height_clearance_meters}m
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5">
              {activeEntrance.barrier_type}
            </span>
          </div>
          {activeEntrance.turn_restrictions && (
            <p className="mt-2 text-[11px] text-amber-300/90 leading-tight">
              ⚠️ {activeEntrance.turn_restrictions}
            </p>
          )}
        </div>
      )}

      {/* Pricing Breakdown & EV Charging Status */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Base Tariff</div>
          <div className="text-sm font-mono font-bold text-white mt-0.5">
            ₹{summary.base_hourly_rate_inr}
            <span className="text-[10px] text-slate-400 font-normal"> / hour</span>
          </div>
          <div className="text-[10px] text-slate-500">Day pass: ₹{summary.base_hourly_rate_inr * 6}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5">
          <div className="text-[10px] text-emerald-400 font-semibold uppercase flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span>EV HyperCharging</span>
          </div>
          <div className="text-sm font-bold text-white mt-0.5">60kW CCS-2</div>
          <div className="text-[10px] text-emerald-300">Fast charging ready</div>
        </div>
      </div>

      {/* Amenities Badges */}
      {summary.amenities && summary.amenities.length > 0 && (
        <div className="mt-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Facility Features
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {summary.amenities.slice(0, 6).map((amenity) => (
              <span
                key={amenity}
                className="rounded-lg border border-slate-800 bg-slate-800/80 px-2 py-1 text-[10px] font-medium text-slate-300"
              >
                {amenity.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Primary Action Buttons */}
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex gap-2">
          {/* Outdoor In-App Navigation CTA */}
          <button
            type="button"
            onClick={handleNavClick}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/50 bg-blue-600/20 py-2.5 text-xs font-bold text-blue-300 hover:bg-blue-600/30 transition shadow"
          >
            <Navigation className="h-3.5 w-3.5 text-blue-400" />
            <span>Navigate to Gate</span>
          </button>

          {/* Book Slot CTA */}
          <button
            type="button"
            disabled={!isAvailable}
            onClick={handleBookClick}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Book Slot</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* External Navigation Apps Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
          <span>External Maps:</span>
          <div className="flex items-center gap-2">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-0.5"
            >
              <span>Google</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <span>•</span>
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-0.5"
            >
              <span>Apple</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <span>•</span>
            <a
              href={wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-0.5"
            >
              <span>Waze</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
