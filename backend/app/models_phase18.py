"""Phase 18: Relational Database Models for Flexible Parking & Advanced Driver Needs.

Covers:
1. EV Charging Stations & OCPP Charging Sessions (kWh, power, tariffs, verified events)
2. Accessibility Credentials & ADA Compliance Configurations
3. Family and Group Bookings with Staggered Multi-Slot Credentials
4. Smart Waitlist Queue with Atomic Slot Offers & Expiration Protection
"""

import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EVChargerStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    CHARGING = "CHARGING"
    RESERVED = "RESERVED"
    FAULT = "FAULT"
    OFFLINE = "OFFLINE"


class EVChargingSessionStatus(str, enum.Enum):
    STARTING = "STARTING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    STOPPED_BY_USER = "STOPPED_BY_USER"
    FAULT_TERMINATED = "FAULT_TERMINATED"


class GroupBookingStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    PARTIALLY_ARRIVED = "PARTIALLY_ARRIVED"
    ALL_ACTIVE = "ALL_ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class GroupMemberStatus(str, enum.Enum):
    RESERVED = "RESERVED"
    CHECKED_IN = "CHECKED_IN"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class WaitlistStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    NOTIFIED_OFFER_ACTIVE = "NOTIFIED_OFFER_ACTIVE"
    CLAIMED = "CLAIMED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class EVChargerStation(Base):
    """Physical EV charging point associated with an electric parking bay."""
    __tablename__ = "ev_charger_stations"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=False, unique=True, index=True)
    charger_code = Column(String(32), unique=True, index=True, nullable=False)
    manufacturer = Column(String(80), default="Schneider Electric / Delta EV", nullable=False)
    model_name = Column(String(80), default="CityFast DC 60kW", nullable=False)
    connector_types_json = Column(String(255), default='["CCS2", "TYPE2_AC"]', nullable=False)
    max_power_kw = Column(Float, default=60.0, nullable=False)
    status = Column(SQLEnum(EVChargerStatus), default=EVChargerStatus.AVAILABLE, nullable=False, index=True)
    energy_tariff_per_kwh_inr = Column(Float, default=18.50, nullable=False)
    idle_fee_per_min_inr = Column(Float, default=2.00, nullable=False)
    firmware_version = Column(String(40), default="OCPP-1.6J-v4.2.1", nullable=False)
    last_heartbeat_at = Column(DateTime(timezone=True), default=utc_now)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    facility = relationship("ParkingLot")
    slot = relationship("ParkingSlot")
    sessions = relationship("EVSmartChargingSession", back_populates="charger", cascade="all, delete-orphan")


class EVSmartChargingSession(Base):
    """Live or historical EV charging session verified by hardware telemetry events."""
    __tablename__ = "ev_smart_charging_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_reference = Column(String(40), unique=True, index=True, nullable=False)
    charger_id = Column(Integer, ForeignKey("ev_charger_stations.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    vehicle_number = Column(String(30), nullable=False, index=True)
    connector_used = Column(String(32), default="CCS2", nullable=False)

    start_time = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    initial_soc_percent = Column(Integer, default=20, nullable=False)
    current_soc_percent = Column(Integer, default=20, nullable=False)
    target_soc_percent = Column(Integer, default=90, nullable=False)

    energy_delivered_kwh = Column(Float, default=0.0, nullable=False)
    charging_rate_kw = Column(Float, default=0.0, nullable=False)
    energy_cost_inr = Column(Float, default=0.0, nullable=False)
    idle_cost_inr = Column(Float, default=0.0, nullable=False)
    total_charging_cost_inr = Column(Float, default=0.0, nullable=False)

    status = Column(
        SQLEnum(EVChargingSessionStatus),
        default=EVChargingSessionStatus.STARTING,
        nullable=False,
        index=True,
    )
    ocpp_transaction_id = Column(String(64), unique=True, index=True, nullable=False)
    verified_hardware_event = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    charger = relationship("EVChargerStation", back_populates="sessions")
    booking = relationship("Booking")


class AccessibilityCredential(Base):
    """Verified accessibility credential or disability badge for PWD bay access."""
    __tablename__ = "accessibility_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    badge_number = Column(String(64), unique=True, index=True, nullable=False)  # UDID card or blue badge
    issuing_authority = Column(String(120), default="Ministry of Social Justice & Empowerment (India)", nullable=False)
    holder_name = Column(String(120), nullable=False)
    disability_type = Column(String(80), default="LOCOMOTOR", nullable=False)
    is_verified = Column(Boolean, default=True, nullable=False)
    verified_by = Column(String(160), default="system_compliance@parkwise.in", nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User")


class GroupBooking(Base):
    """Parent group booking reservation encompassing multiple parking spaces."""
    __tablename__ = "group_bookings"

    id = Column(Integer, primary_key=True, index=True)
    group_reference = Column(String(40), unique=True, index=True, nullable=False)
    organizer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    group_name = Column(String(140), nullable=False)
    notes = Column(Text, nullable=True)

    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False, index=True)
    total_spaces_reserved = Column(Integer, default=2, nullable=False)
    total_amount_inr = Column(Float, default=0.0, nullable=False)
    status = Column(
        SQLEnum(GroupBookingStatus),
        default=GroupBookingStatus.CONFIRMED,
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), default=utc_now)

    organizer = relationship("User")
    facility = relationship("ParkingLot")
    members = relationship("GroupBookingMember", back_populates="group", cascade="all, delete-orphan")


class GroupBookingMember(Base):
    """Individual vehicle space within a family/group reservation with independent QR and check-in."""
    __tablename__ = "group_booking_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("group_bookings.id"), nullable=False, index=True)
    slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    vehicle_number = Column(String(30), nullable=False, index=True)
    driver_name = Column(String(120), nullable=False)
    driver_phone = Column(String(24), nullable=False)

    qr_token_jti = Column(String(64), unique=True, index=True, nullable=False)
    qr_signature = Column(String(255), nullable=False)
    status = Column(
        SQLEnum(GroupMemberStatus),
        default=GroupMemberStatus.RESERVED,
        nullable=False,
        index=True,
    )
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    checked_out_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    group = relationship("GroupBooking", back_populates="members")
    slot = relationship("ParkingSlot")
    booking = relationship("Booking")


class FacilityWaitlistEntry(Base):
    """Queue entry for full parking facilities with atomic claim locks upon vacancy."""
    __tablename__ = "facility_waitlist_entries"

    id = Column(Integer, primary_key=True, index=True)
    waitlist_reference = Column(String(40), unique=True, index=True, nullable=False)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    vehicle_plate = Column(String(30), nullable=False, index=True)
    driver_name = Column(String(120), nullable=False)
    driver_phone = Column(String(24), nullable=False)
    required_slot_type = Column(String(32), default="STANDARD", nullable=False)

    requested_start_time = Column(DateTime(timezone=True), nullable=False)
    requested_end_time = Column(DateTime(timezone=True), nullable=False)
    queue_position = Column(Integer, default=1, nullable=False)
    status = Column(
        SQLEnum(WaitlistStatus),
        default=WaitlistStatus.QUEUED,
        nullable=False,
        index=True,
    )

    offered_slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=True, index=True)
    offer_expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    converted_booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    facility = relationship("ParkingLot")
    user = relationship("User")
    offered_slot = relationship("ParkingSlot", foreign_keys=[offered_slot_id])
    converted_booking = relationship("Booking", foreign_keys=[converted_booking_id])
