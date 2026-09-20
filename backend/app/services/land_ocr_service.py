"""
Land Document OCR & Automated ID Verification Service — Phase 9 (OCR-01, OCR-02, OCR-03)

Provides 100% offline text extraction, revenue record entity parsing, and deterministic
reconciliation against PM-KISAN subsidy claims and state land registries.
"""

import os
import re
import logging
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

# Try importing PDF / Image / OCR libraries with safe fallbacks
try:
    import pymupdf  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False

try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False

# Lazy-loaded EasyOCR reader singleton to avoid memory overhead
_easyocr_reader = None


def get_ocr_reader():
    """Lazy initialize EasyOCR reader with English recognition on CPU."""
    global _easyocr_reader
    if _easyocr_reader is None and EASYOCR_AVAILABLE:
        try:
            # Silence internal download progress bar encoding issues
            _easyocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        except Exception as e:
            logger.warning(f"EasyOCR reader initialization failed: {e}")
            _easyocr_reader = None
    return _easyocr_reader


def extract_text_from_file(file_path: str) -> str:
    """
    Extract text content from an uploaded land deed document (PDF, PNG, JPG).
    Uses fast PyMuPDF / pypdf for digital PDFs, and EasyOCR / Pillow for images and raster pages.
    """
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return ""

    _, ext = os.path.splitext(file_path.lower())

    # ── 1. PDF Processing ───────────────────────────────────────────────
    if ext == ".pdf":
        text_content = ""

        # Strategy A: PyMuPDF digital text extraction (fastest: < 5ms)
        if PYMUPDF_AVAILABLE:
            try:
                doc = pymupdf.open(file_path)
                for page in doc:
                    text_content += page.get_text() + "\n"
                doc.close()
                if text_content.strip():
                    return text_content.strip()
            except Exception as e:
                logger.warning(f"PyMuPDF text extraction failed for {file_path}: {e}")

        # Strategy B: pypdf fallback for digital text
        if not text_content.strip() and PYPDF_AVAILABLE:
            try:
                reader = pypdf.PdfReader(file_path)
                for page in reader.pages:
                    page_text = page.extract_text() or ""
                    text_content += page_text + "\n"
                if text_content.strip():
                    return text_content.strip()
            except Exception as e:
                logger.warning(f"pypdf extraction fallback failed: {e}")

        # Strategy C: Scanned/Raster PDF page extraction via PyMuPDF + EasyOCR
        if not text_content.strip() and PYMUPDF_AVAILABLE and EASYOCR_AVAILABLE:
            try:
                reader = get_ocr_reader()
                if reader:
                    doc = pymupdf.open(file_path)
                    for page_idx in range(min(len(doc), 3)):  # inspect first 3 pages max
                        page = doc[page_idx]
                        pix = page.get_pixmap(dpi=150)
                        image_bytes = pix.tobytes("png")
                        results = reader.readtext(image_bytes, detail=0)
                        text_content += " ".join(results) + "\n"
                    doc.close()
                    if text_content.strip():
                        return text_content.strip()
            except Exception as e:
                logger.warning(f"PyMuPDF raster page OCR failed: {e}")

        return text_content.strip()

    # ── 2. Image Processing (JPG, PNG, JPEG) ────────────────────────────
    elif ext in {".jpg", ".jpeg", ".png"}:
        text_content = ""

        if EASYOCR_AVAILABLE:
            try:
                reader = get_ocr_reader()
                if reader:
                    results = reader.readtext(file_path, detail=0)
                    text_content = " ".join(results)
                    if text_content.strip():
                        return text_content.strip()
            except Exception as e:
                logger.warning(f"EasyOCR image processing failed for {file_path}: {e}")

        # Fallback: Basic metadata or text if pillow available
        if not text_content.strip() and PILLOW_AVAILABLE:
            try:
                with Image.open(file_path) as img:
                    info = img.info.get("description") or img.info.get("comment") or ""
                    if info:
                        return str(info)
            except Exception:
                pass

        return text_content.strip()

    return ""


def parse_land_entities(text: str) -> Dict[str, Any]:
    """
    Parse land revenue identifiers and attributes from extracted text using
    regular expressions tailored for Indian revenue department records (e.g. UP Bhulekh RoR).
    """
    if not text or not text.strip():
        return {
            "doc_id": None,
            "khasra_plot": None,
            "khata_number": None,
            "land_area_ha": None,
            "owner_name": None,
            "raw_snippet": "",
        }

    # Normalize whitespace for cleaner regex evaluation
    normalized = " ".join(text.split())
    raw_snippet = text[:1000].strip()

    document_number = None
    parcel_code = None
    khasra_plot = None
    khata_number = None
    land_area_ha = None
    owner_name = None

    # 1. Document / Registration / Deed Number pattern (e.g., DOC-UP-2024-001001, REG/2024/99)
    doc_regexes = [
        r"(?:Document|Registration|Reg|Certificate|Deed|RoR|Bhulekh\s*Record)\s*(?:No\.?|Number|ID|Ref|Code)?\s*[:\-#]?\s*([A-Z0-9\-\/]{6,35})",
        r"\b((?:DOC|REG|ROR|DEED|CERT)[\s\-_:/#]*[A-Z0-9\-_/]{6,30})\b",
    ]
    for pattern in doc_regexes:
        match = re.search(pattern, normalized, re.IGNORECASE)
        if match:
            candidate = match.group(1).strip().replace(" ", "").upper()
            if not any(candidate.startswith(k) for k in ["NUMBER", "DATE", "NAME", "VILLAGE"]):
                document_number = candidate
                break

    # 1b. Standard Composite Parcel ID pattern (e.g., UP-LKO-MAL-V001-K102-P45)
    parcel_regex = r"\b((?:UP|MH|MP|RJ|PB|HR|GJ|KA|TN|AP|TS|BR|WB)-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+)\b"
    parcel_match = re.search(parcel_regex, normalized, re.IGNORECASE)
    if parcel_match:
        parcel_code = parcel_match.group(1).upper()

    # Composite doc_id for backward compatibility: parcel_code if found, else document_number
    doc_id = parcel_code if parcel_code else document_number

    stopwords = {"EXTRACT", "RECORD", "SYSTEM", "DETAILS", "CERTIFICATE", "COPY", "REPORT", "INFORMATION", "PORTAL", "DEPARTMENT"}

    # 2. Khasra / Plot Number (e.g., Khasra No: 45, Plot Number: 45, Plot: P45)
    plot_regexes = [
        r"(?:Khasra|Plot|Survey|Gata)\s*(?:No\.?|Number|Sankhya)?\s*[:\-#]\s*([A-Z0-9\/\-]+)",
        r"(?:Khasra|Plot|Survey|Gata)\s+(?:No\.?|Number|Sankhya)\s*[:\-#]?\s*([A-Z0-9\/\-]+)",
        r"\b(?:Plot|Khasra)\s*[:\-#]\s*([A-Z0-9\/\-]+)\b",
    ]
    for pattern in plot_regexes:
        for match in re.finditer(pattern, normalized, re.IGNORECASE):
            candidate = match.group(1).strip().upper()
            if candidate not in stopwords and (any(c.isdigit() for c in candidate) or candidate.startswith(('P', 'K'))):
                khasra_plot = candidate
                break
        if khasra_plot:
            break

    # 3. Khata / Khatauni Number (e.g., Khatauni Number: 102, Khata No: 102)
    khata_regexes = [
        r"(?:Khata(?:uni)?)\s*(?:No\.?|Number|Sankhya)?\s*[:\-#]\s*([A-Z0-9\/\-]+)",
        r"(?:Khata(?:uni)?)\s+(?:No\.?|Number|Sankhya)\s*[:\-#]?\s*([A-Z0-9\/\-]+)",
        r"\b(?:Khata)\s*[:\-#]\s*([A-Z0-9\/\-]+)\b",
    ]
    for pattern in khata_regexes:
        for match in re.finditer(pattern, normalized, re.IGNORECASE):
            candidate = match.group(1).strip().upper()
            if candidate not in stopwords and (any(c.isdigit() for c in candidate) or candidate.startswith(('K', 'P'))):
                khata_number = candidate
                break
        if khata_number:
            break

    # 4. Land Area in Hectares / Acres
    area_regex = r"(?:Area|Rakba|Land\s*Area)\s*[:\-#]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:Ha|Hectare|Hectares|Acre|Acres)?"
    area_match = re.search(area_regex, normalized, re.IGNORECASE)
    if area_match:
        try:
            land_area_ha = float(area_match.group(1))
        except ValueError:
            land_area_ha = None

    # 5. Owner / Titleholder Name
    owner_regexes = [
        r"(?:Owner|Titleholder|Farmer|Bhumidhar|Malik|Pattedar|Name)\s*[:\-#]?\s*([A-Za-z\s\.]{3,50})(?:,|\.|\n|Father|S\/o|W\/o|D\/o|Khata|Plot|$)",
    ]
    for pattern in owner_regexes:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate_name = match.group(1).strip()
            # Avoid matching headers
            if candidate_name and not candidate_name.upper().startswith(("BHULEKH", "GOVERNMENT", "DEPARTMENT", "REVENUE")):
                owner_name = candidate_name
                break

    return {
        "doc_id": doc_id,
        "document_number": document_number,
        "parcel_id": parcel_code,
        "khasra_plot": khasra_plot,
        "khata_number": khata_number,
        "land_area_ha": land_area_ha,
        "owner_name": owner_name,
        "raw_snippet": raw_snippet,
    }


def verify_deed_with_govt_registry(
    db,
    extracted: Dict[str, Any],
    declared_parcel_id: str,
    declared_name: str,
) -> Dict[str, Any]:
    """
    Cross-verify extracted deed details against the official LandDeedRegistryMaster table.
    Returns structured government reconciliation results.
    """
    if db is None:
        return {
            "status": "UNVERIFIED",
            "document_number": extracted.get("document_number") or extracted.get("doc_id"),
            "details_message": "Government deed registry session offline / unqueried.",
        }

    doc_number = extracted.get("document_number")
    doc_id = extracted.get("doc_id")
    parcel_code = extracted.get("parcel_id")
    raw_snippet = extracted.get("raw_snippet", "")

    if not raw_snippet or len(raw_snippet.strip()) < 15:
        return {
            "status": "NOT_EXTRACTABLE",
            "document_number": None,
            "details_message": "Document text stream unreadable; could not resolve deed registration number.",
        }

    from app.models import LandDeedRegistryMaster

    record = None
    # 1. Search by document_number if extracted
    candidates = [c for c in [doc_number, doc_id, parcel_code] if c]
    for cand in candidates:
        clean_c = cand.replace(" ", "").upper()
        clean_nodash = clean_c.replace("-", "")
        for r in db.query(LandDeedRegistryMaster).all():
            r_doc = (r.document_number or "").upper()
            r_parcel = (r.parcel_id or "").upper()
            if (r_doc == clean_c or 
                r_doc.replace("-", "") == clean_nodash or 
                r_parcel == clean_c or 
                r_parcel.replace("-", "") == clean_nodash):
                record = r
                break
        if record:
            break

    if not record:
        cand_id = doc_number or doc_id
        return {
            "status": "NOT_FOUND",
            "document_number": cand_id,
            "registered_owner": None,
            "registered_parcel_id": None,
            "sro_office": None,
            "registration_date": None,
            "deed_status": "UNRECORDED",
            "deed_type": None,
            "details_message": f"Document ID '{cand_id or 'Unknown'}' was not found in Government Central Sub-Registrar Archive.",
        }

    # Record found! Check status:
    if record.deed_status in ["REVOKED", "CANCELLED", "DISPUTED"]:
        return {
            "status": "REVOKED",
            "document_number": record.document_number,
            "registered_owner": record.owner_name,
            "registered_parcel_id": record.parcel_id,
            "land_area_ha": record.land_area_ha,
            "sro_office": record.sub_registrar_office,
            "registration_date": str(record.registration_date),
            "deed_status": record.deed_status,
            "deed_type": record.deed_type,
            "details_message": f"CRITICAL: Land deed '{record.document_number}' is marked as {record.deed_status} in Government SRO Archive.",
        }

    clean_decl_parcel = normalize_id(declared_parcel_id)
    clean_rec_parcel = normalize_id(record.parcel_id)

    # Name similarity check
    try:
        from thefuzz import fuzz
        name_sim = fuzz.token_sort_ratio((declared_name or "").lower(), (record.owner_name or "").lower())
    except ImportError:
        name_sim = 100 if (declared_name or "").strip().lower() in (record.owner_name or "").strip().lower() else 50

    if clean_decl_parcel and clean_rec_parcel and clean_decl_parcel != clean_rec_parcel:
        return {
            "status": "MISMATCH",
            "document_number": record.document_number,
            "registered_owner": record.owner_name,
            "registered_parcel_id": record.parcel_id,
            "land_area_ha": record.land_area_ha,
            "sro_office": record.sub_registrar_office,
            "registration_date": str(record.registration_date),
            "deed_status": record.deed_status,
            "deed_type": record.deed_type,
            "name_match_pct": name_sim,
            "details_message": f"Title Divergence: Government Deed '{record.document_number}' is registered for parcel '{record.parcel_id}', contradicting declared parcel '{declared_parcel_id}'.",
        }

    if name_sim < 60:
        return {
            "status": "MISMATCH",
            "document_number": record.document_number,
            "registered_owner": record.owner_name,
            "registered_parcel_id": record.parcel_id,
            "land_area_ha": record.land_area_ha,
            "sro_office": record.sub_registrar_office,
            "registration_date": str(record.registration_date),
            "deed_status": record.deed_status,
            "deed_type": record.deed_type,
            "name_match_pct": name_sim,
            "details_message": f"Owner Mismatch: Government Deed '{record.document_number}' is registered to '{record.owner_name}', conflicting with applicant '{declared_name}'.",
        }

    return {
        "status": "VERIFIED",
        "document_number": record.document_number,
        "registered_owner": record.owner_name,
        "registered_parcel_id": record.parcel_id,
        "land_area_ha": record.land_area_ha,
        "sro_office": record.sub_registrar_office,
        "registration_date": str(record.registration_date),
        "deed_status": record.deed_status,
        "deed_type": record.deed_type,
        "name_match_pct": name_sim,
        "details_message": f"Official Government Verification Confirmed: Registered in {record.sub_registrar_office} under {record.deed_status} status.",
    }


def normalize_id(val: Optional[str]) -> str:
    """Normalize identifiers by removing common prefixes and non-alphanumerics."""
    if not val:
        return ""
    clean = re.sub(r"[^A-Za-z0-9]", "", val).upper()
    # Strip leading 'P' or 'K' if comparing numbers (e.g., P45 -> 45, K102 -> 102)
    if len(clean) > 1 and clean[0] in ('P', 'K') and clean[1:].isdigit():
        return clean[1:]
    return clean


def reconcile_land_document(
    extracted: Dict[str, Any],
    declared_parcel_id: str,
    declared_khata: str,
    declared_plot: str,
    declared_name: str,
) -> Tuple[str, str, float]:
    """
    Reconcile parsed entities from the uploaded land deed against declared claims.
    Returns: (ocr_status, ocr_match_status, ocr_confidence_score)
      - ocr_status: "SUCCESS", "PARTIAL", "FAILED", "UNREADABLE"
      - ocr_match_status: "MATCHED", "MISMATCH", "UNVERIFIED"
      - ocr_confidence_score: 0.0 to 1.0
    """
    raw_snippet = extracted.get("raw_snippet", "")
    extracted_doc_id = extracted.get("doc_id")
    extracted_plot = extracted.get("khasra_plot")
    extracted_khata = extracted.get("khata_number")

    # If document has no extractable text or is empty
    if not raw_snippet or len(raw_snippet.strip()) < 15:
        return ("UNREADABLE", "UNVERIFIED", 0.10)

    # Clean versions for matching
    clean_decl_parcel = normalize_id(declared_parcel_id)
    clean_decl_plot = normalize_id(declared_plot)
    clean_decl_khata = normalize_id(declared_khata)

    clean_ext_doc = normalize_id(extracted_doc_id) if extracted_doc_id else ""
    clean_ext_plot = normalize_id(extracted_plot) if extracted_plot else ""
    clean_ext_khata = normalize_id(extracted_khata) if extracted_khata else ""

    # Case 1: Exact or Substring Parcel ID Match
    if extracted_doc_id:
        if clean_decl_parcel in clean_ext_doc or clean_ext_doc in clean_decl_parcel:
            return ("SUCCESS", "MATCHED", 0.98)

    # Case 2: Plot and Khata Match
    if clean_ext_plot and clean_ext_khata:
        if clean_ext_plot == clean_decl_plot and clean_ext_khata == clean_decl_khata:
            return ("SUCCESS", "MATCHED", 0.94)

    # Case 3: Single Plot Match if document clearly indicates it
    if clean_ext_plot and clean_ext_plot == clean_decl_plot and not extracted_doc_id:
        return ("PARTIAL", "MATCHED", 0.88)

    # Case 4: Mismatch Detection — Document has an extracted ID or Plot, but contradicts the claim!
    if extracted_doc_id and clean_ext_doc != clean_decl_parcel:
        # Check if the extracted ID is a distinct parcel or revenue ref
        if len(clean_ext_doc) >= 6:
            return ("SUCCESS", "MISMATCH", 0.92)

    if extracted_plot and clean_ext_plot != clean_decl_plot:
        # Plot clearly doesn't match
        return ("PARTIAL", "MISMATCH", 0.86)

    # Case 5: Document has general text but revenue identifiers could not be determined
    return ("PARTIAL", "UNVERIFIED", 0.40)


def process_uploaded_land_document(
    file_path: str,
    declared_parcel_id: str,
    declared_khata: str,
    declared_plot: str,
    declared_name: str,
    db: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Main entry point for processing an uploaded land deed document:
    1. Extracts text from file (digital PDF or image).
    2. Parses revenue entities (doc_id, document_number, khasra, khata, area, owner).
    3. Reconciles against declared application claims.
    4. Cross-verifies against official Government SRO Central Registry (LandDeedRegistryMaster).
    5. Returns structured results for database persistence.
    """
    try:
        text = extract_text_from_file(file_path)
        extracted = parse_land_entities(text)
        status, match_status, confidence = reconcile_land_document(
            extracted=extracted,
            declared_parcel_id=declared_parcel_id,
            declared_khata=declared_khata,
            declared_plot=declared_plot,
            declared_name=declared_name,
        )

        govt_verification = verify_deed_with_govt_registry(
            db=db,
            extracted=extracted,
            declared_parcel_id=declared_parcel_id,
            declared_name=declared_name,
        )

        # If government deed archive indicates titleholder mismatch or revoked deed, reflect MISMATCH
        if govt_verification.get("status") in ["MISMATCH", "REVOKED"]:
            match_status = "MISMATCH"

        return {
            "ocr_extracted_doc_id": extracted.get("doc_id") or extracted.get("document_number") or extracted.get("khasra_plot"),
            "ocr_status": status,
            "ocr_match_status": match_status,
            "ocr_confidence_score": confidence,
            "ocr_extracted_data": {
                "doc_id": extracted.get("doc_id"),
                "document_number": extracted.get("document_number"),
                "parcel_id": extracted.get("parcel_id"),
                "khasra_plot": extracted.get("khasra_plot"),
                "khata_number": extracted.get("khata_number"),
                "land_area_ha": extracted.get("land_area_ha"),
                "owner_name": extracted.get("owner_name"),
                "raw_snippet": extracted.get("raw_snippet", "")[:600],
                "govt_registry": govt_verification,
            },
        }
    except Exception as e:
        logger.error(f"Error processing land document '{file_path}': {e}", exc_info=True)
        return {
            "ocr_extracted_doc_id": None,
            "ocr_status": "FAILED",
            "ocr_match_status": "UNVERIFIED",
            "ocr_confidence_score": 0.0,
            "ocr_extracted_data": {"error": str(e)},
        }
