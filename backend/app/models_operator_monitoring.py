"""Phase 12: Live Operator Map & Facility Monitoring Database Models.

Covers:
1. OperationalAlert - Real-time facility alerts (capacity warnings, sensor status, gate delays, restricted zone events)
2. ZoneRestriction - Dynamic zone-level operational restrictions and overrides with audit tracking
"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
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


class OperationalAlert(Base):
    """Operational and safety alerts emitted for parking facilities and zones."""
    __tablename__ = "operational_alerts"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(
        Integer,
        ForeignKey("parking_facilities.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    lot_id = Column(
        Integer,
        ForeignKey("parking_lots.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    zone_code = Column(String(32), nullable=True, index=True)
    severity = Column(String(24), default="WARNING", index=True, nullable=False)  # INFO, WARNING, CRITICAL
    alert_type = Column(
        String(48),
        default="CAPACITY_HIGH",
        index=True,
        nullable=False,
    )  # CAPACITY_HIGH, SENSOR_OFFLINE, GATE_DEGRADED, OCCUPANCY_SPIKE, RESTRICTED_BREACH
    title = Column(String(160), nullable=False)
    message = Column(Text, nullable=False)
    is_acknowledged = Column(Boolean, default=False, index=True, nullable=False)
    acknowledged_by = Column(String(120), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)

    facility = relationship("ParkingFacility", foreign_keys=[facility_id])
    lot = relationship("ParkingLot", foreign_keys=[lot_id])


class ZoneOperationalState(Base):
    """Dynamic operational restrictions and states for parking zones."""
    __tablename__ = "zone_operational_states"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(
        Integer,
        ForeignKey("parking_lots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    zone_code = Column(String(32), nullable=False, index=True)
    is_restricted = Column(Boolean, default=False, nullable=False)
    restriction_reason = Column(
        String(160),
        default="NONE",
        nullable=False,
    )  # NONE, VIP_RESERVE, MAINTENANCE, STAFF_ONLY, CLEANING, FIRE_LANE
    restricted_by = Column(String(120), nullable=True)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_zone_state_lot_code", "lot_id", "zone_code", unique=True),
    )
