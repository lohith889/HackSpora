import { getStatusConfig, formatDate } from '../utils/statusUtils'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPin, Calendar } from 'lucide-react'

export default function ApplicationCard({ app }) {
  const statusCfg = getStatusConfig(app.status)

  return (
    <Link
      to={`/applications/${app.id}`}
      className="card hover:shadow-md transition-shadow duration-200 block group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Application ID + Status */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-mono text-gray-400">APP-{String(app.id).padStart(6, '0')}</span>
            <span className={`status-badge ${statusCfg.color}`}>
              {statusCfg.icon} {statusCfg.label}
            </span>
          </div>

          {/* Farmer & Scheme */}
          <h3 className="font-semibold text-gray-900 truncate">{app.farmer_name}</h3>
          <p className="text-sm text-gov-blue font-medium mt-0.5">{app.scheme_code}</p>

          {/* Parcel ID */}
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate font-mono">{app.parcel_id}</span>
          </div>

          {/* Submitted date */}
          {app.submitted_at && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
              <Calendar className="w-3 h-3" />
              <span>Submitted: {formatDate(app.submitted_at)}</span>
            </div>
          )}

          {/* Citizen message */}
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">{app.citizen_status_message}</p>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gov-blue flex-shrink-0 mt-1 transition-colors" />
      </div>
    </Link>
  )
}
