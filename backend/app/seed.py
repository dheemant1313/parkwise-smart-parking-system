"""Idempotent Database Seeder with Realistic Indian Metro Smart Parking Infrastructure."""
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.auth import hash_password
from app.models import (
    AuditLog,
    Booking,
    BookingStatus,
    GateLog,
    ParkingLot,
    ParkingSlot,
    Payment,
    PaymentStatus,
    SlotStatus,
    SlotType,
    User,
    UserRole,
)
from app.services.booking_service import compute_qr_signature


def seed_initial_data(db: Session) -> None:
    if db.query(ParkingLot).count() > 0:
        return

    # 1. Seed Enterprise RBAC Users
    driver = User(
        full_name="Aarav Sharma",
        email="driver@parkwise.in",
        phone="+91-9811045210",
        password_hash=hash_password("parkwise123"),
        role=UserRole.DRIVER,
        vehicle_number="DL-08-CAF-8921",
        fastag_id="FT-NPCI-ICICI-892104",
    )
    operator = User(
        full_name="Vikramaditya Nair (BKC Operations)",
        email="operator@parkwise.in",
        phone="+91-9820194812",
        password_hash=hash_password("parkwise123"),
        role=UserRole.OPERATOR,
    )
    gate_staff = User(
        full_name="Rajeshwari Menon (Gate Terminal 01)",
        email="gate@parkwise.in",
        phone="+91-9845091823",
        password_hash=hash_password("parkwise123"),
        role=UserRole.GATE_STAFF,
    )
    admin = User(
        full_name="Dheemant Setia (Principal Admin)",
        email="admin@parkwise.in",
        phone="+91-9910088211",
        password_hash=hash_password("parkwise123"),
        role=UserRole.ADMIN,
    )
    db.add_all([driver, operator, gate_staff, admin])
    db.flush()

    # 2. Seed Indian Metropolitan Smart Parking Lots
    lots_data = [
        {
            "code": "DEL-CP-01",
            "name": "Connaught Place Inner Circle Multi-Level Hub",
            "city": "New Delhi",
            "address": "Block A, Inner Circle, Connaught Place, New Delhi 110001",
            "latitude": 28.6315,
            "longitude": 77.2167,
            "total_floors": 3,
            "base_hourly_rate_inr": 80.0,
            "ev_surcharge_inr": 45.0,
            "dynamic_pricing_enabled": True,
            "current_surge_multiplier": 1.25,
            "operator_name": "NDMC Smart Mobility Infrastructure Ltd.",
            "rating": 4.9,
        },
        {
            "code": "MUM-BKC-02",
            "name": "Jio World Drive BKC Automated Deck",
            "city": "Mumbai",
            "address": "Bandra Kurla Complex, Bandra East, Mumbai, Maharashtra 400051",
            "latitude": 19.0607,
            "longitude": 72.8633,
            "total_floors": 4,
            "base_hourly_rate_inr": 100.0,
            "ev_surcharge_inr": 50.0,
            "dynamic_pricing_enabled": True,
            "current_surge_multiplier": 1.35,
            "operator_name": "Western Metro Parking Corp.",
            "rating": 4.95,
        },
        {
            "code": "BLR-IND-03",
            "name": "Indiranagar 100ft Road Smart Plaza",
            "city": "Bengaluru",
            "address": "100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru 560038",
            "latitude": 12.9716,
            "longitude": 77.6412,
            "total_floors": 3,
            "base_hourly_rate_inr": 70.0,
            "ev_surcharge_inr": 40.0,
            "dynamic_pricing_enabled": True,
            "current_surge_multiplier": 1.15,
            "operator_name": "Namma Mobility Grid Pvt. Ltd.",
            "rating": 4.85,
        },
        {
            "code": "GUR-CYB-04",
            "name": "DLF CyberHub Autonomous Tower",
            "city": "Gurugram",
            "address": "DLF Cyber City, Phase 2, NH-48, Gurugram, Haryana 122002",
            "latitude": 28.4950,
            "longitude": 77.0895,
            "total_floors": 3,
            "base_hourly_rate_inr": 90.0,
            "ev_surcharge_inr": 45.0,
            "dynamic_pricing_enabled": True,
            "current_surge_multiplier": 1.20,
            "operator_name": "CyberCity Urban Transit Ops",
            "rating": 4.88,
        },
        {
            "code": "HYD-HIT-05",
            "name": "HITEC City Mindspace Nexus Deck",
            "city": "Hyderabad",
            "address": "Raheja Mindspace, Madhapur, HITEC City, Hyderabad 500081",
            "latitude": 17.4435,
            "longitude": 78.3772,
            "total_floors": 3,
            "base_hourly_rate_inr": 65.0,
            "ev_surcharge_inr": 35.0,
            "dynamic_pricing_enabled": False,
            "current_surge_multiplier": 1.00,
            "operator_name": "Deccan Smart Infra Solutions",
            "rating": 4.82,
        },
    ]

    created_lots = []
    for ldata in lots_data:
        lot = ParkingLot(**ldata)
        db.add(lot)
        db.flush()
        created_lots.append(lot)

        # Create 16 structured slots per lot across 2 floors (Zone A & Zone B)
        for idx in range(1, 17):
            floor = 1 if idx <= 8 else 2
            zone = "A" if idx % 2 == 1 else "B"
            slot_num = f"F{floor}-{zone}{idx:02d}"

            if idx in (1, 2, 9):
                s_type = SlotType.EV_CHARGING
                power = 50.0
            elif idx in (3, 10):
                s_type = SlotType.ACCESSIBLE
                power = None
            elif idx in (7, 8, 15, 16):
                s_type = SlotType.SUV_XL
                power = None
            else:
                s_type = SlotType.STANDARD
                power = None

            if idx in (4, 11):
                s_status = SlotStatus.OCCUPIED
            elif idx == 14:
                s_status = SlotStatus.MAINTENANCE
            else:
                s_status = SlotStatus.AVAILABLE

            slot = ParkingSlot(
                lot_id=lot.id,
                slot_number=slot_num,
                floor=floor,
                zone=zone,
                slot_type=s_type,
                status=s_status,
                sensor_health="ONLINE" if idx != 14 else "CALIBRATING",
                power_kw=power,
            )
            db.add(slot)

    db.flush()

    # 3. Seed one Confirmed Sample Booking for immediate Gate Scanner & Dashboard Demo
    first_lot = created_lots[0]
    sample_slot = (
        db.query(ParkingSlot)
        .filter(
            ParkingSlot.lot_id == first_lot.id,
            ParkingSlot.status == SlotStatus.AVAILABLE,
        )
        .first()
    )
    if sample_slot:
        sample_slot.status = SlotStatus.RESERVED
        now = datetime.now(timezone.utc)
        ref = "PW-DEMO-9012"
        sig = compute_qr_signature(ref, sample_slot.id, "DL-08-CAF-8921")
        demo_booking = Booking(
            booking_reference=ref,
            user_id=driver.id,
            lot_id=first_lot.id,
            slot_id=sample_slot.id,
            vehicle_number="DL-08-CAF-8921",
            driver_name="Aarav Sharma",
            driver_phone="+91-9811045210",
            start_time=now - timedelta(minutes=15),
            end_time=now + timedelta(hours=2),
            duration_hours=2.0,
            base_amount_inr=200.0,
            surge_multiplier=1.25,
            gst_amount_inr=36.0,
            total_amount_inr=236.0,
            status=BookingStatus.CONFIRMED,
            qr_signature=sig,
        )
        db.add(demo_booking)
        db.flush()

        demo_payment = Payment(
            booking_id=demo_booking.id,
            razorpay_order_id="order_pw_demo_9012",
            razorpay_payment_id="pay_pw_demo_9012",
            razorpay_signature="verified_hmac_sha256_demo_signature",
            amount_inr=236.0,
            currency="INR",
            payment_method="UPI / FASTag Auto-Debit",
            status=PaymentStatus.CAPTURED,
            is_simulated=True,
            verified_at=now - timedelta(minutes=14),
        )
        db.add(demo_payment)

        gate_log = GateLog(
            lot_id=first_lot.id,
            booking_reference=ref,
            vehicle_number="DL-08-CAF-8921",
            event_type="PRE_AUTH_READY",
            gate_lane="LANE-01 (ANPR+FASTag)",
            anpr_confidence=0.986,
            verification_method="QR_HMAC + ANPR",
            barrier_action="STANDBY",
            notes="Pre-authorized reservation ready for optical ANPR or QR scan.",
        )
        db.add(gate_log)

    audit = AuditLog(
        actor_email="admin@parkwise.in",
        actor_role="ADMIN",
        action="SYSTEM_BOOT_SEED",
        target_resource="NATIONAL_GRID_5_METROS",
        details="Initialized 5 metro smart parking hubs, 80 IoT bays, and XGBoost AI pricing engine.",
    )
    db.add(audit)
    db.commit()
