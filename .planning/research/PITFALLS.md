# Domain Pitfalls & Edge Cases — KisanGuard Portal

## Critical Gotchas & How KisanGuard Mitigates Them

### 1. Aadhaar Privacy Compliance
- **Pitfall**: Storing 12-digit plain Aadhaar numbers violates UIDAI regulations and Supreme Court privacy judgments.
- **Mitigation**: Immediate tokenization upon receipt. Backend calculates a salted SHA-256 hash (`aadhaar_ref`) used solely for internal indexing and masking (`aadhaar_masked = XXXX-XXXX-1234`). Plaintext Aadhaar is discarded from memory immediately.

### 2. Leaking Fraud Scores to Ineligible Beneficiaries
- **Pitfall**: Showing an applicant their internal risk score (e.g. "Risk Score: 85/100") invites adversarial gaming, panic, or legal challenges before official review.
- **Mitigation**: Strict role filtering on `/api/applications/{id}`. For `USER` role, fraud fields (`risk_score`, `anomaly_flags`, `rationale`) are stripped, and only neutral government status messages (e.g. "Application received and initial checks passed" or "Additional document verification required") are returned.

### 3. Name Discrepancies in Indian Agricultural Context
- **Pitfall**: Indian names frequently have spelling differences across Aadhaar, bank passbooks, and land records (e.g., "Ramesh Kumar", "Ramesh Kumar Sharma", "Ramesh K."). Exact string comparison triggers massive false positives.
- **Mitigation**: Implement token-based fuzzy string matching (`thefuzz.fuzz.token_sort_ratio`). Exact match (>0.85) = pass; partial match (0.60-0.80) = medium flag; distinct mismatch (<0.60) = high flag.

### 4. Mule Bank Accounts (Syndicate Fraud)
- **Pitfall**: Intermediaries or fraudsters submit dozens of applications across different farmer identities but channel benefits into a shared bank account under their control.
- **Mitigation**: Group applications by `bank_account_ifsc_key`. If more than 1 distinct farmer application routes to the same bank account, flag with `BANK_ACCOUNT_SHARED` (severity: High, weight: 35).

### 5. Over-Claimed Land Parcels
- **Pitfall**: Fraudsters claim subsidies using survey plot numbers that already belong to another farmer or have already been claimed in a previous application cycle.
- **Mitigation**: Derive standard `parcel_id` across state-district-tehsil-village-khata-plot. Detect when multiple applications attach to the same parcel (`DUPLICATE_PARCEL_BENEFIT` and `PARCEL_OVER_CLAIMED`).

### 6. Temporal and Geographic Surges
- **Pitfall**: Corrupt local centers mass-submit fraudulent applications right before payout release dates or in specific villages.
- **Mitigation**: Statistical checks comparing village application totals against historical beneficiary profiles (`GEO_ABNORMAL_CONCENTRATION`) and calendar event proximity analysis (`TIME_PRE_EVENT_SPIKE`).
