"""
Risk Scoring Engine — RISK-01

Computes cumulative weighted risk score (0 to 100) based on all triggered anomaly flags.
Decoupled from Confidence Score (which measures evidence certainty).

Risk Tiers:
  - 0 - 24:   Low Risk (Clean application, standard verification)
  - 25 - 49:  Moderate Risk (Discrepancy detected, officer review required)
  - 50 - 74:  High Risk (Multiple discrepancies, field inspection advised)
  - 75 - 100: Critical Risk (Strong indicators of ineligible/fraudulent claim)
"""
from typing import List, Tuple
from app.services.engine_types import AnomalyFlagResult


def compute_risk_score(flags: List[AnomalyFlagResult]) -> int:
    """
    Sum the scores of all unique triggered anomaly flags, capped at 100.
    Severity score contributions:
      Low: 10
      Medium: 25
      High: 40
      Critical: 55
    """
    if not flags:
        return 0

    total_score = sum(flag.score for flag in flags)
    return min(100, max(0, total_score))


def compute_hybrid_risk_score(
    rule_score: int,
    ml_score: int,
    is_statutory_override: bool = False,
) -> int:
    """
    Two-stage hybrid fusion:
    - If statutory override is True -> 100
    - Otherwise max(rule_score, ml_score) to ensure non-linear syndicate risks are not diluted.
    """
    if is_statutory_override:
        return 100
    return min(100, max(0, max(rule_score, ml_score)))


def get_risk_tier(risk_score: int) -> str:
    """Return categorical risk tier."""
    if risk_score >= 75:
        return "Critical"
    elif risk_score >= 50:
        return "High"
    elif risk_score >= 25:
        return "Moderate"
    return "Low"


def get_recommended_action(risk_score: int, flags: List[AnomalyFlagResult]) -> str:
    """
    Generate triage recommendation for the reviewing Scheme Officer.
    CRITICAL ARCHITECTURE PRINCIPLE:
    This is an advisory recommendation ONLY. The system NEVER automatically
    approves, rejects, or disburses payment; the Scheme Officer retains sole
    adjudication authority via explicit manual decision.
    """
    codes = {f.anomaly_code for f in flags}

    # Hard disqualification recommendation
    if any(c in codes for c in ["EXCLUSION_DECEASED", "EXCLUSION_TAXPAYER", "EXCLUSION_GOVT_EMPLOYEE"]):
        return "Recommend Rejection (Statutory Exclusion Hit)"

    if "LAND_PARCEL_NOT_FOUND" in codes or "PARCEL_SYNDICATE_PATTERN" in codes:
        return "Recommend Rejection (Invalid Land Title / Syndicate Claim)"

    if risk_score >= 75:
        return "Recommend Hold & Formal Investigation"
    elif risk_score >= 50:
        return "Recommend Physical Field Verification (Patwari)"
    elif risk_score >= 25:
        return "Recommend Document Clarification from Farmer"
    else:
        return "Recommend Officer Approval (Clean Verification)"
