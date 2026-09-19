import { useState, useEffect, useMemo } from 'react'
import { adminAPI } from '../../api/client'
import { getRiskTier, getStatusBadge, exportToCSV, formatDateTime } from '../../utils/adminUtils'
import { Link } from 'react-router-dom'
import Spinner from '../../components/Spinner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

// Settled light theme chart tokens
const PIE_COLORS = ['#16a34a', '#d97706', '#dc2626']

function KpiBox({ label, value, sub, to, isAccent = false }) {
  const content = (
    <div className={`p-4 border transition-colors text-left shadow-none ${
      isAccent
        ? 'border-red-300 bg-red-50 text-slate-900'
        : 'border-slate-300 bg-white hover:border-slate-700 text-slate-900'
    }`}>
      <span className={`font-mono text-[10px] uppercase tracking-wider block mb-1 font-semibold ${isAccent ? 'text-red-800' : 'text-slate-600'}`}>
        {label}
      </span>
      <div className={`font-mono text-3xl font-bold tracking-tight ${isAccent ? 'text-red-800' : 'text-slate-900'}`}>
        {value}
      </div>
      {sub && <span className="font-mono text-[11px] text-slate-500 block mt-1">{sub}</span>}
    </div>
  )
  return to ? <Link to={to} className="block">{content}</Link> : content
}

export default function AdminDashboardPage() {
  const [apps, setApps] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [appsRes, logsRes] = await Promise.all([
        adminAPI.listApplications(),
        adminAPI.getAuditLogs({ limit: 6 }).catch(() => ({ data: [] })),
      ])
      setApps(appsRes.data || [])
      setAuditLogs(logsRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  // KPI computations
  const kpi = useMemo(() => {
    const total = apps.length
    const critical = apps.filter(a => (a.risk_score ?? 0) >= 75).length
    const high = apps.filter(a => (a.risk_score ?? 0) >= 50 && (a.risk_score ?? 0) < 75).length
    const moderate = apps.filter(a => (a.risk_score ?? 0) >= 25 && (a.risk_score ?? 0) < 50).length
    const low = apps.filter(a => (a.risk_score ?? 0) < 25 && a.risk_score != null).length
    const pending = apps.filter(a => ['SUBMITTED', 'UNDER_REVIEW'].includes(a.status)).length
    return { total, critical, high, moderate, low, pending }
  }, [apps])

  const riskDistData = [
    { name: 'Low (0-24)', value: kpi.low },
    { name: 'Moderate (25-49)', value: kpi.moderate },
    { name: 'Critical/High (≥50)', value: kpi.critical + kpi.high },
  ]

  // Top anomaly codes
  const flagFrequency = useMemo(() => {
    const freq = {}
    apps.forEach(a => (a.anomaly_flags || []).forEach(f => {
      freq[f.anomaly_code] = (freq[f.anomaly_code] || 0) + 1
    }))
    return Object.entries(freq)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 6)
      .map(([code, count]) => ({ code, count }))
  }, [apps])

  // Geographic concentration
  const districtConcentration = useMemo(() => {
    const distMap = {}
    apps.forEach(a => {
      const code = a.district_code || 'OTHER'
      if (!distMap[code]) {
        distMap[code] = { district: code, total: 0, highRisk: 0, avgRiskSum: 0 }
      }
      distMap[code].total += 1
      distMap[code].avgRiskSum += (a.risk_score || 0)
      if ((a.risk_score || 0) >= 50) {
        distMap[code].highRisk += 1
      }
    })

    return Object.values(distMap)
      .map(d => ({
        district: d.district,
        applications: d.total,
        highRisk: d.highRisk,
        avgRisk: Math.round(d.avgRiskSum / d.total),
      }))
      .sort((a, b) => b.applications - a.applications)
  }, [apps])

  // Recent high-risk applications
  const recentHighRisk = useMemo(() =>
    apps.filter(a => (a.risk_score ?? 0) >= 50)
      .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
      .slice(0, 5),
    [apps]
  )

  return (
    <div className="space-y-6 text-left font-sans">
      {/* Header Block */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-800 font-bold block mb-0.5">
            CENTRAL REGISTRY // TELEMETRY &amp; ADJUDICATION QUEUE REF: PMK-HQ-2026
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Subsidy Anomaly Telemetry &amp; Scrutiny Console
          </h1>
          <p className="font-mono text-xs text-slate-600 mt-1">
            Automated Cross-Reconciliation against State Bhulekh, PFMS Banking Gateway, and Statutory Exclusion Lists
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={fetchAll}
            disabled={loading}
            className="btn-secondary"
          >
            {loading ? 'Refreshing...' : 'Reload Telemetry ↻'}
          </button>
          <button
            onClick={() => exportToCSV(apps)}
            className="btn-primary"
          >
            Export Official CSV ({apps.length}) →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-900"><Spinner /></div>
      ) : (
        <>
          {/* Dense KPI Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiBox
              label="01 / Total Claims"
              value={kpi.total}
              sub="Claims in Registry"
              to="/admin/applications"
            />
            <KpiBox
              label="02 / Flagged (≥50)"
              value={kpi.critical + kpi.high}
              sub="High Scrutiny Alert"
              isAccent={true}
              to="/admin/applications?min_risk=50"
            />
            <KpiBox
              label="03 / Moderate (25–49)"
              value={kpi.moderate}
              sub="Verification Warranted"
              to="/admin/applications?min_risk=25&max_risk=49"
            />
            <KpiBox
              label="04 / Low Risk (0–24)"
              value={kpi.low}
              sub="Zero Discrepancy"
              to="/admin/applications?max_risk=24"
            />
            <KpiBox
              label="05 / Pending Review"
              value={kpi.pending}
              sub="Awaiting Determination"
              to="/admin/applications?status=SUBMITTED"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Pie: Risk Distribution */}
            <div className="lg:col-span-5 border border-paper-line bg-white p-5">
              <div className="border-b border-paper-line pb-2 mb-4 flex items-baseline justify-between">
                <h3 className="font-serif text-base font-bold text-ink">Risk Tier Stratification</h3>
                <span className="font-mono text-[10px] text-ink-faint uppercase font-semibold">Multi-Engine</span>
              </div>

              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskDistData}
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={40}
                      dataKey="value"
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {riskDistData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '11px', fontFamily: 'monospace' }}
                    />
                    <Legend wrapperStyle={{ color: '#475569', fontSize: '11px', fontFamily: 'monospace' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 pt-3 border-t border-paper-line grid grid-cols-3 gap-2 font-mono text-[11px] text-center">
                <div>
                  <span className="text-ink-muted block text-[10px]">LOW</span>
                  <span className="text-emerald-700 font-bold">{kpi.low}</span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px]">MOD</span>
                  <span className="text-amber-700 font-bold">{kpi.moderate}</span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px]">HIGH/CRIT</span>
                  <span className="text-accent font-bold">{kpi.critical + kpi.high}</span>
                </div>
              </div>
            </div>

            {/* Top Anomaly Flags */}
            <div className="lg:col-span-7 border border-paper-line bg-white p-5">
              <div className="border-b border-paper-line pb-2 mb-4 flex items-baseline justify-between">
                <h3 className="font-serif text-base font-bold text-ink">Top Anomaly Triggers</h3>
                <span className="font-mono text-[10px] text-ink-faint uppercase font-semibold">Frequency Count</span>
              </div>

              {flagFrequency.length === 0 ? (
                <p className="font-mono text-xs text-ink-faint py-12 text-center">[ NO FLAGS LOGGED ]</p>
              ) : (
                <div className="space-y-3 font-mono text-xs">
                  {flagFrequency.map((f, i) => {
                    const maxCount = Math.max(...flagFrequency.map(x => x.count), 1)
                    const pct = Math.round((f.count / maxCount) * 100)
                    return (
                      <div key={f.code} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-ink font-semibold">{f.code}</span>
                          <span className="text-ink-muted">{f.count} Claims</span>
                        </div>
                        <div className="w-full bg-paper-subtle border border-paper-line h-2">
                          <div
                            className={`h-2 ${i === 0 ? 'bg-accent' : 'bg-slate-700'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* District Concentration */}
          <div className="border border-paper-line bg-white p-5">
            <div className="border-b border-paper-line pb-2 mb-4 flex items-baseline justify-between">
              <h3 className="font-serif text-base font-bold text-ink">Geographic Concentration by Revenue District</h3>
              <span className="font-mono text-[10px] text-ink-faint uppercase font-semibold">Census &amp; Bhulekh Mapping</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {districtConcentration.slice(0, 3).map((d) => (
                <div key={d.district} className="border border-paper-line p-3 bg-paper-subtle font-mono text-xs flex justify-between items-baseline">
                  <div>
                    <span className="text-ink-muted uppercase text-[10px] block font-semibold">DISTRICT</span>
                    <strong className="text-ink text-base">{d.district}</strong>
                    <span className="text-ink-faint block mt-0.5">{d.applications} Claims</span>
                  </div>
                  <div className="text-right">
                    <span className="text-ink-muted uppercase text-[10px] block font-semibold">AVG RISK</span>
                    <span className={`text-sm font-bold ${d.avgRisk >= 50 ? 'text-accent' : 'text-ink'}`}>
                      {d.avgRisk} / 100
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={districtConcentration} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="district" stroke="#94a3b8" tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '11px', fontFamily: 'monospace' }}
                  />
                  <Bar dataKey="applications" name="Claims" fill="#64748b" />
                  <Bar dataKey="avgRisk" name="Avg Risk" fill="#b91c1c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Priority Review Queue */}
            <div className="border border-paper-line bg-white p-5">
              <div className="border-b border-paper-line pb-2 mb-4 flex items-baseline justify-between">
                <h3 className="font-serif text-base font-bold text-accent">Priority Review Docket (High Risk)</h3>
                <Link to="/admin/applications?min_risk=50" className="font-mono text-xs text-ink-muted hover:text-ink underline">
                  View All Flagged →
                </Link>
              </div>

              {recentHighRisk.length === 0 ? (
                <p className="font-mono text-xs text-ink-faint py-8 text-center">[ NO CRITICAL CLAIMS PENDING ]</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-paper-line text-ink-muted uppercase text-[10px] tracking-wider">
                        <th className="py-2 pr-3 font-semibold">Ref ID</th>
                        <th className="py-2 pr-3 font-semibold">Applicant</th>
                        <th className="py-2 pr-3 font-semibold">Score</th>
                        <th className="py-2 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-paper-line">
                      {recentHighRisk.map((a) => (
                        <tr key={a.id} className="hover:bg-paper-subtle transition-colors">
                          <td className="py-2.5 pr-3 text-ink font-semibold">
                            APP-{String(a.id).padStart(6, '0')}
                          </td>
                          <td className="py-2.5 pr-3 text-ink-muted font-sans truncate max-w-[130px]">
                            {a.farmer_name}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="stamp border border-accent-border bg-accent-subtle text-accent font-bold text-[10px]">
                              {a.risk_score} / 100
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <Link
                              to={`/admin/applications/${a.id}`}
                              className="border border-paper-strong hover:border-ink text-ink px-2 py-1 text-[11px] uppercase tracking-wider"
                            >
                              Inspect →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Officer Adjudications Feed */}
            <div className="border border-paper-line bg-white p-5">
              <div className="border-b border-paper-line pb-2 mb-4 flex items-baseline justify-between">
                <h3 className="font-serif text-base font-bold text-ink">Immutable Decision Log</h3>
                <Link to="/admin/audit-logs" className="font-mono text-xs text-ink-muted hover:text-ink underline">
                  Full Audit Trail →
                </Link>
              </div>

              {auditLogs.length === 0 ? (
                <p className="font-mono text-xs text-ink-faint py-8 text-center">[ NO ADJUDICATION LOGS RECORDED ]</p>
              ) : (
                <div className="space-y-2.5 font-mono text-xs">
                  {auditLogs.slice(0, 4).map((log) => (
                    <div key={log.id} className="border border-paper-line p-3 bg-paper-subtle space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-ink font-bold">APP-{String(log.application_id).padStart(6, '0')}</span>
                        <span className="stamp border border-paper-strong text-ink text-[10px] bg-white">
                          {log.action}
                        </span>
                      </div>
                      <p className="text-ink-muted text-[11px] font-sans italic truncate">
                        "{log.remarks || 'Official determination recorded'}"
                      </p>
                      <div className="flex justify-between text-[10px] text-ink-faint pt-0.5">
                        <span>By: {log.admin_name || `Officer #${log.admin_id}`}</span>
                        <span>{formatDateTime(log.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
