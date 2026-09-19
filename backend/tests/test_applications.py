import io
import datetime
import pytest
from app.models import User, Application, PMKisanApplicationDetails
from app.auth import hash_password, hash_aadhaar
from tests.conftest import client, TestingSessionLocal


def create_test_user(email: str, role: str = "USER") -> str:
    """Helper: Seed a user directly in test DB and return valid JWT access token."""
    db = TestingSessionLocal()
    user = User(
        email=email,
        password_hash=hash_password("SecurePass123!"),
        full_name="Ramesh Kumar",
        mobile_number="9876543210",
        date_of_birth=datetime.date(1985, 6, 15),
        gender="Male",
        category="General",
        role=role,
    )
    db.add(user)
    db.commit()
    db.close()

    # Login to get JWT
    login_res = client.post(
        "/api/auth/login",
        json={"email": email, "password": "SecurePass123!"},
    )
    assert login_res.status_code == 200
    return login_res.json()["access_token"]


def get_sample_application_form_data():
    """Return standard valid PM-KISAN form parameters."""
    return {
        "farmer_name": "Ramesh Kumar",
        "date_of_birth": "1985-06-15",
        "gender": "Male",
        "category": "General",
        "mobile_number": "9876543210",
        "otp": "123456",
        "aadhaar_number": "987654321012",
        "e_kyc_consent": "true",
        "bank_account_number": "123456789012",
        "ifsc_code": "SBIN0001234",
        "state_code": "UP",
        "district_code": "LKO",
        "tehsil_code": "TEH01",
        "village_code": "VIL101",
        "khata_number": "KH-452",
        "plot_number": "PL-108",
        "declared_land_area_ha": "1.25",
        "ownership_type": "Single",
        "declared_crop_code": "WHEAT",
        "self_declaration": "true",
    }


# ============================================================================
# 1. Scheme Metadata Specification Tests
# ============================================================================

def test_get_pm_kisan_fields():
    """Verify PM-KISAN scheme specification returns 200 and all 7 form sections."""
    response = client.get("/api/schemes/PM_KISAN/fields")
    assert response.status_code == 200
    data = response.json()
    assert data["scheme_code"] == "PM_KISAN"
    assert data["max_file_size_mb"] == 5
    assert "application/pdf" in data["allowed_mime_types"]
    assert len(data["sections"]) == 7

    section_ids = [s["section_id"] for s in data["sections"]]
    assert "personal_details" in section_ids
    assert "mobile_verification" in section_ids
    assert "identity_aadhaar" in section_ids
    assert "bank_details" in section_ids
    assert "land_details" in section_ids
    assert "document_upload" in section_ids
    assert "statutory_declarations" in section_ids


def test_get_invalid_scheme_fields():
    """Verify unknown scheme code returns 404 Not Found."""
    response = client.get("/api/schemes/UNKNOWN_SCHEME/fields")
    assert response.status_code == 404
    assert "not supported" in response.json()["detail"].lower()


# ============================================================================
# 2. Application Submission & Verification Tests
# ============================================================================

def test_submit_application_success():
    """Verify valid PM-KISAN application submission returns 201 Created and composite keys."""
    token = create_test_user("farmer1@test.com", role="USER")
    form_data = get_sample_application_form_data()
    mock_pdf = io.BytesIO(b"%PDF-1.4 Mock deed binary content for PM-KISAN test")

    response = client.post(
        "/api/applications/pm-kisan",
        headers={"Authorization": f"Bearer {token}"},
        data=form_data,
        files={"land_document": ("deed.pdf", mock_pdf, "application/pdf")},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["scheme_code"] == "PM_KISAN"
    assert data["status"] == "SUBMITTED"
    assert "parcel_id" in data
    assert data["parcel_id"] == "UP-LKO-TEH01-VIL101-KH-452-PL-108"
    assert data["aadhaar_masked"] == "XXXX-XXXX-1012"
    assert "application received" in data["citizen_status_message"].lower()


def test_aadhaar_privacy_never_stored_plaintext():
    """
    CRITICAL PRIVACY TEST:
    Verify raw 12-digit Aadhaar ('987654321012') is NEVER stored in database columns.
    Only salted SHA-256 hash and masked 'XXXX-XXXX-1012' must exist.
    """
    token = create_test_user("privacy_farmer@test.com", role="USER")
    raw_aadhaar = "987654321012"
    form_data = get_sample_application_form_data()
    form_data["aadhaar_number"] = raw_aadhaar

    mock_pdf = io.BytesIO(b"%PDF-1.4 Test content")
    response = client.post(
        "/api/applications/pm-kisan",
        headers={"Authorization": f"Bearer {token}"},
        data=form_data,
        files={"land_document": ("deed.pdf", mock_pdf, "application/pdf")},
    )
    assert response.status_code == 201
    app_id = response.json()["application_id"]

    # Directly inspect database
    db = TestingSessionLocal()
    details = db.query(PMKisanApplicationDetails).filter_by(application_id=app_id).first()
    assert details is not None

    # 1. Assert raw aadhaar is nowhere in the details record
    assert raw_aadhaar not in str(details.__dict__.values())

    # 2. Assert salted hash and mask are correct
    expected_hash = hash_aadhaar(raw_aadhaar)
    assert details.aadhaar_ref == expected_hash
    assert details.aadhaar_masked == "XXXX-XXXX-1012"
    assert details.bank_account_ifsc_key == "123456789012-SBIN0001234"
    db.close()


def test_submit_invalid_file_extension():
    """Verify non-allowed file extension (.exe, .txt) is rejected with 400 Bad Request."""
    token = create_test_user("ext_farmer@test.com", role="USER")
    form_data = get_sample_application_form_data()
    mock_file = io.BytesIO(b"executable content")

    response = client.post(
        "/api/applications/pm-kisan",
        headers={"Authorization": f"Bearer {token}"},
        data=form_data,
        files={"land_document": ("malicious.exe", mock_file, "application/x-msdownload")},
    )
    assert response.status_code == 400
    assert "unsupported document format" in response.json()["detail"].lower()


def test_submit_invalid_file_size():
    """Verify file exceeding 5MB limit is rejected with 400 Bad Request."""
    token = create_test_user("size_farmer@test.com", role="USER")
    form_data = get_sample_application_form_data()
    # 5.1 MB dummy content
    oversized_file = io.BytesIO(b"0" * (5 * 1024 * 1024 + 1024))

    response = client.post(
        "/api/applications/pm-kisan",
        headers={"Authorization": f"Bearer {token}"},
        data=form_data,
        files={"land_document": ("huge_deed.pdf", oversized_file, "application/pdf")},
    )
    assert response.status_code == 400
    assert "exceeds the 5mb maximum limit" in response.json()["detail"].lower()


def test_submit_invalid_otp():
    """Verify invalid mobile OTP is rejected with 400 Bad Request."""
    token = create_test_user("otp_farmer@test.com", role="USER")
    form_data = get_sample_application_form_data()
    form_data["otp"] = "999999"  # Incorrect mock OTP

    mock_pdf = io.BytesIO(b"%PDF-1.4 Mock deed")
    response = client.post(
        "/api/applications/pm-kisan",
        headers={"Authorization": f"Bearer {token}"},
        data=form_data,
        files={"land_document": ("deed.pdf", mock_pdf, "application/pdf")},
    )
    assert response.status_code == 400
    assert "invalid mobile verification otp" in response.json()["detail"].lower()


def test_submit_invalid_aadhaar_format():
    """Verify malformed Aadhaar (< 12 digits) is rejected with 400 Bad Request."""
    token = create_test_user("aadhaar_farmer@test.com", role="USER")
    form_data = get_sample_application_form_data()
    form_data["aadhaar_number"] = "12345"  # Too short

    mock_pdf = io.BytesIO(b"%PDF-1.4 Mock deed")
    response = client.post(
        "/api/applications/pm-kisan",
        headers={"Authorization": f"Bearer {token}"},
        data=form_data,
        files={"land_document": ("deed.pdf", mock_pdf, "application/pdf")},
    )
    assert response.status_code == 400
    assert "invalid aadhaar number" in response.json()["detail"].lower()


def test_submit_invalid_ifsc():
    """Verify malformed IFSC code is rejected with 400 Bad Request."""
    token = create_test_user("ifsc_farmer@test.com", role="USER")
    form_data = get_sample_application_form_data()
    form_data["ifsc_code"] = "NOT_AN_IFSC"

    mock_pdf = io.BytesIO(b"%PDF-1.4 Mock deed")
    response = client.post(
        "/api/applications/pm-kisan",
        headers={"Authorization": f"Bearer {token}"},
        data=form_data,
        files={"land_document": ("deed.pdf", mock_pdf, "application/pdf")},
    )
    assert response.status_code == 400
    assert "invalid ifsc code" in response.json()["detail"].lower()


# ============================================================================
# 3. Role Isolation & Citizen View Redaction Tests
# ============================================================================

def test_farmer_get_my_applications():
    """Verify farmer can retrieve their list of submitted applications."""
    token = create_test_user("list_farmer@test.com", role="USER")
    form_data = get_sample_application_form_data()
    mock_pdf = io.BytesIO(b"%PDF-1.4 Mock deed")

    client.post(
        "/api/applications/pm-kisan",
        headers={"Authorization": f"Bearer {token}"},
        data=form_data,
        files={"land_document": ("deed.pdf", mock_pdf, "application/pdf")},
    )

    response = client.get(
        "/api/applications/my",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    apps = response.json()
    assert len(apps) == 1
    assert apps[0]["scheme_code"] == "PM_KISAN"
    assert apps[0]["farmer_name"] == "Ramesh Kumar"
    assert "citizen_status_message" in apps[0]


def test_farmer_view_application_redaction():
    """
    CRITICAL ROLE ISOLATION TEST:
    Verify farmer view strictly REDACTS risk_score, confidence_level, and anomaly_flags.
    """
    token = create_test_user("redact_farmer@test.com", role="USER")
    form_data = get_sample_application_form_data()
    mock_pdf = io.BytesIO(b"%PDF-1.4 Mock deed")

    sub_res = client.post(
        "/api/applications/pm-kisan",
        headers={"Authorization": f"Bearer {token}"},
        data=form_data,
        files={"land_document": ("deed.pdf", mock_pdf, "application/pdf")},
    )
    app_id = sub_res.json()["application_id"]

    response = client.get(
        f"/api/applications/{app_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    detail = response.json()

    # Citizen fields present
    assert detail["farmer_name"] == "Ramesh Kumar"
    assert detail["status"] == "SUBMITTED"
    assert "citizen_status_message" in detail
    assert detail["bank_account_number"] == "XXXXXXXX9012"  # Masked bank account

    # Fraud scoring fields MUST NOT be present in farmer response
    assert "risk_score" not in detail
    assert "confidence_level" not in detail
    assert "recommended_action" not in detail
    assert "anomaly_report" not in detail
    assert "anomaly_flags" not in detail


def test_farmer_cannot_view_other_farmer_application():
    """Verify farmer A cannot view farmer B's application (403 Forbidden)."""
    token_a = create_test_user("farmer_a@test.com", role="USER")
    token_b = create_test_user("farmer_b@test.com", role="USER")

    form_data = get_sample_application_form_data()
    mock_pdf = io.BytesIO(b"%PDF-1.4 Mock deed")

    sub_res = client.post(
        "/api/applications/pm-kisan",
        headers={"Authorization": f"Bearer {token_a}"},
        data=form_data,
        files={"land_document": ("deed.pdf", mock_pdf, "application/pdf")},
    )
    app_id_a = sub_res.json()["application_id"]

    # Farmer B attempts to view Farmer A's application
    response = client.get(
        f"/api/applications/{app_id_a}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert response.status_code == 403
    assert "access denied" in response.json()["detail"].lower()


def test_admin_can_view_any_application():
    """Verify scheme officer (ADMIN) can inspect any application with full audit details."""
    farmer_token = create_test_user("farmer_sub@test.com", role="USER")
    admin_token = create_test_user("admin_officer@test.com", role="ADMIN")

    form_data = get_sample_application_form_data()
    mock_pdf = io.BytesIO(b"%PDF-1.4 Mock deed")

    sub_res = client.post(
        "/api/applications/pm-kisan",
        headers={"Authorization": f"Bearer {farmer_token}"},
        data=form_data,
        files={"land_document": ("deed.pdf", mock_pdf, "application/pdf")},
    )
    app_id = sub_res.json()["application_id"]

    response = client.get(
        f"/api/applications/{app_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    admin_view = response.json()
    assert admin_view["id"] == app_id
    assert admin_view["farmer_name"] == "Ramesh Kumar"
    assert "aadhaar_ref" in admin_view
    assert "bank_account_ifsc_key" in admin_view
    assert "anomaly_flags" in admin_view
