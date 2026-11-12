/**
 * Phase 10: Location, Maps & Parking Facility API Client.
 * Communicates with backend endpoints (/api/v1/parking/* and /api/parking/*).
 */

export interface FacilityLocation {
  id?: number;
  latitude: number;
  longitude: number;
  altitude_meters: number;
  geohash?: string;
  place_id?: string;
  plus_code?: string;
  bounding_box_ne_lat?: number;
  bounding_box_ne_lng?: number;
  bounding_box_sw_lat?: number;
  bounding_box_sw_lng?: number;
}

export interface FacilityAddress {
  id?: number;
  street_line1: string;
  street_line2?: string;
  locality: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  landmark?: string;
  formatted_address: string;
}

export interface FacilityEntrance {
  id?: number;
  gate_name: string;
  gate_code: string;
  latitude: number;
  longitude: number;
  height_clearance_meters: number;
  barrier_type: string;
  allowed_vehicle_types: string[];
  turn_restrictions?: string;
  navigation_waypoint_notes?: string;
  is_primary: boolean;
  is_open: boolean;
}

export interface FacilityExit {
  id?: number;
  gate_name: string;
  gate_code: string;
  latitude: number;
  longitude: number;
  barrier_type: string;
  merge_instructions?: string;
  is_open: boolean;
}

export interface FacilityOperatingHours {
  id?: number;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_24_hours: boolean;
  is_closed: boolean;
}

export interface FacilityMapConfig {
  id?: number;
  map_provider: string;
  default_zoom_level: number;
  pitch_degrees: number;
  bearing_degrees: number;
  style_url: string;
  has_indoor_3d_tiles: boolean;
  indoor_levels_json: string[];
}

export interface ParkingFacilitySummary {
  id: number;
  lot_id?: number;
  code: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  total_capacity: number;
  available_capacity: number;
  base_hourly_rate_inr: number;
  is_24_hours: boolean;
  latitude: number;
  longitude: number;
  city: string;
  locality: string;
  formatted_address: string;
  primary_entrance?: FacilityEntrance;
  photos: string[];
  amenities: string[];
}

export interface NearbyFacilityItem {
  facility: ParkingFacilitySummary;
  distance_km: number;
  distance_meters: number;
  estimated_driving_minutes: number;
  primary_entrance?: FacilityEntrance;
  is_open_now: boolean;
}

export interface ParkingFacilityDetail extends ParkingFacilitySummary {
  description?: string;
  supported_vehicle_types: string[];
  contact_phone?: string;
  contact_email?: string;
  location?: FacilityLocation;
  address?: FacilityAddress;
  entrances: FacilityEntrance[];
  exits: FacilityExit[];
  operating_hours: FacilityOperatingHours[];
  map_config?: FacilityMapConfig;
  created_at?: string;
}

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  locality: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  type: string;
}

// ------------------------------------------------------------------------------
// Phase 11: Navigation, Clustering & Direct Booking Types
// ------------------------------------------------------------------------------
export interface RouteStep {
  step_number: number;
  instruction: string;
  distance_meters: number;
  duration_seconds: number;
  turn_type: string;
  street_name: string;
}

export interface AlternativeRoute {
  route_id: string;
  name: string;
  distance_km: number;
  duration_minutes: number;
  time_diff_minutes: number;
  summary: string;
  waypoints: { lat: number; lng: number }[];
}

export interface OutdoorRouteResponse {
  facility_id: number;
  facility_name: string;
  origin_coordinates: { latitude: number; longitude: number };
  destination_coordinates: { latitude: number; longitude: number };
  entrance: FacilityEntrance;
  distance_km: number;
  duration_minutes: number;
  summary: string;
  traffic_condition: string;
  waypoints: { lat: number; lng: number }[];
  steps: RouteStep[];
  alternative_routes: AlternativeRoute[];
  external_links: {
    google_maps: string;
    apple_maps: string;
    waze: string;
  };
}

export interface DirectFacilityBookingRequest {
  vehicle_number: string;
  vehicle_type: string;
  driver_name: string;
  driver_phone: string;
  duration_hours: number;
  ev_charging_requested: boolean;
  entrance_id?: number;
}

export interface DirectFacilityBookingResponse {
  booking_reference: string;
  facility_id: number;
  facility_name: string;
  facility_address: string;
  assigned_slot_number: string;
  assigned_slot_floor: string;
  assigned_entrance: FacilityEntrance;
  vehicle_number: string;
  vehicle_type: string;
  duration_hours: number;
  base_rate_inr: number;
  total_amount_inr: number;
  payment_status: string;
  qr_token: string;
  qr_pass_url: string;
  navigation_ready: boolean;
  directions_url: string;
  created_at: string;
}

export interface FacilityCluster {
  cluster_id: string;
  latitude: number;
  longitude: number;
  count: number;
  min_price: number;
  max_price: number;
  total_available_slots: number;
  facility_ids: number[];
  facility_names: string[];
}

export interface FacilityClusterListResponse {
  zoom: number;
  total_clusters: number;
  total_facilities: number;
  clusters: FacilityCluster[];
}

export interface FacilityAvailabilityBreakdown {
  facility_id: number;
  facility_name: string;
  total_capacity: number;
  available_capacity: number;
  occupancy_percentage: number;
  slots_by_vehicle_type: Record<string, number>;
  ev_charging_available: number;
  next_available_slot: string;
  is_booking_available: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

/**
 * Fetch all facilities with optional city and category filters.
 */
export async function fetchFacilities(params?: {
  city?: string;
  category?: string;
  status?: string;
}): Promise<ParkingFacilitySummary[]> {
  const query = new URLSearchParams();
  if (params?.city) query.set("city", params.city);
  if (params?.category) query.set("category", params.category);
  if (params?.status) query.set("status", params.status);

  const res = await fetch(`${API_BASE}/parking/facilities?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch facilities: ${res.statusText}`);
  return res.json();
}

/**
 * Discover facilities near a geographical point, sorted by distance.
 */
export async function fetchNearbyFacilities(params: {
  latitude: number;
  longitude: number;
  radius_km?: number;
  vehicle_type?: string;
  max_price?: number;
  available_only?: boolean;
  category?: string;
  limit?: number;
  has_covered?: boolean;
  has_ev?: boolean;
  has_accessible?: boolean;
  is_open_now?: boolean;
  min_available_slots?: number;
  sort_by?: string;
}): Promise<NearbyFacilityItem[]> {
  const query = new URLSearchParams({
    latitude: params.latitude.toString(),
    longitude: params.longitude.toString(),
    radius_km: (params.radius_km || 10.0).toString(),
  });

  if (params.vehicle_type && params.vehicle_type !== "ALL") query.set("vehicle_type", params.vehicle_type);
  if (params.max_price !== undefined) query.set("max_price", params.max_price.toString());
  if (params.available_only) query.set("available_only", "true");
  if (params.category && params.category !== "ALL") query.set("category", params.category);
  if (params.limit) query.set("limit", params.limit.toString());

  const res = await fetch(`${API_BASE}/parking/facilities/nearby?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch nearby facilities: ${res.statusText}`);
  let items: NearbyFacilityItem[] = await res.json();

  // Client-side refined filtering if requested
  if (params.has_covered) {
    items = items.filter((item) =>
      item.facility.amenities?.some((a) => a.toLowerCase().includes("covered"))
    );
  }
  if (params.has_ev) {
    items = items.filter((item) =>
      item.facility.amenities?.some((a) => a.toLowerCase().includes("ev"))
    );
  }
  if (params.has_accessible) {
    items = items.filter((item) =>
      item.facility.amenities?.some((a) => a.toLowerCase().includes("accessible") || a.toLowerCase().includes("wheelchair"))
    );
  }
  if (params.is_open_now) {
    items = items.filter((item) => item.is_open_now || item.facility.is_24_hours);
  }
  if (params.min_available_slots && params.min_available_slots > 0) {
    items = items.filter((item) => item.facility.available_capacity >= (params.min_available_slots || 1));
  }

  // Sorting
  if (params.sort_by === "price_low") {
    items.sort((a, b) => a.facility.base_hourly_rate_inr - b.facility.base_hourly_rate_inr);
  } else if (params.sort_by === "availability") {
    items.sort((a, b) => b.facility.available_capacity - a.facility.available_capacity);
  } else if (params.sort_by === "name") {
    items.sort((a, b) => a.facility.name.localeCompare(b.facility.name));
  } else {
    // Default: distance
    items.sort((a, b) => a.distance_km - b.distance_km);
  }

  return items;
}

/**
 * Fetch full facility details by ID.
 */
export async function fetchFacilityById(facilityId: number): Promise<ParkingFacilityDetail> {
  const res = await fetch(`${API_BASE}/parking/facilities/${facilityId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch facility #${facilityId}: ${res.statusText}`);
  return res.json();
}

/**
 * Fetch dedicated entrances and exits for a facility.
 */
export async function fetchFacilityEntrances(facilityId: number): Promise<{
  facility_id: number;
  facility_name: string;
  facility_coordinates: { latitude: number; longitude: number };
  entrances: FacilityEntrance[];
  exits: FacilityExit[];
}> {
  const res = await fetch(`${API_BASE}/parking/facilities/${facilityId}/entrances`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch entrances for #${facilityId}: ${res.statusText}`);
  return res.json();
}

/**
 * Calculate turn-by-turn outdoor route from driver coordinates to facility entrance.
 */
export async function fetchFacilityRoute(params: {
  facilityId: number;
  originLat: number;
  originLng: number;
  entranceId?: number;
}): Promise<OutdoorRouteResponse> {
  const query = new URLSearchParams({
    origin_lat: params.originLat.toString(),
    origin_lng: params.originLng.toString(),
  });
  if (params.entranceId) query.set("entrance_id", params.entranceId.toString());

  const res = await fetch(`${API_BASE}/parking/facilities/${params.facilityId}/route?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to calculate route: ${res.statusText}`);
  return res.json();
}

/**
 * Fetch spatial facility clusters for current map zoom level.
 */
export async function fetchFacilityClusters(params?: {
  zoom?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}): Promise<FacilityClusterListResponse> {
  const query = new URLSearchParams();
  if (params?.zoom) query.set("zoom", params.zoom.toString());
  if (params?.latitude !== undefined) query.set("latitude", params.latitude.toString());
  if (params?.longitude !== undefined) query.set("longitude", params.longitude.toString());
  if (params?.radiusKm) query.set("radius_km", params.radiusKm.toString());

  const res = await fetch(`${API_BASE}/parking/facilities/clusters?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch clusters: ${res.statusText}`);
  return res.json();
}

/**
 * Directly book a parking space from the map with immediate slot and entrance assignment.
 */
export async function bookFacilityDirect(
  facilityId: number,
  payload: DirectFacilityBookingRequest
): Promise<DirectFacilityBookingResponse> {
  const res = await fetch(`${API_BASE}/parking/facilities/${facilityId}/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Booking failed (${res.status})`);
  }
  return res.json();
}

/**
 * Fetch real-time breakdown of slot availability by vehicle type.
 */
export async function fetchFacilityAvailability(
  facilityId: number
): Promise<FacilityAvailabilityBreakdown> {
  const res = await fetch(`${API_BASE}/parking/facilities/${facilityId}/availability`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch availability: ${res.statusText}`);
  return res.json();
}

/**
 * Search places and landmarks autocomplete.
 */
export async function searchPlaces(queryText: string): Promise<PlaceSearchResult[]> {
  if (!queryText.trim()) return [];
  const query = new URLSearchParams({ query: queryText.trim(), limit: "8" });
  const res = await fetch(`${API_BASE}/parking/places/search?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

/**
 * Reverse geocode coordinates to approximate address.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<{
  formatted_address: string;
  locality: string;
  city: string;
  state: string;
  country: string;
  distance_to_landmark_km: number;
}> {
  const query = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
  });
  const res = await fetch(`${API_BASE}/parking/places/reverse-geocode?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Reverse geocode failed");
  return res.json();
}
