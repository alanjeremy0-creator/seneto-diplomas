interface LoadingSkeletonProps {
  rows?: number
  className?: string
}

export function LoadingSkeleton({ rows = 3, className = '' }: LoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Cargando..."
      className={`animate-pulse space-y-3 ${className}`}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded bg-gray-200" style={{ width: `${75 + (i % 3) * 8}%` }} />
            <div className="h-3 rounded bg-gray-200" style={{ width: `${50 + (i % 2) * 15}%` }} />
          </div>
        </div>
      ))}
      <span className="sr-only">Cargando contenido...</span>
    </div>
  )
}

export function LoadingSkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Cargando..."
      className={`animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="mb-3 h-4 w-1/2 rounded bg-gray-200" />
      <div className="mb-2 h-3 w-3/4 rounded bg-gray-200" />
      <div className="h-3 w-1/3 rounded bg-gray-200" />
      <span className="sr-only">Cargando...</span>
    </div>
  )
}
