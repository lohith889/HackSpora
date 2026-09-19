import { useState, useEffect, useMemo } from 'react'
import { adminAPI } from '../../api/client'
import { getRiskTier, getStatusBadge, exportToCSV, formatDateTime } from '../../utils/adminUtils'
import { Link, useSearchParams } from 'react-router-dom'
import Spinner from '../../components/Spinner'
import {
  Search, Download, RefreshCw, Filter, Eye,
  ChevronUp, ChevronDown, X
} from 'lucide-react'

const STATUS_OPTIONS = [
  'SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED',
  'PAYMENT_HELD','DOCUMENTS_REQUESTED','ESCALATED'
]

export default function AdminApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter state (ADM-03)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState(searchParams.get('status') || '')
  const [districtFilter, setDist] = useState('')
  const [minRisk, setMinRisk]     = useState(searchParams.get('min_risk') || '')
  const [maxRisk, setMaxRisk]     = useState('')
  const [sortBy, setSortBy]       = useState('risk_score')
  const [sortDir, setSortDir]     = useState('desc')

  const fetchApps = async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status   = statusFilter
      if (districtFilter) params.district = districtFilter
      if (minRisk) params.min_risk = minRisk
      if (maxRisk) params.max_risk = maxRisk
      const { data } = await adminAPI.listApplications(params)
      setApps(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchApps() }, [statusFilter, districtFilter, minRisk, maxRisk])

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
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
        a.district_code?.toLowerCase().includes(q)
      )
    }
    data.sort((a, b) => {
      let av = a[sortBy] ?? -1
      let bv = b[sortBy] ?? -1
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })
    return data
  }, [apps, search, sortBy, sortDir])

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-400" />
      : <ChevronDown className="w-3 h-3 text-blue-400" />
  }

  const clearFilters = () => {
    setSearch(''); setStatus(''); setDist(''); setMinRisk(''); setMaxRisk('')
  }
  const hasFilters = search || statusFilter || districtFilter || minRisk || maxRisk

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Applications</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {loading ? 'Loading…' : `${filtered.length} of ${apps.length} applications`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchApps} disabled={loading}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => exportToCSV(filtered)}
            className="flex items-center gap-1.5 bg-gov-blue hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters (ADM-03) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3 text-gray-400 text-sm">
          <Filter className="w-4 h-4" /> Filters
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, ID, parcel, district…"
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>
          {/* Status */}
          <select value={statusFilter} onChange={e => setStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
          {/* District */}
          <input value={districtFilter} onChange={e => setDist(e.target.value.toUpperCase())}
            placeholder="District code"
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          />
          {/* Min Risk */}
          <input type="number" value={minRisk} onChange={e => setMinRisk(e.target.value)}
            placeholder="Min risk" min={0} max={100}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          />
          {/* Max Risk */}
          <input type="number" value={maxRisk} onChange={e => setMaxRisk(e.target.value)}
            placeholder="Max risk" min={0} max={100}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          />
        </div>
      </div>

      {/* Table (ADM-03) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-center py-16">No applications match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800">
                <tr className="text-gray-400 text-xs uppercase">
                  {[
                    { key: 'id',          label: 'App ID'    },
                    { key: 'farmer_name', label: 'Farmer'    },
                    { key: 'district_code', label: 'District' },
                    { key: 'risk_score',  label: 'Risk'      },
                    { key: 'status',      label: 'Status'    },
                    { key: 'submitted_at', label: 'Submitted' },
                    { key: null,          label: 'Action'    },
                  ].map(({ key, label }) => (
                    <th key={label}
                      className={`text-left px-4 py-3 ${key ? 'cursor-pointer hover:text-white select-none' : ''}`}
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
              <tbody>
                {filtered.map(a => {
                  const tier = getRiskTier(a.risk_score)
                  const st   = getStatusBadge(a.status)
                  return (
                    <tr key={a.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors group">
                      <td className="px-4 py-3 font-mono text-gray-300 text-xs">
                        APP-{String(a.id).padStart(6,'0')}
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{a.farmer_name}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{a.district_code}</td>
                      <td className="px-4 py-3">
                        {a.risk_score != null ? (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${tier.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                            {a.risk_score}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDateTime(a.submitted_at)}</td>
                      <td className="px-4 py-3">
                        <Link to={`/admin/applications/${a.id}`}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium">
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
    </div>
  )
}
