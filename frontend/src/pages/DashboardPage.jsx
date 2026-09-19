import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { applicationAPI } from '../api/client'
import ApplicationCard from '../components/ApplicationCard'
import Spinner from '../components/Spinner'
import { FilePlus, Inbox, RefreshCw, User, Phone, Calendar } from 'lucide-react'
import { formatDate } from '../utils/statusUtils'

export default function DashboardPage() {
  const { user } = useAuth()
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchApplications = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await applicationAPI.myApplications()
      setApps(data)
    } catch (err) {
      setError('Failed to load your applications. Please try refreshing.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  return (
    <div>
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-gov-blue to-gov-light-blue rounded-2xl p-6 text-white mb-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              Jai Kisan! 🌾 {user?.full_name?.split(' ')[0] || 'Farmer'}
            </h1>
            <p className="text-blue-100 text-sm">
              Welcome to the PM-KISAN Pradhan Mantri Kisan Samman Nidhi application portal.
            </p>
            {/* User profile summary */}
            <div className="flex flex-wrap gap-4 mt-3 text-blue-100 text-sm">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {user?.email}
              </span>
              {user?.mobile_number && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {user.mobile_number}
                </span>
              )}
              {user?.date_of_birth && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  DOB: {formatDate(user.date_of_birth)}
                </span>
              )}
            </div>
          </div>
          <Link
            to="/apply"
            className="flex items-center gap-2 bg-gov-saffron hover:bg-orange-600 text-white font-semibold px-5 py-3 rounded-xl transition-colors shadow-md flex-shrink-0"
          >
            <FilePlus className="w-5 h-5" />
            Apply for PM-KISAN
          </Link>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-800">
        <strong>PM-KISAN Scheme:</strong> Under this scheme, eligible farmer families receive ₹6,000 per year
        in three equal installments of ₹2,000 directly to their bank accounts.
      </div>

      {/* Applications Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          My Applications
          {!loading && (
            <span className="ml-2 text-sm text-gray-400 font-normal">({apps.length})</span>
          )}
        </h2>
        <button
          onClick={fetchApplications}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gov-blue hover:text-gov-navy font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <div className="card text-center py-8">
          <p className="text-red-600 mb-3">{error}</p>
          <button onClick={fetchApplications} className="btn-secondary">Retry</button>
        </div>
      ) : apps.length === 0 ? (
        <div className="card text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <Inbox className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Applications Yet</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            You have not submitted any PM-KISAN applications. Click below to start your application.
          </p>
          <Link to="/apply" className="btn-primary">
            Start PM-KISAN Application
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {apps.map((app) => (
            <ApplicationCard key={app.id} app={app} />
          ))}
        </div>
      )}

      {/* Help footer */}
      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
        <strong>Need Help?</strong> Contact the PM-KISAN helpline at{' '}
        <strong>155261</strong> or visit your nearest Common Service Centre (CSC).
      </div>
    </div>
  )
}
