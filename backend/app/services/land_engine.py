"""
Land Record Anomaly Engine — ENG-02

Checks against land_records_master:
  1. LAND_PARCEL_NOT_FOUND        — parcel_id absent from state land registry
  2. LAND_OWNER_AADHAAR_MISMATCH — registered owner Aadhaar ref differs from applicant
  3. LAND_OWNER_NAME_MISMATCH    — fuzzy name mismatch between applicant and registry
  4. LAND_NOT_AGRICULTURAL       — parcel is not classified as agricultural land
  5. LAND_OWNERSHIP_INACTIVE     — ownership status is not ACTIVE (DISPUTED/INACTIVE)
  6. LAND_AREA_DISCREPANCY       — declared area deviates significantly from registry
"""
from typing import List
from sqlalchemy.orm import Session
from thefuzz import fuzz

from app.models import LandRecordMaster, PMKisanApplicationDetails
from app.services.engine_types import AnomalyFlagResult

# Fuzzy match thresholds: below these → anomaly
NAME_MISMATCH_HIGH_THRESHOLD = 65    # < 65 → High anomaly
NAME_MISMATCH_MEDIUM_THRESHOLD = 80  # < 80 → Medium anomaly

# Area discrepancy thresholds (percentage difference)
AREA_HIGH_PCT = 50   # >50% deviation → High anomaly
AREA_MEDIUM_PCT = 20 # >20% deviation → Medium anomaly


def run(details: PMKisanApplicationDetails, db: Session) -> List[AnomalyFlagResult]:
    """Run the Land Record anomaly engine against the submitted application."""
    flags: List[AnomalyFlagResult] = []

    # 1. Parcel existence check
    master = (
        db.query(LandRecordMaster)
        .filter(LandRecordMaster.parcel_id == details.parcel_id)
        .first()
    )
    if master is None:
        flags.append(AnomalyFlagResult(
            anomaly_code="LAND_PARCEL_NOT_FOUND",
            severity="Critical",
            score=55,
            rationale=(
                f"Land parcel '{details.parcel_id}' does not exist in the State Digital Land Registry "
                f"(Bhulekh). Applicant may be claiming rights over non-existent or unregistered land."
            ),
            evidence_json={"declared_parcel_id": details.parcel_id},
        ))
        # Cannot run further checks without a master record
        return flags

    # 2. Owner Aadhaar mismatch
    if master.owner_aadhaar_ref and master.owner_aadhaar_ref != details.aadhaar_ref:
        flags.append(AnomalyFlagResult(
            anomaly_code="LAND_OWNER_AADHAAR_MISMATCH",
            severity="High",
            score=40,
            rationale=(
                f"The registered owner Aadhaar hash for parcel '{details.parcel_id}' does not match "
                f"the applicant's Aadhaar. Applicant may not be the lawful titleholder."
            ),
            evidence_json={
                "parcel_id": details.parcel_id,
                "master_aadhaar_ref_prefix": master.owner_aadhaar_ref[:8] + "...",
                "applicant_aadhaar_masked": details.aadhaar_masked,
                "applicant_aadhaar_ref_prefix": details.aadhaar_ref[:8] + "...",
            },
        ))

    # 3. Owner name fuzzy mismatch
    applicant_name_lower = details.farmer_name.lower().strip()
    master_name_lower = master.owner_name.lower().strip()
    fuzzy_score = fuzz.token_sort_ratio(applicant_name_lower, master_name_lower)

    if fuzzy_score < NAME_MISMATCH_HIGH_THRESHOLD:
        flags.append(AnomalyFlagResult(
            anomaly_code="LAND_OWNER_NAME_MISMATCH",
            severity="High",
            score=40,
            rationale=(
                f"Applicant name '{details.farmer_name}' significantly mismatches the registered owner "
                f"name '{master.owner_name}' in land records (fuzzy match: {fuzzy_score}%)."
            ),
            evidence_json={
                "declared_name": details.farmer_name,
                "master_owner_name": master.owner_name,
                "fuzzy_score": fuzzy_score,
                "threshold": NAME_MISMATCH_HIGH_THRESHOLD,
            },
        ))
    elif fuzzy_score < NAME_MISMATCH_MEDIUM_THRESHOLD:
        flags.append(AnomalyFlagResult(
            anomaly_code="LAND_OWNER_NAME_MISMATCH",
            severity="Medium",
            score=25,
            rationale=(
                f"Applicant name '{details.farmer_name}' partially mismatches registered owner "
                f"'{master.owner_name}' in land records (fuzzy match: {fuzzy_score}%). "
                f"May be a transliteration variant or transcription error."
            ),
            evidence_json={
                "declared_name": details.farmer_name,
                "master_owner_name": master.owner_name,
                "fuzzy_score": fuzzy_score,
                "threshold": NAME_MISMATCH_MEDIUM_THRESHOLD,
            },
        ))

    # 4. Non-agricultural land
    if not master.agricultural_land_flag:
        flags.append(AnomalyFlagResult(
            anomaly_code="LAND_NOT_AGRICULTURAL",
            severity="High",
            score=40,
            rationale=(
                f"Parcel '{details.parcel_id}' is classified as '{master.land_use_code}' in state records, "
                f"not as agricultural land. PM-KISAN benefits are restricted to agricultural landholders."
            ),
            evidence_json={
                "parcel_id": details.parcel_id,
                "land_use_code": master.land_use_code,
                "agricultural_land_flag": master.agricultural_land_flag,
            },
        ))

    # 5. Inactive ownership
    if master.ownership_status != "ACTIVE":
        flags.append(AnomalyFlagResult(
            anomaly_code="LAND_OWNERSHIP_INACTIVE",
            severity="Medium",
            score=25,
            rationale=(
                f"Ownership status for parcel '{details.parcel_id}' is '{master.ownership_status}' "
                f"in state land registry. Only ACTIVE ownership qualifies for PM-KISAN entitlement."
            ),
            evidence_json={
                "parcel_id": details.parcel_id,
                "ownership_status": master.ownership_status,
            },
        ))

    # 6. Land area discrepancy
    if master.land_area_ha > 0:
        pct_diff = abs(details.declared_land_area_ha - master.land_area_ha) / master.land_area_ha * 100
        if pct_diff > AREA_HIGH_PCT:
            flags.append(AnomalyFlagResult(
                anomaly_code="LAND_AREA_DISCREPANCY",
                severity="High",
                score=40,
                rationale=(
                    f"Declared land area ({details.declared_land_area_ha:.2f} Ha) deviates by "
                    f"{pct_diff:.1f}% from registered area ({master.land_area_ha:.2f} Ha) — "
                    f"significant discrepancy suggests over-declaration of cultivable land."
                ),
                evidence_json={
                    "declared_ha": details.declared_land_area_ha,
                    "master_ha": master.land_area_ha,
                    "pct_diff": round(pct_diff, 2),
                    "threshold": AREA_HIGH_PCT,
                },
            ))
        elif pct_diff > AREA_MEDIUM_PCT:
            flags.append(AnomalyFlagResult(
                anomaly_code="LAND_AREA_DISCREPANCY",
                severity="Medium",
                score=25,
                rationale=(
                    f"Declared land area ({details.declared_land_area_ha:.2f} Ha) deviates by "
                    f"{pct_diff:.1f}% from registered area ({master.land_area_ha:.2f} Ha). "
                    f"Minor discrepancy — may require Patwari confirmation."
                ),
                evidence_json={
                    "declared_ha": details.declared_land_area_ha,
                    "master_ha": master.land_area_ha,
                    "pct_diff": round(pct_diff, 2),
                    "threshold": AREA_MEDIUM_PCT,
                },
            ))

    return flags
