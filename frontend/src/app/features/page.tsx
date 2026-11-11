"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  BatteryCharging,
  Building2,
  CarFront,
  CheckCircle2,
  Cpu,
  Layers,
  Lock,
  QrCode,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type CategoryFilter = "ALL" | "DRIVER" | "OPERATOR" | "GATE" | "AI_SECURITY";

interface FeatureSpec {
  id: string;
  category: CategoryFilter;
  badge: string;
  title: string;
  description: string;
  metrics: string[];
  routeHref: string;
  routeLabel: string;
}

const FEATURE_SPECS: FeatureSpec[] = [
  {
    id: "3d-spatial-twin",
    category: "DRIVER",
    badge: "Three.js / R3F",
    title: "Interactive 3D Multi-Floor Garage Digital Twin",
    description:
      "Inspect exact bay locations, instanced structural columns, EV supercharger totems, and autonomous lane geometry before arriving.",
    metrics: [
      "60 FPS WebGL + InstancedMesh",
      "Reduced-Motion & 2D Blueprint Fallback",
      "Click-to-Reserve Bay Selection",
    ],
    routeHref: "/driver",
    routeLabel: "Test 3D Bay Selection",
  },
  {
    id: "atomic-concurrency",
    category: "AI_SECURITY",
    badge: "SQLAlchemy + Redis",
    title: "Zero Double-Booking Transactional Lock Engine",
    description:
      "Acquires a slot-specific mutex/Redis lock and verifies zero time-window overlap inside an atomic database transaction before issuing a reservation.",
    metrics: [
      "HTTP 409 Conflict Protection",
      "Strict Start/End Overlap Query",
      "Atomic Slot Status Commit",
    ],
    routeHref: "/driver",
    routeLabel: "Try Reservation Engine",
  },
  {
    id: "hmac-qr-gate",
    category: "GATE",
    badge: "HMAC-SHA256",
    title: "Cryptographic QR Gate Pass & Forgery Rejection",
    description:
      "Every booking generates a tamper-proof server-side HMAC-SHA256 signature binding the booking reference, slot ID, and Indian RTO plate.",
    metrics: [
      "Zero Frontend Trust Policy",
      "Instant Forged Pass Detection",
      "Automated Overstay FASTag Calculation",
    ],
    routeHref: "/gate",
    routeLabel: "Launch Gate Scanner",
  },
  {
    id: "xgboost-pricing",
    category: "OPERATOR",
    badge: "XGBoost + GBR v2.4",
    title: "12-Hour Predictive Occupancy & Surge Elasticity",
    description:
      "Machine learning demand curves forecast commercial peak hours across Indian metros and recommend optimal surge multipliers (1.00x – 2.25x).",
    metrics: [
      "Recharts Live Telemetry Curves",
      "One-Click Operator Tariff Override",
      "+34% Average RevPAB Uplift",
    ],
    routeHref: "/operator",
    routeLabel: "Open Operator Console",
  },
  {
    id: "ev-fast-charge",
    category: "DRIVER",
    badge: "50kW CCS2",
    title: "Dedicated EV Fast-Charging Bay Reservation",
    description:
      "Reserve high-output 50kW DC charging bays with transparent kWh/hourly surcharge computation and ultrasonic anti-ICE blocking sensors.",
    metrics: [
      "Dedicated EV Bay Filtering",
      "Automated Surcharge Calculation",
      "Real-Time Charger Health Telemetry",
    ],
    routeHref: "/driver",
    routeLabel: "Book EV Charging Bay",
  },
  {
    id: "rbac-governance",
    category: "AI_SECURITY",
    badge: "JWT + PBKDF2",
    title: "Enterprise Role-Based Access Control & Audit Trail",
    description:
      "Enforces strict permissions across DRIVER, OPERATOR, GATE_STAFF, and ADMIN personas with an immutable ledger of every system action.",
    metrics: [
      "4 Distinct Enterprise Personas",
      "Immutable Action Audit Trail",
      "Live vs Sandbox Integration Matrix",
    ],
    routeHref: "/admin",
    routeLabel: "Inspect Admin Console",
  },
];

export default function FeaturesPage() {
  const [filter, setFilter] = useState<CategoryFilter>("ALL");

  const filteredSpecs =
    filter === "ALL"
      ? FEATURE_SPECS
      : FEATURE_SPECS.filter((f) => f.category === filter);

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 space-y-14">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
          <Sparkles className="h-3.5 w-3.5" />
          Platform Capabilities
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Full-Stack Smart Parking Architecture.
        </h1>
        <p className="text-base leading-relaxed text-slate-600">
          Explore the technical modules powering Parkwise across 3D WebGL
          visualization, transactional backend concurrency, AI demand
          forecasting, and edge boom-barrier verification.
        </p>
      </div>

      {/* Interactive Category Filter */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[
          { id: "ALL", label: "All Modules (6)" },
          { id: "DRIVER", label: "Driver Experience" },
          { id: "OPERATOR", label: "Operator SaaS" },
          { id: "GATE", label: "Gate Hardware & ANPR" },
          { id: "AI_SECURITY", label: "AI & Zero-Trust Security" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as CategoryFilter)}
            className={`rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
              filter === tab.id
                ? "bg-brand-600 text-white shadow-stripe"
                : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredSpecs.map((spec) => (
          <motion.div
            key={spec.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 shadow-apple hover:border-brand-500 transition-all"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-brand-50 px-3 py-1 font-mono text-[11px] font-bold text-brand-700 border border-brand-200">
                  {spec.badge}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {spec.category}
                </span>
              </div>

              <h2 className="text-xl font-bold text-slate-900">{spec.title}</h2>
              <p className="text-xs leading-relaxed text-slate-500">
                {spec.description}
              </p>

              <ul className="space-y-2 border-t border-slate-100 pt-4 text-xs font-medium text-slate-700">
                {spec.metrics.map((m) => (
                  <li key={m} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <Link
                href={spec.routeHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-600 transition-colors"
              >
                <span>{spec.routeLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
