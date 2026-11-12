"""Pydantic Request & Response Schemas for Phase 13: AI Location Intelligence & Demand Heatmaps."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ------------------------------------------------------------------------------
# 1. Parking Demand Heatmaps Schemas
# ------------------------------------------------------------------------------
class HeatmapPointItem(BaseModel):
    """Geographical heat point with demand intensity and booking density."""
    latitude: float
    longitude: float
    weight: float = Field(..., ge=0.0, le=1.0, description="Normalized demand weight (0.0 to 1.0)")
    booking_count: int
    facility_name: str
    facility_id: Optional[int] = None
    area_name: str
    intensity_level: str  # LOW, MODERATE, HIGH, CRITICAL
    data_type: str = "HISTORICAL"  # HISTORICAL, CURRENT, PREDICTED


class HeatmapDensityResponse(BaseModel):
    """Collection of geo-density points for spatial heatmap rendering."""
    city: str
    time_window: str
    data_type: str  # HISTORICAL, CURRENT, PREDICTED
    total_observations: int
    points: List[HeatmapPointItem]
    generated_at: datetime
    disclaimer: str = (
        "AI Demand Heatmaps represent statistical density aggregations. "
        "Predictions are probabilistic forecasts and do not guarantee slot vacancy."
    )


class HourlyOccupancyCell(BaseModel):
    """Single cell in the 7x24 time-day occupancy matrix."""
    day_of_week: int  # 0 = Monday ... 6 = Sunday
    day_name: str
    hour: int  # 0 to 23
    occupancy_pct: float = Field(..., ge=0.0, le=100.0)
    sample_count: int
    is_peak: bool


class OccupancyMatrixResponse(BaseModel):
    """7x24 hourly occupancy matrix for a facility or city cluster."""
    facility_id: Optional[int] = None
    facility_name: str
    city: str
    matrix: List[HourlyOccupancyCell]
    busiest_day: str
    peak_hour: int
    peak_occupancy_pct: float
    lowest_hour: int
    lowest_occupancy_pct: float
    generated_at: datetime


class FacilityDemandComparisonItem(BaseModel):
    """Side-by-side facility comparison metric row."""
    facility_id: int
    code: str
    name: str
    city: str
    category: str
    avg_occupancy_pct: float
    peak_hour: int
    peak_occupancy_pct: float
    turnover_rate_daily: float  # Vehicles per bay per day
    revenue_per_bay_inr: float
    weekend_variance_pct: float  # +/- % difference compared to weekdays
    demand_rating: str  # OPTIMAL, MODERATE, HIGH_SURGE, CRITICAL


# ------------------------------------------------------------------------------
# 2. AI Demand Forecasting Schemas
# ------------------------------------------------------------------------------
class ForecastAccuracyMetrics(BaseModel):
    """Evaluation accuracy metrics on test partition."""
    mae: float = Field(..., description="Mean Absolute Error in percentage points")
    rmse: float = Field(..., description="Root Mean Squared Error")
    mape: float = Field(..., description="Mean Absolute Percentage Error")
    r2_score: float = Field(..., description="Coefficient of determination")
    confidence_score_pct: float = Field(..., ge=0.0, le=100.0)


class ForecastHourlyPoint(BaseModel):
    """Single hourly forecast step with 90% confidence bands and event surge."""
    target_hour_utc: datetime
    target_hour_ist_label: str
    predicted_occupancy_pct: float
    ci90_lower_pct: float
    ci90_upper_pct: float
    baseline_occupancy_pct: float
    event_surge_pct: float
    is_peak: bool


class DemandForecastResponse(BaseModel):
    """Next 24h/7d demand forecast for a facility with model evaluation metrics."""
    facility_id: int
    facility_name: str
    city: str
    horizon_hours: int
    model_version: str
    metrics: ForecastAccuracyMetrics
    hourly_points: List[ForecastHourlyPoint]
    event_impact_summary: str
    data_freshness_timestamp: datetime
    disclaimer: str = (
        "PREDICTED_ESTIMATE: Demand forecasts are statistical estimates calculated using "
        "historical booking density, calendar seasonality, and configured special events. "
        "They are not guaranteed availability or revenue."
    )


# ------------------------------------------------------------------------------
# 3. Intelligent Parking Recommendations Schemas
# ------------------------------------------------------------------------------
class IntelligentRecommendationRequest(BaseModel):
    """Driver criteria for personalized parking recommendations."""
    driver_latitude: float = Field(..., ge=-90.0, le=90.0)
    driver_longitude: float = Field(..., ge=-180.0, le=180.0)
    vehicle_type: str = "CAR"  # CAR, SUV, EV, TWO_WHEELER
    needs_ev_charging: bool = False
    needs_accessible: bool = False
    needs_covered: bool = False
    max_walking_time_mins: Optional[int] = 10
    budget_tier: Optional[str] = "BALANCED"  # ECONOMY, BALANCED, PREMIUM
    search_radius_km: float = Field(15.0, ge=0.5, le=50.0)


class RecommendedFacilityItem(BaseModel):
    """Ranked facility recommendation with explainability details."""
    facility_id: int
    name: str
    code: str
    slug: str
    city: str
    category: str
    latitude: float
    longitude: float
    formatted_address: str
    distance_km: float
    estimated_driving_time_mins: int
    available_bays: int
    total_capacity: int = 0
    base_hourly_rate_inr: float
    estimated_total_cost_inr: float
    ev_charging_available: int
    match_score: float = Field(..., ge=0.0, le=100.0)
    match_tier: str  # PRIMARY_MATCH, STRONG_ALTERNATIVE, BUDGET_PICK
    score_breakdown: Dict[str, float]
    explanations: List[str]  # Explainable AI natural-language reasons


class IntelligentRecommendationResponse(BaseModel):
    """List of intelligent parking recommendations for the driver."""
    recommendations: List[RecommendedFacilityItem]
    driver_coordinates: Dict[str, float]
    evaluated_facilities_count: int
    generated_at: datetime


# ------------------------------------------------------------------------------
# 4. Dynamic Pricing Intelligence Schemas
# ------------------------------------------------------------------------------
class DynamicPricingProposalItem(BaseModel):
    """AI pricing proposal awaiting operator review."""
    id: int
    proposal_code: str
    facility_id: int
    facility_name: str
    city: str
    current_hourly_rate_inr: float
    recommended_hourly_rate_inr: float
    current_multiplier: float
    recommended_multiplier: float
    predicted_occupancy_pct: float
    confidence_score_pct: float
    demand_tier: str
    valid_from: datetime
    valid_to: datetime
    reasoning: str
    min_rate_cap_inr: float
    max_multiplier_cap: float
    status: str  # PENDING_APPROVAL, APPROVED, REJECTED, EXPIRED
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    decision_notes: Optional[str] = None
    created_at: datetime


class PricingProposalReviewRequest(BaseModel):
    """Operator decision payload for a dynamic pricing proposal."""
    action: str = Field(..., description="APPROVED or REJECTED")
    decision_notes: Optional[str] = None


class PricingProposalReviewResponse(BaseModel):
    """Result of operator pricing proposal decision."""
    proposal_id: int
    status: str
    applied_multiplier: Optional[float] = None
    applied_rate_inr: Optional[float] = None
    message: str
    reviewed_by: str
    reviewed_at: datetime


# ------------------------------------------------------------------------------
# 5. Event & Location Intelligence Schemas
# ------------------------------------------------------------------------------
class ManagedEventItem(BaseModel):
    """Metro event impacting parking demand and ingress."""
    id: int
    name: str
    event_type: str
    venue_name: str
    city: str
    latitude: float
    longitude: float
    radius_impact_km: float
    start_time: datetime
    end_time: datetime
    expected_attendance: int
    demand_surge_factor: float
    occupancy_pressure_level: str
    recommended_action: Optional[str] = None
    is_active: bool
    impacted_facilities_count: int = 0
    impacted_facility_names: List[str] = []


class ManagedEventCreateRequest(BaseModel):
    """Payload to configure a new high-demand event."""
    name: str
    event_type: str = "EXHIBITION"
    venue_name: str
    city: str
    latitude: float
    longitude: float
    radius_impact_km: float = 3.5
    start_time: datetime
    end_time: datetime
    expected_attendance: int = 5000
    demand_surge_factor: float = 1.25
    recommended_action: Optional[str] = None


# ------------------------------------------------------------------------------
# 6. AI Operator Location Assistant Schemas
# ------------------------------------------------------------------------------
class LocationAssistantRequest(BaseModel):
    """Operator natural language inquiry on location demand or facility intelligence."""
    question: str
    facility_id: Optional[int] = None


class SupportingMetricItem(BaseModel):
    """Auditable metric supporting an assistant's answer."""
    name: str
    value: Any
    unit: str = ""
    source_table: str
    computation_rule: str


class LocationAssistantResponse(BaseModel):
    """Assistant answer strictly grounded in database metrics with provenance."""
    question: str
    answer: str
    intents: List[str]
    supporting_metrics: List[SupportingMetricItem]
    facilities_analyzed: List[str]
    reporting_period: str
    provenance: str = "ACTUAL_DB_OBSERVATION"
    refused: bool = False
    refusal_reason: Optional[str] = None
    generated_at: datetime
