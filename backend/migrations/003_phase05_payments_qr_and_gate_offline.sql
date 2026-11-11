-- ============================================================================
-- PARKWISE Phase 05 Migration: Payments, Webhooks, Signed QR Passes & Gate Sync
-- ============================================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS upi_vpa VARCHAR(80);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(48);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_id VARCHAR(80);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_amount_inr FLOAT DEFAULT 0.0 NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id SERIAL PRIMARY KEY,
    webhook_event_id VARCHAR(80) UNIQUE NOT NULL,
    event_type VARCHAR(48) NOT NULL,
    razorpay_order_id VARCHAR(80) NOT NULL,
    razorpay_payment_id VARCHAR(80),
    signature_verified BOOLEAN DEFAULT TRUE NOT NULL,
    status_applied VARCHAR(32) NOT NULL,
    payload_summary TEXT,
    processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qr_pass_tokens (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    booking_reference VARCHAR(36) NOT NULL,
    token_jti VARCHAR(64) UNIQUE NOT NULL,
    qr_signature VARCHAR(255) NOT NULL,
    qr_payload TEXT NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    entry_used_at TIMESTAMPTZ,
    exit_used_at TIMESTAMPTZ,
    is_revoked BOOLEAN DEFAULT FALSE NOT NULL,
    revoked_reason VARCHAR(160),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_qr_pass_booking_ref ON qr_pass_tokens(booking_reference);

ALTER TABLE gate_logs ADD COLUMN IF NOT EXISTS client_event_id VARCHAR(80) UNIQUE;
ALTER TABLE gate_logs ADD COLUMN IF NOT EXISTS overstay_fee_inr FLOAT DEFAULT 0.0 NOT NULL;
ALTER TABLE gate_logs ADD COLUMN IF NOT EXISTS staff_override_by VARCHAR(160);
ALTER TABLE gate_logs ADD COLUMN IF NOT EXISTS staff_override_reason TEXT;
ALTER TABLE gate_logs ADD COLUMN IF NOT EXISTS sync_status VARCHAR(32) DEFAULT 'LIVE_ONLINE' NOT NULL;
