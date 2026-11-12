"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  X,
  Compass,
  Zap,
  ShieldCheck,
  CheckCircle,
  Navigation,
  Clock,
  Car,
  Tag,
  AlertCircle,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import {
  fetchIntelligentRecommendations,
  RecommendedFacilityItem,
} from "@/lib/locationIntelligenceApi";
import { ParkingFacilitySummary } from "@/lib/facilityApi";

interface AIRecommendationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  driverLocation: { lat: number; lng: number };
  vehicleType?: string;
  hasEv?: boolean;
  hasAccessible?: boolean;
  hasCovered?: boolean;
  onSelectFacility: (facility: ParkingFacilitySummary) => void;
  onNavigateFacility: (facility: ParkingFacilitySummary) => void;
  onBookFacility: (facility: ParkingFacilitySummary) => void;
}

export const AIRecommendationDrawer: React.FC<AIRecommendationDrawerProps> = ({
  isOpen,
  onClose,
  driverLocation,
  vehicleType,
  hasEv,
  hasAccessible,
  hasCovered,
  onSelectFacility,
  onNavigateFacility,
  onBookFacility,
}) => {
  const [recommendations, setRecommendations] = useState<RecommendedFacilityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchRecs = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchIntelligentRecommendations({
          driver_latitude: driverLocation.lat,
          driver_longitude: driverLocation.lng,
          vehicle_type: vehicleType !== "ALL" ? vehicleType : undefined,
          needs_ev_charging: hasEv,
          needs_accessible: hasAccessible,
          needs_covered: hasCovered,
          search_radius_km: 20,
        });
        setRecommendations(res.recommendations || []);
      } catch (err: any) {
        console.error("AI recommendation fetch error:", err);
        setError("Unable to compute AI recommendations right now. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecs();
  }, [isOpen, driverLocation, vehicleType, hasEv, hasAccessible, hasCovered]);

  if (!isOpen) return null;

  // Convert RecommendedFacilityItem to partial ParkingFacilitySummary
  const toFacilitySummary = (rec: RecommendedFacilityItem): ParkingFacilitySummary => {
    return {
      id: rec.facility_id,
      code: rec.code,
      name: rec.name,
      slug: rec.slug,
      category: rec.category,
      status: "OPERATIONAL",
      total_capacity: rec.total_capacity,
      available_capacity: rec.available_bays,
      base_hourly_rate_inr: rec.base_hourly_rate_inr,
      is_24_hours: true,
      latitude: rec.latitude,
      longitude: rec.longitude,
      city: rec.city,
      locality: rec.city,
      formatted_address: rec.formatted_address,
      photos: [],
      amenities: ["CCTV", "Security", "EV_Charging"],
    };
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col text-slate-100 transition-all duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/70">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 text-cyan-400 border border-cyan-500/30">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              AI Smart Recommendations
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                Phase 13
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Personalized multi-objective ranking & real-time explainability
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <Sparkles className="h-8 w-8 text-cyan-400 animate-spin mx-auto opacity-70" />
            <p className="text-sm font-medium text-slate-300">
              Evaluating facilities, traffic paths & availability...
            </p>
            <p className="text-xs text-slate-500">
              Balancing distance, price, vacancy rate and driver preferences
            </p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="py-16 text-center space-y-2 text-slate-400">
            <Car className="h-10 w-10 mx-auto text-slate-600" />
            <p className="text-sm">No facilities matched current criteria.</p>
            <p className="text-xs text-slate-500">Try expanding the search radius or clearing strict filters.</p>
          </div>
        ) : (
          recommendations.map((rec, idx) => {
            const facSummary = toFacilitySummary(rec);
            const isPrimary = rec.match_tier === "PRIMARY_MATCH" || idx === 0;

            return (
              <div
                key={rec.facility_id}
                className={`relative rounded-2xl p-4 border transition-all ${
                  isPrimary
                    ? "bg-gradient-to-br from-cyan-950/40 via-slate-900/90 to-slate-950 border-cyan-500/50 shadow-lg shadow-cyan-950/40"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Match Score Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        isPrimary
                          ? "bg-cyan-500 text-slate-950 shadow-sm"
                          : "bg-blue-900/60 text-blue-300 border border-blue-700"
                      }`}
                    >
                      <Sparkles className="h-3 w-3" />
                      {Math.round(rec.match_score)}% Match
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {rec.match_tier.replace("_", " ")}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">
                    ₹{rec.base_hourly_rate_inr}/hr
                  </span>
                </div>

                {/* Facility Name & Location */}
                <h3 className="text-base font-semibold text-white tracking-tight">
                  {rec.name}
                </h3>
                <p className="text-xs text-slate-400 truncate mb-3">
                  {rec.formatted_address}
                </p>

                {/* Metrics Pill Grid */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs mb-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Distance</span>
                    <span className="font-semibold text-slate-200">{rec.distance_km} km</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Drive Time</span>
                    <span className="font-semibold text-slate-200">~{rec.estimated_driving_time_mins} min</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Available</span>
                    <span className="font-bold text-cyan-400">{rec.available_bays} bays</span>
                  </div>
                </div>

                {/* Explainability Breakdown (Phase 13 requirement) */}
                <div className="space-y-1 mb-4">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-cyan-400" />
                    Why AI recommends this facility:
                  </span>
                  <ul className="space-y-1 text-xs text-slate-400 pl-4 list-disc marker:text-cyan-500">
                    {rec.explanations.map((exp, eIdx) => (
                      <li key={eIdx} className="leading-snug">
                        {exp}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/70">
                  <button
                    onClick={() => {
                      onSelectFacility(facSummary);
                      onClose();
                    }}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition text-center"
                  >
                    View on Map
                  </button>
                  <button
                    onClick={() => {
                      onNavigateFacility(facSummary);
                      onClose();
                    }}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition flex items-center justify-center gap-1"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Navigate
                  </button>
                  <button
                    onClick={() => {
                      onBookFacility(facSummary);
                      onClose();
                    }}
                    className="py-1.5 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-xs font-bold text-slate-950 transition"
                  >
                    Book
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Disclaimer */}
      <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-500 leading-snug">
        Estimates based on historical patterns & live sensor telemetry. Availability is not guaranteed until reservation confirmation.
      </div>
    </div>
  );
};
