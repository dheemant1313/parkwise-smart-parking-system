"""Phase 12: Automated Integration Test Suite for Live Operator Map & Facility Monitoring.

Direct in-memory route executions avoiding Windows loopback socket deadlocks.
Validates:
1. RBAC Security & Authorization (Drivers blocked with 403, Operators/Admins permitted)
2. Multi-Facility Monitoring Overview (Real occupancy counts, city filtering, peak indicators)
3. Granular Facility Monitoring Detail (Gates, zones, slots, live analytics, occupancy velocity)
4. Zone Operational Restriction Toggle & Audit Logging
5. Live Slot Status Map Override & Audit Trail
6. Operational Alerts Feed & Acknowledgment Workflow
7. Real-Time Telemetry & WebSocket Manager Event Broadcasting
"""
from datetime import datetime, timezone
from typing import Any, Coroutine, List
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import AuditLog, ParkingLot, ParkingSlot, SlotStatus, User, UserRole
from app.models_facility import ParkingFacility
from app.models_operator_monitoring import OperationalAlert, ZoneOperationalState
from app.router_operator_monitoring import (
    acknowledge_alert_endpoint,
    get_facility_monitoring,
    get_monitored_facilities,
    get_operational_alerts,
    override_slot_status_endpoint,
    update_zone_restriction_endpoint,
)
from app.schemas_operator_monitoring import (
    SlotStatusOverrideRequest,
    ZoneRestrictionUpdateRequest,
)
from app.seed import seed_initial_data
from app.seed_facility import seed_phase10_facilities
from app.services.operator_monitoring_service import (
    acknowledge_operational_alert,
    get_facility_monitoring_detail,
    list_operator_monitored_facilities,
    override_slot_status_from_map,
    seed_monitoring_alerts_if_needed,
    update_zone_operational_restriction,
)
from app.services.websocket_manager import ws_manager


def _run_sync(coro: Coroutine[Any, Any, Any]) -> Any:
    """Execute a pure coroutine in synchronous test runner."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    finally:
        coro.close()


@pytest.fixture(scope="module")
def db():
    """Module-level session with initial seeded facilities and alert infrastructure."""
    Base.metadata.create_all(bind=engine)
    session: Session = SessionLocal()
    seed_initial_data(session)
    seed_phase10_facilities(session)
    seed_monitoring_alerts_if_needed(session)
    try:
        yield session
    finally:
        session.close()


def test_operator_monitoring_rbac_isolation(db: Session):
    """Test 1: Verify strict RBAC isolation. Drivers must be forbidden with 403."""
    driver_user = db.query(User).filter(User.role == UserRole.DRIVER).first()
    operator_user = db.query(User).filter(User.role == UserRole.OPERATOR).first()
    admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()

    assert driver_user is not None
    assert operator_user is not None
    assert admin_user is not None

    # 1. Driver calling service directly raises 403
    with pytest.raises(HTTPException) as exc_info:
        list_operator_monitored_facilities(db=db, user=driver_user)
    assert exc_info.value.status_code == 403
    assert "Access denied" in exc_info.value.detail

    # 2. Driver calling router endpoint directly raises 403
    with pytest.raises(HTTPException) as exc_info2:
        get_monitored_facilities(db=db, current_user=driver_user)
    assert exc_info2.value.status_code == 403

    # 3. Operator calling router endpoint succeeds
    op_facs = get_monitored_facilities(db=db, current_user=operator_user)
    assert len(op_facs) >= 5

    # 4. Admin calling router endpoint succeeds
    admin_facs = get_monitored_facilities(db=db, current_user=admin_user)
    assert len(admin_facs) >= 5


def test_multi_facility_monitoring_overview(db: Session):
    """Test 2: Verify multi-facility monitoring returns aggregated live occupancy and filters."""
    admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
    facilities = get_monitored_facilities(db=db, current_user=admin_user)

    assert len(facilities) >= 5
    for f in facilities:
        assert f.facility_id > 0
        assert f.latitude != 0.0
        assert f.longitude != 0.0
        assert f.occupancy.total_spaces > 0
        assert (
            f.occupancy.available_spaces
            + f.occupancy.occupied_spaces
            + f.occupancy.reserved_spaces
            + f.occupancy.blocked_spaces
        ) == f.occupancy.total_spaces
        assert 0.0 <= f.occupancy.occupancy_percentage <= 100.0
        assert f.occupancy.peak_indicator in ("LOW", "NORMAL", "HIGH", "CRITICAL_PEAK")

    # City filter check
    delhi_facs = get_monitored_facilities(city="New Delhi", db=db, current_user=admin_user)
    assert len(delhi_facs) >= 1
    assert all(f.city == "New Delhi" for f in delhi_facs)


def test_granular_facility_monitoring_detail(db: Session):
    """Test 3: Verify granular monitoring detail includes gates, zones, slots, and analytics."""
    admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
    first_fac = db.query(ParkingFacility).first()
    assert first_fac is not None

    detail = get_facility_monitoring(facility_id=first_fac.id, db=db, current_user=admin_user)

    assert detail.facility_id == first_fac.id
    assert detail.code == first_fac.code
    assert detail.occupancy.total_spaces > 0

    # Gates verification
    assert len(detail.gates) >= 2  # Entrance + Exit
    entrance_gates = [g for g in detail.gates if g.gate_type == "ENTRANCE"]
    exit_gates = [g for g in detail.gates if g.gate_type == "EXIT"]
    assert len(entrance_gates) >= 1
    assert len(exit_gates) >= 1
    assert entrance_gates[0].barrier_type is not None

    # Zones verification
    assert len(detail.zones) >= 1
    for z in detail.zones:
        assert z.zone_code is not None
        assert z.total_bays >= 0
        assert 0.0 <= z.utilization_pct <= 100.0
        assert z.operational_status in ("OPTIMAL", "HEAVY_LOAD", "NEAR_CAPACITY", "RESTRICTED")
        assert len(z.slots) == z.total_bays

    # Live Analytics summary verification
    assert detail.booking_volume_today >= 0
    assert detail.estimated_revenue_today_inr >= 0.0
    assert detail.current_surge_multiplier >= 1.0
    assert detail.telemetry_source is not None


def test_zone_operational_restriction_toggle_and_audit(db: Session):
    """Test 4: Verify zone restriction toggle updates state and writes an audit log."""
    admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
    first_fac = db.query(ParkingFacility).first()
    assert first_fac is not None

    # 1. Restrict Zone A for VIP Event via endpoint
    restr_payload = ZoneRestrictionUpdateRequest(
        is_restricted=True,
        restriction_reason="VIP_RESERVE",
        notes="Reserved for Chief Minister convoy delegation",
    )
    result = _run_sync(
        update_zone_restriction_endpoint(
            facility_id=first_fac.id,
            zone_code="A",
            payload=restr_payload,
            db=db,
            current_user=admin_user,
        )
    )
    assert result["is_restricted"] is True
    assert result["restriction_reason"] == "VIP_RESERVE"

    # Verify detail response reflects restricted state
    detail = get_facility_monitoring(facility_id=first_fac.id, db=db, current_user=admin_user)
    zone_a = next((z for z in detail.zones if z.zone_code == "A"), None)
    if zone_a:
        assert zone_a.is_restricted is True
        assert zone_a.operational_status == "RESTRICTED"

    # Verify audit log entry
    audit = (
        db.query(AuditLog)
        .filter(AuditLog.action == "ZONE_RESTRICTION_UPDATED")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert audit is not None
    assert "VIP_RESERVE" in audit.details

    # 2. Lift restriction
    lift_payload = ZoneRestrictionUpdateRequest(
        is_restricted=False,
        restriction_reason="NONE",
        notes="Convoy departed, restored to public inventory",
    )
    result2 = _run_sync(
        update_zone_restriction_endpoint(
            facility_id=first_fac.id,
            zone_code="A",
            payload=lift_payload,
            db=db,
            current_user=admin_user,
        )
    )
    assert result2["is_restricted"] is False


def test_live_slot_status_map_override_and_audit(db: Session):
    """Test 5: Verify operator can manually override a bay status from the live map."""
    admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
    first_fac = db.query(ParkingFacility).first()
    lot = db.query(ParkingLot).filter(ParkingLot.id == first_fac.lot_id).first()
    target_slot = lot.slots[0]
    original_status = target_slot.status.value

    # Override to MAINTENANCE
    override_payload = SlotStatusOverrideRequest(
        status="MAINTENANCE",
        reason="Hydraulic oil leak cleanup",
    )
    result = _run_sync(
        override_slot_status_endpoint(
            facility_id=first_fac.id,
            slot_id=target_slot.id,
            payload=override_payload,
            db=db,
            current_user=admin_user,
        )
    )
    assert result["new_status"] == "MAINTENANCE"

    # Verify slot entity updated in DB
    refreshed_slot = db.query(ParkingSlot).filter(ParkingSlot.id == target_slot.id).first()
    assert refreshed_slot.status == SlotStatus.MAINTENANCE

    # Verify audit log
    audit = (
        db.query(AuditLog)
        .filter(AuditLog.action == "SLOT_STATUS_MAP_OVERRIDE")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert audit is not None
    assert f"Slot {target_slot.slot_number}" in audit.details

    # Restore to original status
    restore_payload = SlotStatusOverrideRequest(status=original_status, reason="Cleanup complete")
    _run_sync(
        override_slot_status_endpoint(
            facility_id=first_fac.id,
            slot_id=target_slot.id,
            payload=restore_payload,
            db=db,
            current_user=admin_user,
        )
    )


def test_operational_alerts_feed_and_acknowledgment(db: Session):
    """Test 6: Verify operational alerts query and acknowledgment flow."""
    admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
    alerts = get_operational_alerts(db=db, current_user=admin_user)
    assert len(alerts) >= 1

    target_alert = next((a for a in alerts if not a.is_acknowledged), alerts[0])

    ack_res = _run_sync(
        acknowledge_alert_endpoint(
            alert_id=target_alert.id,
            db=db,
            current_user=admin_user,
        )
    )
    assert ack_res.is_acknowledged is True
    assert ack_res.acknowledged_by == admin_user.email

    # Verify audit log for alert acknowledgment
    audit = (
        db.query(AuditLog)
        .filter(AuditLog.action == "OPERATIONAL_ALERT_ACKNOWLEDGED")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert audit is not None
    assert str(target_alert.id) in audit.target_resource


def test_real_time_websocket_telemetry_flow():
    """Test 7: Verify WebSocket connection manager event broadcasting and connection lifecycle."""
    class MockWebSocket:
        def __init__(self):
            self.accepted = False
            self.sent_messages: List[dict] = []

        async def accept(self):
            self.accepted = True

        async def send_json(self, msg: dict):
            self.sent_messages.append(msg)

    mock_ws = MockWebSocket()

    # 1. Connect
    _run_sync(ws_manager.connect(mock_ws))
    assert mock_ws.accepted is True
    assert mock_ws in ws_manager.active_connections

    # 2. Broadcast event
    _run_sync(
        ws_manager.broadcast_event(
            "FACILITY_OCCUPANCY_CHANGED",
            {"facility_id": 1, "occupied": 12, "available": 88},
        )
    )
    assert len(mock_ws.sent_messages) == 1
    assert mock_ws.sent_messages[0]["event"] == "FACILITY_OCCUPANCY_CHANGED"
    assert mock_ws.sent_messages[0]["data"]["facility_id"] == 1

    # 3. Disconnect
    ws_manager.disconnect(mock_ws)
    assert mock_ws not in ws_manager.active_connections
