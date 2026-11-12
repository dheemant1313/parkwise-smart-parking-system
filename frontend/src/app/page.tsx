"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  Bot,
  BrainCircuit,
  Building2,
  CalendarCheck,
  Camera,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Compass,
  Cpu,
  CreditCard,
  Gauge,
  Layers,
  MapPin,
  Navigation,
  QrCode,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { SmartParkingCanvas } from "@/components/three/SmartParkingCanvas";
import { useParkwise } from "@/lib/store";
import { ParkingSlot } from "@/types";

// Dynamic demo statistics with transparent labeling
const DEMO_METRICS = [
  {
    label: "Smart Parking Facilities",
    value: "42+",
    subtext: "Sample Demonstration Network",
    detail: "Multi-level garages & mall decks",
  },
  {
    label: "Available Parking Spaces",
    value: "1,840+",
    subtext: "Real-Time Sensor Connected",
    detail: "Ultrasonic + camera verified",
  },
  {
    label: "Successful Bookings",
    value: "128,000+",
    subtext: "Verified Platform Volume",
    detail: "<140ms barrier response time",
  },
  {
    label: "Cities Covered",
    value: "5 Metros",
    subtext: "National Demonstration Grid",
    detail: "Delhi NCR, Mumbai, BLR, Pune, HYD",
  },
];

// 3 How It Works Steps
const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Discover Parking",
    desc: "Find nearby parking facilities with real-time availability across premium commercial hubs, transit terminals, and retail centres.",
    icon: Compass,
    accent: "blue",
    badge: "Live Availability",
  },
  {
    step: "02",
    title: "Reserve Your Slot",
    desc: "Select your exact parking space, EV hyper-charger tier, and complete a secure booking with zero surprise surge tariffs.",
    icon: CalendarCheck,
    accent: "indigo",
    badge: "Guaranteed Bay",
  },
  {
    step: "03",
    title: "Navigate & Park",
    desc: "Follow precision navigation from the verified facility entrance all the way down to your exact allotted indoor parking slot.",
    icon: Navigation,
    accent: "emerald",
    badge: "Sub-Meter Indoor AR",
  },
];

// Smart Technology Interactive Items
const TECH_FEATURES = [
  {
    id: "ai-recommendations",
    title: "AI-Powered Parking Recommendations",
    short: "AI Allocation",
    icon: BrainCircuit,
    headline: "Machine Intelligence Matching You to the Nearest Available Bay",
    desc: "Our neural routing model evaluates real-time garage dwell times, your vehicle dimensions, and destination elevators to assign optimal slots automatically.",
    stats: "Sub-100ms algorithmic bay allocation",
    highlight: "Context-Aware",
  },
  {
    id: "real-time-slots",
    title: "Real-Time Slot Availability",
    short: "Ultrasonic Vision",
    icon: Radio,
    headline: "Dual-Modal Telemetry with 99.8% Ground Sensor Parity",
    desc: "Overhead ultrasonic sensors paired with edge camera vision detect slot state changes within 300ms, eliminating ghost availability and dead miles.",
    stats: "300ms edge telemetry refresh rate",
    highlight: "Zero Ghost Bays",
  },
  {
    id: "indoor-nav",
    title: "Indoor Parking Navigation",
    short: "Indoor Wayfinding",
    icon: Navigation,
    headline: "Flawless Multi-Floor Guidance Where GPS Fails",
    desc: "Proprietary inertial dead-reckoning and Bluetooth LE beacons guide vehicles across subterranean basement ramps directly to the marked stall.",
    stats: "Accurate within ±0.6 meters indoors",
    highlight: "Subterranean Precision",
  },
  {
    id: "qr-fastag",
    title: "QR-Based Entry & Exit",
    short: "FASTag & QR",
    icon: QrCode,
    headline: "Zero-Stop Boom Barrier Clearance in Under 140ms",
    desc: "Dual verification using encrypted HMAC dynamic QR codes and NPCI FASTag RFID enables instant barrier opening without rolling down windows.",
    stats: "<140ms boom barrier latency",
    highlight: "Contactless Entry",
  },
  {
    id: "smart-pricing",
    title: "Smart Dynamic Pricing",
    short: "Dynamic Pricing",
    icon: TrendingUp,
    headline: "Adaptive Demand Yield Algorithms for Urban Garages",
    desc: "Dynamic elasticity curves rebalance congested urban parking demand during peak hours while unlocking 28% to 40% revenue gains for real-estate operators.",
    stats: "Gradient-boosted price adjustment",
    highlight: "Demand Responsive",
  },
  {
    id: "ev-charging",
    title: "EV Charging Reservations",
    short: "EV Fast Charging",
    icon: BatteryCharging,
    headline: "Guaranteed 50kW & 60kW CCS2 DC HyperChargers",
    desc: "Reserve dual-purpose parking bays equipped with smart DC fast chargers. Automatic cutoff prevents idle hogging fees and optimizes turn rates.",
    stats: "14.8 MWh clean energy delivered",
    highlight: "60kW DC HyperCharge",
  },
  {
    id: "parking-analytics",
    title: "Parking Analytics",
    short: "Predictive Intelligence",
    icon: Gauge,
    headline: "Full-Funnel Spatial Occupancy & Revenue Intelligence",
    desc: "Deep visual dashboards provide heatmaps of peak arrival windows, average dwell durations, overstay compliance, and predictive turnover forecasts.",
    stats: "24/7 audit-grade analytics export",
    highlight: "Enterprise SaaS",
  },
];

// Indoor Navigation Demonstration Data
const INDOOR_FLOORS = [
  {
    floor: "Ground",
    name: "Ground Level (Entry Plaza)",
    ramp: "Ramp 01 Down to Basement B1",
    slots: [
      { id: "G-01", type: "ACCESSIBLE", status: "AVAILABLE" },
      { id: "G-02", type: "STANDARD", status: "OCCUPIED" },
      { id: "G-03", type: "STANDARD", status: "OCCUPIED" },
      { id: "G-04", type: "EV_CHARGING", status: "AVAILABLE" },
    ],
    guidance: "Pass Main Security Barrier -> Veer right for Ramp to B1",
    activeBay: "G-04",
  },
  {
    floor: "B1",
    name: "Basement B1 (Reserved Deck)",
    ramp: "Intermediate Floor — Elevator Core A",
    slots: [
      { id: "B1-01", type: "STANDARD", status: "OCCUPIED" },
      { id: "B1-02", type: "EV_CHARGING", status: "AVAILABLE" },
      { id: "B1-03", type: "SUV_XL", status: "OCCUPIED" },
      { id: "B1-04", type: "STANDARD", status: "OCCUPIED" },
      { id: "B1-09", type: "STANDARD", status: "ASSIGNED" },
      { id: "B1-10", type: "STANDARD", status: "AVAILABLE" },
    ],
    guidance: "Descend Ramp 01 -> Turn Left at Pillar P-04 -> Straight 24m -> Bay B1-09 on Right",
    activeBay: "B1-09",
  },
  {
    floor: "B2",
    name: "Basement B2 (Fleet & Long-Stay)",
    ramp: "Deep Deck — Elevator Core B",
    slots: [
      { id: "B2-01", type: "STANDARD", status: "AVAILABLE" },
      { id: "B2-02", type: "STANDARD", status: "AVAILABLE" },
      { id: "B2-03", type: "SUV_XL", status: "AVAILABLE" },
      { id: "B2-04", type: "EV_CHARGING", status: "OCCUPIED" },
    ],
    guidance: "Continue via Ramp 02 to Basement B2 -> Proceed to Zone C",
    activeBay: "B2-01",
  },
];

export default function HomePage() {
  const { lots } = useParkwise();
  const [selectedTech, setSelectedTech] = useState(TECH_FEATURES[0].id);
  const [activeFloorIndex, setActiveFloorIndex] = useState(1); // Default B1
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);

  const currentFloor = INDOOR_FLOORS[activeFloorIndex];
  const activeTechObj =
    TECH_FEATURES.find((t) => t.id === selectedTech) || TECH_FEATURES[0];

  const demoSlots: ParkingSlot[] = lots[0]?.slots || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24 border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/50 to-slate-100/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Hero Left Copy */}
            <div className="lg:col-span-6 space-y-6">
              {/* Product Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/80 px-3.5 py-1.5 text-xs font-semibold text-blue-700 shadow-xs backdrop-blur-sm">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                <span>Next-Gen Smart Parking &amp; EV Platform</span>
                <ChevronRight className="h-3.5 w-3.5 text-blue-400" />
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-[1.08]">
                Parking, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600">Reimagined.</span>
              </h1>

              {/* Supporting Text */}
              <p className="max-w-xl text-base sm:text-lg leading-relaxed text-slate-600">
                Find, book, and navigate to your perfect parking spot with intelligent
                technology. Every journey starts with a smarter parking experience.
              </p>

              {/* Primary & Secondary Action CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/driver"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <CarFront className="h-4 w-4" />
                  <span>Find Parking</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-xs hover:border-slate-400 hover:bg-slate-50 transition-all"
                >
                  <span>Explore Parkwise</span>
                </a>
              </div>

              {/* Verified Trust Badges */}
              <div className="flex flex-wrap items-center gap-6 pt-4 text-xs font-medium text-slate-500 border-t border-slate-200/70">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>Zero-Stop Barrier Clearance</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>Indoor Turn-by-Turn AR</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>50kW Fast EV Charging</span>
                </div>
              </div>
            </div>

            {/* Hero Right: 3D Parking Garage Environment */}
            <div className="lg:col-span-6 relative">
              <div className="relative mx-auto w-full rounded-3xl border border-slate-200/90 bg-white p-2.5 shadow-xl transition-all">
                {/* Floating Availability Indicators */}
                <div className="absolute top-5 left-5 z-20 flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur-md text-[11px] font-semibold text-slate-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Bay B1-09 Available &bull; ₹80/hr</span>
                </div>

                <div className="absolute top-5 right-5 z-20 hidden sm:flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/95 px-3 py-1.5 shadow-sm backdrop-blur-md text-[11px] font-semibold text-blue-700">
                  <Zap className="h-3.5 w-3.5 text-blue-600" />
                  <span>60kW DC HyperCharger Ready</span>
                </div>

                {/* 3D WebGL Canvas with Graceful Mobile Fallback */}
                <div className="h-[380px] sm:h-[420px] w-full overflow-hidden rounded-2xl bg-slate-950">
                  <SmartParkingCanvas
                    slots={demoSlots}
                    selectedSlotId={selectedSlotId}
                    onSelectSlot={(slot) => setSelectedSlotId(slot.id)}
                    activeFloor={1}
                  />
                </div>

                {/* Bottom Canvas Control Strip */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-[11px] text-slate-500 bg-slate-50 rounded-xl">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    Interactive 3D Garage Twin &bull; Drag to orbit, tap bays to inspect
                  </span>
                  <Link
                    href="/driver"
                    className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <span>Reserve in App</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TRUST AND STATISTICS SECTION */}
      <section className="py-12 bg-white border-b border-slate-200/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Live Demonstration Network Telemetry
              </h2>
              <p className="text-sm font-semibold text-slate-700">
                Operating across verified Indian metropolitan smart corridors
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Sample Platform Demonstration Data</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {DEMO_METRICS.map((item) => (
              <div
                key={item.label}
                className="group relative rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 transition-all hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-xs"
              >
                <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors">
                  {item.value}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-800">
                  {item.label}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {item.subtext}
                </div>
                <div className="mt-2 text-[10px] font-medium text-blue-600 border-t border-slate-200/60 pt-2">
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-20 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 border border-blue-200/60">
              Seamless 3-Step Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              How Parkwise Works
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              From discovering empty spaces to effortless indoor navigation and
              autonomous barrier clearance.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-md"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="font-mono text-xs font-extrabold text-slate-400 group-hover:text-blue-600">
                        STEP {step.step}
                      </span>
                    </div>

                    <div className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {step.badge}
                    </div>

                    <h3 className="text-xl font-bold tracking-tight text-slate-900">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm leading-relaxed text-slate-500">
                      {step.desc}
                    </p>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
                    <span>Learn step details</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. SMART TECHNOLOGY SECTION */}
      <section id="technology" className="py-20 bg-white border-y border-slate-200/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 border border-blue-200/60">
              Intelligent Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Smart Technology Built for Indian Transit
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Combining edge computer vision, subterranean IoT positioning, and
              automated billing protocols.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Tech Feature Navigation Tabs */}
            <div className="lg:col-span-5 space-y-2">
              {TECH_FEATURES.map((tech) => {
                const Icon = tech.icon;
                const isSelected = selectedTech === tech.id;
                return (
                  <button
                    key={tech.id}
                    type="button"
                    onClick={() => setSelectedTech(tech.id)}
                    className={`w-full text-left flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/60 text-blue-900 shadow-xs"
                        : "border-slate-200/70 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900">
                          {tech.title}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {tech.highlight}
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${
                        isSelected ? "text-blue-600 translate-x-1" : "text-slate-300"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Selected Tech Detail Showcase Box */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-8 sm:p-10 text-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-5">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-400/30">
                    <Cpu className="h-3.5 w-3.5" />
                    <span>{activeTechObj.highlight}</span>
                  </div>
                  <span className="font-mono text-xs text-slate-400">
                    TELEMETRY: LIVE
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug">
                    {activeTechObj.headline}
                  </h3>
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-300">
                    {activeTechObj.desc}
                  </p>
                </div>

                {/* Tech Metrics Highlight */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-6">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <div className="text-[11px] font-medium text-slate-400">
                      Performance Benchmark
                    </div>
                    <div className="mt-1 font-mono text-sm sm:text-base font-bold text-emerald-400">
                      {activeTechObj.stats}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <div className="text-[11px] font-medium text-slate-400">
                      System Reliability
                    </div>
                    <div className="mt-1 font-mono text-sm sm:text-base font-bold text-blue-400">
                      99.98% High-Availability SLA
                    </div>
                  </div>
                </div>

                {/* Action CTA */}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
                  <span className="text-xs text-slate-400">
                    Explore full technical documentation and API schemas
                  </span>
                  <Link
                    href="/features"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-900 px-4 py-2 text-xs font-bold hover:bg-slate-100 transition-colors"
                  >
                    <span>View Architecture Specs</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. INDOOR NAVIGATION SHOWCASE (CORE DIFFERENTIATOR) */}
      <section id="features" className="py-20 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 border border-blue-200/60">
              Core Differentiator
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Indoor Navigation. From Verified Entrance to Exact Allotted Slot.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Never circle a subterranean basement garage again. Parkwise provides
              continuous multi-floor turn-by-turn guidance past ramps and pillars.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
            {/* Multi-Floor Switcher Pills */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select Garage Deck:
                </span>
                <div className="inline-flex rounded-full bg-slate-100 p-1">
                  {INDOOR_FLOORS.map((fl, idx) => (
                    <button
                      key={fl.floor}
                      type="button"
                      onClick={() => setActiveFloorIndex(idx)}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                        activeFloorIndex === idx
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {fl.floor}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Indoor Beacons &amp; Dead-Reckoning Connected</span>
              </div>
            </div>

            {/* Interactive Floor Demonstration View */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Turn-by-Turn Instruction Card */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      Active Navigation Session
                    </span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      {currentFloor.name}
                    </span>
                  </div>

                  <div className="flex items-start gap-3 pt-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                      <Navigation className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Turn-By-Turn Instruction
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">
                        {currentFloor.guidance}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
                    <span>Est. Distance to Bay: <strong>38 meters</strong></span>
                    <span>Walking to Lift: <strong>45 sec</strong></span>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 text-xs text-blue-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-blue-800">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    <span>Driver Guarantee</span>
                  </div>
                  <p className="text-slate-600">
                    Your assigned bay <strong>{currentFloor.activeBay}</strong> is locked
                    and held for your registered vehicle plate. Boom barrier automatically
                    validates entry upon arrival.
                  </p>
                </div>
              </div>

              {/* Floor Plan Schematic Representation */}
              <div className="lg:col-span-7">
                <div className="relative rounded-2xl border border-slate-300 bg-slate-900 p-6 text-white shadow-inner">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-3 mb-4">
                    <span>{currentFloor.ramp}</span>
                    <span className="text-blue-400">BLUE TRAIL = ROUTE TO BAY</span>
                  </div>

                  {/* Schematic Garage Bays Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {currentFloor.slots.map((slot) => {
                      const isAssigned = slot.status === "ASSIGNED" || slot.id === currentFloor.activeBay;
                      const isEV = slot.type === "EV_CHARGING";
                      return (
                        <div
                          key={slot.id}
                          className={`relative flex flex-col items-center justify-center rounded-xl p-3 border transition-all ${
                            isAssigned
                              ? "border-blue-400 bg-blue-600/30 text-white shadow-lg ring-2 ring-blue-400"
                              : slot.status === "AVAILABLE"
                              ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                              : "border-slate-800 bg-slate-950 text-slate-500"
                          }`}
                        >
                          {isAssigned && (
                            <span className="absolute -top-2 rounded-full bg-blue-500 px-1.5 py-0.2 text-[8px] font-extrabold uppercase text-white shadow">
                              Allotted
                            </span>
                          )}
                          <span className="font-mono text-xs font-bold">
                            {slot.id}
                          </span>
                          <span className="text-[9px] mt-0.5">
                            {isEV ? "EV 50kW" : slot.type}
                          </span>
                          <span className="mt-1 text-[8px] font-bold uppercase">
                            {isAssigned ? "Your Bay" : slot.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Route Pathway Indicator */}
                  <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-800/80 px-4 py-2.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
                      <span>Verified Entrance Gate A &bull; Boom Barrier Clear</span>
                    </div>
                    <Link
                      href="/driver"
                      className="font-bold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                    >
                      <span>Try Interactive Driver App</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FOR BUSINESSES SECTION */}
      <section id="for-businesses" className="py-20 bg-white border-b border-slate-200/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Copy Left */}
            <div className="lg:col-span-5 space-y-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 border border-blue-200/60">
                Enterprise Operator SaaS
              </span>

              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                The Operating System for Modern Parking Real-Estate
              </h2>

              <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                Transform passive concrete parking decks into high-yield,
                automated mobility hubs. Parkwise delivers complete facility
                orchestration across cameras, barriers, and dynamic tariffs.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  "Live multi-floor occupancy dashboards with sub-second sync",
                  "Automated revenue collection with NPCI FASTag integration",
                  "AI demand forecasting with dynamic surge yield management",
                  "High-speed ANPR camera surveillance and gate terminal logs",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm text-slate-700">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Link
                  href="/operator"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-all"
                >
                  <Building2 className="h-4 w-4" />
                  <span>Explore Business Solutions</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Visual Right: Operator SaaS Preview Grid */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-200/90 bg-slate-50 p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                    <div className="h-3 w-3 rounded-full bg-emerald-400" />
                    <span className="ml-2 text-xs font-bold text-slate-700">
                      Jio World Drive BKC &bull; Operator Command Desk
                    </span>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    Surge 1.35x Active
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-medium text-slate-500">
                      Live Occupancy
                    </div>
                    <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                      87.4%
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                      +12% vs last week
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-medium text-slate-500">
                      Today&apos;s Revenue
                    </div>
                    <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                      ₹1,42,850
                    </div>
                    <div className="text-[10px] font-semibold text-blue-600 mt-0.5">
                      FASTag &amp; UPI Auto-Settled
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 col-span-2 sm:col-span-1">
                    <div className="text-[11px] font-medium text-slate-500">
                      Barrier Latency
                    </div>
                    <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                      112ms
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                      Zero Entry Queues
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Camera className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">
                        ANPR OCR &amp; CCTV Parity
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        99.4% Indian HSRP plate recognition accuracy
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/operator"
                    className="font-bold text-blue-600 hover:text-blue-700"
                  >
                    Open Console
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FINAL CTA */}
      <section className="py-20 bg-gradient-to-b from-white to-slate-100/60">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8 space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 border border-blue-200/60">
            Start Today
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Make Every Parking Experience Smarter.
          </h2>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed">
            Join thousands of urban drivers and India&apos;s leading commercial
            facilities already experiencing zero-stop, intelligent parking.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-4">
            <Link
              href="/auth?tab=signup"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 hover:shadow-md transition-all active:scale-[0.98]"
            >
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/business"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 shadow-xs hover:border-slate-400 hover:bg-slate-50 transition-all"
            >
              <Building2 className="h-4 w-4 text-slate-500" />
              <span>Partner With Parkwise</span>
            </Link>
          </div>

          <div className="pt-8 text-[11px] font-medium text-slate-400">
            Instant Setup &bull; CMVR Compliant &bull; 99.4% ANPR Accuracy &bull; 24/7 Enterprise SLA
          </div>
        </div>
      </section>
    </div>
  );
}
