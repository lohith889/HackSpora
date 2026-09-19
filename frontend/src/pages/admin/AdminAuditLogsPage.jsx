import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { adminAPI } from '../../api/client'
import { formatDateTime } from '../../utils/adminUtils'
import Spinner from '../../components/Spinner'
import {
  ClipboardList, Search, Filter, RefreshCw, Eye,
  CheckCircle2, XCircle, PauseCircle, HelpCircle, AlertCircle, ShieldAlert
} from 'lucide-react'

const ACTION_CONFIG = {
  APPROVE:           { label: 'Approved',          color: 'bg-green-900/40 text-green-300 border-green-700/60',   icon: CheckCircle2 },
  REJECT:            { label: 'Rejected',          color: 'bg-red-900/40 text-red-300 border-red-700/60',         icon: XCircle },
  HOLD:              { label: 'Payment Held',      color: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/60', icon: PauseCircle },
  REQUEST_DOCUMENTS: { label: 'Doc Requested',     color: 'bg-purple-900/40 text-purple-300 border-purple-700/60', icon: HelpCircle },
  ESCALATE:          { label: 'Escalated',         color: 'bg-blue-900/40 text-blue-300 border-blue-700/60',     icon: AlertCircle },
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const { data } = await adminAPI.getAuditLogs()
      setLogs(data)
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        !search ||
        String(log.application_id).includes(search) ||
        (log.admin_name && log.admin_name.toLowerCase().includes(search.toLowerCase())) ||
        (log.remarks && log.remarks.toLowerCase().includes(search.toLowerCase()))
      const matchAction = !actionFilter || log.action === actionFilter
      return matchSearch && matchAction
    })
  }, [logs, search, actionFilter])

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Audit Trail &amp; Decision Logs</h1>
            <span className="bg-red-950 text-red-300 border border-red-800 text-xs px-2.5 py-0.5 rounded-full font-mono">
              Immutable Ledger
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Permanent compliance log of all Scheme Officer adjudication actions, justifications, and timestamps.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-800 px-3 py-2 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Log
        </button>
      </div>

      {/* Info Callout */}
      <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-4 mb-5 flex items-start gap-3 text-xs text-blue-200">
        <ShieldAlert className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Regulatory Transparency &amp; Anti-Corruption Protocol:</strong>
          {' '}Every action taken on a subsidy application is cryptographically sealed in the{' '}
          <code className="bg-blue-900/60 px-1.5 py-0.5 rounded text-blue-300 font-mono">audit_logs</code>
          {' '}table. Neither officers nor automated background processes can alter or delete logged adjudications.
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by App ID, Officer, Remarks…"
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
          >
            <option value="">All Officer Actions</option>
            <option value="APPROVE">Approved</option>
            <option value="REJECT">Rejected</option>
            <option value="HOLD">Payment Held</option>
            <option value="REQUEST_DOCUMENTS">Documents Requested</option>
            <option value="ESCALATE">Escalated</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <ClipboardList className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No audit log entries matched your filter.</p>
            <p className="text-gray-600 text-xs mt-1">Actions taken by officers in the review console will appear here in real time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-950/60 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Log ID</th>
                  <th className="text-left px-4 py-3">Application Ref</th>
                  <th className="text-left px-4 py-3">Officer Name</th>
                  <th className="text-left px-4 py-3">Decision Action</th>
                  <th className="text-left px-4 py-3">Mandatory Officer Justification</th>
                  <th className="text-left px-4 py-3">Timestamp (IST)</th>
                  <th className="text-center px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filtered.map((log) => {
                  const cfg = ACTION_CONFIG[log.action] || {
                    label: log.action,
                    color: 'bg-gray-800 text-gray-300 border-gray-700',
                    icon: AlertCircle,
                  }
                  const Icon = cfg.icon

                  return (
                    <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-gray-400">
                        #{log.id}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-blue-300 font-medium">
                        APP-{String(log.application_id).padStart(6, '0')}
                      </td>
                      <td className="px-4 py-3 text-white text-xs font-medium">
                        {log.admin_name || `Officer #${log.admin_id}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs max-w-md break-words leading-relaxed">
                        {log.remarks || <span className="text-gray-600 italic">No remarks provided</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap font-mono">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/admin/applications/${log.application_id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/50 px-2.5 py-1 rounded transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Dossier
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
    </div>
  )
}
