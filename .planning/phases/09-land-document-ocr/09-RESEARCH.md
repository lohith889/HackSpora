# Phase 9 Research: Land Document OCR & Automated ID Verification

**Phase:** 09-land-document-ocr  
**Date:** 2026-09-20  
**Scope:** Automated OCR text extraction, Land Document / Parcel ID parsing, deterministic cross-reconciliation with application claims and master registry, anomaly engine integration, and Scheme Officer audit dossier.

---

## 1. Problem Statement & Objectives

Currently, when a farmer submits a PM-KISAN application via `POST /api/applications/pm-kisan`, the uploaded land deed (PDF/JPG/PNG) is validated for file size (<= 5MB) and extension, stored in `backend/uploads/`, and its path is saved in `PMKisanApplicationDetails.land_document_path`. However:
1. **No content inspection** is performed on the uploaded file.
2. An applicant could upload an unrelated document (e.g., an electricity bill, blank PDF, or deed for a completely different plot) and the system would only discover discrepancies if an officer manually downloads and reads every file.
3. The primary identifiers—**Land Document ID / Registration Number**, **Khasra / Plot Number**, **Khatauni Number**, and **Owner Name**—must be extracted automatically upon upload and matched against declared claims.

### Goals
- **OCR-01 (Multi-Format Extraction Pipeline)**: Extract textual content from both digital PDFs and raster images (JPG, PNG, scanned PDF pages) using lightweight offline tools (`pymupdf`, `pypdf`, `easyocr`, `Pillow`).
- **OCR-02 (Entity Parsing & ID Extraction)**: Identify Land Document IDs (`DOC-...`, `REG-...`, `UP-LKO-...`), Khasra/Plot numbers, Khata numbers, and titleholder names using robust regex patterns tailored for Indian revenue department records (e.g., UP Bhulekh, MP Bhulekh, RoR extracts).
- **OCR-03 (Cross-Reconciliation Logic)**: Compare extracted entities against declared application attributes (`parcel_id`, `khata_number`, `plot_number`, `farmer_name`) and `land_records_master`. Assign `ocr_status` (`SUCCESS`, `PARTIAL`, `FAILED`, `UNREADABLE`) and `ocr_match_status` (`MATCHED`, `MISMATCH`, `UNVERIFIED`).
- **OCR-04 (Anomaly Detection Integration)**: Extend `LandEngine` to evaluate OCR results. Trigger `LAND_DOC_ID_MISMATCH` (High severity, 40 score) on conflicting document IDs, and `LAND_DOC_OCR_UNREADABLE` (Medium severity, 20 score) on illegible files.
- **OCR-05 (Admin Dossier UI & Auditability)**: Add a dedicated **Land Deed OCR Verification Dossier** in `AdminApplicationDetailPage.jsx` displaying match badges, comparison grid (Declared vs. Extracted), confidence score, and raw extracted text inspector.

---

## 2. Technical Stack & Offline Execution Constraints

Per `AGENTS.md` and HackSpora 2.0 hackathon rules:
- **Strict Offline Invariant**: Zero cloud dependencies. No AWS Textract, Google Cloud Vision, Azure Cognitive Services, or remote OCR APIs.
- **Local Tool Evaluation**:
  | Tool / Library | Capability | Latency | Dependency Footprint | Role in Phase 9 |
  |---|---|---|---|---|
  | **PyMuPDF (`pymupdf` / `fitz`)** | Digital PDF text, layout blocks, metadata, image extraction | < 5ms | Pre-installed (`1.28.2`) | **Primary Tier-1 Engine** for digital PDFs (fastest, 100% accurate) |
  | **`pypdf`** | Digital PDF parsing fallback | < 10ms | Pre-installed (`6.19.0`) | Secondary digital PDF reader fallback |
  | **`Pillow` (PIL)** | Image loading, resizing, preprocessing | < 10ms | Pre-installed (`12.3.0`) | Image handler for JPG/PNG uploads |
  | **`easyocr`** | Deep-learning OCR for scanned images & non-digital PDF pages | ~150-300ms (CPU) | Installed (`1.7.2`) | **Tier-2 Engine** for raster images and scanned deeds |
  | **`reportlab`** | Synthetic PDF generator | < 15ms | Pre-installed (`5.0.1`) | Generates realistic Bhulekh RoR/Khatauni test fixtures |

---

## 3. Entity Extraction & Pattern Matching Architecture

Indian land records (specifically Uttar Pradesh Bhulekh RoR / Khatauni extracts) contain predictable structural markers:
1. **Document / Registration ID**:
   - `Document No: DOC-UP-2024-884920`
   - `Registration No: REG/2023/55412`
   - `Bhulekh Record Ref: UP-LKO-MAL-V001-K102-P45`
   - Regex patterns:
     - `(?:Doc(?:ument)?|Registration|Reg|Certificate|Deed|RoR|Record)\s*(?:No\.?|Number|ID|Ref|Code)?\s*[:\-#]?\s*([A-Z0-9\-\/]{6,35})`
     - `\b(?:UP|MH|MP|RJ|PB|HR|GJ|KA|TN|AP|TS|BR|WB)-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+\b`
2. **Khasra / Plot Number**:
   - `Khasra No: 45` or `Plot No: P45` or `Gata Sankhya: 45`
   - Regex: `(?:Khasra|Plot|Survey|Gata)\s*(?:No\.?|Number|Sankhya)?\s*[:\-#]?\s*([A-Z0-9\/\-]+)`
3. **Khata / Khatauni Number**:
   - `Khata No: 102` or `Khatauni Sankhya: 102`
   - Regex: `(?:Khata(?:uni)?)\s*(?:No\.?|Number|Sankhya)?\s*[:\-#]?\s*([A-Z0-9\/\-]+)`
4. **Land Area**:
   - `Area: 1.85 Ha` or `Rakba: 1.85 Hectare`
   - Regex: `(?:Area|Rakba|Land\s*Area)\s*[:\-#]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:Ha|Hectare|Hectares|Acre|Acres)?`
5. **Owner Name**:
   - `Titleholder: Ramesh Kumar` or `Bhumidhar / Malik: Ramesh Kumar`
   - Regex: `(?:Owner|Titleholder|Farmer|Bhumidhar|Malik|Name)\s*[:\-#]?\s*([A-Za-z\s\.]{3,50})`

---

## 4. Reconciling Extracted ID vs. Application Claim

Once entities are parsed:
```python
def reconcile_land_document(extracted: dict, details: PMKisanApplicationDetails) -> tuple[str, float]:
    """
    Returns (ocr_match_status, ocr_confidence_score)
    ocr_match_status in ['MATCHED', 'MISMATCH', 'UNVERIFIED']
    """
```
- **MATCHED**:
  - If `extracted['doc_id']` contains or equals `details.parcel_id`, OR
  - If `extracted['khasra']` equals `details.plot_number` (or normalized match) AND `extracted['khata']` equals `details.khata_number`.
  - Confidence: 90% - 98%.
- **MISMATCH**:
  - If a valid Document ID or Plot/Khasra is clearly extracted from the document, but it does NOT match `details.parcel_id` or `details.plot_number`.
  - Example: Claim declares Plot `P45` in Village `V001`, but document clearly certifies Plot `P999` in Village `V009`.
  - Confidence: 85% - 95%.
- **UNVERIFIED**:
  - Document text is blank, illegible, or contains no detectable revenue markers.
  - Confidence: < 30%.

---

## 5. Anomaly Engine & Risk Scorer Impact

When `ocr_match_status == "MISMATCH"`:
- `LandEngine` appends `LAND_DOC_ID_MISMATCH`:
  - Severity: `High`
  - Score: `40`
  - Rationale: *"Uploaded land proof document certifies Document/Plot ID '{extracted_doc_id}', which directly conflicts with the claimed parcel '{details.parcel_id}'. Possible forged or recycled land deed."*
- When `ocr_status == "UNREADABLE"`:
  - `LandEngine` appends `LAND_DOC_OCR_UNREADABLE`:
    - Severity: `Medium`
    - Score: `20`
    - Rationale: *"Uploaded land deed is unreadable, blank, or corrupted. Automated OCR could not verify parcel ownership. Manual officer inspection required."*

---

## 6. Schema & Persistence Changes

In `backend/app/models.py` (`PMKisanApplicationDetails`):
- `ocr_extracted_doc_id`: `Column(String(150), nullable=True)`
- `ocr_status`: `Column(String(50), default="PENDING", nullable=False)`
- `ocr_match_status`: `Column(String(50), default="UNVERIFIED", nullable=False)`
- `ocr_confidence_score`: `Column(Float, default=0.0, nullable=False)`
- `ocr_extracted_data`: `Column(JSON, nullable=True)` (stores dict with `khasra`, `khata`, `owner_name`, `area_ha`, `raw_snippet`)

---

## 7. Frontend Integration Plan

In `AdminApplicationDetailPage.jsx`:
- Display a dedicated **Land Deed Document & OCR Inspection** card under Land Details.
- Include:
  - Download / View Land Document action.
  - OCR Status Badges:
    - `Verified Match` (Emerald badge with CheckCircle icon)
    - `ID Mismatch Alert` (Red badge with AlertTriangle icon)
    - `Unreadable / Pending` (Amber badge with HelpCircle icon)
  - Comparison table:
    | Attribute | Declared Claim | OCR Extracted From Deed | Match Status |
    |---|---|---|---|
    | Document / Parcel ID | `UP-LKO-MAL-V001-K102-P45` | `UP-LKO-MAL-V001-K102-P45` | Matched ✓ |
    | Khata Number | `102` | `102` | Matched ✓ |
    | Plot / Khasra | `45` | `45` | Matched ✓ |
    | Land Area | `1.85 Ha` | `1.85 Ha` | Matched ✓ |
  - Collapsible drawer showing the raw extracted text snippet for complete officer transparency.
