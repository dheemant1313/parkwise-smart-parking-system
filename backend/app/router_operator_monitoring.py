"""Phase 12: Live Operator Map & Facility Monitoring API Endpoints."""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, UserRole
from app.models_operator_monitoring import OperationalAlert
from app.schemas_operator_monitoring import (
    AlertAcknowledgeResponse,
    FacilityMonitoringDetailResponse,
    OperationalAlertItem,
    OperatorFacilityListItem,
    OperatorSlotItem,
    SlotStatusOverrideRequest,
    ZoneRestrictionUpdateRequest,
)
from app.services.operator_monitoring_service import (
    acknowledge_operational_alert,
    get_facility_monitoring_detail,
    list_operator_monitored_facilities,
    override_slot_status_from_map,
    seed_monitoring_alerts_if_needed,
    update_zone_operational_restriction,
)
from app.services.websocket_manager import ws_manager

router = APIRouter(
    prefix="/operator/monitoring",
    tags=["Phase 12 - Live Operator Map & Monitoring"],
)


@router.get(
    "/facilities",
    response_model=List[OperatorFacilityListItem],
    summary="List all authorized facilities with real-time occupancy counts for multi-facility map",
)
def get_monitored_facilities(
    city: Optional[str] = Query(None, description="Filter by Indian Metro City"),
    category: Optional[str] = Query(None, description="Filter by Facility Category"),
    facility_status: Optional[str] = Query(None, description="Filter by status (ACTIVE, FULL, MAINTENANCE)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seed_monitoring_alerts_if_needed(db)
    clean_city = city if isinstance(city, str) and city else None
    clean_category = category if isinstance(category, str) and category else None
    clean_status = facility_status if isinstance(facility_status, str) and facility_status else None

    return list_operator_monitored_facilities(
        db=db,
        user=current_user,
        city=clean_city,
        category=clean_category,
        facility_status=clean_status,
    )


@router.get(
    "/facilities/{facility_id}",
    response_model=FacilityMonitoringDetailResponse,
    summary="Get full deep live telemetry, gates, zones, slots and alerts for a single facility",
)
def get_facility_monitoring(
    facility_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seed_monitoring_alerts_if_needed(db)
    return get_facility_monitoring_detail(
        db=db,
        facility_id=facility_id,
        user=current_user,
    )


@router.post(
    "/facilities/{facility_id}/zones/{zone_code}/restriction",
    summary="Update zone operational restriction state (e.g. VIP reserve, maintenance)",
)
async def update_zone_restriction_endpoint(
    facility_id: int,
    zone_code: str,
    payload: ZoneRestrictionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = update_zone_operational_restriction(
        db=db,
        facility_id=facility_id,
        zone_code=zone_code,
        payload=payload,
        user=current_user,
    )

    # Broadcast WebSocket Event
    await ws_manager.broadcast_event(
        "ZONE_RESTRICTION_UPDATED",
        {
            "facility_id": facility_id,
            "zone_code": zone_code,
            "is_restricted": record.is_restricted,
            "restriction_reason": record.restriction_reason,
            "restricted_by": record.restricted_by,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    return {
        "status": "success",
        "facility_id": facility_id,
        "zone_code": zone_code,
        "is_restricted": record.is_restricted,
        "restriction_reason": record.restriction_reason,
        "message": f"Zone {zone_code} restriction updated to {record.is_restricted}",
    }


@router.post(
    "/facilities/{facility_id}/slots/{slot_id}/override",
    summary="Manually toggle a parking bay status from the live operator map",
)
async def override_slot_status_endpoint(
    facility_id: int,
    slot_id: int,
    payload: SlotStatusOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    slot = override_slot_status_from_map(
        db=db,
        facility_id=facility_id,
        slot_id=slot_id,
        payload=payload,
        user=current_user,
    )

    # Broadcast WebSocket Event
    await ws_manager.broadcast_event(
        "SLOT_STATUS_CHANGED",
        {
            "facility_id": facility_id,
            "slot_id": slot.id,
            "slot_number": slot.slot_number,
            "zone": slot.zone,
            "new_status": slot.status.value if hasattr(slot.status, "value") else str(slot.status),
            "updated_by": current_user.email,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    return {
        "status": "success",
        "slot_id": slot.id,
        "slot_number": slot.slot_number,
        "new_status": slot.status.value if hasattr(slot.status, "value") else str(slot.status),
        "message": f"Slot {slot.slot_number} successfully updated to {slot.status.value}",
    }


@router.get(
    "/alerts",
    response_model=List[OperationalAlertItem],
    summary="List operational alerts across facilities",
)
def get_operational_alerts(
    facility_id: Optional[int] = Query(None),
    severity: Optional[str] = Query(None),
    is_acknowledged: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.OPERATOR, UserRole.ADMIN, UserRole.GATE_STAFF):
        raise HTTPException(status_code=403, detail="Forbidden")

    seed_monitoring_alerts_if_needed(db)
    query = db.query(OperationalAlert)
    if isinstance(facility_id, int):
        query = query.filter(OperationalAlert.facility_id == facility_id)
    if isinstance(severity, str) and severity:
        query = query.filter(OperationalAlert.severity == severity.upper())
    if isinstance(is_acknowledged, bool):
        query = query.filter(OperationalAlert.is_acknowledged == is_acknowledged)

    records = query.order_by(OperationalAlert.created_at.desc()).limit(50).all()
    return [
        OperationalAlertItem(
            id=a.id,
            facility_id=a.facility_id,
            lot_id=a.lot_id,
            zone_code=a.zone_code,
            severity=a.severity,
            alert_type=a.alert_type,
            title=a.title,
            message=a.message,
            is_acknowledged=a.is_acknowledged,
            acknowledged_by=a.acknowledged_by,
            acknowledged_at=a.acknowledged_at,
            created_at=a.created_at,
        )
        for a in records
    ]


@router.post(
    "/alerts/{alert_id}/acknowledge",
    response_model=AlertAcknowledgeResponse,
    summary="Acknowledge an operational facility alert",
)
async def acknowledge_alert_endpoint(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = acknowledge_operational_alert(
        db=db,
        alert_id=alert_id,
        user=current_user,
    )

    await ws_manager.broadcast_event(
        "ALERT_ACKNOWLEDGED",
        {
            "alert_id": alert.id,
            "title": alert.title,
            "acknowledged_by": alert.acknowledged_by,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    return AlertAcknowledgeResponse(
        alert_id=alert.id,
        is_acknowledged=True,
        acknowledged_by=alert.acknowledged_by or current_user.email,
        acknowledged_at=alert.acknowledged_at or datetime.now(timezone.utc),
        message=f"Alert #{alert.id} acknowledged by {current_user.email}",
    )
