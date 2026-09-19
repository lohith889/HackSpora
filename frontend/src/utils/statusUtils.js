/**
 * Maps backend application statuses to citizen-friendly display info.
 * Risk scores and anomaly details are NEVER exposed here (FARM-03).
 */
export const STATUS_CONFIG = {
  SUBMITTED: {
    label: 'Application Submitted',
    color: 'bg-blue-100 text-blue-800',
    description: 'Your application has been received and is awaiting initial review.',
    icon: '📋',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    color: 'bg-yellow-100 text-yellow-800',
    description: 'Your application is currently being reviewed by scheme officers.',
    icon: '🔍',
  },
  APPROVED: {
    label: 'Approved',
    color: 'bg-green-100 text-green-800',
    description: 'Congratulations! Your application has been approved. Benefit disbursement will follow.',
    icon: '✅',
  },
  REJECTED: {
    label: 'Not Eligible',
    color: 'bg-red-100 text-red-800',
    description: 'Your application could not be approved. Please contact your local Kisan Seva Kendra for guidance.',
    icon: '❌',
  },
  HOLD: {
    label: 'On Hold — Documents Needed',
    color: 'bg-orange-100 text-orange-800',
    description: 'Your application is on hold. Please visit your nearest PM-KISAN Seva Kendra with original land documents.',
    icon: '⏸️',
  },
  REQUEST_DOCUMENTS: {
    label: 'Additional Documents Required',
    color: 'bg-purple-100 text-purple-800',
    description: 'Please submit the required documents at your nearest Common Service Centre (CSC).',
    icon: '📄',
  },
  ESCALATED: {
    label: 'Under Special Review',
    color: 'bg-gray-100 text-gray-800',
    description: 'Your application has been referred for additional verification. This process may take additional time.',
    icon: '📤',
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
