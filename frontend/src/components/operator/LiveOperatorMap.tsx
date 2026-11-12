"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Ban,
  BarChart3,
  BatteryCharging,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Crosshair,
  ExternalLink,
  Eye,
  Filter,
  Layers,
  Lock,
  MapPin,
  Maximize2,
  Minimize2,
  Moon,
  Navigation,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  Unlock,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import {
  acknowledgeOperationalAlert,
  fetchFacilityMonitoringDetail,
  fetchMonitoredFacilities,
  fetchOperationalAlerts,
  overrideSlotStatus,
  updateZoneRestriction,
  FacilityMonitoringDetailResponse,
  OperationalAlertItem,
  OperatorFacilityListItem,
  OperatorSlotItem,
  OperatorZoneDetail,
} from "@/lib/operatorMonitoringApi";

// Metro City quick jump coordinates
const CITY_CENTERS: Record<string, { lat: number; lng: number; zoom: number; label: string }> = {
  ALL: { lat: 20.5937, lng: 78.9629, zoom: 5, label: "All India" },
  Delhi: { lat: 28.5355, lng: 77.2000, zoom: 12, label: "Delhi NCR" },
  Mumbai: { lat: 19.0760, lng: 72.8777, zoom: 12, label: "Mumbai" },
  Bengaluru: { lat: 12.9716, lng: 77.5946, zoom: 12, label: "Bengaluru" },
  Hyderabad: { lat: 17.3850, lng: 78.4867, zoom: 12, label: "Hyderabad" },
  Chennai: { lat: 13.0827, lng: 80.2707, zoom: 12, label: "Chennai" },
  Gurugram: { lat: 28.4595, lng: 77.0266, zoom: 13, label: "Gurugram" },
};

interface LiveOperatorMapProps {
  initialFacilityId?: number;
  fullScreenMode?: boolean;
}

export function LiveOperatorMap({
  initialFacilityId,
  fullScreenMode = false,
}: LiveOperatorMapProps) {
  // --------------------------------------------------------------------------
  // Facilities & Filtering State
  // --------------------------------------------------------------------------
  const [facilities, setFacilities] = useState<OperatorFacilityListItem[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(
    initialFacilityId || null
  );
  const [facilityDetail, setFacilityDetail] =
    useState<FacilityMonitoringDetailResponse | null>(null);
  const [alerts, setAlerts] = useState<OperationalAlertItem[]>([]);

  // Filter Bar state
  const [selectedCity, setSelectedCity] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Loading & UI State
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [activeTab, setActiveTab] = useState<"MAP" | "SPLIT" | "ANALYTICS">("SPLIT");
  const [feedbackToast, setFeedbackToast] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Modals
  const [restrictionModalZone, setRestrictionModalZone] =
    useState<OperatorZoneDetail | null>(null);
  const [restrictionReason, setRestrictionReason] = useState<string>("MAINTENANCE");
  const [restrictionNotes, setRestrictionNotes] = useState<string>("");
  const [overrideModalSlot, setOverrideModalSlot] =
    useState<OperatorSlotItem | null>(null);
  const [overrideTargetStatus, setOverrideTargetStatus] =
    useState<string>("MAINTENANCE");
  const [overrideReason, setOverrideReason] = useState<string>("");

  // --------------------------------------------------------------------------
  // Real-Time WebSocket & Telemetry Lag State
  // --------------------------------------------------------------------------
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [lastTelemetryTimestamp, setLastTelemetryTimestamp] = useState<Date>(
    new Date()
  );
  const [secondsSinceLastTelemetry, setSecondsSinceLastTelemetry] =
    useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --------------------------------------------------------------------------
  // Map Viewport (Web Mercator Projection)
  // --------------------------------------------------------------------------
  const containerRef = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 20.5937,
    lng: 78.9629,
  });
  const [zoom, setZoom] = useState<number>(5);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 1000,
    height: 600,
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Track dimensions
  useEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 1000,
          height: containerRef.current.clientHeight || 600,
        });
      }
    };
    updateDims();
    window.addEventListener("resize", updateDims);
    return () => window.removeEventListener("resize", updateDims);
  }, []);

  // Web Mercator coordinate projection
  const latLngToPixels = useCallback(
    (lat: number, lng: number) => {
      const width = dimensions.width || 1000;
      const height = dimensions.height || 600;
      const scale = Math.pow(2, zoom) * 128;
      const x = width / 2 + ((lng - center.lng) * (Math.PI / 180)) * scale;

      const latRad = (lat * Math.PI) / 180;
      const centerLatRad = (center.lat * Math.PI) / 180;
      const yMerc = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
      const centerYMerc = Math.log(Math.tan(Math.PI / 4 + centerLatRad / 2));
      const y = height / 2 - (yMerc - centerYMerc) * scale;

      return { x, y };
    },
    [center, zoom, dimensions]
  );

  // Mouse / Touch Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const scale = Math.pow(2, zoom) * 128;
    const dLng = -(dx / scale) * (180 / Math.PI);
    const dLat = (dy / scale) * (180 / Math.PI);

    setCenter((prev) => ({
      lat: Math.max(-85, Math.min(85, prev.lat + dLat)),
      lng: ((prev.lng + dLng + 180) % 360) - 180,
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(18, z + 1));
    } else {
      setZoom((z) => Math.max(4, z - 1));
    }
  };

  // --------------------------------------------------------------------------
  // Data Fetching: Facilities List
  // --------------------------------------------------------------------------
  const loadFacilities = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const data = await fetchMonitoredFacilities({
        city: selectedCity,
        category: selectedCategory,
        facility_status: selectedStatus,
      });
      setFacilities(data);
      setLastTelemetryTimestamp(new Date());

      // If no facility is selected or selected facility not in list, select first
      if (data.length > 0 && (!selectedFacilityId || !data.some((f) => f.facility_id === selectedFacilityId))) {
        setSelectedFacilityId(data[0].facility_id);
      }
    } catch (err: unknown) {
      console.error("Failed to load facilities:", err);
      setFeedbackToast({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load facilities.",
      });
    } finally {
      setIsLoadingList(false);
    }
  }, [selectedCity, selectedCategory, selectedStatus, selectedFacilityId]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  // --------------------------------------------------------------------------
  // Data Fetching: Selected Facility Detail
  // --------------------------------------------------------------------------
  const loadFacilityDetail = useCallback(async (facilityId: number) => {
    setIsLoadingDetail(true);
    try {
      const detail = await fetchFacilityMonitoringDetail(facilityId);
      setFacilityDetail(detail);
      setLastTelemetryTimestamp(new Date());

      // Center map smoothly on selected facility
      if (detail.latitude && detail.longitude) {
        setCenter({ lat: detail.latitude, lng: detail.longitude });
        setZoom((z) => Math.max(13, z));
      }
    } catch (err: unknown) {
      console.error("Failed to fetch facility detail:", err);
      setFeedbackToast({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to fetch facility telemetry.",
      });
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFacilityId) {
      loadFacilityDetail(selectedFacilityId);
    }
  }, [selectedFacilityId, loadFacilityDetail]);

  // --------------------------------------------------------------------------
  // Data Fetching: Operational Alerts
  // --------------------------------------------------------------------------
  const loadAlerts = useCallback(async () => {
    try {
      const alertItems = await fetchOperationalAlerts({
        facility_id: selectedFacilityId || undefined,
      });
      setAlerts(alertItems);
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    }
  }, [selectedFacilityId]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // --------------------------------------------------------------------------
  // Real-Time WebSocket Connection & Event Stream
  // --------------------------------------------------------------------------
  useEffect(() => {
    let active = true;

    function connectWs() {
      if (!active) return;
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.hostname || "127.0.0.1";
        const wsUrl = `${protocol}//${host}:8000/api/v1/ws/operator/live`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!active) return;
          setWsConnected(true);
          setLastTelemetryTimestamp(new Date());
          console.log("[Parkwise WS] Connected to operator live telemetry feed.");
        };

        ws.onmessage = (event) => {
          if (!active) return;
          try {
            const parsed = JSON.parse(event.data);
            setLastTelemetryTimestamp(new Date());

            // Handle real-time broadcast events
            if (
              parsed.event === "FACILITY_OCCUPANCY_CHANGED" ||
              parsed.event === "SLOT_STATUS_OVERRIDDEN" ||
              parsed.event === "ZONE_RESTRICTION_CHANGED" ||
              parsed.event === "INVENTORY_CHANGED"
            ) {
              // Trigger silent re-sync
              loadFacilities();
              if (selectedFacilityId) {
                loadFacilityDetail(selectedFacilityId);
              }
            } else if (
              parsed.event === "OPERATIONAL_ALERT_TRIGGERED" ||
              parsed.event === "OPERATIONAL_ALERT_ACKNOWLEDGED"
            ) {
              loadAlerts();
            }
          } catch {
            // Non-JSON heartbeat or ping
            setLastTelemetryTimestamp(new Date());
          }
        };

        ws.onerror = () => {
          if (!active) return;
          setWsConnected(false);
        };

        ws.onclose = () => {
          if (!active) return;
          setWsConnected(false);
          // Exponential backoff retry
          reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
        };
      } catch (e) {
        console.error("WebSocket init failed:", e);
        setWsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWs, 5000);
      }
    }

    connectWs();

    return () => {
      active = false;
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [loadFacilities, loadFacilityDetail, loadAlerts, selectedFacilityId]);

  // Telemetry Lag Clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const last = lastTelemetryTimestamp.getTime();
      const diffSec = Math.max(0, Math.floor((now - last) / 1000));
      setSecondsSinceLastTelemetry(diffSec);
    }, 1000);

    return () => clearInterval(timer);
  }, [lastTelemetryTimestamp]);

  // --------------------------------------------------------------------------
  // Filtered Facilities List
  // --------------------------------------------------------------------------
  const filteredFacilities = useMemo(() => {
    return facilities.filter((fac) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          fac.name.toLowerCase().includes(q) ||
          fac.code.toLowerCase().includes(q) ||
          fac.city.toLowerCase().includes(q) ||
          fac.formatted_address.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [facilities, searchQuery]);

  // Selected Facility Item from List
  const selectedFacilityItem = useMemo(() => {
    return (
      facilities.find((f) => f.facility_id === selectedFacilityId) ||
      facilities[0] ||
      null
    );
  }, [facilities, selectedFacilityId]);

  // Aggregated System KPIs across authorized facilities
  const systemKpis = useMemo(() => {
    const totalSpaces = facilities.reduce(
      (acc, f) => acc + (f.occupancy?.total_spaces || 0),
      0
    );
    const availableSpaces = facilities.reduce(
      (acc, f) => acc + (f.occupancy?.available_spaces || 0),
      0
    );
    const occupiedSpaces = facilities.reduce(
      (acc, f) => acc + (f.occupancy?.occupied_spaces || 0),
      0
    );
    const blockedSpaces = facilities.reduce(
      (acc, f) => acc + (f.occupancy?.blocked_spaces || 0),
      0
    );
    const staleSpaces = facilities.reduce(
      (acc, f) => acc + (f.occupancy?.stale_spaces || 0),
      0
    );
    const activeAlerts = facilities.reduce(
      (acc, f) => acc + (f.active_alerts_count || 0),
      0
    );
    const critAlerts = facilities.reduce(
      (acc, f) => acc + (f.critical_alerts_count || 0),
      0
    );
    const avgOcc =
      totalSpaces > 0
        ? Math.round(((occupiedSpaces) / totalSpaces) * 1000) / 10
        : 0;

    return {
      totalFacilities: facilities.length,
      totalSpaces,
      availableSpaces,
      occupiedSpaces,
      blockedSpaces,
      staleSpaces,
      avgOcc,
      activeAlerts,
      critAlerts,
    };
  }, [facilities]);

  // --------------------------------------------------------------------------
  // Interactive Action Handlers
  // --------------------------------------------------------------------------

  // Acknowledge alert
  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await acknowledgeOperationalAlert(alertId);
      setFeedbackToast({
        type: "success",
        text: `Alert #${alertId} acknowledged and logged in immutable audit trail.`,
      });
      loadAlerts();
      loadFacilities();
    } catch (err: unknown) {
      setFeedbackToast({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to acknowledge alert.",
      });
    }
  };

  // Execute Zone Restriction Toggle
  const handleToggleZoneRestriction = async () => {
    if (!selectedFacilityId || !restrictionModalZone) return;
    try {
      const willRestrict = !restrictionModalZone.is_restricted;
      await updateZoneRestriction(selectedFacilityId, restrictionModalZone.zone_code, {
        is_restricted: willRestrict,
        restriction_reason: willRestrict ? restrictionReason : "NONE",
        notes: restrictionNotes || (willRestrict ? "Operational safety restriction" : "Restored to inventory"),
      });

      setFeedbackToast({
        type: "success",
        text: `Zone ${restrictionModalZone.zone_code} ${
          willRestrict ? "RESTRICTED" : "RESTORED"
        } successfully. Broadcasted to live inventory.`,
      });

      setRestrictionModalZone(null);
      setRestrictionNotes("");
      loadFacilityDetail(selectedFacilityId);
      loadFacilities();
    } catch (err: unknown) {
      setFeedbackToast({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update zone restriction.",
      });
    }
  };

  // Execute Slot Status Override
  const handleOverrideSlot = async () => {
    if (!selectedFacilityId || !overrideModalSlot) return;
    try {
      await overrideSlotStatus(selectedFacilityId, overrideModalSlot.id, {
        status: overrideTargetStatus,
        reason: overrideReason || "Manual operator map override",
      });

      setFeedbackToast({
        type: "success",
        text: `Slot ${overrideModalSlot.slot_number} status updated to ${overrideTargetStatus}.`,
      });

      setOverrideModalSlot(null);
      setOverrideReason("");
      loadFacilityDetail(selectedFacilityId);
      loadFacilities();
    } catch (err: unknown) {
      setFeedbackToast({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to override bay status.",
      });
    }
  };

  // Jump to specific Metro City
  const handleCityJump = (cityKey: string) => {
    setSelectedCity(cityKey === "ALL" ? "ALL" : cityKey);
    const target = CITY_CENTERS[cityKey] || CITY_CENTERS.ALL;
    setCenter({ lat: target.lat, lng: target.lng });
    setZoom(target.zoom);
  };

  // --------------------------------------------------------------------------
  // Occupancy Color Helper
  // --------------------------------------------------------------------------
  const getOccupancyColor = (occPct: number) => {
    if (occPct >= 90) return { bg: "bg-red-500", text: "text-red-400", hex: "#ef4444", label: "CRITICAL" };
    if (occPct >= 70) return { bg: "bg-amber-500", text: "text-amber-400", hex: "#f59e0b", label: "HIGH" };
    return { bg: "bg-emerald-500", text: "text-emerald-400", hex: "#10b981", label: "OPTIMAL" };
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div
      className={`relative flex flex-col font-sans transition-colors duration-200 ${
        fullScreenMode ? "h-screen w-screen overflow-hidden" : "h-[860px] w-full rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
      } ${themeMode === "dark" ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}`}
    >
      {/* Toast Feedback */}
      {feedbackToast && (
        <div
          className={`absolute top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-2xl transition-all duration-300 ${
            feedbackToast.type === "success"
              ? "bg-emerald-600 text-white"
              : feedbackToast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-blue-600 text-white"
          }`}
        >
          {feedbackToast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>{feedbackToast.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            className="ml-2 hover:opacity-75"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TOP NOC CONTROL HEADER & STATUS BAR                                    */}
      {/* ===================================================================== */}
      <header
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 ${
          themeMode === "dark"
            ? "border-slate-800 bg-slate-900/90 backdrop-blur"
            : "border-slate-200 bg-slate-50/90 backdrop-blur"
        }`}
      >
        {/* Brand & Live Pulse */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-500/30">
            <Radio className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-tight">
                Live Operator Map & NOC Telemetry
              </h1>
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                Phase 12
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Multi-facility monitoring • Real-time occupancy • Zone restriction control
            </p>
          </div>
        </div>

        {/* Global System Telemetry Badges */}
        <div className="hidden xl:flex items-center gap-2 text-xs">
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono ${
              themeMode === "dark" ? "bg-slate-800" : "bg-white border border-slate-200"
            }`}
          >
            <Building2 className="h-3.5 w-3.5 text-blue-400" />
            <span>Facilities:</span>
            <strong className="text-blue-400">{systemKpis.totalFacilities}</strong>
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono ${
              themeMode === "dark" ? "bg-slate-800" : "bg-white border border-slate-200"
            }`}
          >
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span>Available:</span>
            <strong className="text-emerald-400">{systemKpis.availableSpaces}</strong>
            <span className="text-[10px] text-slate-400">/ {systemKpis.totalSpaces}</span>
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono ${
              themeMode === "dark" ? "bg-slate-800" : "bg-white border border-slate-200"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-purple-400" />
            <span>Avg Load:</span>
            <strong className="text-purple-400">{systemKpis.avgOcc}%</strong>
          </div>

          {systemKpis.activeAlerts > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-2.5 py-1 font-mono text-red-400">
              <ShieldAlert className="h-3.5 w-3.5 animate-bounce" />
              <span>Alerts:</span>
              <strong className="font-bold">{systemKpis.activeAlerts}</strong>
            </div>
          )}
        </div>

        {/* WebSocket Connection Status & Telemetry Lag */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-1 text-xs font-semibold ${
              wsConnected
                ? secondsSinceLastTelemetry > 30
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : "bg-red-500/20 text-red-400 border border-red-500/30"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                wsConnected
                  ? secondsSinceLastTelemetry > 30
                    ? "bg-amber-400 animate-pulse"
                    : "bg-emerald-400 animate-ping"
                  : "bg-red-400"
              }`}
            />
            <span>
              {wsConnected
                ? secondsSinceLastTelemetry > 30
                  ? `Telemetry Stale (${secondsSinceLastTelemetry}s lag)`
                  : "Live WS Sync"
                : "Reconnecting WS..."}
            </span>
          </div>

          {/* Tab View Selector */}
          <div
            className={`flex rounded-lg p-0.5 ${
              themeMode === "dark" ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveTab("MAP")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                activeTab === "MAP"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Full Map
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("SPLIT")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                activeTab === "SPLIT"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Split View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ANALYTICS")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                activeTab === "ANALYTICS"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Facility Sheet
            </button>
          </div>

          {/* Theme & Refresh */}
          <button
            type="button"
            onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
            className={`rounded-lg p-1.5 transition ${
              themeMode === "dark"
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
            title="Toggle NOC Theme"
          >
            {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => {
              loadFacilities();
              if (selectedFacilityId) loadFacilityDetail(selectedFacilityId);
              loadAlerts();
            }}
            className={`rounded-lg p-1.5 transition ${
              themeMode === "dark"
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
            title="Force Telemetry Sync"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingList ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* FILTER BAR & CITY QUICK JUMPS                                          */}
      {/* ===================================================================== */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-2.5 text-xs ${
          themeMode === "dark"
            ? "border-slate-800/80 bg-slate-900/60"
            : "border-slate-200 bg-slate-100/70"
        }`}
      >
        {/* Search input */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search facility name, code, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full rounded-xl pl-9 pr-3 py-1.5 text-xs outline-none transition ${
              themeMode === "dark"
                ? "bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500"
                : "bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500"
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* City Filter */}
          <select
            value={selectedCity}
            onChange={(e) => handleCityJump(e.target.value)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none cursor-pointer ${
              themeMode === "dark"
                ? "bg-slate-800 border border-slate-700 text-slate-200"
                : "bg-white border border-slate-300 text-slate-800"
            }`}
          >
            <option value="ALL">All Metro Cities</option>
            <option value="Delhi">Delhi NCR</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Hyderabad">Hyderabad</option>
            <option value="Chennai">Chennai</option>
            <option value="Gurugram">Gurugram</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none cursor-pointer ${
              themeMode === "dark"
                ? "bg-slate-800 border border-slate-700 text-slate-200"
                : "bg-white border border-slate-300 text-slate-800"
            }`}
          >
            <option value="ALL">All Categories</option>
            <option value="MALL">Mall & Retail</option>
            <option value="TRANSIT_HUB">Transit Hub & Metro</option>
            <option value="TECH_PARK">Tech Park</option>
            <option value="HOSPITAL">Hospital & Medical</option>
            <option value="AIRPORT">Airport Terminal</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none cursor-pointer ${
              themeMode === "dark"
                ? "bg-slate-800 border border-slate-700 text-slate-200"
                : "bg-white border border-slate-300 text-slate-800"
            }`}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="FULL">Near Full</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>

        {/* Quick City Jump Buttons */}
        <div className="hidden lg:flex items-center gap-1.5">
          {Object.entries(CITY_CENTERS).map(([key, info]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleCityJump(key)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                selectedCity === (key === "ALL" ? "ALL" : key)
                  ? "bg-blue-600 text-white"
                  : themeMode === "dark"
                  ? "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {info.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MAIN CONTENT AREA: MAP + SPLIT TELEMETRY DRAWER                       */}
      {/* ===================================================================== */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* ------------------------------------------------------------------- */}
        {/* INTERACTIVE VECTOR MERCATOR MAP                                     */}
        {/* ------------------------------------------------------------------- */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className={`relative h-full flex-1 select-none overflow-hidden cursor-${
            isDragging ? "grabbing" : "grab"
          } ${activeTab === "ANALYTICS" ? "hidden" : "block"} ${
            themeMode === "dark" ? "bg-slate-950" : "bg-slate-100"
          }`}
          style={{
            backgroundImage:
              themeMode === "dark"
                ? "radial-gradient(circle at 1px 1px, #1e293b 1px, transparent 0)"
                : "radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        >
          {/* Tactical Grid Background */}
          <div
            className={`absolute inset-0 pointer-events-none ${
              themeMode === "dark" ? "opacity-20" : "opacity-15"
            }`}
          >
            <svg className="w-full h-full">
              <defs>
                <pattern id="opgrid" width="80" height="80" patternUnits="userSpaceOnUse">
                  <path
                    d="M 80 0 L 0 0 0 80"
                    fill="none"
                    stroke={themeMode === "dark" ? "#38bdf8" : "#0284c7"}
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#opgrid)" />
            </svg>
          </div>

          {/* Stale Telemetry Floating Banner */}
          {secondsSinceLastTelemetry > 30 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl bg-amber-500/90 text-slate-950 px-4 py-2 text-xs font-bold shadow-xl backdrop-blur">
              <AlertTriangle className="h-4 w-4 animate-bounce" />
              <span>
                Telemetry latency &gt;30s ({secondsSinceLastTelemetry}s lag). Live confirmations paused.
              </span>
              <button
                type="button"
                onClick={() => {
                  loadFacilities();
                  if (selectedFacilityId) loadFacilityDetail(selectedFacilityId);
                }}
                className="ml-2 rounded-md bg-slate-950 text-white px-2 py-0.5 text-[11px] hover:bg-slate-800"
              >
                Sync Now
              </button>
            </div>
          )}

          {/* Map Controls Floating Overlay */}
          <div className="absolute right-4 top-4 z-20 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(18, z + 1))}
              className={`flex h-8 w-8 items-center justify-center rounded-xl shadow-lg transition ${
                themeMode === "dark"
                  ? "bg-slate-900/90 text-slate-200 border border-slate-700 hover:bg-slate-800"
                  : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-100"
              }`}
              title="Zoom In"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(4, z - 1))}
              className={`flex h-8 w-8 items-center justify-center rounded-xl shadow-lg transition ${
                themeMode === "dark"
                  ? "bg-slate-900/90 text-slate-200 border border-slate-700 hover:bg-slate-800"
                  : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-100"
              }`}
              title="Zoom Out"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedFacilityItem) {
                  setCenter({
                    lat: selectedFacilityItem.latitude,
                    lng: selectedFacilityItem.longitude,
                  });
                  setZoom(14);
                }
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-xl shadow-lg transition ${
                themeMode === "dark"
                  ? "bg-slate-900/90 text-slate-200 border border-slate-700 hover:bg-slate-800"
                  : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-100"
              }`}
              title="Center on Selected Facility"
            >
              <Crosshair className="h-4 w-4" />
            </button>
          </div>

          {/* Facility Location Pins */}
          {filteredFacilities.map((fac) => {
            const pos = latLngToPixels(fac.latitude, fac.longitude);
            const isSelected = fac.facility_id === selectedFacilityId;
            const occPct = fac.occupancy?.occupancy_percentage || 0;
            const occColor = getOccupancyColor(occPct);
            const hasCritAlert = fac.critical_alerts_count > 0;

            return (
              <div
                key={fac.facility_id}
                onClick={() => setSelectedFacilityId(fac.facility_id)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 z-10 hover:z-30 ${
                  isSelected ? "scale-110 z-30" : "hover:scale-105"
                }`}
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
              >
                {/* Critical Alert Pulsing Ring */}
                {hasCritAlert && (
                  <span className="absolute -inset-2 animate-ping rounded-full bg-red-500 opacity-60 pointer-events-none" />
                )}

                {/* Selected Pin Halo */}
                {isSelected && (
                  <div className="absolute -inset-3 rounded-full border-2 border-blue-400 bg-blue-500/20 animate-pulse pointer-events-none" />
                )}

                {/* Main Interactive Pin Badge */}
                <div
                  className={`relative flex items-center gap-2 rounded-2xl px-3 py-1.5 shadow-2xl backdrop-blur transition-all ${
                    isSelected
                      ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-950 bg-slate-900 text-white"
                      : themeMode === "dark"
                      ? "bg-slate-900/95 text-slate-100 border border-slate-700"
                      : "bg-white text-slate-900 border border-slate-300"
                  }`}
                >
                  {/* Occupancy Indicator Dot */}
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${occColor.bg} ${
                      occPct >= 90 ? "animate-pulse" : ""
                    }`}
                  />

                  {/* Facility Label & Occupancy */}
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold leading-tight max-w-[130px] truncate">
                      {fac.name}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="font-mono font-semibold text-slate-300">
                        {fac.occupancy?.available_spaces || 0} free
                      </span>
                      <span>•</span>
                      <span className={`font-bold ${occColor.text}`}>{occPct}%</span>
                    </div>
                  </div>

                  {/* Critical Alert Icon */}
                  {hasCritAlert && (
                    <ShieldAlert className="h-4 w-4 text-red-500 animate-bounce" />
                  )}
                </div>
              </div>
            );
          })}

          {/* Render Gates of Selected Facility on Map */}
          {facilityDetail?.gates &&
            facilityDetail.gates.map((gate) => {
              const pos = latLngToPixels(gate.latitude, gate.longitude);
              const isEntrance = gate.gate_type === "ENTRANCE";

              return (
                <div
                  key={`gate-${gate.id}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-20"
                  style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                  title={`${gate.gate_name} (${gate.gate_code}) - ${gate.barrier_type}`}
                >
                  <div
                    className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[9px] font-mono font-bold shadow-md ${
                      isEntrance
                        ? "bg-emerald-600 text-white border border-emerald-400"
                        : "bg-amber-600 text-white border border-amber-400"
                    }`}
                  >
                    <span>{isEntrance ? "IN:" : "OUT:"}</span>
                    <span>{gate.gate_code}</span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* GRANULAR FACILITY MONITORING & TELEMETRY SHEET                      */}
        {/* ------------------------------------------------------------------- */}
        <div
          className={`flex flex-col border-l transition-all duration-300 overflow-y-auto ${
            activeTab === "MAP"
              ? "hidden"
              : activeTab === "SPLIT"
              ? "w-full md:w-[460px] lg:w-[500px]"
              : "w-full"
          } ${
            themeMode === "dark"
              ? "border-slate-800 bg-slate-900/95"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          {selectedFacilityItem ? (
            <div className="flex flex-col p-5 space-y-6">
              {/* Facility Header */}
              <div className="flex items-start justify-between border-b pb-4 border-slate-700/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-blue-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-400">
                      {selectedFacilityItem.code}
                    </span>
                    <span className="rounded-md bg-slate-700/50 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                      {selectedFacilityItem.category}
                    </span>
                    {selectedFacilityItem.is_24_hours && (
                      <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        24/7
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 text-lg font-black tracking-tight">
                    {selectedFacilityItem.name}
                  </h2>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                    <span>{selectedFacilityItem.formatted_address}</span>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Base Hourly</span>
                  <span className="text-base font-extrabold text-blue-400">
                    ₹{selectedFacilityItem.base_hourly_rate_inr}/hr
                  </span>
                </div>
              </div>

              {/* Occupancy Summary Gauges (Phase 12 Spec Item 2) */}
              <div
                className={`rounded-2xl p-4 border ${
                  themeMode === "dark"
                    ? "bg-slate-950/60 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Live Occupancy Telemetry
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        selectedFacilityItem.occupancy.peak_indicator === "CRITICAL_PEAK"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : selectedFacilityItem.occupancy.peak_indicator === "HIGH"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {selectedFacilityItem.occupancy.peak_indicator}
                    </span>
                    <span className="text-sm font-extrabold">
                      {selectedFacilityItem.occupancy.occupancy_percentage}%
                    </span>
                  </div>
                </div>

                {/* Granular Segmented Progress Bar */}
                <div className="h-3.5 w-full rounded-full bg-slate-800 overflow-hidden flex">
                  <div
                    style={{
                      width: `${
                        (selectedFacilityItem.occupancy.occupied_spaces /
                          Math.max(1, selectedFacilityItem.occupancy.total_spaces)) *
                        100
                      }%`,
                    }}
                    className="bg-blue-500 h-full transition-all duration-300"
                    title={`Occupied: ${selectedFacilityItem.occupancy.occupied_spaces}`}
                  />
                  <div
                    style={{
                      width: `${
                        (selectedFacilityItem.occupancy.reserved_spaces /
                          Math.max(1, selectedFacilityItem.occupancy.total_spaces)) *
                        100
                      }%`,
                    }}
                    className="bg-purple-500 h-full transition-all duration-300"
                    title={`Reserved: ${selectedFacilityItem.occupancy.reserved_spaces}`}
                  />
                  <div
                    style={{
                      width: `${
                        (selectedFacilityItem.occupancy.blocked_spaces /
                          Math.max(1, selectedFacilityItem.occupancy.total_spaces)) *
                        100
                      }%`,
                    }}
                    className="bg-red-500 h-full transition-all duration-300"
                    title={`Blocked/Maint: ${selectedFacilityItem.occupancy.blocked_spaces}`}
                  />
                  <div
                    style={{
                      width: `${
                        (selectedFacilityItem.occupancy.available_spaces /
                          Math.max(1, selectedFacilityItem.occupancy.total_spaces)) *
                        100
                      }%`,
                    }}
                    className="bg-emerald-500/40 h-full transition-all duration-300"
                    title={`Available: ${selectedFacilityItem.occupancy.available_spaces}`}
                  />
                </div>

                {/* Granular Counts Matrix */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 text-center">
                  <div className="rounded-xl p-2 bg-slate-800/40">
                    <span className="text-[10px] text-slate-400 block">Total</span>
                    <strong className="text-sm font-black">
                      {selectedFacilityItem.occupancy.total_spaces}
                    </strong>
                  </div>
                  <div className="rounded-xl p-2 bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 block">Available</span>
                    <strong className="text-sm font-black text-emerald-400">
                      {selectedFacilityItem.occupancy.available_spaces}
                    </strong>
                  </div>
                  <div className="rounded-xl p-2 bg-blue-500/10 border border-blue-500/20">
                    <span className="text-[10px] text-blue-400 block">Occupied</span>
                    <strong className="text-sm font-black text-blue-400">
                      {selectedFacilityItem.occupancy.occupied_spaces}
                    </strong>
                  </div>
                  <div className="rounded-xl p-2 bg-purple-500/10 border border-purple-500/20">
                    <span className="text-[10px] text-purple-400 block">Reserved</span>
                    <strong className="text-sm font-black text-purple-400">
                      {selectedFacilityItem.occupancy.reserved_spaces}
                    </strong>
                  </div>
                  <div className="rounded-xl p-2 bg-red-500/10 border border-red-500/20">
                    <span className="text-[10px] text-red-400 block">Blocked</span>
                    <strong className="text-sm font-black text-red-400">
                      {selectedFacilityItem.occupancy.blocked_spaces}
                    </strong>
                  </div>
                  <div className="rounded-xl p-2 bg-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Stale</span>
                    <strong className="text-sm font-black text-slate-300">
                      {selectedFacilityItem.occupancy.stale_spaces}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Operator Analytics Module (Phase 12 Spec Item 5) */}
              {facilityDetail && (
                <div
                  className={`rounded-2xl p-4 border ${
                    themeMode === "dark"
                      ? "bg-slate-950/60 border-slate-800"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    Operational Performance & Surge Velocity
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl p-2.5 bg-slate-800/30">
                      <span className="text-[10px] text-slate-400 block">Today's Bookings</span>
                      <strong className="text-base font-extrabold text-blue-400">
                        {facilityDetail.booking_volume_today}
                      </strong>
                    </div>

                    <div className="rounded-xl p-2.5 bg-slate-800/30">
                      <span className="text-[10px] text-slate-400 block">Estimated Revenue</span>
                      <strong className="text-base font-extrabold text-emerald-400">
                        ₹{facilityDetail.estimated_revenue_today_inr.toLocaleString("en-IN")}
                      </strong>
                    </div>

                    <div className="rounded-xl p-2.5 bg-slate-800/30">
                      <span className="text-[10px] text-slate-400 block">Dynamic Surge</span>
                      <strong className="text-base font-extrabold text-amber-400">
                        {facilityDetail.current_surge_multiplier}x
                      </strong>
                    </div>

                    <div className="rounded-xl p-2.5 bg-slate-800/30">
                      <span className="text-[10px] text-slate-400 block">Occupancy Velocity</span>
                      <div className="flex items-center gap-1">
                        {facilityDetail.occupancy_velocity_30m >= 0 ? (
                          <ArrowUp className="h-3.5 w-3.5 text-red-400" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                        <strong
                          className={`text-sm font-extrabold ${
                            facilityDetail.occupancy_velocity_30m >= 0
                              ? "text-red-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {facilityDetail.occupancy_velocity_30m > 0 ? "+" : ""}
                          {facilityDetail.occupancy_velocity_30m}% / 30m
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Entry & Exit Gates Telemetry (Phase 12 Spec Item 3) */}
              {facilityDetail?.gates && facilityDetail.gates.length > 0 && (
                <div
                  className={`rounded-2xl p-4 border ${
                    themeMode === "dark"
                      ? "bg-slate-950/60 border-slate-800"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    Barrier Gates & Height Clearance
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {facilityDetail.gates.map((g) => (
                      <div
                        key={g.id}
                        className={`rounded-xl p-3 border flex items-center justify-between ${
                          themeMode === "dark"
                            ? "bg-slate-900 border-slate-800"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white ${
                              g.gate_type === "ENTRANCE" ? "bg-emerald-600" : "bg-amber-600"
                            }`}
                          >
                            {g.gate_type === "ENTRANCE" ? "IN" : "OUT"}
                          </div>
                          <div>
                            <span className="text-xs font-bold block">{g.gate_name}</span>
                            <span className="text-[10px] text-slate-400">
                              {g.barrier_type} • Clearance: {g.height_clearance_meters || "3.0"}m
                            </span>
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                          {g.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parking Zones & Bay Inspection (Phase 12 Spec Item 3 & 6) */}
              {facilityDetail?.zones && (
                <div
                  className={`rounded-2xl p-4 border ${
                    themeMode === "dark"
                      ? "bg-slate-950/60 border-slate-800"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Zones & Bay Override Matrix
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Click a slot to manually override state
                    </span>
                  </div>

                  <div className="space-y-4">
                    {facilityDetail.zones.map((zone) => (
                      <div
                        key={zone.zone_id}
                        className={`rounded-xl p-3.5 border ${
                          zone.is_restricted
                            ? "border-amber-500/50 bg-amber-500/5"
                            : themeMode === "dark"
                            ? "border-slate-800 bg-slate-900/60"
                            : "border-slate-200 bg-slate-50/70"
                        }`}
                      >
                        {/* Zone Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black">
                              {zone.floor_name} • Zone {zone.zone_code}
                            </span>
                            <span className="text-[10px] text-slate-400">({zone.zone_name})</span>
                            {zone.is_restricted ? (
                              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 flex items-center gap-1">
                                <Lock className="h-3 w-3" /> RESTRICTED ({zone.restriction_reason})
                              </span>
                            ) : (
                              <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                {zone.operational_status}
                              </span>
                            )}
                          </div>

                          {/* Zone Restriction Toggle Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setRestrictionModalZone(zone);
                              setRestrictionReason(
                                zone.is_restricted ? "NONE" : "VIP_RESERVE"
                              );
                            }}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1 ${
                              zone.is_restricted
                                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                : "bg-amber-600/90 text-white hover:bg-amber-600"
                            }`}
                          >
                            {zone.is_restricted ? (
                              <>
                                <Unlock className="h-3 w-3" /> Lift Restriction
                              </>
                            ) : (
                              <>
                                <Lock className="h-3 w-3" /> Restrict Zone
                              </>
                            )}
                          </button>
                        </div>

                        {/* Zone Capacity Stats */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                          <span>
                            Available:{" "}
                            <strong className="text-emerald-400">{zone.available_bays}</strong> /{" "}
                            {zone.total_bays} bays
                          </span>
                          <span>
                            Utilization: <strong>{zone.utilization_pct}%</strong>
                          </span>
                        </div>

                        {/* Interactive Bay Grid (Slots) */}
                        <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 pt-1">
                          {zone.slots.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setOverrideModalSlot(s);
                                setOverrideTargetStatus(
                                  s.status === "MAINTENANCE" ? "AVAILABLE" : "MAINTENANCE"
                                );
                              }}
                              className={`h-7 rounded-md font-mono text-[9px] font-bold flex items-center justify-center transition-all ${
                                s.status === "AVAILABLE"
                                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 border border-emerald-500/40"
                                  : s.status === "OCCUPIED"
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : s.status === "RESERVED"
                                  ? "bg-purple-600 text-white hover:bg-purple-700"
                                  : "bg-red-500/20 text-red-400 hover:bg-red-500/40 border border-red-500/40"
                              }`}
                              title={`Slot ${s.slot_number} (${s.status}) - Click to override`}
                            >
                              {s.slot_number}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Operational Alerts Stream (Phase 12 Spec Item 5) */}
              <div
                className={`rounded-2xl p-4 border ${
                  themeMode === "dark"
                    ? "bg-slate-950/60 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Active Operational Alerts ({alerts.filter((a) => !a.is_acknowledged).length})
                  </span>
                  <button
                    type="button"
                    onClick={loadAlerts}
                    className="text-[11px] text-blue-400 hover:underline"
                  >
                    Refresh Feed
                  </button>
                </div>

                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    All operations normal. No active alerts.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {alerts.map((a) => (
                      <div
                        key={a.id}
                        className={`rounded-xl p-3 border flex items-start justify-between gap-3 ${
                          a.is_acknowledged
                            ? "opacity-60 bg-slate-800/20 border-slate-800"
                            : a.severity === "CRITICAL"
                            ? "bg-red-500/10 border-red-500/30"
                            : a.severity === "WARNING"
                            ? "bg-amber-500/10 border-amber-500/30"
                            : "bg-blue-500/10 border-blue-500/30"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                                a.severity === "CRITICAL"
                                  ? "bg-red-500 text-white"
                                  : a.severity === "WARNING"
                                  ? "bg-amber-500 text-slate-950"
                                  : "bg-blue-500 text-white"
                              }`}
                            >
                              {a.severity}
                            </span>
                            <span className="text-xs font-bold">{a.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-400">{a.message}</p>
                          <span className="text-[9px] font-mono text-slate-500 block">
                            Logged: {new Date(a.created_at).toLocaleTimeString("en-IN")} IST
                          </span>
                        </div>

                        {!a.is_acknowledged ? (
                          <button
                            type="button"
                            onClick={() => handleAcknowledgeAlert(a.id)}
                            className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-500 shrink-0"
                          >
                            Acknowledge
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-400 shrink-0 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Ack
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full text-slate-500">
              <Building2 className="h-10 w-10 text-slate-600 mb-2 animate-bounce" />
              <p className="text-sm font-semibold">Select a facility on the map</p>
              <p className="text-xs mt-1">
                Real-time occupancy gauges, zones, barrier telemetry, and slot overrides will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: ZONE OPERATIONAL RESTRICTION                                   */}
      {/* ===================================================================== */}
      {restrictionModalZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
              themeMode === "dark"
                ? "bg-slate-900 border-slate-700 text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-400" />
                {restrictionModalZone.is_restricted ? "Lift Zone Restriction" : "Restrict Parking Zone"}
              </h3>
              <button
                type="button"
                onClick={() => setRestrictionModalZone(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="text-slate-400">
                You are updating operational permissions for{" "}
                <strong className="text-blue-400">
                  {restrictionModalZone.floor_name} • Zone {restrictionModalZone.zone_code}
                </strong>{" "}
                ({restrictionModalZone.total_bays} total bays).
              </p>

              {!restrictionModalZone.is_restricted && (
                <div>
                  <label className="block font-semibold mb-1">Restriction Reason</label>
                  <select
                    value={restrictionReason}
                    onChange={(e) => setRestrictionReason(e.target.value)}
                    className={`w-full rounded-xl p-2 font-semibold outline-none ${
                      themeMode === "dark"
                        ? "bg-slate-800 border border-slate-700 text-slate-100"
                        : "bg-slate-100 border border-slate-300 text-slate-900"
                    }`}
                  >
                    <option value="VIP_RESERVE">VIP / Diplomatic Delegation Reserve</option>
                    <option value="MAINTENANCE">Pavement / Lighting Maintenance</option>
                    <option value="STAFF_ONLY">Official Staff & Fleet Only</option>
                    <option value="CLEANING">Deep Pressure Cleaning</option>
                    <option value="FIRE_LANE">Emergency Fire Evacuation Lane</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Operational Notes (for Audit Trail)</label>
                <textarea
                  rows={2}
                  value={restrictionNotes}
                  onChange={(e) => setRestrictionNotes(e.target.value)}
                  placeholder="Provide authorization reference or justification..."
                  className={`w-full rounded-xl p-2.5 outline-none ${
                    themeMode === "dark"
                      ? "bg-slate-800 border border-slate-700 text-slate-100"
                      : "bg-slate-100 border border-slate-300 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestrictionModalZone(null)}
                  className="rounded-xl px-4 py-2 font-bold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleToggleZoneRestriction}
                  className={`rounded-xl px-4 py-2 font-bold text-white shadow-lg ${
                    restrictionModalZone.is_restricted
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-amber-600 hover:bg-amber-500"
                  }`}
                >
                  {restrictionModalZone.is_restricted ? "Restore to Public Inventory" : "Confirm Restriction"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: BAY STATUS OVERRIDE                                            */}
      {/* ===================================================================== */}
      {overrideModalSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl border ${
              themeMode === "dark"
                ? "bg-slate-900 border-slate-700 text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-blue-400" />
                Override Bay {overrideModalSlot.slot_number}
              </h3>
              <button
                type="button"
                onClick={() => setOverrideModalSlot(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl p-3 bg-slate-800/40 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Status:</span>
                  <span className="font-bold text-blue-400">{overrideModalSlot.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sensor Health:</span>
                  <span className="font-bold text-emerald-400">{overrideModalSlot.sensor_health}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Floor / Zone:</span>
                  <span>
                    Floor {overrideModalSlot.floor} • Zone {overrideModalSlot.zone}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Target Status</label>
                <select
                  value={overrideTargetStatus}
                  onChange={(e) => setOverrideTargetStatus(e.target.value)}
                  className={`w-full rounded-xl p-2 font-semibold outline-none ${
                    themeMode === "dark"
                      ? "bg-slate-800 border border-slate-700 text-slate-100"
                      : "bg-slate-100 border border-slate-300 text-slate-900"
                  }`}
                >
                  <option value="AVAILABLE">AVAILABLE (Clear & open for drivers)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Block bay for repair/cleaning)</option>
                  <option value="OCCUPIED">OCCUPIED (Physical vehicle present)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Override Reason</label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Hydraulic leak cleanup, barrier sensor reset"
                  className={`w-full rounded-xl p-2 outline-none ${
                    themeMode === "dark"
                      ? "bg-slate-800 border border-slate-700 text-slate-100"
                      : "bg-slate-100 border border-slate-300 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalSlot(null)}
                  className="rounded-xl px-4 py-2 font-bold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOverrideSlot}
                  className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white shadow-lg hover:bg-blue-500"
                >
                  Save Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
