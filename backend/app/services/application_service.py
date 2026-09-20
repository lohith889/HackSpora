import os
import time
import uuid
import datetime
from typing import Optional, List
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models import Application, PMKisanApplicationDetails, User
from app.auth import hash_aadhaar, mask_aadhaar
from app.utils import (
    generate_parcel_id,
    generate_bank_ifsc_key,
    validate_aadhaar_format,
    validate_ifsc_format,
    validate_mock_otp,
)
from app.services.land_ocr_service import process_uploaded_land_document

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


async def save_upload_file(upload_file: UploadFile) -> str:
    """
    Validate extension, check file size limit (5MB), and write to UPLOAD_DIR.
    Returns the relative URL path (/uploads/<filename>).
    """
    if not upload_file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a filename",
        )

    _, ext = os.path.splitext(upload_file.filename)
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported document format '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Read file contents and check size
    contents = await upload_file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Uploaded file size ({len(contents)} bytes) exceeds the 5MB maximum limit",
        )
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded document is empty (0 bytes)",
        )

    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Generate non-colliding sanitized filename
    unique_name = f"land_doc_{uuid.uuid4().hex[:12]}_{int(time.time())}{ext}"
    dest_path = os.path.join(settings.UPLOAD_DIR, unique_name)

    with open(dest_path, "wb") as f:
        f.write(contents)

    return f"/uploads/{unique_name}"


async def create_pm_kisan_application(
    db: Session,
    current_user: User,
    farmer_name: str,
    date_of_birth: datetime.date,
    gender: str,
    category: Optional[str],
    mobile_number: str,
    otp: str,
    aadhaar_number: str,
    e_kyc_consent: bool,
    bank_account_number: str,
    ifsc_code: str,
    state_code: str,
    district_code: str,
    tehsil_code: str,
    village_code: str,
    khata_number: str,
    plot_number: str,
    declared_land_area_ha: float,
    ownership_type: str,
    declared_crop_code: Optional[str],
    self_declaration: bool,
    land_document: UploadFile,
) -> Application:
    """
    Validate input constraints, hash/mask Aadhaar, save document,
    generate composite keys, and persist Application and PMKisanApplicationDetails.
    """
    # 1. Validate mandatory declarations
    if not self_declaration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self declaration undertaking is mandatory to apply for PM-KISAN.",
        )
    if not e_kyc_consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aadhaar e-KYC consent is required for scheme verification.",
        )

    # 2. Validate OTP
    if not validate_mock_otp(otp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid mobile verification OTP. (Mock OTP: 123456)",
        )

    # 3. Validate Aadhaar format (12 numeric digits)
    if not validate_aadhaar_format(aadhaar_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Aadhaar number: must be exactly 12 numeric digits.",
        )

    # 4. Validate Bank Account and IFSC
    clean_bank_acc = bank_account_number.strip()
    if not (9 <= len(clean_bank_acc) <= 18 and clean_bank_acc.isdigit()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid bank account number: must be between 9 and 18 digits.",
        )
    if not validate_ifsc_format(ifsc_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid IFSC code format (expected format: 4 uppercase letters, 0, 6 alphanumeric).",
        )

    # 5. Validate Land Area
    if declared_land_area_ha <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Declared cultivable land area must be greater than 0 hectares.",
        )

    # 6. Save uploaded land document safely
    document_path = await save_upload_file(land_document)

    # 7. Privacy: Compute Salted Hash and Masked Aadhaar (Raw Aadhaar is NEVER stored!)
    aadhaar_ref = hash_aadhaar(aadhaar_number)
    aadhaar_masked = mask_aadhaar(aadhaar_number)

    # 8. Compute standard composite keys
    parcel_id = generate_parcel_id(
        state_code=state_code,
        district_code=district_code,
        tehsil_code=tehsil_code,
        village_code=village_code,
        khata_number=khata_number,
        plot_number=plot_number,
    )
    bank_account_ifsc_key = generate_bank_ifsc_key(
        bank_account_number=clean_bank_acc,
        ifsc_code=ifsc_code,
    )

    # 8b. Automated Land Document OCR & Verification (Phase 9)
    actual_doc_file = os.path.join(settings.UPLOAD_DIR, os.path.basename(document_path))
    ocr_result = process_uploaded_land_document(
        file_path=actual_doc_file,
        declared_parcel_id=parcel_id,
        declared_khata=khata_number,
        declared_plot=plot_number,
        declared_name=farmer_name,
    )

    # 9. Create Application record
    now = datetime.datetime.utcnow()
    application = Application(
        user_id=current_user.id,
        scheme_code="PM_KISAN",
        status="SUBMITTED",
        submitted_at=now,
        created_at=now,
    )
    db.add(application)
    db.flush()  # Flush to populate application.id

    # 10. Create PM-KISAN specific details record
    pm_kisan_details = PMKisanApplicationDetails(
        application_id=application.id,
        farmer_name=farmer_name.strip(),
        date_of_birth=date_of_birth,
        gender=gender.strip(),
        category=category.strip() if category else "General",
        mobile_number=mobile_number.strip(),
        otp_verified=True,
        aadhaar_ref=aadhaar_ref,
        aadhaar_masked=aadhaar_masked,
        bank_account_number=clean_bank_acc,
        ifsc_code=ifsc_code.strip().upper(),
        state_code=state_code.strip().upper(),
        district_code=district_code.strip().upper(),
        tehsil_code=tehsil_code.strip().upper(),
        village_code=village_code.strip().upper(),
        khata_number=khata_number.strip().upper(),
        plot_number=plot_number.strip().upper(),
        declared_land_area_ha=float(declared_land_area_ha),
        ownership_type=ownership_type.strip(),
        declared_crop_code=declared_crop_code.strip() if declared_crop_code else None,
        land_document_path=document_path,
        self_declaration=self_declaration,
        e_kyc_consent=e_kyc_consent,
        e_kyc_status=True,
        parcel_id=parcel_id,
        bank_account_ifsc_key=bank_account_ifsc_key,
        ocr_extracted_doc_id=ocr_result.get("ocr_extracted_doc_id"),
        ocr_status=ocr_result.get("ocr_status", "PENDING"),
        ocr_match_status=ocr_result.get("ocr_match_status", "UNVERIFIED"),
        ocr_confidence_score=ocr_result.get("ocr_confidence_score", 0.0),
        ocr_extracted_data=ocr_result.get("ocr_extracted_data"),
    )
    db.add(pm_kisan_details)
    db.commit()
    db.refresh(application)

    return application


def get_user_applications(db: Session, user_id: int) -> List[Application]:
    """Retrieve all applications submitted by a specific user."""
    return (
        db.query(Application)
        .options(joinedload(Application.pm_kisan_details))
        .filter(Application.user_id == user_id)
        .order_by(Application.submitted_at.desc())
        .all()
    )


def get_application_by_id(db: Session, application_id: int) -> Optional[Application]:
    """Retrieve application by ID with all joined relationships."""
    return (
        db.query(Application)
        .options(
            joinedload(Application.pm_kisan_details),
            joinedload(Application.anomaly_report),
            joinedload(Application.anomaly_flags),
        )
        .filter(Application.id == application_id)
        .first()
    )
