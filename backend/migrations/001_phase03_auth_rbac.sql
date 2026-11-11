-- ============================================================================
-- PARKWISE ENTERPRISE SMART PARKING PLATFORM
-- Migration 001: Phase 03 Authentication, RBAC Permissions, Sessions & Vehicles
-- Compatible with PostgreSQL 15+ and SQLite 3.35+
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL,
    description TEXT NOT NULL,
    is_system_role BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    module VARCHAR(40) NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_jti VARCHAR(64) NOT NULL UNIQUE,
    ip_address VARCHAR(64) NOT NULL DEFAULT '127.0.0.1',
    user_agent VARCHAR(255) NOT NULL DEFAULT 'Parkwise-Enterprise-Client/2.4',
    device_label VARCHAR(120) NOT NULL DEFAULT 'Web Browser Session',
    is_revoked BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plate_number VARCHAR(30) NOT NULL,
    model_name VARCHAR(120) NOT NULL,
    size_class VARCHAR(24) NOT NULL DEFAULT 'SEDAN',
    dimensions_label VARCHAR(64) NOT NULL DEFAULT '4.58m × 1.82m × 1.50m',
    is_ev BOOLEAN NOT NULL DEFAULT 0,
    fastag_id VARCHAR(60) NOT NULL DEFAULT 'FT-NPCI-ICICI-892104',
    is_primary BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
