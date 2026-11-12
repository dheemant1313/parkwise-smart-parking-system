/**
 * Phase 14: Complete Indoor Parking Navigation API Client.
 * Connects frontend driver console and operator map editor to backend endpoints (/api/v1/indoor/*).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// -----------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------

export interface MapNodeItem {
  id: number;
  facility_id: number;
  floor_id?: number | null;
  floor_level: number;
  floor_name: string;
  zone_code?: string | null;
  node_code: string;
  label?: string | null;
  node_type:
    | "ENTRY_GATE"
    | "EXIT_GATE"
    | "RAMP_UP"
    | "RAMP_DOWN"
    | "INTERSECTION"
    | "LANE_WAYPOINT"
    | "SLOT_ENTRY"
    | "ELEVATOR"
    | "STAIRS"
    | "CHECKPOINT"
    | string;
  x_coord: number;
  y_coord: number;
  z_coord: number;
  slot_id?: number | null;
  slot_number?: string | null;
  is_accessible: boolean;
  is_active: boolean;
  created_at: string;
}

export interface MapEdgeItem {
  id: number;
  facility_id: number;
  from_node_id: number;
  to_node_id: number;
  edge_type: "LANE_SEGMENT" | "RAMP" | "TRANSITION" | "PEDESTRIAN_WALKWAY" | string;
  lane_code?: string | null;
  length_meters: number;
  speed_limit_kmh: number;
  is_one_way: boolean;
  is_blocked: boolean;
  block_reason?: string | null;
  is_restricted: boolean;
  restriction_notes?: string | null;
  max_height_meters: number;
  max_weight_tons: number;
  is_pedestrian_accessible: boolean;
  polyline_coords: number[][];
  is_active: boolean;
  created_at: string;
}

export interface SlotLocationItem {
  slot_id: number;
  slot_number: string;
  floor_level: number;
  floor_name: string;
  zone_code: string;
  slot_type: string;
  status: string;
  x_coord: number;
  y_coord: number;
  width_m: number;
  length_m: number;
  heading_deg: number;
  has_ev: boolean;
  is_accessible: boolean;
}

export interface ZoneSummaryItem {
  zone_code: string;
  zone_name: string;
  floor_level: number;
  color_hex: string;
  total_slots: number;
  available_slots: number;
  polygon_points: number[][];
}

export interface IndoorCheckpointItem {
  id: number;
  facility_id: number;
  node_id: number;
  checkpoint_code: string;
  checkpoint_type: string;
  qr_token_payload: string;
  floor_level: number;
  floor_name: string;
  zone_code?: string | null;
  label: string;
  instruction_hint?: string | null;
  scan_count: number;
  is_active: boolean;
  created_at: string;
}

export interface PositioningDeviceItem {
  id: number;
  facility_id: number;
  node_id?: number | null;
  device_type: "BLE_BEACON" | "UWB_ANCHOR" | "WIFI_AP" | string;
  hardware_id: string;
  label: string;
  floor_level: number;
  x_coord: number;
  y_coord: number;
  z_coord: number;
  accuracy_radius_meters: number;
  battery_percentage: number;
  status: string;
  is_active: boolean;
  last_heartbeat_at: string;
  created_at: string;
}

export interface FloorMapLayerItem {
  floor_level: number;
  floor_name: string;
  clearance_height_m: number;
  total_slots: number;
  available_slots: number;
  zones: ZoneSummaryItem[];
  nodes: MapNodeItem[];
  edges: MapEdgeItem[];
  slots: SlotLocationItem[];
  checkpoints: IndoorCheckpointItem[];
  devices: PositioningDeviceItem[];
}

export interface FacilityFloorMapResponse {
  facility_id: number;
  facility_name: string;
  facility_code: string;
  current_map_version: string;
  floors: FloorMapLayerItem[];
  total_nodes: number;
  total_edges: number;
  total_slots: number;
  generated_at: string;
}

export interface TurnByTurnStepItem {
  step_number: number;
  maneuver:
    | "DEPART"
    | "STRAIGHT"
    | "TURN_LEFT"
    | "TURN_RIGHT"
    | "SLIGHT_LEFT"
    | "SLIGHT_RIGHT"
    | "RAMP_DOWN"
    | "RAMP_UP"
    | "ENTER_ZONE"
    | "ARRIVE_SLOT"
    | "PARK_VEHICLE"
    | string;
  instruction: string;
  floor_level: number;
  floor_name: string;
  distance_meters: number;
  cumulative_distance_meters: number;
  zone_code?: string | null;
  target_node_id: number;
  icon_type: string;
  waypoint: number[]; // [x, y]
}

export interface FloorSegmentItem {
  floor_level: number;
  floor_name: string;
  distance_meters: number;
  polyline_points: number[][];
  transition_to_floor?: number | null;
  transition_type?: string | null;
}

export interface IndoorRouteResponse {
  route_code: string;
  facility_id: number;
  facility_name: string;
  booking_id?: number | null;
  assigned_slot_id?: number | null;
  assigned_slot_number: string;
  destination_zone_code: string;
  route_type: string;
  start_floor_level: number;
  end_floor_level: number;
  total_distance_meters: number;
  estimated_duration_seconds: number;
  node_path_ids: number[];
  edge_path_ids: number[];
  floor_segments: FloorSegmentItem[];
  turn_by_turn_steps: TurnByTurnStepItem[];
  is_recalculated: boolean;
  recalculation_reason?: string | null;
  arrival_status: "NOT_STARTED" | "IN_TRANSIT" | "ARRIVED" | "CANCELLED" | string;
  generated_at: string;
}

export interface IndoorPositionEstimateResponse {
  facility_id: number;
  floor_level: number;
  floor_name: string;
  estimated_x: number;
  estimated_y: number;
  estimated_z: number;
  nearest_node_id: number;
  nearest_node_code: string;
  zone_code?: string | null;
  confidence_score: number;
  accuracy_radius_meters: number;
  source_type: string;
  timestamp: string;
  is_exact_gps_disclaimer: string;
}

export interface ArrivalConfirmResponse {
  success: boolean;
  route_code: string;
  assigned_slot_number: string;
  floor_name: string;
  zone_code: string;
  arrival_confirmed: boolean;
  arrival_timestamp: string;
  message: string;
}

export interface FindMyCarResponse {
  booking_id: number;
  facility_id: number;
  facility_name: string;
  assigned_slot_number: string;
  floor_level: number;
  floor_name: string;
  zone_code: string;
  slot_x: number;
  slot_y: number;
  parked_at?: string | null;
  nearest_elevator_code?: string | null;
  nearest_stairs_code?: string | null;
  pedestrian_route?: IndoorRouteResponse | null;
}

export interface MapValidationReport {
  is_valid: boolean;
  connectivity_score: number;
  disconnected_node_codes: string[];
  unreachable_slots: string[];
  zero_length_edges: number[];
  dead_end_lanes: string[];
  warnings: string[];
  errors: string[];
}

// -----------------------------------------------------------------------------
// API Client Functions
// -----------------------------------------------------------------------------

/**
 * Retrieve complete multi-floor map layers for a parking facility.
 */
export async function fetchFacilityIndoorMap(
  facilityId: number
): Promise<FacilityFloorMapResponse> {
  const res = await fetch(`${API_BASE}/indoor/facilities/${facilityId}/map`, {
    headers: getAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch indoor map: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Retrieve exact coordinate, floor, and zone location for a slot.
 */
export async function fetchSlotLocation(
  facilityId: number,
  slotNumber: string
): Promise<{
  facility_id: number;
  slot_number: string;
  floor_level: number;
  floor_name: string;
  zone_code: string;
  x_coord: number;
  y_coord: number;
  z_coord: number;
  node_id: number;
  is_accessible: boolean;
}> {
  const res = await fetch(`${API_BASE}/indoor/facilities/${facilityId}/slots/${slotNumber}`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to find slot location: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Calculate multi-floor indoor route from entrance to assigned slot.
 */
export async function calculateIndoorRoute(params: {
  facility_id: number;
  booking_id?: number;
  origin_node_id?: number;
  destination_slot_number?: string;
  route_type?: string;
}): Promise<IndoorRouteResponse> {
  const res = await fetch(`${API_BASE}/indoor/routes/calculate`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to calculate indoor route: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Dynamically recalculate route when an obstacle, blocked lane, or slot change occurs.
 */
export async function recalculateIndoorRoute(params: {
  route_code: string;
  current_floor_level: number;
  current_x: number;
  current_y: number;
  blocked_edge_id?: number;
  reassigned_slot_number?: string;
  reason?: string;
}): Promise<IndoorRouteResponse> {
  const res = await fetch(`${API_BASE}/indoor/routes/recalculate`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to recalculate route: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Confirm vehicle arrival at assigned slot using position evidence.
 */
export async function confirmSlotArrival(params: {
  route_code: string;
  final_x: number;
  final_y: number;
  final_floor_level: number;
  checkpoint_qr_token?: string;
}): Promise<ArrivalConfirmResponse> {
  const res = await fetch(`${API_BASE}/indoor/routes/arrival`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to confirm arrival: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Scan physical QR checkpoint and calibrate driver position.
 */
export async function verifyQrCheckpoint(params: {
  facility_id: number;
  qr_token_payload: string;
  booking_id?: number;
}): Promise<{
  success: boolean;
  checkpoint_code: string;
  node_id: number;
  floor_level: number;
  floor_name: string;
  zone_code: string;
  label: string;
  x_coord: number;
  y_coord: number;
  message: string;
  verified_at: string;
}> {
  const res = await fetch(`${API_BASE}/indoor/checkpoints/verify`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Invalid checkpoint: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Transmit continuous indoor position telemetry (BLE RSSI, UWB, sensors).
 */
export async function updateIndoorPositionTelemetry(params: {
  facility_id: number;
  booking_id?: number;
  source_type?: string;
  checkpoint_token?: string;
  device_hardware_id?: string;
  raw_rssi?: number;
  reported_floor_level?: number;
  reported_x?: number;
  reported_y?: number;
}): Promise<IndoorPositionEstimateResponse> {
  const res = await fetch(`${API_BASE}/indoor/position/update`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update position: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Find My Car: Retrieve parked vehicle slot and pedestrian return path.
 */
export async function fetchFindMyCarRoute(bookingId: number): Promise<FindMyCarResponse> {
  const res = await fetch(`${API_BASE}/indoor/find-my-car/${bookingId}`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch find my car route: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Operator Map Editor: Toggle driving lane blocked / open state.
 */
export async function toggleLaneBlocked(
  facilityId: number,
  edgeId: number,
  reason?: string
): Promise<MapEdgeItem> {
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  const res = await fetch(
    `${API_BASE}/indoor/facilities/${facilityId}/edges/${edgeId}/toggle-block${query}`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "include",
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to toggle lane state: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Operator Map Editor: Validate graph connectivity and publish new version.
 */
export async function validateAndPublishMap(
  facilityId: number,
  versionCode: string = "v1.4.0",
  notes?: string
): Promise<MapValidationReport> {
  const res = await fetch(`${API_BASE}/indoor/facilities/${facilityId}/publish`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ facility_id: facilityId, version_code: versionCode, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to publish map: ${res.statusText}`);
  }
  return res.json();
}
