"""Module 6 - AI model performance, prediction error, drift (PSI), and data-quality monitoring.

Capabilities
------------
1. Live Forecast Evaluation: Tracks real-time prediction accuracy by comparing stored
   AIForecastPrediction rows with actual occupancy captured from parking_slots.
   Calculates MAE, RMSE, Bias, and 90% confidence interval empirical coverage.
2. Drift Detection: Calculates Population Stability Index (PSI) between reference
   baseline distributions and current observed database distributions.
3. Data Quality Checks: Audits live slot integrity, booking validity, sensor health,
   and pricing rule boundaries.
4. Metric Persistence: Stores point-in-time metrics in AIModelMetricLog with explicit
   data source labels (SAMPLE_HOLDOUT vs LIVE_DB).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy.orm import Session

from app.ai.common import (
    ACTUAL_LABEL,
    SAMPLE_LABEL,
    as_utc,
    current_hour_utc,
    live_occupancy,
    load_sample_dataset,
    utc_now,
)
from app.ai.forecasting import capture_live_actuals
from app.models import (
    Booking,
    ParkingLot,
    ParkingSlot,
    PricingRule,
    SlotStatus,
)
from app.models_ai import AIForecastPrediction, AIModelMetricLog
from app.schemas import (
    DataQualityCheck,
    DriftFeatureReport,
    LiveForecastEvaluation,
    ModelMetricLogItem,
    ModelMonitoringResponse,
)


def compute_psi(
    expected_props: List[float], actual_counts: List[int], total_actual: int
) -> float:
    """Calculate Population Stability Index (PSI) with epsilon smoothing."""
    if total_actual == 0:
        return 0.0
    eps = 1e-4
    actual_props = [(c / total_actual) for c in actual_counts]
    psi = 0.0
    for e, a in zip(expected_props, actual_props):
        e_adj = max(eps, e)
        a_adj = max(eps, a)
        psi += (a_adj - e_adj) * math.log(a_adj / e_adj)
    return round(max(0.0, psi), 4)


def psi_status(psi: float) -> str:
    if psi < 0.10:
        return "HEALTHY"
    if psi < 0.25:
        return "MODERATE_DRIFT"
    return "SIGNIFICANT_DRIFT"


def evaluate_live_predictions(db: Session) -> LiveForecastEvaluation:
    # First ensure any pending hours that have passed are captured with real actuals
    capture_live_actuals(db)

    now = current_hour_utc()
    all_stored = db.query(AIForecastPrediction).all()
    evaluated = [p for p in all_stored if p.actual_observed_pct is not None]
    pending = [p for p in all_stored if as_utc(p.target_hour_utc) >= now]
    missed = [
        p
        for p in all_stored
        if as_utc(p.target_hour_utc) < now and p.actual_observed_pct is None
    ]

    if not evaluated:
        return LiveForecastEvaluation(
            predictions_stored=len(all_stored),
            predictions_evaluated=0,
            predictions_pending=len(pending),
            predictions_missed=len(missed),
            mae=None,
            rmse=None,
            bias=None,
            ci90_coverage_pct=None,
            status="INITIALIZING",
            note=(
                "No target hours have elapsed and had actual occupancy recorded yet. "
                "Forecast predictions have been generated and will be evaluated as real hours complete."
            ),
        )

    errors = [p.predicted_occupancy_pct - p.actual_observed_pct for p in evaluated]
    mae = float(np.mean(np.abs(errors)))
    rmse = float(math.sqrt(np.mean([e ** 2 for e in errors])))
    bias = float(np.mean(errors))
    covered = sum(
        1
        for p in evaluated
        if p.ci90_lower_pct <= p.actual_observed_pct <= p.ci90_upper_pct
    )
    coverage_pct = round((covered / len(evaluated)) * 100.0, 1)

    status = "HEALTHY" if mae <= 12.0 and coverage_pct >= 80.0 else "ATTENTION_REQUIRED"
    return LiveForecastEvaluation(
        predictions_stored=len(all_stored),
        predictions_evaluated=len(evaluated),
        predictions_pending=len(pending),
        predictions_missed=len(missed),
        mae=round(mae, 3),
        rmse=round(rmse, 3),
        bias=round(bias, 3),
        ci90_coverage_pct=coverage_pct,
        status=status,
        note=f"Evaluated against {len(evaluated)} real observed target hours from database.",
    )


def compute_feature_drift(db: Session) -> List[DriftFeatureReport]:
    sample_data = load_sample_dataset()
    ref_dists = sample_data.get("reference_distributions", {})

    slots = db.query(ParkingSlot).all()
    lots = db.query(ParkingLot).all()
    bookings = db.query(Booking).all()

    reports: List[DriftFeatureReport] = []

    # 1. Occupancy % Drift
    occ_ref = ref_dists.get("occupancy_pct", {})
    occ_bins = occ_ref.get("bins", [0, 20, 40, 60, 80, 100])
    occ_props = occ_ref.get("proportions", [0.15, 0.25, 0.30, 0.20, 0.10])
    lot_occs = [live_occupancy(l)[2] for l in lots]
    if lot_occs:
        counts = [0] * len(occ_props)
        for val in lot_occs:
            for i in range(len(occ_props)):
                if occ_bins[i] <= val <= occ_bins[i + 1]:
                    counts[i] += 1
                    break
        psi_val = compute_psi(occ_props, counts, len(lot_occs))
        reports.append(
            DriftFeatureReport(
                feature="occupancy_pct",
                reference_source=SAMPLE_LABEL,
                current_source=ACTUAL_LABEL,
                reference_n=1000,
                current_n=len(lot_occs),
                psi=psi_val,
                status=psi_status(psi_val),
                note=f"PSI={psi_val:.4f} across {len(lot_occs)} live facilities.",
            )
        )

    # 2. Duration Hours Drift
    dur_ref = ref_dists.get("duration_hours", {})
    dur_bins = dur_ref.get("bins", [0, 2, 4, 8, 24])
    dur_props = dur_ref.get("proportions", [0.45, 0.35, 0.15, 0.05])
    durations = [b.duration_hours for b in bookings]
    if durations:
        counts = [0] * len(dur_props)
        for d in durations:
            for i in range(len(dur_props)):
                if dur_bins[i] <= d <= dur_bins[i + 1]:
                    counts[i] += 1
                    break
        psi_val = compute_psi(dur_props, counts, len(durations))
        reports.append(
            DriftFeatureReport(
                feature="duration_hours",
                reference_source=SAMPLE_LABEL,
                current_source=ACTUAL_LABEL,
                reference_n=1000,
                current_n=len(durations),
                psi=psi_val,
                status=psi_status(psi_val),
                note=f"PSI={psi_val:.4f} across {len(durations)} recorded bookings.",
            )
        )

    # 3. Base Hourly Rate Drift
    rate_ref = ref_dists.get("hourly_rate_inr", {})
    rate_bins = rate_ref.get("bins", [0, 60, 80, 100, 200])
    rate_props = rate_ref.get("proportions", [0.20, 0.40, 0.30, 0.10])
    rates = [l.base_hourly_rate_inr for l in lots]
    if rates:
        counts = [0] * len(rate_props)
        for r in rates:
            for i in range(len(rate_props)):
                if rate_bins[i] <= r <= rate_bins[i + 1]:
                    counts[i] += 1
                    break
        psi_val = compute_psi(rate_props, counts, len(rates))
        reports.append(
            DriftFeatureReport(
                feature="base_hourly_rate_inr",
                reference_source=SAMPLE_LABEL,
                current_source=ACTUAL_LABEL,
                reference_n=1000,
                current_n=len(rates),
                psi=psi_val,
                status=psi_status(psi_val),
                note=f"PSI={psi_val:.4f} across {len(rates)} facility base tariffs.",
            )
        )

    return reports


def run_data_quality_audit(db: Session) -> List[DataQualityCheck]:
    checks: List[DataQualityCheck] = []

    # 1. Parking Slots integrity
    slots = db.query(ParkingSlot).all()
    slot_fails = sum(
        1
        for s in slots
        if not s.slot_number or not s.status or (s.floor or 1) < 1
    )
    s_pass = round((1.0 - (slot_fails / max(1, len(slots)))) * 100.0, 2)
    checks.append(
        DataQualityCheck(
            check="Parking Slots Schema & Status Validity",
            rows_checked=len(slots),
            rows_failing=slot_fails,
            pass_rate_pct=s_pass,
            status="PASS" if s_pass >= 99.0 else "FAIL",
        )
    )

    # 2. IoT Sensor Health Heartbeat
    sensor_fails = sum(1 for s in slots if s.sensor_health == "OFFLINE")
    sensor_pass = round((1.0 - (sensor_fails / max(1, len(slots)))) * 100.0, 2)
    checks.append(
        DataQualityCheck(
            check="IoT Sensor Heartbeat & Online Status",
            rows_checked=len(slots),
            rows_failing=sensor_fails,
            pass_rate_pct=sensor_pass,
            status="PASS" if sensor_pass >= 90.0 else "ATTENTION",
        )
    )

    # 3. Bookings Validity (end_time > start_time, positive price, valid ref)
    bookings = db.query(Booking).all()
    booking_fails = sum(
        1
        for b in bookings
        if not b.booking_reference
        or not b.vehicle_number
        or as_utc(b.end_time) <= as_utc(b.start_time)
        or b.total_amount_inr < 0
    )
    b_pass = round((1.0 - (booking_fails / max(1, len(bookings)))) * 100.0, 2)
    checks.append(
        DataQualityCheck(
            check="Booking Integrity & Positive Duration/Amount",
            rows_checked=len(bookings),
            rows_failing=booking_fails,
            pass_rate_pct=b_pass,
            status="PASS" if b_pass >= 99.0 else "FAIL",
        )
    )

    # 4. Pricing Rules Boundaries (multiplier >= 1.0)
    rules = db.query(PricingRule).all()
    rule_fails = sum(1 for r in rules if r.multiplier < 1.0 or r.flat_surcharge_inr < 0)
    r_pass = round((1.0 - (rule_fails / max(1, len(rules)))) * 100.0, 2)
    checks.append(
        DataQualityCheck(
            check="Pricing Rules Non-Negative Multipliers",
            rows_checked=len(rules),
            rows_failing=rule_fails,
            pass_rate_pct=r_pass,
            status="PASS" if r_pass >= 99.0 else "FAIL",
        )
    )

    return checks


def get_model_monitoring_overview(
    db: Session, record_metric_probe: bool = True
) -> ModelMonitoringResponse:
    live_eval = evaluate_live_predictions(db)
    drift_reports = compute_feature_drift(db)
    data_quality = run_data_quality_audit(db)

    # Persist probe record to AIModelMetricLog if requested
    if record_metric_probe:
        now = utc_now()
        if live_eval.mae is not None:
            db.add(
                AIModelMetricLog(
                    module_code="DEMAND_FORECASTING",
                    model_version="xgb-direct-weekly-lag-v1.0",
                    lot_id=None,
                    data_source="LIVE_DB",
                    metric_name="LIVE_MAE_PCT",
                    metric_value=live_eval.mae,
                    sample_size=live_eval.predictions_evaluated,
                    status=live_eval.status,
                    details=f"Live evaluation over {live_eval.predictions_evaluated} predictions",
                )
            )
        for dr in drift_reports:
            if dr.psi is not None:
                db.add(
                    AIModelMetricLog(
                        module_code="FEATURE_DRIFT",
                        model_version="psi-v1.0",
                        lot_id=None,
                        data_source="LIVE_DB",
                        metric_name=f"PSI_{dr.feature.upper()}",
                        metric_value=dr.psi,
                        sample_size=dr.current_n,
                        status=dr.status,
                        details=dr.note,
                    )
                )
        db.commit()

    recent_logs = (
        db.query(AIModelMetricLog)
        .order_by(AIModelMetricLog.recorded_at.desc())
        .limit(20)
        .all()
    )

    reasons: List[str] = []
    overall = "HEALTHY"
    if live_eval.status == "ATTENTION_REQUIRED":
        overall = "DEGRADED"
        reasons.append(f"Live forecast MAE {live_eval.mae}% exceeds target threshold.")
    if any(dr.status == "SIGNIFICANT_DRIFT" for dr in drift_reports):
        overall = "DEGRADED"
        reasons.append("Significant feature drift detected in one or more distributions.")
    if any(dq.status == "FAIL" for dq in data_quality):
        overall = "DEGRADED"
        reasons.append("One or more data quality checks failed.")

    if not reasons:
        reasons.append("All model performance, drift, and data quality checks within healthy thresholds.")

    offline_meta = {
        "status": "VALIDATED",
        "sample_dataset_version": "phase07-v1.0",
        "baseline_holdout_mae_target": 3.8,
        "xgboost_holdout_mae_target": 2.6,
        "eval_script": "backend/scripts/evaluate_models.py",
    }

    return ModelMonitoringResponse(
        evaluated_at=utc_now(),
        overall_status=overall,
        status_reasons=reasons,
        live_forecast_evaluation=live_eval,
        offline_evaluation=offline_meta,
        drift=drift_reports,
        data_quality=data_quality,
        recent_metric_logs=[ModelMetricLogItem.model_validate(l) for l in recent_logs],
    )
