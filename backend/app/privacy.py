"""Personal Data Minimization & DPDP Act 2023 Compliance Utilities for Parkwise.

Under India's Digital Personal Data Protection (DPDP) Act 2023, platforms must:
1. Minimize personal data exposure in public outputs, logs, and telemetry.
2. Mask Personally Identifiable Information (PII) like phone numbers, emails, and vehicle plates.
3. Provide transparent consent and audit-traceable data processing purposes.
"""
import re
from typing import Any, Dict, Optional


def mask_phone(phone: Optional[str]) -> str:
    """Masks Indian phone number: +91 98765 43210 -> +91 98*** **210."""
    if not phone:
        return "N/A"
    clean = re.sub(r"[\s\-]", "", phone.strip())
    if len(clean) >= 10:
        prefix = clean[:5]
        suffix = clean[-3:]
        return f"{prefix}*** ***{suffix}"
    return "***"


def mask_email(email: Optional[str]) -> str:
    """Masks email address: driver@parkwise.in -> d***r@parkwise.in."""
    if not email or "@" not in email:
        return "N/A"
    user_part, domain = email.strip().split("@", 1)
    if len(user_part) <= 2:
        masked_user = user_part[0] + "*"
    else:
        masked_user = user_part[0] + "***" + user_part[-1]
    return f"{masked_user}@{domain}"


def mask_vehicle_plate(plate: Optional[str]) -> str:
    """Masks Indian vehicle registration plate: DL-08-CAF-8921 -> DL-08-***-8921."""
    if not plate:
        return "N/A"
    clean = plate.strip().upper()
    parts = clean.split("-")
    if len(parts) == 4:
        return f"{parts[0]}-{parts[1]}-***-{parts[3]}"
    if len(clean) >= 8:
        return f"{clean[:4]}****{clean[-4:]}"
    return "****"


def sanitize_audit_details(details: str) -> str:
    """Sanitizes PII in audit log messages by masking phone numbers and emails."""
    # Mask email patterns
    sanitized = re.sub(
        r"([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)",
        lambda m: mask_email(m.group(0)),
        details,
    )
    # Mask 10-digit Indian phone numbers
    sanitized = re.sub(
        r"(?:\+91[\s\-]?)?([6-9]\d{9})",
        lambda m: mask_phone(m.group(0)),
        sanitized,
    )
    return sanitized


def get_dpdp_compliance_summary() -> Dict[str, Any]:
    """Returns platform DPDP compliance policy and active guardrails."""
    return {
        "status": "COMPLIANT",
        "regulation": "Digital Personal Data Protection (DPDP) Act 2023 (India)",
        "data_controller": "Parkwise Technologies India Pvt. Ltd.",
        "policies": {
            "data_minimization": "PII masked in public audit logs, receipts, and third-party webhooks.",
            "consent_architecture": "Explicit purpose-bound consent collected during onboarding.",
            "storage_limitation": "Expired reservation session tokens auto-revoked after 24 hours.",
            "encryption_standard": "PBKDF2-SHA256 for credentials, AES-256 for storage, TLS 1.3 in transit.",
            "right_to_erasure": "Supported via POST /api/v1/auth/deactivate endpoint.",
        },
        "masked_samples": {
            "phone_sample": mask_phone("+919876543210"),
            "email_sample": mask_email("aarav.sharma@parkwise.in"),
            "plate_sample": mask_vehicle_plate("DL-08-CAF-8921"),
        },
    }
