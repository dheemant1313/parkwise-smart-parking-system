"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CarFront,
  ChevronDown,
  Compass,
  Cpu,
  KeyRound,
  Layers,
  Menu,
  QrCode,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { UserRole } from "@/types";

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#for-businesses", label: "For Businesses" },
  { href: "/#technology", label: "Technology" },
  { href: "/contact", label: "Contact" },
];

const ALL_PLATFORM_APPS = [
  {
    href: "/driver",
    name: "Driver Mobility App",
    desc: "Find, reserve & navigate to smart parking",
    icon: CarFront,
    color: "text-blue-600 bg-blue-50",
    roles: ["DRIVER", "ADMIN"],
  },
  {
    href: "/driver/map",
    name: "Live Map & Entrances",
    desc: "Discover nearby facilities and entrance waypoints",
    icon: Compass,
    color: "text-sky-600 bg-sky-50",
    roles: ["DRIVER", "ADMIN"],
  },
  {
    href: "/operator",
    name: "Operator SaaS Console",
    desc: "Manage facilities, revenue & dynamic surge",
    icon: Building2,
    color: "text-indigo-600 bg-indigo-50",
    roles: ["OPERATOR", "ADMIN"],
  },
  {
    href: "/gate",
    name: "Gate Terminal & Scanner",
    desc: "FASTag RFID & ANPR boom barrier control",
    icon: QrCode,
    color: "text-emerald-600 bg-emerald-50",
    roles: ["OPERATOR", "GATE_STAFF", "ADMIN"],
  },
  {
    href: "/ecosystem",
    name: "Ecosystem Hub",
    desc: "EV bays, subscriptions & fleet wallets",
    icon: Cpu,
    color: "text-cyan-600 bg-cyan-50",
    roles: ["DRIVER", "OPERATOR", "ADMIN"],
  },
  {
    href: "/admin",
    name: "Platform Administrator",
    desc: "Master multi-tenant root control desk",
    icon: ShieldCheck,
    color: "text-amber-600 bg-amber-50",
    roles: ["ADMIN"],
  },
];

export function Navbar() {
  const pathname = usePathname();
  const { authUser, logoutUser } = useParkwise();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appsDropdownOpen, setAppsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Strict role-filtered platform apps: Drivers NEVER see Operator, Operators NEVER see Driver
  const visibleApps = useMemo(() => {
    if (!authUser) {
      // Unauthenticated visitor sees public apps
      return ALL_PLATFORM_APPS.filter((a) => a.href !== "/admin");
    }
    if (authUser.role === "ADMIN") {
      return ALL_PLATFORM_APPS;
    }
    if (authUser.role === "DRIVER") {
      return [
        {
          href: "/driver",
          name: "Driver Mobility App",
          desc: "Find, reserve & navigate to smart parking",
          icon: CarFront,
          color: "text-blue-600 bg-blue-50",
        },
        {
          href: "/driver/bookings",
          name: "My Bookings & Passes",
          desc: "Active reservations, QR passes & history",
          icon: QrCode,
          color: "text-emerald-600 bg-emerald-50",
        },
        {
          href: "/driver/profile",
          name: "Garage & Vehicles",
          desc: "FASTag tags, plate numbers & EV status",
          icon: Cpu,
          color: "text-indigo-600 bg-indigo-50",
        },
        {
          href: "/ecosystem",
          name: "Ecosystem Hub",
          desc: "EV bays, subscriptions & fleet wallets",
          icon: Zap,
          color: "text-cyan-600 bg-cyan-50",
        },
      ];
    }
    if (authUser.role === "OPERATOR") {
      return [
        {
          href: "/operator",
          name: "Operator SaaS Console",
          desc: "Manage facilities, revenue & dynamic surge",
          icon: Building2,
          color: "text-indigo-600 bg-indigo-50",
        },
        {
          href: "/gate",
          name: "Gate Terminal & Scanner",
          desc: "FASTag RFID & ANPR boom barrier control",
          icon: QrCode,
          color: "text-emerald-600 bg-emerald-50",
        },
        {
          href: "/business",
          name: "Business Solutions",
          desc: "Commercial parking real-estate offerings",
          icon: ShieldCheck,
          color: "text-slate-600 bg-slate-50",
        },
        {
          href: "/ecosystem",
          name: "Multi-Location & ANPR",
          desc: "CCTV feeds, camera streams & marketplace",
          icon: Cpu,
          color: "text-cyan-600 bg-cyan-50",
        },
      ];
    }
    return ALL_PLATFORM_APPS.filter((a) => a.roles.includes(authUser.role));
  }, [authUser]);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-slate-200/80 bg-white/85 backdrop-blur-xl shadow-xs"
          : "border-b border-transparent bg-white/60 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand Logo & Tagline */}
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105">
            <Cpu className="h-5 w-5" />
            <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-slate-900">
                Parkwise
              </span>
              <span className="rounded-full bg-blue-50 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-blue-700 border border-blue-200/70">
                India
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 tracking-tight">
              Smart Parking. Seamless Living.
            </span>
          </div>
        </Link>

        {/* Center Desktop Navigation */}
        <nav
          aria-label="Main Navigation"
          className="hidden lg:flex items-center gap-1 text-[13px] font-medium text-slate-600"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-full px-3.5 py-1.5 transition-colors hover:text-slate-900 hover:bg-slate-100/70"
            >
              {link.label}
            </Link>
          ))}

          {/* Platform Console Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAppsDropdownOpen((prev) => !prev)}
              onBlur={() => setTimeout(() => setAppsDropdownOpen(false), 200)}
              className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 transition-colors hover:text-slate-900 hover:bg-slate-100/70"
            >
              <span>{authUser ? (authUser.role === "DRIVER" ? "Driver Portal" : authUser.role === "OPERATOR" ? "Operator Portal" : "Platform Hub") : "Platform"}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  appsDropdownOpen ? "rotate-180 text-blue-600" : ""
                }`}
              />
            </button>

            {appsDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Authorized Consoles</span>
                  {authUser && (
                    <span className="text-blue-600 font-bold">{authUser.role} BOUNDARY</span>
                  )}
                </div>
                <div className="space-y-1">
                  {visibleApps.map((app) => {
                    const Icon = app.icon;
                    return (
                      <Link
                        key={app.href}
                        href={app.href}
                        onClick={() => setAppsDropdownOpen(false)}
                        className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${app.color}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {app.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {app.desc}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Right Action CTAs */}
        <div className="hidden sm:flex items-center gap-3">
          {authUser ? (
            <div className="flex items-center gap-2">
              <Link
                href={
                  authUser.role === "ADMIN"
                    ? "/admin"
                    : authUser.role === "OPERATOR"
                    ? "/operator"
                    : "/driver"
                }
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 transition-all"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="max-w-[120px] truncate">{authUser.fullName || authUser.email}</span>
                <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {authUser.role}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => logoutUser()}
                className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/auth"
                className="rounded-full px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/auth?tab=signup"
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 hover:shadow transition-all"
              >
                <span>Get Started</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Trigger */}
        <button
          type="button"
          aria-label="Toggle Navigation Menu"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2 text-slate-700 lg:hidden hover:bg-slate-100 transition-colors"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200/80 bg-white/95 backdrop-blur-xl px-5 py-6 lg:hidden space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-3">
              {authUser ? `${authUser.role} Consoles` : "Platform Consoles"}
            </div>
            <div className="grid grid-cols-1 gap-1">
              {visibleApps.map((app) => {
                const Icon = app.icon;
                return (
                  <Link
                    key={app.href}
                    href={app.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Icon className="h-4 w-4 text-blue-600" />
                    <span>{app.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
            {authUser ? (
              <button
                type="button"
                onClick={() => {
                  logoutUser();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-center rounded-full border border-slate-200 py-2.5 text-xs font-semibold text-slate-700"
              >
                Sign Out ({authUser.email})
              </button>
            ) : (
              <>
                <Link
                  href="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center rounded-full border border-slate-200 py-2.5 text-xs font-semibold text-slate-700"
                >
                  Log In
                </Link>
                <Link
                  href="/auth?tab=signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-full bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-sm"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
