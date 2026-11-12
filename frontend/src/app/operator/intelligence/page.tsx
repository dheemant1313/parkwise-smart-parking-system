"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Flame, ShieldCheck, MapPin } from "lucide-react";
import { ProtectedRouteGate } from "@/components/auth/ProtectedRouteGate";
import { AIIntelligenceHeatmapConsole } from "@/components/operator/AIIntelligenceHeatmapConsole";

export default function OperatorIntelligencePage() {
  return (
    <ProtectedRouteGate
      allowedRoles={["OPERATOR", "ADMIN"]}
      requiredPermission="lot:manage"
      applicationName="AI Location Intelligence & Demand Heatmaps Room"
    >
      <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Top Control Bar with Quick Exit & Breadcrumb Links */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-5 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-xs">
          <div className="flex items-center gap-3">
            <Link
              href="/operator"
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition shadow-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Operator OS</span>
            </Link>

            <div className="hidden sm:flex items-center gap-2 text-slate-400">
              <span>•</span>
              <span className="font-mono text-cyan-400 font-semibold flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                Phase 13 Location Intelligence
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Authorized Human Operator Session</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/operator/map"
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium transition"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Live Facility NOC</span>
            </Link>
            <span className="text-slate-600">|</span>
            <Link
              href="/driver/map"
              target="_blank"
              className="flex items-center gap-1 text-slate-400 hover:text-white transition"
            >
              <span>Driver Map</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </header>

        {/* Intelligence Deep-Dive Body */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <AIIntelligenceHeatmapConsole />
        </main>
      </div>
    </ProtectedRouteGate>
  );
}
