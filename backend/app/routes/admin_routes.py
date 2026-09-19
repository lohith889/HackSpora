"""
Admin Review & Decision Adjudication Routes

Provides endpoints for Scheme Officers (ADMIN role) to:
  1. Adjudicate applications with mandatory remarks (Officer Final Decision)
  2. Inspect Anomaly Dossiers & Evaluation Benchmarks (Precision / Recall / F1)
  3. Query, filter, and review applications
"""
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import User, Application, AuditLog, AnomalyReport, AnomalyFlag
from app.auth import require_role
from app.schemas import (
    OfficerDecisionRequest,
    OfficerDecisionResponse,
    EvaluationMetricsResponse,
    AdminApplicationDetail,
    AnomalyReportResponse,
    AnomalyFlagResponse,
)
from app.services.model_evaluation import evaluate_pipeline_on_synthetic_ground_truth

admin_router = APIRouter(prefix="/admin", tags=["Admin Officer Console"])

VALID_DECISIONS = {
    "APPROVE": "APPROVED",
    "REJECT": "REJECTED",
    "HOLD": "PAYMENT_HELD",
    "REQUEST_DOCUMENTS": "DOCUMENTS_REQUESTED",
    "ESCALATE": "ESCALATED",
}


@admin_router.post(
    "/applications/{application_id}/decision",
    response_model=OfficerDecisionResponse,
    summary="Adjudicate Application with Officer Final Decision",
)
def record_officer_decision(
    application_id: int,
    payload: OfficerDecisionRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role("ADMIN")),
):
    """
    CRITICAL ARCHITECTURE CONTRACT:
    The scheme portal NEVER automatically grants, rejects, or disburses subsidy.
    Final status transitions strictly require an authorized Scheme Officer to review
    the anomaly dossier and make an explicit decision with written justification.
    """
    decision_clean = payload.decision.strip().upper()
    if decision_clean not in VALID_DECISIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid decision '{payload.decision}'. Allowed actions: {', '.join(sorted(VALID_DECISIONS.keys()))}",
        )

    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID {application_id} not found.",
        )

    prev_status = app.status
    new_status = VALID_DECISIONS[decision_clean]

    # Update application record
    app.status = new_status
    app.officer_decision = decision_clean
    app.officer_remarks = payload.remarks.strip()
    app.officer_decided_at = datetime.datetime.utcnow()

    # Create immutable audit log entry
    audit_entry = AuditLog(
        application_id=app.id,
        admin_id=admin_user.id,
        action=decision_clean,
        remarks=payload.remarks.strip(),
        created_at=datetime.datetime.utcnow(),
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(app)

    return OfficerDecisionResponse(
        application_id=app.id,
        previous_status=prev_status,
        new_status=new_status,
        decision=decision_clean,
        remarks=payload.remarks.strip(),
        decided_at=app.officer_decided_at,
        decided_by_officer=admin_user.full_name or admin_user.email,
    )


@admin_router.get(
    "/evaluation/metrics",
    response_model=EvaluationMetricsResponse,
    summary="Benchmark Anomaly Pipeline on Synthetic Ground Truth (Precision, Recall, F1)",
)
def get_model_evaluation_metrics(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role("ADMIN")),
):
    """
    Execute synthetic ground-truth benchmark across genuine and fraudulent test cases.
    Returns Confusion Matrix, Precision, Recall, F1 Score, Specificity, and FPR.
    """
    metrics = evaluate_pipeline_on_synthetic_ground_truth(db)
    return EvaluationMetricsResponse(**metrics)


@admin_router.get(
    "/applications",
    response_model=List[AdminApplicationDetail],
    summary="List Applications for Admin Console with Filtering",
)
def list_applications_for_admin(
    status_filter: Optional[str] = Query(None, alias="status"),
    district: Optional[str] = Query(None),
    min_risk: Optional[int] = Query(None),
    max_risk: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role("ADMIN")),
):
    """Retrieve applications with joined PM-KISAN details, risk reports, and flags."""
    query = (
        db.query(Application)
        .options(
            joinedload(Application.pm_kisan_details),
            joinedload(Application.anomaly_report),
            joinedload(Application.anomaly_flags),
        )
    )

    if status_filter:
        query = query.filter(Application.status == status_filter.strip().upper())
    if min_risk is not None:
        query = query.filter(Application.risk_score >= min_risk)
    if max_risk is not None:
        query = query.filter(Application.risk_score <= max_risk)

    apps = query.order_by(Application.risk_score.desc().nullslast(), Application.submitted_at.desc()).all()

    results = []
    for a in apps:
        details = a.pm_kisan_details
        if not details:
            continue
        if district and details.district_code != district.strip().upper():
            continue

        anomaly_rep = None
        if a.anomaly_report:
            anomaly_rep = AnomalyReportResponse(
                risk_score=a.anomaly_report.risk_score,
                confidence_score=a.anomaly_report.confidence_score or 85,
                confidence_level=a.anomaly_report.confidence_level,
                recommended_action=a.anomaly_report.recommended_action,
                rationale=a.anomaly_report.rationale,
            )

        flags = [
            AnomalyFlagResponse(
                anomaly_code=f.anomaly_code,
                severity=f.severity,
                score=f.score,
                rationale=f.rationale,
                evidence_json=f.evidence_json,
            )
            for f in (a.anomaly_flags or [])
        ]

        results.append(AdminApplicationDetail(
            id=a.id,
            user_id=a.user_id,
            scheme_code=a.scheme_code,
            status=a.status,
            risk_score=a.risk_score,
            confidence_score=a.confidence_score,
            confidence_level=a.confidence_level,
            recommended_action=a.recommended_action,
            officer_decision=a.officer_decision,
            officer_remarks=a.officer_remarks,
            officer_decided_at=a.officer_decided_at,
            submitted_at=a.submitted_at,
            created_at=a.created_at,
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
        ))

    return results
