# Roadmap: KisanGuard Portal

**Goal:** Build a production-grade full-stack PM-KISAN application portal and AI-driven anomaly review system with 7 modular detection engines, explainable risk scoring, and zero-leak citizen privacy for HackSpora 2.0.

## Overview

- [x] Phase 1: Foundation & Authentication
- [ ] Phase 2: Scheme & Application Ingestion
- [ ] Phase 3: Modular Anomaly Detection Engines
- [ ] Phase 4: Risk Scoring & Explainability Engine
- [ ] Phase 5: Farmer Application Portal UI
- [ ] Phase 6: Admin Anomaly Review Console UI
- [ ] Phase 7: Master Seed Data & Live Demo Verification

| Phase | Name | Goal | Requirements | Criteria |
|---|---|---|---|---|
| 1 | Foundation & Authentication | Establish FastAPI backend, database models, and secure JWT/bcrypt authentication with RBAC | AUTH-01, AUTH-02, AUTH-03, AUTH-04 | 4 |
| 2 | Scheme & Application Ingestion | Provide scheme field specifications, process multipart application submissions with land documents, tokenize Aadhaar numbers with salt, and persist applications | SCHM-01, SCHM-02, SCHM-03, SCHM-04, APP-01, APP-02, APP-03, APP-04, APP-05 | 5 |
| 3 | Modular Anomaly Detection Engines | Construct all 7 anomaly detection engines: Identity, Land, Bank, Exclusion, Duplicate Parcel, Statistical/Geographic, and Temporal Spikes | ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06, ENG-07 | 7 |
| 4 | Risk Scoring & Explainability Engine | Implement weighted risk scoring (0-100), confidence level logic, natural language rationale generator, and automated status mapper | RISK-01, RISK-02, RISK-03, RISK-04 | 4 |
| 5 | Farmer Application Portal UI | Build responsive React frontend for farmer authentication, multi-step application form with OTP & document upload, and citizen status tracker | FARM-01, FARM-02, FARM-03 | 3 |
| 6 | Admin Anomaly Review Console UI | Build administrative dashboard with KPI metrics, distribution charts, searchable applications table, deep anomaly dossier modal, officer decision workflow, and CSV export | ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06 | 6 |
| 7 | Master Seed Data & Live Demo Verification | Provision realistic seed datasets (users, master registries, 20 diverse risk applications) and run end-to-end verification tests | SEED-01, SEED-02, SEED-03, SEED-04 | 4 |

---

## Phase Details

### Phase 1: Foundation & Authentication
**Goal:** Establish the FastAPI project architecture, SQLite SQLAlchemy models, Pydantic schemas, and JWT/bcrypt authentication system with role-based access control.  
**Mode:** mvp  
**Status:** Complete ✓  
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04  
**Success Criteria:**
1. User can register with name, email, mobile, DOB, gender, category, and password.
2. Passwords are securely hashed with bcrypt; JWT access token returned upon login.
3. Protected endpoints verify JWT Bearer tokens and enforce `USER` vs `ADMIN` role permissions.
4. Database tables for `users`, `applications`, `pm_kisan_application_details`, `anomaly_reports`, `anomaly_flags`, `master tables`, and `audit_logs` are initialized.

### Phase 2: Scheme & Application Ingestion
**Goal:** Provide scheme field specifications, process multipart application submissions with land documents, tokenize Aadhaar numbers with salt, and persist applications.  
**Mode:** mvp  
**Status:** Complete ✓  
**Requirements:** SCHM-01, SCHM-02, SCHM-03, SCHM-04, APP-01, APP-02, APP-03, APP-04, APP-05  
**Success Criteria:**
1. Endpoint `GET /api/schemes/PM_KISAN/fields` returns all required sections and validation constraints.
2. Endpoint `POST /api/applications/pm-kisan` accepts multipart form-data including form fields and land proof documents.
3. Raw Aadhaar is hashed with a secret salt into `aadhaar_ref`, masked to `aadhaar_masked`, and never stored in plaintext.
4. Composite keys `parcel_id` and `bank_account_ifsc_key` are computed automatically upon submission.
5. Uploaded documents are verified for MIME type, size <= 5MB, and stored in `backend/uploads/`.

### Phase 3: Modular Anomaly Detection Engines
**Goal:** Implement and test all 8 anomaly detection engines against applicant data and reference master tables.  
**Mode:** mvp  
**Status:** Complete ✓  
**Requirements:** ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06, ENG-07, ENG-08  
**Success Criteria:**
1. **Identity Engine** flags e-KYC failures, unverified OTP, duplicate Aadhaar numbers across applications, and bulk mobile phone reuse.
2. **Land Engine** queries `land_records_master` to flag non-existent parcels, owner Aadhaar mismatches, fuzzy owner name discrepancies, non-agricultural land use, inactive ownership, and declared area mismatches.
3. **Bank Engine** queries `bank_validation_master` to flag invalid IFSC codes, inactive accounts, failed penny-drops, name mismatches, and mule accounts shared across multiple applicants.
4. **Exclusion Engine** matches applicant `aadhaar_ref` against `exclusion_master` to flag income tax payees, government employees, pensioners, professionals, institutional landholders, and deceased records.
5. **Duplicate Parcel Engine** scans submitted applications to flag multiple applications claiming subsidies on the same parcel.
6. **Statistical Engine** calculates village-level application density against historical cultivator baselines and flags anomalous spikes (>1.75x medium, >2.5x high).
7. **Temporal Engine** compares district application volume within 48 hours preceding milestone dates in `event_calendar_master` against the 14-day baseline and flags surges (>3x medium, >5x high).
8. **Isolation Forest Engine** evaluates 6-dimensional feature vectors to detect unsupervised multivariate outliers and provides explainable contributing factor drivers.

### Phase 4: Risk Scoring, Decoupled Confidence, Officer Final Decision & Evaluation
**Goal:** Compute decoupled 0-100 risk scores and evidential confidence percentages, synthesize plain-English rationales, enforce Scheme Officer Final Decision gating, and benchmark Precision/Recall/F1 against synthetic ground truth.  
**Mode:** mvp  
**Status:** Complete ✓  
**Requirements:** RISK-01, RISK-02, RISK-03, RISK-04, RISK-05, EVAL-01, ADM-05, ADM-06  
**Success Criteria:**
1. Risk score is computed by summing weighted severity values of all triggered flags, capped at 100.
2. Confidence score (0-100%) and level (`High`, `Medium`, `Low`) are mathematically decoupled from risk to quantify evidential certainty and registry verification completeness.
3. Rationale generator outputs clear, structured natural language summary highlighting key anomaly drivers and evidence certainty.
4. Applications strictly require Scheme Officer Final Decision (`APPROVE`, `REJECT`, `HOLD`, `REQUEST_DOCUMENTS`, `ESCALATE`) with written remarks and immutable audit logging — no automatic approval or disbursement.
5. Comprehensive anomaly report is persisted in `anomaly_reports` and `anomaly_flags` tables.
6. Synthetic ground-truth evaluation service computes Precision, Recall, F1-Score, Confusion Matrix, Specificity, and FPR via `GET /api/admin/evaluation/metrics`.

### Phase 5: Farmer Application Portal UI
**Goal:** Build a user-friendly, responsive React frontend tailored for Indian farmers with authentication, a guided multi-section application form, and citizen status tracker.  
**Mode:** mvp  
**UI hint:** yes  
**Requirements:** FARM-01, FARM-02, FARM-03  
**Success Criteria:**
1. Farmer can register, log in, and view personal dashboard with application history cards.
2. Multi-section PM-KISAN application wizard validates personal info, OTP (mock `123456`), Aadhaar format, bank details, land parcel info, and handles document drag-and-drop.
3. Farmer detail view displays application status and official guidance without exposing internal risk scores, anomaly codes, or officer rationale.

### Phase 6: Admin Anomaly Review Console UI
**Goal:** Build a high-density, professional admin dashboard for scheme officers to monitor, filter, inspect, and take action on flagged applications.  
**Mode:** mvp  
**UI hint:** yes  
**Requirements:** ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06  
**Success Criteria:**
1. Admin overview renders KPI metric cards (Total, High/Med/Low Risk counts, Pending Reviews) and visual charts (risk distribution, top anomaly flags).
2. Filterable and sortable applications table allows officers to isolate high-risk cases by district, village, and status.
3. Detailed anomaly dossier modal displays full applicant data, risk score, confidence tag, natural language rationale, individual anomaly flags with weight badges, and raw evidence inspector.
4. Officers can execute decisions (`APPROVE`, `HOLD`, `REJECT`, `REQUEST_DOCUMENTS`, `ESCALATE`) with mandatory remarks, creating an immutable entry in `audit_logs`.
5. Data export functionality downloads filtered application reports as CSV.

### Phase 7: Master Seed Data & Live Demo Verification
**Goal:** Provision comprehensive demonstration fixtures and execute end-to-end verification across both user and administrative workflows.  
**Mode:** mvp  
**Requirements:** SEED-01, SEED-02, SEED-03, SEED-04  
**Success Criteria:**
1. Seeder populates admin credentials (`admin@pmkisan.gov.in` / `Admin@123`) and test farmer (`farmer@test.com` / `Farmer@123`).
2. Seeder populates 20+ records across `land_records_master`, `bank_validation_master`, `exclusion_master`, `village_profile_master`, and `event_calendar_master`.
3. Seeder creates 20 sample applications with pre-calculated anomaly reports distributed across Low (10), Medium (5), and High (5) risk tiers.
4. Automated verification test validates user registration, form submission, anomaly scoring, admin decision workflow, and role-based privacy boundaries.
