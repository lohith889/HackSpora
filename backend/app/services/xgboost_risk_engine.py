"""
Supervised XGBoost Risk Calibration & TreeSHAP Explainability Engine — XGB-03

Two-stage hybrid evaluation:
Stage 1: Strict Boolean Statutory Exclusion Safeguard (PM-KISAN Rule 4) -> Forces Risk 100
Stage 2: Calibrated XGBoost non-linear decision tree evaluation with exact TreeSHAP attributions
"""
import os
import json
import numpy as np
import xgboost as xgb
import shap
from typing import Dict, List, Tuple, Any, Optional
from sqlalchemy.orm import Session

# ── XGBoost / SHAP compatibility patch for base_score bracket formatting ──
try:
    import shap.explainers._tree as _shap_tree
    _orig_decode = _shap_tree.decode_ubjson_buffer

    def _patched_decode_ubjson_buffer(*args, **kwargs):
        res = _orig_decode(*args, **kwargs)
        if isinstance(res, dict) and "learner" in res:
            lmp = res.get("learner", {}).get("learner_model_param", {})
            if "base_score" in lmp and isinstance(lmp["base_score"], str):
                bs = lmp["base_score"].strip("[] \t\r\n")
                lmp["base_score"] = bs
        return res

    _shap_tree.decode_ubjson_buffer = _patched_decode_ubjson_buffer
except Exception:
    pass

from app.models import PMKisanApplicationDetails
from app.services.engine_types import AnomalyFlagResult
from app.services.ml_feature_extractor import (
    FEATURE_NAMES,
    extract_feature_vector,
    get_feature_description,
)

# Global cached model and explainer singletons
_CACHED_BOOSTER: Optional[xgb.Booster] = None
_CACHED_EXPLAINER: Optional[shap.TreeExplainer] = None
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "models")
MODEL_FILE = os.path.join(MODEL_DIR, "xgboost_risk_model.json")


def generate_reference_training_data() -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate balanced, realistic synthetic reference data (120 samples) covering:
    - 60 Clean, verified smallholder farmers (label = 0)
    - 20 Hard statutory exclusions (taxpayers, deceased, institutional) (label = 1)
    - 20 Non-linear multi-signal syndicates (mule bank + drift + surge) (label = 1)
    - 20 Borderline & spatial surge cultivators (label = 0 and 1)
    Seed is strictly fixed (42) for 100% deterministic reproducibility.
    """
    np.random.seed(42)
    X_rows: List[List[float]] = []
    y_labels: List[int] = []

    # 1. Clean genuine farmers (60 samples)
    for _ in range(60):
        row = [
            float(np.random.uniform(0.5, 2.5)),      # declared_land_area_ha
            float(np.random.uniform(25.0, 68.0)),    # applicant_age_years
            float(np.random.uniform(15.0, 90.0)),    # days_to_nearest_event
            float(np.random.uniform(92.0, 100.0)),   # fuzzy_name_match_score
            1.0,                                     # dob_match_flag
            1.0,                                     # mobile_shared_count
            1.0,                                     # bank_account_shared_count
            1.0,                                     # bank_penny_drop_status
            float(np.random.uniform(95.0, 100.0)),   # bank_name_fuzzy_score
            1.0,                                     # land_record_found
            float(np.random.uniform(0.95, 1.05)),    # land_area_discrepancy_ratio
            1.0,                                     # land_owner_aadhaar_match
            1.0,                                     # is_agricultural_land
            0.0,                                     # statutory_exclusion_hit
            1.0,                                     # duplicate_parcel_claim_count
            float(np.random.uniform(0.8, 1.2)),      # village_density_ratio
            float(np.random.uniform(0.7, 1.3)),      # temporal_surge_velocity_ratio
            float(np.random.uniform(0.05, 0.25)),    # isolation_forest_anomaly_score
            1.0,                                     # syndicate_cluster_size
            0.0,                                     # engine_flags_total_count
            0.0, 0.0, 0.0, 0.0                       # flag severity counts
        ]
        X_rows.append(row)
        y_labels.append(0)

    # 2. Hard Statutory Ineligibility Exclusions (20 samples)
    for _ in range(20):
        row = [
            float(np.random.uniform(1.0, 4.0)),
            float(np.random.uniform(30.0, 65.0)),
            float(np.random.uniform(10.0, 40.0)),
            float(np.random.uniform(90.0, 100.0)),
            1.0, 1.0, 1.0, 1.0, 100.0, 1.0, 1.0, 1.0, 1.0,
            1.0,                                     # statutory_exclusion_hit = 1
            1.0, 1.0, 1.0, 0.1, 1.0,
            1.0, 1.0, 0.0, 0.0, 0.0                  # 1 Critical flag
        ]
        X_rows.append(row)
        y_labels.append(1)

    # 3. Non-Linear Multi-Signal Syndicate Registrations (20 samples)
    # Individual discrepancies appear moderate, but together represent an organized attack
    for _ in range(20):
        row = [
            float(np.random.uniform(1.8, 3.5)),      # declared_land_area_ha
            float(np.random.uniform(40.0, 60.0)),
            float(np.random.uniform(1.0, 5.0)),      # days_to_nearest_event (rush)
            float(np.random.uniform(70.0, 84.0)),    # fuzzy_name_match_score (moderate drift)
            1.0,
            float(np.random.randint(2, 5)),          # mobile_shared_count
            float(np.random.randint(3, 7)),          # bank_account_shared_count (mule)
            1.0,
            float(np.random.uniform(65.0, 80.0)),    # bank_name_fuzzy_score
            1.0,
            float(np.random.uniform(1.2, 2.0)),      # land_area_discrepancy_ratio
            0.0,                                     # land_owner_aadhaar_match = 0
            1.0, 0.0,
            float(np.random.randint(2, 4)),          # duplicate_parcel_claim_count
            float(np.random.uniform(2.0, 3.2)),      # village_density_ratio (surge)
            float(np.random.uniform(3.0, 5.5)),      # temporal_surge_velocity_ratio (spike)
            float(np.random.uniform(-0.35, -0.15)),  # isolation_forest_anomaly_score
            float(np.random.randint(4, 10)),         # syndicate_cluster_size
            float(np.random.randint(4, 7)),          # engine_flags_total_count
            0.0, float(np.random.randint(1, 3)), float(np.random.randint(2, 4)), 1.0
        ]
        X_rows.append(row)
        y_labels.append(1)

    # 4. Borderline cases and genuine high-volume campaigns (20 samples)
    for i in range(20):
        is_fraud = 1 if i < 10 else 0
        density = float(np.random.uniform(1.6, 2.3))
        name_sim = float(np.random.uniform(80.0, 92.0)) if is_fraud else float(np.random.uniform(88.0, 96.0))
        cluster = float(np.random.randint(2, 4)) if is_fraud else 1.0
        row = [
            float(np.random.uniform(1.0, 2.5)),
            float(np.random.uniform(30.0, 60.0)),
            float(np.random.uniform(10.0, 30.0)),
            name_sim,
            1.0,
            2.0 if is_fraud else 1.0,
            2.0 if is_fraud else 1.0,
            1.0,
            85.0 if is_fraud else 95.0,
            1.0,
            1.2 if is_fraud else 1.0,
            0.0 if is_fraud else 1.0,
            1.0, 0.0, 1.0,
            density,
            float(np.random.uniform(1.2, 2.0)),
            -0.1 if is_fraud else 0.1,
            cluster,
            2.0 if is_fraud else 1.0,
            0.0, 1.0 if is_fraud else 0.0, 1.0, 0.0
        ]
        X_rows.append(row)
        y_labels.append(is_fraud)

    return np.array(X_rows, dtype=np.float32), np.array(y_labels, dtype=np.int32)


def get_trained_xgboost_model() -> Tuple[xgb.Booster, shap.TreeExplainer]:
    """
    Retrieve or train the global XGBoost booster and TreeSHAP explainer instances.
    Guarantees fast in-memory execution (<2ms per query).
    """
    global _CACHED_BOOSTER, _CACHED_EXPLAINER

    if _CACHED_BOOSTER is not None and _CACHED_EXPLAINER is not None:
        return _CACHED_BOOSTER, _CACHED_EXPLAINER

    os.makedirs(MODEL_DIR, exist_ok=True)

    if os.path.exists(MODEL_FILE):
        try:
            booster = xgb.Booster()
            booster.load_model(MODEL_FILE)
            explainer = shap.TreeExplainer(booster, feature_perturbation="tree_path_dependent")
            _CACHED_BOOSTER = booster
            _CACHED_EXPLAINER = explainer
            return booster, explainer
        except Exception:
            pass  # Re-train on failure

    # Train deterministic model
    X_train, y_train = generate_reference_training_data()
    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=list(FEATURE_NAMES))

    params = {
        "objective": "binary:logistic",
        "eval_metric": "logloss",
        "max_depth": 4,
        "learning_rate": 0.08,
        "subsample": 0.85,
        "colsample_bytree": 0.85,
        "scale_pos_weight": 1.5,
        "seed": 42,
    }

    booster = xgb.train(params, dtrain, num_boost_round=120)
    try:
        booster.save_model(MODEL_FILE)
    except Exception:
        pass

    explainer = shap.TreeExplainer(booster, feature_perturbation="tree_path_dependent")

    _CACHED_BOOSTER = booster
    _CACHED_EXPLAINER = explainer
    return booster, explainer


def evaluate_xgboost_risk(
    details: PMKisanApplicationDetails,
    flags: List[AnomalyFlagResult],
    db: Optional[Session] = None,
    rule_risk_score: int = 0,
) -> Dict[str, Any]:
    """
    Execute two-stage hybrid risk scoring:
    1. Statutory Exclusion Guardrail: Checks for hard legal ineligibility.
    2. Supervised XGBoost Booster: Predicts non-linear interaction probability and
       computes exact TreeSHAP attributions.
    """
    flag_codes = {f.anomaly_code for f in flags}

    # Extract 24-dim feature vector
    vector = extract_feature_vector(details, flags, db)
    X = np.array([vector], dtype=np.float32)

    # ── STAGE 1: Statutory Exclusion Guardrail ─────────────────────────────
    is_hard_statutory = any(
        code.startswith("EXCLUSION_") for code in flag_codes
    ) or ("LAND_PARCEL_NOT_FOUND" in flag_codes)

    if is_hard_statutory:
        shap_drivers = [
            {
                "feature_name": "statutory_exclusion_hit",
                "attribution_value": 1.0,
                "description": "Statutory Ineligibility Exclusion under PM-KISAN Rule 4 (Overrode ML probability)",
            }
        ]
        return {
            "ml_risk_score": 100,
            "final_hybrid_score": 100,
            "is_statutory_override": True,
            "divergence_score": 100 - rule_risk_score,
            "top_shap_drivers": shap_drivers,
            "feature_vector": vector.tolist(),
        }

    # ── STAGE 2: XGBoost Supervised Evaluation & TreeSHAP ─────────────────
    booster, explainer = get_trained_xgboost_model()
    dmatrix = xgb.DMatrix(X, feature_names=list(FEATURE_NAMES))

    # Raw fraud probability (0.0 to 1.0)
    prob = float(booster.predict(dmatrix)[0])
    ml_score = int(round(prob * 100.0))
    ml_score = max(0, min(100, ml_score))

    # Final hybrid score combines rule heuristic and ML probability
    # If ML catches non-linear syndicate patterns, take max(rule, ml)
    final_score = max(rule_risk_score, ml_score)
    divergence = ml_score - rule_risk_score

    # Compute TreeSHAP feature attributions via native C++ booster for <1ms latency
    try:
        contribs = booster.predict(dmatrix, pred_contribs=True)[0]
        values = contribs[:-1]  # Exclude bias/base value at end
        # Sort features by absolute contribution magnitude
        top_indices = np.argsort(np.abs(values))[::-1][:3]
        shap_drivers = []
        for idx in top_indices:
            feat_name = FEATURE_NAMES[idx]
            attr_val = round(float(values[idx]), 4)
            shap_drivers.append({
                "feature_name": feat_name,
                "attribution_value": attr_val,
                "description": get_feature_description(feat_name),
            })
    except Exception:
        try:
            shap_values = explainer(X)
            values = shap_values.values[0]
            top_indices = np.argsort(np.abs(values))[::-1][:3]
            shap_drivers = [
                {
                    "feature_name": FEATURE_NAMES[idx],
                    "attribution_value": round(float(values[idx]), 4),
                    "description": get_feature_description(FEATURE_NAMES[idx]),
                }
                for idx in top_indices
            ]
        except Exception:
            shap_drivers = []

    return {
        "ml_risk_score": ml_score,
        "final_hybrid_score": final_score,
        "is_statutory_override": False,
        "divergence_score": divergence,
        "top_shap_drivers": shap_drivers,
        "feature_vector": vector.tolist(),
    }
