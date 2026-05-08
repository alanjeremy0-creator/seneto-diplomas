import Link from 'next/link'

type EmptyStateAction =
  | { label: string; onClick: () => void; href?: never }
  | { label: string; href: string; onClick?: never }

interface EmptyStateProps {
  title: string
  description?: string
  action?: EmptyStateAction
  icon?: React.ReactNode
  className?: string
}

const CTA_CLASS =
  'mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900'

export function EmptyState({ title, description, action, icon, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      {icon ? (
        <div className="mb-4 text-gray-300">{icon}</div>
      ) : (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-7 w-7 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4"
            />
          </svg>
        </div>
      )}
      <p className="text-base font-medium text-gray-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && (
        action.href ? (
          <Link href={action.href} className={CTA_CLASS}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={CTA_CLASS}>
            {action.label}
          </button>
        )
      )}
    </div>
  )
}
