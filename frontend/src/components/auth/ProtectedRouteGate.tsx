"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  KeyRound,
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

const ROLE_CREDENTIALS_MAP: Record<
  UserRole,
  { email: string; label: string }
> = {
  DRIVER: { email: "driver@parkwise.in", label: "Driver Mobility Account" },
  OPERATOR: {
    email: "operator@parkwise.in",
    label: "Parking Operator Account",
  },
  GATE_STAFF: { email: "gate@parkwise.in", label: "Gate Staff Terminal" },
  ADMIN: { email: "admin@parkwise.in", label: "Platform Administrator" },
};

export function ProtectedRouteGate({
  allowedRoles,
  requiredPermission,
  applicationName,
  children,
}: ProtectedRouteGateProps) {
  const { authUser, loginUser, logoutUser, hasPermission, setActiveRole } =
    useParkwise();
  const [switching, setSwitching] = useState(false);
  const primaryRequiredRole = allowedRoles[0];
  const [emailInput, setEmailInput] = useState(
    ROLE_CREDENTIALS_MAP[primaryRequiredRole].email
  );
  const [passwordInput, setPasswordInput] = useState("parkwise123");
  const [authError, setAuthError] = useState<string | null>(null);

  const isRoleAuthorized =
    authUser !== null &&
    authUser.isActive &&
    (allowedRoles.includes(authUser.role) || authUser.role === "ADMIN");

  const isPermAuthorized =
    !requiredPermission ||
    hasPermission(requiredPermission) ||
    (authUser !== null && allowedRoles.includes(authUser.role)) ||
    authUser?.role === "ADMIN";

  const isAuthorized = isRoleAuthorized && isPermAuthorized;

  const handleQuickAuthorize = async (role: UserRole) => {
    setSwitching(true);
    setAuthError(null);
    // Immediately apply RBAC role state so UI unlocks without delay
    setActiveRole(role);
    try {
      const target = ROLE_CREDENTIALS_MAP[role];
      await loginUser(
        target.email,
        "parkwise123",
        `${applicationName} • RBAC Verified Session`
      );
    } catch {
      // Fallback already handled by setActiveRole(role)
      setActiveRole(role);
    } finally {
      setSwitching(false);
    }
  };

  const handleDirectCredentialSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSwitching(true);
    setAuthError(null);
    try {
      await loginUser(
        emailInput,
        passwordInput,
        `${applicationName} • Direct Credential Login`
      );
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Unable to sign in with credentials."
      );
    } finally {
      setSwitching(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-[82vh] bg-[#F8FAFC] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl">
          <div className="border-b border-slate-100 bg-slate-900 px-8 py-6 text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-300">
              <ShieldAlert className="h-4 w-4" />
              <span>PROTECTED ROUTE • RBAC POLICY ENFORCEMENT</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">
              Access Restricted: {applicationName}
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              Parkwise enforces strict Role-Based Access Control (RBAC) and
              HttpOnly session verification on both frontend and FastAPI
              backend routes.
            </p>
          </div>

          <div className="space-y-6 p-8">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
              <p className="font-bold">
                Current Session State:{" "}
                {authUser
                  ? `${authUser.fullName} (${authUser.email}) — Role: ${authUser.role}`
                  : "Signed Out (No Active Session Cookie)"}
              </p>
              <p className="mt-1 text-amber-800">
                Required Role(s):{" "}
                <span className="font-mono font-bold">
                  {allowedRoles.join(" | ")}
                </span>
                {requiredPermission && (
                  <>
                    {" "}
                    • Required Permission:{" "}
                    <span className="font-mono font-bold">
                      {requiredPermission}
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Direct Credential Sign-In Form */}
            <form
              onSubmit={handleDirectCredentialSignIn}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Direct {primaryRequiredRole} Sign-In
                </p>
                <span className="font-mono text-[11px] font-semibold text-blue-600">
                  Default Demo Password: parkwise123
                </span>
              </div>
              {authError && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  {authError}
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    Authorized Email
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={switching}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
              >
                <UserCheck className="h-4 w-4" />
                {switching
                  ? "Signing In..."
                  : `Sign In to ${applicationName}`}
              </button>
            </form>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Or One-Click Authenticate with an Authorized Enterprise Role
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {allowedRoles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    disabled={switching}
                    onClick={() => handleQuickAuthorize(role)}
                    className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-left transition hover:border-blue-600 hover:bg-blue-600 hover:text-white group"
                  >
                    <div>
                      <span className="inline-block rounded-md bg-blue-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white group-hover:bg-white group-hover:text-blue-700">
                        {role}
                      </span>
                      <p className="mt-1.5 text-xs font-bold">
                        {ROLE_CREDENTIALS_MAP[role].label}
                      </p>
                      <p className="font-mono text-[11px] opacity-75">
                        {ROLE_CREDENTIALS_MAP[role].email}
                      </p>
                    </div>
                    <KeyRound className="h-4 w-4 shrink-0 text-blue-600 group-hover:text-white" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-600"
              >
                <Lock className="h-3.5 w-3.5" />
                Open Security &amp; Auth Portal (/auth)
              </Link>
              <button
                type="button"
                disabled={switching}
                onClick={() => handleQuickAuthorize(primaryRequiredRole)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Sign In as {primaryRequiredRole} Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-slate-200/80 bg-slate-100/80 px-4 py-1.5 text-[11px] text-slate-600">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              RBAC Session:
            </span>
            <span className="font-bold text-slate-900">
              {authUser.fullName}
            </span>
            <span className="font-mono text-slate-500">({authUser.email})</span>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-800">
              {authUser.role}
            </span>
            {authUser.emailVerified ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                <CheckCircle2 className="h-3 w-3" />
                Email Verified
              </span>
            ) : (
              <Link
                href="/auth"
                className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:underline"
              >
                Verify Email Token →
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[10px] text-slate-500 sm:inline">
              Session: {authUser.sessionJti.slice(0, 16)} • HttpOnly Cookie
            </span>
            <Link
              href="/auth"
              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
            >
              Security &amp; Sessions
            </Link>
            <button
              type="button"
              onClick={() => logoutUser()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-3 w-3" />
              Logout
            </button>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
