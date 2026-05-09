import Link from 'next/link'
import type { CertificateDetailItem } from '@/types/api'
import type { CertificateStatus } from '@/types/index'
import { StatusBadge } from '@/components/admin/StatusBadge'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

// ── Data row ──────────────────────────────────────────────────────────────────

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
      <dt className="w-40 flex-shrink-0 text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{children}</dd>
    </div>
  )
}

// ── Photo chip ────────────────────────────────────────────────────────────────

function PhotoChip({ hasPhoto }: { hasPhoto: boolean }) {
  return hasPhoto ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      Tiene foto
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-500">
      Sin foto
    </span>
  )
}

// ── Revocation block ──────────────────────────────────────────────────────────

function RevocationBlock({
  revokedAt,
  reason,
}: {
  revokedAt: string | Date | null | undefined
  reason: string | null | undefined
}) {
  return (
    <div
      className="rounded-xl border border-red-100 bg-red-50 p-4"
      role="status"
      aria-label="Información de revocación"
    >
      <div className="flex items-center gap-2">
        {/* X-circle icon */}
        <svg className="h-5 w-5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-semibold text-red-800">Este certificado fue revocado</p>
      </div>
      <dl className="mt-3 space-y-1 text-sm text-red-700">
        <div className="flex gap-2">
          <dt className="font-medium">Fecha de revocación:</dt>
          <dd>{formatDate(revokedAt)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Motivo:</dt>
          <dd>{reason ?? '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CertificateDetail({ certificate: cert }: { certificate: CertificateDetailItem }) {
  const isRevoked = cert.status === 'revoked'

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Folio</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-gray-900">
              {cert.folio}
            </h1>
            <p className="mt-1 text-lg text-gray-700">{cert.student_name}</p>
            {cert.program && (
              <p className="mt-0.5 text-sm text-gray-500">{cert.program}</p>
            )}
          </div>
          {/* StatusBadge — slightly larger context in detail view */}
          <div className="flex-shrink-0">
            <StatusBadge status={cert.status as CertificateStatus} />
          </div>
        </div>
      </div>

      {/* Revocation block — only when revoked */}
      {isRevoked && (
        <RevocationBlock revokedAt={cert.revoked_at} reason={cert.revocation_reason} />
      )}

      {/* Details */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="text-sm font-medium text-gray-700">Información del certificado</h2>
        <dl className="mt-2 divide-y divide-gray-100">
          <DataRow label="Institución">Seneto</DataRow>
          <DataRow label="Fecha de emisión">{formatDate(cert.issued_date)}</DataRow>
          <DataRow label="Generación">
            <Link
              href={`/admin/generations/${cert.generation.id}`}
              className="text-gray-900 underline underline-offset-2 hover:text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
            >
              {cert.generation.name}
            </Link>
          </DataRow>
          <DataRow label="Foto">
            <PhotoChip hasPhoto={cert.has_photo} />
          </DataRow>
        </dl>
      </div>

      {/* Metadata */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="text-sm font-medium text-gray-700">Metadatos</h2>
        <dl className="mt-2 divide-y divide-gray-100">
          <DataRow label="Creado">{formatDate(cert.created_at)}</DataRow>
          <DataRow label="Actualizado">{formatDate(cert.updated_at)}</DataRow>
        </dl>
      </div>
    </div>
  )
}
