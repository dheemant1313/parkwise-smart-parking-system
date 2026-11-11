"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Accessibility,
  AlertCircle,
  ArrowUpRight,
  BatteryCharging,
  Calendar,
  CarFront,
  CheckCircle2,
  CreditCard,
  Filter,
  QrCode,
  Search,
  Sparkles,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { formatINRPrecise, isValidIndianPlate } from "@/lib/utils";
import { Booking, ParkingSlot, VehicleSize } from "@/types";
import { DriverSubNav } from "@/components/driver/DriverSubNav";
import { InteractiveIndiaMap } from "@/components/driver/InteractiveIndiaMap";
import { QrPassModal } from "@/components/driver/QrPassModal";
import { Canvas3DSkeleton } from "@/components/ui/Skeleton";

const SmartParkingCanvas = dynamic(
  () =>
    import("@/components/three/SmartParkingCanvas").then(
      (m) => m.SmartParkingCanvas
    ),
  {
    ssr: false,
    loading: () => <Canvas3DSkeleton heightClass="h-[400px]" />,
  }
);

export default function DriverBookingPage() {
  const {
    lots,
    vehicles,
    profile,
    createBookingAndVerifyPayment,
    getRecommendations,
  } = useParkwise();

  const primaryVeh = vehicles.find((v) => v.isPrimary) || vehicles[0];

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("ALL");
  const [selectedLotId, setSelectedLotId] = useState<number>(lots[0]?.id || 1);
  const [activeFloor, setActiveFloor] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"2D" | "3D">("2D");
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);

  // Filters: EV, Accessible, Vehicle Size Compatibility
  const [evOnlyFilter, setEvOnlyFilter] = useState<boolean>(false);
  const [accessibleOnlyFilter, setAccessibleOnlyFilter] =
    useState<boolean>(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    primaryVeh?.id || "custom"
  );
  const [vehicleNumber, setVehicleNumber] = useState<string>(
    primaryVeh?.plateNumber || "DL-08-CAF-8921"
  );
  const [vehicleSize, setVehicleSize] = useState<VehicleSize>(
    primaryVeh?.size || "SEDAN"
  );

  // Arrival Date/Time & Duration
  const [arrivalDateTime, setArrivalDateTime] = useState<string>(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [durationHours, setDurationHours] = useState<number>(2);
  const [driverName, setDriverName] = useState<string>(profile.fullName);
  const [driverPhone, setDriverPhone] = useState<string>(profile.phone);
  const [paymentMethod, setPaymentMethod] = useState<string>(
    "UPI / FASTag Auto-Debit"
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(
    null
  );
  const [modalBooking, setModalBooking] = useState<Booking | null>(null);

  // Filtered Lots by Location Search & City
  const filteredLots = useMemo(() => {
    return lots.filter((lot) => {
      if (
        cityFilter !== "ALL" &&
        lot.city.toLowerCase() !== cityFilter.toLowerCase()
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay =
          `${lot.name} ${lot.city} ${lot.address} ${lot.code}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [lots, cityFilter, searchQuery]);

  const selectedLot = useMemo(
    () =>
      filteredLots.find((l) => l.id === selectedLotId) ||
      lots.find((l) => l.id === selectedLotId) ||
      lots[0],
    [filteredLots, lots, selectedLotId]
  );

  // Deterministic Recommendations Engine
  const recommendations = useMemo(
    () =>
      getRecommendations({
        searchQuery,
        city: cityFilter === "ALL" ? undefined : cityFilter,
        targetLatitude: selectedLot.latitude,
        targetLongitude: selectedLot.longitude,
        vehicleSize,
        requiresEv: evOnlyFilter,
        requiresAccessible: accessibleOnlyFilter,
        durationHours,
      }),
    [
      getRecommendations,
      searchQuery,
      cityFilter,
      selectedLot.latitude,
      selectedLot.longitude,
      vehicleSize,
      evOnlyFilter,
      accessibleOnlyFilter,
      durationHours,
    ]
  );

  // Filtered Slots on Active Floor
  const floorSlots = useMemo(() => {
    return selectedLot.slots.filter((s) => {
      if (s.floor !== activeFloor) return false;
      if (evOnlyFilter && s.slot_type !== "EV_CHARGING") return false;
      if (accessibleOnlyFilter && s.slot_type !== "ACCESSIBLE") return false;
      return true;
    });
  }, [selectedLot, activeFloor, evOnlyFilter, accessibleOnlyFilter]);

  const selectedSlot: ParkingSlot | null = useMemo(
    () =>
      selectedLot.slots.find((s) => s.id === selectedSlotId) ||
      floorSlots.find((s) => s.status === "AVAILABLE") ||
      null,
    [selectedLot, selectedSlotId, floorSlots]
  );

  const isSelectedBaySizeCompatible = useMemo(() => {
    if (!selectedSlot) return true;
    if (vehicleSize === "SUV_XL" && selectedSlot.slot_type === "STANDARD") {
      return false;
    }
    return true;
  }, [selectedSlot, vehicleSize]);

  const pricing = useMemo(() => {
    if (!selectedSlot) {
      return { base: 0, gst: 0, total: 0, rate: 0, surge: 1 };
    }
    let hourly = selectedLot.base_hourly_rate_inr;
    if (selectedSlot.slot_type === "EV_CHARGING") {
      hourly += selectedLot.ev_surcharge_inr;
    } else if (selectedSlot.slot_type === "SUV_XL") {
      hourly += 25;
    }
    const surge = selectedLot.dynamic_pricing_enabled
      ? selectedLot.current_surge_multiplier
      : 1.0;
    const base = Math.round(hourly * durationHours * surge * 100) / 100;
    const gst = Math.round(base * 0.18 * 100) / 100;
    const total = Math.round((base + gst) * 100) / 100;
    return { base, gst, total, rate: hourly, surge };
  }, [selectedLot, selectedSlot, durationHours]);

  function handleVehicleDropdownChange(vehId: string) {
    setSelectedVehicleId(vehId);
    const found = vehicles.find((v) => v.id === vehId);
    if (found) {
      setVehicleNumber(found.plateNumber);
      setVehicleSize(found.size);
      if (found.isEv) setEvOnlyFilter(true);
    }
  }

  async function handleReserveAndPay(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedSlot) {
      setErrorMsg("Please select an available parking bay.");
      return;
    }

    if (!isValidIndianPlate(vehicleNumber)) {
      setErrorMsg(
        "Please enter a valid Indian registration number (e.g., DL-08-CAF-8921 or MH-01-AB-4589)."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedStart = new Date(arrivalDateTime);
      const start = isNaN(parsedStart.getTime()) ? new Date() : parsedStart;
      const end = new Date(start.getTime() + durationHours * 3600 * 1000);

      const created = await createBookingAndVerifyPayment({
        lotId: selectedLot.id,
        slotId: selectedSlot.id,
        vehicleNumber,
        vehicleSize,
        driverName,
        driverPhone,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        paymentMethod,
      });
      setConfirmedBooking(created);
      setModalBooking(created);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to complete reservation."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-soft pb-20">
      <DriverSubNav />

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8 space-y-8">
        {/* 1. DRIVER HOMEPAGE HEADER & LOCATION SEARCH BAR */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
                Phase 02 • Parkwise Driver Mobility Hub
              </span>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Search, Compare &amp; Reserve Verified Parking Bays
              </h1>
            </div>

            {/* Search Input + Metro Filter */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:w-72">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  aria-label="Search destination, mall, or city"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Connaught Place, BKC, CyberHub..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-brand-600 focus:bg-white focus:outline-none"
                />
              </div>

              <select
                aria-label="Filter by Metropolitan City"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="ALL">All 5 Metros</option>
                <option value="New Delhi">New Delhi</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Bengaluru">Bengaluru</option>
                <option value="Gurugram">Gurugram</option>
                <option value="Hyderabad">Hyderabad</option>
              </select>
            </div>
          </div>

          {/* Filter Pills: EV Charging, Accessible, Vehicle Size Compatibility */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-slate-400">
                <Filter className="h-3 w-3" />
                Smart Filters:
              </span>
              <button
                type="button"
                onClick={() => setEvOnlyFilter((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                  evOnlyFilter
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400"
                }`}
              >
                <BatteryCharging className="h-3.5 w-3.5" />
                <span>50kW EV Charging Only</span>
              </button>

              <button
                type="button"
                onClick={() => setAccessibleOnlyFilter((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                  accessibleOnlyFilter
                    ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-brand-400"
                }`}
              >
                <Accessibility className="h-3.5 w-3.5" />
                <span>Accessible Ground Bays</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500">
                Vehicle Size Class:
              </span>
              {(["COMPACT", "SEDAN", "SUV_XL"] as VehicleSize[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setVehicleSize(sz)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                    vehicleSize === sz
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {sz.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. INTERACTIVE MAP + DETERMINISTIC RECOMMENDATIONS */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <InteractiveIndiaMap
              lots={filteredLots.length > 0 ? filteredLots : lots}
              selectedLotId={selectedLot.id}
              onSelectLot={(id) => {
                setSelectedLotId(id);
                setSelectedSlotId(null);
              }}
            />
          </div>

          {/* Deterministic Recommendation Engine Panel */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-apple lg:col-span-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-600" />
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Top Recommended Bays for You
                  </h2>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-brand-700">
                  Deterministic Score
                </span>
              </div>

              <div className="mt-3 max-h-[250px] overflow-y-auto space-y-2.5 pr-1">
                {recommendations.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">
                    No bays match your exact filter combination. Try toggling off
                    strict filters above.
                  </p>
                ) : (
                  recommendations.map((rec) => {
                    const isPicked =
                      selectedSlot?.id === rec.slotId &&
                      selectedLot.id === rec.lotId;
                    return (
                      <button
                        key={`${rec.lotId}-${rec.slotId}`}
                        type="button"
                        onClick={() => {
                          setSelectedLotId(rec.lotId);
                          setActiveFloor(rec.floor);
                          setSelectedSlotId(rec.slotId);
                          setErrorMsg(null);
                        }}
                        className={`w-full rounded-2xl border p-3 text-left transition-all ${
                          isPicked
                            ? "border-brand-600 bg-brand-50/60 ring-2 ring-brand-500/20"
                            : "border-slate-200 bg-slate-50/70 hover:border-brand-300 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-slate-900">
                              {rec.slotNumber}
                            </span>
                            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-brand-600 border border-slate-200">
                              {rec.slotType.replace("_", " ")}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              • {rec.city}
                            </span>
                          </div>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-extrabold text-emerald-800">
                            {rec.matchScore}% Match
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-600">
                          <span className="truncate">
                            {rec.reasons.slice(0, 2).join(" • ")}
                          </span>
                          <span className="font-bold text-slate-900">
                            ₹{rec.estimatedTotalInr} ({durationHours}h)
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                Ranked by distance, {vehicleSize} size, EV/Accessible &amp; price
              </span>
              <Link
                href={`/driver/lots/${selectedLot.id}`}
                className="inline-flex items-center gap-1 font-bold text-brand-600 hover:underline"
              >
                <span>Full Lot Details</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* 3. MAIN RESERVATION WORKSPACE: LOT/SLOT VISUALIZER + BOOKING CHECKOUT */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* LEFT: Facility Cards + Visual Slot Selection (2D & 3D) */}
          <div className="space-y-6 lg:col-span-7">
            {/* Facility Cards */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  1. Select Parking Facility ({filteredLots.length} Available)
                </span>
                <Link
                  href={`/driver/lots/${selectedLot.id}`}
                  className="text-xs font-bold text-brand-600 hover:underline"
                >
                  Inspect {selectedLot.code} Details →
                </Link>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(filteredLots.length > 0 ? filteredLots : lots).map((lot) => {
                  const isSelected = lot.id === selectedLot.id;
                  return (
                    <div
                      key={lot.id}
                      onClick={() => {
                        setSelectedLotId(lot.id);
                        setSelectedSlotId(null);
                        setErrorMsg(null);
                      }}
                      className={`cursor-pointer flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                        isSelected
                          ? "border-brand-600 bg-brand-50/40 ring-2 ring-brand-600/20"
                          : "border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700 border border-slate-200">
                            {lot.city}
                          </span>
                          <span className="text-xs font-bold text-brand-600">
                            ₹{lot.base_hourly_rate_inr}/hr
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-900">
                          {lot.name}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-slate-500">
                        <span className="text-emerald-600 font-semibold">
                          {lot.available_slots} / {lot.total_slots} Bays Free
                        </span>
                        <Link
                          href={`/driver/lots/${lot.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold text-brand-600 hover:underline"
                        >
                          Details →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Visual Bay Matrix (Available, Reserved, Occupied, EV Charging, Accessible, SUV XL) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    2. Interactive Bay Visualization
                  </span>
                  <h2 className="text-base font-bold text-slate-900">
                    {selectedLot.name} — Deck Floor 0{activeFloor}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {[1, 2].map((fl) => (
                    <button
                      key={fl}
                      type="button"
                      onClick={() => setActiveFloor(fl)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                        activeFloor === fl
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Floor 0{fl}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setViewMode((prev) => (prev === "2D" ? "3D" : "2D"))
                    }
                    className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"
                  >
                    {viewMode === "2D" ? "Switch to 3D Deck" : "Switch to 2D Map"}
                  </button>
                </div>
              </div>

              {/* Visual Slot Legend */}
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 px-3.5 py-2 text-[11px] font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                  Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  EV Charging (50kW)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                  Accessible
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  Reserved
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                  Occupied
                </span>
              </div>

              {viewMode === "3D" ? (
                <div className="mt-4">
                  <SmartParkingCanvas
                    slots={selectedLot.slots}
                    activeFloor={activeFloor}
                    selectedSlotId={selectedSlot?.id || null}
                    onSelectSlot={(slot) => {
                      setSelectedSlotId(slot.id);
                      setErrorMsg(null);
                    }}
                    heightClass="h-[390px]"
                  />
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {floorSlots.map((slot) => {
                    const isChosen = selectedSlot?.id === slot.id;
                    const isIncompatibleSuv =
                      vehicleSize === "SUV_XL" &&
                      slot.slot_type === "STANDARD";

                    let badgeStyle =
                      "border-slate-200 bg-white hover:border-brand-400 text-slate-800";
                    if (isChosen) {
                      badgeStyle =
                        "border-brand-600 bg-brand-600 text-white shadow-stripe";
                    } else if (slot.status === "RESERVED") {
                      badgeStyle =
                        "border-amber-200 bg-amber-50/80 text-amber-800";
                    } else if (slot.status === "OCCUPIED") {
                      badgeStyle =
                        "border-slate-200 bg-slate-100 text-slate-400";
                    } else if (slot.status === "MAINTENANCE") {
                      badgeStyle = "border-red-200 bg-red-50/70 text-red-700";
                    } else if (slot.slot_type === "EV_CHARGING") {
                      badgeStyle =
                        "border-emerald-200 bg-emerald-50/40 text-slate-900 hover:border-emerald-500";
                    } else if (slot.slot_type === "ACCESSIBLE") {
                      badgeStyle =
                        "border-cyan-200 bg-cyan-50/40 text-slate-900 hover:border-cyan-500";
                    }

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => {
                          setSelectedSlotId(slot.id);
                          setErrorMsg(null);
                        }}
                        className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all ${badgeStyle}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-extrabold">
                            {slot.slot_number}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                              isChosen
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {slot.slot_type.replace("_", " ")}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold">
                          <span>{slot.status}</span>
                          {slot.power_kw && <span>⚡ {slot.power_kw}kW</span>}
                          {!slot.power_kw && isIncompatibleSuv && (
                            <span className="text-[9px] text-amber-600">
                              Compact/Sedan
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Arrival Time, Duration, Vehicle Selection, Summary & Checkout */}
          <div className="space-y-6 lg:col-span-5">
            <form
              onSubmit={handleReserveAndPay}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                    3. Booking Summary &amp; Checkout
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">
                    Arrival Window, Vehicle &amp; Fare
                  </h2>
                </div>
                <Link
                  href="/driver/profile"
                  className="text-xs font-bold text-brand-600 hover:underline"
                >
                  Manage Garage →
                </Link>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-700"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {!isSelectedBaySizeCompatible && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                  Size Compatibility Notice: Your vehicle is set to{" "}
                  <strong>SUV XL</strong>, while Bay{" "}
                  <strong>{selectedSlot?.slot_number}</strong> is a Standard bay.
                  Please pick an SUV XL, EV, or Accessible bay.
                </div>
              )}

              {/* Arrival Date & Time + Duration Selection */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="arrival-datetime"
                    className="flex items-center gap-1 text-xs font-bold text-slate-700"
                  >
                    <Calendar className="h-3.5 w-3.5 text-brand-600" />
                    <span>Arrival Date &amp; Time</span>
                  </label>
                  <input
                    id="arrival-datetime"
                    type="datetime-local"
                    required
                    value={arrivalDateTime}
                    onChange={(e) => setArrivalDateTime(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="duration-select"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Parking Duration
                  </label>
                  <select
                    id="duration-select"
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    {[1, 2, 3, 4, 6, 8, 12, 24].map((hrs) => (
                      <option key={hrs} value={hrs}>
                        {hrs} {hrs === 1 ? "Hour" : "Hours"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Saved Vehicle Selector + Plate Input */}
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="saved-vehicle-select"
                    className="flex items-center gap-1 text-xs font-bold text-slate-700"
                  >
                    <CarFront className="h-3.5 w-3.5 text-brand-600" />
                    <span>Select From Your Saved Vehicles</span>
                  </label>
                  <select
                    id="saved-vehicle-select"
                    value={selectedVehicleId}
                    onChange={(e) =>
                      handleVehicleDropdownChange(e.target.value)
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber} — {v.modelName} ({v.size}
                        {v.isEv ? " • EV" : ""})
                      </option>
                    ))}
                    <option value="custom">+ Enter Another RTO Plate</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="vehicle-plate"
                      className="block text-xs font-bold text-slate-700"
                    >
                      RTO License Plate
                    </label>
                    <input
                      id="vehicle-plate"
                      type="text"
                      required
                      value={vehicleNumber}
                      onChange={(e) =>
                        setVehicleNumber(e.target.value.toUpperCase())
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs font-bold uppercase text-slate-900"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="payment-method"
                      className="block text-xs font-bold text-slate-700"
                    >
                      Payment Rail
                    </label>
                    <select
                      id="payment-method"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    >
                      <option value="UPI / FASTag Auto-Debit">
                        UPI / FASTag Auto-Debit
                      </option>
                      <option value="Razorpay UPI (GPay / PhonePe)">
                        Razorpay UPI (GPay / PhonePe)
                      </option>
                      <option value="Corporate Fleet Wallet">
                        Corporate Fleet Wallet
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Driver Contact */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="driver-name"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Driver Full Name
                  </label>
                  <input
                    id="driver-name"
                    type="text"
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="driver-phone"
                    className="block text-xs font-bold text-slate-700"
                  >
                    Mobile Number
                  </label>
                  <input
                    id="driver-phone"
                    type="text"
                    required
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              {/* Booking Summary Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Selected Facility &amp; Bay</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedLot.code} • {selectedSlot?.slot_number || "None"} (
                    {selectedSlot?.slot_type})
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    Base Tariff ({formatINRPrecise(pricing.rate)}/hr ×{" "}
                    {durationHours}h)
                  </span>
                  <span className="font-semibold">
                    {formatINRPrecise(pricing.rate * durationHours)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>AI Dynamic Surge Multiplier</span>
                  <span className="font-mono font-bold text-brand-600">
                    {pricing.surge.toFixed(2)}x
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>18% GST (CGST + SGST)</span>
                  <span className="font-semibold">
                    {formatINRPrecise(pricing.gst)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
                  <span>Total Payable</span>
                  <span className="text-brand-600">
                    {formatINRPrecise(pricing.total)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedSlot}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3.5 text-sm font-bold text-white shadow-stripe transition-all hover:bg-brand-700 disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                <span>
                  {isSubmitting
                    ? "Locking Bay & Verifying Payment..."
                    : `Confirm & Pay ${formatINRPrecise(pricing.total)}`}
                </span>
              </button>
            </form>

            {/* Instant Confirmation Banner */}
            {confirmedBooking && (
              <div className="rounded-3xl border-2 border-emerald-500 bg-white p-6 shadow-apple space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    BOOKING CONFIRMED
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {confirmedBooking.booking_reference}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setModalBooking(confirmedBooking)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>Open QR Gate Pass &amp; Receipt</span>
                  </button>
                  <Link
                    href="/driver/bookings"
                    className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-white"
                  >
                    Manage / Extend →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Pass & GST Receipt Modal */}
      <QrPassModal
        booking={modalBooking}
        onClose={() => setModalBooking(null)}
      />
    </div>
  );
}
