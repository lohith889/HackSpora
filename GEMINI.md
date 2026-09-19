<!-- GSD:project-start source:PROJECT.md -->

## Project

**KisanGuard Portal**

KisanGuard Portal is a full-stack PM-KISAN scheme application portal and admin anomaly detection system designed for HackSpora 2.0 (Problem Statement 3: AI Driven Fraud and Anomaly Detection). It enables genuine farmers to register, verify identity (OTP, Aadhaar tokenization, mock e-KYC), submit land records and documents, and track application status, while running an automated multi-engine anomaly detection pipeline (Identity, Land, Bank, Exclusion, Duplicate Parcel, Statistical/Geographic, and Temporal Spikes) that computes a 0-100 risk score, confidence level, anomaly flags, and explainable rationale for scheme officers to review, hold, investigate, or approve.

**Core Value:** Deterministic and statistical anomaly detection on agricultural subsidy applications that reliably flags fraudulent claims with high confidence and explainable rationale while keeping internal fraud scoring invisible to applicants.

### Constraints

- **Privacy**: Raw 12-digit Aadhaar numbers must never be persisted; only salted SHA-256 hashes (`aadhaar_ref`) and masked representations (`aadhaar_masked`, e.g., `XXXX-XXXX-1234`) are stored.
- **Role Isolation**: Farmers must never see risk scores, anomaly codes, or internal rationale; only sanitized status messages are visible to applicants.
- **Evaluation**: Seed dataset must include deterministic test cases for all 7 anomaly engines to guarantee reproducible live demo verification.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Core Technologies

| Layer | Technology | Version / Spec | Rationale |
|---|---|---|---|
| **Backend Framework** | FastAPI | >=0.110.0 | High performance async REST API, automatic interactive Swagger UI, typed validation with Pydantic v2 |
| **Web Server** | Uvicorn (standard) | >=0.28.0 | ASGI web server for FastAPI |
| **Database** | SQLite + SQLAlchemy | SQLAlchemy >=2.0 | Lightweight, zero-config relational database for hackathon demo; relational schema with foreign keys and indexes |
| **Data Validation** | Pydantic | >=2.6.0 | Request/response schema definitions, field validation, type coercions |
| **Authentication** | python-jose & passlib[bcrypt] | bcrypt >=4.0, jose >=3.3.0 | Secure password hashing, JWT creation/decoding with expiry and role claims |
| **Data Science / ML** | thefuzz (fuzzy matching), scikit-learn, pandas, numpy | current | Robust fuzzy string matching for Hindi/English farmer name verification vs land & bank records; statistical aggregation |
| **Multipart & Uploads** | python-multipart | >=0.0.9 | Handling multipart/form-data for land document uploads |
| **Frontend Framework** | React 18 + Vite | Vite >=5.0, React >=18.2 | Fast HMR, minimal build overhead, robust component ecosystem |
| **Styling** | Tailwind CSS | >=3.4.0 | Clean, accessible, modern UI aligned with Indian government portal aesthetics (e.g. NIC/Digital India blue/saffron/green motifs) |
| **Icons & Visuals** | Lucide React | >=0.350.0 | High quality SVG icons for verification badges, status alerts, file uploads |
| **Charts** | Recharts | >=2.12.0 | Responsive charts for admin risk distribution, top anomalies, and geographic concentration |
| **HTTP Client** | Axios | >=1.6.0 | Clean interceptors for JWT injection and error handling |

## What NOT to Use and Why

- **MongoDB / NoSQL**: Relational joins between `applications`, `pm_kisan_details`, `land_records_master`, `bank_validation_master`, and `exclusion_master` are essential for fast cross-table fraud detection.
- **External Cloud Storage (S3/GCS)**: Local storage in `backend/uploads/` ensures 100% offline hackathon evaluation with zero external cloud dependencies.
- **Complex Microservices**: Monolithic FastAPI backend prevents network latency and deployment failure during demo evaluations.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.agents/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
