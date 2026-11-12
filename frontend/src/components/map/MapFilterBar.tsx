"use client";

import React from "react";
import { Filter, SlidersHorizontal, BatteryCharging, Car, Layers } from "lucide-react";

interface MapFilterBarProps {
  radiusKm: number;
  onRadiusChange: (radius: number) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedVehicleType: string;
  onVehicleTypeChange: (vehicle: string) => void;
  availableOnly: boolean;
  onAvailableOnlyChange: (available: boolean) => void;
  maxPrice: number;
  onMaxPriceChange: (price: number) => void;
}

const CATEGORIES = [
  { id: "ALL", label: "All Categories" },
  { id: "MALL", label: "Malls" },
  { id: "COMMERCIAL", label: "Commercial Hubs" },
  { id: "TRANSIT", label: "Metro / Transit" },
  { id: "AIRPORT", label: "Airports" },
];

const VEHICLE_TYPES = [
  { id: "ALL", label: "All Vehicles" },
  { id: "EV", label: "EV Only" },
  { id: "SUV", label: "SUV" },
  { id: "SEDAN", label: "Sedan" },
  { id: "TWO_WHEELER", label: "2-Wheeler" },
];

export function MapFilterBar({
  radiusKm,
  onRadiusChange,
  selectedCategory,
  onCategoryChange,
  selectedVehicleType,
  onVehicleTypeChange,
  availableOnly,
  onAvailableOnlyChange,
  maxPrice,
  onMaxPriceChange,
}: MapFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-2 text-white shadow-xl backdrop-blur-xl">
      {/* Category Pills */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              selectedCategory === cat.id
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-750"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="hidden sm:block h-4 w-px bg-slate-700 mx-1" />

      {/* Vehicle Type Selector */}
      <div className="flex items-center gap-1">
        {VEHICLE_TYPES.map((vt) => (
          <button
            key={vt.id}
            onClick={() => onVehicleTypeChange(vt.id)}
            className={`whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
              selectedVehicleType === vt.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-750"
            }`}
          >
            {vt.label}
          </button>
        ))}
      </div>

      <div className="hidden sm:block h-4 w-px bg-slate-700 mx-1" />

      {/* Radius Slider Display */}
      <div className="flex items-center gap-2 rounded-xl bg-slate-800/80 px-3 py-1.5 text-xs">
        <span className="text-slate-400 font-medium">Radius:</span>
        <span className="font-mono font-bold text-blue-400">{radiusKm} km</span>
        <input
          type="range"
          min="1"
          max="30"
          value={radiusKm}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="h-1.5 w-16 accent-blue-500 cursor-pointer"
        />
      </div>

      {/* Available Only Toggle */}
      <label className="flex items-center gap-2 cursor-pointer rounded-xl bg-slate-800/80 px-3 py-1.5 text-xs select-none">
        <input
          type="checkbox"
          checked={availableOnly}
          onChange={(e) => onAvailableOnlyChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded accent-blue-500"
        />
        <span className="text-slate-300 font-medium">Available Only</span>
      </label>
    </div>
  );
}
