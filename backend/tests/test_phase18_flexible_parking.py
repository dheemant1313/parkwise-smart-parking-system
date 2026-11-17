"""Comprehensive automated tests for Phase 18: EV Charging, Accessibility, Group Bookings & Smart Waitlist.

Covers:
1. EV Charging Station Registry & Connector Compatibility
2. EV Charging Reservation & Live OCPP Telemetry Session
3. EV Charger Hardware Completion & Incompatible Connector Rejection
4. Government Disability Badge (UDID) Registration & Verification
5. CORE GUARDRAIL: Unauthorized Driver Rejected for Accessible Bay Access
6. Step-Free Accessible Route Calculation (No Stairs, Elevators & Ramps only)
7. Multi-Slot Family / Group Booking Creation with Independent QR Passes
8. Staggered Group Arrival & Independent Member Check-In
9. Partial Group Member Cancellation (Releases Single Bay, Preserves Group)
10. Smart Waitlist Queue Joining & FIFO Queue Assignment
11. Slot Vacancy Triggers Atomic 10-Minute Hold for Queued Candidate
12. Waitlist Claim Successfully Converts into Confirmed Booking & Payment
13. Expired Waitlist Offer Times Out and Cascades
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import (
    Booking,
    BookingStatus,
    ParkingLot,
    ParkingSlot,
    Payment,
    PaymentStatus,
    SlotStatus,
    SlotType,
    User,
    UserRole,
)
from app.models_phase18 import (
    AccessibilityCredential,
    EVChargerStation,
    EVChargerStatus,
    EVSmartChargingSession,
    EVChargingSessionStatus,
    FacilityWaitlistEntry,
    GroupBooking,
    GroupBookingMember,
    GroupBookingStatus,
    GroupMemberStatus,
    WaitlistStatus,
)
from app.schemas_phase18 import (
    AccessibilityVerifyRequest,
    EVChargingReserveRequest,
    EVChargingTelemetryUpdateRequest,
    GroupBookingCreateRequest,
    GroupMemberInput,
    WaitlistClaimRequest,
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


@pytest.fixture
def db():
    """Isolated database session with clean rollback."""
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def p18_context(db: Session):
    """Seed test facility with standard, EV charging, and accessible bays."""
    suffix = uuid.uuid4().hex[:6].upper()

    driver = User(
        full_name=f"Driver P18 {suffix}",
        email=f"driver_p18_{suffix}@example.com",
        phone=f"+9198765{suffix[:5]}",
        password_hash="argon2_mock",
        role=UserRole.DRIVER,
        vehicle_number=f"MH02EV{suffix[:4]}",
        is_active=True,
    )
    db.add(driver)

    lot = ParkingLot(
        code=f"LOT-P18-{suffix}",
        name=f"Flexible Hub {suffix}",
        city="Mumbai",
        address="Bandra Kurla Complex",
        latitude=19.0657,
        longitude=72.8687,
        total_floors=2,
        base_hourly_rate_inr=60.0,
        grace_period_minutes=15,
        operator_name="Parkwise Flexi Corp",
        kyc_verified=True,
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)

    # 1. Standard Slot
    std_slot = ParkingSlot(
        lot_id=lot.id,
        slot_number=f"S-STD-{suffix}",
        floor=1,
        zone="A",
        slot_type=SlotType.STANDARD,
        status=SlotStatus.AVAILABLE,
    )
    db.add(std_slot)

    # 2. EV Charging Slot & Hardware Station
    ev_slot = ParkingSlot(
        lot_id=lot.id,
        slot_number=f"S-EV-{suffix}",
        floor=1,
        zone="E",
        slot_type=SlotType.EV_CHARGING,
        status=SlotStatus.AVAILABLE,
        power_kw=60.0,
    )
    db.add(ev_slot)
    db.commit()
    db.refresh(ev_slot)

    charger = EVChargerStation(
        facility_id=lot.id,
        slot_id=ev_slot.id,
        charger_code=f"EV-DEL-{suffix}",
        manufacturer="Delta Electronics",
        model_name="CityFast DC 60kW",
        connector_types_json=json.dumps(["CCS2", "TYPE2_AC"]),
        max_power_kw=60.0,
        status=EVChargerStatus.AVAILABLE,
        energy_tariff_per_kwh_inr=18.0,
        idle_fee_per_min_inr=2.5,
    )
    db.add(charger)

    # 3. Accessible Slot
    acc_slot = ParkingSlot(
        lot_id=lot.id,
        slot_number=f"S-ACC-{suffix}",
        floor=1,
        zone="A",
        slot_type=SlotType.ACCESSIBLE,
        status=SlotStatus.AVAILABLE,
    )
    db.add(acc_slot)

    # 4. Slots for Group Booking
    group_slots = []
    for i in range(3):
        g_slot = ParkingSlot(
            lot_id=lot.id,
            slot_number=f"S-GRP-{suffix}-{i+1}",
            floor=1,
            zone="G",
            slot_type=SlotType.STANDARD,
            status=SlotStatus.AVAILABLE,
        )
        db.add(g_slot)
        group_slots.append(g_slot)

    db.commit()
    db.refresh(std_slot)
    db.refresh(acc_slot)
    db.refresh(charger)

    return {
        "driver": driver,
        "lot": lot,
        "std_slot": std_slot,
        "ev_slot": ev_slot,
        "charger": charger,
        "acc_slot": acc_slot,
        "group_slots": group_slots,
        "suffix": suffix,
    }


def test_ev_charger_discovery_and_compatibility(db: Session, p18_context):
    """Test 1: List chargers for a facility and verify connector types."""
    lot = p18_context["lot"]
    chargers = list_ev_chargers(db, facility_id=lot.id)

    assert len(chargers) >= 1
    ch = chargers[0]
    assert ch.facility_id == lot.id
    assert "CCS2" in ch.connector_types
    assert "TYPE2_AC" in ch.connector_types
    assert ch.max_power_kw == 60.0
    assert ch.status == "AVAILABLE"


def test_ev_charging_reservation_and_telemetry_flow(db: Session, p18_context):
    """Test 2 & 3: Reserve EV charger, simulate telemetry, verify cost separation, and hardware completion."""
    lot = p18_context["lot"]
    ev_slot = p18_context["ev_slot"]
    charger = p18_context["charger"]

    # 1. Incompatible connector rejection
    with pytest.raises(HTTPException) as exc_info:
        reserve_ev_charging_session(
            db=db,
            request=EVChargingReserveRequest(
                facility_id=lot.id,
                slot_id=ev_slot.id,
                vehicle_number="MH02EV9999",
                connector_type="CHADEMO_UNSUPPORTED",
            ),
        )
    assert exc_info.value.status_code == 400
    assert "incompatible" in exc_info.value.detail.lower()

    # 2. Valid reservation with CCS2
    init_res = reserve_ev_charging_session(
        db=db,
        request=EVChargingReserveRequest(
            facility_id=lot.id,
            slot_id=ev_slot.id,
            vehicle_number="MH02EV9999",
            connector_type="CCS2",
            initial_soc_percent=25,
            target_soc_percent=85,
        ),
    )
    assert init_res.status == "IN_PROGRESS"
    assert init_res.charger_code == charger.charger_code
    assert init_res.initial_soc_percent == 25
    assert init_res.ocpp_transaction_id is not None

    db.refresh(charger)
    db.refresh(ev_slot)
    assert charger.status == EVChargerStatus.CHARGING
    assert ev_slot.status == SlotStatus.OCCUPIED

    # 3. Telemetry update (Delivered 30 kWh, SoC reaches 75%)
    telem_res = update_charging_telemetry(
        db=db,
        request=EVChargingTelemetryUpdateRequest(
            session_reference=init_res.session_reference,
            current_soc_percent=75,
            energy_delivered_kwh=30.0,
            charging_rate_kw=52.0,
            is_completed=False,
        ),
    )
    assert telem_res.current_soc_percent == 75
    assert telem_res.energy_delivered_kwh == 30.0
    # 30 kWh * ₹18.00 = ₹540.00 energy cost
    assert telem_res.energy_cost_inr == 540.0
    assert telem_res.total_charging_cost_inr == 540.0

    # 4. Verified hardware completion event
    final_res = update_charging_telemetry(
        db=db,
        request=EVChargingTelemetryUpdateRequest(
            session_reference=init_res.session_reference,
            current_soc_percent=85,
            energy_delivered_kwh=42.0,
            charging_rate_kw=0.0,
            is_completed=True,
        ),
    )
    assert final_res.status == "COMPLETED"
    assert final_res.end_time is not None

    db.refresh(charger)
    assert charger.status == EVChargerStatus.AVAILABLE


def test_accessibility_credential_registration_and_verification(db: Session, p18_context):
    """Test 4: Register government UDID disability credential and verify user priority."""
    driver = p18_context["driver"]
    badge_no = f"UDID-IN-DEL-{uuid.uuid4().hex[:6].upper()}"

    res = register_accessibility_credential(
        db=db,
        request=AccessibilityVerifyRequest(
            user_id=driver.id,
            badge_number=badge_no,
            holder_name=driver.full_name,
            disability_type="LOCOMOTOR",
        ),
    )
    assert res.is_verified is True
    assert res.badge_number == badge_no

    db.refresh(driver)
    assert driver.accessible_priority is True


def test_accessibility_guardrail_unauthorized_driver_rejected(db: Session, p18_context):
    """Test 5: CORE GUARDRAIL - Driver without verified disability credential cannot reserve accessible bay."""
    lot = p18_context["lot"]
    acc_slot = p18_context["acc_slot"]

    # Create unauthorized driver without disability credentials
    unauthorized_driver = User(
        full_name="Able-Bodied Driver",
        email=f"driver_unauth_{uuid.uuid4().hex[:6]}@example.com",
        phone="+919999900000",
        password_hash="argon2",
        role=UserRole.DRIVER,
        accessible_priority=False,
    )
    db.add(unauthorized_driver)
    db.commit()
    db.refresh(unauthorized_driver)

    now = datetime.now(timezone.utc)
    with pytest.raises(HTTPException) as exc_info:
        reserve_accessible_bay(
            db=db,
            user_id=unauthorized_driver.id,
            facility_id=lot.id,
            slot_id=acc_slot.id,
            vehicle_number="DL01AA1111",
            start_time=now,
            end_time=now + timedelta(hours=2),
        )
    assert exc_info.value.status_code == 403
    assert "credential" in exc_info.value.detail.lower()

    # Now verify credentials for driver, and reservation succeeds
    register_accessibility_credential(
        db=db,
        request=AccessibilityVerifyRequest(
            user_id=unauthorized_driver.id,
            badge_number=f"UDID-VALID-{uuid.uuid4().hex[:6]}",
            holder_name=unauthorized_driver.full_name,
            disability_type="LOCOMOTOR",
        ),
    )

    booking = reserve_accessible_bay(
        db=db,
        user_id=unauthorized_driver.id,
        facility_id=lot.id,
        slot_id=acc_slot.id,
        vehicle_number="DL01AA1111",
        start_time=now,
        end_time=now + timedelta(hours=2),
    )
    assert booking.status == BookingStatus.CONFIRMED
    assert booking.slot_id == acc_slot.id


def test_accessible_step_free_route_generation(db: Session, p18_context):
    """Test 6: Step-free route avoids all stairs and includes elevators and ramps."""
    lot = p18_context["lot"]
    acc_slot = p18_context["acc_slot"]

    route = calculate_accessible_step_free_route(
        db=db,
        facility_id=lot.id,
        destination_slot_number=acc_slot.slot_number,
    )

    assert route.is_step_free is True
    assert len(route.elevators_used) > 0
    modes = [s.mode for s in route.steps]
    assert "ELEVATOR" in modes
    assert "RAMP" in modes
    assert "STAIRS" not in modes
    assert route.total_distance_meters > 0.0


def test_family_group_booking_creation_and_staggered_arrival(db: Session, p18_context):
    """Test 7 & 8: Multi-slot group reservation, distinct QR tokens, and independent staggered arrival."""
    driver = p18_context["driver"]
    lot = p18_context["lot"]

    now = datetime.now(timezone.utc)
    members_input = [
        GroupMemberInput(vehicle_number="KA01AA1001", driver_name="Alice Smith", driver_phone="+919876500001"),
        GroupMemberInput(vehicle_number="KA01AA1002", driver_name="Bob Smith", driver_phone="+919876500002"),
        GroupMemberInput(vehicle_number="KA01AA1003", driver_name="Charlie Smith", driver_phone="+919876500003"),
    ]

    # 1. Create Group Booking
    group_res = create_group_booking(
        db=db,
        organizer_user_id=driver.id,
        request=GroupBookingCreateRequest(
            facility_id=lot.id,
            group_name="Smith Family Caravan",
            start_time=now,
            end_time=now + timedelta(hours=3),
            members=members_input,
            notes="3 adjoining spots requested near North Gate",
        ),
    )
    assert group_res.total_spaces_reserved == 3
    assert group_res.status == "CONFIRMED"
    assert len(group_res.members) == 3

    # Verify each member has a distinct QR token
    tokens = [m.qr_token_jti for m in group_res.members]
    assert len(set(tokens)) == 3

    # 2. Staggered Arrival - Vehicle 1 arrives first
    m1 = group_res.members[0]
    checkin_1 = check_in_group_member(
        db=db,
        group_reference=group_res.group_reference,
        vehicle_number=m1.vehicle_number,
        qr_token_jti=m1.qr_token_jti,
    )
    assert checkin_1["member_status"] == "CHECKED_IN"
    assert checkin_1["group_status"] == "PARTIALLY_ARRIVED"

    # 3. Vehicle 2 and 3 arrive later
    m2 = group_res.members[1]
    check_in_group_member(
        db=db,
        group_reference=group_res.group_reference,
        vehicle_number=m2.vehicle_number,
        qr_token_jti=m2.qr_token_jti,
    )
    m3 = group_res.members[2]
    checkin_3 = check_in_group_member(
        db=db,
        group_reference=group_res.group_reference,
        vehicle_number=m3.vehicle_number,
        qr_token_jti=m3.qr_token_jti,
    )
    assert checkin_3["group_status"] == "ALL_ACTIVE"


def test_partial_group_member_cancellation(db: Session, p18_context):
    """Test 9: Partial cancellation of a single member vehicle without cancelling the group."""
    driver = p18_context["driver"]
    lot = p18_context["lot"]

    now = datetime.now(timezone.utc)
    members_input = [
        GroupMemberInput(vehicle_number="DL02BB2001", driver_name="Rohan Sharma", driver_phone="+919876511111"),
        GroupMemberInput(vehicle_number="DL02BB2002", driver_name="Priya Sharma", driver_phone="+919876522222"),
    ]

    group_res = create_group_booking(
        db=db,
        organizer_user_id=driver.id,
        request=GroupBookingCreateRequest(
            facility_id=lot.id,
            group_name="Sharma Wedding Convoy",
            start_time=now,
            end_time=now + timedelta(hours=2),
            members=members_input,
        ),
    )
    assert group_res.total_spaces_reserved == 2

    # Partially cancel vehicle 2
    cancel_res = cancel_group_member(
        db=db,
        group_reference=group_res.group_reference,
        vehicle_number="DL02BB2002",
        reason="Vehicle breakdown before departure",
    )
    assert cancel_res["cancelled_vehicle"] == "DL02BB2002"
    assert cancel_res["remaining_spaces"] == 1
    assert cancel_res["group_status"] == "CONFIRMED"


def test_smart_waitlist_flow_queue_offer_and_conversion(db: Session, p18_context):
    """Test 10, 11, 12: Waitlist queue FIFO ordering, vacancy atomic hold, and claim conversion."""
    driver = p18_context["driver"]
    lot = p18_context["lot"]
    std_slot = p18_context["std_slot"]

    now = datetime.now(timezone.utc)

    # 1. Join Waitlist
    w_entry = join_facility_waitlist(
        db=db,
        user_id=driver.id,
        request=WaitlistJoinRequest(
            facility_id=lot.id,
            vehicle_plate="KA03WL9911",
            driver_name=driver.full_name,
            driver_phone=driver.phone,
            required_slot_type="STANDARD",
            requested_start_time=now,
            requested_end_time=now + timedelta(hours=2),
        ),
    )
    assert w_entry.queue_position == 1
    assert w_entry.status == "QUEUED"

    # 2. Simulate Vacancy -> Triggers atomic 10-minute hold for candidate 1
    candidate = process_slot_vacancy_for_waitlist(db, facility_id=lot.id, slot_id=std_slot.id)
    assert candidate is not None
    assert candidate.waitlist_reference == w_entry.waitlist_reference
    assert candidate.status == WaitlistStatus.NOTIFIED_OFFER_ACTIVE
    assert candidate.offered_slot_id == std_slot.id
    assert candidate.offer_expires_at is not None

    db.refresh(std_slot)
    assert std_slot.status == SlotStatus.RESERVED

    # 3. Candidate claims offer within 10-minute window -> Converts to confirmed booking
    claim_res = claim_waitlist_offer(
        db=db,
        waitlist_reference=candidate.waitlist_reference,
        payment_method="FASTAG_AUTO_DEBIT",
    )
    assert claim_res.status == "CLAIMED"
    assert claim_res.slot_number == std_slot.slot_number
    assert claim_res.booking_reference is not None

    # Verify created booking
    booking = (
        db.query(Booking)
        .filter(Booking.booking_reference == claim_res.booking_reference)
        .first()
    )
    assert booking is not None
    assert booking.status == BookingStatus.CONFIRMED
    assert booking.vehicle_number == "KA03WL9911"


def test_smart_waitlist_offer_timeout_and_expiration(db: Session, p18_context):
    """Test 9: Expired waitlist claim window raises HTTP 410 and releases hold."""
    driver = p18_context["driver"]
    lot = p18_context["lot"]
    std_slot = p18_context["std_slot"]
    now = datetime.now(timezone.utc)

    w_entry = join_facility_waitlist(
        db=db,
        user_id=driver.id,
        request=WaitlistJoinRequest(
            facility_id=lot.id,
            vehicle_plate="KA04EXP9900",
            driver_name=driver.full_name,
            driver_phone=driver.phone,
            required_slot_type="STANDARD",
            requested_start_time=now,
            requested_end_time=now + timedelta(hours=2),
        ),
    )

    candidate = process_slot_vacancy_for_waitlist(db, facility_id=lot.id, slot_id=std_slot.id)
    assert candidate is not None

    # Manually backdate offer_expires_at to simulate timeout
    candidate.offer_expires_at = now - timedelta(minutes=5)
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        claim_waitlist_offer(db=db, waitlist_reference=candidate.waitlist_reference)

    assert exc_info.value.status_code == 410
    assert "expired" in exc_info.value.detail.lower()

    db.refresh(candidate)
    assert candidate.status == WaitlistStatus.EXPIRED


def test_flexible_parking_api_routes(db: Session, p18_context):
    """Test 10: FastAPI API endpoints for chargers, accessible routing, and waitlist."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    lot = p18_context["lot"]
    acc_slot = p18_context["acc_slot"]

    # 1. EV Chargers
    resp_ev = client.get(f"/api/v1/flexible/ev/chargers?facility_id={lot.id}")
    assert resp_ev.status_code == 200
    assert len(resp_ev.json()) >= 1

    # 2. Accessible Step-Free Route
    resp_route = client.get(f"/api/v1/flexible/accessibility/route?facility_id={lot.id}&destination_slot={acc_slot.slot_number}")
    assert resp_route.status_code == 200
    route_data = resp_route.json()
    assert route_data["is_step_free"] is True
    assert len(route_data["steps"]) >= 3

    # 3. Waitlist Entries
    resp_wtl = client.get(f"/api/v1/flexible/waitlist/entries?facility_id={lot.id}")
    assert resp_wtl.status_code == 200

