/**
 * Phase 16: Typed API Client for ANPR, Automated Gate Controllers & Offline Operations.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export type LaneDirection = "ENTRY" | "EXIT" | "BIDIRECTIONAL";
export type BarrierState = "CLOSED" | "OPEN" | "HOLD_OPEN" | "FAULT";
export type GateHardwareHealth = "ONLINE" | "OFFLINE" | "DEGRADED";
export type AccessDecision =
  | "AUTHORIZED"
  | "MANUAL_REVIEW"
  | "REJECTED_NO_BOOKING"
  | "REJECTED_ALREADY_ENTERED"
  | "REJECTED_NOT_CHECKED_IN"
  | "REJECTED_EXPIRED"
  | "REJECTED_FUTURE"
  | "REJECTED_CANCELLED"
  | "QR_FALLBACK_AUTHORIZED"
  | "OFFLINE_AUTHORIZED"
  | "MANUAL_OVERRIDE_AUTHORIZED";

export type VerificationMethod = "ANPR" | "QR_CODE" | "MANUAL_OVERRIDE" | "OFFLINE_LOCAL_CRYPTO";
export type GateReviewStatus = "PENDING" | "APPROVED_AS_IS" | "CORRECTED_AND_APPROVED" | "REJECTED";

export interface ANPRScanRequest {
  facility_id: number;
  camera_code: string;
  lane_code?: string;
  captured_plate_raw: string;
  confidence_score: number;
  direction: LaneDirection;
  plate_crop_image_url?: string;
  full_frame_image_url?: string;
  event_uuid?: string;
}

export interface ANPRScanResponse {
  event_uuid: string;
  facility_id: number;
  lane_code: string;
  direction: LaneDirection;
  raw_plate: string;
  normalized_plate: string;
  masked_plate: string;
  confidence_score: number;
  decision: AccessDecision;
  decision_reason: string;
  verification_method: VerificationMethod;
  barrier_action: string;
  matched_booking_reference?: string;
  assigned_slot_number?: string;
  driver_name?: string;
  vehicle_model?: string;
  requires_human_review: boolean;
  review_task_id?: number;
  overstay_minutes: number;
  overstay_fee_inr: number;
  timestamp: string;
}

export interface GateQRVerifyRequest {
  facility_id: number;
  lane_code: string;
  qr_payload: string;
  direction?: LaneDirection;
  vehicle_plate?: string;
}

export interface GateLaneItem {
  id: number;
  facility_id: number;
  lane_code: string;
  lane_name: string;
  direction: LaneDirection;
  ip_address: string;
  mqtt_topic: string;
  controller_model: string;
  barrier_state: BarrierState;
  hardware_health: GateHardwareHealth;
  last_heartbeat_at?: string;
  auto_open_enabled: boolean;
  anti_passback_enabled: boolean;
  early_entry_grace_minutes: number;
  exit_grace_minutes: number;
  created_at: string;
}

export interface GateBarrierControlResponse {
  lane_id: number;
  lane_code: string;
  previous_state: BarrierState;
  new_state: BarrierState;
  execution_status: string;
  timestamp: string;
}

export interface GateManualOverrideRequest {
  facility_id: number;
  lane_code: string;
  action: string;
  vehicle_number: string;
  booking_reference?: string;
  reason: string;
}

export interface GateManualOverrideResponse {
  event_uuid: string;
  lane_code: string;
  action: string;
  vehicle_number_masked: string;
  barrier_action: string;
  staff_email: string;
  reason: string;
  timestamp: string;
}

export interface ANPRReviewItem {
  id: number;
  event_id: number;
  facility_id: number;
  lane_code: string;
  captured_plate_raw: string;
  suggested_candidates: string[];
  confidence_score: number;
  crop_image_url?: string;
  status: GateReviewStatus;
  created_at: string;
}

export interface OfflineTokenItem {
  booking_reference: string;
  vehicle_number_normalized: string;
  valid_from_iso: string;
  valid_to_iso: string;
  facility_id: number;
  slot_number: string;
  vehicle_type: string;
  hmac_signature: string;
}

export interface OfflineManifestResponse {
  manifest_id: string;
  facility_id: number;
  facility_name: string;
  generated_at: string;
  window_start: string;
  window_end: string;
  total_tokens: number;
  tokens: OfflineTokenItem[];
}

export interface LocalOfflineVerifyResponse {
  is_valid: boolean;
  decision: AccessDecision;
  barrier_action: string;
  decision_reason: string;
  generated_offline_event_uuid: string;
}

export interface OfflineEventSyncItem {
  client_event_uuid: string;
  facility_id: number;
  lane_code: string;
  direction: LaneDirection;
  vehicle_number: string;
  booking_reference: string;
  verification_method: VerificationMethod;
  offline_client_timestamp: string;
  hmac_signature: string;
  barrier_action?: string;
}

export interface OfflineBatchSyncResponse {
  facility_id: number;
  total_received: number;
  successfully_synced: number;
  duplicates_skipped: number;
  errors_count: number;
  sync_summary: any[];
  synced_at: string;
}

export interface GateEventItem {
  id: number;
  event_uuid: string;
  facility_id: number;
  lane_code: string;
  direction: LaneDirection;
  masked_plate: string;
  confidence_score: number;
  decision: AccessDecision;
  decision_reason: string;
  verification_method: VerificationMethod;
  barrier_action: string;
  matched_booking_reference?: string;
  human_reviewed: boolean;
  sync_source: string;
  timestamp: string;
}

export interface GateAnalyticsSummaryResponse {
  facility_id: number;
  total_scans_today: number;
  anpr_auto_authorized_count: number;
  manual_reviews_required_count: number;
  qr_fallback_count: number;
  offline_sync_count: number;
  rejections_count: number;
  average_anpr_confidence: number;
  auto_authorization_rate_pct: number;
  active_lanes_count: number;
  pending_manual_reviews_count: number;
}

// -------------------------------------------------------------
// API Request Methods
// -------------------------------------------------------------

export async function submitANPRScan(payload: ANPRScanRequest): Promise<ANPRScanResponse> {
  const res = await fetch(`${API_BASE}/gate/anpr/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `ANPR Scan failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function verifyQRFallback(payload: GateQRVerifyRequest): Promise<ANPRScanResponse> {
  const res = await fetch(`${API_BASE}/gate/qr/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `QR Verify failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchGateLanes(facilityId: number = 1): Promise<GateLaneItem[]> {
  const res = await fetch(`${API_BASE}/gate/lanes?facility_id=${facilityId}`);
  if (!res.ok) {
    throw new Error(`Failed to load gate lanes: HTTP ${res.status}`);
  }
  return res.json();
}

export async function commandBarrier(
  laneId: number,
  command: BarrierState,
  reason?: string
): Promise<GateBarrierControlResponse> {
  const res = await fetch(`${API_BASE}/gate/lanes/${laneId}/barrier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, reason: reason || "Operator manual command" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Barrier command failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function executeManualOverride(
  payload: GateManualOverrideRequest
): Promise<GateManualOverrideResponse> {
  const res = await fetch(`${API_BASE}/gate/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Manual override failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchPendingReviews(facilityId: number = 1): Promise<ANPRReviewItem[]> {
  const res = await fetch(`${API_BASE}/gate/reviews?facility_id=${facilityId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch pending reviews: HTTP ${res.status}`);
  }
  return res.json();
}

export async function resolveReview(
  reviewId: number,
  decision: GateReviewStatus,
  correctedPlate?: string,
  notes?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/gate/reviews/${reviewId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      decision,
      corrected_plate: correctedPlate,
      notes: notes || "Staff inspected live CCTV crop",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Review resolution failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function downloadOfflineManifest(
  facilityId: number = 1,
  windowHours: number = 24
): Promise<OfflineManifestResponse> {
  const res = await fetch(
    `${API_BASE}/gate/offline/manifest?facility_id=${facilityId}&window_hours=${windowHours}`
  );
  if (!res.ok) {
    throw new Error(`Failed to download offline manifest: HTTP ${res.status}`);
  }
  return res.json();
}

export async function verifyLocalOffline(
  facilityId: number,
  vehicleNumber: string,
  offlineToken: OfflineTokenItem,
  direction: LaneDirection = "ENTRY"
): Promise<LocalOfflineVerifyResponse> {
  const res = await fetch(`${API_BASE}/gate/offline/verify-local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      facility_id: facilityId,
      vehicle_number: vehicleNumber,
      offline_token: offlineToken,
      direction,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Local offline verification failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function syncOfflineBatch(
  facilityId: number,
  events: OfflineEventSyncItem[]
): Promise<OfflineBatchSyncResponse> {
  const res = await fetch(`${API_BASE}/gate/offline/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ facility_id: facilityId, events }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Offline sync failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchGateEvents(
  facilityId: number = 1,
  limit: number = 50
): Promise<GateEventItem[]> {
  const res = await fetch(`${API_BASE}/gate/events?facility_id=${facilityId}&limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to load gate events: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.events || [];
}

export async function fetchGateStats(facilityId: number = 1): Promise<GateAnalyticsSummaryResponse> {
  const res = await fetch(`${API_BASE}/gate/stats?facility_id=${facilityId}`);
  if (!res.ok) {
    throw new Error(`Failed to load gate analytics: HTTP ${res.status}`);
  }
  return res.json();
}
