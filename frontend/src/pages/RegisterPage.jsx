import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const GENDER_OPTIONS = ['Male', 'Female', 'Other']
const CATEGORY_OPTIONS = ['General', 'OBC', 'SC', 'ST']

export default function RegisterPage() {
  const { register, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    mobile_number: '',
    date_of_birth: '',
    gender: 'Male',
    category: 'General',
    password: '',
  })

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!/^\d{10}$/.test(form.mobile_number)) {
      return setError('Mobile number must be exactly 10 numeric digits.')
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters.')
    }

    const result = await register(form)
    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 3-Color Subtle National Tri-Band Motif */}
      <div className="h-[3px] w-full flex">
        <div className="h-full w-1/3 bg-[#f97316]"></div>
        <div className="h-full w-1/3 bg-white border-y border-slate-300"></div>
        <div className="h-full w-1/3 bg-[#16a34a]"></div>
      </div>

      {/* Top Government of India Official Utility Ribbon */}
      <div className="border-b border-slate-200 bg-slate-100/80 px-6 py-1.5 font-mono text-[11px] text-slate-700">
        <div className="max-w-4xl w-full mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 tracking-wider">भारत सरकार</span>
            <span className="text-slate-400">|</span>
            <span className="font-semibold text-slate-800">Government of India</span>
            <span className="text-slate-400">|</span>
            <span className="hidden md:inline text-slate-600">कृषि एवं किसान कल्याण मंत्रालय</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-600 uppercase tracking-wider">
            <span>Direct Benefit Transfer (DBT)</span>
            <span className="text-slate-400">|</span>
            <span>GIGW 3.0 Standard</span>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-10">
        <div className="border border-slate-300 p-8 bg-white text-left shadow-none">
          <div className="border-b border-slate-200 pb-4 mb-6">
            <div className="flex items-center gap-3 mb-2">
              {/* Ashoka Emblem Representation */}
              <div className="border-r-2 border-slate-300 pr-3 text-center font-serif leading-none select-none">
                <div className="text-[12px] font-bold tracking-widest text-slate-800">सत्यमेव जयते</div>
                <div className="text-[8px] uppercase tracking-wider text-slate-500 font-sans mt-0.5 font-bold">Govt. of India</div>
              </div>
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-800 font-bold block">
                  FORM A-1 // BENEFICIARY ENROLMENT DOCKET
                </span>
                <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
                  CLAUSE 4(1) OF PM-KISAN OPERATIONAL GUIDELINES
                </span>
              </div>
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Cultivator Beneficiary Registration
            </h1>
            <p className="font-mono text-xs text-slate-600 mt-1">
              Provide identity particulars exactly corresponding with UIDAI Aadhaar and State Land Revenue Records
            </p>
          </div>

          {error && (
            <div className="border border-red-300 bg-red-50 text-red-800 p-3 mb-6 font-mono text-xs">
              <strong className="block">[REGISTRATION REJECTED]</strong>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="form-label">Farmer Full Legal Name (as on Aadhaar) *</label>
                <input
                  type="text"
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. Ramesh Kumar"
                  required
                  minLength={2}
                />
              </div>

              <div>
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="name@domain.com"
                  required
                />
              </div>

              <div>
                <label className="form-label">10-Digit Mobile Telephony Number *</label>
                <input
                  type="tel"
                  name="mobile_number"
                  value={form.mobile_number}
                  onChange={handleChange}
                  className="form-input font-mono"
                  placeholder="9876543210"
                  maxLength={10}
                  required
                />
              </div>

              <div>
                <label className="form-label">Date of Birth *</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={form.date_of_birth}
                  onChange={handleChange}
                  className="form-input font-mono"
                  required
                />
              </div>

              <div>
                <label className="form-label">Gender Classification *</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="form-input bg-white"
                  required
                >
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Cultivator Social Category *</label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="form-input bg-white"
                  required
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label mb-0">Password (Min 6 Characters) *</label>
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="font-mono text-[11px] text-slate-500 hover:text-slate-900 underline"
                >
                  {showPwd ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <input
                type={showPwd ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                className="form-input"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div className="border border-slate-300 p-3 bg-slate-50 font-mono text-xs text-slate-700 leading-relaxed">
              <strong>STATUTORY UNDERTAKING:</strong> I hereby declare that the particulars furnished above are true and correct to the best of my knowledge. I understand that false statements will attract benefit cancellation, recovery with interest, and prosecution under Section 199/200 IPC.
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full sm:w-auto py-2.5 px-8 font-mono text-xs tracking-wider uppercase font-semibold"
              >
                {loading ? '[ TRANSMITTING DOCKET... ]' : 'Submit Registration Docket →'}
              </button>

              <div className="font-mono text-xs">
                <span className="text-slate-600">Already registered? </span>
                <Link to="/login" className="text-slate-900 font-bold underline hover:text-emerald-800">
                  Sign In to Portal →
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Formal Government Statutory Footer */}
      <footer className="border-t border-slate-300 bg-white py-6 px-6 font-mono text-xs text-slate-600 mt-auto">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-3 text-[11px]">
            <div>
              <span className="font-bold text-slate-900">PRADHAN MANTRI KISAN SAMMAN NIDHI (PM-KISAN)</span>
              <span className="block text-slate-500 font-sans text-xs mt-0.5">
                Department of Agriculture and Farmers Welfare, Government of India
              </span>
            </div>
            <div className="text-left sm:text-right font-mono text-[10px] text-slate-600">
              <span>SECURITY PROTOCOL: NIC-CERT AUDITED</span>
              <span className="block text-slate-500">DIGITAL PERSONAL DATA PROTECTION COMPLIANT</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-slate-500 font-sans">
            <p>
              Website Content Managed by <strong>Ministry of Agriculture &amp; Farmers Welfare</strong>.
            </p>
            <p className="font-mono">
              Helpline: <strong>155261</strong> / <strong>011-24300606</strong> (Toll Free: <strong>1800-115-526</strong>)
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
