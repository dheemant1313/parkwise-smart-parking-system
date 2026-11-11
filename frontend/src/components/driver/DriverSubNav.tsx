"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  CarFront,
  Compass,
  MapPin,
  UserCheck,
} from "lucide-react";
import { useParkwise } from "@/lib/store";

export function DriverSubNav() {
  const pathname = usePathname();
  const { bookings, vehicles, notifications, lots } = useParkwise();

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeBookingsCount = bookings.filter((b) =>
    ["CONFIRMED", "ACTIVE", "PENDING_PAYMENT"].includes(b.status)
  ).length;
  const primaryVehicle =
    vehicles.find((v) => v.isPrimary) || vehicles[0];

  const tabs = [
    {
      href: "/driver",
      label: "Find & Reserve Parking",
      icon: Compass,
      exact: true,
    },
    {
      href: `/driver/lots/${lots[0]?.id || 1}`,
      label: "Lot Detail Inspector",
      icon: MapPin,
      matchPrefix: "/driver/lots",
    },
    {
      href: "/driver/bookings",
      label: "Passes, Extensions & Receipts",
      badge: activeBookingsCount > 0 ? String(activeBookingsCount) : undefined,
      icon: CalendarClock,
      exact: true,
    },
    {
      href: "/driver/profile",
      label: "Vehicles & Driver Profile",
      badge: String(vehicles.length),
      icon: UserCheck,
      exact: true,
    },
  ];

  return (
    <div className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <nav
          aria-label="Driver Application Navigation"
          className="flex items-center gap-1.5 overflow-x-auto"
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = t.exact
              ? pathname === t.href
              : t.matchPrefix
              ? pathname?.startsWith(t.matchPrefix)
              : pathname === t.href;

            return (
              <Link
                key={t.href}
                href={t.href}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-brand-600 text-white shadow-stripe"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
                {t.badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-brand-50 text-brand-700"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 text-xs">
          {primaryVehicle && (
            <Link
              href="/driver/profile"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700 hover:border-brand-300"
            >
              <CarFront className="h-3.5 w-3.5 text-brand-600" />
              <span className="font-mono font-bold text-slate-900">
                {primaryVehicle.plateNumber}
              </span>
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200">
                {primaryVehicle.size}
                {primaryVehicle.isEv ? " • EV" : ""}
              </span>
            </Link>
          )}

          <Link
            href="/driver/bookings"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:border-brand-300"
          >
            <Bell className="h-3.5 w-3.5 text-brand-600" />
            <span>Alerts</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-brand-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
