# FINAL_KISANGUARD_PM_KISAN_ARCHITECTURE.md

# 1. Project Name

**KisanGuard Portal**  
**PM-KISAN Scheme Application Portal + Admin Anomaly Review Dashboard**

---

# 2. Final Objective

Build a full-stack PM-KISAN scheme application and verification system where:

1. A **farmer/user** can register, login, and apply for the PM-KISAN scheme.
2. The user enters required PM-KISAN details such as:
   - Aadhaar number
   - Mobile number
   - Farmer name
   - Age/date of birth
   - Gender
   - Category
   - Bank account number
   - IFSC code
   - Land ownership / land record details
   - Self-declaration
   - e-KYC consent
   - Land document upload
3. After submission, the system automatically runs PM-KISAN-specific anomaly detection engines.
4. The system generates:
   - Risk score
   - Confidence level
   - Anomaly flags
   - Evidence
   - Explainable rationale
5. The **admin/scheme officer** views flagged applications, reviews anomalies, and takes action.
6. The **user** sees only application status and required next steps, not the internal fraud score.

---

# 3. Hackathon Problem Statement Mapping

This project maps to:

## HackSpora 2.0 Problem Statement 3

**AI Driven Fraud and Anomaly Detection**

The problem statement requires:

- Detection of fraud or anomalies in a chosen domain
- Flagging suspicious cases
- Clear confidence score
- Clear rationale
- Objective evaluation potential

KisanGuard fulfills this by:

- Choosing PM-KISAN government scheme domain
- Detecting land, identity, bank, exclusion, duplicate, geographic, and temporal anomalies
- Producing a 0-100 risk score
- Producing Low/Medium/High confidence
- Producing human-readable rationale for every flagged application

---

# 4. System Roles

## Role 1: USER / Farmer Applicant

### User Can:
- Register an account
- Login
- View and update basic profile
- View available schemes
- Apply for PM-KISAN
- Fill scheme-specific application form
- Upload land document
- Submit application
- View own application status
- See if additional verification is required

### User Cannot:
- See risk score
- See anomaly flags
- See admin rationale
- See evidence used for fraud detection
- Access other users’ applications
- Access admin dashboard

---

## Role 2: ADMIN / Scheme Officer

### Admin Can:
- Login
- View all submitted PM-KISAN applications
- Filter by risk level, status, district, village
- Sort by risk score
- Open application detail page
- View anomaly flags
- View risk score
- View confidence level
- View rationale
- View evidence
- View uploaded land document metadata
- Approve, reject, hold, request documents, or escalate
- Export anomaly report
- View audit logs

### Admin Cannot:
- Apply as a farmer in the primary demo flow
- Modify raw applicant data directly without audit trail

---

# 5. Final End-to-End Architecture Flow

This is the complete working flow of the system.

---

## Step 1: User Opens Portal

The user opens the KisanGuard web application.

### Pages Visible:
- Login
- Register
- Scheme overview

---

## Step 2: User Registers

The user creates an account using basic profile information.

### Registration Fields:

| Field | Required |
|---|---:|
| Full name | Yes |
| Email | Yes |
| Password | Yes |
| Mobile number | Yes |
| Date of birth | Yes |
| Gender | Yes |
| Category | Optional |

### Backend Processing:
1. Validate request body
2. Check if email already exists
3. Hash password using bcrypt
4. Create user record with role = `USER`
5. Return JWT token and user object

---

## Step 3: User Logs In

The user logs in using email and password.

### Backend Processing:
1. Validate email
2. Verify password hash
3. Generate JWT token
4. Return user role and profile

### JWT Contains:
- User ID
- Email
- Role
- Expiry timestamp

---

## Step 4: User Dashboard Loads

After login, the user is redirected to dashboard.

### Dashboard Shows:
- Welcome message
- Apply for PM-KISAN button
- List of user’s previous applications
- Application status cards

---

## Step 5: User Selects PM-KISAN Scheme

The user clicks:

```text
Apply for PM-KISAN
```

The frontend requests scheme field configuration from backend.

### Endpoint:

```http
GET /api/schemes/PM_KISAN/fields
```

### Backend Returns:
- Required application sections
- Field validation rules
- Document upload requirements
- Declaration requirements

---

# 6. PM-KISAN Application Form Flow

The PM-KISAN application form is divided into sections.

---

## Section A: Personal Details

| Field | Source | Required |
|---|---|---:|
| Farmer name | Prefilled from profile | Yes |
| Date of birth | Prefilled from profile | Yes |
| Gender | Prefilled from profile | Yes |
| Category | Optional | No |
| Mobile number | Prefilled from profile | Yes |

---

## Section B: OTP Verification

Mobile number is used for OTP verification.

For MVP:

```text
Mock OTP = 123456
```

### Backend Behavior:
- If OTP equals `123456`, set:

```text
otp_verified = true
```

- Else reject submission.

---

## Section C: Identity Details

| Field | Required | Validation |
|---|---:|---|
| Aadhaar number | Yes | Must be 12 digits |
| e-KYC consent | Yes | Must be true |

### Aadhaar Privacy Rule:
Do not store raw Aadhaar number.

Instead:

```text
aadhaar_ref = hashed Aadhaar token
aadhaar_masked = XXXX-XXXX-1234
```

### Mock e-KYC Rule:
If:

```text
Aadhaar is valid AND e_kyc_consent is true
```

Then:

```text
e_kyc_status = true
```

Otherwise:

```text
e_kyc_status = false
```

---

## Section D: Bank Details

| Field | Required | Validation |
|---|---:|---|
| Bank account number | Yes | 9 to 18 digits |
| IFSC code | Yes | `^[A-Z]{4}0[A-Z0-9]{6}$` |

---

## Section E: Land Details

| Field | Required |
|---|---:|
| State code | Yes |
| District code | Yes |
| Tehsil code | Yes |
| Village code | Yes |
| Khata number | Yes |
| Plot number | Yes |
| Declared land area in hectares | Yes |
| Ownership type | Yes |
| Declared crop code | Optional |

### Derived Land Parcel ID:

```text
parcel_id = state_code-district_code-tehsil_code-village_code-khata_number-plot_number
```

Example:

```text
S01-D01-T01-V01-004-102
```

---

## Section F: Land Document Upload

User uploads one land-related document.

### Accepted Formats:
- PDF
- JPG
- JPEG
- PNG

### Max Size:
- 5 MB

### Examples:
- Land record extract
- Khata copy
- Survey number document
- Ownership certificate

---

## Section G: Declaration

User must accept:

1. Self-declaration:

```text
I declare that I do not fall under any PM-KISAN exclusion category.
```

2. Aadhaar/e-KYC consent:

```text
I consent to mock Aadhaar/e-KYC verification for this application.
```

If either checkbox is false, submission is blocked.

---

# 7. Application Submission Flow

When user clicks submit, the following happens.

---

## Step 1: Frontend Validation

Frontend checks:

- All required fields are filled
- Aadhaar is 12 digits
- OTP is correct
- Bank account length is valid
- IFSC format is valid
- Land area is greater than zero
- Document is uploaded
- Declarations are checked

---

## Step 2: API Request

Frontend sends multipart/form-data request:

```http
POST /api/applications/pm-kisan
```

With:
- Form fields
- Land document file
- JWT authorization header

---

## Step 3: Backend Validation

Backend validates:

- User authentication
- Required fields
- OTP verification
- Aadhaar format
- Bank account format
- IFSC format
- Land area
- File type
- File size
- Self-declaration
- e-KYC consent

---

## Step 4: Aadhaar Tokenization

Backend hashes Aadhaar number.

```text
raw_aadhaar -> SHA256 hash with secret salt -> aadhaar_ref
```

Stored:

```text
aadhaar_ref = UID-8821 or hashed token
aadhaar_masked = XXXX-XXXX-1234
```

Raw Aadhaar is not stored.

---

## Step 5: Derived Keys Are Created

### Parcel ID:

```text
parcel_id = state_code-district_code-tehsil_code-village_code-khata_number-plot_number
```

### Bank Key:

```text
bank_account_ifsc_key = bank_account_number-IFSC_code
```

---

## Step 6: File Is Stored

Uploaded document is saved to:

```text
backend/uploads/
```

File naming convention:

```text
application_{application_id}_{timestamp}.{extension}
```

Example:

```text
application_21_20260615103000.pdf
```

---

## Step 7: Application Record Is Created

Application status initially:

```text
SUBMITTED
```

---

## Step 8: PM-KISAN Detail Record Is Created

This stores all scheme-specific details.

---

## Step 9: Anomaly Engine Is Triggered

The backend calls:

```python
run_anomaly_engine(application_id, db)
```

---

# 8. Full Anomaly Detection Architecture

The anomaly detection system is modular.

---

## Anomaly Pipeline Order

```text
Application Submitted
        ↓
Load Application Data
        ↓
Load Master Data
        ↓
Identity Engine
        ↓
Land Engine
        ↓
Bank Engine
        ↓
Exclusion Engine
        ↓
Duplicate Parcel Engine
        ↓
Statistical / Geographic Engine
        ↓
Temporal Spike Engine
        ↓
Risk Scoring Engine
        ↓
Confidence Engine
        ↓
Rationale Generator
        ↓
Save Anomaly Report
        ↓
Update Application Status
```

---

# 9. Anomaly Engine Orchestrator

Main function:

```python
run_anomaly_engine(application_id, db):
    application = load_application(application_id)
    details = load_pm_kisan_details(application_id)

    flags = []

    flags += identity_engine(application, details, db)
    flags += land_engine(application, details, db)
    flags += bank_engine(application, details, db)
    flags += exclusion_engine(application, details, db)
    flags += duplicate_parcel_engine(application, details, db)
    flags += statistical_engine(application, details, db)
    flags += temporal_engine(application, details, db)

    risk_score = calculate_risk_score(flags)
    confidence_level = calculate_confidence(flags, risk_score)
    rationale = generate_rationale(flags)
    recommended_action = get_recommended_action(risk_score)

    save_anomaly_report(
        application_id,
        risk_score,
        confidence_level,
        recommended_action,
        rationale
    )

    save_anomaly_flags(application_id, flags)

    update_application_status(
        application_id,
        risk_score
    )
```

---

# 10. Anomaly Engine Specifications

---

## Engine 1: Identity Engine

### Purpose
Detect identity and e-KYC related anomalies.

### Inputs
- Application
- PM-KISAN details
- Existing applications

### Checks

| Check | Anomaly Code | Severity |
|---|---|---|
| e-KYC failed | `ID_EKYC_FAILED` | High |
| OTP not verified | `ID_OTP_NOT_VERIFIED` | Medium |
| Duplicate Aadhaar across applications | `ID_DUPLICATE_AADHAAR` | High |
| Same mobile used excessively | `ID_MOBILE_BULK_USAGE` | Medium/High |

### Mobile Usage Thresholds

```text
More than 5 applications using same mobile => Medium
More than 10 applications using same mobile => High
```

### Evidence Example

```json
{
  "aadhaar_ref": "UID-8821",
  "mobile_number": "9876543210",
  "duplicate_application_count": 3
}
```

---

## Engine 2: Land Engine

### Purpose
Verify land ownership and land record consistency.

### Inputs
- PM-KISAN application details
- land_records_master

### Join Key

```text
parcel_id
```

### Checks

| Check | Anomaly Code | Severity |
|---|---|---|
| Parcel not found | `LAND_RECORD_MISSING` | High |
| Owner Aadhaar mismatch | `LAND_OWNER_AADHAAR_MISMATCH` | High |
| Owner name mismatch | `LAND_OWNER_NAME_MISMATCH` | Medium/High |
| Land is not agricultural | `LAND_NOT_AGRICULTURAL` | High |
| Ownership inactive/disputed | `LAND_OWNERSHIP_INACTIVE` | High |
| Declared area differs from registered area | `LAND_AREA_MISMATCH` | Medium |

### Name Matching Rule

Use fuzzy matching.

```text
name_score = fuzzy_ratio(farmer_name, land_owner_name)
```

Thresholds:

```text
name_score < 0.60 => High
name_score between 0.60 and 0.80 => Medium
```

### Evidence Example

```json
{
  "parcel_id": "S01-D01-T01-V01-004-102",
  "applicant_name": "Ramesh Kumar",
  "land_owner_name": "Suresh Kumar",
  "name_match_score": 0.54,
  "applicant_aadhaar_ref": "UID-8821",
  "land_owner_aadhaar_ref": "UID-5510"
}
```

---

## Engine 3: Bank Engine

### Purpose
Validate bank account details for DBT suitability.

### Inputs
- PM-KISAN application details
- bank_validation_master

### Join Key

```text
bank_account_ifsc_key
```

### Checks

| Check | Anomaly Code | Severity |
|---|---|---|
| IFSC invalid | `BANK_IFSC_INVALID` | High |
| Account inactive | `BANK_ACCOUNT_INACTIVE` | High |
| Penny drop failed | `BANK_PENNY_DROP_FAILED` | Medium |
| Bank name mismatch | `BANK_NAME_MISMATCH` | Medium/High |
| Same account used by multiple applicants | `BANK_ACCOUNT_SHARED` | High |
| Bank validation record missing | `BANK_VALIDATION_MISSING` | Low |

### Name Match Thresholds

```text
name_match_score < 0.60 => High
name_match_score between 0.60 and 0.80 => Medium
```

### Evidence Example

```json
{
  "bank_account_ifsc_key": "1234567890-SBIN0001234",
  "account_status": "INACTIVE",
  "penny_drop_status": "FAILED",
  "linked_application_count": 3
}
```

---

## Engine 4: Exclusion Engine

### Purpose
Detect applicants who fall under excluded categories.

### Inputs
- PM-KISAN application details
- exclusion_master

### Join Key

```text
aadhaar_ref
```

### Checks

| Check | Anomaly Code | Severity |
|---|---|---|
| Taxpayer | `EXCLUSION_TAXPAYER` | High |
| Government employee | `EXCLUSION_GOVT_EMPLOYEE` | High |
| Pensioner | `EXCLUSION_PENSIONER` | High |
| Practicing professional | `EXCLUSION_PROFESSIONAL` | High |
| Institutional landholder | `EXCLUSION_INSTITUTIONAL` | High |
| Deceased record | `EXCLUSION_DECEASED` | High |

### Evidence Example

```json
{
  "aadhaar_ref": "UID-8821",
  "taxpayer_flag": true,
  "source": "exclusion_master",
  "as_of_date": "2026-01-01"
}
```

---

## Engine 5: Duplicate Parcel Engine

### Purpose
Detect multiple applications claiming benefit using the same land parcel.

### Inputs
- All submitted applications
- Current application
- PM-KISAN details

### Grouping Key

```text
parcel_id
```

### Checks

| Condition | Anomaly Code | Severity |
|---|---|---|
| Same parcel and same mobile number | `DUPLICATE_PARCEL_BENEFIT` | High |
| Same parcel, different applicants, count <= 3 | `SAME_PARCEL_MULTIPLE_APPLICANTS` | Medium |
| Same parcel, more than 3 applicants | `PARCEL_OVER_CLAIMED` | High |

### Evidence Example

```json
{
  "parcel_id": "S01-D01-T01-V01-004-102",
  "linked_application_ids": [12, 18, 21],
  "linked_mobile_numbers": ["9876543210", "9876543210"]
}
```

---

## Engine 6: Statistical / Geographic Engine

### Purpose
Detect abnormal concentration of applications in a village.

### Inputs
- Applications
- village_profile_master

### Calculation

```text
current_count = number of applications in village_code
expected_count = historical_beneficiary_count

ratio = current_count / max(expected_count, 1)
```

### Thresholds

```text
ratio > 1.75 => Medium
ratio > 2.5 => High
```

### Anomaly Code

```text
GEO_ABNORMAL_CONCENTRATION
```

### Evidence Example

```json
{
  "village_code": "V001",
  "current_application_count": 85,
  "historical_beneficiary_count": 20,
  "ratio": 4.25
}
```

---

## Engine 7: Temporal Spike Engine

### Purpose
Detect sudden application spikes before important scheme events.

### Inputs
- Applications
- event_calendar_master

### Event Types

```text
installment_release
eKYC_deadline
application_cutoff
special_enrollment_camp
```

### Calculation

```text
spike_count = applications in district during 2 days before event
baseline = average daily applications in previous 14 days
```

### Thresholds

```text
spike_count > 3 * baseline => Medium
spike_count > 5 * baseline => High
```

### Anomaly Code

```text
TIME_PRE_EVENT_SPIKE
```

### Evidence Example

```json
{
  "district_code": "D01",
  "event_type": "installment_release",
  "event_date": "2026-06-20",
  "spike_count": 120,
  "baseline_count": 20
}
```

---

# 11. Risk Scoring Architecture

Each anomaly flag contributes a score.

---

## Risk Score Formula

```text
risk_score = sum(all anomaly flag scores)
risk_score = min(risk_score, 100)
```

---

## Recommended Score Weights

| Anomaly Code | Severity | Weight |
|---|---|---:|
| `LAND_OWNER_AADHAAR_MISMATCH` | High | 45 |
| `LAND_RECORD_MISSING` | High | 40 |
| `LAND_NOT_AGRICULTURAL` | High | 45 |
| `LAND_OWNER_NAME_MISMATCH` | High | 30 |
| `LAND_OWNER_NAME_MISMATCH` | Medium | 15 |
| `LAND_OWNERSHIP_INACTIVE` | High | 30 |
| `LAND_AREA_MISMATCH` | Medium | 20 |
| `ID_EKYC_FAILED` | High | 35 |
| `ID_OTP_NOT_VERIFIED` | Medium | 25 |
| `ID_DUPLICATE_AADHAAR` | High | 45 |
| `ID_MOBILE_BULK_USAGE` | High | 30 |
| `ID_MOBILE_BULK_USAGE` | Medium | 15 |
| `BANK_IFSC_INVALID` | High | 35 |
| `BANK_ACCOUNT_INACTIVE` | High | 35 |
| `BANK_PENNY_DROP_FAILED` | Medium | 25 |
| `BANK_NAME_MISMATCH` | High | 30 |
| `BANK_NAME_MISMATCH` | Medium | 15 |
| `BANK_ACCOUNT_SHARED` | High | 35 |
| `BANK_VALIDATION_MISSING` | Low | 10 |
| `EXCLUSION_TAXPAYER` | High | 50 |
| `EXCLUSION_GOVT_EMPLOYEE` | High | 50 |
| `EXCLUSION_PENSIONER` | High | 45 |
| `EXCLUSION_PROFESSIONAL` | High | 45 |
| `EXCLUSION_INSTITUTIONAL` | High | 50 |
| `EXCLUSION_DECEASED` | High | 50 |
| `DUPLICATE_PARCEL_BENEFIT` | High | 40 |
| `SAME_PARCEL_MULTIPLE_APPLICANTS` | Medium | 20 |
| `PARCEL_OVER_CLAIMED` | High | 45 |
| `GEO_ABNORMAL_CONCENTRATION` | High | 30 |
| `GEO_ABNORMAL_CONCENTRATION` | Medium | 20 |
| `TIME_PRE_EVENT_SPIKE` | High | 35 |
| `TIME_PRE_EVENT_SPIKE` | Medium | 25 |

---

# 12. Confidence Level Architecture

Confidence represents how reliable the risk detection is.

---

## High Confidence

Assign if any of these exist:

- Aadhaar mismatch with land record
- Duplicate Aadhaar
- Exclusion category flag
- Duplicate parcel high flag
- Bank account inactive with active application
- Risk score >= 80

---

## Medium Confidence

Assign if:

- Fuzzy name mismatch
- Geographic concentration
- Temporal spike
- Bank name mismatch medium
- Risk score between 50 and 79

---

## Low Confidence

Assign if:

- Risk score below 50
- Only weak signals exist
- Missing master data but no deterministic fraud signal

---

## Simple Confidence Logic

```python
if deterministic_high_flag_exists or risk_score >= 80:
    confidence_level = "High"
elif risk_score >= 50:
    confidence_level = "Medium"
else:
    confidence_level = "Low"
```

---

# 13. Application Status Architecture

After anomaly scoring, application status is updated.

| Risk Score | Internal Status | User-visible Message |
|---:|---|---|
| 0-24 | `AUTO_CLEARED` | Application received and initial checks passed |
| 25-49 | `UNDER_REVIEW` | Application is under routine verification |
| 50-74 | `ACTION_REQUIRED` | Additional document verification required |
| 75-89 | `FIELD_VERIFICATION` | Field verification required |
| 90-100 | `PAYMENT_HELD` | Application kept on hold for detailed verification |

Admin can override the status through manual decision.

---

# 14. Rationale Generation Architecture

Every application must have a rationale.

---

## Example 1: High Risk

```text
High risk due to: applicant Aadhaar does not match land record owner; same bank account is linked to multiple applications; e-KYC status failed.
```

---

## Example 2: Medium Risk

```text
Medium risk due to: applicant name partially matches land owner name; application volume from the village is higher than historical baseline.
```

---

## Example 3: Low Risk

```text
No major anomalies detected. Application appears consistent with PM-KISAN eligibility data.
```

---

# 15. High-Level System Architecture

```text
+------------------------+
|       User Browser      |
| Farmer Applicant Portal |
+-----------+------------+
            |
            | HTTPS / REST
            v
+------------------------+
|     React Frontend     |
| Vite + Tailwind UI     |
+-----------+------------+
            |
            | Axios API calls
            v
+------------------------+
|     FastAPI Backend    |
+------------------------+
| Auth Service           |
| User Service           |
| Application Service    |
| Admin Service          |
| Anomaly Engine Service |
+-----------+------------+
            |
            v
+------------------------+
|      SQLite Database   |
+------------------------+
| users                  |
| applications           |
| pm_kisan_details       |
| anomaly_reports        |
| anomaly_flags          |
| land_records_master    |
| bank_validation_master |
| exclusion_master       |
| village_profile_master |
| event_calendar_master  |
| audit_logs             |
+------------------------+

+------------------------+
| Local File Storage     |
| backend/uploads        |
+------------------------+
```

---

# 16. Functional Architecture

## Frontend Layer

### Responsibilities:
- User registration/login
- Role-based routing
- PM-KISAN form rendering
- File upload
- API integration
- Application status display
- Admin dashboard
- Charts and filters

---

## Backend Layer

### Responsibilities:
- Authentication
- Authorization
- Application validation
- File upload handling
- Aadhaar tokenization
- Application persistence
- Anomaly engine orchestration
- Risk scoring
- Admin decision handling
- Audit logging
- CSV export

---

## Anomaly Engine Layer

### Responsibilities:
- Identity checks
- Land checks
- Bank checks
- Exclusion checks
- Duplicate detection
- Geographic concentration detection
- Temporal spike detection
- Risk scoring
- Rationale generation

---

## Data Layer

### Responsibilities:
- Store users
- Store applications
- Store scheme details
- Store anomaly reports
- Store master data
- Store audit logs

---

## File Storage Layer

### Responsibilities:
- Store uploaded land documents
- Provide file metadata
- Prevent unsupported file types
- Limit file size

---

# 17. Technical Stack

## Backend

```text
Python 3.11+
FastAPI
SQLAlchemy
SQLite
Pydantic
python-multipart
passlib[bcrypt]
python-jose
pandas
numpy
scikit-learn
thefuzz
PyYAML
```

---

## Frontend

```text
React
Vite
React Router
Axios
Tailwind CSS
Recharts or Chart.js
```

---

## Authentication

```text
JWT
bcrypt password hashing
Role-based access control
```

---

## Database

```text
SQLite for MVP
```

---

## File Storage

```text
Local backend/uploads directory
```

---

# 18. Recommended Repository Structure

```text
kisan-guard/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── auth.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── auth_routes.py
│   │   │   ├── user_routes.py
│   │   │   ├── admin_routes.py
│   │   │   └── scheme_routes.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── application_service.py
│   │   │   ├── anomaly_engine.py
│   │   │   ├── identity_engine.py
│   │   │   ├── land_engine.py
│   │   │   ├── bank_engine.py
│   │   │   ├── exclusion_engine.py
│   │   │   ├── duplicate_engine.py
│   │   │   ├── statistical_engine.py
│   │   │   ├── temporal_engine.py
│   │   │   ├── risk_scorer.py
│   │   │   └── rationale_generator.py
│   │   └── seed/
│   │       ├── __init__.py
│   │       └── seed_data.py
│   │
│   ├── uploads/
│   ├── requirements.txt
│   └── kisan_guard.db
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
│
└── README.md
```

---

# 19. Database Architecture

---

## Table: users

| Column | Type | Notes |
|---|---|---|
| id | integer | Primary key |
| email | string | Unique |
| password_hash | string | Required |
| full_name | string | Required |
| mobile_number | string | Required |
| date_of_birth | date | Required |
| gender | string | Required |
| category | string | Optional |
| role | string | USER or ADMIN |
| created_at | datetime | Auto timestamp |

---

## Table: applications

| Column | Type | Notes |
|---|---|---|
| id | integer | Primary key |
| user_id | integer | Foreign key to users.id |
| scheme_code | string | PM_KISAN |
| status | string | Application status |
| created_at | datetime | Auto timestamp |
| submitted_at | datetime | Nullable |
| risk_score | integer | Nullable |
| confidence_level | string | Nullable |
| recommended_action | string | Nullable |

---

## Table: pm_kisan_application_details

| Column | Type | Notes |
|---|---|---|
| id | integer | Primary key |
| application_id | integer | Unique foreign key |
| farmer_name | string | Required |
| date_of_birth | date | Required |
| gender | string | Required |
| category | string | Optional |
| mobile_number | string | Required |
| otp_verified | boolean | Required |
| aadhaar_ref | string | Hashed/tokenized |
| aadhaar_masked | string | Masked Aadhaar |
| bank_account_number | string | Required |
| ifsc_code | string | Required |
| state_code | string | Required |
| district_code | string | Required |
| tehsil_code | string | Required |
| village_code | string | Required |
| khata_number | string | Required |
| plot_number | string | Required |
| declared_land_area_ha | float | Required |
| ownership_type | string | Required |
| declared_crop_code | string | Optional |
| land_document_path | string | Required |
| self_declaration | boolean | Required |
| e_kyc_consent | boolean | Required |
| e_kyc_status | boolean | Required |
| parcel_id | string | Derived |
| bank_account_ifsc_key | string | Derived |

---

## Table: anomaly_reports

| Column | Type | Notes |
|---|---|---|
| id | integer | Primary key |
| application_id | integer | Unique foreign key |
| risk_score | integer | 0-100 |
| confidence_level | string | Low/Medium/High |
| recommended_action | string | Recommended action |
| rationale | text | Explainable reason |
| created_at | datetime | Auto timestamp |

---

## Table: anomaly_flags

| Column | Type | Notes |
|---|---|---|
| id | integer | Primary key |
| application_id | integer | Foreign key |
| anomaly_code | string | Anomaly code |
| severity | string | Low/Medium/High |
| score | integer | Weight contributed |
| rationale | text | Flag-specific reason |
| evidence_json | json | Evidence object |
| created_at | datetime | Auto timestamp |

---

## Table: land_records_master

| Column | Type | Notes |
|---|---|---|
| id | integer | Primary key |
| parcel_id | string | Unique |
| state_code | string | Required |
| district_code | string | Required |
| tehsil_code | string | Required |
| village_code | string | Required |
| khata_number | string | Required |
| plot_number | string | Required |
| owner_aadhaar_ref | string | Nullable |
| owner_name | string | Required |
| land_area_ha | float | Required |
| land_use_code | string | AGRICULTURAL/NON_AGRICULTURAL/FOREST/URBAN |
| agricultural_land_flag | boolean | Required |
| ownership_status | string | ACTIVE/DISPUTED/INACTIVE |
| title_status | string | CLEAR/UNCLEAR/CO_OWNED |

---

## Table: bank_validation_master

| Column | Type | Notes |
|---|---|---|
| id | integer | Primary key |
| bank_account_ifsc_key | string | Unique |
| bank_account_number | string | Required |
| ifsc_code | string | Required |
| account_holder_name | string | Required |
| account_status | string | ACTIVE/INACTIVE/CLOSED/FROZEN |
| ifsc_valid | boolean | Required |
| penny_drop_status | string | SUCCESS/FAILED/NOT_DONE |
| name_match_score | float | 0 to 1 |

---

## Table: exclusion_master

| Column | Type | Notes |
|---|---|---|
| id | integer | Primary key |
| aadhaar_ref | string | Unique |
| taxpayer_flag | boolean | Required |
| govt_employee_flag | boolean | Required |
| pensioner_flag | boolean | Required |
| professional_flag | boolean | Required |
| institutional_landholder_flag | boolean | Required |
| deceased_flag | boolean | Optional |

---

## Table: village_profile_master

| Column | Type | Notes |
|---|---|---|
| id | integer | Primary key |
| village_code | string | Unique |
| district_code | string | Required |
| tehsil_code | string | Required |
| village_name | string | Required |
| historical_beneficiary_count | integer | Required |
| cultivator_count_estimate | integer | Required |

---

## Table: event_calendar_master

| Column | Type | Notes |
|---|---|---|
| id | integer | Primary key |
| district_code | string | Required |
| event_type | string | Required |
| event_date | date | Required |
| description | string | Optional |

---

## Table: audit_logs

| Column | Type | Notes |
|---|---|---|
| id | integer | Primary key |
| application_id | integer | Foreign key |
| admin_id | integer | Foreign key to users.id |
| action | string | APPROVE/HOLD/REJECT/REQUEST_DOCUMENTS/ESCALATE |
| remarks | text | Optional |
| created_at | datetime | Auto timestamp |

---

# 20. API Architecture

---

## Authentication APIs

### Register

```http
POST /api/auth/register
```

Request:

```json
{
  "email": "farmer@test.com",
  "password": "Farmer@123",
  "full_name": "Ramesh Kumar",
  "mobile_number": "9876543210",
  "date_of_birth": "1985-06-15",
  "gender": "Male",
  "category": "General"
}
```

Response:

```json
{
  "access_token": "jwt-token",
  "token_type": "bearer",
  "user": {
    "id": 2,
    "email": "farmer@test.com",
    "full_name": "Ramesh Kumar",
    "role": "USER"
  }
}
```

---

### Login

```http
GET /api/auth/login
```

Request:

```json
{
  "email": "farmer@test.com",
  "password": "Farmer@123"
}
```

Response:

```json
{
  "access_token": "jwt-token",
  "token_type": "bearer",
  "user": {
    "id": 2,
    "email": "farmer@test.com",
    "full_name": "Ramesh Kumar",
    "role": "USER"
  }
}
```

---

### Get Current User

```http
GET /api/auth/me
```

---

## Scheme APIs

### List Schemes

```http
GET /api/schemes
```

Response:

```json
[
  {
    "scheme_code": "PM_KISAN",
    "scheme_name": "Pradhan Mantri Kisan Samman Nidhi",
    "status": "ACTIVE"
  }
]
```

---

### Get PM-KISAN Fields

```http
GET /api/schemes/PM_KISAN/fields
```

---

## User Application APIs

### Submit PM-KISAN Application

```http
POST /api/applications/pm-kisan
```

Content type:

```text
multipart/form-data
```

Response to normal user:

```json
{
  "application_id": 21,
  "status": "FIELD_VERIFICATION",
  "user_message": "Field verification required",
  "submitted_at": "2026-06-15T10:30:00"
}
```

Do not return risk score to normal user.

---

### Get My Applications

```http
GET /api/applications/my
```

---

### Get Application Detail

```http
GET /api/applications/{application_id}
```

If user is normal user:

- Return status only
- Mask Aadhaar
- Mask bank account
- Do not return risk score
- Do not return anomaly flags

If user is admin:

- Return full report

---

## Admin APIs

### Admin Summary

```http
GET /api/admin/summary
```

Response:

```json
{
  "total_applications": 120,
  "high_risk_count": 18,
  "medium_risk_count": 35,
  "low_risk_count": 67,
  "pending_review_count": 53,
  "top_anomaly_codes": [
    "LAND_OWNER_AADHAAR_MISMATCH",
    "BANK_ACCOUNT_SHARED",
    "EXCLUSION_TAXPAYER"
  ]
}
```

---

### List Applications for Admin

```http
GET /api/admin/applications
```

Query parameters:

```text
status
min_risk
district_code
village_code
page
page_size
sort_by
```

---

### Get Full Application Report

```http
GET /api/admin/applications/{application_id}/report
```

Response:

```json
{
  "application": {},
  "pm_kisan_details": {},
  "risk_report": {
    "risk_score": 87,
    "confidence_level": "High",
    "recommended_action": "Hold payment and verify land record",
    "rationale": "High risk due to applicant Aadhaar mismatch with land record and shared bank account."
  },
  "flags": [],
  "audit_logs": []
}
```

---

### Admin Decision

```http
POST /api/admin/applications/{application_id}/decision
```

Request:

```json
{
  "action": "HOLD",
  "remarks": "Land record needs field verification"
}
```

Allowed actions:

```text
APPROVE
HOLD
REJECT
REQUEST_DOCUMENTS
ESCALATE
```

---

### Export CSV

```http
GET /api/admin/export/csv
```

---

# 21. Frontend Architecture

---

## Public Pages

### `/login`

Components:
- Email input
- Password input
- Login button
- Register link

---

### `/register`

Components:
- Full name
- Email
- Password
- Mobile number
- Date of birth
- Gender
- Category
- Register button

---

## User Pages

### `/dashboard`

Components:
- Welcome card
- Apply for PM-KISAN button
- Applications list
- Status badges

---

### `/apply/pm-kisan`

Sections:
- Personal details
- OTP verification
- Identity details
- Bank details
- Land details
- Document upload
- Declaration
- Submit button

---

### `/applications/:id`

Components:
- Application ID
- Scheme name
- Status badge
- Submitted date
- User-visible message
- Uploaded document name
- Requested action if any

---

## Admin Pages

### `/admin`

Components:
- KPI cards
- Risk distribution chart
- Top anomalies chart
- District risk chart

---

### `/admin/applications`

Components:
- Filters
- Applications table
- Risk score badges
- Confidence badges
- View button

---

### `/admin/applications/:id`

Tabs:
- Applicant
- PM-KISAN Details
- Risk Report
- Documents
- Decision

---

# 22. Admin Review Flow

## Step 1: Admin Logs In

Admin uses seeded credentials:

```text
email: admin@pmkisan.gov.in
password: Admin@123
```

---

## Step 2: Admin Opens Dashboard

Admin sees:

- Total applications
- High risk applications
- Medium risk applications
- Low risk applications
- Pending review count

---

## Step 3: Admin Filters Applications

Admin can filter by:

- High risk
- Medium risk
- Status
- District
- Village

---

## Step 4: Admin Opens High-Risk Application

Admin sees:

- Applicant details
- PM-KISAN details
- Land details
- Bank details
- e-KYC status
- OTP status
- Document metadata

---

## Step 5: Admin Reviews Anomaly Report

Admin sees:

```text
Risk Score: 87
Confidence: High
Recommended Action: Hold payment and verify land record
```

Anomaly flags:

```text
LAND_OWNER_AADHAAR_MISMATCH
BANK_ACCOUNT_SHARED
ID_EKYC_FAILED
```

---

## Step 6: Admin Reviews Evidence

Example evidence:

```json
{
  "parcel_id": "S01-D01-T01-V01-004-102",
  "applicant_aadhaar_ref": "UID-8821",
  "land_owner_aadhaar_ref": "UID-5510",
  "bank_account_ifsc_key": "1234567890-SBIN0001234",
  "linked_application_count": 3
}
```

---

## Step 7: Admin Takes Decision

Admin selects:

```text
HOLD
```

Adds remarks:

```text
Land record needs field verification.
```

---

## Step 8: Audit Log Is Created

Audit log stores:

- Admin ID
- Application ID
- Action
- Remarks
- Timestamp

---

## Step 9: User Sees Updated Status

User sees:

```text
Status: Payment Held
Message: Application kept on hold for detailed verification.
```

User does not see risk score.

---

# 23. User Experience Flow

## Step 1: User Registers

User creates account.

---

## Step 2: User Logs In

User enters dashboard.

---

## Step 3: User Applies for PM-KISAN

User fills form.

---

## Step 4: User Sees Processing State

Frontend shows:

```text
Verifying application...
```

---

## Step 5: User Receives Application ID

Example:

```text
Application ID: PMK-2026-00021
```

---

## Step 6: User Sees Status

Example statuses:

```text
Application received and initial checks passed
Application is under routine verification
Additional document verification required
Field verification required
Application kept on hold for detailed verification
```

---

# 24. Security and Privacy Architecture

---

## Aadhaar Privacy

System must not store raw Aadhaar.

Store:

```text
aadhaar_ref
aadhaar_masked
```

Example:

```text
aadhaar_ref = UID-8821
aadhaar_masked = XXXX-XXXX-1234
```

---

## Password Security

Use:

```text
bcrypt hashing
```

Never store plain text passwords.

---

## Role-Based Access Control

```text
USER:
- /dashboard
- /apply/pm-kisan
- /applications/*

ADMIN:
- /admin
- /admin/applications
- /admin/applications/*
```

---

## File Upload Security

Allowed extensions:

```text
.pdf
.jpg
.jpeg
.png
```

Max size:

```text
5 MB
```

---

## API Security

- JWT required for protected endpoints
- Admin middleware for admin endpoints
- Owner check for user application detail endpoint
- CORS enabled only for frontend origin

---

# 25. Seed Data Architecture

Seed data is required for demo readiness.

---

## Seed Admin User

```text
email: admin@pmkisan.gov.in
password: Admin@123
role: ADMIN
```

---

## Seed Normal User

```text
email: farmer@test.com
password: Farmer@123
role: USER
```

---

## Seed Land Records

Create at least:

```text
20 land records
```

Include:

- Matching owner Aadhaar records
- Mismatching owner Aadhaar records
- Non-agricultural land records
- Disputed ownership records
- Missing parcel records

---

## Seed Bank Validation Records

Include:

- Active accounts
- Inactive accounts
- Failed penny drop accounts
- Shared bank accounts
- Invalid IFSC records

---

## Seed Exclusion Records

Include:

- Taxpayer flags
- Government employee flags
- Pensioner flags
- Professional flags
- Institutional landholder flags

---

## Seed Village Profiles

Include:

- Normal villages
- One high concentration village

---

## Seed Events

Include:

- Installment release event
- e-KYC deadline event
- Application cutoff event

---

## Seed Sample Applications

Create:

```text
20 sample applications
```

Distribution:

```text
10 low risk
5 medium risk
5 high risk
```

Run anomaly engine on all seeded applications.

---

# 26. Final Working Architecture Diagram

```text
+----------------------+       Register/Login       +----------------------+
|                      | -------------------------> |                      |
|   Farmer/User UI     |                            |   FastAPI Backend    |
|                      | <------------------------- |                      |
| - Register           |        JWT Token           | - Auth               |
| - Login              |                            | - User Routes        |
| - Apply PM-KISAN     |                            | - Admin Routes       |
| - View Status        |                            | - Application Routes |
+----------+-----------+                            +----------+-----------+
           |                                                   |
           | Submit PM-KISAN Form                              |
           v                                                   v
+----------------------+                            +----------------------+
| PM-KISAN Form        |                            | Application Service  |
| - Personal           |                            | - Validate           |
| - OTP                |                            | - Hash Aadhaar       |
| - Identity           |                            | - Store Document     |
| - Bank               |                            | - Create Application |
| - Land               |                            +----------+-----------+
| - Document Upload    |                                       |
| - Declaration        |                                       v
+----------------------+                            +----------------------+
                                                    | Anomaly Engine       |
                                                    | - Identity           |
                                                    | - Land               |
                                                    | - Bank               |
                                                    | - Exclusion          |
                                                    | - Duplicate Parcel   |
                                                    | - Geographic         |
                                                    | - Temporal           |
                                                    +----------+-----------+
                                                               |
                                                               v
                                                    +----------------------+
                                                    | Risk Scoring         |
                                                    | - Score 0-100        |
                                                    | - Confidence         |
                                                    | - Rationale          |
                                                    | - Recommended Action |
                                                    +----------+-----------+
                                                               |
                          +------------------------------------+------------------------------------+
                          |                                                                         |
                          v                                                                         v
               +----------------------+                                                  +----------------------+
               | User Status View     |                                                  | Admin Dashboard      |
               | - Status only        |                                                  | - Risk Score         |
               | - No risk score      |                                                  | - Confidence         |
               | - No anomaly details |                                                  | - Flags              |
               +----------------------+                                                  | - Evidence           |
                                                                                         | - Decision           |
                                                                                         +----------------------+
```

---

# 27. Complete Data Flow Architecture

```text
User Form Input
    ↓
Frontend Validation
    ↓
Multipart API Request
    ↓
Backend Validation
    ↓
Aadhaar Hashing
    ↓
File Storage
    ↓
Application Creation
    ↓
PM-KISAN Detail Creation
    ↓
Master Data Lookup
    ↓
Anomaly Engines
    ↓
Anomaly Flags
    ↓
Risk Score
    ↓
Confidence Level
    ↓
Rationale
    ↓
Anomaly Report Saved
    ↓
Application Status Updated
    ↓
User Sees Status
    ↓
Admin Sees Risk Report
```

---

# 28. Build Order for Coding Agent

Use this order to build the MVP.

---

## Phase 1: Project Setup

Build:
- Backend folder
- Frontend folder
- Requirements
- Basic run scripts

---

## Phase 2: Database Models

Build:
- SQLAlchemy models
- SQLite database
- Pydantic schemas

---

## Phase 3: Authentication

Build:
- Register
- Login
- JWT
- Role middleware

---

## Phase 4: User Profile and Scheme API

Build:
- `/api/auth/me`
- `/api/schemes`
- `/api/schemes/PM_KISAN/fields`

---

## Phase 5: PM-KISAN Application Submission

Build:
- Form validation
- File upload
- Aadhaar hashing
- Parcel ID generation
- Bank key generation
- Application creation

---

## Phase 6: Anomaly Engines

Build:
- Identity engine
- Land engine
- Bank engine
- Exclusion engine
- Duplicate parcel engine
- Statistical engine
- Temporal engine

---

## Phase 7: Risk Scoring

Build:
- Score calculation
- Confidence calculation
- Rationale generator
- Status mapping

---

## Phase 8: User Dashboard

Build:
- Dashboard
- Apply form
- Application detail
- Status page

---

## Phase 9: Admin Dashboard

Build:
- Admin summary
- Application list
- Application detail
- Risk report
- Decision action
- Audit logs

---

## Phase 10: Seed Data

Build:
- Admin user
- Normal user
- Master data
- Sample applications
- Engine execution on seed data

---

# 29. Acceptance Criteria

The system is complete only if all of the following work.

---

## Authentication

- User can register
- User can login
- Admin can login
- Passwords are hashed
- JWT protects routes
- Role-based access works

---

## User Application

- User can fill PM-KISAN form
- Form validates required fields
- OTP mock works
- Aadhaar is masked/hashed
- Bank validation works
- Land document upload works
- Application is saved
- User can view own application status

---

## Anomaly Engine

- Anomaly engine runs after submission
- Risk score is generated
- Confidence level is generated
- Rationale is generated
- Anomaly flags are saved
- Evidence is saved

---

## Admin Dashboard

- Admin can see all applications
- Admin can sort by risk score
- Admin can filter by status/risk
- Admin can see full anomaly report
- Admin can take decision
- Decision updates application status
- Audit log is created

---

## Privacy

- Normal user cannot see risk score
- Normal user cannot see anomaly rationale
- Raw Aadhaar is not stored
- Users cannot access other users’ applications

---

# 30. Final Demo Flow

## Demo Step 1: Register User

Create farmer account.

---

## Demo Step 2: Login as User

Go to dashboard.

---

## Demo Step 3: Apply for PM-KISAN

Fill:
- Personal details
- OTP
- Aadhaar
- Bank details
- Land details
- Upload land document
- Accept declarations

---

## Demo Step 4: Submit Application

Show processing state.

---

## Demo Step 5: User Sees Status

Show user-facing status.

Example:

```text
Field verification required
```

---

## Demo Step 6: Login as Admin

Use:

```text
admin@pmkisan.gov.in
Admin@123
```

---

## Demo Step 7: Show Admin Dashboard

Show:
- Total applications
- High risk count
- Top anomalies
- District risk

---

## Demo Step 8: Open High-Risk Application

Show:
- Risk score
- Confidence
- Rationale
- Anomaly flags
- Evidence

---

## Demo Step 9: Take Admin Decision

Select:

```text
HOLD
```

Add remarks.

---

## Demo Step 10: User Sees Updated Status

Show updated status in user dashboard.

---

# 31. Final One-Paragraph Architecture Summary

KisanGuard Portal is a full-stack PM-KISAN application and fraud detection system. A farmer registers and logs in, then applies for PM-KISAN by entering personal, identity, bank, land, and declaration details, along with a land document upload. After submission, the backend validates the data, hashes the Aadhaar number, stores the application, and automatically runs multiple anomaly detection engines: identity, land, bank, exclusion, duplicate parcel, geographic concentration, and temporal spike detection. These engines generate anomaly flags with evidence. A risk scoring engine calculates a 0-100 risk score, assigns a confidence level, and produces an explainable rationale. The application status is updated for the user, while the admin dashboard shows the full risk report, evidence, and recommended action. The admin can approve, hold, reject, request documents, or escalate the application, with every decision stored in an audit log.