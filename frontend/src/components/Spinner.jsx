export default function Spinner({ size = 'md', className = '' }) {
  return (
    <div className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-ink ${className}`}>
      <span className="inline-block w-3 h-3 border border-ink border-t-transparent animate-spin rounded-none" />
      <span>Loading...</span>
    </div>
  )
}
