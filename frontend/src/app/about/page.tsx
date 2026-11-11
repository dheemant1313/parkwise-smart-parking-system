"use client";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  Globe2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useParkwise } from "@/lib/store";

const MILESTONES = [
  {
    year: "2024",
    title: "Architectural Conception & ANPR R&D",
    detail:
      "Trained optical license plate recognition models across 1.2M Indian RTO vehicle frames covering high-glare, monsoon, and commercial basement conditions.",
  },
  {
    year: "2025",
    title: "NPCI FASTag & Razorpay Transactional Core",
    detail:
      "Launched sub-second slot concurrency locking and cryptographic HMAC-SHA256 QR verification across pilot hubs in New Delhi and Gurugram.",
  },
  {
    year: "2026",
    title: "National 5-Metro Smart Grid & 3D Digital Twin",
    detail:
      "Expanded to Connaught Place, Mumbai BKC, Bengaluru Indiranagar, DLF CyberHub, and Hyderabad HITEC City with real-time XGBoost dynamic pricing.",
  },
];

export default function AboutPage() {
  const { lots } = useParkwise();

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 space-y-20">
      {/* Hero */}
      <div className="mx-auto max-w-3xl text-center space-y-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
          <Sparkles className="h-3.5 w-3.5" />
          About Parkwise India
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Re-Engineering Urban Mobility for 1.4 Billion People.
        </h1>
        <p className="text-base leading-relaxed text-slate-600">
          Up to 30% of metropolitan traffic congestion in Indian commercial
          districts is caused by drivers circling for parking. Parkwise
          eliminates blind searching by turning every parking deck into an
          intelligent, predictable, and automated cloud asset.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/driver"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3.5 text-xs font-bold text-white shadow-stripe hover:bg-brand-700"
          >
            <span>Find Parking</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-xs font-bold text-slate-800 hover:border-brand-400"
          >
            <span>Speak With Our Architects</span>
          </Link>
        </div>
      </div>

      {/* Core Pillars */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <motion.div
          whileHover={{ y: -4 }}
          className="rounded-3xl border border-slate-200 bg-white p-7 shadow-apple space-y-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Cpu className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            AI-First Infrastructure
          </h2>
          <p className="text-xs leading-relaxed text-slate-500">
            Our XGBoost + GradientBoosting demand engines process historical
            commercial footfall, weather telemetry, and live bay velocity to
            predict congestion 12 hours ahead.
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="rounded-3xl border border-slate-200 bg-white p-7 shadow-apple space-y-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Zero-Trust Financial Ledger
          </h2>
          <p className="text-xs leading-relaxed text-slate-500">
            Operators lose up to 22% of revenue to manual cash pilferage.
            Parkwise enforces 100% digital UPI/FASTag verification with
            cryptographically signed gate passes.
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="rounded-3xl border border-slate-200 bg-white p-7 shadow-apple space-y-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Globe2 className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Built for Indian Metros
          </h2>
          <p className="text-xs leading-relaxed text-slate-500">
            Native support for Indian RTO registration formats, 18% GST tax
            invoicing, NPCI FASTag lanes, and high-density multi-level basement
            topologies.
          </p>
        </motion.div>
      </div>

      {/* Timeline */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-apple lg:p-12">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
          Platform Evolution
        </span>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-900">
          Engineering Roadmap &amp; Milestones
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {MILESTONES.map((m) => (
            <div
              key={m.year}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 space-y-2"
            >
              <span className="font-mono text-sm font-black text-brand-600">
                {m.year}
              </span>
              <h3 className="text-base font-bold text-slate-900">{m.title}</h3>
              <p className="text-xs leading-relaxed text-slate-500">
                {m.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Live Metropolitan Footprint */}
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
              National Footprint
            </span>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-900">
              Active Smart Parking Clusters Across India
            </h2>
          </div>
          <Link
            href="/driver"
            className="text-xs font-bold text-brand-600 hover:underline"
          >
            View Live Bay Availability →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {lots.map((lot) => (
            <div
              key={lot.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-600">
                  <MapPin className="h-3.5 w-3.5" />
                  {lot.city}
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-400">
                  {lot.code}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 line-clamp-2">
                {lot.name}
              </p>
              <p className="text-[11px] font-semibold text-emerald-600">
                {lot.available_slots}/{lot.total_slots} Bays Open
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
