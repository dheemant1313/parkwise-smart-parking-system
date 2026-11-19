/**
 * Phase 21: Production Launch, Security, Reliability & Quality Assurance API Client
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface LaunchCriterionItem {
  criterion_number: number;
  name: string;
  category: string;
  status: "VERIFIED" | "IN_PROGRESS" | "FAILED";
  description: string;
  evidence: string;
  verification_timestamp: string;
}

export interface LaunchScorecardResponse {
  overall_status: string;
  score_percentage: number;
  certified_for_production: boolean;
  total_criteria_count: number;
  verified_criteria_count: number;
  criteria: LaunchCriterionItem[];
  deployment_target: string;
  platform_version: string;
}

export interface GateControllerTelemetry {
  facility_id: number;
  facility_name: string;
  controller_type: string;
  barrier_status: string;
  heartbeat_latency_ms: number;
  anpr_stream_fps: number;
  offline_cache_entries: number;
  last_sync_timestamp: string;
}

export interface SystemTelemetryResponse {
  environment: string;
  service_uptime_seconds: number;
  database_engine: string;
  database_pool_status: string;
  concurrency_lock_engine: string;
  p95_latency_ms: number;
  anpr_stream_health: string;
  gate_controllers: GateControllerTelemetry[];
  latest_backup_timestamp?: string;
  latest_backup_checksum?: string;
  dpdp_compliance_status: string;
  active_facilities_count: number;
}

export interface ConcurrencyVerificationResponse {
  slot_id: number;
  slot_number: string;
  concurrent_requests: number;
  successful_bookings: number;
  conflicts_detected: number;
  double_booking_prevented: boolean;
  execution_time_ms: number;
  lock_mechanism: string;
  audit_summary: string;
}

export interface MapValidationCheckItem {
  name: string;
  passed: boolean;
  details: string;
}

export interface IndoorMapValidationResponse {
  facility_id: number;
  facility_name: string;
  total_floors: number;
  total_slots: number;
  total_lanes: number;
  is_valid: boolean;
  checks: MapValidationCheckItem[];
  warnings: string[];
}

export interface PrivacyErasureResponse {
  status: string;
  user_id: number;
  masked_email: string;
  masked_phone: string;
  anonymized_vehicles_count: number;
  purged_location_pins: number;
  compliance_standard: string;
  processed_at: string;
  receipt_reference: string;
}

export interface AuditLogItem {
  id: number;
  actor_email: string;
  actor_role: string;
  action: string;
  target_resource?: string;
  details: string;
  ip_address?: string;
  created_at: string;
}

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchLaunchScorecard(): Promise<LaunchScorecardResponse> {
  const res = await fetch(`${API_BASE}/api/v1/launch/scorecard`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load launch scorecard");
  return res.json();
}

export async function fetchSystemTelemetry(): Promise<SystemTelemetryResponse> {
  const res = await fetch(`${API_BASE}/api/v1/launch/telemetry`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load system telemetry");
  return res.json();
}

export async function triggerConcurrencyVerification(slotId?: number): Promise<ConcurrencyVerificationResponse> {
  const res = await fetch(`${API_BASE}/api/v1/launch/verify-concurrency`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(slotId ? { slot_id: slotId } : {}),
  });
  if (!res.ok) throw new Error("Failed to execute concurrency verification");
  return res.json();
}

export async function validateFacilityIndoorMap(facilityId: number): Promise<IndoorMapValidationResponse> {
  const res = await fetch(`${API_BASE}/api/v1/launch/validate-indoor-map/${facilityId}`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to validate indoor garage map");
  return res.json();
}

export async function fetchProductionAuditLogs(limit: number = 25): Promise<AuditLogItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/launch/audit-logs?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch production audit logs");
  return res.json();
}
