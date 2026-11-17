/**
 * Phase 18: Typed API Client for EV Charging, Accessibility, Group Bookings & Smart Waitlist.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export interface EVChargerResponse {
  id: number;
  charger_code: string;
  facility_id: number;
  facility_name: string;
  slot_number: string;
  connector_types: string[];
  max_power_kw: number;
  status: "AVAILABLE" | "CHARGING" | "RESERVED" | "FAULT" | "OFFLINE";
  charging_tariff_inr_per_kwh: number;
  current_session_reference?: string | null;
  updated_at: string;
}

export interface EVChargingReserveRequest {
  facility_id: number;
  charger_id: number;
  booking_reference?: string;
  vehicle_plate: string;
  connector_type: string;
  target_soc_percent?: number;
}

export interface EVChargingSessionResponse {
  session_reference: string;
  charger_code: string;
  slot_number: string;
  vehicle_plate: string;
  connector_type: string;
  status: string;
  start_time: string;
  end_time?: string | null;
  initial_soc_percent?: number;
  current_soc_percent?: number;
  kwh_delivered: number;
  charging_cost_inr: number;
  tariff_inr_per_kwh: number;
  verified_event_count: number;
}

export interface EVChargingTelemetryUpdateRequest {
  session_reference: string;
  charger_code: string;
  current_soc_percent?: number;
  kwh_delivered?: number;
  is_final_stop?: boolean;
  hardware_event_signature?: string;
}

export interface AccessibilityVerifyRequest {
  user_id: number;
  disability_type: string;
  badge_number: string;
  issuing_authority?: string;
  expiry_date?: string;
}

export interface AccessibilityCredentialResponse {
  id: number;
  user_id: number;
  disability_type: string;
  badge_number: string;
  is_verified: boolean;
  verified_at?: string | null;
  eligible_slot_types: string[];
}

export interface AccessibleRouteStep {
  step_number: number;
  instruction: string;
  step_type: "RAMP" | "ELEVATOR" | "LANE" | "WIDE_PATH" | "ARRIVED";
  floor: string;
  distance_meters: number;
  has_stairs: boolean;
  notes?: string | null;
}

export interface AccessibleRouteResponse {
  facility_id: number;
  origin: string;
  destination_slot: string;
  floor: string;
  is_step_free: boolean;
  has_tactile_paving: boolean;
  elevator_accessible: boolean;
  total_distance_meters: number;
  estimated_minutes: number;
  steps: AccessibleRouteStep[];
}

export interface GroupMemberItem {
  member_id: number;
  slot_number: string;
  vehicle_number: string;
  driver_name: string;
  driver_phone?: string | null;
  qr_token_jti: string;
  status: "PENDING_ARRIVAL" | "CHECKED_IN" | "CANCELLED";
  checked_in_at?: string | null;
}

export interface GroupBookingResponse {
  group_reference: string;
  facility_name: string;
  group_name: string;
  start_time: string;
  end_time: string;
  total_spaces_reserved: number;
  total_amount_inr: number;
  status: string;
  members: GroupMemberItem[];
}

export interface GroupBookingCreateRequest {
  facility_id: number;
  group_name: string;
  start_time: string;
  end_time: string;
  vehicles: Array<{
    vehicle_number: string;
    driver_name: string;
    driver_phone?: string;
  }>;
}

export interface GroupMemberCheckInRequest {
  group_reference: string;
  vehicle_number: string;
  qr_token_jti?: string;
}

export interface GroupMemberCancelRequest {
  group_reference: string;
  vehicle_number: string;
  reason?: string;
}

export interface WaitlistEntryItem {
  waitlist_reference: string;
  facility_id: number;
  facility_name: string;
  vehicle_plate: string;
  driver_name: string;
  required_slot_type: string;
  queue_position: number;
  status: "QUEUED" | "OFFERED" | "CONVERTED" | "EXPIRED" | "CANCELLED";
  offered_slot_number?: string | null;
  offer_expires_at?: string | null;
  created_at: string;
}

export interface WaitlistJoinRequest {
  facility_id: number;
  vehicle_plate: string;
  driver_name: string;
  contact_phone?: string;
  required_slot_type?: string;
  estimated_arrival_window_hours?: number;
}

export interface WaitlistClaimRequest {
  waitlist_reference: string;
  payment_method?: string;
}

export interface WaitlistClaimResponse {
  booking_reference: string;
  slot_number: string;
  vehicle_plate: string;
  status: string;
  message: string;
}

// ---------------------------------------------------------------------------
// API Helper
// ---------------------------------------------------------------------------

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const errBody = await res.json();
      if (errBody?.detail) errMsg = typeof errBody.detail === "string" ? errBody.detail : JSON.stringify(errBody.detail);
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export const flexibleParkingApi = {
  // EV Charging
  listChargers: async (facilityId?: number): Promise<EVChargerResponse[]> => {
    const q = facilityId ? `?facility_id=${facilityId}` : "";
    return fetchJson<EVChargerResponse[]>(`/flexible/ev/chargers${q}`);
  },

  reserveCharger: async (req: EVChargingReserveRequest): Promise<EVChargingSessionResponse> => {
    return fetchJson<EVChargingSessionResponse>("/flexible/ev/reserve", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  updateTelemetry: async (req: EVChargingTelemetryUpdateRequest): Promise<EVChargingSessionResponse> => {
    return fetchJson<EVChargingSessionResponse>("/flexible/ev/telemetry", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  // Accessibility
  registerCredential: async (req: AccessibilityVerifyRequest): Promise<AccessibilityCredentialResponse> => {
    return fetchJson<AccessibilityCredentialResponse>("/flexible/accessibility/credentials", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  reserveAccessibleBay: async (params: {
    userId: number;
    facilityId: number;
    slotId: number;
    vehicleNumber: string;
    startTime: string;
    endTime: string;
  }): Promise<{ booking_reference: string; slot_id: number; status: string; message: string }> => {
    const q = new URLSearchParams({
      user_id: params.userId.toString(),
      facility_id: params.facilityId.toString(),
      slot_id: params.slotId.toString(),
      vehicle_number: params.vehicleNumber,
      start_time: params.startTime,
      end_time: params.endTime,
    });
    return fetchJson(`/flexible/accessibility/reserve?${q.toString()}`, {
      method: "POST",
    });
  },

  getAccessibleRoute: async (facilityId: number, destinationSlot: string): Promise<AccessibleRouteResponse> => {
    const q = new URLSearchParams({
      facility_id: facilityId.toString(),
      destination_slot: destinationSlot,
    });
    return fetchJson<AccessibleRouteResponse>(`/flexible/accessibility/route?${q.toString()}`);
  },

  // Family & Group Bookings
  createGroup: async (req: GroupBookingCreateRequest, organizerUserId = 1): Promise<GroupBookingResponse> => {
    return fetchJson<GroupBookingResponse>(`/flexible/groups?organizer_user_id=${organizerUserId}`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  getGroup: async (groupReference: string): Promise<GroupBookingResponse> => {
    return fetchJson<GroupBookingResponse>(`/flexible/groups/${encodeURIComponent(groupReference)}`);
  },

  checkInGroupMember: async (req: GroupMemberCheckInRequest): Promise<{
    status: string;
    member_id: number;
    vehicle_number: string;
    slot_number: string;
    message: string;
  }> => {
    return fetchJson("/flexible/groups/check-in", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  cancelGroupMember: async (req: GroupMemberCancelRequest): Promise<{
    status: string;
    released_slot: string;
    remaining_vehicles: number;
    message: string;
  }> => {
    return fetchJson("/flexible/groups/cancel-member", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  // Smart Waitlist
  joinWaitlist: async (req: WaitlistJoinRequest, userId = 1): Promise<WaitlistEntryItem> => {
    return fetchJson<WaitlistEntryItem>(`/flexible/waitlist/join?user_id=${userId}`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  listWaitlist: async (facilityId?: number): Promise<WaitlistEntryItem[]> => {
    const q = facilityId ? `?facility_id=${facilityId}` : "";
    return fetchJson<WaitlistEntryItem[]>(`/flexible/waitlist/entries${q}`);
  },

  claimWaitlistOffer: async (req: WaitlistClaimRequest): Promise<WaitlistClaimResponse> => {
    return fetchJson<WaitlistClaimResponse>("/flexible/waitlist/claim", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  simulateVacancy: async (facilityId: number, slotId: number): Promise<{
    status: string;
    waitlist_reference?: string;
    vehicle_plate?: string;
    offered_slot_id?: number;
    offer_expires_at?: string;
    message: string;
  }> => {
    const q = new URLSearchParams({
      facility_id: facilityId.toString(),
      slot_id: slotId.toString(),
    });
    return fetchJson(`/flexible/waitlist/simulate-vacancy?${q.toString()}`, {
      method: "POST",
    });
  },
};
