"""Business logic and services for Phase 08 Advanced Parkwise Ecosystem."""
import hashlib
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models import ParkingLot, ParkingSlot, SlotStatus, User, UserRole, utc_now
from app.models_ecosystem import (
    ANPRHumanReviewQueue,
    ANPRScanEvent,
    CameraStream,
    CorporateAccount,
    CorporateMember,
    EVChargingSession,
    EVChargingStatus,
    EVConnectorType,
    EventParkingPass,
    FleetAccount,
    FleetTransaction,
    FleetVehicle,
    GroupPaymentMode,
    GroupReservation,
    GroupReservationGuest,
    LocalizationString,
    MarketplaceBooking,
    MarketplaceListing,
    MarketplaceListingStatus,
    OperatorFacilityGroup,
    OperatorRegion,
    ParkingEvent,
    ParkingSubscription,
    SubscriptionPlanType,
    SubscriptionStatus,
    ValetTicket,
    ValetTicketStatus,
    WhatsAppNotificationLog,
    YOLODetectionRun,
)
from app.schemas_ecosystem import (
    ANPRScanRequest,
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
    SubscriptionCreateRequest,
    ValetActionRequest,
    ValetCheckInRequest,
    WhatsAppSendNotificationRequest,
)

# Mandatory Architectural Disclaimer Constants
VISION_SIMULATION_DISCLAIMER = (
    "ARCHITECTURAL_SIMULATION: Camera-based occupancy and ANPR recognition pipeline "
    "are running in high-fidelity sandbox simulation. Live production requires physical "
    "RTSP/IP cameras, edge TensorRT GPU workers, and on-premise barrier relays."
)

WHATSAPP_SIMULATION_DISCLAIMER = (
    "SIMULATED_PROVIDER_MODE: WhatsApp messaging notifications are dispatched through "
    "Parkwise Mock Provider. Production integration requires verified Meta WhatsApp Cloud "
    "API credentials or Twilio WhatsApp Business number."
)

# ----------------------------------------------------------------------------
# 1. EV Charging Service
# ----------------------------------------------------------------------------
class EVReservationService:
    @staticmethod
    def create_ev_session(db: Session, req: EVReservationCreateRequest) -> EVChargingSession:
        slot = db.query(ParkingSlot).filter(ParkingSlot.id == req.slot_id).first()
        if not slot:
            raise LookupError(f"Parking bay #{req.slot_id} not found.")

        # Compute estimated kWh from SoC difference (assume typical 60 kWh battery)
        battery_capacity_kwh = 60.0
        soc_diff = max(5.0, req.target_soc_pct - req.initial_soc_pct)
        energy_kwh = round((soc_diff / 100.0) * battery_capacity_kwh, 2)
        tariff_per_kwh = 18.5
        charging_fee = round(energy_kwh * tariff_per_kwh, 2)

        session_code = f"EV-SES-{datetime.now(timezone.utc).strftime('%y%m%d%H%M')}-{uuid.uuid4().hex[:6].upper()}"
        end_time = req.scheduled_start + timedelta(hours=req.duration_hours)

        session = EVChargingSession(
            session_code=session_code,
            slot_id=req.slot_id,
            lot_id=req.lot_id,
            user_email=req.user_email,
            connector_type=req.connector_type,
            power_rating_kw=getattr(slot, "power_kw", None) or 50.0,
            initial_soc_pct=req.initial_soc_pct,
            target_soc_pct=req.target_soc_pct,
            current_soc_pct=req.initial_soc_pct,
            energy_consumed_kwh=energy_kwh,
            energy_tariff_per_kwh_inr=tariff_per_kwh,
            charging_fee_inr=charging_fee,
            idle_overstay_fee_inr=0.0,
            charging_status=EVChargingStatus.RESERVED,
            scheduled_start=req.scheduled_start,
            scheduled_end=end_time,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def update_status(db: Session, session_id: int, req: EVStatusUpdateRequest) -> EVChargingSession:
        session = db.query(EVChargingSession).filter(EVChargingSession.id == session_id).first()
        if not session:
            raise LookupError(f"EV Session #{session_id} not found.")

        session.charging_status = req.status
        now = datetime.now(timezone.utc)
        if req.status == EVChargingStatus.PLUGGED_IN and not session.plugged_in_at:
            session.plugged_in_at = now
        elif req.status == EVChargingStatus.CHARGING and not session.charging_started_at:
            session.charging_started_at = now
        elif req.status == EVChargingStatus.COMPLETED and not session.charging_ended_at:
            session.charging_ended_at = now
            session.current_soc_pct = session.target_soc_pct
        elif req.status == EVChargingStatus.DISCONNECTED:
            session.disconnected_at = now
        elif req.status == EVChargingStatus.IDLE_PENALTY:
            session.idle_overstay_fee_inr += 120.0  # Rs 120 idle charger overstay penalty

        if req.current_soc_pct is not None:
            session.current_soc_pct = req.current_soc_pct
        if req.energy_consumed_kwh is not None:
            session.energy_consumed_kwh = req.energy_consumed_kwh

        db.commit()
        db.refresh(session)
        return session


# ----------------------------------------------------------------------------
# 2. Monthly Subscriptions Service
# ----------------------------------------------------------------------------
class SubscriptionService:
    PLAN_PRICING = {
        SubscriptionPlanType.COMMUTER_WEEKDAY: {"title": "Metro Commuter (Mon-Fri 08:00-20:00)", "fee": 3500.0},
        SubscriptionPlanType.UNLIMITED_247: {"title": "Executive 24/7 Unlimited Access", "fee": 6500.0},
        SubscriptionPlanType.RESIDENTIAL_NIGHT: {"title": "Resident Night & Weekend Pass", "fee": 2800.0},
        SubscriptionPlanType.DEDICATED_BAY: {"title": "Personal Dedicated Reserved Bay", "fee": 8500.0},
    }

    @staticmethod
    def create_subscription(db: Session, req: SubscriptionCreateRequest) -> ParkingSubscription:
        plan_meta = SubscriptionService.PLAN_PRICING.get(
            req.plan_type, {"title": "Monthly Parking Pass", "fee": 4000.0}
        )
        base_fee = plan_meta["fee"]
        gst = round(base_fee * 0.18, 2)
        total = round(base_fee + gst, 2)

        start_date = datetime.now(timezone.utc)
        end_date = start_date + timedelta(days=30)
        code = f"SUB-{req.plan_type.value[:4]}-{uuid.uuid4().hex[:6].upper()}"
        qr = f"QR-PASS-{code}-{uuid.uuid4().hex[:8]}"

        sub = ParkingSubscription(
            subscription_code=code,
            user_email=req.user_email,
            lot_id=req.lot_id,
            dedicated_slot_id=req.dedicated_slot_id,
            plan_type=req.plan_type,
            title=plan_meta["title"],
            primary_vehicle_plate=req.primary_vehicle_plate,
            secondary_vehicle_plate=req.secondary_vehicle_plate,
            monthly_fee_inr=base_fee,
            gst_inr=gst,
            total_fee_inr=total,
            start_date=start_date,
            end_date=end_date,
            next_billing_date=end_date,
            auto_renew=req.auto_renew,
            status=SubscriptionStatus.ACTIVE,
            pass_qr_code=qr,
            rfid_card_tag=f"RFID-TAG-{uuid.uuid4().hex[:8].upper()}",
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        return sub


# ----------------------------------------------------------------------------
# 3 & 4. Corporate Accounts & Fleet Wallets
# ----------------------------------------------------------------------------
class CorporateFleetService:
    @staticmethod
    def create_corporate_account(db: Session, req: CorporateAccountCreateRequest) -> CorporateAccount:
        acc = CorporateAccount(
            company_name=req.company_name,
            corporate_code=req.corporate_code.upper().strip(),
            authorized_domain=req.authorized_domain.lower().strip(),
            gst_number=req.gst_number,
            billing_contact_email=req.billing_contact_email,
            monthly_credit_limit_inr=req.monthly_credit_limit_inr,
            allocated_daily_slots=req.allocated_daily_slots,
        )
        db.add(acc)
        db.commit()
        db.refresh(acc)
        return acc

    @staticmethod
    def add_corporate_member(db: Session, req: CorporateMemberAddRequest) -> CorporateMember:
        corp = db.query(CorporateAccount).filter(CorporateAccount.id == req.corporate_id).first()
        if not corp:
            raise LookupError(f"Corporate account #{req.corporate_id} not found.")

        # Validate domain
        email_domain = req.employee_email.split("@")[-1].lower().strip()
        if email_domain != corp.authorized_domain:
            raise ValueError(
                f"Employee email domain '@{email_domain}' does not match company domain '@{corp.authorized_domain}'."
            )

        member = CorporateMember(
            corporate_id=req.corporate_id,
            employee_email=req.employee_email,
            employee_name=req.employee_name,
            employee_id_tag=req.employee_id_tag,
            vehicle_plate=req.vehicle_plate.upper().strip(),
            monthly_stipend_inr=req.monthly_stipend_inr,
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        return member

    @staticmethod
    def create_fleet_account(db: Session, req: FleetAccountCreateRequest) -> FleetAccount:
        fleet = FleetAccount(
            fleet_code=req.fleet_code.upper().strip(),
            fleet_name=req.fleet_name,
            operator_email=req.operator_email,
            wallet_balance_inr=req.initial_deposit_inr,
            auto_recharge_threshold_inr=req.auto_recharge_threshold_inr,
            auto_recharge_amount_inr=req.auto_recharge_amount_inr,
        )
        db.add(fleet)
        db.commit()
        db.refresh(fleet)
        return fleet

    @staticmethod
    def register_fleet_vehicle(db: Session, req: FleetVehicleRegisterRequest) -> FleetVehicle:
        vehicle = FleetVehicle(
            fleet_id=req.fleet_id,
            plate_number=req.plate_number.upper().strip(),
            driver_name=req.driver_name,
            driver_phone=req.driver_phone,
            daily_spend_limit_inr=req.daily_spend_limit_inr,
            fastag_tag_id=req.fastag_tag_id or f"FASTAG-FLT-{uuid.uuid4().hex[:8].upper()}",
        )
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
        return vehicle

    @staticmethod
    def topup_fleet_wallet(db: Session, req: FleetRechargeRequest) -> FleetAccount:
        fleet = db.query(FleetAccount).filter(FleetAccount.id == req.fleet_id).first()
        if not fleet:
            raise LookupError(f"Fleet account #{req.fleet_id} not found.")

        fleet.wallet_balance_inr += req.amount_inr
        tx = FleetTransaction(
            fleet_id=fleet.id,
            vehicle_plate="FLEET-WALLET-CENTRAL",
            amount_inr=req.amount_inr,
            transaction_type="CREDIT_TOPUP",
            description=req.description,
        )
        db.add(tx)
        db.commit()
        db.refresh(fleet)
        return fleet


# ----------------------------------------------------------------------------
# 5 & 6. Group Reservations & Event Parking
# ----------------------------------------------------------------------------
class GroupAndEventService:
    @staticmethod
    def create_group_reservation(db: Session, req: GroupReservationCreateRequest) -> GroupReservation:
        lot = db.query(ParkingLot).filter(ParkingLot.id == req.lot_id).first()
        if not lot:
            raise LookupError(f"Parking Lot #{req.lot_id} not found.")

        duration_hours = max(
            1.0,
            (req.end_time - req.start_time).total_seconds() / 3600.0,
        )
        rate = lot.base_hourly_rate_inr
        total_est = round(req.target_slots_count * duration_hours * rate, 2)
        code = f"GRP-{uuid.uuid4().hex[:6].upper()}"

        group = GroupReservation(
            group_code=code,
            title=req.title,
            host_email=req.host_email,
            host_phone=req.host_phone,
            lot_id=req.lot_id,
            start_time=req.start_time,
            end_time=req.end_time,
            target_slots_count=req.target_slots_count,
            confirmed_slots_count=0,
            payment_mode=req.payment_mode,
            total_estimated_amount_inr=total_est,
        )
        db.add(group)
        db.commit()
        db.refresh(group)
        return group

    @staticmethod
    def join_group_reservation(
        db: Session, group_code: str, req: GroupGuestJoinRequest
    ) -> GroupReservationGuest:
        group = (
            db.query(GroupReservation)
            .filter(GroupReservation.group_code == group_code.upper().strip())
            .first()
        )
        if not group:
            raise LookupError(f"Group reservation code '{group_code}' not found.")

        assigned_slot = f"G-{group.confirmed_slots_count + 1:02d}"
        guest = GroupReservationGuest(
            group_reservation_id=group.id,
            guest_name=req.guest_name,
            guest_phone=req.guest_phone,
            vehicle_plate=req.vehicle_plate.upper().strip(),
            assigned_slot_number=assigned_slot,
            invitation_token=f"INV-{uuid.uuid4().hex[:8].upper()}",
            has_checked_in=False,
        )
        group.confirmed_slots_count += 1
        db.add(guest)
        db.commit()
        db.refresh(guest)
        return guest

    @staticmethod
    def create_parking_event(db: Session, req: ParkingEventCreateRequest) -> ParkingEvent:
        code = f"EVT-{re.sub(r'[^A-Z0-9]', '', req.event_name.upper())[:8]}-{uuid.uuid4().hex[:4].upper()}"
        event = ParkingEvent(
            event_code=code,
            event_name=req.event_name,
            venue_name=req.venue_name,
            lot_id=req.lot_id,
            event_date=req.event_date,
            gates_open_time=req.gates_open_time,
            event_end_time=req.event_end_time,
            total_allocated_bays=req.total_allocated_bays,
            booked_bays_count=0,
            flat_event_fee_inr=req.flat_event_fee_inr,
            shuttle_service_included=req.shuttle_service_included,
            traffic_advisory=req.traffic_advisory,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def book_event_pass(db: Session, req: EventPassBookRequest) -> EventParkingPass:
        event = db.query(ParkingEvent).filter(ParkingEvent.id == req.event_id).first()
        if not event:
            raise LookupError(f"Parking Event #{req.event_id} not found.")

        pass_code = f"PASS-{event.event_code}-{uuid.uuid4().hex[:6].upper()}"
        shuttle_token = f"SHTL-{uuid.uuid4().hex[:6].upper()}" if event.shuttle_service_included else None

        pass_obj = EventParkingPass(
            pass_code=pass_code,
            event_id=event.id,
            user_email=req.user_email,
            vehicle_plate=req.vehicle_plate.upper().strip(),
            assigned_entry_gate=req.assigned_entry_gate,
            fee_paid_inr=event.flat_event_fee_inr,
            shuttle_pass_token=shuttle_token,
        )
        event.booked_bays_count += 1
        db.add(pass_obj)
        db.commit()
        db.refresh(pass_obj)
        return pass_obj


# ----------------------------------------------------------------------------
# 7. WhatsApp Notification Service
# ----------------------------------------------------------------------------
class WhatsAppNotificationService:
    TEMPLATES = {
        "BOOKING_CONFIRMATION": (
            "Namaste! Your Parkwise parking reservation {booking_ref} is CONFIRMED at {lot_name}. "
            "Bay: {slot_number}, Entry Gate: {gate}. Navigation Pin: {map_url}."
        ),
        "ARRIVAL_REMINDER": (
            "Friendly Reminder: Your Parkwise reservation starts in 15 minutes at {lot_name}. "
            "Please keep FASTag or QR pass ready at barrier gate."
        ),
        "OVERSTAY_ALERT": (
            "Alert: Your reservation grace period expires in 5 minutes at {lot_name}. "
            "Extend session via Parkwise Driver Hub to avoid overstay penalty."
        ),
        "EXIT_RECEIPT": (
            "Thank you for parking with Parkwise! Total paid: Rs {amount}. "
            "Your digital tax invoice & receipt: {invoice_url}. Safe travels!"
        ),
    }

    @staticmethod
    def send_notification(
        db: Session, req: WhatsAppSendNotificationRequest
    ) -> WhatsAppNotificationLog:
        raw_tpl = WhatsAppNotificationService.TEMPLATES.get(
            req.template_name,
            "Parkwise Alert: Update regarding reservation {booking_ref}."
        )
        params = req.custom_params or {}
        params.setdefault("booking_ref", req.booking_reference or "PW-RES-7789")
        params.setdefault("lot_name", "Connaught Place Multi-Level Hub")
        params.setdefault("slot_number", "Bay A-12")
        params.setdefault("gate", "North Entry Gate 1")
        params.setdefault("map_url", "https://parkwise.in/maps/cp-01")
        params.setdefault("amount", "160")
        params.setdefault("invoice_url", "https://parkwise.in/invoice/pdf-9823")

        body = raw_tpl.format(**params)
        sid = f"WA-{uuid.uuid4().hex[:12].upper()}"

        log = WhatsAppNotificationLog(
            message_sid=sid,
            booking_reference=req.booking_reference,
            recipient_phone=req.recipient_phone,
            template_name=req.template_name,
            language_code=req.language_code,
            message_body=body,
            provider="META_CLOUD_API_SIMULATED",
            delivery_status="DELIVERED",
            is_mock_provider=True,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log


# ----------------------------------------------------------------------------
# 8. Localization Service
# ----------------------------------------------------------------------------
class LocalizationService:
    DICTIONARIES = {
        "en": {
            "app_title": "Parkwise Enterprise Smart Parking",
            "search_placeholder": "Search destination, mall, or metro city...",
            "book_bay": "Reserve Parking Bay",
            "ev_charging": "EV Ultra-Fast Charging",
            "subscriptions": "Monthly Subscriptions",
            "corporate": "Corporate Accounts",
            "valet": "Digital Valet Desk",
            "anpr_gate": "Automated ANPR Barrier Gate",
            "status_available": "Available",
            "status_occupied": "Occupied",
            "zero_direct_mutations": "Zero Direct Mutations: Driver verification required.",
        },
        "hi": {
            "app_title": "पार्कवाइज़ एंटरप्राइज़ स्मार्ट पार्किंग",
            "search_placeholder": "गंतव्य, मॉल या मेट्रो शहर खोजें...",
            "book_bay": "पार्किंग स्लॉट बुक करें",
            "ev_charging": "ईवी सुपर-फास्ट चार्जिंग",
            "subscriptions": "मासिक पास और सब्सक्रिप्शन",
            "corporate": "कॉर्पोरेट खाते",
            "valet": "डिजिटल वैले सेवा",
            "anpr_gate": "स्वचालित नंबर प्लेट बैरियर गेट",
            "status_available": "उपलब्ध",
            "status_occupied": "व्यस्त",
            "zero_direct_mutations": "शून्य प्रत्यक्ष उत्परिवर्तन: ड्राइवर सत्यापन अनिवार्य है।",
        },
        "mr": {
            "app_title": "पार्कवाइज स्मार्ट पार्किंग प्लॅटफॉर्म",
            "search_placeholder": "ठिकाण, मॉल किंवा शहर शोधा...",
            "book_bay": "पार्किंग जागा आरक्षित करा",
            "ev_charging": "ईव्ही फास्ट चार्जिंग",
            "subscriptions": "मासिक पार्किंग पासेस",
            "corporate": "कॉर्पोरेट खाती",
            "valet": "डिजिटल व्हॅलेट सेवा",
            "anpr_gate": "स्वयंचलित नंबर प्लेट गेट",
            "status_available": "उपलब्ध",
            "status_occupied": "व्यापलेले",
            "zero_direct_mutations": "सुरक्षित धोरण: चालक पडताळणी आवश्यक आहे.",
        },
        "kn": {
            "app_title": "ಪಾರ್ಕ್‌ವೈಸ್ ಸ್ಮಾರ್ಟ್ ಪಾರ್ಕಿಂಗ್",
            "search_placeholder": "ಸ್ಥಳ, ಮಾಲ್ ಅಥವಾ ನಗರವನ್ನು ಹುಡುಕಿ...",
            "book_bay": "ಪಾರ್ಕಿಂಗ್ ಸ್ಲಾಟ್ ಕಾಯ್ದಿರಿಸಿ",
            "ev_charging": "ಇವಿ ವೇಗದ ಚಾರ್ಜಿಂಗ್",
            "subscriptions": "ಮಾಸಿಕ ಚಂದಾದಾರಿಕೆಗಳು",
            "corporate": "ಕಾರ್ಪೊರೇಟ್ ಖಾತೆಗಳು",
            "valet": "ಡಿಜಿಟಲ್ ವ್ಯಾಲೆಟ್ ಸೇವೆ",
            "anpr_gate": "ಸ್ವಯಂಚಾಲಿತ ನಂಬರ್ ಪ್ಲೇಟ್ ಗೇಟ್",
            "status_available": "ಲಭ್ಯವಿದೆ",
            "status_occupied": "ಭರ್ತಿಯಾಗಿದೆ",
            "zero_direct_mutations": "ಸುರಕ್ಷಿತ ನಿಯಮಾವಳಿ: ಚಾಲಕರ ದೃಢೀಕರಣ ಅಗತ್ಯವಿದೆ.",
        },
        "te": {
            "app_title": "పార్క్వైస్ స్మార్ట్ పార్కింగ్ సిస్టమ్",
            "search_placeholder": "లొకేషన్, మాల్ లేదా నగరాన్ని శోధించండి...",
            "book_bay": "పార్కింగ్ స్లాట్ బుక్ చేయండి",
            "ev_charging": "ఈవీ ఫాస్ట్ ఛార్జింగ్",
            "subscriptions": "నెలవారీ సబ్‌స్క్రిప్షన్లు",
            "corporate": "కార్పొరేట్ ఖాతాలు",
            "valet": "డిజిటల్ వాలెట్ సేవ",
            "anpr_gate": "ఆటోమేటిక్ నంబర్ ప్లేట్ గేట్",
            "status_available": "అందుబాటులో ఉంది",
            "status_occupied": "పూర్తిగా ఉంది",
            "zero_direct_mutations": "సురక్షిత పాలసీ: డ్రైవర్ నిర్ధారణ అవసరం.",
        },
        "ta": {
            "app_title": "பார்க்வைஸ் ஸ்மார்ட் பார்க்கிங்",
            "search_placeholder": "இடம், மால் அல்லது நகரத்தைத் தேடுங்கள்...",
            "book_bay": "பார்க்கிங் இடத்தை முன்பதிவு செய்யுங்கள்",
            "ev_charging": "மின்சார வாகனம் (EV) சார்ஜிங்",
            "subscriptions": "மாதாந்திர பாஸ்கள்",
            "corporate": "நிறுவன கணக்குகள்",
            "valet": "டிஜிட்டல் வேலட் சேவை",
            "anpr_gate": "தானியங்கி எண் தட்டு கேட்",
            "status_available": "கிடைக்கிறது",
            "status_occupied": "நிரம்பியுள்ளது",
            "zero_direct_mutations": "பாதுகாப்பான கொள்கை: ஓட்டுநர் சரிபார்ப்பு தேவை.",
        },
    }

    @staticmethod
    def get_dictionary(locale: str) -> Dict[str, str]:
        normalized = locale.lower().strip()
        return LocalizationService.DICTIONARIES.get(
            normalized, LocalizationService.DICTIONARIES["en"]
        )


# ----------------------------------------------------------------------------
# 9. Shared Parking Marketplace
# ----------------------------------------------------------------------------
class SharedMarketplaceService:
    @staticmethod
    def create_listing(db: Session, req: MarketplaceListingCreateRequest) -> MarketplaceListing:
        code = f"MKT-{uuid.uuid4().hex[:6].upper()}"
        listing = MarketplaceListing(
            listing_code=code,
            host_name=req.host_name,
            host_email=req.host_email,
            host_phone=req.host_phone,
            title=req.title,
            address=req.address,
            city=req.city,
            latitude=req.latitude,
            longitude=req.longitude,
            space_type=req.space_type,
            hourly_rate_inr=req.hourly_rate_inr,
            daily_rate_inr=req.daily_rate_inr,
            access_instructions=req.access_instructions,
            is_ev_ready=req.is_ev_ready,
            kyc_verified=True,
            status=MarketplaceListingStatus.ACTIVE,
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)
        return listing

    @staticmethod
    def book_listing(db: Session, req: MarketplaceBookRequest) -> MarketplaceBooking:
        listing = db.query(MarketplaceListing).filter(MarketplaceListing.id == req.listing_id).first()
        if not listing:
            raise LookupError(f"Marketplace listing #{req.listing_id} not found.")

        duration_hours = max(
            1.0,
            (req.end_time - req.start_time).total_seconds() / 3600.0,
        )
        gross = round(duration_hours * listing.hourly_rate_inr, 2)
        platform_fee = round(gross * (listing.platform_commission_pct / 100.0), 2)
        host_payout = round(gross - platform_fee, 2)
        code = f"MBK-{uuid.uuid4().hex[:6].upper()}"

        booking = MarketplaceBooking(
            booking_code=code,
            listing_id=listing.id,
            renter_name=req.renter_name,
            renter_email=req.renter_email,
            vehicle_plate=req.vehicle_plate.upper().strip(),
            start_time=req.start_time,
            end_time=req.end_time,
            gross_amount_inr=gross,
            platform_fee_inr=platform_fee,
            host_payout_inr=host_payout,
            status="CONFIRMED",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return booking


# ----------------------------------------------------------------------------
# 10. Multi-Location Operator Service
# ----------------------------------------------------------------------------
class MultiLocationOperatorService:
    @staticmethod
    def seed_default_regions_if_empty(db: Session):
        if db.query(OperatorRegion).count() == 0:
            regions_data = [
                ("NORTH_NCR", "North Zone (Delhi-NCR)", "New Delhi", "manager.north@parkwise.in"),
                ("WEST_MUMBAI", "West Zone (Mumbai Metropolitan)", "Mumbai", "manager.west@parkwise.in"),
                ("SOUTH_BLR_HYD", "South Zone (Bengaluru & Hyderabad)", "Bengaluru", "manager.south@parkwise.in"),
            ]
            for code, name, city, email in regions_data:
                db.add(OperatorRegion(
                    region_code=code,
                    name=name,
                    headquarters_city=city,
                    supervising_manager_email=email,
                    active_facilities_count=2,
                ))
            db.commit()

    @staticmethod
    def get_overview(db: Session) -> Dict[str, object]:
        MultiLocationOperatorService.seed_default_regions_if_empty(db)
        lots = db.query(ParkingLot).all()
        total_slots = db.query(ParkingSlot).count() or 1
        occupied_slots = db.query(ParkingSlot).filter(ParkingSlot.status == SlotStatus.OCCUPIED).count()
        occupancy_pct = round((occupied_slots / total_slots) * 100.0, 1)

        regions = db.query(OperatorRegion).all()
        region_list = []
        for r in regions:
            matching_lots = [
                l for l in lots
                if (r.region_code == "NORTH_NCR" and l.city in ("New Delhi", "Gurugram"))
                or (r.region_code == "WEST_MUMBAI" and l.city == "Mumbai")
                or (r.region_code == "SOUTH_BLR_HYD" and l.city in ("Bengaluru", "Hyderabad"))
            ]
            lot_ids = [l.id for l in matching_lots]
            reg_total = db.query(ParkingSlot).filter(ParkingSlot.lot_id.in_(lot_ids)).count() if lot_ids else 0
            reg_occ = db.query(ParkingSlot).filter(ParkingSlot.lot_id.in_(lot_ids), ParkingSlot.status == SlotStatus.OCCUPIED).count() if lot_ids else 0
            reg_rev = sum(l.base_hourly_rate_inr * reg_occ * 6 for l in matching_lots) if matching_lots else 0.0
            reg_total_safe = reg_total or 1
            region_list.append({
                "id": r.id,
                "region_code": r.region_code,
                "name": r.name,
                "city": r.headquarters_city,
                "manager": r.supervising_manager_email,
                "facilities_count": len(matching_lots),
                "total_slots": reg_total,
                "occupied_slots": reg_occ,
                "occupancy_pct": round((reg_occ / reg_total_safe) * 100.0, 1),
                "estimated_daily_revenue_inr": reg_rev,
                "facilities": [
                    {
                        "id": l.id,
                        "code": l.code,
                        "name": l.name,
                        "city": l.city,
                        "base_rate": l.base_hourly_rate_inr,
                        "surge_mult": l.current_surge_multiplier,
                        "dynamic_enabled": l.dynamic_pricing_enabled,
                    }
                    for l in matching_lots
                ],
            })

        return {
            "total_regions": len(regions),
            "total_facilities": len(lots),
            "total_network_slots": total_slots,
            "occupied_network_slots": occupied_slots,
            "network_occupancy_pct": occupancy_pct,
            "total_revenue_inr": sum(r["estimated_daily_revenue_inr"] for r in region_list),
            "active_pricing_overrides": 1,
            "regions": region_list,
        }


# ----------------------------------------------------------------------------
# 11, 12, 13, 14. Computer Vision, YOLO, ANPR & OCR Architecture
# ----------------------------------------------------------------------------
class VisionAndANPRService:
    INDIAN_PLATE_REGEX = re.compile(
        r"^(?P<state>[A-Z]{2})(?P<district>[0-9]{1,2})(?P<series>[A-Z]{0,3})(?P<number>[0-9]{4})$"
    )

    @staticmethod
    def normalize_indian_plate(raw_plate: str) -> Tuple[str, bool, Optional[str], Optional[str]]:
        cleaned = re.sub(r"[^A-Z0-9]", "", raw_plate.upper().strip())
        match = VisionAndANPRService.INDIAN_PLATE_REGEX.match(cleaned)
        if match:
            state = match.group("state")
            num = match.group("number")
            return cleaned, True, state, num
        return cleaned, False, None, None

    @staticmethod
    def process_anpr_scan(db: Session, req: ANPRScanRequest) -> ANPRScanEvent:
        normalized, is_hsrp, state, num = VisionAndANPRService.normalize_indian_plate(
            req.captured_plate_raw
        )
        conf = req.confidence_override if req.confidence_override is not None else 0.94
        decision = "AUTO_ALLOWED" if (conf >= 0.88 and is_hsrp) else "HUMAN_REVIEW_REQUIRED"

        # Privacy hash: SHA256 of raw plate + timestamp
        plate_hash = hashlib.sha256(
            f"{normalized}:{datetime.now(timezone.utc).isoformat()}".encode("utf-8")
        ).hexdigest()

        scan_code = f"SCAN-{uuid.uuid4().hex[:8].upper()}"
        scan = ANPRScanEvent(
            scan_code=scan_code,
            lot_id=req.lot_id,
            camera_id=req.camera_id,
            gate_lane=req.gate_lane,
            lane_type=req.lane_type,
            captured_plate_raw=req.captured_plate_raw,
            normalized_plate=normalized,
            confidence_score=conf,
            ocr_engine="EasyOCR-HSRP-IndianStandard-v2",
            is_hsrp_compliant=is_hsrp,
            decision=decision,
            human_verified=False,
            privacy_plate_hash=plate_hash,
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)

        # Route to human review if low confidence
        if decision == "HUMAN_REVIEW_REQUIRED":
            queue_item = ANPRHumanReviewQueue(
                scan_id=scan.id,
                lot_id=req.lot_id,
                captured_plate=req.captured_plate_raw,
                candidate_matches_json=json.dumps([normalized, f"DL01{num or '1234'}"]),
                confidence_score=conf,
                reason="LOW_OCR_CONFIDENCE_OR_NON_STANDARD_PLATE",
                status="PENDING",
            )
            db.add(queue_item)
            db.commit()

        return scan

    @staticmethod
    def run_yolo_inference(
        db: Session, camera_id: int, synthetic: bool = True
    ) -> YOLODetectionRun:
        cam = db.query(CameraStream).filter(CameraStream.id == camera_id).first()
        if not cam:
            # Create a fallback camera stream record if none exists
            cam = CameraStream(
                camera_code=f"CAM-LOT1-{camera_id}",
                lot_id=1,
                zone_name="Zone A - Deck 1",
                stream_url=f"rtsp://cctv.local:8554/cam{camera_id}",
                status="ONLINE",
            )
            db.add(cam)
            db.commit()
            db.refresh(cam)

        # Simulated synthetic YOLO bounding box detections with IoU
        sample_boxes = [
            {"class": "car", "confidence": 0.96, "bbox": [120, 80, 280, 220], "slot_id": 1, "iou": 0.88, "status": "OCCUPIED"},
            {"class": "suv", "confidence": 0.93, "bbox": [310, 85, 470, 230], "slot_id": 2, "iou": 0.85, "status": "OCCUPIED"},
            {"class": "motorcycle", "confidence": 0.91, "bbox": [500, 95, 590, 210], "slot_id": 3, "iou": 0.81, "status": "OCCUPIED"},
            {"class": "car", "confidence": 0.95, "bbox": [620, 80, 780, 220], "slot_id": 4, "iou": 0.89, "status": "OCCUPIED"},
        ]

        run = YOLODetectionRun(
            camera_id=cam.id,
            model_version="YOLOv8-Parking-Precision-v1.4",
            inference_latency_ms=38.4,
            detected_vehicles_count=len(sample_boxes),
            occupied_slots_count=4,
            vacant_slots_count=12,
            bounding_boxes_json=json.dumps(sample_boxes),
            privacy_audit_status="REDACTION_APPLIED_NO_PII",
            is_synthetic_test=synthetic,
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return run


# ----------------------------------------------------------------------------
# 15. Valet Service
# ----------------------------------------------------------------------------
class ValetService:
    @staticmethod
    def check_in_valet(db: Session, req: ValetCheckInRequest) -> ValetTicket:
        ticket_code = f"VALET-{datetime.now(timezone.utc).strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        ticket = ValetTicket(
            ticket_code=ticket_code,
            lot_id=req.lot_id,
            customer_name=req.customer_name,
            customer_phone=req.customer_phone,
            vehicle_plate=req.vehicle_plate.upper().strip(),
            vehicle_model=req.vehicle_model,
            key_locker_tag=req.key_locker_tag,
            assigned_slot_number=req.assigned_slot_number or "V-01",
            valet_fee_inr=150.0,
            status=ValetTicketStatus.ACCEPTED_AT_KIOSK,
            odometer_reading_km=req.odometer_reading_km,
            fuel_or_battery_level_pct=req.fuel_or_battery_level_pct,
            pre_existing_damage_notes=req.pre_existing_damage_notes,
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        return ticket

    @staticmethod
    def execute_valet_action(db: Session, ticket_id: int, req: ValetActionRequest) -> ValetTicket:
        ticket = db.query(ValetTicket).filter(ValetTicket.id == ticket_id).first()
        if not ticket:
            raise LookupError(f"Valet ticket #{ticket_id} not found.")

        now = datetime.now(timezone.utc)
        if req.action == "PARK":
            ticket.status = ValetTicketStatus.PARKED
        elif req.action == "REQUEST_RETRIEVAL":
            ticket.status = ValetTicketStatus.RETRIEVAL_REQUESTED
            ticket.retrieval_requested_at = now
        elif req.action == "START_TRANSIT":
            ticket.status = ValetTicketStatus.IN_TRANSIT
        elif req.action == "DELIVER":
            ticket.status = ValetTicketStatus.DELIVERED_TO_CUSTOMER
            ticket.delivery_time = now

        db.commit()
        db.refresh(ticket)
        return ticket
