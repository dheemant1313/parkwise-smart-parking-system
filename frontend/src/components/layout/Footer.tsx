import React from "react";
import Link from "next/link";
import { Cpu, Shield, Zap, Globe2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Cpu className="h-4 w-4" />
              </div>
              <span className="text-base font-bold tracking-tight text-slate-900">
                PARKWISE
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Enterprise AI-powered smart parking ecosystem for Indian metropolitan
              infrastructure. Connecting drivers, operators, NPCI FASTag lanes, and
              automated boom-barrier terminals.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Core Applications
            </h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link href="/" className="hover:text-brand-600">
                  1. Public Marketing &amp; 3D Twin
                </Link>
              </li>
              <li>
                <Link href="/driver" className="hover:text-brand-600">
                  2. Driver Slot Booking &amp; QR Pass
                </Link>
              </li>
              <li>
                <Link href="/operator" className="hover:text-brand-600">
                  3. Parking Operator SaaS Console
                </Link>
              </li>
              <li>
                <Link href="/gate" className="hover:text-brand-600">
                  4. Gate ANPR &amp; QR Scanner Terminal
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-brand-600">
                  5. Platform Administrator Command
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Metropolitan Clusters
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-500">
              <li>New Delhi — Connaught Place Inner Circle</li>
              <li>Mumbai — Jio World Drive BKC</li>
              <li>Bengaluru — Indiranagar 100ft Plaza</li>
              <li>Gurugram — DLF CyberHub Tower</li>
              <li>Hyderabad — HITEC City Mindspace</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Enterprise Architecture
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs text-slate-500">
              <li className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-brand-600" />
                <span>HMAC-SHA256 Signed QR &amp; Razorpay Verification</span>
              </li>
              <li className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-brand-600" />
                <span>XGBoost Dynamic Surge &amp; Occupancy Forecasting</span>
              </li>
              <li className="flex items-center gap-2">
                <Globe2 className="h-3.5 w-3.5 text-brand-600" />
                <span>Atomic SQL Transactions &amp; Zero Double-Booking</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row">
          <p>© 2026 Parkwise Smart Mobility Systems Pvt. Ltd. All rights reserved.</p>
          <p className="font-mono text-[11px]">
            Stack: Next.js • TypeScript • Three.js/R3F • FastAPI • SQLAlchemy • Redis • XGBoost
          </p>
        </div>
      </div>
    </footer>
  );
}
