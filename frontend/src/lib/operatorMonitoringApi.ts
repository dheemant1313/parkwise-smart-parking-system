/**
 * Phase 12: Live Operator Map & Facility Monitoring API Client.
 * Communicates with backend endpoints (/api/v1/operator/monitoring/*).
 */

export interface FacilityOccupancySummary {
  total_spaces: number;
  available_spaces: number;
  occupied_spaces: number;
  reserved_spaces: number;
  blocked_spaces: number;
  stale_spaces: number;
  occupancy_percentage: number;
  peak_indicator: "LOW" | "NORMAL" | "HIGH" | "CRITICAL_PEAK" | string;
}

export interface OperatorFacilityListItem {
  facility_id: number;
  lot_id: number;
  code: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  city: string;
  latitude: number;
  longitude: number;
  formatted_address: string;
  base_hourly_rate_inr: number;
  is_24_hours: boolean;
  amenities: string[];
  occupancy: FacilityOccupancySummary;
  zones_count: number;
  gates_count: number;
  active_alerts_count: number;
  critical_alerts_count: number;
  last_telemetry_at: string;
}

export interface OperatorGateItem {
  id: number;
  gate_name: string;
  gate_code: string;
  gate_type: "ENTRANCE" | "EXIT" | string;
  latitude: number;
  longitude: number;
  barrier_type: string;
  height_clearance_meters?: number | null;
  status: "OPERATIONAL" | "DEGRADED" | "OFFLINE" | string;
}

export interface OperatorSlotItem {
  id: number;
  slot_number: string;
  floor: number;
  zone: string;
  slot_type: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | string;
  sensor_health: "ONLINE" | "OFFLINE" | string;
  power_kw?: number | null;
}

export interface OperatorZoneDetail {
  zone_id: number;
  floor_id: number;
  floor_name: string;
  zone_code: string;
  zone_name: string;
  dedicated_category: string;
  is_restricted: boolean;
  restriction_reason: string;
  total_bays: number;
  available_bays: number;
  occupied_bays: number;
  reserved_bays: number;
  blocked_bays: number;
  stale_bays: number;
  utilization_pct: number;
  operational_status: "OPTIMAL" | "MODERATE" | "NEAR_CAPACITY" | "RESTRICTED" | string;
  slots: OperatorSlotItem[];
}

export interface OperationalAlertItem {
  id: number;
  facility_id?: number | null;
  lot_id?: number | null;
  zone_code?: string | null;
  severity: "INFO" | "WARNING" | "CRITICAL" | string;
  alert_type: string;
  title: string;
  message: string;
  is_acknowledged: boolean;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  created_at: string;
}

export interface FacilityMonitoringDetailResponse {
  facility_id: number;
  lot_id: number;
  code: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  city: string;
  latitude: number;
  longitude: number;
  formatted_address: string;
  occupancy: FacilityOccupancySummary;
  gates: OperatorGateItem[];
  zones: OperatorZoneDetail[];
  alerts: OperationalAlertItem[];
  booking_volume_today: number;
  active_dwell_count: number;
  estimated_revenue_today_inr: number;
  current_surge_multiplier: number;
  occupancy_velocity_30m: number;
  telemetry_source: string;
  last_updated_at: string;
}

export interface ZoneRestrictionUpdateRequest {
  is_restricted: boolean;
  restriction_reason?: string;
  notes?: string;
}

export interface SlotStatusOverrideRequest {
  status: string;
  reason?: string;
}

export interface AlertAcknowledgeResponse {
  alert_id: number;
  is_acknowledged: boolean;
  acknowledged_by: string;
  acknowledged_at: string;
  message: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-user-role": "OPERATOR",
    "x-user-email": "operator@parkwise.in",
  };

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("parkwise_auth_token") || localStorage.getItem("token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return headers;
}

/**
 * Fetch all facilities authorized for the operator with live occupancy metrics.
 */
export async function fetchMonitoredFacilities(params?: {
  city?: string;
  category?: string;
  facility_status?: string;
}): Promise<OperatorFacilityListItem[]> {
  const query = new URLSearchParams();
  if (params?.city && params.city !== "ALL") query.set("city", params.city);
  if (params?.category && params.category !== "ALL") query.set("category", params.category);
  if (params?.facility_status && params.facility_status !== "ALL") query.set("facility_status", params.facility_status);

  const res = await fetch(`${API_BASE}/operator/monitoring/facilities?${query.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch monitored facilities: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch granular facility detail (zones, slots, gates, analytics, alerts).
 */
export async function fetchFacilityMonitoringDetail(
  facilityId: number
): Promise<FacilityMonitoringDetailResponse> {
  const res = await fetch(`${API_BASE}/operator/monitoring/facilities/${facilityId}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch facility monitoring detail: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Toggle operational restriction on a parking zone.
 */
export async function updateZoneRestriction(
  facilityId: number,
  zoneCode: string,
  payload: ZoneRestrictionUpdateRequest
): Promise<{ success: boolean; zone_code: string; is_restricted: boolean; restriction_reason: string }> {
  const res = await fetch(
    `${API_BASE}/operator/monitoring/facilities/${facilityId}/zones/${zoneCode}/restriction`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to update zone restriction: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Manually override a slot status directly from the operator live map.
 */
export async function overrideSlotStatus(
  facilityId: number,
  slotId: number,
  payload: SlotStatusOverrideRequest
): Promise<{ success: boolean; slot_id: number; new_status: string; reason?: string }> {
  const res = await fetch(
    `${API_BASE}/operator/monitoring/facilities/${facilityId}/slots/${slotId}/override`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to override slot status: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch active or historic operational alerts.
 */
export async function fetchOperationalAlerts(params?: {
  facility_id?: number;
  severity?: string;
  is_acknowledged?: boolean;
}): Promise<OperationalAlertItem[]> {
  const query = new URLSearchParams();
  if (params?.facility_id) query.set("facility_id", params.facility_id.toString());
  if (params?.severity && params.severity !== "ALL") query.set("severity", params.severity);
  if (params?.is_acknowledged !== undefined) query.set("is_acknowledged", params.is_acknowledged.toString());

  const res = await fetch(`${API_BASE}/operator/monitoring/alerts?${query.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch operational alerts: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Acknowledge an operational alert.
 */
export async function acknowledgeOperationalAlert(
  alertId: number
): Promise<AlertAcknowledgeResponse> {
  const res = await fetch(`${API_BASE}/operator/monitoring/alerts/${alertId}/acknowledge`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to acknowledge alert: ${res.statusText}`);
  }
  return res.json();
}
