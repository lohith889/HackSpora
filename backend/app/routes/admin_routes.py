"""
Admin Review & Decision Adjudication Routes

Provides endpoints for Scheme Officers (ADMIN role) to:
  1. Adjudicate applications with mandatory remarks (Officer Final Decision)
  2. Inspect Anomaly Dossiers & Evaluation Benchmarks (Precision / Recall / F1)
  3. Query, filter, and review applications
"""
import io
import csv
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
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
    AuditLogResponse,
)
from app.services.model_evaluation import evaluate_pipeline_on_synthetic_ground_truth
from app.services.network_service import get_network_data

admin_router = APIRouter(prefix="/admin", tags=["Admin Officer Console"])

VALID_DECISIONS = {
    "APPROVE": "APPROVED",
    "REJECT": "REJECTED",
    "HOLD": "PAYMENT_HELD",
    "REQUEST_DOCUMENTS": "DOCUMENTS_REQUESTED",
    "ESCALATE": "ESCALATED",
}


@admin_router.get(
    "/sentinel/network",
    summary="Fraud Ring Radar network of applications, resources, parcels, and villages",
)
def get_sentinel_network(
    mode: str = Query("demo_ring", description="Network mode: demo_ring, demo_family, or live"),
    application_id: Optional[int] = Query(None, description="Optional focus application ID for subgraph extraction"),
    limit: int = Query(150, ge=1, le=500),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role("ADMIN")),
):
    """Return graph-ready, privacy-preserving syndicate network data exclusively for scheme officers."""
    return get_network_data(db, mode=mode, target_app_id=application_id, limit=limit)


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
    village: Optional[str] = Query(None),
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
        if village and details.village_code != village.strip().upper():
            continue

        anomaly_rep = None
        r = a.anomaly_report
        if r:
            anomaly_rep = AnomalyReportResponse(
                risk_score=r.risk_score,
                confidence_score=r.confidence_score or 85,
                confidence_level=r.confidence_level,
                recommended_action=r.recommended_action,
                rationale=r.rationale,
                ml_risk_score=r.ml_risk_score,
                is_statutory_override=r.is_statutory_override,
                divergence_score=r.divergence_score,
                ml_shap_drivers=r.ml_shap_drivers,
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
            ml_risk_score=r.ml_risk_score if r else None,
            is_statutory_override=r.is_statutory_override if r else False,
            divergence_score=r.divergence_score if r else 0,
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
            ocr_extracted_doc_id=details.ocr_extracted_doc_id,
            ocr_status=details.ocr_status,
            ocr_match_status=details.ocr_match_status,
            ocr_confidence_score=details.ocr_confidence_score,
            ocr_extracted_data=details.ocr_extracted_data,
            anomaly_report=anomaly_rep,
            anomaly_flags=flags,
        ))

    return results


@admin_router.get(
    "/applications/export/csv",
    summary="Export Applications and Anomaly Reports as CSV",
)
def export_applications_csv(
    status_filter: Optional[str] = Query(None, alias="status"),
    district: Optional[str] = Query(None),
    village: Optional[str] = Query(None),
    min_risk: Optional[int] = Query(None),
    max_risk: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role("ADMIN")),
):
    """Export filtered applications and anomaly summaries as a downloadable CSV file."""
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

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Application ID",
        "Farmer Name",
        "Status",
        "Risk Score",
        "Risk Tier",
        "Confidence Score",
        "Confidence Level",
        "Recommended Action",
        "District",
        "Village",
        "Parcel ID",
        "Bank Account",
        "IFSC",
        "Anomaly Flag Count",
        "Anomaly Codes",
        "Submitted At",
        "Officer Decision",
        "Officer Remarks",
    ])

    for a in apps:
        details = a.pm_kisan_details
        if not details:
            continue
        if district and details.district_code != district.strip().upper():
            continue
        if village and details.village_code != village.strip().upper():
            continue

        flags = a.anomaly_flags or []
        flag_codes = "; ".join(f.anomaly_code for f in flags)
        tier = "Low"
        if a.risk_score is not None:
            if a.risk_score >= 75:
                tier = "Critical"
            elif a.risk_score >= 50:
                tier = "High"
            elif a.risk_score >= 25:
                tier = "Moderate"

        writer.writerow([
            f"APP-{str(a.id).zfill(6)}",
            details.farmer_name,
            a.status,
            a.risk_score if a.risk_score is not None else 0,
            tier,
            f"{a.confidence_score}%" if a.confidence_score is not None else "85%",
            a.confidence_level or "Medium",
            a.recommended_action or "",
            details.district_code,
            details.village_code,
            details.parcel_id,
            details.bank_account_number,
            details.ifsc_code,
            len(flags),
            flag_codes,
            a.submitted_at.isoformat() if a.submitted_at else "",
            a.officer_decision or "",
            a.officer_remarks or "",
        ])

    output.seek(0)
    filename = f"kisanguard_applications_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@admin_router.get(
    "/applications/{application_id}",
    response_model=AdminApplicationDetail,
    summary="Get Detailed Anomaly Dossier for Application (Admin Route)",
)
def get_admin_application_detail(
    application_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role("ADMIN")),
):
    """Retrieve full anomaly dossier for a specific application."""
    app = (
        db.query(Application)
        .options(
            joinedload(Application.pm_kisan_details),
            joinedload(Application.anomaly_report),
            joinedload(Application.anomaly_flags),
        )
        .filter(Application.id == application_id)
        .first()
    )
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with ID {application_id} not found.",
        )
    details = app.pm_kisan_details
    if not details:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Application details are missing or corrupted.",
        )

    anomaly_rep = None
    r = app.anomaly_report
    if r:
        anomaly_rep = AnomalyReportResponse(
            risk_score=r.risk_score,
            confidence_score=r.confidence_score or 85,
            confidence_level=r.confidence_level,
            recommended_action=r.recommended_action,
            rationale=r.rationale,
            ml_risk_score=r.ml_risk_score,
            is_statutory_override=r.is_statutory_override,
            divergence_score=r.divergence_score,
            ml_shap_drivers=r.ml_shap_drivers,
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
        ml_risk_score=r.ml_risk_score if r else None,
        is_statutory_override=r.is_statutory_override if r else False,
        divergence_score=r.divergence_score if r else 0,
        confidence_score=app.confidence_score,
        confidence_level=app.confidence_level,
        recommended_action=app.recommended_action,
        officer_decision=app.officer_decision,
        officer_remarks=app.officer_remarks,
        officer_decided_at=app.officer_decided_at,
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
        ocr_extracted_doc_id=details.ocr_extracted_doc_id,
        ocr_status=details.ocr_status,
        ocr_match_status=details.ocr_match_status,
        ocr_confidence_score=details.ocr_confidence_score,
        ocr_extracted_data=details.ocr_extracted_data,
        anomaly_report=anomaly_rep,
        anomaly_flags=flags,
    )


@admin_router.get(
    "/audit-logs",
    response_model=List[AuditLogResponse],
    summary="List Immutable Audit Logs for Officer Adjudication Actions",
)
def get_audit_logs(
    application_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role("ADMIN")),
):
    """Retrieve immutable audit logs recorded for scheme officer adjudication actions."""
    query = db.query(AuditLog).options(joinedload(AuditLog.admin))
    if application_id is not None:
        query = query.filter(AuditLog.application_id == application_id)
    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()

    return [
        AuditLogResponse(
            id=log.id,
            application_id=log.application_id,
            admin_id=log.admin_id,
            admin_name=log.admin.full_name or log.admin.email if log.admin else f"Officer #{log.admin_id}",
            action=log.action,
            remarks=log.remarks,
            created_at=log.created_at,
        )
        for log in logs
    ]

