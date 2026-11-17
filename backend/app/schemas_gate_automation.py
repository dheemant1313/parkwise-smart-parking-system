"""Pydantic schemas for Phase 16: ANPR, Automated Gate Controllers & Offline Operations."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.models_gate_automation import (
    AccessDecision,
    BarrierState,
    GateHardwareHealth,
    GateReviewStatus,
    LaneDirection,
    VerificationMethod,
)


# -------------------------------------------------------------
# ANPR Camera & Scan Ingestion
# -------------------------------------------------------------

class ANPRScanRequest(BaseModel):
    facility_id: int
    camera_code: str = Field(..., description="Camera identifier, e.g. CAM-GATE-ENT-01")
    lane_code: Optional[str] = Field(None, description="Optional lane identifier")
    captured_plate_raw: str = Field(..., description="Raw text returned by OCR engine, e.g. 'KA 01 AB 1234'")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="OCR confidence score")
    direction: LaneDirection = Field(LaneDirection.ENTRY, description="ENTRY or EXIT")
    plate_crop_image_url: Optional[str] = Field(None, description="URL or data URI of cropped plate")
    full_frame_image_url: Optional[str] = Field(None, description="URL or data URI of vehicle overview")
    event_uuid: Optional[str] = Field(None, description="Client-generated unique ID for offline deduplication")


class ANPRScanResponse(BaseModel):
    event_uuid: str
    facility_id: int
    lane_code: str
    direction: LaneDirection
    raw_plate: str
    normalized_plate: str
    masked_plate: str
    confidence_score: float
    decision: AccessDecision
    decision_reason: str
    verification_method: VerificationMethod
    barrier_action: str
    matched_booking_reference: Optional[str] = None
    assigned_slot_number: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle_model: Optional[str] = None
    requires_human_review: bool = False
    review_task_id: Optional[int] = None
    overstay_minutes: int = 0
    overstay_fee_inr: float = 0.0
    timestamp: datetime


# -------------------------------------------------------------
# QR Code Fallback Scan
# -------------------------------------------------------------

class GateQRVerifyRequest(BaseModel):
    facility_id: int
    lane_code: str
    qr_payload: str = Field(..., description="Raw scanned QR string or token containing booking reference")
    direction: LaneDirection = Field(LaneDirection.ENTRY)
    vehicle_plate: Optional[str] = Field(None, description="Optional manual plate confirmation from driver")


# -------------------------------------------------------------
# Gate Lane Controller & Barrier Control
# -------------------------------------------------------------

class GateLaneItem(BaseModel):
    id: int
    facility_id: int
    lane_code: str
    lane_name: str
    direction: LaneDirection
    ip_address: str
    mqtt_topic: str
    controller_model: str
    barrier_state: BarrierState
    hardware_health: GateHardwareHealth
    last_heartbeat_at: Optional[datetime] = None
    auto_open_enabled: bool
    anti_passback_enabled: bool
    early_entry_grace_minutes: int
    exit_grace_minutes: int
    created_at: datetime


class GateBarrierControlRequest(BaseModel):
    command: BarrierState = Field(..., description="OPEN, CLOSE, HOLD_OPEN")
    reason: Optional[str] = Field(None, description="Reason for manual barrier actuation")


class GateBarrierControlResponse(BaseModel):
    lane_id: int
    lane_code: str
    previous_state: BarrierState
    new_state: BarrierState
    execution_status: str
    timestamp: datetime


# -------------------------------------------------------------
# Manual Staff Override
# -------------------------------------------------------------

class GateManualOverrideRequest(BaseModel):
    facility_id: int
    lane_code: str
    action: str = Field("OVERRIDE_ENTRY", description="OVERRIDE_ENTRY, OVERRIDE_EXIT, EMERGENCY_LOCKDOWN")
    vehicle_number: str = Field(..., description="Vehicle license plate to allow through")
    booking_reference: Optional[str] = Field(None, description="Optional associated booking reference")
    reason: str = Field(..., min_length=5, description="Auditable mandatory reason for supervisor override")


class GateManualOverrideResponse(BaseModel):
    event_uuid: str
    lane_code: str
    action: str
    vehicle_number_masked: str
    barrier_action: str
    staff_email: str
    reason: str
    timestamp: datetime


# -------------------------------------------------------------
# Human-in-the-Loop Review Queue
# -------------------------------------------------------------

class ANPRReviewItem(BaseModel):
    id: int
    event_id: int
    facility_id: int
    lane_code: str
    captured_plate_raw: str
    suggested_candidates: List[str]
    confidence_score: float
    crop_image_url: Optional[str]
    status: GateReviewStatus
    created_at: datetime


class ANPRReviewResolveRequest(BaseModel):
    decision: GateReviewStatus = Field(..., description="APPROVED_AS_IS, CORRECTED_AND_APPROVED, REJECTED")
    corrected_plate: Optional[str] = Field(None, description="Operator-typed corrected license plate")
    notes: Optional[str] = Field(None, description="Operator review notes")


class ANPRReviewResolveResponse(BaseModel):
    review_id: int
    status: GateReviewStatus
    resolved_plate: Optional[str]
    barrier_action: str
    access_decision: AccessDecision
    matched_booking_reference: Optional[str]
    reviewed_at: datetime


# -------------------------------------------------------------
# Offline Operations: Cryptographic Manifest & Sync
# -------------------------------------------------------------

class OfflineTokenItem(BaseModel):
    booking_reference: str
    vehicle_number_normalized: str
    valid_from_iso: str
    valid_to_iso: str
    facility_id: int
    slot_number: str
    vehicle_type: str
    hmac_signature: str


class OfflineManifestResponse(BaseModel):
    manifest_id: str
    facility_id: int
    facility_name: str
    generated_at: datetime
    window_start: datetime
    window_end: datetime
    total_tokens: int
    hmac_algorithm: str = "HMAC-SHA256"
    tokens: List[OfflineTokenItem]


class LocalOfflineVerifyRequest(BaseModel):
    facility_id: int
    vehicle_number: str
    offline_token: OfflineTokenItem
    direction: LaneDirection = LaneDirection.ENTRY


class LocalOfflineVerifyResponse(BaseModel):
    is_valid: bool
    decision: AccessDecision
    barrier_action: str
    decision_reason: str
    generated_offline_event_uuid: str


class OfflineEventSyncItem(BaseModel):
    client_event_uuid: str
    facility_id: int
    lane_code: str
    direction: LaneDirection
    vehicle_number: str
    booking_reference: str
    verification_method: VerificationMethod
    offline_client_timestamp: datetime
    hmac_signature: str
    barrier_action: str = "OPENED"


class OfflineBatchSyncRequest(BaseModel):
    facility_id: int
    events: List[OfflineEventSyncItem]


class OfflineBatchSyncResponse(BaseModel):
    facility_id: int
    total_received: int
    successfully_synced: int
    duplicates_skipped: int
    errors_count: int
    sync_summary: List[Dict[str, Any]]
    synced_at: datetime


# -------------------------------------------------------------
# Auditable Event Logs & Analytics
# -------------------------------------------------------------

class GateEventItem(BaseModel):
    id: int
    event_uuid: str
    facility_id: int
    lane_code: str
    direction: LaneDirection
    masked_plate: str
    confidence_score: float
    decision: AccessDecision
    decision_reason: str
    verification_method: VerificationMethod
    barrier_action: str
    matched_booking_reference: Optional[str]
    human_reviewed: bool
    sync_source: str
    timestamp: datetime


class GateEventsListResponse(BaseModel):
    facility_id: int
    total: int
    events: List[GateEventItem]


class GateAnalyticsSummaryResponse(BaseModel):
    facility_id: int
    total_scans_today: int
    anpr_auto_authorized_count: int
    manual_reviews_required_count: int
    qr_fallback_count: int
    offline_sync_count: int
    rejections_count: int
    average_anpr_confidence: float
    auto_authorization_rate_pct: float
    active_lanes_count: int
    pending_manual_reviews_count: int


# -------------------------------------------------------------
# Privacy & DPDP Retention Pruning
# -------------------------------------------------------------

class GatePruneRequest(BaseModel):
    facility_id: int
    retention_days: int = Field(90, ge=7, le=365, description="Days of historical raw records to keep")


class GatePruneResponse(BaseModel):
    facility_id: int
    records_pruned_count: int
    retention_days: int
    timestamp: datetime
