import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { applicationAPI } from '../api/client'
import { getStatusConfig, formatDate, maskBankAccount } from '../utils/statusUtils'
import Spinner from '../components/Spinner'

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between py-2 border-b border-slate-100 last:border-0 font-mono text-xs">
      <span className="text-slate-500 uppercase tracking-wider">{label}:</span>
      <span className={`text-slate-900 ${mono ? 'font-mono' : 'font-sans font-medium'}`}>{value || '—'}</span>
    </div>
  )
}

function SectionDocket({ title, code, children }) {
  return (
    <div className="border border-slate-300 p-5 bg-white space-y-3 shadow-sm">
      <div className="border-b border-slate-200 pb-2 flex items-baseline justify-between">
        <h3 className="font-serif text-base font-bold text-slate-900">{title}</h3>
        <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-semibold">{code}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export default function ApplicationDetailPage() {
  const { id } = useParams()
  const [app, setApp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchApp = async () => {
      setLoading(true)
      try {
        const { data } = await applicationAPI.getDetail(id)
        setApp(data)
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load application details.')
      } finally {
        setLoading(false)
      }
    }
    fetchApp()
  }, [id])

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-900">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="border border-red-300 p-8 bg-red-50 text-red-800 text-left font-mono text-xs space-y-3 shadow-sm">
        <strong>[RECORD NOT FOUND]</strong>
        <p>{error}</p>
        <Link to="/dashboard" className="underline block text-slate-900 font-semibold">← Return to Beneficiary Ledger</Link>
      </div>
    )
  }

  const statusCfg = getStatusConfig(app.status)

  // Determine stage sequence index
  const stageIndex = (() => {
    if (['APPROVED'].includes(app.status)) return 3
    if (['UNDER_REVIEW', 'HOLD', 'REQUEST_DOCUMENTS', 'ESCALATED'].includes(app.status)) return 2
    return 1
  })()

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left font-sans">
      {/* Return Link & Print Bar */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <Link
          to="/dashboard"
          className="inline-block font-mono text-xs uppercase tracking-wider text-slate-600 hover:text-slate-900 underline transition-colors"
        >
          ← Return to Citizen Ledger
        </Link>
        <button
          onClick={() => window.print()}
          className="border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 px-3 py-1 text-xs font-mono uppercase tracking-wider font-semibold"
        >
          Print Acknowledgement ⎙
        </button>
      </div>

      {/* Main Dossier Header Block */}
      <div className="border border-slate-300 bg-white shadow-sm overflow-hidden">
        {/* National tri-color accent line */}
        <div className="h-1 flex w-full">
          <div className="bg-[#f97316] w-1/3" />
          <div className="bg-white w-1/3 border-b border-slate-200" />
          <div className="bg-[#16a34a] w-1/3" />
        </div>

        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  FORM AP-ACK (CLAUSE 5(2)) // ACKNOWLEDGEMENT RECEIPT
                </span>
              </div>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-slate-900 mt-1">
                {app.farmer_name}
              </h1>
              <p className="font-mono text-xs text-slate-600 mt-0.5">
                Application Ref: <strong className="text-slate-900">APP-{String(app.id).padStart(6, '0')}</strong> • Scheme: <strong>{app.scheme_code || 'PM_KISAN'}</strong> • Filed: <strong>{formatDate(app.submitted_at)}</strong>
              </p>
            </div>

            <div className="self-start sm:self-auto">
              <span className={`stamp text-xs px-3 py-1 ${statusCfg.badge}`}>
                {statusCfg.code} {statusCfg.label}
              </span>
            </div>
          </div>

          {/* Process Stage Sequence Rule */}
          <div className="grid grid-cols-3 gap-2 mt-5 font-mono text-xs uppercase tracking-wider">
            <div className={`p-2.5 border transition-colors ${stageIndex >= 1 ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-200 bg-white text-slate-400'}`}>
              <span className="text-[10px] block text-slate-500">STAGE 01</span>
              <span>Claim Lodged</span>
            </div>
            <div className={`p-2.5 border transition-colors ${stageIndex >= 2 ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-200 bg-white text-slate-400'}`}>
              <span className="text-[10px] block text-slate-500">STAGE 02</span>
              <span>Multi-Registry Audit</span>
            </div>
            <div className={`p-2.5 border transition-colors ${stageIndex >= 3 ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold' : 'border-slate-200 bg-white text-slate-400'}`}>
              <span className="text-[10px] block text-slate-500">STAGE 03</span>
              <span>District Adjudication</span>
            </div>
          </div>

          {/* Official Status Message */}
          <div className="mt-5 border-l-2 border-slate-800 pl-4 py-2.5 bg-slate-50 font-sans text-xs text-slate-700 leading-relaxed">
            <strong className="font-mono text-[11px] uppercase tracking-wider text-slate-900 block mb-0.5">
              Official Administrative Dispatch:
            </strong>
            {app.citizen_status_message}
          </div>
        </div>
      </div>

      {/* Grid of Section Dockets (Asymmetric) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Demographics */}
        <SectionDocket title="Identity & Demographic Particulars" code="SCHEDULE-A">
          <DetailRow label="Legal Name" value={app.farmer_name} />
          <DetailRow label="Date of Birth" value={formatDate(app.date_of_birth)} mono />
          <DetailRow label="Gender" value={app.gender} />
          <DetailRow label="Social Category" value={app.category || 'General'} />
          <DetailRow label="Masked Aadhaar" value={app.aadhaar_masked || 'XXXX-XXXX-****'} mono />
          <DetailRow label="Mobile Telephony" value={app.mobile_number} mono />
        </SectionDocket>

        {/* Section 2: Bank Details */}
        <SectionDocket title="Direct Benefit Routing (PFMS/DBT)" code="SCHEDULE-B">
          <DetailRow label="Bank Account" value={maskBankAccount(app.bank_account_number)} mono />
          <DetailRow label="Branch IFSC" value={app.ifsc_code} mono />
          <DetailRow label="Disbursement System" value="PFMS / NPCI DBT Gateway" />
          <DetailRow label="e-KYC Consent" value="Authenticated on UIDAI Master" />
          <DetailRow label="Beneficiary Affirmation" value="Affirmed & Signed digitally" />
        </SectionDocket>
      </div>

      {/* Full-width Section 3: Land Parcel */}
      <SectionDocket title="Revenue Land Parcel Record (State Bhulekh Master)" code="SCHEDULE-C">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
          <DetailRow label="Composite Parcel Ref" value={app.parcel_id} mono />
          <DetailRow label="State / District" value={`${app.state_code} / ${app.district_code}`} mono />
          <DetailRow label="Tehsil / Village" value={`${app.tehsil_code} / ${app.village_code}`} mono />
          <DetailRow label="Khata / Plot No." value={`${app.khata_number} / ${app.plot_number}`} mono />
          <DetailRow label="Declared Land Area" value={`${app.declared_land_area_ha} Hectares`} mono />
          <DetailRow label="Ownership Type" value={app.ownership_type || 'Single'} />
          {app.declared_crop_code && (
            <DetailRow label="Cultivated Crop" value={app.declared_crop_code} mono />
          )}
          <DetailRow label="Revenue Deed Proof" value="Attached & archived in state sub-registry" />
        </div>
      </SectionDocket>

      {/* Statutory Guidance */}
      <div className="border border-slate-300 p-5 bg-slate-50 space-y-2 font-mono text-xs text-slate-700 shadow-sm">
        <strong className="text-slate-900 uppercase block border-b border-slate-200 pb-1">
          Statutory PM-KISAN Disbursement Rules &amp; Rights
        </strong>
        <p className="leading-relaxed font-sans text-slate-600">
          Financial support is disbursed directly into authenticated Aadhaar-linked bank accounts in four-monthly tranches (April, August, December). Eligibility is verified against State Bhulekh digitized revenue records and exclusion rolls.
        </p>
        <div className="text-slate-500 text-[11px] pt-1 flex flex-col sm:flex-row justify-between">
          <span>Digital Personal Data Protection Act, 2023 Compliant</span>
          <span>PM-KISAN National Helpline: 155261</span>
        </div>
      </div>
    </div>
  )
}
