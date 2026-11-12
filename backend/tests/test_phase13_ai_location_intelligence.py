"""Phase 13: Automated Integration Test Suite for AI Location Intelligence & Demand Heatmaps.

Direct in-memory route executions avoiding Windows loopback socket deadlocks.
Validates:
1. Spatial booking & demand density heatmaps (Historical, Live, Predicted distinction)
2. 7x24 hourly occupancy matrix & side-by-side facility demand benchmarks
3. Multi-step AI demand forecasting with conformal error bounds & event adjustments
4. Intelligent driver parking recommendations with multi-factor scoring & explainability
5. Dynamic pricing proposals with operator approval gate & strict audit logging
6. Managed metro events modeling & impact radius calculations
7. AI operator location assistant with grounded metrics & mutation prevention guardrails
"""
from datetime import datetime, timedelta, timezone
from typing import Any, List
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import AuditLog, ParkingLot, ParkingSlot, SlotStatus, User, UserRole
from app.models_facility import ParkingFacility
from app.models_location_intelligence import DynamicPricingProposal, FacilityDemandProfile, ManagedEvent
from app.router_location_intelligence import (
    create_managed_event_endpoint,
    get_density_heatmap_endpoint,
    get_facility_comparison_endpoint,
    get_facility_forecast_endpoint,
    get_occupancy_matrix_endpoint,
    get_pricing_proposals_endpoint,
    get_recommendations_endpoint,
    list_managed_events_endpoint,
    query_operator_assistant_endpoint,
    review_pricing_proposal_endpoint,
)
from app.schemas_location_intelligence import (
    IntelligentRecommendationRequest,
    LocationAssistantRequest,
    ManagedEventCreateRequest,
    PricingProposalReviewRequest,
)
from app.seed import seed_initial_data
from app.seed_facility import seed_phase10_facilities
from app.services.location_intelligence_service import seed_location_intelligence_data


@pytest.fixture(scope="module")
def db():
    """Module-level session with initial seeded facilities and AI intelligence infrastructure."""
    Base.metadata.create_all(bind=engine)
    session: Session = SessionLocal()
    seed_initial_data(session)
    seed_phase10_facilities(session)
    seed_location_intelligence_data(session)
    try:
        yield session
    finally:
        session.close()


def test_01_spatial_density_heatmaps(db: Session):
    """Test 1: Verify spatial booking density heatmaps with historical, live, and predicted data."""
    # 1. Historical Heatmap
    hist_res = get_density_heatmap_endpoint(data_type="HISTORICAL", time_window="7D", db=db)
    assert hist_res.data_type == "HISTORICAL"
    assert hist_res.total_observations > 0
    assert len(hist_res.points) >= 5
    for p in hist_res.points:
        assert p.latitude != 0.0
        assert p.longitude != 0.0
        assert 0.0 <= p.weight <= 1.0
        assert p.intensity_level in ("LOW", "MODERATE", "HIGH", "CRITICAL")
        assert "statistical" in hist_res.disclaimer.lower()

    # 2. Live Current Heatmap
    live_res = get_density_heatmap_endpoint(data_type="CURRENT", db=db)
    assert live_res.data_type == "CURRENT"
    assert len(live_res.points) >= 5

    # 3. City-Filtered Heatmap (New Delhi)
    delhi_res = get_density_heatmap_endpoint(city="New Delhi", db=db)
    assert delhi_res.city == "New Delhi"
    assert len(delhi_res.points) >= 1
    for p in delhi_res.points:
        assert "Delhi" in p.facility_name or "Saket" in p.area_name or "Connaught" in p.facility_name or "Palika" in p.facility_name


def test_02_occupancy_matrix_and_facility_benchmarks(db: Session):
    """Test 2: Verify 7x24 occupancy matrix and comparative facility demand benchmarks."""
    first_fac = db.query(ParkingFacility).first()
    assert first_fac is not None

    # 1. 7x24 Matrix
    mat_res = get_occupancy_matrix_endpoint(facility_id=first_fac.id, db=db)
    assert mat_res.facility_id == first_fac.id
    assert len(mat_res.matrix) == 168  # 7 days x 24 hours
    assert mat_res.busiest_day in ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
    assert 0.0 <= mat_res.peak_occupancy_pct <= 100.0
    assert 0 <= mat_res.peak_hour <= 23

    # 2. Facility Comparison Benchmarks
    comp_res = get_facility_comparison_endpoint(db=db)
    assert len(comp_res) >= 5
    for row in comp_res:
        assert row.facility_id > 0
        assert row.code is not None
        assert 0.0 <= row.avg_occupancy_pct <= 100.0
        assert row.turnover_rate_daily > 0.0
        assert row.revenue_per_bay_inr >= 0.0
        assert row.demand_rating in ("OPTIMAL", "MODERATE", "HIGH_SURGE", "CRITICAL")


def test_03_ai_demand_forecasting_with_event_surge(db: Session):
    """Test 3: Verify multi-step hourly demand forecast with evaluation metrics & event surge."""
    first_fac = db.query(ParkingFacility).first()
    assert first_fac is not None

    forecast = get_facility_forecast_endpoint(facility_id=first_fac.id, horizon_hours=24, db=db)

    assert forecast.facility_id == first_fac.id
    assert forecast.horizon_hours == 24
    assert len(forecast.hourly_points) == 24
    assert forecast.metrics.mae > 0.0
    assert forecast.metrics.rmse > 0.0
    assert forecast.metrics.confidence_score_pct >= 85.0
    assert "not guaranteed" in forecast.disclaimer.lower()

    for pt in forecast.hourly_points:
        assert 0.0 <= pt.predicted_occupancy_pct <= 100.0
        assert pt.ci90_lower_pct <= pt.predicted_occupancy_pct <= pt.ci90_upper_pct
        assert pt.baseline_occupancy_pct >= 0.0


def test_04_intelligent_driver_recommendations(db: Session):
    """Test 4: Verify driver recommendation engine with multi-factor scoring and explainability."""
    # Driver near Saket, New Delhi looking for EV parking
    req = IntelligentRecommendationRequest(
        driver_latitude=28.5280,
        driver_longitude=77.2180,
        vehicle_type="EV",
        needs_ev_charging=True,
        needs_covered=True,
        search_radius_km=15.0,
    )
    rec_res = get_recommendations_endpoint(payload=req, db=db)

    assert len(rec_res.recommendations) >= 1
    primary = rec_res.recommendations[0]
    assert primary.match_tier == "PRIMARY_MATCH"
    assert primary.match_score >= 70.0
    assert primary.distance_km >= 0.0
    assert primary.estimated_driving_time_mins > 0
    assert primary.available_bays >= 0
    assert len(primary.explanations) >= 3
    assert any("Distance" in e for e in primary.explanations)
    assert any("EV" in e for e in primary.explanations or "Tariff" in e)


def test_05_dynamic_pricing_proposals_and_operator_approval(db: Session):
    """Test 5: Verify AI pricing proposals require explicit operator review and write audit logs."""
    driver_user = db.query(User).filter(User.role == UserRole.DRIVER).first()
    operator_user = db.query(User).filter(User.role == UserRole.OPERATOR).first()

    assert driver_user is not None
    assert operator_user is not None

    # 1. Driver blocked with 403
    with pytest.raises(HTTPException) as exc_info:
        get_pricing_proposals_endpoint(db=db, current_user=driver_user)
    assert exc_info.value.status_code == 403

    # 2. Operator retrieves pending proposals
    proposals = get_pricing_proposals_endpoint(status_filter="PENDING_APPROVAL", db=db, current_user=operator_user)
    assert len(proposals) >= 1
    target = proposals[0]
    assert target.status == "PENDING_APPROVAL"
    assert target.recommended_multiplier > 0.0

    # 3. Operator approves proposal
    review_req = PricingProposalReviewRequest(
        action="APPROVED",
        decision_notes="Approved weekend surge to manage trade expo influx",
    )
    dec_res = review_pricing_proposal_endpoint(
        proposal_id=target.id,
        payload=review_req,
        db=db,
        current_user=operator_user,
    )
    assert dec_res.status == "APPROVED"
    assert dec_res.applied_multiplier == target.recommended_multiplier

    # 4. Verify Audit Log was recorded
    audit = (
        db.query(AuditLog)
        .filter(AuditLog.action == "DYNAMIC_PRICING_PROPOSAL_APPROVED")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert audit is not None
    assert target.proposal_code in audit.target_resource


def test_06_managed_events_intelligence(db: Session):
    """Test 6: Verify scheduled metro events and impacted facility calculations."""
    operator_user = db.query(User).filter(User.role == UserRole.OPERATOR).first()
    assert operator_user is not None

    # 1. List existing events
    events = list_managed_events_endpoint(is_active=True, db=db)
    assert len(events) >= 3
    for ev in events:
        assert ev.name is not None
        assert ev.venue_name is not None
        assert ev.demand_surge_factor >= 1.0
        assert ev.occupancy_pressure_level in ("LOW", "MODERATE", "ELEVATED", "SEVERE")

    # 2. Create new event
    now = datetime.now(timezone.utc)
    new_ev_req = ManagedEventCreateRequest(
        name="Bengaluru AI & Robotics Hackathon 2026",
        event_type="CORPORATE",
        venue_name="Koramangala Indoor Stadium",
        city="Bengaluru",
        latitude=12.9352,
        longitude=77.6245,
        radius_impact_km=4.0,
        start_time=now + timedelta(days=5),
        end_time=now + timedelta(days=6),
        expected_attendance=5000,
        demand_surge_factor=1.20,
        recommended_action="Coordinate valet overflow bays at 80 Feet Road junction.",
    )
    created_ev = create_managed_event_endpoint(payload=new_ev_req, db=db, current_user=operator_user)
    assert created_ev.id > 0
    assert created_ev.city == "Bengaluru"


def test_07_ai_operator_location_assistant_and_mutation_prevention(db: Session):
    """Test 7: Verify grounded AI assistant answers queries and blocks mutation attempts."""
    operator_user = db.query(User).filter(User.role == UserRole.OPERATOR).first()
    assert operator_user is not None

    # 1. Valid Query: "Which facility is busiest today?"
    q1 = LocationAssistantRequest(question="Which facility is busiest today?")
    res1 = query_operator_assistant_endpoint(payload=q1, db=db, current_user=operator_user)
    assert res1.refused is False
    assert len(res1.supporting_metrics) >= 1
    assert "busiest" in res1.answer.lower()
    assert res1.provenance == "ACTUAL_DB_OBSERVATION"

    # 2. Valid Query: "Which hours generate the most revenue?"
    q2 = LocationAssistantRequest(question="Which hours generate the most revenue?")
    res2 = query_operator_assistant_endpoint(payload=q2, db=db, current_user=operator_user)
    assert res2.refused is False
    assert "revenue" in res2.answer.lower()

    # 3. Mutation Attempt Query: "change price to 50" -> MUST BE BLOCKED
    q3 = LocationAssistantRequest(question="Please change price of facility 1 to 50 INR")
    res3 = query_operator_assistant_endpoint(payload=q3, db=db, current_user=operator_user)
    assert res3.refused is True
    assert "Safety Refusal" in res3.answer
    assert "MUTATION_ATTEMPT_BLOCKED" in res3.intents

    # Verify audit log entry for refused mutation
    audit = (
        db.query(AuditLog)
        .filter(AuditLog.action == "AI_OPERATOR_ASSISTANT_MUTATION_REFUSED")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert audit is not None
    assert "change price" in audit.details
