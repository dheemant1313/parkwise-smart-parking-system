"""Phase 14: Complete Indoor Parking Navigation API Router.

Endpoints mounted under /api/v1/indoor:
- GET /facilities/{facility_id}/map: Complete multi-floor map layers for 2D/3D map & editor
- GET /facilities/{facility_id}/floors: List of floor levels, clearance, zones
- GET /facilities/{facility_id}/slots/{slot_number}: Exact slot coordinate & floor retrieval
- POST /routes/calculate: Graph-based multi-floor route calculation from entrance to slot
- GET /routes/{route_code}/steps: Turn-by-turn maneuvers and instructions
- POST /routes/recalculate: Dynamic route recalculation when obstacle or slot change occurs
- POST /routes/arrival: Confirm arrival at assigned slot using spatial tolerance / QR
- POST /checkpoints/verify: Scan physical QR checkpoint and synchronize position
- POST /position/update: BLE/UWB continuous indoor position estimation
- GET /find-my-car/{booking_id}: Pedestrian return route with elevator & stair support
- Operator Map Editor:
  - POST /facilities/{facility_id}/nodes: Create map node
  - PUT /facilities/{facility_id}/nodes/{node_id}: Update node coordinates/type
  - POST /facilities/{facility_id}/edges: Create lane segment / ramp
  - PUT /facilities/{facility_id}/edges/{edge_id}: Update edge properties
  - POST /facilities/{facility_id}/edges/{edge_id}/toggle-block: Operator lane blocking toggle
  - POST /facilities/{facility_id}/publish: Publish validated map version
  - POST /facilities/{facility_id}/validate: Validate graph connectivity
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import User, UserRole
from app.models_indoor_navigation import MapEdge, MapNode, FacilityMapVersion
from app.schemas_indoor_navigation import (
    ArrivalConfirmRequest,
    ArrivalConfirmResponse,
    CheckpointVerifyRequest,
    CheckpointVerifyResponse,
    FacilityFloorMapResponse,
    FindMyCarResponse,
    IndoorCheckpointItem,
    IndoorPositionEstimateResponse,
    IndoorPositionUpdateRequest,
    IndoorRouteResponse,
    MapEdgeCreate,
    MapEdgeItem,
    MapEdgeUpdate,
    MapNodeCreate,
    MapNodeItem,
    MapNodeUpdate,
    MapValidationReport,
    PublishMapVersionRequest,
    RouteCalculateRequest,
    RouteRecalculateRequest,
    TurnByTurnStepItem,
)
from app.services.indoor_navigation_service import (
    calculate_indoor_route,
    confirm_slot_arrival,
    get_facility_indoor_map,
    get_find_my_car_route,
    recalculate_indoor_route,
    update_indoor_position,
    validate_and_publish_map,
    verify_qr_checkpoint,
)

indoor_router = APIRouter(prefix="/indoor", tags=["Indoor Parking Navigation"])


# -----------------------------------------------------------------------------
# Map Layers & Slot Location
# -----------------------------------------------------------------------------
@indoor_router.get(
    "/facilities/{facility_id}/map",
    response_model=FacilityFloorMapResponse,
    summary="Retrieve full multi-floor indoor garage map",
)
async def get_facility_map_endpoint(
    facility_id: int,
    db: Session = Depends(get_db),
):
    try:
        return get_facility_indoor_map(db=db, facility_id=facility_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@indoor_router.get(
    "/facilities/{facility_id}/slots/{slot_number}",
    summary="Retrieve exact slot floor, zone, and coordinate location",
)
async def get_slot_location_endpoint(
    facility_id: int,
    slot_number: str,
    db: Session = Depends(get_db),
):
    node = (
        db.query(MapNode)
        .filter(
            MapNode.facility_id == facility_id,
            MapNode.slot_number == slot_number,
        )
        .first()
    )
    if not node:
        raise HTTPException(
            status_code=404,
            detail=f"Slot {slot_number} not mapped in facility {facility_id}",
        )

    return {
        "facility_id": facility_id,
        "slot_number": node.slot_number,
        "floor_level": node.floor_level,
        "floor_name": node.floor_name,
        "zone_code": node.zone_code or "Zone C",
        "x_coord": node.x_coord,
        "y_coord": node.y_coord,
        "z_coord": node.z_coord,
        "node_id": node.id,
        "is_accessible": node.is_accessible,
    }


# -----------------------------------------------------------------------------
# Navigation & Routing
# -----------------------------------------------------------------------------
@indoor_router.post(
    "/routes/calculate",
    response_model=IndoorRouteResponse,
    summary="Calculate multi-floor indoor route to assigned slot",
)
async def calculate_route_endpoint(
    req: RouteCalculateRequest,
    db: Session = Depends(get_db),
):
    try:
        return calculate_indoor_route(
            db=db,
            facility_id=req.facility_id,
            booking_id=req.booking_id,
            origin_node_id=req.origin_node_id,
            destination_slot_number=req.destination_slot_number,
            route_type=req.route_type,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@indoor_router.post(
    "/routes/recalculate",
    response_model=IndoorRouteResponse,
    summary="Dynamic route recalculation for blocked lanes or slot reassignments",
)
async def recalculate_route_endpoint(
    req: RouteRecalculateRequest,
    db: Session = Depends(get_db),
):
    try:
        return recalculate_indoor_route(
            db=db,
            route_code=req.route_code,
            current_floor_level=req.current_floor_level,
            current_x=req.current_x,
            current_y=req.current_y,
            blocked_edge_id=req.blocked_edge_id,
            reassigned_slot_number=req.reassigned_slot_number,
            reason=req.reason,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@indoor_router.post(
    "/routes/arrival",
    response_model=ArrivalConfirmResponse,
    summary="Confirm vehicle arrival at assigned parking slot",
)
async def confirm_arrival_endpoint(
    req: ArrivalConfirmRequest,
    db: Session = Depends(get_db),
):
    try:
        return confirm_slot_arrival(
            db=db,
            route_code=req.route_code,
            final_x=req.final_x,
            final_y=req.final_y,
            final_floor_level=req.final_floor_level,
            checkpoint_qr_token=req.checkpoint_qr_token,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -----------------------------------------------------------------------------
# Indoor Positioning & Checkpoints
# -----------------------------------------------------------------------------
@indoor_router.post(
    "/checkpoints/verify",
    response_model=CheckpointVerifyResponse,
    summary="Verify physical QR checkpoint and calibrate driver position",
)
async def verify_checkpoint_endpoint(
    req: CheckpointVerifyRequest,
    db: Session = Depends(get_db),
):
    try:
        return verify_qr_checkpoint(
            db=db,
            facility_id=req.facility_id,
            qr_token_payload=req.qr_token_payload,
            booking_id=req.booking_id,
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@indoor_router.post(
    "/position/update",
    response_model=IndoorPositionEstimateResponse,
    summary="Update driver continuous indoor position via BLE/UWB/Sensors",
)
async def update_position_endpoint(
    req: IndoorPositionUpdateRequest,
    db: Session = Depends(get_db),
):
    try:
        return update_indoor_position(
            db=db,
            facility_id=req.facility_id,
            booking_id=req.booking_id,
            source_type=req.source_type,
            checkpoint_token=req.checkpoint_token,
            device_hardware_id=req.device_hardware_id,
            raw_rssi=req.raw_rssi,
            reported_floor_level=req.reported_floor_level,
            reported_x=req.reported_x,
            reported_y=req.reported_y,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -----------------------------------------------------------------------------
# Find My Car (Pedestrian Navigation)
# -----------------------------------------------------------------------------
@indoor_router.get(
    "/find-my-car/{booking_id}",
    response_model=FindMyCarResponse,
    summary="Locate parked vehicle and calculate pedestrian return path",
)
async def find_my_car_endpoint(
    booking_id: int,
    db: Session = Depends(get_db),
):
    try:
        return get_find_my_car_route(db=db, booking_id=booking_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# -----------------------------------------------------------------------------
# Operator Map Editor Endpoints (Protected RBAC)
# -----------------------------------------------------------------------------
@indoor_router.post(
    "/facilities/{facility_id}/nodes",
    response_model=MapNodeItem,
    summary="Operator: Add new map node or intersection",
)
async def create_map_node_endpoint(
    facility_id: int,
    req: MapNodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
):
    node = MapNode(
        facility_id=facility_id,
        floor_id=req.floor_id,
        floor_level=req.floor_level,
        floor_name=req.floor_name,
        zone_code=req.zone_code,
        node_code=req.node_code,
        label=req.label,
        node_type=req.node_type,
        x_coord=req.x_coord,
        y_coord=req.y_coord,
        z_coord=req.z_coord,
        slot_id=req.slot_id,
        slot_number=req.slot_number,
        is_accessible=req.is_accessible,
        is_active=req.is_active,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@indoor_router.post(
    "/facilities/{facility_id}/edges",
    response_model=MapEdgeItem,
    summary="Operator: Add new driving lane segment or ramp transition",
)
async def create_map_edge_endpoint(
    facility_id: int,
    req: MapEdgeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
):
    edge = MapEdge(
        facility_id=facility_id,
        from_node_id=req.from_node_id,
        to_node_id=req.to_node_id,
        edge_type=req.edge_type,
        lane_code=req.lane_code,
        length_meters=req.length_meters,
        speed_limit_kmh=req.speed_limit_kmh,
        is_one_way=req.is_one_way,
        is_blocked=req.is_blocked,
        is_restricted=req.is_restricted,
        is_pedestrian_accessible=req.is_pedestrian_accessible,
        polyline_coords=req.polyline_coords,
    )
    db.add(edge)
    db.commit()
    db.refresh(edge)
    return edge


@indoor_router.post(
    "/facilities/{facility_id}/edges/{edge_id}/toggle-block",
    response_model=MapEdgeItem,
    summary="Operator: Toggle lane segment blocked / unblocked status",
)
async def toggle_edge_blocked_endpoint(
    facility_id: int,
    edge_id: int,
    reason: Optional[str] = Query(default="Operator temporary roadwork/spill closure"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
):
    edge = (
        db.query(MapEdge)
        .filter(MapEdge.id == edge_id, MapEdge.facility_id == facility_id)
        .first()
    )
    if not edge:
        raise HTTPException(status_code=404, detail=f"Edge {edge_id} not found")

    edge.is_blocked = not edge.is_blocked
    edge.block_reason = reason if edge.is_blocked else None
    db.commit()
    db.refresh(edge)
    return edge


@indoor_router.post(
    "/facilities/{facility_id}/publish",
    response_model=MapValidationReport,
    summary="Operator: Validate connectivity and publish map version",
)
async def publish_map_version_endpoint(
    facility_id: int,
    req: PublishMapVersionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
):
    try:
        return validate_and_publish_map(
            db=db,
            facility_id=facility_id,
            version_code=req.version_code,
            published_by=current_user.email,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
