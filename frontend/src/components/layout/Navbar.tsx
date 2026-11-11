"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Building2,
  CarFront,
  Cpu,
  Menu,
  QrCode,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { UserRole } from "@/types";

const PUBLIC_NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/features", label: "Features" },
  { href: "/business", label: "Business Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const CONSOLE_LINKS = [
  { href: "/driver", label: "Driver App", icon: CarFront },
  { href: "/operator", label: "Operator SaaS", icon: Building2 },
  { href: "/gate", label: "Gate Terminal", icon: QrCode },
  { href: "/admin", label: "Admin Console", icon: ShieldCheck },
];

const ROLES: UserRole[] = ["DRIVER", "OPERATOR", "GATE_STAFF", "ADMIN"];

export function Navbar() {
  const pathname = usePathname();
  const { activeRole, setActiveRole, backendConnected, resetDemoState } =
    useParkwise();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      {/* Top Enterprise Operational Bar */}
      <div className="border-b border-slate-100 bg-slate-900 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 sm:px-6 lg:px-8 text-[11px]">
          <div className="flex items-center gap-3 overflow-x-auto">
            <span className="font-bold uppercase tracking-wider text-brand-300">
              Live Applications:
            </span>
            {CONSOLE_LINKS.map((item) => {
              const Icon = item.icon;
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? "bg-brand-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
              <Activity className="h-3 w-3 animate-pulse" />
              {backendConnected
                ? "FastAPI + SQLAlchemy Live"
                : "Transactional Engine Active"}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">RBAC:</span>
              <select
                aria-label="Active RBAC Role"
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value as UserRole)}
                className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white focus:outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={resetDemoState}
              className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>Reset Demo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Marketing & Product Navigation */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-stripe transition-transform group-hover:scale-105">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                PARKWISE
              </span>
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-600">
                India
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500">
              AI Smart Parking Ecosystem
            </p>
          </div>
        </Link>

        {/* Desktop Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-1"
        >
          {PUBLIC_NAV_LINKS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-brand-50 text-brand-600"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Primary & Secondary Action CTAs */}
        <div className="hidden sm:flex items-center gap-2.5">
          <Link
            href="/business"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:border-brand-300 hover:text-brand-600 transition-colors"
          >
            Explore for Business
          </Link>
          <Link
            href="/driver"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-stripe hover:bg-brand-700 transition-all"
          >
            <span>Find Parking</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Mobile Menu Trigger */}
        <button
          type="button"
          aria-label="Toggle Menu"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2 text-slate-700 lg:hidden"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {PUBLIC_NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 hover:border-brand-300"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <Link
              href="/driver"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-xs font-bold text-white"
            >
              <span>Find Parking</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/business"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700"
            >
              Explore for Business
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
