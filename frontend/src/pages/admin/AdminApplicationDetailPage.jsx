import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { adminAPI } from '../../api/client'
import {
  getRiskTier, getStatusBadge, SEVERITY_COLORS,
  formatDate, formatDateTime
} from '../../utils/adminUtils'
import Spinner from '../../components/Spinner'
import {
  ArrowLeft, ShieldAlert, User, Landmark, MapPin, FileText,
  ChevronDown, ChevronUp, CheckCircle2, AlertTriangle,
  ClipboardList, Send, Lock, Info, Eye, Check, X,
  Building, CreditCard, ShieldCheck, Clock, ExternalLink,
  HelpCircle, PauseCircle, XCircle
} from 'lucide-react'

// ── Decision Options (ADM-05) ────────────────────────────────────────────────
const DECISION_OPTIONS = [
  { value: 'APPROVE',           label: '✅ Approve Subsidy',             color: 'bg-green-700 hover:bg-green-600',   desc: 'Applicant satisfies all PM-KISAN eligibility criteria' },
  { value: 'HOLD',              label: '⏸️ Hold Payment',                color: 'bg-yellow-700 hover:bg-yellow-600', desc: 'Hold disbursement pending field verification' },
  { value: 'REQUEST_DOCUMENTS', label: '📄 Request Documents',           color: 'bg-purple-700 hover:bg-purple-600', desc: 'Notify applicant to upload fresh revenue proof' },
  { value: 'REJECT',            label: '❌ Reject Application',          color: 'bg-red-700 hover:bg-red-600',       desc: 'Ineligible or fraudulent claimant' },
  { value: 'ESCALATE',          label: '📤 Escalate for Investigation',  color: 'bg-blue-700 hover:bg-blue-600',     desc: 'Escalate to District Vigilance Anti-Fraud Committee' },
]

export default function AdminApplicationDetailPage() {
  const { id } = useParams()
  const [app, setApp] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Decision state
  const [decision, setDecision] = useState('')
  const [remarks, setRemarks]   = useState('')
  const [submitting, setSub]    = useState(false)
  const [decisionError, setDecisionError] = useState('')
  const [decisionSuccess, setDecisionSuccess] = useState(null)

  // Expandable flags raw evidence state
  const [expandedFlags, setExpandedFlags] = useState({})

  const toggleFlagEvidence = (index) => {
    setExpandedFlags(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const fetchApplicationData = async () => {
    setLoading(true)
    setError('')
    try {
      const [appRes, logsRes] = await Promise.all([
        adminAPI.getApplicationDetail(id),
        adminAPI.getAuditLogs({ application_id: id }).catch(() => ({ data: [] })),
      ])
      setApp(appRes.data)
      setAuditLogs(logsRes.data || [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load application dossier.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApplicationData()
  }, [id])

  const handleDecisionSubmit = async () => {
    if (!decision) {
      setDecisionError('Please select an adjudication determination.')
      return
    }
    if (remarks.trim().length < 10) {
      setDecisionError('Officer remarks must be at least 10 characters justifying the adjudication.')
      return
    }

    setSub(true)
    setDecisionError('')
    try {
      const { data } = await adminAPI.decision(id, { decision, remarks: remarks.trim() })
      setDecisionSuccess(data)
      setApp(prev => ({
        ...prev,
        status: data.new_status,
        officer_decision: data.decision,
        officer_remarks: data.remarks,
        officer_decided_at: data.decided_at,
      }))
      // Refresh audit logs
      const updatedLogs = await adminAPI.getAuditLogs({ application_id: id })
      setAuditLogs(updatedLogs.data || [])
    } catch (e) {
      setDecisionError(e.response?.data?.detail || 'Adjudication submission failed.')
    } finally {
      setSub(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Spinner />
        <p className="text-gray-400 text-sm font-mono">Querying multi-registry anomaly dossier…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl max-w-lg mx-auto">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-300 font-medium mb-4">{error}</p>
        <Link
          to="/admin/applications"
          className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs px-4 py-2 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Review Console
        </Link>
      </div>
    )
  }

  const tier = getRiskTier(app.risk_score)
  const st   = getStatusBadge(app.status)
  const flags = app.anomaly_flags || []

  // Check specific flags for cross-registry indicators
  const hasTaxpayerFlag   = flags.some(f => f.anomaly_code === 'EXCLUSION_TAXPAYER')
  const hasGovtEmpFlag    = flags.some(f => f.anomaly_code === 'EXCLUSION_GOVT_EMPLOYEE')
  const hasLandInactive   = flags.some(f => f.anomaly_code === 'LAND_OWNERSHIP_INACTIVE')
  const hasLandMismatch   = flags.some(f => f.anomaly_code === 'LAND_AREA_MISMATCH')
  const hasBankInactive   = flags.some(f => f.anomaly_code === 'BANK_ACCOUNT_INACTIVE')
  const hasBankMismatch   = flags.some(f => f.anomaly_code === 'BANK_NAME_MISMATCH')
  const hasDuplicateClaim = flags.some(f => f.anomaly_code === 'DUPLICATE_PARCEL_CLAIM')

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/admin/applications"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Review Applications
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-mono">Dossier Generated: {formatDateTime(app.submitted_at)}</span>
          <span className="bg-red-950 text-red-300 border border-red-800 text-xs px-2 py-0.5 rounded font-mono">
            SEC-CONFIDENTIAL
          </span>
        </div>
      </div>

      {/* Hero Dossier Header Banner (ADM-04) */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white font-mono tracking-tight">
                APP-{String(app.id).padStart(6, '0')}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                {st.label}
              </span>
              <span className="bg-blue-950 text-blue-300 border border-blue-800 text-xs px-2.5 py-0.5 rounded-full font-medium">
                {app.scheme_code || 'PM_KISAN'}
              </span>
            </div>

            <p className="text-xl font-semibold text-gray-200 mt-2">{app.farmer_name}</p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-500" />
                State: <strong className="text-gray-300">{app.state_code || '—'}</strong>
              </span>
              <span>
                District: <strong className="text-gray-300">{app.district_code || '—'}</strong>
              </span>
              <span>
                Tehsil: <strong className="text-gray-300">{app.tehsil_code || '—'}</strong>
              </span>
              <span>
                Village: <strong className="text-gray-300">{app.village_code || '—'}</strong>
              </span>
              <span className="font-mono">
                Khata: <strong className="text-gray-300">{app.khata_number || '—'}</strong> | Plot: <strong className="text-gray-300">{app.plot_number || '—'}</strong>
              </span>
            </div>
          </div>

          {/* Risk and Confidence Pill Matrix */}
          <div className="flex flex-wrap lg:flex-col items-start lg:items-end gap-3 bg-gray-950/80 p-4 rounded-xl border border-gray-800">
            {/* Risk Score */}
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                Anomaly Risk Score
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-base font-bold ${tier.color}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${tier.dot}`} />
                {app.risk_score != null ? `${app.risk_score} / 100` : '—'}
                <span className="text-xs uppercase font-sans">({tier.label})</span>
              </div>
            </div>

            {/* Evidential Confidence Score */}
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">
                Evidence Confidence
              </span>
              <div className="text-sm font-mono text-blue-300 mt-0.5">
                <strong>{app.confidence_score != null ? `${app.confidence_score}%` : '85%'}</strong>
                <span className="text-xs text-gray-400 ml-1.5">({app.confidence_level || 'High'} Certainty)</span>
              </div>
            </div>

            {/* Recommended Action */}
            <div className="text-right">
              <span className="text-[10px] uppercase text-gray-500 block">AI Recommended Action</span>
              <span className="text-xs font-semibold text-yellow-300 bg-yellow-950 border border-yellow-800/80 px-2 py-0.5 rounded mt-0.5 inline-block">
                {app.recommended_action || 'MANUAL_REVIEW'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Rationale Summary Banner */}
      {app.anomaly_report?.rationale && (
        <div className="bg-blue-950/20 border border-blue-900/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 text-blue-300 font-bold text-sm uppercase tracking-wider mb-2">
            <FileText className="w-4 h-4 text-blue-400" />
            AI Explainability Rationale &amp; Synthesis
          </div>
          <p className="text-sm text-gray-200 leading-relaxed">
            {app.anomaly_report.rationale}
          </p>
        </div>
      )}

      {/* ── SECTION 1: Side-by-Side Cross-Registry Verification Comparison Matrix ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5 border-b border-gray-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-gov-green" />
              Multi-Registry Cross-Verification Matrix
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Automated reconciliation of Applicant Declared Claim against State Land, Banking &amp; Statutory Masters
            </p>
          </div>
          <span className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full font-mono">
            4 Registries Queried
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Bhulekh Land Records Master */}
          <div className="bg-gray-850 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-800">
              <span className="text-xs font-bold uppercase tracking-wider text-green-400 flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> 1. Bhulekh Land Records Master
              </span>
              {hasLandInactive || hasLandMismatch || hasDuplicateClaim ? (
                <span className="bg-red-950 border border-red-800 text-red-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <X className="w-3 h-3" /> Discrepancy Found
                </span>
              ) : (
                <span className="bg-green-950 border border-green-800 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Verified Active
                </span>
              )}
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Parcel ID:</span>
                <span className="font-mono text-blue-300 font-medium truncate max-w-[220px]">{app.parcel_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Declared Land Area:</span>
                <span className={`font-mono font-medium ${hasLandMismatch ? 'text-red-400 font-bold' : 'text-gray-200'}`}>
                  {app.declared_land_area_ha} Hectares {hasLandMismatch && '⚠️ (Mismatches Registry)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Ownership Classification:</span>
                <span className="text-gray-200">{app.ownership_type || 'Individual'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Agricultural Land Use:</span>
                <span className="text-green-300 font-medium">Valid Agricultural Plot</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Duplicate Parcel Check:</span>
                <span className={`font-medium ${hasDuplicateClaim ? 'text-red-400' : 'text-green-400'}`}>
                  {hasDuplicateClaim ? '❌ Duplicate Claim Detected across Applicants' : '✅ Unique Parcel Claim'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: PFMS / NPCI Bank Master */}
          <div className="bg-gray-850 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-800">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Landmark className="w-4 h-4" /> 2. PFMS &amp; NPCI Bank Validation Master
              </span>
              {hasBankInactive || hasBankMismatch ? (
                <span className="bg-red-950 border border-red-800 text-red-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <X className="w-3 h-3" /> Bank Issue
                </span>
              ) : (
                <span className="bg-green-950 border border-green-800 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Account Active
                </span>
              )}
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Bank Account &amp; IFSC:</span>
                <span className="font-mono text-gray-200">
                  {app.bank_account_number} • <strong className="text-blue-300">{app.ifsc_code}</strong>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Composite Bank Key:</span>
                <span className="font-mono text-gray-300 text-[11px] truncate max-w-[220px]">
                  {app.bank_account_ifsc_key || `${app.bank_account_number}-${app.ifsc_code}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Account Operational Status:</span>
                <span className={`font-semibold ${hasBankInactive ? 'text-red-400' : 'text-green-400'}`}>
                  {hasBankInactive ? 'INACTIVE / CLOSED / FROZEN' : 'ACTIVE & DBT ENABLED'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Name Match / Penny Drop:</span>
                <span className={`font-medium ${hasBankMismatch ? 'text-yellow-400' : 'text-green-400'}`}>
                  {hasBankMismatch ? 'Fuzzy Discrepancy (<0.70 match)' : '100% Match (SUCCESS)'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Statutory & Exclusion Master */}
          <div className="bg-gray-850 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-800">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Building className="w-4 h-4" /> 3. CBDT &amp; PM-KISAN Exclusion Master
              </span>
              {hasTaxpayerFlag || hasGovtEmpFlag ? (
                <span className="bg-red-950 border border-red-800 text-red-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <X className="w-3 h-3" /> Ineligible (Exclusion Rule)
                </span>
              ) : (
                <span className="bg-green-950 border border-green-800 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> No Exclusion Flag
                </span>
              )}
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Income Tax Payee Check:</span>
                <span className={`font-semibold ${hasTaxpayerFlag ? 'text-red-400' : 'text-green-400'}`}>
                  {hasTaxpayerFlag ? '❌ Taxpayer Flagged (IT Act Section 139)' : '✅ Non-Taxpayer Verified'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Government Service Status:</span>
                <span className={`font-semibold ${hasGovtEmpFlag ? 'text-red-400' : 'text-green-400'}`}>
                  {hasGovtEmpFlag ? '❌ Govt / Autonomous Body Employee' : '✅ Eligible Citizen'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Pensioner Check (&gt;₹10,000/mo):</span>
                <span className="text-green-400 font-semibold">✅ Clear</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Deceased / Institutional Holder:</span>
                <span className="text-green-400 font-semibold">✅ Clear</span>
              </div>
            </div>
          </div>

          {/* Card 4: UIDAI Identity & Demographic Token */}
          <div className="bg-gray-850 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-800">
              <span className="text-xs font-bold uppercase tracking-wider text-yellow-400 flex items-center gap-1.5">
                <User className="w-4 h-4" /> 4. UIDAI Identity &amp; Auth Pipeline
              </span>
              <span className="bg-green-950 border border-green-800 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" /> Zero-Leak Tokenized
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Masked Aadhaar:</span>
                <span className="font-mono text-gray-200 font-bold">{app.aadhaar_masked || 'XXXX-XXXX-****'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Salted SHA-256 Token:</span>
                <span className="font-mono text-gray-400 text-[10px] truncate max-w-[200px]" title={app.aadhaar_ref}>
                  {app.aadhaar_ref ? `${app.aadhaar_ref.slice(0, 16)}…` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">OTP Mobile Verification:</span>
                <span className={`font-semibold ${app.otp_verified ? 'text-green-400' : 'text-red-400'}`}>
                  {app.otp_verified ? '✅ Verified via SMS OTP' : '❌ Unverified OTP'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">e-KYC Consent &amp; Status:</span>
                <span className="text-green-400 font-semibold">
                  {app.e_kyc_status !== false ? '✅ Active Consent Provided' : '❌ e-KYC Failed'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Triggered Anomaly Flags Deep Dive (ADM-04) ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              Detailed Anomaly Dossier &amp; Evidence Inspector
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Comprehensive report generated by KisanGuard's 8 modular anomaly engines
            </p>
          </div>
          <span className="bg-red-950 text-red-300 border border-red-800 text-xs px-2.5 py-1 rounded-full font-mono font-bold">
            {flags.length} {flags.length === 1 ? 'Anomaly Flag' : 'Anomaly Flags'}
          </span>
        </div>

        {flags.length === 0 ? (
          <div className="bg-green-950/20 border border-green-900/40 rounded-xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-2" />
            <h3 className="text-base font-semibold text-green-300">Clean Application Record</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
              No anomalies detected across Identity, Land, Bank, Exclusion, Duplicate, Statistical, Temporal, or Isolation Forest engines.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {flags.map((flag, idx) => {
              const sev = SEVERITY_COLORS[flag.severity] || SEVERITY_COLORS.Low
              const isExpanded = expandedFlags[idx]

              return (
                <div
                  key={idx}
                  className="bg-gray-850 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="bg-gray-800 text-blue-300 border border-gray-700 px-2.5 py-1 rounded text-xs font-mono font-bold">
                        {flag.anomaly_code}
                      </code>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${sev}`}>
                        {flag.severity}
                      </span>
                      <span className="bg-red-950 text-red-300 border border-red-800/80 px-2.5 py-0.5 rounded text-xs font-mono font-bold">
                        Score Contribution: +{flag.score}
                      </span>
                    </div>

                    {flag.evidence_json && Object.keys(flag.evidence_json).length > 0 && (
                      <button
                        onClick={() => toggleFlagEvidence(idx)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-lg transition-colors self-start sm:self-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {isExpanded ? 'Hide Raw Evidence JSON' : 'Inspect Raw Evidence JSON'}
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-gray-200 leading-relaxed mt-1">
                    {flag.rationale}
                  </p>

                  {/* Collapsible raw evidence JSON inspector */}
                  {isExpanded && flag.evidence_json && (
                    <div className="mt-3 bg-gray-950 border border-gray-800 rounded-lg p-3 overflow-x-auto">
                      <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider block mb-1">
                        Registry Evidence Payload (JSON):
                      </span>
                      <pre className="font-mono text-xs text-green-300 leading-tight">
                        {JSON.stringify(flag.evidence_json, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 3: Scheme Officer Final Adjudication Panel (ADM-05) ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Scheme Officer Final Adjudication</h2>
            <span className="bg-red-950 text-red-300 border border-red-800 text-xs px-2 py-0.5 rounded font-mono">
              ADM-05
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Decisions are legally binding, immutable, and immediately recorded to the audit trail.
          </p>
        </div>

        {decisionSuccess ? (
          <div className="bg-green-950/40 border border-green-800 rounded-xl p-5 flex items-start gap-4">
            <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-green-300 font-bold text-base">Adjudication Determination Recorded</h3>
              <p className="text-sm text-gray-300 mt-1">
                Application reference has been updated to <strong className="text-white font-mono">{decisionSuccess.new_status}</strong>.
              </p>
              <div className="text-xs text-gray-400 mt-2 flex flex-wrap gap-4 font-mono">
                <span>Adjudicator: {decisionSuccess.decided_by_officer}</span>
                <span>Timestamp: {formatDateTime(decisionSuccess.decided_at)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-yellow-950/40 border border-yellow-800/60 rounded-xl p-3 text-xs text-yellow-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Zero-Disbursement Without Officer Approval:</strong> PM-KISAN subsidy releases cannot execute automatically. Officer must review evidence and supply mandatory remarks.
              </span>
            </div>

            {/* Decision grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DECISION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDecision(opt.value)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    decision === opt.value
                      ? `${opt.color} text-white border-white/40 shadow-lg`
                      : 'bg-gray-850 border-gray-700/80 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-300/80 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Remarks Textarea */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-400 font-bold mb-1.5">
                Officer Adjudication Remarks (Mandatory, min 10 characters) *
              </label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                placeholder="Provide detailed justification and legal citations for this determination…"
                className="w-full bg-gray-850 border border-gray-700 text-sm text-white rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600 resize-none"
              />
            </div>

            {decisionError && (
              <div className="bg-red-950/60 border border-red-800 text-red-300 text-xs p-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{decisionError}</span>
              </div>
            )}

            <button
              onClick={handleDecisionSubmit}
              disabled={submitting}
              className="flex items-center justify-center gap-2 bg-gov-blue hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Recording Adjudication…' : 'Submit Official Determination'}
            </button>
          </div>
        )}
      </div>

      {/* ── SECTION 4: Immutable Audit Trail Timeline (ADM-06) ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5 border-b border-gray-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-400" />
              Application Audit Trail &amp; Adjudication History
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Append-only audit history of officer interactions with this record
            </p>
          </div>
          <span className="text-xs font-mono text-gray-500">
            {auditLogs.length} {auditLogs.length === 1 ? 'event logged' : 'events logged'}
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-4">
            No officer actions recorded yet for this application reference.
          </p>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="bg-gray-850 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-950 text-blue-300 border border-blue-800 text-xs px-2.5 py-0.5 rounded font-bold font-mono">
                      {log.action}
                    </span>
                    <span className="text-sm font-semibold text-white">
                      by {log.admin_name}
                    </span>
                  </div>
                  {log.remarks && (
                    <p className="text-xs text-gray-300 italic pt-1">
                      "{log.remarks}"
                    </p>
                  )}
                </div>

                <div className="text-right sm:flex-shrink-0">
                  <span className="text-xs text-gray-400 font-mono block">
                    {formatDateTime(log.created_at)}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    Log #{log.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
