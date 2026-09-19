import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date, Text, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    mobile_number = Column(String(20), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(20), nullable=False)
    category = Column(String(50), nullable=True)
    role = Column(String(20), default="USER", nullable=False)  # "USER" or "ADMIN"
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    applications = relationship("Application", back_populates="user", cascade="all, delete-orphan")
    audit_actions = relationship("AuditLog", back_populates="admin")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scheme_code = Column(String(50), default="PM_KISAN", nullable=False)
    status = Column(String(50), default="SUBMITTED", nullable=False)
    risk_score = Column(Integer, nullable=True)
    confidence_level = Column(String(20), nullable=True)  # Low, Medium, High
    recommended_action = Column(String(255), nullable=True)
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="applications")
    pm_kisan_details = relationship("PMKisanApplicationDetails", back_populates="application", uselist=False, cascade="all, delete-orphan")
    anomaly_report = relationship("AnomalyReport", back_populates="application", uselist=False, cascade="all, delete-orphan")
    anomaly_flags = relationship("AnomalyFlag", back_populates="application", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="application", cascade="all, delete-orphan")


class PMKisanApplicationDetails(Base):
    __tablename__ = "pm_kisan_application_details"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True, nullable=False)
    farmer_name = Column(String(255), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(20), nullable=False)
    category = Column(String(50), nullable=True)
    mobile_number = Column(String(20), nullable=False)
    otp_verified = Column(Boolean, default=False, nullable=False)
    aadhaar_ref = Column(String(255), index=True, nullable=False)  # Salted SHA-256
    aadhaar_masked = Column(String(30), nullable=False)            # XXXX-XXXX-1234
    bank_account_number = Column(String(50), nullable=False)
    ifsc_code = Column(String(20), nullable=False)
    state_code = Column(String(20), nullable=False)
    district_code = Column(String(20), nullable=False)
    tehsil_code = Column(String(20), nullable=False)
    village_code = Column(String(20), nullable=False)
    khata_number = Column(String(50), nullable=False)
    plot_number = Column(String(50), nullable=False)
    declared_land_area_ha = Column(Float, nullable=False)
    ownership_type = Column(String(50), nullable=False)
    declared_crop_code = Column(String(50), nullable=True)
    land_document_path = Column(String(500), nullable=False)
    self_declaration = Column(Boolean, default=False, nullable=False)
    e_kyc_consent = Column(Boolean, default=False, nullable=False)
    e_kyc_status = Column(Boolean, default=False, nullable=False)
    parcel_id = Column(String(150), index=True, nullable=False)          # Derived: S-D-T-V-K-P
    bank_account_ifsc_key = Column(String(100), index=True, nullable=False)  # Derived: Acc-IFSC

    application = relationship("Application", back_populates="pm_kisan_details")


class AnomalyReport(Base):
    __tablename__ = "anomaly_reports"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), unique=True, nullable=False)
    risk_score = Column(Integer, nullable=False)  # 0 to 100
    confidence_level = Column(String(20), nullable=False)  # Low, Medium, High
    recommended_action = Column(String(255), nullable=False)
    rationale = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    application = relationship("Application", back_populates="anomaly_report")


class AnomalyFlag(Base):
    __tablename__ = "anomaly_flags"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    anomaly_code = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)  # Low, Medium, High
    score = Column(Integer, nullable=False)
    rationale = Column(Text, nullable=False)
    evidence_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    application = relationship("Application", back_populates="anomaly_flags")


class LandRecordMaster(Base):
    __tablename__ = "land_records_master"

    id = Column(Integer, primary_key=True, index=True)
    parcel_id = Column(String(150), unique=True, index=True, nullable=False)
    state_code = Column(String(20), nullable=False)
    district_code = Column(String(20), nullable=False)
    tehsil_code = Column(String(20), nullable=False)
    village_code = Column(String(20), nullable=False)
    khata_number = Column(String(50), nullable=False)
    plot_number = Column(String(50), nullable=False)
    owner_aadhaar_ref = Column(String(255), nullable=True)
    owner_name = Column(String(255), nullable=False)
    land_area_ha = Column(Float, nullable=False)
    land_use_code = Column(String(50), nullable=False)
    agricultural_land_flag = Column(Boolean, default=True, nullable=False)
    ownership_status = Column(String(50), default="ACTIVE", nullable=False)  # ACTIVE, DISPUTED, INACTIVE
    title_status = Column(String(50), default="CLEAR", nullable=False)


class BankValidationMaster(Base):
    __tablename__ = "bank_validation_master"

    id = Column(Integer, primary_key=True, index=True)
    bank_account_ifsc_key = Column(String(100), unique=True, index=True, nullable=False)
    bank_account_number = Column(String(50), nullable=False)
    ifsc_code = Column(String(20), nullable=False)
    account_holder_name = Column(String(255), nullable=False)
    account_status = Column(String(50), default="ACTIVE", nullable=False)  # ACTIVE, INACTIVE, CLOSED, FROZEN
    ifsc_valid = Column(Boolean, default=True, nullable=False)
    penny_drop_status = Column(String(50), default="SUCCESS", nullable=False)  # SUCCESS, FAILED, NOT_DONE
    name_match_score = Column(Float, default=1.0, nullable=False)


class ExclusionMaster(Base):
    __tablename__ = "exclusion_master"

    id = Column(Integer, primary_key=True, index=True)
    aadhaar_ref = Column(String(255), unique=True, index=True, nullable=False)
    taxpayer_flag = Column(Boolean, default=False, nullable=False)
    govt_employee_flag = Column(Boolean, default=False, nullable=False)
    pensioner_flag = Column(Boolean, default=False, nullable=False)
    professional_flag = Column(Boolean, default=False, nullable=False)
    institutional_landholder_flag = Column(Boolean, default=False, nullable=False)
    deceased_flag = Column(Boolean, default=False, nullable=False)


class VillageProfileMaster(Base):
    __tablename__ = "village_profile_master"

    id = Column(Integer, primary_key=True, index=True)
    village_code = Column(String(50), unique=True, index=True, nullable=False)
    district_code = Column(String(20), nullable=False)
    tehsil_code = Column(String(20), nullable=False)
    village_name = Column(String(255), nullable=False)
    historical_beneficiary_count = Column(Integer, default=0, nullable=False)
    cultivator_count_estimate = Column(Integer, default=0, nullable=False)


class EventCalendarMaster(Base):
    __tablename__ = "event_calendar_master"

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(String(20), nullable=False)
    event_type = Column(String(50), nullable=False)  # installment_release, eKYC_deadline, application_cutoff
    event_date = Column(Date, nullable=False)
    description = Column(String(255), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)  # APPROVE, HOLD, REJECT, REQUEST_DOCUMENTS, ESCALATE
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    application = relationship("Application", back_populates="audit_logs")
    admin = relationship("User", back_populates="audit_actions")
