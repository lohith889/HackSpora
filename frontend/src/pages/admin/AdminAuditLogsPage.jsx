import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { adminAPI } from '../../api/client'
import { formatDateTime } from '../../utils/adminUtils'
import Spinner from '../../components/Spinner'

const ACTION_CONFIG = {
  APPROVE:           { label: 'APPROVED',       badge: 'border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold' },
  REJECT:            { label: 'REJECTED',       badge: 'border border-red-300 bg-red-50 text-red-800 font-bold' },
  HOLD:              { label: 'PAYMENT HELD',   badge: 'border border-amber-400 bg-amber-50 text-amber-900 font-bold' },
  REQUEST_DOCUMENTS: { label: 'DOCS REQUESTED', badge: 'border border-slate-400 bg-slate-100 text-slate-900 font-bold' },
  ESCALATE:          { label: 'ESCALATED',      badge: 'border border-rose-300 bg-rose-50 text-rose-900 font-bold' },
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
    <div className="space-y-6 text-left font-sans">
      {/* Masthead Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              FORM AUD-09 // STATUTORY AUDIT REGISTER
            </span>
            <span className="stamp border border-slate-300 bg-slate-100 text-slate-700 text-[10px] font-semibold">
              IMMUTABLE
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-serif mt-1">
            Central Adjudication Event Register &amp; Statutory Audit Trail
          </h1>
          <p className="text-slate-600 text-xs mt-0.5 font-sans">
            Cryptographically permanent audit records of Scheme Officer adjudications, statutory written justifications, and non-repudiable timestamps.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 px-3.5 py-2 uppercase tracking-wider font-semibold transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh Register ↻'}
          </button>
        </div>
      </div>

      {/* Protocol Banner */}
      <div className="border border-slate-300 bg-slate-50 p-4 font-mono text-xs text-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-sm">
        <div>
          <strong className="text-slate-900 font-bold uppercase">ANTI-CORRUPTION &amp; GIGW 3.0 PROTOCOL:</strong>{' '}
          All determinations are cryptographically committed to an append-only log. Modification or deletion by administrative personnel is technically barred.
        </div>
        <div className="text-slate-500 text-[11px] whitespace-nowrap">
          TOTAL ENTRIES: <span className="text-slate-900 font-bold">{logs.length}</span> | FILTERED: <span className="text-slate-900 font-bold">{filtered.length}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="border border-slate-200 bg-white p-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-80 font-mono text-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by App ID, Officer, Remarks..."
            className="w-full bg-white border border-slate-300 text-slate-900 p-2 text-xs focus:outline-none focus:border-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto font-mono text-xs">
          <span className="text-slate-500 uppercase text-[10px] font-semibold">Filter Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-white border border-slate-300 text-slate-900 p-2 text-xs focus:outline-none focus:border-slate-800 w-full sm:w-auto"
          >
            <option value="">ALL STATUTORY ACTIONS</option>
            <option value="APPROVE">APPROVED ENTITLEMENT</option>
            <option value="REJECT">REJECTED CLAIM</option>
            <option value="HOLD">PAYMENT HELD</option>
            <option value="REQUEST_DOCUMENTS">REVENUE PROOF REQUESTED</option>
            <option value="ESCALATE">ESCALATED TO VIGILANCE</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="border border-slate-300 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-900">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center font-mono text-xs text-slate-500">
            [ NO AUDIT LOG RECORDS MATCHED THE FILTER PARAMETERS ]
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">Log Ref</th>
                  <th className="px-4 py-3 font-semibold">Application Dossier</th>
                  <th className="px-4 py-3 font-semibold">Adjudicating Authority</th>
                  <th className="px-4 py-3 font-semibold">Determination</th>
                  <th className="px-4 py-3 font-semibold">Statutory Written Justification</th>
                  <th className="px-4 py-3 font-semibold">Timestamp (IST)</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
                {filtered.map((log) => {
                  const cfg = ACTION_CONFIG[log.action] || {
                    label: log.action,
                    badge: 'border border-slate-300 text-slate-700 bg-slate-50',
                  }

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 font-semibold">
                        #{String(log.id).padStart(4, '0')}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        APP-{String(log.application_id).padStart(6, '0')}
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-sans font-medium">
                        {log.admin_name || `Officer #${log.admin_id}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[10px] tracking-wider uppercase font-semibold ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-sans max-w-md break-words leading-relaxed text-xs">
                        {log.remarks || <span className="text-slate-400 italic">No justification text entered</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link
                          to={`/admin/applications/${log.application_id}`}
                          className="border border-slate-300 hover:border-slate-800 bg-white px-2.5 py-1 text-[11px] text-slate-800 font-semibold uppercase tracking-wider inline-block"
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
      </div>
    </div>
  )
}
