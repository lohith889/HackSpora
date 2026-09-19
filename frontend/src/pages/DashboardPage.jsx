import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { applicationAPI } from '../api/client'
import ApplicationCard from '../components/ApplicationCard'
import Spinner from '../components/Spinner'
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
      setError('Failed to load application ledger. Please try refreshing.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  return (
    <div className="space-y-6 text-left font-sans">
      {/* Editorial Header Block (Asymmetric & Bordered) */}
      <div className="border border-slate-300 bg-white shadow-sm overflow-hidden">
        {/* National tri-color accent line */}
        <div className="h-1 flex w-full">
          <div className="bg-[#f97316] w-1/3" />
          <div className="bg-white w-1/3 border-b border-slate-200" />
          <div className="bg-[#16a34a] w-1/3" />
        </div>

        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  PM-KISAN BENEFICIARY SERVICES // कृषक सेवा पोर्टल
                </span>
                <span className="stamp border border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px] font-bold">
                  AUTHENTICATED CITIZEN
                </span>
              </div>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-slate-900 mt-1">
                {user?.full_name || 'Registered Cultivator'}
              </h1>
              <p className="font-sans text-xs text-slate-600 mt-0.5">
                Pradhan Mantri Kisan Samman Nidhi (PM-KISAN) • Direct Benefit Transfer Portal
              </p>
            </div>

            <Link
              to="/apply"
              className="bg-emerald-900 hover:bg-emerald-800 text-white self-start md:self-auto py-2.5 px-5 text-xs font-mono font-bold uppercase tracking-wider transition-colors shadow-sm"
            >
              + Lodge New Claim (Form A-1) →
            </Link>
          </div>

          {/* Monospace User Metadata Rule */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mt-4 font-mono text-xs text-slate-600">
            <span>REGISTRATION EMAIL: <strong className="text-slate-900">{user?.email || '—'}</strong></span>
            {user?.mobile_number && (
              <span>MOBILE: <strong className="text-slate-900">{user.mobile_number}</strong></span>
            )}
            {user?.date_of_birth && (
              <span>DATE OF BIRTH: <strong className="text-slate-900">{formatDate(user.date_of_birth)}</strong></span>
            )}
            <span>KYC STATUS: <strong className="text-emerald-800 font-bold">VERIFIED ON RECORD</strong></span>
          </div>
        </div>
      </div>

      {/* Statutory Scheme Parameter Rule */}
      <div className="border border-slate-300 p-4 bg-slate-50 font-mono text-xs leading-relaxed text-slate-700 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <strong className="text-slate-900 uppercase font-bold">Statutory Entitlement (Clause 3):</strong>{' '}
          Financial assistance of ₹6,000/- per annum in three equal 4-monthly installments of ₹2,000/- credited directly into authenticated Aadhaar-linked bank accounts via PFMS/DBT.
        </div>
        <span className="text-[10px] text-slate-500 uppercase border border-slate-200 px-2 py-1 bg-white font-semibold whitespace-nowrap">
          F.No. 1-1/2019-Credit-I
        </span>
      </div>

      {/* Applications Section */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
          <div className="flex items-baseline gap-3">
            <h2 className="font-serif text-xl font-bold text-slate-900">
              Submitted Benefit Claims &amp; Application Dockets
            </h2>
            {!loading && (
              <span className="font-mono text-xs text-slate-600 font-semibold border border-slate-200 px-2 py-0.5 bg-slate-50">
                {apps.length} {apps.length === 1 ? 'RECORD' : 'RECORDS'}
              </span>
            )}
          </div>
          <button
            onClick={fetchApplications}
            disabled={loading}
            className="font-mono text-xs uppercase tracking-wider text-slate-600 hover:text-slate-900 underline transition-colors"
          >
            {loading ? 'Refreshing...' : 'Reload Ledger ↻'}
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-900">
            <Spinner />
          </div>
        ) : error ? (
          <div className="border border-red-300 bg-red-50 text-red-800 p-4 font-mono text-xs">
            <strong>[ERROR]</strong> {error}
            <button onClick={fetchApplications} className="ml-3 underline font-semibold">
              Retry
            </button>
          </div>
        ) : apps.length === 0 ? (
          <div className="border border-slate-300 p-10 text-left bg-white space-y-4 shadow-sm">
            <span className="font-mono text-xs uppercase tracking-widest text-slate-500 block font-semibold">
              [ LEDGER EMPTY // NO RECORD DETECTED ]
            </span>
            <h3 className="font-serif text-xl font-bold text-slate-900">
              No Cultivator Claims Filed Under This Beneficiary Profile
            </h3>
            <p className="text-sm text-slate-600 max-w-lg leading-relaxed font-sans">
              You have not yet lodged an agricultural land parcel claim for PM-KISAN subsidy verification. Click below to start your digital application with instant State Bhulekh and PFMS cross-verification.
            </p>
            <div className="pt-2">
              <Link
                to="/apply"
                className="bg-emerald-900 hover:bg-emerald-800 text-white font-mono text-xs uppercase tracking-wider font-bold py-2.5 px-5 inline-block transition-colors"
              >
                Initiate New Subsidy Application (Form A-1) →
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {apps.map((app) => (
              <ApplicationCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </div>

      {/* Official Assistance Notice */}
      <div className="border-t border-slate-200 pt-4 font-mono text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-2">
        <span>PM-KISAN TOLL FREE HELPLINE: <strong className="text-slate-900">155261</strong> / <strong className="text-slate-900">011-24300606</strong></span>
        <span>COMMON SERVICE CENTRE (CSC) KIOSK ASSISTANCE ENABLED</span>
      </div>
    </div>
  )
}
