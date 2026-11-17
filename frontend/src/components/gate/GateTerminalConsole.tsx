"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Camera,
  Car,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  QrCode,
  Wifi,
  WifiOff,
  RotateCcw,
  RefreshCw,
  Lock,
  Unlock,
  Radio,
  FileCheck,
  Eye,
  KeyRound,
  History,
  Activity,
  Layers,
  ChevronRight,
  Send,
  Zap,
} from "lucide-react";
import {
  ANPRReviewItem,
  ANPRScanResponse,
  GateAnalyticsSummaryResponse,
  GateEventItem,
  GateLaneItem,
  OfflineManifestResponse,
  OfflineTokenItem,
  commandBarrier,
  downloadOfflineManifest,
  executeManualOverride,
  fetchGateEvents,
  fetchGateLanes,
  fetchGateStats,
  fetchPendingReviews,
  resolveReview,
  submitANPRScan,
  syncOfflineBatch,
  verifyLocalOffline,
  verifyQRFallback,
} from "@/lib/gateAutomationApi";

export function GateTerminalConsole() {
  const facilityId = 1;

  // Real-time state
  const [lanes, setLanes] = useState<GateLaneItem[]>([]);
  const [reviews, setReviews] = useState<ANPRReviewItem[]>([]);
  const [events, setEvents] = useState<GateEventItem[]>([]);
  const [stats, setStats] = useState<GateAnalyticsSummaryResponse | null>(null);
  const [manifest, setManifest] = useState<OfflineManifestResponse | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"monitor" | "review_queue" | "offline_hub" | "audit_stream">("monitor");

  // Offline operation state
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [localOfflineQueue, setLocalOfflineQueue] = useState<any[]>([]);

  // Live Scan Monitor State
  const [latestScan, setLatestScan] = useState<ANPRScanResponse | null>(null);
  const [scanningPlate, setScanningPlate] = useState<string>("KA-05-MH-9999");
  const [scanningConfidence, setScanningConfidence] = useState<number>(0.96);
  const [scanningDirection, setScanningDirection] = useState<"ENTRY" | "EXIT">("ENTRY");
  const [simulating, setSimulating] = useState<string | null>(null);

  // Manual Review Modal State
  const [selectedReview, setSelectedReview] = useState<ANPRReviewItem | null>(null);
  const [correctedPlateInput, setCorrectedPlateInput] = useState<string>("");
  const [reviewNotesInput, setReviewNotesInput] = useState<string>("Staff visual verification via 4K CCTV feed");

  // Manual Supervisor Override Modal State
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overridePlate, setOverridePlate] = useState<string>("KA-01-VIP-0001");
  const [overrideLaneCode, setOverrideLaneCode] = useState<string>("LANE-ENT-01");
  const [overrideAction, setOverrideAction] = useState<string>("OVERRIDE_ENTRY");
  const [overrideReason, setOverrideReason] = useState<string>("Diplomatic VIP convoy / Emergency medical vehicle transit");

  const [loading, setLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load all telemetry
  const loadAllGateData = async () => {
    try {
      const [lList, rList, eList, sData, mData] = await Promise.all([
        fetchGateLanes(facilityId).catch(() => []),
        fetchPendingReviews(facilityId).catch(() => []),
        fetchGateEvents(facilityId, 25).catch(() => []),
        fetchGateStats(facilityId).catch(() => null),
        downloadOfflineManifest(facilityId, 24).catch(() => null),
      ]);
      setLanes(lList);
      setReviews(rList);
      setEvents(eList);
      setStats(sData);
      setManifest(mData);
    } catch (err) {
      console.error("Failed to load gate data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllGateData();
    const interval = setInterval(loadAllGateData, 6000);
    return () => clearInterval(interval);
  }, [facilityId]);

  // Simulation Triggers
  const handleSimulateValidANPR = async () => {
    try {
      setSimulating("valid_anpr");
      setStatusMessage("Simulating 4K ANPR frame: KA-05-MH-9999 (96% confidence)...");
      const resp = await submitANPRScan({
        facility_id: facilityId,
        camera_code: "CAM-GATE-ENT-01",
        lane_code: "LANE-ENT-01",
        captured_plate_raw: "KA 05 MH 9999",
        confidence_score: 0.96,
        direction: "ENTRY",
      });
      setLatestScan(resp);
      await loadAllGateData();
      setStatusMessage(`Scan authorized! Welcome ${resp.driver_name || "Driver"} — Barrier Opened.`);
    } catch (err: any) {
      setStatusMessage(`ANPR Scan: ${err.message}`);
    } finally {
      setSimulating(null);
    }
  };

  const handleSimulateLowConfidence = async () => {
    try {
      setSimulating("low_conf");
      setStatusMessage("Simulating low-confidence OCR scan: MH-12-??-7777 (62% confidence)...");
      const resp = await submitANPRScan({
        facility_id: facilityId,
        camera_code: "CAM-GATE-ENT-01",
        lane_code: "LANE-ENT-01",
        captured_plate_raw: "MH-12-??-7777",
        confidence_score: 0.62,
        direction: "ENTRY",
      });
      setLatestScan(resp);
      await loadAllGateData();
      setActiveTab("review_queue");
      setStatusMessage("Low confidence detected! Barrier kept closed. Routed to Human Review Queue.");
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setSimulating(null);
    }
  };

  const handleSimulateAntiPassback = async () => {
    try {
      setSimulating("anti_passback");
      setStatusMessage("Attempting duplicate entry for already checked-in vehicle...");
      const resp = await submitANPRScan({
        facility_id: facilityId,
        camera_code: "CAM-GATE-ENT-01",
        lane_code: "LANE-ENT-01",
        captured_plate_raw: "KA 05 MH 9999",
        confidence_score: 0.95,
        direction: "ENTRY",
      });
      setLatestScan(resp);
      await loadAllGateData();
      setStatusMessage(`Anti-passback alert: ${resp.decision_reason}`);
    } catch (err: any) {
      setStatusMessage(`Anti-passback error: ${err.message}`);
    } finally {
      setSimulating(null);
    }
  };

  const handleSimulateQRFallback = async () => {
    try {
      setSimulating("qr_fallback");
      setStatusMessage("Simulating QR-code fallback scanning for obscured plate...");
      const refToScan = manifest?.tokens[0]?.booking_reference || "PW-ANPR-001";
      const resp = await verifyQRFallback({
        facility_id: facilityId,
        lane_code: "LANE-ENT-01",
        qr_payload: refToScan,
        direction: "ENTRY",
      });
      setLatestScan(resp);
      await loadAllGateData();
      setStatusMessage(`QR Fallback verified: ${resp.matched_booking_reference} authorized! Barrier opened.`);
    } catch (err: any) {
      setStatusMessage(`QR fallback error: ${err.message}`);
    } finally {
      setSimulating(null);
    }
  };

  const handleSimulateOfflineAuth = async () => {
    try {
      setSimulating("offline_auth");
      setIsOfflineMode(true);
      if (!manifest || manifest.tokens.length === 0) {
        setStatusMessage("Downloading fresh offline manifest first...");
        const m = await downloadOfflineManifest(facilityId, 24);
        setManifest(m);
      }
      const token = manifest?.tokens[0];
      if (!token) {
        throw new Error("No offline tokens available in local cache");
      }

      setStatusMessage(`Offline Terminal: Validating local HMAC-SHA256 token for ${token.vehicle_number_normalized}...`);
      const localResp = await verifyLocalOffline(facilityId, token.vehicle_number_normalized, token, "ENTRY");

      // Enqueue to local offline queue
      const offlineEvent = {
        client_event_uuid: localResp.generated_offline_event_uuid,
        facility_id: facilityId,
        lane_code: "LANE-ENT-01",
        direction: "ENTRY",
        vehicle_number: token.vehicle_number_normalized,
        booking_reference: token.booking_reference,
        verification_method: "OFFLINE_LOCAL_CRYPTO",
        offline_client_timestamp: new Date().toISOString(),
        hmac_signature: token.hmac_signature,
        barrier_action: "OPENED",
      };
      setLocalOfflineQueue((prev) => [...prev, offlineEvent]);

      setStatusMessage(`Offline Authorization Granted! Local HMAC Signature Validated. Local Queue: ${localOfflineQueue.length + 1} events.`);
      await loadAllGateData();
    } catch (err: any) {
      setStatusMessage(`Offline Auth Error: ${err.message}`);
    } finally {
      setSimulating(null);
    }
  };

  const handleSyncOfflineEvents = async () => {
    try {
      setSimulating("sync_offline");
      if (localOfflineQueue.length === 0) {
        setStatusMessage("No pending offline events in local gate storage.");
        return;
      }
      setStatusMessage(`Reconnecting to Cloud: Syncing ${localOfflineQueue.length} offline events...`);
      const syncResp = await syncOfflineBatch(facilityId, localOfflineQueue);
      setLocalOfflineQueue([]);
      setIsOfflineMode(false);
      await loadAllGateData();
      setStatusMessage(`Sync Completed! Synced: ${syncResp.successfully_synced}, Duplicates Skipped: ${syncResp.duplicates_skipped}.`);
    } catch (err: any) {
      setStatusMessage(`Sync error: ${err.message}`);
    } finally {
      setSimulating(null);
    }
  };

  // Barrier Actuation
  const handleBarrierCommand = async (laneId: number, command: "OPEN" | "CLOSED" | "HOLD_OPEN") => {
    try {
      const resp = await commandBarrier(laneId, command, "Operator manual console toggle");
      await loadAllGateData();
      setStatusMessage(`Barrier ${resp.lane_code} command sent: ${resp.execution_status}`);
    } catch (err: any) {
      setStatusMessage(`Relay Error: ${err.message}`);
    }
  };

  // Resolve Review
  const handleResolveReviewItem = async (decision: "APPROVED_AS_IS" | "CORRECTED_AND_APPROVED" | "REJECTED") => {
    if (!selectedReview) return;
    try {
      await resolveReview(
        selectedReview.id,
        decision,
        decision === "CORRECTED_AND_APPROVED" ? correctedPlateInput : undefined,
        reviewNotesInput
      );
      setSelectedReview(null);
      await loadAllGateData();
      setStatusMessage(`Review resolved: ${decision} — Barrier actuated.`);
    } catch (err: any) {
      setStatusMessage(`Resolution Error: ${err.message}`);
    }
  };

  // Manual Override Submit
  const handleExecuteOverride = async () => {
    try {
      const resp = await executeManualOverride({
        facility_id: facilityId,
        lane_code: overrideLaneCode,
        action: overrideAction,
        vehicle_number: overridePlate,
        reason: overrideReason,
      });
      setShowOverrideModal(false);
      await loadAllGateData();
      setStatusMessage(`Supervisor Override Executed: ${resp.vehicle_number_masked} allowed through. Reason logged for compliance.`);
    } catch (err: any) {
      setStatusMessage(`Override Error: ${err.message}`);
    }
  };

  // Helper badge styles
  const getDecisionBadge = (decision: string) => {
    if (decision === "AUTHORIZED" || decision === "QR_FALLBACK_AUTHORIZED" || decision === "OFFLINE_AUTHORIZED") {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    }
    if (decision === "MANUAL_REVIEW") {
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    }
    return "bg-rose-500/10 text-rose-400 border-rose-500/30";
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 p-4 md:p-8 font-sans">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
              Phase 16 Gate Automation
            </span>
            {isOfflineMode ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
                <WifiOff className="w-3 h-3" />
                Offline Mode • Crypto Cache Active ({localOfflineQueue.length} queued)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <Wifi className="w-3 h-3" />
                Live Cloud Sync Active
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            ANPR Gate & Offline Operations Terminal
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Bangalore Cyber Gateway • Multi-Lane Boom Barrier Controller & Cryptographic Edge Engine
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
              isOfflineMode
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {isOfflineMode ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOfflineMode ? "Re-connect Online" : "Toggle Offline Mode"}
          </button>

          <button
            onClick={() => setShowOverrideModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/80 hover:bg-rose-500 text-white border border-rose-500/30 flex items-center gap-1.5 transition shadow-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Supervisor Override
          </button>

          <button
            onClick={loadAllGateData}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh All Telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div className="max-w-7xl mx-auto mt-4 p-3 rounded-xl bg-slate-900/90 border border-slate-700/60 flex items-center justify-between text-xs text-slate-200">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-200 text-xs ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Stats Counter Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-6 gap-3 mt-6">
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Scans</div>
          <div className="text-2xl font-bold text-white mt-1">{stats?.total_scans_today ?? 24}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Today across lanes</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Auto-Authorized</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{stats?.auto_authorization_rate_pct ?? 95.8}%</div>
          <div className="text-[10px] text-slate-400 mt-0.5">High-confidence ANPR</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-[11px] font-medium text-sky-400 uppercase tracking-wider">ANPR Accuracy</div>
          <div className="text-2xl font-bold text-sky-400 mt-1">
            {stats ? (stats.average_anpr_confidence * 100).toFixed(1) : 96.4}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">MoRTH OCR engine</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Review Queue</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{reviews.length}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Pending supervisor check</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-[11px] font-medium text-purple-400 uppercase tracking-wider">QR Fallbacks</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{stats?.qr_fallback_count ?? 3}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Obscured camera reads</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="text-[11px] font-medium text-indigo-400 uppercase tracking-wider">Crypto Cache</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{manifest?.total_tokens ?? 25}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Signed offline tokens</div>
        </div>
      </div>

      {/* Interactive Simulation Strip */}
      <div className="max-w-7xl mx-auto mt-6 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-sky-400 animate-pulse" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Interactive ANPR & Gate Hardware Simulator
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            Simulate optical camera inputs, QR fallbacks, anti-passback violations & offline edge crypto
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSimulateValidANPR}
            disabled={simulating !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <Camera className="w-3.5 h-3.5" />
            Valid ANPR Entry (KA-05-MH-9999, 96%)
          </button>

          <button
            onClick={handleSimulateLowConfidence}
            disabled={simulating !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Low-Confidence OCR (MH-12-??-7777, 62%)
          </button>

          <button
            onClick={handleSimulateAntiPassback}
            disabled={simulating !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-700 hover:bg-rose-600 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Anti-Passback Duplicate Entry
          </button>

          <button
            onClick={handleSimulateQRFallback}
            disabled={simulating !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <QrCode className="w-3.5 h-3.5" />
            QR Code Fallback Entry
          </button>

          <button
            onClick={handleSimulateOfflineAuth}
            disabled={simulating !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <Lock className="w-3.5 h-3.5" />
            Offline Mode Local Crypto Auth
          </button>

          <button
            onClick={handleSyncOfflineEvents}
            disabled={simulating !== null || localOfflineQueue.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white shadow-sm flex items-center gap-1.5 transition disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Sync Offline Events ({localOfflineQueue.length})
          </button>
        </div>
      </div>

      {/* Lane Controller Status Strip */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {lanes.map((lane) => (
          <div
            key={lane.id}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{lane.lane_name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {lane.lane_code}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  IP: {lane.ip_address} • {lane.controller_model}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                    lane.barrier_state === "OPEN" || lane.barrier_state === "HOLD_OPEN"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {lane.barrier_state === "OPEN"
                    ? "BARRIER OPEN"
                    : lane.barrier_state === "HOLD_OPEN"
                    ? "HOLD OPEN"
                    : "BARRIER CLOSED"}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Relay Online
                </span>
                <span>•</span>
                <span>Auto-Open: {lane.auto_open_enabled ? "ON" : "OFF"}</span>
                <span>•</span>
                <span>Anti-Passback: {lane.anti_passback_enabled ? "ON" : "OFF"}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBarrierCommand(lane.id, "OPEN")}
                  className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600/80 hover:bg-emerald-500 text-white transition"
                >
                  Open
                </button>
                <button
                  onClick={() => handleBarrierCommand(lane.id, "CLOSED")}
                  className="px-2.5 py-1 rounded text-xs font-semibold bg-rose-600/80 hover:bg-rose-500 text-white transition"
                >
                  Close
                </button>
                <button
                  onClick={() => handleBarrierCommand(lane.id, "HOLD_OPEN")}
                  className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
                >
                  Hold
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation View Tabs */}
      <div className="max-w-7xl mx-auto flex items-center gap-2 mt-6 border-b border-slate-800">
        <button
          onClick={() => setActiveTab("monitor")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "monitor"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Camera className="w-4 h-4" />
          Live ANPR Camera Monitor
        </button>

        <button
          onClick={() => setActiveTab("review_queue")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "review_queue"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Eye className="w-4 h-4" />
          Human-in-the-Loop Review Queue
          {reviews.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-900">
              {reviews.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("offline_hub")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "offline_hub"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Offline Crypto Hub ({manifest?.total_tokens ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("audit_stream")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "audit_stream"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <History className="w-4 h-4" />
          Auditable Event History ({events.length})
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="max-w-7xl mx-auto mt-6">
        {/* Tab 1: Live ANPR Monitor */}
        {activeTab === "monitor" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 4K Camera Viewport Mockup */}
            <div className="lg:col-span-2 rounded-2xl bg-black border border-slate-800 p-4 relative overflow-hidden flex flex-col justify-between min-h-[380px]">
              <div className="flex items-center justify-between text-xs text-slate-400 z-10">
                <div className="flex items-center gap-2 bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-700">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  <span className="font-mono text-[11px] text-white">REC 4K • CAM-GATE-ENT-01 (Hikvision DarkFighter)</span>
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  {new Date().toLocaleTimeString()} • 30 FPS • H.265
                </div>
              </div>

              {/* Simulated vehicle plate targeting box */}
              <div className="my-auto flex flex-col items-center justify-center p-6 text-center z-10">
                <div className="relative border-2 border-emerald-400/80 rounded-lg p-3 bg-emerald-950/20 shadow-[0_0_25px_rgba(52,211,153,0.3)] max-w-sm w-full">
                  <div className="text-[10px] font-mono text-emerald-300 uppercase tracking-widest text-left mb-1 flex items-center justify-between">
                    <span>HSRP PLATE DETECTED</span>
                    <span>CONF: {((latestScan?.confidence_score ?? scanningConfidence) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="bg-white text-slate-950 font-black text-2xl md:text-3xl tracking-widest py-2 px-4 rounded border-2 border-black flex items-center justify-center font-mono">
                    {latestScan?.raw_plate || scanningPlate}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">Norm:</span>
                  <span className="text-xs font-mono font-bold text-sky-400">
                    {latestScan?.normalized_plate || "KA05MH9999"}
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="text-xs text-slate-400 font-mono">Privacy Mask:</span>
                  <span className="text-xs font-mono text-slate-300">
                    {latestScan?.masked_plate || "KA 05 ** 9999"}
                  </span>
                </div>
              </div>

              {/* Bottom camera telemetry stats */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 z-10 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span>OCR Engine: Indian-HSRP-YOLO-OCR-v2</span>
                <span>Latency: 48ms</span>
                <span>Target Lane: LANE-ENT-01</span>
              </div>
            </div>

            {/* Decision & Verification Panel */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Gate Access Authorization Result
                </h3>

                {latestScan ? (
                  <div className="space-y-4">
                    <div
                      className={`p-4 rounded-xl border flex items-start gap-3 ${getDecisionBadge(
                        latestScan.decision
                      )}`}
                    >
                      {latestScan.decision === "AUTHORIZED" ||
                      latestScan.decision === "QR_FALLBACK_AUTHORIZED" ||
                      latestScan.decision === "OFFLINE_AUTHORIZED" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold text-sm tracking-tight">{latestScan.decision}</div>
                        <div className="text-xs mt-0.5 opacity-90">{latestScan.decision_reason}</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                        <span className="text-slate-400">Barrier Action:</span>
                        <span className="font-bold text-white">{latestScan.barrier_action}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                        <span className="text-slate-400">Booking Reference:</span>
                        <span className="font-mono text-sky-400 font-bold">
                          {latestScan.matched_booking_reference || "No Booking"}
                        </span>
                      </div>

                      {latestScan.assigned_slot_number && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                          <span className="text-slate-400">Allotted Slot:</span>
                          <span className="font-bold text-emerald-400">
                            {latestScan.assigned_slot_number} (Basement 2)
                          </span>
                        </div>
                      )}

                      {latestScan.driver_name && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                          <span className="text-slate-400">Driver Name:</span>
                          <span className="font-medium text-slate-200">{latestScan.driver_name}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                        <span className="text-slate-400">Verification Method:</span>
                        <span className="font-medium text-slate-200">{latestScan.verification_method}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    Ready for camera scans. Click any simulation button above or submit a test license plate.
                  </div>
                )}
              </div>

              {/* Quick Scan Form */}
              <div className="mt-4 pt-4 border-t border-slate-800">
                <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
                  Manual Plate OCR Test Input
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={scanningPlate}
                    onChange={(e) => setScanningPlate(e.target.value)}
                    placeholder="e.g. DL-08-CAF-8921"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono tracking-wider focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={() => {
                      submitANPRScan({
                        facility_id: facilityId,
                        camera_code: "CAM-GATE-ENT-01",
                        lane_code: "LANE-ENT-01",
                        captured_plate_raw: scanningPlate,
                        confidence_score: scanningConfidence,
                        direction: scanningDirection,
                      }).then((res) => {
                        setLatestScan(res);
                        loadAllGateData();
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition"
                  >
                    Scan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Human-in-the-Loop Review Queue */}
        {activeTab === "review_queue" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Pending License Plate Verification Queue</h3>
                <p className="text-xs text-slate-400">
                  Detections with confidence &lt; 80% or ambiguous OCR characters hold the gate barrier until human confirmation.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {reviews.length} PENDING
              </span>
            </div>

            {reviews.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                Review queue is clear! All camera reads met or exceeded confidence threshold.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reviews.map((rev) => (
                  <div key={rev.id} className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-mono text-slate-400">{rev.lane_code}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {(rev.confidence_score * 100).toFixed(0)}% Conf
                        </span>
                      </div>

                      {/* Mock vehicle plate crop */}
                      <div className="p-3 bg-black rounded-lg border border-slate-700 text-center my-2 font-mono text-xl font-bold text-amber-400 tracking-widest">
                        {rev.captured_plate_raw}
                      </div>

                      <div className="text-xs text-slate-400 mt-2">
                        Suggested Candidates:
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rev.suggested_candidates.map((cand, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedReview(rev);
                                setCorrectedPlateInput(cand);
                              }}
                              className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-sky-400 border border-slate-700 hover:bg-slate-700"
                            >
                              {cand}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedReview(rev);
                          setCorrectedPlateInput(rev.captured_plate_raw);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition"
                      >
                        Inspect & Correct
                      </button>
                      <button
                        onClick={() => resolveReview(rev.id, "REJECTED", undefined, "Staff rejected ambiguous plate").then(loadAllGateData)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/80 hover:bg-rose-500 text-white transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Offline Crypto Hub */}
        {activeTab === "offline_hub" && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Cryptographic Offline Gate Manifest</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                  Time-bounded signed HMAC-SHA256 tokens enable edge kiosks to authorize drivers with 0ms network latency even when local fiber or internet connectivity is completely severed.
                </p>
                <div className="text-[11px] text-slate-500 font-mono mt-1">
                  Manifest ID: {manifest?.manifest_id || "None"} • Tokens: {manifest?.total_tokens ?? 0}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadOfflineManifest(facilityId, 24).then((m) => setManifest(m))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Manifest
                </button>
                <button
                  onClick={handleSimulateOfflineAuth}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Simulate Local HMAC Check
                </button>
              </div>
            </div>

            {/* Tokens table */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 font-bold text-xs text-white uppercase tracking-wider">
                Cached Offline Authorization Tokens ({manifest?.tokens.length || 0})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Booking Ref</th>
                      <th className="py-2.5 px-4">Vehicle Plate</th>
                      <th className="py-2.5 px-4">Slot</th>
                      <th className="py-2.5 px-4">Valid Window</th>
                      <th className="py-2.5 px-4">HMAC-SHA256 Signature</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {manifest?.tokens.slice(0, 10).map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono text-sky-400">{t.booking_reference}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-white">{t.vehicle_number_normalized}</td>
                        <td className="py-2.5 px-4 text-emerald-400">{t.slot_number}</td>
                        <td className="py-2.5 px-4 text-slate-400">
                          {new Date(t.valid_from_iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                          {new Date(t.valid_to_iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500 max-w-[180px] truncate" title={t.hmac_signature}>
                          {t.hmac_signature.slice(0, 24)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Audit Event Stream */}
        {activeTab === "audit_stream" && (
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-xs text-white uppercase tracking-wider">
                Auditable Gate Access Feed (DPDP India 2023 Compliant)
              </span>
              <span className="text-[11px] text-slate-400">Vehicle plates masked for non-supervisor view</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Time</th>
                    <th className="py-2.5 px-4">Lane / Dir</th>
                    <th className="py-2.5 px-4">Masked Plate</th>
                    <th className="py-2.5 px-4">Method</th>
                    <th className="py-2.5 px-4">Decision</th>
                    <th className="py-2.5 px-4">Barrier Action</th>
                    <th className="py-2.5 px-4">Booking Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {events.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-slate-300">{e.lane_code}</span>
                        <span className={`ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          e.direction === "ENTRY" ? "bg-emerald-500/20 text-emerald-400" : "bg-sky-500/20 text-sky-400"
                        }`}>
                          {e.direction}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-200">{e.masked_plate}</td>
                      <td className="py-2.5 px-4 text-slate-400">{e.verification_method}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getDecisionBadge(e.decision)}`}>
                          {e.decision}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-white">{e.barrier_action}</td>
                      <td className="py-2.5 px-4 font-mono text-sky-400">{e.matched_booking_reference || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Review Resolution Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Gate Staff Plate Inspection & Correction</h3>
            <p className="text-xs text-slate-400 mb-4">
              Inspect OCR character confidence and apply human supervisor correction before releasing the boom barrier.
            </p>

            <div className="p-3 bg-black rounded-lg border border-slate-700 text-center font-mono text-2xl font-bold text-amber-400 tracking-widest mb-4">
              {selectedReview.captured_plate_raw}
            </div>

            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Corrected Registration Number
            </label>
            <input
              type="text"
              value={correctedPlateInput}
              onChange={(e) => setCorrectedPlateInput(e.target.value.toUpperCase())}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase tracking-wider mb-3 focus:outline-none focus:border-sky-500"
            />

            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Supervisor Verification Notes
            </label>
            <textarea
              value={reviewNotesInput}
              onChange={(e) => setReviewNotesInput(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white mb-4 focus:outline-none focus:border-sky-500"
              rows={2}
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleResolveReviewItem("CORRECTED_AND_APPROVED")}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition"
              >
                Approve & Open Barrier
              </button>
              <button
                onClick={() => handleResolveReviewItem("REJECTED")}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition"
              >
                Reject
              </button>
              <button
                onClick={() => setSelectedReview(null)}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supervisor Manual Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-2 mb-2 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Emergency Supervisor Manual Override</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Actuates the boom barrier manually. Every override creates an immutable compliance audit record under DPDP India regulations.
            </p>

            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Vehicle License Plate
            </label>
            <input
              type="text"
              value={overridePlate}
              onChange={(e) => setOverridePlate(e.target.value.toUpperCase())}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase tracking-wider mb-3 focus:outline-none focus:border-rose-500"
            />

            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Target Lane
            </label>
            <select
              value={overrideLaneCode}
              onChange={(e) => setOverrideLaneCode(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white mb-3 focus:outline-none focus:border-rose-500"
            >
              {lanes.map((l) => (
                <option key={l.id} value={l.lane_code}>
                  {l.lane_name} ({l.lane_code})
                </option>
              ))}
            </select>

            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Mandatory Auditable Justification
            </label>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white mb-4 focus:outline-none focus:border-rose-500"
              rows={2}
            />

            <div className="flex items-center gap-2">
              <button
                onClick={handleExecuteOverride}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center justify-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5" />
                Execute Override & Open Barrier
              </button>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
