"""Module 2 - 7-day hourly demand forecasting.

Data
----
``build_history`` first tries to derive hourly occupancy from the real booking
ledger (bookings overlapping each hour / total bays). If the ledger does not hold
enough history (``MIN_DB_NONZERO_HOURS``), it falls back to the clearly-labelled
SAMPLE dataset and says so in every response.

Models
------
* Baseline : seasonal-naive weekly  -> y(t) = y(t - 168h)
* XGBoost  : direct regressor on calendar features + lag_168h + lag_336h + the
             4-week same-hour mean. Every feature is an observation at least 168h
             old, so all 168 forecast steps use real inputs (no recursive feedback).

Evaluation (chronological, no shuffling)
----------------------------------------
train (oldest) | calibration (168h) | test (latest 168h)
* Point accuracy (MAE / RMSE / MAPE / R2) is reported on the test week.
* 90% intervals use split-conformal calibration on the calibration week, and their
  empirical coverage is then measured on the unseen test week.
* The forecast uses whichever model has the lower test MAE.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy.orm import Session

from app.ai.common import (
    ACTUAL_LABEL,
    IST,
    PREDICTION_LABEL,
    SAMPLE_LABEL,
    as_utc,
    current_hour_utc,
    live_occupancy,
    load_sample_dataset,
    utc_now,
)
from app.models import Booking, BookingStatus, ParkingLot
from app.models_ai import AIForecastPrediction
from app.schemas import (
    DailyForecastSummary,
    ForecastAccuracyMetrics,
    HourlyForecastPoint,
    SevenDayForecastResponse,
)

MODEL_VERSION = "xgb-direct-weekly-lag-v1.0"
HISTORY_HOURS = 60 * 24
CALIB_HOURS = 168
TEST_HOURS = 168
HORIZON_HOURS = 168
MIN_LAG = 336
MIN_DB_NONZERO_HOURS = 14 * 24
PERSIST_HOURS = 24
CI_LEVEL = 0.90

SOURCE_DB = "DATABASE_BOOKING_LEDGER"
SOURCE_SAMPLE = "LABELLED_SAMPLE_DATASET"

_BUNDLE_CACHE: Dict[Tuple[int, str, datetime], "ForecastBundle"] = {}


@dataclass
class ForecastBundle:
    lot_id: int
    source: str
    source_reason: str
    history: np.ndarray            # hourly occupancy %, oldest -> newest
    history_end_utc: datetime      # timestamp of the hour AFTER the last history value
    xgb_model: Any
    baseline_metrics: ForecastAccuracyMetrics
    xgb_metrics: ForecastAccuracyMetrics
    baseline_q90: float
    xgb_q90: float
    selected_model: str
    selection_reason: str


# ---------------------------------------------------------------------------
# History construction
# ---------------------------------------------------------------------------
def _db_history(db: Session, lot: ParkingLot, end_utc: datetime) -> np.ndarray:
    total_bays = len(lot.slots or [])
    series = np.zeros(HISTORY_HOURS, dtype=np.float64)
    if total_bays == 0:
        return series
    start_utc = end_utc - timedelta(hours=HISTORY_HOURS)
    bookings = (
        db.query(Booking)
        .filter(
            Booking.lot_id == lot.id,
            Booking.status.in_(
                [BookingStatus.CONFIRMED, BookingStatus.ACTIVE, BookingStatus.COMPLETED]
            ),
        )
        .all()
    )
    counts = np.zeros(HISTORY_HOURS, dtype=np.float64)
    for b in bookings:
        b_start = as_utc(b.checked_in_at) or as_utc(b.start_time)
        b_end = as_utc(b.checked_out_at) or as_utc(b.end_time)
        if b_start is None or b_end is None or b_end <= start_utc or b_start >= end_utc:
            continue
        first = max(0, int((b_start - start_utc).total_seconds() // 3600))
        last = min(HISTORY_HOURS, int(math.ceil((b_end - start_utc).total_seconds() / 3600)))
        counts[first:last] += 1
    return np.clip(counts / total_bays * 100.0, 0.0, 100.0)


def _sample_history(lot: ParkingLot, end_utc: datetime) -> np.ndarray:
    """Deterministic SAMPLE series. The value for a given absolute hour is stable."""
    ds = load_sample_dataset()
    weekday = ds["hourly_curve_weekday_pct"]
    weekend = ds["hourly_curve_weekend_pct"]
    profiles = ds.get("lot_profiles", {})
    profile = profiles.get(lot.code, profiles.get("default", {}))
    scale = float(profile.get("demand_scale", 1.0))
    offset = float(profile.get("offset_pct", 0.0))
    noise_sd = float(ds.get("noise_sd_pct", 2.5))
    ar = float(ds.get("ar1_coefficient", 0.35))

    start_utc = end_utc - timedelta(hours=HISTORY_HOURS)
    epoch_hour0 = int(start_utc.timestamp() // 3600)
    out = np.zeros(HISTORY_HOURS, dtype=np.float64)
    prev_resid = 0.0
    for i in range(HISTORY_HOURS):
        ts_ist = (start_utc + timedelta(hours=i)).astimezone(IST)
        h, dow = ts_ist.hour, ts_ist.weekday()
        base = (weekend if dow >= 5 else weekday)[h]
        if dow == 4 and 17 <= h <= 22:
            base += float(ds.get("friday_evening_uplift_pct", 5.0))
        rng = np.random.default_rng(lot.id * 1_000_003 + epoch_hour0 + i)
        resid = ar * prev_resid + rng.normal(0.0, noise_sd)
        prev_resid = resid
        out[i] = min(98.0, max(3.0, base * scale + offset + resid))
    return np.round(out, 2)


def build_history(db: Session, lot: ParkingLot, end_utc: datetime) -> Tuple[np.ndarray, str, str]:
    db_series = _db_history(db, lot, end_utc)
    nonzero = int(np.count_nonzero(db_series))
    if nonzero >= MIN_DB_NONZERO_HOURS:
        return db_series, SOURCE_DB, (
            f"Booking ledger has {nonzero} non-zero occupancy hours in the last 60 days "
            f"(>= {MIN_DB_NONZERO_HOURS} required)."
        )
    return _sample_history(lot, end_utc), SOURCE_SAMPLE, (
        f"Booking ledger has only {nonzero} non-zero occupancy hours in the last 60 days "
        f"(< {MIN_DB_NONZERO_HOURS} required), so the model was trained on the clearly "
        f"labelled SAMPLE dataset. Forecast levels may not reflect this facility."
    )


# ---------------------------------------------------------------------------
# Features & evaluation
# ---------------------------------------------------------------------------
def _features_for(ts_utc: datetime, series: np.ndarray, idx: int) -> List[float]:
    """Features for the hour at ``series`` position ``idx`` (may be >= len for future)."""
    ts = ts_utc.astimezone(IST)
    h, dow = ts.hour, ts.weekday()
    lag168 = series[idx - 168]
    lag336 = series[idx - 336]
    same_hour = [series[idx - 168 * k] for k in range(1, 5) if idx - 168 * k >= 0]
    return [
        math.sin(2 * math.pi * h / 24),
        math.cos(2 * math.pi * h / 24),
        math.sin(2 * math.pi * dow / 7),
        math.cos(2 * math.pi * dow / 7),
        1.0 if dow >= 5 else 0.0,
        lag168,
        lag336,
        float(np.mean(same_hour)),
    ]


def _metrics(name: str, split: str, y: np.ndarray, p: np.ndarray, q90: Optional[float]) -> ForecastAccuracyMetrics:
    err = p - y
    mae = float(np.mean(np.abs(err)))
    rmse = float(math.sqrt(np.mean(err ** 2)))
    mask = y >= 1.0
    mape = float(np.mean(np.abs(err[mask]) / y[mask]) * 100.0) if mask.any() else float("nan")
    ss_res = float(np.sum(err ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
    coverage = None
    if q90 is not None:
        coverage = round(float(np.mean(np.abs(err) <= q90) * 100.0), 1)
    return ForecastAccuracyMetrics(
        model_name=name,
        evaluation_split=split,
        mae=round(mae, 3),
        rmse=round(rmse, 3),
        mape_pct=round(mape, 2) if not math.isnan(mape) else -1.0,
        r2=round(r2, 4),
        ci90_coverage_pct=coverage,
        sample_size_hours=int(len(y)),
    )


def _conformal_q(abs_resid: np.ndarray, level: float = CI_LEVEL) -> float:
    n = len(abs_resid)
    k = min(n, int(math.ceil((n + 1) * level)))
    return float(np.sort(abs_resid)[k - 1])


def train_and_evaluate(db: Session, lot: ParkingLot) -> ForecastBundle:
    import xgboost as xgb

    end_utc = current_hour_utc()
    key = (lot.id, "auto", end_utc)
    if key in _BUNDLE_CACHE:
        return _BUNDLE_CACHE[key]

    series, source, reason = build_history(db, lot, end_utc)
    start_utc = end_utc - timedelta(hours=HISTORY_HOURS)

    idxs = list(range(MIN_LAG, HISTORY_HOURS))
    X = np.array(
        [_features_for(start_utc + timedelta(hours=i), series, i) for i in idxs],
        dtype=np.float32,
    )
    y = series[MIN_LAG:].astype(np.float64)
    baseline = X[:, 5].astype(np.float64)  # lag_168h

    n = len(y)
    tr_end = n - CALIB_HOURS - TEST_HOURS
    ca_end = n - TEST_HOURS

    model = xgb.XGBRegressor(
        n_estimators=250,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        min_child_weight=3,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=1,
    )
    model.fit(X[:tr_end], y[:tr_end])
    pred_all = np.clip(model.predict(X), 0.0, 100.0).astype(np.float64)

    xgb_q = _conformal_q(np.abs(pred_all[tr_end:ca_end] - y[tr_end:ca_end]))
    base_q = _conformal_q(np.abs(baseline[tr_end:ca_end] - y[tr_end:ca_end]))

    base_m = _metrics(
        "Seasonal-naive weekly baseline (y[t-168h])",
        "test: latest 168h (unseen)",
        y[ca_end:], baseline[ca_end:], base_q,
    )
    xgb_m = _metrics(
        f"XGBoost direct regressor ({MODEL_VERSION})",
        "test: latest 168h (unseen)",
        y[ca_end:], pred_all[ca_end:], xgb_q,
    )

    if xgb_m.mae < base_m.mae:
        selected, why = "XGBOOST", (
            f"XGBoost test MAE {xgb_m.mae} < baseline test MAE {base_m.mae}."
        )
    else:
        selected, why = "BASELINE", (
            f"XGBoost test MAE {xgb_m.mae} did not beat baseline test MAE {base_m.mae}; "
            "the simpler baseline is used for the forecast."
        )

    bundle = ForecastBundle(
        lot_id=lot.id,
        source=source,
        source_reason=reason,
        history=series,
        history_end_utc=end_utc,
        xgb_model=model,
        baseline_metrics=base_m,
        xgb_metrics=xgb_m,
        baseline_q90=base_q,
        xgb_q90=xgb_q,
        selected_model=selected,
        selection_reason=why,
    )
    _BUNDLE_CACHE.clear() if len(_BUNDLE_CACHE) > 32 else None
    _BUNDLE_CACHE[key] = bundle
    return bundle


@dataclass
class ForecastStep:
    target_utc: datetime
    baseline: float
    xgb: float
    selected: float
    lower: float
    upper: float


def forecast_steps(bundle: ForecastBundle, hours: int = HORIZON_HOURS) -> List[ForecastStep]:
    hist = bundle.history
    n_hist = len(hist)
    # Extend with NaN placeholders; features only ever read indices < n_hist because lag >= 168.
    ext = np.concatenate([hist, np.full(hours, np.nan)])
    start_utc = bundle.history_end_utc - timedelta(hours=n_hist)
    rows = [
        _features_for(start_utc + timedelta(hours=n_hist + k), ext, n_hist + k)
        for k in range(hours)
    ]
    X = np.array(rows, dtype=np.float32)
    xgb_pred = np.clip(bundle.xgb_model.predict(X), 0.0, 100.0)
    steps: List[ForecastStep] = []
    use_xgb = bundle.selected_model == "XGBOOST"
    q = bundle.xgb_q90 if use_xgb else bundle.baseline_q90
    for k in range(hours):
        base = float(X[k, 5])
        xp = float(xgb_pred[k])
        sel = xp if use_xgb else base
        steps.append(
            ForecastStep(
                target_utc=bundle.history_end_utc + timedelta(hours=k),
                baseline=round(base, 1),
                xgb=round(xp, 1),
                selected=round(sel, 1),
                lower=round(max(0.0, sel - q), 1),
                upper=round(min(100.0, sel + q), 1),
            )
        )
    return steps


# ---------------------------------------------------------------------------
# Persistence for live evaluation (Module 6)
# ---------------------------------------------------------------------------
def persist_predictions(db: Session, lot: ParkingLot, bundle: ForecastBundle, steps: List[ForecastStep]) -> int:
    version = f"{MODEL_VERSION}:{bundle.selected_model}"
    targets = [s.target_utc for s in steps[:PERSIST_HOURS]]
    existing = {
        as_utc(r.target_hour_utc)
        for r in db.query(AIForecastPrediction.target_hour_utc)
        .filter(
            AIForecastPrediction.lot_id == lot.id,
            AIForecastPrediction.model_version == version,
            AIForecastPrediction.target_hour_utc.in_(targets),
        )
        .all()
    }
    added = 0
    for s in steps[:PERSIST_HOURS]:
        if s.target_utc in existing:
            continue
        db.add(
            AIForecastPrediction(
                lot_id=lot.id,
                model_version=version,
                training_data_source=bundle.source,
                target_hour_utc=s.target_utc,
                predicted_occupancy_pct=s.selected,
                ci90_lower_pct=s.lower,
                ci90_upper_pct=s.upper,
            )
        )
        added += 1
    if added:
        db.commit()
    return added


def capture_live_actuals(db: Session) -> int:
    """Attach a REAL occupancy reading to predictions whose target hour is now."""
    hour = current_hour_utc()
    rows = (
        db.query(AIForecastPrediction)
        .filter(
            AIForecastPrediction.target_hour_utc >= hour,
            AIForecastPrediction.target_hour_utc < hour + timedelta(hours=1),
            AIForecastPrediction.actual_observed_pct.is_(None),
        )
        .all()
    )
    if not rows:
        return 0
    lots = {l.id: l for l in db.query(ParkingLot).all()}
    now = utc_now()
    for r in rows:
        lot = lots.get(r.lot_id)
        if lot is None:
            continue
        _, _, pct = live_occupancy(lot)
        r.actual_observed_pct = pct
        r.evaluated_at = now
    db.commit()
    return len(rows)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def generate_seven_day_forecast(db: Session, lot_id: int, persist: bool = True) -> SevenDayForecastResponse:
    lot = db.query(ParkingLot).filter(ParkingLot.id == lot_id).first()
    if lot is None:
        raise LookupError(f"Parking facility #{lot_id} not found.")

    capture_live_actuals(db)
    bundle = train_and_evaluate(db, lot)
    steps = forecast_steps(bundle)
    if persist:
        persist_predictions(db, lot, bundle, steps)

    hourly: List[HourlyForecastPoint] = []
    for s in steps:
        ts = s.target_utc.astimezone(IST)
        hourly.append(
            HourlyForecastPoint(
                target_hour_ist=ts.strftime("%Y-%m-%dT%H:00+05:30"),
                day_label=ts.strftime("%a %d %b"),
                hour_of_day=ts.hour,
                is_weekend=ts.weekday() >= 5,
                baseline_predicted_pct=s.baseline,
                xgboost_predicted_pct=s.xgb,
                selected_predicted_pct=s.selected,
                ci90_lower_pct=s.lower,
                ci90_upper_pct=s.upper,
            )
        )

    daily: List[DailyForecastSummary] = []
    for day_idx in range(7):
        pts = hourly[day_idx * 24 : (day_idx + 1) * 24]
        if not pts:
            continue
        peak = max(pts, key=lambda p: p.selected_predicted_pct)
        daily.append(
            DailyForecastSummary(
                date=pts[0].target_hour_ist[:10],
                day_label=f"Day {day_idx + 1} ({pts[0].day_label})",
                hours_covered=len(pts),
                avg_predicted_pct=round(
                    float(np.mean([p.selected_predicted_pct for p in pts])), 1
                ),
                peak_predicted_pct=peak.selected_predicted_pct,
                peak_hour_ist=f"{peak.hour_of_day:02d}:00",
                avg_ci90_width_pct=round(
                    float(np.mean([p.ci90_upper_pct - p.ci90_lower_pct for p in pts])), 1
                ),
            )
        )

    busy, total, pct = live_occupancy(lot)
    change = round(
        (bundle.xgb_metrics.mae - bundle.baseline_metrics.mae)
        / max(1e-6, bundle.baseline_metrics.mae) * 100.0,
        1,
    )
    start_utc = bundle.history_end_utc - timedelta(hours=HISTORY_HOURS)

    return SevenDayForecastResponse(
        lot_id=lot.id,
        lot_code=lot.code,
        lot_name=lot.name,
        city=lot.city,
        model_version=MODEL_VERSION,
        generated_at=utc_now(),
        actual_current_occupancy={
            "data_label": ACTUAL_LABEL,
            "occupied_or_reserved_bays": busy,
            "total_bays": total,
            "occupancy_pct": pct,
            "observed_at": utc_now().isoformat(),
        },
        training_data={
            "source": bundle.source,
            "data_label": SAMPLE_LABEL if bundle.source == SOURCE_SAMPLE else ACTUAL_LABEL,
            "source_reason": bundle.source_reason,
            "period_start_utc": start_utc.isoformat(),
            "period_end_utc": bundle.history_end_utc.isoformat(),
            "history_hours": HISTORY_HOURS,
            "train_hours": HISTORY_HOURS - MIN_LAG - CALIB_HOURS - TEST_HOURS,
            "calibration_hours": CALIB_HOURS,
            "test_hours": TEST_HOURS,
        },
        baseline_test_metrics=bundle.baseline_metrics,
        xgboost_test_metrics=bundle.xgb_metrics,
        xgboost_vs_baseline_mae_change_pct=change,
        selected_model=bundle.selected_model,
        selection_reason=bundle.selection_reason,
        interval_method=(
            "Split-conformal 90% interval: half-width = 90th-percentile absolute error on the "
            "calibration week; coverage reported on the separate test week."
        ),
        horizon_hours=HORIZON_HOURS,
        daily_summary=daily,
        hourly_forecast=hourly,
        disclaimer=(
            "Every value in hourly_forecast and daily_summary is a model PREDICTION "
            f"({PREDICTION_LABEL}), not actual occupancy. Actual occupancy appears only in "
            "actual_current_occupancy."
            + (
                " The model was trained on SAMPLE data because the booking ledger is too short."
                if bundle.source == SOURCE_SAMPLE
                else ""
            )
        ),
    )
