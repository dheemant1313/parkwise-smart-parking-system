"use client";

import React, { useState } from "react";
import {
  BatteryCharging,
  Car,
  ChevronDown,
  Compass,
  Filter,
  Layers,
  LayoutGrid,
  Map,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";

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
  // Phase 11 Extended Filters
  hasCovered?: boolean;
  onHasCoveredChange?: (val: boolean) => void;
  hasEv?: boolean;
  onHasEvChange?: (val: boolean) => void;
  hasAccessible?: boolean;
  onHasAccessibleChange?: (val: boolean) => void;
  openNow?: boolean;
  onOpenNowChange?: (val: boolean) => void;
  sortBy?: string;
  onSortByChange?: (val: string) => void;
  // View Toggle
  viewMode: "map" | "list";
  onViewModeChange: (mode: "map" | "list") => void;
}

const CATEGORIES = [
  { id: "ALL", label: "All Hubs" },
  { id: "MALL", label: "Malls" },
  { id: "COMMERCIAL", label: "Commercial" },
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
  hasCovered = false,
  onHasCoveredChange,
  hasEv = false,
  onHasEvChange,
  hasAccessible = false,
  onHasAccessibleChange,
  openNow = false,
  onOpenNowChange,
  sortBy = "distance",
  onSortByChange,
  viewMode,
  onViewModeChange,
}: MapFilterBarProps) {
  const [showExtendedFilters, setShowExtendedFilters] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-2 text-white shadow-xl backdrop-blur-xl transition-all">
      {/* Primary Bar Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Category Selector Pills */}
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

        {/* View Toggle (Map vs List) & Filter Expand Button */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Map vs List Toggle */}
          <div className="flex items-center rounded-xl border border-slate-700 bg-slate-800/80 p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange("map")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                viewMode === "map"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Map className="h-3.5 w-3.5" />
              <span>Map</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                viewMode === "list"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* More Filters Toggle */}
          <button
            type="button"
            onClick={() => setShowExtendedFilters(!showExtendedFilters)}
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
              showExtendedFilters || hasCovered || hasEv || hasAccessible || openNow
                ? "border-blue-500 bg-blue-600/20 text-blue-300"
                : "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-750"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
            <ChevronDown
              className={`h-3 w-3 transition-transform ${showExtendedFilters ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Secondary Quick Row: Vehicle Types & Radius */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60 text-xs">
        {/* Vehicle Types */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {VEHICLE_TYPES.map((vt) => (
            <button
              key={vt.id}
              onClick={() => onVehicleTypeChange(vt.id)}
              className={`whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                selectedVehicleType === vt.id
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              {vt.label}
            </button>
          ))}
        </div>

        <div className="hidden sm:block h-3.5 w-px bg-slate-800" />

        {/* Distance Slider */}
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-800/50 px-2 py-1 text-[11px]">
          <span className="text-slate-400">Radius:</span>
          <span className="font-mono font-bold text-blue-400">{radiusKm}km</span>
          <input
            type="range"
            min="1"
            max="30"
            value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="h-1.5 w-14 accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Available Only */}
        <label className="flex items-center gap-1.5 cursor-pointer rounded-lg bg-slate-800/50 px-2 py-1 text-[11px] select-none">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => onAvailableOnlyChange(e.target.checked)}
            className="h-3 w-3 rounded accent-blue-500"
          />
          <span className="text-slate-300">Available Only</span>
        </label>
      </div>

      {/* Extended Collapsible Filter Drawer */}
      {showExtendedFilters && (
        <div className="mt-1 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs animate-fade-in">
          {/* Max Price Slider */}
          <div className="col-span-2 rounded-xl bg-slate-800/60 p-2 border border-slate-700/60">
            <div className="flex justify-between items-center text-[11px] text-slate-300 mb-1">
              <span>Max Hourly Tariff</span>
              <span className="font-mono font-bold text-emerald-400">₹{maxPrice}/h</span>
            </div>
            <input
              type="range"
              min="40"
              max="200"
              step="10"
              value={maxPrice}
              onChange={(e) => onMaxPriceChange(Number(e.target.value))}
              className="h-1.5 w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Covered Parking Toggle */}
          {onHasCoveredChange && (
            <label className="flex items-center justify-between rounded-xl bg-slate-800/60 p-2 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition">
              <span className="text-[11px] text-slate-200">Covered Bays</span>
              <input
                type="checkbox"
                checked={hasCovered}
                onChange={(e) => onHasCoveredChange(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-blue-500"
              />
            </label>
          )}

          {/* EV Charging Toggle */}
          {onHasEvChange && (
            <label className="flex items-center justify-between rounded-xl bg-slate-800/60 p-2 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition">
              <span className="text-[11px] text-emerald-300 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>EV Charging</span>
              </span>
              <input
                type="checkbox"
                checked={hasEv}
                onChange={(e) => onHasEvChange(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-emerald-500"
              />
            </label>
          )}

          {/* Accessible Parking Toggle */}
          {onHasAccessibleChange && (
            <label className="flex items-center justify-between rounded-xl bg-slate-800/60 p-2 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition">
              <span className="text-[11px] text-slate-200">Accessible (Divyang)</span>
              <input
                type="checkbox"
                checked={hasAccessible}
                onChange={(e) => onHasAccessibleChange(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-blue-500"
              />
            </label>
          )}

          {/* Open Now / 24/7 Toggle */}
          {onOpenNowChange && (
            <label className="flex items-center justify-between rounded-xl bg-slate-800/60 p-2 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition">
              <span className="text-[11px] text-slate-200">Open 24/7</span>
              <input
                type="checkbox"
                checked={openNow}
                onChange={(e) => onOpenNowChange(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-blue-500"
              />
            </label>
          )}

          {/* Sort By Dropdown */}
          {onSortByChange && (
            <div className="col-span-2 sm:col-span-2 flex items-center gap-2 rounded-xl bg-slate-800/60 p-2 border border-slate-700/60">
              <span className="text-[11px] text-slate-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value)}
                className="w-full bg-transparent text-[11px] font-semibold text-white outline-none cursor-pointer"
              >
                <option value="distance" className="bg-slate-900 text-white">
                  Closest Distance
                </option>
                <option value="price_low" className="bg-slate-900 text-white">
                  Price: Low to High
                </option>
                <option value="availability" className="bg-slate-900 text-white">
                  Most Available Bays
                </option>
                <option value="name" className="bg-slate-900 text-white">
                  Facility Name
                </option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
