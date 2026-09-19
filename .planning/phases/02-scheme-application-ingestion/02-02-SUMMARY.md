# Plan 02-02 Summary: Multipart Application Ingestion, Secure File Storage & Role-Isolated Tracking

## Execution Results
- **Status:** Complete ✓
- **Tasks Executed:**
  1. `backend/app/services/application_service.py`:
     - Created `save_upload_file(...)` with strict MIME type checking (`.pdf`, `.jpg`, `.jpeg`, `.png`), size limit enforcement (max 5MB), and unique timestamped filename generation in `backend/uploads/`.
     - Created `create_pm_kisan_application(...)` with complete business validation:
       - Mock OTP check (`123456`)
       - Aadhaar format check (12 numeric digits)
       - Salted SHA-256 tokenization into `aadhaar_ref` and masking into `aadhaar_masked` (raw Aadhaar discarded immediately and never persisted)
       - Bank account length check (9-18 digits) and standard IFSC regex validation
       - Land area validation (> 0 Ha)
       - Automated composite key generation (`parcel_id` and `bank_account_ifsc_key`)
       - Persistence of `Application` and `PMKisanApplicationDetails` records in SQLite.
     - Implemented `get_user_applications(...)` and `get_application_by_id(...)`.
  2. `backend/app/routes/application_routes.py`:
     - `POST /api/applications/pm-kisan`: Accepts multipart form payload + file upload, returns 201 Created with `ApplicationSubmissionResponse` and citizen-friendly status message.
     - `GET /api/applications/my`: Returns list of applications for current logged-in citizen (`CitizenApplicationSummary`).
     - `GET /api/applications/{id}`: Role-aware endpoint:
       - If role is `USER`: validates application ownership, returns `CitizenApplicationDetail` with masked bank details, strictly redacting all risk scores, confidence ratings, and anomaly flags.
       - If role is `ADMIN`: returns `AdminApplicationDetail` with full internal dossier and flags.
  3. `backend/tests/conftest.py` & `backend/tests/test_applications.py`:
     - Built unified test database fixture with SQLite `StaticPool` and clean isolation.
     - Implemented 13 comprehensive automated tests verifying scheme specs, multipart uploads, invalid file rejection, invalid OTP rejection, Aadhaar privacy (asserting raw 12 digits never in DB), composite keys, farmer application tracking, and strict role redaction.
     - All 22 tests across Phase 1 and Phase 2 pass with 100% success in under 12 seconds.

## Requirements Satisfied
- [x] **SCHM-02**: User can submit multi-section PM-KISAN form.
- [x] **SCHM-04**: Backend hashes Aadhaar with salt into `aadhaar_ref` and stores masked representation (`aadhaar_masked`), never storing raw Aadhaar.
- [x] **APP-01**: User can upload land proof document (PDF, JPG, PNG <= 5MB) via multipart form-data.
- [x] **APP-02**: Backend safely validates file extension, file size, and stores files in `backend/uploads/` with unique timestamped names.
- [x] **APP-04**: Backend creates persistent `applications` and `pm_kisan_application_details` records in SQLite.
- [x] **APP-05**: User receives immediate submission response with application ID, status, and citizen-friendly status message.
