"""
Confidence Scoring Engine — RISK-02 & RISK-05

Decoupled Confidence Assessment:
Confidence Score (0-100%) and Confidence Level ("High" | "Medium" | "Low")
quantify the CERTAINTY and RELIABILITY of the detection evidence, completely
independent of whether the application is high-risk or low-risk.

Examples of Decoupling:
  - Clean genuine applicant with verified Land, Bank, and Aadhaar:
      Risk = 0 (Safe), Confidence = 95% (High certainty that applicant is genuine)
  - Income Tax payee or Deceased Aadhaar with direct government registry hit:
      Risk = 95 (Critical), Confidence = 98% (High certainty that claim is fraudulent)
  - Village application density surge with clean personal records:
      Risk = 40 (Moderate), Confidence = 65% (Medium certainty — may be legitimate CSC camp)
  - Application in newly digitized village with missing land master:
      Risk = 55 (High), Confidence = 45% (Low certainty due to registry gap)
"""
from typing import List, Tuple
from sqlalchemy.orm import Session

from app.models import (
    PMKisanApplicationDetails,
    LandRecordMaster,
    BankValidationMaster,
    ExclusionMaster,
)
from app.services.engine_types import AnomalyFlagResult

DETERMINISTIC_HARD_FLAGS = {
    "EXCLUSION_TAXPAYER",
    "EXCLUSION_GOVT_EMPLOYEE",
    "EXCLUSION_DECEASED",
    "EXCLUSION_PENSIONER",
    "EXCLUSION_PROFESSIONAL",
    "LAND_PARCEL_NOT_FOUND",
    "IDENTITY_DUPLICATE_AADHAAR",
    "PARCEL_SYNDICATE_PATTERN",
    "BANK_IFSC_INVALID",
}

HEURISTIC_STATISTICAL_FLAGS = {
    "STAT_VILLAGE_DENSITY_HIGH",
    "STAT_VILLAGE_DENSITY_MEDIUM",
    "TEMPORAL_SPIKE_HIGH",
    "TEMPORAL_SPIKE_MEDIUM",
    "ML_ISOLATION_FOREST_OUTLIER",
}


def compute_confidence(
    flags: List[AnomalyFlagResult],
    details: PMKisanApplicationDetails,
    db: Session,
) -> Tuple[int, str]:
    """
    Compute decoupled (confidence_score_pct, confidence_level).
    Returns integer percentage (0-100) and tier ("High", "Medium", "Low").
    """
    base_confidence = 50  # Prior confidence on baseline data

    # 1. Registry verification completeness
    # Aadhaar e-KYC
    if details.e_kyc_consent and details.e_kyc_status:
        base_confidence += 15
    elif not details.e_kyc_consent:
        base_confidence -= 10

    # Land registry presence
    land_record = (
        db.query(LandRecordMaster)
        .filter(LandRecordMaster.parcel_id == details.parcel_id)
        .first()
    )
    if land_record is not None:
        base_confidence += 15
    else:
        # Absence of registry entry makes land conclusions slightly less certain
        base_confidence -= 5

    # Bank registry presence
    bank_record = (
        db.query(BankValidationMaster)
        .filter(BankValidationMaster.bank_account_ifsc_key == details.bank_account_ifsc_key)
        .first()
    )
    if bank_record is not None:
        base_confidence += 10

    # Mobile OTP verification
    if details.otp_verified:
        base_confidence += 10
    else:
        base_confidence -= 10

    flag_codes = {f.anomaly_code for f in flags}

    # 2. Hard deterministic registry hits provide maximal confidence
    if any(code in DETERMINISTIC_HARD_FLAGS for code in flag_codes):
        # A hard statutory exclusion or database duplicate is indisputable
        confidence_pct = max(base_confidence, 95)
    elif flag_codes.issubset(HEURISTIC_STATISTICAL_FLAGS) and len(flag_codes) > 0:
        # Only statistical or ML flags fired without registry mismatches
        # Capped to 75% to reflect that statistical surges might be benign
        confidence_pct = min(base_confidence, 75)
    else:
        confidence_pct = base_confidence

    confidence_pct = max(10, min(100, confidence_pct))

    # Determine confidence tier
    if confidence_pct >= 80:
        level = "High"
    elif confidence_pct >= 50:
        level = "Medium"
    else:
        level = "Low"

    return confidence_pct, level
