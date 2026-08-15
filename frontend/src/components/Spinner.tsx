export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="animate-spin rounded-full border-2 border-ink-100 border-t-primary"
      style={{ width: size, height: size }}
    />
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center py-24 animate-fade-in">
      <Spinner size={28} />
    </div>
  );
}

export function CardSkeleton() {
  return <div className="card h-32 skeleton" />;
}

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="skeleton h-3.5 w-20 rounded" />
            <div className="skeleton h-9 w-9 rounded-full" />
          </div>
          <div className="skeleton h-7 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-2 animate-fade-in">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 px-3 py-3.5 border-b border-ink-100 last:border-0">
          <div className="skeleton h-9 w-9 rounded-full shrink-0" />
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton h-3.5 rounded flex-1" style={{ maxWidth: c === 0 ? 160 : 90 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
