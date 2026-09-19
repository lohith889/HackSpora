/**
 * Maps backend application statuses to citizen-friendly display info.
 * Settled light theme: gentle contrast, institutional clarity.
 */
export const STATUS_CONFIG = {
  SUBMITTED: {
    label: 'Application Logged',
    badge: 'border border-slate-300 bg-slate-100 text-slate-800 font-mono',
    description: 'Your application has been received into the queue and is awaiting cross-registry verification.',
    code: '[LOGGED]',
  },
  UNDER_REVIEW: {
    label: 'Under Verification',
    badge: 'border border-amber-300 bg-amber-50 text-amber-900 font-mono',
    description: 'Application details are undergoing reconciliation with state land and PFMS records.',
    code: '[IN AUDIT]',
  },
  APPROVED: {
    label: 'Claim Approved',
    badge: 'border border-emerald-300 bg-emerald-50 text-emerald-900 font-mono font-bold',
    description: 'Application approved by scheme officer. Entitlement granted for PM-KISAN subsidy.',
    code: '[APPROVED]',
  },
  REJECTED: {
    label: 'Ineligible Claim',
    badge: 'border border-red-300 bg-red-50 text-red-900 font-mono font-bold',
    description: 'Claim determined ineligible under statutory PM-KISAN exclusion criteria.',
    code: '[REJECTED]',
  },
  HOLD: {
    label: 'Adjudication Held',
    badge: 'border border-amber-400 bg-amber-50 text-amber-900 font-mono font-bold',
    description: 'Verification on hold pending scheme officer review or field inspection.',
    code: '[HELD]',
  },
  REQUEST_DOCUMENTS: {
    label: 'Evidence Required',
    badge: 'border border-slate-400 bg-slate-100 text-slate-900 font-mono font-bold',
    description: 'Please submit fresh revenue proof or Khasra extract to the scheme officer.',
    code: '[DOCS REQ]',
  },
  ESCALATED: {
    label: 'Special Review Docket',
    badge: 'border border-rose-300 bg-rose-50 text-rose-900 font-mono font-bold',
    description: 'Application referred to district revenue magistrate for legal determination.',
    code: '[ESCALATED]',
  },
}

export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG['UNDER_REVIEW']
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function maskBankAccount(acc) {
  if (!acc || acc.length < 4) return acc
  return `XXXXXXXX${acc.slice(-4)}`
}
