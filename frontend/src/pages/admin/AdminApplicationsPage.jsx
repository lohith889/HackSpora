import { useState, useEffect, useMemo } from 'react'
import { adminAPI } from '../../api/client'
import { getRiskTier, getStatusBadge, exportToCSV, formatDateTime, SEVERITY_COLORS } from '../../utils/adminUtils'
import { Link, useSearchParams } from 'react-router-dom'
import Spinner from '../../components/Spinner'
import {
  Search, Download, RefreshCw, Filter, Eye,
  ChevronUp, ChevronDown, X, ShieldAlert, CheckCircle2,
  AlertTriangle, PauseCircle, HelpCircle, XCircle, Send,
  FileText, ExternalLink, MapPin, Landmark, User, Layers
} from 'lucide-react'

const STATUS_OPTIONS = [
  'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED',
  'PAYMENT_HELD', 'DOCUMENTS_REQUESTED', 'ESCALATED'
]

const DECISION_OPTIONS = [
  { value: 'APPROVE',           label: '✅ Approve',                    color: 'bg-green-700 hover:bg-green-600'  },
  { value: 'HOLD',              label: '⏸️ Hold Payment',               color: 'bg-yellow-700 hover:bg-yellow-600'},
  { value: 'REQUEST_DOCUMENTS', label: '📄 Request Documents',          color: 'bg-purple-700 hover:bg-purple-600'},
  { value: 'REJECT',            label: '❌ Reject',                     color: 'bg-red-700 hover:bg-red-600'     },
  { value: 'ESCALATE',          label: '📤 Escalate for Investigation', color: 'bg-blue-700 hover:bg-blue-600'   },
]

// ── Quick Anomaly Dossier Slide-Over Modal (ADM-04) ──────────────────────────
function QuickDossierDrawer({ app, onClose, onDecisionSuccess }) {
  const [expandedFlagIndex, setExpandedFlagIndex] = useState(null)
  const [decision, setDecision] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  if (!app) return null

  const tier = getRiskTier(app.risk_score)
  const st = getStatusBadge(app.status)
  const flags = app.anomaly_flags || []

  const handleDecisionSubmit = async () => {
    if (!decision) {
      setError('Please select an adjudication action.')
      return
    }
    if (remarks.trim().length < 10) {
      setError('Officer remarks must be at least 10 characters justifying the adjudication.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const { data } = await adminAPI.decision(app.id, {
        decision,
        remarks: remarks.trim()
      })
      setSuccessMsg(`Decision recorded: Status moved to ${data.new_status}`)
      onDecisionSuccess(app.id, data.new_status, data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit decision.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl bg-gray-900 border-l border-gray-800 text-white flex flex-col h-full shadow-2xl relative">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-950 border border-red-800 rounded-lg text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-mono tracking-tight text-white">
                  APP-{String(app.id).padStart(6, '0')}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.color}`}>
                  {st.label}
                </span>
              </div>
              <p className="text-xs text-gray-400">Scheme Officer Quick Anomaly Dossier Inspector</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-3">
              <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">Risk Score</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xl font-bold font-mono px-2 py-0.5 rounded-md ${tier.color}`}>
                  {app.risk_score != null ? `${app.risk_score}/100` : '—'}
                </span>
                <span className="text-xs text-gray-400">{tier.label}</span>
              </div>
            </div>

            <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-3">
              <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">Confidence</span>
              <div className="mt-1">
                <span className="text-lg font-bold font-mono text-blue-300">
                  {app.confidence_score != null ? `${app.confidence_score}%` : '85%'}
                </span>
                <span className="text-xs text-gray-400 block">{app.confidence_level || 'High'} Certainty</span>
              </div>
            </div>

            <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-3 col-span-2 sm:col-span-1">
              <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">Recommendation</span>
              <span className="text-xs font-medium text-yellow-300 bg-yellow-950/60 border border-yellow-800/50 px-2 py-1 rounded-md mt-1 inline-block">
                {app.recommended_action || 'Review Flags'}
              </span>
            </div>
          </div>

          {/* Applicant Summary */}
          <div className="bg-gray-850 border border-gray-800 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                <User className="w-3.5 h-3.5" /> Farmer Name:
              </span>
              <span className="font-semibold text-white">{app.farmer_name}</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400 text-xs">Masked Aadhaar:</span>
              <span className="font-mono text-gray-300 text-xs">{app.aadhaar_masked || 'XXXX-XXXX-****'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5" /> Parcel ID:
              </span>
              <span className="font-mono text-blue-300 text-xs truncate max-w-[280px]">{app.parcel_id}</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                <Landmark className="w-3.5 h-3.5" /> Bank IFSC Key:
              </span>
              <span className="font-mono text-gray-300 text-xs">{app.bank_account_ifsc_key || `${app.bank_account_number}-${app.ifsc_code}`}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-gray-400 text-xs">Location:</span>
              <span className="text-gray-300 text-xs">
                District {app.district_code || '—'} • Village {app.village_code || '—'}
              </span>
            </div>
          </div>

          {/* Natural Language Rationale */}
          {app.anomaly_report?.rationale && (
            <div className="bg-blue-950/30 border border-blue-900/60 rounded-xl p-4">
              <span className="text-xs font-bold text-blue-300 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <FileText className="w-3.5 h-3.5" /> AI Explainability Rationale
              </span>
              <p className="text-sm text-gray-200 leading-relaxed">
                {app.anomaly_report.rationale}
              </p>
            </div>
          )}

          {/* Triggered Anomaly Flags */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-red-400" />
                Triggered Anomaly Flags ({flags.length})
              </h3>
              <span className="text-xs text-gray-500">8 Engines Audited</span>
            </div>

            {flags.length === 0 ? (
              <div className="bg-gray-850 border border-gray-800 rounded-xl p-4 text-center text-sm text-green-400">
                <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-400" />
                Zero anomaly flags triggered. Application aligns with master registry baselines.
              </div>
            ) : (
              <div className="space-y-3">
                {flags.map((flag, idx) => {
                  const isExpanded = expandedFlagIndex === idx
                  const sevClass = SEVERITY_COLORS[flag.severity] || SEVERITY_COLORS.Low
                  return (
                    <div
                      key={idx}
                      className="bg-gray-850 border border-gray-700/80 rounded-xl p-3.5 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-gray-800 border border-gray-700 font-mono text-xs px-2 py-0.5 rounded text-blue-300">
                            {flag.anomaly_code}
                          </span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase ${sevClass}`}>
                            {flag.severity}
                          </span>
                          <span className="bg-red-950/70 border border-red-800/60 text-red-300 text-[11px] px-2 py-0.5 rounded font-mono font-bold">
                            +{flag.score} pts
                          </span>
                        </div>

                        {flag.evidence_json && Object.keys(flag.evidence_json).length > 0 && (
                          <button
                            onClick={() => setExpandedFlagIndex(isExpanded ? null : idx)}
                            className="text-xs text-gray-400 hover:text-white flex items-center gap-1 flex-shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {isExpanded ? 'Hide Raw' : 'Inspect Raw'}
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                        {flag.rationale}
                      </p>

                      {isExpanded && flag.evidence_json && (
                        <div className="mt-3 bg-gray-950 p-3 rounded-lg border border-gray-800 overflow-x-auto">
                          <span className="text-[10px] text-gray-500 font-mono block mb-1">
                            Raw Engine Evidence Payload:
                          </span>
                          <pre className="text-[11px] font-mono text-green-300 leading-tight">
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

          {/* Quick Adjudication Decision Form (ADM-05) */}
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              Quick Officer Adjudication (Immutable Audit Trail)
            </h3>

            {successMsg ? (
              <div className="bg-green-950/80 border border-green-800 text-green-300 text-xs p-3 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DECISION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDecision(opt.value)}
                      className={`text-xs font-medium py-2 px-2.5 rounded-lg border transition-all text-left truncate ${
                        decision === opt.value
                          ? `${opt.color} text-white border-white/40 shadow-sm`
                          : 'bg-gray-850 border-gray-700 text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-1">
                    Adjudication Remarks (Mandatory, min 10 chars) *
                  </label>
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    rows={2}
                    placeholder="Enter official reasoning for this determination…"
                    className="w-full bg-gray-850 border border-gray-700 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600 resize-none"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-950/50 border border-red-800/60 p-2 rounded">
                    {error}
                  </p>
                )}

                <button
                  onClick={handleDecisionSubmit}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 bg-gov-blue hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'Recording Adjudication…' : 'Record Adjudication & Update Audit Trail'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Drawer Footer with Full Page Link */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-950 flex items-center justify-between">
          <span className="text-xs text-gray-500">KisanGuard Anomaly Engine v2.0</span>
          <Link
            to={`/admin/applications/${app.id}`}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium group"
          >
            <span>Open Full Application &amp; Cross-Registry Matrix</span>
            <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function AdminApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter state (ADM-02 & ADM-03)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatus]       = useState(searchParams.get('status') || '')
  const [districtFilter, setDist]       = useState('')
  const [villageFilter, setVillage]     = useState('')
  const [minRisk, setMinRisk]           = useState(searchParams.get('min_risk') || '')
  const [maxRisk, setMaxRisk]           = useState('')
  const [tierPreset, setTierPreset]     = useState('ALL')
  const [sortBy, setSortBy]             = useState('risk_score')
  const [sortDir, setSortDir]           = useState('desc')

  // Slide-over dossier modal state (ADM-04)
  const [selectedApp, setSelectedApp]   = useState(null)

  const fetchApps = async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter)   params.status   = statusFilter
      if (districtFilter) params.district = districtFilter
      if (villageFilter)  params.village  = villageFilter
      if (minRisk)        params.min_risk = minRisk
      if (maxRisk)        params.max_risk = maxRisk

      const { data } = await adminAPI.listApplications(params)
      setApps(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApps()
  }, [statusFilter, districtFilter, villageFilter, minRisk, maxRisk])

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const applyTierPreset = (preset) => {
    setTierPreset(preset)
    if (preset === 'ALL') {
      setMinRisk(''); setMaxRisk(''); setStatus('')
    } else if (preset === 'CRITICAL') {
      setMinRisk('75'); setMaxRisk('100'); setStatus('')
    } else if (preset === 'HIGH') {
      setMinRisk('50'); setMaxRisk('74'); setStatus('')
    } else if (preset === 'MODERATE') {
      setMinRisk('25'); setMaxRisk('49'); setStatus('')
    } else if (preset === 'LOW') {
      setMinRisk('0'); setMaxRisk('24'); setStatus('')
    } else if (preset === 'PENDING') {
      setMinRisk(''); setMaxRisk(''); setStatus('UNDER_REVIEW')
    }
  }

  // Client-side search + sort
  const filtered = useMemo(() => {
    let data = [...apps]
    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(a =>
        a.farmer_name?.toLowerCase().includes(q) ||
        String(a.id).includes(q) ||
        a.parcel_id?.toLowerCase().includes(q) ||
        a.district_code?.toLowerCase().includes(q) ||
        a.village_code?.toLowerCase().includes(q)
      )
    }
    data.sort((a, b) => {
      let av = a[sortBy] ?? -1
      let bv = b[sortBy] ?? -1
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return data
  }, [apps, search, sortBy, sortDir])

  const handleDecisionSuccess = (appId, newStatus, fullData) => {
    setApps(prev =>
      prev.map(a => (a.id === appId ? { ...a, status: newStatus, ...fullData } : a))
    )
    if (selectedApp?.id === appId) {
      setSelectedApp(prev => ({ ...prev, status: newStatus }))
    }
  }

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-400" />
      : <ChevronDown className="w-3 h-3 text-blue-400" />
  }

  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setDist('')
    setVillage('')
    setMinRisk('')
    setMaxRisk('')
    setTierPreset('ALL')
  }

  const hasFilters = search || statusFilter || districtFilter || villageFilter || minRisk || maxRisk

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Applications Review Console</h1>
            <span className="bg-red-950 text-red-300 border border-red-800 text-xs px-2.5 py-0.5 rounded-full font-mono">
              ADM-03 / ADM-04
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-0.5">
            {loading ? 'Querying registry records…' : `Displaying ${filtered.length} of ${apps.length} applications`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchApps}
            disabled={loading}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => exportToCSV(filtered)}
            className="flex items-center gap-1.5 bg-gov-blue hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors shadow-md"
          >
            <Download className="w-4 h-4" /> Export CSV (ADM-06)
          </button>
        </div>
      </div>

      {/* Quick Risk Tier Presets */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {[
          { id: 'ALL',      label: 'All Applications',   badge: apps.length },
          { id: 'CRITICAL', label: '🚨 Critical (>75)',   badge: apps.filter(a => (a.risk_score ?? 0) >= 75).length },
          { id: 'HIGH',     label: '⚠️ High (50-74)',     badge: apps.filter(a => (a.risk_score ?? 0) >= 50 && (a.risk_score ?? 0) < 75).length },
          { id: 'MODERATE', label: '🟡 Moderate (25-49)', badge: apps.filter(a => (a.risk_score ?? 0) >= 25 && (a.risk_score ?? 0) < 50).length },
          { id: 'LOW',      label: '✅ Low (≤24)',        badge: apps.filter(a => (a.risk_score ?? 0) < 25 && a.risk_score != null).length },
          { id: 'PENDING',  label: '⏳ Under Review',     badge: apps.filter(a => a.status === 'UNDER_REVIEW').length },
        ].map(preset => (
          <button
            key={preset.id}
            onClick={() => applyTierPreset(preset.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
              tierPreset === preset.id
                ? 'bg-red-900/60 border-red-600 text-white shadow-sm'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <span>{preset.label}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              tierPreset === preset.id ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400'
            }`}>
              {preset.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Filters (ADM-02 & ADM-03) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3 text-gray-400 text-sm">
          <Filter className="w-4 h-4" /> Comprehensive Multi-Registry Filters
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <X className="w-3 h-3" /> Clear all filters
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search farmer name, ID, parcel, district…"
              className="w-full pl-9 pr-3 py-2 bg-gray-850 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={e => { setStatus(e.target.value); setTierPreset('CUSTOM') }}
            className="bg-gray-850 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>

          {/* District */}
          <input
            value={districtFilter}
            onChange={e => setDist(e.target.value.toUpperCase())}
            placeholder="District (e.g. MRT)"
            className="bg-gray-850 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 uppercase"
          />

          {/* Village Code (ADM-03) */}
          <input
            value={villageFilter}
            onChange={e => setVillage(e.target.value.toUpperCase())}
            placeholder="Village (e.g. VIL001)"
            className="bg-gray-850 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 uppercase"
          />

          {/* Min Risk */}
          <div className="flex gap-2">
            <input
              type="number"
              value={minRisk}
              onChange={e => { setMinRisk(e.target.value); setTierPreset('CUSTOM') }}
              placeholder="Min risk"
              min={0}
              max={100}
              className="w-1/2 bg-gray-850 border border-gray-700 text-gray-300 text-sm rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
            <input
              type="number"
              value={maxRisk}
              onChange={e => { setMaxRisk(e.target.value); setTierPreset('CUSTOM') }}
              placeholder="Max risk"
              min={0}
              max={100}
              className="w-1/2 bg-gray-850 border border-gray-700 text-gray-300 text-sm rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Applications Table (ADM-03) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-gray-400 font-medium">No applications match your filter criteria.</p>
            <p className="text-gray-600 text-xs mt-1">Try clearing filters or resetting the risk presets.</p>
            <button
              onClick={clearFilters}
              className="mt-4 bg-gray-800 hover:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800 bg-gray-950/60">
                <tr className="text-gray-400 text-xs uppercase tracking-wider">
                  {[
                    { key: 'id',            label: 'Ref ID'       },
                    { key: 'farmer_name',   label: 'Farmer Name'  },
                    { key: 'district_code', label: 'Dist / Vil'   },
                    { key: 'risk_score',    label: 'Risk Score'   },
                    { key: 'flags',         label: 'Anomaly Flags'},
                    { key: 'status',        label: 'Status'       },
                    { key: 'submitted_at',  label: 'Submitted'    },
                    { key: null,            label: 'Adjudication' },
                  ].map(({ key, label }) => (
                    <th
                      key={label}
                      className={`text-left px-4 py-3.5 ${key ? 'cursor-pointer hover:text-white select-none' : ''}`}
                      onClick={() => key && handleSort(key)}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {key && <SortIcon col={key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filtered.map(a => {
                  const tier = getRiskTier(a.risk_score)
                  const st = getStatusBadge(a.status)
                  const flagCount = (a.anomaly_flags || []).length
                  const hasCritical = (a.anomaly_flags || []).some(f => f.severity === 'High')

                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-gray-850/60 transition-colors group cursor-pointer"
                      onClick={() => setSelectedApp(a)}
                    >
                      {/* App ID */}
                      <td className="px-4 py-3 font-mono text-gray-300 text-xs font-bold">
                        APP-{String(a.id).padStart(6, '0')}
                      </td>

                      {/* Farmer Name + Parcel ID */}
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{a.farmer_name}</div>
                        <div className="text-[11px] text-gray-500 font-mono truncate max-w-[200px]">
                          {a.parcel_id}
                        </div>
                      </td>

                      {/* District / Village */}
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                        <span className="text-white font-semibold">{a.district_code || '—'}</span>
                        {a.village_code && <span className="text-gray-500"> / {a.village_code}</span>}
                      </td>

                      {/* Risk Score */}
                      <td className="px-4 py-3">
                        {a.risk_score != null ? (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold ${tier.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                              {a.risk_score}/100
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Triggered Anomaly Flags */}
                      <td className="px-4 py-3">
                        {flagCount > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              hasCritical
                                ? 'bg-red-950 text-red-300 border border-red-800/80 font-bold'
                                : 'bg-yellow-950 text-yellow-300 border border-yellow-800/60'
                            }`}>
                              {flagCount} {flagCount === 1 ? 'flag' : 'flags'}
                            </span>
                            {hasCritical && (
                              <span className="text-[10px] text-red-400 font-semibold uppercase">Critical</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-green-400 text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Clean
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </td>

                      {/* Submitted At */}
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {formatDateTime(a.submitted_at)}
                      </td>

                      {/* Action buttons */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedApp(a)}
                            className="flex items-center gap-1 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/70 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                            title="Open Anomaly Dossier Slide-Over"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" /> Dossier
                          </button>
                          <Link
                            to={`/admin/applications/${a.id}`}
                            className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                            title="Full Registry Review"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Anomaly Dossier Modal (ADM-04) */}
      {selectedApp && (
        <QuickDossierDrawer
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onDecisionSuccess={handleDecisionSuccess}
        />
      )}
    </div>
  )
}
