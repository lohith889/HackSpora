import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Leaf, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const result = await login(form.email, form.password)
    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gov-navy via-gov-blue to-gov-light-blue flex flex-col">
      {/* Top gov bar */}
      <div className="bg-black/20 text-white/80 text-xs py-1 px-6 text-center">
        Government of India — Ministry of Agriculture &amp; Farmers Welfare
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gov-green rounded-2xl mb-4 shadow-lg">
              <Leaf className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">KisanGuard</h1>
            <p className="text-blue-200 mt-1 text-sm">PM-KISAN Scheme Application Portal</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Farmer Login</h2>
            <p className="text-sm text-gray-500 mb-6">Sign in to access your PM-KISAN application</p>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                className="btn-primary w-full mt-2"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              New farmer?{' '}
              <Link to="/register" className="text-gov-blue font-semibold hover:underline">
                Register here
              </Link>
            </p>
          </div>

          <p className="text-center text-blue-200 text-xs mt-6">
            Secured by Digital India Infrastructure
          </p>
        </div>
      </div>
    </div>
  )
}
