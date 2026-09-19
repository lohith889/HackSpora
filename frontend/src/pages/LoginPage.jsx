import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('farmer') // 'farmer' or 'admin'
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const setDemoCredentials = (role) => {
    setError('')
    setActiveTab(role)
    if (role === 'admin') {
      setForm({ email: 'admin@pmkisan.gov.in', password: 'Admin@123' })
    } else {
      setForm({ email: 'farmer@test.com', password: 'Farmer@123' })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const result = await login(form.email, form.password)
    if (result.success) {
      if (result.user?.role === 'ADMIN') {
        navigate('/admin')
      } else {
        navigate('/dashboard')
      }
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 3-Color National Tri-Band Motif */}
      <div className="h-[3px] w-full flex">
        <div className="h-full w-1/3 bg-[#f97316]"></div>
        <div className="h-full w-1/3 bg-white border-y border-slate-300"></div>
        <div className="h-full w-1/3 bg-[#16a34a]"></div>
      </div>

      {/* Top Government of India Official Utility Ribbon */}
      <div className="border-b border-slate-200 bg-slate-100/80 px-6 py-1.5 font-mono text-[11px] text-slate-700">
        <div className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 tracking-wider">भारत सरकार</span>
            <span className="text-slate-400">|</span>
            <span className="font-semibold text-slate-800">Government of India</span>
            <span className="text-slate-400">|</span>
            <span className="hidden md:inline text-slate-600">कृषि एवं किसान कल्याण मंत्रालय</span>
            <span className="hidden md:inline text-slate-400">|</span>
            <span className="hidden lg:inline text-slate-600">Ministry of Agriculture &amp; Farmers Welfare</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-600 uppercase tracking-wider">
            <span>Direct Benefit Transfer (DBT)</span>
            <span className="text-slate-400">|</span>
            <span>GIGW 3.0 Standard</span>
          </div>
        </div>
      </div>

      {/* Main Grid-based Asymmetrical Layout */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        {/* Left Editorial Docket (7 columns) */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3 mb-2">
              {/* Ashoka Emblem Representation */}
              <div className="border-r-2 border-slate-300 pr-3 text-center font-serif leading-none select-none">
                <div className="text-[12px] font-bold tracking-widest text-slate-800">सत्यमेव जयते</div>
                <div className="text-[8px] uppercase tracking-wider text-slate-500 font-sans mt-0.5 font-bold">Govt. of India</div>
              </div>
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-800 font-bold block">
                  केन्द्रीय प्रमाणीकरण प्रणाली // CENTRAL ACCESS GATEWAY
                </span>
                <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
                  GAZETTE REF: PMK-2026-REGISTRY
                </span>
              </div>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
              Pradhan Mantri Kisan Samman Nidhi
            </h1>
            <p className="font-sans text-base font-semibold text-emerald-900 mt-1">
              KisanGuard: Automated Multi-Registry Anomaly Detection &amp; Entitlement Management Portal
            </p>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed font-sans max-w-xl">
            Official statutory gateway for eligible landholder cultivator registrations and entitlement management under the PM-KISAN central sector scheme. Applications undergo automated multi-registry cross-reconciliation across State Bhulekh Land Records, PFMS Banking Systems, and statutory exclusion dockets.
          </p>

          {/* Official Registry Parameter Matrix */}
          <div className="border border-slate-300 p-5 bg-white space-y-3 font-mono text-xs shadow-none">
            <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-600 uppercase">Statutory Authority:</span>
              <span className="font-semibold text-slate-900">PM-KISAN Operational Guidelines Sec. 4</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-600 uppercase">Fraud Pipeline:</span>
              <span className="font-semibold text-slate-900">8-Engine Deterministic &amp; Isolation Forest ML</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-600 uppercase">Privacy Standard:</span>
              <span className="font-semibold text-slate-900">Zero-Leak Salted SHA-256 Aadhaar Tokenization</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-slate-600 uppercase">Subsidy Clearance:</span>
              <span className="font-semibold text-emerald-800">Officer Adjudication Gated (No Auto-Disburse)</span>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-500 leading-relaxed border-l-2 border-slate-400 pl-3 bg-slate-100/60 py-2 pr-2">
            <strong>STATUTORY NOTICE:</strong> All declarations made on this portal are legally binding affirmations under Section 199 and 200 of the Indian Penal Code, 1860. Falsification of land records, benami submissions, or ineligible claims are subject to immediate benefit recovery and penal prosecution.
          </div>
        </div>

        {/* Right Utilitarian Login Box (5 columns) */}
        <div className="lg:col-span-5 border border-slate-300 p-6 bg-white shadow-none">
          <div className="border-b border-slate-200 pb-3 mb-5">
            <h2 className="font-serif text-xl font-bold text-slate-900">Portal Authentication</h2>
            <p className="font-mono text-xs text-slate-600 mt-0.5">Select role and enter registered credentials</p>
          </div>

          {/* Role Switcher Tabs (Formal Govt Styling) */}
          <div className="grid grid-cols-2 gap-0 border border-slate-300 mb-5 font-mono text-xs uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setDemoCredentials('farmer')}
              className={`py-2 px-3 text-center border-r border-slate-300 transition-colors ${
                activeTab === 'farmer'
                  ? 'bg-emerald-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-white'
              }`}
            >
              01 Citizen / कृषक
            </button>
            <button
              type="button"
              onClick={() => setDemoCredentials('admin')}
              className={`py-2 px-3 text-center transition-colors ${
                activeTab === 'admin'
                  ? 'bg-emerald-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-white'
              }`}
            >
              02 Officer / अधिकारी
            </button>
          </div>

          {/* Quick Demo Credentials Autofill */}
          <div className="border border-slate-200 p-3 mb-5 bg-slate-50 font-mono text-xs">
            <span className="text-slate-600 uppercase block mb-1.5 text-[10px] tracking-wider font-semibold">Test Evaluation Credentials:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDemoCredentials('farmer')}
                className="border border-slate-300 bg-white px-2.5 py-1 hover:border-slate-800 transition-colors text-slate-800 text-[11px] font-semibold"
              >
                Auto-fill Farmer
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('admin')}
                className="border border-slate-300 bg-white px-2.5 py-1 hover:border-slate-800 transition-colors text-slate-800 text-[11px] font-semibold"
              >
                Auto-fill Admin
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="border border-red-300 bg-red-50 text-red-800 p-3 mb-4 font-mono text-xs">
              <strong className="block">[AUTHENTICATION FAILED]</strong>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="form-label">Registered Email Address *</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="form-input"
                placeholder={activeTab === 'admin' ? 'officer@pmkisan.gov.in' : 'farmer@domain.com'}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label mb-0">Password *</label>
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
                required
                className="form-input"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-2 font-mono text-xs tracking-wider uppercase font-semibold"
            >
              {loading ? '[ AUTHENTICATING ACCESS... ]' : 'Authenticate & Sign In →'}
            </button>
          </form>

          {/* Registration Link */}
          <div className="mt-6 pt-4 border-t border-slate-200 text-left font-mono text-xs">
            <span className="text-slate-500">Unregistered cultivator? </span>
            <Link to="/register" className="text-slate-900 font-bold underline hover:text-emerald-800">
              Submit Form A-1 Enrolment →
            </Link>
          </div>
        </div>
      </div>

      {/* Formal Government Statutory Footer */}
      <footer className="border-t border-slate-300 bg-white py-6 px-6 font-mono text-xs text-slate-600 mt-auto">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-3 text-[11px]">
            <div>
              <span className="font-bold text-slate-900">PRADHAN MANTRI KISAN SAMMAN NIDHI (PM-KISAN)</span>
              <span className="block text-slate-500 font-sans text-xs mt-0.5">
                Department of Agriculture and Farmers Welfare, Ministry of Agriculture &amp; Farmers Welfare, Government of India
              </span>
            </div>
            <div className="text-left sm:text-right font-mono text-[10px] text-slate-600">
              <span>SECURITY CERTIFICATION: NIC-CERT COMPLIANT</span>
              <span className="block text-slate-500">DIGITAL PERSONAL DATA PROTECTION COMPLIANT</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-slate-500 font-sans">
            <p>
              Website Content Managed by <strong>Ministry of Agriculture &amp; Farmers Welfare</strong>. Hosted by National Informatics Subsystem.
            </p>
            <p className="font-mono">
              National Helpline: <strong>155261</strong> / <strong>011-24300606</strong> (Toll Free: <strong>1800-115-526</strong>)
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
