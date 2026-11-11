"""Module 1 - Best-slot recommendation.

Architecture
------------
1. ``build_candidates``  : hard constraints (availability, EV, accessibility, vehicle
                           size, budget) are enforced first - a ranker can never
                           recommend a bay that violates them.
2. ``extract_features``  : every candidate is mapped to the same normalised feature
                           vector in [0, 1] (``FEATURE_ORDER``).
3. ``SlotRanker``        : pluggable scorer. ``WeightedScoringRanker`` is the
                           deterministic production default. ``LearnedRanker`` loads
                           a trained XGBoost artifact from ``model_artifacts/`` when
                           one exists, so learned ranking can be introduced later
                           without changing the API or the feature pipeline.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import math
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.ai.common import MODEL_ARTIFACT_DIR, haversine_km
from app.models import ParkingLot, ParkingSlot, SlotStatus, SlotType
from app.schemas import (
    BestSlotRecommendationResponse,
    RankedSlotCandidateItem,
    SlotFeatureBreakdown,
    SlotRankerRequest,
)

FEATURE_ORDER: Tuple[str, ...] = (
    "distance",
    "vehicle_fit",
    "ev_match",
    "duration_fit",
    "availability",
    "price",
)

DEFAULT_WEIGHTS: Dict[str, float] = {
    "distance": 0.30,
    "vehicle_fit": 0.15,
    "ev_match": 0.15,
    "duration_fit": 0.10,
    "availability": 0.10,
    "price": 0.20,
}

DISTANCE_SCALE_KM = 5.0
SUV_SURCHARGE_INR = 25.0
GST_RATE = 0.18
LEARNED_ARTIFACT_PATH = MODEL_ARTIFACT_DIR / "slot_ranker_xgb.json"


@dataclass
class SlotCandidate:
    lot: ParkingLot
    slot: ParkingSlot
    distance_km: float
    hourly_rate_inr: float
    surge_multiplier: float
    estimated_total_inr: float
    lot_availability_ratio: float
    features: Dict[str, float] = field(default_factory=dict)


def hourly_rate_for_slot(lot: ParkingLot, slot: ParkingSlot) -> float:
    """Same tariff composition as the booking engine (base + bay-type surcharge)."""
    rate = (
        slot.custom_hourly_rate_inr
        if slot.custom_hourly_rate_inr
        else lot.base_hourly_rate_inr
    )
    if slot.slot_type == SlotType.EV_CHARGING:
        rate += lot.ev_surcharge_inr
    elif slot.slot_type == SlotType.SUV_XL:
        rate += SUV_SURCHARGE_INR
    return round(rate, 2)


def violates_hard_constraints(
    slot: ParkingSlot, req: SlotRankerRequest, hourly_rate: float
) -> Optional[str]:
    if slot.status != SlotStatus.AVAILABLE:
        return "not_available"
    if req.requires_ev and slot.slot_type != SlotType.EV_CHARGING:
        return "ev_required"
    if req.requires_accessible and slot.slot_type != SlotType.ACCESSIBLE:
        return "accessible_required"
    if slot.slot_type == SlotType.ACCESSIBLE and not req.requires_accessible:
        # Accessible bays are reserved for drivers who request them.
        return "accessible_bay_reserved"
    if req.vehicle_size == "SUV_XL" and slot.slot_type == SlotType.STANDARD:
        return "vehicle_too_large"
    if req.max_hourly_budget_inr is not None and hourly_rate > req.max_hourly_budget_inr:
        return "over_budget"
    return None


def build_candidates(
    db: Session, req: SlotRankerRequest
) -> Tuple[List[SlotCandidate], int]:
    query = db.query(ParkingLot)
    if req.city and req.city.strip().lower() not in ("", "all"):
        query = query.filter(ParkingLot.city.ilike(f"%{req.city.strip()}%"))
    lots = query.order_by(ParkingLot.id.asc()).all()

    candidates: List[SlotCandidate] = []
    rejected = 0
    for lot in lots:
        slots = lot.slots or []
        total = len(slots)
        available = sum(1 for s in slots if s.status == SlotStatus.AVAILABLE)
        ratio = available / total if total else 0.0
        dist = haversine_km(
            req.target_latitude, req.target_longitude, lot.latitude, lot.longitude
        )
        surge = lot.current_surge_multiplier if lot.dynamic_pricing_enabled else 1.0
        for slot in slots:
            rate = hourly_rate_for_slot(lot, slot)
            if violates_hard_constraints(slot, req, rate):
                rejected += 1
                continue
            total_inr = round(rate * req.duration_hours * surge * (1 + GST_RATE), 2)
            candidates.append(
                SlotCandidate(
                    lot=lot,
                    slot=slot,
                    distance_km=dist,
                    hourly_rate_inr=rate,
                    surge_multiplier=round(surge, 2),
                    estimated_total_inr=total_inr,
                    lot_availability_ratio=round(ratio, 4),
                )
            )
    return candidates, rejected


def extract_features(candidates: List[SlotCandidate], req: SlotRankerRequest) -> None:
    """Populate ``candidate.features`` with values in [0, 1]."""
    if not candidates:
        return
    totals = [c.estimated_total_inr for c in candidates]
    lo, hi = min(totals), max(totals)

    for c in candidates:
        st = c.slot.slot_type
        floor = c.slot.floor or 1

        distance = math.exp(-c.distance_km / DISTANCE_SCALE_KM)

        if req.vehicle_size == "SUV_XL":
            vehicle_fit = 1.0 if st == SlotType.SUV_XL else 0.8
        elif req.vehicle_size == "COMPACT":
            vehicle_fit = 1.0 if st == SlotType.STANDARD else 0.7
        else:
            vehicle_fit = 1.0 if st == SlotType.STANDARD else 0.75

        if req.requires_ev:
            ev_match = 1.0  # hard constraint already guarantees an EV bay
        else:
            ev_match = 0.3 if st == SlotType.EV_CHARGING else 1.0

        if req.duration_hours <= 2.0:
            duration_fit = 1.0 if floor == 1 else 0.6
        elif req.duration_hours >= 5.0:
            duration_fit = 1.0 if floor >= 2 else 0.8
        else:
            duration_fit = 0.9 if floor == 1 else 0.85

        availability = c.lot_availability_ratio
        price = 1.0 if hi == lo else 1.0 - (c.estimated_total_inr - lo) / (hi - lo)

        c.features = {
            "distance": round(distance, 4),
            "vehicle_fit": vehicle_fit,
            "ev_match": ev_match,
            "duration_fit": duration_fit,
            "availability": round(availability, 4),
            "price": round(price, 4),
        }


def normalise_weights(custom: Optional[Dict[str, float]]) -> Dict[str, float]:
    if not custom:
        return dict(DEFAULT_WEIGHTS)
    unknown = set(custom) - set(FEATURE_ORDER)
    if unknown:
        raise ValueError(f"Unknown ranking weight(s): {sorted(unknown)}")
    if any(v < 0 for v in custom.values()):
        raise ValueError("Ranking weights must be non-negative.")
    merged = {k: float(custom.get(k, DEFAULT_WEIGHTS[k])) for k in FEATURE_ORDER}
    total = sum(merged.values())
    if total <= 0:
        raise ValueError("At least one ranking weight must be positive.")
    return {k: round(v / total, 4) for k, v in merged.items()}


class SlotRanker(ABC):
    name: str
    version: str

    @abstractmethod
    def score(self, features: Dict[str, float], weights: Dict[str, float]) -> float:
        """Return a score in [0, 100]."""


class WeightedScoringRanker(SlotRanker):
    name = "WEIGHTED_SCORING"
    version = "weighted-scoring-v1.0"

    def score(self, features: Dict[str, float], weights: Dict[str, float]) -> float:
        return round(100.0 * sum(features[k] * weights[k] for k in FEATURE_ORDER), 2)


class LearnedRanker(SlotRanker):
    """Loads an XGBoost relevance model trained on the same FEATURE_ORDER.

    Artifact contract: ``model_artifacts/slot_ranker_xgb.json`` saved with
    ``Booster.save_model``; input = FEATURE_ORDER columns; output = relevance score
    (higher is better) which is squashed to [0, 100].
    """

    name = "LEARNED"
    version = "learned-xgb-artifact"

    def __init__(self) -> None:
        import xgboost as xgb

        self._xgb = xgb
        self._booster = xgb.Booster()
        self._booster.load_model(str(LEARNED_ARTIFACT_PATH))

    @staticmethod
    def is_available() -> bool:
        return LEARNED_ARTIFACT_PATH.exists()

    def score(self, features: Dict[str, float], weights: Dict[str, float]) -> float:
        import numpy as np

        row = np.array([[features[k] for k in FEATURE_ORDER]], dtype=np.float32)
        raw = float(self._booster.predict(self._xgb.DMatrix(row))[0])
        return round(100.0 / (1.0 + math.exp(-raw)), 2)


def select_ranker(strategy: str) -> Tuple[SlotRanker, Optional[str]]:
    if strategy == "LEARNED":
        if LearnedRanker.is_available():
            return LearnedRanker(), None
        return WeightedScoringRanker(), (
            "No trained learned-ranking artifact is registered "
            f"({LEARNED_ARTIFACT_PATH.name} not found). Learned ranking needs labelled "
            "slot-selection outcomes, which Parkwise has not collected yet; the "
            "deterministic weighted scoring model was used instead."
        )
    return WeightedScoringRanker(), None


def _reasons(c: SlotCandidate, req: SlotRankerRequest) -> List[str]:
    reasons = [f"{c.distance_km} km from destination"]
    st = c.slot.slot_type
    if st == SlotType.EV_CHARGING:
        reasons.append(
            f"EV charging bay ({c.slot.power_kw:g} kW)" if c.slot.power_kw else "EV charging bay"
        )
    if st == SlotType.SUV_XL:
        reasons.append("Wide SUV/XL bay")
    if st == SlotType.ACCESSIBLE:
        reasons.append("Accessible bay")
    if (c.slot.floor or 1) == 1 and req.duration_hours <= 2.0:
        reasons.append("Ground floor - quick exit for a short stay")
    reasons.append(
        f"₹{c.hourly_rate_inr:g}/hr x {c.surge_multiplier:g} surge -> est. ₹{c.estimated_total_inr:g} incl. GST"
    )
    return reasons


def recommend_best_slots(
    db: Session, req: SlotRankerRequest
) -> BestSlotRecommendationResponse:
    weights = normalise_weights(req.custom_weights)
    ranker, fallback_reason = select_ranker(req.ranking_strategy)

    candidates, rejected = build_candidates(db, req)
    extract_features(candidates, req)

    scored = [(ranker.score(c.features, weights), c) for c in candidates]
    scored.sort(
        key=lambda t: (-t[0], t[1].estimated_total_inr, t[1].distance_km, t[1].slot.id)
    )

    items: List[RankedSlotCandidateItem] = []
    for rank, (score, c) in enumerate(scored[: req.top_k], start=1):
        contributions = {
            k: round(100.0 * c.features[k] * weights[k], 2) for k in FEATURE_ORDER
        }
        items.append(
            RankedSlotCandidateItem(
                rank=rank,
                lot_id=c.lot.id,
                lot_code=c.lot.code,
                lot_name=c.lot.name,
                city=c.lot.city,
                slot_id=c.slot.id,
                slot_number=c.slot.slot_number,
                floor=c.slot.floor or 1,
                zone=c.slot.zone or "A",
                slot_type=c.slot.slot_type,
                distance_km=c.distance_km,
                hourly_rate_inr=c.hourly_rate_inr,
                surge_multiplier=c.surge_multiplier,
                estimated_total_inr=c.estimated_total_inr,
                score=score,
                feature_breakdown=SlotFeatureBreakdown(
                    features=c.features,
                    weights=weights,
                    weighted_contributions=contributions,
                ),
                reasons=_reasons(c, req),
            )
        )

    return BestSlotRecommendationResponse(
        requested_strategy=req.ranking_strategy,
        strategy_used=ranker.name,
        ranker_version=ranker.version,
        fallback_reason=fallback_reason,
        available_strategies={
            "WEIGHTED_SCORING": True,
            "LEARNED": LearnedRanker.is_available(),
        },
        candidates_evaluated=len(candidates),
        candidates_rejected_by_constraints=rejected,
        recommendations=items,
    )
