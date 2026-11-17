"""Phase 16: Models for ANPR, Automated Gate Controllers & Offline Operations.

Provides complete persistence for:
- Gate lane controllers and relay states
- ANPR camera configurations and recognition models
- ANPR scan and access verification events with privacy hashing
- Gate staff human-in-the-loop manual review queue
- Offline cryptographic manifests and event synchronization logs
- Operator manual barrier overrides with auditable compliance logging
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


class LaneDirection(str, enum.Enum):
    ENTRY = "ENTRY"
    EXIT = "EXIT"
    BIDIRECTIONAL = "BIDIRECTIONAL"


class BarrierState(str, enum.Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HOLD_OPEN = "HOLD_OPEN"
    FAULT = "FAULT"


class GateHardwareHealth(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    DEGRADED = "DEGRADED"


class AccessDecision(str, enum.Enum):
    AUTHORIZED = "AUTHORIZED"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    REJECTED_NO_BOOKING = "REJECTED_NO_BOOKING"
    REJECTED_ALREADY_ENTERED = "REJECTED_ALREADY_ENTERED"  # Anti-passback
    REJECTED_NOT_CHECKED_IN = "REJECTED_NOT_CHECKED_IN"
    REJECTED_EXPIRED = "REJECTED_EXPIRED"
    REJECTED_FUTURE = "REJECTED_FUTURE"
    REJECTED_CANCELLED = "REJECTED_CANCELLED"
    QR_FALLBACK_AUTHORIZED = "QR_FALLBACK_AUTHORIZED"
    OFFLINE_AUTHORIZED = "OFFLINE_AUTHORIZED"
    MANUAL_OVERRIDE_AUTHORIZED = "MANUAL_OVERRIDE_AUTHORIZED"


class VerificationMethod(str, enum.Enum):
    ANPR = "ANPR"
    QR_CODE = "QR_CODE"
    MANUAL_OVERRIDE = "MANUAL_OVERRIDE"
    OFFLINE_LOCAL_CRYPTO = "OFFLINE_LOCAL_CRYPTO"


class GateReviewStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED_AS_IS = "APPROVED_AS_IS"
    CORRECTED_AND_APPROVED = "CORRECTED_AND_APPROVED"
    REJECTED = "REJECTED"


class GateLaneController(Base):
    """Physical or virtual gate lane with boom barrier relay controller."""
    __tablename__ = "gate_lane_controllers"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    lane_code = Column(String(32), unique=True, index=True, nullable=False)  # e.g., "LANE-ENT-01"
    lane_name = Column(String(80), nullable=False)  # e.g., "North Gate Entry - Lane 1"
    direction = Column(SQLEnum(LaneDirection), default=LaneDirection.ENTRY, nullable=False)

    ip_address = Column(String(48), default="192.168.10.101", nullable=False)
    mqtt_topic = Column(String(120), default="parkwise/gate/lane1/control", nullable=False)
    controller_model = Column(String(80), default="Magnetic-Autocontrol-M-Pro-Relay", nullable=False)
    controller_secret_token = Column(String(64), default="pw_gate_sec_token_9921", nullable=False)

    barrier_state = Column(SQLEnum(BarrierState), default=BarrierState.CLOSED, nullable=False)
    hardware_health = Column(SQLEnum(GateHardwareHealth), default=GateHardwareHealth.ONLINE, nullable=False)
    last_heartbeat_at = Column(DateTime(timezone=True), default=utc_now)

    auto_open_enabled = Column(Boolean, default=True, nullable=False)
    anti_passback_enabled = Column(Boolean, default=True, nullable=False)
    early_entry_grace_minutes = Column(Integer, default=30, nullable=False)
    exit_grace_minutes = Column(Integer, default=15, nullable=False)

    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    facility = relationship("ParkingLot")
    cameras = relationship("ANPRCamera", back_populates="lane", cascade="all, delete-orphan")
    verification_events = relationship("ANPRVerificationEvent", back_populates="lane")


class ANPRCamera(Base):
    """Overhead or bollard 4K ANPR camera linked to a gate lane."""
    __tablename__ = "anpr_cameras"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    lane_id = Column(Integer, ForeignKey("gate_lane_controllers.id"), nullable=False, index=True)
    camera_code = Column(String(32), unique=True, index=True, nullable=False)  # e.g., "CAM-GATE-ENT-01"
    camera_model = Column(String(80), default="Hikvision-DarkFighter-ANPR-4K", nullable=False)
    stream_url = Column(String(200), default="rtsp://edge-gate-cam1.internal/live", nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)
    min_confidence_threshold = Column(Float, default=0.80, nullable=False)
    ocr_engine = Column(String(80), default="Indian-HSRP-YOLO-OCR-v2", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    lane = relationship("GateLaneController", back_populates="cameras")


class ANPRVerificationEvent(Base):
    """Immutable auditable log of an access attempt at a gate lane."""
    __tablename__ = "anpr_verification_events"

    id = Column(Integer, primary_key=True, index=True)
    event_uuid = Column(String(64), unique=True, index=True, nullable=False)  # For offline deduplication
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    lane_id = Column(Integer, ForeignKey("gate_lane_controllers.id"), nullable=False, index=True)
    direction = Column(SQLEnum(LaneDirection), default=LaneDirection.ENTRY, nullable=False)

    # Plate Recognition Data
    captured_plate_raw = Column(String(32), nullable=False)  # e.g., "KA 01 AB 1234"
    normalized_plate = Column(String(24), index=True, nullable=False)  # e.g., "KA01AB1234"
    confidence_score = Column(Float, nullable=False)  # 0.0 to 1.0
    plate_crop_image_url = Column(String(255), nullable=True)

    # Matched Booking Info
    matched_booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    matched_booking_reference = Column(String(36), nullable=True, index=True)

    # Access Decision & Physical Action
    decision = Column(SQLEnum(AccessDecision), nullable=False)
    decision_reason = Column(String(200), nullable=False)
    verification_method = Column(SQLEnum(VerificationMethod), default=VerificationMethod.ANPR, nullable=False)
    barrier_action = Column(String(32), default="OPENED", nullable=False)

    # Anti-Passback Tracking
    anti_passback_checked = Column(Boolean, default=True, nullable=False)
    anti_passback_status = Column(String(32), default="VALID", nullable=False)  # "VALID", "VIOLATION_ALREADY_IN", "VIOLATION_NOT_IN"

    # Human Verification
    human_reviewed = Column(Boolean, default=False, nullable=False)
    reviewer_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewer_notes = Column(Text, nullable=True)

    # Offline Sync Info
    sync_source = Column(String(32), default="ONLINE_API", nullable=False)  # "ONLINE_API" or "OFFLINE_GATE_SYNC"
    offline_client_timestamp = Column(DateTime(timezone=True), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now, index=True)

    # Privacy & DPDP Compliance
    encrypted_plate_hash = Column(String(64), nullable=False)  # SHA-256 with salt
    masked_plate = Column(String(24), nullable=False)  # e.g., "KA 01 ** 1234"

    # Relationships
    lane = relationship("GateLaneController", back_populates="verification_events")
    booking = relationship("Booking")
    reviewer = relationship("User", foreign_keys=[reviewer_user_id])
    review_task = relationship("ANPRManualReviewTask", back_populates="event", uselist=False)

    __table_args__ = (
        Index("idx_anpr_norm_facility", "normalized_plate", "facility_id"),
        Index("idx_anpr_timestamp_facility", "timestamp", "facility_id"),
    )


class ANPRManualReviewTask(Base):
    """Gate staff queue for low-confidence (<0.80) or ambiguous license plate scans."""
    __tablename__ = "anpr_manual_review_tasks"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("anpr_verification_events.id"), nullable=False, unique=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    lane_id = Column(Integer, ForeignKey("gate_lane_controllers.id"), nullable=False)

    captured_plate_raw = Column(String(32), nullable=False)
    suggested_candidates_json = Column(Text, nullable=True)  # JSON array of fuzzy plate matches
    crop_image_url = Column(String(255), nullable=True)
    confidence_score = Column(Float, nullable=False)

    status = Column(SQLEnum(GateReviewStatus), default=GateReviewStatus.PENDING, nullable=False)
    corrected_plate = Column(String(24), nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    event = relationship("ANPRVerificationEvent", back_populates="review_task")
    reviewed_by = relationship("User")


class GateOfflineManifestLog(Base):
    """Tracks cryptographic offline access tokens packaged for edge gate caches."""
    __tablename__ = "gate_offline_manifest_logs"

    id = Column(Integer, primary_key=True, index=True)
    manifest_id = Column(String(64), unique=True, index=True, nullable=False)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    window_start = Column(DateTime(timezone=True), nullable=False)
    window_end = Column(DateTime(timezone=True), nullable=False)
    total_tokens_issued = Column(Integer, nullable=False)
    hmac_key_id = Column(String(32), default="v1_2026_primary", nullable=False)
    downloaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    downloaded_at = Column(DateTime(timezone=True), default=utc_now)


class GateAuditLog(Base):
    """Compliance audit log for gate supervisor overrides, plate data lookups, and retention pruning."""
    __tablename__ = "gate_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    action_type = Column(String(48), nullable=False)  # "MANUAL_OVERRIDE", "PLATE_LOOKUP", "DATA_PRUNED", "OFFLINE_SYNC"
    operator_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    operator_email = Column(String(120), nullable=True)
    lane_id = Column(Integer, ForeignKey("gate_lane_controllers.id"), nullable=True)
    vehicle_number_masked = Column(String(24), nullable=True)
    reason = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now)
