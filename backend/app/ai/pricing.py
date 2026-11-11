"""Module 3 - Dynamic pricing with demand forecast integration, min/max bounds, and operator approval.

Guarantees
----------
1. Purely deterministic and fully auditable formula trace.
2. Demand forecast feeds the tier calculation, but prices are bounded by operator rules and min/max caps.
3. No automatic price changes: all AI proposals are created with status=PENDING_APPROVAL
   and only take effect when an authorised operator calls APPROVE or MANUAL_OVERRIDE.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import math
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.ai.common import PREDICTION_LABEL, as_utc, current_hour_utc, utc_now
from app.ai.forecasting import generate_seven_day_forecast
from app.models import AuditLog, ParkingLot, PricingRule, User
from app.models_ai import AIPricingProposal
from app.schemas import (
    PricingProposalCreateRequest,
    PricingProposalDecisionRequest,
    PricingProposalResponse,
)

PRICING_ENGINE_VERSION = "deterministic-bounded-tier-v1.0"


def _format_proposal_code(lot_code: str) -> str:
    now = utc_now()
    micro = now.microsecond // 1000
    return f"AIP-{lot_code}-{now.strftime('%y%m%d%H%M%S')}-{micro:03d}"


def _serialize_proposal(p: AIPricingProposal, lot: ParkingLot) -> PricingProposalResponse:
    warnings = json.loads(p.warnings) if p.warnings else []
    return PricingProposalResponse(
        id=p.id,
        proposal_code=p.proposal_code,
        lot_id=p.lot_id,
        lot_code=lot.code,
        lot_name=lot.name,
        pricing_engine_version=p.pricing_engine_version,
        forecast_model_version=p.forecast_model_version,
        forecast_training_data_source=p.forecast_training_data_source,
        window_start_utc=as_utc(p.window_start_utc),
        window_hours=p.window_hours,
        predicted_peak_occupancy_pct=p.predicted_peak_occupancy_pct,
        ci90_lower_pct=p.ci90_lower_pct,
        ci90_upper_pct=p.ci90_upper_pct,
        demand_tier=p.demand_tier,
        tier_multiplier=p.tier_multiplier,
        operator_rule_cap_multiplier=p.operator_rule_cap_multiplier,
        operator_rule_reference=p.operator_rule_reference,
        base_hourly_rate_inr=p.base_hourly_rate_inr,
        min_hourly_rate_inr=p.min_hourly_rate_inr,
        max_hourly_rate_inr=p.max_hourly_rate_inr,
        unclamped_rate_inr=p.unclamped_rate_inr,
        recommended_rate_inr=p.recommended_rate_inr,
        recommended_multiplier=p.recommended_multiplier,
        was_clamped=p.was_clamped,
        formula_trace=p.formula_trace,
        warnings=warnings,
        status=p.status,
        created_by_email=p.created_by_email,
        decided_by_email=p.decided_by_email,
        applied_rate_inr=p.applied_rate_inr,
        applied_multiplier=p.applied_multiplier,
        decision_notes=p.decision_notes,
        created_at=as_utc(p.created_at),
        decided_at=as_utc(p.decided_at),
        prediction_label=PREDICTION_LABEL,
    )


def determine_demand_tier(predicted_peak_pct: float) -> Tuple[str, float]:
    """Deterministic step function mapping predicted peak occupancy to a surge multiplier."""
    if predicted_peak_pct >= 85.0:
        return "CRITICAL_PEAK", 1.40
    if predicted_peak_pct >= 70.0:
        return "HIGH_DEMAND", 1.25
    if predicted_peak_pct >= 50.0:
        return "MODERATE_DEMAND", 1.10
    if predicted_peak_pct <= 25.0:
        return "OFF_PEAK_DISCOUNT", 0.90
    return "STANDARD_DEMAND", 1.00


def create_pricing_proposal(
    db: Session,
    req: PricingProposalCreateRequest,
    creator_email: str = "operator@parkwise.in",
) -> PricingProposalResponse:
    lot = db.query(ParkingLot).filter(ParkingLot.id == req.lot_id).first()
    if lot is None:
        raise LookupError(f"Parking facility #{req.lot_id} not found.")

    # 1. Obtain demand forecast for the requested window
    forecast = generate_seven_day_forecast(db, lot.id, persist=False)
    window_pts = forecast.hourly_forecast[: req.window_hours]
    if not window_pts:
        raise ValueError("Forecast returned empty horizon window.")

    peak_pt = max(window_pts, key=lambda p: p.selected_predicted_pct)
    peak_pred = peak_pt.selected_predicted_pct
    ci_low = peak_pt.ci90_lower_pct
    ci_high = peak_pt.ci90_upper_pct

    # 2. Determine raw demand tier
    tier_name, raw_tier_mult = determine_demand_tier(peak_pred)

    # 3. Read active operator pricing rules for this facility
    active_rules = (
        db.query(PricingRule)
        .filter(PricingRule.lot_id == lot.id, PricingRule.is_active.is_(True))
        .all()
    )
    peak_rule = next(
        (r for r in active_rules if r.rule_type in ("PEAK_HOUR", "PEAK_SURGE")),
        None,
    )
    if peak_rule:
        rule_cap = peak_rule.multiplier
        rule_ref = f"PricingRule #{peak_rule.id} ('{peak_rule.rule_name}', max {rule_cap:g}x)"
    else:
        rule_cap = 2.0
        rule_ref = "Default facility policy (cap 2.0x)"

    effective_mult = min(raw_tier_mult, rule_cap)

    # 4. Resolve min/max bounds
    base_rate = float(lot.base_hourly_rate_inr)
    min_rate = (
        float(req.min_hourly_rate_inr)
        if req.min_hourly_rate_inr is not None
        else round(base_rate * 0.70, 2)
    )
    max_rate = (
        float(req.max_hourly_rate_inr)
        if req.max_hourly_rate_inr is not None
        else round(base_rate * 2.00, 2)
    )
    if max_rate < min_rate:
        max_rate = min_rate

    warnings: List[str] = []
    if forecast.training_data.get("source") == "LABELLED_SAMPLE_DATASET":
        warnings.append(
            "Forecast was trained on labelled SAMPLE data; review recommended tariff with local knowledge."
        )

    # 5. Deterministic price calculation and clamping
    unclamped_rate = round(base_rate * effective_mult, 2)
    recommended_rate = round(max(min_rate, min(max_rate, unclamped_rate)), 2)
    was_clamped = (recommended_rate != unclamped_rate)
    if was_clamped:
        warnings.append(
            f"Unclamped rate ₹{unclamped_rate:.2f} was clamped to boundary [₹{min_rate:.2f} - ₹{max_rate:.2f}]."
        )
    recommended_mult = round(recommended_rate / max(1.0, base_rate), 2)

    formula_trace = (
        f"base_rate=₹{base_rate:.2f} | peak_{req.window_hours}h_forecast={peak_pred:.1f}% "
        f"[90% CI: {ci_low:.1f}% - {ci_high:.1f}%] -> {tier_name} (raw_tier_mult={raw_tier_mult:g}x) "
        f"| rule_cap={rule_cap:g}x ({rule_ref}) -> effective_mult={effective_mult:g}x "
        f"-> unclamped_rate=₹{unclamped_rate:.2f} | clamp(min=₹{min_rate:.2f}, max=₹{max_rate:.2f}) "
        f"-> recommended_rate=₹{recommended_rate:.2f}/hr ({recommended_mult:.2f}x base)"
    )

    code = _format_proposal_code(lot.code)
    window_start = current_hour_utc()

    proposal = AIPricingProposal(
        proposal_code=code,
        lot_id=lot.id,
        pricing_engine_version=PRICING_ENGINE_VERSION,
        forecast_model_version=forecast.model_version,
        forecast_training_data_source=forecast.training_data.get("source", "UNKNOWN"),
        window_start_utc=window_start,
        window_hours=req.window_hours,
        predicted_peak_occupancy_pct=peak_pred,
        ci90_lower_pct=ci_low,
        ci90_upper_pct=ci_high,
        demand_tier=tier_name,
        tier_multiplier=raw_tier_mult,
        operator_rule_cap_multiplier=rule_cap,
        operator_rule_reference=rule_ref,
        base_hourly_rate_inr=base_rate,
        min_hourly_rate_inr=min_rate,
        max_hourly_rate_inr=max_rate,
        unclamped_rate_inr=unclamped_rate,
        recommended_rate_inr=recommended_rate,
        recommended_multiplier=recommended_mult,
        was_clamped=was_clamped,
        formula_trace=formula_trace,
        warnings=json.dumps(warnings) if warnings else None,
        status="PENDING_APPROVAL",
        created_by_email=creator_email,
    )
    db.add(proposal)
    db.add(
        AuditLog(
            actor_email=creator_email,
            actor_role="OPERATOR",
            action="AI_PRICING_PROPOSAL_CREATED",
            target_resource=f"Proposal {code}",
            details=formula_trace,
        )
    )
    db.commit()
    db.refresh(proposal)

    return _serialize_proposal(proposal, lot)


def decide_pricing_proposal(
    db: Session,
    proposal_id: int,
    req: PricingProposalDecisionRequest,
    operator_user: User,
) -> PricingProposalResponse:
    proposal = (
        db.query(AIPricingProposal)
        .filter(AIPricingProposal.id == proposal_id)
        .first()
    )
    if proposal is None:
        raise LookupError(f"Pricing proposal #{proposal_id} not found.")

    if proposal.status != "PENDING_APPROVAL":
        raise ValueError(
            f"Pricing proposal #{proposal_id} has already been decided (status={proposal.status})."
        )

    lot = db.query(ParkingLot).filter(ParkingLot.id == proposal.lot_id).first()
    if lot is None:
        raise LookupError(f"Parking facility #{proposal.lot_id} not found.")

    now = utc_now()
    proposal.decided_by_email = operator_user.email
    proposal.decided_at = now
    proposal.decision_notes = req.notes.strip()

    if req.action == "APPROVE":
        proposal.status = "APPROVED"
        proposal.applied_rate_inr = proposal.recommended_rate_inr
        proposal.applied_multiplier = proposal.recommended_multiplier
        lot.dynamic_pricing_enabled = True
        lot.current_surge_multiplier = proposal.recommended_multiplier
        audit_action = "AI_PRICING_PROPOSAL_APPROVED"
        audit_details = (
            f"Approved {proposal.proposal_code}: applied tariff ₹{proposal.applied_rate_inr}/hr "
            f"({proposal.applied_multiplier:g}x) to {lot.name}. Notes: {req.notes}"
        )

    elif req.action == "MANUAL_OVERRIDE":
        if req.manual_rate_inr is None:
            raise ValueError("manual_rate_inr is required when action=MANUAL_OVERRIDE.")

        raw_manual = float(req.manual_rate_inr)
        clamped_manual = round(
            max(proposal.min_hourly_rate_inr, min(proposal.max_hourly_rate_inr, raw_manual)),
            2,
        )
        mult = round(clamped_manual / max(1.0, proposal.base_hourly_rate_inr), 2)

        proposal.status = "OVERRIDDEN"
        proposal.applied_rate_inr = clamped_manual
        proposal.applied_multiplier = mult
        lot.dynamic_pricing_enabled = True
        lot.current_surge_multiplier = mult
        audit_action = "AI_PRICING_PROPOSAL_OVERRIDDEN"
        audit_details = (
            f"Manual override on {proposal.proposal_code}: requested ₹{raw_manual}, "
            f"applied clamped rate ₹{clamped_manual}/hr ({mult:g}x). Notes: {req.notes}"
        )

    elif req.action == "REJECT":
        proposal.status = "REJECTED"
        audit_action = "AI_PRICING_PROPOSAL_REJECTED"
        audit_details = (
            f"Rejected {proposal.proposal_code}. Active lot tariff unchanged. Notes: {req.notes}"
        )
    else:
        raise ValueError(f"Unsupported action: {req.action}")

    db.add(
        AuditLog(
            actor_email=operator_user.email,
            actor_role=operator_user.role.value,
            action=audit_action,
            target_resource=f"Proposal {proposal.proposal_code}",
            details=audit_details,
        )
    )
    db.commit()
    db.refresh(proposal)

    return _serialize_proposal(proposal, lot)


def list_pricing_proposals(
    db: Session,
    lot_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 25,
) -> List[PricingProposalResponse]:
    q = db.query(AIPricingProposal)
    if lot_id is not None:
        q = q.filter(AIPricingProposal.lot_id == lot_id)
    if status is not None:
        q = q.filter(AIPricingProposal.status == status.strip().upper())
    rows = (
        q.order_by(AIPricingProposal.created_at.desc()).limit(min(100, max(1, limit))).all()
    )
    lots = {l.id: l for l in db.query(ParkingLot).all()}
    return [_serialize_proposal(r, lots[r.lot_id]) for r in rows if r.lot_id in lots]
