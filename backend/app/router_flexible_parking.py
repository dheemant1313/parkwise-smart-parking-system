"""Phase 18: FastAPI Router for EV Charging, Accessibility, Group Bookings & Smart Waitlist.

Endpoints mounted under /api/v1/flexible and /api/flexible:
- EV Charging:
  - GET /ev/chargers: List EV charging stations & status
  - POST /ev/reserve: Reserve EV charger bay & initialize session
  - POST /ev/telemetry: Ingest live OCPP hardware telemetry / complete session
- Accessibility:
  - POST /accessibility/credentials: Register/verify disability credentials
  - POST /accessibility/reserve: Enforce compliance verification before ADA bay booking
  - GET /accessibility/route: Calculate 100% step-free accessible navigation route
- Family & Group Bookings:
  - POST /groups: Multi-slot group reservation with staggered QR issuance
  - GET /groups/{group_reference}: Fetch group reservation overview
  - POST /groups/check-in: Staggered individual arrival check-in
  - POST /groups/cancel-member: Partial group member cancellation
- Smart Waitlist:
  - POST /waitlist/join: Join queue when facility is full
  - GET /waitlist/entries: List active waitlist queue
  - POST /waitlist/claim: Claim offered slot before 10-min expiration
  - POST /waitlist/simulate-vacancy: Test simulator to trigger waitlist notification
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import User, UserRole
from app.models_phase18 import FacilityWaitlistEntry, GroupBooking, WaitlistStatus
from app.schemas_phase18 import (
    AccessibilityCredentialResponse,
    AccessibilityVerifyRequest,
    AccessibleRouteResponse,
    EVChargerResponse,
    EVChargingReserveRequest,
    EVChargingSessionResponse,
    EVChargingTelemetryUpdateRequest,
    GroupBookingCreateRequest,
    GroupBookingResponse,
    GroupMemberCancelRequest,
    GroupMemberCheckInRequest,
    WaitlistClaimRequest,
    WaitlistClaimResponse,
    WaitlistEntryResponse,
    WaitlistJoinRequest,
)
from app.services.flexible_parking_service import (
    calculate_accessible_step_free_route,
    cancel_group_member,
    check_in_group_member,
    claim_waitlist_offer,
    create_group_booking,
    join_facility_waitlist,
    list_ev_chargers,
    process_slot_vacancy_for_waitlist,
    register_accessibility_credential,
    reserve_accessible_bay,
    reserve_ev_charging_session,
    update_charging_telemetry,
)

flexible_router = APIRouter(prefix="", tags=["Phase 18 — Flexible Parking & Accessibility"])


# ---------------------------------------------------------------------------
# EV Charging Endpoints
# ---------------------------------------------------------------------------

@flexible_router.get("/ev/chargers", response_model=List[EVChargerResponse], summary="List EV charging stations")
def get_chargers(
    facility_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Retrieve all charging stations with connector types and real-time status."""
    return list_ev_chargers(db, facility_id=facility_id)


@flexible_router.post("/ev/reserve", response_model=EVChargingSessionResponse, summary="Reserve EV charger and start session")
def reserve_charger(
    request: EVChargingReserveRequest,
    db: Session = Depends(get_db),
):
    """Reserve a compatible EV charging bay and initialize an OCPP telemetry session."""
    return reserve_ev_charging_session(db, request=request)


@flexible_router.post("/ev/telemetry", response_model=EVChargingSessionResponse, summary="Ingest live charger telemetry")
def update_telemetry(
    request: EVChargingTelemetryUpdateRequest,
    db: Session = Depends(get_db),
):
    """Update live SoC %, energy delivered, or mark session completed based on verified hardware events."""
    return update_charging_telemetry(db, request=request)


# ---------------------------------------------------------------------------
# Accessibility Endpoints
# ---------------------------------------------------------------------------

@flexible_router.post(
    "/accessibility/credentials",
    response_model=AccessibilityCredentialResponse,
    summary="Register government-verified disability badge (UDID)",
)
def verify_credential(
    request: AccessibilityVerifyRequest,
    db: Session = Depends(get_db),
):
    """Register and verify disability certificate/badge for priority ADA accessible bay booking."""
    return register_accessibility_credential(db, request=request)


@flexible_router.post(
    "/accessibility/reserve",
    summary="Reserve accessible parking bay with strict compliance verification",
)
def book_accessible_bay(
    user_id: int,
    facility_id: int,
    slot_id: int,
    vehicle_number: str,
    start_time: str,
    end_time: str,
    db: Session = Depends(get_db),
):
    """Enforce verification guardrails: restricted accessible spaces cannot be booked by unauthorized drivers."""
    from datetime import datetime
    st = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
    et = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
    booking = reserve_accessible_bay(
        db=db,
        user_id=user_id,
        facility_id=facility_id,
        slot_id=slot_id,
        vehicle_number=vehicle_number,
        start_time=st,
        end_time=et,
    )
    return {
        "booking_reference": booking.booking_reference,
        "slot_id": booking.slot_id,
        "status": booking.status.value,
        "message": "Accessible bay confirmed. Step-free indoor navigation path generated.",
    }


@flexible_router.get(
    "/accessibility/route",
    response_model=AccessibleRouteResponse,
    summary="Calculate 100% step-free accessible route",
)
def get_accessible_route(
    facility_id: int = Query(...),
    destination_slot: str = Query(...),
    db: Session = Depends(get_db),
):
    """Generate step-free indoor path avoiding stairs and prioritizing elevators and ramps."""
    return calculate_accessible_step_free_route(
        db=db,
        facility_id=facility_id,
        destination_slot_number=destination_slot,
    )


# ---------------------------------------------------------------------------
# Family & Group Bookings Endpoints
# ---------------------------------------------------------------------------

@flexible_router.post(
    "/groups",
    response_model=GroupBookingResponse,
    summary="Create multi-slot group reservation with staggered QR credentials",
)
def create_group(
    request: GroupBookingCreateRequest,
    organizer_user_id: int = Query(1),
    db: Session = Depends(get_db),
):
    """Reserve multiple contiguous or nearby parking bays in a single group booking."""
    return create_group_booking(db, organizer_user_id=organizer_user_id, request=request)


@flexible_router.get(
    "/groups/{group_reference}",
    response_model=GroupBookingResponse,
    summary="Get group booking details and member vehicle list",
)
def get_group(
    group_reference: str,
    db: Session = Depends(get_db),
):
    """Retrieve details for a family/group booking including all assigned bays and staggered check-in states."""
    group = (
        db.query(GroupBooking)
        .filter(GroupBooking.group_reference == group_reference.strip().upper())
        .first()
    )
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group booking not found.")

    members_resp = [
        {
            "member_id": m.id,
            "slot_number": m.slot.slot_number if m.slot else "BAY-01",
            "vehicle_number": m.vehicle_number,
            "driver_name": m.driver_name,
            "driver_phone": m.driver_phone,
            "qr_token_jti": m.qr_token_jti,
            "status": m.status.value,
            "checked_in_at": m.checked_in_at,
        }
        for m in group.members
    ]

    return GroupBookingResponse(
        group_reference=group.group_reference,
        facility_name=group.facility.name if group.facility else "Central Facility",
        group_name=group.group_name,
        start_time=group.start_time,
        end_time=group.end_time,
        total_spaces_reserved=group.total_spaces_reserved,
        total_amount_inr=group.total_amount_inr,
        status=group.status.value,
        members=members_resp,
    )


@flexible_router.post(
    "/groups/check-in",
    summary="Staggered check-in for individual group vehicle",
)
def check_in_member(
    request: GroupMemberCheckInRequest,
    db: Session = Depends(get_db),
):
    """Support independent arrival for any vehicle in a group reservation."""
    return check_in_group_member(
        db=db,
        group_reference=request.group_reference,
        vehicle_number=request.vehicle_number,
        qr_token_jti=request.qr_token_jti,
    )


@flexible_router.post(
    "/groups/cancel-member",
    summary="Partial cancellation of individual vehicle in group",
)
def cancel_member(
    request: GroupMemberCancelRequest,
    db: Session = Depends(get_db),
):
    """Cancel a single vehicle within a group booking and release its bay without disrupting other members."""
    return cancel_group_member(
        db=db,
        group_reference=request.group_reference,
        vehicle_number=request.vehicle_number,
        reason=request.reason,
    )


# ---------------------------------------------------------------------------
# Smart Waiting List Endpoints
# ---------------------------------------------------------------------------

@flexible_router.post(
    "/waitlist/join",
    response_model=WaitlistEntryResponse,
    summary="Join waiting list when facility is full",
)
def join_waitlist(
    request: WaitlistJoinRequest,
    user_id: int = Query(1),
    db: Session = Depends(get_db),
):
    """Queue for a full facility with fair FIFO allocation."""
    return join_facility_waitlist(db, user_id=user_id, request=request)


@flexible_router.get(
    "/waitlist/entries",
    summary="List active waitlist queue for facility",
)
def list_waitlist(
    facility_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """List queued and notified waitlist entries."""
    query = db.query(FacilityWaitlistEntry)
    if facility_id:
        query = query.filter(FacilityWaitlistEntry.facility_id == facility_id)
    entries = query.order_by(FacilityWaitlistEntry.queue_position.asc()).all()
    return [
        {
            "waitlist_reference": e.waitlist_reference,
            "facility_id": e.facility_id,
            "facility_name": e.facility.name if e.facility else "Central Facility",
            "vehicle_plate": e.vehicle_plate,
            "driver_name": e.driver_name,
            "required_slot_type": e.required_slot_type,
            "queue_position": e.queue_position,
            "status": e.status.value,
            "offered_slot_number": e.offered_slot.slot_number if e.offered_slot else None,
            "offer_expires_at": e.offer_expires_at,
            "created_at": e.created_at,
        }
        for e in entries
    ]


@flexible_router.post(
    "/waitlist/claim",
    response_model=WaitlistClaimResponse,
    summary="Claim and confirm waiting list slot offer before expiration",
)
def claim_offer(
    request: WaitlistClaimRequest,
    db: Session = Depends(get_db),
):
    """Convert a notified waitlist slot offer into a confirmed booking."""
    return claim_waitlist_offer(
        db=db,
        waitlist_reference=request.waitlist_reference,
        payment_method=request.payment_method,
    )


@flexible_router.post(
    "/waitlist/simulate-vacancy",
    summary="Trigger vacancy event to notify next FIFO waitlist candidate",
)
def simulate_vacancy(
    facility_id: int = Query(...),
    slot_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Simulate a vacancy triggering the 10-minute atomic hold for the next waitlist candidate."""
    candidate = process_slot_vacancy_for_waitlist(db, facility_id=facility_id, slot_id=slot_id)
    if not candidate:
        return {"status": "no_candidates", "message": "No candidates currently queued for this facility/slot."}
    return {
        "status": "notified",
        "waitlist_reference": candidate.waitlist_reference,
        "vehicle_plate": candidate.vehicle_plate,
        "offered_slot_id": candidate.offered_slot_id,
        "offer_expires_at": candidate.offer_expires_at.isoformat() if candidate.offer_expires_at else None,
        "message": "Atomic 10-minute hold active. Candidate notified.",
    }
