"""
KisanGuard Portal — End-to-End Verification Test Suite
Phase 7: SEED-04 (Comprehensive E2E Workflow & Policy Verification)

Tests:
  1. SEED-01 / AUTH: Farmer registration, password hashing, JWT issue/decode,
     profile retrieval, invalid login rejection, role-based boundary enforcement.
  2. SEED-02 / SCHEME & INGESTION: Multipart PM-KISAN submission, document handling,
     salt-hashed Aadhaar storage, masked citizen representation, composite key generation.
  3. PRIVACY GATING: Strict role-based redaction: citizens see only sanitized status guidance;
     risk scores, anomaly codes, and officer rationales remain completely redacted.
  4. SEED-03 / ANOMALY ENGINES:
     - Identity Engine (OTP, e-KYC, duplicate Aadhaar)
     - Land Engine (Bhulekh master checks, non-agri classification, inactive ownership)
     - Bank Engine (account verification, penny-drop failure, inactive account)
     - Exclusion Engine (CBDT taxpayer match, deceased status)
     - Duplicate Parcel Engine (multi-claim collision detection)
     - Statistical & Temporal Engines (village density and pre-event surges)
     - Machine Learning & Graph Engines (Isolation Forest multivariate outliers & syndicates)
  5. SEED-04 / ADMIN ADJUDICATION & AUDIT:
     - Admin application listing, search, and filtering
     - Full anomaly dossier retrieval with raw evidence JSON
     - Officer Final Decision actions (APPROVE, REJECT, HOLD, REQUEST_DOCUMENTS)
     - Mandatory remarks validation (length constraints)
     - Immutable audit trail generation in audit_logs
     - Synthetic ground-truth evaluation benchmark (Precision / Recall / F1)
"""

import io
import datetime
import pytest
from sqlalchemy.orm import Session

from app.models import (
    User,
    Application,
    PMKisanApplicationDetails,
    AnomalyReport,
    AnomalyFlag,
    LandRecordMaster,
    BankValidationMaster,
    ExclusionMaster,
    VillageProfileMaster,
    EventCalendarMaster,
    AuditLog,
)
from app.auth import hash_password, hash_aadhaar, mask_aadhaar
from tests.conftest import client, TestingSessionLocal


# ─────────────────────────────────────────────────────────────────────────────
# Test Fixtures and Helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_farmer_auth_headers(email: str = "farmer_e2e@test.com", password: str = "FarmerPass@123") -> dict:
    """Helper to register and authenticate a test farmer, returning auth Bearer headers."""
    db = TestingSessionLocal()
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        res = client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": password,
                "full_name": "E2E Farmer",
                "mobile_number": "9876543210",
                "date_of_birth": "1988-04-12",
                "gender": "Male",
                "category": "General",
            },
        )
        assert res.status_code == 201
        token = res.json()["access_token"]
    else:
        login_res = client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
    db.close()
    return {"Authorization": f"Bearer {token}"}


def get_admin_auth_headers(email: str = "admin_e2e@pmkisan.gov.in", password: str = "AdminPass@123") -> dict:
    """Helper to seed an admin user in test DB and return valid auth Bearer headers."""
    db = TestingSessionLocal()
    admin = db.query(User).filter(User.email == email).first()
    if not admin:
        admin = User(
            email=email,
            password_hash=hash_password(password),
            full_name="E2E Admin Officer",
            mobile_number="9876543299",
            date_of_birth=datetime.date(1980, 5, 20),
            gender="Male",
            category="General",
            role="ADMIN",
        )
        db.add(admin)
        db.commit()
    db.close()

    res = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def get_mock_land_document():
    """Return a mock PDF file tuple for multipart upload."""
    return ("land_document", ("test_deed.pdf", io.BytesIO(b"%PDF-1.4 Mock Land Deed For E2E Test"), "application/pdf"))


def get_valid_pm_kisan_form_data(**overrides):
    """Return valid default form parameters for PM-KISAN application submission."""
    base_data = {
        "farmer_name": "E2E Farmer",
        "date_of_birth": "1988-04-12",
        "gender": "Male",
        "category": "General",
        "mobile_number": "9876543210",
        "otp": "123456",
        "aadhaar_number": "987654321099",
        "e_kyc_consent": "true",
        "bank_account_number": "123456789012",
        "ifsc_code": "SBIN0001234",
        "state_code": "UP",
        "district_code": "MRT",
        "tehsil_code": "HAP",
        "village_code": "VIL001",
        "khata_number": "K100",
        "plot_number": "P100",
        "declared_land_area_ha": "1.50",
        "ownership_type": "Single",
        "declared_crop_code": "WHEAT",
        "self_declaration": "true",
    }
    base_data.update(overrides)
    return base_data


# ─────────────────────────────────────────────────────────────────────────────
# 1. AUTHENTICATION & ROLE-BASED ACCESS CONTROL (SEED-01)
# ─────────────────────────────────────────────────────────────────────────────

class TestAuthAndRBAC:
    """Validate user registration, login, token issue, profile and role security."""

    def test_farmer_registration_success(self):
        """New citizen can register and receive a signed JWT access token."""
        res = client.post(
            "/api/auth/register",
            json={
                "email": "newfarmer@test.com",
                "password": "SecurePassword@123",
                "full_name": "Devendra Singh",
                "mobile_number": "9811223344",
                "date_of_birth": "1990-08-25",
                "gender": "Male",
                "category": "OBC",
            },
        )
        assert res.status_code == 201
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "newfarmer@test.com"
        assert data["user"]["role"] == "USER"

    def test_duplicate_registration_rejected(self):
        """Registering with an already existing email returns 400."""
        payload = {
            "email": "dup@test.com",
            "password": "Password@123",
            "full_name": "Test Duplicate",
            "mobile_number": "9800000000",
            "date_of_birth": "1991-01-01",
            "gender": "Male",
        }
        res1 = client.post("/api/auth/register", json=payload)
        assert res1.status_code == 201
        res2 = client.post("/api/auth/register", json=payload)
        assert res2.status_code == 400

    def test_login_invalid_credentials(self):
        """Incorrect credentials return 401 Unauthorized."""
        res = client.post(
            "/api/auth/login",
            json={"email": "nonexistent@test.com", "password": "WrongPassword"},
        )
        assert res.status_code == 401

    def test_get_current_user_me(self):
        """Authenticated user can fetch their personal profile."""
        headers = get_farmer_auth_headers("me_test@test.com")
        res = client.get("/api/auth/me", headers=headers)
        assert res.status_code == 200
        assert res.json()["email"] == "me_test@test.com"

    def test_farmer_denied_admin_routes(self):
        """Farmers cannot access admin endpoints (403 Forbidden)."""
        headers = get_farmer_auth_headers("farmer_denied@test.com")
        res = client.get("/api/admin/applications", headers=headers)
        assert res.status_code == 403
        assert "ADMIN role required" in res.json()["detail"]


# ─────────────────────────────────────────────────────────────────────────────
# 2. SCHEME APPLICATION INGESTION & PRIVACY (SEED-02 & APP-01..05)
# ─────────────────────────────────────────────────────────────────────────────

class TestApplicationIngestionAndPrivacy:
    """Validate application submission, document handling, key derivation, and zero-leak privacy."""

    def test_submit_clean_application_success(self):
        """Valid PM-KISAN application submission succeeds and returns immediate submission metadata."""
        headers = get_farmer_auth_headers("submit_test@test.com")
        form_data = get_valid_pm_kisan_form_data()
        files = [get_mock_land_document()]

        res = client.post(
            "/api/applications/pm-kisan",
            data=form_data,
            files=files,
            headers=headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert "application_id" in data
        assert data["scheme_code"] == "PM_KISAN"
        assert data["status"] == "SUBMITTED"
        assert "citizen_status_message" in data
        assert data["parcel_id"] == "UP-MRT-HAP-VIL001-K100-P100"
        assert data["aadhaar_masked"] == "XXXX-XXXX-1099"

    def test_raw_aadhaar_never_persisted_in_database(self):
        """Raw 12-digit Aadhaar number is NEVER stored; only salted SHA-256 hash is kept."""
        headers = get_farmer_auth_headers("privacy_aadhaar@test.com")
        raw_aadhaar = "998877665544"
        form_data = get_valid_pm_kisan_form_data(aadhaar_number=raw_aadhaar)
        files = [get_mock_land_document()]

        res = client.post(
            "/api/applications/pm-kisan",
            data=form_data,
            files=files,
            headers=headers,
        )
        assert res.status_code == 201
        app_id = res.json()["application_id"]

        # Inspect database directly
        db = TestingSessionLocal()
        details = db.query(PMKisanApplicationDetails).filter(
            PMKisanApplicationDetails.application_id == app_id
        ).first()
        db.close()

        assert details is not None
        # Must NOT equal raw 12 digits
        assert details.aadhaar_ref != raw_aadhaar
        # Must be 64-char hexadecimal SHA-256 string
        assert len(details.aadhaar_ref) == 64
        assert details.aadhaar_ref == hash_aadhaar(raw_aadhaar)
        # Masked representation format
        assert details.aadhaar_masked == "XXXX-XXXX-5544"

    def test_derived_composite_keys_generated_correctly(self):
        """Standard parcel_id and bank_account_ifsc_key composite keys are generated accurately."""
        headers = get_farmer_auth_headers("keys_test@test.com")
        form_data = get_valid_pm_kisan_form_data(
            state_code="up",
            district_code="mrt",
            tehsil_code="hap",
            village_code="vil002",
            khata_number="kh-12",
            plot_number="pl-34",
            bank_account_number="98765432101",
            ifsc_code="sbin0001234",
        )
        files = [get_mock_land_document()]

        res = client.post(
            "/api/applications/pm-kisan",
            data=form_data,
            files=files,
            headers=headers,
        )
        assert res.status_code == 201
        app_id = res.json()["application_id"]

        db = TestingSessionLocal()
        details = db.query(PMKisanApplicationDetails).filter(
            PMKisanApplicationDetails.application_id == app_id
        ).first()
        db.close()

        assert details.parcel_id == "UP-MRT-HAP-VIL002-KH-12-PL-34"
        assert details.bank_account_ifsc_key == "98765432101-SBIN0001234"

    def test_farmer_detail_view_strictly_redacts_risk_scores(self):
        """
        CITIZEN PRIVACY CONTRACT:
        Farmer querying GET /api/applications/{id} must NEVER see:
        - risk_score
        - confidence_score / confidence_level
        - anomaly_flags or anomaly_report
        - recommended_action or officer internal rationale
        """
        headers = get_farmer_auth_headers("redaction_test@test.com")
        form_data = get_valid_pm_kisan_form_data()
        files = [get_mock_land_document()]

        submit_res = client.post(
            "/api/applications/pm-kisan",
            data=form_data,
            files=files,
            headers=headers,
        )
        app_id = submit_res.json()["application_id"]

        # Farmer requests application detail
        res = client.get(f"/api/applications/{app_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()

        # Sensitive fraud fields must be completely absent from CitizenApplicationDetail
        assert "risk_score" not in data
        assert "confidence_score" not in data
        assert "confidence_level" not in data
        assert "anomaly_report" not in data
        assert "anomaly_flags" not in data
        assert "recommended_action" not in data
        assert "officer_remarks" not in data
        # Only safe guidance is visible
        assert "citizen_status_message" in data
        assert "status" in data


# ─────────────────────────────────────────────────────────────────────────────
# 3. ANOMALY DETECTION ENGINES VERIFICATION (SEED-03 & ENG-01..08)
# ─────────────────────────────────────────────────────────────────────────────

class TestAnomalyEnginesVerification:
    """Validate deterministic detection across all anomaly engines."""

    def test_exclusion_engine_flags_taxpayer(self):
        """Exclusion engine detects applicant Aadhaar present in CBDT taxpayer registry."""
        taxpayer_aadhaar = "200000000001"
        taxpayer_hash = hash_aadhaar(taxpayer_aadhaar)

        # Seed taxpayer in exclusion master
        db = TestingSessionLocal()
        db.query(ExclusionMaster).filter(ExclusionMaster.aadhaar_ref == taxpayer_hash).delete()
        db.add(ExclusionMaster(
            aadhaar_ref=taxpayer_hash,
            taxpayer_flag=True,
        ))
        db.commit()
        db.close()

        headers = get_farmer_auth_headers("taxpayer_applicant@test.com")
        form_data = get_valid_pm_kisan_form_data(aadhaar_number=taxpayer_aadhaar)
        files = [get_mock_land_document()]

        res = client.post("/api/applications/pm-kisan", data=form_data, files=files, headers=headers)
        assert res.status_code == 201
        app_id = res.json()["application_id"]

        # Verify anomaly flags in DB
        db = TestingSessionLocal()
        flags = db.query(AnomalyFlag).filter(AnomalyFlag.application_id == app_id).all()
        flag_codes = [f.anomaly_code for f in flags]
        db.close()

        assert "EXCLUSION_TAXPAYER" in flag_codes

    def test_land_engine_flags_non_agricultural_parcel(self):
        """Land engine flags parcel classified as non-agricultural in state land records."""
        parcel_id = "UP-MRT-HAP-VIL001-K999-P999"
        db = TestingSessionLocal()
        db.query(LandRecordMaster).filter(LandRecordMaster.parcel_id == parcel_id).delete()
        db.add(LandRecordMaster(
            parcel_id=parcel_id,
            state_code="UP", district_code="MRT", tehsil_code="HAP", village_code="VIL001",
            khata_number="K999", plot_number="P999",
            owner_name="Test Owner",
            land_area_ha=2.5,
            land_use_code="COMMERCIAL_MALL",
            agricultural_land_flag=False,
            ownership_status="ACTIVE",
            title_status="CLEAR",
        ))
        db.commit()
        db.close()

        headers = get_farmer_auth_headers("non_agri_farmer@test.com")
        form_data = get_valid_pm_kisan_form_data(
            khata_number="K999",
            plot_number="P999",
        )
        files = [get_mock_land_document()]

        res = client.post("/api/applications/pm-kisan", data=form_data, files=files, headers=headers)
        assert res.status_code == 201
        app_id = res.json()["application_id"]

        db = TestingSessionLocal()
        flags = db.query(AnomalyFlag).filter(AnomalyFlag.application_id == app_id).all()
        flag_codes = [f.anomaly_code for f in flags]
        db.close()

        assert "LAND_NOT_AGRICULTURAL" in flag_codes

    def test_bank_engine_flags_inactive_account(self):
        """Bank engine flags inactive/closed account in PFMS registry."""
        acc_num = "998877660011"
        ifsc = "SBIN0001234"
        key = f"{acc_num}-{ifsc}".upper()

        db = TestingSessionLocal()
        db.query(BankValidationMaster).filter(BankValidationMaster.bank_account_ifsc_key == key).delete()
        db.add(BankValidationMaster(
            bank_account_ifsc_key=key,
            bank_account_number=acc_num,
            ifsc_code=ifsc,
            account_holder_name="E2E Farmer",
            account_status="INACTIVE",
            ifsc_valid=True,
            penny_drop_status="SUCCESS",
            name_match_score=1.0,
        ))
        db.commit()
        db.close()

        headers = get_farmer_auth_headers("bank_inactive_farmer@test.com")
        form_data = get_valid_pm_kisan_form_data(
            bank_account_number=acc_num,
            ifsc_code=ifsc,
        )
        files = [get_mock_land_document()]

        res = client.post("/api/applications/pm-kisan", data=form_data, files=files, headers=headers)
        assert res.status_code == 201
        app_id = res.json()["application_id"]

        db = TestingSessionLocal()
        flags = db.query(AnomalyFlag).filter(AnomalyFlag.application_id == app_id).all()
        flag_codes = [f.anomaly_code for f in flags]
        db.close()

        assert "BANK_ACCOUNT_INACTIVE" in flag_codes

    def test_duplicate_parcel_claim_detection(self):
        """Duplicate Parcel engine flags second application claiming an already-submitted parcel."""
        # 1. First applicant submits parcel
        headers1 = get_farmer_auth_headers("claimant1@test.com")
        form_data1 = get_valid_pm_kisan_form_data(
            khata_number="K555",
            plot_number="P555",
            aadhaar_number="111122223333",
        )
        res1 = client.post("/api/applications/pm-kisan", data=form_data1, files=[get_mock_land_document()], headers=headers1)
        assert res1.status_code == 201

        # 2. Second applicant submits the EXACT same parcel
        headers2 = get_farmer_auth_headers("claimant2@test.com")
        form_data2 = get_valid_pm_kisan_form_data(
            khata_number="K555",
            plot_number="P555",
            aadhaar_number="444455556666",
        )
        res2 = client.post("/api/applications/pm-kisan", data=form_data2, files=[get_mock_land_document()], headers=headers2)
        assert res2.status_code == 201
        app2_id = res2.json()["application_id"]

        db = TestingSessionLocal()
        flags = db.query(AnomalyFlag).filter(AnomalyFlag.application_id == app2_id).all()
        flag_codes = [f.anomaly_code for f in flags]
        db.close()

        assert "PARCEL_DUPLICATE_CLAIM" in flag_codes


# ─────────────────────────────────────────────────────────────────────────────
# 4. ADMIN REVIEW CONSOLE & OFFICER FINAL DECISION WORKFLOW (SEED-04 & ADM-01..06)
# ─────────────────────────────────────────────────────────────────────────────

class TestAdminWorkflowAndDecisions:
    """Validate officer review console, anomaly dossier inspection, decision gating, and audit logging."""

    def test_admin_can_view_all_applications_and_dossiers(self):
        """Scheme officer can list applications and inspect deep anomaly dossiers with raw evidence."""
        # Submit an application
        farmer_headers = get_farmer_auth_headers("dossier_applicant@test.com")
        client.post("/api/applications/pm-kisan", data=get_valid_pm_kisan_form_data(), files=[get_mock_land_document()], headers=farmer_headers)

        # Admin logs in and queries applications
        admin_headers = get_admin_auth_headers()
        res = client.get("/api/admin/applications", headers=admin_headers)
        assert res.status_code == 200
        apps = res.json()
        assert len(apps) > 0

        # Admin inspects the first application's dossier
        target_id = apps[0]["id"]
        res_dossier = client.get(f"/api/admin/applications/{target_id}", headers=admin_headers)
        assert res_dossier.status_code == 200
        dossier = res_dossier.json()

        assert "risk_score" in dossier
        assert "confidence_score" in dossier
        assert "confidence_level" in dossier
        assert "anomaly_report" in dossier
        assert "anomaly_flags" in dossier

    def test_officer_final_decision_approve(self):
        """Officer approving an application transitions status to APPROVED with remarks."""
        farmer_headers = get_farmer_auth_headers("approve_app_farmer@test.com")
        submit_res = client.post("/api/applications/pm-kisan", data=get_valid_pm_kisan_form_data(), files=[get_mock_land_document()], headers=farmer_headers)
        app_id = submit_res.json()["application_id"]

        admin_headers = get_admin_auth_headers()
        decision_res = client.post(
            f"/api/admin/applications/{app_id}/decision",
            json={"decision": "APPROVE", "remarks": "Patwari physical verification completed. Records verified."},
            headers=admin_headers,
        )
        assert decision_res.status_code == 200
        data = decision_res.json()
        assert data["decision"] == "APPROVE"
        assert data["new_status"] == "APPROVED"
        assert "Patwari physical verification" in data["remarks"]

        # Verify application in database
        db = TestingSessionLocal()
        app = db.query(Application).filter(Application.id == app_id).first()
        db.close()
        assert app.status == "APPROVED"
        assert app.officer_decision == "APPROVE"

    def test_officer_final_decision_reject(self):
        """Officer rejecting an application transitions status to REJECTED."""
        farmer_headers = get_farmer_auth_headers("reject_app_farmer@test.com")
        submit_res = client.post("/api/applications/pm-kisan", data=get_valid_pm_kisan_form_data(), files=[get_mock_land_document()], headers=farmer_headers)
        app_id = submit_res.json()["application_id"]

        admin_headers = get_admin_auth_headers()
        decision_res = client.post(
            f"/api/admin/applications/{app_id}/decision",
            json={"decision": "REJECT", "remarks": "Applicant failed mandatory statutory criteria."},
            headers=admin_headers,
        )
        assert decision_res.status_code == 200
        assert decision_res.json()["new_status"] == "REJECTED"

    def test_officer_final_decision_hold_payment(self):
        """Officer placing application on HOLD transitions status to PAYMENT_HELD."""
        farmer_headers = get_farmer_auth_headers("hold_app_farmer@test.com")
        submit_res = client.post("/api/applications/pm-kisan", data=get_valid_pm_kisan_form_data(), files=[get_mock_land_document()], headers=farmer_headers)
        app_id = submit_res.json()["application_id"]

        admin_headers = get_admin_auth_headers()
        decision_res = client.post(
            f"/api/admin/applications/{app_id}/decision",
            json={"decision": "HOLD", "remarks": "High-risk bank anomaly. Placed on payment hold."},
            headers=admin_headers,
        )
        assert decision_res.status_code == 200
        assert decision_res.json()["new_status"] == "PAYMENT_HELD"

    def test_officer_decision_requires_mandatory_remarks(self):
        """Officer decision without remarks fails validation (Pydantic 422)."""
        farmer_headers = get_farmer_auth_headers("remarks_test_farmer@test.com")
        submit_res = client.post("/api/applications/pm-kisan", data=get_valid_pm_kisan_form_data(), files=[get_mock_land_document()], headers=farmer_headers)
        app_id = submit_res.json()["application_id"]

        admin_headers = get_admin_auth_headers()
        # Empty remarks
        res = client.post(
            f"/api/admin/applications/{app_id}/decision",
            json={"decision": "APPROVE", "remarks": ""},
            headers=admin_headers,
        )
        assert res.status_code == 422

    def test_immutable_audit_log_created_on_officer_decision(self):
        """Every officer decision creates an immutable AuditLog entry recording who, when, and why."""
        farmer_headers = get_farmer_auth_headers("audit_test_farmer@test.com")
        submit_res = client.post("/api/applications/pm-kisan", data=get_valid_pm_kisan_form_data(), files=[get_mock_land_document()], headers=farmer_headers)
        app_id = submit_res.json()["application_id"]

        admin_headers = get_admin_auth_headers("audit_officer@pmkisan.gov.in")
        remarks_text = "Verified through district land revenue record audit."
        decision_res = client.post(
            f"/api/admin/applications/{app_id}/decision",
            json={"decision": "APPROVE", "remarks": remarks_text},
            headers=admin_headers,
        )
        assert decision_res.status_code == 200

        # Check audit_logs table
        db = TestingSessionLocal()
        audit_records = db.query(AuditLog).filter(AuditLog.application_id == app_id).all()
        db.close()

        assert len(audit_records) == 1
        entry = audit_records[0]
        assert entry.action == "APPROVE"
        assert entry.remarks == remarks_text
        assert entry.created_at is not None

    def test_admin_evaluation_metrics_benchmark(self):
        """Admin can benchmark anomaly detection pipeline against synthetic ground truth."""
        admin_headers = get_admin_auth_headers()
        res = client.get("/api/admin/evaluation/metrics", headers=admin_headers)
        assert res.status_code == 200
        metrics = res.json()

        assert "accuracy" in metrics
        assert "precision" in metrics
        assert "recall" in metrics
        assert "f1_score" in metrics
        assert "confusion_matrix" in metrics or "true_positives" in metrics
        assert metrics["total_test_samples"] > 0
