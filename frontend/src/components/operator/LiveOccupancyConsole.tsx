"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Camera,
  Car,
  CheckCircle2,
  Clock,
  Eye,
  Layers,
  Power,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Sliders,
  Sparkles,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  applyOperatorOverride,
  clearOperatorOverride,
  fetchCVReviewQueue,
  fetchFacilityLiveOccupancy,
  fetchIoTDevices,
  fetchOccupancyEvents,
  ingestSensorTelemetry,
  resolveCVReview,
  simulateDeviceFailure,
  submitCameraFrameDetection,
  triggerStaleScan,
  CVUncertainReviewItem,
  FacilityLiveOccupancyResponse,
  IoTDeviceItem,
  LiveSlotOccupancyItem,
  OccupancyEventItem,
  OccupancyState,
} from "@/lib/occupancyApi";

export default function LiveOccupancyConsole({ facilityId = 1 }: { facilityId?: number }) {
  const [data, setData] = useState<FacilityLiveOccupancyResponse | null>(null);
  const [devices, setDevices] = useState<IoTDeviceItem[]>([]);
  const [reviews, setReviews] = useState<CVUncertainReviewItem[]>([]);
  const [events, setEvents] = useState<OccupancyEventItem[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<number>(2); // Default to B2 (Zone C)
  const [activeTab, setActiveTab] = useState<"grid" | "cv_queue" | "devices" | "events">("grid");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [simulating, setSimulating] = useState<string | null>(null);

  // Selected slot for manual override modal
  const [selectedSlot, setSelectedSlot] = useState<LiveSlotOccupancyItem | null>(null);
  const [overrideState, setOverrideState] = useState<OccupancyState>("BLOCKED");
  const [overrideReason, setOverrideReason] = useState<string>("Routine maintenance and bay inspection");
  const [overrideDuration, setOverrideDuration] = useState<number>(60);
  const [submittingOverride, setSubmittingOverride] = useState<boolean>(false);

  // Load all telemetry
  const loadAllData = async () => {
    try {
      setRefreshing(true);
      const [facData, devList, revList, evtList] = await Promise.all([
        fetchFacilityLiveOccupancy(facilityId),
        fetchIoTDevices(facilityId),
        fetchCVReviewQueue(facilityId),
        fetchOccupancyEvents(facilityId),
      ]);
      setData(facData);
      setDevices(devList);
      setReviews(revList);
      setEvents(evtList);
    } catch (err) {
      console.error("Failed to load occupancy data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadAllData, 5000);
    return () => clearInterval(interval);
  }, [facilityId]);

  // Live simulation triggers
  const handleSimulatePark = async (slotNumber: string) => {
    try {
      setSimulating(`park_${slotNumber}`);
      await ingestSensorTelemetry(facilityId, `SEN-${slotNumber}`, 0.75, true);
      await loadAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(null);
    }
  };

  const handleSimulateDepart = async (slotNumber: string) => {
    try {
      setSimulating(`depart_${slotNumber}`);
      await ingestSensorTelemetry(facilityId, `SEN-${slotNumber}`, 2.5, false);
      await loadAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(null);
    }
  };

  const handleSimulateCameraFrame = async () => {
    try {
      setSimulating("camera_frame");
      // Vehicle over C-140 ROI
      await submitCameraFrameDetection(facilityId, "CAM-B2-01", [
        { class_name: "car", confidence: 0.94, box_2d: [205, 55, 285, 175] },
      ]);
      await loadAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(null);
    }
  };

  const handleSimulateAmbiguousCV = async () => {
    try {
      setSimulating("ambiguous_cv");
      // Ambiguous 55% detection over C-141
      await submitCameraFrameDetection(facilityId, "CAM-B2-01", [
        { class_name: "car", confidence: 0.55, box_2d: [305, 55, 385, 175] },
      ]);
      await loadAllData();
      setActiveTab("cv_queue");
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(null);
    }
  };

  const handleSimulateFailure = async (slotNumber: string) => {
    try {
      setSimulating(`failure_${slotNumber}`);
      const dev = devices.find((d) => d.device_code === `SEN-${slotNumber}`);
      if (dev) {
        await simulateDeviceFailure(dev.id);
        await loadAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(null);
    }
  };

  const handleTriggerStaleScan = async () => {
    try {
      setSimulating("stale_scan");
      await triggerStaleScan(facilityId);
      await loadAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(null);
    }
  };

  const handleApplyOverride = async () => {
    if (!selectedSlot) return;
    try {
      setSubmittingOverride(true);
      await applyOperatorOverride(
        selectedSlot.slot_id,
        overrideState,
        overrideReason,
        overrideDuration
      );
      await loadAllData();
      setSelectedSlot(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleClearOverride = async (slotId: number) => {
    try {
      setSubmittingOverride(true);
      await clearOperatorOverride(slotId);
      await loadAllData();
      setSelectedSlot(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleResolveReview = async (reviewId: number, decision: "APPROVED_OCCUPIED" | "APPROVED_VACANT" | "DISMISSED") => {
    try {
      await resolveCVReview(reviewId, decision, "Operator manual inspection from live CCTV stream");
      await loadAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // State color mapping
  const getStateBadge = (state: OccupancyState) => {
    switch (state) {
      case "VACANT":
        return {
          bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          dot: "bg-emerald-400",
          label: "Vacant",
        };
      case "OCCUPIED":
        return {
          bg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
          dot: "bg-rose-400",
          label: "Occupied",
        };
      case "RESERVED":
        return {
          bg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          dot: "bg-amber-400",
          label: "Reserved",
        };
      case "BLOCKED":
        return {
          bg: "bg-slate-500/10 text-slate-400 border-slate-500/30",
          dot: "bg-slate-400",
          label: "Blocked",
        };
      case "UNKNOWN":
      default:
        return {
          bg: "bg-purple-500/10 text-purple-400 border-purple-500/30",
          dot: "bg-purple-400",
          label: "Unknown (Sensor Fault)",
        };
    }
  };

  const filteredSlots = data?.slots.filter((s) => s.floor === selectedFloor) || [];

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 p-4 md:p-8 font-sans">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
              Phase 15 Live Occupancy
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live IoT Ingest
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            Smart Sensor Occupancy Hub
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            {data?.facility_name || "Bangalore Cyber Gateway, Karnataka"} • Real-Time Availability & Computer Vision Engine
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAllData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-sky-400" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 my-6">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Bays</span>
          <div className="text-2xl font-bold text-white mt-1">{data?.total_slots || 0}</div>
          <span className="text-[11px] text-slate-500">Multilevel Garage</span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
          <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Vacant</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{data?.vacant_slots || 0}</div>
          <span className="text-[11px] text-emerald-500/80">Available to Book</span>
        </div>

        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40">
          <span className="text-xs font-medium text-rose-400 uppercase tracking-wider">Occupied</span>
          <div className="text-2xl font-bold text-rose-400 mt-1">{data?.occupied_slots || 0}</div>
          <span className="text-[11px] text-rose-500/80">Vehicles Detected</span>
        </div>

        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40">
          <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Reserved</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{data?.reserved_slots || 0}</div>
          <span className="text-[11px] text-amber-500/80">Active Bookings</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Blocked</span>
          <div className="text-2xl font-bold text-slate-400 mt-1">{data?.blocked_slots || 0}</div>
          <span className="text-[11px] text-slate-500">Maintenance</span>
        </div>

        <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40">
          <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">Unknown</span>
          <div className="text-2xl font-bold text-purple-400 mt-1">{data?.unknown_slots || 0}</div>
          <span className="text-[11px] text-purple-500/80">Sensor Faults</span>
        </div>
      </div>

      {/* Simulator Action Strip */}
      <div className="max-w-7xl mx-auto mb-6 p-4 rounded-xl bg-gradient-to-r from-slate-900 via-sky-950/20 to-slate-900 border border-sky-900/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-sky-400 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300">
              Interactive Hardware & CV Telemetry Simulator
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Simulate physical sensors & camera feeds with live interlocking
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleSimulatePark("C-142")}
            disabled={simulating !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <Car className="w-3.5 h-3.5" />
            Park in C-142 (Ultrasonic)
          </button>

          <button
            onClick={() => handleSimulateDepart("C-142")}
            disabled={simulating !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Depart C-142 (Vacant)
          </button>

          <button
            onClick={handleSimulateCameraFrame}
            disabled={simulating !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <Camera className="w-3.5 h-3.5" />
            YOLOv8 Car in C-140 (94% Conf)
          </button>

          <button
            onClick={handleSimulateAmbiguousCV}
            disabled={simulating !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Ambiguous Detection in C-141 (55% Conf)
          </button>

          <button
            onClick={() => handleSimulateFailure("C-143")}
            disabled={simulating !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-700 hover:bg-purple-600 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <WifiOff className="w-3.5 h-3.5" />
            Kill Sensor SEN-C-143 (Offline)
          </button>

          <button
            onClick={handleTriggerStaleScan}
            disabled={simulating !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Clock className="w-3.5 h-3.5" />
            Audit Stale Readings
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto flex items-center gap-2 border-b border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab("grid")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "grid"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          Live Garage Bay Grid
        </button>

        <button
          onClick={() => setActiveTab("cv_queue")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "cv_queue"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Eye className="w-4 h-4" />
          AI Computer Vision Review Queue
          {reviews.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-900">
              {reviews.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("devices")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "devices"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Radio className="w-4 h-4" />
          IoT Device Registry ({devices.length})
        </button>

        <button
          onClick={() => setActiveTab("events")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === "events"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Activity className="w-4 h-4" />
          Audit Event Stream
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="max-w-7xl mx-auto">
        {/* Tab 1: Live Garage Bay Grid */}
        {activeTab === "grid" && (
          <div>
            {/* Floor Switcher */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mr-2">Level:</span>
              {[
                { level: 0, label: "Ground (L0)" },
                { level: 1, label: "Basement 1 (B1)" },
                { level: 2, label: "Basement 2 (B2 - Zone C)" },
                { level: 3, label: "Basement 3 (B3)" },
              ].map((fl) => (
                <button
                  key={fl.level}
                  onClick={() => setSelectedFloor(fl.level)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    selectedFloor === fl.level
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800"
                  }`}
                >
                  {fl.label}
                </button>
              ))}
            </div>

            {/* Bays Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredSlots.map((slot) => {
                const badge = getStateBadge(slot.state);
                return (
                  <div
                    key={slot.slot_id}
                    onClick={() => setSelectedSlot(slot)}
                    className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 transition cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-bold text-white group-hover:text-sky-300 transition">
                          {slot.slot_number}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${badge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-3">
                        <span>Zone {slot.zone}</span>
                        <span>•</span>
                        <span>{slot.slot_type}</span>
                        {slot.has_active_override && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                            Override
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        {slot.sensor_health === "ONLINE" ? (
                          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span>{slot.last_device_code || `SEN-${slot.slot_number}`}</span>
                      </div>

                      <span className="text-slate-500 text-[10px]">
                        {(slot.confidence * 100).toFixed(0)}% conf
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: AI Computer Vision Review Queue */}
        {activeTab === "cv_queue" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Ambiguous Detections Queue</h3>
                <p className="text-xs text-slate-400">
                  Detections with confidence between 40% and 75% or marginal boundary overlap. Must not be treated as confirmed vacancies.
                </p>
              </div>
            </div>

            {reviews.length === 0 ? (
              <div className="p-12 text-center rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-medium">All clear! No ambiguous detections pending review.</p>
                <p className="text-xs text-slate-500 mt-1">Use the simulator to push a test ambiguous detection frame.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews.map((rev) => (
                  <div key={rev.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          Bay {rev.slot_number}
                        </span>
                        <span className="text-xs text-slate-400">
                          Cam: {rev.camera_device_code || "CAM-B2-01"}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-amber-300">
                        {(rev.confidence * 100).toFixed(1)}% Confidence
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
                      <div>Detected Class: {rev.detected_class}</div>
                      <div>ROI Bounding Box: {rev.bounding_box_json}</div>
                      <div>Timestamp: {new Date(rev.frame_timestamp).toLocaleTimeString()}</div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => handleResolveReview(rev.id, "APPROVED_OCCUPIED")}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white transition text-center"
                      >
                        Approve as Occupied
                      </button>
                      <button
                        onClick={() => handleResolveReview(rev.id, "APPROVED_VACANT")}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition text-center"
                      >
                        Approve as Vacant
                      </button>
                      <button
                        onClick={() => handleResolveReview(rev.id, "DISMISSED")}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: IoT Device Registry */}
        {activeTab === "devices" && (
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Device Code</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Health</th>
                    <th className="p-3.5">Battery</th>
                    <th className="p-3.5">Signal</th>
                    <th className="p-3.5">Firmware</th>
                    <th className="p-3.5">Last Heartbeat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {devices.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-bold text-white font-sans">{d.device_code}</td>
                      <td className="p-3.5 font-sans">{d.device_type}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold font-sans ${
                            d.health_status === "ONLINE"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : d.health_status === "STALE"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-rose-500/10 text-rose-400"
                          }`}
                        >
                          {d.health_status}
                        </span>
                      </td>
                      <td className="p-3.5">{d.battery_level_pct !== null ? `${d.battery_level_pct}%` : "PoE Wired"}</td>
                      <td className="p-3.5">{d.signal_rssi_dbm} dBm</td>
                      <td className="p-3.5">{d.firmware_version}</td>
                      <td className="p-3.5 font-sans text-slate-400">
                        {new Date(d.last_heartbeat_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Event Stream */}
        {activeTab === "events" && (
          <div className="rounded-xl bg-slate-900 border border-slate-800 divide-y divide-slate-800/60">
            {events.map((evt) => (
              <div key={evt.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-800/30 transition">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white">Bay {evt.slot_number}</span>
                  <span className="text-slate-400">
                    {evt.previous_state} → <span className="font-semibold text-sky-400">{evt.new_state}</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">
                    {evt.source_type}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                  <span>{(evt.confidence * 100).toFixed(0)}% conf</span>
                  <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Operator Manual Override */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">Bay {selectedSlot.slot_number} Inspection</h3>
                <p className="text-xs text-slate-400">Zone {selectedSlot.zone} • Current: {selectedSlot.state}</p>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Manual Status Override
                </label>
                <select
                  value={overrideState}
                  onChange={(e) => setOverrideState(e.target.value as OccupancyState)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-sky-500"
                >
                  <option value="BLOCKED">BLOCKED (Maintenance / Out of Order)</option>
                  <option value="OCCUPIED">OCCUPIED (Force Mark Vehicle Present)</option>
                  <option value="VACANT">VACANT (Force Clear Bay)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Reason for Override
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-sky-500"
                  placeholder="e.g. Oil spill cleanup, physical inspection"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  value={overrideDuration}
                  onChange={(e) => setOverrideDuration(Number(e.target.value))}
                  min={5}
                  max={1440}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleApplyOverride}
                disabled={submittingOverride}
                className="flex-1 py-2 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition"
              >
                Apply Override
              </button>
              {selectedSlot.has_active_override && (
                <button
                  onClick={() => handleClearOverride(selectedSlot.slot_id)}
                  disabled={submittingOverride}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-rose-400 border border-rose-900/50 transition"
                >
                  Revert to Sensors
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
