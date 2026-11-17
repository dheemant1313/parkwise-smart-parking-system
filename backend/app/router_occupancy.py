"""FastAPI Router for Phase 15: Live Parking Occupancy & Smart Sensor Integration.
Mounts under /api/v1/occupancy.
"""
from datetime import datetime, timezone
import json
import logging
from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import ParkingLot, ParkingSlot, User, UserRole
from app.models_occupancy import (
    CVReviewStatus,
    CVUncertainDetectionReview,
    DeviceHealth,
    DeviceType,
    IoTDevice,
    OccupancyEvent,
    OccupancySource,
    OccupancyState,
    OperatorSlotOverride,
    SensorSlotMapping,
)
from app.schemas_occupancy import (
    CVFrameInferRequest,
    CVFrameInferResponse,
    CVReviewResolveRequest,
    CVUncertainReviewItem,
    FacilityLiveOccupancyResponse,
    IoTDeviceCreate,
    IoTDeviceResponse,
    LiveSlotOccupancyItem,
    OccupancyEventResponse,
    OperatorSlotOverrideRequest,
    OperatorSlotOverrideResponse,
    SensorSlotMappingCreate,
    SensorSlotMappingResponse,
    SensorTelemetryIngestRequest,
    TelemetryIngestResponse,
)
from app.services.occupancy_service import (
    apply_operator_override,
    clear_operator_override,
    detect_and_flag_stale_sensors,
    get_active_operator_override,
    get_facility_live_occupancy,
    infer_camera_frame,
    ingest_sensor_telemetry,
    resolve_cv_review,
)
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/occupancy", tags=["Live Parking Occupancy & IoT Sensors"])


# 1. Live Facility Occupancy Matrix & Summary
@router.get("/facilities/{facility_id}/live", response_model=FacilityLiveOccupancyResponse)
async def get_live_facility_occupancy(
    facility_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve real-time slot occupancy matrix, status breakdown, and sensor health for a facility."""
    return get_facility_live_occupancy(db, facility_id)


# 2. Zone-level Live Occupancy
@router.get("/facilities/{facility_id}/zones/{zone_code}")
async def get_zone_live_occupancy(
    facility_id: int,
    zone_code: str,
    db: Session = Depends(get_db),
):
    """Retrieve zone-level live occupancy summary."""
    slots = (
        db.query(ParkingSlot)
        .filter(ParkingSlot.lot_id == facility_id, ParkingSlot.zone == zone_code)
        .all()
    )
    if not slots:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No slots found for zone '{zone_code}' in facility {facility_id}",
        )

    total = len(slots)
    occupied = sum(1 for s in slots if s.status.value == "OCCUPIED")
    vacant = sum(1 for s in slots if s.status.value == "AVAILABLE")
    reserved = sum(1 for s in slots if s.status.value == "RESERVED")
    blocked = sum(1 for s in slots if s.status.value == "MAINTENANCE")

    return {
        "facility_id": facility_id,
        "zone": zone_code,
        "total_slots": total,
        "vacant_slots": vacant,
        "occupied_slots": occupied,
        "reserved_slots": reserved,
        "blocked_slots": blocked,
        "occupancy_rate_pct": round(occupied / total * 100.0, 1) if total > 0 else 0.0,
    }


# 3. Single Slot Live Telemetry & History
@router.get("/slots/{slot_id}")
async def get_single_slot_telemetry(
    slot_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve detailed real-time state, assigned sensors, and recent events for a specific slot."""
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Slot ID {slot_id} not found.",
        )

    override = get_active_operator_override(db, slot.id)
    mappings = (
        db.query(SensorSlotMapping)
        .filter(SensorSlotMapping.slot_id == slot.id)
        .all()
    )

    devices = [m.device for m in mappings if m.device]
    recent_events = (
        db.query(OccupancyEvent)
        .filter(OccupancyEvent.slot_id == slot.id)
        .order_by(OccupancyEvent.timestamp.desc())
        .limit(10)
        .all()
    )

    return {
        "slot_id": slot.id,
        "slot_number": slot.slot_number,
        "floor": slot.floor,
        "zone": slot.zone,
        "slot_type": slot.slot_type.value,
        "status": slot.status.value,
        "sensor_health": slot.sensor_health,
        "active_override": (
            {
                "id": override.id,
                "target_state": override.target_state.value,
                "reason": override.reason,
                "expires_at": override.expires_at,
            }
            if override
            else None
        ),
        "assigned_devices": [
            {
                "id": d.id,
                "device_code": d.device_code,
                "device_type": d.device_type.value,
                "health_status": d.health_status.value,
                "battery_level_pct": d.battery_level_pct,
                "last_heartbeat_at": d.last_heartbeat_at,
            }
            for d in devices
        ],
        "recent_events": [
            {
                "id": e.id,
                "new_state": e.new_state.value,
                "source_type": e.source_type.value,
                "confidence": e.confidence,
                "timestamp": e.timestamp,
            }
            for e in recent_events
        ],
    }


# 4. Telemetry Ingest (Ultrasonic / Magnetic / Radar)
@router.post("/telemetry/ingest", response_model=TelemetryIngestResponse)
async def ingest_telemetry_batch(
    payload: SensorTelemetryIngestRequest,
    db: Session = Depends(get_db),
):
    """Ingest live sensor telemetry from parking bay sensors or IoT gateways."""
    resp = ingest_sensor_telemetry(db, payload)
    # Broadcast live update
    try:
        await ws_manager.broadcast_event(
            "TELEMETRY_INGESTED",
            {
                "facility_id": payload.facility_id,
                "count": resp.ingested_count,
                "updated_slots": resp.updated_slots,
            },
        )
    except Exception as ex:
        logger.warning(f"WebSocket broadcast error: {ex}")
    return resp


# 5. Computer Vision Frame Inference (Camera-based Detection)
@router.post("/cv/infer-frame", response_model=CVFrameInferResponse)
async def infer_camera_frame_endpoint(
    payload: CVFrameInferRequest,
    db: Session = Depends(get_db),
):
    """Evaluate camera frame detections against parking bay ROIs via YOLOv8 detector."""
    resp = infer_camera_frame(db, payload)
    try:
        await ws_manager.broadcast_event(
            "CV_FRAME_INFERRED",
            {
                "facility_id": payload.facility_id,
                "camera": payload.camera_device_code,
                "occupied": resp.occupied_slots,
                "vacant": resp.vacant_slots,
                "uncertain_count": resp.uncertain_reviews_queued,
            },
        )
    except Exception as ex:
        logger.warning(f"WebSocket broadcast error: {ex}")
    return resp


# 6. Uncertain CV Detection Review Queue
@router.get("/cv/review-queue", response_model=List[CVUncertainReviewItem])
async def get_cv_review_queue(
    facility_id: Optional[int] = None,
    status_filter: CVReviewStatus = CVReviewStatus.PENDING_REVIEW,
    db: Session = Depends(get_db),
):
    """Operator queue for ambiguous/uncertain computer vision detections."""
    query = db.query(CVUncertainDetectionReview).filter(
        CVUncertainDetectionReview.status == status_filter
    )
    if facility_id:
        query = query.filter(CVUncertainDetectionReview.facility_id == facility_id)

    reviews = query.order_by(CVUncertainDetectionReview.id.desc()).all()
    results: List[CVUncertainReviewItem] = []
    for r in reviews:
        slot = r.slot
        device = r.device_id and db.query(IoTDevice).filter(IoTDevice.id == r.device_id).first()
        results.append(
            CVUncertainReviewItem(
                id=r.id,
                facility_id=r.facility_id,
                slot_id=r.slot_id,
                slot_number=slot.slot_number if slot else "",
                camera_device_code=device.device_code if device else None,
                frame_timestamp=r.frame_timestamp,
                bounding_box_json=r.bounding_box_json,
                detected_class=r.detected_class,
                confidence=r.confidence,
                snapshot_url=r.snapshot_url,
                status=r.status,
                created_at=r.created_at,
            )
        )
    return results


# 7. Operator Resolve Uncertain CV Review
@router.post("/cv/review/{review_id}/resolve", response_model=CVUncertainReviewItem)
async def resolve_cv_review_endpoint(
    review_id: int,
    payload: CVReviewResolveRequest,
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Resolve an ambiguous detection by approving as OCCUPIED, approving as VACANT, or dismissing."""
    res = resolve_cv_review(db, review_id, payload, current_user.id)
    try:
        await ws_manager.broadcast_event(
            "CV_REVIEW_RESOLVED",
            {
                "review_id": review_id,
                "slot_number": res.slot_number,
                "decision": payload.decision.value,
            },
        )
    except Exception as ex:
        logger.warning(f"WebSocket broadcast error: {ex}")
    return res


# 8. Operator Manual Override on Slot
@router.post("/slots/{slot_id}/override", response_model=OperatorSlotOverrideResponse)
async def create_operator_override_endpoint(
    slot_id: int,
    payload: OperatorSlotOverrideRequest,
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Apply manual operator correction to a slot's occupancy state."""
    res = apply_operator_override(db, slot_id, payload, current_user.id)
    try:
        await ws_manager.broadcast_event(
            "OPERATOR_OVERRIDE_APPLIED",
            {
                "slot_id": slot_id,
                "slot_number": res.slot_number,
                "target_state": res.target_state.value,
                "reason": res.reason,
            },
        )
    except Exception as ex:
        logger.warning(f"WebSocket broadcast error: {ex}")
    return res


# 9. Clear Operator Manual Override
@router.delete("/slots/{slot_id}/override")
async def delete_operator_override_endpoint(
    slot_id: int,
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Clear manual operator correction on a slot and revert to automated sensor readings."""
    clear_operator_override(db, slot_id)
    try:
        await ws_manager.broadcast_event(
            "OPERATOR_OVERRIDE_CLEARED",
            {"slot_id": slot_id},
        )
    except Exception as ex:
        logger.warning(f"WebSocket broadcast error: {ex}")
    return {"message": f"Operator override cleared for slot {slot_id}. Sensor fusion restored."}


# 10. IoT Device Registry
@router.get("/devices", response_model=List[IoTDeviceResponse])
async def list_iot_devices(
    facility_id: Optional[int] = None,
    device_type: Optional[DeviceType] = None,
    health_status: Optional[DeviceHealth] = None,
    db: Session = Depends(get_db),
):
    """List registered IoT sensors, cameras, and gateways."""
    query = db.query(IoTDevice)
    if facility_id:
        query = query.filter(IoTDevice.facility_id == facility_id)
    if device_type:
        query = query.filter(IoTDevice.device_type == device_type)
    if health_status:
        query = query.filter(IoTDevice.health_status == health_status)

    return query.order_by(IoTDevice.device_code.asc()).all()


# 11. IoT Device Heartbeat Ping
@router.post("/devices/{device_id}/heartbeat")
async def device_heartbeat(
    device_id: int,
    battery_level_pct: Optional[float] = None,
    signal_rssi_dbm: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Keep-alive heartbeat ping from an IoT sensor or camera gateway."""
    device = db.query(IoTDevice).filter(IoTDevice.id == device_id).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device ID {device_id} not found.",
        )

    now = datetime.now(timezone.utc)
    device.last_heartbeat_at = now
    device.health_status = DeviceHealth.ONLINE
    if battery_level_pct is not None:
        device.battery_level_pct = battery_level_pct
    if signal_rssi_dbm is not None:
        device.signal_rssi_dbm = signal_rssi_dbm

    db.commit()
    return {
        "status": "HEARTBEAT_ACK",
        "device_code": device.device_code,
        "health_status": device.health_status.value,
        "last_heartbeat_at": device.last_heartbeat_at,
    }


# 12. Simulate Device Failure (Offline / Stale)
@router.post("/devices/{device_id}/simulate-failure")
async def simulate_device_failure(
    device_id: int,
    db: Session = Depends(get_db),
):
    """Simulate hardware sensor fault or battery death. Marks device OFFLINE and slot UNKNOWN."""
    device = db.query(IoTDevice).filter(IoTDevice.id == device_id).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device ID {device_id} not found.",
        )

    device.health_status = DeviceHealth.OFFLINE
    now = datetime.now(timezone.utc)

    # Set mapped slots sensor_health to OFFLINE
    for m in device.mappings:
        slot = m.slot
        if slot:
            slot.sensor_health = "OFFLINE"
            # Create event marking state as UNKNOWN
            event = OccupancyEvent(
                facility_id=device.facility_id,
                slot_id=slot.id,
                device_id=device.id,
                previous_state=OccupancyState(slot.status.value) if slot.status.value in OccupancyState.__members__ else OccupancyState.VACANT,
                new_state=OccupancyState.UNKNOWN,
                source_type=OccupancySource.ULTRASONIC_SENSOR,
                confidence=0.0,
                raw_payload_json=json.dumps({"error": "SIMULATED_SENSOR_FAILURE"}),
                timestamp=now,
            )
            db.add(event)

    db.commit()
    try:
        await ws_manager.broadcast_event(
            "DEVICE_FAILED",
            {"device_id": device.id, "device_code": device.device_code},
        )
    except Exception as ex:
        logger.warning(f"WebSocket broadcast error: {ex}")

    return {
        "message": f"Device {device.device_code} simulated failure. Health set to OFFLINE.",
        "device_code": device.device_code,
        "health_status": device.health_status.value,
    }


# 13. Stale Sensor Scan Trigger
@router.post("/evaluate-stale")
async def evaluate_stale_sensors_endpoint(
    facility_id: Optional[int] = None,
    threshold_seconds: int = 120,
    db: Session = Depends(get_db),
):
    """Scan and mark sensors with stale heartbeats, setting unmonitored slots to UNKNOWN."""
    count = detect_and_flag_stale_sensors(db, facility_id, threshold_seconds)
    return {
        "message": f"Stale evaluation completed. {count} slots transitioned to UNKNOWN state.",
        "flagged_slots_count": count,
    }


# 14. Occupancy Event Audit Log Stream
@router.get("/events", response_model=List[OccupancyEventResponse])
async def get_occupancy_events(
    facility_id: Optional[int] = None,
    slot_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Retrieve immutable audit stream of occupancy events."""
    query = db.query(OccupancyEvent)
    if facility_id:
        query = query.filter(OccupancyEvent.facility_id == facility_id)
    if slot_id:
        query = query.filter(OccupancyEvent.slot_id == slot_id)

    events = query.order_by(OccupancyEvent.timestamp.desc()).limit(limit).all()
    results: List[OccupancyEventResponse] = []
    for e in events:
        results.append(
            OccupancyEventResponse(
                id=e.id,
                facility_id=e.facility_id,
                slot_id=e.slot_id,
                slot_number=e.slot.slot_number if e.slot else "",
                device_id=e.device_id,
                device_code=e.device.device_code if e.device else None,
                previous_state=e.previous_state,
                new_state=e.new_state,
                source_type=e.source_type,
                confidence=e.confidence,
                license_plate=e.license_plate,
                distance_m=e.distance_m,
                timestamp=e.timestamp,
            )
        )
    return results


# 15. WebSocket Live Occupancy Telemetry Stream
@router.websocket("/ws/{facility_id}")
async def websocket_occupancy_stream(
    websocket: WebSocket,
    facility_id: int,
):
    """Real-time bi-directional WebSocket connection for streaming occupancy changes, alerts, and heartbeats."""
    await ws_manager.connect(websocket)
    try:
        # Send initial confirmation message
        await websocket.send_json(
            {
                "event": "CONNECTED",
                "data": {
                    "facility_id": facility_id,
                    "connected_at": datetime.now(timezone.utc).isoformat(),
                    "channel": f"occupancy_stream_{facility_id}",
                },
            }
        )
        while True:
            # Client can send ping/pong or filter commands
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("action") == "PING":
                    await websocket.send_json({"event": "PONG", "timestamp": datetime.now(timezone.utc).isoformat()})
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as ex:
        logger.error(f"WebSocket error: {ex}")
        ws_manager.disconnect(websocket)
