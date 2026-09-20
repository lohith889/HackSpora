"""
Automated Unit & Integration Tests for Land Document OCR & Automated ID Verification (Phase 9)
Validates text extraction, entity parsing, reconciliation, and LandEngine anomaly flags.
"""

import os
import tempfile
import pytest
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import User, Application, PMKisanApplicationDetails, LandRecordMaster, LandDeedRegistryMaster
from app.services.land_ocr_service import (
    extract_text_from_file,
    parse_land_entities,
    reconcile_land_document,
    process_uploaded_land_document,
    verify_deed_with_govt_registry,
)
from app.services import land_engine


# In-memory SQLite for fast testing
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def create_sample_pdf(content_lines: list, filename: str = "sample_deed.pdf") -> str:
    """Helper to generate an authentic synthetic Bhulekh / Land Deed PDF."""
    temp_dir = tempfile.gettempdir()
    file_path = os.path.join(temp_dir, filename)
    c = canvas.Canvas(file_path, pagesize=letter)
    y = 750
    for line in content_lines:
        c.drawString(72, y, line)
        y -= 25
    c.save()
    return file_path


class TestLandOCRService:
    def test_extract_text_from_synthetic_pdf(self):
        """Verify that digital PDF text extraction extracts all expected lines."""
        pdf_path = create_sample_pdf([
            "GOVERNMENT OF UTTAR PRADESH - REVENUE COUNCIL",
            "BHULEKH KHATAUNI RECORD OF RIGHTS (ROR)",
            "Document Ref: DOC-UP-2024-884920",
            "Parcel ID: UP-LKO-MAL-V001-K102-P45",
            "Khata Number: 102",
            "Plot Number: 45",
            "Land Area: 1.85 Ha",
            "Titleholder Name: Ramesh Kumar",
        ], "test_valid_deed.pdf")

        text = extract_text_from_file(pdf_path)
        assert "BHULEKH KHATAUNI" in text
        assert "UP-LKO-MAL-V001-K102-P45" in text
        assert "Ramesh Kumar" in text

        if os.path.exists(pdf_path):
            os.remove(pdf_path)

    def test_parse_land_entities_success(self):
        """Verify regex extraction of composite parcel ID, plot, khata, area, and owner."""
        raw_text = """
        STATE DIGITAL LAND RECORD SYSTEM
        UP BHULEKH KHATAUNI EXTRACT
        Certificate ID: DOC-UP-2024-884920
        Composite Parcel Code: UP-LKO-MAL-V001-K102-P45
        Khatauni Number: 102
        Khasra / Plot Number: 45
        Cultivable Land Area: 1.85 Ha
        Bhumidhar Name: Ramesh Kumar Singh
        Land Category: Agricultural
        """
        parsed = parse_land_entities(raw_text)
        assert parsed["doc_id"] == "UP-LKO-MAL-V001-K102-P45"
        assert parsed["khata_number"] == "102"
        assert parsed["khasra_plot"] == "45"
        assert parsed["land_area_ha"] == 1.85
        assert "Ramesh Kumar" in parsed["owner_name"]

    def test_reconcile_land_document_matched(self):
        """Verify reconciliation yields MATCHED status when document matches application claim."""
        extracted = {
            "doc_id": "UP-LKO-MAL-V001-K102-P45",
            "khata_number": "102",
            "khasra_plot": "45",
            "land_area_ha": 1.85,
            "owner_name": "Ramesh Kumar",
            "raw_snippet": "UP-LKO-MAL-V001-K102-P45 Khata: 102 Plot: 45",
        }

        status, match_status, confidence = reconcile_land_document(
            extracted=extracted,
            declared_parcel_id="UP-LKO-MAL-V001-K102-P45",
            declared_khata="102",
            declared_plot="45",
            declared_name="Ramesh Kumar",
        )

        assert status == "SUCCESS"
        assert match_status == "MATCHED"
        assert confidence >= 0.90

    def test_reconcile_land_document_mismatch(self):
        """Verify reconciliation flags MISMATCH when uploaded deed certifies a different plot."""
        extracted = {
            "doc_id": "UP-BAR-FAT-V009-K999-P99",
            "khata_number": "999",
            "khasra_plot": "99",
            "land_area_ha": 3.50,
            "owner_name": "Syndicate Impersonator",
            "raw_snippet": "UP-BAR-FAT-V009-K999-P99 Khata: 999 Plot: 99",
        }

        status, match_status, confidence = reconcile_land_document(
            extracted=extracted,
            declared_parcel_id="UP-LKO-MAL-V001-K102-P45",
            declared_khata="102",
            declared_plot="45",
            declared_name="Ramesh Kumar",
        )

        assert status == "SUCCESS"
        assert match_status == "MISMATCH"
        assert confidence >= 0.85

    def test_reconcile_unreadable_document(self):
        """Verify unreadable or blank document yields UNREADABLE and UNVERIFIED."""
        extracted = {
            "doc_id": None,
            "khata_number": None,
            "khasra_plot": None,
            "land_area_ha": None,
            "owner_name": None,
            "raw_snippet": "",
        }

        status, match_status, confidence = reconcile_land_document(
            extracted=extracted,
            declared_parcel_id="UP-LKO-MAL-V001-K102-P45",
            declared_khata="102",
            declared_plot="45",
            declared_name="Ramesh Kumar",
        )

        assert status == "UNREADABLE"
        assert match_status == "UNVERIFIED"
        assert confidence <= 0.20

    def test_process_uploaded_land_document_end_to_end(self):
        """Verify process_uploaded_land_document reads PDF and reconciles successfully."""
        pdf_path = create_sample_pdf([
            "UTTAR PRADESH REVENUE DEPARTMENT - BHULEKH",
            "Parcel Reference: UP-LKO-MAL-V001-K102-P45",
            "Khata No: 102",
            "Plot No: 45",
            "Area: 1.85 Ha",
            "Owner: Ramesh Kumar",
        ], "e2e_matched_deed.pdf")

        res = process_uploaded_land_document(
            file_path=pdf_path,
            declared_parcel_id="UP-LKO-MAL-V001-K102-P45",
            declared_khata="102",
            declared_plot="45",
            declared_name="Ramesh Kumar",
        )

        assert res["ocr_status"] == "SUCCESS"
        assert res["ocr_match_status"] == "MATCHED"
        assert res["ocr_extracted_doc_id"] == "UP-LKO-MAL-V001-K102-P45"
        assert res["ocr_extracted_data"]["land_area_ha"] == 1.85

        if os.path.exists(pdf_path):
            os.remove(pdf_path)


class TestLandEngineOCRFlags:
    def test_land_engine_flags_document_id_mismatch(self):
        """Verify LandEngine emits LAND_DOC_ID_MISMATCH when ocr_match_status is MISMATCH."""
        db = TestingSessionLocal()
        parcel_id = "UP-LKO-MAL-V001-K102-P45"

        # Seed master land record so it doesn't fail parcel existence
        master = LandRecordMaster(
            parcel_id=parcel_id,
            state_code="UP",
            district_code="LKO",
            tehsil_code="MAL",
            village_code="V001",
            khata_number="102",
            plot_number="45",
            owner_aadhaar_ref="sample_ref",
            owner_name="Ramesh Kumar",
            land_area_ha=1.85,
            land_use_code="AGRICULTURE",
            agricultural_land_flag=True,
            ownership_status="ACTIVE",
            title_status="CLEAR",
        )
        db.add(master)
        db.commit()

        details = PMKisanApplicationDetails(
            application_id=1,
            farmer_name="Ramesh Kumar",
            date_of_birth="1985-05-15",
            gender="Male",
            category="General",
            mobile_number="9876543210",
            otp_verified=True,
            aadhaar_ref="sample_ref",
            aadhaar_masked="XXXX-XXXX-1234",
            bank_account_number="1234567890",
            ifsc_code="SBIN0001234",
            state_code="UP",
            district_code="LKO",
            tehsil_code="MAL",
            village_code="V001",
            khata_number="102",
            plot_number="45",
            declared_land_area_ha=1.85,
            ownership_type="Single",
            land_document_path="/uploads/fake_deed.pdf",
            self_declaration=True,
            e_kyc_consent=True,
            e_kyc_status=True,
            parcel_id=parcel_id,
            bank_account_ifsc_key="1234567890-SBIN0001234",
            # OCR Mismatch
            ocr_extracted_doc_id="UP-BAR-FAT-V009-K999-P99",
            ocr_status="SUCCESS",
            ocr_match_status="MISMATCH",
            ocr_confidence_score=0.92,
        )

        flags = land_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]

        assert "LAND_DOC_ID_MISMATCH" in codes
        mismatch_flag = next(f for f in flags if f.anomaly_code == "LAND_DOC_ID_MISMATCH")
        assert mismatch_flag.severity == "High"
        assert mismatch_flag.score == 40
        assert "contradicts the declared parcel" in mismatch_flag.rationale

        db.close()

    def test_land_engine_flags_document_unreadable(self):
        """Verify LandEngine emits LAND_DOC_OCR_UNREADABLE when ocr_status is UNREADABLE."""
        db = TestingSessionLocal()
        parcel_id = "UP-LKO-MAL-V001-K102-P45"

        master = LandRecordMaster(
            parcel_id=parcel_id,
            state_code="UP",
            district_code="LKO",
            tehsil_code="MAL",
            village_code="V001",
            khata_number="102",
            plot_number="45",
            owner_aadhaar_ref="sample_ref",
            owner_name="Ramesh Kumar",
            land_area_ha=1.85,
            land_use_code="AGRICULTURE",
            agricultural_land_flag=True,
            ownership_status="ACTIVE",
            title_status="CLEAR",
        )
        db.add(master)
        db.commit()

        details = PMKisanApplicationDetails(
            application_id=2,
            farmer_name="Ramesh Kumar",
            date_of_birth="1985-05-15",
            gender="Male",
            category="General",
            mobile_number="9876543210",
            otp_verified=True,
            aadhaar_ref="sample_ref",
            aadhaar_masked="XXXX-XXXX-1234",
            bank_account_number="1234567890",
            ifsc_code="SBIN0001234",
            state_code="UP",
            district_code="LKO",
            tehsil_code="MAL",
            village_code="V001",
            khata_number="102",
            plot_number="45",
            declared_land_area_ha=1.85,
            ownership_type="Single",
            land_document_path="/uploads/blank.pdf",
            self_declaration=True,
            e_kyc_consent=True,
            e_kyc_status=True,
            parcel_id=parcel_id,
            bank_account_ifsc_key="1234567890-SBIN0001234",
            # OCR Unreadable
            ocr_extracted_doc_id=None,
            ocr_status="UNREADABLE",
            ocr_match_status="UNVERIFIED",
            ocr_confidence_score=0.10,
        )

        flags = land_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]

        assert "LAND_DOC_OCR_UNREADABLE" in codes
        unreadable_flag = next(f for f in flags if f.anomaly_code == "LAND_DOC_OCR_UNREADABLE")
        assert unreadable_flag.severity == "Medium"
        assert unreadable_flag.score == 20

        db.close()

    def test_land_engine_flags_unrecorded_deed(self):
        """Verify LandEngine emits LAND_DOC_NOT_IN_GOVT_REGISTRY when deed is unrecorded in government SRO archive."""
        db = TestingSessionLocal()
        parcel_id = "UP-LKO-MAL-V001-K102-P45"
        master = LandRecordMaster(
            parcel_id=parcel_id,
            state_code="UP",
            district_code="LKO",
            tehsil_code="MAL",
            village_code="V001",
            khata_number="102",
            plot_number="45",
            owner_aadhaar_ref="sample_ref",
            owner_name="Ramesh Kumar",
            land_area_ha=1.85,
            land_use_code="AGRICULTURE",
            agricultural_land_flag=True,
            ownership_status="ACTIVE",
            title_status="CLEAR",
        )
        db.add(master)
        db.commit()

        details = PMKisanApplicationDetails(
            application_id=3,
            farmer_name="Ramesh Kumar",
            date_of_birth="1985-05-15",
            gender="Male",
            category="General",
            mobile_number="9876543210",
            otp_verified=True,
            aadhaar_ref="sample_ref",
            aadhaar_masked="XXXX-XXXX-1234",
            bank_account_number="1234567890",
            ifsc_code="SBIN0001234",
            state_code="UP",
            district_code="LKO",
            tehsil_code="MAL",
            village_code="V001",
            khata_number="102",
            plot_number="45",
            declared_land_area_ha=1.85,
            ownership_type="Single",
            land_document_path="/uploads/unrecorded_deed.pdf",
            self_declaration=True,
            e_kyc_consent=True,
            e_kyc_status=True,
            parcel_id=parcel_id,
            bank_account_ifsc_key="1234567890-SBIN0001234",
            ocr_extracted_doc_id="DOC-UP-2024-UNRECORDED999",
            ocr_status="SUCCESS",
            ocr_match_status="MATCHED",
            ocr_confidence_score=0.95,
            ocr_extracted_data={"govt_registry": {"status": "NOT_FOUND"}},
        )

        flags = land_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "LAND_DOC_NOT_IN_GOVT_REGISTRY" in codes
        flag = next(f for f in flags if f.anomaly_code == "LAND_DOC_NOT_IN_GOVT_REGISTRY")
        assert flag.severity == "High"
        assert flag.score == 35
        db.close()

    def test_land_engine_flags_revoked_deed(self):
        """Verify LandEngine emits LAND_DOC_GOVT_DEED_REVOKED when deed is revoked in government SRO archive."""
        db = TestingSessionLocal()
        parcel_id = "UP-LKO-MAL-V001-K102-P45"
        master = LandRecordMaster(
            parcel_id=parcel_id,
            state_code="UP",
            district_code="LKO",
            tehsil_code="MAL",
            village_code="V001",
            khata_number="102",
            plot_number="45",
            owner_aadhaar_ref="sample_ref",
            owner_name="Ramesh Kumar",
            land_area_ha=1.85,
            land_use_code="AGRICULTURE",
            agricultural_land_flag=True,
            ownership_status="ACTIVE",
            title_status="CLEAR",
        )
        db.add(master)
        db.commit()

        details = PMKisanApplicationDetails(
            application_id=4,
            farmer_name="Ramesh Kumar",
            date_of_birth="1985-05-15",
            gender="Male",
            category="General",
            mobile_number="9876543210",
            otp_verified=True,
            aadhaar_ref="sample_ref",
            aadhaar_masked="XXXX-XXXX-1234",
            bank_account_number="1234567890",
            ifsc_code="SBIN0001234",
            state_code="UP",
            district_code="LKO",
            tehsil_code="MAL",
            village_code="V001",
            khata_number="102",
            plot_number="45",
            declared_land_area_ha=1.85,
            ownership_type="Single",
            land_document_path="/uploads/revoked_deed.pdf",
            self_declaration=True,
            e_kyc_consent=True,
            e_kyc_status=True,
            parcel_id=parcel_id,
            bank_account_ifsc_key="1234567890-SBIN0001234",
            ocr_extracted_doc_id="DOC-UP-2023-REV001",
            ocr_status="SUCCESS",
            ocr_match_status="MISMATCH",
            ocr_confidence_score=0.95,
            ocr_extracted_data={"govt_registry": {"status": "REVOKED", "deed_status": "REVOKED"}},
        )

        flags = land_engine.run(details, db)
        codes = [f.anomaly_code for f in flags]
        assert "LAND_DOC_GOVT_DEED_REVOKED" in codes
        flag = next(f for f in flags if f.anomaly_code == "LAND_DOC_GOVT_DEED_REVOKED")
        assert flag.severity == "Critical"
        assert flag.score == 60
        db.close()


class TestGovtLandDeedRegistryService:
    def test_verify_deed_with_govt_registry_verified(self):
        """Verify that genuine deed registered with government yields VERIFIED status."""
        import datetime
        db = TestingSessionLocal()
        db.add(LandDeedRegistryMaster(
            document_number="DOC-UP-2024-001001",
            parcel_id="UP-MRT-HAP-VIL001-K001-P001",
            state_code="UP",
            district_code="MRT",
            tehsil_code="HAP",
            village_code="VIL001",
            khata_number="K001",
            plot_number="P001",
            owner_name="Ramesh Kumar",
            land_area_ha=1.25,
            registration_date=datetime.date(2023, 10, 15),
            sub_registrar_office="SRO Hapur - Central Division",
            deed_status="REGISTERED",
            deed_type="SALE_DEED",
        ))
        db.commit()

        extracted = {
            "document_number": "DOC-UP-2024-001001",
            "parcel_id": "UP-MRT-HAP-VIL001-K001-P001",
            "owner_name": "Ramesh Kumar",
            "raw_snippet": "Valid Bhulekh digital extract with official SRO seal.",
        }

        res = verify_deed_with_govt_registry(
            db=db,
            extracted=extracted,
            declared_parcel_id="UP-MRT-HAP-VIL001-K001-P001",
            declared_name="Ramesh Kumar",
        )

        assert res["status"] == "VERIFIED"
        assert res["document_number"] == "DOC-UP-2024-001001"
        assert res["registered_owner"] == "Ramesh Kumar"
        assert "SRO Hapur" in res["sro_office"]
        db.close()

    def test_verify_deed_with_govt_registry_mismatch_owner(self):
        """Verify titleholder divergence yields MISMATCH status."""
        import datetime
        db = TestingSessionLocal()
        db.add(LandDeedRegistryMaster(
            document_number="DOC-UP-2024-999001",
            parcel_id="UP-BAR-FAT-V009-K999-P99",
            state_code="UP",
            district_code="BAR",
            tehsil_code="FAT",
            village_code="V009",
            khata_number="K999",
            plot_number="P99",
            owner_name="Shrimati Malti Devi",
            land_area_ha=4.50,
            registration_date=datetime.date(2021, 5, 18),
            sub_registrar_office="SRO Barabanki - Fatehpur Division",
            deed_status="REGISTERED",
            deed_type="SALE_DEED",
        ))
        db.commit()

        extracted = {
            "document_number": "DOC-UP-2024-999001",
            "parcel_id": "UP-BAR-FAT-V009-K999-P99",
            "owner_name": "Shrimati Malti Devi",
            "raw_snippet": "Digital RoR for DOC-UP-2024-999001 Barabanki.",
        }

        # Applicant is Hari Om claiming parcel UP-LKO-BAK-VIL009-K001-P001
        res = verify_deed_with_govt_registry(
            db=db,
            extracted=extracted,
            declared_parcel_id="UP-LKO-BAK-VIL009-K001-P001",
            declared_name="Hari Om",
        )

        assert res["status"] == "MISMATCH"
        assert res["registered_owner"] == "Shrimati Malti Devi"
        assert "contradicting declared parcel" in res["details_message"]
        db.close()

    def test_verify_deed_with_govt_registry_not_found(self):
        """Verify unrecorded document yields NOT_FOUND status."""
        db = TestingSessionLocal()
        extracted = {
            "document_number": "DOC-UP-2024-FABRICATED99",
            "raw_snippet": "Counterfeit unrecorded deed extract.",
        }

        res = verify_deed_with_govt_registry(
            db=db,
            extracted=extracted,
            declared_parcel_id="UP-MRT-HAP-VIL001-K001-P001",
            declared_name="Ramesh Kumar",
        )

        assert res["status"] == "NOT_FOUND"
        assert res["document_number"] == "DOC-UP-2024-FABRICATED99"
        db.close()
