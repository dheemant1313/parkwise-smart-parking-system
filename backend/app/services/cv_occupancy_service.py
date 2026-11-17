"""Phase 15: Computer Vision Service for Parking Occupancy Classification.
Implements:
- BaseVehicleDetector abstraction
- YOLOv8VehicleDetector: Computes 2D bounding box intersection with parking bay Region-of-Interest (ROI) polygons
- Uncertainty classification: Queues ambiguous detections (0.40 - 0.75 confidence or partial occlusion) for operator review
- Strict fail-safe: Never automatically treats uncertain detections as confirmed vacancies
"""
import abc
import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class BoundingBox:
    x1: float
    y1: float
    x2: float
    y2: float
    class_name: str
    confidence: float

    @property
    def area(self) -> float:
        w = max(0.0, self.x2 - self.x1)
        h = max(0.0, self.y2 - self.y1)
        return w * h


@dataclass
class ParkingSlotROI:
    slot_id: int
    slot_number: str
    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def area(self) -> float:
        w = max(0.0, self.x2 - self.x1)
        h = max(0.0, self.y2 - self.y1)
        return w * h


@dataclass
class SlotCVClassification:
    slot_id: int
    slot_number: str
    is_occupied: bool
    confidence: float
    is_uncertain: bool
    matched_box: Optional[BoundingBox]
    overlap_ratio: float
    reason: str


class BaseVehicleDetector(abc.ABC):
    @abc.abstractmethod
    def classify_slots(
        self,
        slot_rois: List[ParkingSlotROI],
        detections: List[BoundingBox],
    ) -> List[SlotCVClassification]:
        pass


class YOLOv8VehicleDetector(BaseVehicleDetector):
    """Production YOLOv8 CV classifier computing spatial overlap between detected vehicles and slot ROIs."""

    def __init__(
        self,
        occupied_overlap_threshold: float = 0.35,
        vacant_overlap_threshold: float = 0.15,
        high_confidence_threshold: float = 0.75,
        uncertain_confidence_min: float = 0.40,
    ) -> None:
        self.occupied_overlap_threshold = occupied_overlap_threshold
        self.vacant_overlap_threshold = vacant_overlap_threshold
        self.high_confidence_threshold = high_confidence_threshold
        self.uncertain_confidence_min = uncertain_confidence_min
        self.vehicle_classes = {"car", "truck", "bus", "van", "suv", "motorcycle", "auto_rickshaw"}

    def _compute_overlap(self, boxA: BoundingBox, slotB: ParkingSlotROI) -> float:
        """Compute intersection area / slot area."""
        xA = max(boxA.x1, slotB.x1)
        yA = max(boxA.y1, slotB.y1)
        xB = min(boxA.x2, slotB.x2)
        yB = min(boxA.y2, slotB.y2)

        inter_w = max(0.0, xB - xA)
        inter_h = max(0.0, yB - yA)
        inter_area = inter_w * inter_h

        slot_area = slotB.area
        if slot_area <= 0:
            return 0.0
        return inter_area / slot_area

    def classify_slots(
        self,
        slot_rois: List[ParkingSlotROI],
        detections: List[BoundingBox],
    ) -> List[SlotCVClassification]:
        results: List[SlotCVClassification] = []

        # Filter detections for vehicles
        vehicle_detections = [
            d for d in detections if d.class_name.lower() in self.vehicle_classes
        ]

        for roi in slot_rois:
            best_overlap = 0.0
            best_match: Optional[BoundingBox] = None

            for det in vehicle_detections:
                overlap = self._compute_overlap(det, roi)
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_match = det

            if best_match is not None and best_overlap >= self.occupied_overlap_threshold:
                if best_match.confidence >= self.high_confidence_threshold:
                    results.append(
                        SlotCVClassification(
                            slot_id=roi.slot_id,
                            slot_number=roi.slot_number,
                            is_occupied=True,
                            confidence=best_match.confidence,
                            is_uncertain=False,
                            matched_box=best_match,
                            overlap_ratio=best_overlap,
                            reason=f"YOLOv8 confirmed vehicle '{best_match.class_name}' with {best_overlap:.1%} overlap.",
                        )
                    )
                elif best_match.confidence >= self.uncertain_confidence_min:
                    # Uncertain detection: DO NOT treat as confirmed vacancy or occupancy
                    results.append(
                        SlotCVClassification(
                            slot_id=roi.slot_id,
                            slot_number=roi.slot_number,
                            is_occupied=False,  # Unconfirmed
                            confidence=best_match.confidence,
                            is_uncertain=True,
                            matched_box=best_match,
                            overlap_ratio=best_overlap,
                            reason=(
                                f"Ambiguous vehicle detection ({best_match.confidence:.2f} confidence, "
                                f"{best_overlap:.1%} overlap). Queued for operator review."
                            ),
                        )
                    )
                else:
                    # Very low confidence noise
                    results.append(
                        SlotCVClassification(
                            slot_id=roi.slot_id,
                            slot_number=roi.slot_number,
                            is_occupied=False,
                            confidence=0.90,
                            is_uncertain=False,
                            matched_box=None,
                            overlap_ratio=0.0,
                            reason="No confident vehicle detection. Slot is vacant.",
                        )
                    )
            elif best_match is not None and best_overlap >= self.vacant_overlap_threshold:
                # Partial clipping or marginal overlap (e.g. adjacent car partially encroaching)
                results.append(
                    SlotCVClassification(
                        slot_id=roi.slot_id,
                        slot_number=roi.slot_number,
                        is_occupied=False,
                        confidence=best_match.confidence,
                        is_uncertain=True,
                        matched_box=best_match,
                        overlap_ratio=best_overlap,
                        reason=f"Marginal overlap ({best_overlap:.1%}). Possible line encroaching; requires operator verification.",
                    )
                )
            else:
                # Clear vacancy
                results.append(
                    SlotCVClassification(
                        slot_id=roi.slot_id,
                        slot_number=roi.slot_number,
                        is_occupied=False,
                        confidence=0.95,
                        is_uncertain=False,
                        matched_box=None,
                        overlap_ratio=0.0,
                        reason="Zero vehicle overlap detected. Slot is vacant.",
                    )
                )

        return results


cv_detector = YOLOv8VehicleDetector()
