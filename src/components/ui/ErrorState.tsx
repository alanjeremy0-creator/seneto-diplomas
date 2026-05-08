interface ErrorStateProps {
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  message = 'Ocurrió un error inesperado.',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
        <svg
          className="h-7 w-7 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <p className="text-base font-medium text-gray-900">Algo salió mal</p>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}
