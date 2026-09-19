# Architecture & System Design — KisanGuard Portal

## System Topology

```
+-------------------------------------------------------------------------+
|                              CLIENT LAYER                               |
|                                                                         |
|   +----------------------------+     +------------------------------+   |
|   |   Farmer Applicant Web UI  |     | Admin Anomaly Dashboard      |   |
|   |  - Register / Login        |     |  - Overview KPI & Charts     |   |
|   |  - Multi-step PM-KISAN App |     |  - Application Filter Grid   |   |
|   |  - Document Upload         |     |  - Deep Risk & Flag Inspector|   |
|   |  - Status Tracking         |     |  - Officer Decision Console  |   |
|   +--------------+-------------+     +--------------+---------------+   |
|                  |                                  |                   |
+------------------|----------------------------------|-------------------+
                   | REST API (JSON / Multipart)      |
                   v                                  v
+-------------------------------------------------------------------------+
|                           FASTAPI BACKEND                               |
|                                                                         |
|   [ Auth & RBAC Middleware (JWT, bcrypt, Role Guards) ]                 |
|                                                                         |
|   Routes:                                                               |
|     ├── /api/auth (register, login, me)                                 |
|     ├── /api/schemes (PM-KISAN scheme fields & metadata)                |
|     ├── /api/applications (submit multipart, list my, get detail)       |
|     └── /api/admin (summary, applications, report, decision, export)    |
|                                                                         |
|   Services:                                                             |
|     ├── Application Service (Validation, Aadhaar hashing, File store)   |
|     └── Anomaly Pipeline Service (Engine Orchestrator)                  |
|                                                                         |
|   Anomaly Detection Subsystems:                                         |
|     ├── 1. Identity Engine (e-KYC, OTP, duplicate Aadhaar, mobile)     |
|     ├── 2. Land Engine (parcel check, Aadhaar match, fuzzy name)        |
|     ├── 3. Bank Engine (IFSC check, penny-drop, shared account)         |
|     ├── 4. Exclusion Engine (Tax, Govt, Pension, Professional, etc.)    |
|     ├── 5. Duplicate Parcel Engine (over-claimed parcel detection)      |
|     ├── 6. Statistical Engine (village concentration vs baseline)       |
|     ├── 7. Temporal Engine (pre-event submission spikes)                |
|     ├── 8. Risk Scorer (weighted sum, capped at 100)                    |
|     ├── 9. Confidence Engine (High / Medium / Low heuristic)            |
|     └── 10. Rationale Generator (Human-readable explanation)            |
+-------------------------------------+-----------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------+
|                             DATA LAYER                                  |
|                                                                         |
|   SQLite Relational Database (SQLAlchemy ORM):                          |
|     ├── Transactional:                                                  |
|     │     users, applications, pm_kisan_application_details,             |
|     │     anomaly_reports, anomaly_flags, audit_logs                    |
|     └── Master Reference Data:                                          |
|           land_records_master, bank_validation_master, exclusion_master,|
|           village_profile_master, event_calendar_master                 |
|                                                                         |
|   Local File System:                                                    |
|     └── backend/uploads/ (application_{id}_{timestamp}.ext)             |
+-------------------------------------------------------------------------+
```

## Data Schema & Relationships

1. **`users`**
   - Stores farmer and administrative credentials (`email`, `password_hash`, `role`).
2. **`applications`**
   - Tracks submission status (`SUBMITTED`, `AUTO_CLEARED`, `UNDER_REVIEW`, `ACTION_REQUIRED`, `FIELD_VERIFICATION`, `PAYMENT_HELD`, `APPROVED`, `REJECTED`).
   - Links 1:1 with `users` and 1:1 with `pm_kisan_application_details`.
   - Stores computed `risk_score`, `confidence_level`, `recommended_action`.
3. **`pm_kisan_application_details`**
   - Detailed applicant land and bank data.
   - Computes derived join keys:
     - `parcel_id = {state}-{district}-{tehsil}-{village}-{khata}-{plot}`
     - `bank_account_ifsc_key = {account_number}-{ifsc_code}`
     - `aadhaar_ref = SHA256(aadhaar + SALT)`
     - `aadhaar_masked = XXXX-XXXX-1234`
4. **`anomaly_reports` & `anomaly_flags`**
   - Stores the aggregate report and individual flag items with contributing scores, severity, and evidence JSON blobs.
5. **Master Tables**
   - `land_records_master`: Land ownership, area, agricultural status, title dispute flag.
   - `bank_validation_master`: Bank account holder name, penny drop status, active flag.
   - `exclusion_master`: Taxpayer, govt employee, pensioner, professional, deceased flags.
   - `village_profile_master`: Historical beneficiary counts and cultivator baseline estimates.
   - `event_calendar_master`: Scheduled PM-KISAN installment releases and deadlines.
6. **`audit_logs`**
   - Administrative actions (`APPROVE`, `HOLD`, `REJECT`, etc.) with timestamps, officer IDs, and remarks.
