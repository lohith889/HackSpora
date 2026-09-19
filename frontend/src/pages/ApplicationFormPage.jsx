import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { applicationAPI } from '../api/client'
import {
  User, Phone, ShieldCheck, Landmark, MapPin,
  UploadCloud, ClipboardCheck, CheckCircle, AlertCircle,
  ChevronLeft, ChevronRight, X, FileText
} from 'lucide-react'

// ── Step metadata ────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'personal',     label: 'Personal Info',    icon: User },
  { id: 'otp',          label: 'Mobile OTP',       icon: Phone },
  { id: 'identity',     label: 'Aadhaar / KYC',   icon: ShieldCheck },
  { id: 'bank',         label: 'Bank Details',     icon: Landmark },
  { id: 'land',         label: 'Land Parcel',      icon: MapPin },
  { id: 'document',     label: 'Upload Document',  icon: UploadCloud },
  { id: 'declaration',  label: 'Declaration',      icon: ClipboardCheck },
]

const GENDER_OPTIONS = ['Male', 'Female', 'Other']
const CATEGORY_OPTIONS = ['General', 'OBC', 'SC', 'ST']
const OWNERSHIP_TYPES = ['Single', 'Joint']
const CROP_CODES = ['WHEAT', 'RICE', 'MAIZE', 'SUGARCANE', 'COTTON', 'SOYBEAN', 'PULSES', 'OTHER']
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILE_MB = 5

// Step progress bar
function StepBar({ currentStep }) {
  return (
    <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
      {STEPS.map((step, idx) => {
        const Icon = step.icon
        const status = idx < currentStep ? 'done' : idx === currentStep ? 'active' : 'pending'
        return (
          <div key={step.id} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  status === 'done'
                    ? 'bg-gov-green text-white'
                    : status === 'active'
                    ? 'bg-gov-blue text-white ring-4 ring-blue-100'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {status === 'done' ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  status === 'active' ? 'text-gov-blue' : status === 'done' ? 'text-gov-green' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-6 sm:w-12 mx-1 flex-shrink-0 transition-colors ${
                  idx < currentStep ? 'bg-gov-green' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step Components ───────────────────────────────────────────────────────────

function PersonalStep({ data, onChange, errors }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800 text-lg">Personal Information</h3>
      <p className="text-sm text-gray-500">Enter details exactly as they appear on your Aadhaar card.</p>
      <div>
        <label className="form-label">Full Name (as per Aadhaar) *</label>
        <input type="text" name="farmer_name" value={data.farmer_name} onChange={onChange}
          className={`form-input ${errors.farmer_name ? 'border-red-400' : ''}`}
          placeholder="e.g., Ramesh Kumar Singh" required />
        {errors.farmer_name && <p className="text-red-500 text-xs mt-1">{errors.farmer_name}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Date of Birth *</label>
          <input type="date" name="date_of_birth" value={data.date_of_birth} onChange={onChange}
            className={`form-input ${errors.date_of_birth ? 'border-red-400' : ''}`} required />
          {errors.date_of_birth && <p className="text-red-500 text-xs mt-1">{errors.date_of_birth}</p>}
        </div>
        <div>
          <label className="form-label">Gender *</label>
          <select name="gender" value={data.gender} onChange={onChange} className="form-input" required>
            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="form-label">Category</label>
        <select name="category" value={data.category} onChange={onChange} className="form-input">
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  )
}

function OTPStep({ data, onChange, errors, otpSent, onSendOtp, otpLoading }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800 text-lg">Mobile OTP Verification</h3>
      <p className="text-sm text-gray-500">
        Your mobile number must be linked to your Aadhaar for PM-KISAN benefits.
      </p>
      <div>
        <label className="form-label">Aadhaar-Linked Mobile Number *</label>
        <div className="flex gap-2">
          <input type="tel" name="mobile_number" value={data.mobile_number} onChange={onChange}
            className={`form-input flex-1 ${errors.mobile_number ? 'border-red-400' : ''}`}
            placeholder="10-digit mobile number" pattern="\d{10}" required />
          <button type="button" onClick={onSendOtp} disabled={otpLoading || otpSent}
            className="btn-secondary flex-shrink-0 text-sm px-4">
            {otpSent ? '✓ Sent' : otpLoading ? '…' : 'Send OTP'}
          </button>
        </div>
        {errors.mobile_number && <p className="text-red-500 text-xs mt-1">{errors.mobile_number}</p>}
      </div>
      {otpSent && (
        <div>
          <label className="form-label">Enter OTP *</label>
          <input type="text" name="otp" value={data.otp} onChange={onChange}
            className={`form-input ${errors.otp ? 'border-red-400' : ''}`}
            placeholder="Enter 6-digit OTP" maxLength={6} required />
          {errors.otp && <p className="text-red-500 text-xs mt-1">{errors.otp}</p>}
          <p className="text-xs text-amber-600 mt-1">
            🔐 <strong>Demo OTP:</strong> Use <code className="bg-amber-50 px-1 rounded">123456</code>
          </p>
        </div>
      )}
    </div>
  )
}

function IdentityStep({ data, onChange, errors }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800 text-lg">Aadhaar Identity Verification</h3>
      <p className="text-sm text-gray-500">
        Your Aadhaar number will be verified through e-KYC. The raw number is never stored.
      </p>
      <div>
        <label className="form-label">Aadhaar Number (12 digits) *</label>
        <input type="text" name="aadhaar_number" value={data.aadhaar_number} onChange={onChange}
          className={`form-input ${errors.aadhaar_number ? 'border-red-400' : ''}`}
          placeholder="XXXX-XXXX-XXXX" maxLength={12} pattern="\d{12}" required />
        {errors.aadhaar_number && <p className="text-red-500 text-xs mt-1">{errors.aadhaar_number}</p>}
        <p className="text-xs text-gray-400 mt-1">Enter 12 digits without spaces or dashes.</p>
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" name="e_kyc_consent" checked={data.e_kyc_consent}
            onChange={(e) => onChange({ target: { name: 'e_kyc_consent', value: e.target.checked } })}
            className="mt-1 w-4 h-4 accent-gov-blue" required />
          <span className="text-sm text-blue-900">
            I hereby give my <strong>consent for Aadhaar-based e-KYC verification</strong> for the PM-KISAN
            scheme. I understand my Aadhaar data will be used only for identity verification and scheme
            eligibility assessment as per the Aadhaar Act 2016.
          </span>
        </label>
        {errors.e_kyc_consent && <p className="text-red-500 text-xs mt-2">{errors.e_kyc_consent}</p>}
      </div>
    </div>
  )
}

function BankStep({ data, onChange, errors }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800 text-lg">Bank Account Details</h3>
      <p className="text-sm text-gray-500">
        PM-KISAN installments are credited directly to your bank account via Direct Benefit Transfer (DBT).
      </p>
      <div>
        <label className="form-label">Bank Account Number *</label>
        <input type="text" name="bank_account_number" value={data.bank_account_number} onChange={onChange}
          className={`form-input ${errors.bank_account_number ? 'border-red-400' : ''}`}
          placeholder="9 to 18 digit account number" required />
        {errors.bank_account_number && <p className="text-red-500 text-xs mt-1">{errors.bank_account_number}</p>}
      </div>
      <div>
        <label className="form-label">IFSC Code *</label>
        <input type="text" name="ifsc_code" value={data.ifsc_code} onChange={onChange}
          className={`form-input uppercase ${errors.ifsc_code ? 'border-red-400' : ''}`}
          placeholder="e.g., SBIN0001234" pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" maxLength={11} required />
        {errors.ifsc_code && <p className="text-red-500 text-xs mt-1">{errors.ifsc_code}</p>}
        <p className="text-xs text-gray-400 mt-1">11-character code (e.g., SBIN0001234)</p>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
        ⚠️ Ensure your bank account is active and the account holder name matches your Aadhaar name.
        Mismatches may result in rejection.
      </div>
    </div>
  )
}

function LandStep({ data, onChange, errors }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800 text-lg">Land Parcel Details</h3>
      <p className="text-sm text-gray-500">
        Provide your land record details as per official revenue records (Khasra/Khatauni).
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">State Code *</label>
          <input type="text" name="state_code" value={data.state_code} onChange={onChange}
            className={`form-input uppercase ${errors.state_code ? 'border-red-400' : ''}`}
            placeholder="e.g., UP" maxLength={4} required />
          {errors.state_code && <p className="text-red-500 text-xs mt-1">{errors.state_code}</p>}
        </div>
        <div>
          <label className="form-label">District Code *</label>
          <input type="text" name="district_code" value={data.district_code} onChange={onChange}
            className={`form-input uppercase ${errors.district_code ? 'border-red-400' : ''}`}
            placeholder="e.g., AGR" maxLength={6} required />
          {errors.district_code && <p className="text-red-500 text-xs mt-1">{errors.district_code}</p>}
        </div>
        <div>
          <label className="form-label">Tehsil Code *</label>
          <input type="text" name="tehsil_code" value={data.tehsil_code} onChange={onChange}
            className={`form-input ${errors.tehsil_code ? 'border-red-400' : ''}`}
            placeholder="e.g., T001" required />
          {errors.tehsil_code && <p className="text-red-500 text-xs mt-1">{errors.tehsil_code}</p>}
        </div>
        <div>
          <label className="form-label">Village Code *</label>
          <input type="text" name="village_code" value={data.village_code} onChange={onChange}
            className={`form-input ${errors.village_code ? 'border-red-400' : ''}`}
            placeholder="e.g., V001" required />
          {errors.village_code && <p className="text-red-500 text-xs mt-1">{errors.village_code}</p>}
        </div>
        <div>
          <label className="form-label">Khata Number *</label>
          <input type="text" name="khata_number" value={data.khata_number} onChange={onChange}
            className={`form-input ${errors.khata_number ? 'border-red-400' : ''}`}
            placeholder="e.g., K001" required />
          {errors.khata_number && <p className="text-red-500 text-xs mt-1">{errors.khata_number}</p>}
        </div>
        <div>
          <label className="form-label">Plot / Khasra Number *</label>
          <input type="text" name="plot_number" value={data.plot_number} onChange={onChange}
            className={`form-input ${errors.plot_number ? 'border-red-400' : ''}`}
            placeholder="e.g., P001" required />
          {errors.plot_number && <p className="text-red-500 text-xs mt-1">{errors.plot_number}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Land Area (hectares) *</label>
          <input type="number" name="declared_land_area_ha" value={data.declared_land_area_ha}
            onChange={onChange} className={`form-input ${errors.declared_land_area_ha ? 'border-red-400' : ''}`}
            placeholder="e.g., 1.25" step="0.01" min="0.01" max="100" required />
          {errors.declared_land_area_ha && <p className="text-red-500 text-xs mt-1">{errors.declared_land_area_ha}</p>}
        </div>
        <div>
          <label className="form-label">Ownership Type *</label>
          <select name="ownership_type" value={data.ownership_type} onChange={onChange} className="form-input" required>
            {OWNERSHIP_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="form-label">Primary Crop (Optional)</label>
        <select name="declared_crop_code" value={data.declared_crop_code} onChange={onChange} className="form-input">
          <option value="">— Select crop (optional) —</option>
          {CROP_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  )
}

function DocumentStep({ file, onFileChange, errors }) {
  const fileRef = useRef()
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) onFileChange(dropped)
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800 text-lg">Upload Land Document</h3>
      <p className="text-sm text-gray-500">
        Upload a scanned copy of your land ownership document (Khasra/Khatauni extract or Land Deed).
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-gov-blue bg-blue-50' : file ? 'border-gov-green bg-green-50' : 'border-gray-300 hover:border-gov-blue hover:bg-blue-50'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files[0])}
        />
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="w-10 h-10 text-gov-green" />
            <p className="font-medium text-gov-green">{file.name}</p>
            <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFileChange(null) }}
              className="flex items-center gap-1 text-red-500 hover:text-red-700 text-sm mt-1"
            >
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <UploadCloud className="w-10 h-10 text-gray-400" />
            <p className="font-medium text-gray-600">Drag &amp; drop or click to upload</p>
            <p className="text-xs text-gray-400">PDF, JPG, PNG — Max 5MB</p>
          </div>
        )}
      </div>
      {errors.document && <p className="text-red-500 text-xs">{errors.document}</p>}
    </div>
  )
}

function DeclarationStep({ data, onChange, errors }) {
  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-gray-800 text-lg">Farmer Self-Declaration</h3>
      <p className="text-sm text-gray-500">
        Please read the following declarations carefully before submitting your application.
      </p>

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-4">
        <h4 className="font-semibold text-orange-900">Eligibility Declaration</h4>
        <ul className="text-sm text-orange-800 space-y-2 list-disc list-inside">
          <li>I am a genuine farmer and the land mentioned is cultivable agricultural land.</li>
          <li>I or any family member is not an income tax payee.</li>
          <li>I or any family member is not a current or former government employee drawing pension.</li>
          <li>I am not a registered doctor, engineer, lawyer, CA, or architect.</li>
          <li>The bank account provided is active and in my name.</li>
          <li>All information provided is true to the best of my knowledge.</li>
        </ul>

        <label className="flex items-start gap-3 cursor-pointer mt-3">
          <input type="checkbox" name="self_declaration" checked={data.self_declaration}
            onChange={(e) => onChange({ target: { name: 'self_declaration', value: e.target.checked } })}
            className="mt-1 w-4 h-4 accent-gov-blue" required />
          <span className="text-sm text-orange-900 font-medium">
            I hereby declare that all the information provided is true and correct. I understand that
            any false information may result in rejection of my application and legal action.
          </span>
        </label>
        {errors.self_declaration && <p className="text-red-500 text-xs">{errors.self_declaration}</p>}
      </div>
    </div>
  )
}

// ── Main Form Component ───────────────────────────────────────────────────────
const INITIAL_FORM = {
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
  state_code: '',
  district_code: '',
  tehsil_code: '',
  village_code: '',
  khata_number: '',
  plot_number: '',
  declared_land_area_ha: '',
  ownership_type: 'Single',
  declared_crop_code: '',
  self_declaration: false,
}

export default function ApplicationFormPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL_FORM)
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState({})
  const [otpSent, setOtpSent] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [submitError, setSubmitError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleSendOtp = () => {
    if (!/^\d{10}$/.test(form.mobile_number)) {
      setErrors((p) => ({ ...p, mobile_number: 'Enter a valid 10-digit mobile number.' }))
      return
    }
    setOtpLoading(true)
    setTimeout(() => { setOtpLoading(false); setOtpSent(true) }, 1000)
  }

  // Per-step validation
  const validateStep = () => {
    const errs = {}
    switch (step) {
      case 0: // Personal
        if (!form.farmer_name.trim()) errs.farmer_name = 'Full name is required.'
        if (!form.date_of_birth) errs.date_of_birth = 'Date of birth is required.'
        break
      case 1: // OTP
        if (!/^\d{10}$/.test(form.mobile_number)) errs.mobile_number = 'Enter a valid 10-digit mobile number.'
        if (!form.otp) errs.otp = 'Please enter the OTP.'
        else if (form.otp !== '123456') errs.otp = 'Invalid OTP. (Demo: use 123456)'
        break
      case 2: // Identity
        if (!/^\d{12}$/.test(form.aadhaar_number)) errs.aadhaar_number = 'Aadhaar must be exactly 12 digits.'
        if (!form.e_kyc_consent) errs.e_kyc_consent = 'e-KYC consent is required.'
        break
      case 3: // Bank
        if (!form.bank_account_number || form.bank_account_number.length < 9)
          errs.bank_account_number = 'Account number must be 9-18 digits.'
        if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(form.ifsc_code))
          errs.ifsc_code = 'Enter a valid IFSC code (e.g., SBIN0001234).'
        break
      case 4: // Land
        if (!form.state_code.trim()) errs.state_code = 'State code is required.'
        if (!form.district_code.trim()) errs.district_code = 'District code is required.'
        if (!form.tehsil_code.trim()) errs.tehsil_code = 'Tehsil code is required.'
        if (!form.village_code.trim()) errs.village_code = 'Village code is required.'
        if (!form.khata_number.trim()) errs.khata_number = 'Khata number is required.'
        if (!form.plot_number.trim()) errs.plot_number = 'Plot / Khasra number is required.'
        if (!form.declared_land_area_ha || Number(form.declared_land_area_ha) <= 0)
          errs.declared_land_area_ha = 'Land area must be greater than 0.'
        break
      case 5: // Document
        if (!file) errs.document = 'Please upload your land document.'
        else {
          if (!ALLOWED_MIME.includes(file.type)) errs.document = 'Only PDF, JPG, PNG files are allowed.'
          else if (file.size > MAX_FILE_MB * 1024 * 1024) errs.document = `File must be under ${MAX_FILE_MB}MB.`
        }
        break
      case 6: // Declaration
        if (!form.self_declaration) errs.self_declaration = 'You must accept the declaration to proceed.'
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

  // ── Submission success screen ─────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <CheckCircle className="w-12 h-12 text-gov-green" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
          <p className="text-gov-green font-semibold mb-6">Your PM-KISAN application has been received.</p>

          <div className="bg-gray-50 rounded-xl p-5 text-left space-y-3 mb-6 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Application ID</span>
              <span className="font-mono font-semibold">APP-{String(submitted.application_id).padStart(6, '0')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Scheme</span>
              <span className="font-semibold">{submitted.scheme_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="font-semibold text-blue-600">{submitted.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Parcel ID</span>
              <span className="font-mono text-xs">{submitted.parcel_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Aadhaar (Masked)</span>
              <span className="font-mono">{submitted.aadhaar_masked}</span>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 mb-6 text-left">
            <strong>Next Steps:</strong> {submitted.citizen_status_message}
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/dashboard')} className="btn-primary">
              Go to Dashboard
            </button>
            <button onClick={() => navigate(`/applications/${submitted.application_id}`)} className="btn-secondary">
              View Application
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">PM-KISAN Application</h1>
        <p className="text-gray-500 text-sm mt-1">
          Step {step + 1} of {STEPS.length} — {STEPS[step].label}
        </p>
      </div>

      <StepBar currentStep={step} />

      <div className="card">
        {/* Step content */}
        {step === 0 && <PersonalStep data={form} onChange={handleChange} errors={errors} />}
        {step === 1 && (
          <OTPStep data={form} onChange={handleChange} errors={errors}
            otpSent={otpSent} onSendOtp={handleSendOtp} otpLoading={otpLoading} />
        )}
        {step === 2 && <IdentityStep data={form} onChange={handleChange} errors={errors} />}
        {step === 3 && <BankStep data={form} onChange={handleChange} errors={errors} />}
        {step === 4 && <LandStep data={form} onChange={handleChange} errors={errors} />}
        {step === 5 && <DocumentStep file={file} onFileChange={setFile} errors={errors} />}
        {step === 6 && <DeclarationStep data={form} onChange={handleChange} errors={errors} />}

        {/* Submit error */}
        {submitError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mt-4 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0}
            className="flex items-center gap-2 btn-secondary disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button type="button" onClick={handleNext} className="flex items-center gap-2 btn-primary">
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 btn-primary bg-gov-green hover:bg-green-700"
            >
              {submitting ? 'Submitting…' : 'Submit Application'}
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
