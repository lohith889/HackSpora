# Plan 08-01: Supervised XGBoost Risk Engine, Feature Extractor & TreeSHAP Explainability Summary

## Executive Summary
Successfully implemented the two-stage hybrid ML risk calibration and TreeSHAP explainability engine for the KisanGuard PM-KISAN subsidy portal. Application claims and multi-engine anomaly flags are serialized into a 24-dimensional normalized feature vector, evaluated against a strict statutory exclusion invariant ($Risk = 100$, $is\_statutory\_override = True$), and scored using a deterministic XGBoost booster calibrated on 120 reference profiles. Native C++ TreeSHAP feature attributions run in under 2ms to deliver exact driver insights (top 3 features with attribution values and human-readable explanations).

## Key Components Implemented

1. **Environment & Core Dependencies (`XGB-01`)**:
   - Integrated `xgboost==3.2.0` and `shap==0.51.0` into `.venv` and [`backend/requirements.txt`](file:///D:/lohith/hackspora/backend/requirements.txt).
   - Added `extra="ignore"` to `SettingsConfigDict` in [`backend/app/config.py`](file:///D:/lohith/hackspora/backend/app/config.py) for resilient `.env` parsing.

2. **24-Dimensional Canonical Feature Extractor (`XGB-02`)**:
   - Created [`backend/app/services/ml_feature_extractor.py`](file:///D:/lohith/hackspora/backend/app/services/ml_feature_extractor.py) defining `FEATURE_NAMES` covering land discrepancies, age, event proximity, fuzzy name matching, bank degree, duplicate parcel claims, village density, temporal velocity, and anomaly severity counts.
   - Implemented event calendar query caching (60s TTL) and bypassed redundant DB roundtrips when engine flags are available, achieving sub-millisecond feature serialization with zero NaNs/Infs.

3. **Two-Stage Hybrid XGBoost Risk & TreeSHAP Engine (`XGB-03`)**:
   - Created [`backend/app/services/xgboost_risk_engine.py`](file:///D:/lohith/hackspora/backend/app/services/xgboost_risk_engine.py).
   - **Stage 1: Statutory Exclusion Guardrail**: Hard PM-KISAN Rule 4 exclusions (`EXCLUSION_*`, `LAND_PARCEL_NOT_FOUND`) lock risk to 100 with `is_statutory_override = True`.
   - **Stage 2: XGBoost Supervised Evaluation**: Predicts non-linear interaction probability and computes top 3 Shapley values via native `booster.predict(dmatrix, pred_contribs=True)`.

4. **Schema & Model Persistence (`XGB-04`)**:
   - Updated [`backend/app/models.py`](file:///D:/lohith/hackspora/backend/app/models.py): Added `ml_risk_score`, `is_statutory_override`, `divergence_score`, and `ml_shap_drivers` JSON column to `AnomalyReport`.
   - Updated [`backend/app/schemas.py`](file:///D:/lohith/hackspora/backend/app/schemas.py): Added `SHAPDriverResponse` and exposed ML fields in `AnomalyReportResponse` and `AdminApplicationDetail`.
   - Updated [`backend/app/routes/application_routes.py`](file:///D:/lohith/hackspora/backend/app/routes/application_routes.py) and [`backend/app/routes/admin_routes.py`](file:///D:/lohith/hackspora/backend/app/routes/admin_routes.py).

5. **Automated Test Verification**:
   - [`backend/tests/test_xgboost_risk.py`](file:///D:/lohith/hackspora/backend/tests/test_xgboost_risk.py) executes 7 test scenarios (vector validity, statutory override, clean farmer specificity, syndicate sensitivity, TreeSHAP fidelity, sub-15ms latency, hybrid fusion logic).
   - All 7 tests pass in 1.03s.

## Next Steps
Proceed with Plan 08-02 (Wave 2): Update seed data with ML evaluation, implement Dual Risk Meters, SHAP horizontal bar chart, and ML divergence badges in the Scheme Officer Admin Console.
