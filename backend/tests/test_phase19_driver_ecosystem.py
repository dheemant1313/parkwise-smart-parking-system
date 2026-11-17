"""Phase 19: Comprehensive Test Suite for Driver Convenience, Valet Parking, Venues & Assistance."""

from datetime import datetime
import uuid
import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import ParkingLot, SlotStatus, SlotType, User, UserRole
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
    AssistanceStatusUpdateRequest,
    SavedVehicleLocationCreate,
    ValetHandoverRequest,
    ValetIncidentReportRequest,
    ValetParkRequest,
    ValetRequestCreate,
    ValetReturnVerifyRequest,
    VenueDestinationCreate,
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
    seed_phase19_ecosystem_data,
    update_assistance_status,
    valet_handover_vehicle,
    valet_park_vehicle,
    valet_request_retrieval,
    valet_verify_and_return,
)


@pytest.fixture
def p19_ctx():
    """Seed test facility and driver user."""
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    suffix = uuid.uuid4().hex[:6].upper()
    try:
        user = User(
            full_name=f"Vikramaditya Driver {suffix}",
            email=f"driver19_{suffix}@parkwise.io",
            phone=f"+9198{suffix[:8]}",
            password_hash="argon2_mock",
            role=UserRole.DRIVER,
            vehicle_number=f"DL01VL{suffix[:4]}",
            is_active=True,
        )
        session.add(user)

        lot = ParkingLot(
            code=f"LOT-P19-{suffix}",
            name=f"DLF CyberMall Grand Facility {suffix}",
            city="Gurugram",
            address="CyberCity Phase 2, Gurugram",
            latitude=28.4900,
            longitude=77.0900,
            total_floors=3,
            base_hourly_rate_inr=60.0,
            grace_period_minutes=15,
            operator_name="CyberMall Operator",
            kyc_verified=True,
        )
        session.add(lot)
        session.commit()
        session.refresh(user)
        session.refresh(lot)

        yield {"db": session, "user": user, "lot": lot}
    finally:
        session.rollback()
        session.close()


# ---------------------------------------------------------------------------
# Pillar A Tests: Find My Car
# ---------------------------------------------------------------------------

def test_save_vehicle_location_and_retention(p19_ctx):
    db = p19_ctx["db"]
    user = p19_ctx["user"]
    lot = p19_ctx["lot"]

    req = SavedVehicleLocationCreate(
        facility_id=lot.id,
        floor="B2",
        zone="Zone Emerald",
        slot_number="B2-88",
        pillar_reference="Pillar 12C",
        photo_url="https://cdn.parkwise.io/photos/car12c.jpg",
        driver_notes="Parked near south elevator",
    )
    saved = save_vehicle_location(db, user_id=user.id, request=req)

    assert saved.slot_number == "B2-88"
    assert saved.floor == "B2"
    assert saved.zone == "Zone Emerald"
    assert saved.pillar_reference == "Pillar 12C"
    assert saved.is_active is True
    assert saved.retention_expires_at is not None
    assert saved.retention_expires_at > datetime.utcnow()


def test_get_and_clear_saved_vehicle_location(p19_ctx):
    db = p19_ctx["db"]
    user = p19_ctx["user"]
    lot = p19_ctx["lot"]

    req = SavedVehicleLocationCreate(
        facility_id=lot.id,
        floor="B1",
        zone="Zone Sapphire",
        slot_number="B1-40",
    )
    save_vehicle_location(db, user_id=user.id, request=req)

    retrieved = get_saved_vehicle_location(db, user_id=user.id)
    assert retrieved is not None
    assert retrieved.slot_number == "B1-40"

    clear_res = clear_saved_vehicle_location(db, user_id=user.id)
    assert clear_res["status"] == "cleared"
    assert clear_res["records_purged"] == 1

    cleared = get_saved_vehicle_location(db, user_id=user.id)
    assert cleared is None


def test_calculate_pedestrian_return_route(p19_ctx):
    db = p19_ctx["db"]
    user = p19_ctx["user"]
    lot = p19_ctx["lot"]

    req = SavedVehicleLocationCreate(
        facility_id=lot.id,
        floor="B2",
        zone="Zone Ruby",
        slot_number="B2-19",
        pillar_reference="Pillar 5A",
        driver_notes="Adjacent to baggage trolley bay",
    )
    save_vehicle_location(db, user_id=user.id, request=req)

    route = calculate_pedestrian_return_route(db, user_id=user.id, origin="Mall Ground Concourse")
    assert route.total_distance_meters > 0
    assert route.is_pedestrian_only is True
    assert len(route.steps) >= 4
    # Verifies elevator transition step
    elevator_steps = [s for s in route.steps if s.step_type == "ELEVATOR"]
    assert len(elevator_steps) > 0
    assert elevator_steps[0].floor == "B2"


# ---------------------------------------------------------------------------
# Pillar B Tests: Valet Parking
# ---------------------------------------------------------------------------

def test_valet_request_creation_and_ticket_generation(p19_ctx):
    db = p19_ctx["db"]
    user = p19_ctx["user"]
    lot = p19_ctx["lot"]

    req = ValetRequestCreate(
        facility_id=lot.id,
        vehicle_plate="DL01VL2026",
        vehicle_model="Audi e-tron GT",
        driver_name=user.full_name,
        driver_phone=user.phone,
        pre_inspection_notes="Spotless bodywork",
    )
    valet = create_valet_request(db, driver_user_id=user.id, request=req)

    assert valet.valet_ticket_number.startswith("VALET-")
    assert len(valet.handover_otp) == 6
    assert valet.status == "REQUESTED"
    assert valet.vehicle_plate == "DL01VL2026"
    assert len(valet.custody_logs) == 1


def test_valet_handover_and_storage_parking(p19_ctx):
    db = p19_ctx["db"]
    user = p19_ctx["user"]
    lot = p19_ctx["lot"]

    req = ValetRequestCreate(
        facility_id=lot.id,
        vehicle_plate="HR26VL7777",
        vehicle_model="Mercedes EQS",
        driver_name="Sunil Bansal",
        driver_phone="+91 98888 22222",
    )
    valet = create_valet_request(db, driver_user_id=user.id, request=req)

    # 1. Attendant Handover
    handover = valet_handover_vehicle(
        db,
        request=ValetHandoverRequest(
            valet_ticket_number=valet.valet_ticket_number,
            attendant_name="Attendant Suresh",
            inspection_notes="Front left rim minor scuff",
            fuel_level_percent=85,
            odometer_km=8400,
        ),
    )
    assert handover.status == "ACCEPTED_BY_VALET"
    assert handover.assigned_attendant_name == "Attendant Suresh"
    assert "Attendant Suresh" in handover.pre_inspection_notes

    # 2. Park in Storage Vault
    parked = valet_park_vehicle(
        db,
        request=ValetParkRequest(
            valet_ticket_number=valet.valet_ticket_number,
            storage_slot="Valet Vault V-12",
            attendant_name="Attendant Suresh",
        ),
    )
    assert parked.status == "PARKED_IN_STORAGE"
    assert parked.assigned_storage_slot == "Valet Vault V-12"
    assert len(parked.custody_logs) == 3


def test_valet_return_verification_guardrail(p19_ctx):
    db = p19_ctx["db"]
    user = p19_ctx["user"]
    lot = p19_ctx["lot"]

    req = ValetRequestCreate(
        facility_id=lot.id,
        vehicle_plate="KA01VL9999",
        vehicle_model="BMW i7",
        driver_name="Pooja Rao",
        driver_phone="+91 97777 33333",
    )
    valet = create_valet_request(db, driver_user_id=user.id, request=req)
    correct_otp = valet.handover_otp

    # Transition to retrieval requested
    retrieval = valet_request_retrieval(db, valet_ticket_number=valet.valet_ticket_number)
    assert retrieval.status == "RETRIEVAL_REQUESTED"

    # Security Guardrail: Attempt vehicle return with wrong OTP must fail with HTTP 403
    with pytest.raises(Exception) as exc_info:
        valet_verify_and_return(
            db,
            request=ValetReturnVerifyRequest(
                valet_ticket_number=valet.valet_ticket_number,
                handover_otp="000000",
                attendant_name="Attendant Suresh",
            ),
        )
    assert "403" in str(exc_info.value) or "Security Verification Failed" in str(exc_info.value)

    # Valid return with matching 6-digit OTP
    returned = valet_verify_and_return(
        db,
        request=ValetReturnVerifyRequest(
            valet_ticket_number=valet.valet_ticket_number,
            handover_otp=correct_otp,
            attendant_name="Attendant Suresh",
        ),
    )
    assert returned.status == "RETURNED_TO_DRIVER"
    assert returned.returned_time is not None


def test_valet_incident_reporting(p19_ctx):
    db = p19_ctx["db"]
    user = p19_ctx["user"]
    lot = p19_ctx["lot"]

    req = ValetRequestCreate(
        facility_id=lot.id,
        vehicle_plate="DL08VL3333",
        vehicle_model="Volvo XC40 Recharge",
        driver_name="Amit Kapoor",
        driver_phone="+91 96666 44444",
    )
    valet = create_valet_request(db, driver_user_id=user.id, request=req)

    incident = report_valet_incident(
        db,
        request=ValetIncidentReportRequest(
            valet_ticket_number=valet.valet_ticket_number,
            incident_description="Pre-existing hairline scratch on rear bumper identified during bay parking.",
            reported_by="Supervisor Rakesh",
        ),
    )
    assert incident.incident_reported is True
    assert "hairline scratch" in incident.incident_description


# ---------------------------------------------------------------------------
# Pillar C Tests: Mall & Venue Integration
# ---------------------------------------------------------------------------

def test_mall_venue_destinations_and_routes(p19_ctx):
    db = p19_ctx["db"]
    user = p19_ctx["user"]
    lot = p19_ctx["lot"]

    v1 = create_venue_destination(
        db,
        request=VenueDestinationCreate(
            facility_id=lot.id,
            name="PVR IMAX Platinum",
            category="CINEMA",
            floor="Level 4",
            unit_number="Unit 401",
            nearest_parking_zone="Zone Blue (Basement 1)",
            nearest_elevator_bank="Elevator Bank B",
        ),
    )
    v2 = create_venue_destination(
        db,
        request=VenueDestinationCreate(
            facility_id=lot.id,
            name="Starbucks Reserve",
            category="DINING",
            floor="Ground Floor",
            unit_number="Unit G-01",
            nearest_parking_zone="Zone Red (Basement 1)",
            nearest_elevator_bank="Elevator Bank A",
        ),
    )

    # Test directory listing and filter
    cinemas = list_venue_destinations(db, facility_id=lot.id, category="CINEMA")
    assert len(cinemas) == 1
    assert cinemas[0].name == "PVR IMAX Platinum"

    # Save vehicle location first
    save_vehicle_location(
        db,
        user_id=user.id,
        request=SavedVehicleLocationCreate(
            facility_id=lot.id,
            floor="B1",
            zone="Zone Blue",
            slot_number="B1-12",
        ),
    )

    # Forward route: Car -> Cinema
    route_forward = calculate_venue_pedestrian_route(db, venue_id=v1.id, user_id=user.id, reverse=False)
    assert route_forward.origin.startswith("Parked Slot B1-12")
    assert "PVR IMAX" in route_forward.destination
    assert route_forward.total_distance_meters > 0

    # Reverse route: Cinema -> Car
    route_reverse = calculate_venue_pedestrian_route(db, venue_id=v1.id, user_id=user.id, reverse=True)
    assert "PVR IMAX" in route_reverse.origin
    assert "B1-12" in route_reverse.destination


# ---------------------------------------------------------------------------
# Pillar D Tests: Driver Assistance & Support
# ---------------------------------------------------------------------------

def test_driver_assistance_workflow_lifecycle(p19_ctx):
    db = p19_ctx["db"]
    user = p19_ctx["user"]
    lot = p19_ctx["lot"]

    # 1. Driver lodges ticket
    ticket = create_assistance_request(
        db,
        user_id=user.id,
        request=AssistanceRequestCreate(
            facility_id=lot.id,
            driver_name=user.full_name,
            driver_phone=user.phone,
            vehicle_plate="DL01NC2026",
            slot_number="B2-04",
            category="BLOCKED_SLOT",
            urgency="HIGH",
            description="Vehicle unauthorizedly occupying allotted bay B2-04.",
        ),
    )
    assert ticket.ticket_number.startswith("HELP-")
    assert ticket.status == "SUBMITTED"
    assert ticket.urgency == "HIGH"

    # 2. Staff acknowledges
    ack = update_assistance_status(
        db,
        request=AssistanceStatusUpdateRequest(
            ticket_number=ticket.ticket_number,
            status="ACKNOWLEDGED",
            staff_name="Patrol Officer Manpreet",
            notes="Acknowledged in dispatch queue.",
        ),
    )
    assert ack.status == "ACKNOWLEDGED"
    assert ack.assigned_staff_name == "Patrol Officer Manpreet"
    assert ack.acknowledged_at is not None

    # 3. Staff dispatched
    dispatch = update_assistance_status(
        db,
        request=AssistanceStatusUpdateRequest(
            ticket_number=ticket.ticket_number,
            status="STAFF_DISPATCHED",
            staff_name="Patrol Officer Manpreet",
            notes="Patrol en-route to level B2.",
        ),
    )
    assert dispatch.status == "STAFF_DISPATCHED"

    # 4. Resolved
    resolved = update_assistance_status(
        db,
        request=AssistanceStatusUpdateRequest(
            ticket_number=ticket.ticket_number,
            status="RESOLVED",
            staff_name="Patrol Officer Manpreet",
            notes="Unauthorized vehicle redirected. Driver escorted into bay B2-04.",
        ),
    )
    assert resolved.status == "RESOLVED"
    assert resolved.resolved_at is not None
    assert len(resolved.status_history) == 4


# ---------------------------------------------------------------------------
# Pillar E: API Integration Test via TestClient
# ---------------------------------------------------------------------------

def test_driver_ecosystem_api_routes(p19_ctx):
    db = p19_ctx["db"]
    user = p19_ctx["user"]
    lot = p19_ctx["lot"]
    seed_phase19_ecosystem_data(db)
    client = TestClient(app)

    # 1. Find My Car
    res_save = client.post(
        f"/api/v1/driver-ecosystem/find-my-car/save?user_id={user.id}",
        json={
            "facility_id": lot.id,
            "floor": "B3",
            "zone": "Zone Diamond",
            "slot_number": "B3-99",
            "pillar_reference": "Pillar 8A",
            "driver_notes": "Right next to staircase 3",
        },
    )
    assert res_save.status_code == 200
    assert res_save.json()["slot_number"] == "B3-99"

    res_loc = client.get(f"/api/v1/driver-ecosystem/find-my-car/location?user_id={user.id}")
    assert res_loc.status_code == 200
    assert res_loc.json()["slot_number"] == "B3-99"

    res_route = client.get(f"/api/v1/driver-ecosystem/find-my-car/route?user_id={user.id}")
    assert res_route.status_code == 200
    assert "steps" in res_route.json()

    # 2. Venues
    res_venues = client.get(f"/api/v1/driver-ecosystem/venues?facility_id={lot.id}")
    assert res_venues.status_code == 200
    assert isinstance(res_venues.json(), list)

    # 3. Valet
    res_valet = client.get(f"/api/v1/driver-ecosystem/valet/requests?facility_id={lot.id}")
    assert res_valet.status_code == 200
    assert isinstance(res_valet.json(), list)

    # 4. Assistance
    res_help = client.get(f"/api/v1/driver-ecosystem/assistance/requests?facility_id={lot.id}")
    assert res_help.status_code == 200
    assert isinstance(res_help.json(), list)
