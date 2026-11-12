/**
 * Phase 13: AI Location Intelligence & Demand Heatmaps API Client.
 * Communicates with backend endpoints (/api/v1/intelligence/*).
 */

export interface HeatmapPointItem {
  latitude: number;
  longitude: number;
  weight: number;
  booking_count: number;
  facility_name: string;
  facility_id?: number | null;
  area_name: string;
  intensity_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | string;
  data_type: "HISTORICAL" | "CURRENT" | "PREDICTED" | string;
}

export interface HeatmapDensityResponse {
  city: string;
  time_window: string;
  data_type: string;
  total_observations: number;
  points: HeatmapPointItem[];
  generated_at: string;
  disclaimer: string;
}

export interface HourlyOccupancyCell {
  day_of_week: number;
  day_name: string;
  hour: number;
  occupancy_pct: number;
  sample_count: number;
  is_peak: boolean;
}

export interface OccupancyMatrixResponse {
  facility_id?: number | null;
  facility_name: string;
  city: string;
  matrix: HourlyOccupancyCell[];
  busiest_day: string;
  peak_hour: number;
  peak_occupancy_pct: number;
  lowest_hour: number;
  lowest_occupancy_pct: number;
  generated_at: string;
}

export interface FacilityDemandComparisonItem {
  facility_id: number;
  code: string;
  name: string;
  city: string;
  category: string;
  avg_occupancy_pct: number;
  peak_hour: number;
  peak_occupancy_pct: number;
  turnover_rate_daily: number;
  revenue_per_bay_inr: number;
  weekend_variance_pct: number;
  demand_rating: "OPTIMAL" | "MODERATE" | "HIGH_SURGE" | "CRITICAL" | string;
}

export interface ForecastAccuracyMetrics {
  mae: number;
  rmse: number;
  mape: number;
  r2_score: number;
  confidence_score_pct: number;
}

export interface ForecastHourlyPoint {
  target_hour_utc: string;
  target_hour_ist_label: string;
  predicted_occupancy_pct: number;
  ci90_lower_pct: number;
  ci90_upper_pct: number;
  baseline_occupancy_pct: number;
  event_surge_pct: number;
  is_peak: boolean;
}

export interface DemandForecastResponse {
  facility_id: number;
  facility_name: string;
  city: string;
  horizon_hours: number;
  model_version: string;
  metrics: ForecastAccuracyMetrics;
  hourly_points: ForecastHourlyPoint[];
  event_impact_summary: string;
  data_freshness_timestamp: string;
  disclaimer: string;
}

export interface IntelligentRecommendationRequest {
  driver_latitude: number;
  driver_longitude: number;
  vehicle_type?: string;
  needs_ev_charging?: boolean;
  needs_accessible?: boolean;
  needs_covered?: boolean;
  max_walking_time_mins?: number;
  budget_tier?: string;
  search_radius_km?: number;
}

export interface RecommendedFacilityItem {
  facility_id: number;
  name: string;
  code: string;
  slug: string;
  city: string;
  category: string;
  latitude: number;
  longitude: number;
  formatted_address: string;
  distance_km: number;
  estimated_driving_time_mins: number;
  available_bays: number;
  total_capacity: number;
  base_hourly_rate_inr: number;
  estimated_total_cost_inr: number;
  ev_charging_available: number;
  match_score: number;
  match_tier: "PRIMARY_MATCH" | "STRONG_ALTERNATIVE" | "BUDGET_PICK" | string;
  score_breakdown: Record<string, number>;
  explanations: string[];
}

export interface IntelligentRecommendationResponse {
  recommendations: RecommendedFacilityItem[];
  driver_coordinates: { latitude: number; longitude: number };
  evaluated_facilities_count: number;
  generated_at: string;
}

export interface DynamicPricingProposalItem {
  id: number;
  proposal_code: string;
  facility_id: number;
  facility_name: string;
  city: string;
  current_hourly_rate_inr: number;
  recommended_hourly_rate_inr: number;
  current_multiplier: number;
  recommended_multiplier: number;
  predicted_occupancy_pct: number;
  confidence_score_pct: number;
  demand_tier: string;
  valid_from: string;
  valid_to: string;
  reasoning: string;
  min_rate_cap_inr: number;
  max_multiplier_cap: number;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXPIRED" | string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  decision_notes?: string | null;
  created_at: string;
}

export interface PricingProposalReviewResponse {
  proposal_id: number;
  status: string;
  applied_multiplier?: number | null;
  applied_rate_inr?: number | null;
  message: string;
  reviewed_by: string;
  reviewed_at: string;
}

export interface ManagedEventItem {
  id: number;
  name: string;
  event_type: string;
  venue_name: string;
  city: string;
  latitude: number;
  longitude: number;
  radius_impact_km: number;
  start_time: string;
  end_time: string;
  expected_attendance: number;
  demand_surge_factor: number;
  occupancy_pressure_level: string;
  recommended_action?: string | null;
  is_active: boolean;
  impacted_facilities_count: number;
  impacted_facility_names: string[];
}

export interface SupportingMetricItem {
  name: string;
  value: any;
  unit: string;
  source_table: string;
  computation_rule: string;
}

export interface LocationAssistantResponse {
  question: string;
  answer: string;
  intents: string[];
  supporting_metrics: SupportingMetricItem[];
  facilities_analyzed: string[];
  reporting_period: string;
  provenance: string;
  refused: boolean;
  refusal_reason?: string | null;
  generated_at: string;
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
 * Fetch spatial booking density heat points.
 */
export async function fetchDensityHeatmap(params?: {
  city?: string;
  category?: string;
  data_type?: string;
  time_window?: string;
}): Promise<HeatmapDensityResponse> {
  const query = new URLSearchParams();
  if (params?.city && params.city !== "ALL") query.set("city", params.city);
  if (params?.category && params.category !== "ALL") query.set("category", params.category);
  if (params?.data_type) query.set("data_type", params.data_type);
  if (params?.time_window) query.set("time_window", params.time_window);

  const res = await fetch(`${API_BASE}/intelligence/heatmaps/density?${query.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch demand heatmap: ${res.statusText}`);
  return res.json();
}

/**
 * Fetch 7-day x 24-hour occupancy distribution matrix.
 */
export async function fetchOccupancyMatrix(params?: {
  facility_id?: number;
  city?: string;
}): Promise<OccupancyMatrixResponse> {
  const query = new URLSearchParams();
  if (params?.facility_id) query.set("facility_id", params.facility_id.toString());
  if (params?.city && params.city !== "ALL") query.set("city", params.city);

  const res = await fetch(`${API_BASE}/intelligence/heatmaps/occupancy-matrix?${query.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch occupancy matrix: ${res.statusText}`);
  return res.json();
}

/**
 * Fetch side-by-side facility demand benchmarks.
 */
export async function fetchFacilityComparison(city?: string): Promise<FacilityDemandComparisonItem[]> {
  const query = new URLSearchParams();
  if (city && city !== "ALL") query.set("city", city);

  const res = await fetch(`${API_BASE}/intelligence/heatmaps/facility-comparison?${query.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch facility comparisons: ${res.statusText}`);
  return res.json();
}

/**
 * Fetch multi-step AI demand forecast for a facility.
 */
export async function fetchFacilityDemandForecast(
  facilityId: number,
  horizonHours: number = 24
): Promise<DemandForecastResponse> {
  const res = await fetch(`${API_BASE}/intelligence/forecast/${facilityId}?horizon_hours=${horizonHours}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch facility forecast: ${res.statusText}`);
  return res.json();
}

/**
 * Request intelligent personalized parking recommendations for drivers.
 */
export async function fetchIntelligentRecommendations(
  req: IntelligentRecommendationRequest
): Promise<IntelligentRecommendationResponse> {
  const res = await fetch(`${API_BASE}/intelligence/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Failed to fetch intelligent recommendations: ${res.statusText}`);
  return res.json();
}

/**
 * List dynamic pricing proposals awaiting review.
 */
export async function fetchPricingProposals(params?: {
  facility_id?: number;
  status_filter?: string;
}): Promise<DynamicPricingProposalItem[]> {
  const query = new URLSearchParams();
  if (params?.facility_id) query.set("facility_id", params.facility_id.toString());
  if (params?.status_filter && params.status_filter !== "ALL") query.set("status_filter", params.status_filter);

  const res = await fetch(`${API_BASE}/intelligence/pricing-proposals?${query.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch pricing proposals: ${res.statusText}`);
  return res.json();
}

/**
 * Review (APPROVE or REJECT) a dynamic pricing proposal.
 */
export async function reviewPricingProposal(
  proposalId: number,
  action: "APPROVED" | "REJECTED",
  decisionNotes?: string
): Promise<PricingProposalReviewResponse> {
  const res = await fetch(`${API_BASE}/intelligence/pricing-proposals/${proposalId}/review`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ action, decision_notes: decisionNotes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to review pricing proposal: ${res.statusText}`);
  }
  return res.json();
}

/**
 * List scheduled metro events impacting parking demand.
 */
export async function fetchManagedEvents(params?: {
  city?: string;
  is_active?: boolean;
}): Promise<ManagedEventItem[]> {
  const query = new URLSearchParams();
  if (params?.city && params.city !== "ALL") query.set("city", params.city);
  if (params?.is_active !== undefined) query.set("is_active", params.is_active.toString());

  const res = await fetch(`${API_BASE}/intelligence/events?${query.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch managed events: ${res.statusText}`);
  return res.json();
}

/**
 * Register a new high-demand event.
 */
export async function createManagedEvent(payload: {
  name: string;
  event_type: string;
  venue_name: string;
  city: string;
  latitude: number;
  longitude: number;
  radius_impact_km?: number;
  start_time: string;
  end_time: string;
  expected_attendance?: number;
  demand_surge_factor?: number;
  recommended_action?: string;
}): Promise<ManagedEventItem> {
  const res = await fetch(`${API_BASE}/intelligence/events`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create event: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Query the AI Operator Location Assistant.
 */
export async function askLocationAssistant(
  question: string,
  facilityId?: number
): Promise<LocationAssistantResponse> {
  const res = await fetch(`${API_BASE}/intelligence/assistant/ask`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ question, facility_id: facilityId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Assistant query failed: ${res.statusText}`);
  }
  return res.json();
}
