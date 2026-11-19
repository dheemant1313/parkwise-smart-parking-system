"""Phase 21: Pydantic Schemas for Security, Reliability, Production Launch & Quality Assurance."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LaunchCriterionItem(BaseModel):
    criterion_number: int
    name: str
    category: str
    status: str  # VERIFIED, IN_PROGRESS, FAILED
    description: str
    evidence: str
    verification_timestamp: datetime


class LaunchScorecardResponse(BaseModel):
    overall_status: str
    score_percentage: float
    certified_for_production: bool
    total_criteria_count: int
    verified_criteria_count: int
    criteria: List[LaunchCriterionItem]
    deployment_target: str
    platform_version: str


class GateControllerTelemetry(BaseModel):
    facility_id: int
    facility_name: str
    controller_type: str  # INDUSTRIAL_IPC, RASPBERRY_PI_4, TCP_MODBUS
    barrier_status: str   # OPERATIONAL_READY, CALIBRATED
    heartbeat_latency_ms: float
    anpr_stream_fps: float
    offline_cache_entries: int
    last_sync_timestamp: datetime


class SystemTelemetryResponse(BaseModel):
    environment: str
    service_uptime_seconds: float
    database_engine: str
    database_pool_status: str
    concurrency_lock_engine: str
    p95_latency_ms: float
    anpr_stream_health: str
    gate_controllers: List[GateControllerTelemetry]
    latest_backup_timestamp: Optional[datetime]
    latest_backup_checksum: Optional[str]
    dpdp_compliance_status: str
    active_facilities_count: int


class ConcurrencyVerificationRequest(BaseModel):
    slot_id: Optional[int] = Field(None, example=1)


class ConcurrencyVerificationResponse(BaseModel):
    slot_id: int
    slot_number: str
    concurrent_requests: int
    successful_bookings: int
    conflicts_detected: int
    double_booking_prevented: bool
    execution_time_ms: float
    lock_mechanism: str
    audit_summary: str


class PrivacyErasureRequest(BaseModel):
    reason: Optional[str] = Field("User exercised DPDP Act 2023 Right to Erasure", max_length=255)


class PrivacyErasureResponse(BaseModel):
    status: str
    user_id: int
    masked_email: str
    masked_phone: str
    anonymized_vehicles_count: int
    purged_location_pins: int
    compliance_standard: str
    processed_at: datetime
    receipt_reference: str


class MapValidationCheckItem(BaseModel):
    name: str
    passed: bool
    details: str


class IndoorMapValidationResponse(BaseModel):
    facility_id: int
    facility_name: str
    total_floors: int
    total_slots: int
    total_lanes: int
    is_valid: bool
    checks: List[MapValidationCheckItem]
    warnings: List[str]


class AuditLogResponse(BaseModel):
    id: int
    actor_email: str
    actor_role: str
    action: str
    target_resource: str
    details: Optional[str]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
