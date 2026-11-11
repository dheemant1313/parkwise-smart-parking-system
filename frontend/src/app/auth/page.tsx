"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Laptop,
  Lock,
  LogIn,
  LogOut,
  MailCheck,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";
import { UserRole, VehicleSize } from "@/types";

export default function AuthAndSecurityPage() {
  const {
    authUser,
    sessions,
    roleDefinitions,
    auditLogs,
    loginUser,
    registerUser,
    logoutUser,
    verifyEmailToken,
    requestPasswordReset,
    confirmPasswordReset,
    revokeSession,
    deactivateAccount,
  } = useParkwise();

  const [activeTab, setActiveTab] = useState<
    "LOGIN" | "REGISTER" | "VERIFY_RESET" | "SESSIONS_RBAC"
  >("LOGIN");

  // Login State
  const [loginEmail, setLoginEmail] = useState("driver@parkwise.in");
  const [loginPassword, setLoginPassword] = useState("parkwise123");
  const [deviceLabel, setDeviceLabel] = useState(
    "Workstation Chrome • HttpOnly Cookie"
  );

  // Registration State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("+91-9811223344");
  const [regPassword, setRegPassword] = useState("Parkwise2026");
  const [regRole, setRegRole] = useState<string>("DRIVER");
  const [regPlate, setRegPlate] = useState("DL-08-CAF-8921");
  const [regModel, setRegModel] = useState("Tata Nexon EV Empowered+");
  const [regSize, setRegSize] = useState<VehicleSize>("SEDAN");
  const [regEv, setRegEv] = useState(true);
  const [regCity, setRegCity] = useState("New Delhi");

  // Email Verification & Password Reset State
  const [verifyTokenInput, setVerifyTokenInput] = useState("");
  const [forgotEmail, setForgotEmail] = useState("driver@parkwise.in");
  const [issuedResetToken, setIssuedResetToken] = useState("");
  const [newResetPassword, setNewResetPassword] = useState("NewSecurePass2027");

  // Feedback Banner
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      const user = await loginUser(loginEmail, loginPassword, deviceLabel);
      setBanner({
        type: "success",
        text: `Authenticated as ${user.fullName} (${user.role}). HttpOnly cookie set and session ${user.sessionJti.slice(0, 14)} activated.`,
      });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Authentication failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleQuickRoleLogin = async (role: UserRole, email: string) => {
    setBusy(true);
    setBanner(null);
    try {
      setLoginEmail(email);
      const user = await loginUser(
        email,
        "parkwise123",
        `${role} Console • HttpOnly Session`
      );
      setBanner({
        type: "success",
        text: `Switched authenticated session to ${user.fullName} (${user.role}) with ${user.permissions.length} RBAC permissions.`,
      });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Quick login failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      const created = await registerUser({
        fullName: regName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        role: regRole,
        vehicleNumber: regRole === "DRIVER" ? regPlate : undefined,
        modelName: regModel,
        sizeClass: regSize,
        isEv: regEv,
        homeCity: regCity,
      });
      if (created.emailVerificationTokenPreview) {
        setVerifyTokenInput(created.emailVerificationTokenPreview);
      }
      setBanner({
        type: "success",
        text: `Account created for ${created.email} (${created.role}). Verification token issued: ${created.emailVerificationTokenPreview || "verified"}.`,
      });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Registration failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      const tokenToUse =
        verifyTokenInput.trim() ||
        authUser?.emailVerificationTokenPreview ||
        "pw_verify_demo_2026";
      await verifyEmailToken(tokenToUse);
      setBanner({
        type: "success",
        text: `Email ownership verified using cryptographic token '${tokenToUse}'.`,
      });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Email verification failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      const res = await requestPasswordReset(forgotEmail);
      setIssuedResetToken(res.resetToken);
      setBanner({
        type: "success",
        text: `Generated 15-minute cryptographic password reset token: ${res.resetToken}`,
      });
    } catch (err) {
      setBanner({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Unable to generate password reset token.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      await confirmPasswordReset(issuedResetToken, newResetPassword);
      setBanner({
        type: "success",
        text: "Password updated via PBKDF2-HMAC-SHA256 and all prior sessions revoked.",
      });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Password reset failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Top Security Banner */}
      <section className="border-b border-slate-200/80 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <Fingerprint className="h-3.5 w-3.5" />
                <span>
                  PHASE 03 • ENTERPRISE AUTHENTICATION, RBAC &amp; SESSION
                  SECURITY
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Identity, Access Control &amp; Session Governance
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                PBKDF2-HMAC-SHA256 password hashing, HttpOnly cookie sessions,
                sliding-window rate limiting, role-escalation prevention, and
                granular RBAC across Driver, Operator, Gate, and Admin apps.
              </p>
            </div>

            {/* Active Session Badge */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:min-w-[320px]">
              {authUser ? (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-slate-900">
                        {authUser.fullName}
                      </span>
                      <span className="rounded-md bg-blue-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                        {authUser.role}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-600">
                      {authUser.email}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-slate-400">
                      JTI: {authUser.sessionJti} •{" "}
                      {authUser.emailVerified
                        ? "Email Verified"
                        : "Unverified Email"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => logoutUser()}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-rose-700">
                      Signed Out • No Active Session
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Protected routes require authentication
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickRoleLogin("DRIVER", "driver@parkwise.in")
                    }
                    className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Quick Sign In
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { id: "LOGIN", label: "1. Sign In & Quick RBAC Switch", icon: LogIn },
              {
                id: "REGISTER",
                label: "2. Register & Escalation Guard",
                icon: UserPlus,
              },
              {
                id: "VERIFY_RESET",
                label: "3. Email Verification & Password Reset",
                icon: MailCheck,
              },
              {
                id: "SESSIONS_RBAC",
                label: "4. Sessions, Permissions & Deactivation",
                icon: ShieldCheck,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      tab.id as
                        | "LOGIN"
                        | "REGISTER"
                        | "VERIFY_RESET"
                        | "SESSIONS_RBAC"
                    )
                  }
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        {banner && (
          <div
            className={`mb-6 flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm font-medium shadow-xs ${
              banner.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {banner.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
              )}
              <span>{banner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-xs font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left 7 Cols: Active Auth Flow */}
          <div className="space-y-6 lg:col-span-7">
            {activeTab === "LOGIN" && (
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Enterprise Sign In
                    </h2>
                    <p className="text-xs text-slate-500">
                      Authenticates via PBKDF2-HMAC-SHA256 and sets an HttpOnly
                      session cookie (`parkwise_session`).
                    </p>
                  </div>
                  <Lock className="h-5 w-5 text-blue-600" />
                </div>

                {/* 1-Click Role Switcher Cards */}
                <div className="mt-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1-Click Enterprise Role Accounts (Password: parkwise123)
                  </p>
                  <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {[
                      {
                        role: "DRIVER" as UserRole,
                        email: "driver@parkwise.in",
                        name: "Aarav Sharma",
                        appUrl: "/driver",
                        appName: "Driver App",
                      },
                      {
                        role: "OPERATOR" as UserRole,
                        email: "operator@parkwise.in",
                        name: "Vikramaditya Nair",
                        appUrl: "/operator",
                        appName: "Operator SaaS",
                      },
                      {
                        role: "GATE_STAFF" as UserRole,
                        email: "gate@parkwise.in",
                        name: "Rajeshwari Menon",
                        appUrl: "/gate",
                        appName: "Gate Terminal",
                      },
                      {
                        role: "ADMIN" as UserRole,
                        email: "admin@parkwise.in",
                        name: "Dheemant Setia",
                        appUrl: "/admin",
                        appName: "Admin Console",
                      },
                    ].map((preset) => {
                      const isCurrent = authUser?.role === preset.role;
                      return (
                        <div
                          key={preset.role}
                          className={`flex items-center justify-between rounded-2xl border p-3.5 transition ${
                            isCurrent
                              ? "border-blue-600 bg-blue-50/50"
                              : "border-slate-200 bg-slate-50/60"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                                {preset.role}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold text-blue-600">
                                  • Active
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs font-bold text-slate-900">
                              {preset.name}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500">
                              {preset.email}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleQuickRoleLogin(preset.role, preset.email)
                              }
                              className="rounded-xl bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                            >
                              Sign In
                            </button>
                            <Link
                              href={preset.appUrl}
                              className="text-[11px] font-semibold text-blue-600 hover:underline"
                            >
                              Open {preset.appName} →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Email / Password Login Form */}
                <form
                  onSubmit={handleLoginSubmit}
                  className="mt-6 space-y-4 border-t border-slate-100 pt-5"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Session Device Label (Recorded in UserSession Table)
                    </label>
                    <input
                      type="text"
                      value={deviceLabel}
                      onChange={(e) => setDeviceLabel(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    <LogIn className="h-4 w-4" />
                    Authenticate &amp; Issue HttpOnly Session Cookie
                  </button>
                </form>
              </div>
            )}

            {activeTab === "REGISTER" && (
              <form
                onSubmit={handleRegisterSubmit}
                className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Register New Parkwise Account
                    </h2>
                    <p className="text-xs text-slate-500">
                      Includes password strength enforcement, RTO vehicle
                      validation, and backend role-escalation protection.
                    </p>
                  </div>
                  <UserPlus className="h-5 w-5 text-blue-600" />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Siddharth Malhotra"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="siddharth@parkwise.in"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Mobile Phone
                    </label>
                    <input
                      type="text"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Strong Password (8+ chars, letters &amp; digits)
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Role Selection with Role-Escalation Security Test */}
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-700">
                    Account Role (Select ADMIN to test Role-Escalation Prevention)
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {[
                      { code: "DRIVER", label: "Driver" },
                      { code: "OPERATOR", label: "Operator" },
                      { code: "GATE_STAFF", label: "Gate Staff" },
                      { code: "ADMIN", label: "ADMIN (Blocked)" },
                    ].map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => setRegRole(r.code)}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                          regRole === r.code
                            ? r.code === "ADMIN"
                              ? "border-rose-600 bg-rose-50 text-rose-800"
                              : "border-blue-600 bg-blue-50 text-blue-800"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {regRole === "DRIVER" && (
                  <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Primary Vehicle Plate
                      </label>
                      <input
                        type="text"
                        value={regPlate}
                        onChange={(e) =>
                          setRegPlate(e.target.value.toUpperCase())
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-bold uppercase text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Vehicle Model
                      </label>
                      <input
                        type="text"
                        value={regModel}
                        onChange={(e) => setRegModel(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Size Class
                      </label>
                      <select
                        value={regSize}
                        onChange={(e) =>
                          setRegSize(e.target.value as VehicleSize)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                      >
                        <option value="COMPACT">COMPACT</option>
                        <option value="SEDAN">SEDAN</option>
                        <option value="SUV_XL">SUV_XL</option>
                      </select>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Create Account &amp; Issue Verification Token
                </button>
              </form>
            )}

            {activeTab === "VERIFY_RESET" && (
              <div className="space-y-6">
                {/* Email Verification Card */}
                <form
                  onSubmit={handleVerifyEmail}
                  className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Email Ownership Verification
                      </h2>
                      <p className="text-xs text-slate-500">
                        Verify the cryptographic token issued at registration
                        (`POST /api/v1/auth/verify-email`).
                      </p>
                    </div>
                    <MailCheck className="h-5 w-5 text-blue-600" />
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={verifyTokenInput}
                      onChange={(e) => setVerifyTokenInput(e.target.value)}
                      placeholder={
                        authUser?.emailVerificationTokenPreview ||
                        "pw_verify_..."
                      }
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Verify Email Token
                    </button>
                  </div>
                </form>

                {/* Password Reset Flow */}
                <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Cryptographic Password Reset
                      </h2>
                      <p className="text-xs text-slate-500">
                        Generates a 15-minute reset token and revokes all active
                        sessions upon password rotation.
                      </p>
                    </div>
                    <RefreshCw className="h-5 w-5 text-blue-600" />
                  </div>

                  <form
                    onSubmit={handleRequestReset}
                    className="mt-4 flex flex-col gap-3 sm:flex-row"
                  >
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Registered email address"
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      1. Generate Reset Token
                    </button>
                  </form>

                  <form
                    onSubmit={handleConfirmReset}
                    className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3"
                  >
                    <input
                      type="text"
                      required
                      value={issuedResetToken}
                      onChange={(e) => setIssuedResetToken(e.target.value)}
                      placeholder="Reset token (pw_reset_...)"
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-900"
                    />
                    <input
                      type="password"
                      required
                      value={newResetPassword}
                      onChange={(e) => setNewResetPassword(e.target.value)}
                      placeholder="New strong password"
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-600"
                    >
                      2. Confirm Password Reset
                    </button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === "SESSIONS_RBAC" && (
              <div className="space-y-6">
                {/* Active Device Sessions */}
                <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Active &amp; Historical Device Sessions (
                        {sessions.filter((s) => !s.is_revoked).length} Active)
                      </h2>
                      <p className="text-xs text-slate-500">
                        Backed by the `user_sessions` table with JTI token
                        revocation.
                      </p>
                    </div>
                    <Laptop className="h-5 w-5 text-blue-600" />
                  </div>

                  <div className="mt-4 space-y-3">
                    {sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {sess.device_label}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                sess.is_revoked
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {sess.is_revoked ? "REVOKED" : "ACTIVE"}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-[11px] text-slate-500">
                            JTI: {sess.session_token_jti} • IP:{" "}
                            {sess.ip_address}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Created {formatDateTime(sess.created_at)} • Expires{" "}
                            {formatDateTime(sess.expires_at)}
                          </p>
                        </div>

                        {!sess.is_revoked && (
                          <button
                            type="button"
                            onClick={() => revokeSession(sess.id)}
                            className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            Revoke Session
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Role-Based Permissions Matrix */}
                <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-bold text-slate-900">
                    Enterprise RBAC Roles &amp; Granular Permissions Matrix
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Enforced on the FastAPI backend via `require_roles` and
                    `require_permission`.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {roleDefinitions.map((roleDef) => (
                      <div
                        key={roleDef.code}
                        className={`rounded-2xl border p-4 ${
                          authUser?.role === roleDef.code
                            ? "border-blue-600 bg-blue-50/40"
                            : "border-slate-200 bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded-md bg-slate-900 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                            {roleDef.code}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {roleDef.permissions.length} permissions
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-bold text-slate-900">
                          {roleDef.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-600">
                          {roleDef.description}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {roleDef.permissions.map((perm) => (
                            <span
                              key={perm.code}
                              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700"
                              title={perm.description}
                            >
                              {perm.code}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Account Deactivation Card */}
                <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-rose-900">
                        Deactivate Account &amp; Revoke All Sessions
                      </h3>
                      <p className="mt-1 text-xs text-rose-700">
                        Marks `is_active = false`, revokes every active
                        `UserSession`, clears the `HttpOnly` cookie, and blocks
                        future logins until restored by a Platform
                        Administrator.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!authUser}
                      onClick={async () => {
                        await deactivateAccount();
                        setBanner({
                          type: "error",
                          text: "Account deactivated and all active sessions revoked.",
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      <UserX className="h-4 w-4" />
                      Deactivate My Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right 5 Cols: Real-Time Security & Audit Ledger */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Immutable Security &amp; RBAC Audit Log
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  Live Ledger
                </span>
              </div>

              <div className="mt-4 max-h-[540px] space-y-3 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                          log.action.includes("BLOCKED") ||
                          log.action.includes("DENIED") ||
                          log.action.includes("DEACTIVATED")
                            ? "bg-rose-100 text-rose-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-bold text-slate-900">
                      {log.actor_email}{" "}
                      <span className="font-mono text-[11px] font-normal text-slate-500">
                        ({log.actor_role}) → {log.target_resource}
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {log.details}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50/80 via-white to-slate-50 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
                <KeyRound className="h-4 w-4" />
                <span>Zero-Trust Storage Policy</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Sensitive credentials and raw passwords are never stored in
                browser `localStorage`. Authentication tokens are transmitted via
                `HttpOnly`, `SameSite=Lax` cookies and verified server-side
                against active `UserSession` records.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/driver/profile"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-blue-700 shadow-2xs ring-1 ring-slate-200 hover:bg-blue-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Manage Vehicles &amp; Profile →
                </Link>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Admin RBAC Console →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
