import { useState, useEffect, useMemo } from 'react'
import { adminAPI } from '../../api/client'
import { getRiskTier, getStatusBadge, exportToCSV, formatDateTime, SEVERITY_COLORS } from '../../utils/adminUtils'
import { Link, useSearchParams } from 'react-router-dom'
import Spinner from '../../components/Spinner'

const STATUS_OPTIONS = [
  'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED',
  'PAYMENT_HELD', 'DOCUMENTS_REQUESTED', 'ESCALATED'
]

const DECISION_OPTIONS = [
  { value: 'APPROVE',           label: 'APPROVE ENTITLEMENT',          code: '[APPROVE]',  desc: 'Verify records & authorize subsidy' },
  { value: 'HOLD',              label: 'HOLD PAYMENT',                 code: '[HOLD]',     desc: 'Place payment on hold pending inquiry' },
  { value: 'REQUEST_DOCUMENTS', label: 'REQUEST REVENUE DOCUMENTS',    code: '[DOCS REQ]', desc: 'Notify applicant to supply fresh proof' },
  { value: 'REJECT',            label: 'REJECT CLAIM',                 code: '[REJECT]',   desc: 'Disqualify based on exclusion hit' },
  { value: 'ESCALATE',          label: 'ESCALATE TO MAGISTRATE',       code: '[ESCALATE]', desc: 'Refer to district revenue investigation' },
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
      setError('Officer remarks must be at least 10 characters justifying the statutory determination.')
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
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/50 backdrop-blur-[1px]">
      <div className="w-full max-w-2xl bg-white border-l border-slate-300 text-slate-900 flex flex-col h-full relative font-sans text-left shadow-2xl">
        {/* Tri-color top stripe */}
        <div className="h-1 flex w-full">
          <div className="bg-[#f97316] w-1/3" />
          <div className="bg-white w-1/3 border-b border-slate-200" />
          <div className="bg-[#16a34a] w-1/3" />
        </div>

        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">FORM AD-4 // CASE DOSSIER</span>
              <span className={`stamp text-[10px] ${st.color}`}>
                {st.label}
              </span>
            </div>
            <h2 className="text-xl font-bold font-mono tracking-tight text-slate-900 mt-0.5">
              APP-{String(app.id).padStart(6, '0')}
            </h2>
            <p className="font-sans text-xs text-slate-600">
              Cultivator: <strong className="text-slate-900">{app.farmer_name}</strong> • Parcel: <span className="font-mono">{app.parcel_id || '—'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-700 transition-colors"
          >
            [CLOSE ×]
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Statutory Disqualification Banner */}
          {app.is_statutory_override && (
            <div className="border-2 border-red-600 bg-red-50 p-3 font-mono text-xs text-red-900 space-y-1">
              <span className="stamp border border-red-700 bg-red-700 text-white text-[10px] font-bold px-1.5 py-0.2">
                [STATUTORY EXCLUSION OVERRIDE]
              </span>
              <p className="font-sans text-[11px] text-red-800">
                Application locked to 100 Risk under PM-KISAN Rule 4 due to legal disqualification.
              </p>
            </div>
          )}

          {/* ML Suspicion Surge Alert */}
          {(app.divergence_score || 0) >= 35 && !app.is_statutory_override && (
            <div className="border border-purple-400 bg-purple-50 p-3 font-mono text-xs text-purple-900 flex items-center justify-between">
              <span className="font-bold">⚡ ML SUSPICION SURGE DETECTED</span>
              <span className="stamp border border-purple-500 bg-purple-200 text-purple-950 font-bold text-[10px]">
                +{app.divergence_score} PTS OVER HEURISTICS
              </span>
            </div>
          )}

          {/* Metrics Rule */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="border border-slate-200 p-3 bg-slate-50">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">HEURISTIC RISK</span>
              <span className={`text-xl font-bold block mt-0.5 ${app.risk_score >= 50 ? 'text-red-700' : 'text-slate-900'}`}>
                {app.risk_score ?? 0} / 100
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">{tier.label}</span>
            </div>
            <div className="border border-slate-200 p-3 bg-slate-50">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">XGBOOST ML RISK</span>
              <span className={`text-xl font-bold block mt-0.5 ${(app.ml_risk_score ?? app.risk_score) >= 50 ? 'text-purple-700' : 'text-slate-900'}`}>
                {app.ml_risk_score ?? app.risk_score ?? 0} / 100
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                {(app.divergence_score || 0) >= 35 ? `Surge (+${app.divergence_score})` : 'Calibrated'}
              </span>
            </div>
            <div className="border border-slate-200 p-3 bg-slate-50">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">CONFIDENCE INDEX</span>
              <span className="text-xl font-bold text-slate-900 block mt-0.5">
                {app.confidence_score ?? 85}%
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">{app.confidence_level || 'Medium'}</span>
            </div>
            <div className="border border-slate-200 p-3 bg-slate-50">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">ANOMALY TRIGGERS</span>
              <span className={`text-xl font-bold block mt-0.5 ${flags.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {flags.length}
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">{flags.length === 0 ? 'CLEARED' : 'TRIGGERS'}</span>
            </div>
          </div>

          {/* AI Recommended Action */}
          {app.recommended_action && (
            <div className="border border-slate-200 p-3 bg-slate-50 font-mono text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-500 uppercase text-[10px] block font-semibold">RECOMMENDED ADJUDICATION:</span>
                <span className="text-slate-900 font-bold block mt-0.5">{app.recommended_action}</span>
              </div>
              <span className="text-[10px] text-slate-500 uppercase border border-slate-200 px-2 py-0.5 bg-white font-mono">AUTOMATED ENGINE</span>
            </div>
          )}

          {/* Anomaly Flags Accordion */}
          <div>
            <div className="flex justify-between items-baseline border-b border-slate-200 pb-2 mb-3">
              <h3 className="font-serif text-sm font-bold text-slate-900 uppercase tracking-wide">
                Detected Cross-Registry Signals ({flags.length})
              </h3>
              <span className="font-mono text-[10px] text-slate-500 uppercase">Verification Rules 1-8</span>
            </div>

            {flags.length === 0 ? (
              <div className="p-4 border border-paper-line bg-paper-subtle font-mono text-xs text-ink-muted text-center">
                ✓ No anomaly triggers detected. Application appears compliant.
              </div>
            ) : (
              <div className="space-y-2">
                {flags.map((flag, idx) => {
                  const isExpanded = expandedFlagIndex === idx
                  const sevColor = SEVERITY_COLORS[flag.severity] || 'border-slate-200 text-slate-700 bg-slate-50'
                  return (
                    <div
                      key={flag.anomaly_code || idx}
                      className="border border-slate-200 bg-white transition-colors"
                    >
                      <button
                        onClick={() => setExpandedFlagIndex(isExpanded ? null : idx)}
                        className="w-full text-left p-3 flex items-center justify-between gap-2 hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className={`stamp text-[10px] ${sevColor}`}>
                            {flag.severity || 'FLAG'}
                          </span>
                          <span className="font-bold text-slate-900">{flag.anomaly_code}</span>
                        </div>
                        <span className="font-mono text-xs text-slate-500">
                          {isExpanded ? '[-] HIDE' : '[+] INSPECT'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-slate-200 font-mono text-xs space-y-2 bg-slate-50">
                          <p className="text-slate-800 font-sans text-xs">{flag.description}</p>
                          {flag.rationale && (
                            <div className="p-2 border border-slate-200 bg-white text-slate-700 text-[11px] leading-relaxed">
                              <strong className="text-slate-900 font-semibold">Statutory Rationale: </strong>
                              {flag.rationale}
                            </div>
                          )}
                          <div className="flex gap-4 text-[10px] text-slate-500 pt-1">
                            <span>CERTAINTY: {flag.confidence || 'HIGH'}</span>
                            <span>WEIGHT: {flag.weight ?? 1.0}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Adjudication Form (ADM-04 Requirement) */}
          <div className="border border-slate-200 p-5 bg-slate-50 space-y-4">
            <div className="border-b border-slate-200 pb-2">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold block">SECTION 4(2) ADJUDICATION ORDER</span>
              <h3 className="font-serif text-sm font-bold text-slate-900 mt-0.5">
                Competent Authority Determination
              </h3>
              <p className="font-sans text-xs text-slate-600 mt-0.5">
                Enter formal administrative determination and required legal justification into the permanent audit ledger.
              </p>
            </div>

            {error && (
              <div className="p-3 border border-red-300 bg-red-50 font-mono text-xs text-red-800">
                [ERROR] {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 border border-emerald-300 bg-emerald-50 font-mono text-xs text-emerald-800 font-bold">
                ✓ {successMsg}
              </div>
            )}

            {/* Decision Radio Grid */}
            <div className="space-y-2 font-mono text-xs">
              <label className="block text-slate-700 uppercase text-[10px] font-semibold">Select Adjudication Action:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DECISION_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`p-2.5 border cursor-pointer flex flex-col justify-between transition-colors ${
                      decision === opt.value
                        ? 'border-slate-900 bg-slate-900 text-white font-bold'
                        : 'border-slate-200 bg-white hover:border-slate-400 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]">{opt.label}</span>
                      <span className={`text-[10px] ${decision === opt.value ? 'text-slate-300' : 'text-slate-500'}`}>{opt.code}</span>
                    </div>
                    <span className={`text-[10px] font-sans mt-1 ${decision === opt.value ? 'text-slate-300' : 'text-slate-600'}`}>
                      {opt.desc}
                    </span>
                    <input
                      type="radio"
                      name="decision"
                      value={opt.value}
                      checked={decision === opt.value}
                      onChange={(e) => setDecision(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Remarks / Justification Input */}
            <div className="font-mono text-xs space-y-1">
              <label className="block text-slate-700 uppercase text-[10px] font-semibold">
                Mandatory Written Justification (min 10 characters):
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Cite statutory provisions, Bhulekh findings, and verification reasoning..."
                className="w-full bg-white border border-slate-300 text-slate-900 p-2.5 text-xs font-sans focus:outline-none focus:border-slate-800 rounded-none resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Submit Button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleDecisionSubmit}
                disabled={submitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs uppercase tracking-wider py-2.5 px-4 font-bold transition-colors disabled:opacity-50"
              >
                {submitting ? 'COMMITTING TO AUDIT LEDGER...' : 'AUTHORIZE STATUTORY ORDER ➔'}
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center font-mono text-xs">
          <Link
            to={`/admin/applications/${app.id}`}
            className="text-emerald-800 hover:text-emerald-950 font-bold hover:underline"
          >
            Open Comprehensive Evidence Dossier →
          </Link>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Applications Page Component ──────────────────────────────────────────

export default function AdminApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedApp, setSelectedApp] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatus] = useState(searchParams.get('status') || '')
  const [districtFilter, setDist] = useState(searchParams.get('district') || '')
  const [villageFilter, setVillage] = useState(searchParams.get('village') || '')
  const [minRisk, setMinRisk] = useState(searchParams.get('min_risk') || '')
  const [maxRisk, setMaxRisk] = useState(searchParams.get('max_risk') || '')
  const [tierPreset, setTierPreset] = useState('ALL')
  const [mlDivergenceOnly, setMlDivergenceOnly] = useState(false)

  // Sorting
  const [sortBy, setSortBy] = useState('risk_score')
  const [sortDir, setSortDir] = useState('desc')

  const fetchApps = async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (districtFilter) params.district = districtFilter
      if (villageFilter) params.village = villageFilter
      if (minRisk !== '') params.min_risk = parseInt(minRisk, 10)
      if (maxRisk !== '') params.max_risk = parseInt(maxRisk, 10)

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
    setMlDivergenceOnly(false)
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
      setMinRisk(''); setMaxRisk(''); setStatus('SUBMITTED')
    }
  }

  // Client-side search + sort + ML divergence filter
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
    if (mlDivergenceOnly) {
      data = data.filter(a => (a.divergence_score || 0) >= 35)
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
  }, [apps, search, sortBy, sortDir, mlDivergenceOnly])

  const handleDecisionSuccess = (appId, newStatus, fullData) => {
    setApps(prev =>
      prev.map(a => (a.id === appId ? { ...a, status: newStatus, ...fullData } : a))
    )
    if (selectedApp?.id === appId) {
      setSelectedApp(prev => ({ ...prev, status: newStatus }))
    }
  }

  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setDist('')
    setVillage('')
    setMinRisk('')
    setMaxRisk('')
    setTierPreset('ALL')
    setMlDivergenceOnly(false)
  }

  return (
    <div className="space-y-6 text-left font-sans">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              FORM AP-LEDGER (RULES 6 &amp; 8) // REVENUE VIGILANCE QUEUE
            </span>
            <span className="stamp border border-slate-300 bg-slate-100 text-slate-700 text-[10px] font-semibold">
              OFFICIAL USE ONLY
            </span>
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Central Beneficiary Adjudication Register
          </h1>
          <p className="font-sans text-xs text-slate-600 mt-0.5">
            Displaying <strong className="text-slate-900">{filtered.length}</strong> of <strong className="text-slate-900">{apps.length}</strong> registered cultivator subsidy claims under active surveillance
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={fetchApps}
            disabled={loading}
            className="border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 px-3.5 py-2 uppercase tracking-wider font-semibold transition-colors"
          >
            {loading ? 'Querying...' : 'Query Register ↻'}
          </button>
          <button
            onClick={() => exportToCSV(filtered)}
            className="bg-emerald-900 hover:bg-emerald-800 text-white px-4 py-2 uppercase tracking-wider font-semibold transition-colors"
          >
            Export Verified CSV →
          </button>
        </div>
      </div>

      {/* Preset Filter Bar */}
      <div className="border border-slate-200 bg-white p-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 uppercase text-[10px] mr-2 font-semibold">SURVEILLANCE TIER:</span>
          {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'PENDING'].map((preset) => (
            <button
              key={preset}
              onClick={() => applyTierPreset(preset)}
              className={`px-3 py-1 border transition-colors uppercase text-[11px] ${
                tierPreset === preset && !mlDivergenceOnly
                  ? 'border-slate-900 bg-slate-900 text-white font-bold'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
              }`}
            >
              {preset}
            </button>
          ))}
          <span className="text-slate-300 mx-1">|</span>
          <button
            onClick={() => {
              setMlDivergenceOnly(!mlDivergenceOnly)
              if (!mlDivergenceOnly) setTierPreset('')
            }}
            className={`px-3 py-1 border transition-colors uppercase text-[11px] flex items-center gap-1.5 ${
              mlDivergenceOnly
                ? 'border-purple-700 bg-purple-700 text-white font-bold shadow-sm'
                : 'border-purple-300 bg-purple-50 text-purple-900 hover:border-purple-500 font-semibold'
            }`}
          >
            <span>⚡</span>
            <span>ML DIVERGENT (≥+35)</span>
          </button>
        </div>

        {(search || statusFilter || districtFilter || minRisk || maxRisk || mlDivergenceOnly) && (
          <button
            onClick={clearFilters}
            className="text-slate-600 hover:text-slate-900 underline text-[11px]"
          >
            [Clear Parameters ×]
          </button>
        )}
      </div>

      {/* Filter Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
        <div className="sm:col-span-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search farmer name, parcel, district..."
            className="w-full bg-white border border-slate-300 text-slate-900 p-2 text-xs focus:outline-none focus:border-slate-800"
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-900 p-2 text-xs focus:outline-none focus:border-slate-800"
          >
            <option value="">Status (All)</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <input
            type="text"
            value={districtFilter}
            onChange={(e) => setDist(e.target.value.toUpperCase())}
            placeholder="District (e.g. MRT)"
            className="w-full bg-white border border-slate-300 text-slate-900 p-2 text-xs uppercase focus:outline-none focus:border-slate-800"
          />
        </div>
        <div>
          <input
            type="number"
            value={minRisk}
            onChange={(e) => setMinRisk(e.target.value)}
            placeholder="Min Risk (0-100)"
            className="w-full bg-white border border-slate-300 text-slate-900 p-2 text-xs focus:outline-none focus:border-slate-800"
          />
        </div>
        <div>
          <input
            type="number"
            value={maxRisk}
            onChange={(e) => setMaxRisk(e.target.value)}
            placeholder="Max Risk (0-100)"
            className="w-full bg-white border border-slate-300 text-slate-900 p-2 text-xs focus:outline-none focus:border-slate-800"
          />
        </div>
      </div>

      {/* Applications Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-900"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="border border-slate-200 p-12 text-center font-mono text-xs text-slate-500 bg-white">
          [ NO BENEFICIARY DOSSIERS MATCH CURRENT AUDIT FILTERS ]
        </div>
      ) : (
        <div className="border border-slate-300 bg-white overflow-x-auto shadow-sm">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                <th onClick={() => handleSort('id')} className="py-3 px-3 cursor-pointer hover:text-amber-300 font-semibold">
                  Dossier ID {sortBy === 'id' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('farmer_name')} className="py-3 px-3 cursor-pointer hover:text-amber-300 font-semibold">
                  Applicant Particulars {sortBy === 'farmer_name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-3 px-3 font-semibold">Revenue Jurisdiction</th>
                <th onClick={() => handleSort('risk_score')} className="py-3 px-3 cursor-pointer hover:text-amber-300 font-semibold">
                  Threat Score {sortBy === 'risk_score' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-3 px-3 font-semibold">Certainty</th>
                <th className="py-3 px-3 font-semibold">Signals</th>
                <th className="py-3 px-3 font-semibold">Statutory Status</th>
                <th className="py-3 px-3 text-right font-semibold">Adjudication</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-900">
              {filtered.map((a) => {
                const tier = getRiskTier(a.risk_score)
                const st = getStatusBadge(a.status)
                const flagCount = a.anomaly_flags?.length || 0

                return (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-bold whitespace-nowrap text-slate-900">
                      APP-{String(a.id).padStart(6, '0')}
                    </td>
                    <td className="py-3 px-3 font-sans max-w-[180px]">
                      <div className="font-semibold text-slate-900 truncate">{a.farmer_name}</div>
                      <span className="block font-mono text-[10px] text-slate-500 truncate">
                        {a.parcel_id || 'Parcel Unassigned'}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                      <span>{a.district_code || '—'}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-slate-500">{a.village_code || '—'}</span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`stamp text-[11px] ${tier.color}`}>
                            {a.risk_score != null ? `Rule: ${a.risk_score}` : '—'}
                          </span>
                          {a.ml_risk_score != null && (
                            <span className="font-mono text-[10px] text-purple-900 bg-purple-50 border border-purple-200 px-1.5 py-0.5 font-semibold">
                              ML: {a.ml_risk_score}
                            </span>
                          )}
                        </div>
                        {a.is_statutory_override ? (
                          <span className="stamp border border-red-400 bg-red-100 text-red-900 text-[9px] font-bold">
                            RULE 4 OVERRIDE (100)
                          </span>
                        ) : (a.divergence_score || 0) >= 35 ? (
                          <span className="stamp border border-purple-400 bg-purple-100 text-purple-900 text-[9px] font-extrabold">
                            ⚡ ML SURGE (+{a.divergence_score})
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-600 text-[11px]">
                      {a.confidence_score != null ? `${a.confidence_score}%` : '85%'}
                      <span className="text-slate-400 block text-[10px] uppercase">
                        {a.confidence_level || 'Medium'}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {flagCount > 0 ? (
                        <span className="stamp border border-amber-400 bg-amber-50 text-amber-900 font-bold text-[10px]">
                          {flagCount} FLAGS
                        </span>
                      ) : (
                        <span className="stamp border border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px] font-semibold">
                          0 FLAGS
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`stamp text-[10px] ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => setSelectedApp(a)}
                        className="border border-slate-300 hover:border-slate-800 bg-white text-slate-800 px-2 py-1 text-[11px] uppercase tracking-wider font-semibold"
                      >
                        Quick Action
                      </button>
                      <Link
                        to={`/admin/applications/${a.id}`}
                        className="border border-slate-900 bg-slate-900 hover:bg-slate-800 text-white py-1 px-2.5 text-[11px] uppercase tracking-wider font-semibold inline-block"
                      >
                        Dossier →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Dossier Slide-Over */}
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
