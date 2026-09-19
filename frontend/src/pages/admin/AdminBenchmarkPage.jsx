import { useState, useEffect } from 'react'
import { adminAPI } from '../../api/client'
import { formatDateTime } from '../../utils/adminUtils'
import Spinner from '../../components/Spinner'
import {
  ShieldCheck, Activity, RefreshCw, Layers, CheckCircle2,
  AlertTriangle, Cpu, TrendingUp, HelpCircle
} from 'lucide-react'

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
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">AI Anomaly Engine Evaluation Benchmark</h1>
            <span className="bg-green-950 text-green-300 border border-green-800 text-xs px-2.5 py-0.5 rounded-full font-mono">
              Ground Truth Validated
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Empirical statistical evaluation of the 8-Engine Anomaly Detection Pipeline &amp; Isolation Forest model.
          </p>
        </div>

        <button
          onClick={fetchMetrics}
          disabled={running}
          className="self-start sm:self-auto flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-red-900/40"
        >
          <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Benchmarking Pipeline…' : 'Execute Ground-Truth Run'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : error ? (
        <div className="bg-red-950/40 border border-red-800 rounded-xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-300 font-semibold mb-2">{error}</p>
          <button onClick={fetchMetrics} className="btn-secondary text-xs">
            Retry Benchmark
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Precision', value: `${(metrics.precision * 100).toFixed(1)}%`, desc: 'TP / (TP + FP)', color: 'text-green-400' },
              { label: 'Recall (Sensitivity)', value: `${(metrics.recall * 100).toFixed(1)}%`, desc: 'TP / (TP + FN)', color: 'text-blue-400' },
              { label: 'F1 Score', value: metrics.f1_score.toFixed(3), desc: 'Harmonic mean of P & R', color: 'text-purple-400' },
              { label: 'Overall Accuracy', value: `${(metrics.accuracy * 100).toFixed(1)}%`, desc: '(TP + TN) / Total', color: 'text-teal-400' },
              { label: 'Specificity', value: `${(metrics.specificity * 100).toFixed(1)}%`, desc: 'TN / (TN + FP)', color: 'text-amber-400' },
              { label: 'False Positive Rate', value: `${(metrics.false_positive_rate * 100).toFixed(1)}%`, desc: 'FP / (FP + TN)', color: 'text-red-400' },
            ].map(({ label, value, desc, color }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide font-medium">{label}</p>
                  <p className={`text-2xl font-bold font-mono mt-1 ${color}`}>{value}</p>
                </div>
                <p className="text-[11px] text-gray-500 mt-2 font-mono">{desc}</p>
              </div>
            ))}
          </div>

          {/* Confusion Matrix & Execution Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Confusion Matrix Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Confusion Matrix ({metrics.total_test_samples} Ground-Truth Archetypes)
                </h3>
                <span className="text-xs text-gray-400 font-mono">2x2 Classification</span>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto my-4 text-center">
                {/* True Positive */}
                <div className="bg-green-950/40 border-2 border-green-700/60 rounded-xl p-4">
                  <p className="text-xs uppercase text-green-300 font-semibold tracking-wider">True Positives (TP)</p>
                  <p className="text-3xl font-bold font-mono text-green-400 mt-1">{metrics.true_positives}</p>
                  <p className="text-[11px] text-green-200/70 mt-1">Fraudulent Claims Correctly Flagged</p>
                </div>

                {/* False Positive */}
                <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4">
                  <p className="text-xs uppercase text-red-300 font-semibold tracking-wider">False Positives (FP)</p>
                  <p className="text-3xl font-bold font-mono text-red-400 mt-1">{metrics.false_positives}</p>
                  <p className="text-[11px] text-red-200/70 mt-1">Genuine Farmers Misclassified</p>
                </div>

                {/* False Negative */}
                <div className="bg-orange-950/30 border border-orange-800/40 rounded-xl p-4">
                  <p className="text-xs uppercase text-orange-300 font-semibold tracking-wider">False Negatives (FN)</p>
                  <p className="text-3xl font-bold font-mono text-orange-400 mt-1">{metrics.false_negatives}</p>
                  <p className="text-[11px] text-orange-200/70 mt-1">Fraudulent Claims Missed</p>
                </div>

                {/* True Negative */}
                <div className="bg-blue-950/40 border-2 border-blue-700/60 rounded-xl p-4">
                  <p className="text-xs uppercase text-blue-300 font-semibold tracking-wider">True Negatives (TN)</p>
                  <p className="text-3xl font-bold font-mono text-blue-400 mt-1">{metrics.true_negatives}</p>
                  <p className="text-[11px] text-blue-200/70 mt-1">Genuine Farmers Cleared</p>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center mt-3">
                Evaluated on {formatDateTime(metrics.evaluation_timestamp)} against synthetic ground truth.
              </p>
            </div>

            {/* Architecture Pipeline Summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  Pipeline Detection Architecture
                </h3>
                <p className="text-gray-400 text-xs leading-relaxed mb-4">
                  The KisanGuard portal executes a hybrid deterministic and statistical anomaly architecture.
                  Rule engines match against government registries (Bhulekh, PFMS, CBDT), while Isolation Forest detects multi-attribute outliers.
                </p>

                <div className="space-y-2.5 text-xs">
                  {[
                    { engine: '1. Identity Engine', desc: 'UIDAI eKYC verification, OTP checks, duplicate Aadhaar, bulk mobile reuse' },
                    { engine: '2. Land Engine', desc: 'Bhulekh parcel existence, Aadhaar title matching, fuzzy name matching, agricultural land verification' },
                    { engine: '3. Bank Engine', desc: 'PFMS banking registry validation, IFSC format, penny-drop simulation, mule accounts' },
                    { engine: '4. Exclusion Engine', desc: 'CBDT income tax payees, govt employees, institutional pensioners, deceased records' },
                    { engine: '5. Duplicate Parcel Engine', desc: 'Cross-applicant parcel collisions and syndicate claim detection' },
                    { engine: '6. Statistical Engine', desc: 'Village cultivator density surges against historical baselines' },
                    { engine: '7. Temporal Engine', desc: 'Pre-installment DBT surge detection within 48h deadline windows' },
                    { engine: '8. Isolation Forest (ML)', desc: '6-dimensional unsupervised multivariate outlier model with feature driver attribution' },
                    { engine: '9. NetworkX Graph Engine', desc: 'Heterogeneous entity graph detecting mule rings and shared syndicates' },
                  ].map(({ engine, desc }) => (
                    <div key={engine} className="bg-gray-800/60 border border-gray-800 rounded-lg p-2.5 flex items-start gap-2.5">
                      <span className="text-blue-300 font-semibold font-mono flex-shrink-0">{engine}</span>
                      <span className="text-gray-300">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
