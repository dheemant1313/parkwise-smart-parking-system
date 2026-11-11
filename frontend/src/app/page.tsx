"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "motion/react";
import {
  ArrowRight,
  BatteryCharging,
  Building2,
  CarFront,
  CheckCircle2,
  Cpu,
  Globe2,
  Layers,
  Lock,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { formatINR } from "@/lib/utils";
import { Canvas3DSkeleton } from "@/components/ui/Skeleton";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const SmartParkingCanvas = dynamic(
  () =>
    import("@/components/three/SmartParkingCanvas").then(
      (m) => m.SmartParkingCanvas
    ),
  {
    ssr: false,
    loading: () => <Canvas3DSkeleton heightClass="h-[440px]" />,
  }
);

const TRUST_PARTNERS = [
  "DLF CyberCity Hub",
  "Jio World Drive BKC",
  "NDMC Smart City Grid",
  "Raheja Mindspace REIT",
  "Prestige Tech Park",
  "NPCI FASTag NETC",
];

const FEATURE_CARDS = [
  {
    badge: "Concurrency Lock",
    title: "Zero Double-Booking Engine",
    description:
      "Distributed Redis & SQL transactional locks verify time-window overlap in sub-5ms, rejecting conflicting reservations with HTTP 409.",
    href: "/features",
    icon: Lock,
  },
  {
    badge: "Edge Vision + RFID",
    title: "Optical ANPR & FASTag Lanes",
    description:
      "98.8% accuracy Indian RTO license plate recognition paired with NPCI FASTag auto-debit and sub-second boom-barrier actuation.",
    href: "/gate",
    icon: QrCode,
  },
  {
    badge: "Machine Learning",
    title: "XGBoost Dynamic Surge Pricing",
    description:
      "12-hour rolling demand forecasting calibrates bay tariffs automatically during commercial rush hours to maximize operator RevPAB.",
    href: "/operator",
    icon: Cpu,
  },
  {
    badge: "Spatial WebGL",
    title: "3D Digital Twin Navigation",
    description:
      "Interactive Three.js multi-floor garage visualization lets drivers inspect exact bay geometry, EV charger output, and aisle width.",
    href: "/driver",
    icon: Layers,
  },
  {
    badge: "Zero-Trust Security",
    title: "HMAC-SHA256 Signed QR Passes",
    description:
      "Every reservation pass is cryptographically signed on the backend. Forged or replayed QR payloads immediately lock the gate barrier.",
    href: "/gate",
    icon: ShieldCheck,
  },
  {
    badge: "Enterprise Cloud",
    title: "Multi-City Command & RBAC",
    description:
      "Granular role-based access control across Drivers, Operators, Gate Staff, and Platform Admins with immutable security audit logs.",
    href: "/admin",
    icon: Globe2,
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Discover & Select Your Exact 3D Bay",
    summary:
      "Choose your destination hub across Delhi NCR, Mumbai, Bengaluru, Gurugram, or Hyderabad and pick a Standard, SUV XL, Accessible, or 50kW EV bay.",
    metric: "16 IoT Ultrasonic Bays / Deck",
    ctaHref: "/driver",
    ctaLabel: "Try Bay Selection",
  },
  {
    step: "02",
    title: "Instant Transactional Lock & UPI / FASTag Checkout",
    summary:
      "Parkwise locks your bay atomically in PostgreSQL/Redis, calculates transparent 18% GST + dynamic surge, and verifies payment via Razorpay HMAC.",
    metric: "< 120ms Lock Acquisition",
    ctaHref: "/pricing",
    ctaLabel: "View Tariff Model",
  },
  {
    step: "03",
    title: "Zero-Stop Optical ANPR or QR Gate Entry",
    summary:
      "Approach the boom barrier. Either the edge ANPR camera reads your RTO license plate or you scan your HMAC-signed QR pass for instant barrier lift.",
    metric: "98.8% Optical Plate Match",
    ctaHref: "/gate",
    ctaLabel: "Test Gate Scanner",
  },
  {
    step: "04",
    title: "Automated Exit, EV Billing & Live Operator Analytics",
    summary:
      "Drive out seamlessly. Overstay adjustments (if any) settle automatically via FASTag while operator dashboards update occupancy and revenue in real time.",
    metric: "+34% Operator Revenue Uplift",
    ctaHref: "/operator",
    ctaLabel: "Explore Operator SaaS",
  },
];

export default function MarketingHomePage() {
  const { lots, bookings, getAIForecast } = useParkwise();
  const [selectedHeroLotId, setSelectedHeroLotId] = useState<number>(1);
  const [heroFloor, setHeroFloor] = useState<number>(1);
  const [selectedHeroSlotId, setSelectedHeroSlotId] = useState<number | null>(
    null
  );
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);

  // Business ROI interactive state
  const [roiBays, setRoiBays] = useState<number>(180);
  const [roiBaseRate, setRoiBaseRate] = useState<number>(80);

  const heroSectionRef = useRef<HTMLDivElement>(null);
  const revealContainerRef = useRef<HTMLDivElement>(null);

  const activeLot =
    lots.find((l) => l.id === selectedHeroLotId) || lots[0];
  const aiForecast = getAIForecast(activeLot.id);

  const totalBaysAcrossIndia = lots.reduce((acc, l) => acc + l.total_slots, 0);
  const totalAvailableAcrossIndia = lots.reduce(
    (acc, l) => acc + l.available_slots,
    0
  );
  const totalEvAvailable = lots.reduce(
    (acc, l) => acc + l.ev_slots_available,
    0
  );

  const baselineMonthlyInr = roiBays * roiBaseRate * 6.5 * 30;
  const parkwiseMonthlyInr = Math.round(baselineMonthlyInr * 1.34);
  const incrementalAnnualInr = (parkwiseMonthlyInr - baselineMonthlyInr) * 12;

  // GSAP Hero Entrance + ScrollTrigger Section Reveals
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".gsap-hero-item",
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          stagger: 0.1,
          ease: "power3.out",
          clearProps: "all",
        }
      );

      const sections = gsap.utils.toArray<HTMLElement>(".gsap-reveal-section");
      sections.forEach((sec) => {
        gsap.fromTo(
          sec,
          { y: 32, opacity: 0.01 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            ease: "power2.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: sec,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    }, revealContainerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={revealContainerRef} className="space-y-28 pb-28">
      {/* =====================================================================
          SECTION 2: CINEMATIC HERO SECTION
      ===================================================================== */}
      <section
        ref={heroSectionRef}
        className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/70 to-white pt-10 pb-20 lg:pt-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Hero Copy & CTAs */}
            <div className="space-y-6 lg:col-span-6">
              <div className="gsap-hero-item inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/90 px-3.5 py-1.5 text-xs font-bold text-brand-700 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                <span>AI Smart Parking Ecosystem for Modern India</span>
              </div>

              <h1 className="gsap-hero-item text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[58px] lg:leading-[1.05]">
                Parking, without the{" "}
                <span className="bg-gradient-to-r from-brand-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  parking around.
                </span>
              </h1>

              <p className="gsap-hero-item max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Reserve verified bays in seconds, glide through optical ANPR
                and NPCI FASTag gates without stopping, and power commercial
                parking decks with real-time XGBoost demand intelligence.
              </p>

              {/* Required Primary & Secondary CTAs */}
              <div className="gsap-hero-item flex flex-wrap items-center gap-3.5 pt-2">
                <Link
                  href="/driver"
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-4 text-sm font-bold text-white shadow-stripe transition-all hover:bg-brand-700 hover:-translate-y-0.5"
                >
                  <span>Find Parking</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/business"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-sm font-bold text-slate-800 shadow-sm transition-all hover:border-brand-500 hover:text-brand-600"
                >
                  <Building2 className="h-4 w-4 text-brand-600" />
                  <span>Explore for Business</span>
                </Link>
              </div>

              {/* Quick Live Telemetry Pills */}
              <div className="gsap-hero-item grid grid-cols-3 gap-4 border-t border-slate-200/80 pt-6">
                <div>
                  <p className="text-2xl font-extrabold text-slate-900">
                    {totalAvailableAcrossIndia}/{totalBaysAcrossIndia}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    Live Bays Open Across 5 Metros
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-brand-600">
                    &lt; 1.2s
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    ANPR + HMAC Gate Actuation
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-emerald-600">
                    {totalEvAvailable} EV Bays
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    50kW DC Chargers Ready
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive 3D Parking Garage Scene */}
            <div className="gsap-hero-item space-y-3.5 lg:col-span-6">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-600" />
                  <span className="text-xs font-bold text-slate-800">
                    {activeLot.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Select 3D Preview Facility"
                    value={selectedHeroLotId}
                    onChange={(e) => {
                      setSelectedHeroLotId(Number(e.target.value));
                      setSelectedHeroSlotId(null);
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    {lots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.city} — {lot.code}
                      </option>
                    ))}
                  </select>
                  <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    {[1, 2].map((fl) => (
                      <button
                        key={fl}
                        type="button"
                        onClick={() => setHeroFloor(fl)}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition-colors ${
                          heroFloor === fl
                            ? "bg-brand-600 text-white"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        F{fl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <SmartParkingCanvas
                slots={activeLot.slots}
                activeFloor={heroFloor}
                selectedSlotId={selectedHeroSlotId}
                onSelectSlot={(slot) => setSelectedHeroSlotId(slot.id)}
                heightClass="h-[430px]"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">
                    Live Tariff:{" "}
                    <span className="text-brand-600">
                      ₹{activeLot.base_hourly_rate_inr}/hr
                    </span>{" "}
                    ({activeLot.current_surge_multiplier.toFixed(2)}x AI Surge)
                  </span>
                </div>
                <Link
                  href="/driver"
                  className="inline-flex items-center gap-1 font-bold text-brand-600 hover:underline"
                >
                  <span>Book Selected Bay in Driver App</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: TRUST INDICATORS
      ===================================================================== */}
      <section className="gsap-reveal-section mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200/90 bg-white px-6 py-8 shadow-apple">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-400">
            Engineered for India&apos;s Premier Commercial Real Estate &amp;
            Mobility Grids
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {TRUST_PARTNERS.map((partner) => (
              <div
                key={partner}
                className="flex items-center justify-center rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3.5 text-center text-xs font-extrabold tracking-tight text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50/40 hover:text-brand-700"
              >
                {partner}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 4: PRODUCT INTRODUCTION
      ===================================================================== */}
      <section className="gsap-reveal-section mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
            The Parkwise Operating System
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            One Transactional Cloud Connecting Every Car, Bay, and Barrier.
          </h2>
          <p className="text-base leading-relaxed text-slate-600">
            Legacy parking relies on paper slips, blind aisle circling, and
            disconnected cash booths. Parkwise replaces fragmented hardware with
            a unified spatial platform that synchronizes driver reservations,
            operator revenue analytics, and edge boom-barrier verification in
            milliseconds.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
            <span className="font-mono text-xs font-bold text-brand-600">
              01 / SPATIAL DISCOVERY
            </span>
            <h3 className="mt-2 text-lg font-bold text-slate-900">
              Guaranteed Bay Before You Arrive
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Drivers view live 2D/3D bay occupancy across multi-level decks and
              lock their exact spot prior to entering congested commercial zones.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
            <span className="font-mono text-xs font-bold text-brand-600">
              02 / ZERO-TRUST CRYPTOGRAPHY
            </span>
            <h3 className="mt-2 text-lg font-bold text-slate-900">
              Server-Verified Payments &amp; QR Passes
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Every booking is protected by atomic SQL transactions, Razorpay
              order verification, and tamper-proof HMAC-SHA256 gate signatures.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
            <span className="font-mono text-xs font-bold text-brand-600">
              03 / PREDICTIVE YIELD
            </span>
            <h3 className="mt-2 text-lg font-bold text-slate-900">
              AI-Driven Operator Monetization
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Machine learning models forecast hourly congestion across Indian
              metros and dynamically adjust tariffs to eliminate revenue leakage.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 5: FEATURE CARDS (BENTO GRID)
      ===================================================================== */}
      <section className="gsap-reveal-section mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Enterprise Capabilities
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Engineered Like Financial Infrastructure.
            </h2>
          </div>
          <Link
            href="/features"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:underline"
          >
            <span>Explore Full Technical Specification</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-apple transition-all hover:border-brand-500 hover:shadow-stripe"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {card.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-500">
                    {card.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <Link
                    href={card.href}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600"
                  >
                    <span>Launch Module</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          SECTION 6: HOW IT WORKS (INTERACTIVE STEPPER)
      ===================================================================== */}
      <section className="gsap-reveal-section mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-apple lg:p-12">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-end">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
                End-to-End Lifecycle
              </span>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
                How Parkwise Works in Four Steps
              </h2>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-400">
              Click any phase to inspect workflow
            </span>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-5">
              {HOW_IT_WORKS_STEPS.map((item, idx) => {
                const isSelected = idx === activeStepIdx;
                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => setActiveStepIdx(idx)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-brand-600 bg-brand-50/50 shadow-sm"
                        : "border-slate-200 bg-slate-50/60 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-extrabold text-brand-600">
                        STEP {item.step}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                        {item.metric}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-slate-900">
                      {item.title}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col justify-between rounded-3xl border border-brand-200 bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900 p-8 text-white lg:col-span-7">
              <div className="space-y-4">
                <span className="inline-block rounded-full bg-brand-500/20 px-3 py-1 font-mono text-xs font-bold text-brand-300 border border-brand-400/30">
                  PHASE {HOW_IT_WORKS_STEPS[activeStepIdx].step} TELEMETRY
                </span>
                <h3 className="text-2xl font-extrabold">
                  {HOW_IT_WORKS_STEPS[activeStepIdx].title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  {HOW_IT_WORKS_STEPS[activeStepIdx].summary}
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-6">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400">
                    SLA Benchmark
                  </span>
                  <p className="font-mono text-lg font-extrabold text-emerald-400">
                    {HOW_IT_WORKS_STEPS[activeStepIdx].metric}
                  </p>
                </div>
                <Link
                  href={HOW_IT_WORKS_STEPS[activeStepIdx].ctaHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-xs font-bold text-white shadow-stripe hover:bg-brand-500"
                >
                  <span>{HOW_IT_WORKS_STEPS[activeStepIdx].ctaLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 7 & 8: DRIVER EXPERIENCE & OPERATOR EXPERIENCE
      ===================================================================== */}
      <section className="gsap-reveal-section mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Section 7: Driver Experience */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-8 shadow-apple">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-brand-600">
                <CarFront className="h-4 w-4" />
                <span>Driver Experience (B2C App)</span>
              </div>
              <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Arrive, Glide Through the Barrier, and Park in Seconds.
              </h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Designed with Apple-level clarity. Drivers filter bays by floor,
                SUV clearance, or 50kW EV charging, verify their Indian RTO
                registration plate, pay via UPI or FASTag, and receive an
                instant cryptographic QR Gate Pass.
              </p>
              <ul className="space-y-2.5 pt-2 text-xs font-medium text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Interactive 2D Bay Matrix &amp; 3D Spatial Deck View</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Transparent Base + Surge + 18% GST Fare Breakdown</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Instant HMAC-Signed Pass for Zero-Wait Entry</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-500">
                Active Reservations: {bookings.length}
              </span>
              <Link
                href="/driver"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-700"
              >
                <span>Launch Driver Booking App</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Section 8: Operator Experience */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-8 shadow-apple">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-brand-600">
                <Building2 className="h-4 w-4" />
                <span>Operator Experience (B2B SaaS)</span>
              </div>
              <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Stripe-Grade Telemetry for Commercial Parking Operators.
              </h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Monitor live bay occupancy across every floor, override bay
                maintenance states with one click, inspect Recharts revenue
                curves, and apply AI-recommended surge multipliers in real time.
              </p>
              <ul className="space-y-2.5 pt-2 text-xs font-medium text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>12-Hour Rolling Occupancy &amp; Revenue Charts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Real-Time IoT Ultrasonic Sensor Health Monitoring</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>One-Click Dynamic Surge Tariff Calibration</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-500">
                5 Metro Hubs Connected
              </span>
              <Link
                href="/operator"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                <span>Open Operator Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 9: AI INTELLIGENCE
      ===================================================================== */}
      <section className="gsap-reveal-section mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50/70 via-white to-blue-50/60 p-8 shadow-apple lg:p-12">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
                <Cpu className="h-3.5 w-3.5" />
                AI Systems Engineering
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Predictive Demand Forecasting &amp; Optical Computer Vision.
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                {aiForecast.insight_summary}
              </p>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="text-[11px] font-bold uppercase text-slate-400">
                    Model Architecture
                  </span>
                  <p className="mt-1 text-sm font-extrabold text-slate-900">
                    XGBoost + GBR v2.4
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="text-[11px] font-bold uppercase text-slate-400">
                    ANPR Optical Confidence
                  </span>
                  <p className="mt-1 text-sm font-extrabold text-emerald-600">
                    {(aiForecast.anpr_readiness_score * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  Next 6 Hours AI Demand Forecast ({activeLot.city})
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  LIVE INFERENCE
                </span>
              </div>
              <div className="space-y-2.5">
                {aiForecast.hourly_forecast.slice(0, 6).map((pt) => (
                  <div key={pt.hour_label} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="font-mono text-slate-700">
                        {pt.hour_label}
                      </span>
                      <span className="text-slate-900">
                        {pt.predicted_occupancy_pct}% Occupancy •{" "}
                        <strong className="text-brand-600">
                          {pt.recommended_multiplier.toFixed(2)}x Surge
                        </strong>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-600 transition-all"
                        style={{ width: `${pt.predicted_occupancy_pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 10: EV PARKING & SUPERCHARGING INFRASTRUCTURE
      ===================================================================== */}
      <section className="gsap-reveal-section mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/50 p-8 shadow-apple lg:p-12">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                <BatteryCharging className="h-3.5 w-3.5" />
                Dedicated EV Fast-Charging Ecosystem
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Reserve 50kW DC Fast-Charge Bays Before You Plug In.
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Eliminate charger queuing and IC-engine bay blocking. Parkwise
                integrates ultrasonic bay presence sensors with CCS2 DC
                fast-chargers so EV drivers reserve guaranteed charging slots
                with unified parking + kWh tariff settlement.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/driver"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  <Zap className="h-4 w-4" />
                  <span>Book an EV Charging Bay</span>
                </Link>
                <Link
                  href="/features"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700 hover:border-emerald-400"
                >
                  <span>Inspect EV Load Telemetry</span>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:col-span-5">
              <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Charger Output
                </span>
                <p className="mt-1 text-2xl font-extrabold text-emerald-600">
                  50kW CCS2
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  20% to 80% in ~35 mins
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Active EV Bays Free
                </span>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">
                  {totalEvAvailable} Bays
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Anti-ICE blocking enforced
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 11: BUSINESS PARTNERSHIPS & ROI CALCULATOR
      ===================================================================== */}
      <section className="gsap-reveal-section mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-apple lg:p-12">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-5">
              <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
                B2B Enterprise Partnerships
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Transform Parking Real Estate into a High-Margin Digital Asset.
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Whether you operate a Tier-1 shopping mall, an IT SEZ campus, an
                airport terminal, or a municipal smart-city corridor, Parkwise
                deploys in under 14 days with full NPCI FASTag and ANPR
                integration.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/business"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-xs font-bold text-white shadow-stripe hover:bg-brand-700"
                >
                  <span>Explore Business Solutions</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-700 hover:bg-white"
                >
                  <span>Partner With Parkwise</span>
                </Link>
              </div>
            </div>

            {/* Interactive Operator Yield Simulator */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 lg:col-span-7">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                    Live RevPAB Simulator
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    Commercial Operator Yield Calculator (INR)
                  </h3>
                </div>
                <TrendingUp className="h-6 w-6 text-brand-600" />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <label htmlFor="roi-bays">Total Parking Bays</label>
                    <span className="font-mono font-bold text-brand-600">
                      {roiBays} Bays
                    </span>
                  </div>
                  <input
                    id="roi-bays"
                    type="range"
                    min={40}
                    max={600}
                    step={10}
                    value={roiBays}
                    onChange={(e) => setRoiBays(Number(e.target.value))}
                    className="mt-2 w-full accent-brand-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <label htmlFor="roi-rate">Base Hourly Tariff (₹)</label>
                    <span className="font-mono font-bold text-brand-600">
                      ₹{roiBaseRate}/hr
                    </span>
                  </div>
                  <input
                    id="roi-rate"
                    type="range"
                    min={40}
                    max={200}
                    step={10}
                    value={roiBaseRate}
                    onChange={(e) => setRoiBaseRate(Number(e.target.value))}
                    className="mt-2 w-full accent-brand-600 cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-medium text-slate-500">
                    Legacy Static Yield / Mo
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-700">
                    {formatINR(baselineMonthlyInr)}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4">
                  <p className="text-[11px] font-semibold text-brand-700">
                    Parkwise AI Yield / Mo (+34%)
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-brand-600">
                    {formatINR(parkwiseMonthlyInr)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
                  <p className="text-[11px] font-semibold text-emerald-800">
                    Annual Net Uplift
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-emerald-700">
                    +{formatINR(incrementalAnnualInr)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 12: CLOSING CTA SECTION
      ===================================================================== */}
      <section className="gsap-reveal-section mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-slate-900 px-6 py-14 text-center text-white shadow-stripe sm:px-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/20 px-3.5 py-1 text-xs font-bold text-brand-300 border border-brand-400/30">
            <Sparkles className="h-3.5 w-3.5" />
            Ready for Immediate Deployment
          </span>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Experience the Future of Smart Parking Today.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
            Reserve a live bay in under 30 seconds or onboard your commercial
            parking facility onto India&apos;s premier AI mobility network.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/driver"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3.5 text-sm font-bold text-white shadow-stripe hover:bg-brand-500 transition-all"
            >
              <span>Find Parking</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/business"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-6 py-3.5 text-sm font-bold text-white hover:bg-slate-700 transition-all"
            >
              <span>Explore for Business</span>
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-5 py-3.5 text-xs font-bold text-slate-300 hover:text-white transition-all"
            >
              <span>Contact Enterprise Sales</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
