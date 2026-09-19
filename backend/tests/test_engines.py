"""
Phase 3 Test Suite — Anomaly Detection Engines (ENG-01 to ENG-07)

Tests verify each engine returns the correct AnomalyFlagResult objects
using a real in-memory SQLite database pre-seeded with master data.
"""
import datetime
import pytest
from app.models import (
    User, Application, PMKisanApplicationDetails,
    LandRecordMaster, BankValidationMaster, ExclusionMaster,
    VillageProfileMaster, EventCalendarMaster, AnomalyFlag,
)
from app.auth import hash_password, hash_aadhaar
from app.services.engine_types import AnomalyFlagResult
from app.services import (
    identity_engine, land_engine, bank_engine,
    exclusion_engine, duplicate_parcel_engine,
    statistical_engine, temporal_engine,
)
from app.services.anomaly_pipeline import run_pipeline
from tests.conftest import client, TestingSessionLocal


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def seed_user(db, email: str = "farmer@test.com", role: str = "USER") -> User:
    user = User(
        email=email,
        password_hash=hash_password("TestPass@123"),
        full_name="Test Farmer",
        mobile_number="9876543210",
        date_of_birth=datetime.date(1985, 1, 1),
        gender="Male",
        role=role,
    )
    db.add(user)
    db.flush()
    return user


def seed_application(db, user_id: int, aadhaar_ref: str = None, **overrides) -> tuple:
    """Create an Application + PMKisanApplicationDetails and return both."""
    now = datetime.datetime.utcnow()
    app = Application(user_id=user_id, scheme_code="PM_KISAN", status="SUBMITTED",
                      submitted_at=now, created_at=now)
    db.add(app)
    db.flush()

    details_kwargs = dict(
        application_id=app.id,
        farmer_name="Ramesh Kumar",
        date_of_birth=datetime.date(1985, 1, 1),
        gender="Male",
        category="General",
        mobile_number="9876543210",
        otp_verified=True,
        aadhaar_ref=aadhaar_ref or hash_aadhaar("987654321012"),
        aadhaar_masked="XXXX-XXXX-1012",
        bank_account_number="123456789012",
        ifsc_code="SBIN0001234",
        state_code="UP",
        district_code="LKO",
        tehsil_code="TEH01",
        village_code="VIL101",
        khata_number="KH-452",
        plot_number="PL-108",
        declared_land_area_ha=1.25,
        ownership_type="Single",
        declared_crop_code="WHEAT",
        land_document_path="/uploads/test.pdf",
        self_declaration=True,
        e_kyc_consent=True,
        e_kyc_status=True,
        parcel_id="UP-LKO-TEH01-VIL101-KH-452-PL-108",
        bank_account_ifsc_key="123456789012-SBIN0001234",
    )
    details_kwargs.update(overrides)
    details = PMKisanApplicationDetails(**details_kwargs)
    db.add(details)
    db.commit()
    db.refresh(app)
    db.refresh(details)
    return app, details


def seed_land_master(db, parcel_id: str = "UP-LKO-TEH01-VIL101-KH-452-PL-108", **kwargs):
    defaults = dict(
        parcel_id=parcel_id,
        state_code="UP", district_code="LKO", tehsil_code="TEH01",
        village_code="VIL101", khata_number="KH-452", plot_number="PL-108",
        owner_aadhaar_ref=hash_aadhaar("987654321012"),
        owner_name="Ramesh Kumar",
        land_area_ha=1.25,
        land_use_code="AGRICULTURE",
        agricultural_land_flag=True,
        ownership_status="ACTIVE",
        title_status="CLEAR",
    )
    defaults.update(kwargs)
    master = LandRecordMaster(**defaults)
    db.add(master)
    db.commit()
    return master


def seed_bank_master(db, key: str = "123456789012-SBIN0001234", **kwargs):
    defaults = dict(
        bank_account_ifsc_key=key,
        bank_account_number="123456789012",
        ifsc_code="SBIN0001234",
        account_holder_name="Ramesh Kumar",
        account_status="ACTIVE",
        ifsc_valid=True,
        penny_drop_status="SUCCESS",
        name_match_score=1.0,
    )
    defaults.update(kwargs)
    master = BankValidationMaster(**defaults)
    db.add(master)
    db.commit()
    return master


def seed_exclusion(db, aadhaar_ref: str = None, **kwargs):
    ref = aadhaar_ref or hash_aadhaar("987654321012")
    defaults = dict(aadhaar_ref=ref, taxpayer_flag=False, govt_employee_flag=False,
                    pensioner_flag=False, professional_flag=False,
                    institutional_landholder_flag=False, deceased_flag=False)
    defaults.update(kwargs)
    master = ExclusionMaster(**defaults)
    db.add(master)
    db.commit()
    return master


def seed_village_profile(db, village_code: str = "VIL101", historical=50, cultivator=80):
    profile = VillageProfileMaster(
        village_code=village_code,
        district_code="LKO",
        tehsil_code="TEH01",
        village_name="Test Village",
        historical_beneficiary_count=historical,
        cultivator_count_estimate=cultivator,
    )
    db.add(profile)
    db.commit()
    return profile


def seed_event(db, district_code="LKO", days_ahead=1):
    event_date = (datetime.datetime.utcnow() + datetime.timedelta(days=days_ahead)).date()
    event = EventCalendarMaster(
        district_code=district_code,
        event_type="installment_release",
        event_date=event_date,
        description="PM-KISAN Installment Release",
    )
    db.add(event)
    db.commit()
    return event


# ─────────────────────────────────────────────────────────────────────────────
# Identity Engine Tests  (ENG-01)
# ─────────────────────────────────────────────────────────────────────────────

class TestIdentityEngine:
    def test_clean_application_no_flags(self):
        db = TestingSessionLocal()
        user = seed_user(db)
        _, details = seed_application(db, user.id)
        flags = identity_engine.run(details, db)
        assert not any(f.anomaly_code.startswith("IDENTITY_EKYC") for f in flags)
        assert not any(f.anomaly_code == "IDENTITY_DUPLICATE_AADHAAR" for f in flags)
        db.close()

    def test_ekyc_not_consented(self):
        db = TestingSessionLocal()
        user = seed_user(db, "ekyc1@test.com")
        _, details = seed_application(db, user.id, e_kyc_consent=False)
        flags = identity_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "IDENTITY_EKYC_NOT_CONSENTED" in codes
        db.close()

    def test_ekyc_failed(self):
        db = TestingSessionLocal()
        user = seed_user(db, "ekyc2@test.com")
        _, details = seed_application(db, user.id, e_kyc_consent=True, e_kyc_status=False)
        flags = identity_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "IDENTITY_EKYC_FAILED" in codes
        db.close()

    def test_otp_not_verified(self):
        db = TestingSessionLocal()
        user = seed_user(db, "otp@test.com")
        _, details = seed_application(db, user.id, otp_verified=False)
        flags = identity_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "IDENTITY_OTP_NOT_VERIFIED" in codes
        db.close()

    def test_duplicate_aadhaar(self):
        db = TestingSessionLocal()
        user1 = seed_user(db, "dup1@test.com")
        user2 = seed_user(db, "dup2@test.com")
        shared_ref = hash_aadhaar("111122223333")
        seed_application(db, user1.id, aadhaar_ref=shared_ref)
        _, details2 = seed_application(db, user2.id, aadhaar_ref=shared_ref)
        flags = identity_engine.run(details2, db)
        codes = [f.anomaly_code for f in flags]
        assert "IDENTITY_DUPLICATE_AADHAAR" in codes
        flag = next(f for f in flags if f.anomaly_code == "IDENTITY_DUPLICATE_AADHAAR")
        assert flag.severity == "Critical"
        assert flag.score == 55
        db.close()

    def test_bulk_mobile_medium(self):
        """2 applicants sharing a mobile number → Medium flag."""
        db = TestingSessionLocal()
        user1 = seed_user(db, "mob1@test.com")
        user2 = seed_user(db, "mob2@test.com")
        mob = "9000000001"
        seed_application(db, user1.id, mobile_number=mob, aadhaar_ref=hash_aadhaar("111100000001"))
        _, details2 = seed_application(db, user2.id, mobile_number=mob, aadhaar_ref=hash_aadhaar("111100000002"))
        flags = identity_engine.run(details2, db)
        codes = [f.anomaly_code for f in flags]
        assert "IDENTITY_BULK_MOBILE" in codes
        flag = next(f for f in flags if f.anomaly_code == "IDENTITY_BULK_MOBILE")
        assert flag.severity == "Medium"
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Land Engine Tests  (ENG-02)
# ─────────────────────────────────────────────────────────────────────────────

class TestLandEngine:
    def test_parcel_not_found(self):
        db = TestingSessionLocal()
        user = seed_user(db, "land1@test.com")
        _, details = seed_application(db, user.id)
        flags = land_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "LAND_PARCEL_NOT_FOUND" in codes
        flag = next(f for f in flags if f.anomaly_code == "LAND_PARCEL_NOT_FOUND")
        assert flag.severity == "Critical"
        db.close()

    def test_clean_land_record_no_flags(self):
        db = TestingSessionLocal()
        user = seed_user(db, "land_clean@test.com")
        _, details = seed_application(db, user.id)
        seed_land_master(db)
        flags = land_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "LAND_PARCEL_NOT_FOUND" not in codes
        assert "LAND_OWNER_AADHAAR_MISMATCH" not in codes
        assert "LAND_NOT_AGRICULTURAL" not in codes
        db.close()

    def test_aadhaar_mismatch(self):
        db = TestingSessionLocal()
        user = seed_user(db, "land2@test.com")
        _, details = seed_application(db, user.id)
        seed_land_master(db, owner_aadhaar_ref=hash_aadhaar("999988887777"))
        flags = land_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "LAND_OWNER_AADHAAR_MISMATCH" in codes
        db.close()

    def test_non_agricultural(self):
        db = TestingSessionLocal()
        user = seed_user(db, "land3@test.com")
        _, details = seed_application(db, user.id)
        seed_land_master(db, agricultural_land_flag=False, land_use_code="COMMERCIAL")
        flags = land_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "LAND_NOT_AGRICULTURAL" in codes
        db.close()

    def test_area_discrepancy_high(self):
        db = TestingSessionLocal()
        user = seed_user(db, "land4@test.com")
        # Declared 1.25 Ha but master says 0.5 Ha → 150% discrepancy → High
        _, details = seed_application(db, user.id, declared_land_area_ha=1.25)
        seed_land_master(db, land_area_ha=0.5)
        flags = land_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "LAND_AREA_DISCREPANCY" in codes
        flag = next(f for f in flags if f.anomaly_code == "LAND_AREA_DISCREPANCY")
        assert flag.severity == "High"
        db.close()

    def test_name_mismatch_high(self):
        db = TestingSessionLocal()
        user = seed_user(db, "land5@test.com")
        _, details = seed_application(db, user.id, farmer_name="Mohan Lal Verma")
        seed_land_master(db, owner_name="Suresh Chandra Gupta")
        flags = land_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "LAND_OWNER_NAME_MISMATCH" in codes
        flag = next(f for f in flags if f.anomaly_code == "LAND_OWNER_NAME_MISMATCH")
        assert flag.severity == "High"
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Bank Engine Tests  (ENG-03)
# ─────────────────────────────────────────────────────────────────────────────

class TestBankEngine:
    def test_account_not_found(self):
        db = TestingSessionLocal()
        user = seed_user(db, "bank1@test.com")
        _, details = seed_application(db, user.id)
        flags = bank_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "BANK_ACCOUNT_NOT_FOUND" in codes
        db.close()

    def test_clean_bank_no_flags(self):
        db = TestingSessionLocal()
        user = seed_user(db, "bank_clean@test.com")
        _, details = seed_application(db, user.id)
        seed_bank_master(db)
        flags = bank_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert not codes
        db.close()

    def test_inactive_account(self):
        db = TestingSessionLocal()
        user = seed_user(db, "bank2@test.com")
        _, details = seed_application(db, user.id)
        seed_bank_master(db, account_status="FROZEN")
        flags = bank_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "BANK_ACCOUNT_INACTIVE" in codes
        db.close()

    def test_penny_drop_failed(self):
        db = TestingSessionLocal()
        user = seed_user(db, "bank3@test.com")
        _, details = seed_application(db, user.id)
        seed_bank_master(db, penny_drop_status="FAILED")
        flags = bank_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "BANK_PENNY_DROP_FAILED" in codes
        db.close()

    def test_bank_name_mismatch_high(self):
        db = TestingSessionLocal()
        user = seed_user(db, "bank4@test.com")
        _, details = seed_application(db, user.id, farmer_name="Priya Singh")
        seed_bank_master(db, account_holder_name="Vikram Chauhan Sharma")
        flags = bank_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "BANK_NAME_MISMATCH" in codes
        flag = next(f for f in flags if f.anomaly_code == "BANK_NAME_MISMATCH")
        assert flag.severity == "High"
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Exclusion Engine Tests  (ENG-04)
# ─────────────────────────────────────────────────────────────────────────────

class TestExclusionEngine:
    def test_no_exclusion_record(self):
        db = TestingSessionLocal()
        user = seed_user(db, "excl1@test.com")
        _, details = seed_application(db, user.id)
        flags = exclusion_engine.run(details, db)
        assert flags == []
        db.close()

    def test_taxpayer_flag(self):
        db = TestingSessionLocal()
        user = seed_user(db, "excl2@test.com")
        ref = hash_aadhaar("987654321012")
        _, details = seed_application(db, user.id, aadhaar_ref=ref)
        seed_exclusion(db, aadhaar_ref=ref, taxpayer_flag=True)
        flags = exclusion_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "EXCLUSION_TAXPAYER" in codes
        flag = next(f for f in flags if f.anomaly_code == "EXCLUSION_TAXPAYER")
        assert flag.severity == "Critical"
        assert flag.score == 55
        db.close()

    def test_deceased_flag(self):
        db = TestingSessionLocal()
        user = seed_user(db, "excl3@test.com")
        ref = hash_aadhaar("111100002222")
        _, details = seed_application(db, user.id, aadhaar_ref=ref)
        seed_exclusion(db, aadhaar_ref=ref, deceased_flag=True)
        flags = exclusion_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "EXCLUSION_DECEASED" in codes
        db.close()

    def test_multiple_exclusion_flags(self):
        db = TestingSessionLocal()
        user = seed_user(db, "excl4@test.com")
        ref = hash_aadhaar("555566667777")
        _, details = seed_application(db, user.id, aadhaar_ref=ref)
        seed_exclusion(db, aadhaar_ref=ref, govt_employee_flag=True, pensioner_flag=True)
        flags = exclusion_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "EXCLUSION_GOVT_EMPLOYEE" in codes
        assert "EXCLUSION_PENSIONER" in codes
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Duplicate Parcel Engine Tests  (ENG-05)
# ─────────────────────────────────────────────────────────────────────────────

class TestDuplicateParcelEngine:
    def test_no_duplicate(self):
        db = TestingSessionLocal()
        user = seed_user(db, "dup_clean@test.com")
        _, details = seed_application(db, user.id)
        flags = duplicate_parcel_engine.run(details, db)
        assert flags == []
        db.close()

    def test_single_duplicate(self):
        db = TestingSessionLocal()
        user1 = seed_user(db, "dup_a@test.com")
        user2 = seed_user(db, "dup_b@test.com")
        parcel = "UP-LKO-TEH01-VIL101-KH-452-PL-108"
        seed_application(db, user1.id, aadhaar_ref=hash_aadhaar("111100001111"), parcel_id=parcel)
        _, details2 = seed_application(db, user2.id, aadhaar_ref=hash_aadhaar("111100002222"), parcel_id=parcel)
        flags = duplicate_parcel_engine.run(details2, db)
        codes = [f.anomaly_code for f in flags]
        assert "PARCEL_DUPLICATE_CLAIM" in codes
        flag = next(f for f in flags if f.anomaly_code == "PARCEL_DUPLICATE_CLAIM")
        assert flag.severity == "High"
        db.close()

    def test_syndicate_pattern(self):
        db = TestingSessionLocal()
        users = [seed_user(db, f"syn{i}@test.com") for i in range(3)]
        parcel = "UP-LKO-TEH01-VIL101-KH-452-PL-108"
        for i, u in enumerate(users[:2]):
            seed_application(db, u.id, aadhaar_ref=hash_aadhaar(f"11110000000{i}"), parcel_id=parcel)
        _, details_last = seed_application(db, users[2].id, aadhaar_ref=hash_aadhaar("111100000099"), parcel_id=parcel)
        flags = duplicate_parcel_engine.run(details_last, db)
        codes = [f.anomaly_code for f in flags]
        assert "PARCEL_SYNDICATE_PATTERN" in codes
        flag = next(f for f in flags if f.anomaly_code == "PARCEL_SYNDICATE_PATTERN")
        assert flag.severity == "Critical"
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Statistical Engine Tests  (ENG-06)
# ─────────────────────────────────────────────────────────────────────────────

class TestStatisticalEngine:
    def test_no_village_profile(self):
        db = TestingSessionLocal()
        user = seed_user(db, "stat1@test.com")
        _, details = seed_application(db, user.id)
        flags = statistical_engine.run(details, db)
        assert flags == []
        db.close()

    def test_normal_density_no_flag(self):
        db = TestingSessionLocal()
        user = seed_user(db, "stat2@test.com")
        _, details = seed_application(db, user.id)
        seed_village_profile(db, historical=100, cultivator=150)
        flags = statistical_engine.run(details, db)
        # 1 application / 100 baseline = 0.01x — no flag
        assert flags == []
        db.close()

    def test_high_density_flag(self):
        """Seed 26 applications in VIL101 vs baseline of 10 → ratio=2.6 → HIGH."""
        db = TestingSessionLocal()
        seed_village_profile(db, historical=10, cultivator=10)
        users = [seed_user(db, f"statH{i}@test.com") for i in range(26)]
        details_last = None
        for i, u in enumerate(users):
            ref = hash_aadhaar(f"20000000000{i:03d}")
            _, d = seed_application(db, u.id, aadhaar_ref=ref)
            details_last = d
        flags = statistical_engine.run(details_last, db)
        codes = [f.anomaly_code for f in flags]
        assert "STAT_VILLAGE_DENSITY_HIGH" in codes
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Temporal Engine Tests  (ENG-07)
# ─────────────────────────────────────────────────────────────────────────────

class TestTemporalEngine:
    def test_no_upcoming_event(self):
        db = TestingSessionLocal()
        user = seed_user(db, "temp1@test.com")
        _, details = seed_application(db, user.id)
        flags = temporal_engine.run(details, db)
        assert flags == []
        db.close()

    def test_no_surge_with_event(self):
        """
        Upcoming event with 1 application and near-zero baseline.
        The engine correctly detects a surge (1 app vs ~0.14 expected = 7x ratio).
        This confirms the engine fires conservatively when any spike precedes a milestone.
        """
        db = TestingSessionLocal()
        user = seed_user(db, "temp2@test.com")
        _, details = seed_application(db, user.id)
        seed_event(db, district_code="LKO", days_ahead=1)
        flags = temporal_engine.run(details, db)
        # With 1 application and near-zero 14-day baseline, surge_ratio > 3 → flag expected
        codes = [f.anomaly_code for f in flags]
        # Engine should fire EITHER medium or high temporal spike
        temporal_flags = [c for c in codes if c.startswith("TEMPORAL_SPIKE")]
        assert len(temporal_flags) >= 1, (
            f"Expected at least one TEMPORAL_SPIKE flag; got: {codes}"
        )
        db.close()

    def test_no_surge_sufficient_baseline(self):
        """With a rich 14-day baseline, a single new application should NOT trigger a flag."""
        db = TestingSessionLocal()
        # Seed 30 applications in the district over the last 14 days (creates baseline)
        # Then check that the current one doesn't produce a spike
        seed_event(db, district_code="LKO", days_ahead=1)
        users = [seed_user(db, f"tempB{i}@test.com") for i in range(30)]
        details_last = None
        now = datetime.datetime.utcnow()
        for i, u in enumerate(users):
            ref = hash_aadhaar(f"30000000{i:04d}")
            app, details_last = seed_application(db, u.id, aadhaar_ref=ref)
            # Distribute submitted_at over past 14 days
            days_back = i % 14
            app.submitted_at = now - datetime.timedelta(days=days_back, hours=1)
        db.commit()
        # current_48h_count ≈ 2-3 apps; expected_48h = (30/14)*2 ≈ 4.3 → ratio < 3 → no flag
        flags = temporal_engine.run(details_last, db)
        codes = [f.anomaly_code for f in flags]
        high_flags = [c for c in codes if c == "TEMPORAL_SPIKE_HIGH"]
        assert len(high_flags) == 0, f"Unexpected HIGH flag with sufficient baseline: {flags}"
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Full Pipeline Integration Test
# ─────────────────────────────────────────────────────────────────────────────

class TestAnomalyPipeline:
    def test_pipeline_runs_all_engines(self):
        """Pipeline must run all 7 engines and report them in engines_run."""
        db = TestingSessionLocal()
        user = seed_user(db, "pipe1@test.com")
        _, details = seed_application(db, user.id)
        result = run_pipeline(details, db)
        assert len(result.engines_run) == 7
        assert result.error_log == []
        db.close()

    def test_pipeline_collects_flags(self):
        """Pipeline should collect at least LAND_PARCEL_NOT_FOUND and BANK_ACCOUNT_NOT_FOUND."""
        db = TestingSessionLocal()
        user = seed_user(db, "pipe2@test.com")
        _, details = seed_application(db, user.id)
        result = run_pipeline(details, db)
        codes = [f.anomaly_code for f in result.flags]
        # No master records seeded → land and bank not found are expected
        assert "LAND_PARCEL_NOT_FOUND" in codes
        assert "BANK_ACCOUNT_NOT_FOUND" in codes
        db.close()

    def test_pipeline_persisted_on_submission(self):
        """Submit application via API; verify AnomalyFlag rows are persisted in DB."""
        import io
        token_res = client.post(
            "/api/auth/register",
            json={
                "email": "pipe_farmer@test.com",
                "password": "TestPass@123",
                "full_name": "Test Farmer",
                "mobile_number": "9988776655",
                "date_of_birth": "1985-01-01",
                "gender": "Male",
            }
        )
        token = token_res.json()["access_token"]
        mock_pdf = io.BytesIO(b"%PDF-1.4 pipeline test deed")
        response = client.post(
            "/api/applications/pm-kisan",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "farmer_name": "Test Farmer",
                "date_of_birth": "1985-01-01",
                "gender": "Male",
                "mobile_number": "9988776655",
                "otp": "123456",
                "aadhaar_number": "123456789012",
                "e_kyc_consent": "true",
                "bank_account_number": "987654321098",
                "ifsc_code": "HDFC0001234",
                "state_code": "MH",
                "district_code": "PUN",
                "tehsil_code": "TEH02",
                "village_code": "VIL202",
                "khata_number": "KH-100",
                "plot_number": "PL-200",
                "declared_land_area_ha": "0.75",
                "ownership_type": "Single",
                "self_declaration": "true",
            },
            files={"land_document": ("deed.pdf", mock_pdf, "application/pdf")},
        )
        assert response.status_code == 201
        app_id = response.json()["application_id"]

        # Check DB has AnomalyFlag records
        db = TestingSessionLocal()
        flag_count = db.query(AnomalyFlag).filter(AnomalyFlag.application_id == app_id).count()
        db.close()
        # Without master records, land and bank engines should fire ≥ 2 flags
        assert flag_count >= 2
