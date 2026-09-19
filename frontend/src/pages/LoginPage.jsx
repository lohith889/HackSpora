import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Leaf, Eye, EyeOff, AlertCircle, ShieldAlert, UserCheck, KeyRound } from 'lucide-react'

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
    <div className="min-h-screen bg-gradient-to-br from-gov-navy via-gov-blue to-gov-light-blue flex flex-col">
      {/* Top gov bar */}
      <div className="bg-black/20 text-white/80 text-xs py-1.5 px-6 text-center flex items-center justify-between">
        <span>Government of India — Ministry of Agriculture &amp; Farmers Welfare</span>
        <span className="hidden sm:inline-block font-mono">PM-KISAN AI Verification v1.0</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 shadow-lg transition-colors ${
              activeTab === 'admin' ? 'bg-red-700' : 'bg-gov-green'
            }`}>
              {activeTab === 'admin' ? (
                <ShieldAlert className="w-9 h-9 text-white" />
              ) : (
                <Leaf className="w-9 h-9 text-white" />
              )}
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">KisanGuard</h1>
            <p className="text-blue-200 mt-0.5 text-sm">
              {activeTab === 'admin'
                ? 'AI-Driven Anomaly Detection & Scheme Officer Console'
                : 'PM-KISAN Citizen Application & Subsidy Tracking Portal'}
            </p>
          </div>

          {/* Quick Demo Access Bar */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2.5 mb-4 text-xs">
            <div className="text-white/80 font-medium mb-1.5 flex items-center gap-1.5 px-1">
              <KeyRound className="w-3.5 h-3.5 text-yellow-300" />
              <span>Quick Demo Fill:</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDemoCredentials('farmer')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg font-medium transition-all ${
                  activeTab === 'farmer' && form.email === 'farmer@test.com'
                    ? 'bg-gov-green text-white shadow'
                    : 'bg-white/15 text-white/90 hover:bg-white/25'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" /> Farmer Login
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('admin')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg font-medium transition-all ${
                  activeTab === 'admin' && form.email === 'admin@pmkisan.gov.in'
                    ? 'bg-red-700 text-white shadow'
                    : 'bg-white/15 text-white/90 hover:bg-white/25'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Admin Officer
              </button>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-7">
            {/* Tab switch */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => { setActiveTab('farmer'); setError('') }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'farmer' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                🌾 Farmer Applicant
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('admin'); setError('') }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'admin' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                🔒 Scheme Officer (Admin)
              </button>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {activeTab === 'admin' ? 'Scheme Officer Login' : 'Farmer Citizen Login'}
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              {activeTab === 'admin'
                ? 'Sign in to access anomaly dossiers, verification metrics, and adjudication controls.'
                : 'Sign in to submit PM-KISAN subsidy claims and track status.'}
            </p>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">
                  {activeTab === 'admin' ? 'Official Government Email' : 'Email Address'}
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="form-input"
                  placeholder={activeTab === 'admin' ? 'admin@pmkisan.gov.in' : 'farmer@test.com'}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    className="form-input pr-10"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
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

              <button
                type="submit"
                disabled={loading}
                className={`w-full font-semibold py-3 px-4 rounded-xl text-white transition-all shadow-md mt-2 ${
                  activeTab === 'admin'
                    ? 'bg-gray-900 hover:bg-black focus:ring-2 focus:ring-gray-700'
                    : 'btn-primary'
                }`}
              >
                {loading
                  ? 'Verifying Credentials…'
                  : activeTab === 'admin'
                  ? 'Access Officer Console'
                  : 'Sign in to Portal'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-gray-600">
              New farmer?{' '}
              <Link to="/register" className="text-gov-blue font-semibold hover:underline">
                Register here
              </Link>
            </p>
          </div>

          <p className="text-center text-blue-200 text-xs mt-5">
            Secured by Digital India Infrastructure &amp; Role-Based Access Control
          </p>
        </div>
      </div>
    </div>
  )
}
