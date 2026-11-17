"""Phase 19: FastAPI Router for Driver Convenience, Valet Parking, Venues & Driver Assistance.

Endpoints mounted under /api/v1/driver-ecosystem and /api/driver-ecosystem:
- Find My Car:
  - POST /find-my-car/save: Save driver's parked vehicle location with floor, zone, slot, notes, and photo
  - GET /find-my-car/location: Fetch currently active saved parking spot
  - DELETE /find-my-car/clear: Clear parking location under privacy retention policy
  - GET /find-my-car/route: Generate pedestrian return directions from lobby to parked car
- Valet Parking:
  - POST /valet/request: Request valet service & generate secure 6-digit return OTP
  - GET /valet/requests: List all valet tickets with status and custody audit log
  - POST /valet/handover: Attendant completes physical inspection and custody intake
  - POST /valet/park: Attendant records storage slot assignment in valet vault
  - POST /valet/retrieve: Driver requests vehicle return to exit lounge
  - POST /valet/verify-return: Verify 6-digit PIN before releasing vehicle to driver
  - POST /valet/report-incident: Log scratches or custody issues for operator review
- Mall & Venue Integration:
  - GET /venues: Directory of stores, cinemas, dining, and offices with category filters
  - POST /venues: Operator registers or updates venue destination
  - GET /venues/{venue_id}/route: Multi-floor pedestrian route between parking bay and store
- Driver Assistance & Incident Reporting:
  - POST /assistance/request: Lodge incident report (blocked bay, equipment fault, emergency SOS)
  - GET /assistance/requests: List tickets with urgency and transition audit logs
  - POST /assistance/status: Update ticket status (acknowledge, dispatch staff, resolve)
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas_phase19 import (
    AssistanceRequestCreate,
    AssistanceRequestResponse,
    AssistanceStatusUpdateRequest,
    PedestrianRouteResponse,
    SavedVehicleLocationCreate,
    SavedVehicleLocationResponse,
    ValetBookingResponse,
    ValetHandoverRequest,
    ValetIncidentReportRequest,
    ValetParkRequest,
    ValetRequestCreate,
    ValetReturnVerifyRequest,
    VenueDestinationCreate,
    VenueDestinationResponse,
)
from app.services.driver_ecosystem_service import (
    calculate_pedestrian_return_route,
    calculate_venue_pedestrian_route,
    clear_saved_vehicle_location,
    create_assistance_request,
    create_valet_request,
    create_venue_destination,
    get_saved_vehicle_location,
    list_assistance_requests,
    list_valet_requests,
    list_venue_destinations,
    report_valet_incident,
    save_vehicle_location,
    update_assistance_status,
    valet_handover_vehicle,
    valet_park_vehicle,
    valet_request_retrieval,
    valet_verify_and_return,
)

driver_ecosystem_router = APIRouter(prefix="", tags=["Phase 19 — Driver Convenience & Ecosystem"])


# ---------------------------------------------------------------------------
# Pillar A: Find My Car Endpoints
# ---------------------------------------------------------------------------

@driver_ecosystem_router.post(
    "/find-my-car/save",
    response_model=SavedVehicleLocationResponse,
    summary="Save driver's parked vehicle location",
)
def save_location(
    request: SavedVehicleLocationCreate,
    user_id: int = Query(1),
    db: Session = Depends(get_db),
):
    """Persist final parking floor, zone, slot number, pillar reference, and optional photo."""
    return save_vehicle_location(db, user_id=user_id, request=request)


@driver_ecosystem_router.get(
    "/find-my-car/location",
    response_model=Optional[SavedVehicleLocationResponse],
    summary="Get active saved parking location for user",
)
def get_location(
    user_id: int = Query(1),
    db: Session = Depends(get_db),
):
    """Fetch currently active saved location for logged-in driver."""
    loc = get_saved_vehicle_location(db, user_id=user_id)
    if not loc:
        return None
    return loc


@driver_ecosystem_router.delete(
    "/find-my-car/clear",
    summary="Clear saved parking location under retention policy",
)
def clear_location(
    user_id: int = Query(1),
    db: Session = Depends(get_db),
):
    """Clear active location data when no longer needed."""
    return clear_saved_vehicle_location(db, user_id=user_id)


@driver_ecosystem_router.get(
    "/find-my-car/route",
    response_model=PedestrianRouteResponse,
    summary="Generate pedestrian directions back to parked car",
)
def get_return_route(
    user_id: int = Query(1),
    origin: str = Query("Ground Floor Lobby / Elevator B"),
    db: Session = Depends(get_db),
):
    """Compute step-by-step pedestrian path strictly through walkways and elevators back to parked vehicle."""
    return calculate_pedestrian_return_route(db, user_id=user_id, origin=origin)


# ---------------------------------------------------------------------------
# Pillar B: Valet Parking Endpoints
# ---------------------------------------------------------------------------

@driver_ecosystem_router.post(
    "/valet/request",
    response_model=ValetBookingResponse,
    summary="Request valet parking service",
)
def request_valet(
    request: ValetRequestCreate,
    user_id: int = Query(1),
    db: Session = Depends(get_db),
):
    """Driver requests valet parking; generates digital ticket and secure 6-digit return OTP."""
    return create_valet_request(db, driver_user_id=user_id, request=request)


@driver_ecosystem_router.get(
    "/valet/requests",
    response_model=List[ValetBookingResponse],
    summary="List all valet requests and custody logs",
)
def get_valet_requests(
    facility_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Valet attendants and operators monitor active and completed valet tasks."""
    return list_valet_requests(db, facility_id=facility_id, status_filter=status)


@driver_ecosystem_router.post(
    "/valet/handover",
    response_model=ValetBookingResponse,
    summary="Valet attendant accepts custody and logs vehicle intake",
)
def handover_valet(
    request: ValetHandoverRequest,
    db: Session = Depends(get_db),
):
    """Attendant completes vehicle handover and initial physical inspection."""
    return valet_handover_vehicle(db, request=request)


@driver_ecosystem_router.post(
    "/valet/park",
    response_model=ValetBookingResponse,
    summary="Record vehicle safely parked in valet storage vault",
)
def park_valet(
    request: ValetParkRequest,
    db: Session = Depends(get_db),
):
    """Record assigned storage slot in secure valet holding area."""
    return valet_park_vehicle(db, request=request)


@driver_ecosystem_router.post(
    "/valet/retrieve",
    response_model=ValetBookingResponse,
    summary="Driver requests vehicle retrieval to exit lounge",
)
def retrieve_valet(
    valet_ticket_number: str = Query(...),
    db: Session = Depends(get_db),
):
    """Driver signals readiness to pick up car; notifies valet runner."""
    return valet_request_retrieval(db, valet_ticket_number=valet_ticket_number)


@driver_ecosystem_router.post(
    "/valet/verify-return",
    response_model=ValetBookingResponse,
    summary="Verify 6-digit OTP and complete return to driver",
)
def verify_return_valet(
    request: ValetReturnVerifyRequest,
    db: Session = Depends(get_db),
):
    """Strict security check: verifies driver's 6-digit OTP before releasing custody."""
    return valet_verify_and_return(db, request=request)


@driver_ecosystem_router.post(
    "/valet/report-incident",
    response_model=ValetBookingResponse,
    summary="Report incident or damages during valet custody",
)
def report_incident(
    request: ValetIncidentReportRequest,
    db: Session = Depends(get_db),
):
    """Record pre-existing damages or incident with operator audit notes."""
    return report_valet_incident(db, request=request)


# ---------------------------------------------------------------------------
# Pillar C: Mall & Venue Integration Endpoints
# ---------------------------------------------------------------------------

@driver_ecosystem_router.get(
    "/venues",
    response_model=List[VenueDestinationResponse],
    summary="Directory of mall stores, cinemas, dining, and offices",
)
def get_venues(
    facility_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Browse destinations with category filtering."""
    return list_venue_destinations(db, facility_id=facility_id, category=category)


@driver_ecosystem_router.post(
    "/venues",
    response_model=VenueDestinationResponse,
    summary="Register new venue destination",
)
def add_venue(
    request: VenueDestinationCreate,
    db: Session = Depends(get_db),
):
    """Operator adds or updates a store, cinema, or attraction in facility directory."""
    return create_venue_destination(db, request=request)


@driver_ecosystem_router.get(
    "/venues/{venue_id}/route",
    response_model=PedestrianRouteResponse,
    summary="Generate pedestrian route between parking bay and venue",
)
def get_venue_route(
    venue_id: int,
    user_id: int = Query(1),
    reverse: bool = Query(False, description="True for venue back to car, False for car to venue"),
    db: Session = Depends(get_db),
):
    """Calculate multi-floor pedestrian path with elevators/escalators between car and mall store."""
    return calculate_venue_pedestrian_route(db, venue_id=venue_id, user_id=user_id, reverse=reverse)


# ---------------------------------------------------------------------------
# Pillar D: Driver Assistance & Incident Reporting Endpoints
# ---------------------------------------------------------------------------

@driver_ecosystem_router.post(
    "/assistance/request",
    response_model=AssistanceRequestResponse,
    summary="Submit driver incident or assistance request",
)
def report_assistance(
    request: AssistanceRequestCreate,
    user_id: int = Query(1),
    db: Session = Depends(get_db),
):
    """Submit a support ticket for blocked slots, damaged equipment, navigation, or emergency SOS."""
    return create_assistance_request(db, user_id=user_id, request=request)


@driver_ecosystem_router.get(
    "/assistance/requests",
    response_model=List[AssistanceRequestResponse],
    summary="List assistance tickets and audit history",
)
def get_assistance_requests(
    facility_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Operator and support staff monitor pending and resolved assistance requests."""
    return list_assistance_requests(db, facility_id=facility_id, status_filter=status)


@driver_ecosystem_router.post(
    "/assistance/status",
    response_model=AssistanceRequestResponse,
    summary="Update assistance ticket status and dispatch staff",
)
def update_ticket_status(
    request: AssistanceStatusUpdateRequest,
    db: Session = Depends(get_db),
):
    """Acknowledge, dispatch patrol, or resolve support tickets."""
    return update_assistance_status(db, request=request)
