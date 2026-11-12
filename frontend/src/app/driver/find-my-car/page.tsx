"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Footprints,
  MapPin,
  Car,
  Compass,
  CheckCircle2,
  Clock,
  Layers,
  ArrowUp,
  ShieldCheck,
} from "lucide-react";
import { fetchFindMyCarRoute, FindMyCarResponse } from "@/lib/indoorNavigationApi";

function FindMyCarContent() {
  const searchParams = useSearchParams();
  const bookingId = parseInt(searchParams.get("booking") || "1", 10);
  const [data, setData] = useState<FindMyCarResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetchFindMyCarRoute(bookingId);
        setData(res);
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to load find-my-car:", err);
        setError(err.message || "Failed to locate parked vehicle");
        setLoading(false);
      }
    }
    load();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-slate-400">Locating your parked vehicle...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/driver/indoor"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Link href="/driver/bookings" className="hover:text-cyan-400">
                My Bookings
              </Link>
              <span>/</span>
              <span className="text-cyan-400 font-semibold">Pedestrian Return</span>
            </div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <span>Find My Parked Car</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-cyan-950/80 px-3.5 py-1.5 rounded-full border border-cyan-500/40 text-xs font-bold text-cyan-300">
          <Car className="w-4 h-4 text-cyan-400" />
          <span>Slot {data?.assigned_slot_number || "C-142"}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Parked Vehicle Summary Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/30 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Car className="w-8 h-8" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                Parked Location
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
                Bay {data?.assigned_slot_number || "C-142"}
              </h2>
              <div className="text-xs text-cyan-400 font-semibold mt-1 flex items-center gap-2">
                <span>{data?.floor_name || "Basement 2"}</span>
                <span>•</span>
                <span>{data?.zone_code || "Zone C"} (Transit Hub Premium)</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400">Facility Hub</div>
            <div className="text-sm font-bold text-slate-200 mt-0.5">
              {data?.facility_name || "Select CITYWALK Transit Hub"}
            </div>
            <div className="mt-2 text-xs text-emerald-400 font-medium flex items-center justify-end gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Bay Locked & Monitored</span>
            </div>
          </div>
        </div>

        {/* Recommended Pedestrian Access Path */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Footprints className="w-4 h-4 text-cyan-400" />
            <span>Recommended Walking Route from Lobby</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Nearest Elevator</div>
              <div className="text-base font-bold text-cyan-400 mt-1">
                {data?.nearest_elevator_code || "Central Lobby Elevator G"}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Take Elevator from Ground Floor directly down to Level B2.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Nearest Staircase</div>
              <div className="text-base font-bold text-slate-200 mt-1">
                {data?.nearest_stairs_code || "North Stairwell Exit 02"}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Emergency and pedestrian stairs accessible 24/7.
              </p>
            </div>
          </div>

          {/* Turn by Turn Walking Directions */}
          <div className="pt-4 border-t border-slate-800/80">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Step-by-Step Walking Directions
            </h4>
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px]">
                  1
                </div>
                <span>Enter via Ground Central Concourse and proceed to Central Lobby Elevator.</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px]">
                  2
                </div>
                <span>Descend 2 levels to Basement 2 (Transit Hub Concourse).</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px]">
                  3
                </div>
                <span>Exit elevator into Zone C and follow the electric blue overhead markers to Bay {data?.assigned_slot_number || "C-142"}.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/driver/indoor"
            className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center gap-2"
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Open Interactive 2D Map</span>
          </Link>

          <Link
            href="/driver/bookings"
            className="px-6 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Vehicle Located & Ready to Exit</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function FindMyCarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <FindMyCarContent />
    </Suspense>
  );
}
