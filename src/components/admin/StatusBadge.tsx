import type { GenerationStatus, CertificateStatus } from '@/types/index'

type BadgeStatus = GenerationStatus | CertificateStatus

const BADGE_CONFIG: Record<BadgeStatus, { label: string; className: string }> = {
  // Generation statuses
  draft:       { label: 'Borrador',    className: 'bg-gray-100 text-gray-600' },
  ready:       { label: 'Listo',       className: 'bg-blue-100 text-blue-700' },
  processing:  { label: 'Procesando',  className: 'bg-yellow-100 text-yellow-700' },
  completed:   { label: 'Completado',  className: 'bg-green-100 text-green-700' },
  failed:      { label: 'Error',       className: 'bg-red-100 text-red-700' },
  // Certificate statuses
  pending:     { label: 'Pendiente',   className: 'bg-gray-100 text-gray-600' },
  active:      { label: 'Activo',      className: 'bg-green-100 text-green-700' },
  revoked:     { label: 'Revocado',    className: 'bg-red-100 text-red-700' },
  expired:     { label: 'Expirado',    className: 'bg-orange-100 text-orange-700' },
}

interface StatusBadgeProps {
  status: BadgeStatus
  showSpinner?: boolean
}

export function StatusBadge({ status, showSpinner }: StatusBadgeProps) {
  const config = BADGE_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  const spinning = showSpinner ?? status === 'processing'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {spinning && (
        <svg
          className="h-3 w-3 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {config.label}
    </span>
  )
}
