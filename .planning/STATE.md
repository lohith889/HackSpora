# State: KisanGuard Portal

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-19)

**Core value:** Deterministic and statistical anomaly detection on agricultural subsidy applications that reliably flags fraudulent claims with high confidence and explainable rationale while keeping internal fraud scoring invisible to applicants.  
**Current focus:** Phase 5: Farmer Application Portal UI  
**Status:** In Progress (Phases 1, 2, 3 & 4 Complete ✓)

## Progress

- **Phases:** 4 of 7 completed
- **v1 Requirements:** 28 of 37 verified
- **Current Phase:** Phase 5 (Farmer Application Portal UI)

## Phase Breakdown

- [x] **Phase 1: Foundation & Authentication** — Backend setup, SQLite/SQLAlchemy schemas, JWT auth & RBAC
- [x] **Phase 2: Scheme & Application Ingestion** — PM-KISAN form handling, document uploads, salted Aadhaar hashing
- [x] **Phase 3: Modular Anomaly Detection Engines** — 8 detection engines (Identity, Land, Bank, Exclusion, Duplicate, Statistical, Temporal, Isolation Forest ML)
- [x] **Phase 4: Risk Scoring, Decoupled Confidence, Officer Final Decision & Evaluation** — Weighted risk scoring (0-100), decoupled confidence (0-100%), Officer Final Decision gating, explainable rationale, synthetic ground-truth Precision/Recall/F1 benchmark
- [ ] **Phase 5: Farmer Application Portal UI** — Farmer React UI, multi-section application form, status tracker
- [ ] **Phase 6: Admin Anomaly Review Console UI** — Officer review dashboard, charts, anomaly dossier inspector, decision actions
- [ ] **Phase 7: Master Seed Data & Live Demo Verification** — Realistic seed fixtures (20 apps, master records) & automated test suite

---
*Last updated: 2026-09-19 after project initialization*
