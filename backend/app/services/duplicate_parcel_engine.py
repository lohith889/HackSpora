"""
Duplicate Parcel Anomaly Engine — ENG-05

Detects when the same land parcel (parcel_id) is claimed across multiple applications:
  1. PARCEL_DUPLICATE_CLAIM    — 1 other application claims the same parcel
  2. PARCEL_SYNDICATE_PATTERN  — 3+ applications claim the same parcel (coordinated fraud)
"""
from typing import List
from sqlalchemy.orm import Session

from app.models import PMKisanApplicationDetails
from app.services.engine_types import AnomalyFlagResult


def run(details: PMKisanApplicationDetails, db: Session) -> List[AnomalyFlagResult]:
    """Run the Duplicate Parcel engine to detect cross-application land conflicts."""
    flags: List[AnomalyFlagResult] = []

    conflicting = (
        db.query(PMKisanApplicationDetails)
        .filter(
            PMKisanApplicationDetails.parcel_id == details.parcel_id,
            PMKisanApplicationDetails.application_id != details.application_id,
        )
        .all()
    )

    if not conflicting:
        return flags

    conflict_app_ids = [c.application_id for c in conflicting]
    distinct_aadhaar_refs = len(set(c.aadhaar_ref for c in conflicting))
    total_claims = len(conflicting) + 1  # Including current

    if len(conflicting) >= 2:
        flags.append(AnomalyFlagResult(
            anomaly_code="PARCEL_SYNDICATE_PATTERN",
            severity="Critical",
            score=55,
            rationale=(
                f"Land parcel '{details.parcel_id}' is claimed in {total_claims} separate applications "
                f"across {distinct_aadhaar_refs + 1} distinct Aadhaar identities. "
                f"This volume of claims on a single parcel indicates a coordinated fraud syndicate."
            ),
            evidence_json={
                "parcel_id": details.parcel_id,
                "total_claims": total_claims,
                "conflicting_application_ids": conflict_app_ids,
                "distinct_aadhaar_refs": distinct_aadhaar_refs + 1,
            },
        ))
    else:
        flags.append(AnomalyFlagResult(
            anomaly_code="PARCEL_DUPLICATE_CLAIM",
            severity="High",
            score=40,
            rationale=(
                f"Land parcel '{details.parcel_id}' is also claimed in application "
                f"#{conflict_app_ids[0]}. A single parcel cannot qualify for PM-KISAN "
                f"benefits in more than one application."
            ),
            evidence_json={
                "parcel_id": details.parcel_id,
                "conflicting_application_ids": conflict_app_ids,
                "distinct_aadhaar_refs": distinct_aadhaar_refs + 1,
            },
        ))

    return flags
