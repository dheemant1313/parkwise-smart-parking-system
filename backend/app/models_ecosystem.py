"""Phase 08: Advanced Parkwise Ecosystem Database Models.

Covers all 15 Phase 08 modules:
1. EV charging bay reservations
2. Monthly parking subscriptions
3. Corporate parking accounts
4. Fleet wallets
5. Group parking reservations
6. Event parking
7. WhatsApp booking notifications
8. Hindi and regional language support
9. Shared parking marketplace
10. Parking operator multi-location management
11. Camera-based occupancy detection architecture
12. ANPR integration architecture
13. YOLO-based parking occupancy detection
14. OCR-based number plate recognition
15. Valet service support
"""
import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base
from app.models import utc_now


# ----------------------------------------------------------------------------
# 1. EV Charging Bay Reservations
# ----------------------------------------------------------------------------
class EVConnectorType(str, enum.Enum):
    CCS2 = "CCS2"
    TYPE2 = "TYPE2"
    CHADEMO = "CHADEMO"
    BHARAT_DC001 = "BHARAT_DC001"
    WALL_SOCKET = "WALL_SOCKET"


class EVChargingStatus(str, enum.Enum):
    RESERVED = "RESERVED"
    PLUGGED_IN = "PLUGGED_IN"
    CHARGING = "CHARGING"
    COMPLETED = "COMPLETED"
    DISCONNECTED = "DISCONNECTED"
    IDLE_PENALTY = "IDLE_PENALTY"


class EVChargingSession(Base):
    __tablename__ = "ev_charging_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_code = Column(String(48), unique=True, index=True, nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=False, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    user_email = Column(String(120), nullable=False, index=True)

    connector_type = Column(
        Enum(EVConnectorType), default=EVConnectorType.CCS2, nullable=False
    )
    power_rating_kw = Column(Float, default=50.0, nullable=False)
    initial_soc_pct = Column(Float, default=20.0, nullable=False)
    target_soc_pct = Column(Float, default=80.0, nullable=False)
    current_soc_pct = Column(Float, default=20.0, nullable=False)
    energy_consumed_kwh = Column(Float, default=0.0, nullable=False)
    energy_tariff_per_kwh_inr = Column(Float, default=18.5, nullable=False)
    charging_fee_inr = Column(Float, default=0.0, nullable=False)
    idle_overstay_fee_inr = Column(Float, default=0.0, nullable=False)

    charging_status = Column(
        Enum(EVChargingStatus), default=EVChargingStatus.RESERVED, nullable=False
    )
    scheduled_start = Column(DateTime(timezone=True), nullable=False)
    scheduled_end = Column(DateTime(timezone=True), nullable=False)
    plugged_in_at = Column(DateTime(timezone=True), nullable=True)
    charging_started_at = Column(DateTime(timezone=True), nullable=True)
    charging_ended_at = Column(DateTime(timezone=True), nullable=True)
    disconnected_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ----------------------------------------------------------------------------
# 2. Monthly Parking Subscriptions
# ----------------------------------------------------------------------------
class SubscriptionPlanType(str, enum.Enum):
    COMMUTER_WEEKDAY = "COMMUTER_WEEKDAY"
    UNLIMITED_247 = "UNLIMITED_247"
    RESIDENTIAL_NIGHT = "RESIDENTIAL_NIGHT"
    DEDICATED_BAY = "DEDICATED_BAY"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRING_SOON = "EXPIRING_SOON"
    RENEWED = "RENEWED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class ParkingSubscription(Base):
    __tablename__ = "parking_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    subscription_code = Column(String(48), unique=True, index=True, nullable=False)
    user_email = Column(String(120), nullable=False, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    dedicated_slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=True)

    plan_type = Column(
        Enum(SubscriptionPlanType), default=SubscriptionPlanType.COMMUTER_WEEKDAY, nullable=False
    )
    title = Column(String(120), nullable=False)
    primary_vehicle_plate = Column(String(24), nullable=False, index=True)
    secondary_vehicle_plate = Column(String(24), nullable=True)
    monthly_fee_inr = Column(Float, nullable=False)
    gst_inr = Column(Float, nullable=False)
    total_fee_inr = Column(Float, nullable=False)

    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    next_billing_date = Column(DateTime(timezone=True), nullable=False)
    auto_renew = Column(Boolean, default=True, nullable=False)
    status = Column(
        Enum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE, nullable=False
    )
    pass_qr_code = Column(String(64), unique=True, nullable=False)
    rfid_card_tag = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ----------------------------------------------------------------------------
# 3. Corporate Parking Accounts
# ----------------------------------------------------------------------------
class CorporateAccount(Base):
    __tablename__ = "corporate_accounts"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(140), unique=True, index=True, nullable=False)
    corporate_code = Column(String(32), unique=True, index=True, nullable=False)
    authorized_domain = Column(String(80), nullable=False, index=True)  # e.g., "infosys.com"
    gst_number = Column(String(32), nullable=True)
    billing_contact_email = Column(String(120), nullable=False)
    monthly_credit_limit_inr = Column(Float, default=250000.0, nullable=False)
    current_month_spend_inr = Column(Float, default=0.0, nullable=False)
    is_postpaid = Column(Boolean, default=True, nullable=False)
    allocated_daily_slots = Column(Integer, default=50, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class CorporateMember(Base):
    __tablename__ = "corporate_members"

    id = Column(Integer, primary_key=True, index=True)
    corporate_id = Column(Integer, ForeignKey("corporate_accounts.id"), nullable=False, index=True)
    employee_email = Column(String(120), unique=True, index=True, nullable=False)
    employee_name = Column(String(120), nullable=False)
    employee_id_tag = Column(String(48), nullable=False)
    monthly_stipend_inr = Column(Float, default=5000.0, nullable=False)
    current_month_used_inr = Column(Float, default=0.0, nullable=False)
    vehicle_plate = Column(String(24), nullable=False)
    is_approved = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ----------------------------------------------------------------------------
# 4. Fleet Wallets
# ----------------------------------------------------------------------------
class FleetAccount(Base):
    __tablename__ = "fleet_accounts"

    id = Column(Integer, primary_key=True, index=True)
    fleet_code = Column(String(32), unique=True, index=True, nullable=False)
    fleet_name = Column(String(140), nullable=False)
    operator_email = Column(String(120), nullable=False, index=True)
    wallet_balance_inr = Column(Float, default=50000.0, nullable=False)
    auto_recharge_threshold_inr = Column(Float, default=10000.0, nullable=False)
    auto_recharge_amount_inr = Column(Float, default=25000.0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class FleetVehicle(Base):
    __tablename__ = "fleet_vehicles"

    id = Column(Integer, primary_key=True, index=True)
    fleet_id = Column(Integer, ForeignKey("fleet_accounts.id"), nullable=False, index=True)
    plate_number = Column(String(24), unique=True, index=True, nullable=False)
    driver_name = Column(String(120), nullable=False)
    driver_phone = Column(String(20), nullable=False)
    daily_spend_limit_inr = Column(Float, default=1500.0, nullable=False)
    today_spent_inr = Column(Float, default=0.0, nullable=False)
    fastag_tag_id = Column(String(48), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class FleetTransaction(Base):
    __tablename__ = "fleet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    fleet_id = Column(Integer, ForeignKey("fleet_accounts.id"), nullable=False, index=True)
    vehicle_plate = Column(String(24), nullable=False, index=True)
    booking_reference = Column(String(48), nullable=True)
    amount_inr = Column(Float, nullable=False)
    transaction_type = Column(String(32), nullable=False)  # "DEBIT_PARKING", "CREDIT_TOPUP", "DEBIT_EV"
    description = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ----------------------------------------------------------------------------
# 5. Group Parking Reservations
# ----------------------------------------------------------------------------
class GroupPaymentMode(str, enum.Enum):
    HOST_PAYS_ALL = "HOST_PAYS_ALL"
    SPLIT_INDIVIDUAL = "SPLIT_INDIVIDUAL"


class GroupReservation(Base):
    __tablename__ = "group_reservations"

    id = Column(Integer, primary_key=True, index=True)
    group_code = Column(String(32), unique=True, index=True, nullable=False)
    title = Column(String(140), nullable=False)
    host_email = Column(String(120), nullable=False, index=True)
    host_phone = Column(String(20), nullable=False)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)

    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    target_slots_count = Column(Integer, nullable=False)
    confirmed_slots_count = Column(Integer, default=0, nullable=False)
    payment_mode = Column(
        Enum(GroupPaymentMode), default=GroupPaymentMode.HOST_PAYS_ALL, nullable=False
    )
    total_estimated_amount_inr = Column(Float, nullable=False)
    status = Column(String(32), default="ACTIVE", nullable=False)  # "ACTIVE", "CONFIRMED", "CANCELLED"
    created_at = Column(DateTime(timezone=True), default=utc_now)


class GroupReservationGuest(Base):
    __tablename__ = "group_reservation_guests"

    id = Column(Integer, primary_key=True, index=True)
    group_reservation_id = Column(
        Integer, ForeignKey("group_reservations.id"), nullable=False, index=True
    )
    guest_name = Column(String(120), nullable=False)
    guest_phone = Column(String(20), nullable=False)
    vehicle_plate = Column(String(24), nullable=False)
    assigned_slot_number = Column(String(32), nullable=True)
    invitation_token = Column(String(48), unique=True, nullable=False)
    has_checked_in = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ----------------------------------------------------------------------------
# 6. Event Parking
# ----------------------------------------------------------------------------
class ParkingEvent(Base):
    __tablename__ = "parking_events"

    id = Column(Integer, primary_key=True, index=True)
    event_code = Column(String(32), unique=True, index=True, nullable=False)
    event_name = Column(String(160), nullable=False)
    venue_name = Column(String(140), nullable=False)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)

    event_date = Column(DateTime(timezone=True), nullable=False)
    gates_open_time = Column(DateTime(timezone=True), nullable=False)
    event_end_time = Column(DateTime(timezone=True), nullable=False)

    total_allocated_bays = Column(Integer, default=200, nullable=False)
    booked_bays_count = Column(Integer, default=0, nullable=False)
    flat_event_fee_inr = Column(Float, default=250.0, nullable=False)
    shuttle_service_included = Column(Boolean, default=True, nullable=False)
    traffic_advisory = Column(Text, nullable=True)
    status = Column(String(32), default="PUBLISHED", nullable=False)  # "PUBLISHED", "LIVE", "CONCLUDED"
    created_at = Column(DateTime(timezone=True), default=utc_now)


class EventParkingPass(Base):
    __tablename__ = "event_parking_passes"

    id = Column(Integer, primary_key=True, index=True)
    pass_code = Column(String(48), unique=True, index=True, nullable=False)
    event_id = Column(Integer, ForeignKey("parking_events.id"), nullable=False, index=True)
    user_email = Column(String(120), nullable=False, index=True)
    vehicle_plate = Column(String(24), nullable=False)
    assigned_entry_gate = Column(String(48), default="GATE-NORTH-A", nullable=False)
    fee_paid_inr = Column(Float, nullable=False)
    shuttle_pass_token = Column(String(48), nullable=True)
    is_scanned = Column(Boolean, default=False, nullable=False)
    scanned_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ----------------------------------------------------------------------------
# 7. WhatsApp Booking Notifications
# ----------------------------------------------------------------------------
class WhatsAppNotificationLog(Base):
    __tablename__ = "whatsapp_notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    message_sid = Column(String(64), unique=True, index=True, nullable=False)
    booking_reference = Column(String(48), nullable=True, index=True)
    recipient_phone = Column(String(20), nullable=False, index=True)
    template_name = Column(String(64), nullable=False)
    language_code = Column(String(8), default="en", nullable=False)
    message_body = Column(Text, nullable=False)

    provider = Column(String(48), default="META_CLOUD_API_SIMULATED", nullable=False)
    delivery_status = Column(String(32), default="DELIVERED", nullable=False)  # "QUEUED", "SENT", "DELIVERED", "READ"
    is_mock_provider = Column(Boolean, default=True, nullable=False)
    delivered_at = Column(DateTime(timezone=True), default=utc_now)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ----------------------------------------------------------------------------
# 8. Hindi and Regional Language Support
# ----------------------------------------------------------------------------
class LocalizationString(Base):
    __tablename__ = "localization_strings"

    id = Column(Integer, primary_key=True, index=True)
    translation_key = Column(String(120), index=True, nullable=False)
    locale_code = Column(String(10), index=True, nullable=False)  # "en", "hi", "mr", "kn", "te", "ta"
    translated_text = Column(Text, nullable=False)
    category = Column(String(48), default="UI_LABEL", nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        Index("ix_locale_key_unique", "translation_key", "locale_code", unique=True),
    )


# ----------------------------------------------------------------------------
# 9. Shared Parking Marketplace
# ----------------------------------------------------------------------------
class MarketplaceListingStatus(str, enum.Enum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    DELISTED = "DELISTED"


class MarketplaceListing(Base):
    __tablename__ = "marketplace_listings"

    id = Column(Integer, primary_key=True, index=True)
    listing_code = Column(String(48), unique=True, index=True, nullable=False)
    host_email = Column(String(120), nullable=False, index=True)
    host_name = Column(String(120), nullable=False)
    host_phone = Column(String(20), nullable=False)

    title = Column(String(160), nullable=False)
    address = Column(String(255), nullable=False)
    city = Column(String(80), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    space_type = Column(String(48), default="RESIDENTIAL_DRIVEWAY", nullable=False)  # DRIVEWAY, BASEMENT, OPEN_PLOT
    hourly_rate_inr = Column(Float, default=40.0, nullable=False)
    daily_rate_inr = Column(Float, default=250.0, nullable=False)
    platform_commission_pct = Column(Float, default=15.0, nullable=False)

    access_instructions = Column(Text, nullable=True)
    is_ev_ready = Column(Boolean, default=False, nullable=False)
    kyc_verified = Column(Boolean, default=True, nullable=False)
    status = Column(
        Enum(MarketplaceListingStatus), default=MarketplaceListingStatus.ACTIVE, nullable=False
    )
    created_at = Column(DateTime(timezone=True), default=utc_now)


class MarketplaceBooking(Base):
    __tablename__ = "marketplace_bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_code = Column(String(48), unique=True, index=True, nullable=False)
    listing_id = Column(Integer, ForeignKey("marketplace_listings.id"), nullable=False, index=True)
    renter_email = Column(String(120), nullable=False, index=True)
    renter_name = Column(String(120), nullable=False)
    vehicle_plate = Column(String(24), nullable=False)

    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    gross_amount_inr = Column(Float, nullable=False)
    platform_fee_inr = Column(Float, nullable=False)
    host_payout_inr = Column(Float, nullable=False)

    status = Column(String(32), default="CONFIRMED", nullable=False)  # CONFIRMED, COMPLETED, CANCELLED
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ----------------------------------------------------------------------------
# 10. Parking Operator Multi-Location Management
# ----------------------------------------------------------------------------
class OperatorRegion(Base):
    __tablename__ = "operator_regions"

    id = Column(Integer, primary_key=True, index=True)
    region_code = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(120), nullable=False)
    headquarters_city = Column(String(80), nullable=False)
    supervising_manager_email = Column(String(120), nullable=False)
    active_facilities_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class OperatorFacilityGroup(Base):
    __tablename__ = "operator_facility_groups"

    id = Column(Integer, primary_key=True, index=True)
    region_id = Column(Integer, ForeignKey("operator_regions.id"), nullable=False, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), unique=True, nullable=False, index=True)
    tier = Column(String(32), default="METRO_CENTRAL", nullable=False)  # "METRO_CENTRAL", "SUBURBAN_TRANSIT", "AIRPORT"
    regional_surge_cap = Column(Float, default=2.25, nullable=False)
    central_pricing_override_active = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ----------------------------------------------------------------------------
# 11 & 13. Camera-Based Occupancy Detection & YOLO Architecture
# ----------------------------------------------------------------------------
class CameraStream(Base):
    __tablename__ = "camera_streams"

    id = Column(Integer, primary_key=True, index=True)
    camera_code = Column(String(48), unique=True, index=True, nullable=False)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    zone_name = Column(String(48), default="Zone A", nullable=False)
    stream_url = Column(String(255), default="rtsp://cctv.local:8554/cam01", nullable=False)
    stream_protocol = Column(String(24), default="RTSP", nullable=False)
    resolution = Column(String(24), default="1080p", nullable=False)
    fps = Column(Integer, default=15, nullable=False)

    status = Column(String(24), default="ONLINE", nullable=False)  # "ONLINE", "DEGRADED", "OFFLINE"
    privacy_redaction_enabled = Column(Boolean, default=True, nullable=False)  # Face & Pedestrian blur
    monitored_slots_json = Column(Text, nullable=True)  # List of slot IDs & polygon coordinates
    last_heartbeat_at = Column(DateTime(timezone=True), default=utc_now)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class YOLODetectionRun(Base):
    __tablename__ = "yolo_detection_runs"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("camera_streams.id"), nullable=False, index=True)
    model_version = Column(String(48), default="YOLOv8-Parking-Precision-v1.4", nullable=False)
    inference_latency_ms = Column(Float, default=38.4, nullable=False)
    detected_vehicles_count = Column(Integer, default=0, nullable=False)
    occupied_slots_count = Column(Integer, default=0, nullable=False)
    vacant_slots_count = Column(Integer, default=0, nullable=False)

    bounding_boxes_json = Column(Text, nullable=True)
    privacy_audit_status = Column(String(32), default="REDACTION_APPLIED_NO_PII", nullable=False)
    is_synthetic_test = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ----------------------------------------------------------------------------
# 12 & 14. ANPR Integration & OCR Architecture
# ----------------------------------------------------------------------------
class ANPRScanEvent(Base):
    __tablename__ = "anpr_scan_events"

    id = Column(Integer, primary_key=True, index=True)
    scan_code = Column(String(48), unique=True, index=True, nullable=False)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    camera_id = Column(Integer, ForeignKey("camera_streams.id"), nullable=True)
    gate_lane = Column(String(32), default="LANE-ENTRY-01", nullable=False)
    lane_type = Column(String(16), default="ENTRY", nullable=False)  # "ENTRY", "EXIT"

    captured_plate_raw = Column(String(32), nullable=False)
    normalized_plate = Column(String(24), index=True, nullable=False)
    confidence_score = Column(Float, nullable=False)  # e.g., 0.94
    ocr_engine = Column(String(48), default="EasyOCR-HSRP-IndianStandard-v2", nullable=False)
    is_hsrp_compliant = Column(Boolean, default=True, nullable=False)

    decision = Column(String(32), default="AUTO_ALLOWED", nullable=False)  # "AUTO_ALLOWED", "HUMAN_REVIEW_REQUIRED", "REJECTED"
    human_verified = Column(Boolean, default=False, nullable=False)
    verified_by_staff_email = Column(String(120), nullable=True)
    privacy_plate_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class ANPRHumanReviewQueue(Base):
    __tablename__ = "anpr_human_review_queue"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("anpr_scan_events.id"), nullable=False, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    captured_plate = Column(String(32), nullable=False)
    candidate_matches_json = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=False)
    reason = Column(String(120), default="LOW_CONFIDENCE_CHARACTERS", nullable=False)

    status = Column(String(32), default="PENDING", nullable=False)  # "PENDING", "APPROVED", "REJECTED", "MANUAL_CORRECTED"
    resolved_plate = Column(String(24), nullable=True)
    reviewer_email = Column(String(120), nullable=True)
    notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


# ----------------------------------------------------------------------------
# 15. Valet Service Support
# ----------------------------------------------------------------------------
class ValetTicketStatus(str, enum.Enum):
    ACCEPTED_AT_KIOSK = "ACCEPTED_AT_KIOSK"
    PARKED = "PARKED"
    RETRIEVAL_REQUESTED = "RETRIEVAL_REQUESTED"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED_TO_CUSTOMER = "DELIVERED_TO_CUSTOMER"


class ValetTicket(Base):
    __tablename__ = "valet_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_code = Column(String(32), unique=True, index=True, nullable=False)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)

    customer_name = Column(String(120), nullable=False)
    customer_phone = Column(String(20), nullable=False)
    vehicle_plate = Column(String(24), index=True, nullable=False)
    vehicle_model = Column(String(80), default="Sedan", nullable=False)

    assigned_valet_name = Column(String(120), default="Ramesh Kumar", nullable=False)
    key_locker_tag = Column(String(32), default="LOCKER-B-14", nullable=False)
    assigned_slot_number = Column(String(32), nullable=True)

    valet_fee_inr = Column(Float, default=150.0, nullable=False)
    status = Column(
        Enum(ValetTicketStatus), default=ValetTicketStatus.ACCEPTED_AT_KIOSK, nullable=False
    )
    odometer_reading_km = Column(Float, default=12450.0, nullable=False)
    fuel_or_battery_level_pct = Column(Float, default=75.0, nullable=False)
    pre_existing_damage_notes = Column(String(255), default="Minor front bumper scratch (pre-existing)", nullable=True)

    dropoff_time = Column(DateTime(timezone=True), default=utc_now)
    retrieval_requested_at = Column(DateTime(timezone=True), nullable=True)
    delivery_time = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
