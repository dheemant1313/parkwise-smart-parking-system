"""Phase 07 AI Intelligence persistence models.

Every row here carries explicit provenance so predictions are never confused with
actual observations:

* ``AIForecastPrediction``  - a stored model PREDICTION for one future hour. The
  ``actual_observed_pct`` column stays NULL until that hour arrives and a real
  occupancy reading is captured from ``parking_slots``.
* ``AIPricingProposal``     - a deterministic, auditable price recommendation that
  has NO effect until an authorised operator approves or overrides it.
* ``AIModelMetricLog``      - an evaluation measurement (error, drift, data quality,
  test-set accuracy) tagged with the data source it was computed on.
"""
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

from app.database import Base
from app.models import utc_now


class AIForecastPrediction(Base):
    __tablename__ = "ai_forecast_predictions"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    model_version = Column(String(64), nullable=False)
    training_data_source = Column(String(48), nullable=False)
    target_hour_utc = Column(DateTime(timezone=True), nullable=False, index=True)
    predicted_occupancy_pct = Column(Float, nullable=False)
    ci90_lower_pct = Column(Float, nullable=False)
    ci90_upper_pct = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    # Filled only with a real reading taken during the target hour.
    actual_observed_pct = Column(Float, nullable=True)
    evaluated_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index(
            "ix_ai_forecast_unique_target",
            "lot_id",
            "model_version",
            "target_hour_utc",
            unique=True,
        ),
    )


class AIPricingProposal(Base):
    __tablename__ = "ai_pricing_proposals"

    id = Column(Integer, primary_key=True, index=True)
    proposal_code = Column(String(48), unique=True, index=True, nullable=False)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False, index=True)
    pricing_engine_version = Column(String(48), nullable=False)
    forecast_model_version = Column(String(64), nullable=False)
    forecast_training_data_source = Column(String(48), nullable=False)
    window_start_utc = Column(DateTime(timezone=True), nullable=False)
    window_hours = Column(Integer, nullable=False)
    predicted_peak_occupancy_pct = Column(Float, nullable=False)
    ci90_lower_pct = Column(Float, nullable=False)
    ci90_upper_pct = Column(Float, nullable=False)
    demand_tier = Column(String(48), nullable=False)
    tier_multiplier = Column(Float, nullable=False)
    operator_rule_cap_multiplier = Column(Float, nullable=False)
    operator_rule_reference = Column(String(160), nullable=False)
    base_hourly_rate_inr = Column(Float, nullable=False)
    min_hourly_rate_inr = Column(Float, nullable=False)
    max_hourly_rate_inr = Column(Float, nullable=False)
    unclamped_rate_inr = Column(Float, nullable=False)
    recommended_rate_inr = Column(Float, nullable=False)
    recommended_multiplier = Column(Float, nullable=False)
    was_clamped = Column(Boolean, nullable=False, default=False)
    formula_trace = Column(Text, nullable=False)
    warnings = Column(Text, nullable=True)
    # PENDING_APPROVAL -> APPROVED | OVERRIDDEN | REJECTED (terminal)
    status = Column(String(24), nullable=False, default="PENDING_APPROVAL")
    created_by_email = Column(String(160), nullable=False)
    decided_by_email = Column(String(160), nullable=True)
    applied_rate_inr = Column(Float, nullable=True)
    applied_multiplier = Column(Float, nullable=True)
    decision_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    decided_at = Column(DateTime(timezone=True), nullable=True)


class AIModelMetricLog(Base):
    __tablename__ = "ai_model_metric_logs"

    id = Column(Integer, primary_key=True, index=True)
    module_code = Column(String(48), nullable=False, index=True)
    model_version = Column(String(64), nullable=False)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=True, index=True)
    # SAMPLE_HOLDOUT | SAMPLE_TEST_CASES | LIVE_DB
    data_source = Column(String(32), nullable=False)
    metric_name = Column(String(64), nullable=False)
    metric_value = Column(Float, nullable=True)
    sample_size = Column(Integer, nullable=False, default=0)
    status = Column(String(32), nullable=False, default="OK")
    details = Column(Text, nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=utc_now, index=True)
