"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Compass,
  Layers,
  MapPin,
  Navigation,
  ZoomIn,
  ZoomOut,
  Crosshair,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Car,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  ExternalLink,
  X,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";
import {
  FacilityEntrance,
  NearbyFacilityItem,
  OutdoorRouteResponse,
  ParkingFacilitySummary,
} from "@/lib/facilityApi";

interface ParkingMapViewProps {
  facilities: (ParkingFacilitySummary | NearbyFacilityItem)[];
  selectedFacility: ParkingFacilitySummary | null;
  onSelectFacility: (facility: ParkingFacilitySummary) => void;
  driverLocation: { lat: number; lng: number; accuracy?: number } | null;
  selectedEntrance: FacilityEntrance | null;
  onSelectEntrance?: (entrance: FacilityEntrance) => void;
  searchRadiusKm?: number;
  isLoading?: boolean;
  activeRoute?: OutdoorRouteResponse | null;
  onExitNavigation?: () => void;
  onBookFacility?: (facility: ParkingFacilitySummary) => void;
}

export function ParkingMapView({
  facilities,
  selectedFacility,
  onSelectFacility,
  driverLocation,
  selectedEntrance,
  onSelectEntrance,
  searchRadiusKm = 10,
  isLoading = false,
  activeRoute = null,
  onExitNavigation,
  onBookFacility,
}: ParkingMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Map viewport center and zoom state
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: selectedFacility?.latitude || driverLocation?.lat || 28.5283,
    lng: selectedFacility?.longitude || driverLocation?.lng || 77.2185,
  });
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 750,
  });
  const [zoom, setZoom] = useState<number>(14);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [selectedAltRouteId, setSelectedAltRouteId] = useState<string | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || 1200;
        const h = containerRef.current.clientHeight || 750;
        setDimensions({ width: w, height: h });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Synchronize center when activeRoute or selectedFacility changes
  useEffect(() => {
    if (activeRoute && driverLocation) {
      // In navigation mode, center between driver and entrance
      const midLat = (driverLocation.lat + activeRoute.destination_coordinates.latitude) / 2;
      const midLng = (driverLocation.lng + activeRoute.destination_coordinates.longitude) / 2;
      setCenter({ lat: midLat, lng: midLng });
      setZoom(14);
    } else if (selectedFacility) {
      setCenter({ lat: selectedFacility.latitude, lng: selectedFacility.longitude });
    } else if (driverLocation) {
      setCenter({ lat: driverLocation.lat, lng: driverLocation.lng });
    }
  }, [selectedFacility, driverLocation, activeRoute]);

  // Recenter map on driver location
  const handleRecenter = () => {
    if (driverLocation) {
      setCenter({ lat: driverLocation.lat, lng: driverLocation.lng });
      setZoom(15);
    } else if (facilities.length > 0) {
      const f = "facility" in facilities[0] ? facilities[0].facility : facilities[0];
      setCenter({ lat: f.latitude, lng: f.longitude });
      setZoom(14);
    }
  };

  // Convert lat/lng to pixel offsets on container
  const latLngToPixels = useCallback(
    (lat: number, lng: number) => {
      const width = containerRef.current?.clientWidth || dimensions.width || 1200;
      const height = containerRef.current?.clientHeight || dimensions.height || 750;

      // Web Mercator approximation for responsive viewport
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

  // Mouse drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
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

  // Touch drag handlers for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.x;
    const dy = e.touches[0].clientY - dragStart.y;

    const scale = Math.pow(2, zoom) * 128;
    const dLng = -(dx / scale) * (180 / Math.PI);
    const dLat = (dy / scale) * (180 / Math.PI);

    setCenter((prev) => ({
      lat: Math.max(-85, Math.min(85, prev.lat + dLat)),
      lng: ((prev.lng + dLng + 180) % 360) - 180,
    }));
    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = () => setIsDragging(false);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(19, z + 1));
    } else {
      setZoom((z) => Math.max(10, z - 1));
    }
  };

  // Normalizing facilities list
  const facilityItems: ParkingFacilitySummary[] = facilities.map((item) =>
    "facility" in item ? item.facility : item
  );

  // Spatial clustering when zoomed out (zoom <= 12)
  const isClustered = zoom <= 12;
  const clusters: {
    id: string;
    lat: number;
    lng: number;
    count: number;
    minPrice: number;
    totalSlots: number;
    items: ParkingFacilitySummary[];
  }[] = [];

  if (isClustered && facilityItems.length > 0) {
    const used = new Set<number>();
    const thresholdKm = zoom <= 10 ? 8.0 : zoom <= 11 ? 5.0 : 3.0;

    for (let i = 0; i < facilityItems.length; i++) {
      if (used.has(i)) continue;
      const group = [facilityItems[i]];
      used.add(i);

      for (let j = 0; j < facilityItems.length; j++) {
        if (used.has(j)) continue;
        const dLat = facilityItems[i].latitude - facilityItems[j].latitude;
        const dLng = facilityItems[i].longitude - facilityItems[j].longitude;
        const approxKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
        if (approxKm <= thresholdKm) {
          group.push(facilityItems[j]);
          used.add(j);
        }
      }

      const avgLat = group.reduce((sum, f) => sum + f.latitude, 0) / group.length;
      const avgLng = group.reduce((sum, f) => sum + f.longitude, 0) / group.length;
      const minPrice = Math.min(...group.map((f) => f.base_hourly_rate_inr));
      const totalSlots = group.reduce((sum, f) => sum + f.available_capacity, 0);

      clusters.push({
        id: `clust-${i}`,
        lat: avgLat,
        lng: avgLng,
        count: group.length,
        minPrice,
        totalSlots,
        items: group,
      });
    }
  }

  // Active navigation route points
  const activeWaypoints =
    activeRoute && selectedAltRouteId && activeRoute.alternative_routes.length > 0
      ? activeRoute.alternative_routes.find((a) => a.route_id === selectedAltRouteId)?.waypoints ||
        activeRoute.waypoints
      : activeRoute?.waypoints || [];

  const polylinePointsString = activeWaypoints
    .map((wp) => {
      const p = latLngToPixels(wp.lat, wp.lng);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  const altWaypoints =
    activeRoute?.alternative_routes && activeRoute.alternative_routes.length > 0
      ? activeRoute.alternative_routes[0].waypoints
      : [];

  const altPolylinePointsString = altWaypoints
    .map((wp) => {
      const p = latLngToPixels(wp.lat, wp.lng);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  // Next maneuver step
  const nextStep = activeRoute?.steps && activeRoute.steps.length > 0 ? activeRoute.steps[0] : null;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className={`absolute inset-0 h-full w-full overflow-hidden select-none cursor-${
        isDragging ? "grabbing" : "grab"
      } ${themeMode === "light" ? "bg-slate-100" : "bg-slate-950"}`}
      style={{
        backgroundImage:
          themeMode === "light"
            ? "radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)"
            : "radial-gradient(circle at 1px 1px, #1e293b 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }}
    >
      {/* Background Map Grid & Coordinate System */}
      <div
        className={`absolute inset-0 pointer-events-none ${
          themeMode === "light" ? "opacity-15" : "opacity-20"
        }`}
      >
        <svg className="w-full h-full">
          <defs>
            <pattern id="mapgrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path
                d="M 60 0 L 0 0 0 60"
                fill="none"
                stroke={themeMode === "light" ? "#0284c7" : "#38bdf8"}
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mapgrid)" />
        </svg>
      </div>

      {/* Driver Location Accuracy Radius Circle */}
      {driverLocation &&
        (() => {
          const pos = latLngToPixels(driverLocation.lat, driverLocation.lng);
          const pxRadius = Math.max(
            20,
            (driverLocation.accuracy || 35) * Math.pow(2, zoom) * 0.002
          );
          return (
            <div
              className={`absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-300 ${
                themeMode === "light"
                  ? "border-blue-500/40 bg-blue-500/10"
                  : "border-blue-400/50 bg-blue-500/10"
              }`}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${pxRadius * 2}px`,
                height: `${pxRadius * 2}px`,
              }}
            />
          );
        })()}

      {/* Driver GPS Location Beacon */}
      {driverLocation &&
        (() => {
          const pos = latLngToPixels(driverLocation.lat, driverLocation.lng);
          return (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            >
              <div className="relative flex items-center justify-center">
                <span className="absolute h-8 w-8 animate-ping rounded-full bg-blue-500 opacity-75" />
                <div className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blue-600 shadow-xl shadow-blue-500/60">
                  <Navigation className="h-3 w-3 text-white fill-white rotate-45" />
                </div>
              </div>
              <div
                className={`mt-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-bold shadow ${
                  themeMode === "light"
                    ? "bg-white/95 text-blue-700 border border-slate-200"
                    : "bg-slate-900/90 text-blue-300 backdrop-blur"
                }`}
              >
                You are here (±{driverLocation.accuracy || 30}m)
              </div>
            </div>
          );
        })()}

      {/* Active Outdoor Navigation Polyline Route (When Route Active) */}
      {activeRoute && polylinePointsString && (
        <svg className="absolute inset-0 pointer-events-none z-15 w-full h-full">
          {/* Alternative Route Polyline (Dashed Cyan) */}
          {altPolylinePointsString && (
            <polyline
              points={altPolylinePointsString}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="4"
              strokeDasharray="8 6"
              strokeOpacity="0.5"
            />
          )}

          {/* Main Route Outer Glow */}
          <polyline
            points={polylinePointsString}
            fill="none"
            stroke="#2563eb"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.8"
          />

          {/* Main Route High-Vis Core (Electric Blue Pulse) */}
          <polyline
            points={polylinePointsString}
            fill="none"
            stroke="#60a5fa"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="10 8"
            className="animate-pulse"
          />
        </svg>
      )}

      {/* Fallback Direct Vector Line to Entrance when no turn route is calculated */}
      {!activeRoute &&
        driverLocation &&
        selectedEntrance &&
        (() => {
          const p1 = latLngToPixels(driverLocation.lat, driverLocation.lng);
          const p2 = latLngToPixels(selectedEntrance.latitude, selectedEntrance.longitude);
          return (
            <svg className="absolute inset-0 pointer-events-none z-10 w-full h-full">
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#38bdf8"
                strokeWidth="3"
                strokeDasharray="6 6"
                className="animate-pulse"
              />
            </svg>
          );
        })()}

      {/* Spatially Clustered Markers (Zoom <= 12) */}
      {isClustered &&
        clusters.map((cl) => {
          const pos = latLngToPixels(cl.lat, cl.lng);
          return (
            <div
              key={cl.id}
              onClick={(e) => {
                e.stopPropagation();
                // Zoom in and center on cluster
                setCenter({ lat: cl.lat, lng: cl.lng });
                setZoom(14);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer transition-transform hover:scale-115"
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            >
              <div className="relative flex flex-col items-center">
                <span className="absolute -inset-1 rounded-full bg-blue-500/30 animate-ping opacity-60" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-white bg-blue-600 text-white shadow-2xl shadow-blue-500/50">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-black leading-none">{cl.count}</span>
                    <span className="text-[8px] uppercase tracking-tighter opacity-90">Hubs</span>
                  </div>
                </div>
                <div className="mt-1 whitespace-nowrap rounded-lg bg-slate-900/90 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-slate-700 backdrop-blur shadow">
                  from ₹{cl.minPrice}/h • {cl.totalSlots} bays
                </div>
              </div>
            </div>
          );
        })}

      {/* Individual Facility Markers (Zoom > 12) */}
      {!isClustered &&
        facilityItems.map((facility) => {
          const pos = latLngToPixels(facility.latitude, facility.longitude);
          const isSelected = selectedFacility?.id === facility.id;
          const isAvailable = facility.available_capacity > 0;

          return (
            <div
              key={facility.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectFacility(facility);
              }}
              className={`absolute -translate-x-1/2 -translate-y-full z-20 cursor-pointer transition-all duration-200 hover:scale-110 ${
                isSelected ? "scale-125 z-40" : ""
              }`}
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            >
              <div className="relative flex flex-col items-center group">
                {/* Tooltip / Label */}
                <div
                  className={`mb-1 whitespace-nowrap rounded-xl px-2.5 py-1 text-[11px] font-bold shadow-lg transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-blue-500/50 ring-2 ring-white/40"
                      : themeMode === "light"
                      ? "bg-white text-slate-800 border border-slate-200 shadow-md"
                      : "bg-slate-900/95 text-slate-100 border border-slate-700/80"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isAvailable ? "bg-emerald-400" : "bg-rose-500"
                      }`}
                    />
                    <span>{facility.name}</span>
                    <span className="font-mono text-xs opacity-90 font-medium">
                      ₹{facility.base_hourly_rate_inr}/h
                    </span>
                  </div>
                </div>

                {/* Parkwise Custom Electric Blue Pin with Capacity Badge */}
                <div
                  className={`relative flex h-10 w-10 items-center justify-center rounded-2xl border-2 shadow-xl ${
                    isSelected
                      ? "border-blue-400 bg-blue-600 text-white shadow-blue-600/50"
                      : isAvailable
                      ? "border-emerald-400/80 bg-slate-900 text-emerald-400 shadow-emerald-500/20"
                      : "border-rose-400/80 bg-slate-900 text-rose-400"
                  }`}
                >
                  <Car className="h-5 w-5" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[9px] font-black border border-slate-700 text-white">
                    {facility.available_capacity}
                  </span>
                </div>

                {/* Pin Tip */}
                <div
                  className={`h-2 w-2 rotate-45 -mt-1 border-r-2 border-b-2 ${
                    isSelected
                      ? "border-blue-400 bg-blue-600"
                      : isAvailable
                      ? "border-emerald-400/80 bg-slate-900"
                      : "border-rose-400/80 bg-slate-900"
                  }`}
                />
              </div>
            </div>
          );
        })}

      {/* Facility Entrance Markers (When Selected) */}
      {!isClustered &&
        selectedFacility &&
        selectedFacility.primary_entrance &&
        (() => {
          const ent = selectedFacility.primary_entrance;
          const pos = latLngToPixels(ent.latitude, ent.longitude);
          const isSelected = selectedEntrance?.id === ent.id;

          return (
            <div
              key={`ent-${ent.id || "primary"}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectEntrance) onSelectEntrance(ent);
              }}
              className="absolute -translate-x-1/2 -translate-y-full z-25 cursor-pointer transition-transform hover:scale-115"
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            >
              <div className="flex flex-col items-center">
                <div className="mb-0.5 rounded bg-emerald-600/95 px-2 py-0.5 text-[9px] font-bold text-white shadow">
                  Entrance • {ent.height_clearance_meters}m
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-slate-950 shadow-xl">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })()}

      {/* TOP NAVIGATION HUD (Active when in outdoor navigation mode) */}
      {activeRoute && (
        <div className="absolute top-4 left-4 right-4 z-40 max-w-xl mx-auto animate-fade-in">
          <div className="rounded-3xl border border-blue-500/50 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/40">
                  <CornerUpRight className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                    Next Maneuver • In 400m
                  </div>
                  <div className="text-sm font-bold text-slate-100">
                    {nextStep ? nextStep.instruction : "Proceed to facility entrance"}
                  </div>
                </div>
              </div>

              {/* Exit Navigation Button */}
              {onExitNavigation && (
                <button
                  type="button"
                  onClick={onExitNavigation}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  title="Exit Navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Navigation Telemetry Bar */}
            <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-black text-emerald-400">
                  ~{activeRoute.duration_minutes} mins
                </span>
                <span className="text-slate-400 font-medium">• {activeRoute.distance_km} km</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-blue-300">
                  {activeRoute.traffic_condition} Traffic
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>{activeRoute.entrance.gate_name}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Map Controls (Top Right) */}
      <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
        <button
          onClick={() => setZoom((z) => Math.min(19, z + 1))}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-lg backdrop-blur transition ${
            themeMode === "light"
              ? "border-slate-300 bg-white/90 text-slate-800 hover:bg-white"
              : "border-slate-700/80 bg-slate-900/90 text-slate-200 hover:bg-slate-800"
          }`}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(10, z - 1))}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-lg backdrop-blur transition ${
            themeMode === "light"
              ? "border-slate-300 bg-white/90 text-slate-800 hover:bg-white"
              : "border-slate-700/80 bg-slate-900/90 text-slate-200 hover:bg-slate-800"
          }`}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={handleRecenter}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-lg backdrop-blur transition ${
            themeMode === "light"
              ? "border-slate-300 bg-white/90 text-blue-600 hover:bg-white"
              : "border-slate-700/80 bg-slate-900/90 text-blue-400 hover:bg-slate-800"
          }`}
          title="Recenter on My Location"
        >
          <Crosshair className="h-4 w-4" />
        </button>
        {/* Light / Dark Mode Toggle */}
        <button
          onClick={() => setThemeMode((m) => (m === "dark" ? "light" : "dark"))}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-lg backdrop-blur transition ${
            themeMode === "light"
              ? "border-slate-300 bg-white/90 text-amber-500 hover:bg-white"
              : "border-slate-700/80 bg-slate-900/90 text-amber-300 hover:bg-slate-800"
          }`}
          title={`Switch to ${themeMode === "dark" ? "Light (Apple Style)" : "Dark (Tesla Style)"}`}
        >
          {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Map Attribution & Telemetry Status (Bottom Left) */}
      <div
        className={`absolute bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] backdrop-blur ${
          themeMode === "light"
            ? "border-slate-300 bg-white/90 text-slate-700"
            : "border-slate-800 bg-slate-950/90 text-slate-400"
        }`}
      >
        <Compass className="h-3.5 w-3.5 text-blue-500" />
        <span>
          Center: {center.lat.toFixed(4)}°N, {center.lng.toFixed(4)}°E • Zoom {zoom}
        </span>
        <span className="h-2 w-px bg-slate-600" />
        <span className="text-emerald-500 font-medium">
          {facilityItems.length} Smart Facilities Live
        </span>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 shadow-2xl">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            <span>Updating real-time parking telemetry...</span>
          </div>
        </div>
      )}
    </div>
  );
}
