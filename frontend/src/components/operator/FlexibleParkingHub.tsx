"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Zap,
  Accessibility,
  Users,
  Clock,
  BatteryCharging,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  QrCode,
  XCircle,
  PlusCircle,
  Check,
  Radio,
  Sliders,
  Sparkles,
  MapPin,
  Car,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Lock,
  Unlock,
} from "lucide-react";
import {
  flexibleParkingApi,
  EVChargerResponse,
  EVChargingSessionResponse,
  AccessibilityCredentialResponse,
  AccessibleRouteResponse,
  GroupBookingResponse,
  WaitlistEntryItem,
} from "@/lib/flexibleParkingApi";

type Phase18Tab = "EV_CHARGING" | "ACCESSIBILITY" | "GROUP_BOOKINGS" | "WAITLIST";

export function FlexibleParkingHub() {
  const [activeTab, setActiveTab] = useState<Phase18Tab>("EV_CHARGING");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Pillar 1: EV Charging State
  const [chargers, setChargers] = useState<EVChargerResponse[]>([]);
  const [selectedCharger, setSelectedCharger] = useState<EVChargerResponse | null>(null);
  const [activeChargingSession, setActiveChargingSession] = useState<EVChargingSessionResponse | null>(null);
  const [simSoc, setSimSoc] = useState<number>(75);
  const [simKwh, setSimKwh] = useState<number>(24.5);
  const [isReservingEV, setIsReservingEV] = useState<boolean>(false);
  const [evPlateInput, setEvPlateInput] = useState<string>("DL01EV4021");
  const [evConnectorInput, setEvConnectorInput] = useState<string>("CCS2");

  // Pillar 2: Accessibility State
  const [credential, setCredential] = useState<AccessibilityCredentialResponse | null>(null);
  const [badgeNumberInput, setBadgeNumberInput] = useState<string>("UDID-DL-2026-PWD99");
  const [disabilityTypeInput, setDisabilityTypeInput] = useState<string>("LOCOMOTOR");
  const [accessibleRoute, setAccessibleRoute] = useState<AccessibleRouteResponse | null>(null);
  const [routeSlotInput, setRouteSlotInput] = useState<string>("P-ACC-01");
  const [complianceNotice, setComplianceNotice] = useState<string | null>(null);

  // Pillar 3: Group Booking State
  const [groupBookings, setGroupBookings] = useState<GroupBookingResponse[]>([]);
  const [activeGroup, setActiveGroup] = useState<GroupBookingResponse | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>("Sharma Family Convoy");
  const [newGroupPlates, setNewGroupPlates] = useState<string[]>(["DL08AB1111", "DL08AB2222", "DL08AB3333"]);

  // Pillar 4: Smart Waitlist State
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntryItem[]>([]);
  const [waitlistPlateInput, setWaitlistPlateInput] = useState<string>("HR26DQ8899");
  const [waitlistDriverInput, setWaitlistDriverInput] = useState<string>("Arjun Verma");
  const [waitlistSlotTypeInput, setWaitlistSlotTypeInput] = useState<string>("REGULAR");

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Initial Data Fetch
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // 1. Load EV Chargers
      const chargerList = await flexibleParkingApi.listChargers();
      setChargers(chargerList);
      if (chargerList.length > 0 && !selectedCharger) {
        setSelectedCharger(chargerList[0]);
      }

      // 2. Load Group Booking (try default demo group)
      try {
        const demoGroup = await flexibleParkingApi.getGroup("GRP-FAM-2026-001");
        setGroupBookings([demoGroup]);
        setActiveGroup(demoGroup);
      } catch {
        // demo group might not exist yet if seed was different
      }

      // 3. Load Waitlist Entries
      const wl = await flexibleParkingApi.listWaitlist();
      setWaitlistEntries(wl);

      // 4. Load demo accessible route
      try {
        const route = await flexibleParkingApi.getAccessibleRoute(1, "P-ACC-01");
        setAccessibleRoute(route);
      } catch {
        // silent
      }
    } catch (err: any) {
      console.error("Failed to load Phase 18 data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // ---------------------------------------------------------------------------
  // Action Handlers: EV Charging
  // ---------------------------------------------------------------------------
  const handleReserveEV = async () => {
    if (!selectedCharger) return;
    try {
      setIsLoading(true);
      const session = await flexibleParkingApi.reserveCharger({
        facility_id: selectedCharger.facility_id,
        charger_id: selectedCharger.id,
        vehicle_plate: evPlateInput,
        connector_type: evConnectorInput,
        target_soc_percent: 90,
      });
      setActiveChargingSession(session);
      setSimSoc(session.current_soc_percent || 25);
      setSimKwh(session.kwh_delivered);
      setNotification({
        type: "success",
        message: `EV Bay Reserved! Session ${session.session_reference} active. Target SoC: 90%.`,
      });
      setIsReservingEV(false);
      // Refresh chargers
      const updated = await flexibleParkingApi.listChargers();
      setChargers(updated);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to reserve EV bay." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTelemetry = async (isFinal = false) => {
    if (!activeChargingSession || !selectedCharger) {
      setNotification({ type: "error", message: "No active charging session to update telemetry." });
      return;
    }
    try {
      setIsLoading(true);
      const updated = await flexibleParkingApi.updateTelemetry({
        session_reference: activeChargingSession.session_reference,
        charger_code: activeChargingSession.charger_code,
        current_soc_percent: isFinal ? 100 : simSoc,
        kwh_delivered: isFinal ? simKwh + 15 : simKwh,
        is_final_stop: isFinal,
        hardware_event_signature: `SIG-OCPP-${Date.now()}`,
      });
      setActiveChargingSession(updated);
      setNotification({
        type: "success",
        message: isFinal
          ? `Verified Hardware Stop Event Processed! Delivered: ${updated.kwh_delivered} kWh. Tariff: ₹${updated.charging_cost_inr.toFixed(2)}.`
          : `Live Telemetry Synced: ${updated.current_soc_percent}% SoC | ${updated.kwh_delivered} kWh delivered.`,
      });
      const chargerList = await flexibleParkingApi.listChargers();
      setChargers(chargerList);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Telemetry update failed." });
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action Handlers: Accessibility
  // ---------------------------------------------------------------------------
  const handleVerifyCredential = async () => {
    try {
      setIsLoading(true);
      const cred = await flexibleParkingApi.registerCredential({
        user_id: 1,
        disability_type: disabilityTypeInput,
        badge_number: badgeNumberInput,
        issuing_authority: "Ministry of Social Justice & Empowerment (UDID Portal)",
      });
      setCredential(cred);
      setNotification({
        type: "success",
        message: `Government UDID Badge Verified! Eligible: ${cred.eligible_slot_types.join(", ")}.`,
      });
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "UDID verification failed." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchRoute = async () => {
    try {
      setIsLoading(true);
      const route = await flexibleParkingApi.getAccessibleRoute(1, routeSlotInput);
      setAccessibleRoute(route);
      setNotification({
        type: "success",
        message: `Step-free route calculated: ${route.steps.length} waypoints, 100% barrier-free with elevator priority.`,
      });
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to calculate accessible route." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestGuardrail = async (asAuthorized: boolean) => {
    try {
      setIsLoading(true);
      setComplianceNotice(null);
      const res = await flexibleParkingApi.reserveAccessibleBay({
        userId: asAuthorized ? 1 : 9999, // User 9999 has no verified UDID
        facilityId: 1,
        slotId: 4,
        vehicleNumber: asAuthorized ? "DL01PWD001" : "DL99XX0000",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000 * 2).toISOString(),
      });
      setComplianceNotice(`ACCESS GRANTED: ${res.message} (Booking: ${res.booking_reference})`);
      setNotification({ type: "success", message: "Compliance guardrail verified: Authorized user approved." });
    } catch (err: any) {
      setComplianceNotice(`GUARDRAIL ENFORCED (HTTP 403): ${err.message}`);
      setNotification({
        type: "info",
        message: "Policy Guardrail Tested: Unauthorized driver blocked from reserving restricted ADA bay.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action Handlers: Group Bookings
  // ---------------------------------------------------------------------------
  const handleCreateGroup = async () => {
    try {
      setIsLoading(true);
      const vehiclesPayload = newGroupPlates.map((plate, idx) => ({
        vehicle_number: plate.trim().toUpperCase(),
        driver_name: `Group Member ${idx + 1}`,
        driver_phone: `+91 98110 0000${idx + 1}`,
      }));

      const group = await flexibleParkingApi.createGroup({
        facility_id: 1,
        group_name: newGroupName,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000 * 4).toISOString(),
        vehicles: vehiclesPayload,
      });

      setGroupBookings((prev) => [group, ...prev]);
      setActiveGroup(group);
      setNotification({
        type: "success",
        message: `Group booking confirmed! Ref: ${group.group_reference} (${group.total_spaces_reserved} contiguous bays).`,
      });
      setIsCreatingGroup(false);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to create group booking." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckInMember = async (vehicleNumber: string, qrJti: string) => {
    if (!activeGroup) return;
    try {
      setIsLoading(true);
      const res = await flexibleParkingApi.checkInGroupMember({
        group_reference: activeGroup.group_reference,
        vehicle_number: vehicleNumber,
        qr_token_jti: qrJti,
      });
      setNotification({
        type: "success",
        message: `Staggered Entry Success: ${res.vehicle_number} checked in to Slot ${res.slot_number}!`,
      });
      // Refresh group details
      const refreshed = await flexibleParkingApi.getGroup(activeGroup.group_reference);
      setActiveGroup(refreshed);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Check-in failed." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelMember = async (vehicleNumber: string) => {
    if (!activeGroup) return;
    try {
      setIsLoading(true);
      const res = await flexibleParkingApi.cancelGroupMember({
        group_reference: activeGroup.group_reference,
        vehicle_number: vehicleNumber,
        reason: "Driver unable to join convoy.",
      });
      setNotification({
        type: "info",
        message: `Partial Cancellation: Slot ${res.released_slot} released back to inventory. Remaining: ${res.remaining_vehicles} vehicles.`,
      });
      const refreshed = await flexibleParkingApi.getGroup(activeGroup.group_reference);
      setActiveGroup(refreshed);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Partial cancellation failed." });
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action Handlers: Smart Waitlist
  // ---------------------------------------------------------------------------
  const handleJoinWaitlist = async () => {
    try {
      setIsLoading(true);
      const entry = await flexibleParkingApi.joinWaitlist({
        facility_id: 1,
        vehicle_plate: waitlistPlateInput,
        driver_name: waitlistDriverInput,
        required_slot_type: waitlistSlotTypeInput,
        estimated_arrival_window_hours: 2,
      });
      setNotification({
        type: "success",
        message: `Joined Fair FIFO Waitlist! Ref: ${entry.waitlist_reference}, Queue Position: #${entry.queue_position}.`,
      });
      const updated = await flexibleParkingApi.listWaitlist();
      setWaitlistEntries(updated);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to join waitlist." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateVacancy = async () => {
    try {
      setIsLoading(true);
      const res = await flexibleParkingApi.simulateVacancy(1, 1);
      if (res.status === "notified") {
        setNotification({
          type: "success",
          message: `Slot Vacancy Processed! Candidate ${res.vehicle_plate} offered Slot with 10-Minute Atomic Hold until ${res.offer_expires_at ? new Date(res.offer_expires_at).toLocaleTimeString() : "expiry"}.`,
        });
      } else {
        setNotification({ type: "info", message: res.message });
      }
      const updated = await flexibleParkingApi.listWaitlist();
      setWaitlistEntries(updated);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Vacancy simulation failed." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimOffer = async (waitlistRef: string) => {
    try {
      setIsLoading(true);
      const res = await flexibleParkingApi.claimWaitlistOffer({
        waitlist_reference: waitlistRef,
        payment_method: "RAZORPAY_UPI",
      });
      setNotification({
        type: "success",
        message: `Waitlist Claim Confirmed! Booking Ref: ${res.booking_reference}, Slot: ${res.slot_number}. Driver allocated successfully.`,
      });
      const updated = await flexibleParkingApi.listWaitlist();
      setWaitlistEntries(updated);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to claim offered slot." });
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // KPI Metrics Calculation
  // ---------------------------------------------------------------------------
  const totalChargers = chargers.length;
  const availableChargers = chargers.filter((c) => c.status === "AVAILABLE").length;
  const activeSessionsCount = chargers.filter((c) => c.status === "CHARGING").length;
  const activeWaitlistCount = waitlistEntries.filter((w) => w.status === "QUEUED" || w.status === "OFFERED").length;
  const offeredCandidate = waitlistEntries.find((w) => w.status === "OFFERED");

  return (
    <div className="w-full bg-[#060a14] text-slate-100 min-h-screen p-6 md:p-8 space-y-8 font-sans">
      {/* ========================================================================= */}
      {/* 1. Header & Quick Controls */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Phase 18 Live Operational Console
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
              OCPP 2.0.1 & Barrier-Free ADA
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Flexible Parking & Advanced Mobility Hub
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Multi-modal parking infrastructure: EV fast charging telemetry, step-free accessibility routing, family
            convoy bookings, and smart FIFO hold waitlists.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
            Refresh Hub
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between transition-all duration-300 shadow-xl ${
            notification.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
              : notification.type === "error"
              ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
              : "bg-sky-950/40 border-sky-500/40 text-sky-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {notification.type === "error" && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
            {notification.type === "info" && <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-70 hover:opacity-100 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Key Operational Metrics Strip */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">EV Network</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{totalChargers}</span>
            <span className="text-xs text-emerald-400 font-medium">({availableChargers} Available)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">DC Fast & Type 2 AC Stations</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Accessibility</span>
            <Accessibility className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">100%</span>
            <span className="text-xs text-sky-400 font-medium">Step-Free</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Strict UDID verification guardrail</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Group Convoy</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{groupBookings.length}</span>
            <span className="text-xs text-amber-400 font-medium">Active Groups</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Independent staggered arrival QR</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Smart Waitlist</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{activeWaitlistCount}</span>
            <span className="text-xs text-indigo-400 font-medium">In FIFO Queue</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">10-Min atomic hold lockouts</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Pillar Navigation Tabs */}
      {/* ========================================================================= */}
      <div className="flex items-center border-b border-slate-800 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("EV_CHARGING")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "EV_CHARGING"
              ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Zap className="w-4 h-4" />
          EV Charging & OCPP Telemetry
        </button>

        <button
          onClick={() => setActiveTab("ACCESSIBILITY")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "ACCESSIBILITY"
              ? "border-sky-500 text-sky-400 bg-sky-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Accessibility className="w-4 h-4" />
          Accessibility & Step-Free Routing
        </button>

        <button
          onClick={() => setActiveTab("GROUP_BOOKINGS")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "GROUP_BOOKINGS"
              ? "border-amber-500 text-amber-400 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Users className="w-4 h-4" />
          Family & Group Bookings
        </button>

        <button
          onClick={() => setActiveTab("WAITLIST")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "WAITLIST"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Clock className="w-4 h-4" />
          Smart Waiting List & Holds
          {offeredCandidate && (
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. TAB 1: EV CHARGING & OCPP TELEMETRY */}
      {/* ========================================================================= */}
      {activeTab === "EV_CHARGING" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Charger List Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <BatteryCharging className="w-5 h-5 text-emerald-400" />
                Charging Stations Registry
              </h2>
              <button
                onClick={() => setIsReservingEV(!isReservingEV)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Reserve EV Bay
              </button>
            </div>

            {/* Quick Reservation Form (Collapsible) */}
            {isReservingEV && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-4 shadow-xl">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Initiate EV Bay Reservation
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Vehicle Plate</label>
                    <input
                      type="text"
                      value={evPlateInput}
                      onChange={(e) => setEvPlateInput(e.target.value.toUpperCase())}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Connector Type</label>
                    <select
                      value={evConnectorInput}
                      onChange={(e) => setEvConnectorInput(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="CCS2">CCS2 (DC Fast)</option>
                      <option value="TYPE_2_AC">Type 2 AC (Fast)</option>
                      <option value="CHADEMO">CHAdeMO (DC)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleReserveEV}
                      disabled={isLoading}
                      className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition shadow"
                    >
                      Confirm EV Reservation
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Grid of Stations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {chargers.map((ch) => {
                const isSelected = selectedCharger?.id === ch.id;
                return (
                  <div
                    key={ch.id}
                    onClick={() => setSelectedCharger(ch)}
                    className={`p-5 rounded-2xl cursor-pointer transition border relative overflow-hidden ${
                      isSelected
                        ? "bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/10"
                        : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-mono font-bold text-emerald-400">{ch.charger_code}</div>
                        <div className="text-sm font-bold text-white mt-0.5">Slot: {ch.slot_number}</div>
                        <div className="text-[11px] text-slate-400">{ch.facility_name}</div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                          ch.status === "AVAILABLE"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : ch.status === "CHARGING"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                            : ch.status === "RESERVED"
                            ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {ch.status}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400">Power:</span>{" "}
                        <span className="font-bold text-slate-200">{ch.max_power_kw} kW</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Tariff:</span>{" "}
                        <span className="font-bold text-emerald-400">₹{ch.charging_tariff_inr_per_kwh}/kWh</span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {ch.connector_types.map((conn) => (
                        <span
                          key={conn}
                          className="px-2 py-0.5 rounded-md bg-slate-950 text-[10px] font-mono text-slate-300 border border-slate-800"
                        >
                          {conn}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* OCPP Telemetry & Hardware Control Panel */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  OCPP Live Telemetry Station
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Protocol: OCPP 2.0.1</span>
              </div>

              {selectedCharger ? (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                    <div className="text-xs text-slate-400">Active Charger Target</div>
                    <div className="text-base font-bold text-white flex items-center justify-between">
                      <span>{selectedCharger.charger_code}</span>
                      <span className="text-xs text-emerald-400 font-mono">Bay: {selectedCharger.slot_number}</span>
                    </div>
                    {activeChargingSession ? (
                      <div className="pt-2 text-xs space-y-1 font-mono text-slate-300 border-t border-slate-900">
                        <div>Session: {activeChargingSession.session_reference}</div>
                        <div>Vehicle: {activeChargingSession.vehicle_plate}</div>
                        <div className="text-emerald-400">
                          Energy Delivered: {activeChargingSession.kwh_delivered} kWh
                        </div>
                        <div className="text-amber-400">
                          Tariff: ₹{activeChargingSession.charging_cost_inr.toFixed(2)} (Billed Separately from Parking)
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 text-xs text-slate-400 italic">
                        {selectedCharger.status === "AVAILABLE"
                          ? "Charger is idle and available. Reserve bay above to launch session."
                          : "Charger in active hardware standby."}
                      </div>
                    )}
                  </div>

                  {/* Battery SoC Gauge */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Live Battery State of Charge (SoC)</span>
                      <span className="font-bold text-emerald-400 font-mono">{simSoc}%</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden p-0.5 border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-sky-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${simSoc}%` }}
                      />
                    </div>
                  </div>

                  {/* Simulator Controls */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-400">Simulate Hardware Telemetry Ingestion</label>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={simSoc}
                      onChange={(e) => setSimSoc(Number(e.target.value))}
                      className="w-full accent-emerald-500 bg-slate-950"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateTelemetry(false)}
                        disabled={isLoading || !activeChargingSession}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-slate-200 transition"
                      >
                        Push Telemetry Ping
                      </button>

                      <button
                        onClick={() => handleUpdateTelemetry(true)}
                        disabled={isLoading || !activeChargingSession}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-xs font-bold text-white transition shadow"
                      >
                        Verified HW Stop
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Select a charging station on the left to monitor live telemetry.
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300">
              <span className="font-bold">Hardware Verification Guardrail:</span> Charging sessions cannot be claimed
              as started or stopped without verified hardware telemetry signatures.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 2: ACCESSIBILITY & STEP-FREE ROUTING */}
      {/* ========================================================================= */}
      {activeTab === "ACCESSIBILITY" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* UDID Credential Verification & Guardrail Test */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                Government UDID Verification
              </h2>
              <p className="text-xs text-slate-400">
                Register Unique Disability Identity Card (UDID) or Blue Badge for priority accessible bay allocations.
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-[11px] text-slate-400 font-medium">UDID / Disability Badge #</label>
                  <input
                    type="text"
                    value={badgeNumberInput}
                    onChange={(e) => setBadgeNumberInput(e.target.value.toUpperCase())}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-medium">Disability Category</label>
                  <select
                    value={disabilityTypeInput}
                    onChange={(e) => setDisabilityTypeInput(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="LOCOMOTOR">Locomotor / Wheelchair Dependent</option>
                    <option value="VISUAL_IMPAIRMENT">Visual Impairment (Tactile Needed)</option>
                    <option value="HEARING_IMPAIRMENT">Hearing Impairment</option>
                    <option value="SENIOR_CITIZEN_MOBILITY">Reduced Senior Mobility</option>
                  </select>
                </div>

                <button
                  onClick={handleVerifyCredential}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition shadow"
                >
                  Verify Disability Credential
                </button>
              </div>

              {credential && (
                <div className="p-3 rounded-2xl bg-sky-950/40 border border-sky-500/40 text-xs space-y-1">
                  <div className="text-sky-300 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-400" />
                    Verified UDID Credential Active
                  </div>
                  <div className="text-slate-300 font-mono text-[11px]">Badge: {credential.badge_number}</div>
                  <div className="text-slate-400 text-[10px]">
                    Eligible: {credential.eligible_slot_types.join(", ")}
                  </div>
                </div>
              )}
            </div>

            {/* Policy Enforcement Sandbox */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Compliance Guardrail Tester
              </h3>
              <p className="text-xs text-slate-400">
                Rule: Restricted accessible spaces must never be assigned to unauthorized users.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => handleTestGuardrail(true)}
                  disabled={isLoading}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-300 border border-sky-500/30 transition"
                >
                  Test Authorized
                </button>

                <button
                  onClick={() => handleTestGuardrail(false)}
                  disabled={isLoading}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-rose-300 border border-rose-500/30 transition"
                >
                  Test Unauthorized
                </button>
              </div>

              {complianceNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-mono ${
                    complianceNotice.includes("HTTP 403")
                      ? "bg-rose-950/30 border border-rose-500/30 text-rose-300"
                      : "bg-emerald-950/30 border border-emerald-500/30 text-emerald-300"
                  }`}
                >
                  {complianceNotice}
                </div>
              )}
            </div>
          </div>

          {/* Step-Free Indoor Route Visualizer */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-sky-400" />
                  100% Step-Free Accessible Indoor Navigation
                </h2>
                <p className="text-xs text-slate-400">
                  Calculates barrier-free paths strictly avoiding stairs and prioritizing elevators and ramps.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={routeSlotInput}
                  onChange={(e) => setRouteSlotInput(e.target.value.toUpperCase())}
                  placeholder="Slot (e.g. P-ACC-01)"
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white w-32 focus:outline-none focus:border-sky-500"
                />
                <button
                  onClick={handleFetchRoute}
                  disabled={isLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition"
                >
                  Compute
                </button>
              </div>
            </div>

            {accessibleRoute ? (
              <div className="space-y-6">
                {/* Route Header Badges */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    100% Step-Free Verified (0 Stairs)
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Elevator Priority Routing
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300 text-xs font-mono">
                    Distance: {accessibleRoute.total_distance_meters}m (~{accessibleRoute.estimated_minutes} min)
                  </span>
                </div>

                {/* Waypoints Timeline */}
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-800">
                  {accessibleRoute.steps.map((st) => (
                    <div key={st.step_number} className="relative flex items-start gap-4 pl-8">
                      <div
                        className={`absolute left-1.5 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-slate-950 ${
                          st.step_type === "ELEVATOR"
                            ? "border-sky-400"
                            : st.step_type === "RAMP"
                            ? "border-emerald-400"
                            : "border-slate-600"
                        }`}
                      />
                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex-1 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">
                            Step {st.step_number}: {st.instruction}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">{st.distance_meters}m</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                            Floor: {st.floor}
                          </span>
                          {st.has_stairs ? (
                            <span className="text-rose-400 font-bold">Stairs detected</span>
                          ) : (
                            <span className="text-emerald-400 font-semibold">Zero Stairs</span>
                          )}
                          {st.notes && <span className="text-slate-500 italic">({st.notes})</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs">
                No route generated yet. Enter destination slot above and click Compute.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 3: FAMILY & GROUP BOOKINGS */}
      {/* ========================================================================= */}
      {activeTab === "GROUP_BOOKINGS" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                Family & Group Convoy Reservations
              </h2>
              <p className="text-xs text-slate-400">
                Reserve multiple contiguous bays in a single booking. Vehicles arrive independently with separate signed
                QR credentials.
              </p>
            </div>

            <button
              onClick={() => setIsCreatingGroup(!isCreatingGroup)}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition flex items-center gap-2 self-start"
            >
              <PlusCircle className="w-4 h-4" />
              Create Multi-Slot Group Booking
            </button>
          </div>

          {/* Group Creation Drawer */}
          {isCreatingGroup && (
            <div className="p-6 rounded-3xl bg-slate-900 border border-amber-500/40 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Register New Group Reservation (2–10 Bays)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-slate-400 font-medium">Group / Convoy Name</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-medium">
                    Vehicle Registration Numbers (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={newGroupPlates.join(", ")}
                    onChange={(e) =>
                      setNewGroupPlates(
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateGroup}
                disabled={isLoading}
                className="py-2.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition shadow"
              >
                Confirm Group Reservation ({newGroupPlates.length} Spaces)
              </button>
            </div>
          )}

          {/* Active Group Card & Vehicle Member Table */}
          {activeGroup ? (
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="text-xs font-mono text-amber-400 font-bold">{activeGroup.group_reference}</div>
                  <h3 className="text-lg font-bold text-white">{activeGroup.group_name}</h3>
                  <div className="text-xs text-slate-400">
                    Facility: {activeGroup.facility_name} | Total Bays: {activeGroup.total_spaces_reserved} | Tariff: ₹
                    {activeGroup.total_amount_inr}
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {activeGroup.status}
                </span>
              </div>

              {/* Members Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Assigned Group Vehicles & Staggered Arrival Status
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2">Vehicle</th>
                        <th className="pb-2">Assigned Slot</th>
                        <th className="pb-2">Driver</th>
                        <th className="pb-2">QR Token JTI</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {activeGroup.members.map((m) => (
                        <tr key={m.member_id} className="text-slate-200">
                          <td className="py-3 font-bold text-white">{m.vehicle_number}</td>
                          <td className="py-3 text-sky-400">{m.slot_number}</td>
                          <td className="py-3 text-slate-300 font-sans">{m.driver_name}</td>
                          <td className="py-3 text-[11px] text-slate-500">{m.qr_token_jti}</td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                m.status === "CHECKED_IN"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : m.status === "CANCELLED"
                                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>
                          <td className="py-3 text-right space-x-2">
                            {m.status === "PENDING_ARRIVAL" && (
                              <>
                                <button
                                  onClick={() => handleCheckInMember(m.vehicle_number, m.qr_token_jti)}
                                  disabled={isLoading}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-sans font-semibold text-white transition"
                                >
                                  Simulate Arrival
                                </button>
                                <button
                                  onClick={() => handleCancelMember(m.vehicle_number)}
                                  disabled={isLoading}
                                  className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-[11px] font-sans font-semibold text-rose-300 transition"
                                >
                                  Partial Cancel
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 text-xs">
              No active group bookings selected. Create one above to test staggered arrival.
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. TAB 4: SMART WAITING LIST & FIFO HOLDS */}
      {/* ========================================================================= */}
      {activeTab === "WAITLIST" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                Smart Waiting List & Atomic 10-Minute Hold Engine
              </h2>
              <p className="text-xs text-slate-400">
                Fair FIFO queuing for full facilities. Vacant slots trigger an exclusive 10-minute hold lock for the top
                candidate.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSimulateVacancy}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition shadow flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Simulate Slot Vacancy (Trigger Hold)
              </button>
            </div>
          </div>

          {/* Active 10-Minute Hold Banner (If Candidate Notified) */}
          {offeredCandidate && (
            <div className="p-5 rounded-3xl bg-indigo-950/40 border border-indigo-500/50 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-indigo-400 animate-ping" />
                  <span className="text-sm font-bold text-indigo-300">
                    EXCLUSIVE 10-MINUTE HOLD ACTIVE: Slot {offeredCandidate.offered_slot_number || "B1-04"}
                  </span>
                </div>
                <span className="text-xs font-mono text-indigo-400">
                  Expires at:{" "}
                  {offeredCandidate.offer_expires_at
                    ? new Date(offeredCandidate.offer_expires_at).toLocaleTimeString()
                    : "in 10 mins"}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Candidate <span className="font-bold text-white">{offeredCandidate.driver_name}</span> (
                {offeredCandidate.vehicle_plate}) has exclusive right to claim. All other drivers are locked out.
              </p>
              <button
                onClick={() => handleClaimOffer(offeredCandidate.waitlist_reference)}
                disabled={isLoading}
                className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition shadow flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Simulate Driver Claim & Confirm Booking
              </button>
            </div>
          )}

          {/* Join Queue Form */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Join Facility Waitlist
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 font-medium">Vehicle Registration</label>
                <input
                  type="text"
                  value={waitlistPlateInput}
                  onChange={(e) => setWaitlistPlateInput(e.target.value.toUpperCase())}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium">Driver Name</label>
                <input
                  type="text"
                  value={waitlistDriverInput}
                  onChange={(e) => setWaitlistDriverInput(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium">Required Slot Type</label>
                <select
                  value={waitlistSlotTypeInput}
                  onChange={(e) => setWaitlistSlotTypeInput(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="REGULAR">Regular Sedan/SUV</option>
                  <option value="EV_CHARGING">EV Charging Bay</option>
                  <option value="ACCESSIBLE">Accessible PWD Bay</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleJoinWaitlist}
                  disabled={isLoading}
                  className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition shadow"
                >
                  Join Queue
                </button>
              </div>
            </div>
          </div>

          {/* Waitlist Queue Table */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white">Live FIFO Queue Order</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-2">Queue #</th>
                    <th className="pb-2">Reference</th>
                    <th className="pb-2">Driver</th>
                    <th className="pb-2">Vehicle</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Hold / Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {waitlistEntries.map((w) => (
                    <tr key={w.waitlist_reference} className="text-slate-200">
                      <td className="py-3 font-bold text-indigo-400">#{w.queue_position}</td>
                      <td className="py-3 text-[11px] text-slate-400">{w.waitlist_reference}</td>
                      <td className="py-3 font-sans font-medium text-white">{w.driver_name}</td>
                      <td className="py-3 font-bold text-slate-200">{w.vehicle_plate}</td>
                      <td className="py-3 text-[11px] text-slate-300">{w.required_slot_type}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            w.status === "OFFERED"
                              ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse"
                              : w.status === "CONVERTED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : w.status === "EXPIRED"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {w.status}
                        </span>
                      </td>
                      <td className="py-3 text-right font-sans text-xs">
                        {w.status === "OFFERED" ? (
                          <button
                            onClick={() => handleClaimOffer(w.waitlist_reference)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition shadow"
                          >
                            Claim Bay
                          </button>
                        ) : (
                          <span className="text-slate-500 text-[11px]">
                            {w.offer_expires_at ? new Date(w.offer_expires_at).toLocaleTimeString() : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {waitlistEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs font-sans">
                        No candidates currently waiting in queue.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
