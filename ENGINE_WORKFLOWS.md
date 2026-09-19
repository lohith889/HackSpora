# KisanGuard Portal — Anomaly Detection Engines Workflow Reference

This document provides complete flowchart diagrams, decision logic, input sources, anomaly codes, severity weights, and evidence schemas for each of the 7 anomaly detection engines in KisanGuard Portal.

---

## Engine 1: Identity & e-KYC Verification Engine

```mermaid
flowchart TD
    Start(["Input: Application Data + Tokenized Identity"]) --> CheckEKyc{"e_kyc_status == true?"}

    CheckEKyc -->|No| FlagEKyc["Flag: ID_EKYC_FAILED\nSeverity: High\nWeight: +35\nEvidence: e-KYC consent or verification rejected"]
    CheckEKyc -->|Yes| CheckOTP{"otp_verified == true?\n(Mock: 123456)"}

    FlagEKyc --> CheckOTP

    CheckOTP -->|No| FlagOTP["Flag: ID_OTP_NOT_VERIFIED\nSeverity: Medium\nWeight: +25\nEvidence: Mobile verification incomplete"]
    CheckOTP -->|Yes| QueryAadhaar["Query applications for same aadhaar_ref"]

    FlagOTP --> QueryAadhaar

    QueryAadhaar --> CheckDupAadhaar{"Existing application with\nsame aadhaar_ref found?"}

    CheckDupAadhaar -->|Yes| FlagDupAadhaar["Flag: ID_DUPLICATE_AADHAAR\nSeverity: High\nWeight: +45\nEvidence: linked_application_ids, count"]
    CheckDupAadhaar -->|No| QueryMobile["Count applications with same mobile_number"]

    FlagDupAadhaar --> QueryMobile

    QueryMobile --> CheckMobileCount{"Mobile usage count across\nall submitted applications"}

    CheckMobileCount -->|Count > 10| FlagMobileHigh["Flag: ID_MOBILE_BULK_USAGE\nSeverity: High\nWeight: +30\nEvidence: syndicate bulk submission alert"]
    CheckMobileCount -->|Count between 6 and 10| FlagMobileMed["Flag: ID_MOBILE_BULK_USAGE\nSeverity: Medium\nWeight: +15\nEvidence: high mobile reuse alert"]
    CheckMobileCount -->|Count <= 5| IdentityPass["Identity Engine Evaluation Complete"]

    FlagMobileHigh --> IdentityPass
    FlagMobileMed --> IdentityPass
    IdentityPass --> OutputFlags(["Return Identity Flags & Evidence"])
```

---

## Engine 2: Land Records Verification Engine

```mermaid
flowchart TD
    Start(["Input: Land Details + parcel_id"]) --> QueryLandRegistry["Query land_records_master\nWHERE parcel_id = state-dist-teh-vil-khata-plot"]

    QueryLandRegistry --> ParcelFound{"Record found in\nland_records_master?"}

    ParcelFound -->|No| FlagMissing["Flag: LAND_RECORD_MISSING\nSeverity: High\nWeight: +40\nEvidence: parcel_id not found in registry"]
    ParcelFound -->|Yes| MatchAadhaar{"applicant.aadhaar_ref ==\nland_record.owner_aadhaar_ref?"}

    MatchAadhaar -->|Mismatch| FlagAadhaarMismatch["Flag: LAND_OWNER_AADHAAR_MISMATCH\nSeverity: High\nWeight: +45\nEvidence: owner_aadhaar_ref mismatch"]
    MatchAadhaar -->|Match or Missing| FuzzyNameCheck["Compute Fuzzy Match Ratio:\nScore = token_sort_ratio(farmer_name, owner_name)"]

    FlagAadhaarMismatch --> FuzzyNameCheck

    FuzzyNameCheck --> EvalNameScore{"Name Match Score"}
    EvalNameScore -->|Score < 0.60| FlagNameHigh["Flag: LAND_OWNER_NAME_MISMATCH\nSeverity: High\nWeight: +30\nEvidence: name_match_score, names"]
    EvalNameScore -->|0.60 <= Score < 0.80| FlagNameMed["Flag: LAND_OWNER_NAME_MISMATCH\nSeverity: Medium\nWeight: +15\nEvidence: partial name discrepancy"]
    EvalNameScore -->|Score >= 0.80| CheckAgri{"land_use_code == 'AGRICULTURAL'\nAND agri_land_flag == true?"}

    FlagNameHigh --> CheckAgri
    FlagNameMed --> CheckAgri

    CheckAgri -->|No| FlagNonAgri["Flag: LAND_NOT_AGRICULTURAL\nSeverity: High\nWeight: +45\nEvidence: commercial/urban/forest land use"]
    CheckAgri -->|Yes| CheckOwnershipStatus{"ownership_status == 'ACTIVE'?"}

    FlagNonAgri --> CheckOwnershipStatus

    CheckOwnershipStatus -->|Disputed or Inactive| FlagOwnership["Flag: LAND_OWNERSHIP_INACTIVE\nSeverity: High\nWeight: +30\nEvidence: title disputed or inactive status"]
    CheckOwnershipStatus -->|Active| CheckArea{"abs(declared_area - registered_area)\n/ registered_area > 0.20?"}

    FlagOwnership --> CheckArea

    CheckArea -->|Area Discrepancy > 20%| FlagArea["Flag: LAND_AREA_MISMATCH\nSeverity: Medium\nWeight: +20\nEvidence: declared_area vs registered_area"]
    CheckArea -->|Area Matches| LandPass["Land Engine Evaluation Complete"]

    FlagMissing --> LandPass
    FlagArea --> LandPass
    LandPass --> OutputFlags(["Return Land Flags & Evidence"])
```

---

## Engine 3: Bank Account & DBT Validation Engine

```mermaid
flowchart TD
    Start(["Input: bank_account_number + ifsc_code"]) --> BuildKey["Derive bank_account_ifsc_key\n= account_number + '-' + ifsc_code"]

    BuildKey --> ValidateIFSCFormat{"Regex match IFSC:\n^[A-Z]{4}0[A-Z0-9]{6}$"}

    ValidateIFSCFormat -->|Invalid Format| FlagIFSC["Flag: BANK_IFSC_INVALID\nSeverity: High\nWeight: +35\nEvidence: invalid RBI IFSC format"]
    ValidateIFSCFormat -->|Valid Format| QueryBankMaster["Query bank_validation_master\nWHERE bank_account_ifsc_key = key"]

    FlagIFSC --> QueryBankMaster

    QueryBankMaster --> BankRecordFound{"Record found in\nbank_validation_master?"}

    BankRecordFound -->|No| FlagMissingBank["Flag: BANK_VALIDATION_MISSING\nSeverity: Low\nWeight: +10\nEvidence: unverified bank master record"]
    BankRecordFound -->|Yes| CheckAccStatus{"account_status == 'ACTIVE'?"}

    CheckAccStatus -->|Inactive or Closed or Frozen| FlagAccInactive["Flag: BANK_ACCOUNT_INACTIVE\nSeverity: High\nWeight: +35\nEvidence: account_status"]
    CheckAccStatus -->|Active| CheckPennyDrop{"penny_drop_status == 'SUCCESS'?"}

    FlagAccInactive --> CheckPennyDrop

    CheckPennyDrop -->|Failed| FlagPennyFailed["Flag: BANK_PENNY_DROP_FAILED\nSeverity: Medium\nWeight: +25\nEvidence: NPCI penny-drop rejected"]
    CheckPennyDrop -->|Success or Not Done| FuzzyBankName["Compute Fuzzy Ratio:\nScore = token_sort_ratio(farmer_name, holder_name)"]

    FlagPennyFailed --> FuzzyBankName

    FuzzyBankName --> EvalBankName{"Name Match Score"}
    EvalBankName -->|Score < 0.60| FlagBankNameHigh["Flag: BANK_NAME_MISMATCH\nSeverity: High\nWeight: +30\nEvidence: bank_name_score, holder_name"]
    EvalBankName -->|0.60 <= Score < 0.80| FlagBankNameMed["Flag: BANK_NAME_MISMATCH\nSeverity: Medium\nWeight: +15\nEvidence: partial name discrepancy"]
    EvalBankName -->|Score >= 0.80| CheckSharedAccount["Count applications with same\nbank_account_ifsc_key"]

    FlagBankNameHigh --> CheckSharedAccount
    FlagBankNameMed --> CheckSharedAccount

    CheckSharedAccount --> SharedCount{"Linked applications count > 1?"}

    SharedCount -->|Yes (Count > 1)| FlagShared["Flag: BANK_ACCOUNT_SHARED\nSeverity: High\nWeight: +35\nEvidence: mule account alert, linked_app_ids"]
    SharedCount -->|No (Count == 1)| BankPass["Bank Engine Evaluation Complete"]

    FlagMissingBank --> CheckSharedAccount
    FlagShared --> BankPass
    BankPass --> OutputFlags(["Return Bank Flags & Evidence"])
```

---

## Engine 4: Ineligibility & Exclusion Categories Engine

```mermaid
flowchart TD
    Start(["Input: applicant.aadhaar_ref"]) --> QueryExclusion["Query exclusion_master\nWHERE aadhaar_ref = applicant.aadhaar_ref"]

    QueryExclusion --> RecordFound{"Record exists in\nexclusion_master?"}

    RecordFound -->|No Record Found| ExclusionPass["Applicant clear of all statutory exclusions"]

    RecordFound -->|Record Found| CheckTaxpayer{"taxpayer_flag == true?\n(Paid Income Tax in Assessment Year)"}

    CheckTaxpayer -->|Yes| FlagTax["Flag: EXCLUSION_TAXPAYER\nSeverity: High\nWeight: +50\nEvidence: IT Department cross-match"]
    CheckTaxpayer -->|No| CheckGovtEmp{"govt_employee_flag == true?\n(State/Central Govt Employee)"}

    FlagTax --> CheckGovtEmp

    CheckGovtEmp -->|Yes| FlagGovt["Flag: EXCLUSION_GOVT_EMPLOYEE\nSeverity: High\nWeight: +50\nEvidence: Government service registry hit"]
    CheckGovtEmp -->|No| CheckPensioner{"pensioner_flag == true?\n(Pension > Rs 10,000 / month)"}

    FlagGovt --> CheckPensioner

    CheckPensioner -->|Yes| FlagPension["Flag: EXCLUSION_PENSIONER\nSeverity: High\nWeight: +45\nEvidence: Treasury pension records"]
    CheckPensioner -->|No| CheckProfessional{"professional_flag == true?\n(Doctor, Lawyer, Engineer, CA, Architect)"}

    FlagPension --> CheckProfessional

    CheckProfessional -->|Yes| FlagProf["Flag: EXCLUSION_PROFESSIONAL\nSeverity: High\nWeight: +45\nEvidence: Professional council member registry"]
    CheckProfessional -->|No| CheckInst{"institutional_landholder_flag == true?\n(Institutional / Trust Land)"}

    FlagProf --> CheckInst

    CheckInst -->|Yes| FlagInst["Flag: EXCLUSION_INSTITUTIONAL\nSeverity: High\nWeight: +50\nEvidence: Institutional land holding"]
    CheckInst -->|No| CheckDeceased{"deceased_flag == true?\n(Applicant on Civil Death Register)"}

    FlagInst --> CheckDeceased

    CheckDeceased -->|Yes| FlagDeceased["Flag: EXCLUSION_DECEASED\nSeverity: High\nWeight: +50\nEvidence: Registrar of births and deaths"]
    CheckDeceased -->|No| DoneExclusion["Exclusion Evaluation Complete"]

    FlagDeceased --> DoneExclusion
    ExclusionPass --> DoneExclusion
    DoneExclusion --> OutputFlags(["Return Exclusion Flags & Evidence"])
```

---

## Engine 5: Duplicate Land Parcel & Syndicate Engine

```mermaid
flowchart TD
    Start(["Input: parcel_id + applicant_id + mobile_number"]) --> QueryParcelApps["Query all submitted applications\nWHERE parcel_id = current.parcel_id\nAND id != current.id"]

    QueryParcelApps --> ParcelAppCount{"How many other applications\nclaim this exact parcel_id?"}

    ParcelAppCount -->|0 Other Applications| NoDuplicate["Single claim on parcel - Normal"]

    ParcelAppCount -->|1 or more Other Applications| CheckSameMobile{"Any other application uses\nidentical mobile_number?"}

    CheckSameMobile -->|Yes (Same mobile)| FlagDupBenefit["Flag: DUPLICATE_PARCEL_BENEFIT\nSeverity: High\nWeight: +40\nEvidence: syndicate fraud; same parcel and mobile"]
    CheckSameMobile -->|No (Distinct mobiles)| EvalTotalClaimants{"Total distinct claimants on parcel"}

    FlagDupBenefit --> EvalTotalClaimants

    EvalTotalClaimants -->|Total <= 3 claimants| FlagMultiple["Flag: SAME_PARCEL_MULTIPLE_APPLICANTS\nSeverity: Medium\nWeight: +20\nEvidence: parcel claimed by 2-3 applicants"]
    EvalTotalClaimants -->|Total > 3 claimants| FlagOverClaimed["Flag: PARCEL_OVER_CLAIMED\nSeverity: High\nWeight: +45\nEvidence: parcel over-claimed by > 3 applicants"]

    NoDuplicate --> DuplicateDone["Duplicate Parcel Evaluation Complete"]
    FlagMultiple --> DuplicateDone
    FlagOverClaimed --> DuplicateDone
    DuplicateDone --> OutputFlags(["Return Duplicate Parcel Flags & Evidence"])
```

---

## Engine 6: Statistical & Geographic Concentration Engine

```mermaid
flowchart TD
    Start(["Input: village_code"]) --> QueryVillageProfile["Query village_profile_master\nWHERE village_code = current.village_code"]

    QueryVillageProfile --> QueryCurrentCount["Count total submitted applications in this village_code"]

    QueryCurrentCount --> ProfileExists{"village_profile_master\nrecord exists?"}

    ProfileExists -->|No| FallbackBaseline["Use default baseline: 20 beneficiaries"]
    ProfileExists -->|Yes| ReadBaseline["expected = historical_beneficiary_count"]

    FallbackBaseline --> CalcRatio["Calculate Geographic Ratio:\nR_geo = current_applications / max(expected, 1)"]
    ReadBaseline --> CalcRatio

    CalcRatio --> EvalRatio{"Evaluate Concentration Ratio R_geo"}

    EvalRatio -->|R_geo > 2.5| FlagGeoHigh["Flag: GEO_ABNORMAL_CONCENTRATION\nSeverity: High\nWeight: +30\nEvidence: current_count, expected_count, ratio > 2.5x"]
    EvalRatio -->|1.75 < R_geo <= 2.5| FlagGeoMed["Flag: GEO_ABNORMAL_CONCENTRATION\nSeverity: Medium\nWeight: +20\nEvidence: current_count, expected_count, ratio 1.75x-2.5x"]
    EvalRatio -->|R_geo <= 1.75| NormalDensity["Normal Geographic Density - Within Expected Limits"]

    FlagGeoHigh --> GeoDone["Geographic Evaluation Complete"]
    FlagGeoMed --> GeoDone
    NormalDensity --> GeoDone
    GeoDone --> OutputFlags(["Return Geographic Flags & Evidence"])
```

---

## Engine 7: Temporal Spike & Pre-Event Surge Engine

```mermaid
flowchart TD
    Start(["Input: district_code + submitted_at"]) --> QueryCalendar["Query event_calendar_master\nWHERE district_code = current.district_code\nOR district_code = 'ALL'"]

    QueryCalendar --> FindNearbyEvents{"Any scheme event within 48 hours?\n(installment_release, cutoff_date, eKYC_deadline)"}

    FindNearbyEvents -->|No Event in Window| NormalWindow["Standard application period - No surge check needed"]

    FindNearbyEvents -->|Event Found| CalcDailyRates["Calculate District Application Rates:\n1. spike_count: applications in district in 48h pre-event\n2. baseline_daily: avg daily applications in prior 14 days"]

    CalcDailyRates --> EvalSurgeRatio{"Surge Multiple = spike_count / max(baseline_daily, 1)"}

    EvalSurgeRatio -->|Multiple > 5.0x baseline| FlagSpikeHigh["Flag: TIME_PRE_EVENT_SPIKE\nSeverity: High\nWeight: +35\nEvidence: event_type, spike_count, baseline, surge > 5x"]
    EvalSurgeRatio -->|3.0x < Multiple <= 5.0x baseline| FlagSpikeMed["Flag: TIME_PRE_EVENT_SPIKE\nSeverity: Medium\nWeight: +25\nEvidence: event_type, spike_count, baseline, surge 3x-5x"]
    EvalSurgeRatio -->|Multiple <= 3.0x baseline| NormalRate["Normal volume surge within allowable variance"]

    FlagSpikeHigh --> TemporalDone["Temporal Evaluation Complete"]
    FlagSpikeMed --> TemporalDone
    NormalWindow --> TemporalDone
    NormalRate --> TemporalDone
    TemporalDone --> OutputFlags(["Return Temporal Flags & Evidence"])
```

---

## 8. Master Synthesis: Risk Scorer, Confidence & Rationale Orchestration

```mermaid
flowchart TD
    subgraph AllEngines["7 Parallel / Sequential Anomaly Engines"]
        E1["Identity Engine Flags"]
        E2["Land Engine Flags"]
        E3["Bank Engine Flags"]
        E4["Exclusion Engine Flags"]
        E5["Duplicate Parcel Flags"]
        E6["Geographic Flags"]
        E7["Temporal Flags"]
    end

    E1 & E2 & E3 & E4 & E5 & E6 & E7 --> Aggregator["Flag Collector & Aggregator\nTotal Flags: [flag_1, flag_2, ..., flag_k]"]

    subgraph ScoringSubsystem["Scoring & Explainability Subsystem"]
        Aggregator --> Scorer["Risk Scoring Formula:\nRisk Score = min(100, Sum of all Flag Weights)"]
        
        Aggregator --> Confidence["Confidence Level Classifier:
- HIGH if deterministic flag exists (Aadhaar mismatch, duplicate Aadhaar, exclusion hit, over-claimed parcel) OR Risk Score >= 80
- MEDIUM if heuristic flag exists (fuzzy name mismatch, geo/temporal spike) OR Risk Score >= 50
- LOW if only weak flags exist OR Risk Score < 50"]

        Aggregator --> Rationale["Explainable Rationale Generator:
Natural Language synthesis combining top severity drivers into plain-English officer guidance"]
    end

    Scorer & Confidence & Rationale --> StatusTiers{"Status Tier Mapping (Risk Score)"}

    StatusTiers -->|"0 - 24"| S1["AUTO_CLEARED\nCitizen Msg: Initial checks passed\nOfficer Action: Auto-approve DBT installment"]
    StatusTiers -->|"25 - 49"| S2["UNDER_REVIEW\nCitizen Msg: Routine verification in progress\nOfficer Action: Routine document check"]
    StatusTiers -->|"50 - 74"| S3["ACTION_REQUIRED\nCitizen Msg: Additional document verification required\nOfficer Action: Request updated land passbook"]
    StatusTiers -->|"75 - 89"| S4["FIELD_VERIFICATION\nCitizen Msg: Field verification required\nOfficer Action: Dispatch Revenue Inspector"]
    StatusTiers -->|"90 - 100"| S5["PAYMENT_HELD\nCitizen Msg: Detailed verification on hold\nOfficer Action: Payment hold & Vigilance escalation"]

    S1 & S2 & S3 & S4 & S5 --> Persist["Persist to SQLite:
1. INSERT INTO anomaly_reports (risk_score, confidence_level, rationale, recommended_action)
2. INSERT INTO anomaly_flags (each flag with severity, score, evidence_json)
3. UPDATE applications SET status = mapped_status, risk_score, confidence_level"]

    Persist --> EndState(["Application Ready for Citizen Tracking & Admin Adjudication"])
```
