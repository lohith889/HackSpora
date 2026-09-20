# State: KisanGuard Portal

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-19)

**Core value:** Deterministic and statistical anomaly detection on agricultural subsidy applications that reliably flags fraudulent claims with high confidence and explainable rationale while keeping internal fraud scoring invisible to applicants.  
**Current focus:** Phase 8 Complete — Supervised XGBoost Calibration & TreeSHAP Verified ✓  
**Status:** All 8 Phases Complete ✓

## Progress

- **Phases:** 8 of 8 completed
- **v1 Requirements:** 39 of 39 verified (34 core + 5 XGBoost)
- **Current Phase:** None (All Phases Verified)

## Phase Breakdown

- [x] **Phase 1: Foundation & Authentication** — Backend setup, SQLite/SQLAlchemy schemas, JWT auth & RBAC
- [x] **Phase 2: Scheme & Application Ingestion** — PM-KISAN form handling, document uploads, salted Aadhaar hashing
- [x] **Phase 3: Modular Anomaly Detection Engines** — 8 detection engines (Identity, Land, Bank, Exclusion, Duplicate, Statistical, Temporal, Isolation Forest ML, Graph)
- [x] **Phase 4: Risk Scoring, Decoupled Confidence, Officer Final Decision & Evaluation** — Weighted risk scoring (0-100), decoupled confidence (0-100%), Officer Final Decision gating, explainable rationale, synthetic ground-truth Precision/Recall/F1 benchmark
- [x] **Phase 5: Farmer Application Portal UI** — Farmer React UI, multi-section application form, status tracker
- [x] **Phase 6: Admin Anomaly Review Console UI** — Officer review dashboard, charts, anomaly dossier inspector, decision actions
- [x] **Phase 7: Master Seed Data & Live Demo Verification** — Realistic seed fixtures (20 apps, master records) & automated test suite
- [x] **Phase 8: Supervised XGBoost Risk Calibration & SHAP Explainability Engine** — 24-dim feature extractor, 2-stage hybrid scoring, strict statutory override ($Risk=100$), native TreeSHAP (<2ms), Dual Risk Meters, SHAP horizontal bar chart, ML surge badging and filtering

---
*Last updated: 2026-09-20 upon Phase 8 completion*
