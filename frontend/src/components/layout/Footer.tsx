import React from "react";
import Link from "next/link";
import { Cpu, Globe2, ShieldCheck, Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="space-y-4 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <Cpu className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Parkwise
              </span>
            </Link>
            <p className="text-xs font-semibold text-blue-600">
              Smart Parking. Seamless Living.
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-slate-500">
              India&apos;s intelligent AI smart parking platform connecting
              urban drivers, commercial real-estate operators, NPCI FASTag boom
              barriers, and EV hyper-charging networks with sub-meter indoor
              guidance.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-medium text-slate-500">
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
                Pune
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                Hyderabad
              </span>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Platform
            </h3>
            <ul className="mt-3.5 space-y-2.5 text-xs">
              <li>
                <Link
                  href="/driver"
                  className="hover:text-blue-600 transition-colors"
                >
                  Driver App
                </Link>
              </li>
              <li>
                <Link
                  href="/operator"
                  className="hover:text-blue-600 transition-colors"
                >
                  Business Solutions
                </Link>
              </li>
              <li>
                <Link
                  href="/#technology"
                  className="hover:text-blue-600 transition-colors"
                >
                  Technology
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="hover:text-blue-600 transition-colors"
                >
                  Pricing &amp; Tariffs
                </Link>
              </li>
              <li>
                <Link
                  href="/ecosystem"
                  className="hover:text-blue-600 transition-colors"
                >
                  Ecosystem Hub
                </Link>
              </li>
            </ul>
          </div>

          {/* Solutions & Differentiators */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Solutions
            </h3>
            <ul className="mt-3.5 space-y-2.5 text-xs">
              <li>
                <Link
                  href="/#features"
                  className="hover:text-blue-600 transition-colors"
                >
                  Indoor Navigation
                </Link>
              </li>
              <li>
                <Link
                  href="/#technology"
                  className="hover:text-blue-600 transition-colors"
                >
                  YOLOv8 Edge Vision
                </Link>
              </li>
              <li>
                <Link
                  href="/#features"
                  className="hover:text-blue-600 transition-colors"
                >
                  FASTag Boom Barrier
                </Link>
              </li>
              <li>
                <Link
                  href="/#features"
                  className="hover:text-blue-600 transition-colors"
                >
                  60kW EV HyperCharging
                </Link>
              </li>
              <li>
                <Link
                  href="/gate"
                  className="hover:text-blue-600 transition-colors"
                >
                  Gate Terminal
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Legal */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Company
            </h3>
            <ul className="mt-3.5 space-y-2.5 text-xs">
              <li>
                <Link
                  href="/about"
                  className="hover:text-blue-600 transition-colors"
                >
                  About Parkwise
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-blue-600 transition-colors"
                >
                  Contact &amp; Support
                </Link>
              </li>
              <li>
                <Link
                  href="/auth"
                  className="hover:text-blue-600 transition-colors"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/auth?tab=signup"
                  className="hover:text-blue-600 transition-colors"
                >
                  Get Started
                </Link>
              </li>
              <li>
                <span className="text-slate-400 cursor-not-allowed">
                  Privacy Policy
                </span>
              </li>
              <li>
                <span className="text-slate-400 cursor-not-allowed">
                  Terms &amp; Conditions
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 text-[11px] text-slate-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <span>&copy; {new Date().getFullYear()} Parkwise Technologies India Pvt. Ltd.</span>
            <span>&bull;</span>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              MoRTH CMVR &amp; NPCI FASTag Compliant
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <span className="hover:text-blue-600 cursor-pointer">Twitter / X</span>
            <span className="hover:text-blue-600 cursor-pointer">LinkedIn</span>
            <span className="hover:text-blue-600 cursor-pointer">GitHub</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
