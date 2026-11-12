"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bot,
  Brain,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Info,
  Layers,
  Lock,
  MapPin,
  Maximize2,
  MessageSquare,
  Moon,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  askLocationAssistant,
  createManagedEvent,
  fetchDensityHeatmap,
  fetchFacilityComparison,
  fetchFacilityDemandForecast,
  fetchManagedEvents,
  fetchOccupancyMatrix,
  fetchPricingProposals,
  reviewPricingProposal,
  DemandForecastResponse,
  DynamicPricingProposalItem,
  FacilityDemandComparisonItem,
  HeatmapDensityResponse,
  HeatmapPointItem,
  LocationAssistantResponse,
  ManagedEventItem,
  OccupancyMatrixResponse,
} from "@/lib/locationIntelligenceApi";

const METRO_CITIES = ["ALL", "New Delhi", "Mumbai", "Bengaluru", "Gurugram", "Hyderabad", "Chennai"];

export function AIIntelligenceHeatmapConsole() {
  // Navigation & Control State
  const [activeTab, setActiveTab] = useState<
    "HEATMAPS" | "FORECASTING" | "PRICING" | "EVENTS" | "ASSISTANT"
  >("HEATMAPS");
  const [selectedCity, setSelectedCity] = useState<string>("ALL");
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Tab 1: Heatmaps & Matrix State
  const [heatdataType, setHeatdataType] = useState<"HISTORICAL" | "CURRENT" | "PREDICTED">("HISTORICAL");
  const [timeWindow, setTimeWindow] = useState<"24H" | "7D" | "30D">("7D");
  const [densityData, setDensityData] = useState<HeatmapDensityResponse | null>(null);
  const [matrixData, setMatrixData] = useState<OccupancyMatrixResponse | null>(null);
  const [comparisonData, setComparisonData] = useState<FacilityDemandComparisonItem[]>([]);
  const [viewSubMode, setViewSubMode] = useState<"GRID" | "BENCHMARKS">("GRID");
  const [selectedCell, setSelectedCell] = useState<{
    day: string;
    hour: number;
    occ: number;
    sample: number;
    isPeak: boolean;
  } | null>(null);

  // Tab 2: AI Forecasting State
  const [selectedFacilityId, setSelectedFacilityId] = useState<number>(1);
  const [forecastData, setForecastData] = useState<DemandForecastResponse | null>(null);
  const [forecastHorizon, setForecastHorizon] = useState<number>(24);

  // Tab 3: Dynamic Pricing Proposals State
  const [proposals, setProposals] = useState<DynamicPricingProposalItem[]>([]);
  const [pricingFilter, setPricingFilter] = useState<string>("PENDING_APPROVAL");

  // Tab 4: Event Intelligence State
  const [events, setEvents] = useState<ManagedEventItem[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState<boolean>(false);
  const [newEventName, setNewEventName] = useState<string>("");
  const [newEventVenue, setNewEventVenue] = useState<string>("");
  const [newEventCity, setNewEventCity] = useState<string>("New Delhi");
  const [newEventAttendance, setNewEventAttendance] = useState<number>(5000);
  const [newEventSurge, setNewEventSurge] = useState<number>(1.25);
  const [newEventAction, setNewEventAction] = useState<string>("");

  // Tab 5: AI Operator Assistant State
  const [assistantInput, setAssistantInput] = useState<string>("");
  const [assistantResponse, setAssistantResponse] = useState<LocationAssistantResponse | null>(null);
  const [isAsking, setIsAsking] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // Data Loaders
  // --------------------------------------------------------------------------
  const loadHeatmapData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [density, matrix, comparison] = await Promise.all([
        fetchDensityHeatmap({
          city: selectedCity,
          data_type: heatdataType,
          time_window: timeWindow,
        }),
        fetchOccupancyMatrix({
          city: selectedCity,
        }),
        fetchFacilityComparison(selectedCity),
      ]);
      setDensityData(density);
      setMatrixData(matrix);
      setComparisonData(comparison);
    } catch (e: unknown) {
      console.error("Heatmap load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCity, heatdataType, timeWindow]);

  const loadForecastData = useCallback(async () => {
    setIsLoading(true);
    try {
      const f = await fetchFacilityDemandForecast(selectedFacilityId, forecastHorizon);
      setForecastData(f);
    } catch (e: unknown) {
      console.error("Forecast load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFacilityId, forecastHorizon]);

  const loadPricingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPricingProposals({ status_filter: pricingFilter });
      setProposals(data);
    } catch (e: unknown) {
      console.error("Pricing load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [pricingFilter]);

  const loadEventsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const evs = await fetchManagedEvents({ city: selectedCity, is_active: true });
      setEvents(evs);
    } catch (e: unknown) {
      console.error("Events load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCity]);

  // Initial load when tab or city changes
  useEffect(() => {
    if (activeTab === "HEATMAPS") loadHeatmapData();
    if (activeTab === "FORECASTING") loadForecastData();
    if (activeTab === "PRICING") loadPricingData();
    if (activeTab === "EVENTS") loadEventsData();
  }, [activeTab, loadHeatmapData, loadForecastData, loadPricingData, loadEventsData]);

  // --------------------------------------------------------------------------
  // Action Handlers
  // --------------------------------------------------------------------------
  const handleReviewProposal = async (proposalId: number, action: "APPROVED" | "REJECTED") => {
    try {
      const res = await reviewPricingProposal(
        proposalId,
        action,
        `Operator decision: ${action} via AI Location Intelligence Console`
      );
      setToastMessage({
        type: "success",
        text: res.message,
      });
      loadPricingData();
    } catch (err: unknown) {
      setToastMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to review proposal.",
      });
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim() || !newEventVenue.trim()) return;

    try {
      const now = new Date();
      const startTime = new Date(now.getTime() + 86400000).toISOString();
      const endTime = new Date(now.getTime() + 86400000 + 36000000).toISOString();

      await createManagedEvent({
        name: newEventName.trim(),
        event_type: "EXHIBITION",
        venue_name: newEventVenue.trim(),
        city: newEventCity,
        latitude: 28.5283,
        longitude: 77.2185,
        radius_impact_km: 3.5,
        start_time: startTime,
        end_time: endTime,
        expected_attendance: newEventAttendance,
        demand_surge_factor: newEventSurge,
        recommended_action: newEventAction || "Deploy overflow marshals and monitor ingress.",
      });

      setToastMessage({
        type: "success",
        text: `Event '${newEventName}' registered. Proximity impact modeled across nearby facilities.`,
      });

      setIsEventModalOpen(false);
      setNewEventName("");
      setNewEventVenue("");
      loadEventsData();
    } catch (err: unknown) {
      setToastMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to create event.",
      });
    }
  };

  const handleAskAssistant = async (customPrompt?: string) => {
    const q = (customPrompt || assistantInput).trim();
    if (!q) return;

    setIsAsking(true);
    try {
      const res = await askLocationAssistant(q, selectedFacilityId);
      setAssistantResponse(res);
      setAssistantInput("");
    } catch (err: unknown) {
      setToastMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to query assistant.",
      });
    } finally {
      setIsAsking(false);
    }
  };

  // Color helper for 7x24 heatmap cell
  const getCellColor = (occ: number) => {
    if (occ >= 85) return "bg-red-500 text-white font-extrabold shadow-sm";
    if (occ >= 70) return "bg-amber-500 text-slate-950 font-bold";
    if (occ >= 50) return "bg-blue-600 text-white font-medium";
    if (occ >= 30) return "bg-emerald-600 text-white font-medium";
    return themeMode === "dark" ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-600";
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div
      className={`rounded-3xl border shadow-2xl overflow-hidden font-sans transition-colors duration-200 ${
        themeMode === "dark"
          ? "bg-slate-950 border-slate-800 text-slate-100"
          : "bg-white border-slate-200 text-slate-900"
      }`}
    >
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 text-xs font-semibold ${
            toastMessage.type === "success"
              ? "bg-emerald-600 text-white"
              : toastMessage.type === "error"
              ? "bg-red-600 text-white"
              : "bg-blue-600 text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="hover:opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TOP HEADER & MODULE TABS                                              */}
      {/* ===================================================================== */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4 ${
          themeMode === "dark"
            ? "border-slate-800 bg-slate-900/80 backdrop-blur"
            : "border-slate-200 bg-slate-50/80 backdrop-blur"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/25">
            <Brain className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight">
                AI Location Intelligence &amp; Demand Heatmaps
              </h2>
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-extrabold text-purple-400">
                Phase 13
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Spatial density modeling • XGBoost demand forecasting • Explainable recommendations • Human-in-the-loop pricing
            </p>
          </div>
        </div>

        {/* Global Metro City Filter & Theme Toggle */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <MapPin className="h-3.5 w-3.5 text-purple-400" />
            <span>Metro City:</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer ${
                themeMode === "dark"
                  ? "bg-slate-800 border border-slate-700 text-slate-200"
                  : "bg-white border border-slate-300 text-slate-800"
              }`}
            >
              {METRO_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "All Metro Cities" : c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
            className={`rounded-xl p-2 transition ${
              themeMode === "dark"
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
            title="Toggle Light/Dark Theme"
          >
            {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeTab === "HEATMAPS") loadHeatmapData();
              if (activeTab === "FORECASTING") loadForecastData();
              if (activeTab === "PRICING") loadPricingData();
              if (activeTab === "EVENTS") loadEventsData();
            }}
            className={`rounded-xl p-2 transition ${
              themeMode === "dark"
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
            title="Refresh Intelligence Data"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        className={`flex flex-wrap items-center gap-1 border-b px-6 py-2.5 text-xs font-bold ${
          themeMode === "dark" ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-slate-100/60"
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveTab("HEATMAPS")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
            activeTab === "HEATMAPS"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Flame className="h-3.5 w-3.5" />
          <span>Demand Heatmaps</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("FORECASTING")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
            activeTab === "FORECASTING"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>AI Demand Forecasting</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PRICING")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
            activeTab === "PRICING"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Dynamic Pricing Intelligence</span>
          {proposals.filter((p) => p.status === "PENDING_APPROVAL").length > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[9px] text-slate-950 font-black">
              {proposals.filter((p) => p.status === "PENDING_APPROVAL").length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("EVENTS")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
            activeTab === "EVENTS"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Event &amp; Location Modeling</span>
          <span className="rounded-full bg-slate-700 px-1.5 py-0.2 text-[9px] text-slate-300">
            {events.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ASSISTANT")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
            activeTab === "ASSISTANT"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Bot className="h-3.5 w-3.5" />
          <span>AI Operator Assistant</span>
          <span className="rounded-full bg-purple-500/20 px-1.5 py-0.2 text-[9px] text-purple-300">
            Grounded
          </span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: PARKING DEMAND HEATMAPS & MATRIX                                */}
      {/* ===================================================================== */}
      {activeTab === "HEATMAPS" && (
        <div className="p-6 space-y-6">
          {/* Controls Bar: Data Provenance & View Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Data Source:</span>
              <div
                className={`flex rounded-xl p-0.5 ${
                  themeMode === "dark" ? "bg-slate-900 border border-slate-800" : "bg-slate-100 border border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setHeatdataType("HISTORICAL")}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    heatdataType === "HISTORICAL"
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Historical Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setHeatdataType("CURRENT")}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    heatdataType === "CURRENT"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Live Sensor Readings
                </button>
                <button
                  type="button"
                  onClick={() => setHeatdataType("PREDICTED")}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    heatdataType === "PREDICTED"
                      ? "bg-purple-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Forecasted Demand
                </button>
              </div>

              <div className="flex items-center gap-1 text-xs font-semibold ml-2">
                <span className="text-slate-400">Window:</span>
                <select
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value as any)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold outline-none cursor-pointer ${
                    themeMode === "dark"
                      ? "bg-slate-800 border border-slate-700 text-slate-200"
                      : "bg-white border border-slate-300 text-slate-800"
                  }`}
                >
                  <option value="24H">Last 24 Hours</option>
                  <option value="7D">Last 7 Days</option>
                  <option value="30D">Last 30 Days</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewSubMode("GRID")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  viewSubMode === "GRID"
                    ? "bg-blue-600 text-white"
                    : themeMode === "dark"
                    ? "bg-slate-900 text-slate-300 border border-slate-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                7x24 Occupancy Matrix
              </button>
              <button
                type="button"
                onClick={() => setViewSubMode("BENCHMARKS")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  viewSubMode === "BENCHMARKS"
                    ? "bg-blue-600 text-white"
                    : themeMode === "dark"
                    ? "bg-slate-900 text-slate-300 border border-slate-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Facility Benchmarks
              </button>
            </div>
          </div>

          {/* Safety Disclaimer Banner */}
          <div className="flex items-center gap-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5 text-xs text-blue-300">
            <Info className="h-4 w-4 shrink-0 text-blue-400" />
            <span>
              <strong>Transparency Guarantee:</strong> AI Demand Heatmaps aggregate statistical booking densities. Predictions represent probabilistic forecasts and do not guarantee slot vacancy.
            </span>
          </div>

          {/* Submode 1: 7x24 Occupancy Matrix Grid */}
          {viewSubMode === "GRID" && matrixData && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between text-xs">
                <div>
                  <h3 className="text-sm font-bold">
                    Hourly Occupancy Matrix: {matrixData.facility_name} ({matrixData.city})
                  </h3>
                  <p className="text-slate-400 text-[11px]">
                    Busiest Day: <strong className="text-red-400">{matrixData.busiest_day}</strong> • Peak Hour:{" "}
                    <strong className="text-red-400">{matrixData.peak_hour}:00 IST ({matrixData.peak_occupancy_pct}%)</strong> • Low:{" "}
                    <strong className="text-emerald-400">{matrixData.lowest_hour}:00 IST ({matrixData.lowest_occupancy_pct}%)</strong>
                  </p>
                </div>

                {/* Color Legend */}
                <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-slate-800 border border-slate-700" /> &lt;30%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-emerald-600" /> 30-50%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-blue-600" /> 50-70%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-amber-500" /> 70-85%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded bg-red-500" /> &gt;85% Peak
                  </span>
                </div>
              </div>

              {/* 7-Day by 24-Hour Matrix */}
              <div className="overflow-x-auto pb-2">
                <div className="min-w-[780px]">
                  {/* Hours Header */}
                  <div className="grid grid-cols-25 gap-1 text-[9px] font-mono text-center text-slate-400 mb-1">
                    <div className="text-left font-bold pl-1">Day</div>
                    {Array.from({ length: 24 }, (_, i) => (
                      <div key={i}>{String(i).padStart(2, "0")}h</div>
                    ))}
                  </div>

                  {/* Day Rows */}
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                    (dayName, dayIdx) => {
                      const dayCells = matrixData.matrix.filter((c) => c.day_of_week === dayIdx);
                      return (
                        <div key={dayName} className="grid grid-cols-25 gap-1 mb-1 items-center">
                          <div className="text-[11px] font-bold truncate pr-1 text-slate-300">
                            {dayName.slice(0, 3)}
                          </div>
                          {dayCells.map((cell) => (
                            <button
                              key={`${dayIdx}-${cell.hour}`}
                              type="button"
                              onClick={() =>
                                setSelectedCell({
                                  day: dayName,
                                  hour: cell.hour,
                                  occ: cell.occupancy_pct,
                                  sample: cell.sample_count,
                                  isPeak: cell.is_peak,
                                })
                              }
                              className={`h-7 rounded-md text-[9px] flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${getCellColor(
                                cell.occupancy_pct
                              )}`}
                              title={`${dayName} ${cell.hour}:00 IST - ${cell.occupancy_pct}% (${cell.sample_count} samples)`}
                            >
                              {Math.round(cell.occupancy_pct)}
                            </button>
                          ))}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Selected Cell Popout */}
              {selectedCell && (
                <div className="rounded-2xl p-4 bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
                      {selectedCell.hour}h
                    </div>
                    <div>
                      <span className="font-bold text-sm block">
                        {selectedCell.day} at {selectedCell.hour}:00 IST
                      </span>
                      <span className="text-slate-400">
                        Observed Occupancy: <strong className="text-blue-400">{selectedCell.occ}%</strong> (Sample Size: {selectedCell.sample} booking events)
                      </span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 font-bold text-[10px] ${
                      selectedCell.isPeak
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {selectedCell.isPeak ? "CRITICAL PEAK HOUR" : "OPTIMAL LOAD"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Submode 2: Facility Benchmarks & Comparison */}
          {viewSubMode === "BENCHMARKS" && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead
                  className={`border-b ${
                    themeMode === "dark" ? "bg-slate-900/90 border-slate-800 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600"
                  }`}
                >
                  <tr>
                    <th className="p-3">Facility</th>
                    <th className="p-3">City / Category</th>
                    <th className="p-3">Avg Occupancy</th>
                    <th className="p-3">Peak Hour &amp; Load</th>
                    <th className="p-3">Turnover (Cars/Bay/Day)</th>
                    <th className="p-3">Est. Rev / Bay</th>
                    <th className="p-3">Weekend Variance</th>
                    <th className="p-3">Demand Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {comparisonData.map((row) => (
                    <tr
                      key={row.facility_id}
                      className={themeMode === "dark" ? "hover:bg-slate-900/60" : "hover:bg-slate-50"}
                    >
                      <td className="p-3 font-sans">
                        <span className="font-bold block text-slate-200">{row.name}</span>
                        <span className="text-[10px] text-slate-400">{row.code}</span>
                      </td>
                      <td className="p-3 font-sans text-slate-300">
                        {row.city} • <span className="text-[10px]">{row.category}</span>
                      </td>
                      <td className="p-3 font-bold text-blue-400">{row.avg_occupancy_pct}%</td>
                      <td className="p-3 text-red-400 font-bold">
                        {row.peak_hour}:00 IST ({row.peak_occupancy_pct}%)
                      </td>
                      <td className="p-3 text-slate-300">{row.turnover_rate_daily}</td>
                      <td className="p-3 text-emerald-400 font-bold">₹{row.revenue_per_bay_inr}</td>
                      <td className="p-3">
                        <span
                          className={`font-bold ${
                            row.weekend_variance_pct >= 0 ? "text-red-400" : "text-emerald-400"
                          }`}
                        >
                          {row.weekend_variance_pct >= 0 ? "+" : ""}
                          {row.weekend_variance_pct}%
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            row.demand_rating === "CRITICAL"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : row.demand_rating === "HIGH_SURGE"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {row.demand_rating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: AI DEMAND FORECASTING (XGBOOST + CONFORMAL BANDS)               */}
      {/* ===================================================================== */}
      {activeTab === "FORECASTING" && (
        <div className="p-6 space-y-6">
          {/* Controls: Target Facility & Horizon */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Target Facility:</span>
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(Number(e.target.value))}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer ${
                  themeMode === "dark"
                    ? "bg-slate-800 border border-slate-700 text-slate-200"
                    : "bg-white border border-slate-300 text-slate-800"
                }`}
              >
                {comparisonData.map((f) => (
                  <option key={f.facility_id} value={f.facility_id}>
                    {f.name} ({f.city})
                  </option>
                ))}
              </select>

              <span className="text-xs font-bold text-slate-400 ml-3">Horizon:</span>
              <select
                value={forecastHorizon}
                onChange={(e) => setForecastHorizon(Number(e.target.value))}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer ${
                  themeMode === "dark"
                    ? "bg-slate-800 border border-slate-700 text-slate-200"
                    : "bg-white border border-slate-300 text-slate-800"
                }`}
              >
                <option value={24}>Next 24 Hours</option>
                <option value={48}>Next 48 Hours</option>
                <option value={168}>Next 7 Days (168h)</option>
              </select>
            </div>

            {forecastData && (
              <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-mono font-bold text-purple-300">
                Model: {forecastData.model_version}
              </span>
            )}
          </div>

          {forecastData && (
            <div className="space-y-6">
              {/* Forecast Evaluation Metrics Scorecard */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-2xl p-3 bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Confidence Score</span>
                  <strong className="text-lg font-black text-purple-400">
                    {forecastData.metrics.confidence_score_pct}%
                  </strong>
                </div>
                <div className="rounded-2xl p-3 bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Mean Absolute Error (MAE)</span>
                  <strong className="text-lg font-black text-emerald-400">
                    {forecastData.metrics.mae}%
                  </strong>
                </div>
                <div className="rounded-2xl p-3 bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Root Mean Sq. Error (RMSE)</span>
                  <strong className="text-lg font-black text-blue-400">
                    {forecastData.metrics.rmse}%
                  </strong>
                </div>
                <div className="rounded-2xl p-3 bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Percentage Error (MAPE)</span>
                  <strong className="text-lg font-black text-amber-400">
                    {forecastData.metrics.mape}%
                  </strong>
                </div>
                <div className="rounded-2xl p-3 bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">R² Goodness of Fit</span>
                  <strong className="text-lg font-black text-slate-200">
                    {forecastData.metrics.r2_score}
                  </strong>
                </div>
              </div>

              {/* Event Impact Banner */}
              <div className="rounded-2xl p-4 bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold block text-sm">External Event Impact Analysis</span>
                  <p className="mt-0.5 text-slate-300">{forecastData.event_impact_summary}</p>
                </div>
              </div>

              {/* 24-Step Hourly Trajectory Table & Visualization */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Hourly Trajectory &amp; 90% Conformal Confidence Bands
                </span>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <tr>
                        <th className="p-2">Target Hour</th>
                        <th className="p-2">Baseline</th>
                        <th className="p-2">Event Surge</th>
                        <th className="p-2">Predicted Occupancy</th>
                        <th className="p-2">90% Confidence Interval</th>
                        <th className="p-2">Load Bar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {forecastData.hourly_points.slice(0, 24).map((pt, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="p-2 font-bold text-slate-300">{pt.target_hour_ist_label}</td>
                          <td className="p-2 text-slate-400">{pt.baseline_occupancy_pct}%</td>
                          <td className="p-2 text-purple-400">
                            {pt.event_surge_pct > 0 ? `+${pt.event_surge_pct}%` : "0%"}
                          </td>
                          <td className="p-2 font-bold text-blue-400">
                            {pt.predicted_occupancy_pct}%
                          </td>
                          <td className="p-2 text-slate-400">
                            [{pt.ci90_lower_pct}% – {pt.ci90_upper_pct}%]
                          </td>
                          <td className="p-2 w-48">
                            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                              <div
                                style={{ width: `${pt.predicted_occupancy_pct}%` }}
                                className={`h-full ${
                                  pt.predicted_occupancy_pct >= 85
                                    ? "bg-red-500"
                                    : pt.predicted_occupancy_pct >= 70
                                    ? "bg-amber-500"
                                    : "bg-blue-500"
                                }`}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: DYNAMIC PRICING INTELLIGENCE (HUMAN-IN-THE-LOOP)               */}
      {/* ===================================================================== */}
      {activeTab === "PRICING" && (
        <div className="p-6 space-y-6">
          {/* Header & Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">AI Dynamic Pricing Proposals</h3>
              <p className="text-xs text-slate-400">
                Deterministic price suggestions based on demand elasticity. Explicit operator approval required.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Filter Status:</span>
              <select
                value={pricingFilter}
                onChange={(e) => setPricingFilter(e.target.value)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer ${
                  themeMode === "dark"
                    ? "bg-slate-800 border border-slate-700 text-slate-200"
                    : "bg-white border border-slate-300 text-slate-800"
                }`}
              >
                <option value="ALL">All Proposals</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* Strict Safety Guardrail Notice */}
          <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-3">
            <Lock className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <strong className="block">Hard Safety Constraint:</strong>
              <p className="text-slate-300">
                AI algorithms are strictly prohibited from independently altering tariffs, charging drivers, or modifying confirmed bookings. All price adjustments require human operator approval.
              </p>
            </div>
          </div>

          {/* Proposals List */}
          {proposals.length === 0 ? (
            <div className="rounded-2xl p-12 text-center text-slate-500 border border-slate-800">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-semibold">No dynamic pricing proposals found for this filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proposals.map((prop) => (
                <div
                  key={prop.id}
                  className={`rounded-2xl p-5 border transition-all ${
                    prop.status === "PENDING_APPROVAL"
                      ? "bg-slate-900 border-blue-500/40 shadow-xl"
                      : "bg-slate-900/60 border-slate-800 opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-blue-400 font-bold block">
                        {prop.proposal_code}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-0.5">
                        {prop.facility_name} ({prop.city})
                      </h4>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        prop.status === "PENDING_APPROVAL"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : prop.status === "APPROVED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {prop.status}
                    </span>
                  </div>

                  {/* Rate Comparison */}
                  <div className="grid grid-cols-2 gap-3 my-3 p-3 rounded-xl bg-slate-950/60 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Current Tariff</span>
                      <strong className="text-slate-200">
                        ₹{prop.current_hourly_rate_inr}/hr ({prop.current_multiplier}x)
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Recommended Tariff</span>
                      <strong className="text-blue-400 font-bold">
                        ₹{prop.recommended_hourly_rate_inr}/hr ({prop.recommended_multiplier}x)
                      </strong>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mb-4">{prop.reasoning}</p>

                  <div className="text-[10px] text-slate-400 space-y-1 mb-4">
                    <div>
                      Predicted Occupancy:{" "}
                      <strong className="text-white">{prop.predicted_occupancy_pct}%</strong> (Confidence: {prop.confidence_score_pct}%)
                    </div>
                    <div>
                      Limits: Floor ₹{prop.min_rate_cap_inr}/hr • Ceiling {prop.max_multiplier_cap}x
                    </div>
                  </div>

                  {prop.status === "PENDING_APPROVAL" ? (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleReviewProposal(prop.id, "APPROVED")}
                        className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 shadow-md transition"
                      >
                        Approve &amp; Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewProposal(prop.id, "REJECTED")}
                        className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                      Reviewed by {prop.reviewed_by} on{" "}
                      {prop.reviewed_at ? new Date(prop.reviewed_at).toLocaleDateString() : "N/A"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: EVENT & LOCATION INTELLIGENCE                                   */}
      {/* ===================================================================== */}
      {activeTab === "EVENTS" && (
        <div className="p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Scheduled Metro Events &amp; Impact Radii</h3>
              <p className="text-xs text-slate-400">
                Track footfall surges, concert crowds, and exhibitions to prepare parking operations in advance.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsEventModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Register New Event</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-2xl p-5 bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold text-purple-300">
                      {ev.event_type}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-1">{ev.name}</h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-slate-500" />
                      <span>
                        {ev.venue_name}, {ev.city}
                      </span>
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      ev.occupancy_pressure_level === "SEVERE"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : ev.occupancy_pressure_level === "ELEVATED"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    }`}
                  >
                    {ev.occupancy_pressure_level}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950/60 text-xs text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Attendance</span>
                    <strong className="text-white">{ev.expected_attendance.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Surge Factor</span>
                    <strong className="text-purple-400">+{Math.round((ev.demand_surge_factor - 1) * 100)}%</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Impact Radius</span>
                    <strong className="text-blue-400">{ev.radius_impact_km} km</strong>
                  </div>
                </div>

                {ev.recommended_action && (
                  <div className="text-xs p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Recommended Operational Playbook
                    </span>
                    <p className="text-slate-300">{ev.recommended_action}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: AI OPERATOR LOCATION ASSISTANT                                  */}
      {/* ===================================================================== */}
      {activeTab === "ASSISTANT" && (
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Bot className="h-4 w-4 text-purple-400" />
              Grounded AI Operator Assistant
            </h3>
            <p className="text-xs text-slate-400">
              Answers questions strictly based on actual database observations and ML demand models. Pure read-only with safety guardrails.
            </p>
          </div>

          {/* Quick Prompt Chips */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-slate-400 font-semibold self-center">Try asking:</span>
            {[
              "Which facility is busiest today?",
              "Which zone is underutilized?",
              "What demand is expected tomorrow?",
              "Which hours generate the most revenue?",
              "What events are impacting demand this week?",
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleAskAssistant(chip)}
                className="rounded-xl px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:border-purple-500/50 hover:text-white transition"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Inquiry Input Form */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask anything about facility demand, revenue, or occupancy..."
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAskAssistant();
              }}
              className="flex-1 rounded-2xl p-3 text-xs bg-slate-900 border border-slate-800 text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition"
            />
            <button
              type="button"
              disabled={isAsking || !assistantInput.trim()}
              onClick={() => handleAskAssistant()}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition shadow-md shadow-blue-500/20"
            >
              {isAsking ? "Thinking..." : "Ask Assistant"}
            </button>
          </div>

          {/* Answer Display */}
          {assistantResponse && (
            <div className="rounded-2xl p-5 bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-purple-400">
                  Query: &ldquo;{assistantResponse.question}&rdquo;
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[9px] font-mono font-bold text-emerald-300">
                  {assistantResponse.provenance}
                </span>
              </div>

              <div className="text-xs leading-relaxed text-slate-200">
                {assistantResponse.answer}
              </div>

              {/* Supporting Metrics Table */}
              {assistantResponse.supporting_metrics.length > 0 && (
                <div className="rounded-xl p-3 bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Auditable Supporting Metrics
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {assistantResponse.supporting_metrics.map((m, idx) => (
                      <div key={idx} className="rounded-lg p-2 bg-slate-900/60 text-xs">
                        <span className="text-slate-400 block text-[10px]">{m.name}</span>
                        <strong className="text-white text-sm">{m.value}</strong>
                        <span className="text-[9px] text-slate-500 block font-mono">
                          Table: {m.source_table}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal: Register New Event */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateEvent}
            className="w-full max-w-md rounded-2xl p-6 bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-400" />
                Register High-Demand Event
              </h4>
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block font-semibold mb-1">Event Name</label>
              <input
                type="text"
                required
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="e.g. Bandra Music Festival, Delhi Tech Expo"
                className="w-full rounded-xl p-2.5 bg-slate-800 border border-slate-700 text-white outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Venue / Corridor</label>
              <input
                type="text"
                required
                value={newEventVenue}
                onChange={(e) => setNewEventVenue(e.target.value)}
                placeholder="e.g. Saket District Centre, MMRDA Grounds BKC"
                className="w-full rounded-xl p-2.5 bg-slate-800 border border-slate-700 text-white outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Metro City</label>
                <select
                  value={newEventCity}
                  onChange={(e) => setNewEventCity(e.target.value)}
                  className="w-full rounded-xl p-2.5 bg-slate-800 border border-slate-700 text-white outline-none"
                >
                  <option value="New Delhi">New Delhi</option>
                  <option value="Mumbai">Mumbai</option>
                  <option value="Bengaluru">Bengaluru</option>
                  <option value="Gurugram">Gurugram</option>
                  <option value="Hyderabad">Hyderabad</option>
                  <option value="Chennai">Chennai</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Attendance</label>
                <input
                  type="number"
                  min={500}
                  step={500}
                  value={newEventAttendance}
                  onChange={(e) => setNewEventAttendance(Number(e.target.value))}
                  className="w-full rounded-xl p-2.5 bg-slate-800 border border-slate-700 text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Recommended Operational Action</label>
              <textarea
                rows={2}
                value={newEventAction}
                onChange={(e) => setNewEventAction(e.target.value)}
                placeholder="e.g. Deploy +2 marshals to Gate 1, reserve Zone B for pre-bookings..."
                className="w-full rounded-xl p-2.5 bg-slate-800 border border-slate-700 text-white outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="rounded-xl px-4 py-2 font-bold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white shadow-lg hover:bg-blue-500"
              >
                Save &amp; Model Impact
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
