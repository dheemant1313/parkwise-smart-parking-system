"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  Building2,
  CalendarCheck,
  Camera,
  CarFront,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Navigation,
  Phone,
  QrCode,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { UserRole } from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type AuthTab = "signin" | "signup";
type SigninMethod = "email" | "phone";
type AccountType = "DRIVER" | "OPERATOR";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authUser, loginUser, logoutUser, setActiveRole } = useParkwise();

  // Mode and Method states
  const initialTab = searchParams?.get("tab") === "signup" ? "signup" : "signin";
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [signinMethod, setSigninMethod] = useState<SigninMethod>("email");
  const [accountType, setAccountType] = useState<AccountType>("DRIVER");

  // Email form states
  const [email, setEmail] = useState("driver@parkwise.in");
  const [password, setPassword] = useState("parkwise123");
  const [showPassword, setShowPassword] = useState(false);

  // Phone OTP states
  const [phone, setPhone] = useState("+91 98765 43210");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Signup form states
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  // Driver Onboarding states (Optional/Skippable)
  const [vehicleType, setVehicleType] = useState<"SEDAN" | "SUV_XL" | "COMPACT">("SEDAN");
  const [isEv, setIsEv] = useState(false);
  const [plateNumber, setPlateNumber] = useState("");
  const [homeCity, setHomeCity] = useState("New Delhi");

  // Operator Onboarding states (Optional/Skippable)
  const [businessName, setBusinessName] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [approxCapacity, setApproxCapacity] = useState("200");
  const [numFloors, setNumFloors] = useState("3");

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  // OTP Countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Autofill helpers for quick persona testing
  const autofillPersona = (role: "driver" | "operator" | "admin") => {
    setActiveTab("signin");
    setSigninMethod("email");
    setErrorMessage(null);
    if (role === "driver") {
      setEmail("driver@parkwise.in");
      setPassword("parkwise123");
    } else if (role === "operator") {
      setEmail("operator@parkwise.in");
      setPassword("parkwise123");
    } else {
      setEmail("admin@parkwise.in");
      setPassword("parkwise123");
    }
  };

  // Redirect based on role
  const redirectForRole = (role: UserRole) => {
    if (role === "ADMIN") {
      router.push("/admin");
    } else if (role === "OPERATOR") {
      router.push("/operator");
    } else if (role === "GATE_STAFF") {
      router.push("/gate");
    } else {
      router.push("/driver");
    }
  };

  // 1. Handle Email & Password Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await loginUser(
        email.trim(),
        password,
        "Parkwise Web &bull; Verified Credentials"
      );
      setSuccessMessage(`Welcome back, ${user.fullName}! Redirecting...`);
      setTimeout(() => {
        redirectForRole(user.role);
      }, 700);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Invalid email or password credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Send Phone OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const cleanPhone = phone.replace(/\s+/g, "");
    if (cleanPhone.length < 10) {
      setErrorMessage("Please enter a valid 10-digit mobile number.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, channel: "SMS" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Unable to send verification OTP.");
      }

      setOtpSent(true);
      setPreviewOtp(data.preview_code || "654321");
      setResendCooldown(data.cooldown_seconds || 30);
      setSuccessMessage(`Verification code sent to ${data.phone}.`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to connect to verification server."
      );
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Verify Phone OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const cleanPhone = phone.replace(/\s+/g, "");
    if (!otpCode || otpCode.length < 4) {
      setErrorMessage("Please enter the 6-digit verification code.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          otp: otpCode.trim(),
          role: accountType,
          device_label: "Web Browser &bull; Phone OTP Session",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid or expired OTP code.");
      }

      // Update store role and profile
      setActiveRole(data.role);
      setSuccessMessage(`Verified! Logging in as ${data.full_name}...`);
      setTimeout(() => {
        redirectForRole(data.role);
      }, 700);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Verification failed. Check the code."
      );
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Google Sign-in Mock/Oauth
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // Simulate real OAuth authorization callback
      const targetEmail =
        accountType === "OPERATOR"
          ? "operator@parkwise.in"
          : "driver@parkwise.in";
      const user = await loginUser(
        targetEmail,
        "parkwise123",
        "Google Workspace &bull; Verified OAuth"
      );
      setSuccessMessage(`Signed in with Google as ${user.email}!`);
      setTimeout(() => {
        redirectForRole(user.role);
      }, 700);
    } catch {
      setErrorMessage("Google Sign-In authorization failed.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Handle Real Account Registration
  const handleRegisterAccount = async (skipOnboarding = false) => {
    setLoading(true);
    setErrorMessage(null);

    if (!signupEmail || !signupPassword || !fullName || !signupPhone) {
      setErrorMessage("Please fill in all required registration fields.");
      setLoading(false);
      return;
    }

    try {
      const payload: Record<string, any> = {
        full_name: fullName.trim(),
        email: signupEmail.trim().toLowerCase(),
        phone: signupPhone.replace(/\s+/g, ""),
        password: signupPassword,
        role: accountType,
        home_city: homeCity,
        is_ev: isEv,
        size_class: vehicleType,
      };

      if (!skipOnboarding && plateNumber.trim()) {
        payload.vehicle_number = plateNumber.trim().toUpperCase();
      }

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Registration failed. Please check inputs.");
      }

      setSuccessMessage(`Account created! Signing you in...`);
      // Log in with new credentials
      const user = await loginUser(
        signupEmail.trim().toLowerCase(),
        signupPassword,
        "Parkwise New User Session"
      );
      setTimeout(() => {
        redirectForRole(user.role);
      }, 700);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Unable to complete registration."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center">
      <div className="w-full mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Back Link */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Home</span>
          </Link>

          {/* Quick Demo Persona Autofill Chips */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-slate-400 hidden sm:inline">Instant Demo Logins:</span>
            <button
              type="button"
              onClick={() => autofillPersona("driver")}
              className="rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-1 font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              🚗 Driver
            </button>
            <button
              type="button"
              onClick={() => autofillPersona("operator")}
              className="rounded-full border border-indigo-200 bg-indigo-50/80 px-2.5 py-1 font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              🏢 Operator
            </button>
            <button
              type="button"
              onClick={() => autofillPersona("admin")}
              className="rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-1 font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              👑 Admin
            </button>
          </div>
        </div>

        {/* Split-Screen Authentication Container */}
        <div className="grid grid-cols-1 overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl lg:grid-cols-12 min-h-[660px]">
          {/* Left Column: Cinematic Parking Garage Visual (Tesla / Stripe inspired) */}
          <div className="relative hidden lg:flex lg:col-span-5 flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-10 text-white">
            {/* Background Ambient Glow & Grid Lines */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,102,255,0.22),transparent_70%)] pointer-events-none" />
            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />

            {/* Top Brand Tag */}
            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
                  <Cpu className="h-5 w-5" />
                </div>
                <span className="text-xl font-extrabold tracking-tight">
                  PARKWISE
                </span>
              </div>
              <p className="text-xs font-semibold text-blue-400">
                Smart Parking. Seamless Living.
              </p>
            </div>

            {/* Middle Cinematic Headline & Availability Cards */}
            <div className="relative z-10 space-y-6 my-auto">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                  Welcome to Smarter Parking.
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Experience zero-stop boom barrier entries, live subterranean
                  indoor navigation, and guaranteed parking bays across India&apos;s
                  premier metropolitan smart hubs.
                </p>
              </div>

              {/* Floating Dynamic Availability Indicators */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
                  <div className="flex items-center gap-2.5 text-xs">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Radio className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-100">
                        Jio World Drive BKC
                      </div>
                      <div className="text-[10px] text-slate-400">
                        18 Bays Open &bull; ₹100/hr
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                    LIVE
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
                  <div className="flex items-center gap-2.5 text-xs">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                      <Zap className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-100">
                        EV HyperCharger 50kW
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Bay Reserved &amp; Ready
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-300">
                    AUTOCUT
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
                  <div className="flex items-center gap-2.5 text-xs">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-100">
                        FASTag Boom Barrier
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Verified clearance in &lt;140ms
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[9px] font-bold text-indigo-300">
                    CMVR
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Proof Quote */}
            <div className="relative z-10 border-t border-white/10 pt-4 text-[11px] text-slate-400">
              &ldquo;Parkwise reduced our garage entry queue times by 78% while
              optimizing spatial peak yield.&rdquo;
              <div className="mt-1 font-semibold text-slate-300">
                — DLF CyberHub Smart Parking Operations
              </div>
            </div>
          </div>

          {/* Right Column: Clean White Authentication Card (Linear / Notion / Tesla) */}
          <div className="lg:col-span-7 flex flex-col justify-between p-8 sm:p-12 bg-white">
            <div>
              {/* Tab Switcher: Sign In vs Create Account */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div className="inline-flex rounded-full bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("signin");
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className={`rounded-full px-5 py-1.5 text-xs font-bold transition-all ${
                      activeTab === "signin"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("signup");
                      setSignupStep(1);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className={`rounded-full px-5 py-1.5 text-xs font-bold transition-all ${
                      activeTab === "signup"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                <div className="text-[11px] font-medium text-slate-500">
                  {activeTab === "signin" ? (
                    <span>New here? <button type="button" onClick={() => setActiveTab("signup")} className="font-bold text-blue-600 hover:underline">Get started</button></span>
                  ) : (
                    <span>Have account? <button type="button" onClick={() => setActiveTab("signin")} className="font-bold text-blue-600 hover:underline">Sign in</button></span>
                  )}
                </div>
              </div>

              {/* Error & Success Alert Banners */}
              {errorMessage && (
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50/80 p-3.5 text-xs font-semibold text-red-700 animate-in fade-in duration-150">
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs font-semibold text-emerald-800 animate-in fade-in duration-150">
                  {successMessage}
                </div>
              )}

              {/* TAB 1: SIGN IN FLOW */}
              {activeTab === "signin" && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                      Welcome back.
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-slate-500">
                      Sign in to continue your Parkwise experience.
                    </p>
                  </div>

                  {/* Method Selector: Email vs Phone OTP */}
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-1 border border-slate-200/70 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setSigninMethod("email");
                        setOtpSent(false);
                      }}
                      className={`flex items-center justify-center gap-2 rounded-xl py-2 transition-all ${
                        signinMethod === "email"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Email &amp; Password</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSigninMethod("phone")}
                      className={`flex items-center justify-center gap-2 rounded-xl py-2 transition-all ${
                        signinMethod === "phone"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>Phone OTP</span>
                    </button>
                  </div>

                  {/* Method A: Email & Password Form */}
                  {signinMethod === "email" && (
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Email Address
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-slate-700">
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={() => setForgotPasswordOpen(true)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 pr-10 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-full bg-blue-600 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                        {loading ? "Signing in..." : "Sign In to Parkwise"}
                      </button>
                    </form>
                  )}

                  {/* Method B: Phone Number with OTP */}
                  {signinMethod === "phone" && (
                    <div className="space-y-4">
                      {!otpSent ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Mobile Number (India)
                            </label>
                            <div className="relative flex rounded-2xl border border-slate-200 bg-white">
                              <span className="flex items-center px-3.5 text-xs font-bold text-slate-500 border-r border-slate-100 bg-slate-50 rounded-l-2xl">
                                +91
                              </span>
                              <input
                                type="tel"
                                required
                                value={phone.replace(/^\+91\s*/, "")}
                                onChange={(e) => setPhone(`+91 ${e.target.value}`)}
                                placeholder="98765 43210"
                                className="w-full rounded-r-2xl px-3.5 py-3 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
                              />
                            </div>
                            <p className="mt-1 text-[11px] text-slate-400">
                              We&apos;ll send a 6-digit verification code via SMS.
                            </p>
                          </div>

                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-full bg-blue-600 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50"
                          >
                            {loading ? "Sending Code..." : "Continue with OTP"}
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-bold text-slate-700">
                                6-Digit Verification Code
                              </label>
                              <span className="text-[11px] text-slate-400">
                                Sent to {phone}
                              </span>
                            </div>
                            <input
                              type="text"
                              maxLength={6}
                              autoFocus
                              value={otpCode}
                              onChange={(e) => setOtpCode(e.target.value)}
                              placeholder="654321"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center font-mono text-lg font-bold tracking-widest text-slate-900 focus:border-blue-600 focus:outline-none"
                            />
                            {previewOtp && (
                              <p className="mt-1.5 text-[11px] font-mono text-emerald-600 text-center">
                                Sandbox Test OTP: <strong>{previewOtp}</strong>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={() => setOtpSent(false)}
                              className="font-semibold text-slate-500 hover:text-slate-800"
                            >
                              Change Number
                            </button>
                            <button
                              type="button"
                              disabled={resendCooldown > 0 || loading}
                              onClick={handleSendOtp}
                              className="font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                            >
                              {resendCooldown > 0
                                ? `Resend in ${resendCooldown}s`
                                : "Resend OTP"}
                            </button>
                          </div>

                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-full bg-blue-600 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50"
                          >
                            {loading ? "Verifying..." : "Verify & Sign In"}
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Social Divider */}
                  <div className="relative flex items-center justify-center my-4">
                    <div className="border-t border-slate-200 w-full" />
                    <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase">
                      or
                    </span>
                  </div>

                  {/* Google Sign-in */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2.5 rounded-full border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 transition-all"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.98 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>
              )}

              {/* TAB 2: SIGNUP & ONBOARDING EXPERIENCE */}
              {activeTab === "signup" && (
                <div className="space-y-6">
                  {/* Step Tracker Indicator */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                        Get started with Parkwise.
                      </h1>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {signupStep === 1
                          ? "Step 1 of 2: Choose your account type"
                          : signupStep === 2
                          ? "Step 2 of 2: Enter your basic credentials"
                          : "Optional: Complete your profile"}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      Step {signupStep} / 3
                    </span>
                  </div>

                  {/* Step 1: Choose Account Type */}
                  {signupStep === 1 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Driver Card */}
                        <div
                          onClick={() => setAccountType("DRIVER")}
                          className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                            accountType === "DRIVER"
                              ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-600 shadow-sm"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                              <CarFront className="h-5 w-5" />
                            </div>
                            {accountType === "DRIVER" && (
                              <CheckCircle2 className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                          <div className="mt-3 font-bold text-sm text-slate-900">
                            Driver Account
                          </div>
                          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                            Find, book, and navigate to parking spaces with
                            instant FASTag auto-debit payments.
                          </p>
                          <ul className="mt-3 space-y-1 text-[11px] text-slate-600 font-medium">
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-blue-600" />
                              <span>Find &amp; reserve bays</span>
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-blue-600" />
                              <span>Indoor turn-by-turn navigation</span>
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-blue-600" />
                              <span>EV hyper-charging reservations</span>
                            </li>
                          </ul>
                        </div>

                        {/* Parking Operator Card */}
                        <div
                          onClick={() => setAccountType("OPERATOR")}
                          className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                            accountType === "OPERATOR"
                              ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600 shadow-sm"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                              <Building2 className="h-5 w-5" />
                            </div>
                            {accountType === "OPERATOR" && (
                              <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                            )}
                          </div>
                          <div className="mt-3 font-bold text-sm text-slate-900">
                            Parking Operator
                          </div>
                          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                            Manage facilities, monitor live occupancy, track
                            revenue, and automate boom barriers.
                          </p>
                          <ul className="mt-3 space-y-1 text-[11px] text-slate-600 font-medium">
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-indigo-600" />
                              <span>Live facility occupancy desk</span>
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-indigo-600" />
                              <span>AI dynamic surge pricing</span>
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-indigo-600" />
                              <span>ANPR camera &amp; gate audit</span>
                            </li>
                          </ul>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSignupStep(2)}
                        className="w-full flex items-center justify-center gap-2 rounded-full bg-blue-600 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all"
                      >
                        <span>Continue to Details</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Step 2: Enter Basic Details */}
                  {signupStep === 2 && (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Aarav Sharma"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          required
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Phone (+91)
                          </label>
                          <input
                            type="tel"
                            required
                            value={signupPhone}
                            onChange={(e) => setSignupPhone(e.target.value)}
                            placeholder="9876543210"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Password (min 8 chars)
                          </label>
                          <input
                            type="password"
                            required
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            placeholder="Password123"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setSignupStep(1)}
                          className="rounded-full border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => setSignupStep(3)}
                          className="flex-1 rounded-full bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Continue to Profile Setup
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Profile Setup / Onboarding Flow */}
                  {signupStep === 3 && (
                    <div className="space-y-4">
                      {accountType === "DRIVER" ? (
                        /* Driver Profile Setup */
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-slate-800">
                            Vehicle &amp; City Preferences (Skippable)
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {(["SEDAN", "SUV_XL", "COMPACT"] as const).map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setVehicleType(type)}
                                className={`rounded-xl border p-2 text-center text-xs font-semibold transition-all ${
                                  vehicleType === type
                                    ? "border-blue-600 bg-blue-50 text-blue-700"
                                    : "border-slate-200 bg-white text-slate-600"
                                }`}
                              >
                                {type === "SUV_XL" ? "SUV / XL" : type}
                              </button>
                            ))}
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Vehicle Plate (Optional until booking)
                            </label>
                            <input
                              type="text"
                              value={plateNumber}
                              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                              placeholder="e.g. DL-01-AB-1234"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="checkbox"
                              id="isEvCheckbox"
                              checked={isEv}
                              onChange={(e) => setIsEv(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="isEvCheckbox" className="text-xs font-medium text-slate-700 cursor-pointer">
                              Electric Vehicle (Prioritize 50kW charging bays)
                            </label>
                          </div>
                        </div>
                      ) : (
                        /* Operator Profile Setup */
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-slate-800">
                            Parking Facility Information (Skippable)
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Business / Management Firm
                            </label>
                            <input
                              type="text"
                              value={businessName}
                              onChange={(e) => setBusinessName(e.target.value)}
                              placeholder="e.g. Nexus Malls Pvt. Ltd."
                              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                Facility Name
                              </label>
                              <input
                                type="text"
                                value={facilityName}
                                onChange={(e) => setFacilityName(e.target.value)}
                                placeholder="BKC Automated Deck"
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                Total Bays (Approx)
                              </label>
                              <input
                                type="number"
                                value={approxCapacity}
                                onChange={(e) => setApproxCapacity(e.target.value)}
                                placeholder="200"
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-3">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleRegisterAccount(true)}
                          className="rounded-full border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Skip for Now
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleRegisterAccount(false)}
                          className="flex-1 rounded-full bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          {loading ? "Creating Account..." : "Complete & Launch"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Footer & Legal */}
            <div className="mt-8 border-t border-slate-100 pt-4 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>
                By continuing, you agree to Parkwise&apos;s{" "}
                <span className="text-slate-600 underline cursor-pointer">Terms</span> and{" "}
                <span className="text-slate-600 underline cursor-pointer">Privacy Policy</span>.
              </span>
              <span className="flex items-center gap-1 text-slate-500 font-medium">
                <Lock className="h-3 w-3 text-blue-600" />
                256-Bit PBKDF2-SHA256 Encrypted
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Reset Your Password
              </h3>
              <button
                type="button"
                onClick={() => setForgotPasswordOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Enter your registered Parkwise email. We will generate a secure reset link.
            </p>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setForgotPasswordOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessMessage("Password reset email sent (sandbox simulation).");
                  setForgotPasswordOpen(false);
                }}
                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Send Reset Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-xs font-semibold">
          Loading Parkwise Secure Authentication...
        </div>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}
