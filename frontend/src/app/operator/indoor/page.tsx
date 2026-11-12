"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Layers, ShieldCheck, Map, Plus } from "lucide-react";
import IndoorMapEditor from "@/components/operator/IndoorMapEditor";

function OperatorIndoorPageContent() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/operator"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Link href="/operator" className="hover:text-cyan-400 transition-colors">
                NOC Operations Dashboard
              </Link>
              <span>/</span>
              <span className="text-cyan-400 font-semibold">Indoor Garage Studio</span>
            </div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <span>Indoor Garage Topology & Multi-Floor Map Studio</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </h1>
          </div>
        </div>

        {/* Operator Badge */}
        <div className="flex items-center gap-2 bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-slate-800 text-xs font-medium text-slate-300">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Role: Operator Lead (Digital Signer)</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        <IndoorMapEditor facilityId={1} />
      </main>
    </div>
  );
}

export default function OperatorIndoorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OperatorIndoorPageContent />
    </Suspense>
  );
}
