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
} from "lucide-react";
import { FacilityEntrance, NearbyFacilityItem, ParkingFacilitySummary } from "@/lib/facilityApi";

interface ParkingMapViewProps {
  facilities: (ParkingFacilitySummary | NearbyFacilityItem)[];
  selectedFacility: ParkingFacilitySummary | null;
  onSelectFacility: (facility: ParkingFacilitySummary) => void;
  driverLocation: { lat: number; lng: number; accuracy?: number } | null;
  selectedEntrance: FacilityEntrance | null;
  onSelectEntrance?: (entrance: FacilityEntrance) => void;
  searchRadiusKm?: number;
  isLoading?: boolean;
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
  const [tileMode, setTileMode] = useState<"standard" | "dark" | "satellite">("standard");

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

  // Synchronize center when selectedFacility changes
  useEffect(() => {
    if (selectedFacility) {
      setCenter({ lat: selectedFacility.latitude, lng: selectedFacility.longitude });
    } else if (driverLocation) {
      setCenter({ lat: driverLocation.lat, lng: driverLocation.lng });
    }
  }, [selectedFacility, driverLocation]);

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
      } bg-slate-950`}
      style={{
        backgroundImage:
          tileMode === "dark"
            ? "radial-gradient(circle at 1px 1px, #1e293b 1px, transparent 0)"
            : "radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }}
    >
      {/* Background Map Grid & Coordinate System */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <svg className="w-full h-full">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Driver Location Accuracy Radius Circle */}
      {driverLocation && (
        (() => {
          const pos = latLngToPixels(driverLocation.lat, driverLocation.lng);
          const pxRadius = Math.max(20, (driverLocation.accuracy || 45) * Math.pow(2, zoom) * 0.002);
          return (
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/50 bg-blue-500/10 transition-all duration-300"
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${pxRadius * 2}px`,
                height: `${pxRadius * 2}px`,
              }}
            />
          );
        })()
      )}

      {/* Driver GPS Location Beacon */}
      {driverLocation && (
        (() => {
          const pos = latLngToPixels(driverLocation.lat, driverLocation.lng);
          return (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            >
              <div className="relative flex items-center justify-center">
                <span className="absolute h-8 w-8 animate-ping rounded-full bg-blue-500 opacity-75" />
                <div className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blue-600 shadow-lg shadow-blue-500/50">
                  <Navigation className="h-3 w-3 text-white fill-white rotate-45" />
                </div>
              </div>
              <div className="mt-1 whitespace-nowrap rounded-md bg-slate-900/90 px-1.5 py-0.5 text-[9px] font-bold text-blue-300 backdrop-blur shadow">
                You are here (±{driverLocation.accuracy || 30}m)
              </div>
            </div>
          );
        })()
      )}

      {/* Animated Route Line from Driver to Selected Entrance */}
      {driverLocation && selectedEntrance && (
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
        })()
      )}

      {/* Facility Location Markers */}
      {facilityItems.map((facility) => {
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
            className={`absolute -translate-x-1/2 -translate-y-full z-20 cursor-pointer transition-transform duration-200 hover:scale-110 ${
              isSelected ? "scale-125 z-40" : ""
            }`}
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
          >
            <div className="relative flex flex-col items-center group">
              {/* Tooltip / Label */}
              <div
                className={`mb-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold shadow-lg transition-all ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-blue-500/40"
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

              {/* Pin Icon with Capacity Badge */}
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
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[9px] font-black border border-slate-700">
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

      {/* Facility Entrance Markers (When a facility is selected) */}
      {selectedFacility &&
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
                <div className="mb-0.5 rounded bg-emerald-600/95 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                  Entrance • {ent.height_clearance_meters}m
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400 bg-emerald-500 text-slate-950 shadow-lg">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })()}

      {/* Floating Map Controls (Top Right) */}
      <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
        <button
          onClick={() => setZoom((z) => Math.min(19, z + 1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/90 text-slate-200 shadow-lg backdrop-blur hover:bg-slate-800 transition"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(10, z - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/90 text-slate-200 shadow-lg backdrop-blur hover:bg-slate-800 transition"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={handleRecenter}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/90 text-blue-400 shadow-lg backdrop-blur hover:bg-slate-800 transition"
          title="Recenter on My Location"
        >
          <Crosshair className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            setTileMode((m) =>
              m === "standard" ? "dark" : m === "dark" ? "satellite" : "standard"
            )
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/90 text-slate-200 shadow-lg backdrop-blur hover:bg-slate-800 transition"
          title={`Layer Mode: ${tileMode}`}
        >
          <Layers className="h-4 w-4" />
        </button>
      </div>

      {/* Map Attribution & Status (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-1.5 text-[11px] text-slate-400 backdrop-blur">
        <Compass className="h-3.5 w-3.5 text-blue-400" />
        <span>
          Center: {center.lat.toFixed(4)}°N, {center.lng.toFixed(4)}°E • Zoom {zoom}
        </span>
        <span className="h-2 w-px bg-slate-700" />
        <span className="text-emerald-400 font-medium">
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
