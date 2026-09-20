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
    <div className={`p-4 sm:p-5 rounded-2xl border transition-all text-left ${
      isAccent
        ? 'border-rose-200 bg-rose-50/60 hover:border-rose-300 shadow-xs'
        : 'border-slate-200/80 bg-white hover:border-emerald-300 hover:shadow-md text-slate-900 shadow-xs'
    }`}>
      <span className={`text-[11px] uppercase tracking-wider block mb-1 font-semibold ${isAccent ? 'text-rose-700' : 'text-slate-500'}`}>
        {label}
      </span>
      <div className={`font-heading text-3xl font-bold tracking-tight ${isAccent ? 'text-rose-700' : 'text-slate-900'}`}>
        {value}
      </div>
      {sub && <span className="text-xs text-slate-500 block mt-1 font-normal">{sub}</span>}
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
          <span className="text-[11px] uppercase tracking-wider text-emerald-800 font-semibold block mb-0.5">
            CENTRAL REGISTRY // TELEMETRY &amp; ADJUDICATION QUEUE REF: PMK-HQ-2026
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Subsidy Anomaly Telemetry &amp; Scrutiny Console
          </h1>
          <p className="text-xs text-slate-600 mt-1 font-normal">
            Automated Cross-Reconciliation against State Bhulekh, PFMS Banking Gateway, and Statutory Exclusion Lists
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
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
            <div className="lg:col-span-5 border border-slate-200/80 bg-white p-5 rounded-2xl shadow-xs">
              <div className="border-b border-slate-100 pb-2 mb-4 flex items-baseline justify-between">
                <h3 className="font-heading text-base font-bold text-slate-900">Risk Tier Stratification</h3>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Multi-Engine</span>
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
                      contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '11px', borderRadius: '8px' }}
                    />
                    <Legend wrapperStyle={{ color: '#475569', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-[11px] text-center">
                <div>
                  <span className="text-slate-500 block text-[10px]">LOW</span>
                  <span className="text-emerald-700 font-bold">{kpi.low}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">MOD</span>
                  <span className="text-amber-700 font-bold">{kpi.moderate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">HIGH/CRIT</span>
                  <span className="text-rose-600 font-bold">{kpi.critical + kpi.high}</span>
                </div>
              </div>
            </div>

            {/* Top Anomaly Flags */}
            <div className="lg:col-span-7 border border-slate-200/80 bg-white p-5 rounded-2xl shadow-xs">
              <div className="border-b border-slate-100 pb-2 mb-4 flex items-baseline justify-between">
                <h3 className="font-heading text-base font-bold text-slate-900">Top Anomaly Triggers</h3>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Frequency Count</span>
              </div>

              {flagFrequency.length === 0 ? (
                <p className="text-xs text-slate-400 py-12 text-center">[ NO FLAGS LOGGED ]</p>
              ) : (
                <div className="space-y-3 text-xs">
                  {flagFrequency.map((f, i) => {
                    const maxCount = Math.max(...flagFrequency.map(x => x.count), 1)
                    const pct = Math.round((f.count / maxCount) * 100)
                    return (
                      <div key={f.code} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-800 font-medium">{f.code}</span>
                          <span className="text-slate-500">{f.count} Claims</span>
                        </div>
                        <div className="w-full bg-slate-100 border border-slate-200/60 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${i === 0 ? 'bg-rose-600' : 'bg-slate-700'}`}
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
          <div className="border border-slate-200/80 bg-white p-5 rounded-2xl shadow-xs">
            <div className="border-b border-slate-100 pb-2 mb-4 flex items-baseline justify-between">
              <h3 className="font-heading text-base font-bold text-slate-900">Geographic Concentration by Revenue District</h3>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Census &amp; Bhulekh Mapping</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {districtConcentration.slice(0, 3).map((d) => (
                <div key={d.district} className="border border-slate-200/70 p-3.5 bg-slate-50/70 rounded-xl text-xs flex justify-between items-baseline">
                  <div>
                    <span className="text-slate-500 uppercase text-[10px] block font-semibold">DISTRICT</span>
                    <strong className="text-slate-900 text-base">{d.district}</strong>
                    <span className="text-slate-400 block mt-0.5">{d.applications} Claims</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 uppercase text-[10px] block font-semibold">AVG RISK</span>
                    <span className={`text-sm font-bold ${d.avgRisk >= 50 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {d.avgRisk} / 100
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={districtConcentration} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="district" stroke="#94a3b8" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#475569', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '11px', borderRadius: '8px' }}
                  />
                  <Bar dataKey="applications" name="Claims" fill="#64748b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgRisk" name="Avg Risk" fill="#b91c1c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Priority Review Queue */}
            <div className="border border-slate-200/80 bg-white p-5 rounded-2xl shadow-xs">
              <div className="border-b border-slate-100 pb-2 mb-4 flex items-baseline justify-between">
                <h3 className="font-heading text-base font-bold text-rose-700">Priority Review Docket (High Risk)</h3>
                <Link to="/admin/applications?min_risk=50" className="text-xs text-slate-500 hover:text-slate-900 underline">
                  View All Flagged →
                </Link>
              </div>

              {recentHighRisk.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">[ NO CRITICAL CLAIMS PENDING ]</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500 uppercase text-[10px] tracking-wider">
                        <th className="py-2 pr-3 font-semibold">Ref ID</th>
                        <th className="py-2 pr-3 font-semibold">Applicant</th>
                        <th className="py-2 pr-3 font-semibold">Score</th>
                        <th className="py-2 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentHighRisk.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 pr-3 text-slate-900 font-semibold font-mono">
                            APP-{String(a.id).padStart(6, '0')}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-700 truncate max-w-[130px]">
                            {a.farmer_name}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="stamp border border-rose-300 bg-rose-50 text-rose-700 font-bold text-[10px] rounded-md px-2 py-0.5">
                              {a.risk_score} / 100
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <Link
                              to={`/admin/applications/${a.id}`}
                              className="border border-slate-200 hover:border-slate-800 text-slate-800 px-2.5 py-1 text-[11px] rounded-lg font-medium transition-colors"
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
            <div className="border border-slate-200/80 bg-white p-5 rounded-2xl shadow-xs">
              <div className="border-b border-slate-100 pb-2 mb-4 flex items-baseline justify-between">
                <h3 className="font-heading text-base font-bold text-slate-900">Immutable Decision Log</h3>
                <Link to="/admin/audit-logs" className="text-xs text-slate-500 hover:text-slate-900 underline">
                  Full Audit Trail →
                </Link>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">[ NO ADJUDICATION LOGS RECORDED ]</p>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {auditLogs.slice(0, 4).map((log) => (
                    <div key={log.id} className="border border-slate-200/70 p-3 bg-slate-50/70 rounded-xl space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-900 font-bold font-mono">APP-{String(log.application_id).padStart(6, '0')}</span>
                        <span className="stamp border border-slate-200 text-slate-800 text-[10px] bg-white rounded-md px-2 py-0.5">
                          {log.action}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] italic truncate">
                        "{log.remarks || 'Official determination recorded'}"
                      </p>
                      <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
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
