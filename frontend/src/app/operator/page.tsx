"use client";

import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Building2,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  IndianRupee,
  Layers,
  MapPin,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useParkwise } from "@/lib/store";
import { formatDateTime, formatINR } from "@/lib/utils";
import { PricingRuleItem, SlotStatus, SlotType } from "@/types";
import { ProtectedRouteGate } from "@/components/auth/ProtectedRouteGate";

export default function OperatorDashboardPage() {
  const {
    lots,
    bookings,
    updateSlotStatus,
    updateLotSurge,
    getAIForecast,
    createParkingLocation,
    addParkingFloor,
    addParkingZone,
    createParkingBay,
    assignParkingBayType,
    updateLocationSchedule,
    addPricingRule,
    checkTimeRangeAvailability,
    calculateDurationAndQuote,
    releaseExpiredReservations,
    applyAdditionalCharges,
    cancelBooking,
  } = useParkwise();

  const [selectedLotId, setSelectedLotId] = useState<number>(lots[0]?.id || 1);
  const [engineTab, setEngineTab] = useState<
    "INVENTORY" | "SCHEDULE_PRICING" | "AVAILABILITY_QUOTE"
  >("INVENTORY");
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const activeLot = useMemo(
    () => lots.find((l) => l.id === selectedLotId) || lots[0],
    [lots, selectedLotId]
  );

  const aiForecast = useMemo(
    () => getAIForecast(activeLot.id),
    [getAIForecast, activeLot.id]
  );

  const lotBookings = useMemo(
    () => bookings.filter((b) => b.lot_id === activeLot.id),
    [bookings, activeLot.id]
  );

  const lotRevenue = useMemo(
    () =>
      lotBookings.reduce(
        (acc, b) => acc + b.total_amount_inr + b.overstay_fee_inr,
        0
      ) + 18450,
    [lotBookings]
  );

  const occupancyPct = useMemo(() => {
    const active = activeLot.occupied_slots + activeLot.reserved_slots;
    return Math.round((active / Math.max(1, activeLot.total_slots)) * 100);
  }, [activeLot]);

  // 1. New Parking Location Form State
  const [newLocCode, setNewLocCode] = useState("PW-PUN-06");
  const [newLocName, setNewLocName] = useState(
    "Hinjawadi Phase 2 CyberHub Smart Deck"
  );
  const [newLocCity, setNewLocCity] = useState("Pune");
  const [newLocAddress, setNewLocAddress] = useState(
    "Rajiv Gandhi Infotech Park, Hinjawadi, Pune 411057"
  );
  const [newLocRate, setNewLocRate] = useState(75);
  const [newLocEvSurcharge, setNewLocEvSurcharge] = useState(40);
  const [newLocFloors, setNewLocFloors] = useState(3);

  // 2. Floor, Zone & Bay Builder State
  const [floorNum, setFloorNum] = useState(3);
  const [floorName, setFloorName] = useState("Level B3 — Executive EV & SUV Deck");
  const [clearanceCm, setClearanceCm] = useState(230);

  const [zoneFloorNum, setZoneFloorNum] = useState(1);
  const [zoneCode, setZoneCode] = useState("C");
  const [zoneName, setZoneName] = useState("Zone C • Hypercharge & Fleet Wing");
  const [zoneType, setZoneType] = useState("EV_PRIORITY");

  const [bayNumber, setBayNumber] = useState("F1-C17");
  const [bayFloor, setBayFloor] = useState(1);
  const [bayZone, setBayZone] = useState("A");
  const [bayType, setBayType] = useState<SlotType>("EV_CHARGING");
  const [bayCategory, setBayCategory] = useState("EV_FOUR_WHEELER");
  const [bayPowerKw, setBayPowerKw] = useState(50);

  // 3. Opening Hours & Pricing Rule State
  const [openTime, setOpenTime] = useState(activeLot.opening_time || "06:00");
  const [closeTime, setCloseTime] = useState(activeLot.closing_time || "23:59");
  const [is24Hours, setIs24Hours] = useState(activeLot.is_24_hours ?? true);
  const [graceMins, setGraceMins] = useState(
    activeLot.grace_period_minutes ?? 15
  );
  const [holdMins, setHoldMins] = useState(
    activeLot.reservation_hold_minutes ?? 15
  );

  const [ruleName, setRuleName] = useState("Evening Corporate Rush Tariff");
  const [ruleType, setRuleType] =
    useState<PricingRuleItem["rule_type"]>("PEAK_HOUR");
  const [ruleMult, setRuleMult] = useState(1.25);
  const [ruleFlatInr, setRuleFlatInr] = useState(20);
  const [ruleSlotType, setRuleSlotType] = useState("ALL");

  // 4. Time-Range Availability & Duration Quote State
  const [rangeStart, setRangeStart] = useState("2026-11-12T10:00");
  const [rangeEnd, setRangeEnd] = useState("2026-11-12T13:30");
  const [rangeSlotFilter, setRangeSlotFilter] = useState<SlotType | "ALL">("ALL");
  const [quoteSlotId, setQuoteSlotId] = useState<number>(
    activeLot.slots[0]?.id || 101
  );
  const [quoteVehicleCat, setQuoteVehicleCat] = useState("EV_FOUR_WHEELER");
  const [quoteValet, setQuoteValet] = useState(true);
  const [quoteEvFast, setQuoteEvFast] = useState(true);
  const [quoteOverstayMins, setQuoteOverstayMins] = useState(30);

  // 5. Additional Charges Calculator for Existing Booking
  const [chargeBookingRef, setChargeBookingRef] = useState(
    bookings[0]?.booking_reference || "PW-2026-8901"
  );
  const [chargeOverstayMins, setChargeOverstayMins] = useState(45);
  const [chargeEvKwh, setChargeEvKwh] = useState(16.5);
  const [chargeValet, setChargeValet] = useState(true);

  const availabilityReport = useMemo(() => {
    const sIso = new Date(rangeStart).toISOString();
    const eIso = new Date(rangeEnd).toISOString();
    return checkTimeRangeAvailability({
      lotId: activeLot.id,
      startTime: sIso,
      endTime: eIso,
      slotType: rangeSlotFilter,
    });
  }, [
    checkTimeRangeAvailability,
    activeLot.id,
    rangeStart,
    rangeEnd,
    rangeSlotFilter,
  ]);

  const quoteReport = useMemo(() => {
    const sIso = new Date(rangeStart).toISOString();
    const eIso = new Date(rangeEnd).toISOString();
    return calculateDurationAndQuote({
      lotId: activeLot.id,
      slotId: quoteSlotId,
      startTime: sIso,
      endTime: eIso,
      vehicleCategory: quoteVehicleCat,
      includeValetService: quoteValet,
      includeEvFastCharge: quoteEvFast,
      overstayMinutes: quoteOverstayMins,
    });
  }, [
    calculateDurationAndQuote,
    activeLot.id,
    quoteSlotId,
    rangeStart,
    rangeEnd,
    quoteVehicleCat,
    quoteValet,
    quoteEvFast,
    quoteOverstayMins,
  ]);

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createParkingLocation({
        code: newLocCode,
        name: newLocName,
        city: newLocCity,
        address: newLocAddress,
        latitude: 18.5913,
        longitude: 73.7389,
        totalFloors: newLocFloors,
        baseHourlyRateInr: newLocRate,
        evSurchargeInr: newLocEvSurcharge,
        operatorName: "Parkwise Metro Partner Pvt. Ltd.",
        is24Hours: true,
        openingTime: "00:00",
        closingTime: "23:59",
      });
      setSelectedLotId(created.id);
      setFeedbackBanner({
        type: "success",
        text: `Created parking location ${created.name} (${created.code}) with ${created.slots.length} bays and ${created.floors?.length || 2} floors.`,
      });
    } catch (err) {
      setFeedbackBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to create location.",
      });
    }
  };

  const handleAddFloorAndZone = async () => {
    try {
      await addParkingFloor(activeLot.id, {
        floorNumber: floorNum,
        floorName,
        clearanceHeightCm: clearanceCm,
      });
      await addParkingZone(activeLot.id, {
        floorNumber: zoneFloorNum,
        zoneCode,
        zoneName,
        zoneType,
        surchargeMultiplier: 1.1,
      });
      setFeedbackBanner({
        type: "success",
        text: `Configured Floor B${floorNum} (${floorName}) and Zone ${zoneCode} on ${activeLot.code}.`,
      });
    } catch (err) {
      setFeedbackBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to configure floor/zone.",
      });
    }
  };

  const handleCreateBay = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createParkingBay(activeLot.id, {
        slotNumber: bayNumber,
        floor: bayFloor,
        zone: bayZone,
        slotType: bayType,
        vehicleCategoryCode: bayCategory,
        powerKw: bayType === "EV_CHARGING" ? bayPowerKw : null,
      });
      setFeedbackBanner({
        type: "success",
        text: `Created individual bay ${created.slot_number} (${created.slot_type}, ${created.vehicle_category_code}) in ${activeLot.code}.`,
      });
    } catch (err) {
      setFeedbackBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to create bay.",
      });
    }
  };

  const handleSaveSchedule = async () => {
    await updateLocationSchedule(activeLot.id, {
      openingTime: openTime,
      closingTime: closeTime,
      is24Hours,
      gracePeriodMinutes: graceMins,
      reservationHoldMinutes: holdMins,
    });
    setFeedbackBanner({
      type: "success",
      text: `Updated operating hours (${is24Hours ? "24/7" : `${openTime}–${closeTime} IST`}) & reservation hold TTL (${holdMins}m) for ${activeLot.code}.`,
    });
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const rule = await addPricingRule(activeLot.id, {
      ruleName,
      ruleType,
      multiplier: ruleMult,
      flatSurchargeInr: ruleFlatInr,
      minDurationHours: 1,
      appliesToSlotType: ruleSlotType,
    });
    setFeedbackBanner({
      type: "success",
      text: `Added pricing rule '${rule.rule_name}' (${rule.multiplier}x + ₹${rule.flat_surcharge_inr}) to ${activeLot.code}.`,
    });
  };

  const handleReleaseExpiredHolds = async () => {
    const res = await releaseExpiredReservations();
    setFeedbackBanner({
      type: "success",
      text:
        res.releasedCount > 0
          ? `Released ${res.releasedCount} expired reservation hold(s): ${res.releasedReferences.join(", ")}.`
          : "Scanned Redis & PostgreSQL reservation locks: 0 expired holds pending release.",
    });
  };

  const handleApplyAdditionalCharges = async () => {
    try {
      const updated = await applyAdditionalCharges(chargeBookingRef, {
        overstayMinutes: chargeOverstayMins,
        evKwhConsumed: chargeEvKwh,
        valetCleaningRequested: chargeValet,
      });
      setFeedbackBanner({
        type: "success",
        text: `Updated ${updated.booking_reference}: Overstay ₹${updated.overstay_fee_inr}, Additional Charges ₹${updated.additional_charges_inr || 0}, New Total ₹${updated.total_amount_inr}.`,
      });
    } catch (err) {
      setFeedbackBanner({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to apply additional charges.",
      });
    }
  };

  return (
    <ProtectedRouteGate
      allowedRoles={["OPERATOR", "ADMIN"]}
      requiredPermission="slot:override"
      applicationName="Parking Operator SaaS & Inventory Engine"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {/* Header & Facility Selector */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Application 03 &amp; Phase 04 • B2B Operator SaaS &amp; Inventory Engine
            </span>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
              Parking Inventory, Pricing Rules &amp; Booking Engine
            </h1>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <Building2 className="h-4 w-4 text-brand-600" />
            <select
              aria-label="Select Operator Facility"
              value={selectedLotId}
              onChange={(e) => setSelectedLotId(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none"
            >
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.city} — {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {feedbackBanner && (
          <div
            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-bold ${
              feedbackBanner.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{feedbackBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="ml-4 text-[11px] underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-apple">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Today&apos;s Gross Revenue</span>
              <IndianRupee className="h-4 w-4 text-brand-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">
              {formatINR(lotRevenue)}
            </p>
            <p className="mt-1 text-[11px] font-medium text-emerald-600">
              +24.8% vs 7-day rolling average
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-apple">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Live Bay Occupancy</span>
              <Gauge className="h-4 w-4 text-brand-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">
              {occupancyPct}%
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              {activeLot.available_slots} of {activeLot.total_slots} bays free
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-apple">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Active Surge Multiplier</span>
              <Sparkles className="h-4 w-4 text-brand-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-brand-600">
              {activeLot.dynamic_pricing_enabled
                ? `${activeLot.current_surge_multiplier.toFixed(2)}x`
                : "1.00x (Fixed)"}
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              AI Recommended: {aiForecast.recommended_surge_multiplier.toFixed(2)}x
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-apple">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>EV 50kW Chargers Ready</span>
              <Activity className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-emerald-600">
              {activeLot.ev_slots_available} Bays
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              Surcharge: +₹{activeLot.ev_surcharge_inr}/hr •{" "}
              {activeLot.is_24_hours ? "24/7 Open" : `${activeLot.opening_time}–${activeLot.closing_time}`}
            </p>
          </div>
        </div>

        {/* Phase 04: Parking Inventory & Transactional Booking Engine Console */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-6">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-700">
                <Layers className="h-3.5 w-3.5" />
                Phase 04 • Core Parking Inventory &amp; Reservation Infrastructure
              </span>
              <h2 className="mt-1.5 text-lg font-extrabold text-slate-900">
                Multi-Level Inventory Architect, Tariff Rules &amp; Time-Range Booking Engine
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEngineTab("INVENTORY")}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  engineTab === "INVENTORY"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                1. Locations, Floors, Zones &amp; Bays
              </button>
              <button
                type="button"
                onClick={() => setEngineTab("SCHEDULE_PRICING")}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  engineTab === "SCHEDULE_PRICING"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                2. Opening Hours &amp; Pricing Rules
              </button>
              <button
                type="button"
                onClick={() => setEngineTab("AVAILABILITY_QUOTE")}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  engineTab === "AVAILABILITY_QUOTE"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                3. Time-Range Check, Quote &amp; Charges
              </button>
            </div>
          </div>

          {/* TAB 1: Locations, Floors, Zones & Individual Bays */}
          {engineTab === "INVENTORY" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Create Parking Location */}
              <form
                onSubmit={handleCreateLocation}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Create Parking Location
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Facility Code
                    </label>
                    <input
                      type="text"
                      value={newLocCode}
                      onChange={(e) => setNewLocCode(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      City
                    </label>
                    <input
                      type="text"
                      value={newLocCity}
                      onChange={(e) => setNewLocCity(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500">
                    Location Name
                  </label>
                  <input
                    type="text"
                    value={newLocName}
                    onChange={(e) => setNewLocName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={newLocAddress}
                    onChange={(e) => setNewLocAddress(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Base ₹/hr
                    </label>
                    <input
                      type="number"
                      value={newLocRate}
                      onChange={(e) => setNewLocRate(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      EV +₹/hr
                    </label>
                    <input
                      type="number"
                      value={newLocEvSurcharge}
                      onChange={(e) =>
                        setNewLocEvSurcharge(Number(e.target.value))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Floors
                    </label>
                    <input
                      type="number"
                      value={newLocFloors}
                      onChange={(e) => setNewLocFloors(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-700"
                >
                  + Create Parking Location
                </button>
              </form>

              {/* Configure Floors & Zones */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Configure Floors &amp; Zones ({activeLot.code})
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Floor Number
                    </label>
                    <input
                      type="number"
                      value={floorNum}
                      onChange={(e) => setFloorNum(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Clearance (cm)
                    </label>
                    <input
                      type="number"
                      value={clearanceCm}
                      onChange={(e) => setClearanceCm(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500">
                    Floor Label
                  </label>
                  <input
                    type="text"
                    value={floorName}
                    onChange={(e) => setFloorName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Zone Code
                    </label>
                    <input
                      type="text"
                      value={zoneCode}
                      onChange={(e) => setZoneCode(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      On Floor
                    </label>
                    <input
                      type="number"
                      value={zoneFloorNum}
                      onChange={(e) => setZoneFloorNum(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Zone Type
                    </label>
                    <select
                      value={zoneType}
                      onChange={(e) => setZoneType(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold"
                    >
                      <option value="EV_PRIORITY">EV_PRIORITY</option>
                      <option value="GENERAL_AND_SUV">GENERAL_AND_SUV</option>
                      <option value="ACCESSIBLE_NEAR_LIFT">ACCESSIBLE</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500">
                    Zone Name
                  </label>
                  <input
                    type="text"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddFloorAndZone}
                  className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Save Floor &amp; Zone Configuration
                </button>
                <div className="pt-1 text-[11px] text-slate-500">
                  Active Floors: {(activeLot.floors || []).length} • Active Zones:{" "}
                  {(activeLot.zones || []).map((z) => z.zone_code).join(", ")}
                </div>
              </div>

              {/* Create Individual Parking Bay */}
              <form
                onSubmit={handleCreateBay}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-brand-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Create Individual Bay &amp; Assign Type
                  </h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Bay Number
                    </label>
                    <input
                      type="text"
                      value={bayNumber}
                      onChange={(e) => setBayNumber(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Floor
                    </label>
                    <input
                      type="number"
                      value={bayFloor}
                      onChange={(e) => setBayFloor(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Zone
                    </label>
                    <input
                      type="text"
                      value={bayZone}
                      onChange={(e) => setBayZone(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Bay Type
                    </label>
                    <select
                      value={bayType}
                      onChange={(e) => setBayType(e.target.value as SlotType)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="STANDARD">STANDARD</option>
                      <option value="EV_CHARGING">EV_CHARGING</option>
                      <option value="ACCESSIBLE">ACCESSIBLE</option>
                      <option value="SUV_XL">SUV_XL</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Vehicle Category
                    </label>
                    <select
                      value={bayCategory}
                      onChange={(e) => setBayCategory(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="COMPACT">COMPACT</option>
                      <option value="SEDAN">SEDAN</option>
                      <option value="SUV_XL">SUV_XL</option>
                      <option value="EV_FOUR_WHEELER">EV_FOUR_WHEELER</option>
                      <option value="TWO_WHEELER">TWO_WHEELER</option>
                    </select>
                  </div>
                </div>
                {bayType === "EV_CHARGING" && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Charger Power Output (kW)
                    </label>
                    <input
                      type="number"
                      value={bayPowerKw}
                      onChange={(e) => setBayPowerKw(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-700"
                >
                  + Provision Smart Parking Bay
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: Opening Hours & Pricing Rules */}
          {engineTab === "SCHEDULE_PRICING" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 lg:col-span-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-brand-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Set Opening Hours &amp; Hold TTL ({activeLot.code})
                  </h3>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={is24Hours}
                    onChange={(e) => setIs24Hours(e.target.checked)}
                    className="h-4 w-4 accent-brand-600 rounded"
                  />
                  <span>24/7 Continuous Operations</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Opening Time (IST)
                    </label>
                    <input
                      type="text"
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Closing Time (IST)
                    </label>
                    <input
                      type="text"
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Exit Grace Period (Mins)
                    </label>
                    <input
                      type="number"
                      value={graceMins}
                      onChange={(e) => setGraceMins(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Unpaid Reservation Hold TTL (Mins)
                    </label>
                    <input
                      type="number"
                      value={holdMins}
                      onChange={(e) => setHoldMins(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  className="w-full rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700"
                >
                  Save Schedule &amp; Hold Policy
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-brand-600" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                      Configure Parking Pricing Rules ({activeLot.code})
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    Base: ₹{activeLot.base_hourly_rate_inr}/hr
                  </span>
                </div>

                <form
                  onSubmit={handleAddRule}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-5"
                >
                  <input
                    type="text"
                    placeholder="Rule Name"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-2"
                    required
                  />
                  <select
                    value={ruleType}
                    onChange={(e) =>
                      setRuleType(e.target.value as PricingRuleItem["rule_type"])
                    }
                    className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold"
                  >
                    <option value="PEAK_HOUR">PEAK_HOUR</option>
                    <option value="WEEKEND_SURGE">WEEKEND_SURGE</option>
                    <option value="EV_FAST_CHARGE">EV_FAST_CHARGE</option>
                    <option value="SUV_OVERSIZE">SUV_OVERSIZE</option>
                    <option value="OVERSTAY_PENALTY">OVERSTAY_PENALTY</option>
                  </select>
                  <input
                    type="number"
                    step="0.05"
                    value={ruleMult}
                    onChange={(e) => setRuleMult(Number(e.target.value))}
                    aria-label="Rule Multiplier"
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    + Add Rule
                  </button>
                </form>

                <div className="space-y-2">
                  {(activeLot.pricing_rules || []).map((pr) => (
                    <div
                      key={pr.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">
                          {pr.rule_name}
                        </span>
                        <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {pr.rule_type} • {pr.applies_to_slot_type}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-brand-600">
                        {pr.multiplier.toFixed(2)}x + ₹{pr.flat_surcharge_inr}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Time-Range Availability, Duration Quote & Additional Charges */}
          {engineTab === "AVAILABILITY_QUOTE" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Time-Range Availability Checker + Expired Hold Releaser */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 lg:col-span-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-brand-600" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                      Check Time-Range Bay Availability
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleReleaseExpiredHolds}
                    className="inline-flex items-center gap-1 rounded-xl border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 hover:bg-brand-100"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Release Expired Holds
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Start Window
                    </label>
                    <input
                      type="datetime-local"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      End Window
                    </label>
                    <input
                      type="datetime-local"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Bay Type Filter
                    </label>
                    <select
                      value={rangeSlotFilter}
                      onChange={(e) =>
                        setRangeSlotFilter(e.target.value as SlotType | "ALL")
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="ALL">ALL BAY TYPES</option>
                      <option value="STANDARD">STANDARD</option>
                      <option value="EV_CHARGING">EV_CHARGING</option>
                      <option value="ACCESSIBLE">ACCESSIBLE</option>
                      <option value="SUV_XL">SUV_XL</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-center">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400">
                      Window Duration
                    </p>
                    <p className="mt-0.5 text-base font-extrabold text-slate-900">
                      {availabilityReport.duration_hours} hrs
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400">
                      Available Bays
                    </p>
                    <p className="mt-0.5 text-base font-extrabold text-emerald-600">
                      {availabilityReport.available_bay_count} /{" "}
                      {availabilityReport.total_matching_bays}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400">
                      Conflicting Holds
                    </p>
                    <p className="mt-0.5 text-base font-extrabold text-amber-600">
                      {availabilityReport.conflicting_bay_count}
                    </p>
                  </div>
                </div>

                {/* Active Facility Bookings & Cancellation */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Active Reservations in {activeLot.code} (Idempotent &amp; Locked)
                  </p>
                  {lotBookings.slice(0, 3).map((b) => (
                    <div
                      key={b.booking_reference}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900">
                          {b.booking_reference}
                        </span>
                        <span className="ml-2 text-slate-500">
                          Bay {b.slot_number} • {b.vehicle_number}
                        </span>
                        <p className="text-[10px] text-slate-400">
                          {formatDateTime(b.start_time)} →{" "}
                          {formatDateTime(b.end_time)} ({b.status})
                        </p>
                      </div>
                      {b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                        <button
                          type="button"
                          onClick={() => cancelBooking(b.booking_reference)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100"
                        >
                          Cancel &amp; Release
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Duration & Additional Charges Calculator */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 lg:col-span-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-brand-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Duration Quote &amp; Additional Charges Engine
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Target Bay
                    </label>
                    <select
                      value={quoteSlotId}
                      onChange={(e) => setQuoteSlotId(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold"
                    >
                      {activeLot.slots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.slot_number} ({s.slot_type.slice(0, 3)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Vehicle Category
                    </label>
                    <select
                      value={quoteVehicleCat}
                      onChange={(e) => setQuoteVehicleCat(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold"
                    >
                      <option value="SEDAN">SEDAN</option>
                      <option value="SUV_XL">SUV_XL</option>
                      <option value="EV_FOUR_WHEELER">EV_FOUR_WHEELER</option>
                      <option value="COMPACT">COMPACT</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">
                      Simulated Overstay (m)
                    </label>
                    <input
                      type="number"
                      value={quoteOverstayMins}
                      onChange={(e) =>
                        setQuoteOverstayMins(Number(e.target.value))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-700">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={quoteEvFast}
                      onChange={(e) => setQuoteEvFast(e.target.checked)}
                      className="h-3.5 w-3.5 accent-brand-600"
                    />
                    <span>Include 50kW EV Fast-Charge</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={quoteValet}
                      onChange={(e) => setQuoteValet(e.target.checked)}
                      className="h-3.5 w-3.5 accent-brand-600"
                    />
                    <span>Concierge Valet (+₹120)</span>
                  </label>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Base Tariff ({quoteReport.billable_hours} billable hrs ×{" "}
                      {quoteReport.surge_multiplier.toFixed(2)}x)
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      ₹{quoteReport.base_tariff_inr}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Additional Charges (EV ₹{quoteReport.ev_charging_fee_inr} +
                      SUV ₹{quoteReport.suv_oversize_fee_inr} + Valet ₹
                      {quoteReport.valet_or_amenity_fee_inr} + Overstay ₹
                      {quoteReport.overstay_penalty_inr})
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      ₹{quoteReport.additional_charges_total_inr}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST (18% CGST + SGST)</span>
                    <span className="font-mono font-bold text-slate-900">
                      ₹{quoteReport.gst_18_pct_inr}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 text-sm font-extrabold text-brand-600">
                    <span>Total Calculated Quote</span>
                    <span className="font-mono">
                      ₹{quoteReport.grand_total_inr}
                    </span>
                  </div>
                </div>

                {/* Apply Post-Session Additional Charges to Existing Booking */}
                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Apply Post-Park Additional Charges to Booking
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={chargeBookingRef}
                      onChange={(e) => setChargeBookingRef(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold"
                    >
                      {bookings.map((b) => (
                        <option
                          key={b.booking_reference}
                          value={b.booking_reference}
                        >
                          {b.booking_reference} ({b.vehicle_number})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={chargeOverstayMins}
                      onChange={(e) =>
                        setChargeOverstayMins(Number(e.target.value))
                      }
                      placeholder="Overstay mins"
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                    <input
                      type="number"
                      step="0.5"
                      value={chargeEvKwh}
                      onChange={(e) => setChargeEvKwh(Number(e.target.value))}
                      placeholder="EV kWh"
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyAdditionalCharges}
                    className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    Compute &amp; Debit Additional Charges (Overstay + EV kWh +
                    Valet)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Insight Banner + Dynamic Pricing Control */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-3xl border border-brand-200 bg-gradient-to-r from-brand-50/80 via-white to-blue-50/50 p-6 shadow-sm lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold text-white">
                <Cpu className="h-3.5 w-3.5" />
                {aiForecast.model_architecture}
              </span>
              <span className="font-mono text-xs font-bold text-brand-700">
                LIVE ML INFERENCE
              </span>
            </div>
            <p className="text-sm font-medium leading-relaxed text-slate-700">
              {aiForecast.insight_summary}
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() =>
                  updateLotSurge(
                    activeLot.id,
                    true,
                    aiForecast.recommended_surge_multiplier
                  )
                }
                className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700"
              >
                Apply AI Recommended Tariff (
                {aiForecast.recommended_surge_multiplier.toFixed(2)}x)
              </button>
            </div>
          </div>

          {/* Manual Surge Controller */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-brand-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Dynamic Surge Tariff Policy
                </h2>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeLot.dynamic_pricing_enabled}
                  onChange={(e) =>
                    updateLotSurge(
                      activeLot.id,
                      e.target.checked,
                      activeLot.current_surge_multiplier
                    )
                  }
                  className="h-4 w-4 accent-brand-600 rounded"
                />
                <span>Enabled</span>
              </label>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>Surge Multiplier</span>
                <span className="font-mono font-bold text-brand-600">
                  {activeLot.current_surge_multiplier.toFixed(2)}x (₹
                  {Math.round(
                    activeLot.base_hourly_rate_inr *
                      activeLot.current_surge_multiplier
                  )}
                  /hr)
                </span>
              </div>
              <input
                type="range"
                aria-label="Surge Multiplier Slider"
                min={1.0}
                max={2.25}
                step={0.05}
                value={activeLot.current_surge_multiplier}
                onChange={(e) =>
                  updateLotSurge(activeLot.id, true, Number(e.target.value))
                }
                className="mt-2 w-full accent-brand-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Recharts Analytics Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
            <h3 className="text-sm font-bold text-slate-900">
              12-Hour AI Occupancy Forecast (%)
            </h3>
            <p className="text-xs text-slate-500">
              Predicted bay utilization curve across IST commercial rush hours
            </p>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={aiForecast.hourly_forecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="hour_label" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="predicted_occupancy_pct"
                    stroke="#0052FF"
                    fill="#DBEAFE"
                    strokeWidth={2.5}
                    name="Predicted Occupancy %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
            <h3 className="text-sm font-bold text-slate-900">
              Recommended Dynamic Multiplier Curve (x)
            </h3>
            <p className="text-xs text-slate-500">
              Automated surge elasticity calibrated to prevent 100% bay saturation
            </p>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aiForecast.hourly_forecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="hour_label" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0.8, 2.0]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar
                    dataKey="recommended_multiplier"
                    fill="#2563EB"
                    radius={[6, 6, 0, 0]}
                    name="Surge Multiplier (x)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Live Bay Matrix Override & Bay Type Assignment Controller */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-brand-600" />
              <h3 className="text-base font-bold text-slate-900">
                Live IoT Bay Status &amp; Bay Type Assignment Controller (
                {activeLot.code})
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Override status or assign bay type (syncs to Driver &amp; Gate apps)
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {activeLot.slots.map((slot) => (
              <div
                key={slot.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-extrabold text-slate-900">
                    {slot.slot_number}
                  </span>
                  <span className="text-[9px] font-bold text-brand-600">
                    F{slot.floor}•Z{slot.zone}
                  </span>
                </div>
                <select
                  aria-label={`Change status for ${slot.slot_number}`}
                  value={slot.status}
                  onChange={(e) =>
                    updateSlotStatus(
                      activeLot.id,
                      slot.id,
                      e.target.value as SlotStatus
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-800"
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="RESERVED">RESERVED</option>
                  <option value="OCCUPIED">OCCUPIED</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
                <select
                  aria-label={`Assign bay type for ${slot.slot_number}`}
                  value={slot.slot_type}
                  onChange={(e) =>
                    assignParkingBayType(
                      activeLot.id,
                      slot.id,
                      e.target.value as SlotType,
                      e.target.value === "SUV_XL"
                        ? "SUV_XL"
                        : e.target.value === "EV_CHARGING"
                        ? "EV_FOUR_WHEELER"
                        : "SEDAN"
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-700"
                >
                  <option value="STANDARD">TYPE: STANDARD</option>
                  <option value="EV_CHARGING">TYPE: EV 50kW</option>
                  <option value="ACCESSIBLE">TYPE: ACCESSIBLE</option>
                  <option value="SUV_XL">TYPE: SUV XL</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProtectedRouteGate>
  );
}
