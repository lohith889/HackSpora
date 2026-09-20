"""
ML Feature Vector Extractor — XGB-02

Serializes PM-KISAN application claims and multi-engine verification signals
into a canonical 24-dimensional normalized numerical feature vector for
supervised XGBoost evaluation and TreeSHAP attribution.
"""
import time
import datetime
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from sqlalchemy.orm import Session

from app.models import (
    PMKisanApplicationDetails,
    LandRecordMaster,
    BankValidationMaster,
    EventCalendarMaster,
)
from app.services.engine_types import AnomalyFlagResult

_UPCOMING_EVENT_CACHE: Optional[Tuple[float, float]] = None

# Canonical ordered feature keys (exactly 24 dimensions)
FEATURE_NAMES: Tuple[str, ...] = (
    "declared_land_area_ha",
    "applicant_age_years",
    "days_to_nearest_event",
    "fuzzy_name_match_score",
    "dob_match_flag",
    "mobile_shared_count",
    "bank_account_shared_count",
    "bank_penny_drop_status",
    "bank_name_fuzzy_score",
    "land_record_found",
    "land_area_discrepancy_ratio",
    "land_owner_aadhaar_match",
    "is_agricultural_land",
    "statutory_exclusion_hit",
    "duplicate_parcel_claim_count",
    "village_density_ratio",
    "temporal_surge_velocity_ratio",
    "isolation_forest_anomaly_score",
    "syndicate_cluster_size",
    "engine_flags_total_count",
    "engine_critical_flags_count",
    "engine_high_flags_count",
    "engine_medium_flags_count",
    "engine_low_flags_count",
)

FEATURE_DESCRIPTIONS: Dict[str, str] = {
    "declared_land_area_ha": "Cultivable land area declared in application (hectares)",
    "applicant_age_years": "Applicant age in years derived from verified Date of Birth",
    "days_to_nearest_event": "Days proximity to nearest PM-KISAN installment milestone",
    "fuzzy_name_match_score": "Fuzzy token similarity between declared name and land registry name (0-100)",
    "dob_match_flag": "Consistency of Date of Birth across Identity and Aadhaar e-KYC (1=Match, 0=Discrepancy)",
    "mobile_shared_count": "Number of applications associated with the same mobile number",
    "bank_account_shared_count": "Number of applications claiming benefits into the same bank account",
    "bank_penny_drop_status": "PFMS Penny-drop automated bank account active confirmation (1=Active, 0=Inactive/Fail)",
    "bank_name_fuzzy_score": "Fuzzy name match between applicant name and bank account titleholder (0-100)",
    "land_record_found": "Official Bhulekh cadastral title record found in land master registry (1=Yes, 0=Missing)",
    "land_area_discrepancy_ratio": "Ratio of declared cultivable land area to Bhulekh registered land area",
    "land_owner_aadhaar_match": "Land registry title owner matches applicant Aadhaar identity token (1=Yes, 0=No)",
    "is_agricultural_land": "Cadastral land parcel zoning is verified agricultural (1=Yes, 0=Non-agricultural)",
    "statutory_exclusion_hit": "Hit in exclusion master registry (Taxpayer, Civil Servant, Deceased, Institutional) (1=Hit, 0=Clear)",
    "duplicate_parcel_claim_count": "Number of other applications claiming subsidies on this exact cadastral parcel",
    "village_density_ratio": "Village registration volume relative to historical cultivator baseline",
    "temporal_surge_velocity_ratio": "District registration velocity within 48h pre-event relative to 14-day baseline",
    "isolation_forest_anomaly_score": "Unsupervised multivariate outlier decision score (-0.5 to 0.5)",
    "syndicate_cluster_size": "NetworkX heterogeneous syndicate graph connected component size",
    "engine_flags_total_count": "Total count of anomaly flags triggered across all engines",
    "engine_critical_flags_count": "Count of Critical severity anomaly flags triggered",
    "engine_high_flags_count": "Count of High severity anomaly flags triggered",
    "engine_medium_flags_count": "Count of Medium severity anomaly flags triggered",
    "engine_low_flags_count": "Count of Low severity anomaly flags triggered",
}


def extract_feature_vector(
    details: PMKisanApplicationDetails,
    flags: List[AnomalyFlagResult],
    db: Optional[Session] = None,
) -> np.ndarray:
    """
    Extract a normalized 24-dimensional NumPy feature vector from application
    details and triggered engine flags. Imputes missing signals safely to prevent NaNs.
    """
    flag_codes = {f.anomaly_code: f for f in flags}
    features: Dict[str, float] = {}

    # 1. Declared Land Area
    features["declared_land_area_ha"] = float(details.declared_land_area_ha or 0.0)

    # 2. Applicant Age
    if details.date_of_birth:
        today = datetime.date.today()
        dob = details.date_of_birth
        age = (today - dob).days / 365.25
        features["applicant_age_years"] = max(18.0, min(100.0, float(age)))
    else:
        features["applicant_age_years"] = 45.0  # Safe rural median

    # 3. Days to nearest calendar event
    global _UPCOMING_EVENT_CACHE
    days_to_event = 30.0
    now_ts = time.time()
    if _UPCOMING_EVENT_CACHE is not None and (now_ts - _UPCOMING_EVENT_CACHE[0]) < 60.0:
        days_to_event = _UPCOMING_EVENT_CACHE[1]
    elif db:
        try:
            today_date = datetime.date.today()
            upcoming_event = (
                db.query(EventCalendarMaster)
                .filter(EventCalendarMaster.event_date >= today_date)
                .order_by(EventCalendarMaster.event_date.asc())
                .first()
            )
            if upcoming_event:
                days_to_event = float((upcoming_event.event_date - today_date).days)
            _UPCOMING_EVENT_CACHE = (now_ts, days_to_event)
        except Exception:
            days_to_event = 30.0
    features["days_to_nearest_event"] = max(0.0, days_to_event)

    # 4. Fuzzy Name Match Score (0 - 100)
    name_score = 100.0
    if "LAND_NAME_MISMATCH_SUSPECT" in flag_codes:
        ev = flag_codes["LAND_NAME_MISMATCH_SUSPECT"].evidence_json or {}
        name_score = float(ev.get("similarity_score", 65.0))
    elif "IDENTITY_NAME_MISMATCH" in flag_codes:
        ev = flag_codes["IDENTITY_NAME_MISMATCH"].evidence_json or {}
        name_score = float(ev.get("similarity_score", 60.0))
    features["fuzzy_name_match_score"] = max(0.0, min(100.0, name_score))

    # 5. DOB Match Flag
    features["dob_match_flag"] = 0.0 if "IDENTITY_DOB_MISMATCH" in flag_codes else 1.0

    # 6. Mobile Shared Count
    mobile_shared = 1
    if "IDENTITY_MOBILE_REUSED" in flag_codes:
        ev = flag_codes["IDENTITY_MOBILE_REUSED"].evidence_json or {}
        mobile_shared = int(ev.get("application_count", 3))
    elif flags is None and db and details.mobile_number:
        try:
            mobile_shared = (
                db.query(PMKisanApplicationDetails)
                .filter(PMKisanApplicationDetails.mobile_number == details.mobile_number)
                .count()
            )
        except Exception:
            mobile_shared = 1
    features["mobile_shared_count"] = float(max(1, mobile_shared))

    # 7. Bank Account Shared Count
    bank_shared = 1
    if "BANK_ACCOUNT_SHARED_MULE" in flag_codes:
        ev = flag_codes["BANK_ACCOUNT_SHARED_MULE"].evidence_json or {}
        bank_shared = int(ev.get("shared_count", 3))
    elif flags is None and db and details.bank_account_ifsc_key:
        try:
            bank_shared = (
                db.query(PMKisanApplicationDetails)
                .filter(PMKisanApplicationDetails.bank_account_ifsc_key == details.bank_account_ifsc_key)
                .count()
            )
        except Exception:
            bank_shared = 1
    features["bank_account_shared_count"] = float(max(1, bank_shared))

    # 8. Bank Penny Drop Status (1=Active, 0=Inactive/Fail)
    bank_inactive = any(c in flag_codes for c in ["BANK_ACCOUNT_INACTIVE", "BANK_ACCOUNT_NOT_FOUND", "BANK_IFSC_INVALID"])
    features["bank_penny_drop_status"] = 0.0 if bank_inactive else 1.0

    # 9. Bank Name Fuzzy Score
    bank_name_score = 100.0
    if "BANK_HOLDER_NAME_MISMATCH" in flag_codes:
        ev = flag_codes["BANK_HOLDER_NAME_MISMATCH"].evidence_json or {}
        bank_name_score = float(ev.get("similarity_score", 55.0))
    features["bank_name_fuzzy_score"] = max(0.0, min(100.0, bank_name_score))

    # 10. Land Record Found
    features["land_record_found"] = 0.0 if "LAND_PARCEL_NOT_FOUND" in flag_codes else 1.0

    # 11. Land Area Discrepancy Ratio
    area_ratio = 1.0
    if "LAND_AREA_EXCEEDED" in flag_codes:
        ev = flag_codes["LAND_AREA_EXCEEDED"].evidence_json or {}
        declared = float(ev.get("declared_area_ha", details.declared_land_area_ha or 1.0))
        actual = float(ev.get("registered_area_ha", 1.0))
        area_ratio = declared / max(0.01, actual)
    features["land_area_discrepancy_ratio"] = float(area_ratio)

    # 12. Land Owner Aadhaar Match
    owner_mismatch = "LAND_OWNER_MISMATCH" in flag_codes
    features["land_owner_aadhaar_match"] = 0.0 if owner_mismatch else 1.0

    # 13. Is Agricultural Land
    non_agri = "LAND_USE_NON_AGRICULTURAL" in flag_codes
    features["is_agricultural_land"] = 0.0 if non_agri else 1.0

    # 14. Statutory Exclusion Hit (Taxpayer, Govt, Deceased, Pensioner, Institutional)
    exclusion_hit = any(c.startswith("EXCLUSION_") for c in flag_codes)
    features["statutory_exclusion_hit"] = 1.0 if exclusion_hit else 0.0

    # 15. Duplicate Parcel Claim Count
    dup_parcel_count = 1
    if "PARCEL_DUPLICATE_CLAIM" in flag_codes:
        ev = flag_codes["PARCEL_DUPLICATE_CLAIM"].evidence_json or {}
        dup_parcel_count = int(ev.get("existing_applications_count", 2))
    elif flags is None and db and details.parcel_id:
        try:
            dup_parcel_count = (
                db.query(PMKisanApplicationDetails)
                .filter(PMKisanApplicationDetails.parcel_id == details.parcel_id)
                .count()
            )
        except Exception:
            dup_parcel_count = 1
    features["duplicate_parcel_claim_count"] = float(max(1, dup_parcel_count))

    # 16. Village Density Ratio
    village_ratio = 1.0
    if "STAT_VILLAGE_DENSITY_SPIKE" in flag_codes:
        ev = flag_codes["STAT_VILLAGE_DENSITY_SPIKE"].evidence_json or {}
        village_ratio = float(ev.get("density_ratio", 2.6))
    elif "STAT_VILLAGE_DENSITY_HIGH" in flag_codes:
        ev = flag_codes["STAT_VILLAGE_DENSITY_HIGH"].evidence_json or {}
        village_ratio = float(ev.get("density_ratio", 1.8))
    features["village_density_ratio"] = float(village_ratio)

    # 17. Temporal Surge Velocity Ratio
    temporal_ratio = 1.0
    if "TEMPORAL_PRE_EVENT_SURGE" in flag_codes:
        ev = flag_codes["TEMPORAL_PRE_EVENT_SURGE"].evidence_json or {}
        temporal_ratio = float(ev.get("velocity_ratio", 4.2))
    features["temporal_surge_velocity_ratio"] = float(temporal_ratio)

    # 18. Isolation Forest Anomaly Score
    iso_score = 0.1
    if "ML_OUTLIER_DETECTED" in flag_codes:
        ev = flag_codes["ML_OUTLIER_DETECTED"].evidence_json or {}
        iso_score = float(ev.get("anomaly_score", -0.25))
    features["isolation_forest_anomaly_score"] = float(iso_score)

    # 19. Syndicate Cluster Size
    cluster_sz = 1
    if "PARCEL_SYNDICATE_PATTERN" in flag_codes:
        ev = flag_codes["PARCEL_SYNDICATE_PATTERN"].evidence_json or {}
        cluster_sz = int(ev.get("cluster_size", 4))
    elif "CLUSTER_SHARED_BANK" in flag_codes:
        ev = flag_codes["CLUSTER_SHARED_BANK"].evidence_json or {}
        cluster_sz = int(ev.get("cluster_size", 3))
    elif "CLUSTER_SHARED_MOBILE" in flag_codes:
        ev = flag_codes["CLUSTER_SHARED_MOBILE"].evidence_json or {}
        cluster_sz = int(ev.get("cluster_size", 3))
    features["syndicate_cluster_size"] = float(cluster_sz)

    # 20. Engine Flags Total Count
    features["engine_flags_total_count"] = float(len(flags))

    # 21-24. Flags Severity Counts
    features["engine_critical_flags_count"] = float(sum(1 for f in flags if f.severity == "Critical"))
    features["engine_high_flags_count"] = float(sum(1 for f in flags if f.severity == "High"))
    features["engine_medium_flags_count"] = float(sum(1 for f in flags if f.severity == "Medium"))
    features["engine_low_flags_count"] = float(sum(1 for f in flags if f.severity == "Low"))

    # Construct ordered numpy array matching FEATURE_NAMES
    vector = np.array([features[name] for name in FEATURE_NAMES], dtype=np.float32)
    return vector


def get_feature_description(feature_name: str) -> str:
    """Retrieve plain-English description of a feature for audit presentation."""
    return FEATURE_DESCRIPTIONS.get(feature_name, feature_name.replace("_", " ").title())
