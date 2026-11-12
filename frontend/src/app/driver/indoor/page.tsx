"use client";

import React, { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Navigation, ShieldCheck, MapPin, Compass } from "lucide-react";
import IndoorNavigationConsole from "@/components/indoor/IndoorNavigationConsole";

function DriverIndoorNavContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const facilityId = parseInt(searchParams.get("facilityId") || "1", 10);
  const slotNumber = searchParams.get("slot") || "C-142";
  const bookingId = parseInt(searchParams.get("bookingId") || "1", 10);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/driver/map"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Link href="/driver/map" className="hover:text-cyan-400 transition-colors">
                Outdoor Map
              </Link>
              <span>/</span>
              <span className="text-cyan-400 font-semibold">Indoor Multi-Floor Guidance</span>
            </div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <span>Indoor Garage Navigation</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h1>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-slate-800 text-xs font-medium text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Entrance Gate Verified:</span>
          <span className="font-bold text-cyan-400">Barrier 1 (Saket Hub)</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Navigation Console */}
        <IndoorNavigationConsole
          facilityId={facilityId}
          initialSlotNumber={slotNumber}
          bookingId={bookingId}
          onParkedSuccess={() => {
            console.log("Vehicle parked successfully!");
          }}
        />

        {/* Guidance Tips & Positioning Disclaimers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-300">
            <div className="flex items-center gap-2 font-bold text-slate-100 mb-1">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Multi-Level Ramp Guidance</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Follow highlighted ramp transitions descending from Ground → B1 → B2. Speed limit on ramps is restricted to 10 km/h.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-300">
            <div className="flex items-center gap-2 font-bold text-slate-100 mb-1">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>Exact Allotted Bay Locking</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Your vehicle bay <strong className="text-cyan-400">{slotNumber}</strong> in Zone C has an automated digital sensor lock reserved exclusively for your booking reference.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-300">
            <div className="flex items-center gap-2 font-bold text-slate-100 mb-1">
              <Navigation className="w-4 h-4 text-blue-400" />
              <span>Positioning Engine</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Indoor positioning is maintained via BLE beacons, physical QR checkpoints, and smartphone dead-reckoning sensors. Conventional GPS is not used inside garages.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DriverIndoorNavigationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DriverIndoorNavContent />
    </Suspense>
  );
}
