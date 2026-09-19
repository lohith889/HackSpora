import pytest
from fastapi import Depends
from app.main import app
from app.models import User
from app.auth import hash_password, require_role
from tests.conftest import client, TestingSessionLocal

# Create a test admin-only endpoint to test require_role
@app.get("/api/test-admin-only", tags=["Test"])
def admin_only_endpoint(admin_user: User = Depends(require_role("ADMIN"))):
    return {"message": "Welcome, Administrator", "admin_email": admin_user.email}


def test_health_check():
    """Verify health endpoint returns status 200 and 'ok'."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["project"] == "KisanGuard Portal"


def test_register_user():
    """Verify valid farmer registration returns 201 Created and JWT access token."""
    payload = {
        "email": "farmer.ramesh@test.com",
        "password": "FarmerPassword@123",
        "full_name": "Ramesh Kumar",
        "mobile_number": "9876543210",
        "date_of_birth": "1985-06-15",
        "gender": "Male",
        "category": "Small/Marginal",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "farmer.ramesh@test.com"
    assert data["user"]["role"] == "USER"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]


def test_register_duplicate_email():
    """Verify registering with duplicate email returns 400 Bad Request."""
    payload = {
        "email": "duplicate@test.com",
        "password": "Password@123",
        "full_name": "Duplicate Test",
        "mobile_number": "9876543210",
        "date_of_birth": "1990-01-01",
        "gender": "Male",
    }
    # First registration
    resp1 = client.post("/api/auth/register", json=payload)
    assert resp1.status_code == 201

    # Second registration with same email
    resp2 = client.post("/api/auth/register", json=payload)
    assert resp2.status_code == 400
    assert "already exists" in resp2.json()["detail"]


def test_login_success():
    """Verify user login with valid credentials returns 200 OK and JWT token."""
    # Register user
    client.post(
        "/api/auth/register",
        json={
            "email": "login.test@test.com",
            "password": "SecretPassword@123",
            "full_name": "Login Test",
            "mobile_number": "9876543211",
            "date_of_birth": "1988-03-20",
            "gender": "Female",
        },
    )

    # Login
    response = client.post(
        "/api/auth/login",
        json={"email": "login.test@test.com", "password": "SecretPassword@123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "login.test@test.com"


def test_login_invalid_password():
    """Verify login with incorrect password returns 401 Unauthorized."""
    client.post(
        "/api/auth/register",
        json={
            "email": "wrongpw@test.com",
            "password": "CorrectPassword@123",
            "full_name": "Wrong Password Test",
            "mobile_number": "9876543212",
            "date_of_birth": "1992-05-10",
            "gender": "Male",
        },
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "wrongpw@test.com", "password": "IncorrectPassword"},
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


def test_login_nonexistent_email():
    """Verify login with non-existent email returns 401 Unauthorized."""
    response = client.post(
        "/api/auth/login",
        json={"email": "nonexistent@test.com", "password": "AnyPassword"},
    )
    assert response.status_code == 401


def test_get_current_user_me():
    """Verify GET /api/auth/me returns current user profile with valid Bearer token."""
    reg_response = client.post(
        "/api/auth/register",
        json={
            "email": "me.test@test.com",
            "password": "Password@123",
            "full_name": "Me Endpoint Test",
            "mobile_number": "9876543213",
            "date_of_birth": "1980-11-25",
            "gender": "Male",
        },
    )
    token = reg_response.json()["access_token"]

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    user_data = response.json()
    assert user_data["email"] == "me.test@test.com"
    assert user_data["full_name"] == "Me Endpoint Test"


def test_get_current_user_unauthorized():
    """Verify GET /api/auth/me without token returns 401 Unauthorized."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_role_guard_restriction():
    """Verify require_role enforces access control: USER is 403 Forbidden, ADMIN is 200 OK."""
    # 1. Register normal USER
    user_resp = client.post(
        "/api/auth/register",
        json={
            "email": "normal.user@test.com",
            "password": "Password@123",
            "full_name": "Normal User",
            "mobile_number": "9876543214",
            "date_of_birth": "1995-07-07",
            "gender": "Female",
        },
    )
    user_token = user_resp.json()["access_token"]

    # Attempt to access admin endpoint with USER token -> Expected 403 Forbidden
    resp_forbidden = client.get(
        "/api/test-admin-only",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp_forbidden.status_code == 403
    assert "ADMIN role required" in resp_forbidden.json()["detail"]

    # 2. Seed an ADMIN user directly into DB and login
    import datetime
    db = TestingSessionLocal()
    admin_user = User(
        email="admin@pmkisan.gov.in",
        password_hash=hash_password("Admin@123"),
        full_name="Scheme Admin Officer",
        mobile_number="9999999999",
        date_of_birth=datetime.date(1980, 1, 1),
        gender="Male",
        role="ADMIN",
    )
    db.add(admin_user)
    db.commit()

    # Login as ADMIN
    admin_login_resp = client.post(
        "/api/auth/login",
        json={"email": "admin@pmkisan.gov.in", "password": "Admin@123"},
    )
    assert admin_login_resp.status_code == 200
    admin_token = admin_login_resp.json()["access_token"]

    # Access admin endpoint with ADMIN token -> Expected 200 OK
    resp_allowed = client.get(
        "/api/test-admin-only",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp_allowed.status_code == 200
    assert resp_allowed.json()["message"] == "Welcome, Administrator"


def test_update_user_profile():
    """Verify authenticated user can update profile details via PUT /api/auth/me."""
    user_resp = client.post(
        "/api/auth/register",
        json={
            "email": "update.profile@test.com",
            "password": "Password@123",
            "full_name": "Original Name",
            "mobile_number": "9876543219",
            "date_of_birth": "1992-04-10",
            "gender": "Male",
            "category": "General",
        },
    )
    token = user_resp.json()["access_token"]

    update_resp = client.put(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "full_name": "Updated Name",
            "category": "OBC",
        },
    )
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["full_name"] == "Updated Name"
    assert updated_data["category"] == "OBC"
    assert updated_data["email"] == "update.profile@test.com"

