"""FastAPI Router for Phase 08: Advanced Parkwise Ecosystem."""
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_permission, require_roles
from app.database import get_db
from app.models import ParkingLot, ParkingSlot, User, UserRole
from app.models_ecosystem import (
    ANPRHumanReviewQueue,
    ANPRScanEvent,
    CameraStream,
    CorporateAccount,
    CorporateMember,
    EVChargingSession,
    EventParkingPass,
    FleetAccount,
    FleetVehicle,
    GroupReservation,
    GroupReservationGuest,
    MarketplaceBooking,
    MarketplaceListing,
    OperatorRegion,
    ParkingEvent,
    ParkingSubscription,
    ValetTicket,
    ValetTicketStatus,
    WhatsAppNotificationLog,
    YOLODetectionRun,
)
from app.schemas_ecosystem import (
    ANPRHumanReviewResolveRequest,
    ANPRScanRequest,
    ANPRScanResponse,
    CameraStreamCreateRequest,
    CameraStreamResponse,
    CorporateAccountCreateRequest,
    CorporateAccountResponse,
    CorporateMemberAddRequest,
    CorporateMemberResponse,
    EVChargingSessionResponse,
    EVReservationCreateRequest,
    EVStatusUpdateRequest,
    EventPassBookRequest,
    EventPassResponse,
    FleetAccountCreateRequest,
    FleetAccountResponse,
    FleetRechargeRequest,
    FleetVehicleRegisterRequest,
    FleetVehicleResponse,
    GroupGuestJoinRequest,
    GroupGuestResponse,
    GroupReservationCreateRequest,
    GroupReservationResponse,
    LocalizationDictionaryResponse,
    MarketplaceBookingResponse,
    MarketplaceBookRequest,
    MarketplaceListingCreateRequest,
    MarketplaceListingResponse,
    MultiLocationOverviewResponse,
    ParkingEventCreateRequest,
    ParkingEventResponse,
    ParkingSubscriptionResponse,
    RegionalPricingOverrideRequest,
    SubscriptionCreateRequest,
    ValetActionRequest,
    ValetCheckInRequest,
    ValetTicketResponse,
    WhatsAppNotificationResponse,
    WhatsAppSendNotificationRequest,
    YOLODetectionResponse,
    YOLORunInferenceRequest,
)
from app.services.ecosystem import (
    CorporateFleetService,
    EVReservationService,
    GroupAndEventService,
    LocalizationService,
    MultiLocationOperatorService,
    SharedMarketplaceService,
    SubscriptionService,
    ValetService,
    VisionAndANPRService,
    VISION_SIMULATION_DISCLAIMER,
    WHATSAPP_SIMULATION_DISCLAIMER,
    WhatsAppNotificationService,
)

router = APIRouter(prefix="/api/v1/ecosystem", tags=["Phase 08 Ecosystem"])


# ----------------------------------------------------------------------------
# 1. EV Charging Bay Reservations
# ----------------------------------------------------------------------------
@router.post(
    "/ev/reserve",
    response_model=EVChargingSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def reserve_ev_charging_session(
    payload: EVReservationCreateRequest,
    db: Session = Depends(get_db),
):
    try:
        session = EVReservationService.create_ev_session(db, payload)
        return session
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/ev/sessions", response_model=List[EVChargingSessionResponse])
async def list_ev_charging_sessions(
    lot_id: Optional[int] = None,
    user_email: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(EVChargingSession)
    if lot_id:
        q = q.filter(EVChargingSession.lot_id == lot_id)
    if user_email:
        q = q.filter(EVChargingSession.user_email == user_email)
    sessions = q.order_by(EVChargingSession.created_at.desc()).limit(50).all()
    return sessions


@router.patch("/ev/sessions/{session_id}/status", response_model=EVChargingSessionResponse)
async def update_ev_session_status(
    session_id: int,
    payload: EVStatusUpdateRequest,
    db: Session = Depends(get_db),
):
    try:
        return EVReservationService.update_status(db, session_id, payload)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ----------------------------------------------------------------------------
# 2. Monthly Parking Subscriptions
# ----------------------------------------------------------------------------
@router.get("/subscriptions/plans")
async def list_subscription_plans():
    return [
        {
            "plan_type": plan_type.value,
            "title": meta["title"],
            "monthly_fee_inr": meta["fee"],
            "gst_inr": round(meta["fee"] * 0.18, 2),
            "total_fee_inr": round(meta["fee"] * 1.18, 2),
            "features": [
                "Guaranteed entrance at peak hours",
                "Automated ANPR / FASTag barrier lifting",
                "Dedicated customer support priority",
                "15% discount on EV fast charging",
            ],
        }
        for plan_type, meta in SubscriptionService.PLAN_PRICING.items()
    ]


@router.post(
    "/subscriptions",
    response_model=ParkingSubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_parking_subscription(
    payload: SubscriptionCreateRequest,
    db: Session = Depends(get_db),
):
    return SubscriptionService.create_subscription(db, payload)


@router.get("/subscriptions", response_model=List[ParkingSubscriptionResponse])
async def list_user_subscriptions(
    user_email: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(ParkingSubscription)
    if user_email:
        q = q.filter(ParkingSubscription.user_email == user_email)
    return q.order_by(ParkingSubscription.created_at.desc()).limit(20).all()


# ----------------------------------------------------------------------------
# 3. Corporate Parking Accounts
# ----------------------------------------------------------------------------
@router.post(
    "/corporate/accounts",
    response_model=CorporateAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_corporate_account(
    payload: CorporateAccountCreateRequest,
    db: Session = Depends(get_db),
):
    return CorporateFleetService.create_corporate_account(db, payload)


@router.get("/corporate/accounts", response_model=List[CorporateAccountResponse])
async def list_corporate_accounts(db: Session = Depends(get_db)):
    return db.query(CorporateAccount).all()


@router.post(
    "/corporate/members",
    response_model=CorporateMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_corporate_member(
    payload: CorporateMemberAddRequest,
    db: Session = Depends(get_db),
):
    try:
        return CorporateFleetService.add_corporate_member(db, payload)
    except (LookupError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/corporate/members", response_model=List[CorporateMemberResponse])
async def list_corporate_members(
    corporate_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(CorporateMember)
    if corporate_id:
        q = q.filter(CorporateMember.corporate_id == corporate_id)
    return q.all()


# ----------------------------------------------------------------------------
# 4. Fleet Wallets
# ----------------------------------------------------------------------------
@router.post(
    "/fleet/accounts",
    response_model=FleetAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_fleet_account(
    payload: FleetAccountCreateRequest,
    db: Session = Depends(get_db),
):
    return CorporateFleetService.create_fleet_account(db, payload)


@router.get("/fleet/accounts", response_model=List[FleetAccountResponse])
async def list_fleet_accounts(
    operator_email: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(FleetAccount)
    if operator_email:
        q = q.filter(FleetAccount.operator_email == operator_email)
    return q.all()


@router.post(
    "/fleet/vehicles",
    response_model=FleetVehicleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_fleet_vehicle(
    payload: FleetVehicleRegisterRequest,
    db: Session = Depends(get_db),
):
    return CorporateFleetService.register_fleet_vehicle(db, payload)


@router.get("/fleet/vehicles", response_model=List[FleetVehicleResponse])
async def list_fleet_vehicles(
    fleet_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(FleetVehicle)
    if fleet_id:
        q = q.filter(FleetVehicle.fleet_id == fleet_id)
    return q.all()


@router.post("/fleet/recharge", response_model=FleetAccountResponse)
async def recharge_fleet_wallet(
    payload: FleetRechargeRequest,
    db: Session = Depends(get_db),
):
    try:
        return CorporateFleetService.topup_fleet_wallet(db, payload)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ----------------------------------------------------------------------------
# 5. Group Parking Reservations
# ----------------------------------------------------------------------------
@router.post(
    "/groups/create",
    response_model=GroupReservationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_group_reservation(
    payload: GroupReservationCreateRequest,
    db: Session = Depends(get_db),
):
    try:
        return GroupAndEventService.create_group_reservation(db, payload)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/groups/{group_code}", response_model=GroupReservationResponse)
async def get_group_reservation(group_code: str, db: Session = Depends(get_db)):
    group = (
        db.query(GroupReservation)
        .filter(GroupReservation.group_code == group_code.upper().strip())
        .first()
    )
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found.")
    return group


@router.post(
    "/groups/{group_code}/join",
    response_model=GroupGuestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def join_group_reservation(
    group_code: str,
    payload: GroupGuestJoinRequest,
    db: Session = Depends(get_db),
):
    try:
        return GroupAndEventService.join_group_reservation(db, group_code, payload)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ----------------------------------------------------------------------------
# 6. Event Parking
# ----------------------------------------------------------------------------
@router.post(
    "/events",
    response_model=ParkingEventResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_parking_event(
    payload: ParkingEventCreateRequest,
    db: Session = Depends(get_db),
):
    return GroupAndEventService.create_parking_event(db, payload)


@router.get("/events", response_model=List[ParkingEventResponse])
async def list_parking_events(db: Session = Depends(get_db)):
    events = db.query(ParkingEvent).order_by(ParkingEvent.event_date.asc()).all()
    if not events:
        # Seed default event
        lot = db.query(ParkingLot).first()
        if lot:
            default_evt = ParkingEvent(
                event_code="EVT-COLDPLAY-MUM",
                event_name="Coldplay Music of the Spheres Tour",
                venue_name="DY Patil Sports Stadium, Mumbai",
                lot_id=lot.id,
                event_date=datetime.now(timezone.utc) + timedelta(days=5),
                gates_open_time=datetime.now(timezone.utc) + timedelta(days=5, hours=-2),
                event_end_time=datetime.now(timezone.utc) + timedelta(days=5, hours=5),
                total_allocated_bays=350,
                booked_bays_count=142,
                flat_event_fee_inr=300.0,
                shuttle_service_included=True,
                traffic_advisory="Special dedicated parking lanes. Metro feeder shuttles every 5 mins.",
            )
            db.add(default_evt)
            db.commit()
            events = [default_evt]
    return events


@router.post(
    "/events/passes",
    response_model=EventPassResponse,
    status_code=status.HTTP_201_CREATED,
)
async def book_event_pass(
    payload: EventPassBookRequest,
    db: Session = Depends(get_db),
):
    try:
        return GroupAndEventService.book_event_pass(db, payload)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/events/passes", response_model=List[EventPassResponse])
async def list_event_passes(
    event_id: Optional[int] = None,
    user_email: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(EventParkingPass)
    if event_id:
        q = q.filter(EventParkingPass.event_id == event_id)
    if user_email:
        q = q.filter(EventParkingPass.user_email == user_email)
    return q.order_by(EventParkingPass.created_at.desc()).limit(50).all()


# ----------------------------------------------------------------------------
# 7. WhatsApp Notifications
# ----------------------------------------------------------------------------
@router.post("/notifications/whatsapp/send", response_model=WhatsAppNotificationResponse)
async def send_whatsapp_notification(
    payload: WhatsAppSendNotificationRequest,
    db: Session = Depends(get_db),
):
    log = WhatsAppNotificationService.send_notification(db, payload)
    return WhatsAppNotificationResponse(
        id=log.id,
        message_sid=log.message_sid,
        booking_reference=log.booking_reference,
        recipient_phone=log.recipient_phone,
        template_name=log.template_name,
        language_code=log.language_code,
        message_body=log.message_body,
        provider=log.provider,
        delivery_status=log.delivery_status,
        is_mock_provider=log.is_mock_provider,
        disclaimer=WHATSAPP_SIMULATION_DISCLAIMER,
        delivered_at=log.delivered_at,
        created_at=log.created_at,
    )


@router.get("/notifications/whatsapp/logs", response_model=List[WhatsAppNotificationResponse])
async def list_whatsapp_logs(
    recipient_phone: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(WhatsAppNotificationLog)
    if recipient_phone:
        q = q.filter(WhatsAppNotificationLog.recipient_phone == recipient_phone)
    logs = q.order_by(WhatsAppNotificationLog.created_at.desc()).limit(30).all()
    return [
        WhatsAppNotificationResponse(
            id=l.id,
            message_sid=l.message_sid,
            booking_reference=l.booking_reference,
            recipient_phone=l.recipient_phone,
            template_name=l.template_name,
            language_code=l.language_code,
            message_body=l.message_body,
            provider=l.provider,
            delivery_status=l.delivery_status,
            is_mock_provider=l.is_mock_provider,
            disclaimer=WHATSAPP_SIMULATION_DISCLAIMER,
            delivered_at=l.delivered_at,
            created_at=l.created_at,
        )
        for l in logs
    ]


# ----------------------------------------------------------------------------
# 8. Hindi and Regional Language Support
# ----------------------------------------------------------------------------
@router.get("/localization/{locale}", response_model=LocalizationDictionaryResponse)
async def get_localization_dictionary(locale: str):
    dic = LocalizationService.get_dictionary(locale)
    return LocalizationDictionaryResponse(
        locale=locale,
        translations_count=len(dic),
        strings=dic,
    )


# ----------------------------------------------------------------------------
# 9. Shared Parking Marketplace
# ----------------------------------------------------------------------------
@router.post(
    "/marketplace/listings",
    response_model=MarketplaceListingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_marketplace_listing(
    payload: MarketplaceListingCreateRequest,
    db: Session = Depends(get_db),
):
    return SharedMarketplaceService.create_listing(db, payload)


@router.get("/marketplace/listings", response_model=List[MarketplaceListingResponse])
async def list_marketplace_listings(
    city: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(MarketplaceListing)
    if city and city != "ALL":
        q = q.filter(MarketplaceListing.city.ilike(f"%{city}%"))
    listings = q.order_by(MarketplaceListing.created_at.desc()).all()
    if not listings:
        # Seed initial listings if empty
        seed_items = [
            ("Anand Varma", "anand.varma@gmail.com", "+919811223344", "Covered Driveway near CyberHub DLF Phase 2", "DLF Phase 2, Gurugram", "Gurugram", 28.4901, 77.0890, 45.0, 300.0, True),
            ("Priya Deshmukh", "priya.d@gmail.com", "+919822334455", "Secure Residential Bay near BKC Diamond Bourse", "Bandra East, Mumbai", "Mumbai", 19.0655, 72.8680, 60.0, 450.0, True),
            ("Kavitha Rao", "kavitha.r@gmail.com", "+919844556677", "Shaded Gated Parking near Indiranagar 100ft Rd", "Indiranagar, Bengaluru", "Bengaluru", 12.9784, 77.6408, 40.0, 260.0, False),
        ]
        for name, email, phone, title, addr, cty, lat, lng, hr, day, ev in seed_items:
            listing = MarketplaceListing(
                listing_code=f"MKT-SEED-{uuid.uuid4().hex[:4].upper()}",
                host_name=name,
                host_email=email,
                host_phone=phone,
                title=title,
                address=addr,
                city=cty,
                latitude=lat,
                longitude=lng,
                hourly_rate_inr=hr,
                daily_rate_inr=day,
                is_ev_ready=ev,
                kyc_verified=True,
            )
            db.add(listing)
        db.commit()
        listings = db.query(MarketplaceListing).all()
    return listings


@router.post(
    "/marketplace/book",
    response_model=MarketplaceBookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def book_marketplace_slot(
    payload: MarketplaceBookRequest,
    db: Session = Depends(get_db),
):
    try:
        return SharedMarketplaceService.book_listing(db, payload)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/marketplace/bookings", response_model=List[MarketplaceBookingResponse])
async def list_marketplace_bookings(
    renter_email: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(MarketplaceBooking)
    if renter_email:
        q = q.filter(MarketplaceBooking.renter_email == renter_email)
    return q.order_by(MarketplaceBooking.created_at.desc()).limit(30).all()


# ----------------------------------------------------------------------------
# 10. Parking Operator Multi-Location Management
# ----------------------------------------------------------------------------
@router.get("/operator/multi-location", response_model=MultiLocationOverviewResponse)
async def get_multi_location_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("operator:analytics")),
):
    return MultiLocationOperatorService.get_overview(db)


@router.post("/operator/regional-override")
async def apply_regional_override(
    payload: RegionalPricingOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("lot:manage")),
):
    region = db.query(OperatorRegion).filter(OperatorRegion.id == payload.region_id).first()
    if not region:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Region not found.")
    return {
        "status": "APPLIED",
        "region_code": region.region_code,
        "global_surge_cap": payload.global_surge_cap,
        "applied_by": current_user.email,
        "message": f"Centralized pricing surge cap of {payload.global_surge_cap}x applied across {region.name}.",
    }


# ----------------------------------------------------------------------------
# 11 & 13. Camera Streams & YOLO Occupancy Detection
# ----------------------------------------------------------------------------
@router.post(
    "/camera/streams",
    response_model=CameraStreamResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_camera_stream(
    payload: CameraStreamCreateRequest,
    db: Session = Depends(get_db),
):
    cam = CameraStream(
        camera_code=payload.camera_code,
        lot_id=payload.lot_id,
        zone_name=payload.zone_name,
        stream_url=payload.stream_url,
        stream_protocol=payload.stream_protocol,
        resolution=payload.resolution,
        fps=payload.fps,
        privacy_redaction_enabled=payload.privacy_redaction_enabled,
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return cam


@router.get("/camera/streams", response_model=List[CameraStreamResponse])
async def list_camera_streams(
    lot_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(CameraStream)
    if lot_id:
        q = q.filter(CameraStream.lot_id == lot_id)
    streams = q.all()
    if not streams:
        # Seed initial camera streams
        cams = [
            ("CAM-NCR-01", 1, "Deck 1 - North Bays", "rtsp://cctv.local:8554/ncr01"),
            ("CAM-NCR-02", 1, "Deck 2 - EV Fast Charging Hub", "rtsp://cctv.local:8554/ncr02"),
            ("CAM-MUM-01", 2, "Basement B1 - Entry Gate Lane", "rtsp://cctv.local:8554/mum01"),
        ]
        for code, lid, zone, url in cams:
            db.add(CameraStream(
                camera_code=code,
                lot_id=lid,
                zone_name=zone,
                stream_url=url,
                status="ONLINE",
            ))
        db.commit()
        streams = db.query(CameraStream).all()
    return streams


@router.post("/yolo/inference", response_model=YOLODetectionResponse)
async def run_yolo_inference(
    payload: YOLORunInferenceRequest,
    db: Session = Depends(get_db),
):
    run = VisionAndANPRService.run_yolo_inference(db, payload.camera_id, payload.synthetic_benchmark)
    boxes = json.loads(run.bounding_boxes_json) if run.bounding_boxes_json else []
    return YOLODetectionResponse(
        id=run.id,
        camera_id=run.camera_id,
        model_version=run.model_version,
        inference_latency_ms=run.inference_latency_ms,
        detected_vehicles_count=run.detected_vehicles_count,
        occupied_slots_count=run.occupied_slots_count,
        vacant_slots_count=run.vacant_slots_count,
        bounding_boxes=boxes,
        privacy_audit_status=run.privacy_audit_status,
        is_synthetic_test=run.is_synthetic_test,
        disclaimer=VISION_SIMULATION_DISCLAIMER,
        created_at=run.created_at,
    )


# ----------------------------------------------------------------------------
# 12 & 14. ANPR & OCR Recognition Architecture
# ----------------------------------------------------------------------------
@router.post("/anpr/scan", response_model=ANPRScanResponse)
async def process_anpr_scan(
    payload: ANPRScanRequest,
    db: Session = Depends(get_db),
):
    scan = VisionAndANPRService.process_anpr_scan(db, payload)
    return ANPRScanResponse(
        id=scan.id,
        scan_code=scan.scan_code,
        lot_id=scan.lot_id,
        gate_lane=scan.gate_lane,
        lane_type=scan.lane_type,
        captured_plate_raw=scan.captured_plate_raw,
        normalized_plate=scan.normalized_plate,
        confidence_score=scan.confidence_score,
        ocr_engine=scan.ocr_engine,
        is_hsrp_compliant=scan.is_hsrp_compliant,
        decision=scan.decision,
        human_verified=scan.human_verified,
        verified_by_staff_email=scan.verified_by_staff_email,
        human_review_required=(scan.decision == "HUMAN_REVIEW_REQUIRED"),
        privacy_plate_hash=scan.privacy_plate_hash,
        disclaimer=VISION_SIMULATION_DISCLAIMER,
        created_at=scan.created_at,
    )


@router.get("/anpr/human-reviews")
async def list_anpr_human_reviews(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(ANPRHumanReviewQueue)
    if status_filter:
        q = q.filter(ANPRHumanReviewQueue.status == status_filter)
    items = q.order_by(ANPRHumanReviewQueue.created_at.desc()).limit(20).all()
    return [
        {
            "id": i.id,
            "scan_id": i.scan_id,
            "lot_id": i.lot_id,
            "captured_plate": i.captured_plate,
            "candidate_matches": json.loads(i.candidate_matches_json or "[]"),
            "confidence_score": i.confidence_score,
            "reason": i.reason,
            "status": i.status,
            "resolved_plate": i.resolved_plate,
            "reviewer_email": i.reviewer_email,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in items
    ]


@router.post("/anpr/human-reviews/resolve")
async def resolve_anpr_human_review(
    payload: ANPRHumanReviewResolveRequest,
    db: Session = Depends(get_db),
):
    item = db.query(ANPRHumanReviewQueue).filter(ANPRHumanReviewQueue.id == payload.review_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review item not found.")

    item.status = payload.action
    item.resolved_plate = payload.corrected_plate or item.captured_plate
    item.reviewer_email = payload.reviewer_email
    item.notes = payload.notes
    item.resolved_at = datetime.now(timezone.utc)

    # Update associated scan
    scan = db.query(ANPRScanEvent).filter(ANPRScanEvent.id == item.scan_id).first()
    if scan:
        scan.human_verified = True
        scan.verified_by_staff_email = payload.reviewer_email
        scan.decision = "HUMAN_APPROVED" if payload.action in ("APPROVE", "CORRECT") else "REJECTED"
        if payload.corrected_plate:
            scan.normalized_plate = payload.corrected_plate

    db.commit()
    return {"status": "RESOLVED", "action": payload.action, "resolved_plate": item.resolved_plate}


@router.post("/ocr/recognize")
async def recognize_license_plate_ocr(
    raw_plate_text: str = Query(...),
):
    normalized, is_hsrp, state, num = VisionAndANPRService.normalize_indian_plate(raw_plate_text)
    return {
        "raw_input": raw_plate_text,
        "normalized_plate": normalized,
        "is_hsrp_compliant": is_hsrp,
        "parsed_state": state,
        "parsed_number": num,
        "ocr_engine": "EasyOCR-HSRP-IndianStandard-v2",
        "optical_confidence": 0.94 if is_hsrp else 0.72,
        "character_level_confidence": {
            char: round(0.92 + (idx * 0.007) % 0.07, 3)
            for idx, char in enumerate(normalized)
        },
        "disclaimer": VISION_SIMULATION_DISCLAIMER,
    }


# ----------------------------------------------------------------------------
# 15. Valet Service Support
# ----------------------------------------------------------------------------
@router.post(
    "/valet/tickets",
    response_model=ValetTicketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def check_in_valet_vehicle(
    payload: ValetCheckInRequest,
    db: Session = Depends(get_db),
):
    return ValetService.check_in_valet(db, payload)


@router.get("/valet/tickets", response_model=List[ValetTicketResponse])
async def list_valet_tickets(
    lot_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(ValetTicket)
    if lot_id:
        q = q.filter(ValetTicket.lot_id == lot_id)
    if status_filter:
        q = q.filter(ValetTicket.status == status_filter)
    tickets = q.order_by(ValetTicket.created_at.desc()).limit(30).all()
    if not tickets:
        # Seed default ticket
        lot = db.query(ParkingLot).first()
        if lot:
            default_tkt = ValetTicket(
                ticket_code="VALET-261112-9841",
                lot_id=lot.id,
                customer_name="Sunil Mittal",
                customer_phone="+919811002233",
                vehicle_plate="DL01CA1234",
                vehicle_model="Mercedes Benz C-Class",
                assigned_valet_name="Vikram Singh",
                key_locker_tag="LOCKER-B-14",
                assigned_slot_number="V-04",
                valet_fee_inr=150.0,
                status=ValetTicketStatus.PARKED,
                odometer_reading_km=14200.0,
                fuel_or_battery_level_pct=82.0,
            )
            db.add(default_tkt)
            db.commit()
            tickets = [default_tkt]
    return tickets


@router.post("/valet/tickets/{ticket_id}/action", response_model=ValetTicketResponse)
async def execute_valet_action(
    ticket_id: int,
    payload: ValetActionRequest,
    db: Session = Depends(get_db),
):
    try:
        return ValetService.execute_valet_action(db, ticket_id, payload)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
