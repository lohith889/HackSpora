import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Leaf, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

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
      return setError('Mobile number must be exactly 10 digits.')
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
    <div className="min-h-screen bg-gradient-to-br from-gov-navy via-gov-blue to-gov-light-blue flex flex-col">
      <div className="bg-black/20 text-white/80 text-xs py-1 px-6 text-center">
        Government of India — Ministry of Agriculture &amp; Farmers Welfare
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gov-green rounded-2xl mb-3 shadow-lg">
              <Leaf className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">KisanGuard Portal</h1>
            <p className="text-blue-200 text-sm">Register as a PM-KISAN Beneficiary</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Create Account</h2>
            <p className="text-sm text-gray-500 mb-6">All fields are required for PM-KISAN eligibility verification</p>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="form-label">Full Name (as per Aadhaar)</label>
                <input
                  type="text"
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g., Ramesh Kumar Singh"
                  required
                  minLength={2}
                />
              </div>

              {/* Email */}
              <div>
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="your@email.com"
                  required
                />
              </div>

              {/* Mobile */}
              <div>
                <label className="form-label">Mobile Number (linked to Aadhaar)</label>
                <input
                  type="tel"
                  name="mobile_number"
                  value={form.mobile_number}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="10-digit mobile number"
                  pattern="\d{10}"
                  required
                />
              </div>

              {/* DOB */}
              <div>
                <label className="form-label">Date of Birth</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={form.date_of_birth}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>

              {/* Gender + Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Gender</label>
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    className="form-input"
                    required
                  >
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="form-input"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    className="form-input pr-10"
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Data Consent notice */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
                  <span>
                    Your personal data will be processed strictly for PM-KISAN scheme verification
                    under the IT Act 2000 and relevant government regulations.
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-2"
              >
                {loading ? 'Creating account…' : 'Create Farmer Account'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-600">
              Already registered?{' '}
              <Link to="/login" className="text-gov-blue font-semibold hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
