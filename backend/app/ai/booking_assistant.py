"""Module 4 - Conversational booking assistant in English & Hindi.

Guarantees
----------
1. Bilingual natural-language parsing (English, Devanagari Hindi, and Hinglish).
2. Extracts location, vehicle class, EV needs, accessibility, duration, and budget into
   a strictly-typed ``StructuredSearchParams`` object.
3. Every search requires backend database validation: slots are queried through
   Module 1 (Slot Ranker) and verified against overlapping booking intervals in the DB.
4. SAFETY INVARIANT: The assistant NEVER creates bookings or executes payments. It outputs
   a validated ``BookingDraft`` with the exact parameters and requires the user to submit
   it via the standard transactional ``POST /api/v1/bookings`` endpoint.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.ai.common import IST, as_utc, utc_now
from app.ai.slot_ranker import recommend_best_slots
from app.models import Booking, BookingStatus, ParkingLot
from app.schemas import (
    BookingAssistantRequest,
    BookingAssistantResponse,
    BookingDraft,
    RankedSlotCandidateItem,
    SlotRankerRequest,
    StructuredSearchParams,
)

HINDI_NUMBERS: Dict[str, float] = {
    "एक": 1.0,
    "दो": 2.0,
    "तीन": 3.0,
    "चार": 4.0,
    "पांच": 5.0,
    "पाँच": 5.0,
    "छह": 6.0,
    "सात": 7.0,
    "आठ": 8.0,
    "नौ": 9.0,
    "दस": 10.0,
    "ek": 1.0,
    "do": 2.0,
    "teen": 3.0,
    "char": 4.0,
    "paanch": 5.0,
    "chhah": 6.0,
    "saat": 7.0,
    "aath": 8.0,
}

ENGLISH_NUMBERS: Dict[str, float] = {
    "one": 1.0,
    "two": 2.0,
    "three": 3.0,
    "four": 4.0,
    "five": 5.0,
    "six": 6.0,
    "seven": 7.0,
    "eight": 8.0,
}

CITY_LANDMARK_MAP: List[Tuple[str, str, List[str]]] = [
    (
        "New Delhi",
        "DEL-CP-01",
        [
            "connaught",
            "cp",
            "delhi",
            "new delhi",
            "कनॉट",
            "कनॉट प्लेस",
            "दिल्ली",
            "नई दिल्ली",
            "राजीव चौक",
        ],
    ),
    (
        "Mumbai",
        "MUM-BKC-02",
        [
            "bkc",
            "bandra",
            "kurla",
            "mumbai",
            "jio world",
            "बीकेसी",
            "बांद्रा",
            "मुंबई",
        ],
    ),
    (
        "Bengaluru",
        "BLR-IND-03",
        [
            "indiranagar",
            "bengaluru",
            "bangalore",
            "mg road",
            "ub city",
            "इंदिरानगर",
            "बेंगलुरु",
            "बैंगलोर",
            "एमजी रोड",
        ],
    ),
    (
        "Gurugram",
        "GUR-CYB-04",
        [
            "cyberhub",
            "cyber hub",
            "cybercity",
            "gurugram",
            "gurgaon",
            "साइबरहब",
            "साइबर हब",
            "गुरुग्राम",
            "गुडगांव",
        ],
    ),
    (
        "Hyderabad",
        "HYD-HIT-05",
        [
            "hitec",
            "hitec city",
            "mindspace",
            "madhapur",
            "hyderabad",
            "हाईटेक",
            "हाईटेक सिटी",
            "हैदराबाद",
        ],
    ),
]


def detect_language(text: str, preferred: str = "AUTO") -> Tuple[str, str]:
    if preferred == "hi":
        return "hi", "Hindi (Devanagari / Hinglish)"
    if preferred == "en":
        return "en", "English"

    # Devanagari Unicode block
    if re.search(r"[\u0900-\u097F]", text):
        return "hi", "Hindi (Devanagari)"

    # Hinglish tokens
    lower = text.lower()
    hinglish_markers = [
        "chahiye", "ghante", "ghanta", "mein", "ke liye", "paas", "dikhao",
        "kal", "aaj", "mujhe", "kahan", "gaadi", "gaadiyan", "kripya",
    ]
    if any(m in lower for m in hinglish_markers):
        return "hi", "Hindi (Hinglish Conversational)"

    return "en", "English"


def parse_booking_intent(
    text: str, lots: List[ParkingLot]
) -> Tuple[Dict[str, Any], List[str], List[str]]:
    """Parse text into raw entity dictionary, defaults applied, and clarification notes."""
    lower = text.lower()
    entities: Dict[str, Any] = {}
    defaults: List[str] = []
    clarifications: List[str] = []

    # 1. Location / Facility
    matched_city: Optional[str] = None
    matched_lot_code: Optional[str] = None
    for city, code, tokens in CITY_LANDMARK_MAP:
        if any(t in lower or t in text for t in tokens):
            matched_city = city
            matched_lot_code = code
            break

    if matched_city:
        entities["city"] = matched_city
        entities["lot_code"] = matched_lot_code
    else:
        # Default to first lot if none specified, noting it as default
        default_lot = lots[0] if lots else None
        if default_lot:
            entities["city"] = default_lot.city
            entities["lot_code"] = default_lot.code
            defaults.append(
                f"No city/landmark mentioned; defaulted to {default_lot.city} ({default_lot.name})."
            )
            clarifications.append("Specify a city (e.g. Delhi, Mumbai, Bengaluru, Gurugram, Hyderabad) to target another facility.")

    # 2. Vehicle size
    suv_tokens = [
        "suv", "xl", "fortuner", "safari", "scorpio", "harrier", "creta",
        "एसयूवी", "बड़ी कार", "बड़ी गाड़ी",
    ]
    compact_tokens = [
        "compact", "hatchback", "small", "swift", "tiago", "i10", "wagonr",
        "कॉम्पैक्ट", "हैचबैक", "छोटी कार", "छोटी गाड़ी",
    ]
    if any(t in lower or t in text for t in suv_tokens):
        entities["vehicle_size"] = "SUV_XL"
    elif any(t in lower or t in text for t in compact_tokens):
        entities["vehicle_size"] = "COMPACT"
    else:
        entities["vehicle_size"] = "SEDAN"
        defaults.append("No vehicle size specified; defaulted to standard SEDAN.")

    # 3. EV Charging
    ev_tokens = [
        "ev", "electric", "charging", "charger", "ccs2", "fast charge",
        "ईवी", "इलेक्ट्रिक", "चार्जिंग", "चार्जर",
    ]
    entities["requires_ev"] = any(
        re.search(rf"\b{re.escape(t)}\b", lower) if t.isascii() else (t in text)
        for t in ev_tokens
    )

    # 4. Accessibility
    acc_tokens = [
        "accessible", "wheelchair", "disabled", "handicap", "divyang",
        "दिव्यांग", "व्हीलचेयर", "सुलभ",
    ]
    entities["requires_accessible"] = any(t in lower or t in text for t in acc_tokens)

    # 5. Duration (hours)
    digit_match = re.search(
        r"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h|घंटे|घंटा|ghante|ghanta)",
        text,
        flags=re.IGNORECASE,
    )
    if digit_match:
        entities["duration_hours"] = max(0.5, min(24.0, float(digit_match.group(1))))
    else:
        found_word = False
        for word, val in {**HINDI_NUMBERS, **ENGLISH_NUMBERS}.items():
            if re.search(
                rf"(?:^|\s){re.escape(word)}\s*(?:hours?|hrs?|घंटे|घंटा|ghante|ghanta)",
                text,
                flags=re.IGNORECASE,
            ):
                entities["duration_hours"] = val
                found_word = True
                break
        if not found_word:
            entities["duration_hours"] = 2.0
            defaults.append("No parking duration specified; defaulted to 2.0 hours.")

    # 6. Budget
    budget_match = re.search(
        r"(?:under|below|max|budget|within|₹|rs\.?|inr|कम|तक)\s*₹?\s*(\d{2,4})(?:\s*(?:/hr|per hour|प्रति घंटा))?",
        text,
        flags=re.IGNORECASE,
    )
    if budget_match:
        entities["max_hourly_budget_inr"] = float(budget_match.group(1))

    # 7. Start / End time
    now_utc = utc_now()
    if any(k in lower or k in text for k in ["tomorrow", "कल", "kal"]):
        start_time = (now_utc + timedelta(days=1)).replace(minute=0, second=0, microsecond=0)
    else:
        # Default start: top of next hour
        start_time = (now_utc + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)

    entities["start_time"] = start_time
    entities["end_time"] = start_time + timedelta(hours=entities["duration_hours"])

    return entities, defaults, clarifications


def process_booking_assistant_message(
    db: Session, req: BookingAssistantRequest
) -> BookingAssistantResponse:
    lang_code, lang_label = detect_language(req.message, req.preferred_language)

    lots = db.query(ParkingLot).order_by(ParkingLot.id.asc()).all()
    if not lots:
        raise LookupError("No parking facilities configured.")

    entities, defaults, clarifications = parse_booking_intent(req.message, lots)

    # Locate chosen facility
    matched_lot = next(
        (l for l in lots if l.code == entities.get("lot_code")), lots[0]
    )

    search_params = StructuredSearchParams(
        city=matched_lot.city,
        lot_id=matched_lot.id,
        lot_code=matched_lot.code,
        target_latitude=matched_lot.latitude,
        target_longitude=matched_lot.longitude,
        vehicle_size=entities["vehicle_size"],
        requires_ev=entities["requires_ev"],
        requires_accessible=entities["requires_accessible"],
        duration_hours=entities["duration_hours"],
        start_time=entities["start_time"],
        end_time=entities["end_time"],
        max_hourly_budget_inr=entities.get("max_hourly_budget_inr"),
    )

    # -------------------------------------------------------------------------
    # Mandatory backend database validation:
    # 1. Rank available candidate bays using Module 1
    # 2. Check each candidate bay against overlapping active bookings in DB
    # -------------------------------------------------------------------------
    ranker_req = SlotRankerRequest(
        city=matched_lot.city,
        target_latitude=matched_lot.latitude,
        target_longitude=matched_lot.longitude,
        vehicle_size=search_params.vehicle_size,
        requires_ev=search_params.requires_ev,
        requires_accessible=search_params.requires_accessible,
        duration_hours=search_params.duration_hours,
        max_hourly_budget_inr=search_params.max_hourly_budget_inr,
        ranking_strategy="WEIGHTED_SCORING",
        top_k=6,
    )
    ranked = recommend_best_slots(db, ranker_req)

    # Cross-verify each bay against overlapping database reservations
    conflict_free: List[RankedSlotCandidateItem] = []
    for cand in ranked.recommendations:
        overlap = (
            db.query(Booking)
            .filter(
                Booking.slot_id == cand.slot_id,
                Booking.status.in_(
                    [
                        BookingStatus.PENDING_PAYMENT,
                        BookingStatus.CONFIRMED,
                        BookingStatus.ACTIVE,
                    ]
                ),
                Booking.start_time < search_params.end_time,
                Booking.end_time > search_params.start_time,
            )
            .first()
        )
        if overlap is None:
            conflict_free.append(cand)

    validation_passed = len(conflict_free) > 0
    top_bay = conflict_free[0] if conflict_free else None

    # Construct non-executed BookingDraft if a valid bay exists
    draft: Optional[BookingDraft] = None
    if top_bay:
        draft = BookingDraft(
            lot_id=top_bay.lot_id,
            slot_id=top_bay.slot_id,
            slot_number=top_bay.slot_number,
            start_time=search_params.start_time,
            end_time=search_params.end_time,
            vehicle_category=search_params.vehicle_size,
            estimated_total_inr=top_bay.estimated_total_inr,
            submit_to="POST /api/v1/bookings",
        )

    # Build bilingual replies
    start_ist = search_params.start_time.astimezone(IST).strftime("%d %b %H:%M IST")
    end_ist = search_params.end_time.astimezone(IST).strftime("%H:%M IST")

    if validation_passed and top_bay:
        reply_en = (
            f"Found {len(conflict_free)} verified conflict-free bay(s) at {matched_lot.name} ({matched_lot.city}) "
            f"for {search_params.vehicle_size} from {start_ist} to {end_ist} ({search_params.duration_hours:g}h)"
            f"{', 50kW EV Charging' if search_params.requires_ev else ''}"
            f"{', Accessible' if search_params.requires_accessible else ''}. "
            f"Best match: Bay {top_bay.slot_number} (Floor {top_bay.floor}) - Score {top_bay.score}/100, "
            f"Estimated total: ₹{top_bay.estimated_total_inr:.2f} (incl. 18% GST). "
            f"Review the draft below and confirm to reserve."
        )
        reply_hi = (
            f"{matched_lot.name} ({matched_lot.city}) में {start_ist} से {end_ist} तक ({search_params.duration_hours:g} घंटे) "
            f"{search_params.vehicle_size} के लिए {len(conflict_free)} उपलब्ध पार्किंग बे सत्यापित किए गए हैं"
            f"{', 50kW ईवी फास्ट चार्जिंग' if search_params.requires_ev else ''}"
            f"{', दिव्यांग सुलभ' if search_params.requires_accessible else ''}। "
            f"शीर्ष सुझाव: बे {top_bay.slot_number} (मंज़िल {top_bay.floor}) - स्कोर {top_bay.score}/100, "
            f"अनुमानित कुल: ₹{top_bay.estimated_total_inr:.2f} (18% GST सहित)। "
            f"पुष्टि करने के लिए नीचे दिए गए ड्राफ्ट को सबमिट करें।"
        )
    else:
        reply_en = (
            f"Searched {matched_lot.name} ({matched_lot.city}) for {search_params.vehicle_size} "
            f"from {start_ist} to {end_ist}, but all matching bays are currently booked or undergoing maintenance. "
            f"Try adjusting the arrival time, duration, or budget."
        )
        reply_hi = (
            f"{matched_lot.name} ({matched_lot.city}) में {start_ist} से {end_ist} तक के लिए "
            f"सभी संबंधित बे पहले से आरक्षित हैं। कृपया समय या अवधि बदलकर पुनः प्रयास करें।"
        )

    chosen_reply = reply_hi if lang_code == "hi" else reply_en

    return BookingAssistantResponse(
        message=req.message,
        detected_language=lang_label,
        understood=True,
        extracted_entities={
            "city": search_params.city,
            "facility": matched_lot.name,
            "lot_code": matched_lot.code,
            "vehicle_size": search_params.vehicle_size,
            "requires_ev": search_params.requires_ev,
            "requires_accessible": search_params.requires_accessible,
            "duration_hours": search_params.duration_hours,
            "start_time_ist": start_ist,
            "end_time_ist": end_ist,
            "max_hourly_budget_inr": search_params.max_hourly_budget_inr,
        },
        defaults_applied=defaults,
        clarifications_needed=clarifications,
        search_params=search_params,
        backend_validation={
            "checked_against_db": True,
            "conflict_free_bays_count": len(conflict_free),
            "validation_passed": validation_passed,
        },
        validated_options=conflict_free,
        booking_draft=draft,
        reply=chosen_reply,
        reply_en=reply_en,
        reply_hi=reply_hi,
        booking_executed=False,
        policy=(
            "SAFETY INVARIANT: The conversational assistant is strictly read-only and never performs "
            "financial or booking mutations. Final reservations must be submitted by the user through "
            "the transactional POST /api/v1/bookings route."
        ),
    )
