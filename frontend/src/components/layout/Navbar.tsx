"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  CarFront,
  Cpu,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { UserRole } from "@/types";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Platform Overview",
    badge: "Marketing",
    icon: Sparkles,
  },
  {
    href: "/driver",
    label: "Driver Booking",
    badge: "B2C App",
    icon: CarFront,
  },
  {
    href: "/operator",
    label: "Operator Console",
    badge: "SaaS",
    icon: Building2,
  },
  {
    href: "/gate",
    label: "Gate Terminal",
    badge: "ANPR+QR",
    icon: QrCode,
  },
  {
    href: "/admin",
    label: "National Admin",
    badge: "Command",
    icon: ShieldCheck,
  },
];

const ROLES: UserRole[] = ["DRIVER", "OPERATOR", "GATE_STAFF", "ADMIN"];

export function Navbar() {
  const pathname = usePathname();
  const { activeRole, setActiveRole, backendConnected, resetDemoState } =
    useParkwise();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-stripe transition-transform group-hover:scale-105">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-slate-900">
                PARKWISE
              </span>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-600 border border-brand-200">
                India Grid v2.4
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500">
              AI Smart Parking &amp; Gate Telemetry Ecosystem
            </p>
          </div>
        </Link>

        {/* Application Switcher */}
        <nav
          aria-label="Core Applications"
          className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200/90 bg-slate-50/90 p-1"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Controls: Integration Mode Badge & RBAC Role Selector */}
        <div className="flex items-center gap-2.5">
          <div
            title={
              backendConnected
                ? "Connected to live FastAPI + SQLAlchemy backend"
                : "Running deterministic transactional client engine (Start FastAPI on :8000 for live API)"
            }
            className={`hidden xl:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              backendConnected
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-blue-200 bg-blue-50 text-brand-700"
            }`}
          >
            <Activity className="h-3 w-3 animate-pulse" />
            <span>
              {backendConnected
                ? "LIVE FASTAPI + DB"
                : "TRANSACTIONAL ENGINE ACTIVE"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              RBAC:
            </span>
            <select
              aria-label="Active RBAC Role"
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as UserRole)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
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
            title="Reset sample bookings and slot states"
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
