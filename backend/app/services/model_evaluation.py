"""
Synthetic Ground Truth Model Evaluation Service — EVAL-01

Benchmarks the 8-engine KisanGuard Anomaly Pipeline against a deterministic synthetic
ground-truth evaluation dataset.

Computes standard ML classification metrics:
  - Confusion Matrix: True Positives (TP), False Positives (FP),
                      True Negatives (TN), False Negatives (FN)
  - Precision: TP / (TP + FP)
  - Recall (Sensitivity): TP / (TP + FN)
  - F1-Score: 2 * (Precision * Recall) / (Precision + Recall)
  - Specificity (True Negative Rate): TN / (TN + FP)
  - False Positive Rate (FPR): FP / (FP + TN)
  - Accuracy: (TP + TN) / Total
"""
import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from app.database import Base
from app.models import (
    User, Application, PMKisanApplicationDetails,
    LandRecordMaster, BankValidationMaster, ExclusionMaster,
    VillageProfileMaster, EventCalendarMaster,
)
from app.auth import hash_password, hash_aadhaar
from app.services.anomaly_pipeline import run_pipeline
from app.services.risk_scorer import compute_risk_score

ANOMALY_DECISION_THRESHOLD = 25  # Risk score >= 25 is classified as Suspicious/Anomalous


def evaluate_pipeline_on_synthetic_ground_truth(db: Session) -> Dict[str, Any]:
    """
    Construct a synthetic test bench with known ground truth (Genuine vs Fraudulent)
    covering all 8 anomaly types, execute the full pipeline on each, and calculate
    comprehensive classification performance metrics.
    """
    # Ensure tables exist
    Base.metadata.create_all(bind=db.get_bind())

    # ─────────────────────────────────────────────────────────────────────────
    # 1. Provision Evaluation Master Tables & Ground Truth Cases
    # ─────────────────────────────────────────────────────────────────────────
    today = datetime.date.today()
    eval_prefix = f"eval_{int(datetime.datetime.utcnow().timestamp())}"

    # Master: Legitimate Land & Bank for Case 1 (Sita Ram)
    clean_parcel_1 = "UP-LKO-EVAL-VIL01-KH01-PL01"
    clean_bank_key_1 = "998877665544-SBIN0001234"
    clean_aadhaar_ref_1 = hash_aadhaar("100010001000")

    if not db.query(LandRecordMaster).filter_by(parcel_id=clean_parcel_1).first():
        db.add(LandRecordMaster(
            parcel_id=clean_parcel_1,
            state_code="UP", district_code="LKO", tehsil_code="EVAL",
            village_code="VIL01", khata_number="KH01", plot_number="PL01",
            owner_aadhaar_ref=clean_aadhaar_ref_1,
            owner_name="Sita Ram",
            land_area_ha=1.5,
            land_use_code="AGRICULTURE",
            agricultural_land_flag=True,
            ownership_status="ACTIVE",
            title_status="CLEAR",
        ))
    if not db.query(BankValidationMaster).filter_by(bank_account_ifsc_key=clean_bank_key_1).first():
        db.add(BankValidationMaster(
            bank_account_ifsc_key=clean_bank_key_1,
            bank_account_number="998877665544",
            ifsc_code="SBIN0001234",
            account_holder_name="Sita Ram",
            account_status="ACTIVE",
            ifsc_valid=True,
            penny_drop_status="SUCCESS",
            name_match_score=1.0,
        ))

    # Master: Legitimate Land & Bank for Case 2 (Gita Devi)
    clean_parcel_2 = "UP-LKO-EVAL-VIL01-KH05-PL05"
    clean_bank_key_2 = "887766554433-SBIN0001234"
    clean_aadhaar_ref_2 = hash_aadhaar("100010002000")

    if not db.query(LandRecordMaster).filter_by(parcel_id=clean_parcel_2).first():
        db.add(LandRecordMaster(
            parcel_id=clean_parcel_2,
            state_code="UP", district_code="LKO", tehsil_code="EVAL",
            village_code="VIL01", khata_number="KH05", plot_number="PL05",
            owner_aadhaar_ref=clean_aadhaar_ref_2,
            owner_name="Gita Devi",
            land_area_ha=1.2,
            land_use_code="AGRICULTURE",
            agricultural_land_flag=True,
            ownership_status="ACTIVE",
            title_status="CLEAR",
        ))
    if not db.query(BankValidationMaster).filter_by(bank_account_ifsc_key=clean_bank_key_2).first():
        db.add(BankValidationMaster(
            bank_account_ifsc_key=clean_bank_key_2,
            bank_account_number="887766554433",
            ifsc_code="SBIN0001234",
            account_holder_name="Gita Devi",
            account_status="ACTIVE",
            ifsc_valid=True,
            penny_drop_status="SUCCESS",
            name_match_score=1.0,
        ))

    # Village Profile for Evaluation
    if not db.query(VillageProfileMaster).filter_by(village_code="VIL01").first():
        db.add(VillageProfileMaster(
            village_code="VIL01",
            district_code="LKO",
            tehsil_code="EVAL",
            village_name="Evaluation Village",
            historical_beneficiary_count=100,
            cultivator_count_estimate=120,
        ))
    # Exclusion Master: Taxpayer
    taxpayer_aadhaar = hash_aadhaar("200020002000")
    if not db.query(ExclusionMaster).filter_by(aadhaar_ref=taxpayer_aadhaar).first():
        db.add(ExclusionMaster(
            aadhaar_ref=taxpayer_aadhaar,
            taxpayer_flag=True,
            govt_employee_flag=False,
            pensioner_flag=False,
            professional_flag=False,
            institutional_landholder_flag=False,
            deceased_flag=False,
        ))
    db.commit()

    # Ground truth test cases: List of (details_dict, ground_truth_label)
    # y_true = 0: Genuine Farmer
    # y_true = 1: Fraudulent / Ineligible Claim
    test_cases: List[tuple] = [
        # --- GENUINE APPLICANTS (y_true = 0) ---
        (
            {
                "farmer_name": "Sita Ram",
                "date_of_birth": datetime.date(1980, 5, 10),
                "gender": "Male",
                "mobile_number": "9876500001",
                "otp_verified": True,
                "aadhaar_ref": clean_aadhaar_ref_1,
                "aadhaar_masked": "XXXX-XXXX-1000",
                "bank_account_number": "998877665544",
                "ifsc_code": "SBIN0001234",
                "state_code": "UP", "district_code": "LKO", "tehsil_code": "EVAL",
                "village_code": "VIL01", "khata_number": "KH01", "plot_number": "PL01",
                "declared_land_area_ha": 1.5,
                "ownership_type": "Single",
                "land_document_path": "/uploads/valid.pdf",
                "self_declaration": True,
                "e_kyc_consent": True,
                "e_kyc_status": True,
                "parcel_id": clean_parcel_1,
                "bank_account_ifsc_key": clean_bank_key_1,
            },
            0,  # Genuine
        ),
        (
            {
                "farmer_name": "Gita Devi",
                "date_of_birth": datetime.date(1984, 8, 15),
                "gender": "Female",
                "mobile_number": "9876500002",
                "otp_verified": True,
                "aadhaar_ref": clean_aadhaar_ref_2,
                "aadhaar_masked": "XXXX-XXXX-2000",
                "bank_account_number": "887766554433",
                "ifsc_code": "SBIN0001234",
                "state_code": "UP", "district_code": "LKO", "tehsil_code": "EVAL",
                "village_code": "VIL01", "khata_number": "KH05", "plot_number": "PL05",
                "declared_land_area_ha": 1.2,
                "ownership_type": "Single",
                "land_document_path": "/uploads/valid2.pdf",
                "self_declaration": True,
                "e_kyc_consent": True,
                "e_kyc_status": True,
                "parcel_id": clean_parcel_2,
                "bank_account_ifsc_key": clean_bank_key_2,
            },
            0,  # Genuine
        ),

        # --- FRAUDULENT APPLICANTS (y_true = 1) ---
        # Case 1: Taxpayer Exclusion Hit
        (
            {
                "farmer_name": "Rajesh Gupta",
                "date_of_birth": datetime.date(1975, 3, 20),
                "gender": "Male",
                "mobile_number": "9876500003",
                "otp_verified": True,
                "aadhaar_ref": taxpayer_aadhaar,
                "aadhaar_masked": "XXXX-XXXX-2000",
                "bank_account_number": "111122223333",
                "ifsc_code": "SBIN0001234",
                "state_code": "UP", "district_code": "LKO", "tehsil_code": "EVAL",
                "village_code": "VIL01", "khata_number": "KH02", "plot_number": "PL02",
                "declared_land_area_ha": 1.0,
                "ownership_type": "Single",
                "land_document_path": "/uploads/taxpayer.pdf",
                "self_declaration": True,
                "e_kyc_consent": True,
                "e_kyc_status": True,
                "parcel_id": "UP-LKO-EVAL-VIL01-KH02-PL02",
                "bank_account_ifsc_key": "111122223333-SBIN0001234",
            },
            1,  # Fraudulent (Taxpayer)
        ),
        # Case 2: Non-Existent Land Parcel Fraud
        (
            {
                "farmer_name": "Vikram Singh",
                "date_of_birth": datetime.date(1988, 11, 5),
                "gender": "Male",
                "mobile_number": "9876500004",
                "otp_verified": True,
                "aadhaar_ref": hash_aadhaar("300030003000"),
                "aadhaar_masked": "XXXX-XXXX-3000",
                "bank_account_number": "222233334444",
                "ifsc_code": "SBIN0001234",
                "state_code": "UP", "district_code": "LKO", "tehsil_code": "EVAL",
                "village_code": "VIL01", "khata_number": "FAKE99", "plot_number": "FAKE99",
                "declared_land_area_ha": 1.8,
                "ownership_type": "Single",
                "land_document_path": "/uploads/fake_land.pdf",
                "self_declaration": True,
                "e_kyc_consent": True,
                "e_kyc_status": True,
                "parcel_id": "UP-LKO-EVAL-VIL01-FAKE99-FAKE99",
                "bank_account_ifsc_key": "222233334444-SBIN0001234",
            },
            1,  # Fraudulent (Phantom Parcel)
        ),
        # Case 3: Identity e-KYC Failure & No Consent
        (
            {
                "farmer_name": "Mohan Verma",
                "date_of_birth": datetime.date(1990, 7, 12),
                "gender": "Male",
                "mobile_number": "9876500005",
                "otp_verified": False,
                "aadhaar_ref": hash_aadhaar("400040004000"),
                "aadhaar_masked": "XXXX-XXXX-4000",
                "bank_account_number": "333344445555",
                "ifsc_code": "SBIN0001234",
                "state_code": "UP", "district_code": "LKO", "tehsil_code": "EVAL",
                "village_code": "VIL01", "khata_number": "KH03", "plot_number": "PL03",
                "declared_land_area_ha": 1.2,
                "ownership_type": "Single",
                "land_document_path": "/uploads/no_ekyc.pdf",
                "self_declaration": True,
                "e_kyc_consent": False,
                "e_kyc_status": False,
                "parcel_id": "UP-LKO-EVAL-VIL01-KH03-PL03",
                "bank_account_ifsc_key": "333344445555-SBIN0001234",
            },
            1,  # Fraudulent (Unverified Identity)
        ),
        # Case 4: Multivariate Isolation Forest Outlier (Extreme Age + Extreme Area + Discrepancy)
        (
            {
                "farmer_name": "Unknown Entity",
                "date_of_birth": datetime.date(1920, 1, 1),  # Age 106 years
                "gender": "Other",
                "mobile_number": "9876500006",
                "otp_verified": True,
                "aadhaar_ref": hash_aadhaar("500050005000"),
                "aadhaar_masked": "XXXX-XXXX-5000",
                "bank_account_number": "444455556666",
                "ifsc_code": "SBIN0001234",
                "state_code": "UP", "district_code": "LKO", "tehsil_code": "EVAL",
                "village_code": "VIL01", "khata_number": "KH04", "plot_number": "PL04",
                "declared_land_area_ha": 9.8,  # Huge outlier landholding
                "ownership_type": "Joint",
                "land_document_path": "/uploads/outlier.pdf",
                "self_declaration": True,
                "e_kyc_consent": True,
                "e_kyc_status": True,
                "parcel_id": "UP-LKO-EVAL-VIL01-KH04-PL04",
                "bank_account_ifsc_key": "444455556666-SBIN0001234",
            },
            1,  # Fraudulent (Multivariate Outlier)
        ),
    ]

    # ─────────────────────────────────────────────────────────────────────────
    # 2. Evaluate Each Ground Truth Case
    # ─────────────────────────────────────────────────────────────────────────
    tp = fp = tn = fn = 0

    try:
        dummy_user = User(
            email=f"{eval_prefix}@eval.test",
            password_hash=hash_password("EvalPass123!"),
            full_name="Eval Test User",
            mobile_number="9876500000",
            date_of_birth=datetime.date(1985, 1, 1),
            gender="Male",
        )
        db.add(dummy_user)
        db.flush()

        for idx, (details_kwargs, y_true) in enumerate(test_cases):
            eval_app = Application(
                user_id=dummy_user.id,
                scheme_code="PM_KISAN",
                status="UNDER_REVIEW",
            )
            db.add(eval_app)
            db.flush()

            details = PMKisanApplicationDetails(
                application_id=eval_app.id,
                **details_kwargs,
            )
            db.add(details)
            db.flush()

            # Run full pipeline with all 8 engines
            pipeline_res = run_pipeline(details, db)
            risk_score = compute_risk_score(pipeline_res.flags)

            y_pred = 1 if risk_score >= ANOMALY_DECISION_THRESHOLD else 0

            if y_true == 1 and y_pred == 1:
                tp += 1
            elif y_true == 0 and y_pred == 1:
                fp += 1
            elif y_true == 0 and y_pred == 0:
                tn += 1
            elif y_true == 1 and y_pred == 0:
                fn += 1
    finally:
        db.rollback()

    total = tp + fp + tn + fn
    accuracy = (tp + tn) / total if total > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 1.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    return {
        "total_test_samples": total,
        "true_positives": tp,
        "false_positives": fp,
        "true_negatives": tn,
        "false_negatives": fn,
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "specificity": round(specificity, 4),
        "false_positive_rate": round(fpr, 4),
        "evaluation_timestamp": datetime.datetime.utcnow(),
    }
