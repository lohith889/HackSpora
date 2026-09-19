import re
from typing import Dict

# Regex for standard 11-character Indian IFSC code:
# 4 uppercase letters, a '0', followed by 6 alphanumeric characters.
IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")

CITIZEN_STATUS_MESSAGES: Dict[str, str] = {
    "SUBMITTED": "Application received and queued for automated verification against state land registries.",
    "AUTO_CLEARED": "Application successfully verified with zero discrepancies. Queued for subsidy disbursement.",
    "UNDER_REVIEW": "Application details are currently undergoing cross-verification with revenue and land records.",
    "ACTION_REQUIRED": "Additional documentation or clarification requested by scheme officer.",
    "FIELD_VERIFICATION": "Physical parcel inspection and Patwari verification in progress.",
    "PAYMENT_HELD": "Application verification on hold pending officer review.",
    "APPROVED": "Application approved by scheme officer. Entitlement granted for PM-KISAN subsidy.",
    "REJECTED": "Application rejected based on scheme eligibility criteria.",
}


def generate_parcel_id(
    state_code: str,
    district_code: str,
    tehsil_code: str,
    village_code: str,
    khata_number: str,
    plot_number: str,
) -> str:
    """
    Generate standard composite parcel identifier:
    Format: S-D-T-V-K-P (all uppercase)
    """
    parts = [
        str(state_code).strip().upper(),
        str(district_code).strip().upper(),
        str(tehsil_code).strip().upper(),
        str(village_code).strip().upper(),
        str(khata_number).strip().upper(),
        str(plot_number).strip().upper(),
    ]
    return "-".join(parts)


def generate_bank_ifsc_key(bank_account_number: str, ifsc_code: str) -> str:
    """
    Generate standard composite bank identifier:
    Format: ACCOUNT_NUMBER-IFSC_CODE (all uppercase)
    """
    clean_acc = str(bank_account_number).strip().upper()
    clean_ifsc = str(ifsc_code).strip().upper()
    return f"{clean_acc}-{clean_ifsc}"


def validate_aadhaar_format(raw_aadhaar: str) -> bool:
    """Validate that raw Aadhaar consists of exactly 12 numeric digits."""
    clean = str(raw_aadhaar).replace(" ", "").replace("-", "").strip()
    return clean.isdigit() and len(clean) == 12


def validate_ifsc_format(ifsc_code: str) -> bool:
    """Validate 11-character Indian Financial System Code (IFSC)."""
    clean = str(ifsc_code).strip().upper()
    return bool(IFSC_REGEX.match(clean))


def validate_mock_otp(otp: str) -> bool:
    """Validate mock mobile OTP against the testing value '123456'."""
    return str(otp).strip() == "123456"


def get_citizen_status_message(status: str) -> str:
    """Return an applicant-safe, plain-English status description."""
    clean_status = str(status).strip().upper()
    return CITIZEN_STATUS_MESSAGES.get(
        clean_status,
        f"Application is currently in {clean_status} status.",
    )
