"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Activity,
  ArrowRight,
  BatteryCharging,
  Building2,
  Camera,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  Crown,
  Eye,
  Globe2,
  KeyRound,
  Layers,
  Lock,
  MapPin,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { formatINR } from "@/lib/utils";
import { Canvas3DSkeleton } from "@/components/ui/Skeleton";

const SmartParkingCanvas = dynamic(
  () =>
    import("@/components/three/SmartParkingCanvas").then(
      (m) => m.SmartParkingCanvas
    ),
  {
    ssr: false,
    loading: () => <Canvas3DSkeleton heightClass="h-[460px]" />,
  }
);

const TRUST_PARTNERS = [
  "DLF CyberCity NCR",
  "Jio World Drive BKC",
  "NDMC Smart City Grid",
  "Raheja Mindspace REIT",
  "Prestige Tech Park Bengaluru",
  "NPCI FASTag NETC",
];

export default function FuturisticLandingPage() {
  const { lots, bookings, getAIForecast, authUser, activeRole } = useParkwise();

  // Selected Lot for 3D & Live Radar
  const [selectedLotId, setSelectedLotId] = useState<number>(1);
  const [selectedDeckFloor, setSelectedDeckFloor] = useState<number>(1);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);

  // Live ROI Calculator State
  const [roiBays, setRoiBays] = useState<number>(200);
  const [roiBaseRate, setRoiBaseRate] = useState<number>(80);

  // Active Lot computation
  const activeLot = lots.find((l) => l.id === selectedLotId) || lots[0];
  const aiForecast = getAIForecast(activeLot.id);

  const totalBays = lots.reduce((acc, l) => acc + l.total_slots, 0);
  const totalAvailable = lots.reduce((acc, l) => acc + l.available_slots, 0);
  const totalEv = lots.reduce((acc, l) => acc + l.ev_slots_available, 0);

  // ROI calculations
  const baselineMonthly = roiBays * roiBaseRate * 7 * 30;
  const parkwiseMonthly = Math.round(baselineMonthly * 1.34);
  const annualUplift = (parkwiseMonthly - baselineMonthly) * 12;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* 1. TOP LIVE TELEMETRY COMMAND TICKER */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-b border-cyan-500/20 bg-slate-950/90 text-slate-300 text-[11px] font-mono tracking-wider backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 sm:px-6 lg:px-8 overflow-x-auto gap-4">
          <div className="flex items-center gap-4 shrink-0">
            <span className="flex items-center gap-1.5 font-bold text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              TELEMETRY MESH 2026:
            </span>
            <span className="text-slate-400">
              NETWORK OCCUPANCY: <strong className="text-white">87.4%</strong>
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">
              YOLOv8 EDGE INFERENCE: <strong className="text-emerald-400">18.2ms</strong>
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">
              FASTAG BOOM BARRIER: <strong className="text-cyan-300">&lt;140ms</strong>
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">
              EV ENERGY DISPENSED: <strong className="text-emerald-400">14.8 MWh</strong>
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              MoRTH CMVR COMPLIANT
            </span>
            <span className="text-slate-400 font-mono text-[10px]">
              PAN-INDIA SMART CITY GRID
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. FUTURISTIC HERO SECTION */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28">
        {/* Holographic Radial Gradients */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-gradient-to-tr from-cyan-600/20 via-brand-600/20 to-purple-600/20 blur-[140px]" />
        <div className="pointer-events-none absolute top-1/3 -left-40 h-[400px] w-[400px] rounded-full bg-emerald-600/10 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Holographic Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-950/40 px-4 py-1.5 text-xs font-bold text-cyan-300 backdrop-blur-xl shadow-lg shadow-cyan-500/10 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
              <span>THE NEXT-GEN AUTONOMOUS PARKING &amp; EV OPERATING SYSTEM</span>
              <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-mono text-cyan-200">
                v2.5
              </span>
            </div>

            {/* Giant Title */}
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl md:text-7xl leading-[1.08]">
              Autonomous Parking.{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-brand-400 to-indigo-400 bg-clip-text text-transparent">
                Edge AI Vision.
              </span>{" "}
              Zero-Stop Barrier Gates.
            </h1>

            <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Parkwise transforms modern Indian garages into intelligent autonomous mobility hubs. Powered by{" "}
              <span className="text-white font-semibold">YOLOv8 Computer Vision</span>,{" "}
              <span className="text-cyan-400 font-semibold">HSRP ANPR plate recognition</span>,{" "}
              <span className="text-emerald-400 font-semibold">60kW DC HyperCharging</span>, and{" "}
              <span className="text-indigo-400 font-semibold">XGBoost dynamic surge pricing</span>.
            </p>

            {/* Prominent Role Gate Access CTAs */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              {/* Driver CTA */}
              <Link
                href="/driver"
                className="group relative inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4 text-sm font-bold text-white shadow-xl shadow-cyan-500/25 transition-all hover:scale-105 hover:shadow-cyan-500/40 ring-1 ring-white/20"
              >
                <CarFront className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
                <span>Launch Driver Mobility App</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>

              {/* Operator CTA */}
              <Link
                href="/operator"
                className="group relative inline-flex items-center gap-2.5 rounded-2xl border border-indigo-500/50 bg-indigo-950/60 px-6 py-4 text-sm font-bold text-indigo-200 backdrop-blur-xl transition-all hover:bg-indigo-900/60 hover:text-white hover:scale-105 shadow-xl shadow-indigo-950/40"
              >
                <Building2 className="h-5 w-5 text-indigo-400 transition-transform group-hover:-translate-y-0.5" />
                <span>Operator SaaS Command Desk</span>
                <ArrowRight className="h-4 w-4 text-indigo-400 transition-transform group-hover:translate-x-1" />
              </Link>

              {/* Ecosystem & Auth Portal */}
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4 text-sm font-bold text-slate-300 hover:border-slate-700 hover:text-white transition-all backdrop-blur-md"
              >
                <KeyRound className="h-4 w-4 text-amber-400" />
                <span>Role Login Portal</span>
              </Link>
            </div>

            {/* Quick Metrics Bar */}
            <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-4xl mx-auto">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-xl">
                <div className="text-2xl sm:text-3xl font-black text-white">{totalBays}+</div>
                <div className="text-xs text-slate-400 mt-1 font-medium">IoT Ultrasonic Bays</div>
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-xl">
                <div className="text-2xl sm:text-3xl font-black text-emerald-400">{totalEv} Bays</div>
                <div className="text-xs text-slate-400 mt-1 font-medium">60kW Fast EV Chargers</div>
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-xl">
                <div className="text-2xl sm:text-3xl font-black text-cyan-400">99.4%</div>
                <div className="text-xs text-slate-400 mt-1 font-medium">HSRP ANPR Accuracy</div>
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-xl">
                <div className="text-2xl sm:text-3xl font-black text-indigo-400">+34%</div>
                <div className="text-xs text-slate-400 mt-1 font-medium">Operator Revenue Uplift</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. INTERACTIVE 3D DIGITAL TWIN GARAGE CANVAS */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative py-16 bg-slate-950/80 border-y border-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400 border border-cyan-500/20">
                WEBGL 3D DIGITAL TWIN
              </span>
              <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                Spatial Multi-Level Deck Navigation
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-400">
                Inspect live bay geometry, EV hypercharger status, and real-time sensor occupancy in 3D.
              </p>
            </div>

            {/* Deck Floor Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Deck Level:</span>
              {[1, 2, 3].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedDeckFloor(f)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    selectedDeckFloor === f
                      ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30"
                      : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  Floor 0{f}
                </button>
              ))}
            </div>
          </div>

          {/* 3D Canvas Box */}
          <div className="relative rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 backdrop-blur-2xl shadow-2xl overflow-hidden">
            <div className="relative h-[440px] sm:h-[480px] w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80">
              <SmartParkingCanvas
                slots={activeLot.slots}
                selectedSlotId={selectedSlotId}
                onSelectSlot={(slot) => setSelectedSlotId(slot.id)}
              />

              {/* Overlay HUD Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
                <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900/85 px-3 py-1.5 text-xs font-mono text-cyan-300 border border-cyan-500/30 backdrop-blur-md">
                  <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                  <span>3D TWIN ENGINE: {activeLot.name}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900/85 px-3 py-1.5 text-xs font-mono text-emerald-400 border border-emerald-500/30 backdrop-blur-md">
                  <Zap className="h-3.5 w-3.5" />
                  <span>EV FAST BAYS: {activeLot.ev_slots_available} AVAILABLE</span>
                </div>
              </div>

              <div className="absolute bottom-4 right-4 pointer-events-none">
                <div className="rounded-xl bg-slate-900/85 px-3 py-1.5 text-[11px] font-mono text-slate-400 border border-slate-800 backdrop-blur-md">
                  Click on any bay in 3D to inspect real-time sensor telemetry
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. LIVE METROPOLITAN BAY RADAR & CITY LOT SELECTOR */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
              LIVE NETWORK RADAR
            </span>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              Real-Time Metropolitan Indian Hubs
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Live capacity telemetry across commercial corridors in Delhi NCR, Mumbai BKC, Bengaluru, Pune, and Hyderabad.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {lots.slice(0, 3).map((lot) => {
              const forecast = getAIForecast(lot.id);
              const occPct = Math.round(((lot.total_slots - lot.available_slots) / lot.total_slots) * 100);

              return (
                <div
                  key={lot.id}
                  className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-bold text-brand-300 border border-brand-500/20">
                        {lot.city}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>LIVE LOT</span>
                      </div>
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-white">{lot.name}</h3>
                    <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                      {lot.address}
                    </p>

                    {/* Occupancy bar */}
                    <div className="mt-5">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400">Live Occupancy:</span>
                        <span className="font-bold text-white">{occPct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                          style={{ width: `${occPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block">Available</span>
                        <strong className="text-emerald-400 font-bold">{lot.available_slots} Bays</strong>
                      </div>
                      <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block">Base Tariff</span>
                        <strong className="text-white font-bold">₹{lot.base_hourly_rate_inr}/hr</strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="text-xs text-slate-400">
                      Surge: <strong className="text-cyan-400">{lot.current_surge_multiplier}x</strong>
                    </div>
                    <Link
                      href={`/driver/lots/${lot.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-500 transition-colors shadow-md shadow-brand-600/30"
                    >
                      <span>Book Slot</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. 6 CORE PILLARS OF THE FUTURE TECH MATRIX */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-20 bg-slate-950/60 border-t border-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-400 border border-indigo-500/20">
              NEXT-GEN INFRASTRUCTURE
            </span>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              Architected for Zero Friction &amp; Absolute Trust
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Six foundational technological breakthroughs enabling intelligent Indian urban parking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Camera,
                title: "YOLOv8 Edge Vision & HSRP ANPR",
                desc: "On-device NVIDIA Jetson inference classifies vehicle types in 18ms with MoRTH Rule 50 optical parsing and automated face redaction.",
                tag: "Computer Vision",
                color: "cyan",
              },
              {
                icon: QrCode,
                title: "Zero-Stop FASTag Boom Barriers",
                desc: "NPCI NETC dual-frequency RFID scanners lift entry barriers in <140ms with automated toll-wallet debit and instant audit logging.",
                tag: "RFID NETC",
                color: "emerald",
              },
              {
                icon: BatteryCharging,
                title: "60kW DC EV HyperCharging",
                desc: "OCPP 2.0.1 smart load-balancing bays for CCS2, Type 2 AC, and CHAdeMO with real-time SoC telemetry and idle overstay protection.",
                tag: "Clean Energy",
                color: "teal",
              },
              {
                icon: TrendingUp,
                title: "XGBoost Dynamic Surge AI",
                desc: "12-hour rolling machine learning models calibrate commercial peak-hour bay tariffs to maximize facility revenue per available bay (RevPAB).",
                tag: "Machine Learning",
                color: "indigo",
              },
              {
                icon: MapPin,
                title: "Shared Driveway Marketplace",
                desc: "Peer-to-peer private residential stilt bays and driveways monetized effortlessly with transparent 15% platform commission.",
                tag: "Shared Economy",
                color: "amber",
              },
              {
                icon: ShieldCheck,
                title: "Quantum-Grade HMAC QR Passes",
                desc: "Every digital ticket token is signed server-side with HMAC-SHA256, cryptographically preventing gate replay and forged tickets.",
                tag: "Zero-Trust Security",
                color: "purple",
              },
            ].map((p, idx) => {
              const Icon = p.icon;
              return (
                <div
                  key={idx}
                  className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 text-brand-400 border border-slate-700">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-300">
                      {p.tag}
                    </span>
                  </div>

                  <h3 className="mt-5 text-base font-bold text-white">{p.title}</h3>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. OPERATOR REVENUE ROI CALCULATOR */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-20 border-t border-slate-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 to-slate-950 p-8 sm:p-12 backdrop-blur-xl shadow-2xl">
            <div className="text-center max-w-2xl mx-auto">
              <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-400 border border-indigo-500/20">
                REVENUE CALCULATOR
              </span>
              <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                Calculate Your Facility's AI Revenue Uplift
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-400">
                See how dynamic surge pricing, zero-overstay FASTag settlement, and EV bays elevate annual net operating income.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Sliders */}
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-bold text-slate-300">Total Managed Bays</span>
                    <strong className="text-cyan-400 font-bold">{roiBays} Parking Bays</strong>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={800}
                    step={25}
                    value={roiBays}
                    onChange={(e) => setRoiBays(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-bold text-slate-300">Base Hourly Tariff</span>
                    <strong className="text-emerald-400 font-bold">₹{roiBaseRate} / hour</strong>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={200}
                    step={10}
                    value={roiBaseRate}
                    onChange={(e) => setRoiBaseRate(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>

              {/* Result Callout Card */}
              <div className="rounded-2xl border border-indigo-500/40 bg-indigo-950/60 p-6 text-center shadow-xl">
                <span className="text-xs uppercase tracking-wider text-indigo-300 font-bold">
                  PROJECTED ANNUAL INCREMENTAL REVENUE
                </span>
                <div className="mt-2 text-3xl sm:text-4xl font-black text-white">
                  +{formatINR(annualUplift)}
                </div>
                <div className="mt-1 text-xs font-bold text-emerald-400">
                  +34% Revenue Optimization vs Traditional Flat-Rate Parking
                </div>

                <div className="mt-6 pt-4 border-t border-indigo-900/80 flex items-center justify-between text-xs text-slate-300">
                  <span>Monthly Projected: {formatINR(parkwiseMonthly)}</span>
                  <Link
                    href="/operator"
                    className="font-bold text-cyan-400 hover:text-white inline-flex items-center gap-1"
                  >
                    <span>Deploy to Lot</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 7. STRICT ISOLATION ROLE MATRIX (DRIVER VS OPERATOR VS ADMIN) */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-20 border-t border-slate-900 bg-slate-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-bold text-brand-300 border border-brand-500/20">
              ZERO-LEAK RBAC SEGREGATION
            </span>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              Strict User Privacy &amp; Operator Isolation
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Every persona operates in an isolated environment with zero cross-tenant data leakage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Driver Column */}
            <div className="rounded-3xl border border-cyan-500/30 bg-slate-900/60 p-6 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <CarFront className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Driver Portal</h3>
                  <span className="text-[11px] text-cyan-400 font-mono">Role: DRIVER</span>
                </div>
              </div>

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Real-time bay search &amp; 3D navigation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>60kW EV DC Fast Charging bay reservations</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Monthly pass subscriptions with QR tokens</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>FASTag wallet &amp; UPI payment receipts</span>
                </li>
                <li className="flex items-center gap-2 text-rose-400 pt-2 border-t border-slate-800">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Cannot view other drivers or operator revenue</span>
                </li>
              </ul>
            </div>

            {/* Operator Column */}
            <div className="rounded-3xl border border-indigo-500/30 bg-slate-900/60 p-6 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Operator SaaS</h3>
                  <span className="text-[11px] text-indigo-400 font-mono">Role: OPERATOR</span>
                </div>
              </div>

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span>Multi-lot occupancy monitoring in real-time</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span>XGBoost Dynamic surge tariff controls</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span>ANPR Gate Staff manual review queue</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span>Facility staff scheduling &amp; GST compliance</span>
                </li>
                <li className="flex items-center gap-2 text-rose-400 pt-2 border-t border-slate-800">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Cannot inspect other facilities or driver PII</span>
                </li>
              </ul>
            </div>

            {/* Admin Column */}
            <div className="rounded-3xl border border-amber-500/30 bg-slate-900/60 p-6 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Platform Owner</h3>
                  <span className="text-[11px] text-amber-400 font-mono">Role: SUPERADMIN</span>
                </div>
              </div>

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Universal Master Access to all applications</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Switch into Driver, Operator, or Gate view</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>System-wide security audit trail &amp; tokens</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Network multi-location pricing overrides</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400 pt-2 border-t border-slate-800">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Full Platform Authority &amp; System Settings</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 8. FUTURISTIC FOOTER */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 text-slate-400 text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-black text-sm">
                P
              </div>
              <span className="text-base font-black tracking-tight text-white">PARKWISE</span>
              <span className="text-[10px] text-slate-500 font-mono ml-2">AUTONOMOUS MOBILITY 2026</span>
            </div>

            <div className="flex items-center gap-6">
              <Link href="/driver" className="hover:text-white transition-colors">
                Driver App
              </Link>
              <Link href="/operator" className="hover:text-white transition-colors">
                Operator SaaS
              </Link>
              <Link href="/ecosystem" className="hover:text-white transition-colors">
                Ecosystem Hub
              </Link>
              <Link href="/auth" className="hover:text-white transition-colors">
                Login / Auth
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
            <p>© 2026 Parkwise Technologies Private Limited. All rights reserved. Indian Patent Pending.</p>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-emerald-400">● SECURE RBAC ACTIVE</span>
              <span>•</span>
              <span>NPCI FASTAG NETC INTEGRATED</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
