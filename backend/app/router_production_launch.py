"""Phase 21: FastAPI Router for Security, Reliability, Production Launch & Quality Assurance."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import AuditLog, User, UserRole
from app.schemas_phase21 import (
    AuditLogResponse,
    ConcurrencyVerificationRequest,
    ConcurrencyVerificationResponse,
    IndoorMapValidationResponse,
    LaunchScorecardResponse,
    PrivacyErasureRequest,
    PrivacyErasureResponse,
    SystemTelemetryResponse,
)
from app.services import production_launch_service

launch_router = APIRouter(tags=["Production Launch, Security & Telemetry"])


# ============================================================================
# 1. PROMETHEUS METRICS & SYSTEM TELEMETRY
# ============================================================================

@launch_router.get("/metrics")
@launch_router.get("/api/v1/metrics")
def get_prometheus_metrics(
    request: Request,
    db: Session = Depends(get_db),
):
    """Exposes Prometheus-compatible metrics for Grafana / Datadog scraping."""
    accept = request.headers.get("accept", "")
    if "application/json" in accept and not request.url.path.endswith("/metrics"):
        # Return JSON metrics if explicitly requested via API
        telemetry = production_launch_service.get_system_telemetry(db)
        return {
            "uptime_seconds": telemetry.service_uptime_seconds,
            "p95_latency_ms": telemetry.p95_latency_ms,
            "database_pool": telemetry.database_pool_status,
            "concurrency_locks": telemetry.concurrency_lock_engine,
            "anpr_stream_health": telemetry.anpr_stream_health,
        }
    metrics_text = production_launch_service.generate_prometheus_metrics(db)
    return Response(content=metrics_text, media_type="text/plain; version=0.0.4; charset=utf-8")


@launch_router.get("/api/v1/launch/scorecard", response_model=LaunchScorecardResponse)
def get_scorecard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    """Returns the verified production launch readiness scorecard covering all 8 launch criteria."""
    return production_launch_service.get_launch_scorecard(db)


@launch_router.get("/api/v1/launch/telemetry", response_model=SystemTelemetryResponse)
def get_telemetry(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    """Returns real-time health telemetry across database, caches, ANPR, and gate IPCs."""
    return production_launch_service.get_system_telemetry(db)


# ============================================================================
# 2. CONCURRENCY & DOUBLE-BOOKING MUTEX VERIFICATION
# ============================================================================

@launch_router.post("/api/v1/launch/verify-concurrency", response_model=ConcurrencyVerificationResponse)
def verify_concurrency(
    data: Optional[ConcurrencyVerificationRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    """Executes live concurrent booking attempts against the same slot to verify race condition immunity."""
    slot_id = data.slot_id if data else None
    return production_launch_service.execute_concurrency_verification(db, slot_id)


# ============================================================================
# 3. DPDP ACT 2023 RIGHT TO ERASURE HANDLER
# ============================================================================

@launch_router.post("/api/v1/privacy/erasure-request", response_model=PrivacyErasureResponse)
def privacy_erasure(
    data: Optional[PrivacyErasureRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Executes statutory Right to Erasure under Section 12 of India's DPDP Act 2023."""
    reason = data.reason if data else "User exercised Right to Erasure"
    return production_launch_service.process_privacy_erasure(db, current_user, reason)


# ============================================================================
# 4. INDOOR GARAGE MAP STRUCTURAL VALIDATION
# ============================================================================

@launch_router.post("/api/v1/launch/validate-indoor-map/{facility_id}", response_model=IndoorMapValidationResponse)
def validate_map(
    facility_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    """Validates digital indoor garage map for lane continuity, disconnected slots, and ramp safety."""
    return production_launch_service.validate_facility_indoor_map(db, facility_id)


# ============================================================================
# 5. AUDIT LOG TELEMETRY
# ============================================================================

@launch_router.get("/api/v1/launch/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.OPERATOR])),
):
    """Returns recent tamper-evident audit logs with sanitized PII."""
    return db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
