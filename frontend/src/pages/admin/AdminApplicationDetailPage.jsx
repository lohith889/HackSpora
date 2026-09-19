import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { adminAPI, applicationAPI } from '../../api/client'
import {
  getRiskTier, getStatusBadge, SEVERITY_COLORS,
  formatDate, formatDateTime
} from '../../utils/adminUtils'
import Spinner from '../../components/Spinner'
import {
  ArrowLeft, ShieldAlert, User, Landmark, MapPin, FileText,
  ChevronDown, ChevronUp, CheckCircle, AlertTriangle,
  ClipboardList, Send, Lock, Info, Eye
} from 'lucide-react'

// ── Sub-components ─────────────────────────────────────────────────────────

function DetailRow({ label, value, mono = false, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start gap-1 py-2.5 border-b border-gray-800 last:border-0 ${className}`}>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide sm:w-48 flex-shrink-0">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono text-blue-300' : 'text-gray-200'}`}>{value ?? '—'}</span>
    </div>
  )
}

function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-white">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  )
}

function AnomalyFlagCard({ flag }) {
  const [showEvidence, setShowEvidence] = useState(false)
  const sev = SEVERITY_COLORS[flag.severity] || SEVERITY_COLORS.Low
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="bg-gray-700 text-blue-300 px-2 py-0.5 rounded text-xs font-mono">
            {flag.anomaly_code}
          </code>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sev}`}>
            {flag.severity}
          </span>
          <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs">
            Score: +{flag.score}
          </span>
        </div>
        {flag.evidence_json && Object.keys(flag.evidence_json).length > 0 && (
          <button
            onClick={() => setShowEvidence(s => !s)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 flex-shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            {showEvidence ? 'Hide' : 'Evidence'}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-300 leading-relaxed">{flag.rationale}</p>
      {showEvidence && flag.evidence_json && (
        <pre className="mt-3 bg-gray-950 text-green-300 text-xs p-3 rounded-lg overflow-x-auto border border-gray-700">
          {JSON.stringify(flag.evidence_json, null, 2)}
        </pre>
      )}
    </div>
  )
}

// Officer decision form (ADM-05)
const DECISION_OPTIONS = [
  { value: 'APPROVE',           label: '✅ Approve',                    color: 'bg-green-700 hover:bg-green-600'  },
  { value: 'HOLD',              label: '⏸️ Hold Payment',               color: 'bg-yellow-700 hover:bg-yellow-600'},
  { value: 'REQUEST_DOCUMENTS', label: '📄 Request Documents',          color: 'bg-purple-700 hover:bg-purple-600'},
  { value: 'REJECT',            label: '❌ Reject',                     color: 'bg-red-700 hover:bg-red-600'     },
  { value: 'ESCALATE',          label: '📤 Escalate for Investigation', color: 'bg-gray-600 hover:bg-gray-500'   },
]

function DecisionPanel({ appId, onSuccess }) {
  const [decision, setDecision] = useState('')
  const [remarks, setRemarks]   = useState('')
  const [submitting, setSub]    = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(null)

  const handleSubmit = async () => {
    if (!decision) return setError('Please select a decision.')
    if (remarks.trim().length < 10) return setError('Remarks must be at least 10 characters.')
    setSub(true); setError('')
    try {
      const { data } = await adminAPI.decision(appId, { decision, remarks: remarks.trim() })
      setSuccess(data)
      onSuccess(data.new_status)
    } catch (e) {
      setError(e.response?.data?.detail || 'Decision failed. Please try again.')
    } finally { setSub(false) }
  }

  if (success) {
    return (
      <div className="bg-green-900/30 border border-green-700 rounded-xl p-5 text-center">
        <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-green-300 font-semibold">Decision Recorded</p>
        <p className="text-sm text-gray-400 mt-1">
          Application moved to <strong className="text-white">{success.new_status}</strong>.
          Decision by: {success.decided_by_officer} at {formatDateTime(success.decided_at)}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3 text-sm text-yellow-300">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>This decision is <strong>immutable</strong> and will be recorded in the audit log.</span>
      </div>

      {/* Decision selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DECISION_OPTIONS.map(({ value, label, color }) => (
          <button
            key={value}
            onClick={() => setDecision(value)}
            className={`px-4 py-3 rounded-lg text-sm font-medium text-white transition-colors border-2 ${
              decision === value
                ? `${color} border-white/30`
                : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Remarks */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">
          Officer Remarks (Mandatory) *
        </label>
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          rows={4}
          placeholder="Provide detailed justification for your decision… (min 10 characters)"
          className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600 resize-none"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-gov-blue hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
      >
        <Send className="w-4 h-4" />
        {submitting ? 'Submitting Decision…' : 'Submit Officer Decision'}
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminApplicationDetailPage() {
  const { id } = useParams()
  const [app, setApp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchApp = async () => {
    setLoading(true)
    try {
      const { data } = await applicationAPI.getDetail(id)
      setApp(data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load application.')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchApp() }, [id])

  const handleDecisionSuccess = (newStatus) => {
    setApp(prev => ({ ...prev, status: newStatus }))
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner /></div>
  if (error)   return (
    <div className="text-center py-10">
      <p className="text-red-400 mb-4">{error}</p>
      <Link to="/admin/applications" className="text-blue-400 hover:text-blue-300">← Back</Link>
    </div>
  )

  const tier = getRiskTier(app.risk_score)
  const st   = getStatusBadge(app.status)
  const alreadyDecided = !!app.officer_decision

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back */}
      <Link to="/admin/applications"
        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Applications
      </Link>

      {/* Header (ADM-04) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <p className="text-gray-500 text-xs mb-1">Application Reference</p>
            <h1 className="text-xl font-bold font-mono text-white">APP-{String(app.id).padStart(6,'0')}</h1>
            <p className="text-gray-300 mt-1 text-lg">{app.farmer_name}</p>
            <p className="text-gray-500 text-sm mt-0.5">Scheme: {app.scheme_code}</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            {/* Risk score badge */}
            {app.risk_score != null && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${tier.color}`}>
                <span className={`w-2 h-2 rounded-full ${tier.dot}`} />
                Risk Score: {app.risk_score}/100
              </div>
            )}
            {/* Status */}
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${st.color}`}>{st.label}</span>
            {/* Confidence */}
            {app.confidence_level && (
              <span className="text-xs text-gray-500">
                Confidence: <span className="text-gray-300 font-medium">{app.confidence_score}% — {app.confidence_level}</span>
              </span>
            )}
          </div>
        </div>

        {/* Recommended action */}
        {app.recommended_action && (
          <div className="mt-4 flex items-start gap-2 bg-gray-800 rounded-lg p-3 text-sm">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-gray-400">System Recommendation: </span>
              <span className="text-white font-medium">{app.recommended_action}</span>
            </div>
          </div>
        )}
      </div>

      {/* Rationale (ADM-04) */}
      {app.anomaly_report?.rationale && (
        <Section title="Fraud Analysis Rationale" icon={ShieldAlert} defaultOpen={true}>
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {app.anomaly_report.rationale}
          </p>
        </Section>
      )}

      {/* Anomaly Flags (ADM-04) */}
      {app.anomaly_flags?.length > 0 && (
        <Section title={`Anomaly Flags (${app.anomaly_flags.length})`} icon={AlertTriangle} defaultOpen={true}>
          {app.anomaly_flags
            .sort((a,b) => b.score - a.score)
            .map((flag, i) => <AnomalyFlagCard key={i} flag={flag} />)
          }
        </Section>
      )}

      {/* Applicant Profile (ADM-04) */}
      <Section title="Applicant Profile" icon={User} defaultOpen={false}>
        <DetailRow label="Full Name"     value={app.farmer_name} />
        <DetailRow label="Date of Birth" value={formatDate(app.date_of_birth)} />
        <DetailRow label="Gender"        value={app.gender} />
        <DetailRow label="Category"      value={app.category} />
        <DetailRow label="Mobile"        value={app.mobile_number} mono />
        <DetailRow label="Aadhaar (Masked)" value={app.aadhaar_masked} mono />
        <DetailRow label="Aadhaar Ref (Hash)" value={app.aadhaar_ref} mono />
        <DetailRow label="OTP Verified"  value={app.otp_verified ? '✅ Yes' : '❌ No'} />
        <DetailRow label="e-KYC Status"  value={app.e_kyc_status ? '✅ Verified' : '❌ Not Verified'} />
      </Section>

      {/* Bank Details */}
      <Section title="Bank Account" icon={Landmark} defaultOpen={false}>
        <DetailRow label="Account Number" value={app.bank_account_number} mono />
        <DetailRow label="IFSC Code"      value={app.ifsc_code} mono />
        <DetailRow label="Account+IFSC Key" value={app.bank_account_ifsc_key} mono />
      </Section>

      {/* Land Parcel */}
      <Section title="Land Parcel Details" icon={MapPin} defaultOpen={false}>
        <DetailRow label="Parcel ID"   value={app.parcel_id} mono />
        <DetailRow label="State"       value={app.state_code} />
        <DetailRow label="District"    value={app.district_code} />
        <DetailRow label="Tehsil"      value={app.tehsil_code} />
        <DetailRow label="Village"     value={app.village_code} />
        <DetailRow label="Khata No."   value={app.khata_number} mono />
        <DetailRow label="Plot No."    value={app.plot_number} mono />
        <DetailRow label="Land Area"   value={`${app.declared_land_area_ha} ha`} />
        <DetailRow label="Ownership"   value={app.ownership_type} />
        <DetailRow label="Crop Code"   value={app.declared_crop_code} />
        <DetailRow label="Self Decl."  value={app.self_declaration ? '✅ Yes' : '❌ No'} />
      </Section>

      {/* Document */}
      <Section title="Uploaded Document" icon={FileText} defaultOpen={false}>
        <DetailRow label="File Path" value={app.land_document_path} mono />
      </Section>

      {/* Decision Panel (ADM-05) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-white">Officer Decision</h3>
          {alreadyDecided && (
            <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
              <Lock className="w-3 h-3" /> Decision recorded {formatDateTime(app.officer_decided_at)}
            </span>
          )}
        </div>

        {alreadyDecided ? (
          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${getStatusBadge(app.status).color}`}>
                {app.officer_decision}
              </span>
              <span className="text-gray-400 text-sm">decided at {formatDateTime(app.officer_decided_at)}</span>
            </div>
            {app.officer_remarks && (
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1 uppercase">Officer Remarks</p>
                <p className="text-gray-200 text-sm leading-relaxed">{app.officer_remarks}</p>
              </div>
            )}
          </div>
        ) : (
          <DecisionPanel appId={id} onSuccess={handleDecisionSuccess} />
        )}
      </div>
    </div>
  )
}
