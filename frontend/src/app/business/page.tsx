"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  Layers,
  QrCode,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

const SECTORS = [
  {
    title: "Tier-1 Shopping Malls & Retail",
    subtitle: "Jio World Drive, Select CITYWALK, Phoenix Marketcity",
    description:
      "Eliminate weekend entry ramp queues with pre-booked VIP bays, optical ANPR entry, and dynamic weekend surge pricing.",
    uplift: "+38% Weekend RevPAB",
  },
  {
    title: "IT SEZ Parks & Corporate Campuses",
    subtitle: "DLF CyberCity, Mindspace HITEC City, Manyata Tech Park",
    description:
      "Automate corporate tenant fleet passes, visitor QR invitations, and 50kW EV charging bay rotation across multi-basement towers.",
    uplift: "100% Automated Gate Flow",
  },
  {
    title: "Municipal Smart Cities & Transit",
    subtitle: "NDMC Connaught Place, Metro Park-and-Ride Hubs",
    description:
      "Digitize public street and multi-level parking with zero cash leakage, unified NPCI FASTag settlement, and live citizen bay maps.",
    uplift: "Zero Cash Leakage",
  },
  {
    title: "Airports & High-Velocity Terminals",
    subtitle: "IGI Terminal 3, CSMIA Mumbai, KIA Bengaluru",
    description:
      "Sub-second boom-barrier actuation with encrypted HMAC QR verification and automated overstay billing.",
    uplift: "< 1.2s Lane Throughput",
  },
];

export default function BusinessSolutionsPage() {
  const [bays, setBays] = useState<number>(250);
  const [rate, setRate] = useState<number>(90);

  const legacyMonthly = bays * rate * 6.5 * 30;
  const parkwiseMonthly = Math.round(legacyMonthly * 1.34);
  const annualGain = (parkwiseMonthly - legacyMonthly) * 12;

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 space-y-20">
      {/* Hero */}
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
            <Building2 className="h-3.5 w-3.5" />
            Parkwise for Enterprise &amp; Real Estate
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Turn Commercial Parking Into an Autonomous Revenue Engine.
          </h1>
          <p className="text-base leading-relaxed text-slate-600">
            Deploy India&apos;s most advanced AI parking operating system across
            your commercial real-estate portfolio. Connect existing boom
            barriers, ANPR cameras, and NPCI FASTag readers to our cloud in
            under 14 days.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/operator"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3.5 text-xs font-bold text-white shadow-stripe hover:bg-brand-700"
            >
              <span>Launch Live Operator Console</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-xs font-bold text-slate-800 hover:border-brand-400"
            >
              <span>Request Enterprise Deployment Proposal</span>
            </Link>
          </div>
        </div>

        {/* Interactive Enterprise ROI Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-apple lg:col-span-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                Portfolio Yield Model
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Enterprise RevPAB Simulator
              </h2>
            </div>
            <TrendingUp className="h-5 w-5 text-brand-600" />
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <label htmlFor="biz-bays">Portfolio Parking Bays</label>
                <span className="font-mono text-brand-600">{bays} Bays</span>
              </div>
              <input
                id="biz-bays"
                type="range"
                min={50}
                max={1000}
                step={25}
                value={bays}
                onChange={(e) => setBays(Number(e.target.value))}
                className="mt-2 w-full accent-brand-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <label htmlFor="biz-rate">Average Hourly Tariff (₹)</label>
                <span className="font-mono text-brand-600">₹{rate}/hr</span>
              </div>
              <input
                id="biz-rate"
                type="range"
                min={40}
                max={250}
                step={10}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="mt-2 w-full accent-brand-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Projected Monthly AI Revenue</span>
              <span className="font-bold text-slate-900">
                {formatINR(parkwiseMonthly)}
              </span>
            </div>
            <div className="flex justify-between border-t border-brand-200/70 pt-2 text-sm font-extrabold text-brand-700">
              <span>Net Annual Portfolio Uplift</span>
              <span>+{formatINR(annualGain)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Industry Sectors */}
      <div className="space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Industry Verticals
          </span>
          <h2 className="mt-1 text-3xl font-extrabold text-slate-900">
            Tailored for High-Density Indian Infrastructure
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {SECTORS.map((s) => (
            <div
              key={s.title}
              className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 shadow-apple space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-brand-600">
                    {s.subtitle}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    {s.uplift}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">{s.title}</h3>
                <p className="text-xs leading-relaxed text-slate-500">
                  {s.description}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:underline"
                >
                  <span>Request Sector Case Study</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
