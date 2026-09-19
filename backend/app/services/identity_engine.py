"""
Identity Anomaly Engine — ENG-01

Checks:
  1. IDENTITY_EKYC_NOT_CONSENTED  — Aadhaar e-KYC consent absent
  2. IDENTITY_EKYC_FAILED          — e-KYC verification returned failure
  3. IDENTITY_OTP_NOT_VERIFIED     — Mobile OTP was not verified
  4. IDENTITY_DUPLICATE_AADHAAR   — Same Aadhaar appears in another application
  5. IDENTITY_BULK_MOBILE          — Mobile number shared across multiple applicants
"""
from typing import List
from sqlalchemy.orm import Session

from app.models import PMKisanApplicationDetails
from app.services.engine_types import AnomalyFlagResult


def run(details: PMKisanApplicationDetails, db: Session) -> List[AnomalyFlagResult]:
    """Run the Identity anomaly engine against the supplied application details."""
    flags: List[AnomalyFlagResult] = []

    # 1. e-KYC Consent missing
    if not details.e_kyc_consent:
        flags.append(AnomalyFlagResult(
            anomaly_code="IDENTITY_EKYC_NOT_CONSENTED",
            severity="High",
            score=40,
            rationale="Applicant did not provide consent for UIDAI Aadhaar e-KYC verification. Identity cannot be confirmed.",
            evidence_json={"e_kyc_consent": details.e_kyc_consent},
        ))

    # 2. e-KYC Failed (consent given but verification failed)
    if details.e_kyc_consent and not details.e_kyc_status:
        flags.append(AnomalyFlagResult(
            anomaly_code="IDENTITY_EKYC_FAILED",
            severity="High",
            score=40,
            rationale="Aadhaar e-KYC verification returned a failure status. Applicant identity could not be authenticated against UIDAI registry.",
            evidence_json={"e_kyc_consent": True, "e_kyc_status": False},
        ))

    # 3. OTP Not Verified
    if not details.otp_verified:
        flags.append(AnomalyFlagResult(
            anomaly_code="IDENTITY_OTP_NOT_VERIFIED",
            severity="Medium",
            score=25,
            rationale="Mobile OTP verification was not completed. Applicant's mobile number ownership cannot be confirmed.",
            evidence_json={"otp_verified": False, "mobile_number": details.mobile_number},
        ))

    # 4. Duplicate Aadhaar — same aadhaar_ref on a different application
    duplicate_apps = (
        db.query(PMKisanApplicationDetails)
        .filter(
            PMKisanApplicationDetails.aadhaar_ref == details.aadhaar_ref,
            PMKisanApplicationDetails.application_id != details.application_id,
        )
        .all()
    )
    if duplicate_apps:
        conflict_ids = [d.application_id for d in duplicate_apps]
        flags.append(AnomalyFlagResult(
            anomaly_code="IDENTITY_DUPLICATE_AADHAAR",
            severity="Critical",
            score=55,
            rationale=(
                f"Aadhaar reference hash ({details.aadhaar_masked}) is linked to "
                f"{len(conflict_ids)} other PM-KISAN application(s). Duplicate identity detected."
            ),
            evidence_json={
                "duplicate_count": len(conflict_ids),
                "conflicting_application_ids": conflict_ids,
                "aadhaar_masked": details.aadhaar_masked,
            },
        ))

    # 5. Bulk Mobile — same mobile number on multiple applications
    mobile_apps = (
        db.query(PMKisanApplicationDetails)
        .filter(
            PMKisanApplicationDetails.mobile_number == details.mobile_number,
            PMKisanApplicationDetails.application_id != details.application_id,
        )
        .all()
    )
    shared_count = len(mobile_apps)
    if shared_count >= 3:
        flags.append(AnomalyFlagResult(
            anomaly_code="IDENTITY_BULK_MOBILE",
            severity="High",
            score=40,
            rationale=(
                f"Mobile number {details.mobile_number} is shared across {shared_count + 1} "
                f"applications. Bulk registration using a single SIM card indicates potential fraud."
            ),
            evidence_json={"mobile_number": details.mobile_number, "shared_count": shared_count + 1},
        ))
    elif shared_count >= 1:
        flags.append(AnomalyFlagResult(
            anomaly_code="IDENTITY_BULK_MOBILE",
            severity="Medium",
            score=25,
            rationale=(
                f"Mobile number {details.mobile_number} is shared across {shared_count + 1} applications. "
                f"Multiple registrations with the same mobile may indicate a proxy submission."
            ),
            evidence_json={"mobile_number": details.mobile_number, "shared_count": shared_count + 1},
        ))

    return flags
