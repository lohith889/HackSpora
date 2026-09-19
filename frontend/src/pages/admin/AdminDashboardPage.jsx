import { useState, useEffect, useMemo } from 'react'
import { adminAPI } from '../../api/client'
import { getRiskTier, getStatusBadge, exportToCSV, formatDateTime } from '../../utils/adminUtils'
import { Link } from 'react-router-dom'
import Spinner from '../../components/Spinner'
import {
  ShieldAlert, Users, AlertTriangle, CheckCircle, Clock,
  BarChart2, TrendingUp, Search, Download, RefreshCw,
  ChevronRight, Filter, Eye
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const PIE_COLORS = ['#22c55e', '#eab308', '#ef4444']

function KpiCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color} flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const { data } = await adminAPI.listApplications()
      setApps(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const fetchMetrics = async () => {
    setMetricsLoading(true)
    try {
      const { data } = await adminAPI.evaluationMetrics()
      setMetrics(data)
    } catch (e) { console.error(e) }
    finally { setMetricsLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  // ── KPI computations ─────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const total = apps.length
    const high   = apps.filter(a => (a.risk_score ?? 0) > 60).length
    const medium = apps.filter(a => (a.risk_score ?? 0) > 30 && (a.risk_score ?? 0) <= 60).length
    const low    = apps.filter(a => (a.risk_score ?? 0) <= 30 && a.risk_score != null).length
    const pending = apps.filter(a => ['SUBMITTED','UNDER_REVIEW'].includes(a.status)).length
    return { total, high, medium, low, pending }
  }, [apps])

  const riskDistData = [
    { name: 'Low Risk',    value: kpi.low    },
    { name: 'Medium Risk', value: kpi.medium },
    { name: 'High Risk',   value: kpi.high   },
  ]

  // Top anomaly codes
  const flagFrequency = useMemo(() => {
    const freq = {}
    apps.forEach(a => (a.anomaly_flags || []).forEach(f => {
      freq[f.anomaly_code] = (freq[f.anomaly_code] || 0) + 1
    }))
    return Object.entries(freq)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 8)
      .map(([code, count]) => ({ code: code.replace(/_/g,' '), count }))
  }, [apps])

  // Recent high-risk
  const recentHighRisk = useMemo(() =>
    apps.filter(a => (a.risk_score ?? 0) > 60)
      .sort((a,b) => (b.risk_score??0) - (a.risk_score??0))
      .slice(0, 5),
    [apps]
  )

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">PM-KISAN Anomaly Detection Summary</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} disabled={loading}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => exportToCSV(apps)}
            className="flex items-center gap-1.5 bg-gov-blue hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : (
        <>
          {/* KPI Cards (ADM-01) */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <KpiCard label="Total Applications" value={kpi.total} icon={Users} color="bg-blue-700" />
            <KpiCard label="High Risk"  value={kpi.high}   icon={ShieldAlert}   color="bg-red-700"    sub=">60 score" />
            <KpiCard label="Medium Risk" value={kpi.medium} icon={AlertTriangle} color="bg-yellow-600" sub="31–60 score" />
            <KpiCard label="Low Risk"    value={kpi.low}    icon={CheckCircle}   color="bg-green-700"  sub="≤30 score" />
            <KpiCard label="Pending Review" value={kpi.pending} icon={Clock} color="bg-purple-700" sub="Need action" />
          </div>

          {/* Charts row (ADM-02) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Pie: Risk Distribution */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-gray-400" /> Risk Distribution
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={riskDistData} cx="50%" cy="50%" outerRadius={80}
                    dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                    labelLine={false}>
                    {riskDistData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', color: '#fff' }} />
                  <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar: Top Anomaly Codes */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-400" /> Top Anomaly Flags
              </h3>
              {flagFrequency.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-10">No anomaly flags recorded yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={flagFrequency} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis type="category" dataKey="code" tick={{ fill: '#9ca3af', fontSize: 10 }} width={130} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', color: '#fff' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Evaluation Metrics */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" /> Pipeline Evaluation Metrics (Precision / Recall / F1)
              </h3>
              {!metrics && (
                <button onClick={fetchMetrics} disabled={metricsLoading}
                  className="bg-red-900/50 hover:bg-red-800 text-red-300 text-sm px-3 py-1.5 rounded-lg transition-colors">
                  {metricsLoading ? 'Loading…' : 'Run Benchmark'}
                </button>
              )}
            </div>
            {metrics ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Precision',  value: `${(metrics.precision * 100).toFixed(1)}%` },
                  { label: 'Recall',     value: `${(metrics.recall    * 100).toFixed(1)}%` },
                  { label: 'F1 Score',   value: `${(metrics.f1_score  * 100).toFixed(1)}%` },
                  { label: 'Accuracy',   value: `${(metrics.accuracy  * 100).toFixed(1)}%` },
                  { label: 'Specificity',value: `${(metrics.specificity* 100).toFixed(1)}%` },
                  { label: 'FPR',        value: `${(metrics.false_positive_rate * 100).toFixed(1)}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs mb-1">{label}</p>
                    <p className="text-white font-bold text-lg">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Click "Run Benchmark" to evaluate the 8-engine pipeline against synthetic ground truth.</p>
            )}
          </div>

          {/* Recent High-Risk Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Recent High-Risk Applications</h3>
              <Link to="/admin/applications?min_risk=61"
                className="text-sm text-gov-blue hover:text-blue-300 flex items-center gap-1">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {recentHighRisk.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No high-risk applications detected yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                      <th className="text-left py-2 pr-4">App ID</th>
                      <th className="text-left py-2 pr-4">Farmer</th>
                      <th className="text-left py-2 pr-4">Risk Score</th>
                      <th className="text-left py-2 pr-4">Status</th>
                      <th className="text-left py-2 pr-4">Submitted</th>
                      <th className="text-left py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentHighRisk.map(a => {
                      const tier = getRiskTier(a.risk_score)
                      const st   = getStatusBadge(a.status)
                      return (
                        <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="py-3 pr-4 font-mono text-gray-300">APP-{String(a.id).padStart(6,'0')}</td>
                          <td className="py-3 pr-4 text-white">{a.farmer_name}</td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${tier.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                              {a.risk_score}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                          </td>
                          <td className="py-3 pr-4 text-gray-400">{formatDateTime(a.submitted_at)}</td>
                          <td className="py-3">
                            <Link to={`/admin/applications/${a.id}`}
                              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs">
                              <Eye className="w-3.5 h-3.5" /> Review
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
        </>
      )}
    </div>
  )
}
