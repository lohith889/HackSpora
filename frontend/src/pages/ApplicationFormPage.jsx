import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { applicationAPI } from '../api/client'

// ── Step metadata ────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'personal',    code: '01', label: 'Personal' },
  { id: 'otp',         code: '02', label: 'Mobile OTP' },
  { id: 'identity',    code: '03', label: 'Aadhaar / KYC' },
  { id: 'bank',        code: '04', label: 'DBT Bank' },
  { id: 'land',        code: '05', label: 'Land Parcel' },
  { id: 'document',    code: '06', label: 'Revenue Deed' },
  { id: 'declaration', code: '07', label: 'Affirmation' },
]

const GENDER_OPTIONS = ['Male', 'Female', 'Other']
const CATEGORY_OPTIONS = ['General', 'OBC', 'SC', 'ST']
const OWNERSHIP_TYPES = ['Single', 'Joint']
const CROP_CODES = ['WHEAT', 'RICE', 'MAIZE', 'SUGARCANE', 'COTTON', 'SOYBEAN', 'PULSES', 'OTHER']
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILE_MB = 5

// ── Monospaced Step Ledger Header ─────────────────────────────────────────────
function StepBar({ currentStep, onSelectStep }) {
  return (
    <div className="border border-paper-line p-2 bg-paper-subtle mb-8 overflow-x-auto">
      <div className="flex items-center gap-1.5 min-w-[650px] font-mono text-xs uppercase tracking-wider">
        {STEPS.map((step, idx) => {
          const isCurrent = idx === currentStep
          const isDone = idx < currentStep
          return (
            <div key={step.id} className="flex-1 flex items-center">
              <button
                type="button"
                onClick={() => isDone && onSelectStep(idx)}
                disabled={!isDone}
                className={`w-full text-left px-3 py-2 border transition-colors ${
                  isCurrent
                    ? 'border-paper-strong bg-paper text-ink font-bold border-l-2 border-l-accent'
                    : isDone
                    ? 'border-paper-line bg-paper text-ink-muted hover:border-paper-strong cursor-pointer'
                    : 'border-transparent text-ink-faint cursor-not-allowed opacity-60'
                }`}
              >
                <span className={`block text-[10px] font-mono ${isCurrent ? 'text-accent font-semibold' : isDone ? 'text-gov' : 'text-ink-faint'}`}>
                  {isCurrent ? '● CURRENT' : isDone ? '✓ DONE' : '— PENDING'}
                </span>
                <span className="truncate block mt-0.5">
                  {step.code} {step.label}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Step Components ───────────────────────────────────────────────────────────

function PersonalStep({ data, onChange, errors }) {
  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-paper-line pb-3">
        <h3 className="font-serif text-xl font-bold text-ink">01. Applicant Personal Particulars</h3>
        <p className="font-mono text-xs text-ink-faint mt-1">
          Identity details must strictly correspond with the demographic records registered on UIDAI Aadhaar.
        </p>
      </div>

      <div>
        <label className="form-label">Farmer Full Legal Name (as on Aadhaar) *</label>
        <input
          type="text"
          name="farmer_name"
          value={data.farmer_name}
          onChange={onChange}
          className={`form-input ${errors.farmer_name ? 'border-accent' : ''}`}
          placeholder="e.g. Ramesh Kumar"
          required
        />
        {errors.farmer_name && <p className="text-accent font-mono text-xs mt-1">[ERROR] {errors.farmer_name}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="form-label">Date of Birth *</label>
          <input
            type="date"
            name="date_of_birth"
            value={data.date_of_birth}
            onChange={onChange}
            className={`form-input ${errors.date_of_birth ? 'border-accent' : ''}`}
            required
          />
          {errors.date_of_birth && <p className="text-accent font-mono text-xs mt-1">[ERROR] {errors.date_of_birth}</p>}
        </div>
        <div>
          <label className="form-label">Gender Classification *</label>
          <select
            name="gender"
            value={data.gender}
            onChange={onChange}
            className="form-input bg-paper"
            required
          >
            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="form-label">Cultivator Category</label>
        <select
          name="category"
          value={data.category}
          onChange={onChange}
          className="form-input bg-paper"
        >
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  )
}

function OtpStep({ data, onChange, onSendOtp, otpSent, errors }) {
  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-paper-line pb-3">
        <h3 className="font-serif text-xl font-bold text-ink">02. Mobile Telephony &amp; OTP Verification</h3>
        <p className="font-mono text-xs text-ink-faint mt-1">
          Verification prevents bulk proxy applications and confirms active contact ownership.
        </p>
      </div>

      <div>
        <label className="form-label">10-Digit Mobile Number *</label>
        <div className="flex gap-2">
          <input
            type="tel"
            name="mobile_number"
            value={data.mobile_number}
            onChange={onChange}
            maxLength={10}
            className={`form-input ${errors.mobile_number ? 'border-accent' : ''}`}
            placeholder="9876543210"
            required
          />
          <button
            type="button"
            onClick={onSendOtp}
            className="btn-secondary whitespace-nowrap text-xs"
          >
            {otpSent ? 'Resend OTP ↻' : 'Transmit OTP →'}
          </button>
        </div>
        {errors.mobile_number && <p className="text-accent font-mono text-xs mt-1">[ERROR] {errors.mobile_number}</p>}
      </div>

      {otpSent && (
        <div className="border border-paper-line p-4 bg-paper-subtle space-y-3 font-mono text-xs">
          <div className="text-ink-muted">
            [TRANSMITTED]: Verification code dispatched via SMS. (Demo Mock OTP: <strong>123456</strong>)
          </div>
          <div>
            <label className="form-label">Enter 6-Digit One-Time Password *</label>
            <input
              type="text"
              name="otp"
              value={data.otp}
              onChange={onChange}
              maxLength={6}
              className={`form-input font-mono tracking-widest text-base ${errors.otp ? 'border-accent' : ''}`}
              placeholder="123456"
            />
            {errors.otp && <p className="text-accent font-mono text-xs mt-1">[ERROR] {errors.otp}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function IdentityStep({ data, onChange, errors }) {
  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-paper-line pb-3">
        <h3 className="font-serif text-xl font-bold text-ink">03. UIDAI Identity &amp; e-KYC Verification</h3>
        <p className="font-mono text-xs text-ink-faint mt-1">
          Zero-leak privacy: 12-digit Aadhaar is hashed immediately via Salted SHA-256. Raw numbers are never stored.
        </p>
      </div>

      <div>
        <label className="form-label">12-Digit Aadhaar Identifier *</label>
        <input
          type="text"
          name="aadhaar_number"
          value={data.aadhaar_number}
          onChange={onChange}
          maxLength={12}
          className={`form-input font-mono tracking-widest ${errors.aadhaar_number ? 'border-accent' : ''}`}
          placeholder="100000000001"
          required
        />
        {errors.aadhaar_number && <p className="text-accent font-mono text-xs mt-1">[ERROR] {errors.aadhaar_number}</p>}
      </div>

      <div className="border border-paper-line p-4 bg-paper-subtle space-y-3">
        <label className="flex items-start gap-3 cursor-pointer text-xs leading-relaxed text-ink-muted font-mono">
          <input
            type="checkbox"
            name="e_kyc_consent"
            checked={data.e_kyc_consent}
            onChange={onChange}
            className="mt-0.5 rounded-none border-paper-strong text-ink focus:ring-0"
          />
          <span>
            <strong>e-KYC Consent:</strong> I hereby grant consent to the PM-KISAN authority to authenticate my demographic particulars against the UIDAI centralized identity repository for subsidy disbursement eligibility.
          </span>
        </label>
        {errors.e_kyc_consent && <p className="text-accent font-mono text-xs">[ERROR] {errors.e_kyc_consent}</p>}
      </div>
    </div>
  )
}

function BankStep({ data, onChange, errors }) {
  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-paper-line pb-3">
        <h3 className="font-serif text-xl font-bold text-ink">04. Direct Benefit Transfer (DBT) Bank Account</h3>
        <p className="font-mono text-xs text-ink-faint mt-1">
          Account is verified via PFMS registry and simulated penny-drop reconciliation.
        </p>
      </div>

      <div>
        <label className="form-label">Commercial / Rural Bank Account Number (9–18 Digits) *</label>
        <input
          type="text"
          name="bank_account_number"
          value={data.bank_account_number}
          onChange={onChange}
          className={`form-input font-mono ${errors.bank_account_number ? 'border-accent' : ''}`}
          placeholder="123456789001"
          required
        />
        {errors.bank_account_number && <p className="text-accent font-mono text-xs mt-1">[ERROR] {errors.bank_account_number}</p>}
      </div>

      <div>
        <label className="form-label">Bank Branch IFSC Code (11 Alphanumeric Characters) *</label>
        <input
          type="text"
          name="ifsc_code"
          value={data.ifsc_code}
          onChange={onChange}
          maxLength={11}
          className={`form-input font-mono uppercase ${errors.ifsc_code ? 'border-accent' : ''}`}
          placeholder="SBIN0001234"
          required
        />
        {errors.ifsc_code && <p className="text-accent font-mono text-xs mt-1">[ERROR] {errors.ifsc_code}</p>}
      </div>
    </div>
  )
}

function LandStep({ data, onChange, errors }) {
  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-paper-line pb-3">
        <h3 className="font-serif text-xl font-bold text-ink">05. Land Parcel &amp; Revenue Record Particulars</h3>
        <p className="font-mono text-xs text-ink-faint mt-1">
          Must precisely match the State Bhulekh Digital Registry record.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="form-label">State Code *</label>
          <input
            type="text"
            name="state_code"
            value={data.state_code}
            onChange={onChange}
            maxLength={3}
            className={`form-input font-mono uppercase ${errors.state_code ? 'border-accent' : ''}`}
            placeholder="UP"
            required
          />
        </div>
        <div>
          <label className="form-label">District Code *</label>
          <input
            type="text"
            name="district_code"
            value={data.district_code}
            onChange={onChange}
            maxLength={4}
            className={`form-input font-mono uppercase ${errors.district_code ? 'border-accent' : ''}`}
            placeholder="MRT"
            required
          />
        </div>
        <div>
          <label className="form-label">Tehsil Code *</label>
          <input
            type="text"
            name="tehsil_code"
            value={data.tehsil_code}
            onChange={onChange}
            className={`form-input font-mono uppercase ${errors.tehsil_code ? 'border-accent' : ''}`}
            placeholder="HAP"
            required
          />
        </div>
        <div>
          <label className="form-label">Village Code *</label>
          <input
            type="text"
            name="village_code"
            value={data.village_code}
            onChange={onChange}
            className={`form-input font-mono uppercase ${errors.village_code ? 'border-accent' : ''}`}
            placeholder="VIL001"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Khata / Revenue Account Number *</label>
          <input
            type="text"
            name="khata_number"
            value={data.khata_number}
            onChange={onChange}
            className={`form-input font-mono ${errors.khata_number ? 'border-accent' : ''}`}
            placeholder="K001"
            required
          />
        </div>
        <div>
          <label className="form-label">Plot / Khasra Survey Number *</label>
          <input
            type="text"
            name="plot_number"
            value={data.plot_number}
            onChange={onChange}
            className={`form-input font-mono ${errors.plot_number ? 'border-accent' : ''}`}
            placeholder="P001"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="form-label">Cultivable Area (Hectares) *</label>
          <input
            type="number"
            name="declared_land_area_ha"
            value={data.declared_land_area_ha}
            onChange={onChange}
            step="0.01"
            min="0.01"
            className={`form-input font-mono ${errors.declared_land_area_ha ? 'border-accent' : ''}`}
            placeholder="1.25"
            required
          />
        </div>
        <div>
          <label className="form-label">Ownership Type *</label>
          <select
            name="ownership_type"
            value={data.ownership_type}
            onChange={onChange}
            className="form-input bg-paper"
          >
            {OWNERSHIP_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Crop Code (Optional)</label>
          <select
            name="declared_crop_code"
            value={data.declared_crop_code}
            onChange={onChange}
            className="form-input bg-paper"
          >
            <option value="">Select Crop</option>
            {CROP_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

function DocumentStep({ file, onFileChange, errors }) {
  const inputRef = useRef(null)

  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-paper-line pb-3">
        <h3 className="font-serif text-xl font-bold text-ink">06. Land Ownership Evidence (Deed / Khasra)</h3>
        <p className="font-mono text-xs text-ink-faint mt-1">
          Upload certified revenue extract (Khasra/Khatauni or Registered Sale Deed). Allowed: PDF, JPG, PNG (Max 5MB).
        </p>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          file ? 'border-gov bg-gov-subtle/50' : 'border-paper-strong hover:border-ink bg-paper'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => onFileChange(e.target.files[0] || null)}
          className="hidden"
        />
        {file ? (
          <div className="font-mono text-xs space-y-1">
            <span className="font-bold text-gov block">[ATTACHED FILE SELECTED]</span>
            <span className="text-ink-muted">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
            <span className="text-ink-faint block underline mt-2">Click to replace file</span>
          </div>
        ) : (
          <div className="font-mono text-xs space-y-2">
            <span className="font-bold text-ink block">[SELECT REVENUE PROOF DOCUMENT]</span>
            <span className="text-ink-faint block">Click here to browse files on your device (PDF, JPG, PNG under 5MB)</span>
          </div>
        )}
      </div>
      {errors.document && <p className="text-accent font-mono text-xs">[ERROR] {errors.document}</p>}
    </div>
  )
}

function DeclarationStep({ data, onChange, form, file, errors }) {
  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-paper-line pb-3">
        <h3 className="font-serif text-xl font-bold text-ink">07. Summary Review &amp; Statutory Affirmation</h3>
        <p className="font-mono text-xs text-ink-faint mt-1">
          Verify application summary prior to lodging claim into the anomaly audit queue.
        </p>
      </div>

      {/* Review Ledger */}
      <div className="border border-paper-line p-4 bg-paper-subtle space-y-2 font-mono text-xs">
        <div className="flex justify-between border-b border-paper-line pb-1">
          <span className="text-ink-faint">Applicant:</span>
          <span className="font-bold text-ink">{form.farmer_name}</span>
        </div>
        <div className="flex justify-between border-b border-paper-line pb-1">
          <span className="text-ink-faint">Aadhaar (Masked):</span>
          <span className="text-ink">XXXX-XXXX-{form.aadhaar_number?.slice(-4) || '****'}</span>
        </div>
        <div className="flex justify-between border-b border-paper-line pb-1">
          <span className="text-ink-faint">Bank Account &amp; IFSC:</span>
          <span className="text-ink">{form.bank_account_number} ({form.ifsc_code})</span>
        </div>
        <div className="flex justify-between border-b border-paper-line pb-1">
          <span className="text-ink-faint">Declared Parcel:</span>
          <span className="text-ink">{form.state_code}-{form.district_code}-{form.tehsil_code}-{form.village_code}-{form.khata_number}-{form.plot_number}</span>
        </div>
        <div className="flex justify-between border-b border-paper-line pb-1">
          <span className="text-ink-faint">Land Area:</span>
          <span className="text-ink">{form.declared_land_area_ha} Hectares ({form.ownership_type})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-faint">Attached Document:</span>
          <span className="text-ink">{file?.name || 'Attached file on record'}</span>
        </div>
      </div>

      {/* Statutory Affirmation */}
      <div className="border border-paper-strong p-4 bg-paper space-y-2">
        <label className="flex items-start gap-3 cursor-pointer text-xs font-mono text-ink leading-relaxed">
          <input
            type="checkbox"
            name="self_declaration"
            checked={data.self_declaration}
            onChange={onChange}
            className="mt-0.5 rounded-none border-paper-strong text-ink focus:ring-0"
          />
          <span>
            <strong>STATUTORY LEGAL AFFIRMATION:</strong> I hereby declare that I am a bona fide landholder cultivator. Neither I nor any member of my family is an income tax payee, government servant, or institutional entity excluded under Section 3 of PM-KISAN Operational Rules. Any false declaration will result in benefit recovery and penal prosecution under the Indian Penal Code.
          </span>
        </label>
        {errors.self_declaration && <p className="text-accent font-mono text-xs">[ERROR] {errors.self_declaration}</p>}
      </div>
    </div>
  )
}

// ── Main Form Page Component ──────────────────────────────────────────────────

export default function ApplicationFormPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [otpSent, setOtpSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(null)
  const [errors, setErrors] = useState({})

  const [form, setForm] = useState({
    farmer_name: '',
    date_of_birth: '',
    gender: 'Male',
    category: 'General',
    mobile_number: '',
    otp: '',
    aadhaar_number: '',
    e_kyc_consent: false,
    bank_account_number: '',
    ifsc_code: '',
    state_code: 'UP',
    district_code: 'MRT',
    tehsil_code: 'HAP',
    village_code: 'VIL001',
    khata_number: 'K001',
    plot_number: 'P001',
    declared_land_area_ha: '1.25',
    ownership_type: 'Single',
    declared_crop_code: 'WHEAT',
    self_declaration: false,
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  // Quick Demo Autofill helper
  const handleAutofillValid = () => {
    setForm({
      farmer_name: 'Ramesh Kumar',
      date_of_birth: '1982-06-15',
      gender: 'Male',
      category: 'General',
      mobile_number: '9876543210',
      otp: '123456',
      aadhaar_number: '100000000001',
      e_kyc_consent: true,
      bank_account_number: '123456789001',
      ifsc_code: 'SBIN0001234',
      state_code: 'UP',
      district_code: 'MRT',
      tehsil_code: 'HAP',
      village_code: 'VIL001',
      khata_number: 'K001',
      plot_number: 'P001',
      declared_land_area_ha: '1.25',
      ownership_type: 'Single',
      declared_crop_code: 'WHEAT',
      self_declaration: true,
    })
    setOtpSent(true)
    // Create a mock dummy PDF file for upload
    const blob = new Blob(['Mock PM-KISAN Land Deed Certificate Content'], { type: 'application/pdf' })
    const dummyFile = new File([blob], 'ramesh_land_deed_k001.pdf', { type: 'application/pdf' })
    setFile(dummyFile)
    setErrors({})
  }

  const handleSendOtp = () => {
    if (!/^\d{10}$/.test(form.mobile_number)) {
      setErrors((prev) => ({ ...prev, mobile_number: 'Enter a valid 10-digit mobile number.' }))
      return
    }
    setOtpSent(true)
    setForm((prev) => ({ ...prev, otp: '123456' }))
  }

  const validateStep = () => {
    const errs = {}
    switch (step) {
      case 0:
        if (!form.farmer_name.trim()) errs.farmer_name = 'Name is required.'
        if (!form.date_of_birth) errs.date_of_birth = 'Date of birth is required.'
        break
      case 1:
        if (!/^\d{10}$/.test(form.mobile_number)) errs.mobile_number = '10-digit mobile number required.'
        if (form.otp !== '123456') errs.otp = 'Invalid OTP. Enter mock OTP: 123456.'
        break
      case 2:
        if (!/^\d{12}$/.test(form.aadhaar_number)) errs.aadhaar_number = 'Aadhaar must be exactly 12 numeric digits.'
        if (!form.e_kyc_consent) errs.e_kyc_consent = 'Consent for UIDAI e-KYC is mandatory.'
        break
      case 3:
        if (!form.bank_account_number || form.bank_account_number.length < 9) errs.bank_account_number = 'Bank account must be at least 9 digits.'
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc_code.toUpperCase())) errs.ifsc_code = 'Invalid IFSC format (e.g. SBIN0001234).'
        break
      case 4:
        if (!form.state_code) errs.state_code = 'State code is required.'
        if (!form.district_code) errs.district_code = 'District code is required.'
        if (!form.tehsil_code) errs.tehsil_code = 'Tehsil code is required.'
        if (!form.village_code) errs.village_code = 'Village code is required.'
        if (!form.khata_number) errs.khata_number = 'Khata number is required.'
        if (!form.plot_number) errs.plot_number = 'Plot number is required.'
        if (!form.declared_land_area_ha || parseFloat(form.declared_land_area_ha) <= 0) errs.declared_land_area_ha = 'Land area must be > 0.'
        break
      case 5:
        if (!file) errs.document = 'Please upload a land ownership proof file.'
        else if (!ALLOWED_MIME.includes(file.type)) errs.document = 'Only PDF, JPG, PNG formats permitted.'
        else if (file.size > MAX_FILE_MB * 1024 * 1024) errs.document = `File size must not exceed ${MAX_FILE_MB}MB.`
        break
      case 6:
        if (!form.self_declaration) errs.self_declaration = 'You must affirm the legal declaration to submit.'
        break
      default:
        break
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    if (validateStep()) setStep((s) => s + 1)
  }

  const handleBack = () => {
    setStep((s) => s - 1)
    setErrors({})
  }

  const handleSubmit = async () => {
    if (!validateStep()) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const fd = new FormData()
      fd.append('farmer_name', form.farmer_name)
      fd.append('date_of_birth', form.date_of_birth)
      fd.append('gender', form.gender)
      fd.append('category', form.category || 'General')
      fd.append('mobile_number', form.mobile_number)
      fd.append('otp', form.otp)
      fd.append('aadhaar_number', form.aadhaar_number)
      fd.append('e_kyc_consent', form.e_kyc_consent)
      fd.append('bank_account_number', form.bank_account_number)
      fd.append('ifsc_code', form.ifsc_code.toUpperCase())
      fd.append('state_code', form.state_code.toUpperCase())
      fd.append('district_code', form.district_code.toUpperCase())
      fd.append('tehsil_code', form.tehsil_code)
      fd.append('village_code', form.village_code)
      fd.append('khata_number', form.khata_number)
      fd.append('plot_number', form.plot_number)
      fd.append('declared_land_area_ha', form.declared_land_area_ha)
      fd.append('ownership_type', form.ownership_type)
      if (form.declared_crop_code) fd.append('declared_crop_code', form.declared_crop_code)
      fd.append('self_declaration', form.self_declaration)
      fd.append('land_document', file)

      const { data } = await applicationAPI.submit(fd)
      setSubmitted(data)
    } catch (err) {
      const detail = err.response?.data?.detail
      setSubmitError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
          ? detail.map((d) => d.msg).join('; ')
          : 'Submission failed. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submission Success Screen (Editorial Gazette Receipt) ──────────────────
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-left font-sans">
        <div className="border border-paper-line p-8 bg-paper space-y-6">
          <div className="border-b border-paper-line pb-4">
            <span className="font-mono text-xs uppercase tracking-widest text-gov font-semibold block mb-1">
              [ OFFICIAL RECEIPT DOCKET // CLAIM LODGED ]
            </span>
            <h2 className="font-serif text-3xl font-bold text-ink">
              Application Receipt Generated
            </h2>
            <p className="font-mono text-xs text-ink-faint mt-1">
              Application is queued for automated registry cross-verification and officer adjudication.
            </p>
          </div>

          <div className="border border-paper-line p-5 bg-paper-subtle space-y-3 font-mono text-xs">
            <div className="flex justify-between border-b border-paper-line pb-1.5">
              <span className="text-ink-faint">APPLICATION ID:</span>
              <span className="font-bold text-ink text-sm">APP-{String(submitted.application_id).padStart(6, '0')}</span>
            </div>
            <div className="flex justify-between border-b border-paper-line pb-1.5">
              <span className="text-ink-faint">SCHEME CODE:</span>
              <span className="font-semibold text-ink">{submitted.scheme_code}</span>
            </div>
            <div className="flex justify-between border-b border-paper-line pb-1.5">
              <span className="text-ink-faint">INITIAL STATUS:</span>
              <span className="font-bold text-gov bg-gov-subtle px-2 py-0.5 border border-gov">
                {submitted.status}
              </span>
            </div>
            <div className="flex justify-between border-b border-paper-line pb-1.5">
              <span className="text-ink-faint">PARCEL REFERENCE:</span>
              <span className="text-ink">{submitted.parcel_id || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">AADHAAR TOKEN PREVIEW:</span>
              <span className="text-ink">{submitted.aadhaar_masked || 'XXXX-XXXX-****'}</span>
            </div>
          </div>

          <div className="border-l-2 border-paper-strong pl-4 py-2 text-xs text-ink-muted font-mono bg-paper-subtle/50">
            {submitted.citizen_status_message}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-paper-line">
            <Link
              to={`/applications/${submitted.application_id}`}
              className="btn-primary w-full sm:w-auto"
            >
              Inspect Application Record →
            </Link>
            <Link
              to="/dashboard"
              className="btn-secondary w-full sm:w-auto"
            >
              Return to Citizen Ledger
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto text-left font-sans">
      {/* Top Header & Demo Fill */}
      <div className="border-b border-paper-line pb-4 mb-6 flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold block mb-0.5">
            [ FORM A-1 // SUBSIDY ENROLMENT ]
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink">
            PM-KISAN Scheme Application
          </h1>
        </div>

        <button
          type="button"
          onClick={handleAutofillValid}
          className="border border-paper-line hover:border-paper-strong px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-ink-muted bg-paper hover:bg-paper-subtle transition-colors self-start sm:self-auto"
        >
          Auto-fill Valid Demo Claim ⚡
        </button>
      </div>

      {/* Step Progress Ledger */}
      <StepBar currentStep={step} onSelectStep={setStep} />

      {/* Main Step Box */}
      <div className="border border-paper-line p-6 sm:p-8 bg-paper">
        {step === 0 && <PersonalStep data={form} onChange={handleChange} errors={errors} />}
        {step === 1 && (
          <OtpStep
            data={form}
            onChange={handleChange}
            onSendOtp={handleSendOtp}
            otpSent={otpSent}
            errors={errors}
          />
        )}
        {step === 2 && <IdentityStep data={form} onChange={handleChange} errors={errors} />}
        {step === 3 && <BankStep data={form} onChange={handleChange} errors={errors} />}
        {step === 4 && <LandStep data={form} onChange={handleChange} errors={errors} />}
        {step === 5 && <DocumentStep file={file} onFileChange={setFile} errors={errors} />}
        {step === 6 && (
          <DeclarationStep
            data={form}
            onChange={handleChange}
            form={form}
            file={file}
            errors={errors}
          />
        )}

        {submitError && (
          <div className="border border-accent bg-paper text-accent p-3 mt-6 font-mono text-xs">
            <strong>[SUBMISSION REJECTED]</strong> {submitError}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-8 mt-8 border-t border-paper-line">
          {step > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="btn-secondary"
            >
              ← Previous Step
            </button>
          ) : (
            <Link to="/dashboard" className="font-mono text-xs text-ink-faint hover:text-ink underline">
              Cancel Filing
            </Link>
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="btn-primary"
            >
              Continue to Step {STEPS[step + 1].code} →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-accent"
            >
              {submitting ? '[ TRANSMITTING DOCKET... ]' : 'Lodge Formal Claim →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
