-- Phase 06 Migration: Parking Operator Dashboard, Facility Staff Management & No-Show Tracking
-- Compatible with PostgreSQL 15+ and SQLite 3.35+

ALTER TABLE bookings ADD COLUMN is_no_show BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS facility_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL REFERENCES parking_lots(id) ON DELETE CASCADE,
    employee_code VARCHAR(32) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL,
    phone VARCHAR(24) NOT NULL,
    role_title VARCHAR(80) NOT NULL,
    shift_window VARCHAR(64) NOT NULL DEFAULT '08:00-16:00 IST (Day Shift)',
    assigned_zone VARCHAR(80) NOT NULL DEFAULT 'All Floors & Gate Lanes',
    is_on_duty BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_facility_staff_lot_id ON facility_staff(lot_id);
CREATE INDEX IF NOT EXISTS ix_facility_staff_employee_code ON facility_staff(employee_code);
