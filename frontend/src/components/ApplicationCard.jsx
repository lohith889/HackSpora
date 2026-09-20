import { getStatusConfig, formatDate } from '../utils/statusUtils'
import { Link } from 'react-router-dom'

export default function ApplicationCard({ app }) {
  const statusCfg = getStatusConfig(app.status)

  return (
    <Link
      to={`/applications/${app.id}`}
      className="block border border-slate-200 hover:border-emerald-400 hover:shadow-md bg-white p-5 rounded-2xl transition-all group"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <span className="text-xs font-semibold text-slate-700 tracking-wide">
              APP-{String(app.id).padStart(6, '0')}
            </span>
            <span className={`stamp text-[10px] font-semibold rounded-full px-2.5 py-0.5 ${statusCfg.badge}`}>
              {statusCfg.code} {statusCfg.label}
            </span>
            <span className="text-xs text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-full bg-slate-50 font-medium">
              {app.scheme_code || 'PM-KISAN'}
            </span>
          </div>

          <h3 className="text-lg font-heading font-bold text-slate-900 truncate mt-1">
            {app.farmer_name}
          </h3>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-2 text-xs text-slate-600">
            <span>Parcel ID: <strong className="text-slate-800 font-medium">{app.parcel_id || '—'}</strong></span>
            {app.submitted_at && (
              <span>Lodged: <strong className="text-slate-800 font-medium">{formatDate(app.submitted_at)}</strong></span>
            )}
            <span>District: <strong className="text-slate-800 font-medium">{app.state_code || '—'} / {app.district_code || '—'}</strong></span>
          </div>

          <div className="mt-3.5 text-xs text-slate-700 leading-relaxed max-w-2xl border-l-2 border-emerald-600 pl-3.5 bg-slate-50/80 rounded-r-xl py-2.5 pr-3 font-sans">
            <strong className="text-slate-900 font-semibold block mb-0.5 text-[11px]">
              Current Administrative Status:
            </strong>
            {app.citizen_status_message}
          </div>
        </div>

        <div className="flex items-center text-xs text-slate-600 group-hover:text-emerald-800 transition-colors self-start sm:self-center font-semibold border border-slate-200 group-hover:border-emerald-300 px-3.5 py-2 rounded-xl bg-slate-50 group-hover:bg-emerald-50/60 shadow-xs">
          <span>Inspect Docket</span>
          <span className="ml-1.5 text-base leading-none group-hover:translate-x-0.5 transition-transform">→</span>
        </div>
      </div>
    </Link>
  )
}
