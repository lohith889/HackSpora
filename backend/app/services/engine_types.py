from dataclasses import dataclass, field
from typing import Any, Dict, Optional

SEVERITY_SCORES: Dict[str, int] = {
    "Low": 10,
    "Medium": 25,
    "High": 40,
    "Critical": 55,
}


@dataclass
class AnomalyFlagResult:
    """Structured result from any anomaly detection engine."""
    anomaly_code: str
    severity: str              # "Low" | "Medium" | "High" | "Critical"
    score: int                 # Contribution to cumulative risk score
    rationale: str             # Human-readable explanation for scheme officer
    evidence_json: Optional[Dict[str, Any]] = field(default_factory=dict)
