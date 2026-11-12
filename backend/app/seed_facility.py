"""Idempotent Seeder for Phase 10: Real Indian Parking Facilities, Locations, and Entrance Waypoints."""
from sqlalchemy.orm import Session
from app.models import ParkingLot
from app.models_facility import (
    FacilityAddress,
    FacilityEntrance,
    FacilityExit,
    FacilityLocation,
    FacilityMapConfiguration,
    FacilityOperatingHours,
    ParkingFacility,
)
from app.services.location_service import calculate_bounding_box, encode_geohash


def seed_phase10_facilities(db: Session) -> None:
    """Seeds rich, realistic Indian parking facilities if table is empty."""
    if db.query(ParkingFacility).count() > 0:
        return

    # Check if there are existing ParkingLot records to link to
    lots = db.query(ParkingLot).order_by(ParkingLot.id.asc()).all()
    lot_map = {lot.city.lower(): lot.id for lot in lots}

    facilities_data = [
        {
            "code": "FAC-DEL-001",
            "name": "Select CITYWALK Smart Transit Hub",
            "slug": "select-citywalk-delhi",
            "description": "Premier multi-level smart parking facility at Saket District Centre with high-speed EV charging, automated FASTag boom barriers, and real-time floor occupancy indicators.",
            "category": "MALL",
            "status": "ACTIVE",
            "total_capacity": 450,
            "available_capacity": 185,
            "lot_id": lot_map.get("new delhi") or (lots[0].id if lots else None),
            "base_hourly_rate_inr": 80.0,
            "is_24_hours": False,
            "contact_phone": "+91 11 4211 4200",
            "contact_email": "parking@selectcitywalk.com",
            "supported_vehicle_types": ["COMPACT", "SEDAN", "SUV", "EV", "TWO_WHEELER"],
            "amenities": [
                "EV_FAST_CHARGING",
                "COVERED_PARKING",
                "CCTV_24X7",
                "VALET_SERVICE",
                "RESTROOMS",
                "ACCESSIBLE_DISABLED",
                "ELEVATOR",
                "SECURITY_STAFF",
            ],
            "photos": [
                "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=1200&q=80",
            ],
            "location": {
                "latitude": 28.5283,
                "longitude": 77.2185,
                "altitude_meters": 215.0,
                "place_id": "del_saket_02",
                "plus_code": "7JWVF6H9+8C",
            },
            "address": {
                "street_line1": "A-3, District Centre, Saket",
                "street_line2": "Sector 6, Pushp Vihar",
                "locality": "Saket",
                "city": "New Delhi",
                "state": "Delhi",
                "postal_code": "110017",
                "country": "India",
                "landmark": "Opposite Saket Metro Station Gate 2",
                "formatted_address": "Select CITYWALK, A-3 District Centre, Saket, New Delhi, Delhi 110017",
            },
            "entrances": [
                {
                    "gate_name": "Gate 1 - North Ramp Entrance",
                    "gate_code": "ENT-NORTH-01",
                    "latitude": 28.5290,
                    "longitude": 77.2188,
                    "height_clearance_meters": 2.6,
                    "barrier_type": "FASTAG_RFID + ANPR",
                    "allowed_vehicle_types": ["COMPACT", "SEDAN", "SUV", "EV"],
                    "turn_restrictions": "Direct entry from Press Enclave Marg service road",
                    "navigation_waypoint_notes": "Stay in extreme left lane 50m before main mall roundabout",
                    "is_primary": True,
                    "is_open": True,
                },
                {
                    "gate_name": "Gate 2 - South Basement Ramp",
                    "gate_code": "ENT-SOUTH-02",
                    "latitude": 28.5276,
                    "longitude": 77.2178,
                    "height_clearance_meters": 2.4,
                    "barrier_type": "QR_SCANNER + ANPR",
                    "allowed_vehicle_types": ["COMPACT", "SEDAN", "TWO_WHEELER"],
                    "turn_restrictions": "No heavy commercial vehicles",
                    "navigation_waypoint_notes": "Direct basement ramp access from Mandir Marg",
                    "is_primary": False,
                    "is_open": True,
                },
            ],
            "exits": [
                {
                    "gate_name": "Gate 3 - Press Enclave Exit",
                    "gate_code": "EXT-PRESS-03",
                    "latitude": 28.5272,
                    "longitude": 77.2191,
                    "barrier_type": "AUTOMATIC_BOOM_BARRIER",
                    "merge_instructions": "Merge slowly onto main carriageway towards Saket Metro",
                    "is_open": True,
                }
            ],
            "operating_hours": [
                {"day_of_week": d, "open_time": "08:00", "close_time": "23:59", "is_24_hours": False}
                for d in range(7)
            ],
            "map_config": {
                "map_provider": "mapbox",
                "default_zoom_level": 17,
                "pitch_degrees": 50,
                "bearing_degrees": 25,
                "style_url": "mapbox://styles/mapbox/navigation-day-v1",
                "has_indoor_3d_tiles": True,
                "indoor_levels_json": ["B2", "B1", "G", "L1", "L2"],
            },
        },
        {
            "code": "FAC-GUR-002",
            "name": "DLF CyberHub Multi-Level Automated Facility",
            "slug": "dlf-cyberhub-gurugram",
            "description": "High-density smart automated parking structure serving Cyber City commercial offices and dining promenade with automated vehicle routing.",
            "category": "COMMERCIAL",
            "status": "ACTIVE",
            "total_capacity": 600,
            "available_capacity": 290,
            "lot_id": lot_map.get("gurugram") or (lots[1].id if len(lots) > 1 else None),
            "base_hourly_rate_inr": 100.0,
            "is_24_hours": True,
            "contact_phone": "+91 124 456 7890",
            "contact_email": "operations@cyberhubparking.com",
            "supported_vehicle_types": ["COMPACT", "SEDAN", "SUV", "EV", "TWO_WHEELER"],
            "amenities": [
                "EV_FAST_CHARGING",
                "COVERED_PARKING",
                "CCTV_24X7",
                "VALET_SERVICE",
                "RESTROOMS",
                "ACCESSIBLE_DISABLED",
                "ELEVATOR",
                "SECURITY_STAFF",
            ],
            "photos": [
                "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80",
                "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80",
            ],
            "location": {
                "latitude": 28.4952,
                "longitude": 77.0894,
                "altitude_meters": 222.0,
                "place_id": "gur_cyber_04",
                "plus_code": "7JWVF3WJ+QH",
            },
            "address": {
                "street_line1": "DLF Cyber City, Phase 2, Sector 24",
                "street_line2": "Building 8 & 10 Access Road",
                "locality": "DLF Phase 2",
                "city": "Gurugram",
                "state": "Haryana",
                "postal_code": "122002",
                "country": "India",
                "landmark": "Near Vodafone Belvedere Towers Rapid Metro Station",
                "formatted_address": "DLF CyberHub, Phase 2, Sector 24, Gurugram, Haryana 122002",
            },
            "entrances": [
                {
                    "gate_name": "Gate 1 - NH-48 Expressway Inbound Ramp",
                    "gate_code": "ENT-NH48-01",
                    "latitude": 28.4960,
                    "longitude": 77.0901,
                    "height_clearance_meters": 2.7,
                    "barrier_type": "FASTAG_RFID + ANPR",
                    "allowed_vehicle_types": ["COMPACT", "SEDAN", "SUV", "EV"],
                    "turn_restrictions": "Free left turn from Service Lane",
                    "navigation_waypoint_notes": "Enter directly via dedicated Cyber City underpass flyover",
                    "is_primary": True,
                    "is_open": True,
                },
                {
                    "gate_name": "Gate 2 - Cyber Loop Rapid Entry",
                    "gate_code": "ENT-LOOP-02",
                    "latitude": 28.4945,
                    "longitude": 77.0886,
                    "height_clearance_meters": 2.4,
                    "barrier_type": "FASTAG_RFID + QR_SCANNER",
                    "allowed_vehicle_types": ["COMPACT", "SEDAN", "EV", "TWO_WHEELER"],
                    "turn_restrictions": "One-way circular loop",
                    "navigation_waypoint_notes": "Follow blue overhead signage for Tower 10 parking",
                    "is_primary": False,
                    "is_open": True,
                },
            ],
            "exits": [
                {
                    "gate_name": "Gate 4 - Rapid Metro Service Exit",
                    "gate_code": "EXT-METRO-04",
                    "latitude": 28.4940,
                    "longitude": 77.0890,
                    "barrier_type": "AUTOMATIC_BOOM_BARRIER",
                    "merge_instructions": "Merge into Phase 2 inner lane; watch for pedestrians",
                    "is_open": True,
                }
            ],
            "operating_hours": [
                {"day_of_week": d, "open_time": "00:00", "close_time": "23:59", "is_24_hours": True}
                for d in range(7)
            ],
            "map_config": {
                "map_provider": "mapbox",
                "default_zoom_level": 17,
                "pitch_degrees": 45,
                "bearing_degrees": 90,
                "style_url": "mapbox://styles/mapbox/navigation-day-v1",
                "has_indoor_3d_tiles": True,
                "indoor_levels_json": ["B3", "B2", "B1", "G", "L1", "L2", "L3"],
            },
        },
        {
            "code": "FAC-DEL-003",
            "name": "Connaught Place Palika Kendra Smart Garage",
            "slug": "palika-kendra-connaught-place",
            "description": "Central Delhi flagship automated underground parking facility connecting Connaught Place Radial Roads and Rajiv Chowk Metro Hub.",
            "category": "TRANSIT",
            "status": "ACTIVE",
            "total_capacity": 350,
            "available_capacity": 120,
            "lot_id": lot_map.get("new delhi") or (lots[0].id if lots else None),
            "base_hourly_rate_inr": 60.0,
            "is_24_hours": False,
            "contact_phone": "+91 11 2334 5678",
            "contact_email": "palika.ndmc@parkwise.in",
            "supported_vehicle_types": ["COMPACT", "SEDAN", "SUV", "EV"],
            "amenities": [
                "COVERED_PARKING",
                "CCTV_24X7",
                "RESTROOMS",
                "ACCESSIBLE_DISABLED",
                "ELEVATOR",
                "SECURITY_STAFF",
            ],
            "photos": [
                "https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=1200&q=80",
            ],
            "location": {
                "latitude": 28.6315,
                "longitude": 77.2167,
                "altitude_meters": 216.0,
                "place_id": "del_cp_01",
                "plus_code": "7JWVJ6J8+HM",
            },
            "address": {
                "street_line1": "Palika Kendra, Sansad Marg",
                "street_line2": "Near Shivaji Stadium Bus Terminal",
                "locality": "Connaught Place",
                "city": "New Delhi",
                "state": "Delhi",
                "postal_code": "110001",
                "country": "India",
                "landmark": "Opposite NDMC Headquarters",
                "formatted_address": "Palika Kendra, Sansad Marg, Connaught Place, New Delhi, Delhi 110001",
            },
            "entrances": [
                {
                    "gate_name": "Gate 1 - Sansad Marg Main Entry",
                    "gate_code": "ENT-SANSAD-01",
                    "latitude": 28.6310,
                    "longitude": 77.2160,
                    "height_clearance_meters": 2.3,
                    "barrier_type": "FASTAG_RFID + ANPR",
                    "allowed_vehicle_types": ["COMPACT", "SEDAN", "SUV", "EV"],
                    "turn_restrictions": "No U-turns on Sansad Marg",
                    "navigation_waypoint_notes": "Turn left into underground ramp 80m past Shivaji Stadium turn",
                    "is_primary": True,
                    "is_open": True,
                }
            ],
            "exits": [
                {
                    "gate_name": "Gate 2 - Janpath Radial Exit",
                    "gate_code": "EXT-JANPATH-02",
                    "latitude": 28.6320,
                    "longitude": 77.2175,
                    "barrier_type": "AUTOMATIC_BOOM_BARRIER",
                    "merge_instructions": "Merge onto Outer Circle Connaught Place",
                    "is_open": True,
                }
            ],
            "operating_hours": [
                {"day_of_week": d, "open_time": "06:00", "close_time": "23:00", "is_24_hours": False}
                for d in range(7)
            ],
            "map_config": {
                "map_provider": "mapbox",
                "default_zoom_level": 17,
                "pitch_degrees": 40,
                "bearing_degrees": 0,
                "style_url": "mapbox://styles/mapbox/navigation-day-v1",
                "has_indoor_3d_tiles": True,
                "indoor_levels_json": ["B2", "B1", "G"],
            },
        },
        {
            "code": "FAC-BOM-004",
            "name": "Bandra Kurla Complex (BKC) Financial District Hub",
            "slug": "bkc-financial-hub-mumbai",
            "description": "Multi-tier commercial hub parking supporting MMRDA, Diamond Bourse, and corporate headquarters with ultra-fast DC fast chargers.",
            "category": "COMMERCIAL",
            "status": "ACTIVE",
            "total_capacity": 500,
            "available_capacity": 210,
            "lot_id": lot_map.get("mumbai") or (lots[2].id if len(lots) > 2 else None),
            "base_hourly_rate_inr": 120.0,
            "is_24_hours": True,
            "contact_phone": "+91 22 2659 0000",
            "contact_email": "parking.bkc@parkwise.in",
            "supported_vehicle_types": ["COMPACT", "SEDAN", "SUV", "EV", "TWO_WHEELER"],
            "amenities": [
                "EV_FAST_CHARGING",
                "COVERED_PARKING",
                "CCTV_24X7",
                "VALET_SERVICE",
                "RESTROOMS",
                "ACCESSIBLE_DISABLED",
                "ELEVATOR",
                "SECURITY_STAFF",
            ],
            "photos": [
                "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80",
            ],
            "location": {
                "latitude": 19.0657,
                "longitude": 72.8687,
                "altitude_meters": 12.0,
                "place_id": "mum_bkc_08",
                "plus_code": "7JFJ3V89+7F",
            },
            "address": {
                "street_line1": "G Block, Bandra Kurla Complex",
                "street_line2": "Avenue 3, Opposite MCA Club",
                "locality": "Bandra East",
                "city": "Mumbai",
                "state": "Maharashtra",
                "postal_code": "400051",
                "country": "India",
                "landmark": "Near Bharat Diamond Bourse Gate 5",
                "formatted_address": "G Block, BKC, Bandra East, Mumbai, Maharashtra 400051",
            },
            "entrances": [
                {
                    "gate_name": "Gate 1 - Bharat Diamond Bourse Entry",
                    "gate_code": "ENT-BDB-01",
                    "latitude": 19.0662,
                    "longitude": 72.8692,
                    "height_clearance_meters": 2.8,
                    "barrier_type": "FASTAG_RFID + ANPR",
                    "allowed_vehicle_types": ["COMPACT", "SEDAN", "SUV", "EV"],
                    "turn_restrictions": "Turn right into subterranean concourse",
                    "navigation_waypoint_notes": "Clear security scan checkpoint 20m before barrier",
                    "is_primary": True,
                    "is_open": True,
                }
            ],
            "exits": [
                {
                    "gate_name": "Gate 3 - WEH Connector Exit",
                    "gate_code": "EXT-WEH-03",
                    "latitude": 19.0645,
                    "longitude": 72.8690,
                    "barrier_type": "AUTOMATIC_BOOM_BARRIER",
                    "merge_instructions": "Merge onto BKC Connector towards Chunabhatti / Eastern Freeway",
                    "is_open": True,
                }
            ],
            "operating_hours": [
                {"day_of_week": d, "open_time": "00:00", "close_time": "23:59", "is_24_hours": True}
                for d in range(7)
            ],
            "map_config": {
                "map_provider": "mapbox",
                "default_zoom_level": 17,
                "pitch_degrees": 45,
                "bearing_degrees": 30,
                "style_url": "mapbox://styles/mapbox/navigation-day-v1",
                "has_indoor_3d_tiles": True,
                "indoor_levels_json": ["B3", "B2", "B1", "G", "L1"],
            },
        },
        {
            "code": "FAC-BLR-005",
            "name": "Indiranagar 100ft Road Smart Mobility Hub",
            "slug": "indiranagar-smart-mobility-blr",
            "description": "Tech-enabled automated parking facility in east Bengaluru with app-based reservation, dynamic surge stabilization, and two-wheeler designated zones.",
            "category": "MALL",
            "status": "ACTIVE",
            "total_capacity": 250,
            "available_capacity": 85,
            "lot_id": lot_map.get("bengaluru") or (lots[0].id if lots else None),
            "base_hourly_rate_inr": 70.0,
            "is_24_hours": False,
            "contact_phone": "+91 80 2525 1100",
            "contact_email": "indiranagar@parkwise.in",
            "supported_vehicle_types": ["COMPACT", "SEDAN", "SUV", "EV", "TWO_WHEELER"],
            "amenities": [
                "EV_FAST_CHARGING",
                "COVERED_PARKING",
                "CCTV_24X7",
                "RESTROOMS",
                "ACCESSIBLE_DISABLED",
                "SECURITY_STAFF",
            ],
            "photos": [
                "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80",
            ],
            "location": {
                "latitude": 12.9784,
                "longitude": 77.6408,
                "altitude_meters": 910.0,
                "place_id": "blr_indira_05",
                "plus_code": "7J4VXJHR+98",
            },
            "address": {
                "street_line1": "100 Feet Road, HAL 2nd Stage",
                "street_line2": "Near CMH Road Intersection",
                "locality": "Indiranagar",
                "city": "Bengaluru",
                "state": "Karnataka",
                "postal_code": "560038",
                "country": "India",
                "landmark": "200m from Indiranagar Metro Station",
                "formatted_address": "100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038",
            },
            "entrances": [
                {
                    "gate_name": "Gate 1 - 100ft Road Entry Ramp",
                    "gate_code": "ENT-100FT-01",
                    "latitude": 12.9790,
                    "longitude": 77.6412,
                    "height_clearance_meters": 2.4,
                    "barrier_type": "FASTAG_RFID + ANPR",
                    "allowed_vehicle_types": ["COMPACT", "SEDAN", "SUV", "EV"],
                    "turn_restrictions": "Slow left turn off main 100ft road",
                    "navigation_waypoint_notes": "Enter via designated lane 1; lane 2 reserved for two-wheelers",
                    "is_primary": True,
                    "is_open": True,
                }
            ],
            "exits": [
                {
                    "gate_name": "Gate 2 - 12th Main Road Exit",
                    "gate_code": "EXT-12MAIN-02",
                    "latitude": 12.9778,
                    "longitude": 77.6402,
                    "barrier_type": "AUTOMATIC_BOOM_BARRIER",
                    "merge_instructions": "Merge onto 12th Main Road; one-way north-bound",
                    "is_open": True,
                }
            ],
            "operating_hours": [
                {"day_of_week": d, "open_time": "07:00", "close_time": "23:30", "is_24_hours": False}
                for d in range(7)
            ],
            "map_config": {
                "map_provider": "mapbox",
                "default_zoom_level": 17,
                "pitch_degrees": 40,
                "bearing_degrees": 45,
                "style_url": "mapbox://styles/mapbox/navigation-day-v1",
                "has_indoor_3d_tiles": True,
                "indoor_levels_json": ["B2", "B1", "G", "L1"],
            },
        },
    ]

    for item in facilities_data:
        loc_data = item["location"]
        addr_data = item["address"]
        entrances_data = item["entrances"]
        exits_data = item["exits"]
        hours_data = item["operating_hours"]
        map_data = item["map_config"]

        # Compute geohash & bounding box
        geohash = encode_geohash(loc_data["latitude"], loc_data["longitude"], precision=8)
        bbox = calculate_bounding_box(loc_data["latitude"], loc_data["longitude"], radius_km=1.0)

        facility = ParkingFacility(
            code=item["code"],
            name=item["name"],
            slug=item["slug"],
            description=item["description"],
            category=item["category"],
            status=item["status"],
            total_capacity=item["total_capacity"],
            available_capacity=item["available_capacity"],
            lot_id=item["lot_id"],
            base_hourly_rate_inr=item["base_hourly_rate_inr"],
            is_24_hours=item["is_24_hours"],
            contact_phone=item["contact_phone"],
            contact_email=item["contact_email"],
            supported_vehicle_types=item["supported_vehicle_types"],
            amenities=item["amenities"],
            photos=item["photos"],
        )
        db.add(facility)
        db.flush()

        location = FacilityLocation(
            facility_id=facility.id,
            latitude=loc_data["latitude"],
            longitude=loc_data["longitude"],
            altitude_meters=loc_data["altitude_meters"],
            geohash=geohash,
            bounding_box_ne_lat=bbox["max_lat"],
            bounding_box_ne_lng=bbox["max_lng"],
            bounding_box_sw_lat=bbox["min_lat"],
            bounding_box_sw_lng=bbox["min_lng"],
            place_id=loc_data["place_id"],
            plus_code=loc_data["plus_code"],
        )
        db.add(location)

        address = FacilityAddress(
            facility_id=facility.id,
            street_line1=addr_data["street_line1"],
            street_line2=addr_data["street_line2"],
            locality=addr_data["locality"],
            city=addr_data["city"],
            state=addr_data["state"],
            postal_code=addr_data["postal_code"],
            country=addr_data["country"],
            landmark=addr_data["landmark"],
            formatted_address=addr_data["formatted_address"],
        )
        db.add(address)

        for ent in entrances_data:
            entrance = FacilityEntrance(
                facility_id=facility.id,
                gate_name=ent["gate_name"],
                gate_code=ent["gate_code"],
                latitude=ent["latitude"],
                longitude=ent["longitude"],
                height_clearance_meters=ent["height_clearance_meters"],
                barrier_type=ent["barrier_type"],
                allowed_vehicle_types=ent["allowed_vehicle_types"],
                turn_restrictions=ent["turn_restrictions"],
                navigation_waypoint_notes=ent["navigation_waypoint_notes"],
                is_primary=ent["is_primary"],
                is_open=ent["is_open"],
            )
            db.add(entrance)

        for ex in exits_data:
            exit_gate = FacilityExit(
                facility_id=facility.id,
                gate_name=ex["gate_name"],
                gate_code=ex["gate_code"],
                latitude=ex["latitude"],
                longitude=ex["longitude"],
                barrier_type=ex["barrier_type"],
                merge_instructions=ex["merge_instructions"],
                is_open=ex["is_open"],
            )
            db.add(exit_gate)

        for h in hours_data:
            op_hour = FacilityOperatingHours(
                facility_id=facility.id,
                day_of_week=h["day_of_week"],
                open_time=h["open_time"],
                close_time=h["close_time"],
                is_24_hours=h["is_24_hours"],
            )
            db.add(op_hour)

        map_config = FacilityMapConfiguration(
            facility_id=facility.id,
            map_provider=map_data["map_provider"],
            default_zoom_level=map_data["default_zoom_level"],
            pitch_degrees=map_data["pitch_degrees"],
            bearing_degrees=map_data["bearing_degrees"],
            style_url=map_data["style_url"],
            has_indoor_3d_tiles=map_data["has_indoor_3d_tiles"],
            indoor_levels_json=map_data["indoor_levels_json"],
        )
        db.add(map_config)

    db.commit()
