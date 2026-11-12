"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Compass,
  Navigation,
  MapPin,
  QrCode,
  Zap,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Layers,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  TrendingDown,
  Info,
  Car,
  Footprints,
  ChevronRight,
  ShieldCheck,
  Radio,
} from "lucide-react";
import {
  calculateIndoorRoute,
  confirmSlotArrival,
  fetchFacilityIndoorMap,
  recalculateIndoorRoute,
  verifyQrCheckpoint,
  updateIndoorPositionTelemetry,
  FacilityFloorMapResponse,
  IndoorRouteResponse,
  FloorMapLayerItem,
  TurnByTurnStepItem,
} from "@/lib/indoorNavigationApi";

interface IndoorNavigationConsoleProps {
  facilityId?: number;
  initialSlotNumber?: string;
  bookingId?: number;
  onParkedSuccess?: () => void;
}

export default function IndoorNavigationConsole({
  facilityId = 1,
  initialSlotNumber = "C-142",
  bookingId = 1,
  onParkedSuccess,
}: IndoorNavigationConsoleProps) {
  // Map and Route State
  const [mapData, setMapData] = useState<FacilityFloorMapResponse | null>(null);
  const [activeFloorLevel, setActiveFloorLevel] = useState<number>(0);
  const [route, setRoute] = useState<IndoorRouteResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Vehicle Simulation State
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [vehiclePos, setVehiclePos] = useState<{ x: number; y: number; floor: number }>({
    x: 20,
    y: 20,
    floor: 0,
  });
  const [vehicleHeading, setVehicleHeading] = useState<number>(90);
  const [isNavigating, setIsNavigating] = useState<boolean>(true);

  // Telemetry & Arrival State
  const [lastCheckpoint, setLastCheckpoint] = useState<string | null>("PW-QR-G-GATE-01 (Ground Entrance)");
  const [positioningConfidence, setPositioningConfidence] = useState<number>(0.95);
  const [isArrivalModalOpen, setIsArrivalModalOpen] = useState<boolean>(false);
  const [isParkedConfirmed, setIsParkedConfirmed] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Load Map & Initial Route
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const map = await fetchFacilityIndoorMap(facilityId);
        setMapData(map);

        // Calculate route from entrance to allotted slot
        const calculatedRoute = await calculateIndoorRoute({
          facility_id: facilityId,
          booking_id: bookingId,
          destination_slot_number: initialSlotNumber,
          route_type: "VEHICLE",
        });
        setRoute(calculatedRoute);
        setActiveFloorLevel(calculatedRoute.start_floor_level);
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to initialize indoor navigation:", err);
        setError(err.message || "Failed to load indoor garage routing data.");
        setLoading(false);
      }
    }
    init();
  }, [facilityId, initialSlotNumber, bookingId]);

  // Active Floor Layer Data
  const currentFloorLayer: FloorMapLayerItem | undefined = mapData?.floors.find(
    (f) => f.floor_level === activeFloorLevel
  );

  // Turn-by-Turn Maneuver Icon Resolver
  const renderManeuverIcon = (maneuver: string, className: string = "w-6 h-6") => {
    switch (maneuver) {
      case "STRAIGHT":
        return <ArrowUp className={className} />;
      case "TURN_LEFT":
      case "SLIGHT_LEFT":
        return <CornerUpLeft className={className} />;
      case "TURN_RIGHT":
      case "SLIGHT_RIGHT":
        return <CornerUpRight className={className} />;
      case "RAMP_DOWN":
        return <TrendingDown className={`${className} text-cyan-400`} />;
      case "ARRIVE_SLOT":
      case "PARK_VEHICLE":
        return <CheckCircle2 className={`${className} text-emerald-400`} />;
      default:
        return <Compass className={className} />;
    }
  };

  // Checkpoint Scan Simulation
  const handleScanCheckpoint = async (tokenPayload: string, label: string) => {
    try {
      setActionNotice(`Scanning Checkpoint ${label}...`);
      const verifyRes = await verifyQrCheckpoint({
        facility_id: facilityId,
        qr_token_payload: tokenPayload,
        booking_id: bookingId,
      });

      setVehiclePos({
        x: verifyRes.x_coord,
        y: verifyRes.y_coord,
        floor: verifyRes.floor_level,
      });
      setActiveFloorLevel(verifyRes.floor_level);
      setLastCheckpoint(`${tokenPayload} (${verifyRes.label})`);
      setPositioningConfidence(0.98);
      setActionNotice(`Location Synced: Ground truth confirmed on Level ${verifyRes.floor_name}`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(`Checkpoint Error: ${err.message}`);
    }
  };

  // Simulate Obstacle / Blocked Lane Rerouting
  const handleSimulateBlockedLane = async () => {
    if (!route) return;
    try {
      setActionNotice("Obstacle Detected: Lane blocked on Level B1. Recalculating route...");
      const recalcRes = await recalculateIndoorRoute({
        route_code: route.route_code,
        current_floor_level: -1,
        current_x: 140.0,
        current_y: 20.0,
        reason: "Temporary chemical spill / hazard on B1 North Concourse",
      });
      setRoute(recalcRes);
      setActiveFloorLevel(-1);
      setVehiclePos({ x: 140.0, y: 20.0, floor: -1 });
      setActionNotice("Route Recalculated! Diverting vehicle via safe alternate lane.");
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(`Recalculation error: ${err.message}`);
    }
  };

  // Confirm Arrival at Slot C-142
  const handleConfirmArrival = async () => {
    if (!route) return;
    try {
      const arrivalRes = await confirmSlotArrival({
        route_code: route.route_code,
        final_floor_level: -2,
        final_x: 210.0,
        final_y: 140.0,
        checkpoint_qr_token: "PW-QR-B2-ZONEC-01",
      });
      if (arrivalRes.arrival_confirmed) {
        setIsParkedConfirmed(true);
        setIsArrivalModalOpen(false);
        if (onParkedSuccess) onParkedSuccess();
      }
    } catch (err: any) {
      setActionNotice(`Arrival confirmation error: ${err.message}`);
    }
  };

  // Current Step in navigation
  const activeStep: TurnByTurnStepItem | undefined = route?.turn_by_turn_steps[currentStepIndex];

  // Advance to next navigation step
  const handleAdvanceStep = () => {
    if (!route) return;
    if (currentStepIndex < route.turn_by_turn_steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      const nextStep = route.turn_by_turn_steps[nextIdx];
      setVehiclePos({
        x: nextStep.waypoint[0],
        y: nextStep.waypoint[1],
        floor: nextStep.floor_level,
      });
      setActiveFloorLevel(nextStep.floor_level);
    } else {
      setIsArrivalModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-3xl text-white">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-xl font-bold">Initializing Indoor Graph Routing Engine...</h3>
        <p className="text-sm text-slate-400 mt-1">Calibrating multi-floor garage nodes (Ground, B1, B2, B3)</p>
      </div>
    );
  }

  if (error || !mapData) {
    return (
      <div className="p-8 bg-rose-950/30 border border-rose-800/40 rounded-3xl text-rose-200">
        <h3 className="text-lg font-bold">Failed to load indoor garage navigation</h3>
        <p className="text-sm text-rose-300/80 mt-1">{error || "Map data unavailable"}</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-950 text-slate-100 rounded-3xl border border-slate-800/80 overflow-hidden shadow-2xl">
      {/* Top Header & Destination HUD */}
      <div className="p-6 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                PHASE 14 INDOOR ENGINE
              </span>
              <span className="text-xs text-slate-400">Map Version: {mapData.current_map_version}</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-white mt-0.5">
              {mapData.facility_name}
            </h2>
          </div>
        </div>

        {/* Assigned Destination Badge */}
        <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-cyan-500/30">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-300">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              Allotted Slot
            </div>
            <div className="text-sm font-extrabold text-cyan-400 flex items-center gap-1.5">
              <span>{route?.assigned_slot_number || initialSlotNumber}</span>
              <span className="text-xs text-slate-400 font-normal">
                (Level B2 • Zone C)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Console Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Left Side: Interactive 2D/3D Multi-Floor Garage Canvas */}
        <div className="lg:col-span-8 p-6 flex flex-col items-center justify-between border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950/60 relative">
          {/* Level Floor Switcher */}
          <div className="w-full flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 px-3 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> Level:
              </span>
              {mapData.floors.map((fl) => (
                <button
                  key={fl.floor_level}
                  onClick={() => setActiveFloorLevel(fl.floor_level)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    activeFloorLevel === fl.floor_level
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  {fl.floor_level === 0
                    ? "Ground (G)"
                    : fl.floor_level === -1
                    ? "B1"
                    : fl.floor_level === -2
                    ? "B2"
                    : `B${Math.abs(fl.floor_level)}`}
                </button>
              ))}
            </div>

            {/* Clearance & Zone Info */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800">
              <span>Clearance: <strong className="text-slate-200">2.4 m</strong></span>
              <span>•</span>
              <span>Available: <strong className="text-emerald-400">{currentFloorLayer?.available_slots || 12} bays</strong></span>
            </div>
          </div>

          {/* Interactive SVG Garage Canvas */}
          <div className="w-full aspect-[16/10] max-h-[460px] bg-gradient-to-b from-slate-950 via-slate-900/80 to-slate-950 rounded-2xl border border-slate-800/80 relative overflow-hidden flex items-center justify-center p-2 shadow-inner">
            <svg
              viewBox="0 0 260 200"
              className="w-full h-full select-none"
              style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}
            >
              <defs>
                {/* Electric Blue Glow */}
                <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00E5FF" />
                  <stop offset="100%" stopColor="#0284C7" />
                </linearGradient>
              </defs>

              {/* Grid Background */}
              <pattern id="indoorGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
              <rect width="260" height="200" fill="url(#indoorGrid)" />

              {/* Zone Highlight Polygon */}
              {currentFloorLayer?.zones.map((zone) => (
                <polygon
                  key={zone.zone_code}
                  points={zone.polygon_points.map((p) => p.join(",")).join(" ")}
                  fill={zone.color_hex}
                  fillOpacity="0.08"
                  stroke={zone.color_hex}
                  strokeWidth="0.8"
                  strokeDasharray="2,2"
                />
              ))}

              {/* Driving Lanes (Edges) */}
              {currentFloorLayer?.edges.map((edge) => {
                const fromNode = currentFloorLayer.nodes.find((n) => n.id === edge.from_node_id);
                const toNode = currentFloorLayer.nodes.find((n) => n.id === edge.to_node_id);
                if (!fromNode || !toNode) return null;

                const isBlocked = edge.is_blocked;
                return (
                  <g key={edge.id}>
                    <line
                      x1={fromNode.x_coord}
                      y1={fromNode.y_coord}
                      x2={toNode.x_coord}
                      y2={toNode.y_coord}
                      stroke={isBlocked ? "#ef4444" : "#334155"}
                      strokeWidth={edge.edge_type === "LANE_SEGMENT" ? "4.5" : "3"}
                      strokeDasharray={edge.edge_type === "RAMP_TRANSITION" ? "2,2" : undefined}
                      strokeLinecap="round"
                    />
                    {isBlocked && (
                      <text
                        x={(fromNode.x_coord + toNode.x_coord) / 2}
                        y={(fromNode.y_coord + toNode.y_coord) / 2 - 4}
                        fill="#ef4444"
                        fontSize="6"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        ⚠️ BLOCKED
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Active Multi-Floor Route Segments on this floor */}
              {route?.floor_segments
                .filter((seg) => seg.floor_level === activeFloorLevel)
                .map((seg, sIdx) => {
                  const pointsStr = seg.polyline_points.map((p) => p.join(",")).join(" ");
                  return (
                    <polyline
                      key={`route-seg-${sIdx}`}
                      points={pointsStr}
                      fill="none"
                      stroke="url(#routeGrad)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#cyanGlow)"
                      className="animate-pulse"
                    />
                  );
                })}

              {/* Nodes (Gates, Ramps, Elevators, Slots) */}
              {currentFloorLayer?.nodes.map((node) => {
                const isAllottedSlot =
                  node.slot_number === (route?.assigned_slot_number || initialSlotNumber);
                const isRamp = node.node_type.includes("RAMP");
                const isGate = node.node_type.includes("GATE");
                const isElevator = node.node_type === "ELEVATOR";

                return (
                  <g key={node.id} transform={`translate(${node.x_coord}, ${node.y_coord})`}>
                    {/* Node Circle */}
                    <circle
                      r={isAllottedSlot ? 8 : isRamp || isGate ? 5.5 : 3.5}
                      fill={
                        isAllottedSlot
                          ? "#00E5FF"
                          : isRamp
                          ? "#f59e0b"
                          : isGate
                          ? "#10b981"
                          : isElevator
                          ? "#8b5cf6"
                          : "#1e293b"
                      }
                      stroke="#0f172a"
                      strokeWidth="1.5"
                      filter={isAllottedSlot ? "url(#cyanGlow)" : undefined}
                    />

                    {/* Allotted Slot Pulse Ring */}
                    {isAllottedSlot && (
                      <circle
                        r="12"
                        fill="none"
                        stroke="#00E5FF"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                        className="animate-spin"
                      />
                    )}

                    {/* Node Text Label */}
                    <text
                      x="0"
                      y={isAllottedSlot ? -11 : -7}
                      fill={isAllottedSlot ? "#00E5FF" : "#94a3b8"}
                      fontSize={isAllottedSlot ? "6" : "4.5"}
                      fontWeight={isAllottedSlot ? "bold" : "normal"}
                      textAnchor="middle"
                    >
                      {node.slot_number || node.label?.split(" ")[0] || node.node_code}
                    </text>
                  </g>
                );
              })}

              {/* Live Vehicle Position Marker */}
              {vehiclePos.floor === activeFloorLevel && (
                <g transform={`translate(${vehiclePos.x}, ${vehiclePos.y})`}>
                  <circle r="7" fill="#0284C7" fillOpacity="0.4" className="animate-ping" />
                  <circle r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
                  <polygon
                    points="0,-4 3,3 0,1.5 -3,3"
                    fill="#ffffff"
                    transform={`rotate(${vehicleHeading})`}
                  />
                </g>
              )}
            </svg>

            {/* In-Canvas Floor & Transition Badge */}
            <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs font-semibold text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>
                {currentFloorLayer?.floor_name || "Basement 2"} •{" "}
                {currentFloorLayer?.zones[0]?.zone_name || "Zone C Concourse"}
              </span>
            </div>

            {/* Target Slot Proximity Callout */}
            {activeFloorLevel === -2 && (
              <div className="absolute bottom-3 right-3 bg-cyan-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-500/40 text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>Destination Slot: C-142</span>
              </div>
            )}
          </div>

          {/* Action Notice Toast */}
          {actionNotice && (
            <div className="w-full mt-3 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-medium flex items-center gap-2 animate-fadeIn">
              <Info className="w-4 h-4 shrink-0 text-cyan-400" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* Bottom Interactive Simulation Bar */}
          <div className="w-full mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Position Accuracy:</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400" />
                {(positioningConfidence * 100).toFixed(0)}% (BLE/UWB Fusion)
              </span>
            </div>

            {/* Simulation Shortcuts */}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  handleScanCheckpoint("PW-QR-B2-ZONEC-01", "Zone C Entrance QR")
                }
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 font-medium"
              >
                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Scan Zone C QR</span>
              </button>
              <button
                onClick={handleSimulateBlockedLane}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors flex items-center gap-1.5 font-medium"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Simulate Obstacle</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Tesla-Style Turn-by-Turn Navigation HUD */}
        <div className="lg:col-span-4 p-6 bg-slate-900/60 flex flex-col justify-between">
          <div>
            {/* Primary Maneuver Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/30 shadow-lg relative overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                  {renderManeuverIcon(activeStep?.maneuver || "STRAIGHT", "w-8 h-8")}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-white tracking-tight">
                    {activeStep?.distance_meters ? `${activeStep.distance_meters} m` : "Now"}
                  </div>
                  <div className="text-xs text-slate-400">
                    Step {currentStepIndex + 1} of {route?.turn_by_turn_steps.length || 1}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-base font-bold text-slate-100 leading-snug">
                  {activeStep?.instruction || "Proceed straight along the driving concourse"}
                </h4>
                <div className="flex items-center gap-2 mt-2 text-xs text-cyan-400 font-medium">
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    Current Floor: {activeStep?.floor_name || "Ground Floor"}
                  </span>
                </div>
              </div>
            </div>

            {/* Journey Progress Indicators */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-medium">Remaining Distance</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {route?.total_distance_meters || 185} m
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-medium">Estimated Ingress</div>
                <div className="text-lg font-bold text-cyan-400 mt-0.5">
                  ~{Math.ceil((route?.estimated_duration_seconds || 120) / 60)} min
                </div>
              </div>
            </div>

            {/* Turn-by-Turn Instruction List Preview */}
            <div className="mt-5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Route Maneuvers
              </h5>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {route?.turn_by_turn_steps.map((st, idx) => (
                  <div
                    key={st.step_number}
                    onClick={() => {
                      setCurrentStepIndex(idx);
                      setVehiclePos({
                        x: st.waypoint[0],
                        y: st.waypoint[1],
                        floor: st.floor_level,
                      });
                      setActiveFloorLevel(st.floor_level);
                    }}
                    className={`p-2.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      currentStepIndex === idx
                        ? "bg-cyan-500/10 border border-cyan-500/40 text-cyan-200"
                        : "bg-slate-950/50 hover:bg-slate-800/60 text-slate-300 border border-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center text-cyan-400 shrink-0">
                        {renderManeuverIcon(st.maneuver, "w-3 h-3")}
                      </div>
                      <span className="truncate max-w-[190px]">{st.instruction}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px]">{st.distance_meters}m</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Navigation Control Buttons */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col gap-2.5">
            {!isParkedConfirmed ? (
              <>
                <button
                  onClick={handleAdvanceStep}
                  className="w-full py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
                >
                  <Navigation className="w-4 h-4 fill-current" />
                  <span>
                    {currentStepIndex >= (route?.turn_by_turn_steps.length || 1) - 1
                      ? "Arrived at Allotted Slot C-142"
                      : "Next Waypoint / Maneuver"}
                  </span>
                </button>

                <button
                  onClick={() => setIsArrivalModalOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Confirm Parked in Slot {initialSlotNumber}</span>
                </button>
              </>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-2">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-emerald-300">
                  Vehicle Successfully Parked
                </h4>
                <p className="text-xs text-emerald-400/80 mt-1">
                  Confirmed at Slot {initialSlotNumber} • Level B2 • Zone C
                </p>
                <a
                  href={`/driver/find-my-car?booking=${bookingId}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-400 font-bold hover:underline"
                >
                  <Footprints className="w-3.5 h-3.5" />
                  <span>Find My Car Pedestrian Route</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Arrival Confirmation Modal */}
      {isArrivalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 shadow-2xl text-slate-100 animate-scaleIn">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white">
              Confirm Arrival at Slot {initialSlotNumber}
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              You have arrived at <strong className="text-cyan-400">Level Basement 2, Zone C</strong>.
              Verify your vehicle is positioned securely inside the bay markers.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Facility:</span>
                <span className="font-semibold text-slate-200">{mapData.facility_name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Assigned Slot:</span>
                <span className="font-bold text-cyan-400">{initialSlotNumber}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Arrival Gate Verification:</span>
                <span className="text-emerald-400 font-medium">Verified by BLE/QR</span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsArrivalModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmArrival}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/30 flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm & Lock Slot</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
