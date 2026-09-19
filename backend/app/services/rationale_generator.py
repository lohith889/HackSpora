"""
Explainable Rationale Generator — RISK-03

Synthesizes structured, plain-English executive summaries explaining:
  1. Risk Score and Severity Tier
  2. Primary Anomaly Drivers & Evidence
  3. Evidence Certainty & Confidence Rating
  4. Suggested Adjudication Action for the Scheme Officer
"""
from typing import List
from app.services.engine_types import AnomalyFlagResult


def generate_rationale(
    risk_score: int,
    confidence_score: int,
    confidence_level: str,
    recommended_action: str,
    flags: List[AnomalyFlagResult],
) -> str:
    """Generate human-readable explainable rationale for the Scheme Officer dossier."""
    if not flags:
        return (
            f"CLEAN APPLICATION (Risk Score: 0/100, Confidence: {confidence_score}% [{confidence_level}]). "
            f"All automated checks passed successfully across Identity, Land Registry, PFMS Banking, "
            f"and Statutory Exclusion registries. No duplicate claims or statistical anomalies detected. "
            f"Action: {recommended_action}."
        )

    # Sort flags by severity score descending (most severe first)
    sorted_flags = sorted(flags, key=lambda f: f.score, reverse=True)
    top_flags = sorted_flags[:3]

    reasons = [f"• {f.anomaly_code}: {f.rationale}" for f in top_flags]
    additional_count = len(sorted_flags) - len(top_flags)
    if additional_count > 0:
        reasons.append(f"• Plus {additional_count} additional secondary flag(s).")

    summary_lines = [
        f"FLAGGED APPLICATION — Cumulative Risk Score: {risk_score}/100 "
        f"(Evidence Certainty: {confidence_score}% [{confidence_level}]).",
        f"Key Detected Anomalies:",
        *reasons,
        f"Advisory Recommendation: {recommended_action}. "
        f"(Scheme Officer manual review and explicit approval/rejection required).",
    ]

    return "\n".join(summary_lines)
