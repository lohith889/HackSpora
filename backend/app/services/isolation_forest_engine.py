"""
Isolation Forest Machine Learning Anomaly Engine — ENG-08

Unsupervised multidimensional anomaly detection using scikit-learn's IsolationForest.
Detects complex, multivariate anomalies that bypass single-attribute rule thresholds
by evaluating joint distributions of:
  1. Declared Land Area (Hectares)
  2. Land Area Discrepancy Percentage
  3. Applicant Age (Years)
  4. Land Registry Name Fuzzy Match Score (0-100)
  5. Bank Account Holder Name Fuzzy Match Score (0-100)
  6. Village Application Density Ratio
"""
import datetime
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session
from thefuzz import fuzz

from app.models import (
    PMKisanApplicationDetails,
    LandRecordMaster,
    BankValidationMaster,
    VillageProfileMaster,
)
from app.services.engine_types import AnomalyFlagResult

# Feature names in order
FEATURE_NAMES = [
    "declared_land_area_ha",
    "land_area_pct_discrepancy",
    "applicant_age",
    "land_name_fuzzy_score",
    "bank_name_fuzzy_score",
    "village_density_ratio",
]

_ISOLATION_FOREST_MODEL: Optional[IsolationForest] = None


def _generate_baseline_reference_data(n_samples: int = 400, random_state: int = 42) -> np.ndarray:
    """
    Generate synthetic representative feature distributions of normal, genuine PM-KISAN applicants
    to train the baseline Isolation Forest estimator.
    """
    rng = np.random.RandomState(random_state)

    # 1. Declared land area (hectares): log-normal with mean ~1.1 Ha, clipped to [0.1, 2.5]
    land_area = np.clip(rng.normal(loc=1.1, scale=0.4, size=n_samples), 0.1, 2.5)

    # 2. Land area discrepancy %: normally near 0, minor clerical errors up to 10%
    discrepancy = np.clip(rng.exponential(scale=3.0, size=n_samples), 0.0, 15.0)

    # 3. Applicant age (years): normal between 25 and 70
    age = np.clip(rng.normal(loc=46.0, scale=11.0, size=n_samples), 21.0, 75.0)

    # 4. Land owner fuzzy name score: high similarity (90-100%) for genuine farmers
    land_fuzzy = np.clip(100.0 - rng.exponential(scale=3.5, size=n_samples), 80.0, 100.0)

    # 5. Bank holder fuzzy name score: high similarity (90-100%)
    bank_fuzzy = np.clip(100.0 - rng.exponential(scale=3.5, size=n_samples), 80.0, 100.0)

    # 6. Village density ratio: legitimate villages range from initial applications up to normal density
    density = np.clip(rng.uniform(0.01, 1.35, size=n_samples), 0.0, 1.5)

    return np.column_stack([land_area, discrepancy, age, land_fuzzy, bank_fuzzy, density])


def get_trained_isolation_forest() -> IsolationForest:
    """Return cached singleton Isolation Forest model fitted on baseline farmer distributions."""
    global _ISOLATION_FOREST_MODEL
    if _ISOLATION_FOREST_MODEL is None:
        X_train = _generate_baseline_reference_data(n_samples=600, random_state=42)
        model = IsolationForest(
            n_estimators=100,
            contamination=0.06,  # 6% baseline anomaly prior
            max_samples=256,
            random_state=42,
            n_jobs=1,
        )
        model.fit(X_train)
        _ISOLATION_FOREST_MODEL = model
    return _ISOLATION_FOREST_MODEL


def extract_features(details: PMKisanApplicationDetails, db: Session) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Extract 6-dimensional numerical feature vector for the given application.
    Returns (feature_vector_array, feature_dict).
    """
    # 1. Declared Land Area
    land_area = float(details.declared_land_area_ha)

    # 2. Land Area Discrepancy %
    discrepancy_pct = 0.0
    land_master = (
        db.query(LandRecordMaster)
        .filter(LandRecordMaster.parcel_id == details.parcel_id)
        .first()
    )
    if land_master and land_master.land_area_ha > 0:
        discrepancy_pct = abs(land_area - land_master.land_area_ha) / land_master.land_area_ha * 100.0

    # 3. Applicant Age
    today = datetime.date.today()
    dob = details.date_of_birth
    age = float(today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day)))

    # 4. Land Owner Fuzzy Score
    land_fuzzy = 100.0
    if land_master and land_master.owner_name:
        land_fuzzy = float(fuzz.token_sort_ratio(
            details.farmer_name.lower().strip(),
            land_master.owner_name.lower().strip(),
        ))

    # 5. Bank Account Holder Fuzzy Score
    bank_fuzzy = 100.0
    bank_master = (
        db.query(BankValidationMaster)
        .filter(BankValidationMaster.bank_account_ifsc_key == details.bank_account_ifsc_key)
        .first()
    )
    if bank_master and bank_master.account_holder_name:
        bank_fuzzy = float(fuzz.token_sort_ratio(
            details.farmer_name.lower().strip(),
            bank_master.account_holder_name.lower().strip(),
        ))

    # 6. Village Application Density Ratio
    village_density = 1.0
    village_profile = (
        db.query(VillageProfileMaster)
        .filter(VillageProfileMaster.village_code == details.village_code)
        .first()
    )
    if village_profile:
        base = village_profile.historical_beneficiary_count or village_profile.cultivator_count_estimate
        if base and base > 0:
            current_apps = (
                db.query(PMKisanApplicationDetails)
                .filter(PMKisanApplicationDetails.village_code == details.village_code)
                .count()
            )
            village_density = float(current_apps / base)

    feat_dict = {
        "declared_land_area_ha": round(land_area, 2),
        "land_area_pct_discrepancy": round(discrepancy_pct, 2),
        "applicant_age": int(age),
        "land_name_fuzzy_score": round(land_fuzzy, 1),
        "bank_name_fuzzy_score": round(bank_fuzzy, 1),
        "village_density_ratio": round(village_density, 2),
    }

    feat_vector = np.array([
        land_area,
        discrepancy_pct,
        age,
        land_fuzzy,
        bank_fuzzy,
        village_density,
    ], dtype=np.float64)

    return feat_vector, feat_dict


def run(details: PMKisanApplicationDetails, db: Session) -> List[AnomalyFlagResult]:
    """
    Run Isolation Forest machine learning model on application features.
    Flags multivariate anomalies where individual fields might look plausible in isolation,
    but their combination represents a statistically rare outlier.
    """
    flags: List[AnomalyFlagResult] = []

    try:
        model = get_trained_isolation_forest()
        feat_vector, feat_dict = extract_features(details, db)

        # Reshape for single sample prediction
        X_sample = feat_vector.reshape(1, -1)
        pred = model.predict(X_sample)[0]                  # -1 = outlier, 1 = inlier
        decision_score = float(model.decision_function(X_sample)[0])  # Negative = anomalous

        # Identify contributing feature dimensions
        drivers = []
        if feat_dict["declared_land_area_ha"] > 2.5 or feat_dict["declared_land_area_ha"] < 0.2:
            drivers.append(f"Abnormal landholding size ({feat_dict['declared_land_area_ha']} Ha)")
        if feat_dict["land_area_pct_discrepancy"] > 20.0:
            drivers.append(f"High land record deviation ({feat_dict['land_area_pct_discrepancy']}%)")
        if feat_dict["applicant_age"] < 21 or feat_dict["applicant_age"] > 75:
            drivers.append(f"Atypical applicant age ({feat_dict['applicant_age']} yrs)")
        if feat_dict["land_name_fuzzy_score"] < 80.0:
            drivers.append(f"Weak land owner name correlation ({feat_dict['land_name_fuzzy_score']}%)")
        if feat_dict["bank_name_fuzzy_score"] < 80.0:
            drivers.append(f"Weak bank holder name correlation ({feat_dict['bank_name_fuzzy_score']}%)")
        if feat_dict["village_density_ratio"] > 1.5:
            drivers.append(f"Elevated village application density ({feat_dict['village_density_ratio']}x)")

        # Anomaly condition: either deep isolation score or decision_score < 0 with concrete contributing feature drivers
        is_significant_outlier = (decision_score < -0.10) or (decision_score < -0.02 and len(drivers) > 0)

        if is_significant_outlier:
            if decision_score < -0.10:
                severity = "High"
                score = 40
            else:
                severity = "Medium"
                score = 25

            driver_str = "; ".join(drivers) if drivers else "Joint multivariate feature distribution deviates from baseline"

            flags.append(AnomalyFlagResult(
                anomaly_code="ML_ISOLATION_FOREST_OUTLIER",
                severity=severity,
                score=score,
                rationale=(
                    f"Unsupervised Isolation Forest model identified multivariate outlier "
                    f"(anomaly score: {decision_score:.3f}). Key contributing dimensions: {driver_str}."
                ),
                evidence_json={
                    "model": "IsolationForest",
                    "n_estimators": 100,
                    "decision_score": round(decision_score, 4),
                    "is_outlier": True,
                    "features_evaluated": feat_dict,
                    "anomaly_drivers": drivers,
                },
            ))

    except Exception as exc:
        # ML engine must fail gracefully without halting submission pipeline
        pass

    return flags
