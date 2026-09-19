import { getStatusConfig, formatDate } from '../utils/statusUtils'
import { Link } from 'react-router-dom'

export default function ApplicationCard({ app }) {
  const statusCfg = getStatusConfig(app.status)

  return (
    <Link
      to={`/applications/${app.id}`}
      className="block border border-slate-300 hover:border-slate-800 bg-white p-5 transition-colors group shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="font-mono text-xs font-bold text-slate-900 uppercase tracking-wider">
              DOSSIER REF: APP-{String(app.id).padStart(6, '0')}
            </span>
            <span className={`stamp text-[10px] font-bold ${statusCfg.badge}`}>
              {statusCfg.code} {statusCfg.label}
            </span>
            <span className="font-mono text-xs text-slate-500 border border-slate-200 px-2 py-0.5 bg-slate-50">
              {app.scheme_code || 'PM_KISAN'}
            </span>
          </div>

          <h3 className="text-lg font-serif font-bold text-slate-900 truncate mt-1">
            {app.farmer_name}
          </h3>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-2 font-mono text-xs text-slate-600">
            <span>BHULEKH PARCEL: <strong className="text-slate-900">{app.parcel_id || '—'}</strong></span>
            {app.submitted_at && (
              <span>LODGED: <strong className="text-slate-900">{formatDate(app.submitted_at)}</strong></span>
            )}
            <span>STATE / DIST: <strong className="text-slate-900">{app.state_code || '—'} / {app.district_code || '—'}</strong></span>
          </div>

          <div className="mt-3 text-xs text-slate-700 leading-relaxed max-w-2xl border-l-2 border-slate-800 pl-3 bg-slate-50 py-2 pr-3 font-sans">
            <strong className="text-slate-900 font-semibold block mb-0.5 font-mono text-[11px] uppercase">
              Current Administrative Status:
            </strong>
            {app.citizen_status_message}
          </div>
        </div>

        <div className="flex items-center text-xs font-mono uppercase tracking-wider text-slate-600 group-hover:text-slate-900 transition-colors self-start sm:self-center font-bold border border-slate-200 px-3 py-1.5 bg-slate-50 group-hover:bg-slate-100">
          <span>Inspect Docket</span>
          <span className="ml-1 text-base leading-none">→</span>
        </div>
      </div>
    </Link>
  )
}
