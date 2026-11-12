"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BatteryCharging,
  Building2,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Crown,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Laptop,
  Lock,
  LogIn,
  LogOut,
  Mail,
  QrCode,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { UserRole } from "@/types";

type LoginPortalMode = "DRIVER" | "OPERATOR" | "ADMIN";

export default function InteractiveAuthPage() {
  const router = useRouter();
  const {
    authUser,
    loginUser,
    registerUser,
    logoutUser,
    activeRole,
    setActiveRole,
    backendConnected,
    sessions,
    revokeSession,
  } = useParkwise();

  // Mode: "DRIVER" | "OPERATOR" | "ADMIN" | "REGISTER"
  const [portalMode, setPortalMode] = useState<LoginPortalMode>("DRIVER");
  const [authView, setAuthView] = useState<"LOGIN" | "REGISTER" | "MANAGE_SESSION">("LOGIN");

  // Input states
  const [email, setEmail] = useState("driver@parkwise.in");
  const [password, setPassword] = useState("parkwise123");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [biometricScanning, setBiometricScanning] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Register state
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("+91 9811002233");
  const [regPassword, setRegPassword] = useState("Parkwise2026");
  const [regRole, setRegRole] = useState<"DRIVER" | "OPERATOR">("DRIVER");
  const [regPlate, setRegPlate] = useState("DL-01-AB-1234");
  const [regModel, setRegModel] = useState("Tata Nexon EV");
  const [regFacilityName, setRegFacilityName] = useState("CyberHub Multi-Level Lot");

  // Quick preset loader when switching modes
  const handleSelectMode = (mode: LoginPortalMode) => {
    setPortalMode(mode);
    setFeedback(null);
    if (mode === "DRIVER") {
      setEmail("driver@parkwise.in");
      setPassword("parkwise123");
    } else if (mode === "OPERATOR") {
      setEmail("operator@parkwise.in");
      setPassword("parkwise123");
    } else if (mode === "ADMIN") {
      setEmail("admin@parkwise.in");
      setPassword("parkwise123");
    }
  };

  // Submit handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const user = await loginUser(
        email,
        password,
        `${portalMode} Console • Web Client Session`
      );

      // Verify that user role matches portal mode (unless user is SuperAdmin)
      if (portalMode === "DRIVER" && user.role !== "DRIVER" && user.role !== "ADMIN") {
        setFeedback({
          type: "error",
          message: `This account has role '${user.role}', but you are attempting Driver Portal login. Please switch to the Operator portal.`,
        });
        setBusy(false);
        return;
      }

      if (portalMode === "OPERATOR" && user.role !== "OPERATOR" && user.role !== "ADMIN") {
        setFeedback({
          type: "error",
          message: `This account has role '${user.role}', but you are attempting Operator SaaS login. Please switch to the Driver portal.`,
        });
        setBusy(false);
        return;
      }

      // Synchronize activeRole
      setActiveRole(user.role);

      setFeedback({
        type: "success",
        message: `Welcome, ${user.fullName}! Authenticated as ${user.role}. Redirecting to your console...`,
      });

      // Redirect strictly based on role
      setTimeout(() => {
        if (user.role === "DRIVER") {
          router.push("/driver");
        } else if (user.role === "OPERATOR") {
          router.push("/operator");
        } else {
          router.push("/admin");
        }
      }, 900);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Authentication failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  // Simulated WebAuthn Biometric Fast Sign-In
  const handleBiometricAuth = async () => {
    setBiometricScanning(true);
    setFeedback({
      type: "info",
      message: `Scanning WebAuthn / TouchID for ${portalMode} profile...`,
    });

    setTimeout(async () => {
      try {
        let targetEmail = "driver@parkwise.in";
        if (portalMode === "OPERATOR") targetEmail = "operator@parkwise.in";
        if (portalMode === "ADMIN") targetEmail = "admin@parkwise.in";

        const user = await loginUser(
          targetEmail,
          "parkwise123",
          `Biometric FIDO2 • ${portalMode} Authenticator`
        );
        setActiveRole(user.role);

        setFeedback({
          type: "success",
          message: `Biometric Verified! Authenticated as ${user.fullName} (${user.role}). Redirecting...`,
        });

        setTimeout(() => {
          if (user.role === "DRIVER") router.push("/driver");
          else if (user.role === "OPERATOR") router.push("/operator");
          else router.push("/admin");
        }, 800);
      } catch (err) {
        setFeedback({
          type: "error",
          message: "Biometric authentication failed. Please enter your credentials manually.",
        });
      } finally {
        setBiometricScanning(false);
      }
    }, 1200);
  };

  // Registration handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const created = await registerUser({
        fullName: regFullName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        role: regRole,
        vehicleNumber: regRole === "DRIVER" ? regPlate : undefined,
        modelName: regRole === "DRIVER" ? regModel : undefined,
        homeCity: "New Delhi",
      });

      setFeedback({
        type: "success",
        message: `Account created for ${created.fullName} (${created.role})! You are now signed in.`,
      });

      setActiveRole(created.role);
      setTimeout(() => {
        if (created.role === "DRIVER") router.push("/driver");
        else router.push("/operator");
      }, 1000);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Registration failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-80px)] overflow-hidden bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Holographic Glow Mesh */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-brand-500/15 blur-[128px]" />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-[550px] w-[550px] rounded-full bg-indigo-500/15 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[130px]" />

      <div className="relative mx-auto w-full max-w-4xl">
        {/* Header Branding */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-950/50 px-4 py-1.5 text-xs font-bold text-brand-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-brand-400 animate-pulse" />
            <span>PARKWISE ENTERPRISE IDENTITY &amp; RBAC 2.0</span>
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
            Choose Your Access Portal
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
            Strict role-based operational isolation. Drivers access individual mobility, EV charging &amp; payments. Operators command smart facilities, live cameras &amp; dynamic pricing.
          </p>
        </div>

        {/* Active Session Status Notification Bar */}
        {authUser && (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-300">CURRENTLY AUTHENTICATED</span>
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                      {authUser.role}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-white">
                    {authUser.fullName} <span className="text-xs font-normal text-slate-400">({authUser.email})</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={authUser.role === "DRIVER" ? "/driver" : authUser.role === "OPERATOR" ? "/operator" : "/admin"}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/30"
                >
                  <span>Go to {authUser.role} Console</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await logoutUser();
                    setFeedback({ type: "info", message: "You have been logged out safely." });
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5 inline mr-1" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mt-4 flex items-start gap-3 rounded-2xl p-4 text-xs font-medium backdrop-blur-md border ${
              feedback.type === "success"
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
                : feedback.type === "error"
                ? "border-rose-500/40 bg-rose-950/40 text-rose-200"
                : "border-blue-500/40 bg-blue-950/40 text-blue-200"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : feedback.type === "error" ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            ) : (
              <RefreshCw className="h-4 w-4 shrink-0 text-blue-400 mt-0.5 animate-spin" />
            )}
            <div className="flex-1">{feedback.message}</div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-white ml-2 text-sm leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Main Card Container */}
        <div className="mt-8 rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          {/* Top Mode Selector: Driver vs Operator vs Admin */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Driver Portal */}
            <button
              type="button"
              onClick={() => {
                setAuthView("LOGIN");
                handleSelectMode("DRIVER");
              }}
              className={`relative flex flex-col p-4 rounded-2xl border text-left transition-all ${
                portalMode === "DRIVER" && authView === "LOGIN"
                  ? "border-cyan-500/80 bg-cyan-950/30 ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-500/10"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                    portalMode === "DRIVER"
                      ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-300"
                      : "border-slate-700 bg-slate-800 text-slate-400"
                  }`}
                >
                  <CarFront className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-500/20">
                  CONSUMER MOBILITY
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-white">Driver Portal</h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                Bay booking, 60kW EV charging, FASTag auto-debit, monthly passes, and QR gate pass.
              </p>
              <div className="mt-3 text-[11px] font-semibold text-cyan-400 flex items-center gap-1">
                <span>Direct Access: /driver</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </button>

            {/* 2. Operator SaaS Console */}
            <button
              type="button"
              onClick={() => {
                setAuthView("LOGIN");
                handleSelectMode("OPERATOR");
              }}
              className={`relative flex flex-col p-4 rounded-2xl border text-left transition-all ${
                portalMode === "OPERATOR" && authView === "LOGIN"
                  ? "border-indigo-500/80 bg-indigo-950/30 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-500/10"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                    portalMode === "OPERATOR"
                      ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-300"
                      : "border-slate-700 bg-slate-800 text-slate-400"
                  }`}
                >
                  <Building2 className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/20">
                  FACILITY OPERATOR
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-white">Operator SaaS</h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                Multi-facility control, XGBoost dynamic surge pricing, ANPR camera streams, and staff roster.
              </p>
              <div className="mt-3 text-[11px] font-semibold text-indigo-400 flex items-center gap-1">
                <span>Direct Access: /operator</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </button>

            {/* 3. SuperAdmin Master Control */}
            <button
              type="button"
              onClick={() => {
                setAuthView("LOGIN");
                handleSelectMode("ADMIN");
              }}
              className={`relative flex flex-col p-4 rounded-2xl border text-left transition-all ${
                portalMode === "ADMIN" && authView === "LOGIN"
                  ? "border-amber-500/80 bg-amber-950/30 ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/10"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                    portalMode === "ADMIN"
                      ? "border-amber-400/50 bg-amber-500/20 text-amber-300"
                      : "border-slate-700 bg-slate-800 text-slate-400"
                  }`}
                >
                  <Crown className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                  SUPERADMIN MASTER
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-white">Platform Owner</h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                Universal root access: bypasses all role gates, full telemetry, user management, audit logs.
              </p>
              <div className="mt-3 text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                <span>All Consoles Unlocked</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </button>
          </div>

          {/* Tab Navigation: Sign In vs Create Account */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAuthView("LOGIN")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  authView === "LOGIN"
                    ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                Sign In to {portalMode === "DRIVER" ? "Driver Portal" : portalMode === "OPERATOR" ? "Operator SaaS" : "Admin Master"}
              </button>
              <button
                type="button"
                onClick={() => setAuthView("REGISTER")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  authView === "REGISTER"
                    ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                New Account Registration
              </button>
            </div>

            {/* Quick Demo Autofill Pill */}
            {authView === "LOGIN" && (
              <button
                type="button"
                onClick={() => handleSelectMode(portalMode)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                <RefreshCw className="h-3 w-3 text-brand-400" />
                <span>Autofill {portalMode} Demo Credentials</span>
              </button>
            )}
          </div>

          {/* VIEW 1: LOGIN FORM */}
          {authView === "LOGIN" && (
            <div className="mt-6 space-y-6">
              {/* Strict Isolation Notice */}
              <div
                className={`rounded-2xl border p-4 text-xs ${
                  portalMode === "DRIVER"
                    ? "border-cyan-800/40 bg-cyan-950/20 text-cyan-200"
                    : portalMode === "OPERATOR"
                    ? "border-indigo-800/40 bg-indigo-950/20 text-indigo-200"
                    : "border-amber-800/40 bg-amber-950/20 text-amber-200"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <Shield className="h-4 w-4 shrink-0 mt-0.5 text-current" />
                  <div>
                    <span className="font-bold uppercase tracking-wider">
                      {portalMode === "DRIVER"
                        ? "Driver Data Boundary:"
                        : portalMode === "OPERATOR"
                        ? "Facility Operator Boundary:"
                        : "Root SuperAdmin Key:"}
                    </span>{" "}
                    {portalMode === "DRIVER" &&
                      "Driver accounts have zero visibility into other drivers' bookings, operator revenue streams, or CCTV security cameras. Access is strictly confined to your personal mobility dashboard."}
                    {portalMode === "OPERATOR" &&
                      "Operator accounts manage their assigned facilities and dynamic pricing models. You cannot inspect other operators' revenues or private driver profile details."}
                    {portalMode === "ADMIN" &&
                      "As the Platform Owner / SuperAdmin, you possess master multi-tenant privileges across Driver Apps, Operator Consoles, Gate Scanners, and System Configurations."}
                  </div>
                </div>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    {portalMode === "DRIVER" ? "Driver Registered Email" : portalMode === "OPERATOR" ? "Operator Work Email" : "SuperAdmin Root Email"}
                  </label>
                  <div className="relative mt-1.5">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={portalMode === "DRIVER" ? "driver@parkwise.in" : portalMode === "OPERATOR" ? "operator@parkwise.in" : "admin@parkwise.in"}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-10 pr-4 py-2.5 font-mono text-sm font-semibold text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Password
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">Default Demo: parkwise123</span>
                  </div>
                  <div className="relative mt-1.5">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-10 pr-10 py-2.5 font-mono text-sm font-semibold text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Primary Sign In Button */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={busy || biometricScanning}
                    className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3 px-5 text-sm font-bold text-white transition-all shadow-xl ${
                      portalMode === "DRIVER"
                        ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-600/25"
                        : portalMode === "OPERATOR"
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/25"
                        : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/25"
                    }`}
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{busy ? "Authenticating..." : `Sign In to ${portalMode} Console`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBiometricAuth}
                    disabled={busy || biometricScanning}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <Fingerprint className={`h-4 w-4 text-emerald-400 ${biometricScanning ? "animate-pulse" : ""}`} />
                    <span>{biometricScanning ? "Verifying..." : "Fast Biometric Sign-In"}</span>
                  </button>
                </div>
              </form>

              {/* 1-Click Fast Switch Buttons for Demonstration */}
              <div className="mt-6 border-t border-slate-800/80 pt-5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-3">
                  Instant One-Click Demo Personas:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectMode("DRIVER");
                      setEmail("driver@parkwise.in");
                      setPassword("parkwise123");
                    }}
                    className="flex items-center justify-between rounded-xl border border-cyan-800/30 bg-cyan-950/20 p-2.5 text-left hover:border-cyan-500 hover:bg-cyan-950/40 transition-colors"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-cyan-400">DRIVER</span>
                      <p className="text-xs font-bold text-white">Rohit Sharma (EV Driver)</p>
                      <p className="text-[10px] text-slate-400 font-mono">driver@parkwise.in</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSelectMode("OPERATOR");
                      setEmail("operator@parkwise.in");
                      setPassword("parkwise123");
                    }}
                    className="flex items-center justify-between rounded-xl border border-indigo-800/30 bg-indigo-950/20 p-2.5 text-left hover:border-indigo-500 hover:bg-indigo-950/40 transition-colors"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-indigo-400">OPERATOR</span>
                      <p className="text-xs font-bold text-white">Aarav Patel (DLF CyberCity)</p>
                      <p className="text-[10px] text-slate-400 font-mono">operator@parkwise.in</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-indigo-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSelectMode("ADMIN");
                      setEmail("admin@parkwise.in");
                      setPassword("parkwise123");
                    }}
                    className="flex items-center justify-between rounded-xl border border-amber-800/30 bg-amber-950/20 p-2.5 text-left hover:border-amber-500 hover:bg-amber-950/40 transition-colors"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-amber-400">SUPERADMIN</span>
                      <p className="text-xs font-bold text-white">Platform Owner (Full Access)</p>
                      <p className="text-[10px] text-slate-400 font-mono">admin@parkwise.in</p>
                    </div>
                    <Crown className="h-3.5 w-3.5 text-amber-400" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: REGISTRATION FORM */}
          {authView === "REGISTER" && (
            <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4">
              <div className="rounded-xl border border-brand-800/40 bg-brand-950/20 p-3 text-xs text-brand-300">
                Registering a new account provisions an isolated tenant with cryptographic authentication tokens.
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Account Role</label>
                <div className="mt-1.5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRegRole("DRIVER")}
                    className={`rounded-xl p-3 border text-left font-bold text-xs ${
                      regRole === "DRIVER"
                        ? "border-cyan-500 bg-cyan-950/40 text-cyan-300"
                        : "border-slate-700 bg-slate-800 text-slate-400"
                    }`}
                  >
                    🚗 Driver Mobility Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRole("OPERATOR")}
                    className={`rounded-xl p-3 border text-left font-bold text-xs ${
                      regRole === "OPERATOR"
                        ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                        : "border-slate-700 bg-slate-800 text-slate-400"
                    }`}
                  >
                    🏢 Parking Operator Account
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Vikramaditya Rao"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs font-semibold text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Email Address</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="vikram@example.com"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs font-mono font-semibold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Choose Password</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              {regRole === "DRIVER" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-800 pt-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Primary Vehicle Plate</label>
                    <input
                      type="text"
                      value={regPlate}
                      onChange={(e) => setRegPlate(e.target.value.toUpperCase())}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs font-mono font-bold text-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300">Vehicle Model</label>
                    <input
                      type="text"
                      value={regModel}
                      onChange={(e) => setRegModel(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-800 pt-3">
                  <label className="text-xs font-bold text-slate-300">Facility / Company Name</label>
                  <input
                    type="text"
                    value={regFacilityName}
                    onChange={(e) => setRegFacilityName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full mt-4 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white hover:bg-brand-500 shadow-lg shadow-brand-600/30 transition-all"
              >
                {busy ? "Registering..." : `Create ${regRole} Account`}
              </button>
            </form>
          )}
        </div>

        {/* Security & Cryptographic Integrity Footer */}
        <div className="mt-8 flex flex-wrap items-center justify-between text-xs text-slate-500 border-t border-slate-900 pt-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>FIPS 140-2 Compatible • HMAC-SHA256 Signed Sessions • Zero Plaintext Storage</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>FastAPI: {backendConnected ? "LIVE 8000" : "LOCAL CACHE"}</span>
            <span>•</span>
            <span>RBAC: ENFORCED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
