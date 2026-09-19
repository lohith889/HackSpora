# Plan 03-01 Summary: Identity, Land & Bank Anomaly Engines

## Execution Results
- **Status:** Complete ✓

### Files Created
1. **`backend/app/services/engine_types.py`**
   - `AnomalyFlagResult` dataclass: `anomaly_code`, `severity`, `score`, `rationale`, `evidence_json`
   - `SEVERITY_SCORES`: `{"Low": 10, "Medium": 25, "High": 40, "Critical": 55}`

2. **`backend/app/services/identity_engine.py`** — 5 flags:
   - `IDENTITY_EKYC_NOT_CONSENTED` (High/40)
   - `IDENTITY_EKYC_FAILED` (High/40)
   - `IDENTITY_OTP_NOT_VERIFIED` (Medium/25)
   - `IDENTITY_DUPLICATE_AADHAAR` (Critical/55) — cross-application aadhaar_ref dedup query
   - `IDENTITY_BULK_MOBILE` (Medium/25 or High/40) — escalating by shared count

3. **`backend/app/services/land_engine.py`** — 6 flags:
   - `LAND_PARCEL_NOT_FOUND` (Critical/55) — early return
   - `LAND_OWNER_AADHAAR_MISMATCH` (High/40)
   - `LAND_OWNER_NAME_MISMATCH` (Medium/25 or High/40) — `thefuzz.token_sort_ratio` < 80/65
   - `LAND_NOT_AGRICULTURAL` (High/40)
   - `LAND_OWNERSHIP_INACTIVE` (Medium/25)
   - `LAND_AREA_DISCREPANCY` (Medium/25 or High/40) — pct deviation > 20%/50%

4. **`backend/app/services/bank_engine.py`** — 6 flags:
   - `BANK_ACCOUNT_NOT_FOUND` (High/40) — early return
   - `BANK_IFSC_INVALID` (High/40)
   - `BANK_ACCOUNT_INACTIVE` (High/40)
   - `BANK_PENNY_DROP_FAILED` (Medium/25)
   - `BANK_NAME_MISMATCH` (Medium/25 or High/40) — fuzzy match
   - `BANK_MULE_ACCOUNT` (Critical/55) — 2+ distinct aadhaar_refs on same bank account

## Requirements Satisfied
- [x] **ENG-01**: Identity Engine with 5 flag types
- [x] **ENG-02**: Land Engine with 6 flag types
- [x] **ENG-03**: Bank Engine with 6 flag types
