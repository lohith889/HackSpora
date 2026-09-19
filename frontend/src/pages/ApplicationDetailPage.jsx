import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { applicationAPI } from '../api/client'
import { getStatusConfig, formatDate } from '../utils/statusUtils'
import Spinner from '../components/Spinner'
import {
  ArrowLeft, User, Phone, MapPin, Landmark, FileText,
  Calendar, ShieldCheck, CheckCircle, Clock, Info
} from 'lucide-react'

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide sm:w-44 flex-shrink-0">{label}</span>
      <span className={`text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  )
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card mb-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-gov-blue/10 p-2 rounded-lg">
          <Icon className="w-4 h-4 text-gov-blue" />
        </div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  )
}

// Timeline step
const TIMELINE = [
  { status: 'SUBMITTED', label: 'Application Received', icon: CheckCircle },
  { status: 'UNDER_REVIEW', label: 'Under Officer Review', icon: Clock },
  { status: 'APPROVED', label: 'Approved & Disbursed', icon: CheckCircle },
]

export default function ApplicationDetailPage() {
  const { id } = useParams()
  const [app, setApp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchApp = async () => {
      setLoading(true)
      try {
        const { data } = await applicationAPI.getDetail(id)
        setApp(data)
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load application details.')
      } finally {
        setLoading(false)
      }
    }
    fetchApp()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card text-center py-10">
        <p className="text-red-600 mb-4">{error}</p>
        <Link to="/dashboard" className="btn-secondary">Back to Dashboard</Link>
      </div>
    )
  }

  const statusCfg = getStatusConfig(app.status)

  // Determine active timeline step
  const activeTimelineIdx = (() => {
    if (['APPROVED'].includes(app.status)) return 2
    if (['UNDER_REVIEW', 'HOLD', 'REQUEST_DOCUMENTS', 'ESCALATED'].includes(app.status)) return 1
    return 0
  })()

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-gov-blue hover:text-gov-navy text-sm font-medium mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Header card */}
      <div className="bg-gradient-to-r from-gov-blue to-gov-light-blue rounded-2xl p-6 text-white mb-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <p className="text-blue-200 text-xs mb-1">Application Reference</p>
            <h1 className="text-xl font-bold font-mono">APP-{String(app.id).padStart(6, '0')}</h1>
            <p className="text-blue-100 mt-1">{app.farmer_name}</p>
            <p className="text-blue-200 text-sm mt-0.5">{app.scheme_code} Scheme</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold ${statusCfg.color} border`}>
              <span>{statusCfg.icon}</span>
              <span>{statusCfg.label}</span>
            </div>
            {app.submitted_at && (
              <p className="text-blue-200 text-xs mt-2">
                Submitted: {formatDate(app.submitted_at)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status guidance */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-gov-blue flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-gov-blue text-sm mb-0.5">Application Status Update</p>
          <p className="text-sm text-blue-800">{app.citizen_status_message}</p>
        </div>
      </div>

      {/* Application Progress Timeline */}
      <div className="card mb-4">
        <h3 className="font-semibold text-gray-900 mb-5">Application Progress</h3>
        <div className="flex items-center justify-between">
          {TIMELINE.map((step, idx) => {
            const Icon = step.icon
            const isDone = idx < activeTimelineIdx
            const isActive = idx === activeTimelineIdx
            return (
              <div key={step.status} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      isDone ? 'bg-gov-green text-white' :
                      isActive ? 'bg-gov-blue text-white ring-4 ring-blue-100' :
                      'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-medium max-w-[72px] ${
                    isActive ? 'text-gov-blue' : isDone ? 'text-gov-green' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {idx < TIMELINE.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${idx < activeTimelineIdx ? 'bg-gov-green' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Personal Details */}
      <Section title="Personal Information" icon={User}>
        <DetailRow label="Full Name" value={app.farmer_name} />
        <DetailRow label="Date of Birth" value={formatDate(app.date_of_birth)} />
        <DetailRow label="Gender" value={app.gender} />
        <DetailRow label="Category" value={app.category} />
      </Section>

      {/* Contact & Identity */}
      <Section title="Contact & Identity" icon={ShieldCheck}>
        <DetailRow label="Mobile Number" value={app.mobile_number} />
        <DetailRow label="Aadhaar (Masked)" value={app.aadhaar_masked} mono />
      </Section>

      {/* Bank Details */}
      <Section title="Bank Account" icon={Landmark}>
        <DetailRow label="Account Number" value={app.bank_account_number} mono />
        <DetailRow label="IFSC Code" value={app.ifsc_code} mono />
      </Section>

      {/* Land Details */}
      <Section title="Land Parcel" icon={MapPin}>
        <DetailRow label="Parcel ID" value={app.parcel_id} mono />
        <DetailRow label="State / District" value={`${app.state_code} / ${app.district_code}`} />
        <DetailRow label="Tehsil / Village" value={`${app.tehsil_code} / ${app.village_code}`} />
        <DetailRow label="Khata / Plot" value={`${app.khata_number} / ${app.plot_number}`} />
        <DetailRow label="Land Area" value={`${app.declared_land_area_ha} Hectares`} />
        <DetailRow label="Ownership Type" value={app.ownership_type} />
        {app.declared_crop_code && <DetailRow label="Declared Crop" value={app.declared_crop_code} />}
      </Section>

      {/* Document */}
      <Section title="Uploaded Document" icon={FileText}>
        <DetailRow label="Land Document" value="✅ Document uploaded and on record" />
      </Section>

      {/* Official Guidance */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mt-2">
        <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Official Government Guidance
        </h4>
        <ul className="text-sm text-amber-800 space-y-1.5 list-disc list-inside">
          <li>PM-KISAN installments are released in April, August, and December each year.</li>
          <li>Ensure your bank account details are up to date to avoid payment failures.</li>
          <li>Track your benefit status at <strong>pmkisan.gov.in</strong>.</li>
          <li>For queries, call PM-KISAN helpline: <strong>155261</strong>.</li>
          <li>If you need to update details, visit your nearest Common Service Centre (CSC).</li>
        </ul>
      </div>

      {/* Privacy notice — explicitly no risk score exposed (FARM-03) */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-4 text-xs text-gray-500">
        <p>
          <ShieldCheck className="inline w-3.5 h-3.5 mr-1 text-gray-400" />
          Your application details are protected under the Digital India data protection framework.
          Internal processing details are not visible to applicants.
        </p>
      </div>
    </div>
  )
}
