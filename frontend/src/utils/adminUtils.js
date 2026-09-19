/**
 * Shared admin utilities — risk tier colours, severity badges, CSV export
 */

export const RISK_TIER = {
  low:    { label: 'Low Risk',      color: 'bg-green-900/40 text-green-300 border border-green-700',   dot: 'bg-green-400'  },
  medium: { label: 'Medium Risk',   color: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700', dot: 'bg-yellow-400' },
  high:   { label: 'High Risk',     color: 'bg-red-900/40 text-red-300 border border-red-700',          dot: 'bg-red-400'    },
  none:   { label: 'No Score',      color: 'bg-gray-800 text-gray-400 border border-gray-700',          dot: 'bg-gray-500'   },
}

export function getRiskTier(score) {
  if (score == null) return RISK_TIER.none
  if (score <= 30)   return RISK_TIER.low
  if (score <= 60)   return RISK_TIER.medium
  return RISK_TIER.high
}

export const SEVERITY_COLORS = {
  Low:      'bg-blue-900/50 text-blue-300 border border-blue-700',
  Medium:   'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  High:     'bg-orange-900/50 text-orange-300 border border-orange-700',
  Critical: 'bg-red-900/60 text-red-200 border border-red-600',
}

export const STATUS_LABELS = {
  SUBMITTED:           { label: 'Submitted',              color: 'bg-blue-900/40 text-blue-300 border border-blue-700' },
  UNDER_REVIEW:        { label: 'Under Review',           color: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700' },
  APPROVED:            { label: 'Approved',               color: 'bg-green-900/40 text-green-300 border border-green-700' },
  REJECTED:            { label: 'Rejected',               color: 'bg-red-900/40 text-red-300 border border-red-700' },
  PAYMENT_HELD:        { label: 'Payment Held',           color: 'bg-orange-900/40 text-orange-300 border border-orange-700' },
  DOCUMENTS_REQUESTED: { label: 'Documents Requested',   color: 'bg-purple-900/40 text-purple-300 border border-purple-700' },
  ESCALATED:           { label: 'Escalated',             color: 'bg-gray-700 text-gray-200 border border-gray-500' },
}

export function getStatusBadge(status) {
  return STATUS_LABELS[status] || { label: status, color: 'bg-gray-800 text-gray-400 border border-gray-700' }
}

export function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Export filtered applications as CSV */
export function exportToCSV(apps) {
  const headers = [
    'App ID', 'Farmer Name', 'Status', 'Risk Score', 'Confidence Level',
    'Recommended Action', 'District', 'Village', 'Parcel ID', 'Submitted At'
  ]
  const rows = apps.map((a) => [
    `APP-${String(a.id).padStart(6, '0')}`,
    `"${a.farmer_name}"`,
    a.status,
    a.risk_score ?? '',
    a.confidence_level ?? '',
    a.recommended_action ?? '',
    a.district_code,
    a.village_code,
    a.parcel_id,
    formatDateTime(a.submitted_at),
  ])
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kisanguard_applications_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
