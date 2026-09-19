"""
KisanGuard Portal — Master Seed Data Script
Phase 7: SEED-01, SEED-02, SEED-03

Provisions:
  1. Default Admin (admin@pmkisan.gov.in / Admin@123) and Test Farmer (farmer@test.com / Farmer@123)
  2. 25+ Land Records (LandRecordMaster)
  3. 25+ Bank Validation Records (BankValidationMaster)
  4. 20+ Exclusion Master Records (taxpayer, govt employee, pensioner, professional, institutional, deceased)
  5. 20+ Village Profile Master Records (normal baselines & sparse baselines for density testing)
  6. 20+ Event Calendar Master Records (upcoming deadlines & installment releases)
  7. 20 Sample PM-KISAN Applications across Low (10), Medium (5), and High (5) Risk tiers
     exercising all detection engines with populated AnomalyReports and AnomalyFlags.
"""

import os
import sys
import datetime
from typing import List, Dict, Any

# Ensure backend root is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from app.database import Base, engine, SessionLocal
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
from app.services.anomaly_pipeline import run_pipeline
from app.services.risk_scorer import compute_risk_score, get_recommended_action
from app.services.confidence_engine import compute_confidence
from app.services.rationale_generator import generate_rationale


# ─────────────────────────────────────────────────────────────────────────────
# 1. SEED USERS (SEED-01)
# ─────────────────────────────────────────────────────────────────────────────

def seed_users(db: SessionLocal) -> Dict[str, User]:
    """Seed primary admin and test farmer users."""
    print("  -> Seeding admin and test farmer users (SEED-01)...")
    users = {}

    # 1. Admin Officer
    admin = db.query(User).filter(User.email == "admin@pmkisan.gov.in").first()
    if not admin:
        admin = User(
            email="admin@pmkisan.gov.in",
            password_hash=hash_password("Admin@123"),
            full_name="Scheme Verification Officer",
            mobile_number="9876543210",
            date_of_birth=datetime.date(1980, 1, 15),
            gender="Male",
            category="General",
            role="ADMIN",
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
    users["admin"] = admin

    # 2. Primary Test Farmer
    farmer = db.query(User).filter(User.email == "farmer@test.com").first()
    if not farmer:
        farmer = User(
            email="farmer@test.com",
            password_hash=hash_password("Farmer@123"),
            full_name="Ramesh Kumar",
            mobile_number="9876543211",
            date_of_birth=datetime.date(1985, 6, 15),
            gender="Male",
            category="OBC",
            role="USER",
        )
        db.add(farmer)
        db.commit()
        db.refresh(farmer)
    users["farmer"] = farmer

    # Additional test farmers for multi-applicant scenarios
    for i in range(2, 6):
        email = f"farmer{i}@test.com"
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                password_hash=hash_password("Farmer@123"),
                full_name=f"Test Farmer {i}",
                mobile_number=f"987654321{i}",
                date_of_birth=datetime.date(1982 + i, 3, 10),
                gender="Male" if i % 2 == 0 else "Female",
                category="General",
                role="USER",
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        users[f"farmer_{i}"] = u

    return users


# ─────────────────────────────────────────────────────────────────────────────
# 2. SEED MASTER REGISTRIES (SEED-02)
# ─────────────────────────────────────────────────────────────────────────────

def seed_land_records(db: SessionLocal):
    """Seed 25+ land parcel master records."""
    print("  -> Seeding Land Records Master (25 records)...")
    db.query(LandRecordMaster).delete()

    parcels = [
        # Normal active agricultural parcels
        ("UP-MRT-HAP-VIL001-K001-P001", "UP", "MRT", "HAP", "VIL001", "K001", "P001", "100000000001", "Ramesh Kumar", 1.25, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-MRT-HAP-VIL001-K001-P002", "UP", "MRT", "HAP", "VIL001", "K001", "P002", "100000000002", "Suresh Patel", 0.95, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-MRT-HAP-VIL001-K002-P001", "UP", "MRT", "HAP", "VIL001", "K002", "P001", "100000000003", "Anita Devi", 1.80, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-MRT-HAP-VIL002-K001-P001", "UP", "MRT", "HAP", "VIL002", "K001", "P001", "100000000004", "Vikram Singh", 2.10, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-MRT-HAP-VIL002-K002-P002", "UP", "MRT", "HAP", "VIL002", "K002", "P002", "100000000005", "Sunita Sharma", 1.40, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-MRT-HAP-VIL003-K001-P001", "UP", "MRT", "HAP", "VIL003", "K001", "P001", "100000000006", "Mohan Lal", 0.75, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-MRT-HAP-VIL003-K002-P001", "UP", "MRT", "HAP", "VIL003", "K002", "P001", "100000000007", "Geeta Verma", 1.15, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-MRT-HAP-VIL004-K001-P001", "UP", "MRT", "HAP", "VIL004", "K001", "P001", "100000000008", "Rajesh Gupta", 1.50, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-MRT-HAP-VIL004-K001-P002", "UP", "MRT", "HAP", "VIL004", "K001", "P002", "100000000009", "Pooja Yadav", 0.85, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-MRT-HAP-VIL005-K001-P001", "UP", "MRT", "HAP", "VIL005", "K001", "P001", "100000000010", "Dinesh Chandra", 2.40, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-AGR-FAT-VIL006-K001-P001", "UP", "AGR", "FAT", "VIL006", "K001", "P001", "100000000011", "Kavita Rani", 1.60, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-AGR-FAT-VIL006-K002-P001", "UP", "AGR", "FAT", "VIL006", "K002", "P001", "100000000012", "Santosh Tiwari", 1.10, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-AGR-FAT-VIL007-K001-P001", "UP", "AGR", "FAT", "VIL007", "K001", "P001", "100000000013", "Meena Kumari", 0.65, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-AGR-FAT-VIL007-K002-P001", "UP", "AGR", "FAT", "VIL007", "K002", "P001", "100000000014", "Deepak Rawat", 1.90, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-AGR-FAT-VIL008-K001-P001", "UP", "AGR", "FAT", "VIL008", "K001", "P001", "100000000015", "Shanti Devi", 1.30, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),

        # Special anomaly-triggering parcels
        # Non-agricultural parcel (Commercial / Industrial)
        ("UP-MRT-HAP-VIL001-K099-P099", "UP", "MRT", "HAP", "VIL001", "K099", "P099", "100000000016", "Anil Aggarwal", 3.50, "COMMERCIAL_ESTATE", False, "ACTIVE", "CLEAR"),
        ("UP-AGR-FAT-VIL006-K088-P088", "UP", "AGR", "FAT", "VIL006", "K088", "P088", "100000000017", "Bharat Builders", 4.20, "RESIDENTIAL_LAYOUT", False, "ACTIVE", "CLEAR"),

        # Inactive / Disputed ownership parcels
        ("UP-MRT-HAP-VIL002-K077-P077", "UP", "MRT", "HAP", "VIL002", "K077", "P077", "100000000018", "Raghuveer Saran", 1.50, "AGRI_CULTIVABLE", True, "INACTIVE", "DISPUTED"),
        ("UP-AGR-FAT-VIL007-K066-P066", "UP", "AGR", "FAT", "VIL007", "K066", "P066", "100000000019", "Madan Mohan", 2.00, "AGRI_CULTIVABLE", True, "DISPUTED", "COURT_STAY"),

        # Area mismatch test parcels (registered area is 0.50 Ha)
        ("UP-MRT-HAP-VIL003-K055-P055", "UP", "MRT", "HAP", "VIL003", "K055", "P055", "100000000020", "Govind Prasad", 0.50, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),

        # Shared parcel for duplicate claim syndicate test
        ("UP-MRT-HAP-VIL001-K044-P044", "UP", "MRT", "HAP", "VIL001", "K044", "P044", "100000000021", "Om Prakash", 1.75, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),

        # Additional clean parcels to exceed 25 records
        ("UP-LKO-BAK-VIL009-K001-P001", "UP", "LKO", "BAK", "VIL009", "K001", "P001", "100000000022", "Hari Om", 1.05, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-LKO-BAK-VIL009-K002-P001", "UP", "LKO", "BAK", "VIL009", "K002", "P001", "100000000023", "Radha Krishna", 0.80, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-LKO-BAK-VIL010-K001-P001", "UP", "LKO", "BAK", "VIL010", "K001", "P001", "100000000024", "Kamla Devi", 1.45, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
        ("UP-LKO-BAK-VIL010-K002-P001", "UP", "LKO", "BAK", "VIL010", "K002", "P001", "100000000025", "Nand Kishore", 2.20, "AGRI_CULTIVABLE", True, "ACTIVE", "CLEAR"),
    ]

    for p in parcels:
        rec = LandRecordMaster(
            parcel_id=p[0],
            state_code=p[1],
            district_code=p[2],
            tehsil_code=p[3],
            village_code=p[4],
            khata_number=p[5],
            plot_number=p[6],
            owner_aadhaar_ref=hash_aadhaar(p[7]),
            owner_name=p[8],
            land_area_ha=p[9],
            land_use_code=p[10],
            agricultural_land_flag=p[11],
            ownership_status=p[12],
            title_status=p[13],
        )
        db.add(rec)
    db.commit()


def seed_bank_records(db: SessionLocal):
    """Seed 25+ bank validation master records."""
    print("  -> Seeding Bank Validation Master (25 records)...")
    db.query(BankValidationMaster).delete()

    banks = [
        # Normal active bank accounts with successful penny-drop
        ("123456789001", "SBIN0001234", "Ramesh Kumar", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789002", "SBIN0001234", "Suresh Patel", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789003", "PUNB0005678", "Anita Devi", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789004", "PUNB0005678", "Vikram Singh", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789005", "BARB0VILMRT", "Sunita Sharma", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789006", "BARB0VILMRT", "Mohan Lal", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789007", "CNRB0002345", "Geeta Verma", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789008", "CNRB0002345", "Rajesh Gupta", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789009", "UBIN0534211", "Pooja Yadav", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789010", "UBIN0534211", "Dinesh Chandra", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789011", "SBIN0009876", "Kavita Rani", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789012", "SBIN0009876", "Santosh Tiwari", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789013", "HDFC0001122", "Meena Kumari", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789014", "HDFC0001122", "Deepak Rawat", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789015", "ICIC0003344", "Shanti Devi", "ACTIVE", True, "SUCCESS", 1.0),

        # Anomaly bank records:
        # Inactive / Closed / Frozen
        ("999988887701", "SBIN0001234", "Kailash Chand", "INACTIVE", True, "SUCCESS", 1.0),
        ("999988887702", "PUNB0005678", "Devendra Joshi", "CLOSED", True, "SUCCESS", 1.0),
        ("999988887703", "BARB0VILMRT", "Jagdish Prasad", "FROZEN", True, "SUCCESS", 1.0),

        # Invalid IFSC
        ("888877776601", "INVALID0000", "Sudhir Kumar", "ACTIVE", False, "FAILED", 0.0),

        # Failed penny-drop
        ("777766665501", "SBIN0001234", "Satish Chandra", "ACTIVE", True, "FAILED", 1.0),

        # Name mismatch (Holder name completely different from farmer)
        ("666655554401", "SBIN0001234", "Zakir Hussain Enterprise", "ACTIVE", True, "SUCCESS", 0.35),
        ("666655554402", "PUNB0005678", "Northland Trade Corp", "ACTIVE", True, "SUCCESS", 0.40),

        # Shared Mule Account (will be linked to multiple applications)
        ("555544443301", "SBIN0001234", "Mule Syndicate Hub", "ACTIVE", True, "SUCCESS", 1.0),

        # Additional clean accounts
        ("123456789022", "SBIN0001234", "Hari Om", "ACTIVE", True, "SUCCESS", 1.0),
        ("123456789023", "PUNB0005678", "Radha Krishna", "ACTIVE", True, "SUCCESS", 1.0),
    ]

    for b in banks:
        key = f"{b[0]}-{b[1]}".upper()
        rec = BankValidationMaster(
            bank_account_ifsc_key=key,
            bank_account_number=b[0],
            ifsc_code=b[1],
            account_holder_name=b[2],
            account_status=b[3],
            ifsc_valid=b[4],
            penny_drop_status=b[5],
            name_match_score=b[6],
        )
        db.add(rec)
    db.commit()


def seed_exclusion_master(db: SessionLocal):
    """Seed 20+ exclusion master records."""
    print("  -> Seeding Exclusion Master (20 records)...")
    db.query(ExclusionMaster).delete()

    exclusions = [
        # Taxpayers (CBDT Match)
        ("200000000001", True, False, False, False, False, False),
        ("200000000002", True, False, False, False, False, False),
        ("200000000003", True, False, False, False, False, False),
        ("200000000004", True, False, False, False, False, False),

        # Govt Employees (Central/State)
        ("200000000005", False, True, False, False, False, False),
        ("200000000006", False, True, False, False, False, False),
        ("200000000007", False, True, False, False, False, False),
        ("200000000008", False, True, False, False, False, False),

        # Institutional Pensioners (>= 10k/month)
        ("200000000009", False, False, True, False, False, False),
        ("200000000010", False, False, True, False, False, False),
        ("200000000011", False, False, True, False, False, False),

        # Licensed Professionals (Doctors, Engineers, Lawyers, CAs)
        ("200000000012", False, False, False, True, False, False),
        ("200000000013", False, False, False, True, False, False),
        ("200000000014", False, False, False, True, False, False),

        # Institutional / Corporate Landholders
        ("200000000015", False, False, False, False, True, False),
        ("200000000016", False, False, False, False, True, False),
        ("200000000017", False, False, False, False, True, False),

        # Deceased Farmers
        ("200000000018", False, False, False, False, False, True),
        ("200000000019", False, False, False, False, False, True),
        ("200000000020", False, False, False, False, False, True),
    ]

    for e in exclusions:
        rec = ExclusionMaster(
            aadhaar_ref=hash_aadhaar(e[0]),
            taxpayer_flag=e[1],
            govt_employee_flag=e[2],
            pensioner_flag=e[3],
            professional_flag=e[4],
            institutional_landholder_flag=e[5],
            deceased_flag=e[6],
        )
        db.add(rec)
    db.commit()


def seed_village_profiles(db: SessionLocal):
    """Seed 20+ village profile records."""
    print("  -> Seeding Village Profile Master (20 records)...")
    db.query(VillageProfileMaster).delete()

    villages = [
        # Normal baseline villages
        ("VIL001", "MRT", "HAP", "Rampur", 150, 180),
        ("VIL002", "MRT", "HAP", "Kalyanpur", 120, 150),
        ("VIL003", "MRT", "HAP", "Shyampur", 110, 140),
        ("VIL004", "MRT", "HAP", "Govindpur", 90, 120),
        ("VIL005", "MRT", "HAP", "Fatehpur", 140, 170),
        ("VIL006", "AGR", "FAT", "Chandpur", 130, 160),
        ("VIL007", "AGR", "FAT", "Daulatpur", 100, 130),
        ("VIL008", "AGR", "FAT", "Sultanpur", 115, 145),
        ("VIL009", "LKO", "BAK", "Malihabad", 200, 250),
        ("VIL010", "LKO", "BAK", "Kakori", 180, 220),
        ("VIL011", "VAR", "PND", "Shivpur", 160, 190),
        ("VIL012", "VAR", "PND", "Rohania", 140, 170),
        ("VIL013", "MRT", "HAP", "Bhopura", 95, 125),
        ("VIL014", "AGR", "FAT", "Kiraoli", 105, 135),
        ("VIL015", "LKO", "BAK", "Bakshi Ka Talab", 175, 210),

        # Sparse baseline villages for statistical density spike tests
        ("VIL091", "MRT", "HAP", "Chhoti Dhani", 1, 1),
        ("VIL092", "MRT", "HAP", "Majra Kalan", 1, 1),
        ("VIL093", "AGR", "FAT", "Basti Buzurg", 1, 1),
        ("VIL094", "LKO", "BAK", "Naya Kheda", 2, 2),
        ("VIL095", "VAR", "PND", "Purwa Khurd", 1, 1),
    ]

    for v in villages:
        rec = VillageProfileMaster(
            village_code=v[0],
            district_code=v[1],
            tehsil_code=v[2],
            village_name=v[3],
            historical_beneficiary_count=v[4],
            cultivator_count_estimate=v[5],
        )
        db.add(rec)
    db.commit()


def seed_event_calendar(db: SessionLocal):
    """Seed 20+ event calendar records."""
    print("  -> Seeding Event Calendar Master (20 records)...")
    db.query(EventCalendarMaster).delete()

    today = datetime.date.today()
    events = [
        # Upcoming milestone events (within 48 hours for temporal spike tests)
        ("MRT", "installment_release", today + datetime.timedelta(days=1), "17th Installment Direct Benefit Transfer"),
        ("AGR", "eKYC_deadline", today + datetime.timedelta(days=1), "Aadhaar eKYC Mandatory Linking Deadline"),
        ("LKO", "application_cutoff", today + datetime.timedelta(days=2), "Kharif Subsidy Window Final Submission Cutoff"),

        # Other events spread across year
        ("MRT", "eKYC_deadline", today + datetime.timedelta(days=30), "Periodic Biometric Verification Drive"),
        ("MRT", "application_cutoff", today + datetime.timedelta(days=60), "Rabi Season Application Cutoff"),
        ("AGR", "installment_release", today + datetime.timedelta(days=45), "18th Installment Fund Disbursement"),
        ("AGR", "application_cutoff", today + datetime.timedelta(days=90), "Annual Registration Reconciliation"),
        ("LKO", "installment_release", today + datetime.timedelta(days=15), "State Supplementary DBT Tranche"),
        ("LKO", "eKYC_deadline", today + datetime.timedelta(days=75), "Patwari Land Seeding Verification"),
        ("VAR", "installment_release", today + datetime.timedelta(days=10), "Purvanchal Agricultural Grant Release"),
        ("VAR", "eKYC_deadline", today + datetime.timedelta(days=25), "CSC Center eKYC Camp"),
        ("VAR", "application_cutoff", today + datetime.timedelta(days=50), "District Crop Survey Completion"),

        # Past events
        ("MRT", "installment_release", today - datetime.timedelta(days=120), "16th Installment PM-KISAN Release"),
        ("AGR", "installment_release", today - datetime.timedelta(days=120), "16th Installment PM-KISAN Release"),
        ("LKO", "installment_release", today - datetime.timedelta(days=120), "16th Installment PM-KISAN Release"),
        ("VAR", "installment_release", today - datetime.timedelta(days=120), "16th Installment PM-KISAN Release"),
        ("MRT", "eKYC_deadline", today - datetime.timedelta(days=60), "Past Mandatory eKYC Drive"),
        ("AGR", "eKYC_deadline", today - datetime.timedelta(days=60), "Past Mandatory eKYC Drive"),
        ("LKO", "application_cutoff", today - datetime.timedelta(days=90), "Previous Quarter Application Cutoff"),
        ("VAR", "application_cutoff", today - datetime.timedelta(days=90), "Previous Quarter Application Cutoff"),
    ]

    for ev in events:
        rec = EventCalendarMaster(
            district_code=ev[0],
            event_type=ev[1],
            event_date=ev[2],
            description=ev[3],
        )
        db.add(rec)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# 3. SEED 20 SAMPLE APPLICATIONS (SEED-03)
# ─────────────────────────────────────────────────────────────────────────────

def seed_applications(db: SessionLocal, users: Dict[str, User]):
    """
    Seed 20 diverse PM-KISAN applications covering:
      - 10 Low Risk (Risk score 0-24, genuine farmers)
      - 5 Medium Risk (Risk score 25-49, partial name mismatch, inactive ownership, etc.)
      - 5 High/Critical Risk (Risk score 50-100, exclusion, non-agri, duplicate parcel, mule account)
    Executes the real multi-engine anomaly detection pipeline to compute scores & rationales.
    """
    print("  -> Seeding 20 diverse PM-KISAN applications (SEED-03)...")
    db.query(AuditLog).delete()
    db.query(AnomalyFlag).delete()
    db.query(AnomalyReport).delete()
    db.query(PMKisanApplicationDetails).delete()
    db.query(Application).delete()
    db.commit()

    farmer = users["farmer"]
    now = datetime.datetime.utcnow()

    # Application specifications:
    # (name, dob, gender, mobile, aadhaar_raw, bank_acc, ifsc, parcel_id, area_ha, otp_ok, ekyc_ok, status)
    app_specs = [
        # =====================================================================
        # TIER 1: 10 LOW RISK APPLICATIONS (Genuine, fully verified claims)
        # =====================================================================
        {
            "id": 1,
            "farmer_name": "Ramesh Kumar",
            "dob": datetime.date(1985, 6, 15),
            "gender": "Male",
            "mobile": "9876543211",
            "aadhaar": "100000000001",
            "bank_acc": "123456789001",
            "ifsc": "SBIN0001234",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL001",
            "khata": "K001", "plot": "P001",
            "area": 1.25, "crop": "WHEAT",
            "otp_ok": True, "ekyc_ok": True,
            "status": "APPROVED",
            "decision": "APPROVE",
            "remarks": "Clean land registry and bank verification. Identity authenticated via eKYC.",
        },
        {
            "id": 2,
            "farmer_name": "Suresh Patel",
            "dob": datetime.date(1978, 4, 20),
            "gender": "Male",
            "mobile": "9876543222",
            "aadhaar": "100000000002",
            "bank_acc": "123456789002",
            "ifsc": "SBIN0001234",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL001",
            "khata": "K001", "plot": "P002",
            "area": 0.95, "crop": "PADDY",
            "otp_ok": True, "ekyc_ok": True,
            "status": "APPROVED",
            "decision": "APPROVE",
            "remarks": "Small and marginal farmer entitlement confirmed. Verified by Revenue Inspector.",
        },
        {
            "id": 3,
            "farmer_name": "Anita Devi",
            "dob": datetime.date(1982, 9, 12),
            "gender": "Female",
            "mobile": "9876543223",
            "aadhaar": "100000000003",
            "bank_acc": "123456789003",
            "ifsc": "PUNB0005678",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL001",
            "khata": "K002", "plot": "P001",
            "area": 1.80, "crop": "SUGARCANE",
            "otp_ok": True, "ekyc_ok": True,
            "status": "APPROVED",
            "decision": "APPROVE",
            "remarks": "Single female titleholder verified against Bhulekh digital record.",
        },
        {
            "id": 4,
            "farmer_name": "Vikram Singh",
            "dob": datetime.date(1990, 11, 5),
            "gender": "Male",
            "mobile": "9876543224",
            "aadhaar": "100000000004",
            "bank_acc": "123456789004",
            "ifsc": "PUNB0005678",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL002",
            "khata": "K001", "plot": "P001",
            "area": 2.10, "crop": "MUSTARD",
            "otp_ok": True, "ekyc_ok": True,
            "status": "SUBMITTED",
            "decision": None, "remarks": None,
        },
        {
            "id": 5,
            "farmer_name": "Sunita Sharma",
            "dob": datetime.date(1986, 2, 28),
            "gender": "Female",
            "mobile": "9876543225",
            "aadhaar": "100000000005",
            "bank_acc": "123456789005",
            "ifsc": "BARB0VILMRT",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL002",
            "khata": "K002", "plot": "P002",
            "area": 1.40, "crop": "WHEAT",
            "otp_ok": True, "ekyc_ok": True,
            "status": "SUBMITTED",
            "decision": None, "remarks": None,
        },
        {
            "id": 6,
            "farmer_name": "Mohan Lal",
            "dob": datetime.date(1975, 8, 14),
            "gender": "Male",
            "mobile": "9876543226",
            "aadhaar": "100000000006",
            "bank_acc": "123456789006",
            "ifsc": "BARB0VILMRT",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL003",
            "khata": "K001", "plot": "P001",
            "area": 0.75, "crop": "PULSES",
            "otp_ok": True, "ekyc_ok": True,
            "status": "SUBMITTED",
            "decision": None, "remarks": None,
        },
        {
            "id": 7,
            "farmer_name": "Geeta Verma",
            "dob": datetime.date(1988, 12, 1),
            "gender": "Female",
            "mobile": "9876543227",
            "aadhaar": "100000000007",
            "bank_acc": "123456789007",
            "ifsc": "CNRB0002345",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL003",
            "khata": "K002", "plot": "P001",
            "area": 1.15, "crop": "MAIZE",
            "otp_ok": True, "ekyc_ok": True,
            "status": "SUBMITTED",
            "decision": None, "remarks": None,
        },
        {
            "id": 8,
            "farmer_name": "Rajesh Gupta",
            "dob": datetime.date(1980, 5, 19),
            "gender": "Male",
            "mobile": "9876543228",
            "aadhaar": "100000000008",
            "bank_acc": "123456789008",
            "ifsc": "CNRB0002345",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL004",
            "khata": "K001", "plot": "P001",
            "area": 1.50, "crop": "WHEAT",
            "otp_ok": True, "ekyc_ok": True,
            "status": "SUBMITTED",
            "decision": None, "remarks": None,
        },
        {
            "id": 9,
            "farmer_name": "Pooja Yadav",
            "dob": datetime.date(1992, 7, 25),
            "gender": "Female",
            "mobile": "9876543229",
            "aadhaar": "100000000009",
            "bank_acc": "123456789009",
            "ifsc": "UBIN0534211",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL004",
            "khata": "K001", "plot": "P002",
            "area": 0.85, "crop": "BARLEY",
            "otp_ok": True, "ekyc_ok": True,
            "status": "SUBMITTED",
            "decision": None, "remarks": None,
        },
        {
            "id": 10,
            "farmer_name": "Dinesh Chandra",
            "dob": datetime.date(1973, 10, 30),
            "gender": "Male",
            "mobile": "9876543230",
            "aadhaar": "100000000010",
            "bank_acc": "123456789010",
            "ifsc": "UBIN0534211",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL005",
            "khata": "K001", "plot": "P001",
            "area": 2.40, "crop": "SUGARCANE",
            "otp_ok": True, "ekyc_ok": True,
            "status": "SUBMITTED",
            "decision": None, "remarks": None,
        },

        # =====================================================================
        # TIER 2: 5 MEDIUM RISK APPLICATIONS (Moderate anomalies, review required)
        # =====================================================================
        # App 11: Minor Land Area Discrepancy (Declared 0.70 vs 0.50 registered -> ~40% diff, medium flag)
        {
            "id": 11,
            "farmer_name": "Govind Prasad",
            "dob": datetime.date(1983, 3, 15),
            "gender": "Male",
            "mobile": "9876543231",
            "aadhaar": "100000000020",
            "bank_acc": "123456789001",
            "ifsc": "SBIN0001234",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL003",
            "khata": "K055", "plot": "P055",
            "area": 0.70, "crop": "WHEAT",
            "otp_ok": True, "ekyc_ok": True,
            "status": "DOCUMENTS_REQUESTED",
            "decision": "REQUEST_DOCUMENTS",
            "remarks": "Land area deviation of 40% detected against Khasra records. Requested updated Khasra Khatauni.",
        },
        # App 12: Inactive Land Ownership (DISPUTED/INACTIVE parcel in registry)
        {
            "id": 12,
            "farmer_name": "Raghuveer Saran",
            "dob": datetime.date(1968, 9, 21),
            "gender": "Male",
            "mobile": "9876543232",
            "aadhaar": "100000000018",
            "bank_acc": "123456789002",
            "ifsc": "SBIN0001234",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL002",
            "khata": "K077", "plot": "P077",
            "area": 1.50, "crop": "WHEAT",
            "otp_ok": True, "ekyc_ok": True,
            "status": "PAYMENT_HELD",
            "decision": "HOLD",
            "remarks": "Land parcel title is marked as INACTIVE/DISPUTED in civil revenue records.",
        },
        # App 13: Penny-drop Verification Failed
        {
            "id": 13,
            "farmer_name": "Satish Chandra",
            "dob": datetime.date(1981, 7, 9),
            "gender": "Male",
            "mobile": "9876543233",
            "aadhaar": "100000000001",
            "bank_acc": "777766665501",
            "ifsc": "SBIN0001234",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL001",
            "khata": "K001", "plot": "P001",
            "area": 1.25, "crop": "WHEAT",
            "otp_ok": True, "ekyc_ok": True,
            "status": "DOCUMENTS_REQUESTED",
            "decision": "REQUEST_DOCUMENTS",
            "remarks": "PFMS mock penny drop verification failed. Farmer requested to submit passbook photocopy.",
        },
        # App 14: Mobile Shared on Multiple Applications (Bulk Mobile Medium)
        {
            "id": 14,
            "farmer_name": "Hari Om",
            "dob": datetime.date(1984, 11, 18),
            "gender": "Male",
            "mobile": "9876543211",  # Same as Ramesh Kumar (farmer #1)
            "aadhaar": "100000000022",
            "bank_acc": "123456789022",
            "ifsc": "SBIN0001234",
            "state": "UP", "district": "LKO", "tehsil": "BAK", "village": "VIL009",
            "khata": "K001", "plot": "P001",
            "area": 1.05, "crop": "WHEAT",
            "otp_ok": True, "ekyc_ok": True,
            "status": "SUBMITTED",
            "decision": None, "remarks": None,
        },
        # App 15: Statistical Village Density Spike (Village VIL091 has baseline of 1)
        {
            "id": 15,
            "farmer_name": "Kavita Rani",
            "dob": datetime.date(1987, 5, 24),
            "gender": "Female",
            "mobile": "9876543235",
            "aadhaar": "100000000011",
            "bank_acc": "123456789011",
            "ifsc": "SBIN0009876",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL091",
            "khata": "K001", "plot": "P001",
            "area": 1.60, "crop": "WHEAT",
            "otp_ok": True, "ekyc_ok": True,
            "status": "SUBMITTED",
            "decision": None, "remarks": None,
        },

        # =====================================================================
        # TIER 3: 5 HIGH / CRITICAL RISK APPLICATIONS (Serious statutory/fraud flags)
        # =====================================================================
        # App 16: Statutory Exclusion Hit — Income Taxpayer (CBDT Registry)
        {
            "id": 16,
            "farmer_name": "Ashok Singhal",
            "dob": datetime.date(1974, 1, 10),
            "gender": "Male",
            "mobile": "9876543241",
            "aadhaar": "200000000001",  # Matches taxpayer in exclusion_master
            "bank_acc": "123456789001",
            "ifsc": "SBIN0001234",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL001",
            "khata": "K001", "plot": "P001",
            "area": 1.25, "crop": "WHEAT",
            "otp_ok": True, "ekyc_ok": True,
            "status": "REJECTED",
            "decision": "REJECT",
            "remarks": "Direct statutory disqualification: Applicant is an income tax assessee (CBDT exclusion match).",
        },
        # App 17: Statutory Exclusion Hit — Deceased Identity Claimed
        {
            "id": 17,
            "farmer_name": "Late Ram Swaroop",
            "dob": datetime.date(1950, 4, 12),
            "gender": "Male",
            "mobile": "9876543242",
            "aadhaar": "200000000018",  # Matches deceased in exclusion_master
            "bank_acc": "123456789002",
            "ifsc": "SBIN0001234",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL001",
            "khata": "K001", "plot": "P002",
            "area": 0.95, "crop": "PADDY",
            "otp_ok": True, "ekyc_ok": True,
            "status": "REJECTED",
            "decision": "REJECT",
            "remarks": "Fraudulent claim: Aadhaar record is flagged as DECEASED in the national civil registry.",
        },
        # App 18: Non-Agricultural Commercial Land Claimed for Agricultural Subsidy
        {
            "id": 18,
            "farmer_name": "Anil Aggarwal",
            "dob": datetime.date(1979, 6, 20),
            "gender": "Male",
            "mobile": "9876543243",
            "aadhaar": "100000000016",
            "bank_acc": "123456789004",
            "ifsc": "PUNB0005678",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL001",
            "khata": "K099", "plot": "P099",  # Commercial estate parcel
            "area": 3.50, "crop": "COMMERCIAL",
            "otp_ok": True, "ekyc_ok": True,
            "status": "REJECTED",
            "decision": "REJECT",
            "remarks": "Land use classification mismatch: Parcel is designated as COMMERCIAL_ESTATE in state land registry.",
        },
        # App 19: Duplicate Parcel Claim (Claims same parcel as App 1: UP-MRT-HAP-VIL001-K001-P001)
        {
            "id": 19,
            "farmer_name": "Santosh Tiwari",
            "dob": datetime.date(1983, 10, 8),
            "gender": "Male",
            "mobile": "9876543244",
            "aadhaar": "100000000012",
            "bank_acc": "123456789012",
            "ifsc": "SBIN0009876",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL001",
            "khata": "K001", "plot": "P001",  # Same parcel as App 1!
            "area": 1.25, "crop": "WHEAT",
            "otp_ok": True, "ekyc_ok": True,
            "status": "PAYMENT_HELD",
            "decision": "HOLD",
            "remarks": "Duplicate parcel claim detected. Parcel K001-P001 is already registered under Ramesh Kumar.",
        },
        # App 20: Mule Account & Inactive Bank Account
        {
            "id": 20,
            "farmer_name": "Zakir Hussain Enterprise",
            "dob": datetime.date(1982, 1, 25),
            "gender": "Male",
            "mobile": "9876543245",
            "aadhaar": "100000000017",
            "bank_acc": "999988887701",  # Inactive account in bank master
            "ifsc": "SBIN0001234",
            "state": "UP", "district": "MRT", "tehsil": "HAP", "village": "VIL001",
            "khata": "K001", "plot": "P001",
            "area": 1.25, "crop": "WHEAT",
            "otp_ok": True, "ekyc_ok": True,
            "status": "PAYMENT_HELD",
            "decision": "HOLD",
            "remarks": "Bank account is flagged as INACTIVE in PFMS registry with severe name mismatch.",
        },
    ]

    admin = users["admin"]

    for spec in app_specs:
        aad_raw = spec["aadhaar"]
        aad_ref = hash_aadhaar(aad_raw)
        aad_mask = mask_aadhaar(aad_raw)
        p_id = f"{spec['state']}-{spec['district']}-{spec['tehsil']}-{spec['village']}-{spec['khata']}-{spec['plot']}".upper()
        b_key = f"{spec['bank_acc']}-{spec['ifsc']}".upper()

        sub_time = now - datetime.timedelta(days=20 - spec["id"])

        # 1. Create Application
        app = Application(
            id=spec["id"],
            user_id=farmer.id,
            scheme_code="PM_KISAN",
            status=spec["status"],
            submitted_at=sub_time,
            created_at=sub_time,
        )
        db.add(app)
        db.flush()

        # 2. Create PMKisanApplicationDetails
        details = PMKisanApplicationDetails(
            application_id=app.id,
            farmer_name=spec["farmer_name"],
            date_of_birth=spec["dob"],
            gender=spec["gender"],
            category="General",
            mobile_number=spec["mobile"],
            otp_verified=spec["otp_ok"],
            aadhaar_ref=aad_ref,
            aadhaar_masked=aad_mask,
            bank_account_number=spec["bank_acc"],
            ifsc_code=spec["ifsc"],
            state_code=spec["state"],
            district_code=spec["district"],
            tehsil_code=spec["tehsil"],
            village_code=spec["village"],
            khata_number=spec["khata"],
            plot_number=spec["plot"],
            declared_land_area_ha=spec["area"],
            ownership_type="Single",
            declared_crop_code=spec["crop"],
            land_document_path=f"/uploads/seed_deed_app_{spec['id']}.pdf",
            self_declaration=True,
            e_kyc_consent=True,
            e_kyc_status=spec["ekyc_ok"],
            parcel_id=p_id,
            bank_account_ifsc_key=b_key,
        )
        db.add(details)
        db.flush()

        # 3. Execute Multi-Engine Anomaly Pipeline
        pipeline_result = run_pipeline(details, db)

        # 4. Save Flags
        for f in pipeline_result.flags:
            db_flag = AnomalyFlag(
                application_id=app.id,
                anomaly_code=f.anomaly_code,
                severity=f.severity,
                score=f.score,
                rationale=f.rationale,
                evidence_json=f.evidence_json or {},
            )
            db.add(db_flag)

        # 5. Compute Risk & Confidence Scores
        r_score = compute_risk_score(pipeline_result.flags)
        c_score, c_level = compute_confidence(pipeline_result.flags, details, db)
        rec_action = get_recommended_action(r_score, pipeline_result.flags)
        rat = generate_rationale(
            risk_score=r_score,
            confidence_score=c_score,
            confidence_level=c_level,
            recommended_action=rec_action,
            flags=pipeline_result.flags,
        )

        # 6. Save Anomaly Report
        anom_report = AnomalyReport(
            application_id=app.id,
            risk_score=r_score,
            confidence_score=c_score,
            confidence_level=c_level,
            recommended_action=rec_action,
            rationale=rat,
        )
        db.add(anom_report)

        # 7. Update Application metadata
        app.risk_score = r_score
        app.confidence_score = c_score
        app.confidence_level = c_level
        app.recommended_action = rec_action

        # If decision is already made in spec, record officer decision and audit log
        if spec["decision"]:
            app.officer_decision = spec["decision"]
            app.officer_remarks = spec["remarks"]
            app.officer_decided_at = sub_time + datetime.timedelta(hours=2)

            audit = AuditLog(
                application_id=app.id,
                admin_id=admin.id,
                action=spec["decision"],
                remarks=spec["remarks"],
                created_at=sub_time + datetime.timedelta(hours=2),
            )
            db.add(audit)

        db.commit()

    print("  -> Applications seeded successfully!")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN RUNNER
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 70)
    print(" KisanGuard Portal — Master Seed Data Provisioning (Phase 7)")
    print("=" * 70)

    # Initialize tables
    Base.metadata.create_all(bind=engine)

    # Ensure uploads directory
    uploads_dir = os.path.join(BASE_DIR, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)

    db = SessionLocal()
    try:
        users = seed_users(db)
        seed_land_records(db)
        seed_bank_records(db)
        seed_exclusion_master(db)
        seed_village_profiles(db)
        seed_event_calendar(db)
        seed_applications(db, users)
        print("=" * 70)
        print("[OK] Phase 7 Master Seed Completed Successfully!")
        print(f"   Admin:  admin@pmkisan.gov.in / Admin@123")
        print(f"   Farmer: farmer@test.com / Farmer@123")
        print(f"   Applications: 20 seeded across Low (10), Med (5), High (5)")
        print("=" * 70)
    except Exception as exc:
        db.rollback()
        print(f"[ERROR] Error during seed provisioning: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
