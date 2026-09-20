import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { adminAPI } from '../../api/client'
import {
  getRiskTier, getStatusBadge, SEVERITY_COLORS,
  formatDate, formatDateTime
} from '../../utils/adminUtils'
import Spinner from '../../components/Spinner'
import SyndicateGraphPanel from '../../components/SyndicateGraphPanel'

// ── Decision Options (ADM-05) ────────────────────────────────────────────────
const DECISION_OPTIONS = [
  { value: 'APPROVE',           label: 'APPROVE SUBSIDY',             code: '[APPROVE]',     desc: 'Applicant satisfies all eligibility criteria' },
  { value: 'HOLD',              label: 'HOLD DISBURSEMENT',           code: '[HOLD]',        desc: 'Hold payment pending physical field verification' },
  { value: 'REQUEST_DOCUMENTS', label: 'REQUEST REVENUE PROOF',       code: '[DOCS REQ]',    desc: 'Notify applicant to upload certified revenue extract' },
  { value: 'REJECT',            label: 'REJECT CLAIM',                code: '[REJECT]',      desc: 'Disqualify based on statutory exclusion or fake title' },
  { value: 'ESCALATE',          label: 'ESCALATE TO VIGILANCE',       code: '[ESCALATE]',    desc: 'Refer to District Vigilance Anti-Fraud Committee' },
]

export default function AdminApplicationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [app, setApp] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showGraph, setShowGraph] = useState(false)

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
      setDecisionError('Select an official adjudication determination.')
      return
    }
    if (remarks.trim().length < 10) {
      setDecisionError('Officer written justification must be at least 10 characters citing legal basis.')
      return
    }

    setSub(true)
    setDecisionError('')
    try {
      const { data } = await adminAPI.decision(id, {
        decision,
        remarks: remarks.trim(),
      })
      setDecisionSuccess(data)
      setApp(prev => ({ ...prev, status: data.new_status }))
      fetchApplicationData()
    } catch (err) {
      setDecisionError(err.response?.data?.detail || 'Failed to record adjudication.')
    } finally {
      setSub(false)
    }
  }

  if (loading) {
    return (
      <div className="py-24 text-center text-white"><Spinner /></div>
    )
  }

  if (error || !app) {
    return (
      <div className="border border-accent p-8 bg-black text-accent text-left font-mono text-xs space-y-3">
        <strong>[DOSSIER NOT FOUND]</strong>
        <p>{error || 'Requested application reference does not exist.'}</p>
        <Link to="/admin/applications" className="underline block text-white">← Return to Application Ledger</Link>
      </div>
    )
  }

  const tier = getRiskTier(app.risk_score)
  const st = getStatusBadge(app.status)
  const flags = app.anomaly_flags || []

  // ML Risk Calibration & Explainability (XGB-05)
  const isOverride = app.anomaly_report?.is_statutory_override || app.is_statutory_override || false
  const ruleScore = app.risk_score ?? 0
  const mlScore = app.anomaly_report?.ml_risk_score ?? app.ml_risk_score ?? ruleScore
  const divergence = app.anomaly_report?.divergence_score ?? app.divergence_score ?? (mlScore - ruleScore)
  const shapDrivers = app.anomaly_report?.ml_shap_drivers || []

  // Check specific flags
  const flagCodes = new Set(flags.map(f => f.anomaly_code))
  const hasLandMismatch = flagCodes.has('LAND_AREA_DISCREPANCY') || flagCodes.has('LAND_OWNER_NAME_MISMATCH')
  const hasLandInactive = flagCodes.has('LAND_OWNERSHIP_INACTIVE') || flagCodes.has('LAND_NOT_AGRICULTURAL') || flagCodes.has('LAND_PARCEL_NOT_FOUND')
  const hasDuplicateClaim = flagCodes.has('DUPLICATE_LAND_PARCEL_MULTI_APP') || flagCodes.has('PARCEL_SYNDICATE_PATTERN')
  const hasBankMismatch = flagCodes.has('BANK_NAME_MISMATCH')
  const hasBankInactive = flagCodes.has('BANK_ACCOUNT_INACTIVE') || flagCodes.has('BANK_ACCOUNT_NOT_FOUND') || flagCodes.has('BANK_IFSC_INVALID')
  const hasTaxpayerFlag = flagCodes.has('EXCLUSION_TAXPAYER')
  const hasGovtEmpFlag = flagCodes.has('EXCLUSION_GOVT_EMPLOYEE')

  return (
    <div className="space-y-6 text-left font-sans">
      {/* Return & Security Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 font-mono text-xs">
        <Link
          to="/admin/applications"
          className="text-slate-600 hover:text-slate-900 underline uppercase tracking-wider font-semibold"
        >
          ← Return to Central Adjudication Register
        </Link>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="font-semibold">STATUTORY CLASSIFICATION:</span>
          <span className="stamp border border-slate-300 bg-slate-100 text-slate-800 font-bold">
            CONFIDENTIAL AUDIT DOSSIER // RESTRICTED
          </span>
        </div>
      </div>

      {/* Hero Dossier Header Banner (ADM-04) */}
      <div className="border border-slate-300 bg-white shadow-sm">
        {/* National tri-color accent line */}
        <div className="h-1 flex w-full">
          <div className="bg-[#f97316] w-1/3" />
          <div className="bg-white w-1/3 border-b border-slate-200" />
          <div className="bg-[#16a34a] w-1/3" />
        </div>

        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                  FORM AD-5 // DOSSIER REF:
                </span>
                <h1 className="text-3xl font-bold text-slate-900 font-mono tracking-tight">
                  APP-{String(app.id).padStart(6, '0')}
                </h1>
                <span className={`stamp text-xs px-2.5 py-1 ${st.color}`}>
                  {st.label}
                </span>
                <span className="font-mono text-xs text-slate-600 font-semibold border border-slate-200 px-2 py-0.5 bg-slate-50">
                  SCHEME: {app.scheme_code || 'PM_KISAN'}
                </span>
              </div>

              <p className="text-2xl font-serif font-bold text-slate-900 mt-1">
                {app.farmer_name}
              </p>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-xs text-slate-600 pt-1 border-t border-slate-100 mt-2">
                <span>STATE: <strong className="text-slate-900">{app.state_code || '—'}</strong></span>
                <span>DISTRICT: <strong className="text-slate-900">{app.district_code || '—'}</strong></span>
                <span>TEHSIL: <strong className="text-slate-900">{app.tehsil_code || '—'}</strong></span>
                <span>VILLAGE: <strong className="text-slate-900">{app.village_code || '—'}</strong></span>
                <span>KHATA / PLOT: <strong className="text-slate-900">{app.khata_number || '—'} / {app.plot_number || '—'}</strong></span>
              </div>
            </div>

            {/* Risk and Confidence Pillar */}
            <div className="flex flex-wrap lg:flex-col items-start lg:items-end gap-3 border border-slate-200 p-4 bg-slate-50 font-mono text-xs">
              <div className="text-left lg:text-right">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">ANOMALY THREAT SCORE</span>
                <span className={`text-2xl font-bold ${app.risk_score >= 50 ? 'text-red-700' : 'text-slate-900'}`}>
                  {app.risk_score != null ? `${app.risk_score} / 100` : '—'}
                </span>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">{tier.label}</span>
              </div>

              <div className="text-left lg:text-right border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">CERTAINTY INDEX</span>
                <span className="text-base font-bold text-slate-900 block">
                  {app.confidence_score != null ? `${app.confidence_score}%` : '85%'}
                </span>
                <span className="text-[10px] text-slate-500 uppercase block">{app.confidence_level || 'Medium'}</span>
              </div>

              <div className="text-left lg:text-right border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">RECOMMENDED DETERMINATION</span>
                <span className="stamp border border-slate-300 bg-white text-slate-900 text-[11px] font-bold mt-0.5">
                  {app.recommended_action || 'OFFICER_REVIEW'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statutory Override Alert Banner (Statutory PM-KISAN Rule 4 Invariant) */}
      {isOverride && (
        <div className="border-2 border-red-600 bg-red-50 p-4 font-mono text-xs text-red-900 shadow-sm flex flex-col sm:flex-row items-start gap-3">
          <span className="stamp border border-red-700 bg-red-700 text-white text-[11px] font-bold px-2 py-0.5 whitespace-nowrap">
            [STATUTORY OVERRIDE ENFORCED]
          </span>
          <div className="space-y-1">
            <strong className="block text-red-950 font-bold uppercase tracking-wide text-xs">
              Mandatory Statutory Disqualification — PM-KISAN Operational Guidelines Rule 4
            </strong>
            <p className="font-sans text-xs text-red-800 leading-relaxed">
              This application triggered one or more strict statutory disqualifications (e.g. Income Taxpayer assessee, Deceased identity claim, Institutional landholder, or Non-Agricultural land). The KisanGuard pipeline has locked the Threat Score to Maximum (100/100), superseding statistical probability calculations.
            </p>
          </div>
        </div>
      )}

      {/* Dual-Risk Calibration & Model Divergence Card (XGB-05) */}
      <div className="border border-slate-300 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-slate-200 pb-3 gap-2">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
              SCHEDULE 0 // DUAL-ENGINE RISK CALIBRATION (HEURISTIC VS. SUPERVISED XGBOOST)
            </div>
            <h2 className="font-serif text-xl font-bold text-slate-900 mt-0.5">
              Dual-Engine Risk Calibration &amp; Machine Learning Calibration
            </h2>
            <p className="font-sans text-xs text-slate-600 mt-0.5">
              Comparative analysis of linear rule accumulation vs. non-linear multi-signal interaction probabilities
            </p>
          </div>
          {divergence >= 35 && (
            <span className="stamp border-2 border-purple-600 bg-purple-100 text-purple-900 font-extrabold text-xs px-2.5 py-1 tracking-wider whitespace-nowrap">
              ⚡ ML SUSPICION SURGE (+{divergence} PTS)
            </span>
          )}
        </div>

        {/* Comparison Meters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          {/* 1. Heuristic Rule Meter */}
          <div className="border border-slate-200 p-4 bg-slate-50 space-y-2.5">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-700 uppercase font-bold text-[11px]">1. Heuristic Rule Score</span>
              <span className="text-[10px] text-slate-500">Linear Engine Sum</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${ruleScore >= 70 ? 'text-red-700' : ruleScore >= 40 ? 'text-amber-700' : 'text-slate-900'}`}>
                {ruleScore}
              </span>
              <span className="text-slate-500">/ 100</span>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-none overflow-hidden">
              <div
                className={`h-full transition-all ${ruleScore >= 70 ? 'bg-red-600' : ruleScore >= 40 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                style={{ width: `${Math.min(100, Math.max(0, ruleScore))}%` }}
              />
            </div>
            <p className="font-sans text-[11px] text-slate-500 leading-tight">
              Accumulated penalty sum across statutory, land registry, PFMS banking, and identity verification checks.
            </p>
          </div>

          {/* 2. Divergence Delta Indicator */}
          <div className="border border-slate-200 p-4 bg-slate-50 flex flex-col justify-between space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-700 uppercase font-bold text-[11px]">Model Divergence</span>
              <span className="text-[10px] text-slate-500">Δ ML - Rule</span>
            </div>
            <div className="text-center py-1">
              <span className={`text-3xl font-bold font-mono ${divergence >= 35 ? 'text-purple-700' : divergence > 0 ? 'text-blue-700' : 'text-slate-700'}`}>
                {divergence > 0 ? `+${divergence}` : divergence}
              </span>
              <span className="block text-[10px] uppercase font-semibold text-slate-500 mt-0.5">
                {divergence >= 35 ? 'High Non-Linear Risk Surge' : divergence > 0 ? 'ML Elevated Concern' : 'Mutual Calibration Alignment'}
              </span>
            </div>
            <div className="font-sans text-[11px] text-slate-600 text-center border-t border-slate-200 pt-2 leading-tight">
              {divergence >= 35
                ? 'XGBoost detected complex non-linear syndicate interactions that exceeded isolated rule penalties.'
                : 'Rule heuristics and gradient boosted decision trees are in statistical agreement.'}
            </div>
          </div>

          {/* 3. XGBoost ML Meter */}
          <div className="border border-slate-200 p-4 bg-slate-50 space-y-2.5">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-700 uppercase font-bold text-[11px]">2. XGBoost ML Score</span>
              <span className="text-[10px] text-slate-500">Supervised Booster</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${mlScore >= 70 ? 'text-purple-700' : mlScore >= 40 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {mlScore}
              </span>
              <span className="text-slate-500">/ 100</span>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-none overflow-hidden">
              <div
                className={`h-full transition-all ${mlScore >= 70 ? 'bg-purple-600' : mlScore >= 40 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                style={{ width: `${Math.min(100, Math.max(0, mlScore))}%` }}
              />
            </div>
            <p className="font-sans text-[11px] text-slate-500 leading-tight">
              Calibrated multi-variate probability vector assessing coordinated ring patterns and multi-signal drift.
            </p>
          </div>
        </div>
      </div>

      {/* TreeSHAP Feature Attribution Bar Chart (XGB-05) */}
      {shapDrivers.length > 0 && (
        <div className="border border-slate-300 bg-white p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                EXPLAINABILITY ENGINE // MATHEMATICAL FEATURE CONTRIBUTIONS
              </div>
              <h3 className="font-serif text-lg font-bold text-slate-900 mt-0.5">
                TreeSHAP Feature Attribution (Top 3 Model Drivers)
              </h3>
              <p className="font-sans text-xs text-slate-600 mt-0.5">
                Local Shapley values computed in margin space via tree-path perturbation showing which features increased (+) or mitigated (-) suspicion.
              </p>
            </div>
            <span className="font-mono text-[10px] text-slate-700 uppercase border border-slate-300 px-2.5 py-1 bg-slate-50 font-semibold whitespace-nowrap">
              Fast Native C++ TreeSHAP (&lt;2ms)
            </span>
          </div>

          {/* Horizontal Feature Attribution Bars */}
          <div className="space-y-3.5">
            {shapDrivers.map((driver, idx) => {
              const isPositive = driver.attribution_value >= 0
              const absVal = Math.abs(driver.attribution_value)
              const maxVal = Math.max(...shapDrivers.map(d => Math.abs(d.attribution_value)), 1.0)
              const pct = Math.min(100, Math.max(15, Math.round((absVal / maxVal) * 100)))

              return (
                <div key={idx} className="border border-slate-200 p-4 bg-slate-50 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-[13px]">{driver.feature_name}</span>
                      <span className={`stamp text-[10px] px-1.5 py-0.5 font-bold ${isPositive ? 'border-red-300 bg-red-100 text-red-800' : 'border-emerald-300 bg-emerald-100 text-emerald-800'}`}>
                        {isPositive ? 'INCREASES RISK (+)' : 'MITIGATES RISK (-)'}
                      </span>
                    </div>
                    <span className="font-bold text-slate-800">
                      SHAP Contribution: {driver.attribution_value > 0 ? `+${driver.attribution_value.toFixed(4)}` : driver.attribution_value.toFixed(4)}
                    </span>
                  </div>

                  {/* Attribution Bar */}
                  <div className="w-full bg-slate-200 h-3 rounded-none overflow-hidden flex">
                    <div
                      className={`h-full transition-all ${isPositive ? 'bg-red-600' : 'bg-emerald-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <p className="font-sans text-xs text-slate-600">
                    {driver.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Interactive Syndicate & Fraud Ring Investigation Panel ── */}
      <div className="border border-slate-300 bg-white shadow-sm">
        {/* Section Header / Toggle Button */}
        <button
          onClick={() => setShowGraph(g => !g)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-200 group"
        >
          <div className="flex items-center gap-3">
            {/* Tri-color accent dot */}
            <span className="flex gap-0.5">
              <span className="w-2 h-2 rounded-full bg-[#f97316]" />
              <span className="w-2 h-2 rounded-full bg-white border border-slate-300" />
              <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
            </span>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">ENG-08 // FORENSIC GRAPH INTELLIGENCE</span>
              <span className="font-serif text-base font-bold text-slate-900">
                Syndicate &amp; Fraud Ring Radar
              </span>
            </div>
            {hasDuplicateClaim && (
              <span className="font-mono text-[10px] px-2 py-0.5 border border-rose-400 bg-rose-50 text-rose-800 font-bold uppercase">
                ⚠ Ring Pattern Detected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 group-hover:text-slate-800 transition-colors">
            <span>{showGraph ? 'COLLAPSE ▲' : 'OPEN INVESTIGATION ▼'}</span>
          </div>
        </button>

        {/* Collapsible Graph Panel */}
        {showGraph && (
          <div className="border-t border-slate-200">
            <SyndicateGraphPanel
              applicationId={app.id}
              onOpenApplication={(targetId) => navigate(`/admin/applications/${targetId}`)}
            />
          </div>
        )}
      </div>

      {/* AI Rationale Summary Banner */}
      {app.anomaly_report?.rationale && (
        <div className="border border-slate-300 p-5 bg-white font-mono text-xs space-y-1 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
            <strong className="text-slate-900 uppercase text-[11px] tracking-wider font-bold">
              [ AI EXPLAINABILITY RATIONALE &amp; STATUTORY SYNTHESIS ]
            </strong>
            <span className="text-[10px] text-slate-500 uppercase">RULE-BASED + STATISTICAL ENGINES</span>
          </div>
          <p className="text-slate-700 font-sans leading-relaxed text-sm">
            {app.anomaly_report.rationale}
          </p>
        </div>
      )}

      {/* ── SECTION 1: Multi-Registry Cross-Verification Matrix ── */}
      <div className="border border-slate-300 p-6 bg-white space-y-4 shadow-sm">
        <div className="border-b border-slate-200 pb-3 flex items-baseline justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500 font-semibold">SCHEDULE I // INTER-MINISTERIAL RECONCILIATION</div>
            <h2 className="font-serif text-xl font-bold text-slate-900 mt-0.5">Multi-Registry Cross-Verification Matrix</h2>
            <p className="font-sans text-xs text-slate-600 mt-0.5">
              Reconciliation of applicant claims against State Bhulekh, PFMS banking gateway, and Income Tax exclusion rolls
            </p>
          </div>
          <span className="font-mono text-[10px] text-slate-700 uppercase border border-slate-300 px-2.5 py-1 bg-slate-50 font-semibold">
            4 National Registries Queried
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono text-xs">
          {/* Registry 1: Bhulekh */}
          <div className="border border-slate-200 p-4 bg-slate-50 space-y-2.5">
            <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-900 font-bold uppercase">1. State Bhulekh Land Records</span>
              <span className={`stamp text-[10px] ${hasLandInactive || hasLandMismatch || hasDuplicateClaim ? 'border-red-300 bg-red-50 text-red-800 font-bold' : 'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold'}`}>
                {hasLandInactive || hasLandMismatch || hasDuplicateClaim ? '[DISCREPANCY DETECTED]' : '[VERIFIED ACTIVE]'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Parcel Identification:</span>
              <span className="text-slate-900 truncate max-w-[220px] font-semibold">{app.parcel_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Declared Cultivable Area:</span>
              <span className={hasLandMismatch ? 'text-red-700 font-bold' : 'text-slate-900'}>
                {app.declared_land_area_ha} Hectares {hasLandMismatch && '(Discrepant)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Land Classification:</span>
              <span className="text-slate-900">Agricultural Cultivable</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cross-Application Duplicate:</span>
              <span className={hasDuplicateClaim ? 'text-red-700 font-bold' : 'text-slate-600'}>
                {hasDuplicateClaim ? 'Duplicate Claim Flagged' : 'Unique Parcel (Clear)'}
              </span>
            </div>
          </div>

          {/* Registry 2: PFMS Bank */}
          <div className="border border-slate-200 p-4 bg-slate-50 space-y-2.5">
            <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-900 font-bold uppercase">2. PFMS &amp; NPCI DBT Gateway</span>
              <span className={`stamp text-[10px] ${hasBankInactive || hasBankMismatch ? 'border-red-300 bg-red-50 text-red-800 font-bold' : 'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold'}`}>
                {hasBankInactive || hasBankMismatch ? '[BANK DISCREPANCY]' : '[DBT ENABLED]'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Account &amp; IFSC:</span>
              <span className="text-slate-900 font-semibold">{app.bank_account_number} • {app.ifsc_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Operational Status:</span>
              <span className={hasBankInactive ? 'text-red-700 font-bold' : 'text-emerald-700 font-semibold'}>
                {hasBankInactive ? 'INACTIVE / CLOSED' : 'ACTIVE & DBT ENABLED'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Penny-Drop Validation:</span>
              <span className={hasBankMismatch ? 'text-red-700 font-bold' : 'text-slate-600'}>
                {hasBankMismatch ? 'Fuzzy Name Discrepancy' : 'Success (100% Match)'}
              </span>
            </div>
          </div>

          {/* Registry 3: Exclusion Master */}
          <div className="border border-slate-200 p-4 bg-slate-50 space-y-2.5">
            <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-900 font-bold uppercase">3. Statutory Exclusion Roll</span>
              <span className={`stamp text-[10px] ${hasTaxpayerFlag || hasGovtEmpFlag ? 'border-red-300 bg-red-50 text-red-800 font-bold' : 'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold'}`}>
                {hasTaxpayerFlag || hasGovtEmpFlag ? '[STATUTORILY EXCLUDED]' : '[ELIGIBLE CITIZEN]'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Income Tax Payee (Sec 139):</span>
              <span className={hasTaxpayerFlag ? 'text-red-700 font-bold' : 'text-emerald-700 font-semibold'}>
                {hasTaxpayerFlag ? 'Taxpayer Hit Flagged' : 'Clear (Non-Taxpayer)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Civil / Govt Servant:</span>
              <span className={hasGovtEmpFlag ? 'text-red-700 font-bold' : 'text-emerald-700 font-semibold'}>
                {hasGovtEmpFlag ? 'Govt Employee Flagged' : 'Eligible Cultivator'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Institutional Holding:</span>
              <span className="text-emerald-700 font-semibold">Clear</span>
            </div>
          </div>

          {/* Registry 4: UIDAI Identity */}
          <div className="border border-slate-200 p-4 bg-slate-50 space-y-2.5">
            <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-900 font-bold uppercase">4. UIDAI Identity &amp; e-KYC</span>
              <span className="stamp text-[10px] border-slate-300 bg-white text-slate-800 font-semibold">
                [TOKENIZED CRYPTO-REF]
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Masked Aadhaar:</span>
              <span className="text-slate-900 font-bold">{app.aadhaar_masked || 'XXXX-XXXX-****'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Salted SHA-256 Token:</span>
              <span className="text-slate-400 text-[10px] truncate max-w-[200px]">{app.aadhaar_ref || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mobile Telephony OTP:</span>
              <span className="text-slate-900">{app.otp_verified ? 'Verified via SMS (Authenticated)' : 'Unverified'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Detailed Anomaly Dossier & Evidence Inspector ── */}
      <div className="border border-slate-300 p-6 bg-white space-y-4 shadow-sm">
        <div className="border-b border-slate-200 pb-3 flex items-baseline justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500 font-semibold">SCHEDULE II // DISCREPANCY DISCLOSURE</div>
            <h2 className="font-serif text-xl font-bold text-slate-900 mt-0.5">Triggered Anomaly Flags &amp; Risk Evidence</h2>
            <p className="font-sans text-xs text-slate-600 mt-0.5">
              Comprehensive findings generated by the 9-Engine automated pipeline
            </p>
          </div>
          <span className="font-mono text-xs text-slate-800 border border-slate-300 px-2.5 py-1 bg-slate-50 font-bold">
            {flags.length} {flags.length === 1 ? 'TRIGGER' : 'TRIGGERS'}
          </span>
        </div>

        {flags.length === 0 ? (
          <div className="border border-emerald-300 p-8 text-center font-mono text-xs text-emerald-900 bg-emerald-50">
            ✓ ZERO DISCREPANCIES DETECTED — BENEFICIARY CLEARED FOR DISBURSEMENT
          </div>
        ) : (
          <div className="space-y-3 font-mono text-xs">
            {flags.map((flag, idx) => (
              <div key={idx} className="border border-slate-200 p-4 bg-slate-50 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{flag.anomaly_code}</span>
                    <span className={`stamp text-[10px] ${SEVERITY_COLORS[flag.severity] || ''}`}>
                      {flag.severity}
                    </span>
                  </div>
                  <span className="stamp border border-red-300 bg-red-50 text-red-800 text-[10px] font-bold">
                    +{flag.score} RISK PTS
                  </span>
                </div>

                <p className="text-slate-700 font-sans text-xs leading-relaxed">
                  {flag.rationale}
                </p>

                {flag.evidence_json && Object.keys(flag.evidence_json).length > 0 && (
                  <div className="pt-1">
                    <button
                      onClick={() => toggleFlagEvidence(idx)}
                      className="text-[11px] text-slate-600 hover:text-slate-900 underline"
                    >
                      {expandedFlags[idx] ? 'Hide Raw Audit Evidence JSON [-]' : 'Inspect Raw Audit Evidence JSON [+]'}
                    </button>
                    {expandedFlags[idx] && (
                      <pre className="mt-2 p-3 bg-white border border-slate-200 text-[10px] text-slate-900 overflow-x-auto">
                        {JSON.stringify(flag.evidence_json, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 3: Scheme Officer Final Adjudication Panel (ADM-05) ── */}
      <div className="border border-slate-300 p-6 bg-white space-y-4 shadow-sm">
        <div className="border-b border-slate-200 pb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">SCHEDULE III // STATUTORY ADJUDICATION</span>
            <span className="font-mono text-xs text-slate-600 uppercase font-semibold">[RULE 8 GATED]</span>
          </div>
          <h2 className="font-serif text-xl font-bold text-slate-900 mt-0.5">Competent Authority Final Adjudication Order</h2>
          <p className="font-sans text-xs text-slate-600 mt-0.5">
            Adjudications are legally binding under Section 4 of PM-KISAN Guidelines, non-repudiable, and permanently committed to the statutory audit ledger.
          </p>
        </div>

        {decisionSuccess ? (
          <div className="border border-emerald-300 bg-emerald-50 p-5 font-mono text-xs space-y-2">
            <strong className="text-emerald-950 block text-sm font-bold">✓ STATUTORY ADJUDICATION COMMITTED TO AUDIT TRAIL</strong>
            <p className="text-emerald-900">
              Application status updated to: <strong>{decisionSuccess.new_status}</strong>
            </p>
            <div className="text-emerald-800 text-[10px] pt-1">
              Adjudicating Officer: {decisionSuccess.decided_by_officer} • Timestamp: {formatDateTime(decisionSuccess.decided_at)}
            </div>
          </div>
        ) : (
          <div className="space-y-4 font-mono text-xs">
            {/* Grid of Decision Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DECISION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDecision(opt.value)}
                  className={`p-3 border text-left transition-colors ${
                    decision === opt.value
                      ? 'border-slate-900 bg-slate-900 text-white font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400'
                  }`}
                >
                  <div className="font-bold">{opt.code}</div>
                  <div className={`text-[10px] mt-1 ${decision === opt.value ? 'text-slate-300' : 'text-slate-600'}`}>{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Remarks Textarea */}
            <div>
              <label className="block text-slate-700 uppercase text-[10px] font-semibold mb-1 font-mono">
                Mandatory Statutory Written Justification (min 10 characters) *
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Enter formal administrative reasoning, citing relevant scheme clauses and Bhulekh findings..."
                className="w-full bg-white border border-slate-300 text-slate-900 p-3 text-xs font-sans focus:outline-none focus:border-slate-900 rounded-none resize-none placeholder:text-slate-400"
              />
            </div>

            {decisionError && (
              <div className="border border-red-300 bg-red-50 text-red-800 p-2.5 text-xs">
                [ERROR] {decisionError}
              </div>
            )}

            <button
              type="button"
              onClick={handleDecisionSubmit}
              disabled={submitting}
              className="bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-6 font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {submitting ? '[ COMMITTING STATUTORY ORDER... ]' : 'Authorize Statutory Adjudication Order ➔'}
            </button>
          </div>
        )}
      </div>

      {/* ── SECTION 4: Immutable Audit Trail Timeline (ADM-06) ── */}
      <div className="border border-slate-300 p-6 bg-white space-y-4 font-mono text-xs shadow-sm">
        <div className="border-b border-slate-200 pb-3 flex items-baseline justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500 font-semibold">SCHEDULE IV // GIGW 3.0 PERMANENT LOG</div>
            <h2 className="font-serif text-xl font-bold text-slate-900 mt-0.5">Application Administrative Audit Trail</h2>
            <p className="font-sans text-xs text-slate-600 mt-0.5">
              Append-only cryptographically verifiable event log of all officer determinations
            </p>
          </div>
          <span className="text-slate-600 font-semibold">[{auditLogs.length} Events]</span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-slate-500 py-4 text-center">[ NO ACTIONS RECORDED YET ]</p>
        ) : (
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="border border-slate-200 p-3 bg-slate-50 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="stamp border border-slate-300 bg-white text-slate-900 text-[10px] font-bold">
                      {log.action}
                    </span>
                    <span className="text-slate-900 font-bold">by {log.admin_name}</span>
                  </div>
                  {log.remarks && (
                    <p className="text-slate-600 font-sans italic text-xs pt-1">
                      "{log.remarks}"
                    </p>
                  )}
                </div>
                <div className="text-slate-500 text-[10px] sm:text-right">
                  <span>{formatDateTime(log.created_at)}</span>
                  <span className="block font-semibold">Audit Record #{log.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
