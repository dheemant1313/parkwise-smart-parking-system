"""Idempotent Database Seeder with Realistic Indian Metro Smart Parking Infrastructure, RBAC, and Phase 04 Inventory Hierarchy."""
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.auth import ROLE_PERMISSIONS_MAP, hash_password
from app.models import (
    AuditLog,
    AvailabilitySchedule,
    Booking,
    BookingEvent,
    BookingStatus,
    GateLog,
    ParkingFloor,
    ParkingLot,
    ParkingOperator,
    ParkingSlot,
    ParkingZone,
    Payment,
    PaymentStatus,
    Permission,
    PricingRule,
    Role,
    RolePermission,
    SlotStatus,
    SlotType,
    User,
    UserRole,
    Vehicle,
    VehicleCategory,
)
from app.services.booking_service import compute_qr_signature, issue_signed_qr_pass


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

    # 0b. Seed Vehicle Categories (Phase 04)
    categories_data = [
        ("TWO_WHEELER", "Two-Wheeler & Electric Scooter", 2.1, 0.9, 1.3, 0.5, "Compact two-wheeler bays"),
        ("COMPACT", "Compact Hatchback (<4.0m)", 3.99, 1.80, 1.55, 1.0, "Sub-4m hatchbacks and compact city cars"),
        ("SEDAN", "Executive Sedan & Mid-Crossover", 4.60, 1.84, 1.55, 1.0, "Standard executive sedans and mid-size crossovers"),
        ("SUV_XL", "Full-Size SUV, 7-Seater & MPV", 4.95, 1.98, 1.85, 1.3, "Wide-turning 3.2m bays with 2.4m vertical clearance"),
        ("EV_FOUR_WHEELER", "50kW CCS2 Electric Vehicle", 4.80, 1.90, 1.75, 1.25, "Dedicated EV bays equipped with 50kW DC fast chargers"),
    ]
    for code, name, l_m, w_m, h_m, mult, desc in categories_data:
        db.add(
            VehicleCategory(
                code=code,
                name=name,
                max_length_m=l_m,
                max_width_m=w_m,
                max_height_m=h_m,
                rate_multiplier=mult,
                description=desc,
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

    # 2. Seed Parking Operators & Indian Metropolitan Smart Parking Lots
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
            "gstin": "07AAACN1122K1Z4",
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
            "gstin": "27AABCW9988M1Z1",
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
            "gstin": "29AABCN4455L1Z8",
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
            "gstin": "06AABCC7788P1Z2",
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
            "gstin": "36AABCD3344Q1Z9",
            "rating": 4.82,
        },
    ]

    created_lots = []
    for idx_lot, ldata in enumerate(lots_data, start=1):
        gstin = ldata.pop("gstin")
        op_entity = ParkingOperator(
            company_name=ldata["operator_name"],
            gstin=gstin,
            contact_email=f"ops{idx_lot}@parkwise.in",
            contact_phone=f"+91-981001100{idx_lot}",
            kyc_verified=True,
            settlement_account=f"RZP-SETTLE-IN-00{idx_lot}",
        )
        db.add(op_entity)
        db.flush()

        lot = ParkingLot(
            operator_id=op_entity.id,
            opening_time="00:00",
            closing_time="23:59",
            is_24_hours=True,
            grace_period_minutes=15,
            reservation_hold_minutes=15,
            **ldata,
        )
        db.add(lot)
        db.flush()
        created_lots.append(lot)

        # Seed 2 structured floors and 2 zones per floor for each lot
        floor_map = {}
        zone_map = {}
        for f_num in (1, 2):
            fl = ParkingFloor(
                lot_id=lot.id,
                floor_number=f_num,
                floor_name=f"Level 0{f_num} — {'Express & EV Deck' if f_num == 1 else 'Executive & SUV Deck'}",
                clearance_height_m=2.45 if f_num == 1 else 2.30,
                total_bays=8,
                has_ev_chargers=True,
            )
            db.add(fl)
            db.flush()
            floor_map[f_num] = fl

            for z_code, z_name, z_cat in [
                ("A", "Zone A (North Core & EV Totems)", "EV_AND_ACCESSIBLE"),
                ("B", "Zone B (South Express & SUV Wing)", "STANDARD_AND_SUV"),
            ]:
                zn = ParkingZone(
                    lot_id=lot.id,
                    floor_id=fl.id,
                    zone_code=z_code,
                    zone_name=z_name,
                    dedicated_category=z_cat,
                    is_active=True,
                )
                db.add(zn)
                db.flush()
                zone_map[(f_num, z_code)] = zn

        # Seed 7-day Availability Schedule
        for dow in range(7):
            db.add(
                AvailabilitySchedule(
                    lot_id=lot.id,
                    day_of_week=dow,
                    open_time="00:00",
                    close_time="23:59",
                    is_24_hours=True,
                    is_closed=False,
                    peak_start_time="09:00",
                    peak_end_time="20:00",
                )
            )

        # Seed Pricing Rules for the location
        db.add_all(
            [
                PricingRule(
                    lot_id=lot.id,
                    rule_name="Commercial Peak Surge Policy",
                    rule_type="PEAK_HOUR",
                    multiplier=lot.current_surge_multiplier,
                    flat_surcharge_inr=0.0,
                    min_duration_hours=1.0,
                    applies_to_slot_type="ALL",
                    is_active=lot.dynamic_pricing_enabled,
                ),
                PricingRule(
                    lot_id=lot.id,
                    rule_name="50kW CCS2 Fast-Charge Tariff",
                    rule_type="EV_FAST_CHARGE",
                    multiplier=1.0,
                    flat_surcharge_inr=lot.ev_surcharge_inr,
                    min_duration_hours=0.5,
                    applies_to_slot_type="EV_CHARGING",
                    is_active=True,
                ),
                PricingRule(
                    lot_id=lot.id,
                    rule_name="SUV XL Wide-Clearance Bay Rule",
                    rule_type="SUV_OVERSIZE",
                    multiplier=1.0,
                    flat_surcharge_inr=25.0,
                    min_duration_hours=1.0,
                    applies_to_slot_type="SUV_XL",
                    is_active=True,
                ),
            ]
        )

        # Create 16 structured slots per lot across 2 floors (Zone A & Zone B)
        for idx in range(1, 17):
            floor = 1 if idx <= 8 else 2
            zone = "A" if idx % 2 == 1 else "B"
            slot_num = f"F{floor}-${zone}{idx:02d}".replace("$", "")

            if idx in (1, 2, 9):
                s_type = SlotType.EV_CHARGING
                v_cat = "EV_FOUR_WHEELER"
                power = 50.0
            elif idx in (3, 10):
                s_type = SlotType.ACCESSIBLE
                v_cat = "SEDAN"
                power = None
            elif idx in (7, 8, 15, 16):
                s_type = SlotType.SUV_XL
                v_cat = "SUV_XL"
                power = None
            else:
                s_type = SlotType.STANDARD
                v_cat = "SEDAN"
                power = None

            if idx in (4, 11):
                s_status = SlotStatus.OCCUPIED
            elif idx == 14:
                s_status = SlotStatus.MAINTENANCE
            else:
                s_status = SlotStatus.AVAILABLE

            slot = ParkingSlot(
                lot_id=lot.id,
                floor_id=floor_map[floor].id,
                zone_id=zone_map[(floor, zone)].id,
                slot_number=slot_num,
                floor=floor,
                zone=zone,
                slot_type=s_type,
                vehicle_category_code=v_cat,
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
            idempotency_key="idem_seed_pw_demo_9012",
            user_id=driver.id,
            lot_id=first_lot.id,
            slot_id=sample_slot.id,
            vehicle_number="DL-08-CAF-8921",
            vehicle_category="EV_FOUR_WHEELER",
            driver_name="Aarav Sharma",
            driver_phone="+91-9811045210",
            start_time=now - timedelta(minutes=15),
            end_time=now + timedelta(hours=2),
            reservation_expires_at=now + timedelta(minutes=15),
            duration_hours=2.0,
            base_amount_inr=200.0,
            surge_multiplier=1.25,
            additional_charges_inr=0.0,
            gst_amount_inr=36.0,
            total_amount_inr=236.0,
            status=BookingStatus.CONFIRMED,
            qr_signature=sig,
        )
        db.add(demo_booking)
        db.flush()

        db.add_all(
            [
                BookingEvent(
                    booking_id=demo_booking.id,
                    booking_reference=ref,
                    event_type="RESERVED_HOLD_CREATED",
                    previous_status=None,
                    new_status="PENDING_PAYMENT",
                    details="Initial 15-minute Redis + SQLAlchemy reservation hold created.",
                ),
                BookingEvent(
                    booking_id=demo_booking.id,
                    booking_reference=ref,
                    event_type="PAYMENT_CONFIRMED",
                    previous_status="PENDING_PAYMENT",
                    new_status="CONFIRMED",
                    details="Revalidated bay availability and captured Razorpay order order_pw_demo_9012.",
                ),
            ]
        )

        demo_payment = Payment(
            booking_id=demo_booking.id,
            razorpay_order_id="order_pw_demo_9012",
            razorpay_payment_id="pay_pw_demo_9012",
            razorpay_signature="verified_hmac_sha256_demo_signature",
            amount_inr=236.0,
            currency="INR",
            payment_method="UPI / FASTag Auto-Debit",
            upi_vpa="aarav.sharma@okicici",
            receipt_number="PW-GST-2026-9012",
            status=PaymentStatus.CAPTURED,
            is_simulated=True,
            verified_at=now - timedelta(minutes=14),
        )
        db.add(demo_payment)
        issue_signed_qr_pass(db, demo_booking, ttl_minutes=240, commit=False)

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
        details="Initialized 5 Indian metro facilities, 10 floors, 20 zones, 80 IoT bays, 15 pricing rules, and 5 vehicle categories.",
    )
    db.add(audit)
    db.commit()
