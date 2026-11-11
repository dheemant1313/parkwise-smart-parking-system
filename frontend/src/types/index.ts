export type UserRole = "DRIVER" | "OPERATOR" | "GATE_STAFF" | "ADMIN";

export type SlotType = "STANDARD" | "EV_CHARGING" | "ACCESSIBLE" | "SUV_XL";

export type SlotStatus = "AVAILABLE" | "RESERVED" | "OCCUPIED" | "MAINTENANCE";

export type VehicleSize = "COMPACT" | "SEDAN" | "SUV_XL";

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentStatus =
  | "CREATED"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "REFUNDED";

export interface DriverVehicle {
  id: string;
  plateNumber: string;
  modelName: string;
  size: VehicleSize;
  dimensionsLabel: string;
  isEv: boolean;
  fastagId: string;
  isPrimary: boolean;
}

export interface DriverProfile {
  fullName: string;
  email: string;
  phone: string;
  homeCity: string;
  fastagAutoDebit: boolean;
  smsReceipts: boolean;
  whatsappPassAlerts: boolean;
  accessiblePriority: boolean;
  gstNumber?: string;
}

export interface DriverNotification {
  id: string;
  title: string;
  message: string;
  category: "BOOKING" | "PAYMENT" | "EXTENSION" | "CANCELLATION" | "GATE";
  timestamp: string;
  read: boolean;
  bookingReference?: string;
}

export interface SlotRecommendation {
  lotId: number;
  lotCode: string;
  lotName: string;
  city: string;
  slotId: number;
  slotNumber: string;
  floor: number;
  zone: string;
  slotType: SlotType;
  distanceKm: number;
  estimatedTotalInr: number;
  matchScore: number;
  reasons: string[];
}

export interface ParkingSlot {
  id: number;
  lot_id: number;
  slot_number: string;
  floor: number;
  zone: string;
  slot_type: SlotType;
  vehicle_category_code?: string;
  status: SlotStatus;
  sensor_health: string;
  power_kw?: number | null;
  custom_hourly_rate_inr?: number | null;
}

export interface ParkingFloorItem {
  id: number;
  lot_id: number;
  floor_number: number;
  floor_name: string;
  clearance_height_cm: number;
  total_bays: number;
  ev_bays: number;
  accessible_bays: number;
}

export interface ParkingZoneItem {
  id: number;
  lot_id: number;
  floor_id: number;
  zone_code: string;
  zone_name: string;
  zone_type: string;
  surcharge_multiplier: number;
}

export interface AvailabilityScheduleItem {
  id: number;
  lot_id: number;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_24_hours: boolean;
  is_closed: boolean;
  peak_start_time: string;
  peak_end_time: string;
}

export interface PricingRuleItem {
  id: number;
  lot_id: number;
  rule_name: string;
  rule_type:
    | "PEAK_HOUR"
    | "WEEKEND_SURGE"
    | "EV_FAST_CHARGE"
    | "SUV_OVERSIZE"
    | "EARLY_BIRD_DISCOUNT"
    | "OVERSTAY_PENALTY";
  multiplier: number;
  flat_surcharge_inr: number;
  min_duration_hours: number;
  applies_to_slot_type: string;
  is_active: boolean;
}

export interface ParkingOperatorItem {
  id: number;
  company_name: string;
  gstin: string;
  pan_number: string;
  contact_email: string;
  contact_phone: string;
  headquarters_city: string;
  kyc_verified: boolean;
  revenue_share_pct: number;
}

export interface VehicleCategoryItem {
  id: number;
  code: string;
  name: string;
  max_length_cm: number;
  max_width_cm: number;
  max_height_cm: number;
  rate_multiplier: number;
  requires_ev_bay: boolean;
}

export interface BookingEventItem {
  id: number;
  booking_id: number;
  booking_reference: string;
  event_type: string;
  previous_status?: string | null;
  new_status?: string | null;
  details?: string | null;
  created_at: string;
}

export interface DurationAndQuoteResult {
  lot_id: number;
  slot_id: number;
  slot_number: string;
  duration_hours: number;
  billable_hours: number;
  base_hourly_rate_inr: number;
  surge_multiplier: number;
  base_tariff_inr: number;
  ev_charging_fee_inr: number;
  suv_oversize_fee_inr: number;
  valet_or_amenity_fee_inr: number;
  overstay_penalty_inr: number;
  additional_charges_total_inr: number;
  subtotal_before_tax_inr: number;
  gst_18_pct_inr: number;
  grand_total_inr: number;
  applied_pricing_rules: string[];
}

export interface TimeRangeAvailabilityResult {
  lot_id: number;
  lot_code: string;
  lot_name: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  is_within_opening_hours: boolean;
  total_matching_bays: number;
  available_bay_count: number;
  conflicting_bay_count: number;
  available_bays: ParkingSlot[];
  conflicting_slot_ids: number[];
}

export interface ParkingLot {
  id: number;
  code: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  total_floors: number;
  base_hourly_rate_inr: number;
  ev_surcharge_inr: number;
  dynamic_pricing_enabled: boolean;
  current_surge_multiplier: number;
  opening_time?: string;
  closing_time?: string;
  is_24_hours?: boolean;
  grace_period_minutes?: number;
  reservation_hold_minutes?: number;
  anpr_enabled: boolean;
  fastag_enabled: boolean;
  operator_name: string;
  kyc_verified: boolean;
  rating: number;
  total_slots: number;
  available_slots: number;
  occupied_slots: number;
  reserved_slots: number;
  ev_slots_available: number;
  slots: ParkingSlot[];
  floors?: ParkingFloorItem[];
  zones?: ParkingZoneItem[];
  pricing_rules?: PricingRuleItem[];
  schedules?: AvailabilityScheduleItem[];
}

export interface PaymentSummary {
  razorpay_order_id: string;
  razorpay_payment_id?: string | null;
  razorpay_signature?: string | null;
  amount_inr: number;
  currency: string;
  payment_method: string;
  upi_vpa?: string | null;
  upi_intent_uri?: string | null;
  receipt_number?: string | null;
  status: PaymentStatus;
  is_simulated: boolean;
  refund_id?: string | null;
  refund_amount_inr?: number | null;
  refund_reason?: string | null;
  verified_at?: string | null;
  refunded_at?: string | null;
}

export interface QRPassTokenItem {
  token_jti: string;
  booking_reference: string;
  qr_signature: string;
  qr_payload: string;
  issued_at: string;
  expires_at: string;
  is_revoked: boolean;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  entry_used_at?: string | null;
  exit_used_at?: string | null;
}

export interface PaymentWebhookLogItem {
  id: number;
  webhook_event_id: string;
  event_type: "payment.captured" | "payment.failed" | "refund.processed";
  razorpay_order_id: string;
  razorpay_payment_id: string;
  booking_reference: string;
  signature_verified: boolean;
  idempotent_replay: boolean;
  status_applied: string;
  processed_at: string;
}

export interface PaymentReceiptData {
  receipt_number: string;
  booking_reference: string;
  razorpay_order_id: string;
  razorpay_payment_id?: string | null;
  payment_method: string;
  upi_vpa?: string | null;
  payment_status: string;
  lot_name: string;
  city: string;
  slot_number: string;
  vehicle_number: string;
  driver_name: string;
  driver_phone: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  base_amount_inr: number;
  surge_multiplier: number;
  additional_charges_inr: number;
  overstay_fee_inr: number;
  cgst_9_pct_inr: number;
  sgst_9_pct_inr: number;
  total_gst_18_pct_inr: number;
  total_amount_inr: number;
  refunded_amount_inr: number;
  net_paid_inr: number;
  gstin_operator: string;
  sac_code: string;
  issued_at: string;
  verification_hash: string;
}

export interface OfflineGateQueueItem {
  offline_event_id: string;
  lot_id: number;
  booking_reference: string;
  vehicle_number: string;
  action: "ENTRY" | "EXIT";
  qr_signature: string;
  token_jti?: string | null;
  gate_lane: string;
  occurred_at: string;
  queued_status: "PENDING_SYNC" | "SYNCED" | "CONFLICT" | "REJECTED";
  resolution_code?: string;
  resolution_detail?: string;
}

export interface OfflineSyncReportItem {
  offline_event_id: string;
  booking_reference: string;
  action: string;
  occurred_at: string;
  resolution:
    | "SYNCED_APPLIED"
    | "IDEMPOTENT_ALREADY_SYNCED"
    | "CONFLICT_DUPLICATE_REPLAY"
    | "REJECTED_INVALID_SIGNATURE"
    | "REJECTED_EXPIRED_OR_REVOKED"
    | "REJECTED_UNPAID_OR_CANCELLED";
  detail: string;
  overstay_fee_inr: number;
}

export interface Booking {
  id: number;
  booking_reference: string;
  idempotency_key?: string | null;
  lot_id: number;
  slot_id: number;
  slot_number: string;
  lot_name: string;
  city: string;
  vehicle_number: string;
  vehicle_category?: string;
  driver_name: string;
  driver_phone: string;
  start_time: string;
  end_time: string;
  reservation_expires_at?: string | null;
  duration_hours: number;
  base_amount_inr: number;
  surge_multiplier: number;
  additional_charges_inr?: number;
  gst_amount_inr: number;
  total_amount_inr: number;
  status: BookingStatus;
  qr_signature: string;
  qr_payload: string;
  qr_pass?: QRPassTokenItem | null;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  overstay_fee_inr: number;
  is_no_show?: boolean;
  created_at: string;
  payment: PaymentSummary;
  events?: BookingEventItem[];
}

export interface GateLogEntry {
  id: number;
  lot_id: number;
  booking_reference: string;
  vehicle_number: string;
  event_type:
    | "ENTRY"
    | "EXIT"
    | "DENIED_INVALID_SIGNATURE"
    | "DENIED_EXPIRED_QR_PASS"
    | "DENIED_REVOKED_QR_PASS"
    | "DENIED_DUPLICATE_ENTRY"
    | "DENIED_DUPLICATE_EXIT"
    | "DENIED_PLATE_MISMATCH"
    | "PRE_AUTH_READY"
    | "MANUAL_OVERRIDE";
  gate_lane: string;
  anpr_confidence: number;
  verification_method: string;
  barrier_action: "OPENED" | "LOCKED" | "STANDBY";
  staff_override_by?: string | null;
  override_reason?: string | null;
  offline_event_id?: string | null;
  synced_from_offline?: boolean;
  overstay_fee_inr?: number;
  notes: string;
  timestamp: string;
}

export interface AIForecastPoint {
  hour_label: string;
  predicted_occupancy_pct: number;
  recommended_multiplier: number;
  confidence_score: number;
}

export interface AIPricingForecast {
  lot_id: number;
  lot_name: string;
  city: string;
  model_architecture: string;
  is_live_ml_inference: boolean;
  current_occupancy_pct: number;
  recommended_surge_multiplier: number;
  recommended_hourly_rate_inr: number;
  anpr_readiness_score: number;
  insight_summary: string;
  hourly_forecast: AIForecastPoint[];
}

export interface AuditLogItem {
  id: number;
  actor_email: string;
  actor_role: UserRole | string;
  action: string;
  target_resource: string;
  details: string;
  ip_address?: string;
  created_at: string;
}

export interface AuthSessionItem {
  id: number;
  session_token_jti: string;
  ip_address: string;
  user_agent: string;
  device_label: string;
  is_revoked: boolean;
  created_at: string;
  expires_at: string;
  last_active_at: string;
}

export interface RolePermissionItem {
  code: string;
  name: string;
  module: string;
  description: string;
}

export interface RoleDefinition {
  code: UserRole;
  name: string;
  description: string;
  permissions: RolePermissionItem[];
}

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  homeCity: string;
  gstNumber?: string;
  emailVerified: boolean;
  emailVerificationTokenPreview?: string | null;
  isActive: boolean;
  permissions: string[];
  sessionJti: string;
}

export interface FacilityStaffItem {
  id: number;
  lot_id: number;
  lot_name: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string;
  role_title: string;
  shift_window: string;
  assigned_zone: string;
  is_on_duty: boolean;
  is_active: boolean;
  created_at: string;
}

export interface OperatorWebSocketEvent {
  id: string;
  event_type:
    | "INITIAL_OPERATOR_SNAPSHOT"
    | "SLOT_UPDATED"
    | "BOOKING_UPDATED"
    | "LOT_CONFIG_UPDATED"
    | "OPERATOR_LIVE_SYNC";
  summary: string;
  timestamp: string;
}



// ----------------------------------------------------------------------------
// Phase 07: AI Intelligence Types (Modules 1 - 6)
// ----------------------------------------------------------------------------
export interface RankedSlotCandidateItem {
  rank: number;
  lot_id: number;
  lot_code: string;
  lot_name: string;
  city: string;
  slot_id: number;
  slot_number: string;
  floor: number;
  zone: string;
  slot_type: SlotType;
  distance_km: number;
  hourly_rate_inr: number;
  surge_multiplier: number;
  estimated_total_inr: number;
  score: number;
  feature_breakdown: {
    features: Record<string, number>;
    weights: Record<string, number>;
    weighted_contributions: Record<string, number>;
  };
  reasons: string[];
}

export interface BestSlotRecommendationResponse {
  requested_strategy: string;
  strategy_used: string;
  ranker_version: string;
  fallback_reason?: string | null;
  available_strategies: Record<string, boolean>;
  candidates_evaluated: number;
  candidates_rejected_by_constraints: number;
  recommendations: RankedSlotCandidateItem[];
  data_label: string;
}

export interface HourlyForecastPoint {
  target_hour_ist: string;
  day_label: string;
  hour_of_day: number;
  is_weekend: boolean;
  baseline_predicted_pct: number;
  xgboost_predicted_pct: number;
  selected_predicted_pct: number;
  ci90_lower_pct: number;
  ci90_upper_pct: number;
  data_label: string;
}

export interface DailyForecastSummary {
  date: string;
  day_label: string;
  hours_covered: number;
  avg_predicted_pct: number;
  peak_predicted_pct: number;
  peak_hour_ist: string;
  avg_ci90_width_pct: number;
  data_label: string;
}

export interface ForecastAccuracyMetrics {
  model_name: string;
  evaluation_split: string;
  mae: number;
  rmse: number;
  mape_pct: number;
  r2: number;
  ci90_coverage_pct?: number | null;
  sample_size_hours: number;
}

export interface SevenDayForecastResponse {
  lot_id: number;
  lot_code: string;
  lot_name: string;
  city: string;
  model_version: string;
  generated_at: string;
  actual_current_occupancy: {
    data_label: string;
    occupied_or_reserved_bays: number;
    total_bays: number;
    occupancy_pct: number;
    observed_at: string;
  };
  training_data: {
    source: string;
    data_label: string;
    source_reason: string;
    history_hours: number;
    test_hours: number;
  };
  baseline_test_metrics: ForecastAccuracyMetrics;
  xgboost_test_metrics: ForecastAccuracyMetrics;
  xgboost_vs_baseline_mae_change_pct: number;
  selected_model: string;
  selection_reason: string;
  interval_method: string;
  horizon_hours: number;
  daily_summary: DailyForecastSummary[];
  hourly_forecast: HourlyForecastPoint[];
  disclaimer: string;
}

export interface PricingProposalResponse {
  id: number;
  proposal_code: string;
  lot_id: number;
  lot_code: string;
  lot_name: string;
  pricing_engine_version: string;
  forecast_model_version: string;
  forecast_training_data_source: string;
  window_start_utc: string;
  window_hours: number;
  predicted_peak_occupancy_pct: number;
  ci90_lower_pct: number;
  ci90_upper_pct: number;
  demand_tier: string;
  tier_multiplier: number;
  operator_rule_cap_multiplier: number;
  operator_rule_reference: string;
  base_hourly_rate_inr: number;
  min_hourly_rate_inr: number;
  max_hourly_rate_inr: number;
  unclamped_rate_inr: number;
  recommended_rate_inr: number;
  recommended_multiplier: number;
  was_clamped: boolean;
  formula_trace: string;
  warnings: string[];
  status: "PENDING_APPROVAL" | "APPROVED" | "OVERRIDDEN" | "REJECTED";
  created_by_email: string;
  decided_by_email?: string | null;
  applied_rate_inr?: number | null;
  applied_multiplier?: number | null;
  decision_notes?: string | null;
  created_at: string;
  decided_at?: string | null;
  prediction_label: string;
}

export interface BookingDraft {
  lot_id: number;
  slot_id: number;
  slot_number: string;
  start_time: string;
  end_time: string;
  vehicle_category: string;
  estimated_total_inr: number;
  submit_to: string;
}

export interface BookingAssistantResponse {
  message: string;
  detected_language: string;
  understood: boolean;
  extracted_entities: Record<string, any>;
  defaults_applied: string[];
  clarifications_needed: string[];
  search_params?: {
    city?: string;
    lot_id?: number;
    lot_code?: string;
    target_latitude?: number;
    target_longitude?: number;
    vehicle_size: string;
    requires_ev: boolean;
    requires_accessible: boolean;
    duration_hours: number;
    start_time: string;
    end_time: string;
    max_hourly_budget_inr?: number | null;
  } | null;
  backend_validation: {
    checked_against_db: boolean;
    conflict_free_bays_count: number;
    validation_passed: boolean;
  };
  validated_options: RankedSlotCandidateItem[];
  booking_draft?: BookingDraft | null;
  reply: string;
  reply_en: string;
  reply_hi: string;
  booking_executed: boolean;
  policy: string;
}

export interface SupportingMetric {
  name: string;
  value?: number | null;
  display_value: string;
  unit: string;
  source_tables: string[];
  computation: string;
  data_label: string;
}

export interface OperatorAssistantResponse {
  question: string;
  detected_language: string;
  intents: string[];
  refused: boolean;
  refusal_reason?: string | null;
  scope: string;
  date_range_start: string;
  date_range_end: string;
  answer: string;
  supporting_metrics: SupportingMetric[];
  data_gaps: string[];
  write_capabilities: string[];
  policy: string;
}

export interface DriftFeatureReport {
  feature: string;
  reference_source: string;
  current_source: string;
  reference_n: number;
  current_n: number;
  psi?: number | null;
  status: string;
  note: string;
}

export interface DataQualityCheck {
  check: string;
  rows_checked: number;
  rows_failing: number;
  pass_rate_pct: number;
  status: string;
}

export interface LiveForecastEvaluation {
  predictions_stored: number;
  predictions_evaluated: number;
  predictions_pending: number;
  predictions_missed: number;
  mae?: number | null;
  rmse?: number | null;
  bias?: number | null;
  ci90_coverage_pct?: number | null;
  status: string;
  note: string;
}

export interface ModelMonitoringResponse {
  evaluated_at: string;
  overall_status: string;
  status_reasons: string[];
  live_forecast_evaluation: LiveForecastEvaluation;
  offline_evaluation: Record<string, any>;
  drift: DriftFeatureReport[];
  data_quality: DataQualityCheck[];
  recent_metric_logs: {
    id: number;
    module_code: string;
    model_version: string;
    lot_id?: number | null;
    data_source: string;
    metric_name: string;
    metric_value?: number | null;
    sample_size: number;
    status: string;
    details?: string | null;
    recorded_at: string;
  }[];
}
