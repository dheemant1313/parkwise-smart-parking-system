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
}): Promise<NearbyFacilityItem[]> {
  const query = new URLSearchParams({
    latitude: params.latitude.toString(),
    longitude: params.longitude.toString(),
    radius_km: (params.radius_km || 10.0).toString(),
  });

  if (params.vehicle_type) query.set("vehicle_type", params.vehicle_type);
  if (params.max_price !== undefined) query.set("max_price", params.max_price.toString());
  if (params.available_only) query.set("available_only", "true");
  if (params.category) query.set("category", params.category);
  if (params.limit) query.set("limit", params.limit.toString());

  const res = await fetch(`${API_BASE}/parking/facilities/nearby?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch nearby facilities: ${res.statusText}`);
  return res.json();
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
