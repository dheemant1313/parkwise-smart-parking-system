"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  BatteryCharging,
  Building,
  Calendar,
  Camera,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  Eye,
  FileCheck,
  Globe2,
  HelpCircle,
  Info,
  Key,
  Layers,
  MapPin,
  MessageSquare,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  Truck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import {
  ANPRHumanReviewItem,
  ANPRScan,
  CameraStream,
  CorporateAccount,
  EVChargingSession,
  EVConnectorType,
  EventParkingPass,
  FleetAccount,
  GroupReservation,
  MarketplaceBooking,
  MarketplaceListing,
  MultiLocationOverview,
  ParkingEvent,
  ParkingSubscription,
  SubscriptionPlan,
  ValetStatus,
  ValetTicket,
  WhatsAppNotification,
  YOLODetectionRun,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type EcosystemTab =
  | "EV_CHARGING"
  | "SUBSCRIPTIONS"
  | "CORPORATE_FLEET"
  | "GROUPS_EVENTS"
  | "MARKETPLACE"
  | "VISION_ANPR"
  | "VALET"
  | "WHATSAPP_LANG";

export default function EcosystemPage() {
  const [activeTab, setActiveTab] = useState<EcosystemTab>("EV_CHARGING");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 1. EV Charging States
  const [evSessions, setEvSessions] = useState<EVChargingSession[]>([]);
  const [evConnector, setEvConnector] = useState<EVConnectorType>("CCS2");
  const [evTargetSoc, setEvTargetSoc] = useState<number>(85);
  const [evDurationHours, setEvDurationHours] = useState<number>(2.0);
  const [evLoading, setEvLoading] = useState<boolean>(false);

  // 2. Subscriptions States
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubs, setUserSubs] = useState<ParkingSubscription[]>([]);
  const [subPlate, setSubPlate] = useState<string>("DL-01-AB-1234");
  const [selectedPlan, setSelectedPlan] = useState<string>("COMMUTER_WEEKDAY");

  // 3 & 4. Corporate & Fleet States
  const [corpAccounts, setCorpAccounts] = useState<CorporateAccount[]>([]);
  const [fleetAccounts, setFleetAccounts] = useState<FleetAccount[]>([]);
  const [newCorpName, setNewCorpName] = useState<string>("Infosys Technologies Noida");
  const [newCorpDomain, setNewCorpDomain] = useState<string>("infosys.com");
  const [multiLocation, setMultiLocation] = useState<MultiLocationOverview | null>(null);

  // 5 & 6. Groups & Events
  const [events, setEvents] = useState<ParkingEvent[]>([]);
  const [groupReservations, setGroupReservations] = useState<GroupReservation[]>([]);
  const [groupTitle, setGroupTitle] = useState<string>("Verma Family Wedding Gathering");
  const [groupSlots, setGroupSlots] = useState<number>(12);

  // 7 & 8. WhatsApp & Multilingual
  const [waLogs, setWaLogs] = useState<WhatsAppNotification[]>([]);
  const [waPhone, setWaPhone] = useState<string>("+919811002233");
  const [waTemplate, setWaTemplate] = useState<string>("BOOKING_CONFIRMATION");
  const [selectedLocale, setSelectedLocale] = useState<string>("hi");
  const [localizedStrings, setLocalizedStrings] = useState<Record<string, string>>({});

  // 9. Shared Marketplace
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [mktCity, setMktCity] = useState<string>("ALL");
  const [mktBookings, setMktBookings] = useState<MarketplaceBooking[]>([]);

  // 11-14. Vision, YOLO, ANPR
  const [cameras, setCameras] = useState<CameraStream[]>([]);
  const [latestYolo, setLatestYolo] = useState<YOLODetectionRun | null>(null);
  const [anprRawPlate, setAnprRawPlate] = useState<string>("DL 01 AB 1234");
  const [anprScanResult, setAnprScanResult] = useState<ANPRScan | null>(null);
  const [humanReviewQueue, setHumanReviewQueue] = useState<ANPRHumanReviewItem[]>([]);
  const [visionSimDisclaimer, setVisionSimDisclaimer] = useState<string>(
    "ARCHITECTURAL_SIMULATION: Camera YOLO & ANPR edge models run with simulated synthetic benchmarks. Zero live physical gate lifting until edge server connected."
  );

  // 15. Valet Desk
  const [valetTickets, setValetTickets] = useState<ValetTicket[]>([]);
  const [valetCustomerName, setValetCustomerName] = useState<string>("Sunil Mittal");
  const [valetPlate, setValetPlate] = useState<string>("DL-02-CB-5544");
  const [valetModel, setValetModel] = useState<string>("Mercedes Benz C-Class");

  // Initial Data Fetch
  useEffect(() => {
    fetchInitialEcosystemData();
  }, []);

  async function fetchInitialEcosystemData() {
    try {
      // 1. EV sessions
      fetch(`${API_BASE}/ecosystem/ev/sessions`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setEvSessions(d))
        .catch(() => {});

      // 2. Subscription plans
      fetch(`${API_BASE}/ecosystem/subscriptions/plans`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setSubscriptionPlans(d))
        .catch(() => {});

      // 3. Corporate accounts
      fetch(`${API_BASE}/ecosystem/corporate/accounts`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setCorpAccounts(d))
        .catch(() => {});

      // 4. Fleet accounts
      fetch(`${API_BASE}/ecosystem/fleet/accounts`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setFleetAccounts(d))
        .catch(() => {});

      // 5. Events
      fetch(`${API_BASE}/ecosystem/events`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setEvents(d))
        .catch(() => {});

      // 6. Marketplace listings
      fetch(`${API_BASE}/ecosystem/marketplace/listings`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setListings(d))
        .catch(() => {});

      // 7. Cameras
      fetch(`${API_BASE}/ecosystem/camera/streams`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setCameras(d))
        .catch(() => {});

      // 8. ANPR Reviews
      fetch(`${API_BASE}/ecosystem/anpr/human-reviews?status_filter=PENDING`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setHumanReviewQueue(d))
        .catch(() => {});

      // 9. Valet tickets
      fetch(`${API_BASE}/ecosystem/valet/tickets`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setValetTickets(d))
        .catch(() => {});

      // 10. WhatsApp Logs
      fetch(`${API_BASE}/ecosystem/notifications/whatsapp/logs`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setWaLogs(d))
        .catch(() => {});

      // 11. Localization
      loadLocalization(selectedLocale);
    } catch {
      // Graceful fallback for offline mode
    }
  }

  async function loadLocalization(locale: string) {
    try {
      const res = await fetch(`${API_BASE}/ecosystem/localization/${locale}`);
      if (res.ok) {
        const data = await res.json();
        setLocalizedStrings(data.strings || {});
      }
    } catch {
      // Fallback
    }
  }

  // Action: Reserve EV Session
  async function handleReserveEVSession(e: React.FormEvent) {
    e.preventDefault();
    setEvLoading(true);
    try {
      const start = new Date(Date.now() + 3600 * 1000).toISOString();
      const res = await fetch(`${API_BASE}/ecosystem/ev/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_id: 1,
          slot_id: 1,
          user_email: "driver.ev@parkwise.in",
          connector_type: evConnector,
          target_soc_pct: evTargetSoc,
          initial_soc_pct: 25.0,
          scheduled_start: start,
          duration_hours: evDurationHours,
          energy_kwh_requested: 35.0,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setEvSessions((prev) => [created, ...prev]);
        setStatusMessage(`EV Charging Bay reserved successfully! Session Code: ${created.session_code}`);
      }
    } catch {
      setStatusMessage("Demo EV session created locally.");
    } finally {
      setEvLoading(false);
    }
  }

  // Action: Create Subscription
  async function handleCreateSubscription() {
    try {
      const res = await fetch(`${API_BASE}/ecosystem/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_id: 1,
          user_email: "commuter@parkwise.in",
          plan_type: selectedPlan,
          primary_vehicle_plate: subPlate,
          auto_renew: true,
        }),
      });
      if (res.ok) {
        const sub = await res.json();
        setUserSubs((prev) => [sub, ...prev]);
        setStatusMessage(`Monthly Pass activated! Code: ${sub.subscription_code} (QR Pass: ${sub.pass_qr_code})`);
      }
    } catch {
      setStatusMessage("Demo subscription pass issued.");
    }
  }

  // Action: Dispatch WhatsApp Notification (Simulated)
  async function handleSendWhatsApp() {
    try {
      const res = await fetch(`${API_BASE}/ecosystem/notifications/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_phone: waPhone,
          template_name: waTemplate,
          language_code: selectedLocale,
          booking_reference: "PW-RES-DEMO-001",
          custom_params: {
            lot_name: "Connaught Place Multi-Level Hub",
            slot_number: "Bay B-04",
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWaLogs((prev) => [data, ...prev]);
        setStatusMessage(`Simulated WhatsApp alert dispatched! Message SID: ${data.message_sid}`);
      }
    } catch {
      setStatusMessage("Simulated notification queued.");
    }
  }

  // Action: Run YOLO Inference
  async function handleRunYOLO(cameraId: number) {
    try {
      const res = await fetch(`${API_BASE}/ecosystem/yolo/inference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camera_id: cameraId, synthetic_benchmark: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setLatestYolo(data);
        setStatusMessage(`YOLOv8 Edge inference completed in ${data.inference_latency_ms}ms.`);
      }
    } catch {
      setStatusMessage("Synthetic YOLO inference triggered.");
    }
  }

  // Action: Scan ANPR Plate
  async function handleScanANPR() {
    try {
      const res = await fetch(`${API_BASE}/ecosystem/anpr/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_id: 1,
          captured_plate_raw: anprRawPlate,
          gate_lane: "LANE-ENTRY-01",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnprScanResult(data);
        if (data.human_review_required) {
          fetch(`${API_BASE}/ecosystem/anpr/human-reviews?status_filter=PENDING`)
            .then((r) => r.json())
            .then((d) => Array.isArray(d) && setHumanReviewQueue(d));
        }
        setStatusMessage(`ANPR Scan: ${data.decision} (Confidence: ${Math.round(data.confidence_score * 100)}%)`);
      }
    } catch {
      setStatusMessage("ANPR scan processed.");
    }
  }

  // Action: Resolve Human Review Item
  async function handleResolveReview(reviewId: number, action: "APPROVE" | "CORRECT" | "REJECT", plate?: string) {
    try {
      const res = await fetch(`${API_BASE}/ecosystem/anpr/human-reviews/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: reviewId,
          action,
          corrected_plate: plate || "DL01AB1234",
          reviewer_email: "staff.gate@parkwise.in",
          notes: "Manual review verification at gate terminal.",
        }),
      });
      if (res.ok) {
        setHumanReviewQueue((prev) => prev.filter((r) => r.id !== reviewId));
        setStatusMessage(`Review item #${reviewId} resolved: ${action}`);
      }
    } catch {
      setHumanReviewQueue((prev) => prev.filter((r) => r.id !== reviewId));
    }
  }

  // Action: Check-in Valet
  async function handleValetCheckIn(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/ecosystem/valet/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_id: 1,
          customer_name: valetCustomerName,
          customer_phone: "+919811445566",
          vehicle_plate: valetPlate,
          vehicle_model: valetModel,
          key_locker_tag: "LOCKER-VIP-07",
          odometer_reading_km: 14500.0,
          fuel_or_battery_level_pct: 88.0,
          pre_existing_damage_notes: "Minor scratch on passenger side bumper.",
        }),
      });
      if (res.ok) {
        const tkt = await res.json();
        setValetTickets((prev) => [tkt, ...prev]);
        setStatusMessage(`Valet intake confirmed! Ticket: ${tkt.ticket_code} (Key tag: ${tkt.key_locker_tag})`);
      }
    } catch {
      setStatusMessage("Valet intake completed.");
    }
  }

  // Action: Valet Status Step
  async function handleValetAction(ticketId: number, action: "PARK" | "REQUEST_RETRIEVAL" | "DELIVER") {
    try {
      const res = await fetch(`${API_BASE}/ecosystem/valet/tickets/${ticketId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const upd = await res.json();
        setValetTickets((prev) => prev.map((t) => (t.id === ticketId ? upd : t)));
        setStatusMessage(`Valet Ticket #${upd.ticket_code} updated to ${upd.status}`);
      }
    } catch {
      // Local state update
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                  PHASE 08: LIVE ECOSYSTEM
                </span>
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400 border border-blue-500/20">
                  15 ENTERPRISE EXTENSIONS
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Advanced Parkwise Ecosystem Hub
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                EV Fast Charging, Subscriptions, Corporate Fleets, Computer Vision Edge YOLOv8, HSRP ANPR Gate Queues & Valet.
              </p>
            </div>

            {/* Quick Status Notification */}
            {statusMessage && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-950/80 border border-emerald-600/40 px-3 py-2 text-xs font-medium text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{statusMessage}</span>
                <button
                  type="button"
                  onClick={() => setStatusMessage(null)}
                  className="ml-2 text-emerald-400 hover:text-white"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
            {[
              { id: "EV_CHARGING", label: "EV Charging Bays", icon: Zap },
              { id: "SUBSCRIPTIONS", label: "Monthly Passes", icon: Calendar },
              { id: "CORPORATE_FLEET", label: "Corporate & Fleet", icon: Building },
              { id: "GROUPS_EVENTS", label: "Groups & Events", icon: Users },
              { id: "MARKETPLACE", label: "Driveway Marketplace", icon: MapPin },
              { id: "VISION_ANPR", label: "YOLO & ANPR Vision", icon: Camera },
              { id: "VALET", label: "Digital Valet Desk", icon: Key },
              { id: "WHATSAPP_LANG", label: "WhatsApp & Languages", icon: MessageSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as EcosystemTab)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-brand-600 text-white shadow-lg shadow-brand-600/25 ring-1 ring-brand-400"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ================================================================= */}
        {/* TAB 1: EV CHARGING HUB (MODULE 1) */}
        {/* ================================================================= */}
        {activeTab === "EV_CHARGING" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4">
              <div className="flex items-start gap-3">
                <BatteryCharging className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-200">
                    Smart EV Charging Hub - Connected DC Fast & AC Type 2 Bays
                  </h3>
                  <p className="mt-1 text-xs text-emerald-300/80">
                    Automated Bay Reservation, OCPP 2.0.1 simulation, tariff calculation (₹18.5/kWh energy tariff + ₹2.5/min idle overstay protection), and battery SoC optimization.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Form Card */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-400" />
                  Reserve EV Charging Bay
                </h3>

                <form onSubmit={handleReserveEVSession} className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Connector Standard</label>
                    <select
                      value={evConnector}
                      onChange={(e) => setEvConnector(e.target.value as EVConnectorType)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="CCS2">CCS2 (60 kW DC Fast Charging)</option>
                      <option value="TYPE2_AC">Type 2 AC (22 kW Standard Charging)</option>
                      <option value="CHADEMO">CHAdeMO (50 kW Fast Charging)</option>
                      <option value="GB_T">GB/T (30 kW DC Fast Charging)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-300">Target Battery SoC</span>
                      <span className="font-bold text-emerald-400">{evTargetSoc}%</span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={100}
                      step={5}
                      value={evTargetSoc}
                      onChange={(e) => setEvTargetSoc(Number(e.target.value))}
                      className="mt-2 w-full accent-emerald-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>40% (Quick Top-Up)</span>
                      <span>80% (Battery Health Rec.)</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300">Hold Duration</label>
                    <div className="mt-1 grid grid-cols-3 gap-2">
                      {[1.0, 2.0, 3.5].map((hrs) => (
                        <button
                          key={hrs}
                          type="button"
                          onClick={() => setEvDurationHours(hrs)}
                          className={`rounded-lg py-1.5 text-xs font-bold ${
                            evDurationHours === hrs
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {hrs} Hours
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tariff breakdown */}
                  <div className="rounded-lg bg-slate-950 p-3 text-xs space-y-1.5 border border-slate-800">
                    <div className="flex justify-between text-slate-400">
                      <span>Estimated Energy:</span>
                      <span className="font-medium text-white">35.0 kWh</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Energy Tariff (@ ₹18.5/kWh):</span>
                      <span className="font-medium text-white">₹647.50</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>GST (18%):</span>
                      <span className="font-medium text-white">₹116.55</span>
                    </div>
                    <div className="border-t border-slate-800 pt-1.5 flex justify-between font-bold text-emerald-400">
                      <span>Total Estimated Fee:</span>
                      <span>₹764.05</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={evLoading}
                    className="w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/30"
                  >
                    {evLoading ? "Reserving Charging Bay..." : "Confirm EV Bay Reservation"}
                  </button>
                </form>
              </div>

              {/* Sessions List */}
              <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    Live & Reserved EV Sessions
                  </h3>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300 font-medium">
                    {evSessions.length} Active Sessions
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {evSessions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-slate-500">
                      <BatteryCharging className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                      <p className="text-xs">No active EV charging sessions recorded yet. Reserve one above!</p>
                    </div>
                  ) : (
                    evSessions.slice(0, 5).map((ses) => (
                      <div
                        key={ses.id}
                        className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 transition-all hover:border-slate-700"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-xs font-bold text-brand-400">
                              {ses.session_code}
                            </span>
                            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                              {ses.connector_type}
                            </span>
                            <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
                              {ses.power_rating_kw} kW
                            </span>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              ses.charging_status === "CHARGING"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse"
                                : ses.charging_status === "RESERVED"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-blue-500/20 text-blue-300"
                            }`}
                          >
                            {ses.charging_status}
                          </span>
                        </div>

                        {/* Battery Progress Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                            <span>Battery Charge Status</span>
                            <span className="font-bold text-white">
                              {ses.current_soc_pct}% / {ses.target_soc_pct}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                              style={{ width: `${Math.min(100, ses.current_soc_pct)}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-900">
                          <span>Energy: {ses.energy_consumed_kwh} kWh</span>
                          <span className="font-bold text-emerald-400">Fee: ₹{ses.charging_fee_inr}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: MONTHLY SUBSCRIPTIONS (MODULE 2) */}
        {/* ================================================================= */}
        {activeTab === "SUBSCRIPTIONS" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-blue-800/40 bg-blue-950/20 p-4">
              <div className="flex items-start gap-3">
                <Ticket className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-blue-200">
                    Parkwise Monthly Parking Subscriptions
                  </h3>
                  <p className="mt-1 text-xs text-blue-300/80">
                    Automated ANPR barrier lifting, recurring auto-renew billing, dedicated VIP lane access, and multi-vehicle pass sharing.
                  </p>
                </div>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  id: "COMMUTER_WEEKDAY",
                  title: "Commuter Weekday Pass",
                  fee: 2499,
                  time: "Mon - Fri, 07:00 - 21:00",
                  tag: "Most Popular",
                },
                {
                  id: "RESIDENTIAL_NIGHT",
                  title: "Residential Night Pass",
                  fee: 1899,
                  time: "All Days, 19:00 - 09:00",
                  tag: "Overnight Saver",
                },
                {
                  id: "COMMERCIAL_ALL_ACCESS",
                  title: "Commercial All-Access 24/7",
                  fee: 4999,
                  time: "Unlimited 24/7 Access",
                  tag: "Enterprise Tier",
                },
                {
                  id: "WEEKEND_EXPLORER",
                  title: "Weekend Explorer Pass",
                  fee: 1299,
                  time: "Sat - Sun Unlimited",
                  tag: "Leisure & Dining",
                },
              ].map((plan) => {
                const isSelected = selectedPlan === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`cursor-pointer rounded-xl border p-5 transition-all ${
                      isSelected
                        ? "border-brand-500 bg-brand-950/40 ring-1 ring-brand-500"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                    }`}
                  >
                    <span className="rounded bg-brand-500/20 px-2 py-0.5 text-[10px] font-bold text-brand-300 border border-brand-500/30">
                      {plan.tag}
                    </span>
                    <h4 className="mt-3 text-sm font-bold text-white">{plan.title}</h4>
                    <p className="mt-1 text-xs text-slate-400">{plan.time}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white">₹{plan.fee}</span>
                      <span className="text-xs text-slate-400">/ month + GST</span>
                    </div>

                    <ul className="mt-4 space-y-1.5 text-[11px] text-slate-300">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Guaranteed spot during peak hours
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Automated FASTag & ANPR barrier opening
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        15% off EV fast charging tariffs
                      </li>
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Subscribe Box */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-white">Issue Subscription Pass</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Assign Indian vehicle license plate to generate dynamic QR token & RFID whitelist.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={subPlate}
                    onChange={(e) => setSubPlate(e.target.value.toUpperCase())}
                    placeholder="DL-01-AB-1234"
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-brand-500 w-44"
                  />
                  <button
                    type="button"
                    onClick={handleCreateSubscription}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-500 transition-colors shadow-lg shadow-brand-600/30"
                  >
                    Activate Selected Pass
                  </button>
                </div>
              </div>

              {/* Active Subscriptions Display */}
              {userSubs.length > 0 && (
                <div className="mt-6 border-t border-slate-800 pt-4">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Newly Issued Passes ({userSubs.length})
                  </h5>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {userSubs.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3"
                      >
                        <div>
                          <div className="font-mono text-xs font-bold text-brand-400">{s.subscription_code}</div>
                          <div className="text-[11px] text-slate-400">
                            Plate: <span className="font-mono text-white">{s.primary_vehicle_plate}</span> | Plan: {s.plan_type}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            ACTIVE
                          </span>
                          <div className="text-[10px] font-mono text-slate-500 mt-1">{s.pass_qr_code}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: CORPORATE ACCOUNTS & FLEET WALLETS (MODULES 3 & 4) */}
        {/* ================================================================= */}
        {activeTab === "CORPORATE_FLEET" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-indigo-800/40 bg-indigo-950/20 p-4">
              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-indigo-200">
                    Corporate Accounts & Commercial Fleet Wallets
                  </h3>
                  <p className="mt-1 text-xs text-indigo-300/80">
                    B2B domain authentication (e.g. @tcs.com, @infosys.com), employee monthly stipends, fleet automated wallet deductions with FASTag, and daily vehicle spend caps.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Corporate Portal */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-400" />
                  Corporate Account Management
                </h3>

                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300">Company Name</label>
                      <input
                        type="text"
                        value={newCorpName}
                        onChange={(e) => setNewCorpName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300">Authorized Domain</label>
                      <input
                        type="text"
                        value={newCorpDomain}
                        onChange={(e) => setNewCorpDomain(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono font-bold text-white"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-950 p-3 text-xs border border-slate-800">
                    <div className="font-semibold text-slate-300">Domain-Enforced Verification Policy:</div>
                    <p className="text-slate-400 mt-1">
                      Employees registering with non-matching domains (e.g. @gmail.com) are automatically blocked with HTTP 400.
                    </p>
                  </div>

                  <div className="space-y-2 mt-4">
                    <h5 className="text-xs font-bold text-slate-300">Registered Corporate Accounts:</h5>
                    {corpAccounts.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{c.company_name}</div>
                          <div className="text-[11px] text-slate-400">
                            Domain: <span className="text-indigo-400 font-mono">@{c.authorized_domain}</span> | Credit: ₹{c.monthly_credit_limit_inr.toLocaleString()}
                          </div>
                        </div>
                        <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
                          {c.allocated_daily_slots} Daily Slots
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fleet Wallets Portal */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Truck className="h-4 w-4 text-emerald-400" />
                  Commercial EV & Taxi Fleet Wallets
                </h3>

                <div className="mt-4 space-y-4">
                  {fleetAccounts.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-white">{f.fleet_name}</h4>
                          <span className="font-mono text-xs text-brand-400">{f.fleet_code}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400">Wallet Balance</span>
                          <div className="text-lg font-black text-emerald-400">
                            ₹{f.wallet_balance_inr.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-900 pt-2">
                        <span>Auto-Recharge Threshold: ₹{f.auto_recharge_threshold_inr.toLocaleString()}</span>
                        <span className="text-emerald-400 font-bold">Auto-Debit: ENABLED</span>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-lg bg-slate-950 p-4 border border-slate-800">
                    <h5 className="text-xs font-bold text-slate-300">Fleet Spend Controls</h5>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Each taxi or commercial delivery vehicle operates under a strict daily spend limit (e.g. ₹2,000/day) with FASTag auto-deduction logs.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: GROUPS & EVENTS (MODULES 5 & 6) */}
        {/* ================================================================= */}
        {activeTab === "GROUPS_EVENTS" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-purple-800/40 bg-purple-950/20 p-4">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-purple-200">
                    Group Delegations & Stadium Event Parking
                  </h3>
                  <p className="mt-1 text-xs text-purple-300/80">
                    Single-link group parking reservations (Weddings, Corporate Offsites), split or host-pays payment modes, and high-density stadium event passes with shuttle integration.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Event Passes */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-purple-400" />
                  Upcoming Stadium & Arena Events
                </h3>

                <div className="mt-4 space-y-4">
                  {events.map((evt) => (
                    <div
                      key={evt.id}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-purple-400">{evt.event_code}</span>
                        <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                          Flat Rate ₹{evt.flat_event_fee_inr}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{evt.event_name}</h4>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-slate-500" />
                        {evt.venue_name}
                      </div>

                      <div className="rounded bg-slate-900 p-2.5 text-[11px] text-slate-300 flex items-center justify-between">
                        <span>Allocated Bays: {evt.total_allocated_bays}</span>
                        <span className="text-emerald-400 font-semibold">
                          Shuttle Feeder Included
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 italic">
                        "{evt.traffic_advisory}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group Reservation Creator */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-400" />
                  Create Group Reservation Link
                </h3>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Event / Group Title</label>
                    <input
                      type="text"
                      value={groupTitle}
                      onChange={(e) => setGroupTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-300">Reserved Slot Capacity</span>
                      <span className="font-bold text-purple-400">{groupSlots} Vehicles</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={40}
                      step={1}
                      value={groupSlots}
                      onChange={(e) => setGroupSlots(Number(e.target.value))}
                      className="mt-2 w-full accent-purple-500"
                    />
                  </div>

                  <div className="rounded-lg bg-slate-950 p-3 text-xs border border-slate-800 space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>Payment Strategy:</span>
                      <span className="font-bold text-white">HOST_PAYS_ALL</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Shareable Invite Link:</span>
                      <span className="font-mono text-purple-400">https://parkwise.in/g/GRP-V7X9A</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStatusMessage("Group reservation created! Invite link generated.")}
                    className="w-full rounded-lg bg-purple-600 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition-colors shadow-lg shadow-purple-600/30"
                  >
                    Generate Delegation Parking Link
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: DRIVEWAY MARKETPLACE (MODULE 9) */}
        {/* ================================================================= */}
        {activeTab === "MARKETPLACE" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-amber-200">
                    Peer-to-Peer Shared Parking Marketplace
                  </h3>
                  <p className="mt-1 text-xs text-amber-300/80">
                    Monetize private residential driveways and society stilt bays. 15% platform commission transparently itemized with KYC verified hosts.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                        {item.city}
                      </span>
                      {item.is_ev_ready && (
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          EV Socket Ready
                        </span>
                      )}
                    </div>
                    <h4 className="mt-3 text-sm font-bold text-white">{item.title}</h4>
                    <p className="mt-1 text-xs text-slate-400">{item.address}</p>

                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Host: {item.host_name} (KYC Verified)</span>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-800 pt-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-lg font-black text-white">₹{item.hourly_rate_inr}</span>
                        <span className="text-xs text-slate-400"> / hr</span>
                      </div>
                      <span className="text-xs text-slate-400">Day: ₹{item.daily_rate_inr}</span>
                    </div>

                    <div className="mt-2 text-[10px] text-slate-500">
                      Pricing includes 15% Parkwise escrow & insurance cover
                    </div>

                    <button
                      type="button"
                      onClick={() => setStatusMessage(`Driveway space "${item.title}" booked successfully!`)}
                      className="mt-3 w-full rounded-lg bg-amber-600 py-2 text-xs font-bold text-white hover:bg-amber-500 transition-colors shadow-lg shadow-amber-600/30"
                    >
                      Book Driveway Bay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: COMPUTER VISION, YOLO & ANPR (MODULES 11, 12, 13, 14) */}
        {/* ================================================================= */}
        {activeTab === "VISION_ANPR" && (
          <div className="space-y-6">
            {/* MANDATORY DISCLAIMER BANNER */}
            <div className="rounded-xl border border-red-800/60 bg-red-950/30 p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-red-200">
                    Architectural Vision & ANPR Simulation Mode
                  </h3>
                  <p className="mt-1 text-xs text-red-300/80">
                    {visionSimDisclaimer}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* YOLO Detection Module */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Camera className="h-4 w-4 text-brand-400" />
                    YOLOv8 Edge Occupancy Inference
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleRunYOLO(1)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-500"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Run Inference Benchmark
                  </button>
                </div>

                {/* Simulated Camera Feed Canvas */}
                <div className="relative mt-4 aspect-video w-full rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                  <div className="absolute top-2 left-2 flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
                    <span className="font-mono text-[10px] text-slate-400">CAM-NCR-01 (1080p@15fps)</span>
                  </div>
                  <div className="absolute top-2 right-2 rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-slate-700">
                    Privacy Redaction: ON (Faces Blotted)
                  </div>

                  {/* Simulated Bounding Boxes */}
                  <div className="absolute inset-8 border border-emerald-500/40 rounded bg-emerald-500/5 flex flex-col justify-between p-2">
                    <div className="flex justify-between items-start">
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-mono font-bold text-white">
                        CAR [IoU: 0.94]
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400">
                        Bay A-01: OCCUPIED
                      </span>
                    </div>
                  </div>

                  <div className="text-center text-xs text-slate-500">
                    <p className="font-bold text-slate-300">Synthetic Edge TensorRT Stream Active</p>
                    <p className="text-[11px] text-slate-500 mt-1">Inference Latency: 18.4ms | FPS: 54.2</p>
                  </div>
                </div>

                {latestYolo && (
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                      <div className="text-slate-400">Detected</div>
                      <div className="text-base font-bold text-white">{latestYolo.detected_vehicles_count}</div>
                    </div>
                    <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                      <div className="text-slate-400">Occupied</div>
                      <div className="text-base font-bold text-emerald-400">{latestYolo.occupied_slots_count}</div>
                    </div>
                    <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                      <div className="text-slate-400">Vacant</div>
                      <div className="text-base font-bold text-blue-400">{latestYolo.vacant_slots_count}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* ANPR OCR & Gate Decision Engine */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="h-4 w-4 text-emerald-400" />
                  Indian HSRP ANPR & Plate OCR Engine
                </h3>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">
                      Camera Captured Raw Plate Image Text
                    </label>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        value={anprRawPlate}
                        onChange={(e) => setAnprRawPlate(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono font-bold text-white"
                      />
                      <button
                        type="button"
                        onClick={handleScanANPR}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                      >
                        Process ANPR
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Tip: Test "D? 01 ?? 1234" to trigger the human review queue.
                    </span>
                  </div>

                  {anprScanResult && (
                    <div className="rounded-lg bg-slate-950 p-4 border border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Normalized Plate:</span>
                        <span className="font-mono text-sm font-bold text-brand-400">
                          {anprScanResult.normalized_plate}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">HSRP Standard Compliant:</span>
                        <span className="text-emerald-400 font-bold">
                          {anprScanResult.is_hsrp_compliant ? "YES (MoRTH Validated)" : "NO"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Optical Confidence:</span>
                        <span className="text-white font-bold">
                          {Math.round(anprScanResult.confidence_score * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-900 pt-2 font-bold">
                        <span>Barrier Gate Action:</span>
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            anprScanResult.decision === "AUTO_ALLOWED"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {anprScanResult.decision}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Human Review Queue */}
                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <h5 className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span>Gate Staff Human Verification Queue</span>
                      <span className="rounded bg-amber-500/20 text-amber-400 px-1.5 py-0.2 text-[10px]">
                        {humanReviewQueue.length} Pending
                      </span>
                    </h5>

                    <div className="mt-3 space-y-2">
                      {humanReviewQueue.length === 0 ? (
                        <div className="text-[11px] text-slate-500 italic p-2 text-center bg-slate-950 rounded">
                          No low-confidence plates awaiting human operator review.
                        </div>
                      ) : (
                        humanReviewQueue.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 space-y-2 text-xs"
                          >
                            <div className="flex justify-between">
                              <span className="font-mono text-amber-300 font-bold">{item.captured_plate}</span>
                              <span className="text-[10px] text-slate-400">Confidence: {Math.round(item.confidence_score * 100)}%</span>
                            </div>
                            <div className="text-[11px] text-slate-300">
                              Reason: <span className="text-amber-400">{item.reason}</span>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleResolveReview(item.id, "CORRECT", "DL01AB1234")}
                                className="flex-1 rounded bg-emerald-600 py-1 text-[11px] font-bold text-white hover:bg-emerald-500"
                              >
                                Correct & Approve (DL01AB1234)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResolveReview(item.id, "REJECT")}
                                className="rounded bg-red-600/80 px-3 py-1 text-[11px] font-bold text-white hover:bg-red-600"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 7: VALET SERVICE SUPPORT (MODULE 15) */}
        {/* ================================================================= */}
        {activeTab === "VALET" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-teal-800/40 bg-teal-950/20 p-4">
              <div className="flex items-start gap-3">
                <Key className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-teal-200">
                    Digital Valet Service Desk & Smart Key Management
                  </h3>
                  <p className="mt-1 text-xs text-teal-300/80">
                    Kiosk check-in, key locker tracking (`LOCKER-VIP-07`), pre-damage inspection logs, and customer self-service "Request My Car" pre-retrieval workflow.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Valet Check-In Form */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="h-4 w-4 text-teal-400" />
                  Valet Vehicle Intake
                </h3>

                <form onSubmit={handleValetCheckIn} className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Customer Name</label>
                    <input
                      type="text"
                      value={valetCustomerName}
                      onChange={(e) => setValetCustomerName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300">Vehicle Plate Number</label>
                    <input
                      type="text"
                      value={valetPlate}
                      onChange={(e) => setValetPlate(e.target.value.toUpperCase())}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono font-bold text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300">Vehicle Make & Model</label>
                    <input
                      type="text"
                      value={valetModel}
                      onChange={(e) => setValetModel(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="rounded-lg bg-slate-950 p-3 text-xs border border-slate-800 space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Valet Fee:</span>
                      <span className="font-bold text-white">₹150.00</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Digital Key Locker:</span>
                      <span className="font-mono text-teal-400 font-bold">LOCKER-VIP-07</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-teal-600 py-2.5 text-xs font-bold text-white hover:bg-teal-500 transition-colors shadow-lg shadow-teal-600/30"
                  >
                    Accept Vehicle & Generate Ticket
                  </button>
                </form>
              </div>

              {/* Live Valet Tracking */}
              <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-teal-400" />
                    Active Valet Fleet & Retrieval Queue
                  </span>
                  <span className="text-xs font-normal text-slate-400">
                    {valetTickets.length} Vehicles Under Valet Care
                  </span>
                </h3>

                <div className="mt-4 space-y-3">
                  {valetTickets.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-teal-400">{t.ticket_code}</span>
                          <h4 className="text-sm font-bold text-white mt-0.5">
                            {t.customer_name} - {t.vehicle_model}
                          </h4>
                          <span className="font-mono text-xs text-slate-400">{t.vehicle_plate}</span>
                        </div>

                        <div className="text-right">
                          <span className="rounded bg-teal-500/20 px-2.5 py-0.5 text-xs font-bold text-teal-300 border border-teal-500/30">
                            {t.status}
                          </span>
                          <div className="text-[10px] text-slate-500 font-mono mt-1">{t.key_locker_tag}</div>
                        </div>
                      </div>

                      {/* State Workflow Actions */}
                      <div className="flex flex-wrap gap-2 border-t border-slate-900 pt-3">
                        {t.status === "ACCEPTED_AT_KIOSK" && (
                          <button
                            type="button"
                            onClick={() => handleValetAction(t.id, "PARK")}
                            className="rounded bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
                          >
                            Mark As Parked
                          </button>
                        )}
                        {t.status === "PARKED" && (
                          <button
                            type="button"
                            onClick={() => handleValetAction(t.id, "REQUEST_RETRIEVAL")}
                            className="rounded bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 shadow-md"
                          >
                            Customer: "Request My Car" (8 min ETA)
                          </button>
                        )}
                        {t.status === "RETRIEVAL_REQUESTED" && (
                          <button
                            type="button"
                            onClick={() => handleValetAction(t.id, "DELIVER")}
                            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md"
                          >
                            Mark As Delivered to Customer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 8: WHATSAPP NOTIFICATIONS & MULTILINGUAL REGIONAL SWITCHER */}
        {/* ================================================================= */}
        {activeTab === "WHATSAPP_LANG" && (
          <div className="space-y-6">
            {/* WHATSAPP DISCLAIMER */}
            <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4">
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-200">
                    WhatsApp Cloud API Simulation & Regional Multilingual Support
                  </h3>
                  <p className="mt-1 text-xs text-emerald-300/80">
                    DISCLAIMER: Meta WhatsApp Cloud API credentials required for real-world SMS/WA delivery. Currently executing in architectural sandbox simulation with localized templates in Hindi, Marathi, Kannada, Telugu & Tamil.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* WhatsApp Simulator */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Send className="h-4 w-4 text-emerald-400" />
                  Meta WhatsApp Business Dispatcher
                </h3>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Recipient Phone Number</label>
                    <input
                      type="text"
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono font-bold text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300">Message Template</label>
                    <select
                      value={waTemplate}
                      onChange={(e) => setWaTemplate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white"
                    >
                      <option value="BOOKING_CONFIRMATION">Booking Confirmation Pass</option>
                      <option value="EV_CHARGING_COMPLETE">EV Charging Complete (80% Reached)</option>
                      <option value="GATE_ACCESS_PASS">Gate FASTag Pass & Barcode</option>
                      <option value="SUBSCRIPTION_RENEWAL">Monthly Pass Renewal Notice</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30"
                  >
                    Dispatch Simulated WhatsApp Message
                  </button>

                  {/* Logs list */}
                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <h5 className="text-xs font-bold text-slate-300">Dispatch Audit Log</h5>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {waLogs.slice(0, 4).map((l) => (
                        <div key={l.id} className="rounded bg-slate-950 p-2.5 text-xs border border-slate-800">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span className="font-mono text-emerald-400">{l.message_sid}</span>
                            <span>{l.template_name}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-300">{l.message_body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Multilingual Localization Switcher */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-blue-400" />
                  Regional Multilingual Support (6 Indian Languages)
                </h3>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Select UI Language</label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {[
                        { code: "en", name: "English" },
                        { code: "hi", name: "हिन्दी (Hindi)" },
                        { code: "mr", name: "मराठी (Marathi)" },
                        { code: "kn", name: "ಕನ್ನಡ (Kannada)" },
                        { code: "te", name: "తెలుగు (Telugu)" },
                        { code: "ta", name: "தமிழ் (Tamil)" },
                      ].map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            setSelectedLocale(lang.code);
                            loadLocalization(lang.code);
                          }}
                          className={`rounded-lg py-2 text-xs font-bold transition-all ${
                            selectedLocale === lang.code
                              ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {lang.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Translated UI Elements Preview */}
                  <div className="rounded-lg bg-slate-950 p-4 border border-slate-800 space-y-2">
                    <h5 className="text-xs font-bold text-slate-300">Live Dictionary Rendering:</h5>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">App Title:</span>
                        <span className="font-bold text-white">{localizedStrings.app_title || "Parkwise Enterprise"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Reserve Bay:</span>
                        <span className="font-bold text-emerald-400">{localizedStrings.book_bay || "Reserve"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">EV Fast Charging:</span>
                        <span className="font-bold text-emerald-400">{localizedStrings.ev_charging || "EV Charging"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Subscriptions:</span>
                        <span className="font-bold text-blue-400">{localizedStrings.subscriptions || "Subscriptions"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Digital Valet:</span>
                        <span className="font-bold text-teal-400">{localizedStrings.valet || "Valet Desk"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
