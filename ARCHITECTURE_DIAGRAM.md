# KisanGuard Portal — Full Architecture Diagram & System Design

**Project**: KisanGuard Portal  
**Domain**: PM-KISAN Scheme Application & AI-Driven Anomaly Detection System  
**Hackathon**: HackSpora 2.0 (Problem Statement 3: AI Driven Fraud and Anomaly Detection)  

---

## 1. High-Level System Topology

```mermaid
flowchart TD
    subgraph Clients["Client Layer (Browser)"]
        FarmerUI["Farmer Applicant Portal\n(React 18 + Vite + Tailwind CSS)\n- Register / Login\n- Multi-step PM-KISAN Form\n- OTP Verification\n- Document Upload\n- Citizen Status View"]
        AdminUI["Admin Review Console\n(React 18 + Vite + Recharts)\n- KPI Overview & Charts\n- Risk-Sorted Application Grid\n- Anomaly Dossier Inspector\n- Officer Decision Console\n- Audit Log Viewer & CSV Export"]
    end

    subgraph Gateway["API Gateway & Security Layer"]
        FastAPI["FastAPI Application Server (Port 8000)"]
        JWTAuth["JWT Authentication & RBAC Guard\n- Role: USER vs ADMIN\n- bcrypt Password Verifier\n- PII Redaction Filter"]
    end

    subgraph CoreServices["Backend Service Layer"]
        AppService["Application Ingestion Service\n- Form Validation\n- Salted SHA-256 Aadhaar Tokenizer\n- Derived Parcel ID Generator\n- Derived Bank Key Generator"]
        FileService["Document Storage Service\n- MIME & Size Validation (<= 5MB)\n- Safe Local Persistence (backend/uploads/)"]
        AnomalyOrchestrator["Anomaly Engine Orchestrator\n- Pipeline Dispatcher\n- Risk Scorer (0-100)\n- Confidence Classifier\n- Explainable Rationale Generator"]
    end

    subgraph AnomalyEngines["7-Engine Anomaly Detection Pipeline"]
        E1["1. Identity Engine\n- e-KYC status\n- OTP check\n- Duplicate Aadhaar\n- Bulk mobile reuse"]
        E2["2. Land Records Engine\n- Missing parcel\n- Owner Aadhaar match\n- Fuzzy name ratio\n- Non-agricultural check\n- Inactive title status"]
        E3["3. Bank Validation Engine\n- Invalid IFSC\n- Inactive account\n- Failed penny drop\n- Name mismatch\n- Mule shared accounts"]
        E4["4. Ineligibility / Exclusion Engine\n- Income tax payee\n- Government employee\n- Pensioner > 10k\n- Professional\n- Institutional land\n- Deceased check"]
        E5["5. Duplicate Parcel Engine\n- Multi-claim on parcel\n- Syndicate mobile reuse\n- Over-claimed plot (>3)"]
        E6["6. Statistical & Geographic Engine\n- Village application density\n- Baseline ratio (>1.75x, >2.5x)"]
        E7["7. Temporal Spike Engine\n- Pre-event surge (48h)\n- Payout deadline spike (>3x, >5x)"]
    end

    subgraph DataStorage["Data Persistence Layer"]
        SQLiteDB[("SQLite Database (SQLAlchemy 2.0)\n- users\n- applications\n- pm_kisan_application_details\n- anomaly_reports\n- anomaly_flags\n- audit_logs\n- land_records_master\n- bank_validation_master\n- exclusion_master\n- village_profile_master\n- event_calendar_master")]
        UploadsDir[("Local File Storage\nbackend/uploads/\n- Encrypted land documents\n- application_{id}_{timestamp}.pdf")]
    end

    FarmerUI -->|HTTPS / REST API| FastAPI
    AdminUI -->|HTTPS / REST API| FastAPI
    FastAPI --> JWTAuth
    JWTAuth --> AppService
    AppService --> FileService
    FileService --> UploadsDir
    AppService --> SQLiteDB
    AppService --> AnomalyOrchestrator
    AnomalyOrchestrator --> E1 & E2 & E3 & E4 & E5 & E6 & E7
    E1 & E2 & E3 & E4 & E5 & E6 & E7 --> SQLiteDB
    AnomalyOrchestrator --> SQLiteDB
```

---

## 2. End-to-End Application Ingestion & Scoring Flow

```mermaid
sequenceDiagram
    autonumber
    actor Farmer as Farmer / Applicant
    participant UI as React Frontend
    participant API as FastAPI Backend
    participant Storage as backend/uploads/
    participant DB as SQLite DB
    participant Engine as Anomaly Pipeline

    Farmer->>UI: Fills PM-KISAN Form (Personal, OTP, Aadhaar, Bank, Land, Declaration)
    Farmer->>UI: Uploads Land Document (PDF/JPG <= 5MB)
    Farmer->>UI: Clicks "Submit Application"
    UI->>UI: Client validation (12-digit Aadhaar, IFSC, OTP = 123456)
    UI->>API: POST /api/applications/pm-kisan (multipart/form-data + JWT)
    
    API->>API: Verify JWT Bearer token
    API->>API: Validate form constraints & file size/MIME
    API->>API: Hash Aadhaar: aadhaar_ref = SHA256(raw + SALT)
    API->>API: Mask Aadhaar: aadhaar_masked = XXXX-XXXX-1234
    API->>API: Generate parcel_id and bank_account_ifsc_key
    API->>Storage: Save file to backend/uploads/application_{id}_{ts}.ext
    
    API->>DB: INSERT into applications (status = SUBMITTED)
    API->>DB: INSERT into pm_kisan_application_details
    
    API->>Engine: run_anomaly_engine(application_id, db)
    Engine->>DB: Query master registries (land, bank, exclusion, village, events)
    Engine->>Engine: Run 7 modular anomaly detection engines
    Engine->>Engine: Compute weighted risk score (0-100)
    Engine->>Engine: Determine confidence level (High / Medium / Low)
    Engine->>Engine: Synthesize plain-English explainable rationale
    Engine->>DB: INSERT into anomaly_reports & anomaly_flags
    Engine->>DB: UPDATE applications SET status = mapped_status, risk_score, confidence
    
    API-->>UI: Return 201 Created (application_id, status, citizen_message)
    Note over UI: Risk score and fraud flags are STRICTLY REDACTED for Farmer
    UI-->>Farmer: Displays application confirmation & official tracking status
```

---

## 3. Modular Anomaly Pipeline & Risk Scoring Flow

```mermaid
flowchart TD
    AppInput["Submitted PM-KISAN Application\n(Personal, Tokenized Aadhaar, Land, Bank, Upload)"] --> EngineDispatch["Anomaly Orchestrator"]

    subgraph MasterData["Master Verification Registries"]
        M_Land[("land_records_master\n(Revenue Titles, Area, Land Use)")]
        M_Bank[("bank_validation_master\n(Penny Drop, Active Status, IFSC)")]
        M_Exclusion[("exclusion_master\n(Taxpayer, Govt, Pension, Deceased)")]
        M_Village[("village_profile_master\n(Cultivator Baseline Count)")]
        M_Events[("event_calendar_master\n(Installment Payout Dates)")]
        M_ExistingApps[("Historical Applications Table\n(Cross-Application Tracking)")]
    end

    EngineDispatch --> E1["Identity Engine"]
    EngineDispatch --> E2["Land Records Engine"]
    EngineDispatch --> E3["Bank Validation Engine"]
    EngineDispatch --> E4["Exclusion Engine"]
    EngineDispatch --> E5["Duplicate Parcel Engine"]
    EngineDispatch --> E6["Statistical/Geographic Engine"]
    EngineDispatch --> E7["Temporal Spike Engine"]

    M_ExistingApps -.-> E1 & E5 & E6 & E7
    M_Land -.-> E2
    M_Bank -.-> E3
    M_Exclusion -.-> E4
    M_Village -.-> E6
    M_Events -.-> E7

    E1 -->|"ID_EKYC_FAILED (35)\nID_OTP_NOT_VERIFIED (25)\nID_DUPLICATE_AADHAAR (45)\nID_MOBILE_BULK_USAGE (15-30)"| FlagCollector["Anomaly Flag Collector\n(Flags + Contributing Scores + Evidence JSON)"]
    E2 -->|"LAND_RECORD_MISSING (40)\nLAND_OWNER_AADHAAR_MISMATCH (45)\nLAND_OWNER_NAME_MISMATCH (15-30)\nLAND_NOT_AGRICULTURAL (45)\nLAND_OWNERSHIP_INACTIVE (30)\nLAND_AREA_MISMATCH (20)"| FlagCollector
    E3 -->|"BANK_IFSC_INVALID (35)\nBANK_ACCOUNT_INACTIVE (35)\nBANK_PENNY_DROP_FAILED (25)\nBANK_NAME_MISMATCH (15-30)\nBANK_ACCOUNT_SHARED (35)"| FlagCollector
    E4 -->|"EXCLUSION_TAXPAYER (50)\nEXCLUSION_GOVT_EMPLOYEE (50)\nEXCLUSION_PENSIONER (45)\nEXCLUSION_PROFESSIONAL (45)\nEXCLUSION_INSTITUTIONAL (50)\nEXCLUSION_DECEASED (50)"| FlagCollector
    E5 -->|"DUPLICATE_PARCEL_BENEFIT (40)\nSAME_PARCEL_MULTIPLE_APPLICANTS (20)\nPARCEL_OVER_CLAIMED (45)"| FlagCollector
    E6 -->|"GEO_ABNORMAL_CONCENTRATION (20-30)\n(Ratio > 1.75x / > 2.5x)"| FlagCollector
    E7 -->|"TIME_PRE_EVENT_SPIKE (25-35)\n(Pre-payout Surge > 3x / > 5x)"| FlagCollector

    FlagCollector --> RiskCalc["Risk Scoring Formula\nRisk Score = min(100, Sum of Weights)"]
    FlagCollector --> ConfCalc["Confidence Classifier\n- High: Deterministic flag OR Score >= 80\n- Medium: Heuristic flags OR Score >= 50\n- Low: Weak signals OR Score < 50"]
    FlagCollector --> RatGen["Natural Language Rationale Generator\n(Generates plain-English summary of core flags)"]

    RiskCalc & ConfCalc & RatGen --> ReportBuilder["Anomaly Report Assembly"]
    ReportBuilder --> StatusMapper{"Automatic Status Mapping"}

    StatusMapper -->|"Score 0-24"| S1["AUTO_CLEARED\n'Initial checks passed'"]
    StatusMapper -->|"Score 25-49"| S2["UNDER_REVIEW\n'Routine verification'"]
    StatusMapper -->|"Score 50-74"| S3["ACTION_REQUIRED\n'Additional document verification required'"]
    StatusMapper -->|"Score 75-89"| S4["FIELD_VERIFICATION\n'Field verification required'"]
    StatusMapper -->|"Score 90-100"| S5["PAYMENT_HELD\n'Detailed verification on hold'"]
```

---

## 4. Privacy Boundary & Role-Based Response Isolation

```mermaid
flowchart LR
    subgraph CoreBackend["FastAPI Backend Endpoint: GET /api/applications/{id}"]
        Req["Incoming Request with JWT"] --> AuthCheck{"Inspect Role Claim"}
    end

    subgraph UserView["USER Role (Farmer Applicant)"]
        F_Allowed["Allowed Data:\n- application_id\n- scheme_code\n- status badge\n- submitted_at\n- user_message (Official citizen guidance)\n- aadhaar_masked (XXXX-XXXX-1234)\n- bank_account_masked (XXXX1234)\n- uploaded_document_name"]
        F_Redacted["STRICTLY BLOCKED & REDACTED:\n- risk_score\n- confidence_level\n- recommended_action\n- anomaly_flags\n- contributing scores\n- fraud rationale\n- raw investigation evidence"]
    end

    subgraph AdminView["ADMIN Role (Scheme Officer)"]
        A_Allowed["Complete Anomaly Dossier:\n- Complete applicant & PM-KISAN fields\n- Risk Score (0-100) & Severity Gauge\n- Confidence Tag (High / Medium / Low)\n- Plain-English Explainable Rationale\n- Recommended Officer Action\n- Individual Anomaly Flags & Weight Badges\n- Raw Cross-Table Evidence JSON\n- Document Preview & Metadata\n- Audit Log History & Decision Controls"]
    end

    AuthCheck -->|"role == 'USER'\n(Verify current_user.id == app.user_id)"| UserView
    AuthCheck -->|"role == 'ADMIN'"| AdminView
```

---

## 5. Database Entity-Relationship Diagram

```mermaid
erDiagram
    users ||--o{ applications : "submits"
    users ||--o{ audit_logs : "records_officer_action"
    applications ||--|| pm_kisan_application_details : "contains_scheme_data"
    applications ||--|| anomaly_reports : "has_risk_assessment"
    applications ||--o{ anomaly_flags : "triggers"
    applications ||--o{ audit_logs : "tracks_decisions"

    users {
        int id PK
        string email UK
        string password_hash
        string full_name
        string mobile_number
        date date_of_birth
        string gender
        string category
        string role "USER or ADMIN"
        datetime created_at
    }

    applications {
        int id PK
        int user_id FK
        string scheme_code "PM_KISAN"
        string status "SUBMITTED, AUTO_CLEARED, UNDER_REVIEW, etc."
        int risk_score "0-100"
        string confidence_level "Low, Medium, High"
        string recommended_action
        datetime submitted_at
        datetime created_at
    }

    pm_kisan_application_details {
        int id PK
        int application_id FK,UK
        string farmer_name
        date date_of_birth
        string gender
        string mobile_number
        boolean otp_verified
        string aadhaar_ref "Salted SHA-256 Hash"
        string aadhaar_masked "XXXX-XXXX-1234"
        string bank_account_number
        string ifsc_code
        string state_code
        string district_code
        string tehsil_code
        string village_code
        string khata_number
        string plot_number
        float declared_land_area_ha
        string ownership_type
        string land_document_path
        boolean self_declaration
        boolean e_kyc_consent
        boolean e_kyc_status
        string parcel_id "Derived: S-D-T-V-K-P"
        string bank_account_ifsc_key "Derived: Acc-IFSC"
    }

    anomaly_reports {
        int id PK
        int application_id FK,UK
        int risk_score "0-100"
        string confidence_level "Low, Medium, High"
        string recommended_action
        text rationale
        datetime created_at
    }

    anomaly_flags {
        int id PK
        int application_id FK
        string anomaly_code
        string severity "Low, Medium, High"
        int score "Contributing weight"
        text rationale
        json evidence_json
        datetime created_at
    }

    land_records_master {
        int id PK
        string parcel_id UK
        string state_code
        string district_code
        string tehsil_code
        string village_code
        string khata_number
        string plot_number
        string owner_aadhaar_ref
        string owner_name
        float land_area_ha
        string land_use_code
        boolean agricultural_land_flag
        string ownership_status "ACTIVE, DISPUTED, INACTIVE"
        string title_status
    }

    bank_validation_master {
        int id PK
        string bank_account_ifsc_key UK
        string bank_account_number
        string ifsc_code
        string account_holder_name
        string account_status "ACTIVE, INACTIVE, CLOSED, FROZEN"
        boolean ifsc_valid
        string penny_drop_status "SUCCESS, FAILED, NOT_DONE"
        float name_match_score
    }

    exclusion_master {
        int id PK
        string aadhaar_ref UK
        boolean taxpayer_flag
        boolean govt_employee_flag
        boolean pensioner_flag
        boolean professional_flag
        boolean institutional_landholder_flag
        boolean deceased_flag
    }

    village_profile_master {
        int id PK
        string village_code UK
        string district_code
        string tehsil_code
        string village_name
        int historical_beneficiary_count
        int cultivator_count_estimate
    }

    event_calendar_master {
        int id PK
        string district_code
        string event_type "installment_release, cutoff"
        date event_date
        string description
    }

    audit_logs {
        int id PK
        int application_id FK
        int admin_id FK
        string action "APPROVE, HOLD, REJECT, REQUEST_DOCUMENTS, ESCALATE"
        text remarks
        datetime created_at
    }
```

---

## 6. Admin Triage & Adjudication Lifecycle

```mermaid
stateDiagram-v2
    [*] --> ApplicationSubmitted: Farmer Submits Application
    
    ApplicationSubmitted --> AnomalyEngineRunning: Trigger 7-Engine Pipeline
    
    AnomalyEngineRunning --> AutoCleared: Risk Score 0-24
    AnomalyEngineRunning --> UnderReview: Risk Score 25-49
    AnomalyEngineRunning --> ActionRequired: Risk Score 50-74
    AnomalyEngineRunning --> FieldVerification: Risk Score 75-89
    AnomalyEngineRunning --> PaymentHeld: Risk Score 90-100
    
    AutoCleared --> AdminTriage: Officer reviews batch
    UnderReview --> AdminTriage: Officer reviews flagged items
    ActionRequired --> AdminTriage: Officer reviews flagged items
    FieldVerification --> AdminTriage: Officer reviews flagged items
    PaymentHeld --> AdminTriage: Officer reviews high-severity items

    state AdminTriage {
        [*] --> ViewDossier: Open Application Details
        ViewDossier --> InspectFlags: Review Risk Score & Confidence
        InspectFlags --> InspectEvidence: View Cross-Table Evidence JSON
        InspectEvidence --> OfficerDecision: Select Action & Enter Mandatory Remarks
    }

    AdminTriage --> Approved: Action = APPROVE
    AdminTriage --> Held: Action = HOLD
    AdminTriage --> Rejected: Action = REJECT
    AdminTriage --> DocumentsRequested: Action = REQUEST_DOCUMENTS
    AdminTriage --> Escalated: Action = ESCALATE

    Approved --> AuditLogged
    Held --> AuditLogged
    Rejected --> AuditLogged
    DocumentsRequested --> AuditLogged
    Escalated --> AuditLogged

    AuditLogged --> CitizenStatusUpdated: Status reflected to Farmer Dashboard
    CitizenStatusUpdated --> [*]
```

---

## 7. Repository Layout & Component Mapping

```text
hackspora/
│
├── .planning/                          # GSD Planning & Architecture Artifacts
│   ├── PROJECT.md                      # Core values, scope, constraints
│   ├── REQUIREMENTS.md                 # 34 checkable atomic v1 requirements
│   ├── ROADMAP.md                      # 7-phase vertical MVP roadmap
│   ├── STATE.md                        # Living phase progress tracking
│   ├── config.json                     # GSD workflow configuration
│   └── research/                       # Stack, features, architecture, pitfalls
│
├── backend/                            # FastAPI Python Backend
│   ├── app/
│   │   ├── main.py                     # App entry point, CORS, routers
│   │   ├── config.py                   # Environment & security config (SECRET_KEY, SALT)
│   │   ├── database.py                 # SQLite SQLAlchemy engine & session factory
│   │   ├── models.py                   # SQLAlchemy ORM models (11 tables)
│   │   ├── schemas.py                  # Pydantic validation & response schemas
│   │   ├── auth.py                     # JWT token encode/decode, bcrypt, get_current_user
│   │   ├── routes/
│   │   │   ├── auth_routes.py          # /api/auth (register, login, me)
│   │   │   ├── user_routes.py          # /api/applications (submit, list my, get detail)
│   │   │   ├── scheme_routes.py        # /api/schemes (PM-KISAN field metadata)
│   │   │   └── admin_routes.py         # /api/admin (summary, filter, dossier, decision, CSV)
│   │   ├── services/
│   │   │   ├── application_service.py  # File storage, Aadhaar tokenizer, key generator
│   │   │   ├── anomaly_engine.py       # Orchestrator running all 7 engines
│   │   │   ├── identity_engine.py      # Engine 1: e-KYC, OTP, duplicate Aadhaar, mobile
│   │   │   ├── land_engine.py          # Engine 2: Parcel existence, owner Aadhaar, fuzzy name
│   │   │   ├── bank_engine.py          # Engine 3: IFSC, inactive account, penny-drop, shared
│   │   │   ├── exclusion_engine.py     # Engine 4: Taxpayer, govt, pension, deceased checks
│   │   │   ├── duplicate_engine.py     # Engine 5: Multi-claim parcel, syndicate detection
│   │   │   ├── statistical_engine.py   # Engine 6: Geographic village density baseline
│   │   │   ├── temporal_engine.py      # Engine 7: Pre-event deadline submission spikes
│   │   │   ├── risk_scorer.py          # Weighted scoring formula (0-100) & confidence
│   │   │   └── rationale_generator.py  # Plain-English explanation synthesizer
│   │   └── seed/
│   │       └── seed_data.py            # Master registries & 20 sample applications
│   ├── uploads/                        # Local file storage for land documents
│   └── requirements.txt                # Python dependencies
│
├── frontend/                           # React 18 + Vite Frontend
│   ├── src/
│   │   ├── api/                        # Axios instance & API service functions
│   │   ├── components/                 # Reusable UI (Navbar, Badges, Modals, Charts)
│   │   ├── context/                    # AuthContext (JWT, user state, login/logout)
│   │   ├── pages/
│   │   │   ├── Login.jsx               # Citizen & Officer Login
│   │   │   ├── Register.jsx            # Farmer Registration
│   │   │   ├── FarmerDashboard.jsx     # Citizen application list & status cards
│   │   │   ├── ApplyPMKisan.jsx        # Multi-section wizard with OTP & upload
│   │   │   ├── ApplicationDetail.jsx   # Citizen application tracker (redacted fraud)
│   │   │   ├── AdminDashboard.jsx      # KPI metrics, Recharts, filterable grid
│   │   │   └── AdminDossier.jsx        # Deep anomaly inspection & decision modal
│   │   ├── App.jsx                     # Route definitions & Role guards
│   │   └── main.jsx
│   ├── package.json
│   └── tailwind.config.js
│
├── ARCHITECTURE_DIAGRAM.md             # This comprehensive architecture diagram document
├── context.md                          # Original hackathon problem context & blueprint
├── AGENTS.md                           # Developer & AI Agent workflow instructions
└── GEMINI.md                           # Antigravity/Gemini runtime directives
```
