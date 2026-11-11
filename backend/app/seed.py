"""Idempotent Database Seeder with Realistic Indian Metro Smart Parking Infrastructure, RBAC Roles, Permissions & Vehicles."""
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.auth import ROLE_PERMISSIONS_MAP, hash_password
from app.models import (
    AuditLog,
    Booking,
    BookingStatus,
    GateLog,
    ParkingLot,
    ParkingSlot,
    Payment,
    PaymentStatus,
    Permission,
    Role,
    RolePermission,
    SlotStatus,
    SlotType,
    User,
    UserRole,
    Vehicle,
)
from app.services.booking_service import compute_qr_signature


def seed_initial_data(db: Session) -> None:
    if db.query(ParkingLot).count() > 0:
        return

    # 0. Seed Roles, Permissions, and RolePermission mappings
    permission_definitions = [
        ("booking:create", "Create Parking Reservation", "DRIVER", "Reserve available parking bays with transactional locks"),
        ("booking:read", "Read Booking Records", "DRIVER", "Inspect reservation details, QR passes, and GST invoices"),
        ("booking:cancel", "Cancel Reservation", "DRIVER", "Cancel pre-check-in reservations and initiate Razorpay refund"),
        ("booking:extend", "Extend Active Parking", "DRIVER", "Extend reservation duration with conflict verification"),
        ("vehicle:manage", "Manage Registered Vehicles", "DRIVER", "Add, update, and remove RTO vehicles and FASTag tags"),
        ("profile:manage", "Manage Account Profile", "AUTH", "Update personal profile, GSTIN, and notification settings"),
        ("slot:override", "Override Bay Status", "OPERATOR", "Mark parking bays Available, Occupied, or Maintenance"),
        ("pricing:surge", "Configure Dynamic Surge", "OPERATOR", "Enable dynamic pricing and adjust surge multipliers"),
        ("ai:forecast", "Run AI Occupancy Forecast", "OPERATOR", "Execute XGBoost demand forecasting and tariff inference"),
        ("lot:manage", "Manage Parking Facility", "OPERATOR", "Manage multi-floor parking facility telemetry"),
        ("gate:scan", "Process Gate QR/ANPR Scan", "GATE", "Verify HMAC QR signatures and optical ANPR plates at barrier"),
        ("gate:logs", "Inspect Gate Telemetry Logs", "GATE", "View entry, exit, and denied boom-barrier events"),
        ("gate:override", "Manual Barrier Override", "GATE", "Authorize emergency or manual boom-barrier actuation"),
        ("admin:users", "Manage Platform Users", "ADMIN", "Inspect users, verify KYC, and manage platform accounts"),
        ("admin:roles", "Assign RBAC Roles", "ADMIN", "Modify user roles and enforce least-privilege access"),
        ("admin:audit", "Inspect Security Audit Ledger", "ADMIN", "Read immutable security and operational audit logs"),
        ("admin:deactivate", "Deactivate / Reactivate Accounts", "ADMIN", "Suspend or restore user accounts and revoke sessions"),
    ]

    perm_by_code = {}
    for code, name, module, desc in permission_definitions:
        p = Permission(code=code, name=name, module=module, description=desc)
        db.add(p)
        db.flush()
        perm_by_code[code] = p

    role_definitions = [
        (UserRole.DRIVER, "Driver Mobility User", "Search, reserve, pay, and manage vehicles and QR gate passes"),
        (UserRole.OPERATOR, "Parking Facility Operator", "Manage bay inventory, AI surge pricing, and facility revenue"),
        (UserRole.GATE_STAFF, "Gate Terminal Controller", "Operate ANPR cameras, QR scanners, and boom-barrier lanes"),
        (UserRole.ADMIN, "Platform Administrator", "Full national grid governance, RBAC administration, and security audits"),
    ]

    for r_enum, r_name, r_desc in role_definitions:
        role_row = Role(
            code=r_enum.value,
            name=r_name,
            description=r_desc,
            is_system_role=True,
        )
        db.add(role_row)
        db.flush()
        for p_code in ROLE_PERMISSIONS_MAP.get(r_enum, []):
            if p_code in perm_by_code:
                db.add(
                    RolePermission(
                        role_id=role_row.id,
                        permission_id=perm_by_code[p_code].id,
                    )
                )

    db.flush()

    # 1. Seed Enterprise RBAC Users
    driver = User(
        full_name="Aarav Sharma",
        email="driver@parkwise.in",
        phone="+91-9811045210",
        password_hash=hash_password("parkwise123"),
        role=UserRole.DRIVER,
        vehicle_number="DL-08-CAF-8921",
        fastag_id="FT-NPCI-ICICI-892104",
        home_city="New Delhi",
        gst_number="07AABCP9981K1Z5",
        email_verified=True,
        email_verification_token=None,
    )
    operator = User(
        full_name="Vikramaditya Nair (BKC Operations)",
        email="operator@parkwise.in",
        phone="+91-9820194812",
        password_hash=hash_password("parkwise123"),
        role=UserRole.OPERATOR,
        home_city="Mumbai",
        email_verified=True,
    )
    gate_staff = User(
        full_name="Rajeshwari Menon (Gate Terminal 01)",
        email="gate@parkwise.in",
        phone="+91-9845091823",
        password_hash=hash_password("parkwise123"),
        role=UserRole.GATE_STAFF,
        home_city="New Delhi",
        email_verified=True,
    )
    admin = User(
        full_name="Dheemant Setia (Principal Admin)",
        email="admin@parkwise.in",
        phone="+91-9910088211",
        password_hash=hash_password("parkwise123"),
        role=UserRole.ADMIN,
        home_city="New Delhi",
        email_verified=True,
    )
    db.add_all([driver, operator, gate_staff, admin])
    db.flush()

    # 1b. Seed Vehicles for the Driver User
    v1 = Vehicle(
        user_id=driver.id,
        plate_number="DL-08-CAF-8921",
        model_name="Tata Nexon EV Empowered+",
        size_class="SEDAN",
        dimensions_label="3.99m × 1.81m × 1.62m",
        is_ev=True,
        fastag_id="FT-NPCI-ICICI-892104",
        is_primary=True,
    )
    v2 = Vehicle(
        user_id=driver.id,
        plate_number="MH-01-AB-4589",
        model_name="Mahindra XUV700 AX7L",
        size_class="SUV_XL",
        dimensions_label="4.69m × 1.89m × 1.75m",
        is_ev=False,
        fastag_id="FT-NPCI-HDFC-458912",
        is_primary=False,
    )
    v3 = Vehicle(
        user_id=driver.id,
        plate_number="KA-03-MN-1122",
        model_name="Hyundai i20 N-Line",
        size_class="COMPACT",
        dimensions_label="3.99m × 1.77m × 1.50m",
        is_ev=False,
        fastag_id="FT-NPCI-AXIS-112209",
        is_primary=False,
    )
    db.add_all([v1, v2, v3])
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
        action="SYSTEM_BOOTSTRAPPED",
        target_resource="ALL_METRO_LOTS",
        details="Initialized 5 Indian metro smart parking facilities, 80 IoT bays, 4 RBAC roles, and 17 granular permissions.",
    )
    db.add(audit)
    db.commit()
