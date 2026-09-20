import { useState, useEffect, useMemo } from 'react'
import { adminAPI } from '../../api/client'
import { getRiskTier, getStatusBadge, exportToCSV, formatDateTime, SEVERITY_COLORS } from '../../utils/adminUtils'
import { Link, useSearchParams } from 'react-router-dom'
import Spinner from '../../components/Spinner'
import SyndicateGraphPanel from '../../components/SyndicateGraphPanel'

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
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                AUDIT AUDIENCE // DOSSIER REVIEW
              </span>
              <span className={`stamp text-[10px] ${st.color}`}>{st.label}</span>
            </div>
            <h2 className="font-serif text-xl font-bold text-slate-900">
              {app.farmer_name}
            </h2>
            <div className="font-mono text-xs text-slate-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>APP-{String(app.id).padStart(6, '0')}</span>
              <span>AADHAAR: {app.aadhaar_hash ? `${app.aadhaar_hash.slice(0, 4)}••••${app.aadhaar_hash.slice(-4)}` : 'REDACTED'}</span>
              <span>PARCEL: {app.parcel_id || 'NOT_ASSIGNED'}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-mono text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Drawer Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Statutory Override Alert */}
          {app.is_statutory_override && (
            <div className="border border-red-500 bg-red-50 p-3 font-mono text-xs text-red-900 space-y-1">
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
                {app.confidence_score != null ? `${app.confidence_score}%` : '85%'}
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">{app.confidence_level || 'MEDIUM'}</span>
            </div>
            <div className="border border-slate-200 p-3 bg-slate-50">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">RECOMMENDED</span>
              <span className="stamp border border-slate-300 bg-white text-slate-800 text-[10px] font-bold block mt-1">
                {app.recommended_action || 'OFFICER_REVIEW'}
              </span>
            </div>
          </div>

          {/* Anomaly Flags List */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
              <h3 className="font-serif font-bold text-sm text-slate-900 uppercase tracking-wide">
                Detected Cross-Registry Discrepancies ({flags.length})
              </h3>
              <span className="font-mono text-[10px] text-slate-500 uppercase">Verification Rules 1-8</span>
            </div>

            {flags.length === 0 ? (
              <div className="p-4 border border-slate-200 bg-slate-50 font-mono text-xs text-slate-500 text-center">
                ✓ No discrepancy triggers detected. Application satisfies statutory criteria.
              </div>
            ) : (
              <div className="space-y-2">
                {flags.map((flag, idx) => {
                  const isExpanded = expandedFlagIndex === idx
                  return (
                    <div key={idx} className="border border-slate-200 p-3 bg-slate-50 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-slate-900">{flag.anomaly_code}</span>
                        <span className="stamp text-[10px] border border-red-300 bg-red-50 text-red-800 font-bold">
                          +{flag.score} PTS
                        </span>
                      </div>
                      <p className="font-sans text-xs text-slate-700 leading-relaxed">
                        {flag.rationale}
                      </p>
                      {flag.raw_evidence && Object.keys(flag.raw_evidence).length > 0 && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setExpandedFlagIndex(isExpanded ? null : idx)}
                            className="font-mono text-[10px] text-blue-700 hover:text-blue-900 underline"
                          >
                            {isExpanded ? 'Hide Forensic Evidence [-]' : 'View Forensic Evidence [+]'}
                          </button>
                          {isExpanded && (
                            <pre className="mt-2 p-2 bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                              {JSON.stringify(flag.raw_evidence, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Adjudication Form */}
          <div className="border border-slate-300 bg-slate-50 p-4 space-y-3">
            <div className="border-b border-slate-200 pb-2 flex items-baseline justify-between">
              <h3 className="font-serif font-bold text-sm text-slate-900 uppercase tracking-wide">
                Fast Statutory Determination (ADM-05)
              </h3>
              <span className="font-mono text-[10px] text-slate-500">Official Adjudication</span>
            </div>

            {successMsg ? (
              <div className="border border-emerald-300 bg-emerald-50 p-3 font-mono text-xs text-emerald-900 font-bold">
                ✓ {successMsg}
              </div>
            ) : (
              <div className="space-y-3">
                {error && (
                  <div className="border border-red-300 bg-red-50 p-2 font-mono text-xs text-red-800">
                    ⚠ {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DECISION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDecision(opt.value)}
                      className={`p-2.5 border text-left transition-colors font-mono text-xs ${
                        decision === opt.value
                          ? 'border-blue-700 bg-blue-50 text-blue-900 ring-1 ring-blue-600'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{opt.code}</span>
                        {decision === opt.value && <span>●</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5">{opt.label}</div>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-500 font-semibold mb-1">
                    Official Statutory Justification Remarks (Mandatory)
                  </label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter explicit findings, legal rule citations, or verification order notes..."
                    className="w-full bg-white border border-slate-300 text-slate-900 p-2 text-xs font-sans focus:outline-none focus:border-slate-800"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleDecisionSubmit}
                  disabled={submitting || !decision}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white font-mono text-xs uppercase tracking-wider py-2.5 px-4 font-bold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'COMMITTING TO AUDIT LEDGER...' : 'AUTHORIZE STATUTORY ORDER ➔'}
                </button>
              </div>
            )}
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
  const [searchParams] = useSearchParams()

  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedApp, setSelectedApp] = useState(null)

  // View Mode: 'command' (Split screen Command Center) vs 'table' (Classic Registry Table)
  const [viewMode, setViewMode] = useState('command')

  // Selected application in Command Center split view
  const [activeAppId, setActiveAppId] = useState(null)

  // Sub-tabs in Command Center investigation workspace: 'signals' | 'graph'
  const [workspaceTab, setWorkspaceTab] = useState('signals')

  // Inline decision state in Command Center
  const [inlineDecision, setInlineDecision] = useState('')
  const [inlineRemarks, setInlineRemarks] = useState('')
  const [inlineSubmitting, setInlineSubmitting] = useState(false)
  const [inlineMsg, setInlineMsg] = useState('')
  const [inlineErr, setInlineErr] = useState('')

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

  // Automatically select the first application in Command Center mode if none selected or invalid
  useEffect(() => {
    if (filtered.length > 0) {
      if (!activeAppId || !filtered.some(a => a.id === activeAppId)) {
        setActiveAppId(filtered[0].id)
      }
    } else {
      setActiveAppId(null)
    }
  }, [filtered, activeAppId])

  const activeApp = useMemo(() => {
    return filtered.find(a => a.id === activeAppId) || apps.find(a => a.id === activeAppId) || null
  }, [activeAppId, filtered, apps])

  // Co-claimants sharing the same parcel, bank, or mobile collisions
  const coClaimants = useMemo(() => {
    if (!activeApp) return []
    return apps.filter(a =>
      a.id !== activeApp.id && (
        (activeApp.parcel_id && a.parcel_id === activeApp.parcel_id) ||
        (activeApp.aadhaar_hash && a.aadhaar_hash === activeApp.aadhaar_hash)
      )
    )
  }, [activeApp, apps])

  const handleDecisionSuccess = (appId, newStatus, fullData) => {
    setApps(prev =>
      prev.map(a => (a.id === appId ? { ...a, status: newStatus, ...fullData } : a))
    )
    if (selectedApp?.id === appId) {
      setSelectedApp(prev => ({ ...prev, status: newStatus }))
    }
  }

  const handleInlineDecisionSubmit = async () => {
    if (!activeApp) return
    if (!inlineDecision) {
      setInlineErr('Select an official adjudication determination.')
      return
    }
    if (inlineRemarks.trim().length < 10) {
      setInlineErr('Officer written justification must be at least 10 characters citing legal basis.')
      return
    }

    setInlineSubmitting(true)
    setInlineErr('')
    try {
      const { data } = await adminAPI.decision(activeApp.id, {
        decision: inlineDecision,
        remarks: inlineRemarks.trim()
      })
      setInlineMsg(`Determination recorded: ${data.new_status}`)
      handleDecisionSuccess(activeApp.id, data.new_status, data)
      setTimeout(() => {
        setInlineMsg('')
        setInlineDecision('')
        setInlineRemarks('')
      }, 4000)
    } catch (err) {
      setInlineErr(err.response?.data?.detail || 'Failed to submit adjudication order.')
    } finally {
      setInlineSubmitting(false)
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

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {/* View Mode Switcher */}
          <div className="flex items-center border border-slate-300 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('command')}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase transition-colors ${
                viewMode === 'command'
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              ⚡ Split Command Center
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase transition-colors ${
                viewMode === 'table'
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              📋 Registry Table
            </button>
          </div>

          <button
            onClick={fetchApps}
            disabled={loading}
            className="border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 px-3 py-1.5 uppercase tracking-wider font-semibold transition-colors"
          >
            {loading ? 'Querying...' : 'Query ↻'}
          </button>
          <button
            onClick={() => exportToCSV(filtered)}
            className="bg-emerald-800 hover:bg-emerald-900 text-white px-3.5 py-1.5 uppercase tracking-wider font-semibold transition-colors"
          >
            Export CSV →
          </button>
        </div>
      </div>

      {/* Preset Filter Bar */}
      <div className="border border-slate-200 bg-white p-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 uppercase text-[10px] mr-2 font-semibold">SURVEILLANCE TIER:</span>
          {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'PENDING'].map((preset) => (
            <button
              key={preset}
              onClick={() => applyTierPreset(preset)}
              className={`px-3 py-1 border transition-colors uppercase text-[11px] ${
                tierPreset === preset && !mlDivergenceOnly
                  ? 'border-blue-700 bg-blue-50 text-blue-900 font-bold ring-1 ring-blue-600'
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

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center text-slate-900"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="border border-slate-200 p-12 text-center font-mono text-xs text-slate-500 bg-white">
          [ NO BENEFICIARY DOSSIERS MATCH CURRENT AUDIT FILTERS ]
        </div>
      ) : viewMode === 'command' ? (
        /* ── VIEW 1: Split-Screen Command Center ── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Pane: Surveillance Queue */}
          <div className="lg:col-span-4 space-y-2">
            <div className="border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between font-mono text-xs">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Surveillance Queue ({filtered.length})
              </span>
              <span className="text-slate-500 text-[10px]">Click to inspect</span>
            </div>

            <div className="max-h-[720px] overflow-y-auto space-y-2 pr-1">
              {filtered.map((a) => {
                const tier = getRiskTier(a.risk_score)
                const st = getStatusBadge(a.status)
                const isSelected = activeAppId === a.id

                return (
                  <div
                    key={a.id}
                    onClick={() => setActiveAppId(a.id)}
                    className={`p-3 border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[10px] text-slate-500 font-bold block">
                          APP-{String(a.id).padStart(6, '0')}
                        </span>
                        <h4 className="font-serif font-bold text-sm text-slate-900 leading-snug">
                          {a.farmer_name}
                        </h4>
                      </div>
                      <span className={`stamp text-[10px] shrink-0 ${st.color}`}>
                        {st.label}
                      </span>
                    </div>

                    <div className="font-mono text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span className="truncate">{a.village_code || 'Village Unassigned'} / {a.district_code || '—'}</span>
                      <span className="text-slate-400 truncate max-w-[100px]">{a.parcel_id || 'No Parcel'}</span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`stamp text-[10px] ${tier.color}`}>
                          Rule: {a.risk_score ?? 0}
                        </span>
                        {a.ml_risk_score != null && (
                          <span className="font-mono text-[10px] text-purple-900 bg-purple-50 border border-purple-200 px-1 py-0.2 font-semibold">
                            ML: {a.ml_risk_score}
                          </span>
                        )}
                        {a.is_statutory_override ? (
                          <span className="stamp border border-red-400 bg-red-100 text-red-900 text-[9px] font-bold">
                            RULE 4
                          </span>
                        ) : (a.divergence_score || 0) >= 35 ? (
                          <span className="stamp border border-purple-400 bg-purple-100 text-purple-900 text-[9px] font-extrabold">
                            ⚡ SURGE (+{a.divergence_score})
                          </span>
                        ) : null}
                      </div>

                      <span className="font-mono text-[10px] text-slate-400">
                        {a.anomaly_flags?.length || 0} flags
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Pane: Investigation Workspace */}
          <div className="lg:col-span-8 space-y-4">
            {activeApp ? (
              <div className="border border-slate-300 bg-white shadow-sm">
                {/* Workspace Header */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        ACTIVE INVESTIGATION // APP-{String(activeApp.id).padStart(6, '0')}
                      </span>
                      <span className={`stamp text-[10px] ${getStatusBadge(activeApp.status).color}`}>
                        {getStatusBadge(activeApp.status).label}
                      </span>
                    </div>
                    <h2 className="font-serif text-xl font-bold text-slate-900">
                      {activeApp.farmer_name}
                    </h2>
                    <div className="font-mono text-xs text-slate-600 mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5">
                      <span>AADHAAR: {activeApp.aadhaar_hash ? `${activeApp.aadhaar_hash.slice(0, 4)}••••${activeApp.aadhaar_hash.slice(-4)}` : 'REDACTED'}</span>
                      <span>PARCEL: {activeApp.parcel_id || 'UNASSIGNED'}</span>
                      <span>DISTRICT: {activeApp.district_code || '—'}</span>
                    </div>
                  </div>

                  <Link
                    to={`/admin/applications/${activeApp.id}`}
                    className="border border-slate-300 hover:border-slate-800 bg-white text-slate-800 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors inline-block text-center whitespace-nowrap"
                  >
                    Open Full Dossier →
                  </Link>
                </div>

                <div className="p-4 space-y-4">
                  {/* Statutory Rule 4 Alert */}
                  {activeApp.is_statutory_override && (
                    <div className="border border-red-500 bg-red-50 p-2.5 font-mono text-xs text-red-900 flex items-center justify-between">
                      <span className="font-bold">⚠ PM-KISAN RULE 4 MANDATORY STATUTORY EXCLUSION</span>
                      <span className="stamp border border-red-700 bg-red-700 text-white font-bold text-[10px]">
                        LOCKED 100 RISK
                      </span>
                    </div>
                  )}

                  {/* ML Suspicion Surge Alert */}
                  {(activeApp.divergence_score || 0) >= 35 && !activeApp.is_statutory_override && (
                    <div className="border border-purple-400 bg-purple-50 p-2.5 font-mono text-xs text-purple-900 flex items-center justify-between">
                      <span className="font-bold">⚡ ML SUSPICION SURGE DETECTED</span>
                      <span className="stamp border border-purple-500 bg-purple-200 text-purple-950 font-bold text-[10px]">
                        +{activeApp.divergence_score} PTS OVER HEURISTICS
                      </span>
                    </div>
                  )}

                  {/* 4-Metric Score Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                    <div className="border border-slate-200 p-2.5 bg-slate-50">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">HEURISTIC RISK</span>
                      <span className={`text-lg font-bold block mt-0.5 ${activeApp.risk_score >= 50 ? 'text-red-700' : 'text-slate-900'}`}>
                        {activeApp.risk_score ?? 0} / 100
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">{getRiskTier(activeApp.risk_score).label}</span>
                    </div>
                    <div className="border border-slate-200 p-2.5 bg-slate-50">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">XGBOOST ML RISK</span>
                      <span className={`text-lg font-bold block mt-0.5 ${(activeApp.ml_risk_score ?? activeApp.risk_score) >= 50 ? 'text-purple-700' : 'text-slate-900'}`}>
                        {activeApp.ml_risk_score ?? activeApp.risk_score ?? 0} / 100
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">
                        {(activeApp.divergence_score || 0) >= 35 ? `Surge (+${activeApp.divergence_score})` : 'Calibrated'}
                      </span>
                    </div>
                    <div className="border border-slate-200 p-2.5 bg-slate-50">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">CONFIDENCE INDEX</span>
                      <span className="text-lg font-bold text-slate-900 block mt-0.5">
                        {activeApp.confidence_score != null ? `${activeApp.confidence_score}%` : '85%'}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">{activeApp.confidence_level || 'MEDIUM'}</span>
                    </div>
                    <div className="border border-slate-200 p-2.5 bg-slate-50">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">RECOMMENDED</span>
                      <span className="stamp border border-slate-300 bg-white text-slate-800 text-[10px] font-bold block mt-1 truncate">
                        {activeApp.recommended_action || 'OFFICER_REVIEW'}
                      </span>
                    </div>
                  </div>

                  {/* Workspace Sub-Tabs */}
                  <div className="border-b border-slate-200 flex items-center gap-1 pt-1 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setWorkspaceTab('signals')}
                      className={`px-3.5 py-2 font-bold uppercase transition-colors border-b-2 -mb-px ${
                        workspaceTab === 'signals'
                          ? 'border-blue-700 text-blue-900 bg-blue-50/30'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      📋 Verification Signals &amp; Co-Claimants
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkspaceTab('graph')}
                      className={`px-3.5 py-2 font-bold uppercase transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                        workspaceTab === 'graph'
                          ? 'border-blue-700 text-blue-900 bg-blue-50/30'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>🕸️ Fraud Ring Radar (Forensic Graph)</span>
                      {coClaimants.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
                      )}
                    </button>
                  </div>

                  {/* Sub-Tab 1: Signals & Co-Claimants */}
                  {workspaceTab === 'signals' && (
                    <div className="space-y-4">
                      {/* Co-Claimants Collision Bar */}
                      {coClaimants.length > 0 ? (
                        <div className="border border-amber-300 bg-amber-50 p-3 space-y-1.5 font-mono text-xs text-amber-900">
                          <div className="flex items-center justify-between font-bold">
                            <span>⚠ ASSET COLLISION DETECTED: {coClaimants.length} CO-CLAIMANTS SHARE PARCEL/IDENTIFIER</span>
                            <span className="stamp border border-amber-500 bg-amber-100 text-amber-950 font-bold text-[10px]">
                              POTENTIAL RING
                            </span>
                          </div>
                          <p className="font-sans text-xs text-amber-800">
                            The parcel or identity token in this claim is linked to other active applications in the registry:
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {coClaimants.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setActiveAppId(c.id)}
                                className="border border-amber-400 bg-white hover:bg-amber-100 text-amber-900 px-2 py-0.5 text-[11px] font-mono transition-colors"
                              >
                                APP-{String(c.id).padStart(6, '0')} ({c.farmer_name}) ➔
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="border border-emerald-200 bg-emerald-50/50 p-3 flex items-center justify-between font-mono text-xs text-emerald-900">
                          <span className="flex items-center gap-2">
                            <span>✓</span>
                            <span>Independent Beneficiary: Zero shared parcel, bank, or mobile collisions with other claimants.</span>
                          </span>
                        </div>
                      )}

                      {/* Triggered Anomaly Signals */}
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                          <h4 className="font-serif font-bold text-sm text-slate-900 uppercase tracking-wide">
                            Detected Cross-Registry Signals ({(activeApp.anomaly_flags || []).length})
                          </h4>
                          <span className="font-mono text-[10px] text-slate-500 uppercase">Verification Rules 1-8</span>
                        </div>

                        {(activeApp.anomaly_flags || []).length === 0 ? (
                          <div className="p-4 border border-slate-200 bg-slate-50 font-mono text-xs text-slate-500 text-center">
                            ✓ No discrepancy triggers detected. Application satisfies statutory criteria.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                            {activeApp.anomaly_flags.map((flag, idx) => (
                              <div key={idx} className="border border-slate-200 p-3 bg-slate-50/70 space-y-1 text-xs">
                                <div className="flex items-center justify-between font-mono">
                                  <span className="font-bold text-slate-900">{flag.anomaly_code}</span>
                                  <span className="stamp text-[10px] border border-red-300 bg-red-50 text-red-800 font-bold">
                                    +{flag.score} PTS
                                  </span>
                                </div>
                                <p className="font-sans text-xs text-slate-700 leading-relaxed">
                                  {flag.rationale}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sub-Tab 2: Fraud Ring Radar Graph */}
                  {workspaceTab === 'graph' && (
                    <div className="border border-slate-200 bg-white">
                      <SyndicateGraphPanel
                        applicationId={activeApp.id}
                        onOpenApplication={(targetId) => setActiveAppId(targetId)}
                      />
                    </div>
                  )}

                  {/* Fast Statutory Adjudication Desk */}
                  <div className="border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="font-mono text-xs font-bold text-slate-900 uppercase tracking-wider">
                        ⚡ Fast Statutory Adjudication Desk
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">Official Determination</span>
                    </div>

                    {inlineMsg ? (
                      <div className="border border-emerald-300 bg-emerald-50 p-3 font-mono text-xs text-emerald-900 font-bold">
                        ✓ {inlineMsg}
                      </div>
                    ) : (
                      <div className="space-y-2 font-mono text-xs">
                        {/* 5 Decision options */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                          {DECISION_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setInlineDecision(opt.value)}
                              className={`py-1.5 px-1 border text-center transition-colors text-[10px] font-bold ${
                                inlineDecision === opt.value
                                  ? 'border-blue-700 bg-blue-50 text-blue-900 ring-1 ring-blue-600'
                                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                              }`}
                            >
                              {opt.code}
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={inlineRemarks}
                            onChange={(e) => setInlineRemarks(e.target.value)}
                            placeholder="Enter statutory justification remarks (min 10 characters)..."
                            className="flex-1 bg-white border border-slate-300 text-slate-900 p-2 text-xs font-sans focus:outline-none focus:border-slate-800 placeholder:text-slate-400"
                          />
                          <button
                            onClick={handleInlineDecisionSubmit}
                            disabled={inlineSubmitting || !inlineDecision}
                            className="border border-blue-700 bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-2 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap transition-colors disabled:opacity-50"
                          >
                            {inlineSubmitting ? 'Recording...' : 'Commit Order ➔'}
                          </button>
                        </div>
                        {inlineErr && (
                          <p className="text-red-700 text-[11px]">{inlineErr}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 p-12 text-center text-slate-500 font-mono text-xs bg-white">
                [ SELECT AN APPLICANT FROM THE SURVEILLANCE QUEUE TO BEGIN INVESTIGATION ]
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── VIEW 2: Classic Registry Table ── */
        <div className="border border-slate-300 bg-white overflow-x-auto shadow-sm">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider">
                <th onClick={() => handleSort('id')} className="py-3 px-3 cursor-pointer hover:text-blue-700 font-semibold">
                  Dossier ID {sortBy === 'id' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('farmer_name')} className="py-3 px-3 cursor-pointer hover:text-blue-700 font-semibold">
                  Applicant Particulars {sortBy === 'farmer_name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-3 px-3 font-semibold">Revenue Jurisdiction</th>
                <th onClick={() => handleSort('risk_score')} className="py-3 px-3 cursor-pointer hover:text-blue-700 font-semibold">
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
                        className="border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 py-1 px-2.5 text-[11px] uppercase tracking-wider font-semibold inline-block"
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
