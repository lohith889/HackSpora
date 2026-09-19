from fastapi import APIRouter, HTTPException, status
from app.schemas import (
    SchemeMetadataResponse,
    SchemeSectionSpec,
    SchemeFieldSpec,
    SchemeFieldOption,
)

scheme_router = APIRouter(prefix="/schemes", tags=["Schemes"])

PM_KISAN_METADATA = SchemeMetadataResponse(
    scheme_code="PM_KISAN",
    scheme_name="Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)",
    version="2.0",
    description=(
        "Central sector scheme providing financial assistance of ₹6,000 per year "
        "payable in three equal installments of ₹2,000 every four months to all "
        "eligible landholding farmer families across the country."
    ),
    allowed_mime_types=["application/pdf", "image/jpeg", "image/png"],
    max_file_size_mb=5,
    sections=[
        SchemeSectionSpec(
            section_id="personal_details",
            title="1. Personal Details",
            description="Basic demographic and applicant background information as registered in government records.",
            fields=[
                SchemeFieldSpec(
                    name="farmer_name",
                    label="Farmer Full Name (as per Aadhaar)",
                    type="text",
                    required=True,
                    placeholder="Enter full legal name",
                    help_text="Name must match Aadhaar card and land records.",
                ),
                SchemeFieldSpec(
                    name="date_of_birth",
                    label="Date of Birth",
                    type="date",
                    required=True,
                    help_text="Applicant must be at least 18 years of age.",
                ),
                SchemeFieldSpec(
                    name="gender",
                    label="Gender",
                    type="select",
                    required=True,
                    options=[
                        SchemeFieldOption(label="Male", value="Male"),
                        SchemeFieldOption(label="Female", value="Female"),
                        SchemeFieldOption(label="Other", value="Other"),
                    ],
                ),
                SchemeFieldSpec(
                    name="category",
                    label="Farmer Category",
                    type="select",
                    required=False,
                    options=[
                        SchemeFieldOption(label="General", value="General"),
                        SchemeFieldOption(label="OBC", value="OBC"),
                        SchemeFieldOption(label="SC", value="SC"),
                        SchemeFieldOption(label="ST", value="ST"),
                    ],
                ),
            ],
        ),
        SchemeSectionSpec(
            section_id="mobile_verification",
            title="2. Mobile Verification (OTP)",
            description="Two-factor phone verification to prevent bulk syndicated registrations.",
            fields=[
                SchemeFieldSpec(
                    name="mobile_number",
                    label="Aadhaar-Linked Mobile Number",
                    type="text",
                    required=True,
                    placeholder="10-digit mobile number",
                    validation_regex=r"^[6-9]\d{9}$",
                    help_text="Must be active and linked to Aadhaar for receiving DBT alerts.",
                ),
                SchemeFieldSpec(
                    name="otp",
                    label="Verification OTP",
                    type="text",
                    required=True,
                    placeholder="Enter 6-digit OTP",
                    validation_regex=r"^\d{6}$",
                    help_text="Mock testing OTP is 123456.",
                ),
            ],
        ),
        SchemeSectionSpec(
            section_id="identity_aadhaar",
            title="3. Identity & e-KYC",
            description="Aadhaar tokenization and consent. Raw numbers are never permanently stored.",
            fields=[
                SchemeFieldSpec(
                    name="aadhaar_number",
                    label="12-Digit Aadhaar Number",
                    type="text",
                    required=True,
                    placeholder="XXXX XXXX XXXX",
                    validation_regex=r"^\d{12}$",
                    help_text="Encrypted using salted SHA-256 immediately upon entry; only masked preview is retained.",
                ),
                SchemeFieldSpec(
                    name="e_kyc_consent",
                    label="Consent for UIDAI e-KYC Verification",
                    type="checkbox",
                    required=True,
                    help_text="I authorize PM-KISAN authority to verify my identity against UIDAI Aadhaar registry.",
                ),
            ],
        ),
        SchemeSectionSpec(
            section_id="bank_details",
            title="4. Direct Benefit Transfer (DBT) Bank Account",
            description="Commercial or regional rural bank account where installments will be credited via PFMS.",
            fields=[
                SchemeFieldSpec(
                    name="bank_account_number",
                    label="Bank Account Number",
                    type="text",
                    required=True,
                    placeholder="Account number (9 to 18 digits)",
                    validation_regex=r"^\d{9,18}$",
                    help_text="Account must be active and in the applicant's name.",
                ),
                SchemeFieldSpec(
                    name="ifsc_code",
                    label="Bank IFSC Code",
                    type="text",
                    required=True,
                    placeholder="e.g. SBIN0001234",
                    validation_regex=r"^[A-Z]{4}0[A-Z0-9]{6}$",
                    help_text="11-character code identifying bank branch.",
                ),
            ],
        ),
        SchemeSectionSpec(
            section_id="land_details",
            title="5. Land Ownership & Parcel Details",
            description="Agricultural landholding details verified against State Digital Land Records (Bhulekh).",
            fields=[
                SchemeFieldSpec(
                    name="state_code",
                    label="State Code",
                    type="text",
                    required=True,
                    placeholder="e.g. UP, MH, MP, RJ",
                    help_text="2-letter standard state code.",
                ),
                SchemeFieldSpec(
                    name="district_code",
                    label="District Code",
                    type="text",
                    required=True,
                    placeholder="e.g. LKO, VAR, PUN",
                    help_text="3-letter district abbreviation.",
                ),
                SchemeFieldSpec(
                    name="tehsil_code",
                    label="Tehsil / Taluka Code",
                    type="text",
                    required=True,
                    placeholder="e.g. TEH01",
                ),
                SchemeFieldSpec(
                    name="village_code",
                    label="Village Code / LGD Code",
                    type="text",
                    required=True,
                    placeholder="e.g. VIL101",
                ),
                SchemeFieldSpec(
                    name="khata_number",
                    label="Khata / Revenue Account Number",
                    type="text",
                    required=True,
                    placeholder="e.g. KH-452",
                ),
                SchemeFieldSpec(
                    name="plot_number",
                    label="Plot / Khasra / Survey Number",
                    type="text",
                    required=True,
                    placeholder="e.g. PL-108",
                ),
                SchemeFieldSpec(
                    name="declared_land_area_ha",
                    label="Cultivable Land Area (in Hectares)",
                    type="number",
                    required=True,
                    placeholder="e.g. 1.25",
                    help_text="Must not exceed 2.00 Ha for small/marginal farmer schemes.",
                ),
                SchemeFieldSpec(
                    name="ownership_type",
                    label="Ownership Category",
                    type="select",
                    required=True,
                    options=[
                        SchemeFieldOption(label="Single Owner", value="Single"),
                        SchemeFieldOption(label="Joint Owner", value="Joint"),
                    ],
                ),
                SchemeFieldSpec(
                    name="declared_crop_code",
                    label="Primary Agricultural Crop",
                    type="select",
                    required=False,
                    options=[
                        SchemeFieldOption(label="Wheat (गेहूं)", value="WHEAT"),
                        SchemeFieldOption(label="Paddy / Rice (धान)", value="PADDY"),
                        SchemeFieldOption(label="Maize (मक्का)", value="MAIZE"),
                        SchemeFieldOption(label="Pulses / Dal (दालें)", value="PULSES"),
                        SchemeFieldOption(label="Sugarcane (गन्ना)", value="SUGARCANE"),
                        SchemeFieldOption(label="Cotton (कपास)", value="COTTON"),
                        SchemeFieldOption(label="Other / Mixed", value="OTHER"),
                    ],
                ),
            ],
        ),
        SchemeSectionSpec(
            section_id="document_upload",
            title="6. Land Proof Document Upload",
            description="Official deed or land registry record (Khatauni / ROR 7/12 extract / Patta).",
            fields=[
                SchemeFieldSpec(
                    name="land_document",
                    label="Land Record Document (PDF / JPG / PNG, max 5MB)",
                    type="file",
                    required=True,
                    help_text="Clear copy of latest Record of Rights (RoR), Khatauni, or Sale Deed.",
                ),
            ],
        ),
        SchemeSectionSpec(
            section_id="statutory_declarations",
            title="7. Statutory Exclusion & Self Declarations",
            description="Legal undertaking confirming non-exclusion under PM-KISAN guidelines.",
            fields=[
                SchemeFieldSpec(
                    name="self_declaration",
                    label=(
                        "I hereby declare that neither I nor any member of my family is an income tax payee, "
                        "constitutional post holder, government employee, professional (doctor, engineer, lawyer, CA), "
                        "or pensioner drawing ₹10,000+ per month."
                    ),
                    type="checkbox",
                    required=True,
                ),
            ],
        ),
    ],
)


@scheme_router.get(
    "/{scheme_code}/fields",
    response_model=SchemeMetadataResponse,
    summary="Get Scheme Field Specification & Constraints",
)
def get_scheme_fields(scheme_code: str):
    """
    Retrieve dynamic form fields, validation constraints, and supported upload specs
    for the requested scheme code (e.g. PM_KISAN).
    """
    normalized_code = scheme_code.strip().upper().replace("-", "_")
    if normalized_code == "PM_KISAN":
        return PM_KISAN_METADATA

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Scheme '{scheme_code}' is not supported or does not exist.",
    )
