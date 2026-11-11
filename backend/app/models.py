"""Relational Database Models for Parkwise Enterprise Platform."""
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Index,
)
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    DRIVER = "DRIVER"
    OPERATOR = "OPERATOR"
    GATE_STAFF = "GATE_STAFF"
    ADMIN = "ADMIN"


class SlotType(str, enum.Enum):
    STANDARD = "STANDARD"
    EV_CHARGING = "EV_CHARGING"
    ACCESSIBLE = "ACCESSIBLE"
    SUV_XL = "SUV_XL"


class SlotStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    OCCUPIED = "OCCUPIED"
    MAINTENANCE = "MAINTENANCE"


class BookingStatus(str, enum.Enum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    CONFIRMED = "CONFIRMED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class PaymentStatus(str, enum.Enum):
    CREATED = "CREATED"
    AUTHORIZED = "AUTHORIZED"
    CAPTURED = "CAPTURED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(80), nullable=False)
    description = Column(Text, nullable=False)
    is_system_role = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    role_permissions = relationship(
        "RolePermission", back_populates="role", cascade="all, delete-orphan"
    )


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(120), nullable=False)
    module = Column(String(40), nullable=False)
    description = Column(Text, nullable=False)

    role_permissions = relationship(
        "RolePermission", back_populates="permission", cascade="all, delete-orphan"
    )


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
    permission_id = Column(
        Integer, ForeignKey("permissions.id"), nullable=False, index=True
    )

    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(160), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.DRIVER, nullable=False)
    vehicle_number = Column(String(30), nullable=True)
    fastag_id = Column(String(60), nullable=True)
    home_city = Column(String(80), default="New Delhi", nullable=False)
    gst_number = Column(String(32), nullable=True)
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_token = Column(String(128), nullable=True, index=True)
    password_reset_token = Column(String(128), nullable=True, index=True)
    reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    fastag_auto_debit = Column(Boolean, default=True, nullable=False)
    sms_receipts = Column(Boolean, default=True, nullable=False)
    whatsapp_alerts = Column(Boolean, default=True, nullable=False)
    accessible_priority = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    deactivated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    bookings = relationship("Booking", back_populates="user")
    vehicles = relationship(
        "Vehicle", back_populates="user", cascade="all, delete-orphan"
    )
    sessions = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_token_jti = Column(String(64), unique=True, index=True, nullable=False)
    ip_address = Column(String(64), default="127.0.0.1", nullable=False)
    user_agent = Column(
        String(255), default="Parkwise-Enterprise-Client/2.4", nullable=False
    )
    device_label = Column(
        String(120), default="Web Browser Session", nullable=False
    )
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_active_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="sessions")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    plate_number = Column(String(30), index=True, nullable=False)
    model_name = Column(String(120), nullable=False)
    size_class = Column(String(24), default="SEDAN", nullable=False)
    dimensions_label = Column(
        String(64), default="4.58m × 1.82m × 1.50m", nullable=False
    )
    is_ev = Column(Boolean, default=False, nullable=False)
    fastag_id = Column(String(60), default="FT-NPCI-ICICI-892104", nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="vehicles")


class ParkingLot(Base):
    __tablename__ = "parking_lots"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(160), nullable=False)
    city = Column(String(80), index=True, nullable=False)
    address = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    total_floors = Column(Integer, default=3, nullable=False)
    base_hourly_rate_inr = Column(Float, default=60.0, nullable=False)
    ev_surcharge_inr = Column(Float, default=40.0, nullable=False)
    dynamic_pricing_enabled = Column(Boolean, default=True, nullable=False)
    current_surge_multiplier = Column(Float, default=1.0, nullable=False)
    anpr_enabled = Column(Boolean, default=True, nullable=False)
    fastag_enabled = Column(Boolean, default=True, nullable=False)
    operator_name = Column(String(140), nullable=False)
    kyc_verified = Column(Boolean, default=True, nullable=False)
    rating = Column(Float, default=4.8, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    slots = relationship(
        "ParkingSlot", back_populates="lot", cascade="all, delete-orphan"
    )
    bookings = relationship("Booking", back_populates="lot")


class ParkingSlot(Base):
    __tablename__ = "parking_slots"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    slot_number = Column(String(24), nullable=False)
    floor = Column(Integer, default=1, nullable=False)
    zone = Column(String(24), default="A", nullable=False)
    slot_type = Column(Enum(SlotType), default=SlotType.STANDARD, nullable=False)
    status = Column(Enum(SlotStatus), default=SlotStatus.AVAILABLE, nullable=False)
    sensor_health = Column(String(32), default="ONLINE", nullable=False)
    power_kw = Column(Float, nullable=True)  # For EV bays

    lot = relationship("ParkingLot", back_populates="slots")
    bookings = relationship("Booking", back_populates="slot")

    __table_args__ = (
        Index("ix_lot_slot_number", "lot_id", "slot_number", unique=True),
    )


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_reference = Column(String(36), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=False, index=True)
    vehicle_number = Column(String(24), nullable=False, index=True)
    driver_name = Column(String(120), nullable=False)
    driver_phone = Column(String(20), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_hours = Column(Float, nullable=False)
    base_amount_inr = Column(Float, nullable=False)
    surge_multiplier = Column(Float, default=1.0, nullable=False)
    gst_amount_inr = Column(Float, nullable=False)
    total_amount_inr = Column(Float, nullable=False)
    status = Column(
        Enum(BookingStatus), default=BookingStatus.PENDING_PAYMENT, nullable=False
    )
    qr_signature = Column(String(128), nullable=False)
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    checked_out_at = Column(DateTime(timezone=True), nullable=True)
    overstay_fee_inr = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="bookings")
    lot = relationship("ParkingLot", back_populates="bookings")
    slot = relationship("ParkingSlot", back_populates="bookings")
    payment = relationship("Payment", back_populates="booking", uselist=False)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), unique=True, nullable=False)
    razorpay_order_id = Column(String(80), unique=True, index=True, nullable=False)
    razorpay_payment_id = Column(String(80), nullable=True)
    razorpay_signature = Column(String(255), nullable=True)
    amount_inr = Column(Float, nullable=False)
    currency = Column(String(8), default="INR", nullable=False)
    payment_method = Column(String(40), default="UPI / Razorpay", nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.CREATED, nullable=False)
    is_simulated = Column(Boolean, default=True, nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    booking = relationship("Booking", back_populates="payment")


class GateLog(Base):
    __tablename__ = "gate_logs"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    booking_reference = Column(String(36), nullable=True, index=True)
    vehicle_number = Column(String(24), nullable=False)
    event_type = Column(String(24), nullable=False)  # ENTRY, EXIT, DENIED, OVERRIDE
    gate_lane = Column(String(32), default="LANE-01 (ANPR+FASTag)", nullable=False)
    anpr_confidence = Column(Float, default=0.96, nullable=False)
    verification_method = Column(String(40), default="QR_HMAC + ANPR", nullable=False)
    barrier_action = Column(String(24), default="OPENED", nullable=False)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_email = Column(String(160), nullable=False)
    actor_role = Column(String(40), nullable=False)
    action = Column(String(120), nullable=False)
    target_resource = Column(String(120), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(64), default="127.0.0.1", nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
