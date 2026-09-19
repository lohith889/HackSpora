# Requirements: KisanGuard Portal

**Defined:** 2026-09-19  
**Core Value:** Deterministic and statistical anomaly detection on agricultural subsidy applications that reliably flags fraudulent claims with high confidence and explainable rationale while keeping internal fraud scoring invisible to applicants.

## v1 Requirements

### Authentication & Authorization
- [x] **AUTH-01**: User can register with email, mobile, password, name, DOB, gender, and category with bcrypt password hashing.
- [x] **AUTH-02**: User and Admin can log in using email/password and receive JWT tokens with role claims (`USER` or `ADMIN`).
- [x] **AUTH-03**: Backend authenticates protected routes via JWT Bearer authentication and enforces role-based access control.
- [x] **AUTH-04**: Session state persists across browser reloads via token storage in frontend client.

### Scheme Definition & Application Form
- [x] **SCHM-01**: User can fetch active scheme metadata and required fields via `/api/schemes/PM_KISAN/fields`.
- [x] **SCHM-02**: User can complete multi-section PM-KISAN form (Personal, Mobile OTP, Identity/Aadhaar, Bank, Land, Document Upload, Declarations).
- [x] **SCHM-03**: Frontend and backend validate mock OTP (`123456`), Aadhaar 12-digit format, bank account length, IFSC format, and required declarations.
- [x] **SCHM-04**: Backend hashes Aadhaar with salt into `aadhaar_ref` and stores masked representation (`aadhaar_masked`), never storing raw Aadhaar.

### Application Ingestion & File Storage
- [x] **APP-01**: User can upload land proof document (PDF, JPG, PNG <= 5MB) via multipart form-data.
- [x] **APP-02**: Backend safely validates file extension, file size, and stores files in `backend/uploads/` with unique timestamped names.
- [x] **APP-03**: Backend generates standard composite identifiers: `parcel_id` and `bank_account_ifsc_key`.
- [x] **APP-04**: Backend creates persistent `applications` and `pm_kisan_application_details` records in SQLite.
- [x] **APP-05**: User receives immediate submission response with application ID, status, and citizen-friendly status message.

### Anomaly Detection Pipeline
- [x] **ENG-01**: Identity Engine evaluates mock e-KYC status, OTP verification, duplicate Aadhaar across accounts, and bulk mobile usage.
- [x] **ENG-02**: Land Engine evaluates parcel existence in `land_records_master`, owner Aadhaar match, fuzzy owner name match, non-agricultural land flag, ownership active status, and area discrepancies.
- [x] **ENG-03**: Bank Engine evaluates IFSC validity, account active status, mock penny-drop status, bank account holder fuzzy name match, and multi-applicant shared bank accounts.
- [x] **ENG-04**: Exclusion Engine matches applicant `aadhaar_ref` against `exclusion_master` for taxpayers, government employees, pensioners, professionals, institutional landholders, and deceased status.
- [x] **ENG-05**: Duplicate Parcel Engine detects cross-application multiple claims on identical land parcels and flags syndicate patterns.
- [x] **ENG-06**: Statistical & Geographic Engine identifies abnormal application density in villages compared to historical cultivator baselines.
- [x] **ENG-07**: Temporal Spike Engine detects abnormal submission surges in districts preceding key scheme milestone dates (installment payouts).

### Risk Scoring, Confidence & Explainability
- [ ] **RISK-01**: Risk Scorer computes cumulative weighted severity score (capped at 0-100) from all triggered anomaly flags.
- [ ] **RISK-02**: Confidence Engine dynamically assigns `High`, `Medium`, or `Low` based on deterministic evidence strength and score thresholds.
- [ ] **RISK-03**: Rationale Generator synthesizes clear, human-readable plain-English explanation of why the application was flagged.
- [ ] **RISK-04**: Application status is automatically mapped based on risk score tier (`AUTO_CLEARED`, `UNDER_REVIEW`, `ACTION_REQUIRED`, `FIELD_VERIFICATION`, `PAYMENT_HELD`).

### Farmer Applicant Portal
- [ ] **FARM-01**: Farmer can view dashboard with list of submitted applications and status badges.
- [ ] **FARM-02**: Farmer can view detailed application progress with masked PII and official government guidance notes.
- [ ] **FARM-03**: Farmer detail view strictly redacts risk score, anomaly codes, and internal fraud rationale.

### Admin Anomaly Review Console
- [ ] **ADM-01**: Admin dashboard displays KPI summary metrics (total applications, high/medium/low risk counts, pending reviews, top anomaly flags).
- [ ] **ADM-02**: Admin dashboard renders interactive charts for risk distribution, anomaly frequencies, and geographic concentration.
- [ ] **ADM-03**: Admin can view, filter (by risk tier, status, district, village), and sort applications table by risk score.
- [ ] **ADM-04**: Admin can inspect full anomaly dossier: applicant profile, scheme details, risk report, individual anomaly flags with score weights, and raw evidence JSON.
- [ ] **ADM-05**: Admin can execute decision actions (`APPROVE`, `HOLD`, `REJECT`, `REQUEST_DOCUMENTS`, `ESCALATE`) with mandatory remarks, updating application status.
- [ ] **ADM-06**: Admin actions are immutably logged to `audit_logs` table, and filtered applications can be exported to CSV.

### Seed Dataset & Demo Verification
- [ ] **SEED-01**: Seeder script provisions admin user (`admin@pmkisan.gov.in`) and farmer user (`farmer@test.com`).
- [ ] **SEED-02**: Seeder provisions 20+ master records for land, bank validation, exclusion registries, village profiles, and calendar events.
- [ ] **SEED-03**: Seeder provisions 20 sample applications covering all risk tiers (10 Low Risk, 5 Medium Risk, 5 High Risk) and executes the anomaly pipeline on all.
- [ ] **SEED-04**: End-to-end verification script or demo flow validates both farmer submission and admin review workflows.

## v2 Requirements

- **NOTF-01**: Automated SMS/WhatsApp notifications to farmers regarding status updates and document requests.
- **SATE-01**: Integration with Sentinel/Bhuvan satellite imagery APIs for dynamic crop validation.
- **ML-01**: Isolation Forest unsupervised anomaly detection models trained on historical nationwide application clusters.
- **OCR-01**: Automatic OCR text extraction and signature verification on uploaded land deed PDF files.

## Out of Scope

| Feature | Reason |
|---|---|
| Live UIDAI Aadhaar biometric/OTP API | Requires live government NIC credentials and UIDAI AUA/KUA licensing; mock OTP and tokenization used for hackathon. |
| Production NPCI DBT payments | Direct fund transfer from public treasury requires PFMS credentials; mock validation used. |
| Native mobile application | Web-first responsive SPA provides optimal reach across devices without app store overhead. |

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| SCHM-01 | Phase 2 | Pending |
| SCHM-02 | Phase 2 | Pending |
| SCHM-03 | Phase 2 | Pending |
| SCHM-04 | Phase 2 | Pending |
| APP-01 | Phase 2 | Pending |
| APP-02 | Phase 2 | Pending |
| APP-03 | Phase 2 | Pending |
| APP-04 | Phase 2 | Pending |
| APP-05 | Phase 2 | Pending |
| ENG-01 | Phase 3 | Pending |
| ENG-02 | Phase 3 | Pending |
| ENG-03 | Phase 3 | Pending |
| ENG-04 | Phase 3 | Pending |
| ENG-05 | Phase 3 | Pending |
| ENG-06 | Phase 3 | Pending |
| ENG-07 | Phase 3 | Pending |
| RISK-01 | Phase 4 | Pending |
| RISK-02 | Phase 4 | Pending |
| RISK-03 | Phase 4 | Pending |
| RISK-04 | Phase 4 | Pending |
| FARM-01 | Phase 5 | Pending |
| FARM-02 | Phase 5 | Pending |
| FARM-03 | Phase 5 | Pending |
| ADM-01 | Phase 6 | Pending |
| ADM-02 | Phase 6 | Pending |
| ADM-03 | Phase 6 | Pending |
| ADM-04 | Phase 6 | Pending |
| ADM-05 | Phase 6 | Pending |
| ADM-06 | Phase 6 | Pending |
| SEED-01 | Phase 7 | Pending |
| SEED-02 | Phase 7 | Pending |
| SEED-03 | Phase 7 | Pending |
| SEED-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-19*  
*Last updated: 2026-09-19 after initial definition*
