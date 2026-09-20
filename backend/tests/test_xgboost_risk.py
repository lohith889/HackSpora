"""
Automated Test Suite for Supervised XGBoost Risk Calibration & TreeSHAP — XGB-01 to XGB-04

Verifies:
1. 24-dimensional feature vector extraction and zero-NaN integrity.
2. Strict Boolean Statutory Exclusion Override ($Risk = 100$, $is_override = True$).
3. Non-linear multi-signal syndicate pattern interception.
4. Clean farmer low-risk specificity.
5. TreeSHAP feature attribution consistency.
6. Sub-15ms inference latency benchmark.
"""
import time
import datetime
import pytest
import numpy as np
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, PMKisanApplicationDetails
from app.services.engine_types import AnomalyFlagResult
from app.services.ml_feature_extractor import (
    FEATURE_NAMES,
    extract_feature_vector,
    get_feature_description,
)
from app.services.xgboost_risk_engine import (
    get_trained_xgboost_model,
    evaluate_xgboost_risk,
)
from app.services.risk_scorer import compute_hybrid_risk_score


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def clean_details():
    return PMKisanApplicationDetails(
        application_id=1,
        farmer_name="RAMESH KUMAR",
        date_of_birth=datetime.date(1982, 5, 10),
        gender="Male",
        category="General",
        mobile_number="9876543210",
        otp_verified=True,
        aadhaar_ref="hash_ramesh_123",
        aadhaar_masked="XXXX-XXXX-1010",
        bank_account_number="123456789012",
        ifsc_code="SBIN0001234",
        state_code="UP",
        district_code="DIST01",
        tehsil_code="TEH01",
        village_code="VIL101",
        khata_number="KH-100",
        plot_number="PL-200",
        declared_land_area_ha=1.5,
        ownership_type="Owner",
        land_document_path="/uploads/doc.pdf",
        self_declaration=True,
        e_kyc_consent=True,
        e_kyc_status=True,
        parcel_id="UP-DIST01-TEH01-VIL101-KH-100-PL-200",
        bank_account_ifsc_key="123456789012_SBIN0001234",
    )


def test_feature_vector_dimension_and_validity(test_db, clean_details):
    """Verify feature extractor outputs exactly 24 dimensions with zero NaNs."""
    vector = extract_feature_vector(clean_details, [], test_db)
    assert isinstance(vector, np.ndarray)
    assert len(vector) == 24
    assert len(FEATURE_NAMES) == 24
    assert not np.isnan(vector).any(), "Feature vector contains NaNs!"
    assert not np.isinf(vector).any(), "Feature vector contains Infs!"
    assert vector[0] == 1.5  # declared_land_area_ha
    assert vector[4] == 1.0  # dob_match_flag


def test_statutory_exclusion_override(test_db, clean_details):
    """
    CRITICAL STATUTORY CONTRACT:
    Any statutory exclusion flag (e.g. EXCLUSION_TAXPAYER, EXCLUSION_DECEASED)
    must strictly force score to 100 with is_statutory_override = True.
    """
    flags = [
        AnomalyFlagResult(
            anomaly_code="EXCLUSION_TAXPAYER",
            severity="Critical",
            score=55,
            rationale="Applicant filed income tax return under Section 4(e) of PM-KISAN.",
            evidence_json={"taxpayer": True},
        )
    ]
    res = evaluate_xgboost_risk(clean_details, flags, test_db, rule_risk_score=55)
    assert res["ml_risk_score"] == 100
    assert res["final_hybrid_score"] == 100
    assert res["is_statutory_override"] is True
    assert len(res["top_shap_drivers"]) > 0
    assert res["top_shap_drivers"][0]["feature_name"] == "statutory_exclusion_hit"


def test_clean_farmer_low_risk(test_db, clean_details):
    """Verified genuine smallholder farmer must evaluate to Low Risk (< 25)."""
    res = evaluate_xgboost_risk(clean_details, [], test_db, rule_risk_score=0)
    assert res["is_statutory_override"] is False
    assert res["ml_risk_score"] < 25, f"Expected clean farmer ML risk < 25, got {res['ml_risk_score']}"
    assert res["final_hybrid_score"] < 25


def test_nonlinear_syndicate_interception(test_db, clean_details):
    """
    Test that multi-signal syndicate cases (shared bank degree + moderate drift + registration surge)
    trigger high ML risk even when individual rule severities appear moderate.
    """
    flags = [
        AnomalyFlagResult(
            anomaly_code="BANK_ACCOUNT_SHARED_MULE",
            severity="High",
            score=40,
            rationale="Bank account shared across 4 claimants.",
            evidence_json={"shared_count": 4},
        ),
        AnomalyFlagResult(
            anomaly_code="LAND_NAME_MISMATCH_SUSPECT",
            severity="Low",
            score=10,
            rationale="Fuzzy token similarity 74%.",
            evidence_json={"similarity_score": 74.0},
        ),
        AnomalyFlagResult(
            anomaly_code="STAT_VILLAGE_DENSITY_HIGH",
            severity="Medium",
            score=25,
            rationale="Village registration ratio 2.4x baseline.",
            evidence_json={"density_ratio": 2.4},
        ),
        AnomalyFlagResult(
            anomaly_code="PARCEL_SYNDICATE_PATTERN",
            severity="High",
            score=40,
            rationale="Syndicate cluster of size 5 detected.",
            evidence_json={"cluster_size": 5},
        ),
    ]
    # Rule heuristic would sum to ~75 (capped/weighted)
    res = evaluate_xgboost_risk(clean_details, flags, test_db, rule_risk_score=50)
    assert res["is_statutory_override"] is False
    assert res["ml_risk_score"] >= 80, f"Expected syndicate ML risk >= 80, got {res['ml_risk_score']}"
    assert len(res["top_shap_drivers"]) == 3
    driver_names = [d["feature_name"] for d in res["top_shap_drivers"]]
    # High impact features should feature in top SHAP drivers
    assert any(
        k in driver_names
        for k in ["bank_account_shared_count", "syndicate_cluster_size", "village_density_ratio", "fuzzy_name_match_score"]
    )


def test_treeshap_attribution_fidelity(test_db, clean_details):
    """Verify TreeSHAP attributions are computed, sorted, and contain readable descriptions."""
    flags = [
        AnomalyFlagResult(
            anomaly_code="BANK_ACCOUNT_SHARED_MULE",
            severity="High",
            score=40,
            rationale="Bank account shared across 3 claimants.",
            evidence_json={"shared_count": 3},
        )
    ]
    res = evaluate_xgboost_risk(clean_details, flags, test_db, rule_risk_score=40)
    drivers = res["top_shap_drivers"]
    assert len(drivers) <= 3
    for d in drivers:
        assert "feature_name" in d
        assert "attribution_value" in d
        assert "description" in d
        assert isinstance(d["attribution_value"], float)
        assert len(d["description"]) > 0


def test_inference_latency_benchmark(test_db, clean_details):
    """Assert 95th percentile inference latency is strictly under 15ms."""
    import gc

    # Warmup
    for _ in range(5):
        evaluate_xgboost_risk(clean_details, [], test_db, rule_risk_score=0)

    gc.disable()
    try:
        times = []
        for _ in range(50):
            t0 = time.perf_counter()
            evaluate_xgboost_risk(clean_details, [], test_db, rule_risk_score=0)
            times.append(time.perf_counter() - t0)
    finally:
        gc.enable()

    p95_ms = np.percentile(times, 95) * 1000
    assert p95_ms < 15.0, f"P95 latency ({p95_ms:.2f}ms) exceeded 15ms target!"


def test_hybrid_risk_fusion():
    """Verify compute_hybrid_risk_score enforces statutory override and max rule/ml logic."""
    assert compute_hybrid_risk_score(40, 85, is_statutory_override=False) == 85
    assert compute_hybrid_risk_score(70, 30, is_statutory_override=False) == 70
    assert compute_hybrid_risk_score(20, 20, is_statutory_override=True) == 100
    assert compute_hybrid_risk_score(0, 0, is_statutory_override=True) == 100
