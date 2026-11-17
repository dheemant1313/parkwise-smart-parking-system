"""Phase 16: Indian Vehicle Registration Plate Normalizer, Validator & OCR Heuristic Repair.

Implements MoRTH (Ministry of Road Transport and Highways) standards:
- Standard Series: ^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$ (e.g. DL-08-CAF-8921, KA-01-AB-1234)
- Bharat Series:   ^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$ (e.g. 22-BH-1234-AA)
- OCR character confusion repair based on positional syntax (digits vs letters).
- Privacy masking and salted SHA-256 hashing for DPDP India 2023 compliance.
"""

import hashlib
import re
from typing import Tuple, List, Optional

INDIAN_STATE_CODES = {
    "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN", "GA", "GJ", "HP", "HR",
    "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP", "MZ", "NL", "OD",
    "PB", "PY", "RJ", "SK", "TN", "TR", "TS", "UK", "UP", "WB"
}

STANDARD_MORTH_REGEX = re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$")
BHARAT_SERIES_REGEX = re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$")

SALT_DPDP_INDIA = "parkwise_anpr_dpdp_salt_v1_2026"


def clean_raw_plate(raw_plate: str) -> str:
    """Strip spaces, dashes, dots, and non-alphanumeric characters; uppercase."""
    if not raw_plate:
        return ""
    return re.sub(r"[^A-Za-z0-9]", "", raw_plate).upper()


def repair_ocr_confusions(plate: str) -> str:
    """Repair common OCR optical confusions based on positional syntax of Indian plates."""
    if len(plate) < 8 or len(plate) > 11:
        return plate

    chars = list(plate)

    # 1. State Code (First 2 chars): MUST be alpha
    alpha_map = {"0": "O", "1": "I", "8": "B", "5": "S", "2": "Z", "6": "G"}
    for i in range(min(2, len(chars))):
        if chars[i] in alpha_map:
            chars[i] = alpha_map[chars[i]]

    # 2. Last 4 chars: MUST be digits
    digit_map = {
        "O": "0", "D": "0", "Q": "0",
        "I": "1", "L": "1",
        "Z": "2",
        "S": "5",
        "G": "6",
        "B": "8",
        "A": "4",
        "T": "7",
    }
    for i in range(max(0, len(chars) - 4), len(chars)):
        if chars[i] in digit_map:
            chars[i] = digit_map[chars[i]]

    # 3. District Code (chars 2 and 3 in standard plate)
    if len(chars) >= 4 and "".join(chars[:2]) in INDIAN_STATE_CODES:
        for i in range(2, 4):
            if chars[i] in digit_map:
                chars[i] = digit_map[chars[i]]

    return "".join(chars)


def normalize_and_validate_plate(raw_plate: str) -> Tuple[str, bool, Optional[str]]:
    """Normalize, repair OCR confusions, and validate against Indian MoRTH specifications.

    Returns:
        (normalized_plate, is_valid, format_type)
    """
    cleaned = clean_raw_plate(raw_plate)
    if not cleaned:
        return ("", False, None)

    # First check if raw already matches standard
    if STANDARD_MORTH_REGEX.match(cleaned):
        state = cleaned[:2]
        if state in INDIAN_STATE_CODES:
            return (cleaned, True, "STANDARD_MORTH")

    if BHARAT_SERIES_REGEX.match(cleaned):
        return (cleaned, True, "BHARAT_SERIES")

    # Attempt positional repair
    repaired = repair_ocr_confusions(cleaned)
    if STANDARD_MORTH_REGEX.match(repaired):
        state = repaired[:2]
        if state in INDIAN_STATE_CODES:
            return (repaired, True, "STANDARD_MORTH_REPAIRED")

    if BHARAT_SERIES_REGEX.match(repaired):
        return (repaired, True, "BHARAT_SERIES_REPAIRED")

    # If length matches general plate length (8 to 10 chars), return repaired as best-effort
    return (repaired if repaired else cleaned, False, "UNRECOGNIZED_FORMAT")


def generate_fuzzy_candidates(raw_plate: str) -> List[str]:
    """Generate fuzzy candidate plate strings for manual review suggestion."""
    cleaned = clean_raw_plate(raw_plate)
    candidates = set()

    if cleaned:
        candidates.add(cleaned)
        repaired = repair_ocr_confusions(cleaned)
        if repaired:
            candidates.add(repaired)

    # Return up to 3 unique candidates
    return list(candidates)[:3]


def mask_plate_for_privacy(plate: str) -> str:
    """Mask central characters of license plate for DPDP India privacy display.

    Example: "KA01AB1234" -> "KA 01 ** 1234"
             "DL08CAF8921" -> "DL 08 *** 8921"
    """
    cleaned = clean_raw_plate(plate)
    if len(cleaned) < 7:
        return cleaned

    state = cleaned[:2]
    district = cleaned[2:4] if cleaned[2:4].isdigit() else cleaned[2:3]
    series_len = len(cleaned) - len(state) - len(district) - 4
    series_stars = "*" * max(1, series_len)
    digits = cleaned[-4:]

    return f"{state} {district} {series_stars} {digits}"


def hash_plate_privacy(plate: str) -> str:
    """Generate salted SHA-256 hash of normalized plate for secure indexing without plaintext leak."""
    cleaned = clean_raw_plate(plate)
    payload = f"{cleaned}:{SALT_DPDP_INDIA}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()
