import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import type { SAFE_GENERATION_SELECT } from '@/lib/api/selects'
import { StatusBadge } from '@/components/admin/StatusBadge'
import type { GenerationStatus } from '@/types/index'

export type GenerationListItem = Prisma.GenerationGetPayload<{
  select: typeof SAFE_GENERATION_SELECT
}>

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function GenerationCard({ generation }: { generation: GenerationListItem }) {
  const { id, name, status, folio_prefix, folio_year, total_count, processed_count, error_count, template, created_at } = generation

  return (
    <Link
      href={`/admin/generations/${id}`}
      className="group block rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200 transition hover:ring-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-gray-700">
            {name}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {folio_prefix}-{folio_year}
            {template ? ` · ${template.name}` : ''}
          </p>
        </div>
        <StatusBadge status={status as GenerationStatus} />
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span>
          <span className="font-medium text-gray-700">{total_count}</span> alumnos
        </span>
        {processed_count > 0 && (
          <span>
            <span className="font-medium text-green-700">{processed_count}</span> procesados
          </span>
        )}
        {error_count > 0 && (
          <span>
            <span className="font-medium text-red-700">{error_count}</span> errores
          </span>
        )}
        <span className="ml-auto">{formatDate(created_at)}</span>
      </div>
    </Link>
  )
}
