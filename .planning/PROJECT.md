# KisanGuard Portal

## What This Is

KisanGuard Portal is a full-stack PM-KISAN scheme application portal and admin anomaly detection system designed for HackSpora 2.0 (Problem Statement 3: AI Driven Fraud and Anomaly Detection). It enables genuine farmers to register, verify identity (OTP, Aadhaar tokenization, mock e-KYC), submit land records and documents, and track application status, while running an automated multi-engine anomaly detection pipeline (Identity, Land, Bank, Exclusion, Duplicate Parcel, Statistical/Geographic, and Temporal Spikes) that computes a 0-100 risk score, confidence level, anomaly flags, and explainable rationale for scheme officers to review, hold, investigate, or approve.

## Core Value

Deterministic and statistical anomaly detection on agricultural subsidy applications that reliably flags fraudulent claims with high confidence and explainable rationale while keeping internal fraud scoring invisible to applicants.

## Business Context

- **Customer**: Ministry of Agriculture & Farmers Welfare / Scheme Officers & Indian Farmers
- **Domain**: PM-KISAN (Pradhan Mantri Kisan Samman Nidhi) DBT Scheme
- **Success Metric**: 100% detection rate on seeded synthetic fraud patterns with zero raw Aadhaar leaks and explainable audit trail
- **Target Event**: HackSpora 2.0 Hackathon

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Farmer registration, authentication (JWT, bcrypt), and profile management
- [ ] Multi-section PM-KISAN application form (Personal, OTP verification, Identity/Aadhaar tokenization, Bank details, Land details, Document upload, Self-declaration)
- [x] Secure file storage for land ownership documents (PDF, JPG, PNG <= 5MB)
- [x] 8 modular anomaly detection engines:
  - Identity Engine (e-KYC failure, OTP unverified, duplicate Aadhaar, mobile bulk usage)
  - Land Engine (missing parcel, owner Aadhaar mismatch, owner fuzzy name mismatch, non-agricultural land, inactive ownership, area mismatch)
  - Bank Engine (invalid IFSC, inactive account, penny drop failed, bank name fuzzy mismatch, shared bank account)
  - Exclusion Engine (income tax payee, government employee, pensioner, practicing professional, institutional landholder, deceased applicant)
  - Duplicate Parcel Engine (same parcel + same mobile, multiple applicants per parcel, syndicate claims)
  - Statistical & Geographic Engine (abnormal application volume per village vs historical baseline)
  - Temporal Spike Engine (application surges prior to installment release or cutoff dates)
  - Isolation Forest Machine Learning Engine (unsupervised multivariate outlier detection across joint distributions of land area, discrepancy %, age, fuzzy name scores, and density)
- [x] Decoupled Risk scoring (0-100 threat severity), Confidence assessment (0-100% evidential certainty), and human-readable explainable rationale generator
- [x] Officer Final Decision workflow (APPROVE, HOLD, REJECT, REQUEST_DOCUMENTS, ESCALATE) with mandatory written remarks and audit logging — no automatic clearance or disbursement
- [x] Synthetic Ground-Truth Evaluation Service benchmarking Precision, Recall, F1-Score, Confusion Matrix, Specificity, and FPR
- [ ] Farmer applicant dashboard displaying status and user-facing action messages (without exposing internal risk scores)
- [ ] Admin Anomaly Review Dashboard with KPI summary, risk score sorting, status/district filtering, full anomaly report view, evidence inspector, and decision workflow
- [ ] Audit logging for all administrative decisions and remarks
- [ ] CSV export of anomaly reports and flagged applications
- [ ] Comprehensive seed data generator (Admin, normal user, 20+ land records, bank master, exclusion master, village profile master, event calendar, and 20 sample applications covering all risk tiers)

### Out of Scope

- Real UIDAI / Aadhaar OTP API integration — Mock OTP (123456) and mock e-KYC consent used for hackathon MVP.
- Real NPCI / PFMS bank DBT payout execution — Mock penny-drop and bank validation master data used.
- Production satellite imagery analysis — Non-agricultural land flags derived from land records master database.
- Mobile native apps (iOS / Android) — Responsive web application (Vite + React + Tailwind CSS) prioritized.

## Context

- HackSpora 2.0 Problem Statement 3 requires AI-driven fraud and anomaly detection with clear confidence scores, transparent rationale, and objective evaluation.
- PM-KISAN provides ₹6,000/year in 3 installments to landholding farmer families, subject to strict exclusion criteria (taxpayers, constitutional post holders, institutional land).
- High-profile anomalies in real-world PM-KISAN deployments include shared bank accounts, ineligible taxpayers, duplicate claims on single land parcels, and sudden surges in applications before installment releases.
- Technical stack: FastAPI + SQLite + SQLAlchemy + Pydantic (Backend); React + Vite + Tailwind CSS + Lucide Icons (Frontend); thefuzz + scikit-learn for fuzzy matching and statistical checks.

## Constraints

- **Privacy**: Raw 12-digit Aadhaar numbers must never be persisted; only salted SHA-256 hashes (`aadhaar_ref`) and masked representations (`aadhaar_masked`, e.g., `XXXX-XXXX-1234`) are stored.
- **Role Isolation**: Farmers must never see risk scores, anomaly codes, or internal rationale; only sanitized status messages are visible to applicants.
- **Evaluation**: Seed dataset must include deterministic test cases for all 7 anomaly engines to guarantee reproducible live demo verification.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SQLite for MVP | Zero-configuration local database, fast seeding, self-contained for hackathon demo | ✓ Good |
| FastAPI Backend | High performance, automatic OpenAPI documentation, clean async support, type safety with Pydantic | ✓ Good |
| Vite + React + Tailwind CSS | Modern, fast development and crisp government-grade UI styling with responsive dashboards | ✓ Good |
| Modular Anomaly Engines | Clean separation of concerns; each engine evaluates specific domain rules and returns structured flags + evidence | ✓ Good |
| Salted SHA-256 Aadhaar Tokenization | Strict compliance with Indian data protection norms while allowing exact matching for duplicate and exclusion detection | ✓ Good |
| Synchronous Inline Engine Execution | Run all 7 engines in-request (<200ms) to ensure instant response without polling complexity | ✓ Good |
| Demo Quick-Fill Presets | Floating toolbar with 1-click test scenarios + auto-attached mock deed PDF for rapid evaluator testing | ✓ Good |
| Auto-Seed on Startup | Automatically populate master tables and 20 sample applications on startup if database is unseeded | ✓ Good |
| Indian DPI Theme with EN/HI Toggle | National Informatics Centre (NIC) styling (Navy Blue/Saffron/Green) with English/Hindi toggle | ✓ Good |
| Unified One-Click Dev Runner | Provide start.ps1 and start.bat to launch backend (8000) and frontend (5173) together | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-19 after initialization*
