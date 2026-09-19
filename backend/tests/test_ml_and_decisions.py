"""
Test Suite for:
  1. Engine #8: Isolation Forest Machine Learning Anomaly Detection (ENG-08)
  2. Decoupled Risk vs Confidence Scoring (RISK-01, RISK-02, RISK-05)
  3. Officer Final Decision Workflow & Audit Logging (ADM-04, ADM-05)
  4. Synthetic Ground Truth Model Evaluation Metrics (EVAL-01)
"""
import datetime
import io
import pytest
from app.models import (
    User, Application, PMKisanApplicationDetails,
    LandRecordMaster, BankValidationMaster, ExclusionMaster,
    VillageProfileMaster, AuditLog,
)
from app.auth import hash_password, hash_aadhaar
from app.services import isolation_forest_engine
from app.services.anomaly_pipeline import run_pipeline
from app.services.risk_scorer import compute_risk_score, get_recommended_action
from app.services.confidence_engine import compute_confidence
from app.services.model_evaluation import evaluate_pipeline_on_synthetic_ground_truth
from tests.conftest import client, TestingSessionLocal


# ─────────────────────────────────────────────────────────────────────────────
# Helper Fixtures
# ─────────────────────────────────────────────────────────────────────────────

def create_admin_user(db) -> User:
    admin = User(
        email="admin_officer@gov.in",
        password_hash=hash_password("AdminSecurePass!1"),
        full_name="District Scheme Officer",
        mobile_number="9876543299",
        date_of_birth=datetime.date(1978, 4, 12),
        gender="Male",
        role="ADMIN",
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def create_farmer_user(db, email: str = "farmer_test@test.com") -> User:
    farmer = User(
        email=email,
        password_hash=hash_password("FarmerPass!123"),
        full_name="Ramesh Kumar",
        mobile_number="9876543210",
        date_of_birth=datetime.date(1985, 6, 20),
        gender="Male",
        role="USER",
    )
    db.add(farmer)
    db.commit()
    db.refresh(farmer)
    return farmer


# ─────────────────────────────────────────────────────────────────────────────
# 1. Isolation Forest ML Engine Tests (ENG-08)
# ─────────────────────────────────────────────────────────────────────────────

class TestIsolationForestEngine:
    def test_clean_farmer_inlier(self):
        """Standard legitimate farmer features should be recognized as an inlier."""
        db = TestingSessionLocal()
        farmer = create_farmer_user(db, "inlier@test.com")

        # Provision matching land and bank masters
        parcel_id = "UP-LKO-TEH01-VIL01-KH10-PL10"
        bank_key = "123456789012-SBIN0001234"
        aadhaar_ref = hash_aadhaar("123412341234")

        db.add(LandRecordMaster(
            parcel_id=parcel_id,
            state_code="UP", district_code="LKO", tehsil_code="TEH01",
            village_code="VIL01", khata_number="KH10", plot_number="PL10",
            owner_aadhaar_ref=aadhaar_ref,
            owner_name="Ramesh Kumar",
            land_area_ha=1.2,
            land_use_code="AGRICULTURE",
            agricultural_land_flag=True,
            ownership_status="ACTIVE",
            title_status="CLEAR",
        ))
        db.add(BankValidationMaster(
            bank_account_ifsc_key=bank_key,
            bank_account_number="123456789012",
            ifsc_code="SBIN0001234",
            account_holder_name="Ramesh Kumar",
            account_status="ACTIVE",
            ifsc_valid=True,
            penny_drop_status="SUCCESS",
            name_match_score=1.0,
        ))
        db.commit()

        app = Application(user_id=farmer.id, scheme_code="PM_KISAN", status="UNDER_REVIEW")
        db.add(app)
        db.flush()

        details = PMKisanApplicationDetails(
            application_id=app.id,
            farmer_name="Ramesh Kumar",
            date_of_birth=datetime.date(1985, 6, 20),
            gender="Male",
            mobile_number="9876543210",
            otp_verified=True,
            aadhaar_ref=aadhaar_ref,
            aadhaar_masked="XXXX-XXXX-1234",
            bank_account_number="123456789012",
            ifsc_code="SBIN0001234",
            state_code="UP", district_code="LKO", tehsil_code="TEH01",
            village_code="VIL01", khata_number="KH10", plot_number="PL10",
            declared_land_area_ha=1.2,
            ownership_type="Single",
            land_document_path="/uploads/test.pdf",
            self_declaration=True,
            e_kyc_consent=True,
            e_kyc_status=True,
            parcel_id=parcel_id,
            bank_account_ifsc_key=bank_key,
        )
        db.add(details)
        db.commit()

        flags = isolation_forest_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "ML_ISOLATION_FOREST_OUTLIER" not in codes
        db.close()

    def test_multivariate_outlier_flagged(self):
        """
        Multivariate outlier: Centenarian applicant claiming massive landholding
        with major land area discrepancy. Should be flagged by Isolation Forest.
        """
        db = TestingSessionLocal()
        farmer = create_farmer_user(db, "outlier@test.com")

        parcel_id = "UP-LKO-TEH01-VIL01-KH99-PL99"
        bank_key = "999988887777-SBIN0001234"
        aadhaar_ref = hash_aadhaar("999999999999")

        # Master record exists but has land area = 0.5 Ha vs claimed 8.5 Ha (1600% discrepancy)
        db.add(LandRecordMaster(
            parcel_id=parcel_id,
            state_code="UP", district_code="LKO", tehsil_code="TEH01",
            village_code="VIL01", khata_number="KH99", plot_number="PL99",
            owner_aadhaar_ref=aadhaar_ref,
            owner_name="Unknown Entity",
            land_area_ha=0.5,
            land_use_code="AGRICULTURE",
            agricultural_land_flag=True,
            ownership_status="ACTIVE",
            title_status="CLEAR",
        ))
        db.commit()

        app = Application(user_id=farmer.id, scheme_code="PM_KISAN", status="UNDER_REVIEW")
        db.add(app)
        db.flush()

        details = PMKisanApplicationDetails(
            application_id=app.id,
            farmer_name="Old Outlier",
            date_of_birth=datetime.date(1915, 1, 1),  # Age 111 years
            gender="Other",
            mobile_number="9876543219",
            otp_verified=True,
            aadhaar_ref=aadhaar_ref,
            aadhaar_masked="XXXX-XXXX-9999",
            bank_account_number="999988887777",
            ifsc_code="SBIN0001234",
            state_code="UP", district_code="LKO", tehsil_code="TEH01",
            village_code="VIL01", khata_number="KH99", plot_number="PL99",
            declared_land_area_ha=8.5,  # Massive outlier
            ownership_type="Joint",
            land_document_path="/uploads/test.pdf",
            self_declaration=True,
            e_kyc_consent=True,
            e_kyc_status=True,
            parcel_id=parcel_id,
            bank_account_ifsc_key=bank_key,
        )
        db.add(details)
        db.commit()

        flags = isolation_forest_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "ML_ISOLATION_FOREST_OUTLIER" in codes
        flag = next(f for f in flags if f.anomaly_code == "ML_ISOLATION_FOREST_OUTLIER")
        assert flag.evidence_json["is_outlier"] is True
        assert "decision_score" in flag.evidence_json
        assert len(flag.evidence_json["anomaly_drivers"]) > 0
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 2. Decoupled Risk vs Confidence Scoring Tests (RISK-01, RISK-05)
# ─────────────────────────────────────────────────────────────────────────────

class TestRiskConfidenceSeparation:
    def test_clean_applicant_low_risk_high_confidence(self):
        """Verified genuine applicant has 0 risk but high evidential confidence."""
        db = TestingSessionLocal()
        farmer = create_farmer_user(db, "clean_conf@test.com")

        parcel_id = "UP-LKO-TEH01-VIL01-KH101-PL101"
        bank_key = "112233445566-SBIN0001234"
        aadhaar_ref = hash_aadhaar("112233445566")

        db.add(LandRecordMaster(
            parcel_id=parcel_id, state_code="UP", district_code="LKO", tehsil_code="TEH01",
            village_code="VIL01", khata_number="KH101", plot_number="PL101",
            owner_aadhaar_ref=aadhaar_ref, owner_name="Ramesh Kumar", land_area_ha=1.0,
            land_use_code="AGRICULTURE", agricultural_land_flag=True, ownership_status="ACTIVE",
            title_status="CLEAR",
        ))
        db.add(BankValidationMaster(
            bank_account_ifsc_key=bank_key, bank_account_number="112233445566",
            ifsc_code="SBIN0001234", account_holder_name="Ramesh Kumar",
            account_status="ACTIVE", ifsc_valid=True, penny_drop_status="SUCCESS",
            name_match_score=1.0,
        ))
        db.commit()

        app = Application(user_id=farmer.id, scheme_code="PM_KISAN", status="UNDER_REVIEW")
        db.add(app)
        db.flush()

        details = PMKisanApplicationDetails(
            application_id=app.id, farmer_name="Ramesh Kumar",
            date_of_birth=datetime.date(1985, 1, 1), gender="Male",
            mobile_number="9876543210", otp_verified=True, aadhaar_ref=aadhaar_ref,
            aadhaar_masked="XXXX-XXXX-5566", bank_account_number="112233445566",
            ifsc_code="SBIN0001234", state_code="UP", district_code="LKO",
            tehsil_code="TEH01", village_code="VIL01", khata_number="KH101",
            plot_number="PL101", declared_land_area_ha=1.0, ownership_type="Single",
            land_document_path="/uploads/test.pdf", self_declaration=True,
            e_kyc_consent=True, e_kyc_status=True, parcel_id=parcel_id,
            bank_account_ifsc_key=bank_key,
        )
        db.add(details)
        db.commit()

        pipeline_res = run_pipeline(details, db)
        risk_score = compute_risk_score(pipeline_res.flags)
        conf_score, conf_level = compute_confidence(pipeline_res.flags, details, db)

        # Risk must be zero, but confidence must be HIGH (>80%) because all registries verified
        assert risk_score == 0
        assert conf_score >= 80
        assert conf_level == "High"
        db.close()

    def test_taxpayer_exclusion_high_risk_high_confidence(self):
        """Hard exclusion hit has critical risk AND high confidence (deterministic proof)."""
        db = TestingSessionLocal()
        farmer = create_farmer_user(db, "taxpayer_conf@test.com")

        tax_ref = hash_aadhaar("999900001111")
        db.add(ExclusionMaster(aadhaar_ref=tax_ref, taxpayer_flag=True))
        db.commit()

        app = Application(user_id=farmer.id, scheme_code="PM_KISAN", status="UNDER_REVIEW")
        db.add(app)
        db.flush()

        details = PMKisanApplicationDetails(
            application_id=app.id, farmer_name="Ramesh Kumar",
            date_of_birth=datetime.date(1985, 1, 1), gender="Male",
            mobile_number="9876543210", otp_verified=True, aadhaar_ref=tax_ref,
            aadhaar_masked="XXXX-XXXX-1111", bank_account_number="112233445599",
            ifsc_code="SBIN0001234", state_code="UP", district_code="LKO",
            tehsil_code="TEH01", village_code="VIL01", khata_number="KH102",
            plot_number="PL102", declared_land_area_ha=1.0, ownership_type="Single",
            land_document_path="/uploads/test.pdf", self_declaration=True,
            e_kyc_consent=True, e_kyc_status=True, parcel_id="UP-LKO-TEH01-VIL01-KH102-PL102",
            bank_account_ifsc_key="112233445599-SBIN0001234",
        )
        db.add(details)
        db.commit()

        pipeline_res = run_pipeline(details, db)
        risk_score = compute_risk_score(pipeline_res.flags)
        conf_score, conf_level = compute_confidence(pipeline_res.flags, details, db)

        # Risk must be high (>=55) AND confidence must be High (>=95%) due to deterministic statutory match
        assert risk_score >= 55
        assert conf_score >= 95
        assert conf_level == "High"
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 3. Officer Final Decision Workflow Tests (ADM-04, ADM-05)
# ─────────────────────────────────────────────────────────────────────────────

class TestOfficerFinalDecision:
    def test_application_initially_pending_officer_decision(self):
        """Newly submitted applications are UNDER_REVIEW and never automatically approved."""
        db = TestingSessionLocal()
        farmer = create_farmer_user(db, "app_status@test.com")
        token_res = client.post(
            "/api/auth/login",
            json={"email": "app_status@test.com", "password": "FarmerPass!123"}
        )
        token = token_res.json()["access_token"]

        mock_pdf = io.BytesIO(b"%PDF-1.4 test deed")
        res = client.post(
            "/api/applications/pm-kisan",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "farmer_name": "Ramesh Kumar",
                "date_of_birth": "1985-06-20",
                "gender": "Male",
                "mobile_number": "9876543210",
                "otp": "123456",
                "aadhaar_number": "987654321012",
                "e_kyc_consent": "true",
                "bank_account_number": "123456789012",
                "ifsc_code": "SBIN0001234",
                "state_code": "UP",
                "district_code": "LKO",
                "tehsil_code": "TEH01",
                "village_code": "VIL01",
                "khata_number": "KH-1",
                "plot_number": "PL-1",
                "declared_land_area_ha": "1.0",
                "ownership_type": "Single",
                "self_declaration": "true",
            },
            files={"land_document": ("deed.pdf", mock_pdf, "application/pdf")},
        )
        assert res.status_code == 201
        app_id = res.json()["application_id"]

        # Verify DB status is SUBMITTED/UNDER_REVIEW, and NOT automatically approved
        app = db.query(Application).filter_by(id=app_id).first()
        assert app.status in ["SUBMITTED", "UNDER_REVIEW"]
        assert app.status != "APPROVED"
        assert app.officer_decision is None
        db.close()

    def test_officer_approval_decision(self):
        """Scheme officer explicitly APPROVES an application with mandatory remarks."""
        db = TestingSessionLocal()
        admin = create_admin_user(db)
        admin_token_res = client.post(
            "/api/auth/login",
            json={"email": "admin_officer@gov.in", "password": "AdminSecurePass!1"}
        )
        admin_token = admin_token_res.json()["access_token"]

        farmer = create_farmer_user(db, "app_approve@test.com")
        app = Application(user_id=farmer.id, scheme_code="PM_KISAN", status="UNDER_REVIEW")
        db.add(app)
        db.commit()
        db.refresh(app)

        res = client.post(
            f"/api/admin/applications/{app.id}/decision",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "decision": "APPROVE",
                "remarks": "Land deed and physical RoR verified by Patwari; application approved for PM-KISAN.",
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["new_status"] == "APPROVED"
        assert data["decision"] == "APPROVE"

        # Verify application status and audit log in DB
        db.refresh(app)
        assert app.status == "APPROVED"
        assert app.officer_decision == "APPROVE"

        audit = db.query(AuditLog).filter_by(application_id=app.id).first()
        assert audit is not None
        assert audit.action == "APPROVE"
        assert "Patwari" in audit.remarks
        db.close()

    def test_officer_rejection_decision(self):
        """Scheme officer REJECTS an application with remarks."""
        db = TestingSessionLocal()
        admin = create_admin_user(db)
        admin_token_res = client.post(
            "/api/auth/login",
            json={"email": "admin_officer@gov.in", "password": "AdminSecurePass!1"}
        )
        admin_token = admin_token_res.json()["access_token"]

        farmer = create_farmer_user(db, "app_reject@test.com")
        app = Application(user_id=farmer.id, scheme_code="PM_KISAN", status="UNDER_REVIEW")
        db.add(app)
        db.commit()
        db.refresh(app)

        res = client.post(
            f"/api/admin/applications/{app.id}/decision",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "decision": "REJECT",
                "remarks": "Claimant disqualified due to statutory income tax payee exclusion.",
            }
        )
        assert res.status_code == 200
        assert res.json()["new_status"] == "REJECTED"
        db.refresh(app)
        assert app.status == "REJECTED"
        db.close()

    def test_officer_decision_invalid_action(self):
        """Invalid decision verb should be rejected with 400 Bad Request."""
        db = TestingSessionLocal()
        create_admin_user(db)
        admin_token_res = client.post(
            "/api/auth/login",
            json={"email": "admin_officer@gov.in", "password": "AdminSecurePass!1"}
        )
        admin_token = admin_token_res.json()["access_token"]

        res = client.post(
            "/api/admin/applications/1/decision",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"decision": "AUTO_DISBURSE", "remarks": "Invalid action test"}
        )
        assert res.status_code == 400
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 4. Evaluation Metrics Endpoint Test (EVAL-01)
# ─────────────────────────────────────────────────────────────────────────────

class TestEvaluationMetricsEndpoint:
    def test_admin_can_fetch_evaluation_metrics(self):
        """Admin can call GET /api/admin/evaluation/metrics to benchmark the pipeline."""
        db = TestingSessionLocal()
        create_admin_user(db)
        admin_token_res = client.post(
            "/api/auth/login",
            json={"email": "admin_officer@gov.in", "password": "AdminSecurePass!1"}
        )
        admin_token = admin_token_res.json()["access_token"]

        res = client.get(
            "/api/admin/evaluation/metrics",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "precision" in data
        assert "recall" in data
        assert "f1_score" in data
        assert "accuracy" in data
        assert "specificity" in data
        assert "false_positive_rate" in data
        assert data["precision"] >= 0.80
        assert data["recall"] >= 0.80
        assert data["f1_score"] >= 0.80
        db.close()
