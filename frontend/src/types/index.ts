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
  status: SlotStatus;
  sensor_health: string;
  power_kw?: number | null;
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
}

export interface PaymentSummary {
  razorpay_order_id: string;
  razorpay_payment_id?: string | null;
  amount_inr: number;
  currency: string;
  payment_method: string;
  status: PaymentStatus;
  is_simulated: boolean;
}

export interface Booking {
  id: number;
  booking_reference: string;
  lot_id: number;
  slot_id: number;
  slot_number: string;
  lot_name: string;
  city: string;
  vehicle_number: string;
  driver_name: string;
  driver_phone: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  base_amount_inr: number;
  surge_multiplier: number;
  gst_amount_inr: number;
  total_amount_inr: number;
  status: BookingStatus;
  qr_signature: string;
  qr_payload: string;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  overstay_fee_inr: number;
  created_at: string;
  payment: PaymentSummary;
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
    | "PRE_AUTH_READY"
    | "MANUAL_OVERRIDE";
  gate_lane: string;
  anpr_confidence: number;
  verification_method: string;
  barrier_action: "OPENED" | "LOCKED" | "STANDBY";
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
