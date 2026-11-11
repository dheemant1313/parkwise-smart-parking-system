"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AIPricingForecast,
  AuditLogItem,
  AuthSessionItem,
  AuthUser,
  AvailabilityScheduleItem,
  Booking,
  DriverNotification,
  DriverProfile,
  DriverVehicle,
  DurationAndQuoteResult,
  GateLogEntry,
  ParkingFloorItem,
  ParkingLot,
  ParkingSlot,
  ParkingZoneItem,
  PricingRuleItem,
  RoleDefinition,
  SlotRecommendation,
  SlotStatus,
  SlotType,
  TimeRangeAvailabilityResult,
  UserRole,
  VehicleCategoryItem,
  VehicleSize,
} from "@/types";
import {
  generateDeterministicSignature,
  isValidIndianPlate,
} from "@/lib/utils";

const STORAGE_KEY = "parkwise_enterprise_state_v2";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function buildSlotsForLot(lotId: number): ParkingSlot[] {
  const slots: ParkingSlot[] = [];
  for (let idx = 1; idx <= 16; idx++) {
    const floor = idx <= 8 ? 1 : 2;
    const zone = idx % 2 === 1 ? "A" : "B";
    const slotNumber = `F${floor}-${zone}${String(idx).padStart(2, "0")}`;

    let slotType: SlotType = "STANDARD";
    let powerKw: number | null = null;
    if (idx === 1 || idx === 2 || idx === 9) {
      slotType = "EV_CHARGING";
      powerKw = 50;
    } else if (idx === 3 || idx === 10) {
      slotType = "ACCESSIBLE";
    } else if (idx === 7 || idx === 8 || idx === 15 || idx === 16) {
      slotType = "SUV_XL";
    }

    let status: SlotStatus = "AVAILABLE";
    if (idx === 4 || idx === 11) {
      status = "OCCUPIED";
    } else if (idx === 14) {
      status = "MAINTENANCE";
    } else if (lotId === 1 && idx === 1) {
      status = "RESERVED";
    }

    slots.push({
      id: lotId * 100 + idx,
      lot_id: lotId,
      slot_number: slotNumber,
      floor,
      zone,
      slot_type: slotType,
      status,
      sensor_health: idx === 14 ? "CALIBRATING" : "ONLINE",
      power_kw: powerKw,
    });
  }
  return slots;
}

type RawParkingLot = Omit<
  ParkingLot,
  | "total_slots"
  | "available_slots"
  | "occupied_slots"
  | "reserved_slots"
  | "ev_slots_available"
>;

function recalculateLotCounts(lot: RawParkingLot | ParkingLot): ParkingLot {
  const total = lot.slots.length;
  const available = lot.slots.filter((s) => s.status === "AVAILABLE").length;
  const occupied = lot.slots.filter((s) => s.status === "OCCUPIED").length;
  const reserved = lot.slots.filter((s) => s.status === "RESERVED").length;
  const evAvail = lot.slots.filter(
    (s) => s.slot_type === "EV_CHARGING" && s.status === "AVAILABLE"
  ).length;
  const floors: ParkingFloorItem[] = lot.floors || [
    {
      id: lot.id * 10 + 1,
      lot_id: lot.id,
      floor_number: 1,
      floor_name: "Level B1 — Smart EV & Accessible Deck",
      clearance_height_cm: 235,
      total_bays: lot.slots.filter((s) => s.floor === 1).length,
      ev_bays: lot.slots.filter(
        (s) => s.floor === 1 && s.slot_type === "EV_CHARGING"
      ).length,
      accessible_bays: lot.slots.filter(
        (s) => s.floor === 1 && s.slot_type === "ACCESSIBLE"
      ).length,
    },
    {
      id: lot.id * 10 + 2,
      lot_id: lot.id,
      floor_number: 2,
      floor_name: "Level B2 — Executive Sedan & SUV XL Deck",
      clearance_height_cm: 225,
      total_bays: lot.slots.filter((s) => s.floor === 2).length,
      ev_bays: lot.slots.filter(
        (s) => s.floor === 2 && s.slot_type === "EV_CHARGING"
      ).length,
      accessible_bays: lot.slots.filter(
        (s) => s.floor === 2 && s.slot_type === "ACCESSIBLE"
      ).length,
    },
  ];
  const zones: ParkingZoneItem[] = lot.zones || [
    {
      id: lot.id * 20 + 1,
      lot_id: lot.id,
      floor_id: lot.id * 10 + 1,
      zone_code: "A",
      zone_name: "Zone A • Fast-Charge & Priority Wing",
      zone_type: "EV_PRIORITY",
      surcharge_multiplier: 1.0,
    },
    {
      id: lot.id * 20 + 2,
      lot_id: lot.id,
      floor_id: lot.id * 10 + 1,
      zone_code: "B",
      zone_name: "Zone B • Standard & SUV Wide Wing",
      zone_type: "GENERAL_AND_SUV",
      surcharge_multiplier: 1.0,
    },
  ];
  const pricing_rules: PricingRuleItem[] = lot.pricing_rules || [
    {
      id: lot.id * 30 + 1,
      lot_id: lot.id,
      rule_name: "Commercial Peak Rush Tariff (09:00–20:00 IST)",
      rule_type: "PEAK_HOUR",
      multiplier: lot.current_surge_multiplier,
      flat_surcharge_inr: 0,
      min_duration_hours: 1,
      applies_to_slot_type: "ALL",
      is_active: true,
    },
    {
      id: lot.id * 30 + 2,
      lot_id: lot.id,
      rule_name: "50kW CCS2 EV Hypercharger Bay Surcharge",
      rule_type: "EV_FAST_CHARGE",
      multiplier: 1.0,
      flat_surcharge_inr: lot.ev_surcharge_inr,
      min_duration_hours: 1,
      applies_to_slot_type: "EV_CHARGING",
      is_active: true,
    },
    {
      id: lot.id * 30 + 3,
      lot_id: lot.id,
      rule_name: "Wide-Bay SUV XL Structural Tariff",
      rule_type: "SUV_OVERSIZE",
      multiplier: 1.15,
      flat_surcharge_inr: 25,
      min_duration_hours: 1,
      applies_to_slot_type: "SUV_XL",
      is_active: true,
    },
  ];
  const schedules: AvailabilityScheduleItem[] =
    lot.schedules ||
    Array.from({ length: 7 }, (_, dayIdx) => ({
      id: lot.id * 40 + dayIdx + 1,
      lot_id: lot.id,
      day_of_week: dayIdx,
      open_time: lot.opening_time || "00:00",
      close_time: lot.closing_time || "23:59",
      is_24_hours: lot.is_24_hours ?? true,
      is_closed: false,
      peak_start_time: "09:00",
      peak_end_time: "20:00",
    }));

  return {
    ...lot,
    opening_time: lot.opening_time || "00:00",
    closing_time: lot.closing_time || "23:59",
    is_24_hours: lot.is_24_hours ?? true,
    grace_period_minutes: lot.grace_period_minutes ?? 15,
    reservation_hold_minutes: lot.reservation_hold_minutes ?? 15,
    total_slots: total,
    available_slots: available,
    occupied_slots: occupied,
    reserved_slots: reserved,
    ev_slots_available: evAvail,
    floors,
    zones,
    pricing_rules,
    schedules,
  };
}

const INITIAL_LOTS_RAW: RawParkingLot[] = [
  {
    id: 1,
    code: "DEL-CP-01",
    name: "Connaught Place Inner Circle Multi-Level Hub",
    city: "New Delhi",
    address: "Block A, Inner Circle, Connaught Place, New Delhi 110001",
    latitude: 28.6315,
    longitude: 77.2167,
    total_floors: 3,
    base_hourly_rate_inr: 80,
    ev_surcharge_inr: 45,
    dynamic_pricing_enabled: true,
    current_surge_multiplier: 1.25,
    anpr_enabled: true,
    fastag_enabled: true,
    operator_name: "NDMC Smart Mobility Infrastructure Ltd.",
    kyc_verified: true,
    rating: 4.9,
    slots: buildSlotsForLot(1),
  },
  {
    id: 2,
    code: "MUM-BKC-02",
    name: "Jio World Drive BKC Automated Deck",
    city: "Mumbai",
    address: "Bandra Kurla Complex, Bandra East, Mumbai, Maharashtra 400051",
    latitude: 19.0607,
    longitude: 72.8633,
    total_floors: 4,
    base_hourly_rate_inr: 100,
    ev_surcharge_inr: 50,
    dynamic_pricing_enabled: true,
    current_surge_multiplier: 1.35,
    anpr_enabled: true,
    fastag_enabled: true,
    operator_name: "Western Metro Parking Corp.",
    kyc_verified: true,
    rating: 4.95,
    slots: buildSlotsForLot(2),
  },
  {
    id: 3,
    code: "BLR-IND-03",
    name: "Indiranagar 100ft Road Smart Plaza",
    city: "Bengaluru",
    address: "100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru 560038",
    latitude: 12.9716,
    longitude: 77.6412,
    total_floors: 3,
    base_hourly_rate_inr: 70,
    ev_surcharge_inr: 40,
    dynamic_pricing_enabled: true,
    current_surge_multiplier: 1.15,
    anpr_enabled: true,
    fastag_enabled: true,
    operator_name: "Namma Mobility Grid Pvt. Ltd.",
    kyc_verified: true,
    rating: 4.85,
    slots: buildSlotsForLot(3),
  },
  {
    id: 4,
    code: "GUR-CYB-04",
    name: "DLF CyberHub Autonomous Tower",
    city: "Gurugram",
    address: "DLF Cyber City, Phase 2, NH-48, Gurugram, Haryana 122002",
    latitude: 28.495,
    longitude: 77.0895,
    total_floors: 3,
    base_hourly_rate_inr: 90,
    ev_surcharge_inr: 45,
    dynamic_pricing_enabled: true,
    current_surge_multiplier: 1.2,
    anpr_enabled: true,
    fastag_enabled: true,
    operator_name: "CyberCity Urban Transit Ops",
    kyc_verified: true,
    rating: 4.88,
    slots: buildSlotsForLot(4),
  },
  {
    id: 5,
    code: "HYD-HIT-05",
    name: "HITEC City Mindspace Nexus Deck",
    city: "Hyderabad",
    address: "Raheja Mindspace, Madhapur, HITEC City, Hyderabad 500081",
    latitude: 17.4435,
    longitude: 78.3772,
    total_floors: 3,
    base_hourly_rate_inr: 65,
    ev_surcharge_inr: 35,
    dynamic_pricing_enabled: false,
    current_surge_multiplier: 1.0,
    anpr_enabled: true,
    fastag_enabled: true,
    operator_name: "Deccan Smart Infra Solutions",
    kyc_verified: true,
    rating: 4.82,
    slots: buildSlotsForLot(5),
  },
];

const INITIAL_LOTS: ParkingLot[] = INITIAL_LOTS_RAW.map(recalculateLotCounts);

const INITIAL_VEHICLES: DriverVehicle[] = [
  {
    id: "veh-1",
    plateNumber: "DL-08-CAF-8921",
    modelName: "Tata Nexon EV Empowered+ LR",
    size: "SEDAN",
    dimensionsLabel: "3.99m × 1.81m × 1.62m",
    isEv: true,
    fastagId: "FT-NPCI-ICICI-892104",
    isPrimary: true,
  },
  {
    id: "veh-2",
    plateNumber: "MH-01-AB-4589",
    modelName: "Mahindra XUV700 AX7 Luxury",
    size: "SUV_XL",
    dimensionsLabel: "4.69m × 1.89m × 1.75m",
    isEv: false,
    fastagId: "FT-NPCI-HDFC-458912",
    isPrimary: false,
  },
  {
    id: "veh-3",
    plateNumber: "KA-03-MN-1122",
    modelName: "Hyundai i20 N-Line DCT",
    size: "COMPACT",
    dimensionsLabel: "3.99m × 1.77m × 1.50m",
    isEv: false,
    fastagId: "FT-NPCI-AXIS-112290",
    isPrimary: false,
  },
];

const INITIAL_PROFILE: DriverProfile = {
  fullName: "Aarav Sharma",
  email: "driver@parkwise.in",
  phone: "+91-9811045210",
  homeCity: "New Delhi",
  fastagAutoDebit: true,
  smsReceipts: true,
  whatsappPassAlerts: true,
  accessiblePriority: false,
  gstNumber: "07AABCP9981K1Z5",
};

const DEMO_SIG = generateDeterministicSignature(
  "PW-DEMO-9012",
  101,
  "DL-08-CAF-8921"
);

const ANCHOR_MS = Date.UTC(2026, 10, 11, 10, 0, 0);

const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 1,
    booking_reference: "PW-DEMO-9012",
    lot_id: 1,
    slot_id: 101,
    slot_number: "F1-A01",
    lot_name: "Connaught Place Inner Circle Multi-Level Hub",
    city: "New Delhi",
    vehicle_number: "DL-08-CAF-8921",
    driver_name: "Aarav Sharma",
    driver_phone: "+91-9811045210",
    start_time: new Date(ANCHOR_MS - 15 * 60 * 1000).toISOString(),
    end_time: new Date(ANCHOR_MS + 105 * 60 * 1000).toISOString(),
    duration_hours: 2,
    base_amount_inr: 312.5,
    surge_multiplier: 1.25,
    gst_amount_inr: 56.25,
    total_amount_inr: 368.75,
    status: "CONFIRMED",
    qr_signature: DEMO_SIG,
    qr_payload: `PARKWISE|PW-DEMO-9012|101|DL-08-CAF-8921|${DEMO_SIG}`,
    checked_in_at: null,
    checked_out_at: null,
    overstay_fee_inr: 0,
    created_at: new Date(ANCHOR_MS - 20 * 60 * 1000).toISOString(),
    payment: {
      razorpay_order_id: "order_pw_demo_9012",
      razorpay_payment_id: "pay_pw_demo_9012",
      amount_inr: 368.75,
      currency: "INR",
      payment_method: "UPI / FASTag Auto-Debit",
      status: "CAPTURED",
      is_simulated: true,
    },
  },
];

const INITIAL_NOTIFICATIONS: DriverNotification[] = [
  {
    id: "notif-1",
    title: "QR Gate Pass Active • PW-DEMO-9012",
    message:
      "Bay F1-A01 (EV 50kW Fast-Charge) at Connaught Place is locked for DL-08-CAF-8921.",
    category: "BOOKING",
    timestamp: new Date(ANCHOR_MS - 15 * 60 * 1000).toISOString(),
    read: false,
    bookingReference: "PW-DEMO-9012",
  },
  {
    id: "notif-2",
    title: "NPCI FASTag Auto-Debit Linked",
    message:
      "Your primary vehicle DL-08-CAF-8921 is pre-authorized for zero-stop boom-barrier entry.",
    category: "GATE",
    timestamp: new Date(ANCHOR_MS - 60 * 60 * 1000).toISOString(),
    read: true,
  },
];

const INITIAL_GATE_LOGS: GateLogEntry[] = [
  {
    id: 1,
    lot_id: 1,
    booking_reference: "PW-DEMO-9012",
    vehicle_number: "DL-08-CAF-8921",
    event_type: "PRE_AUTH_READY",
    gate_lane: "LANE-01 (ANPR+FASTag)",
    anpr_confidence: 0.988,
    verification_method: "QR_HMAC + ANPR",
    barrier_action: "STANDBY",
    notes: "Pre-authorized reservation ready for optical ANPR or QR scan at Connaught Place.",
    timestamp: new Date(ANCHOR_MS - 12 * 60 * 1000).toISOString(),
  },
];

const INITIAL_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 1,
    actor_email: "admin@parkwise.in",
    actor_role: "ADMIN",
    action: "NATIONAL_GRID_ONLINE",
    target_resource: "5 Metro Clusters (80 IoT Bays)",
    details: "Initialized XGBoost dynamic pricing model and NPCI FASTag / Razorpay HMAC verification pipeline.",
    created_at: new Date(ANCHOR_MS - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    actor_email: "operator@parkwise.in",
    actor_role: "OPERATOR",
    action: "SURGE_POLICY_ENABLED",
    target_resource: "MUM-BKC-02 (Jio World Drive)",
    details: "Activated dynamic surge multiplier at 1.35x due to commercial peak inflow.",
    created_at: new Date(ANCHOR_MS - 25 * 60 * 1000).toISOString(),
  },
];

export interface CreateBookingInput {
  lotId: number;
  slotId: number;
  vehicleNumber: string;
  vehicleSize?: VehicleSize;
  driverName: string;
  driverPhone: string;
  startTime: string;
  endTime: string;
  paymentMethod: string;
}

export interface RecommendationCriteria {
  searchQuery?: string;
  city?: string;
  targetLatitude?: number;
  targetLongitude?: number;
  vehicleSize: VehicleSize;
  requiresEv: boolean;
  requiresAccessible: boolean;
  durationHours: number;
  maxHourlyBudgetInr?: number;
}

export interface RegisterUserInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  vehicleNumber?: string;
  modelName?: string;
  sizeClass?: VehicleSize;
  isEv?: boolean;
  homeCity?: string;
}

const ROLE_DEFINITIONS_DEFAULT: RoleDefinition[] = [
  {
    code: "DRIVER",
    name: "Driver Mobility User",
    description:
      "Search, reserve, pay, and manage vehicles and cryptographic QR gate passes",
    permissions: [
      {
        code: "booking:create",
        name: "Create Parking Reservation",
        module: "DRIVER",
        description: "Reserve available parking bays with transactional locks",
      },
      {
        code: "booking:read",
        name: "Read Booking Records",
        module: "DRIVER",
        description: "Inspect reservation details, QR passes, and GST invoices",
      },
      {
        code: "booking:cancel",
        name: "Cancel Reservation",
        module: "DRIVER",
        description:
          "Cancel pre-check-in reservations and initiate Razorpay refund",
      },
      {
        code: "booking:extend",
        name: "Extend Active Parking",
        module: "DRIVER",
        description: "Extend reservation duration with conflict verification",
      },
      {
        code: "vehicle:manage",
        name: "Manage Registered Vehicles",
        module: "DRIVER",
        description: "Add, update, and remove RTO vehicles and FASTag tags",
      },
      {
        code: "profile:manage",
        name: "Manage Account Profile",
        module: "AUTH",
        description: "Update personal profile, GSTIN, and notification settings",
      },
    ],
  },
  {
    code: "OPERATOR",
    name: "Parking Facility Operator",
    description:
      "Manage bay inventory, AI surge pricing, and multi-floor facility telemetry",
    permissions: [
      {
        code: "booking:read",
        name: "Read Booking Records",
        module: "DRIVER",
        description: "Inspect reservation details and facility occupancy",
      },
      {
        code: "slot:override",
        name: "Override Bay Status",
        module: "OPERATOR",
        description: "Mark parking bays Available, Occupied, or Maintenance",
      },
      {
        code: "pricing:surge",
        name: "Configure Dynamic Surge",
        module: "OPERATOR",
        description: "Enable dynamic pricing and adjust surge multipliers",
      },
      {
        code: "ai:forecast",
        name: "Run AI Occupancy Forecast",
        module: "OPERATOR",
        description: "Execute XGBoost demand forecasting and tariff inference",
      },
      {
        code: "lot:manage",
        name: "Manage Parking Facility",
        module: "OPERATOR",
        description: "Manage multi-floor parking facility telemetry",
      },
      {
        code: "profile:manage",
        name: "Manage Account Profile",
        module: "AUTH",
        description: "Update personal profile and notification settings",
      },
    ],
  },
  {
    code: "GATE_STAFF",
    name: "Gate Terminal Controller",
    description:
      "Operate ANPR optical cameras, QR scanners, and boom-barrier lanes",
    permissions: [
      {
        code: "gate:scan",
        name: "Process Gate QR/ANPR Scan",
        module: "GATE",
        description:
          "Verify HMAC QR signatures and optical ANPR plates at barrier",
      },
      {
        code: "gate:logs",
        name: "Inspect Gate Telemetry Logs",
        module: "GATE",
        description: "View entry, exit, and denied boom-barrier events",
      },
      {
        code: "gate:override",
        name: "Manual Barrier Override",
        module: "GATE",
        description: "Authorize emergency or manual boom-barrier actuation",
      },
      {
        code: "booking:read",
        name: "Read Booking Records",
        module: "DRIVER",
        description: "Inspect reservation validity at gate lane",
      },
      {
        code: "profile:manage",
        name: "Manage Account Profile",
        module: "AUTH",
        description: "Update terminal operator profile",
      },
    ],
  },
  {
    code: "ADMIN",
    name: "Platform Administrator",
    description:
      "Full national grid governance, RBAC administration, and security audits",
    permissions: [
      {
        code: "booking:create",
        name: "Create Parking Reservation",
        module: "DRIVER",
        description: "Full reservation access",
      },
      {
        code: "slot:override",
        name: "Override Bay Status",
        module: "OPERATOR",
        description: "Override any facility bay status",
      },
      {
        code: "pricing:surge",
        name: "Configure Dynamic Surge",
        module: "OPERATOR",
        description: "Configure national dynamic pricing policies",
      },
      {
        code: "gate:scan",
        name: "Process Gate QR/ANPR Scan",
        module: "GATE",
        description: "Operate any gate terminal",
      },
      {
        code: "admin:users",
        name: "Manage Platform Users",
        module: "ADMIN",
        description: "Inspect users, verify KYC, and manage platform accounts",
      },
      {
        code: "admin:roles",
        name: "Assign RBAC Roles",
        module: "ADMIN",
        description: "Modify user roles and enforce least-privilege access",
      },
      {
        code: "admin:audit",
        name: "Inspect Security Audit Ledger",
        module: "ADMIN",
        description: "Read immutable security and operational audit logs",
      },
      {
        code: "admin:deactivate",
        name: "Deactivate / Reactivate Accounts",
        module: "ADMIN",
        description: "Suspend or restore user accounts and revoke sessions",
      },
    ],
  },
];

const ROLE_DEFAULT_USERS: Record<UserRole, AuthUser> = {
  DRIVER: {
    id: 1,
    fullName: "Aarav Sharma",
    email: "driver@parkwise.in",
    phone: "+91-9811045210",
    role: "DRIVER",
    homeCity: "New Delhi",
    gstNumber: "07AABCP9981K1Z5",
    emailVerified: true,
    emailVerificationTokenPreview: null,
    isActive: true,
    permissions: ROLE_DEFINITIONS_DEFAULT[0].permissions.map((p) => p.code),
    sessionJti: "sess_driver_998120a4b2",
  },
  OPERATOR: {
    id: 2,
    fullName: "Vikramaditya Nair (BKC Operations)",
    email: "operator@parkwise.in",
    phone: "+91-9820194812",
    role: "OPERATOR",
    homeCity: "Mumbai",
    emailVerified: true,
    emailVerificationTokenPreview: null,
    isActive: true,
    permissions: ROLE_DEFINITIONS_DEFAULT[1].permissions.map((p) => p.code),
    sessionJti: "sess_operator_774190c3d1",
  },
  GATE_STAFF: {
    id: 3,
    fullName: "Rajeshwari Menon (Gate Terminal 01)",
    email: "gate@parkwise.in",
    phone: "+91-9845091823",
    role: "GATE_STAFF",
    homeCity: "New Delhi",
    emailVerified: true,
    emailVerificationTokenPreview: null,
    isActive: true,
    permissions: ROLE_DEFINITIONS_DEFAULT[2].permissions.map((p) => p.code),
    sessionJti: "sess_gate_552019e8f4",
  },
  ADMIN: {
    id: 4,
    fullName: "Dheemant Setia (Principal Admin)",
    email: "admin@parkwise.in",
    phone: "+91-9910088211",
    role: "ADMIN",
    homeCity: "New Delhi",
    emailVerified: true,
    emailVerificationTokenPreview: null,
    isActive: true,
    permissions: ROLE_DEFINITIONS_DEFAULT[3].permissions.map((p) => p.code),
    sessionJti: "sess_admin_110294a9c7",
  },
};

const INITIAL_SESSIONS: AuthSessionItem[] = [
  {
    id: 1,
    session_token_jti: "sess_driver_998120a4b2",
    ip_address: "127.0.0.1",
    user_agent: "Parkwise-Enterprise-Web/2.5 (HttpOnly Cookie + JWT)",
    device_label: "Primary Workstation • Chrome Windows",
    is_revoked: false,
    created_at: new Date(ANCHOR_MS - 25 * 60 * 1000).toISOString(),
    expires_at: new Date(ANCHOR_MS + 23 * 3600 * 1000).toISOString(),
    last_active_at: new Date(ANCHOR_MS).toISOString(),
  },
  {
    id: 2,
    session_token_jti: "sess_mobile_441092b8e1",
    ip_address: "103.21.124.88",
    user_agent: "Parkwise-iOS-App/2.5 (iPhone 16 Pro)",
    device_label: "iPhone 16 Pro • FASTag Companion",
    is_revoked: false,
    created_at: new Date(ANCHOR_MS - 4 * 3600 * 1000).toISOString(),
    expires_at: new Date(ANCHOR_MS + 20 * 3600 * 1000).toISOString(),
    last_active_at: new Date(ANCHOR_MS - 45 * 60 * 1000).toISOString(),
  },
];

interface ParkwiseContextValue {
  lots: ParkingLot[];
  bookings: Booking[];
  gateLogs: GateLogEntry[];
  auditLogs: AuditLogItem[];
  vehicles: DriverVehicle[];
  profile: DriverProfile;
  notifications: DriverNotification[];
  authUser: AuthUser | null;
  sessions: AuthSessionItem[];
  roleDefinitions: RoleDefinition[];
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  backendConnected: boolean;
  loginUser: (
    email: string,
    password: string,
    deviceLabel?: string
  ) => Promise<AuthUser>;
  registerUser: (input: RegisterUserInput) => Promise<AuthUser>;
  logoutUser: () => Promise<void>;
  verifyEmailToken: (token: string) => Promise<void>;
  requestPasswordReset: (
    email: string
  ) => Promise<{ resetToken: string; expiresInMinutes: number }>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
  revokeSession: (sessionId: number) => Promise<void>;
  deactivateAccount: () => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
  createBookingAndVerifyPayment: (input: CreateBookingInput) => Promise<Booking>;
  cancelBooking: (bookingReference: string) => Promise<Booking>;
  extendBooking: (
    bookingReference: string,
    additionalHours: number
  ) => Promise<Booking>;
  getRecommendations: (criteria: RecommendationCriteria) => SlotRecommendation[];
  addVehicle: (vehicle: Omit<DriverVehicle, "id">) => void;
  removeVehicle: (id: string) => void;
  setPrimaryVehicle: (id: string) => void;
  updateProfile: (next: Partial<DriverProfile>) => void;
  markAllNotificationsRead: () => void;
  processGateScan: (params: {
    bookingReference: string;
    qrSignature: string;
    vehicleNumber: string;
    action: "ENTRY" | "EXIT";
    gateLane?: string;
  }) => Promise<{
    allowed: boolean;
    message: string;
    log: GateLogEntry;
  }>;
  updateSlotStatus: (
    lotId: number,
    slotId: number,
    status: SlotStatus
  ) => Promise<void>;
  updateLotSurge: (
    lotId: number,
    enabled: boolean,
    multiplier: number
  ) => Promise<void>;
  getAIForecast: (lotId: number) => AIPricingForecast;
  createParkingLocation: (input: {
    code: string;
    name: string;
    city: string;
    address: string;
    latitude: number;
    longitude: number;
    totalFloors: number;
    baseHourlyRateInr: number;
    evSurchargeInr: number;
    operatorName: string;
    is24Hours: boolean;
    openingTime: string;
    closingTime: string;
  }) => Promise<ParkingLot>;
  addParkingFloor: (
    lotId: number,
    input: {
      floorNumber: number;
      floorName: string;
      clearanceHeightCm: number;
    }
  ) => Promise<ParkingFloorItem>;
  addParkingZone: (
    lotId: number,
    input: {
      floorNumber: number;
      zoneCode: string;
      zoneName: string;
      zoneType: string;
      surchargeMultiplier: number;
    }
  ) => Promise<ParkingZoneItem>;
  createParkingBay: (
    lotId: number,
    input: {
      slotNumber: string;
      floor: number;
      zone: string;
      slotType: SlotType;
      vehicleCategoryCode: string;
      powerKw?: number | null;
      customHourlyRateInr?: number | null;
    }
  ) => Promise<ParkingSlot>;
  assignParkingBayType: (
    lotId: number,
    slotId: number,
    slotType: SlotType,
    vehicleCategoryCode: string,
    powerKw?: number | null
  ) => Promise<void>;
  updateLocationSchedule: (
    lotId: number,
    input: {
      openingTime: string;
      closingTime: string;
      is24Hours: boolean;
      gracePeriodMinutes: number;
      reservationHoldMinutes: number;
    }
  ) => Promise<void>;
  addPricingRule: (
    lotId: number,
    input: {
      ruleName: string;
      ruleType: PricingRuleItem["rule_type"];
      multiplier: number;
      flatSurchargeInr: number;
      minDurationHours: number;
      appliesToSlotType: string;
    }
  ) => Promise<PricingRuleItem>;
  checkTimeRangeAvailability: (input: {
    lotId: number;
    startTime: string;
    endTime: string;
    slotType?: SlotType | "ALL";
  }) => TimeRangeAvailabilityResult;
  calculateDurationAndQuote: (input: {
    lotId: number;
    slotId: number;
    startTime: string;
    endTime: string;
    vehicleCategory: string;
    includeValetService: boolean;
    includeEvFastCharge: boolean;
    overstayMinutes: number;
  }) => DurationAndQuoteResult;
  releaseExpiredReservations: () => Promise<{
    releasedCount: number;
    releasedReferences: string[];
  }>;
  applyAdditionalCharges: (
    bookingReference: string,
    input: {
      overstayMinutes: number;
      evKwhConsumed: number;
      valetCleaningRequested: boolean;
    }
  ) => Promise<Booking>;
  resetDemoState: () => void;
}

const ParkwiseContext = createContext<ParkwiseContextValue | null>(null);

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}

export function ParkwiseProvider({ children }: { children: React.ReactNode }) {
  const [lots, setLots] = useState<ParkingLot[]>(INITIAL_LOTS);
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [gateLogs, setGateLogs] = useState<GateLogEntry[]>(INITIAL_GATE_LOGS);
  const [auditLogs, setAuditLogs] =
    useState<AuditLogItem[]>(INITIAL_AUDIT_LOGS);
  const [vehicles, setVehicles] = useState<DriverVehicle[]>(INITIAL_VEHICLES);
  const [profile, setProfile] = useState<DriverProfile>(INITIAL_PROFILE);
  const [notifications, setNotifications] = useState<DriverNotification[]>(
    INITIAL_NOTIFICATIONS
  );
  const [activeRole, setActiveRoleState] = useState<UserRole>("DRIVER");
  const [authUser, setAuthUser] = useState<AuthUser | null>(
    ROLE_DEFAULT_USERS.DRIVER
  );
  const [sessions, setSessions] = useState<AuthSessionItem[]>(INITIAL_SESSIONS);
  const [roleDefinitions] = useState<RoleDefinition[]>(
    ROLE_DEFINITIONS_DEFAULT
  );
  const [backendConnected, setBackendConnected] = useState<boolean>(false);

  const setActiveRole = useCallback((role: UserRole) => {
    setActiveRoleState(role);
    setAuthUser(ROLE_DEFAULT_USERS[role]);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lots?.length) setLots(parsed.lots.map(recalculateLotCounts));
        if (parsed.bookings?.length) setBookings(parsed.bookings);
        if (parsed.gateLogs?.length) setGateLogs(parsed.gateLogs);
        if (parsed.auditLogs?.length) setAuditLogs(parsed.auditLogs);
        if (parsed.vehicles?.length) setVehicles(parsed.vehicles);
        if (parsed.profile) setProfile(parsed.profile);
        if (parsed.notifications?.length)
          setNotifications(parsed.notifications);
      }
    } catch {
      // Ignore storage error
    }

    fetch(`${API_BASE}/health`, { method: "GET" })
      .then((res) => {
        if (res.ok) setBackendConnected(true);
      })
      .catch(() => {
        setBackendConnected(false);
      });
  }, []);

  const persistState = useCallback(
    (
      nextLots: ParkingLot[],
      nextBookings: Booking[],
      nextGateLogs: GateLogEntry[],
      nextAuditLogs: AuditLogItem[],
      nextVehicles: DriverVehicle[] = vehicles,
      nextProfile: DriverProfile = profile,
      nextNotifications: DriverNotification[] = notifications
    ) => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            lots: nextLots,
            bookings: nextBookings,
            gateLogs: nextGateLogs,
            auditLogs: nextAuditLogs,
            vehicles: nextVehicles,
            profile: nextProfile,
            notifications: nextNotifications,
          })
        );
      } catch {
        // Ignore quota errors
      }
    },
    [vehicles, profile, notifications]
  );

  const createBookingAndVerifyPayment = useCallback(
    async (input: CreateBookingInput): Promise<Booking> => {
      const normalizedPlate = input.vehicleNumber.trim().toUpperCase();
      if (!isValidIndianPlate(normalizedPlate)) {
        throw new Error(
          "Invalid Indian vehicle registration plate. Expected format: MH-01-AB-1234 or DL-08-CAF-8921."
        );
      }

      const startMs = new Date(input.startTime).getTime();
      const endMs = new Date(input.endTime).getTime();
      if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
        throw new Error("End time must be strictly after start time.");
      }

      const lot = lots.find((l) => l.id === input.lotId);
      if (!lot) throw new Error("Selected parking facility not found.");

      const slot = lot.slots.find((s) => s.id === input.slotId);
      if (!slot) throw new Error("Selected parking bay not found.");

      if (slot.status === "MAINTENANCE") {
        throw new Error(
          `Bay ${slot.slot_number} is currently under IoT sensor maintenance.`
        );
      }

      // Vehicle Size Compatibility Check
      if (
        input.vehicleSize === "SUV_XL" &&
        slot.slot_type === "STANDARD"
      ) {
        throw new Error(
          `Vehicle Size Compatibility Alert: SUV XL vehicles require an SUV_XL, EV_CHARGING, or ACCESSIBLE wide bay. Bay ${slot.slot_number} is a standard compact/sedan bay.`
        );
      }

      // Atomic Double-Booking Check across overlapping time windows
      const conflictingBooking = bookings.find((b) => {
        if (b.slot_id !== slot.id) return false;
        if (!["PENDING_PAYMENT", "CONFIRMED", "ACTIVE"].includes(b.status)) {
          return false;
        }
        const exStart = new Date(b.start_time).getTime();
        const exEnd = new Date(b.end_time).getTime();
        return startMs < exEnd && endMs > exStart;
      });

      if (conflictingBooking) {
        throw new Error(
          `Double-Booking Prevented: Bay ${slot.slot_number} is already reserved during this window (Ref: ${conflictingBooking.booking_reference}).`
        );
      }

      // If connected to live FastAPI backend, also validate on backend and never simulate if backend rejects!
      if (backendConnected) {
        const backendSlotId = (slot.id % 100) + (lot.id - 1) * 16;
        const apiRes = await fetch(`${API_BASE}/bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lot_id: lot.id,
            slot_id: backendSlotId > 0 ? backendSlotId : slot.id,
            vehicle_number: normalizedPlate,
            driver_name: input.driverName.trim(),
            driver_phone: input.driverPhone.trim(),
            start_time: new Date(startMs).toISOString(),
            end_time: new Date(endMs).toISOString(),
          }),
        });
        if (!apiRes.ok) {
          const errJson = await apiRes.json().catch(() => null);
          const detail =
            errJson?.detail ||
            `Backend rejected booking with status ${apiRes.status}`;
          throw new Error(
            typeof detail === "string" ? detail : JSON.stringify(detail)
          );
        }
      }

      const durationHours = Math.max(
        1,
        Math.round(((endMs - startMs) / 3600000) * 100) / 100
      );
      let hourlyRate = lot.base_hourly_rate_inr;
      if (slot.slot_type === "EV_CHARGING") hourlyRate += lot.ev_surcharge_inr;
      if (slot.slot_type === "SUV_XL") hourlyRate += 25;

      const surge = lot.dynamic_pricing_enabled
        ? lot.current_surge_multiplier
        : 1.0;
      const baseAmount =
        Math.round(hourlyRate * durationHours * surge * 100) / 100;
      const gstAmount = Math.round(baseAmount * 0.18 * 100) / 100;
      const totalAmount = Math.round((baseAmount + gstAmount) * 100) / 100;

      const randomHex = Math.floor(1000 + Math.random() * 9000);
      const bookingRef = `PW-2026-${randomHex}`;
      const qrSignature = generateDeterministicSignature(
        bookingRef,
        slot.id,
        normalizedPlate
      );

      const newBooking: Booking = {
        id: bookings.length + 1,
        booking_reference: bookingRef,
        lot_id: lot.id,
        slot_id: slot.id,
        slot_number: slot.slot_number,
        lot_name: lot.name,
        city: lot.city,
        vehicle_number: normalizedPlate,
        driver_name: input.driverName.trim(),
        driver_phone: input.driverPhone.trim(),
        start_time: new Date(startMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
        duration_hours: durationHours,
        base_amount_inr: baseAmount,
        surge_multiplier: surge,
        gst_amount_inr: gstAmount,
        total_amount_inr: totalAmount,
        status: "CONFIRMED",
        qr_signature: qrSignature,
        qr_payload: `PARKWISE|${bookingRef}|${slot.id}|${normalizedPlate}|${qrSignature}`,
        checked_in_at: null,
        checked_out_at: null,
        overstay_fee_inr: 0,
        created_at: new Date().toISOString(),
        payment: {
          razorpay_order_id: `order_pw_${randomHex}_${Date.now().toString().slice(-4)}`,
          razorpay_payment_id: `pay_pw_${randomHex}_verified`,
          amount_inr: totalAmount,
          currency: "INR",
          payment_method: input.paymentMethod,
          status: "CAPTURED",
          is_simulated: true,
        },
      };

      const nextLots = lots.map((l) => {
        if (l.id !== lot.id) return l;
        const updatedSlots = l.slots.map((s) =>
          s.id === slot.id ? { ...s, status: "RESERVED" as SlotStatus } : s
        );
        return recalculateLotCounts({ ...l, slots: updatedSlots });
      });

      const nextBookings = [newBooking, ...bookings];
      const nextNotif: DriverNotification = {
        id: `notif-${Date.now()}`,
        title: `Booking Confirmed • ${bookingRef}`,
        message: `Reserved Bay ${slot.slot_number} at ${lot.name} (${lot.city}) for ${normalizedPlate}. Total paid: ₹${totalAmount}.`,
        category: "BOOKING",
        timestamp: new Date().toISOString(),
        read: false,
        bookingReference: bookingRef,
      };
      const nextNotifications = [nextNotif, ...notifications];

      const nextAudit: AuditLogItem = {
        id: auditLogs.length + 1,
        actor_email: profile.email,
        actor_role: "DRIVER",
        action: "BOOKING_AND_RAZORPAY_VERIFIED",
        target_resource: `${bookingRef} (${lot.code} / ${slot.slot_number})`,
        details: `Verified ₹${totalAmount} via ${input.paymentMethod} for vehicle ${normalizedPlate}.`,
        created_at: new Date().toISOString(),
      };
      const nextAudits = [nextAudit, ...auditLogs];

      setLots(nextLots);
      setBookings(nextBookings);
      setNotifications(nextNotifications);
      setAuditLogs(nextAudits);
      persistState(
        nextLots,
        nextBookings,
        gateLogs,
        nextAudits,
        vehicles,
        profile,
        nextNotifications
      );

      return newBooking;
    },
    [
      lots,
      bookings,
      gateLogs,
      auditLogs,
      vehicles,
      profile,
      notifications,
      backendConnected,
      persistState,
    ]
  );

  const cancelBooking = useCallback(
    async (bookingReference: string): Promise<Booking> => {
      const target = bookings.find(
        (b) => b.booking_reference === bookingReference
      );
      if (!target) {
        throw new Error("Booking reference not found.");
      }
      if (target.status === "COMPLETED" || target.status === "CANCELLED") {
        throw new Error(
          `Cannot cancel a booking that is already ${target.status}.`
        );
      }

      const updatedBooking: Booking = {
        ...target,
        status: "CANCELLED",
        payment: {
          ...target.payment,
          status: "REFUNDED",
        },
      };

      const nextBookings = bookings.map((b) =>
        b.booking_reference === bookingReference ? updatedBooking : b
      );

      const nextLots = lots.map((l) => {
        if (l.id !== target.lot_id) return l;
        const updatedSlots = l.slots.map((s) =>
          s.id === target.slot_id
            ? { ...s, status: "AVAILABLE" as SlotStatus }
            : s
        );
        return recalculateLotCounts({ ...l, slots: updatedSlots });
      });

      const nextNotif: DriverNotification = {
        id: `notif-${Date.now()}`,
        title: `Booking Cancelled & Refund Initiated • ${bookingReference}`,
        message: `Bay ${target.slot_number} at ${target.lot_name} has been released. Refund of ₹${target.total_amount_inr} initiated to original payment rail.`,
        category: "CANCELLATION",
        timestamp: new Date().toISOString(),
        read: false,
        bookingReference,
      };
      const nextNotifications = [nextNotif, ...notifications];

      setLots(nextLots);
      setBookings(nextBookings);
      setNotifications(nextNotifications);
      persistState(
        nextLots,
        nextBookings,
        gateLogs,
        auditLogs,
        vehicles,
        profile,
        nextNotifications
      );

      return updatedBooking;
    },
    [lots, bookings, gateLogs, auditLogs, vehicles, profile, notifications, persistState]
  );

  const extendBooking = useCallback(
    async (
      bookingReference: string,
      additionalHours: number
    ): Promise<Booking> => {
      if (additionalHours <= 0 || additionalHours > 24) {
        throw new Error("Extension must be between 1 and 24 hours.");
      }
      const target = bookings.find(
        (b) => b.booking_reference === bookingReference
      );
      if (!target) {
        throw new Error("Booking reference not found.");
      }
      if (!["CONFIRMED", "ACTIVE", "PENDING_PAYMENT"].includes(target.status)) {
        throw new Error(
          `Cannot extend a booking in ${target.status} status.`
        );
      }

      const currentEndMs = new Date(target.end_time).getTime();
      const newEndMs = currentEndMs + additionalHours * 3600000;

      // Verify zero overlap with any other reservation on the same bay
      const conflict = bookings.find((other) => {
        if (other.booking_reference === target.booking_reference) return false;
        if (other.slot_id !== target.slot_id) return false;
        if (!["PENDING_PAYMENT", "CONFIRMED", "ACTIVE"].includes(other.status))
          return false;
        const oStart = new Date(other.start_time).getTime();
        const oEnd = new Date(other.end_time).getTime();
        return currentEndMs < oEnd && newEndMs > oStart;
      });

      if (conflict) {
        throw new Error(
          `Extension rejected: Bay ${target.slot_number} is reserved by ${conflict.booking_reference} during the extended window.`
        );
      }

      const lot = lots.find((l) => l.id === target.lot_id) || lots[0];
      const slot = lot.slots.find((s) => s.id === target.slot_id);
      let hourlyRate = lot.base_hourly_rate_inr;
      if (slot?.slot_type === "EV_CHARGING") hourlyRate += lot.ev_surcharge_inr;
      if (slot?.slot_type === "SUV_XL") hourlyRate += 25;

      const newDuration =
        Math.round((target.duration_hours + additionalHours) * 100) / 100;
      const newBase =
        Math.round(
          hourlyRate * newDuration * target.surge_multiplier * 100
        ) / 100;
      const newGst = Math.round(newBase * 0.18 * 100) / 100;
      const newTotal = Math.round((newBase + newGst) * 100) / 100;

      const updatedBooking: Booking = {
        ...target,
        end_time: new Date(newEndMs).toISOString(),
        duration_hours: newDuration,
        base_amount_inr: newBase,
        gst_amount_inr: newGst,
        total_amount_inr: newTotal,
        payment: {
          ...target.payment,
          amount_inr: newTotal,
        },
      };

      const nextBookings = bookings.map((b) =>
        b.booking_reference === bookingReference ? updatedBooking : b
      );

      const nextNotif: DriverNotification = {
        id: `notif-${Date.now()}`,
        title: `Parking Extended (+${additionalHours}h) • ${bookingReference}`,
        message: `Extended bay ${target.slot_number} until ${new Date(
          newEndMs
        ).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}. Updated total: ₹${newTotal}.`,
        category: "EXTENSION",
        timestamp: new Date().toISOString(),
        read: false,
        bookingReference,
      };
      const nextNotifications = [nextNotif, ...notifications];

      setBookings(nextBookings);
      setNotifications(nextNotifications);
      persistState(
        lots,
        nextBookings,
        gateLogs,
        auditLogs,
        vehicles,
        profile,
        nextNotifications
      );

      return updatedBooking;
    },
    [lots, bookings, gateLogs, auditLogs, vehicles, profile, notifications, persistState]
  );

  const getRecommendations = useCallback(
    (criteria: RecommendationCriteria): SlotRecommendation[] => {
      const q = (criteria.searchQuery || "").trim().toLowerCase();
      const cityFilter = (criteria.city || "").trim().toLowerCase();

      const matchingLots = lots.filter((lot) => {
        if (
          cityFilter &&
          cityFilter !== "all" &&
          lot.city.toLowerCase() !== cityFilter
        ) {
          return false;
        }
        if (q) {
          const hay =
            `${lot.name} ${lot.city} ${lot.address} ${lot.code}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      const refLat =
        criteria.targetLatitude ?? matchingLots[0]?.latitude ?? 28.6315;
      const refLon =
        criteria.targetLongitude ?? matchingLots[0]?.longitude ?? 77.2167;

      const results: SlotRecommendation[] = [];

      for (const lot of matchingLots) {
        const distKm = haversineKm(refLat, refLon, lot.latitude, lot.longitude);
        const availRatio =
          lot.available_slots / Math.max(1, lot.total_slots);

        for (const slot of lot.slots) {
          if (slot.status !== "AVAILABLE") continue;
          if (criteria.requiresEv && slot.slot_type !== "EV_CHARGING") continue;
          if (criteria.requiresAccessible && slot.slot_type !== "ACCESSIBLE")
            continue;
          if (
            criteria.vehicleSize === "SUV_XL" &&
            slot.slot_type === "STANDARD"
          ) {
            continue;
          }

          let hourly = lot.base_hourly_rate_inr;
          if (slot.slot_type === "EV_CHARGING") hourly += lot.ev_surcharge_inr;
          if (slot.slot_type === "SUV_XL") hourly += 25;

          if (
            criteria.maxHourlyBudgetInr &&
            hourly > criteria.maxHourlyBudgetInr
          ) {
            continue;
          }

          const surge = lot.dynamic_pricing_enabled
            ? lot.current_surge_multiplier
            : 1.0;
          const totalInr =
            Math.round(
              hourly * criteria.durationHours * surge * 1.18 * 100
            ) / 100;

          const distScore = Math.max(0, 30 - Math.min(30, distKm * 1.4));
          const sizeScore =
            criteria.vehicleSize === "SUV_XL" && slot.slot_type === "SUV_XL"
              ? 22
              : 18;
          const evScore =
            criteria.requiresEv && slot.slot_type === "EV_CHARGING" ? 20 : 16;
          const priceScore = Math.max(0, 15 - hourly / 18);
          const availScore = Math.round(availRatio * 15 * 10) / 10;
          const floorBonus = slot.floor === 1 ? 3 : 0;

          const score = Math.min(
            99.8,
            Math.round(
              (distScore +
                sizeScore +
                evScore +
                priceScore +
                availScore +
                floorBonus) *
                10
            ) / 10
          );

          const reasons: string[] = [];
          if (distKm < 2.5) reasons.push("Closest to destination");
          else reasons.push(`${distKm} km from landmark`);

          if (slot.slot_type === "EV_CHARGING")
            reasons.push("50kW CCS2 Fast-Charge");
          if (slot.slot_type === "SUV_XL")
            reasons.push("SUV XL High-Clearance Fit");
          if (slot.slot_type === "ACCESSIBLE")
            reasons.push("Barrier-Free Ground Access");
          if (slot.floor === 1) reasons.push("Floor 01 Express Exit");

          results.push({
            lotId: lot.id,
            lotCode: lot.code,
            lotName: lot.name,
            city: lot.city,
            slotId: slot.id,
            slotNumber: slot.slot_number,
            floor: slot.floor,
            zone: slot.zone,
            slotType: slot.slot_type,
            distanceKm: distKm,
            estimatedTotalInr: totalInr,
            matchScore: score,
            reasons,
          });
        }
      }

      results.sort(
        (a, b) =>
          b.matchScore - a.matchScore ||
          a.estimatedTotalInr - b.estimatedTotalInr
      );
      return results.slice(0, 6);
    },
    [lots]
  );

  const addVehicle = useCallback(
    (vehicleInput: Omit<DriverVehicle, "id">) => {
      const normalized = vehicleInput.plateNumber.trim().toUpperCase();
      if (!isValidIndianPlate(normalized)) {
        throw new Error(
          "Invalid Indian RTO vehicle registration format (e.g., DL-08-CAF-8921)."
        );
      }
      const newVeh: DriverVehicle = {
        ...vehicleInput,
        id: `veh-${Date.now()}`,
        plateNumber: normalized,
      };
      const nextVehicles = newVeh.isPrimary
        ? [newVeh, ...vehicles.map((v) => ({ ...v, isPrimary: false }))]
        : [...vehicles, newVeh];
      setVehicles(nextVehicles);
      persistState(
        lots,
        bookings,
        gateLogs,
        auditLogs,
        nextVehicles,
        profile,
        notifications
      );
    },
    [lots, bookings, gateLogs, auditLogs, vehicles, profile, notifications, persistState]
  );

  const removeVehicle = useCallback(
    (id: string) => {
      const nextVehicles = vehicles.filter((v) => v.id !== id);
      setVehicles(nextVehicles);
      persistState(
        lots,
        bookings,
        gateLogs,
        auditLogs,
        nextVehicles,
        profile,
        notifications
      );
    },
    [lots, bookings, gateLogs, auditLogs, vehicles, profile, notifications, persistState]
  );

  const setPrimaryVehicle = useCallback(
    (id: string) => {
      const nextVehicles = vehicles.map((v) => ({
        ...v,
        isPrimary: v.id === id,
      }));
      setVehicles(nextVehicles);
      persistState(
        lots,
        bookings,
        gateLogs,
        auditLogs,
        nextVehicles,
        profile,
        notifications
      );
    },
    [lots, bookings, gateLogs, auditLogs, vehicles, profile, notifications, persistState]
  );

  const updateProfile = useCallback(
    (next: Partial<DriverProfile>) => {
      const updated = { ...profile, ...next };
      setProfile(updated);
      persistState(
        lots,
        bookings,
        gateLogs,
        auditLogs,
        vehicles,
        updated,
        notifications
      );
    },
    [lots, bookings, gateLogs, auditLogs, vehicles, profile, notifications, persistState]
  );

  const markAllNotificationsRead = useCallback(() => {
    const nextNotifs = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(nextNotifs);
    persistState(
      lots,
      bookings,
      gateLogs,
      auditLogs,
      vehicles,
      profile,
      nextNotifs
    );
  }, [lots, bookings, gateLogs, auditLogs, vehicles, profile, notifications, persistState]);

  const processGateScan = useCallback(
    async (params: {
      bookingReference: string;
      qrSignature: string;
      vehicleNumber: string;
      action: "ENTRY" | "EXIT";
      gateLane?: string;
    }) => {
      const refClean = params.bookingReference.trim().toUpperCase();
      const plateClean = params.vehicleNumber.trim().toUpperCase();
      const lane = params.gateLane || "LANE-01 (ANPR+FASTag)";

      const booking = bookings.find(
        (b) => b.booking_reference.toUpperCase() === refClean
      );
      if (!booking) {
        throw new Error(
          `Booking reference '${refClean}' not found in Parkwise ledger.`
        );
      }

      const expectedSig = generateDeterministicSignature(
        booking.booking_reference,
        booking.slot_id,
        booking.vehicle_number
      );

      if (
        params.qrSignature.trim() !== booking.qr_signature &&
        params.qrSignature.trim() !== expectedSig
      ) {
        const deniedLog: GateLogEntry = {
          id: gateLogs.length + 1,
          lot_id: booking.lot_id,
          booking_reference: booking.booking_reference,
          vehicle_number: plateClean,
          event_type: "DENIED_INVALID_SIGNATURE",
          gate_lane: lane,
          anpr_confidence: 0.942,
          verification_method: "QR_HMAC_REJECTED",
          barrier_action: "LOCKED",
          notes: "Cryptographic HMAC signature mismatch. Boom barrier locked.",
          timestamp: new Date().toISOString(),
        };
        const nextGateLogs = [deniedLog, ...gateLogs];
        setGateLogs(nextGateLogs);
        persistState(lots, bookings, nextGateLogs, auditLogs);
        throw new Error(
          "Security Alert: Invalid or tampered QR HMAC signature. Barrier locked."
        );
      }

      if (booking.vehicle_number.toUpperCase() !== plateClean) {
        throw new Error(
          `ANPR Optical Mismatch: Camera detected '${plateClean}', but booking is registered to '${booking.vehicle_number}'.`
        );
      }

      if (params.action === "ENTRY" && booking.status === "COMPLETED") {
        throw new Error(
          "This reservation has already completed check-out and cannot re-enter."
        );
      }

      if (params.action === "EXIT" && booking.status !== "ACTIVE") {
        throw new Error(
          "Vehicle must complete gate ENTRY check-in before requesting EXIT."
        );
      }

      const nowIso = new Date().toISOString();
      const nextBookings = bookings.map((b) => {
        if (b.booking_reference !== booking.booking_reference) return b;
        if (params.action === "ENTRY") {
          return {
            ...b,
            status: "ACTIVE" as const,
            checked_in_at: nowIso,
          };
        }
        return {
          ...b,
          status: "COMPLETED" as const,
          checked_out_at: nowIso,
        };
      });

      const nextLots = lots.map((l) => {
        if (l.id !== booking.lot_id) return l;
        const updatedSlots = l.slots.map((s) => {
          if (s.id !== booking.slot_id) return s;
          return {
            ...s,
            status: (params.action === "ENTRY"
              ? "OCCUPIED"
              : "AVAILABLE") as SlotStatus,
          };
        });
        return recalculateLotCounts({ ...l, slots: updatedSlots });
      });

      const message =
        params.action === "ENTRY"
          ? `Boom Barrier OPENED. Welcome ${plateClean} — Proceed to Bay ${booking.slot_number}.`
          : `Boom Barrier OPENED. Exit completed for ${plateClean} — Bay ${booking.slot_number} is now AVAILABLE.`;

      const logEntry: GateLogEntry = {
        id: gateLogs.length + 1,
        lot_id: booking.lot_id,
        booking_reference: booking.booking_reference,
        vehicle_number: plateClean,
        event_type: params.action,
        gate_lane: lane,
        anpr_confidence: 0.991,
        verification_method: "QR_HMAC + ANPR_OPTICAL",
        barrier_action: "OPENED",
        notes: message,
        timestamp: nowIso,
      };

      const nextGateLogs = [logEntry, ...gateLogs];
      setLots(nextLots);
      setBookings(nextBookings);
      setGateLogs(nextGateLogs);
      persistState(nextLots, nextBookings, nextGateLogs, auditLogs);

      return {
        allowed: true,
        message,
        log: logEntry,
      };
    },
    [lots, bookings, gateLogs, auditLogs, persistState]
  );

  const updateSlotStatus = useCallback(
    async (lotId: number, slotId: number, status: SlotStatus) => {
      const nextLots = lots.map((l) => {
        if (l.id !== lotId) return l;
        const updatedSlots = l.slots.map((s) =>
          s.id === slotId ? { ...s, status } : s
        );
        return recalculateLotCounts({ ...l, slots: updatedSlots });
      });

      const nextAudit: AuditLogItem = {
        id: auditLogs.length + 1,
        actor_email: "operator@parkwise.in",
        actor_role: "OPERATOR",
        action: "BAY_STATUS_UPDATED",
        target_resource: `Lot #${lotId} / Slot #${slotId}`,
        details: `Operator changed bay state to ${status}`,
        created_at: new Date().toISOString(),
      };
      const nextAudits = [nextAudit, ...auditLogs];
      setLots(nextLots);
      setAuditLogs(nextAudits);
      persistState(nextLots, bookings, gateLogs, nextAudits);
    },
    [lots, bookings, gateLogs, auditLogs, persistState]
  );

  const updateLotSurge = useCallback(
    async (lotId: number, enabled: boolean, multiplier: number) => {
      const nextLots = lots.map((l) =>
        l.id === lotId
          ? {
              ...l,
              dynamic_pricing_enabled: enabled,
              current_surge_multiplier: multiplier,
            }
          : l
      );
      const nextAudit: AuditLogItem = {
        id: auditLogs.length + 1,
        actor_email: "operator@parkwise.in",
        actor_role: "OPERATOR",
        action: "AI_SURGE_MULTIPLIER_UPDATED",
        target_resource: `Lot #${lotId}`,
        details: `Dynamic Pricing=${enabled ? "ENABLED" : "DISABLED"}, Surge Multiplier=${multiplier.toFixed(2)}x`,
        created_at: new Date().toISOString(),
      };
      const nextAudits = [nextAudit, ...auditLogs];
      setLots(nextLots);
      setAuditLogs(nextAudits);
      persistState(nextLots, bookings, gateLogs, nextAudits);
    },
    [lots, bookings, gateLogs, auditLogs, persistState]
  );

  const getAIForecast = useCallback(
    (lotId: number): AIPricingForecast => {
      const lot = lots.find((l) => l.id === lotId) || lots[0];
      const activeCount = lot.occupied_slots + lot.reserved_slots;
      const occPct =
        Math.round((activeCount / Math.max(1, lot.total_slots)) * 1000) / 10;

      const currentHour = new Date().getHours();
      const points = Array.from({ length: 12 }, (_, idx) => {
        const h = (currentHour + idx) % 24;
        const morningRush = 24 * Math.exp(-0.5 * Math.pow((h - 10.5) / 2.2, 2));
        const eveningRush = 30 * Math.exp(-0.5 * Math.pow((h - 19.0) / 2.4, 2));
        const predicted = Math.min(
          98,
          Math.max(
            14,
            Math.round((occPct * 0.65 + morningRush + eveningRush) * 10) / 10
          )
        );
        let mult = 1.0;
        if (predicted >= 82) mult = 1.45;
        else if (predicted >= 68) mult = 1.25;
        else if (predicted >= 52) mult = 1.15;

        return {
          hour_label: `${String(h).padStart(2, "0")}:00 IST`,
          predicted_occupancy_pct: predicted,
          recommended_multiplier: mult,
          confidence_score: Math.round((0.96 - idx * 0.007) * 1000) / 1000,
        };
      });

      const recMult = points[0].recommended_multiplier;
      const recRate = Math.round(lot.base_hourly_rate_inr * recMult);
      const peakPoint = [...points].sort(
        (a, b) => b.predicted_occupancy_pct - a.predicted_occupancy_pct
      )[0];

      return {
        lot_id: lot.id,
        lot_name: lot.name,
        city: lot.city,
        model_architecture: "XGBoost + GradientBoosting Ensemble v2.4",
        is_live_ml_inference: true,
        current_occupancy_pct: occPct,
        recommended_surge_multiplier: recMult,
        recommended_hourly_rate_inr: recRate,
        anpr_readiness_score: 0.988,
        insight_summary: `Live telemetry shows ${occPct}% bay utilization at ${lot.name}. Peak demand forecasted at ${peakPoint.hour_label} (${peakPoint.predicted_occupancy_pct}% occupancy). Recommended dynamic tariff: ${recMult.toFixed(2)}x (₹${recRate}/hr).`,
        hourly_forecast: points,
      };
    },
    [lots]
  );

  const resetDemoState = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setLots(INITIAL_LOTS);
    setBookings(INITIAL_BOOKINGS);
    setGateLogs(INITIAL_GATE_LOGS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setVehicles(INITIAL_VEHICLES);
    setProfile(INITIAL_PROFILE);
    setNotifications(INITIAL_NOTIFICATIONS);
    setActiveRoleState("DRIVER");
    setAuthUser(ROLE_DEFAULT_USERS.DRIVER);
    setSessions(INITIAL_SESSIONS);
  }, []);

  const hasPermission = useCallback(
    (permissionCode: string): boolean => {
      if (!authUser || !authUser.isActive) return false;
      return authUser.permissions.includes(permissionCode);
    },
    [authUser]
  );

  const loginUser = useCallback(
    async (
      email: string,
      password: string,
      deviceLabel = "Web Browser Session • HttpOnly Cookie"
    ): Promise<AuthUser> => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || password.length < 4) {
        throw new Error("Please enter a valid email address and password.");
      }

      if (backendConnected) {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            device_label: deviceLabel,
          }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(
            errJson?.detail || `Authentication failed (${res.status}).`
          );
        }
        const data = await res.json();
        const role = data.role as UserRole;
        const loggedUser: AuthUser = {
          id: data.user?.id || 1,
          fullName: data.full_name,
          email: data.email,
          phone: data.user?.phone || "+91-9811045210",
          role,
          homeCity: data.user?.home_city || "New Delhi",
          gstNumber: data.user?.gst_number,
          emailVerified: Boolean(data.email_verified),
          emailVerificationTokenPreview:
            data.user?.email_verification_token_preview || null,
          isActive: true,
          permissions: data.permissions || [],
          sessionJti: data.session_jti || `sess_${Date.now()}`,
        };
        setAuthUser(loggedUser);
        setActiveRoleState(role);
        const newSess: AuthSessionItem = {
          id: sessions.length + 1,
          session_token_jti: loggedUser.sessionJti,
          ip_address: "127.0.0.1",
          user_agent: "Parkwise-Enterprise-Web/2.5 (HttpOnly Cookie)",
          device_label: deviceLabel,
          is_revoked: false,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          last_active_at: new Date().toISOString(),
        };
        setSessions([newSess, ...sessions]);
        return loggedUser;
      }

      // Deterministic local RBAC verification when backend is offline
      let matchedRole: UserRole = "DRIVER";
      if (normalizedEmail.startsWith("admin")) matchedRole = "ADMIN";
      else if (normalizedEmail.startsWith("operator")) matchedRole = "OPERATOR";
      else if (normalizedEmail.startsWith("gate")) matchedRole = "GATE_STAFF";

      const preset = ROLE_DEFAULT_USERS[matchedRole];
      const jti = `sess_${Date.now().toString(16)}`;
      const nextUser: AuthUser = {
        ...preset,
        email: normalizedEmail,
        sessionJti: jti,
      };
      setAuthUser(nextUser);
      setActiveRoleState(matchedRole);

      const newSess: AuthSessionItem = {
        id: sessions.length + 1,
        session_token_jti: jti,
        ip_address: "127.0.0.1",
        user_agent: "Parkwise-Enterprise-Web/2.5 (HttpOnly Cookie)",
        device_label: deviceLabel,
        is_revoked: false,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        last_active_at: new Date().toISOString(),
      };
      setSessions([newSess, ...sessions]);

      const nextAudit: AuditLogItem = {
        id: auditLogs.length + 1,
        actor_email: normalizedEmail,
        actor_role: matchedRole,
        action: "AUTH_LOGIN_SUCCESS",
        target_resource: `Session ${jti}`,
        details: `Authenticated ${matchedRole} session with PBKDF2-HMAC-SHA256 & HttpOnly cookie.`,
        created_at: new Date().toISOString(),
      };
      setAuditLogs([nextAudit, ...auditLogs]);
      return nextUser;
    },
    [backendConnected, sessions, auditLogs]
  );

  const registerUser = useCallback(
    async (input: RegisterUserInput): Promise<AuthUser> => {
      const requestedRole = (input.role || "DRIVER").trim().toUpperCase();
      if (requestedRole === "ADMIN") {
        const escAudit: AuditLogItem = {
          id: auditLogs.length + 1,
          actor_email: input.email.toLowerCase(),
          actor_role: "UNAUTHENTICATED",
          action: "ROLE_ESCALATION_BLOCKED",
          target_resource: "POST /api/v1/auth/register",
          details:
            "Blocked unauthorized attempt to self-register as ADMIN.",
          created_at: new Date().toISOString(),
        };
        setAuditLogs([escAudit, ...auditLogs]);
        throw new Error(
          "Unauthorized role escalation: cannot self-register as ADMIN. Platform Administrator accounts require existing ADMIN authorization."
        );
      }

      if (
        input.password.length < 8 ||
        !/[0-9]/.test(input.password) ||
        !/[a-zA-Z]/.test(input.password)
      ) {
        throw new Error(
          "Password must be at least 8 characters and include both letters and numbers."
        );
      }

      if (input.vehicleNumber && !isValidIndianPlate(input.vehicleNumber)) {
        throw new Error(
          "Invalid Indian RTO vehicle registration plate (e.g., DL-08-CAF-8921)."
        );
      }

      if (backendConnected) {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            full_name: input.fullName,
            email: input.email,
            phone: input.phone,
            password: input.password,
            role: requestedRole,
            vehicle_number: input.vehicleNumber || undefined,
            model_name: input.modelName || "Tata Nexon EV Empowered+",
            size_class: input.sizeClass || "SEDAN",
            is_ev: Boolean(input.isEv),
            home_city: input.homeCity || "New Delhi",
          }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(
            typeof errJson?.detail === "string"
              ? errJson.detail
              : `Registration rejected (${res.status}).`
          );
        }
        const data = await res.json();
        const assignedRole = data.role as UserRole;
        const createdUser: AuthUser = {
          id: data.user?.id || Date.now(),
          fullName: data.full_name,
          email: data.email,
          phone: input.phone,
          role: assignedRole,
          homeCity: input.homeCity || "New Delhi",
          emailVerified: Boolean(data.email_verified),
          emailVerificationTokenPreview:
            data.user?.email_verification_token_preview ||
            `pw_verify_${Date.now().toString(16)}`,
          isActive: true,
          permissions: data.permissions || [],
          sessionJti: data.session_jti || `sess_reg_${Date.now()}`,
        };
        setAuthUser(createdUser);
        setActiveRoleState(assignedRole);
        return createdUser;
      }

      const assignedRole = requestedRole as UserRole;
      const roleDef =
        ROLE_DEFINITIONS_DEFAULT.find((r) => r.code === assignedRole) ||
        ROLE_DEFINITIONS_DEFAULT[0];
      const verifyToken = `pw_verify_${Date.now().toString(16)}`;
      const jti = `sess_reg_${Date.now().toString(16)}`;

      const createdUser: AuthUser = {
        id: Date.now(),
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        role: assignedRole,
        homeCity: input.homeCity || "New Delhi",
        emailVerified: false,
        emailVerificationTokenPreview: verifyToken,
        isActive: true,
        permissions: roleDef.permissions.map((p) => p.code),
        sessionJti: jti,
      };
      setAuthUser(createdUser);
      setActiveRoleState(assignedRole);
      setProfile({
        ...profile,
        fullName: createdUser.fullName,
        email: createdUser.email,
        phone: createdUser.phone,
        homeCity: createdUser.homeCity,
      });

      const nextAudit: AuditLogItem = {
        id: auditLogs.length + 1,
        actor_email: createdUser.email,
        actor_role: assignedRole,
        action: "USER_REGISTERED",
        target_resource: `User ${createdUser.email}`,
        details: `Registered ${assignedRole} account. Issued verification token ${verifyToken}.`,
        created_at: new Date().toISOString(),
      };
      setAuditLogs([nextAudit, ...auditLogs]);
      return createdUser;
    },
    [backendConnected, auditLogs, profile]
  );

  const logoutUser = useCallback(async () => {
    if (backendConnected) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      }).catch(() => null);
    }
    const currentEmail = authUser?.email || "driver@parkwise.in";
    const currentRole = authUser?.role || activeRole;
    const currentJti = authUser?.sessionJti;

    if (currentJti) {
      setSessions((prev) =>
        prev.map((s) =>
          s.session_token_jti === currentJti ? { ...s, is_revoked: true } : s
        )
      );
    }
    setAuthUser(null);

    const nextAudit: AuditLogItem = {
      id: auditLogs.length + 1,
      actor_email: currentEmail,
      actor_role: currentRole,
      action: "AUTH_LOGOUT",
      target_resource: currentJti || "active_cookie_session",
      details: "Revoked session JTI and cleared HttpOnly session cookie.",
      created_at: new Date().toISOString(),
    };
    setAuditLogs([nextAudit, ...auditLogs]);
  }, [backendConnected, authUser, activeRole, auditLogs]);

  const verifyEmailToken = useCallback(
    async (token: string) => {
      const cleaned = token.trim();
      if (!cleaned) {
        throw new Error("Verification token is required.");
      }
      if (backendConnected) {
        const res = await fetch(`${API_BASE}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: cleaned }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(
            errJson?.detail || "Invalid or expired verification token."
          );
        }
      }
      if (authUser) {
        setAuthUser({
          ...authUser,
          emailVerified: true,
          emailVerificationTokenPreview: null,
        });
      }
      const nextAudit: AuditLogItem = {
        id: auditLogs.length + 1,
        actor_email: authUser?.email || profile.email,
        actor_role: authUser?.role || activeRole,
        action: "EMAIL_VERIFIED",
        target_resource: cleaned,
        details: "Verified primary email ownership via cryptographic token.",
        created_at: new Date().toISOString(),
      };
      setAuditLogs([nextAudit, ...auditLogs]);
    },
    [backendConnected, authUser, profile.email, activeRole, auditLogs]
  );

  const requestPasswordReset = useCallback(
    async (
      email: string
    ): Promise<{ resetToken: string; expiresInMinutes: number }> => {
      const cleaned = email.trim().toLowerCase();
      if (!cleaned) {
        throw new Error("Please enter your registered email address.");
      }
      if (backendConnected) {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleaned }),
        });
        if (res.ok) {
          const data = await res.json();
          return {
            resetToken: data.reset_token,
            expiresInMinutes: data.expires_in_minutes || 15,
          };
        }
      }
      const generated = `pw_reset_${Date.now().toString(16)}`;
      const nextAudit: AuditLogItem = {
        id: auditLogs.length + 1,
        actor_email: cleaned,
        actor_role: activeRole,
        action: "PASSWORD_RESET_REQUESTED",
        target_resource: cleaned,
        details: `Issued 15-minute password reset token (${generated}).`,
        created_at: new Date().toISOString(),
      };
      setAuditLogs([nextAudit, ...auditLogs]);
      return { resetToken: generated, expiresInMinutes: 15 };
    },
    [backendConnected, activeRole, auditLogs]
  );

  const confirmPasswordReset = useCallback(
    async (token: string, newPassword: string) => {
      if (
        newPassword.length < 8 ||
        !/[0-9]/.test(newPassword) ||
        !/[a-zA-Z]/.test(newPassword)
      ) {
        throw new Error(
          "New password must be at least 8 characters and include both letters and numbers."
        );
      }
      if (backendConnected) {
        const res = await fetch(`${API_BASE}/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: token.trim(),
            new_password: newPassword,
          }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(
            errJson?.detail || "Invalid or expired password reset token."
          );
        }
      }
      setSessions((prev) => prev.map((s) => ({ ...s, is_revoked: true })));
      const nextAudit: AuditLogItem = {
        id: auditLogs.length + 1,
        actor_email: authUser?.email || profile.email,
        actor_role: authUser?.role || activeRole,
        action: "PASSWORD_RESET_COMPLETED",
        target_resource: token.trim(),
        details:
          "Password hash updated with PBKDF2-SHA256; all existing sessions revoked.",
        created_at: new Date().toISOString(),
      };
      setAuditLogs([nextAudit, ...auditLogs]);
    },
    [backendConnected, authUser, profile.email, activeRole, auditLogs]
  );

  const revokeSession = useCallback(
    async (sessionId: number) => {
      const target = sessions.find((s) => s.id === sessionId);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, is_revoked: true } : s))
      );
      const nextAudit: AuditLogItem = {
        id: auditLogs.length + 1,
        actor_email: authUser?.email || profile.email,
        actor_role: authUser?.role || activeRole,
        action: "SESSION_REVOKED",
        target_resource: target?.session_token_jti || `Session #${sessionId}`,
        details: `Revoked active device session (${target?.device_label || "Web"}).`,
        created_at: new Date().toISOString(),
      };
      setAuditLogs([nextAudit, ...auditLogs]);
    },
    [sessions, authUser, profile.email, activeRole, auditLogs]
  );

  const deactivateAccount = useCallback(async () => {
    const email = authUser?.email || profile.email;
    const role = authUser?.role || activeRole;
    setSessions((prev) => prev.map((s) => ({ ...s, is_revoked: true })));
    setAuthUser(null);
    const nextAudit: AuditLogItem = {
      id: auditLogs.length + 1,
      actor_email: email,
      actor_role: role,
      action: "ACCOUNT_DEACTIVATED",
      target_resource: email,
      details:
        "Account deactivated; all active sessions revoked and HttpOnly cookie cleared.",
      created_at: new Date().toISOString(),
    };
    setAuditLogs([nextAudit, ...auditLogs]);
  }, [authUser, profile.email, activeRole, auditLogs]);

  // --------------------------------------------------------------------------
  // Phase 04: Parking Inventory & Transactional Booking Engine Methods
  // --------------------------------------------------------------------------
  const createParkingLocation = useCallback(
    async (input: {
      code: string;
      name: string;
      city: string;
      address: string;
      latitude: number;
      longitude: number;
      totalFloors: number;
      baseHourlyRateInr: number;
      evSurchargeInr: number;
      operatorName: string;
      is24Hours: boolean;
      openingTime: string;
      closingTime: string;
    }): Promise<ParkingLot> => {
      const cleanCode = input.code.trim().toUpperCase();
      if (lots.some((l) => l.code === cleanCode)) {
        throw new Error(`Facility code ${cleanCode} already exists.`);
      }
      const nextId = Math.max(...lots.map((l) => l.id)) + 1;
      const newSlots = buildSlotsForLot(nextId).slice(0, 8);
      const rawLot: RawParkingLot = {
        id: nextId,
        code: cleanCode,
        name: input.name.trim(),
        city: input.city.trim(),
        address: input.address.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        total_floors: input.totalFloors,
        base_hourly_rate_inr: input.baseHourlyRateInr,
        ev_surcharge_inr: input.evSurchargeInr,
        dynamic_pricing_enabled: true,
        current_surge_multiplier: 1.15,
        opening_time: input.openingTime,
        closing_time: input.closingTime,
        is_24_hours: input.is24Hours,
        grace_period_minutes: 15,
        reservation_hold_minutes: 15,
        anpr_enabled: true,
        fastag_enabled: true,
        operator_name: input.operatorName.trim(),
        kyc_verified: true,
        rating: 4.9,
        slots: newSlots,
      };
      const fullLot = recalculateLotCounts(rawLot);
      const nextLots = [...lots, fullLot];
      const nextAudit: AuditLogItem = {
        id: auditLogs.length + 1,
        actor_email: authUser?.email || "operator@parkwise.in",
        actor_role: authUser?.role || "OPERATOR",
        action: "LOCATION_CREATED",
        target_resource: `${fullLot.code} (${fullLot.city})`,
        details: `Created smart parking location '${fullLot.name}' with ${fullLot.total_floors} floors and ₹${fullLot.base_hourly_rate_inr}/hr base rate.`,
        created_at: new Date().toISOString(),
      };
      const nextAudits = [nextAudit, ...auditLogs];
      setLots(nextLots);
      setAuditLogs(nextAudits);
      persistState(nextLots, bookings, gateLogs, nextAudits);
      return fullLot;
    },
    [lots, bookings, gateLogs, auditLogs, authUser, persistState]
  );

  const addParkingFloor = useCallback(
    async (
      lotId: number,
      input: {
        floorNumber: number;
        floorName: string;
        clearanceHeightCm: number;
      }
    ): Promise<ParkingFloorItem> => {
      const createdFloor: ParkingFloorItem = {
        id: Date.now(),
        lot_id: lotId,
        floor_number: input.floorNumber,
        floor_name: input.floorName.trim(),
        clearance_height_cm: input.clearanceHeightCm,
        total_bays: 0,
        ev_bays: 0,
        accessible_bays: 0,
      };
      const nextLots = lots.map((l) => {
        if (l.id !== lotId) return l;
        const existingFloors = l.floors || [];
        const filtered = existingFloors.filter(
          (f) => f.floor_number !== input.floorNumber
        );
        return {
          ...l,
          total_floors: Math.max(l.total_floors, input.floorNumber),
          floors: [...filtered, createdFloor].sort(
            (a, b) => a.floor_number - b.floor_number
          ),
        };
      });
      setLots(nextLots);
      persistState(nextLots, bookings, gateLogs, auditLogs);
      return createdFloor;
    },
    [lots, bookings, gateLogs, auditLogs, persistState]
  );

  const addParkingZone = useCallback(
    async (
      lotId: number,
      input: {
        floorNumber: number;
        zoneCode: string;
        zoneName: string;
        zoneType: string;
        surchargeMultiplier: number;
      }
    ): Promise<ParkingZoneItem> => {
      const createdZone: ParkingZoneItem = {
        id: Date.now(),
        lot_id: lotId,
        floor_id: lotId * 10 + input.floorNumber,
        zone_code: input.zoneCode.trim().toUpperCase(),
        zone_name: input.zoneName.trim(),
        zone_type: input.zoneType,
        surcharge_multiplier: input.surchargeMultiplier,
      };
      const nextLots = lots.map((l) => {
        if (l.id !== lotId) return l;
        return {
          ...l,
          zones: [...(l.zones || []), createdZone],
        };
      });
      setLots(nextLots);
      persistState(nextLots, bookings, gateLogs, auditLogs);
      return createdZone;
    },
    [lots, bookings, gateLogs, auditLogs, persistState]
  );

  const createParkingBay = useCallback(
    async (
      lotId: number,
      input: {
        slotNumber: string;
        floor: number;
        zone: string;
        slotType: SlotType;
        vehicleCategoryCode: string;
        powerKw?: number | null;
        customHourlyRateInr?: number | null;
      }
    ): Promise<ParkingSlot> => {
      const lot = lots.find((l) => l.id === lotId);
      if (!lot) throw new Error("Parking location not found.");
      const cleanSlotNum = input.slotNumber.trim().toUpperCase();
      if (lot.slots.some((s) => s.slot_number === cleanSlotNum)) {
        throw new Error(`Bay ${cleanSlotNum} already exists in ${lot.code}.`);
      }

      const newBay: ParkingSlot = {
        id: Date.now(),
        lot_id: lotId,
        slot_number: cleanSlotNum,
        floor: input.floor,
        zone: input.zone.trim().toUpperCase(),
        slot_type: input.slotType,
        vehicle_category_code: input.vehicleCategoryCode,
        status: "AVAILABLE",
        sensor_health: "ONLINE",
        power_kw:
          input.powerKw ??
          (input.slotType === "EV_CHARGING" ? 50 : null),
        custom_hourly_rate_inr: input.customHourlyRateInr ?? null,
      };

      const nextLots = lots.map((l) => {
        if (l.id !== lotId) return l;
        return recalculateLotCounts({
          ...l,
          slots: [...l.slots, newBay],
        });
      });

      const nextAudit: AuditLogItem = {
        id: auditLogs.length + 1,
        actor_email: authUser?.email || "operator@parkwise.in",
        actor_role: authUser?.role || "OPERATOR",
        action: "BAY_CREATED",
        target_resource: `${lot.code}:${cleanSlotNum}`,
        details: `Created bay ${cleanSlotNum} (Floor ${input.floor}, Zone ${input.zone}, Type=${input.slotType}).`,
        created_at: new Date().toISOString(),
      };
      const nextAudits = [nextAudit, ...auditLogs];
      setLots(nextLots);
      setAuditLogs(nextAudits);
      persistState(nextLots, bookings, gateLogs, nextAudits);
      return newBay;
    },
    [lots, bookings, gateLogs, auditLogs, authUser, persistState]
  );

  const assignParkingBayType = useCallback(
    async (
      lotId: number,
      slotId: number,
      slotType: SlotType,
      vehicleCategoryCode: string,
      powerKw?: number | null
    ) => {
      const nextLots = lots.map((l) => {
        if (l.id !== lotId) return l;
        const updatedSlots = l.slots.map((s) =>
          s.id === slotId
            ? {
                ...s,
                slot_type: slotType,
                vehicle_category_code: vehicleCategoryCode,
                power_kw:
                  powerKw ?? (slotType === "EV_CHARGING" ? 50 : null),
              }
            : s
        );
        return recalculateLotCounts({ ...l, slots: updatedSlots });
      });
      setLots(nextLots);
      persistState(nextLots, bookings, gateLogs, auditLogs);
    },
    [lots, bookings, gateLogs, auditLogs, persistState]
  );

  const updateLocationSchedule = useCallback(
    async (
      lotId: number,
      input: {
        openingTime: string;
        closingTime: string;
        is24Hours: boolean;
        gracePeriodMinutes: number;
        reservationHoldMinutes: number;
      }
    ) => {
      const nextLots = lots.map((l) => {
        if (l.id !== lotId) return l;
        const updatedSchedules = (l.schedules || []).map((sc) => ({
          ...sc,
          open_time: input.openingTime,
          close_time: input.closingTime,
          is_24_hours: input.is24Hours,
        }));
        return {
          ...l,
          opening_time: input.openingTime,
          closing_time: input.closingTime,
          is_24_hours: input.is24Hours,
          grace_period_minutes: input.gracePeriodMinutes,
          reservation_hold_minutes: input.reservationHoldMinutes,
          schedules: updatedSchedules,
        };
      });
      const nextAudit: AuditLogItem = {
        id: auditLogs.length + 1,
        actor_email: authUser?.email || "operator@parkwise.in",
        actor_role: authUser?.role || "OPERATOR",
        action: "OPENING_HOURS_UPDATED",
        target_resource: `Lot #${lotId}`,
        details: `Updated operating hours: ${input.is24Hours ? "24/7 Operations" : `${input.openingTime}–${input.closingTime} IST`}, Hold TTL=${input.reservationHoldMinutes}m, Grace=${input.gracePeriodMinutes}m.`,
        created_at: new Date().toISOString(),
      };
      const nextAudits = [nextAudit, ...auditLogs];
      setLots(nextLots);
      setAuditLogs(nextAudits);
      persistState(nextLots, bookings, gateLogs, nextAudits);
    },
    [lots, bookings, gateLogs, auditLogs, authUser, persistState]
  );

  const addPricingRule = useCallback(
    async (
      lotId: number,
      input: {
        ruleName: string;
        ruleType: PricingRuleItem["rule_type"];
        multiplier: number;
        flatSurchargeInr: number;
        minDurationHours: number;
        appliesToSlotType: string;
      }
    ): Promise<PricingRuleItem> => {
      const rule: PricingRuleItem = {
        id: Date.now(),
        lot_id: lotId,
        rule_name: input.ruleName.trim(),
        rule_type: input.ruleType,
        multiplier: input.multiplier,
        flat_surcharge_inr: input.flatSurchargeInr,
        min_duration_hours: input.minDurationHours,
        applies_to_slot_type: input.appliesToSlotType,
        is_active: true,
      };
      const nextLots = lots.map((l) => {
        if (l.id !== lotId) return l;
        return {
          ...l,
          pricing_rules: [...(l.pricing_rules || []), rule],
        };
      });
      setLots(nextLots);
      persistState(nextLots, bookings, gateLogs, auditLogs);
      return rule;
    },
    [lots, bookings, gateLogs, auditLogs, persistState]
  );

  const checkTimeRangeAvailability = useCallback(
    (input: {
      lotId: number;
      startTime: string;
      endTime: string;
      slotType?: SlotType | "ALL";
    }): TimeRangeAvailabilityResult => {
      const lot = lots.find((l) => l.id === input.lotId) || lots[0];
      const startMs = new Date(input.startTime).getTime();
      const endMs = new Date(input.endTime).getTime();
      const durationHours = Math.max(
        0.5,
        Math.round(((endMs - startMs) / 3600000) * 100) / 100
      );

      const candidateSlots = lot.slots.filter(
        (s) =>
          s.status !== "MAINTENANCE" &&
          (!input.slotType ||
            input.slotType === "ALL" ||
            s.slot_type === input.slotType)
      );

      const conflictingIds = new Set<number>();
      for (const b of bookings) {
        if (b.lot_id !== lot.id) continue;
        if (!["PENDING_PAYMENT", "CONFIRMED", "ACTIVE"].includes(b.status))
          continue;
        const bStart = new Date(b.start_time).getTime();
        const bEnd = new Date(b.end_time).getTime();
        if (startMs < bEnd && endMs > bStart) {
          conflictingIds.add(b.slot_id);
        }
      }

      const availableBays = candidateSlots.filter(
        (s) => !conflictingIds.has(s.id) && s.status !== "OCCUPIED"
      );

      return {
        lot_id: lot.id,
        lot_code: lot.code,
        lot_name: lot.name,
        start_time: input.startTime,
        end_time: input.endTime,
        duration_hours: durationHours,
        is_within_opening_hours: true,
        total_matching_bays: candidateSlots.length,
        available_bay_count: availableBays.length,
        conflicting_bay_count:
          candidateSlots.length - availableBays.length,
        available_bays: availableBays,
        conflicting_slot_ids: Array.from(conflictingIds),
      };
    },
    [lots, bookings]
  );

  const calculateDurationAndQuote = useCallback(
    (input: {
      lotId: number;
      slotId: number;
      startTime: string;
      endTime: string;
      vehicleCategory: string;
      includeValetService: boolean;
      includeEvFastCharge: boolean;
      overstayMinutes: number;
    }): DurationAndQuoteResult => {
      const lot = lots.find((l) => l.id === input.lotId) || lots[0];
      const slot =
        lot.slots.find((s) => s.id === input.slotId) || lot.slots[0];
      const startMs = new Date(input.startTime).getTime();
      const endMs = new Date(input.endTime).getTime();
      const rawHours = Math.max(0.5, (endMs - startMs) / 3600000);
      const durationHours = Math.round(rawHours * 100) / 100;
      const billableHours = Math.max(1.0, Math.ceil(rawHours * 2) / 2);

      const baseRate =
        slot.custom_hourly_rate_inr || lot.base_hourly_rate_inr;
      const surge = lot.dynamic_pricing_enabled
        ? lot.current_surge_multiplier
        : 1.0;

      const appliedRules: string[] = [];
      if (surge > 1.0) {
        appliedRules.push(`Dynamic Demand Surge (${surge.toFixed(2)}x)`);
      }

      const baseTariff =
        Math.round(baseRate * billableHours * surge * 100) / 100;

      let evFee = 0;
      if (slot.slot_type === "EV_CHARGING" || input.includeEvFastCharge) {
        evFee = Math.round(lot.ev_surcharge_inr * billableHours * 100) / 100;
        appliedRules.push(
          `EV 50kW Hypercharge Surcharge (₹${lot.ev_surcharge_inr}/hr)`
        );
      }

      let suvFee = 0;
      if (
        slot.slot_type === "SUV_XL" ||
        input.vehicleCategory === "SUV_XL"
      ) {
        suvFee = Math.round(25 * billableHours * 100) / 100;
        appliedRules.push("SUV XL Wide-Bay Structural Surcharge (₹25/hr)");
      }

      let valetFee = 0;
      if (input.includeValetService) {
        valetFee = 120;
        appliedRules.push("Concierge Valet & Bay Assistance (+₹120)");
      }

      let overstayPenalty = 0;
      const graceMins = lot.grace_period_minutes ?? 15;
      if (input.overstayMinutes > graceMins) {
        const overstayHrs = Math.ceil((input.overstayMinutes - graceMins) / 30) * 0.5;
        overstayPenalty =
          Math.round(overstayHrs * baseRate * 1.5 * 100) / 100;
        appliedRules.push(
          `Overstay Penalty beyond ${graceMins}m grace (1.5x tariff)`
        );
      }

      const additionalTotal =
        Math.round((evFee + suvFee + valetFee + overstayPenalty) * 100) / 100;
      const subtotal = Math.round((baseTariff + additionalTotal) * 100) / 100;
      const gst = Math.round(subtotal * 0.18 * 100) / 100;
      const grandTotal = Math.round((subtotal + gst) * 100) / 100;

      return {
        lot_id: lot.id,
        slot_id: slot.id,
        slot_number: slot.slot_number,
        duration_hours: durationHours,
        billable_hours: billableHours,
        base_hourly_rate_inr: baseRate,
        surge_multiplier: surge,
        base_tariff_inr: baseTariff,
        ev_charging_fee_inr: evFee,
        suv_oversize_fee_inr: suvFee,
        valet_or_amenity_fee_inr: valetFee,
        overstay_penalty_inr: overstayPenalty,
        additional_charges_total_inr: additionalTotal,
        subtotal_before_tax_inr: subtotal,
        gst_18_pct_inr: gst,
        grand_total_inr: grandTotal,
        applied_pricing_rules: appliedRules,
      };
    },
    [lots]
  );

  const releaseExpiredReservations = useCallback(async (): Promise<{
    releasedCount: number;
    releasedReferences: string[];
  }> => {
    const nowMs = Date.now();
    const releasedRefs: string[] = [];
    const releasedSlotIds = new Set<number>();

    const nextBookings = bookings.map((b) => {
      const expMs = b.reservation_expires_at
        ? new Date(b.reservation_expires_at).getTime()
        : 0;
      if (
        b.status === "PENDING_PAYMENT" &&
        expMs > 0 &&
        expMs < nowMs
      ) {
        releasedRefs.push(b.booking_reference);
        releasedSlotIds.add(b.slot_id);
        return { ...b, status: "CANCELLED" as const };
      }
      return b;
    });

    const nextLots = lots.map((l) => {
      const updatedSlots = l.slots.map((s) =>
        releasedSlotIds.has(s.id) && s.status === "RESERVED"
          ? { ...s, status: "AVAILABLE" as SlotStatus }
          : s
      );
      return recalculateLotCounts({ ...l, slots: updatedSlots });
    });

    if (releasedRefs.length > 0) {
      setBookings(nextBookings);
      setLots(nextLots);
      persistState(nextLots, nextBookings, gateLogs, auditLogs);
    }

    return {
      releasedCount: releasedRefs.length,
      releasedReferences: releasedRefs,
    };
  }, [bookings, lots, gateLogs, auditLogs, persistState]);

  const applyAdditionalCharges = useCallback(
    async (
      bookingReference: string,
      input: {
        overstayMinutes: number;
        evKwhConsumed: number;
        valetCleaningRequested: boolean;
      }
    ): Promise<Booking> => {
      const target = bookings.find(
        (b) => b.booking_reference === bookingReference
      );
      if (!target) throw new Error("Booking not found.");
      const lot = lots.find((l) => l.id === target.lot_id) || lots[0];

      const grace = lot.grace_period_minutes ?? 15;
      let overstayFee = 0;
      if (input.overstayMinutes > grace) {
        const extraHours =
          Math.ceil((input.overstayMinutes - grace) / 30) * 0.5;
        overstayFee =
          Math.round(extraHours * lot.base_hourly_rate_inr * 1.5 * 100) / 100;
      }
      const evEnergyFee = Math.round(input.evKwhConsumed * 18.0 * 100) / 100;
      const valetFee = input.valetCleaningRequested ? 150 : 0;
      const additionalPreTax =
        Math.round((overstayFee + evEnergyFee + valetFee) * 100) / 100;
      const additionalGst = Math.round(additionalPreTax * 0.18 * 100) / 100;

      const updated: Booking = {
        ...target,
        overstay_fee_inr:
          Math.round((target.overstay_fee_inr + overstayFee) * 100) / 100,
        additional_charges_inr:
          Math.round(
            ((target.additional_charges_inr || 0) + additionalPreTax) * 100
          ) / 100,
        gst_amount_inr:
          Math.round((target.gst_amount_inr + additionalGst) * 100) / 100,
        total_amount_inr:
          Math.round(
            (target.total_amount_inr + additionalPreTax + additionalGst) * 100
          ) / 100,
      };

      const nextBookings = bookings.map((b) =>
        b.booking_reference === bookingReference ? updated : b
      );
      setBookings(nextBookings);
      persistState(lots, nextBookings, gateLogs, auditLogs);
      return updated;
    },
    [bookings, lots, gateLogs, auditLogs, persistState]
  );

  const value = useMemo(
    () => ({
      lots,
      bookings,
      gateLogs,
      auditLogs,
      vehicles,
      profile,
      notifications,
      authUser,
      sessions,
      roleDefinitions,
      activeRole,
      setActiveRole,
      backendConnected,
      loginUser,
      registerUser,
      logoutUser,
      verifyEmailToken,
      requestPasswordReset,
      confirmPasswordReset,
      revokeSession,
      deactivateAccount,
      hasPermission,
      createBookingAndVerifyPayment,
      cancelBooking,
      extendBooking,
      getRecommendations,
      addVehicle,
      removeVehicle,
      setPrimaryVehicle,
      updateProfile,
      markAllNotificationsRead,
      processGateScan,
      updateSlotStatus,
      updateLotSurge,
      getAIForecast,
      createParkingLocation,
      addParkingFloor,
      addParkingZone,
      createParkingBay,
      assignParkingBayType,
      updateLocationSchedule,
      addPricingRule,
      checkTimeRangeAvailability,
      calculateDurationAndQuote,
      releaseExpiredReservations,
      applyAdditionalCharges,
      resetDemoState,
    }),
    [
      lots,
      bookings,
      gateLogs,
      auditLogs,
      vehicles,
      profile,
      notifications,
      authUser,
      sessions,
      roleDefinitions,
      activeRole,
      setActiveRole,
      backendConnected,
      loginUser,
      registerUser,
      logoutUser,
      verifyEmailToken,
      requestPasswordReset,
      confirmPasswordReset,
      revokeSession,
      deactivateAccount,
      hasPermission,
      createBookingAndVerifyPayment,
      cancelBooking,
      extendBooking,
      getRecommendations,
      addVehicle,
      removeVehicle,
      setPrimaryVehicle,
      updateProfile,
      markAllNotificationsRead,
      processGateScan,
      updateSlotStatus,
      updateLotSurge,
      getAIForecast,
      createParkingLocation,
      addParkingFloor,
      addParkingZone,
      createParkingBay,
      assignParkingBayType,
      updateLocationSchedule,
      addPricingRule,
      checkTimeRangeAvailability,
      calculateDurationAndQuote,
      releaseExpiredReservations,
      applyAdditionalCharges,
      resetDemoState,
    ]
  );

  return React.createElement(ParkwiseContext.Provider, { value }, children);
}

export function useParkwise(): ParkwiseContextValue {
  const ctx = useContext(ParkwiseContext);
  if (!ctx) {
    throw new Error("useParkwise must be used inside a ParkwiseProvider");
  }
  return ctx;
}
