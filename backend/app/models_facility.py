"""Phase 10: Parking Facility, Location & Map Infrastructure Database Models.

Covers:
1. ParkingFacility - Main facility entity with capacity, supported vehicles, amenities, photos
2. FacilityLocation - Precise latitude, longitude, altitude, geohash, bounding box, place IDs
3. FacilityEntrance - Dedicated entrance waypoints, height clearances, barrier types, turn restrictions
4. FacilityExit - Dedicated exit waypoints, merge instructions, barrier types
5. FacilityAddress - Structured postal address, locality, landmark, formatted address
6. FacilityOperatingHours - Day-of-week schedules, opening/closing times, 24/7 flags
7. FacilityMapConfiguration - Mapbox / Google Maps styling, 3D indoor levels, zoom, pitch, bearing
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base
from app.models import utc_now


class ParkingFacility(Base):
    """Core geographical parking facility model."""
    __tablename__ = "parking_facilities"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=True, index=True)
    code = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(160), index=True, nullable=False)
    slug = Column(String(160), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(
        String(48),
        default="COMMERCIAL",
        index=True,
        nullable=False,
    )  # MALL, AIRPORT, COMMERCIAL, TRANSIT, HOSPITAL, EVENT_VENUE, HOTEL, STREET
    status = Column(
        String(32),
        default="ACTIVE",
        index=True,
        nullable=False,
    )  # ACTIVE, MAINTENANCE, FULL, CLOSED

    total_capacity = Column(Integer, default=100, nullable=False)
    available_capacity = Column(Integer, default=45, nullable=False)
    supported_vehicle_types = Column(
        JSON,
        default=lambda: ["COMPACT", "SEDAN", "SUV", "EV", "TWO_WHEELER"],
        nullable=False,
    )
    amenities = Column(
        JSON,
        default=lambda: [
            "COVERED_PARKING",
            "CCTV_24X7",
            "VALET_SERVICE",
            "EV_FAST_CHARGING",
            "RESTROOMS",
            "ACCESSIBLE_DISABLED",
            "ELEVATOR",
            "SECURITY_STAFF",
        ],
        nullable=False,
    )
    photos = Column(
        JSON,
        default=lambda: [
            "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80",
        ],
        nullable=False,
    )
    base_hourly_rate_inr = Column(Float, default=60.0, nullable=False)
    is_24_hours = Column(Boolean, default=False, nullable=False)
    contact_phone = Column(String(32), nullable=True)
    contact_email = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    location = relationship(
        "FacilityLocation",
        back_populates="facility",
        uselist=False,
        cascade="all, delete-orphan",
    )
    address = relationship(
        "FacilityAddress",
        back_populates="facility",
        uselist=False,
        cascade="all, delete-orphan",
    )
    entrances = relationship(
        "FacilityEntrance",
        back_populates="facility",
        cascade="all, delete-orphan",
        order_by="FacilityEntrance.id",
    )
    exits = relationship(
        "FacilityExit",
        back_populates="facility",
        cascade="all, delete-orphan",
        order_by="FacilityExit.id",
    )
    operating_hours = relationship(
        "FacilityOperatingHours",
        back_populates="facility",
        cascade="all, delete-orphan",
        order_by="FacilityOperatingHours.day_of_week",
    )
    map_config = relationship(
        "FacilityMapConfiguration",
        back_populates="facility",
        uselist=False,
        cascade="all, delete-orphan",
    )


class FacilityLocation(Base):
    """Precise geographical coordinates and bounding box for a facility."""
    __tablename__ = "facility_locations"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(
        Integer,
        ForeignKey("parking_facilities.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    altitude_meters = Column(Float, default=0.0, nullable=False)
    geohash = Column(String(12), index=True, nullable=True)
    bounding_box_ne_lat = Column(Float, nullable=True)
    bounding_box_ne_lng = Column(Float, nullable=True)
    bounding_box_sw_lat = Column(Float, nullable=True)
    bounding_box_sw_lng = Column(Float, nullable=True)
    place_id = Column(String(128), nullable=True)
    plus_code = Column(String(32), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    facility = relationship("ParkingFacility", back_populates="location")


class FacilityAddress(Base):
    """Structured postal address and landmark information."""
    __tablename__ = "facility_addresses"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(
        Integer,
        ForeignKey("parking_facilities.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    street_line1 = Column(String(255), nullable=False)
    street_line2 = Column(String(255), nullable=True)
    locality = Column(String(120), index=True, nullable=False)
    city = Column(String(80), index=True, nullable=False)
    state = Column(String(80), nullable=False)
    postal_code = Column(String(16), index=True, nullable=False)
    country = Column(String(48), default="India", nullable=False)
    landmark = Column(String(160), nullable=True)
    formatted_address = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    facility = relationship("ParkingFacility", back_populates="address")


class FacilityEntrance(Base):
    """Dedicated entrance gate waypoints with navigation and clearance specifications."""
    __tablename__ = "facility_entrances"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(
        Integer,
        ForeignKey("parking_facilities.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    gate_name = Column(String(120), nullable=False)  # e.g. "Gate 1 - North Ramp Entrance"
    gate_code = Column(String(32), nullable=False)  # e.g. "ENT-NORTH-01"
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    height_clearance_meters = Column(Float, default=2.4, nullable=False)
    barrier_type = Column(
        String(48),
        default="FASTAG_RFID + ANPR",
        nullable=False,
    )  # BOOM_BARRIER, FASTAG_RFID, QR_SCANNER, MANUAL
    allowed_vehicle_types = Column(
        JSON,
        default=lambda: ["COMPACT", "SEDAN", "SUV", "EV"],
        nullable=False,
    )
    turn_restrictions = Column(String(255), nullable=True)
    navigation_waypoint_notes = Column(Text, nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)
    is_open = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    facility = relationship("ParkingFacility", back_populates="entrances")


class FacilityExit(Base):
    """Dedicated exit gate waypoints and road merge instructions."""
    __tablename__ = "facility_exits"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(
        Integer,
        ForeignKey("parking_facilities.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    gate_name = Column(String(120), nullable=False)
    gate_code = Column(String(32), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    barrier_type = Column(
        String(48),
        default="AUTOMATIC_BOOM_BARRIER",
        nullable=False,
    )
    merge_instructions = Column(Text, nullable=True)
    is_open = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    facility = relationship("ParkingFacility", back_populates="exits")


class FacilityOperatingHours(Base):
    """Operating schedule for each day of the week."""
    __tablename__ = "facility_operating_hours"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(
        Integer,
        ForeignKey("parking_facilities.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    day_of_week = Column(Integer, nullable=False)  # 0 = Monday, 6 = Sunday
    open_time = Column(String(8), default="06:00", nullable=False)  # HH:MM
    close_time = Column(String(8), default="23:59", nullable=False)  # HH:MM
    is_24_hours = Column(Boolean, default=False, nullable=False)
    is_closed = Column(Boolean, default=False, nullable=False)

    facility = relationship("ParkingFacility", back_populates="operating_hours")


class FacilityMapConfiguration(Base):
    """Map display settings, vector tile configuration, and 3D indoor levels."""
    __tablename__ = "facility_map_configurations"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(
        Integer,
        ForeignKey("parking_facilities.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    map_provider = Column(String(32), default="mapbox", nullable=False)  # mapbox, google_maps, osm
    default_zoom_level = Column(Integer, default=17, nullable=False)
    pitch_degrees = Column(Integer, default=45, nullable=False)
    bearing_degrees = Column(Integer, default=0, nullable=False)
    style_url = Column(
        String(255),
        default="mapbox://styles/mapbox/navigation-day-v1",
        nullable=False,
    )
    has_indoor_3d_tiles = Column(Boolean, default=True, nullable=False)
    indoor_levels_json = Column(
        JSON,
        default=lambda: ["B2", "B1", "G", "L1", "L2"],
        nullable=False,
    )
    custom_marker_svg = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    facility = relationship("ParkingFacility", back_populates="map_config")
