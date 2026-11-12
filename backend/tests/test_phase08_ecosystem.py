"""Comprehensive Integration Test Suite for Phase 08: Advanced Parkwise Ecosystem (All 15 Modules).
Executes route coroutines directly in-memory using _run_sync to avoid Windows loopback socket deadlocks.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Coroutine
import uuid
import pytest
from fastapi import HTTPException
from app.database import Base, SessionLocal, engine
from app.models import User, UserRole
from app.models_ecosystem import ValetTicketStatus
from app.schemas_ecosystem import (
    ANPRHumanReviewResolveRequest,
    ANPRScanRequest,
    CameraStreamCreateRequest,
    CorporateAccountCreateRequest,
    CorporateMemberAddRequest,
    EVReservationCreateRequest,
    EVStatusUpdateRequest,
    EventPassBookRequest,
    FleetAccountCreateRequest,
    FleetRechargeRequest,
    FleetVehicleRegisterRequest,
    GroupGuestJoinRequest,
    GroupReservationCreateRequest,
    MarketplaceBookRequest,
    MarketplaceListingCreateRequest,
    ParkingEventCreateRequest,
    RegionalPricingOverrideRequest,
    SubscriptionCreateRequest,
    ValetActionRequest,
    ValetCheckInRequest,
    WhatsAppSendNotificationRequest,
    YOLORunInferenceRequest,
)
from app.router_ecosystem import (
    add_corporate_member,
    apply_regional_override,
    book_event_pass,
    book_marketplace_slot,
    check_in_valet_vehicle,
    create_corporate_account,
    create_fleet_account,
    create_group_reservation,
    create_marketplace_listing,
    create_parking_event,
    create_parking_subscription,
    execute_valet_action,
    get_group_reservation,
    get_localization_dictionary,
    get_multi_location_overview,
    join_group_reservation,
    list_anpr_human_reviews,
    list_camera_streams,
    list_corporate_accounts,
    list_corporate_members,
    list_ev_charging_sessions,
    list_event_passes,
    list_fleet_accounts,
    list_fleet_vehicles,
    list_marketplace_bookings,
    list_marketplace_listings,
    list_parking_events,
    list_subscription_plans,
    list_user_subscriptions,
    list_valet_tickets,
    list_whatsapp_logs,
    process_anpr_scan,
    recharge_fleet_wallet,
    recognize_license_plate_ocr,
    register_camera_stream,
    register_fleet_vehicle,
    reserve_ev_charging_session,
    resolve_anpr_human_review,
    run_yolo_inference,
    send_whatsapp_notification,
    update_ev_session_status,
)
from app.seed import seed_initial_data


def _run_sync(coro: Coroutine[Any, Any, Any]) -> Any:
    """Execute a pure in-memory FastAPI route coroutine without Windows loopback socketpair."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    finally:
        coro.close()


@pytest.fixture(scope="session", autouse=True)
def setup_phase08_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def operator_user(db_session):
    user = db_session.query(User).filter(User.role == UserRole.OPERATOR).first()
    if not user:
        user = User(
            full_name="Regional Facility Lead",
            email="operator.phase08@parkwise.in",
            hashed_password="dummy_hashed_pw",
            role=UserRole.OPERATOR,
            is_active=True,
            is_verified=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
    return user


# ============================================================================
# MODULE 1: EV Charging Bay Reservations
# ============================================================================
def test_01_ev_charging_reservation_lifecycle(db_session):
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    payload = EVReservationCreateRequest(
        lot_id=1,
        slot_id=1,
        user_email="driver.ev@parkwise.in",
        connector_type="CCS2",
        target_soc_pct=85.0,
        initial_soc_pct=25.0,
        scheduled_start=start,
        duration_hours=2.5,
        energy_kwh_requested=36.0,
    )
    session = _run_sync(reserve_ev_charging_session(payload, db=db_session))
    assert session.session_code.startswith("EV-SES-")
    assert session.charging_status == "RESERVED"
    assert session.energy_consumed_kwh > 0
    assert session.charging_fee_inr > 0
    session_id = session.id

    # State transition to CHARGING
    upd_payload = EVStatusUpdateRequest(status="CHARGING", current_soc_pct=45.0)
    updated = _run_sync(update_ev_session_status(session_id, upd_payload, db=db_session))
    assert updated.charging_status == "CHARGING"
    assert updated.current_soc_pct == 45.0

    # Query sessions list
    all_sessions = _run_sync(list_ev_charging_sessions(lot_id=1, db=db_session))
    assert len(all_sessions) >= 1


# ============================================================================
# MODULE 2: Monthly Parking Subscriptions
# ============================================================================
def test_02_monthly_subscriptions(db_session):
    plans = _run_sync(list_subscription_plans())
    assert len(plans) >= 4
    plan_types = [p["plan_type"] for p in plans]
    assert "COMMUTER_WEEKDAY" in plan_types
    assert "RESIDENTIAL_NIGHT" in plan_types

    sub_payload = SubscriptionCreateRequest(
        lot_id=1,
        user_email="commuter.daily@gmail.com",
        plan_type="COMMUTER_WEEKDAY",
        primary_vehicle_plate="DL-01-AB-1234",
        auto_renew=True,
    )
    sub = _run_sync(create_parking_subscription(sub_payload, db=db_session))
    assert sub.subscription_code.startswith("SUB-")
    assert sub.pass_qr_code.startswith("QR-PASS-")
    assert sub.status == "ACTIVE"
    assert sub.total_fee_inr > 0

    user_subs = _run_sync(list_user_subscriptions(user_email="commuter.daily@gmail.com", db=db_session))
    assert len(user_subs) >= 1


# ============================================================================
# MODULE 3: Corporate Parking Accounts
# ============================================================================
def test_03_corporate_accounts_and_domain_check(db_session):
    uid = uuid.uuid4().hex[:4].upper()
    corp_code = f"TCS-{uid}"
    corp_payload = CorporateAccountCreateRequest(
        company_name=f"Tata Consultancy Services {uid}",
        corporate_code=corp_code,
        authorized_domain="tcs.com",
        billing_contact_email=f"admin.{uid.lower()}@tcs.com",
        monthly_credit_limit_inr=500000.0,
        allocated_daily_slots=75,
    )
    corp = _run_sync(create_corporate_account(corp_payload, db=db_session))
    corp_id = corp.id
    assert corp.authorized_domain == "tcs.com"

    # Valid domain member
    mem_payload = CorporateMemberAddRequest(
        corporate_id=corp_id,
        employee_email=f"emp.{uid.lower()}@tcs.com",
        employee_name="Rohit Sharma",
        employee_id_tag=f"TCS-{uid}",
        vehicle_plate=f"DL-08-CA-{uid}",
        monthly_stipend_inr=6000.0,
    )
    member = _run_sync(add_corporate_member(mem_payload, db=db_session))
    assert member.is_approved is True
    assert member.employee_email == f"emp.{uid.lower()}@tcs.com"

    # Invalid domain member should fail validation
    invalid_payload = CorporateMemberAddRequest(
        corporate_id=corp_id,
        employee_email="intruder@gmail.com",
        employee_name="Bad Actor",
        employee_id_tag="FAKE-01",
        vehicle_plate="DL-08-XX-0000",
    )
    with pytest.raises(HTTPException) as exc_info:
        _run_sync(add_corporate_member(invalid_payload, db=db_session))
    assert exc_info.value.status_code == 400
    assert "does not match company domain" in exc_info.value.detail


# ============================================================================
# MODULE 4: Fleet Wallets
# ============================================================================
def test_04_fleet_wallets(db_session):
    uid = uuid.uuid4().hex[:4].upper()
    fleet_code = f"BLU-{uid}"
    plate_num = f"DL-01-EV-{uid}"
    fleet_payload = FleetAccountCreateRequest(
        fleet_code=fleet_code,
        fleet_name=f"BluSmart EV Fleet Delhi {uid}",
        operator_email=f"fleet.{uid.lower()}@blusmart.in",
        initial_deposit_inr=100000.0,
        auto_recharge_threshold_inr=20000.0,
        auto_recharge_amount_inr=50000.0,
    )
    fleet = _run_sync(create_fleet_account(fleet_payload, db=db_session))
    fleet_id = fleet.id
    assert fleet.wallet_balance_inr == 100000.0

    # Register fleet vehicle
    veh_payload = FleetVehicleRegisterRequest(
        fleet_id=fleet_id,
        plate_number=plate_num,
        driver_name="Suresh Pal",
        driver_phone="+919876543210",
        daily_spend_limit_inr=2000.0,
    )
    veh = _run_sync(register_fleet_vehicle(veh_payload, db=db_session))
    assert veh.plate_number == plate_num

    # Wallet top-up recharge
    recharge_payload = FleetRechargeRequest(
        fleet_id=fleet_id,
        amount_inr=25000.0,
        description="Weekly Fleet Top-up",
    )
    updated_fleet = _run_sync(recharge_fleet_wallet(recharge_payload, db=db_session))
    assert updated_fleet.wallet_balance_inr == 125000.0


# ============================================================================
# MODULE 5: Group Parking Reservations
# ============================================================================
def test_05_group_parking_reservations(db_session):
    start = datetime.now(timezone.utc) + timedelta(days=2)
    end = start + timedelta(hours=4)
    grp_payload = GroupReservationCreateRequest(
        title="Verma Wedding Guests Parking",
        host_email="arun.verma@gmail.com",
        host_phone="+919811223344",
        lot_id=1,
        start_time=start,
        end_time=end,
        target_slots_count=15,
        payment_mode="HOST_PAYS_ALL",
    )
    group = _run_sync(create_group_reservation(grp_payload, db=db_session))
    code = group.group_code
    assert code.startswith("GRP-")
    assert group.total_estimated_amount_inr > 0

    # Get group
    fetched_group = _run_sync(get_group_reservation(code, db=db_session))
    assert fetched_group.group_code == code

    # Join guest
    guest_payload = GroupGuestJoinRequest(
        guest_name="Alok Verma",
        guest_phone="+919877889900",
        vehicle_plate="HR-26-BW-5555",
    )
    guest = _run_sync(join_group_reservation(code, guest_payload, db=db_session))
    assert guest.assigned_slot_number is not None
    assert guest.guest_name == "Alok Verma"


# ============================================================================
# MODULE 6: Event Parking
# ============================================================================
def test_06_event_parking(db_session):
    evt_date = datetime.now(timezone.utc) + timedelta(days=7)
    evt_payload = ParkingEventCreateRequest(
        event_name="India vs Australia T20 International",
        venue_name="Arun Jaitley Stadium, Delhi",
        lot_id=1,
        event_date=evt_date,
        gates_open_time=(evt_date - timedelta(hours=2)),
        event_end_time=(evt_date + timedelta(hours=4)),
        total_allocated_bays=400,
        flat_event_fee_inr=350.0,
        shuttle_service_included=True,
    )
    event = _run_sync(create_parking_event(evt_payload, db=db_session))
    evt_id = event.id
    assert event.event_code.startswith("EVT-")

    # Book event pass
    pass_payload = EventPassBookRequest(
        event_id=evt_id,
        user_email="cricket.fan@parkwise.in",
        vehicle_plate="DL-03-CC-1122",
        assigned_entry_gate="GATE-VIP-EAST",
    )
    ev_pass = _run_sync(book_event_pass(pass_payload, db=db_session))
    assert ev_pass.pass_code.startswith("PASS-")
    assert ev_pass.fee_paid_inr == 350.0

    # List event passes
    passes = _run_sync(list_event_passes(event_id=evt_id, db=db_session))
    assert len(passes) >= 1


# ============================================================================
# MODULE 7: WhatsApp Notifications & Simulation Disclaimer
# ============================================================================
def test_07_whatsapp_notification_dispatch_and_disclaimer(db_session):
    payload = WhatsAppSendNotificationRequest(
        recipient_phone="+919811002233",
        template_name="BOOKING_CONFIRMATION",
        language_code="hi",
        booking_reference="PW-RES-TEST-001",
        custom_params={
            "lot_name": "Connaught Place Multi-Level Hub",
            "slot_number": "Bay B-08",
        },
    )
    notif = _run_sync(send_whatsapp_notification(payload, db=db_session))
    assert notif.message_sid.startswith("WA-")
    assert notif.is_mock_provider is True
    # Mandatory requirement: do not claim live integration
    assert "SIMULATED_PROVIDER_MODE" in notif.disclaimer

    # Check notification logs query
    logs = _run_sync(list_whatsapp_logs(recipient_phone="+919811002233", db=db_session))
    assert len(logs) >= 1


# ============================================================================
# MODULE 8: Hindi & Regional Language Support
# ============================================================================
def test_08_multilingual_localization_dictionaries():
    for loc in ["en", "hi", "mr", "kn", "te", "ta"]:
        data = _run_sync(get_localization_dictionary(loc))
        assert data.locale == loc
        assert data.translations_count >= 10
        assert "app_title" in data.strings
        assert "book_bay" in data.strings


# ============================================================================
# MODULE 9: Shared Parking Marketplace
# ============================================================================
def test_09_shared_parking_marketplace(db_session):
    list_payload = MarketplaceListingCreateRequest(
        host_name="Rajesh Khanna",
        host_email="rajesh.host@gmail.com",
        host_phone="+919811334455",
        title="Private Driveway Slot near Hauz Khas Village",
        address="E-14 Hauz Khas Enclave",
        city="New Delhi",
        latitude=28.5494,
        longitude=77.2001,
        hourly_rate_inr=50.0,
        daily_rate_inr=350.0,
        is_ev_ready=True,
    )
    listing = _run_sync(create_marketplace_listing(list_payload, db=db_session))
    listing_id = listing.id

    # Book marketplace slot
    start = datetime.now(timezone.utc) + timedelta(hours=2)
    end = start + timedelta(hours=3)
    book_payload = MarketplaceBookRequest(
        listing_id=listing_id,
        renter_name="Kunal Kapoor",
        renter_email="kunal.renter@gmail.com",
        vehicle_plate="DL-04-CA-7788",
        start_time=start,
        end_time=end,
    )
    booking = _run_sync(book_marketplace_slot(book_payload, db=db_session))
    assert booking.gross_amount_inr == 150.0
    assert booking.platform_fee_inr == 22.50  # 15% platform commission
    assert booking.host_payout_inr == 127.50

    # List bookings
    bookings = _run_sync(list_marketplace_bookings(renter_email="kunal.renter@gmail.com", db=db_session))
    assert len(bookings) >= 1


# ============================================================================
# MODULE 10: Multi-Location Operator Management
# ============================================================================
def test_10_multi_location_management(db_session, operator_user):
    overview = _run_sync(get_multi_location_overview(db=db_session, current_user=operator_user))
    assert overview["total_regions"] >= 3
    assert overview["total_facilities"] >= 1
    assert overview["network_occupancy_pct"] >= 0

    # Regional surge override
    region = overview["regions"][0]
    override_payload = RegionalPricingOverrideRequest(
        region_id=region["id"],
        global_surge_cap=2.2,
    )
    res = _run_sync(apply_regional_override(override_payload, db=db_session, current_user=operator_user))
    assert res["status"] == "APPLIED"
    assert res["global_surge_cap"] == 2.2


# ============================================================================
# MODULE 11 & 13: Camera Streams & YOLO Occupancy Detection
# ============================================================================
def test_11_and_13_camera_streams_and_yolo_detection(db_session):
    cam_code = f"CAM-{uuid.uuid4().hex[:6].upper()}"
    cam_payload = CameraStreamCreateRequest(
        lot_id=1,
        camera_code=cam_code,
        zone_name="Deck 1 EV Zone",
        stream_url="rtsp://cctv.local:8554/test01",
        privacy_redaction_enabled=True,
    )
    cam = _run_sync(register_camera_stream(cam_payload, db=db_session))
    cam_id = cam.id
    assert cam.camera_code == cam_code

    # Run YOLO detection
    yolo_payload = YOLORunInferenceRequest(camera_id=cam_id, synthetic_benchmark=True)
    yolo = _run_sync(run_yolo_inference(yolo_payload, db=db_session))
    assert yolo.model_version.startswith("YOLOv8")
    assert yolo.inference_latency_ms > 0
    assert len(yolo.bounding_boxes) > 0
    assert "ARCHITECTURAL_SIMULATION" in yolo.disclaimer


# ============================================================================
# MODULE 12 & 14: ANPR, OCR Recognition & Human Verification Queue
# ============================================================================
def test_12_and_14_anpr_ocr_and_human_review_workflow(db_session):
    # 1. OCR direct test
    ocr = _run_sync(recognize_license_plate_ocr(raw_plate_text="DL-01-AB-1234"))
    assert ocr["normalized_plate"] == "DL01AB1234"
    assert ocr["is_hsrp_compliant"] is True

    # 2. High confidence ANPR scan -> AUTO_ALLOWED
    scan_high_payload = ANPRScanRequest(
        lot_id=1,
        captured_plate_raw="DL 01 AB 1234",
        confidence_override=0.95,
    )
    scan_high = _run_sync(process_anpr_scan(scan_high_payload, db=db_session))
    assert scan_high.decision == "AUTO_ALLOWED"

    # 3. Low confidence ANPR scan -> HUMAN_REVIEW_REQUIRED
    scan_low_payload = ANPRScanRequest(
        lot_id=1,
        captured_plate_raw="D? 01 ?? 1234",
        confidence_override=0.65,
    )
    scan_low = _run_sync(process_anpr_scan(scan_low_payload, db=db_session))
    assert scan_low.decision == "HUMAN_REVIEW_REQUIRED"
    assert scan_low.human_review_required is True

    # Check reviews queue
    reviews = _run_sync(list_anpr_human_reviews(status_filter="PENDING", db=db_session))
    assert len(reviews) > 0
    rev_id = reviews[0]["id"]

    # Resolve review
    resolve_payload = ANPRHumanReviewResolveRequest(
        review_id=rev_id,
        action="CORRECT",
        corrected_plate="DL01AB1234",
        reviewer_email="staff.gate@parkwise.in",
        notes="Fixed blurry characters manually via gate monitor.",
    )
    res = _run_sync(resolve_anpr_human_review(resolve_payload, db=db_session))
    assert res["status"] == "RESOLVED"
    assert res["resolved_plate"] == "DL01AB1234"


# ============================================================================
# MODULE 15: Valet Service Support Lifecycle
# ============================================================================
def test_15_valet_service_lifecycle(db_session):
    # Valet Check-In
    in_payload = ValetCheckInRequest(
        lot_id=1,
        customer_name="Vikram Sethi",
        customer_phone="+919811445566",
        vehicle_plate="MH-02-CB-9090",
        vehicle_model="BMW 3 Series",
        key_locker_tag="LOCKER-VIP-07",
        odometer_reading_km=18500.0,
        fuel_or_battery_level_pct=90.0,
        pre_existing_damage_notes="Minor scratch on rear bumper.",
    )
    ticket = _run_sync(check_in_valet_vehicle(in_payload, db=db_session))
    tkt_id = ticket.id
    assert ticket.ticket_code.startswith("VALET-")
    assert ticket.status == "ACCEPTED_AT_KIOSK"

    # Park
    p_action = ValetActionRequest(action="PARK")
    parked = _run_sync(execute_valet_action(tkt_id, p_action, db=db_session))
    assert parked.status == "PARKED"

    # Request retrieval by customer
    req_action = ValetActionRequest(action="REQUEST_RETRIEVAL")
    retrieval = _run_sync(execute_valet_action(tkt_id, req_action, db=db_session))
    assert retrieval.status == "RETRIEVAL_REQUESTED"

    # Deliver to customer
    del_action = ValetActionRequest(action="DELIVER")
    delivered = _run_sync(execute_valet_action(tkt_id, del_action, db=db_session))
    assert delivered.status == "DELIVERED_TO_CUSTOMER"

    # List tickets
    all_tickets = _run_sync(list_valet_tickets(lot_id=1, db=db_session))
    assert len(all_tickets) >= 1
