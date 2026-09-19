"""
Bank Validation Anomaly Engine — ENG-03

Checks against bank_validation_master:
  1. BANK_ACCOUNT_NOT_FOUND  — account+IFSC combination absent from banking master
  2. BANK_IFSC_INVALID        — IFSC code flagged as invalid in master record
  3. BANK_ACCOUNT_INACTIVE   — Account status is INACTIVE, CLOSED, or FROZEN
  4. BANK_PENNY_DROP_FAILED  — Mock penny-drop verification did not succeed
  5. BANK_NAME_MISMATCH      — Fuzzy name mismatch between farmer and bank account holder
  6. BANK_MULE_ACCOUNT       — Same bank account linked to multiple distinct Aadhaar refs (mule account)
"""
from typing import List
from sqlalchemy.orm import Session
from thefuzz import fuzz

from app.models import BankValidationMaster, PMKisanApplicationDetails
from app.services.engine_types import AnomalyFlagResult

NAME_MISMATCH_HIGH_THRESHOLD = 65
NAME_MISMATCH_MEDIUM_THRESHOLD = 80
MULE_DISTINCT_APPLICANT_THRESHOLD = 2  # 2+ distinct Aadhaar refs sharing the same bank account


def run(details: PMKisanApplicationDetails, db: Session) -> List[AnomalyFlagResult]:
    """Run the Bank Validation anomaly engine against the submitted application."""
    flags: List[AnomalyFlagResult] = []

    # Query bank master record
    master = (
        db.query(BankValidationMaster)
        .filter(BankValidationMaster.bank_account_ifsc_key == details.bank_account_ifsc_key)
        .first()
    )

    # 1. Account not found in banking master
    if master is None:
        flags.append(AnomalyFlagResult(
            anomaly_code="BANK_ACCOUNT_NOT_FOUND",
            severity="High",
            score=40,
            rationale=(
                f"Bank account '{details.bank_account_number}' with IFSC '{details.ifsc_code}' "
                f"was not found in the PFMS bank validation registry. "
                f"Account may be non-existent or not verified."
            ),
            evidence_json={
                "bank_account_ifsc_key": details.bank_account_ifsc_key,
                "ifsc_code": details.ifsc_code,
            },
        ))
        # Without a master record, can't run subsequent checks
        return flags

    # 2. IFSC invalid
    if not master.ifsc_valid:
        flags.append(AnomalyFlagResult(
            anomaly_code="BANK_IFSC_INVALID",
            severity="High",
            score=40,
            rationale=(
                f"IFSC code '{details.ifsc_code}' is flagged as invalid in the RBI/NPCI banking "
                f"registry. DBT transfers to this account would fail."
            ),
            evidence_json={"ifsc_code": details.ifsc_code, "ifsc_valid": master.ifsc_valid},
        ))

    # 3. Account inactive / closed / frozen
    if master.account_status != "ACTIVE":
        flags.append(AnomalyFlagResult(
            anomaly_code="BANK_ACCOUNT_INACTIVE",
            severity="High",
            score=40,
            rationale=(
                f"Bank account status is '{master.account_status}'. Only ACTIVE accounts are eligible "
                f"to receive PM-KISAN DBT installments."
            ),
            evidence_json={
                "bank_account_ifsc_key": details.bank_account_ifsc_key,
                "account_status": master.account_status,
            },
        ))

    # 4. Penny-drop verification failed
    if master.penny_drop_status != "SUCCESS":
        flags.append(AnomalyFlagResult(
            anomaly_code="BANK_PENNY_DROP_FAILED",
            severity="Medium",
            score=25,
            rationale=(
                f"Mock penny-drop transaction for account '{details.bank_account_number}' returned "
                f"status '{master.penny_drop_status}'. Account may be unoperational or mismatched."
            ),
            evidence_json={
                "bank_account_number": details.bank_account_number,
                "penny_drop_status": master.penny_drop_status,
            },
        ))

    # 5. Name mismatch between applicant and bank account holder
    applicant_name_lower = details.farmer_name.lower().strip()
    holder_name_lower = master.account_holder_name.lower().strip()
    fuzzy_score = fuzz.token_sort_ratio(applicant_name_lower, holder_name_lower)

    if fuzzy_score < NAME_MISMATCH_HIGH_THRESHOLD:
        flags.append(AnomalyFlagResult(
            anomaly_code="BANK_NAME_MISMATCH",
            severity="High",
            score=40,
            rationale=(
                f"Applicant name '{details.farmer_name}' significantly mismatches bank account holder "
                f"name '{master.account_holder_name}' (fuzzy score: {fuzzy_score}%). "
                f"Account may belong to a different person."
            ),
            evidence_json={
                "declared_name": details.farmer_name,
                "bank_holder_name": master.account_holder_name,
                "fuzzy_score": fuzzy_score,
                "threshold": NAME_MISMATCH_HIGH_THRESHOLD,
            },
        ))
    elif fuzzy_score < NAME_MISMATCH_MEDIUM_THRESHOLD:
        flags.append(AnomalyFlagResult(
            anomaly_code="BANK_NAME_MISMATCH",
            severity="Medium",
            score=25,
            rationale=(
                f"Partial name mismatch between applicant '{details.farmer_name}' and bank account "
                f"holder '{master.account_holder_name}' (fuzzy score: {fuzzy_score}%). "
                f"May be a transliteration difference."
            ),
            evidence_json={
                "declared_name": details.farmer_name,
                "bank_holder_name": master.account_holder_name,
                "fuzzy_score": fuzzy_score,
                "threshold": NAME_MISMATCH_MEDIUM_THRESHOLD,
            },
        ))

    # 6. Mule account detection — same bank account linked to multiple distinct Aadhaar refs
    other_applicants = (
        db.query(PMKisanApplicationDetails)
        .filter(
            PMKisanApplicationDetails.bank_account_ifsc_key == details.bank_account_ifsc_key,
            PMKisanApplicationDetails.aadhaar_ref != details.aadhaar_ref,
            PMKisanApplicationDetails.application_id != details.application_id,
        )
        .all()
    )
    distinct_aadhaar_count = len(set(a.aadhaar_ref for a in other_applicants))

    if distinct_aadhaar_count >= MULE_DISTINCT_APPLICANT_THRESHOLD:
        flags.append(AnomalyFlagResult(
            anomaly_code="BANK_MULE_ACCOUNT",
            severity="Critical",
            score=55,
            rationale=(
                f"Bank account '{details.bank_account_number}' is linked to "
                f"{distinct_aadhaar_count + 1} distinct Aadhaar identities. "
                f"Strong indicator of a mule account used to funnel subsidy payments."
            ),
            evidence_json={
                "bank_account_ifsc_key": details.bank_account_ifsc_key,
                "distinct_aadhaar_count": distinct_aadhaar_count + 1,
            },
        ))

    return flags
