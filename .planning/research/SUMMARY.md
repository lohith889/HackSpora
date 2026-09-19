# Research Summary — KisanGuard Portal

## Executive Summary

KisanGuard Portal is engineered to address **HackSpora 2.0 Problem Statement 3: AI Driven Fraud and Anomaly Detection** within the domain of the PM-KISAN Direct Benefit Transfer (DBT) scheme.

### Key Conclusions & Architecture Choices:
1. **Frontend / Backend Decoupling**: FastAPI backend with SQLite provides lightning-fast execution and zero-friction setup for hackathon demos. Vite + React + Tailwind CSS provides an institutional, high-trust government UI.
2. **Deterministic & Statistical Fusion**: Rather than relying exclusively on opaque "black-box" neural networks, the solution combines deterministic cross-database validation (identity, land, bank, exclusion registries) with heuristic/statistical anomaly modeling (fuzzy matching, village density baselines, pre-payout temporal spikes). This yields 100% explainability, high officer confidence, and actionable evidence.
3. **Data Protection & User Experience**: Applicants experience a smooth, standard e-governance workflow with transparent status progress, while officers are equipped with a rich, data-dense anomaly triage console with full audit logging.
4. **Seed Scenarios for Demonstration**: A comprehensive seed generator guarantees that 20 representative applications (10 Low Risk, 5 Medium Risk, 5 High Risk) are immediately available for live demonstration, showcasing every anomaly engine in action.
