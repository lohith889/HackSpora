# Phase 2 Verification: Scheme & Application Ingestion

**Phase:** 02-scheme-application-ingestion  
**Goal:** Provide scheme field specifications, process multipart application submissions with land documents, tokenize Aadhaar numbers with salt, and persist applications with citizen-safe status and role isolation.  
**Status:** PASSED ✓  
**Verified On:** 2026-09-19  

---

## 1. Requirements Coverage & Verification

| Requirement ID | Description | Status | Evidence / Verification Test |
|---|---|:---:|---|
| **SCHM-01** | User can fetch active scheme metadata and required fields via `/api/schemes/PM_KISAN/fields` | PASS | `test_get_pm_kisan_fields`, `test_get_invalid_scheme_fields` |
| **SCHM-02** | User can complete multi-section PM-KISAN form | PASS | `test_submit_application_success` |
| **SCHM-03** | Frontend and backend validate mock OTP (`123456`), Aadhaar 12-digit format, bank account length, IFSC format, and required declarations | PASS | `test_submit_invalid_otp`, `test_submit_invalid_aadhaar_format`, `test_submit_invalid_ifsc` |
| **SCHM-04** | Backend hashes Aadhaar with salt into `aadhaar_ref` and stores masked representation (`aadhaar_masked`), never storing raw Aadhaar | PASS | `test_aadhaar_privacy_never_stored_plaintext` |
| **APP-01** | User can upload land proof document (PDF, JPG, PNG <= 5MB) via multipart form-data | PASS | `test_submit_application_success`, `test_submit_invalid_file_extension`, `test_submit_invalid_file_size` |
| **APP-02** | Backend safely validates file extension, file size, and stores files in `backend/uploads/` with unique timestamped names | PASS | `test_submit_application_success`, `backend/app/services/application_service.py:save_upload_file` |
| **APP-03** | Backend generates standard composite identifiers: `parcel_id` and `bank_account_ifsc_key` | PASS | `test_submit_application_success`, `backend/app/utils.py` |
| **APP-04** | Backend creates persistent `applications` and `pm_kisan_application_details` records in SQLite | PASS | `test_submit_application_success`, `test_aadhaar_privacy_never_stored_plaintext` |
| **APP-05** | User receives immediate submission response with application ID, status, and citizen-friendly status message | PASS | `test_submit_application_success`, `test_farmer_get_my_applications` |

---

## 2. Automated Test Execution Evidence

Command executed: `python -m pytest -v`

```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-9.1.1, pluggy-1.6.0 -- C:\Program Files\Python311\python.exe
cachedir: .pytest_cache
rootdir: D:\lohith\hackspora\backend
plugins: anyio-4.11.0, Faker-20.1.0
collecting ... collected 22 items

tests/test_applications.py::test_get_pm_kisan_fields PASSED              [  4%]
tests/test_applications.py::test_get_invalid_scheme_fields PASSED        [  9%]
tests/test_applications.py::test_submit_application_success PASSED       [ 13%]
tests/test_applications.py::test_aadhaar_privacy_never_stored_plaintext PASSED [ 18%]
tests/test_applications.py::test_submit_invalid_file_extension PASSED    [ 22%]
tests/test_applications.py::test_submit_invalid_file_size PASSED         [ 27%]
tests/test_applications.py::test_submit_invalid_otp PASSED               [ 31%]
tests/test_applications.py::test_submit_invalid_aadhaar_format PASSED    [ 36%]
tests/test_applications.py::test_submit_invalid_ifsc PASSED              [ 40%]
tests/test_applications.py::test_farmer_get_my_applications PASSED       [ 45%]
tests/test_applications.py::test_farmer_view_application_redaction PASSED [ 50%]
tests/test_applications.py::test_farmer_cannot_view_other_farmer_application PASSED [ 54%]
tests/test_applications.py::test_admin_can_view_any_application PASSED   [ 59%]
tests/test_auth.py::test_health_check PASSED                             [ 63%]
tests/test_auth.py::test_register_user PASSED                            [ 68%]
tests/test_auth.py::test_register_duplicate_email PASSED                 [ 72%]
tests/test_auth.py::test_login_success PASSED                            [ 77%]
tests/test_auth.py::test_login_invalid_password PASSED                   [ 81%]
tests/test_auth.py::test_login_nonexistent_email PASSED                  [ 86%]
tests/test_auth.py::test_get_current_user_me PASSED                      [ 90%]
tests/test_auth.py::test_get_current_user_unauthorized PASSED            [ 95%]
tests/test_auth.py::test_role_guard_restriction PASSED                   [100%]

============================= 22 passed in 11.88s =============================
```

---

## 3. Privacy & Role-Isolation Audit

1. **Aadhaar Privacy**: Verified that when a farmer submits a 12-digit Aadhaar number, the plaintext digits are never saved in the database or reflected in any logs. Only `aadhaar_ref` (salted SHA-256) and `aadhaar_masked` (`XXXX-XXXX-1012`) exist.
2. **Citizen Data Redaction**: Confirmed that `GET /api/applications/{id}` for a citizen (`USER`) returns `CitizenApplicationDetail`, which completely suppresses and redacts `risk_score`, `confidence_level`, `recommended_action`, `anomaly_report`, and `anomaly_flags`.
3. **Cross-Tenant Access Control**: Confirmed that Farmer A cannot access Farmer B's application dossier (returns HTTP 403 Forbidden). Scheme Officers (`ADMIN`) have authorized access to all application dossiers.

**Phase 2 is 100% complete and verified.**
