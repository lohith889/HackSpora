# Features & Domain Research — KisanGuard Portal

## Domain Overview: PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)

PM-KISAN is a flagship Direct Benefit Transfer (DBT) scheme by the Government of India providing ₹6,000 annually in 3 equal installments of ₹2,000 directly into bank accounts of landholder farmer families.

### Table Stakes Features (Must Have)
1. **Farmer Authentication & Onboarding**:
   - Secure registration with email, mobile, password, name, DOB, gender, category.
   - JWT session management with persistence.
2. **Standard Application Form (Digital Seva Kendra / Farmer Facing)**:
   - Personal details prefill.
   - Mock OTP validation (OTP = `123456`).
   - Aadhaar 12-digit format check and e-KYC consent declaration.
   - Bank account (9-18 digits) and IFSC code format validation (`^[A-Z]{4}0[A-Z0-9]{6}$`).
   - Land parcel location: State, District, Tehsil, Village, Khata, Plot, Declared Area (ha), Ownership Type.
   - Land record file upload (PDF/JPG/PNG <= 5MB).
   - Self-declaration of non-exclusion and truthfulness.
3. **Application Lifecycle & Status**:
   - Post-submission status tracker for farmer: `AUTO_CLEARED`, `UNDER_REVIEW`, `ACTION_REQUIRED`, `FIELD_VERIFICATION`, `PAYMENT_HELD`.
   - Farmer sees only citizen-appropriate action messages (e.g. "Field verification required"), never fraud scores.
4. **Admin Anomaly Review Portal**:
   - Authentication for scheme officers.
   - Overview KPI summary: Total applications, High/Medium/Low risk counts, Pending reviews, Top anomaly codes.
   - Searchable, filterable applications table with risk badges and confidence tags.
   - Deep inspection modal/page: Applicant details, Scheme details, Risk report, Anomaly flags, Raw evidence JSON, Document viewer.
   - Administrative decision action: `APPROVE`, `HOLD`, `REJECT`, `REQUEST_DOCUMENTS`, `ESCALATE` with required remarks.
   - Persistent audit log of all decisions.

### Differentiator Features (Competitive Advantage for HackSpora 2.0)
1. **7-Engine Modular Anomaly Pipeline**:
   - **Identity Engine**: e-KYC failure detection, duplicate Aadhaar across accounts, bulk mobile usage (syndicate alert).
   - **Land Engine**: Missing land parcel in registry, owner Aadhaar mismatch, fuzzy owner name mismatch, non-agricultural land classification, inactive ownership status, declared vs registered area discrepancies.
   - **Bank Engine**: Invalid IFSC, inactive account, penny drop verification failure, bank account holder name mismatch, account shared across multiple applicants (mule accounts).
   - **Exclusion Engine**: Automated check against ineligible registries (Income Tax payee, Government employee, Pensioner > ₹10,000/mo, practicing Doctor/Engineer/Lawyer/CA, Institutional landholder, Deceased records).
   - **Duplicate Parcel Engine**: Cross-application detection of multiple claims on the same plot/parcel, flagging syndicate fraud where multiple applicants use the same mobile or claim the same plot.
   - **Statistical & Geographic Concentration Engine**: Identifying micro-regions (villages) where application rates statistically exceed local historical cultivator baselines by >1.75x or >2.5x.
   - **Temporal Surge Engine**: Detecting artificial bursts in application volume within 48 hours preceding scheme milestone dates (installment payouts, cutoff deadlines).
2. **Transparent Explainability & Confidence Scoring**:
   - 0-100 aggregated risk score with clear severity weighting.
   - Dynamic confidence assignment (High, Medium, Low) based on deterministic vs heuristic evidence.
   - Natural language rationale generator providing immediate plain-English justification for scheme officers.
3. **Citizen Privacy by Design**:
   - Aadhaar tokenization: raw 12-digit Aadhaar is hashed with a secret salt (`aadhaar_ref`) and masked (`aadhaar_masked`), preventing PII leakage while enabling deterministic cross-database checks.
   - Strict role-based response filtering: backend endpoints redact fraud metrics from applicant responses.
