# State: KisanGuard Portal

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-19)

**Core value:** Deterministic and statistical anomaly detection on agricultural subsidy applications that reliably flags fraudulent claims with high confidence and explainable rationale while keeping internal fraud scoring invisible to applicants.  
**Current focus:** All 9 Phases Completed — Production Ready for HackSpora 2.0 Evaluation  
**Status:** Complete ✓ (All 9 Phases Delivered)

## Progress

- **Phases:** 9 of 9 completed (100%)
- **v1 Requirements:** 44 of 44 verified (34 core + 5 XGBoost + 5 Land Document OCR)
- **Current Phase:** Phase 9 (Land Document OCR & Automated ID Verification) Complete ✓

## Phase Breakdown

- [x] **Phase 1: Foundation & Authentication** — Backend setup, SQLite/SQLAlchemy schemas, JWT auth & RBAC
- [x] **Phase 2: Scheme & Application Ingestion** — PM-KISAN form handling, document uploads, salted Aadhaar hashing
- [x] **Phase 3: Modular Anomaly Detection Engines** — 8 detection engines (Identity, Land, Bank, Exclusion, Duplicate, Statistical, Temporal, Isolation Forest ML, Graph)
- [x] **Phase 4: Risk Scoring, Decoupled Confidence, Officer Final Decision & Evaluation** — Weighted risk scoring (0-100), decoupled confidence (0-100%), Officer Final Decision gating, explainable rationale, synthetic ground-truth Precision/Recall/F1 benchmark
- [x] **Phase 5: Farmer Application Portal UI** — Farmer React UI, multi-section application form, status tracker
- [x] **Phase 6: Admin Anomaly Review Console UI** — Officer review dashboard, charts, anomaly dossier inspector, decision actions
- [x] **Phase 7: Master Seed Data & Live Demo Verification** — Realistic seed fixtures (20 apps, master records) & automated test suite
- [x] **Phase 8: Supervised XGBoost Risk Calibration & SHAP Explainability Engine** — 24-dim feature extractor, 2-stage hybrid scoring, strict statutory override ($Risk=100$), native TreeSHAP (<2ms), Dual Risk Meters, SHAP horizontal bar chart, ML surge badging and filtering
- [x] **Phase 9: Land Document OCR & Automated ID Verification** — Offline multi-format OCR (`pymupdf`/`easyocr`), Land Document/Parcel ID entity parsing, cross-reconciliation, `LAND_DOC_ID_MISMATCH` anomaly flag, and Admin Land Deed OCR Dossier UI

---
*Last updated: 2026-09-20 upon Phase 9 execution and verification completion*
