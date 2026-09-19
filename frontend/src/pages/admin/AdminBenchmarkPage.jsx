import { useState, useEffect } from 'react'
import { adminAPI } from '../../api/client'
import { formatDateTime } from '../../utils/adminUtils'
import Spinner from '../../components/Spinner'

export default function AdminBenchmarkPage() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const fetchMetrics = async () => {
    setRunning(true)
    setError('')
    try {
      const { data } = await adminAPI.evaluationMetrics()
      setMetrics(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to compute evaluation metrics.')
    } finally {
      setLoading(false)
      setRunning(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  return (
    <div className="space-y-6 text-left font-sans">
      {/* Masthead Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              TECHNICAL MEMORANDUM // AI-ML BENCHMARK REPORT
            </span>
            <span className="border border-emerald-400 bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 font-mono uppercase tracking-wider font-bold">
              GROUND TRUTH VALIDATED
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-serif mt-1">
            Algorithmic Vigilance Pipeline &amp; Model Benchmark
          </h1>
          <p className="text-slate-600 text-xs mt-0.5 font-sans">
            Empirical statistical validation of the 9-Engine Anomaly Detection Pipeline &amp; Isolation Forest model against synthetic ground truth archetypes.
          </p>
        </div>

        <button
          onClick={fetchMetrics}
          disabled={running}
          className="bg-emerald-900 hover:bg-emerald-800 text-white font-mono text-xs uppercase tracking-wider px-4 py-2 font-bold transition-colors disabled:opacity-50"
        >
          {running ? '[ EXECUTING BENCHMARK... ]' : 'Execute Ground-Truth Run ↻'}
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-900">
          <Spinner />
        </div>
      ) : error ? (
        <div className="border border-red-300 bg-red-50 p-6 text-left shadow-sm">
          <span className="font-mono text-xs font-bold text-red-800 uppercase block mb-1">
            [EVALUATION ENGINE FAULT]
          </span>
          <p className="text-slate-800 text-sm font-sans mb-4">{error}</p>
          <button
            onClick={fetchMetrics}
            className="border border-slate-400 bg-white hover:bg-slate-100 text-slate-800 px-3 py-1.5 font-mono text-xs uppercase"
          >
            [RETRY EVALUATION RUN]
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'PRECISION', value: `${(metrics.precision * 100).toFixed(1)}%`, formula: 'TP / (TP + FP)', note: 'Flagged claims accuracy' },
              { label: 'RECALL', value: `${(metrics.recall * 100).toFixed(1)}%`, formula: 'TP / (TP + FN)', note: 'Fraud capture sensitivity' },
              { label: 'F1 SCORE', value: metrics.f1_score.toFixed(3), formula: '2*(P*R)/(P+R)', note: 'Harmonic mean balance' },
              { label: 'ACCURACY', value: `${(metrics.accuracy * 100).toFixed(1)}%`, formula: '(TP + TN) / TOTAL', note: 'Overall classification' },
              { label: 'SPECIFICITY', value: `${(metrics.specificity * 100).toFixed(1)}%`, formula: 'TN / (TN + FP)', note: 'Genuine claim pass-through' },
              { label: 'FALSE POS. RATE', value: `${(metrics.false_positive_rate * 100).toFixed(1)}%`, formula: 'FP / (FP + TN)', isAlert: metrics.false_positive_rate > 0.05, note: 'Erroneous denial rate' },
            ].map(({ label, value, formula, note, isAlert }) => (
              <div
                key={label}
                className={`border p-4 flex flex-col justify-between shadow-sm ${
                  isAlert
                    ? 'border-amber-300 bg-amber-50 text-slate-900'
                    : 'border-slate-300 bg-white text-slate-900'
                }`}
              >
                <div>
                  <div className="font-mono text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    {label}
                  </div>
                  <div className={`font-mono text-2xl font-bold tracking-tight mt-1 ${isAlert ? 'text-amber-800' : 'text-slate-900'}`}>
                    {value}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200">
                  <div className="font-mono text-[10px] text-slate-500">{formula}</div>
                  <div className="font-sans text-[11px] text-slate-600 mt-0.5">{note}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Contingency Matrix & System Architecture */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Confusion Matrix (6 cols) */}
            <div className="lg:col-span-6 border border-slate-300 bg-white p-5 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-baseline justify-between border-b border-slate-200 pb-2 mb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">TABLE 1.1 // CLASSIFICATION ACCURACY</span>
                    <h3 className="font-serif text-base font-bold text-slate-900">
                      2x2 Statistical Contingency Matrix
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] text-slate-600 font-semibold border border-slate-200 px-2 py-0.5 bg-slate-50">
                    N = {metrics.total_test_samples} BENCHMARK CASES
                  </span>
                </div>

                {/* 2x2 Ledger */}
                <div className="border border-slate-300 bg-white overflow-hidden">
                  <div className="grid grid-cols-2 border-b border-slate-300 font-mono text-[10px] text-slate-700 uppercase tracking-wider bg-slate-100">
                    <div className="p-2.5 border-r border-slate-300 text-center font-bold">PREDICTED FRAUD</div>
                    <div className="p-2.5 text-center font-bold">PREDICTED GENUINE</div>
                  </div>

                  <div className="grid grid-cols-2 border-b border-slate-200">
                    {/* True Positive */}
                    <div className="p-4 border-r border-slate-200 text-left bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase text-slate-600 font-semibold">TRUE POSITIVE [TP]</span>
                        <span className="font-mono text-[9px] text-emerald-800 bg-emerald-50 border border-emerald-300 px-1 font-bold">CORRECT</span>
                      </div>
                      <div className="font-mono text-4xl font-bold text-slate-900 mt-2">
                        {metrics.true_positives}
                      </div>
                      <p className="font-sans text-[11px] text-slate-600 mt-1">
                        Fraudulent claims correctly identified &amp; flagged
                      </p>
                    </div>

                    {/* False Negative */}
                    <div className="p-4 text-left bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase text-slate-600 font-semibold">FALSE NEGATIVE [FN]</span>
                        <span className="font-mono text-[9px] text-amber-800 bg-amber-50 border border-amber-300 px-1 font-bold">TYPE II</span>
                      </div>
                      <div className={`font-mono text-4xl font-bold mt-2 ${metrics.false_negatives > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                        {metrics.false_negatives}
                      </div>
                      <p className="font-sans text-[11px] text-slate-600 mt-1">
                        Fraudulent claims undetected by pipeline
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2">
                    {/* False Positive */}
                    <div className="p-4 border-r border-slate-200 text-left bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase text-slate-600 font-semibold">FALSE POSITIVE [FP]</span>
                        <span className="font-mono text-[9px] text-amber-800 bg-amber-50 border border-amber-300 px-1 font-bold">TYPE I</span>
                      </div>
                      <div className={`font-mono text-4xl font-bold mt-2 ${metrics.false_positives > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                        {metrics.false_positives}
                      </div>
                      <p className="font-sans text-[11px] text-slate-600 mt-1">
                        Genuine farmer claims incorrectly flagged
                      </p>
                    </div>

                    {/* True Negative */}
                    <div className="p-4 text-left bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase text-slate-600 font-semibold">TRUE NEGATIVE [TN]</span>
                        <span className="font-mono text-[9px] text-emerald-800 bg-emerald-50 border border-emerald-300 px-1 font-bold">CORRECT</span>
                      </div>
                      <div className="font-mono text-4xl font-bold text-slate-900 mt-2">
                        {metrics.true_negatives}
                      </div>
                      <p className="font-sans text-[11px] text-slate-600 mt-1">
                        Genuine claims cleared without impediment
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 font-mono text-[11px] text-slate-500 flex justify-between">
                <span>EVALUATION RUN COMPLETED:</span>
                <span className="text-slate-800 font-semibold">{formatDateTime(metrics.evaluation_timestamp)}</span>
              </div>
            </div>

            {/* Pipeline Architecture Table (6 cols) */}
            <div className="lg:col-span-6 border border-slate-300 bg-white p-5 shadow-sm">
              <div className="flex items-baseline justify-between border-b border-slate-200 pb-2 mb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">TABLE 1.2 // PIPELINE ENGINES</span>
                  <h3 className="font-serif text-base font-bold text-slate-900">
                    9-Engine Detection Architecture
                  </h3>
                </div>
                <span className="font-mono text-[11px] text-slate-600 font-semibold border border-slate-200 px-2 py-0.5 bg-slate-50">
                  DETERMINISTIC + ML
                </span>
              </div>

              <div className="space-y-2">
                {[
                  { id: '01', name: 'Identity Engine', rule: 'UIDAI e-KYC, tokenized Aadhaar hash duplicate check, OTP verify' },
                  { id: '02', name: 'Land Record Engine', rule: 'Bhulekh record verification, title-holder match, fuzzy name alignment' },
                  { id: '03', name: 'Bank Validation Engine', rule: 'PFMS format check, penny-drop validation, mule account tracing' },
                  { id: '04', name: 'Exclusion Engine', rule: 'CBDT income tax filer matching, institutional pensions, deceased records' },
                  { id: '05', name: 'Duplicate Parcel Engine', rule: 'Cross-applicant plot collisions and multi-claimant detection' },
                  { id: '06', name: 'Statistical Density Engine', rule: 'Village cultivator threshold vs historical saturation bounds' },
                  { id: '07', name: 'Temporal Surge Engine', rule: 'Velocity spikes within 48-hour pre-disbursement windows' },
                  { id: '08', name: 'Isolation Forest (ML)', rule: '6-dimensional unsupervised multivariate outlier model' },
                  { id: '09', name: 'NetworkX Graph Engine', rule: 'Heterogeneous entity-linkage graph detecting syndicate rings' },
                ].map(({ id, name, rule }) => (
                  <div
                    key={id}
                    className="border border-slate-200 bg-slate-50 p-2.5 flex items-start justify-between gap-3 text-left font-mono"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-slate-500 text-[11px] font-bold">{id}</span>
                      <div>
                        <span className="text-slate-900 text-xs font-bold block">{name}</span>
                        <span className="text-slate-600 text-[11px] font-sans block mt-0.5 leading-snug">{rule}</span>
                      </div>
                    </div>
                    <span className="border border-emerald-300 bg-emerald-50 text-emerald-800 text-[9px] px-1.5 py-0.5 uppercase tracking-wider font-bold flex-shrink-0">
                      ACTIVE
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
