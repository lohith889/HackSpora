import { useState, useEffect, useMemo } from 'react'
import { adminAPI } from '../../api/client'
import { getRiskTier, getStatusBadge, exportToCSV, formatDateTime } from '../../utils/adminUtils'
import { Link, useNavigate } from 'react-router-dom'
import Spinner from '../../components/Spinner'
import {
  ShieldAlert, Users, AlertTriangle, CheckCircle, Clock,
  BarChart2, TrendingUp, Search, Download, RefreshCw,
  ChevronRight, Filter, Eye, MapPin, ClipboardList, ShieldCheck,
  CheckCircle2, XCircle, ArrowUpRight
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const PIE_COLORS = ['#22c55e', '#eab308', '#ef4444']

function KpiCard({ label, value, icon: Icon, color, sub, to }) {
  const content = (
    <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 flex items-start justify-between gap-4 transition-all hover:bg-gray-850 group">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${color} flex-shrink-0 shadow-md`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-gray-400 text-sm font-medium">{label}</p>
          <p className="text-2xl font-bold text-white mt-0.5 font-mono">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
      </div>
      {to && (
        <span className="text-gray-600 group-hover:text-blue-400 transition-colors">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      )}
    </div>
  )

  return to ? <Link to={to} className="block">{content}</Link> : content
}

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const [apps, setApps] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

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

  const fetchMetrics = async () => {
    setMetricsLoading(true)
    try {
      const { data } = await adminAPI.evaluationMetrics()
      setMetrics(data)
    } catch (e) {
      console.error(e)
    } finally {
      setMetricsLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  // ── KPI computations ─────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const total = apps.length
    const high   = apps.filter(a => (a.risk_score ?? 0) > 60).length
    const medium = apps.filter(a => (a.risk_score ?? 0) > 30 && (a.risk_score ?? 0) <= 60).length
    const low    = apps.filter(a => (a.risk_score ?? 0) <= 30 && a.risk_score != null).length
    const pending = apps.filter(a => ['SUBMITTED', 'UNDER_REVIEW'].includes(a.status)).length
    return { total, high, medium, low, pending }
  }, [apps])

  const riskDistData = [
    { name: 'Low Risk (≤30)',    value: kpi.low    },
    { name: 'Medium Risk (31-60)', value: kpi.medium },
    { name: 'High Risk (>60)',   value: kpi.high   },
  ]

  // Top anomaly codes
  const flagFrequency = useMemo(() => {
    const freq = {}
    apps.forEach(a => (a.anomaly_flags || []).forEach(f => {
      freq[f.anomaly_code] = (freq[f.anomaly_code] || 0) + 1
    }))
    return Object.entries(freq)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 8)
      .map(([code, count]) => ({ code: code.replace(/_/g, ' '), count }))
  }, [apps])

  // Geographic concentration (ADM-02)
  const districtConcentration = useMemo(() => {
    const distMap = {}
    apps.forEach(a => {
      const code = a.district_code || 'OTHER'
      if (!distMap[code]) {
        distMap[code] = { district: code, total: 0, highRisk: 0, avgRiskSum: 0 }
      }
      distMap[code].total += 1
      distMap[code].avgRiskSum += (a.risk_score || 0)
      if ((a.risk_score || 0) > 60) {
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
    apps.filter(a => (a.risk_score ?? 0) > 60)
      .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
      .slice(0, 5),
    [apps]
  )

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Scheme Officer Overview Dashboard</h1>
            <span className="bg-red-950 text-red-300 border border-red-800 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
              Live AI Monitor
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-0.5">
            Real-time subsidy anomaly telemetry, risk concentrations, and officer review queues.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => exportToCSV(apps)}
            className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors shadow-md"
          >
            <Download className="w-4 h-4" /> Export CSV ({apps.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : (
        <>
          {/* KPI Cards (ADM-01) with Direct Filtering Routes */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
            <KpiCard
              label="Total Applications"
              value={kpi.total}
              icon={Users}
              color="bg-blue-700"
              to="/admin/applications"
            />
            <KpiCard
              label="Critical / High Risk"
              value={kpi.high}
              icon={ShieldAlert}
              color="bg-red-700"
              sub="Score > 60"
              to="/admin/applications?min_risk=61"
            />
            <KpiCard
              label="Medium Risk"
              value={kpi.medium}
              icon={AlertTriangle}
              color="bg-yellow-600"
              sub="Score 31–60"
              to="/admin/applications?min_risk=31&max_risk=60"
            />
            <KpiCard
              label="Low Risk (Clean)"
              value={kpi.low}
              icon={CheckCircle}
              color="bg-green-700"
              sub="Score ≤ 30"
              to="/admin/applications?max_risk=30"
            />
            <KpiCard
              label="Pending Adjudication"
              value={kpi.pending}
              icon={Clock}
              color="bg-purple-700"
              sub="Requires Officer Decision"
              to="/admin/applications?status=SUBMITTED"
            />
          </div>

          {/* Charts Row: Risk Distribution + Top Anomaly Codes (ADM-02) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            {/* Pie: Risk Distribution */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-400" />
                  Applicant Risk Tier Distribution (0-100)
                </h3>
                <span className="text-xs text-gray-500 font-mono">Weighted Multi-Engine</span>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={riskDistData}
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    dataKey="value"
                    label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {riskDistData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', color: '#fff', borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar: Top Triggered Anomaly Flags */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-400" />
                  Top Triggered Anomaly Flags
                </h3>
                <span className="text-xs text-gray-500 font-mono">Frequency Count</span>
              </div>
              {flagFrequency.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-12">No anomaly flags recorded yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={flagFrequency} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis type="category" dataKey="code" tick={{ fill: '#9ca3af', fontSize: 10 }} width={140} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', color: '#fff', borderRadius: '8px' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Geographic Concentration (District-level) (ADM-02) */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                Geographic Risk Concentration (By District)
              </h3>
              <span className="text-xs text-gray-500 font-mono">Applications &amp; Avg Risk Score</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {districtConcentration.slice(0, 3).map((d) => (
                <div key={d.district} className="bg-gray-800/60 border border-gray-800 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-400 font-mono uppercase">District {d.district}</span>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">{d.applications} Claims</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-gray-500">Avg Risk</span>
                    <p className={`text-sm font-bold font-mono ${d.avgRisk > 50 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {d.avgRisk}/100
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={districtConcentration} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="district" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', color: '#fff', borderRadius: '8px' }} />
                <Bar dataKey="applications" name="Total Applications" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgRisk" name="Avg Risk Score" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Row: Recent High Risk + Live Audit Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            {/* Recent High-Risk Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  Priority Review Queue (High Risk)
                </h3>
                <Link
                  to="/admin/applications?min_risk=61"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {recentHighRisk.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No high-risk claims currently pending.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500 text-[11px] uppercase tracking-wider">
                        <th className="text-left py-2 pr-3">Ref</th>
                        <th className="text-left py-2 pr-3">Applicant</th>
                        <th className="text-left py-2 pr-3">Risk</th>
                        <th className="text-left py-2 pr-3">Status</th>
                        <th className="text-right py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40">
                      {recentHighRisk.map((a) => {
                        const tier = getRiskTier(a.risk_score)
                        const st = getStatusBadge(a.status)
                        return (
                          <tr key={a.id} className="hover:bg-gray-800/30 transition-colors">
                            <td className="py-2.5 pr-3 font-mono text-xs text-blue-300">
                              APP-{String(a.id).padStart(6, '0')}
                            </td>
                            <td className="py-2.5 pr-3 text-white text-xs font-medium max-w-[130px] truncate">
                              {a.farmer_name}
                            </td>
                            <td className="py-2.5 pr-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${tier.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                                {a.risk_score}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>
                                {st.label}
                              </span>
                            </td>
                            <td className="py-2.5 text-right">
                              <Link
                                to={`/admin/applications/${a.id}`}
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium bg-blue-950/40 px-2 py-1 rounded border border-blue-800/40"
                              >
                                <Eye className="w-3 h-3" /> Dossier
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Officer Adjudications Feed (ADM-06) */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-purple-400" />
                  Recent Scheme Officer Adjudications
                </h3>
                <Link
                  to="/admin/audit-logs"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  Full Audit Log <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No officer adjudications recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.slice(0, 4).map((log) => (
                    <div key={log.id} className="bg-gray-800/60 border border-gray-800 rounded-lg p-3 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-blue-300 font-medium">
                            APP-{String(log.application_id).padStart(6, '0')}
                          </span>
                          <span className="bg-gray-700 px-2 py-0.5 rounded text-white font-semibold text-[10px]">
                            {log.action}
                          </span>
                        </div>
                        <span className="text-gray-500 text-[10px] font-mono">
                          {formatDateTime(log.created_at)}
                        </span>
                      </div>
                      <p className="text-gray-300 line-clamp-1 italic">
                        "{log.remarks || 'No justification entered'}"
                      </p>
                      <p className="text-gray-500 text-[10px] mt-1">
                        Decided by: <span className="text-gray-300">{log.admin_name || `Officer #${log.admin_id}`}</span>
                      </p>
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
