"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { ProtectedRouteGate } from "@/components/auth/ProtectedRouteGate";
import { LiveOperatorMap } from "@/components/operator/LiveOperatorMap";

export default function OperatorLiveMapPage() {
  return (
    <ProtectedRouteGate
      allowedRoles={["OPERATOR", "ADMIN", "GATE_STAFF"]}
      requiredPermission="lot:manage"
      applicationName="NOC Operations Room • Live Facility Monitoring"
    >
      <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
        {/* Top Control Bar with Quick Exit Link */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs z-50">
          <div className="flex items-center gap-3">
            <Link
              href="/operator"
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1 font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Operator OS</span>
            </Link>

            <div className="hidden sm:flex items-center gap-2 text-slate-400">
              <span>•</span>
              <span className="font-mono text-slate-300">NOC Control Room v2.8</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Authorized Operator Session</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/driver/map"
              target="_blank"
              className="flex items-center gap-1 text-blue-400 hover:underline"
            >
              <span>Driver Map Preview</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Live Operator Map in Full Screen Mode */}
        <div className="flex-1 w-full h-[calc(100vh-2.5rem)] overflow-hidden">
          <LiveOperatorMap fullScreenMode={true} />
        </div>
      </div>
    </ProtectedRouteGate>
  );
}
