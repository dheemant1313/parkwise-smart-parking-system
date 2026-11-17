/**
 * Phase 19: Typed API Client for Driver Convenience, Valet Parking, Venues & Assistance.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export interface SavedVehicleLocationResponse {
  id: number;
  user_id: number;
  facility_id: number;
  facility_name: string;
  floor: string;
  zone: string;
  slot_number: string;
  pillar_reference?: string | null;
  photo_url?: string | null;
  driver_notes?: string | null;
  saved_at: string;
  is_active: boolean;
  retention_expires_at?: string | null;
}

export interface SavedVehicleLocationCreate {
  facility_id: number;
  floor: string;
  zone: string;
  slot_number: string;
  pillar_reference?: string;
  photo_url?: string;
  driver_notes?: string;
  booking_id?: number;
}

export interface PedestrianRouteStep {
  step_number: number;
  instruction: string;
  floor: string;
  step_type: "WALKWAY" | "ELEVATOR" | "ESCALATOR" | "RAMP" | "ARRIVED";
  distance_meters: number;
  notes?: string | null;
}

export interface PedestrianRouteResponse {
  origin: string;
  destination: string;
  total_distance_meters: number;
  estimated_walk_minutes: number;
  is_pedestrian_only: boolean;
  steps: PedestrianRouteStep[];
}

export interface ValetBookingResponse {
  id: number;
  valet_ticket_number: string;
  facility_id: number;
  facility_name: string;
  driver_name: string;
  driver_phone: string;
  vehicle_plate: string;
  vehicle_model: string;
  status: "REQUESTED" | "ACCEPTED_BY_VALET" | "PARKED_IN_STORAGE" | "RETRIEVAL_REQUESTED" | "RETURNED_TO_DRIVER" | "CANCELLED";
  assigned_attendant_name?: string | null;
  assigned_storage_slot?: string | null;
  handover_otp: string;
  handover_time?: string | null;
  parked_time?: string | null;
  retrieval_requested_time?: string | null;
  returned_time?: string | null;
  pre_inspection_notes?: string | null;
  incident_reported: boolean;
  incident_description?: string | null;
  custody_logs: Array<{
    timestamp: string;
    actor: string;
    role: string;
    action: string;
    notes?: string;
  }>;
  created_at: string;
}

export interface ValetRequestCreate {
  facility_id: number;
  vehicle_plate: string;
  vehicle_model: string;
  driver_name: string;
  driver_phone: string;
  booking_id?: number;
  pre_inspection_notes?: string;
}

export interface ValetHandoverRequest {
  valet_ticket_number: string;
  attendant_name: string;
  inspection_notes?: string;
  fuel_level_percent?: number;
  odometer_km?: number;
}

export interface ValetParkRequest {
  valet_ticket_number: string;
  storage_slot: string;
  attendant_name: string;
}

export interface ValetReturnVerifyRequest {
  valet_ticket_number: string;
  handover_otp: string;
  attendant_name: string;
}

export interface ValetIncidentReportRequest {
  valet_ticket_number: string;
  incident_description: string;
  reported_by: string;
}

export interface VenueDestinationResponse {
  id: number;
  facility_id: number;
  facility_name: string;
  name: string;
  category: "SHOPPING" | "DINING" | "CINEMA" | "SERVICES" | "OFFICES" | "EVENTS";
  floor: string;
  unit_number: string;
  opening_hours: string;
  nearest_parking_zone: string;
  nearest_elevator_bank: string;
  description?: string | null;
  logo_icon?: string | null;
  is_active: boolean;
}

export interface VenueDestinationCreate {
  facility_id: number;
  name: string;
  category: string;
  floor: string;
  unit_number: string;
  opening_hours?: string;
  nearest_parking_zone: string;
  nearest_elevator_bank?: string;
  description?: string;
}

export interface AssistanceRequestResponse {
  id: number;
  ticket_number: string;
  facility_id: number;
  facility_name: string;
  driver_name: string;
  driver_phone: string;
  vehicle_plate?: string | null;
  slot_number?: string | null;
  category: "BLOCKED_SLOT" | "DAMAGED_EQUIPMENT" | "NAVIGATION_ISSUE" | "PAYMENT_DISPUTE" | "EMERGENCY_SOS" | "OTHER";
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL_SOS";
  description: string;
  status: "SUBMITTED" | "ACKNOWLEDGED" | "STAFF_DISPATCHED" | "RESOLVED" | "CLOSED";
  assigned_staff_name?: string | null;
  staff_resolution_notes?: string | null;
  created_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  status_history: Array<{
    timestamp: string;
    status: string;
    actor: string;
    role: string;
    notes?: string;
  }>;
}

export interface AssistanceRequestCreate {
  facility_id: number;
  driver_name: string;
  driver_phone: string;
  vehicle_plate?: string;
  slot_number?: string;
  category: string;
  urgency?: string;
  description: string;
}

export interface AssistanceStatusUpdateRequest {
  ticket_number: string;
  status: string;
  staff_name: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// HTTP Request Helper
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
// Exported Client
// ---------------------------------------------------------------------------

export const driverConvenienceApi = {
  // Find My Car
  saveLocation: async (req: SavedVehicleLocationCreate, userId = 1): Promise<SavedVehicleLocationResponse> => {
    return fetchJson<SavedVehicleLocationResponse>(`/driver-ecosystem/find-my-car/save?user_id=${userId}`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  getLocation: async (userId = 1): Promise<SavedVehicleLocationResponse | null> => {
    return fetchJson<SavedVehicleLocationResponse | null>(`/driver-ecosystem/find-my-car/location?user_id=${userId}`);
  },

  clearLocation: async (userId = 1): Promise<{ status: string; records_purged: number; message: string }> => {
    return fetchJson(`/driver-ecosystem/find-my-car/clear?user_id=${userId}`, {
      method: "DELETE",
    });
  },

  getReturnRoute: async (userId = 1, origin = "Ground Floor Lobby / Elevator B"): Promise<PedestrianRouteResponse> => {
    const q = new URLSearchParams({ user_id: userId.toString(), origin });
    return fetchJson<PedestrianRouteResponse>(`/driver-ecosystem/find-my-car/route?${q.toString()}`);
  },

  // Valet Parking
  requestValet: async (req: ValetRequestCreate, userId = 1): Promise<ValetBookingResponse> => {
    return fetchJson<ValetBookingResponse>(`/driver-ecosystem/valet/request?user_id=${userId}`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  listValetRequests: async (facilityId?: number, status?: string): Promise<ValetBookingResponse[]> => {
    const q = new URLSearchParams();
    if (facilityId) q.append("facility_id", facilityId.toString());
    if (status) q.append("status", status);
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return fetchJson<ValetBookingResponse[]>(`/driver-ecosystem/valet/requests${queryStr}`);
  },

  valetHandover: async (req: ValetHandoverRequest): Promise<ValetBookingResponse> => {
    return fetchJson<ValetBookingResponse>("/driver-ecosystem/valet/handover", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  valetPark: async (req: ValetParkRequest): Promise<ValetBookingResponse> => {
    return fetchJson<ValetBookingResponse>("/driver-ecosystem/valet/park", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  valetRetrieve: async (ticketNumber: string): Promise<ValetBookingResponse> => {
    return fetchJson<ValetBookingResponse>(`/driver-ecosystem/valet/retrieve?valet_ticket_number=${encodeURIComponent(ticketNumber)}`, {
      method: "POST",
    });
  },

  valetVerifyReturn: async (req: ValetReturnVerifyRequest): Promise<ValetBookingResponse> => {
    return fetchJson<ValetBookingResponse>("/driver-ecosystem/valet/verify-return", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  valetReportIncident: async (req: ValetIncidentReportRequest): Promise<ValetBookingResponse> => {
    return fetchJson<ValetBookingResponse>("/driver-ecosystem/valet/report-incident", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  // Venues
  listVenues: async (facilityId?: number, category?: string): Promise<VenueDestinationResponse[]> => {
    const q = new URLSearchParams();
    if (facilityId) q.append("facility_id", facilityId.toString());
    if (category) q.append("category", category);
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return fetchJson<VenueDestinationResponse[]>(`/driver-ecosystem/venues${queryStr}`);
  },

  createVenue: async (req: VenueDestinationCreate): Promise<VenueDestinationResponse> => {
    return fetchJson<VenueDestinationResponse>("/driver-ecosystem/venues", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  getVenueRoute: async (venueId: number, userId = 1, reverse = false): Promise<PedestrianRouteResponse> => {
    const q = new URLSearchParams({
      user_id: userId.toString(),
      reverse: reverse ? "true" : "false",
    });
    return fetchJson<PedestrianRouteResponse>(`/driver-ecosystem/venues/${venueId}/route?${q.toString()}`);
  },

  // Assistance
  createAssistanceRequest: async (req: AssistanceRequestCreate, userId = 1): Promise<AssistanceRequestResponse> => {
    return fetchJson<AssistanceRequestResponse>(`/driver-ecosystem/assistance/request?user_id=${userId}`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  listAssistanceRequests: async (facilityId?: number, status?: string): Promise<AssistanceRequestResponse[]> => {
    const q = new URLSearchParams();
    if (facilityId) q.append("facility_id", facilityId.toString());
    if (status) q.append("status", status);
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return fetchJson<AssistanceRequestResponse[]>(`/driver-ecosystem/assistance/requests${queryStr}`);
  },

  updateAssistanceStatus: async (req: AssistanceStatusUpdateRequest): Promise<AssistanceRequestResponse> => {
    return fetchJson<AssistanceRequestResponse>("/driver-ecosystem/assistance/status", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
};
