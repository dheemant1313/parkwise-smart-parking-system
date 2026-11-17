"""Phase 19: SQLAlchemy Models for Driver Convenience, Valet Parking, Venue Integration & Assistance.

Entities:
1. SavedVehicleLocation: Driver's saved parking spot with floor, zone, slot, pillar, photo & notes.
2. ValetBooking: Valet parking service with vehicle handover, storage custody, secure OTP return, and inspection logs.
3. VenueDestination: Mall/venue directories (stores, cinemas, dining) with multi-floor pedestrian waypoints.
4. AssistanceRequest: Driver help tickets (blocked bay, equipment failure, emergency SOS) with staff dispatch & resolution audit.
"""

from datetime import datetime
import enum
from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import relationship

from app.database import Base


class ValetStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    ACCEPTED_BY_VALET = "ACCEPTED_BY_VALET"
    PARKED_IN_STORAGE = "PARKED_IN_STORAGE"
    RETRIEVAL_REQUESTED = "RETRIEVAL_REQUESTED"
    RETURNED_TO_DRIVER = "RETURNED_TO_DRIVER"
    CANCELLED = "CANCELLED"


class VenueCategory(str, enum.Enum):
    SHOPPING = "SHOPPING"
    DINING = "DINING"
    CINEMA = "CINEMA"
    SERVICES = "SERVICES"
    OFFICES = "OFFICES"
    EVENTS = "EVENTS"


class AssistanceCategory(str, enum.Enum):
    BLOCKED_SLOT = "BLOCKED_SLOT"
    DAMAGED_EQUIPMENT = "DAMAGED_EQUIPMENT"
    NAVIGATION_ISSUE = "NAVIGATION_ISSUE"
    PAYMENT_DISPUTE = "PAYMENT_DISPUTE"
    EMERGENCY_SOS = "EMERGENCY_SOS"
    OTHER = "OTHER"


class AssistanceUrgency(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL_SOS = "CRITICAL_SOS"


class AssistanceStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    STAFF_DISPATCHED = "STAFF_DISPATCHED"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class SavedVehicleLocation(Base):
    """Stores driver's parked vehicle location for pedestrian navigation back to vehicle."""
    __tablename__ = "saved_vehicle_locations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False)
    floor = Column(String(50), nullable=False)  # e.g. "B2"
    zone = Column(String(50), nullable=False)   # e.g. "Zone Green"
    slot_number = Column(String(50), nullable=False)  # e.g. "B2-142"
    pillar_reference = Column(String(100), nullable=True)  # e.g. "Pillar 4B"
    photo_url = Column(String(500), nullable=True)
    driver_notes = Column(Text, nullable=True)
    saved_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    retention_expires_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    facility = relationship("ParkingLot", foreign_keys=[facility_id])


class ValetBooking(Base):
    """End-to-end valet parking workflow with custody logs and secure return OTP."""
    __tablename__ = "valet_bookings"

    id = Column(Integer, primary_key=True, index=True)
    valet_ticket_number = Column(String(64), unique=True, index=True, nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False)
    driver_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_name = Column(String(100), nullable=False)
    driver_phone = Column(String(32), nullable=False)
    vehicle_plate = Column(String(32), nullable=False, index=True)
    vehicle_model = Column(String(100), nullable=False)
    status = Column(Enum(ValetStatus), default=ValetStatus.REQUESTED, nullable=False, index=True)
    
    assigned_attendant_name = Column(String(100), nullable=True)
    assigned_storage_slot = Column(String(64), nullable=True)  # e.g. "Valet Vault V-09"
    handover_otp = Column(String(8), nullable=False)  # 6-digit secure PIN for return
    
    handover_time = Column(DateTime, nullable=True)
    parked_time = Column(DateTime, nullable=True)
    retrieval_requested_time = Column(DateTime, nullable=True)
    returned_time = Column(DateTime, nullable=True)
    
    pre_inspection_notes = Column(Text, nullable=True)
    incident_reported = Column(Boolean, default=False)
    incident_description = Column(Text, nullable=True)
    custody_logs = Column(JSON, default=list)  # array of timestamped custody events

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    facility = relationship("ParkingLot", foreign_keys=[facility_id])
    driver = relationship("User", foreign_keys=[driver_user_id])


class VenueDestination(Base):
    """Mall, venue, or commercial destination linked to parking facility for pedestrian routing."""
    __tablename__ = "venue_destinations"

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False)
    name = Column(String(150), nullable=False, index=True)
    category = Column(Enum(VenueCategory), default=VenueCategory.SHOPPING, nullable=False, index=True)
    floor = Column(String(50), nullable=False)  # e.g. "Level 3"
    unit_number = Column(String(50), nullable=False)  # e.g. "Unit 301"
    opening_hours = Column(String(100), default="10:00 AM - 11:00 PM")
    nearest_parking_zone = Column(String(100), nullable=False)
    nearest_elevator_bank = Column(String(100), default="Elevator Bank B")
    description = Column(Text, nullable=True)
    logo_icon = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    facility = relationship("ParkingLot", foreign_keys=[facility_id])


class AssistanceRequest(Base):
    """Help & support incident tickets submitted by drivers with staff dispatch and audit log."""
    __tablename__ = "assistance_requests"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(64), unique=True, index=True, nullable=False)
    facility_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_name = Column(String(100), nullable=False)
    driver_phone = Column(String(32), nullable=False)
    vehicle_plate = Column(String(32), nullable=True)
    slot_number = Column(String(50), nullable=True)
    
    category = Column(Enum(AssistanceCategory), default=AssistanceCategory.OTHER, nullable=False)
    urgency = Column(Enum(AssistanceUrgency), default=AssistanceUrgency.MEDIUM, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(Enum(AssistanceStatus), default=AssistanceStatus.SUBMITTED, nullable=False, index=True)
    
    assigned_staff_name = Column(String(100), nullable=True)
    staff_resolution_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    status_history = Column(JSON, default=list)  # array of transitions

    # Relationships
    facility = relationship("ParkingLot", foreign_keys=[facility_id])
    user = relationship("User", foreign_keys=[user_id])
