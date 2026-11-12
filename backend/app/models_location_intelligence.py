"""Phase 13: AI Location Intelligence, Demand Heatmaps & Event Modeling Database Models.

Covers:
1. ManagedEvent - Manually configured or scheduled metro events impacting parking demand
2. DynamicPricingProposal - Operator-auditable AI surge/discount proposals with strict approval guardrails
3. FacilityDemandProfile - Historical and predicted demand baselines per parking facility
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


class ManagedEvent(Base):
    """Special metro events (concerts, matches, conferences, expos) impacting parking demand."""
    __tablename__ = "managed_events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(160), nullable=False, index=True)
    event_type = Column(
        String(48),
        nullable=False,
        default="EXHIBITION",
        index=True,
    )  # SPORTS, CONCERT, EXHIBITION, FESTIVAL, CORPORATE, METRO_TRANSIT
    venue_name = Column(String(160), nullable=False)
    city = Column(String(64), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_impact_km = Column(Float, default=3.5, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False)
    expected_attendance = Column(Integer, default=5000, nullable=False)
    demand_surge_factor = Column(Float, default=1.25, nullable=False)  # 1.25 = +25% demand
    occupancy_pressure_level = Column(String(24), default="ELEVATED")  # LOW, MODERATE, ELEVATED, SEVERE
    recommended_action = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class DynamicPricingProposal(Base):
    """AI-generated pricing adjustment proposals requiring explicit human operator review.
    
    Hard safety constraint:
    AI cannot independently modify tariffs or alter confirmed bookings.
    All proposals remain in PENDING_APPROVAL until an operator approves or rejects them.
    """
    __tablename__ = "dynamic_pricing_proposals"

    id = Column(Integer, primary_key=True, index=True)
    proposal_code = Column(String(64), unique=True, index=True, nullable=False)
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
    current_hourly_rate_inr = Column(Float, nullable=False)
    recommended_hourly_rate_inr = Column(Float, nullable=False)
    current_multiplier = Column(Float, default=1.0, nullable=False)
    recommended_multiplier = Column(Float, nullable=False)
    predicted_occupancy_pct = Column(Float, nullable=False)
    confidence_score_pct = Column(Float, default=90.0, nullable=False)
    demand_tier = Column(String(32), default="HIGH_DEMAND")  # LOW_OFFPEAK, NORMAL, HIGH_DEMAND, SURGE_PEAK
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_to = Column(DateTime(timezone=True), nullable=False)
    reasoning = Column(Text, nullable=False)
    min_rate_cap_inr = Column(Float, default=40.0, nullable=False)
    max_multiplier_cap = Column(Float, default=2.0, nullable=False)
    # Status: PENDING_APPROVAL -> APPROVED | REJECTED | EXPIRED
    status = Column(String(32), default="PENDING_APPROVAL", nullable=False, index=True)
    reviewed_by = Column(String(160), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    decision_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)


class FacilityDemandProfile(Base):
    """Historical and aggregated baseline demand characteristics for parking facilities."""
    __tablename__ = "facility_demand_profiles"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(
        Integer,
        ForeignKey("parking_facilities.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    historical_peak_hour = Column(Integer, default=19, nullable=False)  # 0 to 23
    historical_avg_occupancy_pct = Column(Float, default=62.5, nullable=False)
    turnover_rate_daily = Column(Float, default=3.2, nullable=False)  # Cars per bay per day
    weekend_surge_pct = Column(Float, default=22.0, nullable=False)
    ev_demand_index = Column(Float, default=1.4, nullable=False)
    busiest_day_of_week = Column(String(16), default="Saturday", nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now)
