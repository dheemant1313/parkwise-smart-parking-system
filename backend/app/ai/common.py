"""Shared helpers for the Parkwise AI modules."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from app.models import ParkingLot, SlotStatus

ACTUAL_LABEL = "ACTUAL_DB_OBSERVATION"
PREDICTION_LABEL = "PREDICTED_NOT_ACTUAL"
SAMPLE_LABEL = "SAMPLE_DATA"

IST = timezone(timedelta(hours=5, minutes=30))

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
SAMPLE_DATASET_PATH = BACKEND_ROOT / "data" / "ai_sample_dataset.json"
MODEL_ARTIFACT_DIR = BACKEND_ROOT / "model_artifacts"

_SAMPLE_CACHE: Optional[Dict[str, Any]] = None


def load_sample_dataset() -> Dict[str, Any]:
    """Load the clearly-labelled sample dataset (curves + evaluation test cases)."""
    global _SAMPLE_CACHE
    if _SAMPLE_CACHE is None:
        with open(SAMPLE_DATASET_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        if not data.get("is_sample_dataset"):
            raise ValueError(
                "ai_sample_dataset.json must declare is_sample_dataset=true."
            )
        _SAMPLE_CACHE = data
    return _SAMPLE_CACHE


def as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """SQLite returns naive datetimes; treat them as UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def current_hour_utc() -> datetime:
    return utc_now().replace(minute=0, second=0, microsecond=0)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return round(r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


def live_occupancy(lot: ParkingLot) -> Tuple[int, int, float]:
    """Return (occupied_or_reserved, total_bays, pct) from parking_slots right now."""
    slots = lot.slots or []
    total = len(slots)
    busy = sum(
        1 for s in slots if s.status in (SlotStatus.OCCUPIED, SlotStatus.RESERVED)
    )
    pct = round((busy / total) * 100.0, 2) if total else 0.0
    return busy, total, pct
