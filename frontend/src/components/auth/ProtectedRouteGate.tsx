"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CarFront,
  CheckCircle2,
  Lock,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { UserRole } from "@/types";

interface ProtectedRouteGateProps {
  allowedRoles: UserRole[];
  requiredPermission?: string;
  applicationName: string;
  children: React.ReactNode;
}

export function ProtectedRouteGate({
  allowedRoles,
  requiredPermission,
  applicationName,
  children,
}: ProtectedRouteGateProps) {
  const router = useRouter();
  const { authUser, logoutUser, hasPermission } = useParkwise();

  // Root SuperAdmin has universal master access to all portals
  const isSuperAdmin = authUser !== null && authUser.role === "ADMIN";

  // Strict Role authorization check
  const isRoleAuthorized =
    isSuperAdmin ||
    (authUser !== null &&
      authUser.isActive &&
      allowedRoles.includes(authUser.role));

  // Granular Permission check
  const isPermAuthorized =
    isSuperAdmin ||
    !requiredPermission ||
    hasPermission(requiredPermission) ||
    (authUser !== null && allowedRoles.includes(authUser.role));

  const isAuthorized = isRoleAuthorized && isPermAuthorized;

  // If not authorized, render role-specific strict boundary screen
  if (!isAuthorized) {
    // SCENARIO 1: Driver trying to access Operator / Gate / Admin sections
    if (authUser?.role === "DRIVER") {
      return (
        <div className="min-h-[82vh] bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-red-200 bg-white shadow-xl">
            {/* Header */}
            <div className="border-b border-red-100 bg-red-950 px-8 py-6 text-white">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300 border border-red-500/30">
                <ShieldAlert className="h-4 w-4" />
                <span>STRICT ROLE ISOLATION &bull; DRIVER BOUNDARY</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight">
                Access Restricted: {applicationName}
              </h1>
              <p className="mt-1 text-xs text-red-200 leading-relaxed">
                Your account is currently authenticated as a <strong>Driver</strong> ({authUser.email}).
              </p>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed space-y-2">
                <p className="font-bold text-slate-900">
                  Driver Privacy &amp; Commercial Isolation Policy:
                </p>
                <p>
                  Driver accounts are strictly prohibited from accessing commercial
                  operator facilities, CCTV surveillance feeds, XGBoost dynamic surge
                  pricing desks, or other operators&apos; private revenue data.
                </p>
                <div className="pt-2 border-t border-slate-200 text-slate-500">
                  Required Role(s): <span className="font-mono font-bold text-slate-800">{allowedRoles.join(" | ")}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Link
                  href="/driver"
                  className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-all"
                >
                  <CarFront className="h-4 w-4" />
                  <span>Return to Driver App</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    logoutUser();
                    router.push("/auth");
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // SCENARIO 2: Operator trying to access Driver personal sections
    if (authUser?.role === "OPERATOR") {
      return (
        <div className="min-h-[82vh] bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-indigo-200 bg-white shadow-xl">
            {/* Header */}
            <div className="border-b border-indigo-100 bg-indigo-950 px-8 py-6 text-white">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 border border-indigo-500/30">
                <ShieldAlert className="h-4 w-4" />
                <span>STRICT ROLE ISOLATION &bull; OPERATOR BOUNDARY</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight">
                Access Restricted: {applicationName}
              </h1>
              <p className="mt-1 text-xs text-indigo-200 leading-relaxed">
                Your account is currently authenticated as an <strong>Operator</strong> ({authUser.email}).
              </p>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed space-y-2">
                <p className="font-bold text-slate-900">
                  Consumer Data Protection Policy:
                </p>
                <p>
                  Facility operators cannot access personal driver wallets, private
                  booking histories, vehicle passes, or personal user profiles.
                  Access is confined strictly to commercial facility operations.
                </p>
                <div className="pt-2 border-t border-slate-200 text-slate-500">
                  Required Role(s): <span className="font-mono font-bold text-slate-800">{allowedRoles.join(" | ")}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Link
                  href="/operator"
                  className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-all"
                >
                  <Building2 className="h-4 w-4" />
                  <span>Return to Operator Console</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    logoutUser();
                    router.push("/auth");
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // SCENARIO 3: Gate staff or unauthenticated visitor
    return (
      <div className="min-h-[82vh] bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl">
          <div className="border-b border-slate-100 bg-slate-900 px-8 py-6 text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300">
              <Lock className="h-4 w-4" />
              <span>AUTHENTICATION REQUIRED</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">
              Sign In to Access {applicationName}
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              This application requires an authorized {allowedRoles.join(" or ")} account.
            </p>
          </div>

          <div className="p-8 space-y-6">
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Please sign in with your verified credentials to proceed. Role-based
              access controls ensure complete data separation between Drivers,
              Facility Operators, and Platform Administrators.
            </p>

            <div className="flex flex-col gap-2.5 pt-2">
              <Link
                href="/auth"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all"
              >
                <span>Sign In to Continue</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User is authorized: Render protected children
  return (
    <>
      <div className="border-b border-slate-200/80 bg-slate-100/60 px-4 py-1.5 text-[11px] text-slate-600">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              Verified Session:
            </span>
            <span className="font-bold text-slate-900">
              {authUser?.fullName}
            </span>
            <span className="font-mono text-slate-500">({authUser?.email})</span>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-800">
              {authUser?.role}
            </span>
            {isSuperAdmin && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                UNIVERSAL ROOT ACCESS
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => logoutUser()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-3 w-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
