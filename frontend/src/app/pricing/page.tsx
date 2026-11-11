"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

const OPERATOR_TIERS = [
  {
    name: "Starter Commercial Lot",
    badge: "Up to 100 Bays",
    monthlyInr: 14999,
    annualMonthlyInr: 11999,
    description:
      "Ideal for standalone commercial complexes, hospitals, and boutique retail plazas.",
    features: [
      "Up to 100 IoT / Marked Parking Bays",
      "2D & 3D Driver Booking Web App",
      "HMAC-SHA256 QR Gate Terminal App",
      "Razorpay & UPI Automated Settlement",
      "Standard GST Invoicing & Daily Reports",
    ],
    ctaHref: "/contact",
    ctaLabel: "Start Commercial Pilot",
    highlighted: false,
  },
  {
    name: "Enterprise Mall & IT Park",
    badge: "Most Popular • Up to 1,000 Bays",
    monthlyInr: 39999,
    annualMonthlyInr: 31999,
    description:
      "Full AI dynamic surge pricing, optical ANPR camera integration, and NPCI FASTag lanes.",
    features: [
      "Up to 1,000 Multi-Floor Parking Bays",
      "XGBoost 12-Hour AI Dynamic Surge Engine",
      "Optical ANPR + NPCI FASTag Gate Integration",
      "50kW EV Charger Load & Surcharge Management",
      "Recharts Real-Time Executive SaaS Dashboard",
      "24/7 Priority SLA & Dedicated Solutions Architect",
    ],
    ctaHref: "/operator",
    ctaLabel: "Explore Live Operator Console",
    highlighted: true,
  },
  {
    name: "Smart City & Airport Grid",
    badge: "Unlimited Multi-Site Bays",
    monthlyInr: 94999,
    annualMonthlyInr: 74999,
    description:
      "Multi-city command center for municipal authorities, airports, and national REIT portfolios.",
    features: [
      "Unlimited Facilities & Metropolitan Clusters",
      "National Admin Command & RBAC Governance",
      "Custom ERP, SAP & Municipal API Webhooks",
      "On-Premise or Dedicated VPC Cloud Deployment",
      "Hardware Turnkey Procurement & Maintenance",
    ],
    ctaHref: "/business",
    ctaLabel: "Explore Enterprise Solutions",
    highlighted: false,
  },
];

export default function PricingPage() {
  const [annualBilling, setAnnualBilling] = useState<boolean>(true);
  const [driverHours, setDriverHours] = useState<number>(2);
  const [driverBayType, setDriverBayType] = useState<
    "STANDARD" | "EV" | "SUV_XL"
  >("STANDARD");

  const baseRate = 80;
  const surcharge =
    driverBayType === "EV" ? 45 : driverBayType === "SUV_XL" ? 25 : 0;
  const subtotal = (baseRate + surcharge) * driverHours;
  const gst = Math.round(subtotal * 0.18);
  const totalDriverInr = subtotal + gst;

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 space-y-20">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
          <Sparkles className="h-3.5 w-3.5" />
          Transparent Tariff &amp; SaaS Pricing
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Simple Pay-Per-Use for Drivers. Predictable SaaS for Operators.
        </h1>
        <p className="text-base leading-relaxed text-slate-600">
          Zero hidden booking fees for urban commuters and high-ROI enterprise
          subscriptions for commercial parking operators across India.
        </p>

        {/* Billing Toggle */}
        <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setAnnualBilling(false)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              !annualBilling
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setAnnualBilling(true)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              annualBilling
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Annual Billing (Save 20%)
          </button>
        </div>
      </div>

      {/* Operator SaaS Pricing Cards */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {OPERATOR_TIERS.map((tier) => {
          const price = annualBilling
            ? tier.annualMonthlyInr
            : tier.monthlyInr;
          return (
            <div
              key={tier.name}
              className={`flex flex-col justify-between rounded-3xl border p-8 transition-all ${
                tier.highlighted
                  ? "border-2 border-brand-600 bg-white shadow-stripe"
                  : "border-slate-200 bg-white shadow-apple"
              }`}
            >
              <div className="space-y-4">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
                    tier.highlighted
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {tier.badge}
                </span>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {tier.name}
                </h2>
                <p className="text-xs leading-relaxed text-slate-500">
                  {tier.description}
                </p>

                <div className="border-y border-slate-100 py-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {formatINR(price)}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      / facility / month + GST
                    </span>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs font-medium text-slate-700">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4">
                <Link
                  href={tier.ctaHref}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-bold transition-all ${
                    tier.highlighted
                      ? "bg-brand-600 text-white shadow-stripe hover:bg-brand-700"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  <span>{tier.ctaLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Driver Tariff Estimator */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-apple lg:p-12">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-brand-600">
              <CreditCard className="h-3.5 w-3.5" />
              Driver B2C Tariff Calculator
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Estimate Your Commuter Parking Fare
            </h2>
            <p className="text-xs leading-relaxed text-slate-600">
              Drivers pay only for the hours reserved plus transparent 18% GST.
              Select bay class and duration below or jump straight into the live
              Driver Booking App.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {[
                { id: "STANDARD", label: "Standard Bay (₹80/hr)" },
                { id: "SUV_XL", label: "SUV XL Bay (₹105/hr)" },
                { id: "EV", label: "EV 50kW Fast-Charge (₹125/hr)" },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() =>
                    setDriverBayType(b.id as "STANDARD" | "EV" | "SUV_XL")
                  }
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    driverBayType === b.id
                      ? "bg-brand-600 text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <label htmlFor="driver-hours-range">Parking Duration</label>
                <span className="text-brand-600">{driverHours} Hours</span>
              </div>
              <input
                id="driver-hours-range"
                type="range"
                min={1}
                max={12}
                value={driverHours}
                onChange={(e) => setDriverHours(Number(e.target.value))}
                className="mt-2 w-full accent-brand-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 lg:col-span-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Estimated Driver Checkout Breakdown
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Base + Bay Class Tariff ({driverHours} hrs)</span>
                <span className="font-bold">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>18% IGST / CGST+SGST</span>
                <span className="font-bold">{formatINR(gst)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-extrabold text-slate-900">
                <span>Total Estimated Fare</span>
                <span className="text-brand-600">
                  {formatINR(totalDriverInr)}
                </span>
              </div>
            </div>
            <Link
              href="/driver"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-xs font-bold text-white shadow-stripe hover:bg-brand-700"
            >
              <span>Reserve This Bay Now</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
