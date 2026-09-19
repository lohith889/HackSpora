"""
Anomaly Detection Pipeline Orchestrator

Runs all 7 anomaly engines in sequence, fault-tolerantly collecting
AnomalyFlagResult objects from each engine.
"""
from dataclasses import dataclass, field
from typing import List
from sqlalchemy.orm import Session

from app.models import PMKisanApplicationDetails
from app.services.engine_types import AnomalyFlagResult
from app.services import (
    identity_engine,
    land_engine,
    bank_engine,
    exclusion_engine,
    duplicate_parcel_engine,
    statistical_engine,
    temporal_engine,
    isolation_forest_engine,
)

ENGINES = [
    ("identity_engine",        identity_engine),
    ("land_engine",            land_engine),
    ("bank_engine",            bank_engine),
    ("exclusion_engine",       exclusion_engine),
    ("duplicate_parcel_engine",duplicate_parcel_engine),
    ("statistical_engine",     statistical_engine),
    ("temporal_engine",        temporal_engine),
    ("isolation_forest_engine",isolation_forest_engine),
]


@dataclass
class PipelineResult:
    """Aggregated result from running all 7 anomaly engines."""
    flags: List[AnomalyFlagResult] = field(default_factory=list)
    engines_run: List[str] = field(default_factory=list)
    error_log: List[str] = field(default_factory=list)


def run_pipeline(details: PMKisanApplicationDetails, db: Session) -> PipelineResult:
    """
    Execute all 7 anomaly engines against the submitted application details.
    Each engine is wrapped in a try/except so a single engine failure does not
    block the others or the application submission response.
    """
    result = PipelineResult()

    for engine_name, engine_module in ENGINES:
        try:
            engine_flags = engine_module.run(details, db)
            result.flags.extend(engine_flags)
            result.engines_run.append(engine_name)
        except Exception as exc:
            error_msg = f"{engine_name} raised {type(exc).__name__}: {exc}"
            result.error_log.append(error_msg)

    return result
