"""
Temporal Spike Anomaly Engine — ENG-07

Detects abnormal application submission surges in a district within 48 hours
before a PM-KISAN milestone event (installment release, eKYC deadline, etc.).

Surge ratios compared to 14-day baseline:
  - > 3.0x expected → TEMPORAL_SPIKE_MEDIUM (Medium, 25)
  - > 5.0x expected → TEMPORAL_SPIKE_HIGH   (High, 40)
"""
import datetime
from typing import List
from sqlalchemy.orm import Session

from app.models import EventCalendarMaster, Application, PMKisanApplicationDetails
from app.services.engine_types import AnomalyFlagResult

SURGE_MEDIUM_RATIO = 3.0
SURGE_HIGH_RATIO = 5.0
PRE_EVENT_WINDOW_HOURS = 48
BASELINE_WINDOW_DAYS = 14


def run(details: PMKisanApplicationDetails, db: Session) -> List[AnomalyFlagResult]:
    """Run the Temporal Spike engine to detect pre-milestone submission surges."""
    flags: List[AnomalyFlagResult] = []

    now = datetime.datetime.utcnow()
    window_end = now + datetime.timedelta(hours=PRE_EVENT_WINDOW_HOURS)

    # Query upcoming milestone events for this district within the next 48 hours
    upcoming_events = (
        db.query(EventCalendarMaster)
        .filter(
            EventCalendarMaster.district_code == details.district_code,
            EventCalendarMaster.event_date >= now.date(),
            EventCalendarMaster.event_date <= window_end.date(),
        )
        .all()
    )

    if not upcoming_events:
        return flags

    # Take the nearest upcoming event for reporting
    nearest_event = min(upcoming_events, key=lambda e: e.event_date)

    # Compute 14-day baseline submission rate for the district
    baseline_start = now - datetime.timedelta(days=BASELINE_WINDOW_DAYS)
    total_14d = (
        db.query(Application)
        .join(PMKisanApplicationDetails, Application.id == PMKisanApplicationDetails.application_id)
        .filter(
            PMKisanApplicationDetails.district_code == details.district_code,
            Application.submitted_at >= baseline_start,
            Application.submitted_at <= now,
        )
        .count()
    )

    baseline_rate_per_day = total_14d / BASELINE_WINDOW_DAYS if total_14d > 0 else 0.0
    expected_48h = baseline_rate_per_day * 2  # Expected count in 48h window

    if expected_48h == 0:
        return flags

    # Count applications submitted in the last 48 hours from this district
    window_48h_start = now - datetime.timedelta(hours=PRE_EVENT_WINDOW_HOURS)
    recent_48h = (
        db.query(Application)
        .join(PMKisanApplicationDetails, Application.id == PMKisanApplicationDetails.application_id)
        .filter(
            PMKisanApplicationDetails.district_code == details.district_code,
            Application.submitted_at >= window_48h_start,
        )
        .count()
    )

    surge_ratio = recent_48h / expected_48h

    event_date_str = nearest_event.event_date.isoformat()
    event_type = nearest_event.event_type

    evidence = {
        "district_code": details.district_code,
        "recent_48h_count": recent_48h,
        "expected_48h": round(expected_48h, 2),
        "surge_ratio": round(surge_ratio, 3),
        "upcoming_event_date": event_date_str,
        "upcoming_event_type": event_type,
        "baseline_14d_count": total_14d,
    }

    if surge_ratio > SURGE_HIGH_RATIO:
        flags.append(AnomalyFlagResult(
            anomaly_code="TEMPORAL_SPIKE_HIGH",
            severity="High",
            score=40,
            rationale=(
                f"District '{details.district_code}' shows a {surge_ratio:.1f}x submission surge "
                f"in the 48 hours preceding '{event_type}' milestone on {event_date_str}. "
                f"Received {recent_48h} applications vs. expected ~{expected_48h:.1f}. "
                f"Extreme spikes indicate coordinated pre-deadline registration fraud."
            ),
            evidence_json=evidence,
        ))
    elif surge_ratio > SURGE_MEDIUM_RATIO:
        flags.append(AnomalyFlagResult(
            anomaly_code="TEMPORAL_SPIKE_MEDIUM",
            severity="Medium",
            score=25,
            rationale=(
                f"District '{details.district_code}' shows a {surge_ratio:.1f}x submission surge "
                f"in the 48 hours preceding '{event_type}' milestone on {event_date_str}. "
                f"Received {recent_48h} applications vs. expected ~{expected_48h:.1f}. "
                f"Elevated surge warrants monitoring for bulk registration patterns."
            ),
            evidence_json=evidence,
        ))

    return flags
