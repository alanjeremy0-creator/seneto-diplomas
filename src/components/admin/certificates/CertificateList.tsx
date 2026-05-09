import Link from 'next/link'
import type { CertificateListItem } from '@/types/api'
import type { CertificateStatus } from '@/types/index'
import { StatusBadge } from '@/components/admin/StatusBadge'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

// ── Photo chip ────────────────────────────────────────────────────────────────

function PhotoChip({ hasPhoto }: { hasPhoto: boolean }) {
  return hasPhoto ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
      {/* Camera icon */}
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      Tiene foto
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
      Sin foto
    </span>
  )
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function CertificateCard({ cert }: { cert: CertificateListItem }) {
  return (
    <Link
      href={`/admin/certificates/${cert.folio}`}
      className="block min-h-[44px] rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 transition hover:ring-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      aria-label={`Ver certificado de ${cert.student_name}, folio ${cert.folio}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{cert.student_name}</p>
          <p className="mt-0.5 text-xs text-gray-500">{cert.folio}</p>
          {cert.program && (
            <p className="mt-0.5 truncate text-xs text-gray-500">{cert.program}</p>
          )}
        </div>
        <StatusBadge status={cert.status as CertificateStatus} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <PhotoChip hasPhoto={cert.has_photo} />
        <span className="ml-auto text-xs text-gray-400">{formatDate(cert.issued_date)}</span>
      </div>
    </Link>
  )
}

// ── Desktop table row ─────────────────────────────────────────────────────────

function CertificateRow({ cert }: { cert: CertificateListItem }) {
  return (
    <tr className="group border-t border-gray-100 transition hover:bg-gray-50">
      <td className="py-3 pl-4 pr-3 text-sm sm:pl-6">
        <Link
          href={`/admin/certificates/${cert.folio}`}
          className="block min-h-[44px] flex items-center font-medium text-gray-900 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
        >
          {cert.folio}
        </Link>
      </td>
      <td className="px-3 py-3 text-sm text-gray-700">{cert.student_name}</td>
      <td className="px-3 py-3 text-sm text-gray-500">{cert.program ?? '—'}</td>
      <td className="px-3 py-3">
        <StatusBadge status={cert.status as CertificateStatus} />
      </td>
      <td className="px-3 py-3 text-sm text-gray-500">{formatDate(cert.issued_date)}</td>
      <td className="px-3 py-3">
        <PhotoChip hasPhoto={cert.has_photo} />
      </td>
      <td className="px-3 py-3 text-sm text-gray-500">{cert.generation.name}</td>
    </tr>
  )
}

// ── Pagination controls ────────────────────────────────────────────────────────

interface PaginationProps {
  page: number
  pages: number
  total: number
  searchParamsString: string
}

function Pagination({ page, pages, total, searchParamsString }: PaginationProps) {
  function buildPageHref(p: number) {
    const params = new URLSearchParams(searchParamsString)
    params.set('page', String(p))
    return `/admin/certificates?${params.toString()}`
  }

  return (
    <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-sm text-gray-500">
      <p>{total} certificado{total !== 1 ? 's' : ''}</p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={buildPageHref(page - 1)}
              className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
            >
              ← Anterior
            </Link>
          ) : (
            <span className="min-h-[44px] cursor-not-allowed rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-300">
              ← Anterior
            </span>
          )}

          <span className="px-2 tabular-nums">
            {page} / {pages}
          </span>

          {page < pages ? (
            <Link
              href={buildPageHref(page + 1)}
              className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
            >
              Siguiente →
            </Link>
          ) : (
            <span className="min-h-[44px] cursor-not-allowed rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-300">
              Siguiente →
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface CertificateListProps {
  certificates: CertificateListItem[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
  searchParamsString: string
}

export function CertificateList({ certificates, pagination, searchParamsString }: CertificateListProps) {
  return (
    <div className="space-y-4">
      {/* Mobile: cards (< 768px) */}
      <div className="space-y-3 md:hidden" role="list" aria-label="Lista de certificados">
        {certificates.map((cert) => (
          <div key={cert.folio} role="listitem">
            <CertificateCard cert={cert} />
          </div>
        ))}
      </div>

      {/* Desktop: table (≥ 768px) */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-6">Folio</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Nombre</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Programa</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estado</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Emisión</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Foto</th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Generación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {certificates.map((cert) => (
                <CertificateRow key={cert.folio} cert={cert} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={pagination.page}
        pages={pagination.pages}
        total={pagination.total}
        searchParamsString={searchParamsString}
      />
    </div>
  )
}
