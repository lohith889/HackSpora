"""
Exclusion Anomaly Engine — ENG-04

Checks applicant Aadhaar against exclusion_master for PM-KISAN disqualification categories:
  1. EXCLUSION_TAXPAYER              — Income tax payer
  2. EXCLUSION_GOVT_EMPLOYEE        — Current government employee
  3. EXCLUSION_PENSIONER             — Institutional pensioner
  4. EXCLUSION_PROFESSIONAL          — Licensed professional (doctor/engineer/lawyer/CA)
  5. EXCLUSION_INSTITUTIONAL_LAND    — Institutional / corporate landholder
  6. EXCLUSION_DECEASED              — Applicant Aadhaar marked deceased
"""
from typing import List
from sqlalchemy.orm import Session

from app.models import ExclusionMaster, PMKisanApplicationDetails
from app.services.engine_types import AnomalyFlagResult


def run(details: PMKisanApplicationDetails, db: Session) -> List[AnomalyFlagResult]:
    """Run the Exclusion engine against the exclusion registry for the applicant's Aadhaar."""
    flags: List[AnomalyFlagResult] = []

    exclusion = (
        db.query(ExclusionMaster)
        .filter(ExclusionMaster.aadhaar_ref == details.aadhaar_ref)
        .first()
    )

    # No exclusion record — applicant is clean
    if exclusion is None:
        return flags

    # 1. Taxpayer
    if exclusion.taxpayer_flag:
        flags.append(AnomalyFlagResult(
            anomaly_code="EXCLUSION_TAXPAYER",
            severity="Critical",
            score=55,
            rationale=(
                f"Applicant ({details.aadhaar_masked}) is identified as an income tax payer in the "
                f"CBDT exclusion registry. Income tax payers are ineligible for PM-KISAN benefits."
            ),
            evidence_json={"aadhaar_masked": details.aadhaar_masked, "exclusion_flag": "taxpayer"},
        ))

    # 2. Government Employee
    if exclusion.govt_employee_flag:
        flags.append(AnomalyFlagResult(
            anomaly_code="EXCLUSION_GOVT_EMPLOYEE",
            severity="Critical",
            score=55,
            rationale=(
                f"Applicant ({details.aadhaar_masked}) is registered as a current government employee. "
                f"Central/State government employees are excluded from PM-KISAN scheme entitlement."
            ),
            evidence_json={"aadhaar_masked": details.aadhaar_masked, "exclusion_flag": "govt_employee"},
        ))

    # 3. Pensioner
    if exclusion.pensioner_flag:
        flags.append(AnomalyFlagResult(
            anomaly_code="EXCLUSION_PENSIONER",
            severity="High",
            score=40,
            rationale=(
                f"Applicant ({details.aadhaar_masked}) is a registered institutional pensioner drawing "
                f"₹10,000+ per month. Pensioners above this threshold are excluded from PM-KISAN."
            ),
            evidence_json={"aadhaar_masked": details.aadhaar_masked, "exclusion_flag": "pensioner"},
        ))

    # 4. Licensed Professional
    if exclusion.professional_flag:
        flags.append(AnomalyFlagResult(
            anomaly_code="EXCLUSION_PROFESSIONAL",
            severity="High",
            score=40,
            rationale=(
                f"Applicant ({details.aadhaar_masked}) is a registered professional (doctor, engineer, "
                f"chartered accountant, or lawyer). Such professionals are ineligible for PM-KISAN."
            ),
            evidence_json={"aadhaar_masked": details.aadhaar_masked, "exclusion_flag": "professional"},
        ))

    # 5. Institutional Landholder
    if exclusion.institutional_landholder_flag:
        flags.append(AnomalyFlagResult(
            anomaly_code="EXCLUSION_INSTITUTIONAL_LAND",
            severity="High",
            score=40,
            rationale=(
                f"Land parcel is held by an institutional/corporate entity associated with Aadhaar "
                f"({details.aadhaar_masked}). Only individual farmer families qualify for PM-KISAN."
            ),
            evidence_json={"aadhaar_masked": details.aadhaar_masked, "exclusion_flag": "institutional_landholder"},
        ))

    # 6. Deceased Applicant
    if exclusion.deceased_flag:
        flags.append(AnomalyFlagResult(
            anomaly_code="EXCLUSION_DECEASED",
            severity="Critical",
            score=55,
            rationale=(
                f"Aadhaar ({details.aadhaar_masked}) is marked as DECEASED in the UIDAI/Civil Registry. "
                f"Application filed under a deceased individual's identity indicates potential fraud."
            ),
            evidence_json={"aadhaar_masked": details.aadhaar_masked, "exclusion_flag": "deceased"},
        ))

    return flags
