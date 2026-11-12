"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRouteGate } from "@/components/auth/ProtectedRouteGate";
import { DriverSubNav } from "@/components/driver/DriverSubNav";
import { ParkingMapView } from "@/components/map/ParkingMapView";
import { FacilityCardDrawer } from "@/components/map/FacilityCardDrawer";
import { LocationSearchBar } from "@/components/map/LocationSearchBar";
import { MapFilterBar } from "@/components/map/MapFilterBar";
import {
  FacilityEntrance,
  NearbyFacilityItem,
  ParkingFacilitySummary,
  fetchNearbyFacilities,
} from "@/lib/facilityApi";
import { Compass, AlertCircle } from "lucide-react";

export default function DriverMapPage() {
  const router = useRouter();

  // Search & Filter State
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
  }>({
    lat: 28.5283,
    lng: 77.2185,
    accuracy: 35,
  }); // Default to Saket Metro, Delhi
  const [gpsStatus, setGpsStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [radiusKm, setRadiusKm] = useState<number>(15);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("ALL");
  const [availableOnly, setAvailableOnly] = useState<boolean>(false);
  const [maxPrice, setMaxPrice] = useState<number>(150);

  // Data & Selection State
  const [nearbyFacilities, setNearbyFacilities] = useState<NearbyFacilityItem[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<ParkingFacilitySummary | null>(null);
  const [selectedEntrance, setSelectedEntrance] = useState<FacilityEntrance | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Request browser geolocation permission
  const handleRequestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("denied");
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }

    setGpsStatus("requesting");
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDriverLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        });
        setGpsStatus("granted");
      },
      (error) => {
        setGpsStatus("denied");
        let msg = "Location permission denied. Using central transit hub.";
        if (error.code === error.TIMEOUT) {
          msg = "Location request timed out. Please retry or pick a hub.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "GPS signal unavailable. Please select your location manually.";
        }
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  // Fetch facilities whenever coordinates or filters change
  const loadNearbyFacilities = useCallback(async () => {
    if (!driverLocation) return;
    setIsLoading(true);
    try {
      const data = await fetchNearbyFacilities({
        latitude: driverLocation.lat,
        longitude: driverLocation.lng,
        radius_km: radiusKm,
        vehicle_type: selectedVehicleType !== "ALL" ? selectedVehicleType : undefined,
        category: selectedCategory !== "ALL" ? selectedCategory : undefined,
        available_only: availableOnly,
        max_price: maxPrice,
      });

      setNearbyFacilities(data);
      if (data.length > 0 && !selectedFacility) {
        setSelectedFacility(data[0].facility);
        if (data[0].primary_entrance) {
          setSelectedEntrance(data[0].primary_entrance);
        }
      }
    } catch (err) {
      console.error("Failed to load nearby facilities:", err);
    } finally {
      setIsLoading(false);
    }
  }, [driverLocation, radiusKm, selectedVehicleType, selectedCategory, availableOnly, maxPrice]);

  useEffect(() => {
    loadNearbyFacilities();
  }, [loadNearbyFacilities]);

  // Handler for place selection from search bar
  const handleLocationSelect = (loc: { lat: number; lng: number; name: string }) => {
    setDriverLocation({ lat: loc.lat, lng: loc.lng, accuracy: 25 });
    setGpsStatus("idle");
    setGpsError(null);
    setSelectedFacility(null);
    setSelectedEntrance(null);
  };

  const handleFacilitySelect = (facility: ParkingFacilitySummary) => {
    setSelectedFacility(facility);
    if (facility.primary_entrance) {
      setSelectedEntrance(facility.primary_entrance);
    } else {
      setSelectedEntrance(null);
    }
  };

  const handleReserveClick = (facilityId: number, lotId?: number) => {
    // Navigate to driver booking view with selected lot
    router.push(`/driver?lotId=${lotId || facilityId}`);
  };

  return (
    <ProtectedRouteGate
      allowedRoles={["DRIVER", "ADMIN"]}
      applicationName="Driver Discovery & Live Map"
    >
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Navigation Header */}
        <div className="border-b border-slate-800 bg-slate-900/90 backdrop-blur">
          <DriverSubNav />
        </div>

        {/* Map Container Area */}
        <div className="relative w-full h-[calc(100vh-130px)] min-h-[600px] overflow-hidden">
          {/* Top Floating Control Bar */}
          <div className="absolute top-4 left-4 right-4 z-40 flex flex-col gap-2 pointer-events-none">
            <div className="pointer-events-auto flex flex-col md:flex-row items-stretch md:items-center gap-2">
              <LocationSearchBar
                onLocationSelect={handleLocationSelect}
                driverLocation={driverLocation}
                onGpsRequested={handleRequestGps}
                gpsStatus={gpsStatus}
                gpsError={gpsError}
              />
              <div className="overflow-x-auto">
                <MapFilterBar
                  radiusKm={radiusKm}
                  onRadiusChange={setRadiusKm}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  selectedVehicleType={selectedVehicleType}
                  onVehicleTypeChange={setSelectedVehicleType}
                  availableOnly={availableOnly}
                  onAvailableOnlyChange={setAvailableOnly}
                  maxPrice={maxPrice}
                  onMaxPriceChange={setMaxPrice}
                />
              </div>
            </div>
          </div>

          {/* Interactive Map Component */}
          <ParkingMapView
            facilities={nearbyFacilities}
            selectedFacility={selectedFacility}
            onSelectFacility={handleFacilitySelect}
            driverLocation={driverLocation}
            selectedEntrance={selectedEntrance}
            onSelectEntrance={setSelectedEntrance}
            searchRadiusKm={radiusKm}
            isLoading={isLoading}
          />

          {/* Facility Details Drawer (Slide-up on mobile, floating card on desktop) */}
          {selectedFacility && (
            <FacilityCardDrawer
              facility={selectedFacility}
              onClose={() => setSelectedFacility(null)}
              selectedEntrance={selectedEntrance}
              onSelectEntrance={setSelectedEntrance}
              onReserveClick={handleReserveClick}
            />
          )}
        </div>
      </main>
    </ProtectedRouteGate>
  );
}
