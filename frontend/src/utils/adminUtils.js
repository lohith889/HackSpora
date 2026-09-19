/**
 * Shared admin utilities — Settled light theme design tokens
 * Crisp readable contrast. No glow, no dark violet.
 */

export const RISK_TIER = {
  low: {
    label: 'Low Risk',
    color: 'border border-emerald-300 bg-emerald-50 text-emerald-900 font-medium',
    dot: 'bg-emerald-600',
    indicator: 'LOW',
  },
  moderate: {
    label: 'Moderate Risk',
    color: 'border border-amber-300 bg-amber-50 text-amber-900 font-semibold',
    dot: 'bg-amber-600',
    indicator: 'MOD',
  },
  high: {
    label: 'High Risk',
    color: 'border border-orange-300 bg-orange-50 text-orange-900 font-bold',
    dot: 'bg-orange-600',
    indicator: 'HIGH',
  },
  critical: {
    label: 'Critical Risk',
    color: 'border border-red-400 bg-red-50 text-red-900 font-mono font-bold',
    dot: 'bg-red-600',
    indicator: 'CRIT',
  },
  none: {
    label: 'Unscored',
    color: 'border border-slate-300 bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
    indicator: '—',
  },
}

export function getRiskTier(score) {
  if (score == null) return RISK_TIER.none
  if (score >= 75) return RISK_TIER.critical
  if (score >= 50) return RISK_TIER.high
  if (score >= 25) return RISK_TIER.moderate
  return RISK_TIER.low
}

export const SEVERITY_COLORS = {
  Low: 'border border-slate-300 text-slate-700 bg-slate-100',
  Medium: 'border border-amber-300 text-amber-800 bg-amber-50 font-medium',
  High: 'border border-orange-300 text-orange-800 bg-orange-50 font-bold',
  Critical: 'border border-red-300 text-red-800 bg-red-50 font-bold',
}

export const STATUS_LABELS = {
  SUBMITTED: { label: 'SUBMITTED', color: 'border border-slate-300 bg-slate-100 text-slate-800' },
  UNDER_REVIEW: { label: 'UNDER REVIEW', color: 'border border-amber-300 bg-amber-50 text-amber-900 font-medium' },
  APPROVED: { label: 'APPROVED', color: 'border border-emerald-300 bg-emerald-50 text-emerald-900 font-bold' },
  REJECTED: { label: 'REJECTED', color: 'border border-red-300 bg-red-50 text-red-900 font-bold' },
  PAYMENT_HELD: { label: 'PAYMENT HELD', color: 'border border-amber-400 bg-amber-50 text-amber-900 font-bold' },
  DOCUMENTS_REQUESTED: { label: 'DOCS REQUESTED', color: 'border border-slate-400 bg-slate-100 text-slate-900 font-mono font-bold' },
  ESCALATED: { label: 'ESCALATED', color: 'border border-rose-300 bg-rose-50 text-rose-900 font-bold' },
}

export function getStatusBadge(status) {
  return STATUS_LABELS[status] || { label: status, color: 'border border-slate-300 text-slate-700 bg-slate-100' }
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
