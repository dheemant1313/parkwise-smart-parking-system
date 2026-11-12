"use client";

import React, { useState } from "react";
import {
  Accessibility,
  AlertCircle,
  Car,
  CheckCircle2,
  CreditCard,
  Plus,
  Ruler,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Zap,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { isValidIndianPlate } from "@/lib/utils";
import { DriverSubNav } from "@/components/driver/DriverSubNav";
import { VehicleSize } from "@/types";
import { ProtectedRouteGate } from "@/components/auth/ProtectedRouteGate";

const SIZE_DIMENSIONS_MAP: Record<
  VehicleSize,
  { dims: string; description: string; bayFit: string }
> = {
  COMPACT: {
    dims: "3.99m × 1.80m × 1.55m",
    description: "Hatchbacks & Sub-4m Compact Crossovers",
    bayFit: "Compatible with all Standard, EV, Accessible & SUV XL bays",
  },
  SEDAN: {
    dims: "4.58m × 1.82m × 1.50m",
    description: "Executive Sedans & Mid-size Coupes",
    bayFit: "Compatible with Standard, EV, Accessible & SUV XL bays",
  },
  SUV_XL: {
    dims: "4.85m × 1.92m × 1.78m",
    description: "Full-size 7-Seater SUVs, MPVs & Luxury EVs",
    bayFit: "Prioritizes wide-turning SUV_XL (3.2m width) & EV bays",
  },
};

export default function DriverProfilePage() {
  const {
    vehicles,
    profile,
    addVehicle,
    removeVehicle,
    setPrimaryVehicle,
    updateProfile,
  } = useParkwise();

  // New vehicle state
  const [plateNumber, setPlateNumber] = useState("");
  const [modelName, setModelName] = useState("");
  const [vehicleSize, setVehicleSize] = useState<VehicleSize>("SEDAN");
  const [isEv, setIsEv] = useState(false);
  const [fastagId, setFastagId] = useState("FT-NPCI-ICICI-8840");
  const [vehicleMsg, setVehicleMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Profile form state
  const [fullName, setFullName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [homeCity, setHomeCity] = useState(profile.homeCity);
  const [gstNumber, setGstNumber] = useState(profile.gstNumber || "");
  const [profileSaved, setProfileSaved] = useState(false);

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    setVehicleMsg(null);
    const normalizedPlate = plateNumber.trim().toUpperCase();

    if (!isValidIndianPlate(normalizedPlate)) {
      setVehicleMsg({
        type: "error",
        text: "Enter a valid Indian RTO registration plate (e.g. DL-08-CAF-8921 or KA-01-MJ-2044).",
      });
      return;
    }

    if (!modelName.trim()) {
      setVehicleMsg({
        type: "error",
        text: "Please enter the vehicle make and model name.",
      });
      return;
    }

    addVehicle({
      plateNumber: normalizedPlate,
      modelName: modelName.trim(),
      size: vehicleSize,
      dimensionsLabel: SIZE_DIMENSIONS_MAP[vehicleSize].dims,
      isEv,
      fastagId: fastagId.trim() || "FT-NPCI-AUTO-0091",
      isPrimary: vehicles.length === 0,
    });

    setPlateNumber("");
    setModelName("");
    setVehicleMsg({
      type: "success",
      text: `Vehicle ${normalizedPlate} added to your garage with ${vehicleSize} bay compatibility.`,
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      fullName: fullName.trim() || profile.fullName,
      email: email.trim() || profile.email,
      phone: phone.trim() || profile.phone,
      homeCity,
      gstNumber: gstNumber.trim(),
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3500);
  };

  return (
    <ProtectedRouteGate
      allowedRoles={["DRIVER", "ADMIN"]}
      applicationName="Driver Profile & Garage"
    >
      <div className="min-h-screen bg-[#F8FAFC] pb-24">
        <DriverSubNav />

      {/* Header */}
      <section className="border-b border-slate-200/80 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Car className="h-3.5 w-3.5" />
            <span>GARAGE, VEHICLE DIMENSIONS, FASTAG &amp; DRIVER SETTINGS</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Vehicle Garage &amp; Driver Profile
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Manage registered Indian RTO vehicles, configure physical dimension
            compatibility for automated slot matching, and control NPCI FASTag
            zero-stop gate entry preferences.
          </p>
        </div>
      </section>

      <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left 7 Cols: Vehicle Management & Size Compatibility */}
          <div className="space-y-6 lg:col-span-7">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Registered Vehicles ({vehicles.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Your primary vehicle is automatically selected for ANPR gate
                    recognition and deterministic slot recommendations.
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  ANPR + FASTag Synced
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {vehicles.map((v) => (
                  <div
                    key={v.id}
                    className={`rounded-2xl border p-5 transition ${
                      v.isPrimary
                        ? "border-blue-600 bg-blue-50/30 shadow-xs"
                        : "border-slate-200 bg-slate-50/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-slate-900 px-3 py-1 font-mono text-sm font-bold tracking-wider text-white">
                            {v.plateNumber}
                          </span>
                          {v.isPrimary && (
                            <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                              Primary Vehicle
                            </span>
                          )}
                          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-800">
                            {v.size}
                          </span>
                          {v.isEv && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                              <Zap className="h-3 w-3" />
                              EV 50kW CCS2
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-base font-bold text-slate-900">
                          {v.modelName}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        {!v.isPrimary && (
                          <button
                            type="button"
                            onClick={() => setPrimaryVehicle(v.id)}
                            className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Set Primary
                          </button>
                        )}
                        {vehicles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVehicle(v.id)}
                            className="rounded-xl border border-rose-200 bg-white p-2 text-rose-600 hover:bg-rose-50"
                            title="Remove vehicle"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-slate-200/70 bg-white p-3 text-xs text-slate-600 sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-blue-600" />
                        <span>
                          Dimensions:{" "}
                          <strong className="text-slate-900">
                            {v.dimensionsLabel}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-emerald-600" />
                        <span>
                          FASTag:{" "}
                          <strong className="font-mono text-slate-900">
                            {v.fastagId}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add New Vehicle Form */}
            <form
              onSubmit={handleAddVehicle}
              className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                <Plus className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  Add Vehicle to Garage
                </h2>
              </div>

              {vehicleMsg && (
                <div
                  className={`mt-4 flex items-center gap-2 rounded-2xl border p-3.5 text-xs font-semibold ${
                    vehicleMsg.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                  }`}
                >
                  {vehicleMsg.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  )}
                  <span>{vehicleMsg.text}</span>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Indian RTO Registration Plate
                  </label>
                  <input
                    type="text"
                    value={plateNumber}
                    onChange={(e) =>
                      setPlateNumber(e.target.value.toUpperCase())
                    }
                    placeholder="e.g. KA-01-MJ-2044"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs font-bold uppercase text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Vehicle Make &amp; Model
                  </label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g. Hyundai Ioniq 5 / Mahindra XUV700"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Vehicle Size & Bay Compatibility Selector */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-700">
                  Vehicle Size &amp; Bay Dimension Compatibility
                </label>
                <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {(["COMPACT", "SEDAN", "SUV_XL"] as VehicleSize[]).map(
                    (size) => {
                      const info = SIZE_DIMENSIONS_MAP[size];
                      const active = vehicleSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setVehicleSize(size)}
                          className={`rounded-2xl border p-3 text-left transition ${
                            active
                              ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/15"
                              : "border-slate-200 bg-slate-50/60 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">
                              {size}
                            </span>
                            <span className="font-mono text-[10px] font-semibold text-blue-700">
                              {info.dims.split("×")[0]}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] font-medium text-slate-600">
                            {info.dims}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {info.description}
                          </p>
                        </button>
                      );
                    }
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-blue-700">
                  <strong>Compatibility Rule:</strong>{" "}
                  {SIZE_DIMENSIONS_MAP[vehicleSize].bayFit}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    NPCI FASTag Tag ID
                  </label>
                  <input
                    type="text"
                    value={fastagId}
                    onChange={(e) => setFastagId(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={isEv}
                      onChange={(e) => setIsEv(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Zap className="h-4 w-4 text-emerald-600" />
                    <span>EV Vehicle (Requires 50kW CCS2 Bay)</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Register Vehicle in Garage
              </button>
            </form>
          </div>

          {/* Right 5 Cols: Driver Profile & Smart Preferences */}
          <div className="space-y-6 lg:col-span-5">
            <form
              onSubmit={handleSaveProfile}
              className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-bold text-slate-900">
                    Driver Account &amp; Preferences
                  </h2>
                </div>
                {profileSaved && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Saved
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Mobile Number (SMS/WhatsApp)
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Home Metro Cluster
                    </label>
                    <select
                      value={homeCity}
                      onChange={(e) => setHomeCity(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    >
                      <option value="New Delhi">New Delhi (NCR)</option>
                      <option value="Mumbai">Mumbai (MMR)</option>
                      <option value="Bengaluru">Bengaluru</option>
                      <option value="Hyderabad">Hyderabad</option>
                      <option value="Chennai">Chennai</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Corporate GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      value={gstNumber}
                      onChange={(e) =>
                        setGstNumber(e.target.value.toUpperCase())
                      }
                      placeholder="07AABCP9981K1Z5"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs uppercase text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Smart Toggles */}
                <div className="space-y-2.5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Automation &amp; Accessibility Toggles
                  </p>

                  {[
                    {
                      key: "fastagAutoDebit" as const,
                      label: "NPCI FASTag Boom-Barrier Auto-Debit",
                      desc: "Automatically settle overstay or pre-authorized entry via RFID reader",
                    },
                    {
                      key: "whatsappPassAlerts" as const,
                      label: "WhatsApp HMAC QR Pass Delivery",
                      desc: "Receive encrypted gate QR passes and extension reminders on WhatsApp",
                    },
                    {
                      key: "smsReceipts" as const,
                      label: "Instant 18% GST Invoice via SMS & Email",
                      desc: "Send downloadable tax receipts immediately upon checkout",
                    },
                    {
                      key: "accessiblePriority" as const,
                      label: "Accessible / Senior-Citizen Bay Priority",
                      desc: "Boost ground-floor wide-access bays near elevator cores in recommendations",
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 hover:bg-slate-100/70"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {item.desc}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={profile[item.key]}
                        onChange={(e) =>
                          updateProfile({ [item.key]: e.target.checked })
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-slate-900 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600"
                >
                  Save Profile &amp; Preferences
                </button>
              </div>
            </form>

            {/* Security & Privacy Card */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
                <ShieldCheck className="h-4 w-4" />
                <span>Zero-Trust Payment &amp; ANPR Privacy</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Parkwise never trusts client-side payment flags. Every booking
                is verified server-side via Razorpay HMAC-SHA256 signatures and
                locked with PostgreSQL row-level transactions.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-700">
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1">
                  <Sparkles className="h-3 w-3 text-blue-600" />
                  DPDP Act 2023 Compliant
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1">
                  <Accessibility className="h-3 w-3 text-emerald-600" />
                  WCAG 2.1 AA Accessible
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRouteGate>
  );
}
