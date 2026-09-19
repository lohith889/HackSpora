"""
Statistical & Geographic Anomaly Engine — ENG-06

Measures current application density in a village against historical cultivator baselines.
Thresholds:
  - > 1.75x baseline → STAT_VILLAGE_DENSITY_MEDIUM (Medium, 25)
  - > 2.5x baseline  → STAT_VILLAGE_DENSITY_HIGH   (High, 40)
"""
from typing import List
from sqlalchemy.orm import Session

from app.models import VillageProfileMaster, PMKisanApplicationDetails, Application
from app.services.engine_types import AnomalyFlagResult

DENSITY_MEDIUM_RATIO = 1.75
DENSITY_HIGH_RATIO = 2.50


def run(details: PMKisanApplicationDetails, db: Session) -> List[AnomalyFlagResult]:
    """Run the Statistical/Geographic engine to detect abnormal village application density."""
    flags: List[AnomalyFlagResult] = []

    # Query village baseline profile
    profile = (
        db.query(VillageProfileMaster)
        .filter(VillageProfileMaster.village_code == details.village_code)
        .first()
    )

    if profile is None:
        # No baseline data for this village — cannot compute density
        return flags

    # Determine baseline (prefer historical_beneficiary_count, fallback to cultivator_count_estimate)
    baseline = profile.historical_beneficiary_count
    if baseline == 0:
        baseline = profile.cultivator_count_estimate
    if baseline == 0:
        return flags

    # Count all submitted/active applications from this village (including the current one)
    current_village_count = (
        db.query(PMKisanApplicationDetails)
        .filter(PMKisanApplicationDetails.village_code == details.village_code)
        .count()
    )

    ratio = current_village_count / baseline

    if ratio > DENSITY_HIGH_RATIO:
        flags.append(AnomalyFlagResult(
            anomaly_code="STAT_VILLAGE_DENSITY_HIGH",
            severity="High",
            score=40,
            rationale=(
                f"Village '{details.village_code}' ({profile.village_name}) has {current_village_count} "
                f"applications — {ratio:.2f}x its historical cultivator baseline of {baseline}. "
                f"This extreme density is a strong indicator of coordinated bulk registration."
            ),
            evidence_json={
                "village_code": details.village_code,
                "village_name": profile.village_name,
                "current_count": current_village_count,
                "baseline_count": baseline,
                "ratio": round(ratio, 3),
                "threshold": DENSITY_HIGH_RATIO,
            },
        ))
    elif ratio > DENSITY_MEDIUM_RATIO:
        flags.append(AnomalyFlagResult(
            anomaly_code="STAT_VILLAGE_DENSITY_MEDIUM",
            severity="Medium",
            score=25,
            rationale=(
                f"Village '{details.village_code}' ({profile.village_name}) has {current_village_count} "
                f"applications — {ratio:.2f}x its historical cultivator baseline of {baseline}. "
                f"Above-average application density may warrant field verification."
            ),
            evidence_json={
                "village_code": details.village_code,
                "village_name": profile.village_name,
                "current_count": current_village_count,
                "baseline_count": baseline,
                "ratio": round(ratio, 3),
                "threshold": DENSITY_MEDIUM_RATIO,
            },
        ))

    return flags
