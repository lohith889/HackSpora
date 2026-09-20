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
from thefuzz import fuzz

from app.models import PMKisanApplicationDetails, UIDAIAadhaarMaster
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

    # 6. UIDAI Central Identity Repository Cross-Verification
    uidai_rec = (
        db.query(UIDAIAadhaarMaster)
        .filter(UIDAIAadhaarMaster.aadhaar_ref == details.aadhaar_ref)
        .first()
    )
    if uidai_rec:
        # A. Aadhaar status check (Suspended/Deactivated)
        if uidai_rec.aadhaar_status != "ACTIVE":
            flags.append(AnomalyFlagResult(
                anomaly_code="IDENTITY_AADHAAR_DEACTIVATED",
                severity="Critical",
                score=55,
                rationale=(
                    f"Aadhaar identifier ({details.aadhaar_masked}) is marked as '{uidai_rec.aadhaar_status}' "
                    f"in UIDAI Central Identity Repository. Deactivated or suspended identities cannot receive subsidy benefits."
                ),
                evidence_json={
                    "aadhaar_masked": details.aadhaar_masked,
                    "uidai_status": uidai_rec.aadhaar_status,
                },
            ))

        # B. Demographic Name Matching
        if details.farmer_name and uidai_rec.full_name:
            name_similarity = fuzz.token_sort_ratio(details.farmer_name.lower(), uidai_rec.full_name.lower())
            if name_similarity < 70:
                flags.append(AnomalyFlagResult(
                    anomaly_code="IDENTITY_NAME_MISMATCH_WITH_UIDAI",
                    severity="High",
                    score=40,
                    rationale=(
                        f"Applicant declared name '{details.farmer_name}' significantly deviates from UIDAI registered name "
                        f"'{uidai_rec.full_name}' (fuzzy match: {name_similarity}%). Possible identity spoofing or proxy claim."
                    ),
                    evidence_json={
                        "declared_name": details.farmer_name,
                        "uidai_registered_name": uidai_rec.full_name,
                        "fuzzy_match_score": name_similarity,
                    },
                ))

        # C. Demographic Date of Birth / Age Matching (> 2 years divergence)
        if details.date_of_birth and uidai_rec.date_of_birth:
            diff_days = abs((details.date_of_birth - uidai_rec.date_of_birth).days)
            if diff_days > 730:
                flags.append(AnomalyFlagResult(
                    anomaly_code="IDENTITY_DOB_MISMATCH_WITH_UIDAI",
                    severity="Medium",
                    score=25,
                    rationale=(
                        f"Declared Date of Birth ({details.date_of_birth}) contradicts UIDAI official birth records "
                        f"({uidai_rec.date_of_birth}). Age discrepancy detected."
                    ),
                    evidence_json={
                        "declared_dob": str(details.date_of_birth),
                        "uidai_dob": str(uidai_rec.date_of_birth),
                        "discrepancy_days": diff_days,
                    },
                ))

    return flags
