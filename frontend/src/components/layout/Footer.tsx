import React from "react";
import Link from "next/link";
import { Cpu, Globe2, Shield, Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="space-y-4 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
                <Cpu className="h-4 w-4" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                PARKWISE
              </span>
            </Link>
            <p className="max-w-sm text-xs leading-relaxed text-slate-500">
              Parking, without the parking around. Parkwise is India&apos;s
              enterprise AI smart parking ecosystem connecting drivers,
              commercial real-estate operators, NPCI FASTag lanes, and automated
              boom-barrier terminals.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-semibold text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                New Delhi
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                Mumbai BKC
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                Bengaluru
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                Gurugram
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                Hyderabad
              </span>
            </div>
          </div>

          {/* Public Website Pages */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Platform &amp; Company
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs font-medium">
              <li>
                <Link href="/" className="hover:text-brand-600 transition-colors">
                  Home Overview
                </Link>
              </li>
              <li>
                <Link
                  href="/features"
                  className="hover:text-brand-600 transition-colors"
                >
                  Features &amp; AI Specs
                </Link>
              </li>
              <li>
                <Link
                  href="/business"
                  className="hover:text-brand-600 transition-colors"
                >
                  Business Solutions
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="hover:text-brand-600 transition-colors"
                >
                  Pricing &amp; Tariffs
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-brand-600 transition-colors"
                >
                  About Parkwise
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-brand-600 transition-colors"
                >
                  Contact &amp; Sales
                </Link>
              </li>
            </ul>
          </div>

          {/* Live Operational Applications */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Live Applications
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs font-medium">
              <li>
                <Link
                  href="/driver"
                  className="hover:text-brand-600 transition-colors"
                >
                  Driver Booking App
                </Link>
              </li>
              <li>
                <Link
                  href="/operator"
                  className="hover:text-brand-600 transition-colors"
                >
                  Parking Operator Console
                </Link>
              </li>
              <li>
                <Link
                  href="/gate"
                  className="hover:text-brand-600 transition-colors"
                >
                  Gate ANPR &amp; QR Scanner
                </Link>
              </li>
              <li>
                <Link
                  href="/admin"
                  className="hover:text-brand-600 transition-colors"
                >
                  Platform Admin Command
                </Link>
              </li>
            </ul>
          </div>

          {/* Security & Engineering Guarantees */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Architecture Standards
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs text-slate-500">
              <li className="flex items-start gap-2">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                <span>HMAC-SHA256 Signed QR &amp; Razorpay Verification</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                <span>XGBoost Dynamic Surge &amp; Occupancy Forecasting</span>
              </li>
              <li className="flex items-start gap-2">
                <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                <span>Atomic SQL Transactions &amp; Zero Double-Booking</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row">
          <p>© 2026 Parkwise Smart Mobility Systems Pvt. Ltd. All rights reserved.</p>
          <p className="font-mono text-[11px]">
            Next.js • TypeScript • Three.js/R3F • GSAP/Lenis • FastAPI • SQLAlchemy
          </p>
        </div>
      </div>
    </footer>
  );
}
