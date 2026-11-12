"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRouteGate } from "@/components/auth/ProtectedRouteGate";
import { DriverSubNav } from "@/components/driver/DriverSubNav";
import { ParkingMapView } from "@/components/map/ParkingMapView";
import { FacilityCardDrawer } from "@/components/map/FacilityCardDrawer";
import { LocationSearchBar } from "@/components/map/LocationSearchBar";
import { MapFilterBar } from "@/components/map/MapFilterBar";
import { FacilityListView } from "@/components/map/FacilityListView";
import { FacilityDirectBookingModal } from "@/components/map/FacilityDirectBookingModal";
import {
  FacilityEntrance,
  NearbyFacilityItem,
  OutdoorRouteResponse,
  ParkingFacilitySummary,
  fetchFacilityRoute,
  fetchNearbyFacilities,
} from "@/lib/facilityApi";
import { Compass, AlertCircle, Sparkles } from "lucide-react";

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

  // View Mode: Map or List
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  // Core & Phase 11 Extended Filter State
  const [radiusKm, setRadiusKm] = useState<number>(15);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("ALL");
  const [availableOnly, setAvailableOnly] = useState<boolean>(false);
  const [maxPrice, setMaxPrice] = useState<number>(150);
  const [hasCovered, setHasCovered] = useState<boolean>(false);
  const [hasEv, setHasEv] = useState<boolean>(false);
  const [hasAccessible, setHasAccessible] = useState<boolean>(false);
  const [openNow, setOpenNow] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>("distance");

  // Data & Selection State
  const [nearbyFacilities, setNearbyFacilities] = useState<NearbyFacilityItem[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<ParkingFacilitySummary | null>(null);
  const [selectedEntrance, setSelectedEntrance] = useState<FacilityEntrance | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Phase 11: Outdoor Route Navigation State
  const [activeRoute, setActiveRoute] = useState<OutdoorRouteResponse | null>(null);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  // Phase 11: Direct Booking Modal State
  const [bookingFacility, setBookingFacility] = useState<ParkingFacilitySummary | null>(null);

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
        has_covered: hasCovered,
        has_ev: hasEv,
        has_accessible: hasAccessible,
        is_open_now: openNow,
        sort_by: sortBy,
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
  }, [
    driverLocation,
    radiusKm,
    selectedVehicleType,
    selectedCategory,
    availableOnly,
    maxPrice,
    hasCovered,
    hasEv,
    hasAccessible,
    openNow,
    sortBy,
  ]);

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
    setActiveRoute(null);
  };

  const handleFacilitySelect = (facility: ParkingFacilitySummary) => {
    setSelectedFacility(facility);
    if (facility.primary_entrance) {
      setSelectedEntrance(facility.primary_entrance);
    } else {
      setSelectedEntrance(null);
    }
  };

  // Outdoor navigation calculation
  const handleStartNavigation = async (
    facility: ParkingFacilitySummary,
    entrance?: FacilityEntrance
  ) => {
    try {
      setSelectedFacility(facility);
      const targetEntrance = entrance || facility.primary_entrance;
      if (targetEntrance) setSelectedEntrance(targetEntrance);

      const routeData = await fetchFacilityRoute({
        facilityId: facility.id,
        originLat: driverLocation.lat,
        originLng: driverLocation.lng,
        entranceId: targetEntrance?.id,
      });

      setActiveRoute(routeData);
      setIsNavigating(true);
      setViewMode("map"); // Automatically bring up map view for navigation
    } catch (err) {
      console.error("Navigation route error:", err);
    }
  };

  const handleExitNavigation = () => {
    setActiveRoute(null);
    setIsNavigating(false);
  };

  // Direct map booking
  const handleOpenDirectBooking = (facility: ParkingFacilitySummary) => {
    setBookingFacility(facility);
  };

  const handleReserveClick = (facilityId: number, lotId?: number) => {
    // Navigate to legacy lot reserve or open direct booking modal
    const fac = nearbyFacilities.find((n) => n.facility.id === facilityId)?.facility;
    if (fac) {
      setBookingFacility(fac);
    } else {
      router.push(`/driver?lotId=${lotId || facilityId}`);
    }
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

        {/* Map / Discovery Container Area */}
        <div className="relative w-full h-[calc(100vh-130px)] min-h-[600px] overflow-hidden flex flex-col">
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
                  hasCovered={hasCovered}
                  onHasCoveredChange={setHasCovered}
                  hasEv={hasEv}
                  onHasEvChange={setHasEv}
                  hasAccessible={hasAccessible}
                  onHasAccessibleChange={setHasAccessible}
                  openNow={openNow}
                  onOpenNowChange={setOpenNow}
                  sortBy={sortBy}
                  onSortByChange={setSortBy}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
              </div>
            </div>
          </div>

          {/* Conditional View Rendering: Map View vs List View */}
          {viewMode === "map" ? (
            <div className="relative flex-1 w-full h-full">
              {/* Interactive Vector Canvas Map */}
              <ParkingMapView
                facilities={nearbyFacilities}
                selectedFacility={selectedFacility}
                onSelectFacility={handleFacilitySelect}
                driverLocation={driverLocation}
                selectedEntrance={selectedEntrance}
                onSelectEntrance={setSelectedEntrance}
                searchRadiusKm={radiusKm}
                isLoading={isLoading}
                activeRoute={activeRoute}
                onExitNavigation={handleExitNavigation}
                onBookFacility={handleOpenDirectBooking}
              />

              {/* Facility Details Drawer (Slide-up card on map) */}
              {selectedFacility && !isNavigating && (
                <FacilityCardDrawer
                  facility={selectedFacility}
                  onClose={() => setSelectedFacility(null)}
                  selectedEntrance={selectedEntrance}
                  onSelectEntrance={setSelectedEntrance}
                  onReserveClick={handleReserveClick}
                  onStartNavigation={handleStartNavigation}
                  onBookDirect={handleOpenDirectBooking}
                />
              )}
            </div>
          ) : (
            /* List View Mode (Top padding allows floating search bar) */
            <div className="flex-1 w-full h-full overflow-y-auto pt-24 pb-8">
              <FacilityListView
                facilities={nearbyFacilities}
                selectedFacility={selectedFacility}
                onSelectFacility={handleFacilitySelect}
                onBookFacility={handleOpenDirectBooking}
                onNavigateFacility={(fac) => handleStartNavigation(fac)}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Direct Booking Modal from Map */}
          {bookingFacility && (
            <FacilityDirectBookingModal
              facility={bookingFacility}
              isOpen={true}
              onClose={() => setBookingFacility(null)}
              onStartNavigation={(fac, ent) => handleStartNavigation(fac, ent)}
            />
          )}
        </div>
      </main>
    </ProtectedRouteGate>
  );
}
