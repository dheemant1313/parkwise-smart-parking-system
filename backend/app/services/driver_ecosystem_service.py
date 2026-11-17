"""Phase 19: Driver Ecosystem Domain Service.

Implements:
1. Find My Car: manual location persistence, photo/notes, pedestrian path generation, privacy retention.
2. Valet Parking: request, attendant intake, custody log, secure 6-digit OTP return verification, incident logs.
3. Mall & Venue Integration: store directory, category filtering, multi-floor pedestrian waypoints.
4. Driver Assistance: incident reporting (blocked bay, equipment failure, SOS), staff dispatch & resolution audit.
"""

from datetime import datetime, timedelta
import random
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import ParkingLot, ParkingSlot, User
from app.models_phase19 import (
    AssistanceCategory,
    AssistanceRequest,
    AssistanceStatus,
    AssistanceUrgency,
    SavedVehicleLocation,
    ValetBooking,
    ValetStatus,
    VenueCategory,
    VenueDestination,
)
from app.schemas_phase19 import (
    AssistanceRequestCreate,
    AssistanceRequestResponse,
    AssistanceStatusUpdateRequest,
    PedestrianRouteResponse,
    PedestrianRouteStep,
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


# ---------------------------------------------------------------------------
# Pillar A: Find My Car Service
# ---------------------------------------------------------------------------

def save_vehicle_location(
    db: Session,
    user_id: int,
    request: SavedVehicleLocationCreate,
) -> SavedVehicleLocationResponse:
    """Save or update the driver's parked vehicle location with retention expiry."""
    facility = db.query(ParkingLot).filter(ParkingLot.id == request.facility_id).first()
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility {request.facility_id} not found.",
        )

    # Invalidate previous active locations for this user under retention policy
    db.query(SavedVehicleLocation).filter(
        SavedVehicleLocation.user_id == user_id,
        SavedVehicleLocation.is_active == True,
    ).update({"is_active": False})

    # Retention expiry set to 24 hours
    retention_expires_at = datetime.utcnow() + timedelta(hours=24)

    saved_loc = SavedVehicleLocation(
        user_id=user_id,
        booking_id=request.booking_id,
        facility_id=request.facility_id,
        floor=request.floor.strip().upper(),
        zone=request.zone.strip(),
        slot_number=request.slot_number.strip().upper(),
        pillar_reference=request.pillar_reference.strip() if request.pillar_reference else None,
        photo_url=request.photo_url,
        driver_notes=request.driver_notes,
        saved_at=datetime.utcnow(),
        is_active=True,
        retention_expires_at=retention_expires_at,
    )
    db.add(saved_loc)
    db.commit()
    db.refresh(saved_loc)

    return SavedVehicleLocationResponse(
        id=saved_loc.id,
        user_id=saved_loc.user_id,
        facility_id=saved_loc.facility_id,
        facility_name=facility.name,
        floor=saved_loc.floor,
        zone=saved_loc.zone,
        slot_number=saved_loc.slot_number,
        pillar_reference=saved_loc.pillar_reference,
        photo_url=saved_loc.photo_url,
        driver_notes=saved_loc.driver_notes,
        saved_at=saved_loc.saved_at,
        is_active=saved_loc.is_active,
        retention_expires_at=saved_loc.retention_expires_at,
    )


def get_saved_vehicle_location(
    db: Session,
    user_id: int,
) -> Optional[SavedVehicleLocationResponse]:
    """Retrieve the driver's currently active saved vehicle location."""
    saved_loc = (
        db.query(SavedVehicleLocation)
        .filter(
            SavedVehicleLocation.user_id == user_id,
            SavedVehicleLocation.is_active == True,
        )
        .order_by(SavedVehicleLocation.saved_at.desc())
        .first()
    )
    if not saved_loc:
        return None

    facility = db.query(ParkingLot).filter(ParkingLot.id == saved_loc.facility_id).first()
    return SavedVehicleLocationResponse(
        id=saved_loc.id,
        user_id=saved_loc.user_id,
        facility_id=saved_loc.facility_id,
        facility_name=facility.name if facility else "Parking Facility",
        floor=saved_loc.floor,
        zone=saved_loc.zone,
        slot_number=saved_loc.slot_number,
        pillar_reference=saved_loc.pillar_reference,
        photo_url=saved_loc.photo_url,
        driver_notes=saved_loc.driver_notes,
        saved_at=saved_loc.saved_at,
        is_active=saved_loc.is_active,
        retention_expires_at=saved_loc.retention_expires_at,
    )


def clear_saved_vehicle_location(
    db: Session,
    user_id: int,
) -> Dict[str, Any]:
    """Comply with privacy retention: clear active parking location data for user."""
    count = (
        db.query(SavedVehicleLocation)
        .filter(
            SavedVehicleLocation.user_id == user_id,
            SavedVehicleLocation.is_active == True,
        )
        .update({"is_active": False})
    )
    db.commit()
    return {
        "status": "cleared",
        "records_purged": count,
        "message": "Saved parking location cleared under data retention policy.",
    }


def calculate_pedestrian_return_route(
    db: Session,
    user_id: int,
    origin: str = "Ground Floor Lobby / Elevator B",
) -> PedestrianRouteResponse:
    """Generate pedestrian return path strictly through walkways and elevators back to parked vehicle."""
    saved_loc = get_saved_vehicle_location(db, user_id)
    if not saved_loc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active saved vehicle location found for driver.",
        )

    destination = f"Slot {saved_loc.slot_number} ({saved_loc.floor}, {saved_loc.zone})"
    steps = [
        PedestrianRouteStep(
            step_number=1,
            instruction=f"From {origin}, proceed to Elevator Bank B.",
            floor="Ground Floor",
            step_type="WALKWAY",
            distance_meters=25,
            notes="Follow illuminated pedestrian floor signs.",
        ),
        PedestrianRouteStep(
            step_number=2,
            instruction=f"Take Elevator Bank B down to {saved_loc.floor}.",
            floor=saved_loc.floor,
            step_type="ELEVATOR",
            distance_meters=15,
            notes=f"Press button for Level {saved_loc.floor}.",
        ),
        PedestrianRouteStep(
            step_number=3,
            instruction=f"Exit elevator lobby onto {saved_loc.floor} Main Pedestrian Walkway.",
            floor=saved_loc.floor,
            step_type="WALKWAY",
            distance_meters=35,
            notes="Walk inside green safety crosswalk lane away from vehicle driving aisle.",
        ),
        PedestrianRouteStep(
            step_number=4,
            instruction=f"Turn towards {saved_loc.zone} near {saved_loc.pillar_reference or 'central pillar'}.",
            floor=saved_loc.floor,
            step_type="WALKWAY",
            distance_meters=20,
            notes=saved_loc.driver_notes or "Look for overhead bay indicator light.",
        ),
        PedestrianRouteStep(
            step_number=5,
            instruction=f"Arrive at your vehicle in Bay {saved_loc.slot_number}.",
            floor=saved_loc.floor,
            step_type="ARRIVED",
            distance_meters=5,
            notes="Vehicle located successfully.",
        ),
    ]

    total_dist = sum(s.distance_meters for s in steps)
    est_minutes = max(1, round(total_dist / 40))

    return PedestrianRouteResponse(
        origin=origin,
        destination=destination,
        total_distance_meters=total_dist,
        estimated_walk_minutes=est_minutes,
        is_pedestrian_only=True,
        steps=steps,
    )


# ---------------------------------------------------------------------------
# Pillar B: Valet Parking Service
# ---------------------------------------------------------------------------

def create_valet_request(
    db: Session,
    driver_user_id: int,
    request: ValetRequestCreate,
) -> ValetBookingResponse:
    """Create a valet parking request and issue a secure 6-digit return OTP."""
    facility = db.query(ParkingLot).filter(ParkingLot.id == request.facility_id).first()
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility {request.facility_id} not found.",
        )

    ticket_number = f"VALET-{datetime.utcnow().strftime('%y%m%d')}-{random.randint(1000, 9999)}"
    handover_otp = f"{random.randint(100000, 999999)}"

    initial_custody = [
        {
            "timestamp": datetime.utcnow().isoformat(),
            "actor": request.driver_name,
            "role": "DRIVER",
            "action": "VALET_REQUEST_CREATED",
            "notes": "Valet service requested at main facility drop-off zone.",
        }
    ]

    valet = ValetBooking(
        valet_ticket_number=ticket_number,
        booking_id=request.booking_id,
        facility_id=request.facility_id,
        driver_user_id=driver_user_id,
        driver_name=request.driver_name,
        driver_phone=request.driver_phone,
        vehicle_plate=request.vehicle_plate.strip().upper(),
        vehicle_model=request.vehicle_model.strip(),
        status=ValetStatus.REQUESTED,
        handover_otp=handover_otp,
        pre_inspection_notes=request.pre_inspection_notes,
        custody_logs=initial_custody,
        created_at=datetime.utcnow(),
    )
    db.add(valet)
    db.commit()
    db.refresh(valet)

    return _to_valet_response(valet, facility.name)


def list_valet_requests(
    db: Session,
    facility_id: Optional[int] = None,
    status_filter: Optional[str] = None,
) -> List[ValetBookingResponse]:
    """Retrieve all valet requests with optional facility and status filters."""
    query = db.query(ValetBooking)
    if facility_id:
        query = query.filter(ValetBooking.facility_id == facility_id)
    if status_filter:
        query = query.filter(ValetBooking.status == status_filter.upper())

    results = query.order_by(ValetBooking.created_at.desc()).all()
    facility_map = {f.id: f.name for f in db.query(ParkingLot).all()}

    return [_to_valet_response(v, facility_map.get(v.facility_id, "Central Facility")) for v in results]


def valet_handover_vehicle(
    db: Session,
    request: ValetHandoverRequest,
) -> ValetBookingResponse:
    """Attendant completes vehicle handover and initial physical inspection."""
    valet = db.query(ValetBooking).filter(ValetBooking.valet_ticket_number == request.valet_ticket_number).first()
    if not valet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Valet ticket {request.valet_ticket_number} not found.",
        )

    valet.assigned_attendant_name = request.attendant_name
    valet.handover_time = datetime.utcnow()
    valet.status = ValetStatus.ACCEPTED_BY_VALET
    if request.inspection_notes:
        existing = valet.pre_inspection_notes or ""
        valet.pre_inspection_notes = f"{existing} | Attendant {request.attendant_name}: {request.inspection_notes}".strip(" |")

    logs = list(valet.custody_logs or [])
    logs.append({
        "timestamp": datetime.utcnow().isoformat(),
        "actor": request.attendant_name,
        "role": "VALET_ATTENDANT",
        "action": "VEHICLE_HANDOVER_ACCEPTED",
        "notes": f"Inspection: {request.inspection_notes or 'Clean'}. Fuel: {request.fuel_level_percent or 'N/A'}%, Odo: {request.odometer_km or 'N/A'} km.",
    })
    valet.custody_logs = logs

    db.commit()
    db.refresh(valet)
    return _to_valet_response(valet)


def valet_park_vehicle(
    db: Session,
    request: ValetParkRequest,
) -> ValetBookingResponse:
    """Record vehicle safely parked in designated valet storage vault."""
    valet = db.query(ValetBooking).filter(ValetBooking.valet_ticket_number == request.valet_ticket_number).first()
    if not valet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Valet ticket {request.valet_ticket_number} not found.",
        )

    valet.assigned_storage_slot = request.storage_slot
    valet.parked_time = datetime.utcnow()
    valet.status = ValetStatus.PARKED_IN_STORAGE

    logs = list(valet.custody_logs or [])
    logs.append({
        "timestamp": datetime.utcnow().isoformat(),
        "actor": request.attendant_name,
        "role": "VALET_ATTENDANT",
        "action": "VEHICLE_PARKED_IN_STORAGE",
        "notes": f"Securely positioned in storage slot {request.storage_slot}.",
    })
    valet.custody_logs = logs

    db.commit()
    db.refresh(valet)
    return _to_valet_response(valet)


def valet_request_retrieval(
    db: Session,
    valet_ticket_number: str,
) -> ValetBookingResponse:
    """Driver signals readiness to pick up car; notifies valet runner."""
    valet = db.query(ValetBooking).filter(ValetBooking.valet_ticket_number == valet_ticket_number).first()
    if not valet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Valet ticket {valet_ticket_number} not found.",
        )

    valet.status = ValetStatus.RETRIEVAL_REQUESTED
    valet.retrieval_requested_time = datetime.utcnow()

    logs = list(valet.custody_logs or [])
    logs.append({
        "timestamp": datetime.utcnow().isoformat(),
        "actor": valet.driver_name,
        "role": "DRIVER",
        "action": "RETRIEVAL_REQUESTED",
        "notes": "Driver requested vehicle return to Valet Exit Lounge.",
    })
    valet.custody_logs = logs

    db.commit()
    db.refresh(valet)
    return _to_valet_response(valet)


def valet_verify_and_return(
    db: Session,
    request: ValetReturnVerifyRequest,
) -> ValetBookingResponse:
    """Strictly verify driver's 6-digit OTP before releasing custody of the vehicle."""
    valet = db.query(ValetBooking).filter(ValetBooking.valet_ticket_number == request.valet_ticket_number).first()
    if not valet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Valet ticket {request.valet_ticket_number} not found.",
        )

    # Security Guardrail: Check OTP match
    if request.handover_otp.strip() != valet.handover_otp.strip():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Security Verification Failed: Invalid 6-digit driver return OTP. Vehicle custody cannot be released.",
        )

    valet.status = ValetStatus.RETURNED_TO_DRIVER
    valet.returned_time = datetime.utcnow()

    logs = list(valet.custody_logs or [])
    logs.append({
        "timestamp": datetime.utcnow().isoformat(),
        "actor": request.attendant_name,
        "role": "VALET_ATTENDANT",
        "action": "VEHICLE_RETURNED_TO_DRIVER",
        "notes": f"Identity verified via secure PIN. Vehicle successfully handed back to {valet.driver_name}.",
    })
    valet.custody_logs = logs

    db.commit()
    db.refresh(valet)
    return _to_valet_response(valet)


def report_valet_incident(
    db: Session,
    request: ValetIncidentReportRequest,
) -> ValetBookingResponse:
    """Record damages or incident during valet custody for operator review."""
    valet = db.query(ValetBooking).filter(ValetBooking.valet_ticket_number == request.valet_ticket_number).first()
    if not valet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Valet ticket {request.valet_ticket_number} not found.",
        )

    valet.incident_reported = True
    valet.incident_description = request.incident_description

    logs = list(valet.custody_logs or [])
    logs.append({
        "timestamp": datetime.utcnow().isoformat(),
        "actor": request.reported_by,
        "role": "OPERATOR",
        "action": "INCIDENT_RECORDED",
        "notes": request.incident_description,
    })
    valet.custody_logs = logs

    db.commit()
    db.refresh(valet)
    return _to_valet_response(valet)


def _to_valet_response(valet: ValetBooking, facility_name: Optional[str] = None) -> ValetBookingResponse:
    return ValetBookingResponse(
        id=valet.id,
        valet_ticket_number=valet.valet_ticket_number,
        facility_id=valet.facility_id,
        facility_name=facility_name or (valet.facility.name if valet.facility else "Central Facility"),
        driver_name=valet.driver_name,
        driver_phone=valet.driver_phone,
        vehicle_plate=valet.vehicle_plate,
        vehicle_model=valet.vehicle_model,
        status=valet.status.value,
        assigned_attendant_name=valet.assigned_attendant_name,
        assigned_storage_slot=valet.assigned_storage_slot,
        handover_otp=valet.handover_otp,
        handover_time=valet.handover_time,
        parked_time=valet.parked_time,
        retrieval_requested_time=valet.retrieval_requested_time,
        returned_time=valet.returned_time,
        pre_inspection_notes=valet.pre_inspection_notes,
        incident_reported=valet.incident_reported,
        incident_description=valet.incident_description,
        custody_logs=valet.custody_logs or [],
        created_at=valet.created_at,
    )


# ---------------------------------------------------------------------------
# Pillar C: Mall & Venue Integration Service
# ---------------------------------------------------------------------------

def list_venue_destinations(
    db: Session,
    facility_id: Optional[int] = None,
    category: Optional[str] = None,
) -> List[VenueDestinationResponse]:
    """Retrieve all mall/venue destinations with optional category filtering."""
    query = db.query(VenueDestination).filter(VenueDestination.is_active == True)
    if facility_id:
        query = query.filter(VenueDestination.facility_id == facility_id)
    if category:
        query = query.filter(VenueDestination.category == category.upper())

    results = query.order_by(VenueDestination.name.asc()).all()
    facility_map = {f.id: f.name for f in db.query(ParkingLot).all()}

    return [
        VenueDestinationResponse(
            id=v.id,
            facility_id=v.facility_id,
            facility_name=facility_map.get(v.facility_id, "Central Mall"),
            name=v.name,
            category=v.category.value,
            floor=v.floor,
            unit_number=v.unit_number,
            opening_hours=v.opening_hours,
            nearest_parking_zone=v.nearest_parking_zone,
            nearest_elevator_bank=v.nearest_elevator_bank,
            description=v.description,
            logo_icon=v.logo_icon,
            is_active=v.is_active,
        )
        for v in results
    ]


def create_venue_destination(
    db: Session,
    request: VenueDestinationCreate,
) -> VenueDestinationResponse:
    """Operator adds or manages a store, cinema, or attraction in facility directory."""
    facility = db.query(ParkingLot).filter(ParkingLot.id == request.facility_id).first()
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility {request.facility_id} not found.",
        )

    venue = VenueDestination(
        facility_id=request.facility_id,
        name=request.name.strip(),
        category=VenueCategory(request.category.upper()),
        floor=request.floor.strip(),
        unit_number=request.unit_number.strip(),
        opening_hours=request.opening_hours.strip(),
        nearest_parking_zone=request.nearest_parking_zone.strip(),
        nearest_elevator_bank=request.nearest_elevator_bank.strip(),
        description=request.description,
        logo_icon=request.logo_icon,
        is_active=True,
    )
    db.add(venue)
    db.commit()
    db.refresh(venue)

    return VenueDestinationResponse(
        id=venue.id,
        facility_id=venue.facility_id,
        facility_name=facility.name,
        name=venue.name,
        category=venue.category.value,
        floor=venue.floor,
        unit_number=venue.unit_number,
        opening_hours=venue.opening_hours,
        nearest_parking_zone=venue.nearest_parking_zone,
        nearest_elevator_bank=venue.nearest_elevator_bank,
        description=venue.description,
        logo_icon=venue.logo_icon,
        is_active=venue.is_active,
    )


def calculate_venue_pedestrian_route(
    db: Session,
    venue_id: int,
    user_id: int,
    reverse: bool = False,
) -> PedestrianRouteResponse:
    """Generate multi-floor pedestrian path between parked car and mall store."""
    venue = db.query(VenueDestination).filter(VenueDestination.id == venue_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Venue destination {venue_id} not found.",
        )

    saved_loc = get_saved_vehicle_location(db, user_id)
    car_label = f"Parked Slot {saved_loc.slot_number} ({saved_loc.floor})" if saved_loc else "Parking Concourse"
    venue_label = f"{venue.name} ({venue.floor}, {venue.unit_number})"

    if not reverse:
        # Car -> Store
        origin = car_label
        destination = venue_label
        steps = [
            PedestrianRouteStep(
                step_number=1,
                instruction=f"Exit parking bay and follow green walkway to {venue.nearest_elevator_bank}.",
                floor=saved_loc.floor if saved_loc else "Basement",
                step_type="WALKWAY",
                distance_meters=35,
                notes="Pedestrian safety corridor.",
            ),
            PedestrianRouteStep(
                step_number=2,
                instruction=f"Take {venue.nearest_elevator_bank} up to {venue.floor}.",
                floor=venue.floor,
                step_type="ELEVATOR",
                distance_meters=20,
                notes=f"Transition from garage level to retail level {venue.floor}.",
            ),
            PedestrianRouteStep(
                step_number=3,
                instruction=f"Turn right from elevator lobby onto main atrium concourse.",
                floor=venue.floor,
                step_type="WALKWAY",
                distance_meters=45,
                notes=f"Pass central fountain towards {venue.nearest_parking_zone} corridor.",
            ),
            PedestrianRouteStep(
                step_number=4,
                instruction=f"Arrive at {venue.name} ({venue.unit_number}).",
                floor=venue.floor,
                step_type="ARRIVED",
                distance_meters=10,
                notes=f"Open: {venue.opening_hours}.",
            ),
        ]
    else:
        # Store -> Car
        origin = venue_label
        destination = car_label
        steps = [
            PedestrianRouteStep(
                step_number=1,
                instruction=f"Exit {venue.name} and walk along atrium towards {venue.nearest_elevator_bank}.",
                floor=venue.floor,
                step_type="WALKWAY",
                distance_meters=55,
                notes="Follow illuminated parking lobby directional signs.",
            ),
            PedestrianRouteStep(
                step_number=2,
                instruction=f"Take {venue.nearest_elevator_bank} down to {saved_loc.floor if saved_loc else 'Basement 1'}.",
                floor=saved_loc.floor if saved_loc else "Basement 1",
                step_type="ELEVATOR",
                distance_meters=20,
                notes="Select your parking level.",
            ),
            PedestrianRouteStep(
                step_number=3,
                instruction=f"Exit into parking corridor and head towards {saved_loc.zone if saved_loc else 'Zone A'}.",
                floor=saved_loc.floor if saved_loc else "Basement 1",
                step_type="WALKWAY",
                distance_meters=30,
                notes=f"Pillar ref: {saved_loc.pillar_reference or 'Pillar 4B'}." if saved_loc else None,
            ),
            PedestrianRouteStep(
                step_number=4,
                instruction=f"Arrive back at your parked car ({destination}).",
                floor=saved_loc.floor if saved_loc else "Basement 1",
                step_type="ARRIVED",
                distance_meters=5,
                notes="Pedestrian navigation completed.",
            ),
        ]

    total_dist = sum(s.distance_meters for s in steps)
    est_minutes = max(1, round(total_dist / 40))

    return PedestrianRouteResponse(
        origin=origin,
        destination=destination,
        total_distance_meters=total_dist,
        estimated_walk_minutes=est_minutes,
        is_pedestrian_only=True,
        steps=steps,
    )


# ---------------------------------------------------------------------------
# Pillar D: Driver Assistance & Incident Reporting Service
# ---------------------------------------------------------------------------

def create_assistance_request(
    db: Session,
    user_id: int,
    request: AssistanceRequestCreate,
) -> AssistanceRequestResponse:
    """Submit an incident ticket or help request for parking staff dispatch."""
    facility = db.query(ParkingLot).filter(ParkingLot.id == request.facility_id).first()
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility {request.facility_id} not found.",
        )

    ticket_number = f"HELP-{datetime.utcnow().strftime('%y%m%d')}-{random.randint(100, 999)}"

    initial_history = [
        {
            "timestamp": datetime.utcnow().isoformat(),
            "status": "SUBMITTED",
            "actor": request.driver_name,
            "role": "DRIVER",
            "notes": f"Incident reported: {request.description}",
        }
    ]

    ar = AssistanceRequest(
        ticket_number=ticket_number,
        facility_id=request.facility_id,
        user_id=user_id,
        driver_name=request.driver_name,
        driver_phone=request.driver_phone,
        vehicle_plate=request.vehicle_plate.strip().upper() if request.vehicle_plate else None,
        slot_number=request.slot_number.strip().upper() if request.slot_number else None,
        category=AssistanceCategory(request.category.upper()),
        urgency=AssistanceUrgency(request.urgency.upper()),
        description=request.description.strip(),
        status=AssistanceStatus.SUBMITTED,
        created_at=datetime.utcnow(),
        status_history=initial_history,
    )
    db.add(ar)
    db.commit()
    db.refresh(ar)

    return _to_assistance_response(ar, facility.name)


def list_assistance_requests(
    db: Session,
    facility_id: Optional[int] = None,
    status_filter: Optional[str] = None,
) -> List[AssistanceRequestResponse]:
    """Retrieve all assistance tickets with audit history."""
    query = db.query(AssistanceRequest)
    if facility_id:
        query = query.filter(AssistanceRequest.facility_id == facility_id)
    if status_filter:
        query = query.filter(AssistanceRequest.status == status_filter.upper())

    results = query.order_by(AssistanceRequest.created_at.desc()).all()
    facility_map = {f.id: f.name for f in db.query(ParkingLot).all()}

    return [_to_assistance_response(a, facility_map.get(a.facility_id, "Central Facility")) for a in results]


def update_assistance_status(
    db: Session,
    request: AssistanceStatusUpdateRequest,
) -> AssistanceRequestResponse:
    """Staff updates ticket progress, dispatches patrol, or resolves incident."""
    ar = db.query(AssistanceRequest).filter(AssistanceRequest.ticket_number == request.ticket_number).first()
    if not ar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assistance ticket {request.ticket_number} not found.",
        )

    new_status = AssistanceStatus(request.status.upper())
    ar.status = new_status
    ar.assigned_staff_name = request.staff_name

    now = datetime.utcnow()
    if new_status == AssistanceStatus.ACKNOWLEDGED and not ar.acknowledged_at:
        ar.acknowledged_at = now
    elif new_status in (AssistanceStatus.RESOLVED, AssistanceStatus.CLOSED):
        ar.resolved_at = now
        if request.notes:
            ar.staff_resolution_notes = request.notes

    history = list(ar.status_history or [])
    history.append({
        "timestamp": now.isoformat(),
        "status": new_status.value,
        "actor": request.staff_name,
        "role": "STAFF",
        "notes": request.notes or f"Status transitioned to {new_status.value}.",
    })
    ar.status_history = history

    db.commit()
    db.refresh(ar)
    return _to_assistance_response(ar)


def _to_assistance_response(ar: AssistanceRequest, facility_name: Optional[str] = None) -> AssistanceRequestResponse:
    return AssistanceRequestResponse(
        id=ar.id,
        ticket_number=ar.ticket_number,
        facility_id=ar.facility_id,
        facility_name=facility_name or (ar.facility.name if ar.facility else "Central Facility"),
        driver_name=ar.driver_name,
        driver_phone=ar.driver_phone,
        vehicle_plate=ar.vehicle_plate,
        slot_number=ar.slot_number,
        category=ar.category.value,
        urgency=ar.urgency.value,
        description=ar.description,
        status=ar.status.value,
        assigned_staff_name=ar.assigned_staff_name,
        staff_resolution_notes=ar.staff_resolution_notes,
        created_at=ar.created_at,
        acknowledged_at=ar.acknowledged_at,
        resolved_at=ar.resolved_at,
        status_history=ar.status_history or [],
    )


# ---------------------------------------------------------------------------
# Seeder for Phase 19 Sample Data
# ---------------------------------------------------------------------------

def seed_phase19_ecosystem_data(db: Session) -> None:
    """Populate sample data for Find-My-Car, Valet, Mall Venues & Support Tickets."""
    facilities = db.query(ParkingLot).all()
    if not facilities:
        return
    fac = facilities[0]

    # 1. Seed demo venue destinations
    existing_venues = db.query(VenueDestination).filter(VenueDestination.facility_id == fac.id).count()
    if existing_venues == 0:
        demo_venues = [
            VenueDestination(
                facility_id=fac.id,
                name="PVR Director's Cut & IMAX",
                category=VenueCategory.CINEMA,
                floor="Level 3",
                unit_number="Unit 301",
                opening_hours="09:00 AM - 01:00 AM",
                nearest_parking_zone="Zone Blue (Basement 1)",
                nearest_elevator_bank="Elevator Bank B",
                description="Luxury IMAX 4K screening auditoriums with gourmet dining.",
                logo_icon="Film",
            ),
            VenueDestination(
                facility_id=fac.id,
                name="Zara Flagship Store",
                category=VenueCategory.SHOPPING,
                floor="Ground Floor",
                unit_number="Unit G-12",
                opening_hours="10:00 AM - 10:00 PM",
                nearest_parking_zone="Zone Red (Basement 1)",
                nearest_elevator_bank="Elevator Bank A",
                description="International fast-fashion and accessories flagship showroom.",
                logo_icon="ShoppingBag",
            ),
            VenueDestination(
                facility_id=fac.id,
                name="Food Atrium & Specialty Dining",
                category=VenueCategory.DINING,
                floor="Level 2",
                unit_number="Food Court 200",
                opening_hours="11:00 AM - 11:30 PM",
                nearest_parking_zone="Zone Green (Basement 2)",
                nearest_elevator_bank="Elevator Bank C",
                description="Global cuisine, artisan bakeries, and gourmet coffee lounges.",
                logo_icon="UtensilsCrossed",
            ),
            VenueDestination(
                facility_id=fac.id,
                name="Apple Store & Authorized Care",
                category=VenueCategory.SHOPPING,
                floor="Ground Floor",
                unit_number="Unit G-05",
                opening_hours="10:00 AM - 10:00 PM",
                nearest_parking_zone="Zone Red (Basement 1)",
                nearest_elevator_bank="Elevator Bank A",
                description="Official flagship store and Genius Bar technical service.",
                logo_icon="Smartphone",
            ),
            VenueDestination(
                facility_id=fac.id,
                name="WeWork Enterprise Hub & Offices",
                category=VenueCategory.OFFICES,
                floor="Level 4",
                unit_number="Tower B - Suite 401",
                opening_hours="24/7 Access",
                nearest_parking_zone="Zone Blue (Basement 1)",
                nearest_elevator_bank="Elevator Bank B",
                description="Flexible workspaces and executive conference boardrooms.",
                logo_icon="Building",
            ),
        ]
        db.add_all(demo_venues)
        db.commit()

    # 2. Seed demo saved vehicle location for User 1
    existing_loc = db.query(SavedVehicleLocation).filter(SavedVehicleLocation.user_id == 1).first()
    if not existing_loc:
        demo_loc = SavedVehicleLocation(
            user_id=1,
            facility_id=fac.id,
            floor="Basement 2",
            zone="Zone Green",
            slot_number="B2-142",
            pillar_reference="Pillar 4B",
            photo_url="/static/sample_parked_car.jpg",
            driver_notes="Parked directly facing the Elevator Bank C glass doors.",
            saved_at=datetime.utcnow(),
            is_active=True,
            retention_expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        db.add(demo_loc)
        db.commit()

    # 3. Seed demo valet booking
    existing_valet = db.query(ValetBooking).filter(ValetBooking.facility_id == fac.id).first()
    if not existing_valet:
        demo_valet = ValetBooking(
            valet_ticket_number="VALET-2026-DEMO01",
            facility_id=fac.id,
            driver_user_id=1,
            driver_name="Rajesh Sharma",
            driver_phone="+91 98110 54321",
            vehicle_plate="DL01VAL9999",
            vehicle_model="BMW 5-Series Sedan",
            status=ValetStatus.PARKED_IN_STORAGE,
            assigned_attendant_name="Vikram Singh",
            assigned_storage_slot="Valet Vault V-04",
            handover_otp="842910",
            handover_time=datetime.utcnow() - timedelta(minutes=45),
            parked_time=datetime.utcnow() - timedelta(minutes=40),
            pre_inspection_notes="Clean exterior, no scratches. Fuel: 70%. Odometer: 14,200 km.",
            custody_logs=[
                {
                    "timestamp": (datetime.utcnow() - timedelta(minutes=45)).isoformat(),
                    "actor": "Vikram Singh",
                    "role": "VALET_ATTENDANT",
                    "action": "VEHICLE_HANDOVER_ACCEPTED",
                    "notes": "Handover accepted at Grand Portico VIP Entry.",
                },
                {
                    "timestamp": (datetime.utcnow() - timedelta(minutes=40)).isoformat(),
                    "actor": "Vikram Singh",
                    "role": "VALET_ATTENDANT",
                    "action": "VEHICLE_PARKED_IN_STORAGE",
                    "notes": "Parked in subterranean secure valet vault slot V-04.",
                },
            ],
            created_at=datetime.utcnow() - timedelta(minutes=50),
        )
        db.add(demo_valet)
        db.commit()

    # 4. Seed demo assistance request
    existing_ar = db.query(AssistanceRequest).filter(AssistanceRequest.facility_id == fac.id).first()
    if not existing_ar:
        demo_ar = AssistanceRequest(
            ticket_number="HELP-2026-DEMO01",
            facility_id=fac.id,
            user_id=1,
            driver_name="Ananya Roy",
            driver_phone="+91 98220 12345",
            vehicle_plate="DL03AB4021",
            slot_number="B1-08",
            category=AssistanceCategory.BLOCKED_SLOT,
            urgency=AssistanceUrgency.HIGH,
            description="Slot B1-08 allotted on booking is partially blocked by a delivery trolley.",
            status=AssistanceStatus.STAFF_DISPATCHED,
            assigned_staff_name="Suraj Patil (Patrol Unit 2)",
            created_at=datetime.utcnow() - timedelta(minutes=25),
            acknowledged_at=datetime.utcnow() - timedelta(minutes=20),
            status_history=[
                {
                    "timestamp": (datetime.utcnow() - timedelta(minutes=25)).isoformat(),
                    "status": "SUBMITTED",
                    "actor": "Ananya Roy",
                    "role": "DRIVER",
                    "notes": "Incident ticket lodged via Parkwise App.",
                },
                {
                    "timestamp": (datetime.utcnow() - timedelta(minutes=20)).isoformat(),
                    "status": "STAFF_DISPATCHED",
                    "actor": "Suraj Patil",
                    "role": "STAFF",
                    "notes": "Patrol attendant dispatched with utility clearing team.",
                },
            ],
        )
        db.add(demo_ar)
        db.commit()
