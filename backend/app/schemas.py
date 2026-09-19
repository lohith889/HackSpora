import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Dict, Any


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    mobile_number: str = Field(..., min_length=10, max_length=15)
    date_of_birth: datetime.date
    gender: str = Field(..., min_length=1, max_length=20)
    category: Optional[str] = "General"


class UserRegister(UserBase):
    password: str = Field(..., min_length=6, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(UserBase):
    id: int
    role: str
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None
    role: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    project: str
    version: str


# ==========================================
# Scheme Specifications & Metadata Schemas
# ==========================================

class SchemeFieldOption(BaseModel):
    label: str
    value: str


class SchemeFieldSpec(BaseModel):
    name: str
    label: str
    type: str  # text, number, date, select, checkbox, file
    required: bool = True
    placeholder: Optional[str] = None
    validation_regex: Optional[str] = None
    options: Optional[List[SchemeFieldOption]] = None
    help_text: Optional[str] = None


class SchemeSectionSpec(BaseModel):
    section_id: str
    title: str
    description: Optional[str] = None
    fields: List[SchemeFieldSpec]


class SchemeMetadataResponse(BaseModel):
    scheme_code: str
    scheme_name: str
    version: str
    description: str
    allowed_mime_types: List[str]
    max_file_size_mb: int
    sections: List[SchemeSectionSpec]


# ==========================================
# Application Submission & Tracking Schemas
# ==========================================

class ApplicationSubmissionResponse(BaseModel):
    application_id: int
    scheme_code: str
    status: str
    citizen_status_message: str
    submitted_at: datetime.datetime
    parcel_id: str
    aadhaar_masked: str


class CitizenApplicationSummary(BaseModel):
    id: int
    scheme_code: str
    status: str
    citizen_status_message: str
    submitted_at: Optional[datetime.datetime] = None
    farmer_name: str
    parcel_id: str

    model_config = ConfigDict(from_attributes=True)


class CitizenApplicationDetail(BaseModel):
    id: int
    scheme_code: str
    status: str
    citizen_status_message: str
    submitted_at: Optional[datetime.datetime] = None
    farmer_name: str
    date_of_birth: datetime.date
    gender: str
    category: Optional[str] = None
    mobile_number: str
    aadhaar_masked: str
    bank_account_number: str
    ifsc_code: str
    state_code: str
    district_code: str
    tehsil_code: str
    village_code: str
    khata_number: str
    plot_number: str
    declared_land_area_ha: float
    ownership_type: str
    declared_crop_code: Optional[str] = None
    land_document_path: str
    parcel_id: str

    model_config = ConfigDict(from_attributes=True)


class AnomalyFlagResponse(BaseModel):
    anomaly_code: str
    severity: str
    score: int
    rationale: str
    evidence_json: Optional[Any] = None

    model_config = ConfigDict(from_attributes=True)


class AnomalyReportResponse(BaseModel):
    risk_score: int
    confidence_score: int = 85
    confidence_level: str
    recommended_action: str
    rationale: str

    model_config = ConfigDict(from_attributes=True)


class AdminApplicationDetail(BaseModel):
    id: int
    user_id: int
    scheme_code: str
    status: str
    risk_score: Optional[int] = None
    confidence_score: Optional[int] = None
    confidence_level: Optional[str] = None
    recommended_action: Optional[str] = None
    officer_decision: Optional[str] = None
    officer_remarks: Optional[str] = None
    officer_decided_at: Optional[datetime.datetime] = None
    submitted_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    # PM-Kisan Details
    farmer_name: str
    date_of_birth: datetime.date
    gender: str
    category: Optional[str] = None
    mobile_number: str
    otp_verified: bool
    aadhaar_ref: str
    aadhaar_masked: str
    bank_account_number: str
    ifsc_code: str
    bank_account_ifsc_key: str
    state_code: str
    district_code: str
    tehsil_code: str
    village_code: str
    khata_number: str
    plot_number: str
    declared_land_area_ha: float
    ownership_type: str
    declared_crop_code: Optional[str] = None
    land_document_path: str
    self_declaration: bool
    e_kyc_consent: bool
    e_kyc_status: bool
    parcel_id: str

    # Anomaly Dossier
    anomaly_report: Optional[AnomalyReportResponse] = None
    anomaly_flags: List[AnomalyFlagResponse] = []

    model_config = ConfigDict(from_attributes=True)


class OfficerDecisionRequest(BaseModel):
    decision: str = Field(..., description="Action: APPROVE, REJECT, HOLD, REQUEST_DOCUMENTS, ESCALATE")
    remarks: str = Field(..., min_length=3, max_length=1000, description="Mandatory officer explanation")


class OfficerDecisionResponse(BaseModel):
    application_id: int
    previous_status: str
    new_status: str
    decision: str
    remarks: str
    decided_at: datetime.datetime
    decided_by_officer: str


class EvaluationMetricsResponse(BaseModel):
    total_test_samples: int
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    specificity: float
    false_positive_rate: float
    evaluation_timestamp: datetime.datetime


class AuditLogResponse(BaseModel):
    id: int
    application_id: int
    admin_id: int
    admin_name: Optional[str] = None
    action: str
    remarks: Optional[str] = None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

