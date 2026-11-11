-- ============================================================================
-- PARKWISE ENTERPRISE SMART PARKING PLATFORM
-- Migration 002: Phase 04 Parking Inventory Hierarchy, Pricing Rules,
--                Schedules, Idempotent Bookings & Booking Lifecycle Events
-- Compatible with PostgreSQL 15+ and SQLite 3.35+
-- ============================================================================

CREATE TABLE IF NOT EXISTS parking_operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name VARCHAR(160) NOT NULL UNIQUE,
    gstin VARCHAR(32) NOT NULL,
    contact_email VARCHAR(160) NOT NULL,
    contact_phone VARCHAR(24) NOT NULL,
    kyc_verified BOOLEAN NOT NULL DEFAULT 1,
    settlement_account VARCHAR(64) NOT NULL DEFAULT 'RZP-SETTLE-IN-001',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL,
    max_length_m FLOAT NOT NULL,
    max_width_m FLOAT NOT NULL,
    max_height_m FLOAT NOT NULL,
    rate_multiplier FLOAT NOT NULL DEFAULT 1.0,
    description TEXT
);

CREATE TABLE IF NOT EXISTS parking_floors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL REFERENCES parking_lots(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    floor_name VARCHAR(80) NOT NULL,
    clearance_height_m FLOAT NOT NULL DEFAULT 2.4,
    total_bays INTEGER NOT NULL DEFAULT 8,
    has_ev_chargers BOOLEAN NOT NULL DEFAULT 1,
    UNIQUE(lot_id, floor_number)
);

CREATE TABLE IF NOT EXISTS parking_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL REFERENCES parking_lots(id) ON DELETE CASCADE,
    floor_id INTEGER NOT NULL REFERENCES parking_floors(id) ON DELETE CASCADE,
    zone_code VARCHAR(24) NOT NULL,
    zone_name VARCHAR(100) NOT NULL,
    dedicated_category VARCHAR(32) NOT NULL DEFAULT 'ALL',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    UNIQUE(floor_id, zone_code)
);

CREATE TABLE IF NOT EXISTS availability_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL REFERENCES parking_lots(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0=Monday .. 6=Sunday
    open_time VARCHAR(8) NOT NULL DEFAULT '00:00',
    close_time VARCHAR(8) NOT NULL DEFAULT '23:59',
    is_24_hours BOOLEAN NOT NULL DEFAULT 1,
    is_closed BOOLEAN NOT NULL DEFAULT 0,
    peak_start_time VARCHAR(8) NOT NULL DEFAULT '09:00',
    peak_end_time VARCHAR(8) NOT NULL DEFAULT '20:00',
    UNIQUE(lot_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS pricing_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL REFERENCES parking_lots(id) ON DELETE CASCADE,
    rule_name VARCHAR(120) NOT NULL,
    rule_type VARCHAR(40) NOT NULL,
    multiplier FLOAT NOT NULL DEFAULT 1.0,
    flat_surcharge_inr FLOAT NOT NULL DEFAULT 0.0,
    min_duration_hours FLOAT NOT NULL DEFAULT 0.0,
    applies_to_slot_type VARCHAR(32) DEFAULT 'ALL',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS booking_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    booking_reference VARCHAR(36) NOT NULL,
    event_type VARCHAR(48) NOT NULL,
    previous_status VARCHAR(32),
    new_status VARCHAR(32),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_booking_events_ref ON booking_events(booking_reference);
