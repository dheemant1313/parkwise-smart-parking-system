"""Phase 13: AI Location Intelligence & Demand Heatmaps API Router.

Mounted under /api/v1/intelligence:
1. GET /heatmaps/density - Spatial booking & demand density points (historical, live, predicted)
2. GET /heatmaps/occupancy-matrix - 7x24 hourly occupancy matrix
3. GET /heatmaps/facility-comparison - Side-by-side facility demand benchmarks
4. GET /forecast/{facility_id} - Multi-step AI demand forecasting with event surge & conformal intervals
5. POST /recommendations - Intelligent personalized driver parking recommendations with explainability
6. GET /pricing-proposals - AI dynamic pricing proposals awaiting operator approval
7. POST /pricing-proposals/{id}/review - Operator decision gate (APPROVE/REJECT) with audit log
8. GET /events - Scheduled metro events impacting parking demand
9. POST /events - Register new high-demand event
10. POST /assistant/ask - Operator AI assistant grounded in actual DB analytics with mutation guardrails
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, UserRole
from app.schemas_location_intelligence import (
    DemandForecastResponse,
    DynamicPricingProposalItem,
    FacilityDemandComparisonItem,
    HeatmapDensityResponse,
    IntelligentRecommendationRequest,
    IntelligentRecommendationResponse,
    LocationAssistantRequest,
    LocationAssistantResponse,
    ManagedEventCreateRequest,
    ManagedEventItem,
    OccupancyMatrixResponse,
    PricingProposalReviewRequest,
    PricingProposalReviewResponse,
)
from app.services.location_intelligence_service import (
    compare_facilities_demand,
    create_managed_event,
    generate_facility_ai_forecast,
    generate_intelligent_recommendations,
    get_managed_events,
    get_occupancy_matrix_7x24,
    get_pending_pricing_proposals,
    get_spatial_density_heatmap,
    query_ai_location_assistant,
    review_pricing_proposal,
    seed_location_intelligence_data,
)

router = APIRouter(
    prefix="/intelligence",
    tags=["Phase 13 - AI Location Intelligence & Demand Heatmaps"],
)


def _ensure_operator_or_admin(user: User) -> None:
    if user.role not in (UserRole.OPERATOR, UserRole.ADMIN, UserRole.GATE_STAFF):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Location intelligence and pricing controls require OPERATOR or ADMIN role.",
        )


# ------------------------------------------------------------------------------
# 1. Parking Demand Heatmaps Endpoints
# ------------------------------------------------------------------------------
@router.get(
    "/heatmaps/density",
    response_model=HeatmapDensityResponse,
    summary="Get spatial demand density heat points (Historical, Live Current, or Predicted)",
)
def get_density_heatmap_endpoint(
    city: Optional[str] = Query(None, description="Filter by Indian Metro City (Delhi, Mumbai, Bengaluru, etc.)"),
    category: Optional[str] = Query(None, description="Filter by Facility Category (MALL, COMMERCIAL, TRANSIT)"),
    data_type: str = Query("HISTORICAL", description="HISTORICAL, CURRENT, or PREDICTED"),
    time_window: str = Query("7D", description="Time window (24H, 7D, 30D)"),
    db: Session = Depends(get_db),
):
    clean_city = city if isinstance(city, str) and city else None
    clean_category = category if isinstance(category, str) and category else None
    clean_data_type = data_type if isinstance(data_type, str) and data_type else "HISTORICAL"
    clean_window = time_window if isinstance(time_window, str) and time_window else "7D"

    return get_spatial_density_heatmap(
        db=db,
        city=clean_city,
        category=clean_category,
        data_type=clean_data_type,
        time_window=clean_window,
    )


@router.get(
    "/heatmaps/occupancy-matrix",
    response_model=OccupancyMatrixResponse,
    summary="Get 7-day x 24-hour occupancy distribution matrix for a facility or city",
)
def get_occupancy_matrix_endpoint(
    facility_id: Optional[int] = Query(None, description="Target parking facility ID"),
    city: Optional[str] = Query(None, description="Filter by city cluster if facility not specified"),
    db: Session = Depends(get_db),
):
    clean_fac_id = facility_id if isinstance(facility_id, int) else None
    clean_city = city if isinstance(city, str) and city else None

    return get_occupancy_matrix_7x24(
        db=db,
        facility_id=clean_fac_id,
        city=clean_city,
    )


@router.get(
    "/heatmaps/facility-comparison",
    response_model=List[FacilityDemandComparisonItem],
    summary="Get side-by-side facility demand, turnover, and peak benchmarks",
)
def get_facility_comparison_endpoint(
    city: Optional[str] = Query(None, description="Filter by city"),
    db: Session = Depends(get_db),
):
    clean_city = city if isinstance(city, str) and city else None
    return compare_facilities_demand(db=db, city=clean_city)


# ------------------------------------------------------------------------------
# 2. AI Demand Forecasting Endpoint
# ------------------------------------------------------------------------------
@router.get(
    "/forecast/{facility_id}",
    response_model=DemandForecastResponse,
    summary="Get multi-step hourly demand forecast with evaluation metrics & event adjustments",
)
def get_facility_forecast_endpoint(
    facility_id: int,
    horizon_hours: int = Query(24, ge=6, le=168, description="Forecast horizon in hours (6 to 168)"),
    db: Session = Depends(get_db),
):
    clean_horizon = horizon_hours if isinstance(horizon_hours, int) else 24
    return generate_facility_ai_forecast(
        db=db,
        facility_id=facility_id,
        horizon_hours=clean_horizon,
    )


# ------------------------------------------------------------------------------
# 3. Intelligent Driver Parking Recommendations
# ------------------------------------------------------------------------------
@router.post(
    "/recommendations",
    response_model=IntelligentRecommendationResponse,
    summary="Personalized multi-factor parking recommendations with natural language explainability",
)
def get_recommendations_endpoint(
    payload: IntelligentRecommendationRequest,
    db: Session = Depends(get_db),
):
    return generate_intelligent_recommendations(db=db, req=payload)


# ------------------------------------------------------------------------------
# 4. Dynamic Pricing Intelligence & Operator Review
# ------------------------------------------------------------------------------
@router.get(
    "/pricing-proposals",
    response_model=List[DynamicPricingProposalItem],
    summary="List dynamic pricing adjustment proposals awaiting operator review",
)
def get_pricing_proposals_endpoint(
    facility_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query("PENDING_APPROVAL", description="PENDING_APPROVAL, APPROVED, REJECTED, ALL"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_operator_or_admin(current_user)
    clean_fac_id = facility_id if isinstance(facility_id, int) else None
    clean_status = status_filter if isinstance(status_filter, str) and status_filter else "PENDING_APPROVAL"

    return get_pending_pricing_proposals(
        db=db,
        facility_id=clean_fac_id,
        status_filter=clean_status,
    )


@router.post(
    "/pricing-proposals/{proposal_id}/review",
    response_model=PricingProposalReviewResponse,
    summary="Operator decision gate for dynamic pricing proposal (APPROVE or REJECT)",
)
def review_pricing_proposal_endpoint(
    proposal_id: int,
    payload: PricingProposalReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_operator_or_admin(current_user)
    try:
        return review_pricing_proposal(
            db=db,
            proposal_id=proposal_id,
            action=payload.action,
            decision_notes=payload.decision_notes,
            operator_user=current_user,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ------------------------------------------------------------------------------
# 5. Event & Location Intelligence
# ------------------------------------------------------------------------------
@router.get(
    "/events",
    response_model=List[ManagedEventItem],
    summary="List scheduled metro events impacting parking demand",
)
def list_managed_events_endpoint(
    city: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
):
    clean_city = city if isinstance(city, str) and city else None
    clean_active = is_active if isinstance(is_active, bool) else True
    return get_managed_events(db=db, city=clean_city, is_active=clean_active)


@router.post(
    "/events",
    response_model=ManagedEventItem,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new high-demand metro event with impact modeling",
)
def create_managed_event_endpoint(
    payload: ManagedEventCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_operator_or_admin(current_user)
    return create_managed_event(db=db, payload=payload, user=current_user)


# ------------------------------------------------------------------------------
# 6. AI Operator Location Assistant
# ------------------------------------------------------------------------------
@router.post(
    "/assistant/ask",
    response_model=LocationAssistantResponse,
    summary="Ask AI Operator Assistant natural language questions grounded in database analytics",
)
def query_operator_assistant_endpoint(
    payload: LocationAssistantRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_operator_or_admin(current_user)
    clean_fac_id = payload.facility_id if isinstance(payload.facility_id, int) else None
    return query_ai_location_assistant(
        db=db,
        question=payload.question,
        facility_id=clean_fac_id,
        user=current_user,
    )
