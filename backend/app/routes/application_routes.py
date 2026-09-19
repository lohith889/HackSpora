import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Application, AnomalyFlag
from app.auth import get_current_user
from app.utils import get_citizen_status_message
from app.schemas import (
    ApplicationSubmissionResponse,
    CitizenApplicationSummary,
    CitizenApplicationDetail,
    AdminApplicationDetail,
    AnomalyFlagResponse,
    AnomalyReportResponse,
)
from app.services import application_service
from app.services.anomaly_pipeline import run_pipeline

application_router = APIRouter(prefix="/applications", tags=["Applications"])


@application_router.post(
    "/pm-kisan",
    response_model=ApplicationSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit PM-KISAN Scheme Application with Land Document",
)
async def submit_pm_kisan_application(
    farmer_name: str = Form(..., description="Farmer full name matching Aadhaar"),
    date_of_birth: str = Form(..., description="Date of birth in YYYY-MM-DD format"),
    gender: str = Form(..., description="Gender (Male, Female, Other)"),
    category: Optional[str] = Form("General", description="Category (General, OBC, SC, ST)"),
    mobile_number: str = Form(..., description="10-digit mobile number"),
    otp: str = Form(..., description="6-digit mobile verification OTP"),
    aadhaar_number: str = Form(..., description="12-digit Aadhaar number"),
    e_kyc_consent: bool = Form(..., description="Consent for Aadhaar e-KYC"),
    bank_account_number: str = Form(..., description="Bank account number (9-18 digits)"),
    ifsc_code: str = Form(..., description="Bank IFSC code"),
    state_code: str = Form(..., description="2-letter state code"),
    district_code: str = Form(..., description="3-letter district code"),
    tehsil_code: str = Form(..., description="Tehsil code"),
    village_code: str = Form(..., description="Village code"),
    khata_number: str = Form(..., description="Khata number"),
    plot_number: str = Form(..., description="Plot / Khasra number"),
    declared_land_area_ha: float = Form(..., description="Land area in hectares"),
    ownership_type: str = Form(..., description="Single or Joint"),
    declared_crop_code: Optional[str] = Form(None, description="Primary crop"),
    self_declaration: bool = Form(..., description="Mandatory eligibility declaration"),
    land_document: UploadFile = File(..., description="Land deed proof (PDF/JPG/PNG max 5MB)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ingest a new PM-KISAN subsidy claim:
    - Verifies mock OTP ('123456')
    - Hashes Aadhaar with secret salt; discards raw 12-digit Aadhaar immediately
    - Stores land deed in uploads/ directory with size and format verification
    - Generates parcel_id and bank_account_ifsc_key
    - Persists Application and PMKisanApplicationDetails in database
    - Returns immediate submission acknowledgment with citizen status
    """
    try:
        parsed_dob = datetime.date.fromisoformat(date_of_birth.strip())
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date_of_birth format. Please use YYYY-MM-DD.",
        )

    application = await application_service.create_pm_kisan_application(
        db=db,
        current_user=current_user,
        farmer_name=farmer_name,
        date_of_birth=parsed_dob,
        gender=gender,
        category=category,
        mobile_number=mobile_number,
        otp=otp,
        aadhaar_number=aadhaar_number,
        e_kyc_consent=e_kyc_consent,
        bank_account_number=bank_account_number,
        ifsc_code=ifsc_code,
        state_code=state_code,
        district_code=district_code,
        tehsil_code=tehsil_code,
        village_code=village_code,
        khata_number=khata_number,
        plot_number=plot_number,
        declared_land_area_ha=declared_land_area_ha,
        ownership_type=ownership_type,
        declared_crop_code=declared_crop_code,
        self_declaration=self_declaration,
        land_document=land_document,
    )

    details = application.pm_kisan_details

    # ── Run Anomaly Detection Pipeline (all 7 engines) ──────────────────────
    if details:
        try:
            pipeline_result = run_pipeline(details, db)
            # Persist each flag as an AnomalyFlag row (raw flags — scoring in Phase 4)
            for flag in pipeline_result.flags:
                db_flag = AnomalyFlag(
                    application_id=application.id,
                    anomaly_code=flag.anomaly_code,
                    severity=flag.severity,
                    score=flag.score,
                    rationale=flag.rationale,
                    evidence_json=flag.evidence_json or {},
                )
                db.add(db_flag)
            db.commit()
        except Exception:
            # Pipeline errors must never block the citizen's submission response
            db.rollback()

    return ApplicationSubmissionResponse(
        application_id=application.id,
        scheme_code=application.scheme_code,
        status=application.status,
        citizen_status_message=get_citizen_status_message(application.status),
        submitted_at=application.submitted_at or datetime.datetime.utcnow(),
        parcel_id=details.parcel_id if details else "",
        aadhaar_masked=details.aadhaar_masked if details else "",
    )


@application_router.get(
    "/my",
    response_model=List[CitizenApplicationSummary],
    summary="List Applications for Current Logged-In User",
)
def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all applications submitted by the logged-in citizen.
    Provides sanitized status guidance and redacts internal fraud scores.
    """
    apps = application_service.get_user_applications(db, current_user.id)
    return [
        CitizenApplicationSummary(
            id=app.id,
            scheme_code=app.scheme_code,
            status=app.status,
            citizen_status_message=get_citizen_status_message(app.status),
            submitted_at=app.submitted_at,
            farmer_name=app.pm_kisan_details.farmer_name if app.pm_kisan_details else "",
            parcel_id=app.pm_kisan_details.parcel_id if app.pm_kisan_details else "",
        )
        for app in apps
    ]


@application_router.get(
    "/{application_id}",
    summary="Get Application Details with Role-Based Redaction",
)
def get_application_details(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve application details.
    - If applicant is USER: ensures ownership and returns CitizenApplicationDetail
      (strictly redacting risk score, anomaly flags, and rationale).
    - If applicant is ADMIN: returns AdminApplicationDetail with full fraud dossier.
    """
    app = application_service.get_application_by_id(db, application_id)
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID {application_id} not found.",
        )

    # Enforce role boundaries
    if current_user.role != "ADMIN" and app.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view this application.",
        )

    details = app.pm_kisan_details
    if not details:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Application details are missing or corrupted.",
        )

    # 1. Citizen view (strictly redacted)
    if current_user.role != "ADMIN":
        return CitizenApplicationDetail(
            id=app.id,
            scheme_code=app.scheme_code,
            status=app.status,
            citizen_status_message=get_citizen_status_message(app.status),
            submitted_at=app.submitted_at,
            farmer_name=details.farmer_name,
            date_of_birth=details.date_of_birth,
            gender=details.gender,
            category=details.category,
            mobile_number=details.mobile_number,
            aadhaar_masked=details.aadhaar_masked,
            bank_account_number=f"XXXXXXXX{details.bank_account_number[-4:]}" if len(details.bank_account_number) >= 4 else details.bank_account_number,
            ifsc_code=details.ifsc_code,
            state_code=details.state_code,
            district_code=details.district_code,
            tehsil_code=details.tehsil_code,
            village_code=details.village_code,
            khata_number=details.khata_number,
            plot_number=details.plot_number,
            declared_land_area_ha=details.declared_land_area_ha,
            ownership_type=details.ownership_type,
            declared_crop_code=details.declared_crop_code,
            land_document_path=details.land_document_path,
            parcel_id=details.parcel_id,
        )

    # 2. Admin view (full internal dossier)
    anomaly_rep = None
    if app.anomaly_report:
        anomaly_rep = AnomalyReportResponse(
            risk_score=app.anomaly_report.risk_score,
            confidence_level=app.anomaly_report.confidence_level,
            recommended_action=app.anomaly_report.recommended_action,
            rationale=app.anomaly_report.rationale,
        )

    flags = [
        AnomalyFlagResponse(
            anomaly_code=f.anomaly_code,
            severity=f.severity,
            score=f.score,
            rationale=f.rationale,
            evidence_json=f.evidence_json,
        )
        for f in (app.anomaly_flags or [])
    ]

    return AdminApplicationDetail(
        id=app.id,
        user_id=app.user_id,
        scheme_code=app.scheme_code,
        status=app.status,
        risk_score=app.risk_score,
        confidence_level=app.confidence_level,
        recommended_action=app.recommended_action,
        submitted_at=app.submitted_at,
        created_at=app.created_at,
        farmer_name=details.farmer_name,
        date_of_birth=details.date_of_birth,
        gender=details.gender,
        category=details.category,
        mobile_number=details.mobile_number,
        otp_verified=details.otp_verified,
        aadhaar_ref=details.aadhaar_ref,
        aadhaar_masked=details.aadhaar_masked,
        bank_account_number=details.bank_account_number,
        ifsc_code=details.ifsc_code,
        bank_account_ifsc_key=details.bank_account_ifsc_key,
        state_code=details.state_code,
        district_code=details.district_code,
        tehsil_code=details.tehsil_code,
        village_code=details.village_code,
        khata_number=details.khata_number,
        plot_number=details.plot_number,
        declared_land_area_ha=details.declared_land_area_ha,
        ownership_type=details.ownership_type,
        declared_crop_code=details.declared_crop_code,
        land_document_path=details.land_document_path,
        self_declaration=details.self_declaration,
        e_kyc_consent=details.e_kyc_consent,
        e_kyc_status=details.e_kyc_status,
        parcel_id=details.parcel_id,
        anomaly_report=anomaly_rep,
        anomaly_flags=flags,
    )
