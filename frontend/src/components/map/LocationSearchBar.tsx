"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Crosshair,
  MapPin,
  Compass,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Navigation,
} from "lucide-react";
import { PlaceSearchResult, searchPlaces } from "@/lib/facilityApi";

interface LocationSearchBarProps {
  onLocationSelect: (loc: { lat: number; lng: number; name: string }) => void;
  driverLocation: { lat: number; lng: number; accuracy?: number } | null;
  onGpsRequested: () => void;
  gpsStatus: "idle" | "requesting" | "granted" | "denied";
  gpsError: string | null;
}

export function LocationSearchBar({
  onLocationSelect,
  driverLocation,
  onGpsRequested,
  gpsStatus,
  gpsError,
}: LocationSearchBarProps) {
  const [query, setQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<PlaceSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced place search
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchPlaces(query);
        setSuggestions(results);
        setIsOpen(true);
      } catch (err) {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPlace = (place: PlaceSearchResult) => {
    setQuery(place.name);
    setIsOpen(false);
    onLocationSelect({
      lat: place.latitude,
      lng: place.longitude,
      name: place.name,
    });
  };

  return (
    <div className="relative w-full max-w-xl z-50">
      {/* Search Input Container */}
      <div className="relative flex items-center rounded-2xl border border-slate-700/80 bg-slate-900/95 px-4 py-2.5 shadow-2xl backdrop-blur-xl">
        <Search className="h-4 w-4 text-slate-400 shrink-0 mr-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder="Search by landmark, mall, airport, or locality (e.g. CyberHub, CP, Saket)..."
          className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
        />

        {query && (
          <button
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              setIsOpen(false);
            }}
            className="mr-2 text-slate-500 hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* GPS Button */}
        <button
          onClick={onGpsRequested}
          disabled={gpsStatus === "requesting"}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shrink-0 ${
            gpsStatus === "granted"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : gpsStatus === "denied"
              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              : "bg-blue-600/30 text-blue-400 border border-blue-500/40 hover:bg-blue-600/50"
          }`}
          title="Detect my current location"
        >
          <Crosshair className={`h-3.5 w-3.5 ${gpsStatus === "requesting" ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">
            {gpsStatus === "requesting"
              ? "Locating..."
              : gpsStatus === "granted"
              ? "GPS Active"
              : "Use GPS"}
          </span>
        </button>
      </div>

      {/* GPS Error Notification */}
      {gpsError && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/80 px-3.5 py-2 text-xs text-rose-300 backdrop-blur shadow-lg">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/98 p-2 shadow-2xl backdrop-blur-xl"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Matching Locations in India
          </div>
          {suggestions.map((item) => (
            <button
              key={item.place_id}
              onClick={() => handleSelectPlace(item)}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-800/80 transition"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-200 truncate">{item.name}</div>
                <div className="text-xs text-slate-400">
                  {item.locality}, {item.city}, {item.state}
                </div>
              </div>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-400 uppercase">
                {item.type.replace(/_/g, " ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
