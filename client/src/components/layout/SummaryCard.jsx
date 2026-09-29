// SummaryCard - dashboard stat card; clickable for drill-down.

export function SummaryCard({ label, value = '--', icon: Icon, onClick, accent = false, loading = false }) {
  const interactive = typeof onClick === 'function';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left shadow-sm transition-colors ${
        accent ? 'border-accent-200 bg-accent-50' : 'border-slate-200 bg-white'
      } ${interactive ? 'hover:border-primary-300 hover:shadow' : 'cursor-default'}`}
    >
      {Icon && (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent ? 'bg-accent-100 text-accent-600' : 'bg-primary-50 text-primary-700'}`}>
          <Icon size={20} />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-slate-500">{label}</span>
        <span className="block text-xl font-semibold text-slate-900">
          {loading ? '…' : value}
        </span>
      </span>
    </button>
  );
}
