/**
 * Phase 15: Live Parking Occupancy & Smart Sensor Integration API Client.
 * Connects to /api/v1/occupancy endpoints and provides WebSocket streaming.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type OccupancyState = "VACANT" | "OCCUPIED" | "RESERVED" | "BLOCKED" | "UNKNOWN";
export type DeviceHealth = "ONLINE" | "OFFLINE" | "DEGRADED" | "STALE";
export type DeviceType = "ULTRASONIC" | "MAGNETIC" | "RADAR" | "OPTICAL" | "CAMERA_CV" | "GATEWAY";

export interface LiveSlotOccupancyItem {
  slot_id: number;
  slot_number: string;
  floor: number;
  zone: string;
  slot_type: string;
  state: OccupancyState;
  is_bookable: boolean;
  confidence: number;
  source_type?: string;
  last_device_code?: string;
  sensor_health: DeviceHealth;
  last_updated_at: string;
  has_active_override: boolean;
  active_booking_reference?: string;
}

export interface FacilityLiveOccupancyResponse {
  facility_id: number;
  facility_name: string;
  total_slots: number;
  vacant_slots: number;
  occupied_slots: number;
  reserved_slots: number;
  blocked_slots: number;
  unknown_slots: number;
  occupancy_rate_pct: number;
  sensor_health_summary: Record<string, number>;
  slots: LiveSlotOccupancyItem[];
}

export interface IoTDeviceItem {
  id: number;
  facility_id: number;
  device_code: string;
  device_type: DeviceType;
  ip_address?: string;
  mac_address?: string;
  firmware_version: string;
  battery_level_pct?: number;
  signal_rssi_dbm: number;
  health_status: DeviceHealth;
  last_heartbeat_at: string;
  registered_at: string;
}

export interface CVUncertainReviewItem {
  id: number;
  facility_id: number;
  slot_id: number;
  slot_number: string;
  camera_device_code?: string;
  frame_timestamp: string;
  bounding_box_json: string;
  detected_class: string;
  confidence: number;
  snapshot_url?: string;
  status: "PENDING_REVIEW" | "APPROVED_OCCUPIED" | "APPROVED_VACANT" | "DISMISSED";
  created_at: string;
}

export interface OccupancyEventItem {
  id: number;
  facility_id: number;
  slot_id: number;
  slot_number: string;
  device_id?: number;
  device_code?: string;
  previous_state: OccupancyState;
  new_state: OccupancyState;
  source_type: string;
  confidence: number;
  license_plate?: string;
  distance_m?: number;
  timestamp: string;
}

export async function fetchFacilityLiveOccupancy(facilityId: number = 1): Promise<FacilityLiveOccupancyResponse> {
  const res = await fetch(`${API_BASE}/api/v1/occupancy/facilities/${facilityId}/live`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load facility occupancy: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchIoTDevices(facilityId: number = 1): Promise<IoTDeviceItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/occupancy/devices?facility_id=${facilityId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load IoT devices: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchCVReviewQueue(facilityId: number = 1): Promise<CVUncertainReviewItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/occupancy/cv/review-queue?facility_id=${facilityId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load review queue: ${res.statusText}`);
  }
  return res.json();
}

export async function resolveCVReview(
  reviewId: number,
  decision: "APPROVED_OCCUPIED" | "APPROVED_VACANT" | "DISMISSED",
  operatorNotes?: string
): Promise<CVUncertainReviewItem> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const res = await fetch(`${API_BASE}/api/v1/occupancy/cv/review/${reviewId}/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ decision, operator_notes: operatorNotes }),
  });
  if (!res.ok) {
    throw new Error(`Failed to resolve CV review: ${res.statusText}`);
  }
  return res.json();
}

export async function applyOperatorOverride(
  slotId: number,
  targetState: OccupancyState,
  reason: string,
  durationMinutes: number = 60
) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const res = await fetch(`${API_BASE}/api/v1/occupancy/slots/${slotId}/override`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      target_state: targetState,
      reason,
      duration_minutes: durationMinutes,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to apply operator override: ${res.statusText}`);
  }
  return res.json();
}

export async function clearOperatorOverride(slotId: number) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const res = await fetch(`${API_BASE}/api/v1/occupancy/slots/${slotId}/override`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to clear operator override: ${res.statusText}`);
  }
  return res.json();
}

export async function ingestSensorTelemetry(
  facilityId: number,
  deviceCode: string,
  distanceM?: number,
  isOccupied?: boolean
) {
  const res = await fetch(`${API_BASE}/api/v1/occupancy/telemetry/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      facility_id: facilityId,
      telemetry: [
        {
          device_code: deviceCode,
          distance_m: distanceM,
          is_occupied: isOccupied,
          confidence: 0.98,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to ingest telemetry: ${res.statusText}`);
  }
  return res.json();
}

export async function submitCameraFrameDetection(
  facilityId: number,
  cameraDeviceCode: string,
  detections: Array<{ class_name: string; confidence: number; box_2d: number[] }>
) {
  const res = await fetch(`${API_BASE}/api/v1/occupancy/cv/infer-frame`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      facility_id: facilityId,
      camera_device_code: cameraDeviceCode,
      frame_timestamp: new Date().toISOString(),
      detections,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to infer CV frame: ${res.statusText}`);
  }
  return res.json();
}

export async function simulateDeviceFailure(deviceId: number) {
  const res = await fetch(`${API_BASE}/api/v1/occupancy/devices/${deviceId}/simulate-failure`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to simulate device failure: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerStaleScan(facilityId: number = 1) {
  const res = await fetch(`${API_BASE}/api/v1/occupancy/evaluate-stale?facility_id=${facilityId}&threshold_seconds=120`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to trigger stale evaluation: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchOccupancyEvents(facilityId: number = 1): Promise<OccupancyEventItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/occupancy/events?facility_id=${facilityId}&limit=30`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load occupancy events: ${res.statusText}`);
  }
  return res.json();
}
