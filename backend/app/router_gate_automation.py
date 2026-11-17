"""Phase 16: FastAPI Router for ANPR, Automated Gate Controllers & Offline Operations.

Endpoints mounted under /api/v1/gate:
- POST /anpr/scan: Process live ANPR camera frame recognition
- POST /qr/verify: Process QR-code fallback scanning
- GET /lanes: List gate lane controllers & relay statuses
- POST /lanes/{lane_id}/barrier: Send direct barrier command (OPEN, CLOSE, HOLD_OPEN)
- POST /override: Gate supervisor manual barrier override with audit trail
- GET /reviews: Retrieve pending human-in-the-loop manual review queue
- POST /reviews/{review_id}/resolve: Resolve review item (approve/correct/reject)
- GET /offline/manifest: Download cryptographically signed offline authorization tokens
- POST /offline/verify-local: Simulate edge gate kiosk local HMAC validation
- POST /offline/sync: Synchronize offline event batch when connectivity is restored
- GET /events: Retrieve immutable entry/exit event history
- GET /stats: Retrieve real-time gate throughput & ANPR metrics
- POST /privacy/prune: DPDP India compliance data retention pruning
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user, require_roles
from app.models import User, UserRole, ParkingLot
from app.models_gate_automation import BarrierState, GateLaneController
from app.schemas_gate_automation import (
    ANPRReviewItem,
    ANPRReviewResolveRequest,
    ANPRReviewResolveResponse,
    ANPRScanRequest,
    ANPRScanResponse,
    GateAnalyticsSummaryResponse,
    GateBarrierControlRequest,
    GateBarrierControlResponse,
    GateEventsListResponse,
    GateLaneItem,
    GateManualOverrideRequest,
    GateManualOverrideResponse,
    GatePruneRequest,
    GatePruneResponse,
    GateQRVerifyRequest,
    LocalOfflineVerifyRequest,
    LocalOfflineVerifyResponse,
    OfflineBatchSyncRequest,
    OfflineBatchSyncResponse,
    OfflineManifestResponse,
)
from app.services.gate_access_service import (
    command_gate_barrier,
    execute_manual_gate_override,
    get_gate_analytics_summary,
    get_gate_event_history,
    get_pending_review_tasks,
    process_anpr_scan,
    process_qr_fallback,
    prune_anpr_records_retention,
    resolve_manual_review,
)
from app.services.gate_offline_service import (
    generate_facility_offline_manifest,
    reconcile_offline_events_batch,
    verify_local_offline_access,
)

gate_router = APIRouter(prefix="/gate", tags=["Phase 16 - ANPR & Gate Automation"])


# -------------------------------------------------------------
# ANPR Camera & Scan Ingestion
# -------------------------------------------------------------

@gate_router.post("/anpr/scan", response_model=ANPRScanResponse)
def submit_anpr_scan(
    request: ANPRScanRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Process incoming ANPR camera capture, recognize license plate, and actuate barrier or queue review."""
    return process_anpr_scan(
        db=db,
        request=request,
        operator_user_id=current_user.id if current_user else None,
    )


# -------------------------------------------------------------
# QR Code Fallback Scan
# -------------------------------------------------------------

@gate_router.post("/qr/verify", response_model=ANPRScanResponse)
def verify_gate_qr_fallback(
    request: GateQRVerifyRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Fallback entry/exit authorization when license plate camera is obscured or unreadable."""
    return process_qr_fallback(db=db, request=request)


# -------------------------------------------------------------
# Gate Lane Controllers & Relay Actuation
# -------------------------------------------------------------

@gate_router.get("/lanes", response_model=List[GateLaneItem])
def list_gate_lanes(
    facility_id: int = Query(1, description="Parking Facility ID"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """List all physical and virtual gate lane controllers and their relay states."""
    lanes = (
        db.query(GateLaneController)
        .filter(GateLaneController.facility_id == facility_id)
        .all()
    )
    return [
        GateLaneItem(
            id=l.id,
            facility_id=l.facility_id,
            lane_code=l.lane_code,
            lane_name=l.lane_name,
            direction=l.direction,
            ip_address=l.ip_address,
            mqtt_topic=l.mqtt_topic,
            controller_model=l.controller_model,
            barrier_state=l.barrier_state,
            hardware_health=l.hardware_health,
            last_heartbeat_at=l.last_heartbeat_at,
            auto_open_enabled=l.auto_open_enabled,
            anti_passback_enabled=l.anti_passback_enabled,
            early_entry_grace_minutes=l.early_entry_grace_minutes,
            exit_grace_minutes=l.exit_grace_minutes,
            created_at=l.created_at,
        )
        for l in lanes
    ]


@gate_router.post("/lanes/{lane_id}/barrier", response_model=GateBarrierControlResponse)
def actuate_barrier(
    lane_id: int,
    request: GateBarrierControlRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Send physical boom barrier relay command (OPEN, CLOSE, HOLD_OPEN)."""
    return command_gate_barrier(
        db=db,
        lane_id=lane_id,
        command=request.command,
        reason=request.reason,
    )


# -------------------------------------------------------------
# Manual Staff Override
# -------------------------------------------------------------

@gate_router.post("/override", response_model=GateManualOverrideResponse)
def trigger_manual_override(
    request: GateManualOverrideRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Supervisor emergency barrier override with mandatory auditable justification."""
    staff_id = current_user.id if current_user else 1
    staff_email = current_user.email if current_user else "gate_supervisor@parkwise.internal"
    return execute_manual_gate_override(
        db=db,
        request=request,
        staff_user_id=staff_id,
        staff_email=staff_email,
    )


# -------------------------------------------------------------
# Human-in-the-Loop Review Queue
# -------------------------------------------------------------

@gate_router.get("/reviews", response_model=List[ANPRReviewItem])
def list_pending_reviews(
    facility_id: int = Query(1),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Retrieve all pending manual review tasks for ambiguous or low-confidence plate reads."""
    return get_pending_review_tasks(db=db, facility_id=facility_id)


@gate_router.post("/reviews/{review_id}/resolve", response_model=ANPRReviewResolveResponse)
def resolve_review_item(
    review_id: int,
    request: ANPRReviewResolveRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Gate staff approves, corrects, or rejects an ambiguous license plate scan."""
    reviewer_id = current_user.id if current_user else 1
    return resolve_manual_review(
        db=db,
        review_id=review_id,
        request=request,
        operator_user_id=reviewer_id,
    )


# -------------------------------------------------------------
# Offline Operations: Cryptographic Manifest & Sync
# -------------------------------------------------------------

@gate_router.get("/offline/manifest", response_model=OfflineManifestResponse)
def download_offline_manifest(
    facility_id: int = Query(1),
    window_hours: int = Query(24, ge=1, le=72),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Download signed cryptographic manifest package of active and upcoming bookings for edge gate cache."""
    user_id = current_user.id if current_user else None
    return generate_facility_offline_manifest(
        db=db,
        facility_id=facility_id,
        window_hours=window_hours,
        downloaded_by_user_id=user_id,
    )


@gate_router.post("/offline/verify-local", response_model=LocalOfflineVerifyResponse)
def simulate_local_offline_verification(
    request: LocalOfflineVerifyRequest,
):
    """Simulate edge gate kiosk performing local HMAC signature validation without internet access."""
    return verify_local_offline_access(request=request)


@gate_router.post("/offline/sync", response_model=OfflineBatchSyncResponse)
def sync_offline_events_batch(
    request: OfflineBatchSyncRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Synchronize a batch of locally verified offline gate entry/exit events into the primary database."""
    return reconcile_offline_events_batch(
        db=db,
        facility_id=request.facility_id,
        events=request.events,
    )


# -------------------------------------------------------------
# Auditable Event Logs & Analytics
# -------------------------------------------------------------

@gate_router.get("/events", response_model=GateEventsListResponse)
def get_gate_events(
    facility_id: int = Query(1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Retrieve immutable chronological audit feed of gate entry/exit events."""
    return get_gate_event_history(db=db, facility_id=facility_id, limit=limit)


@gate_router.get("/stats", response_model=GateAnalyticsSummaryResponse)
def get_gate_statistics(
    facility_id: int = Query(1),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Retrieve gate operational performance KPIs: ANPR accuracy %, throughput, offline syncs."""
    return get_gate_analytics_summary(db=db, facility_id=facility_id)


# -------------------------------------------------------------
# Privacy & DPDP Retention Pruning
# -------------------------------------------------------------

@gate_router.post("/privacy/prune", response_model=GatePruneResponse)
def prune_old_gate_records(
    request: GatePruneRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """DPDP India 2023 compliance: prune historical raw plate logs older than retention period."""
    return prune_anpr_records_retention(
        db=db,
        facility_id=request.facility_id,
        retention_days=request.retention_days,
    )
