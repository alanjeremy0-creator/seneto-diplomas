import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { CertificateStatus } from '@/types/index'
import type { CertificateDetailItem } from '@/types/api'
import { CertificateDetail } from '@/components/admin/certificates/CertificateDetail'

export async function generateMetadata({ params }: { params: { folio: string } }) {
  return { title: `${params.folio} — Certificados — Seneto` }
}

interface PageProps {
  params: { folio: string }
}

export default async function CertificateDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions)

  const raw = await prisma.certificate.findUnique({
    where: { folio: params.folio },
    select: {
      // safe fields — no verification_token, no diploma paths, no email
      id: true,
      folio: true,
      student_name: true,
      program: true,
      issued_date: true,
      status: true,
      revoked_at: true,
      revocation_reason: true,
      photo_path: true,     // fetched only to compute has_photo — stripped below
      generation_id: true,  // fetched only for ownership check — not passed to UI
      created_at: true,
      updated_at: true,
      generation: {
        select: { id: true, name: true, folio_prefix: true, folio_year: true, created_by: true },
      },
    },
  })

  if (!raw) notFound()

  // Ownership check: non-superadmin can only view certs from their own generations
  if (
    session?.user.role !== 'superadmin' &&
    raw.generation.created_by !== session?.user.id
  ) {
    notFound() // 404 rather than 403 — don't confirm the cert exists
  }

  // Strip sensitive fields before passing to UI layer
  const { photo_path, generation_id: _generationId, generation, ...rest } = raw

  const certificate: CertificateDetailItem = {
    ...rest,
    status: rest.status as CertificateStatus,
    has_photo: !!photo_path,
    issued_date: rest.issued_date?.toISOString() ?? null,
    revoked_at: rest.revoked_at?.toISOString() ?? null,
    created_at: rest.created_at.toISOString(),
    updated_at: rest.updated_at.toISOString(),
    // generation: only expose the safe ref — not created_by
    generation: {
      id: generation.id,
      name: generation.name,
      folio_prefix: generation.folio_prefix,
      folio_year: generation.folio_year,
    },
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb / back link */}
      <nav aria-label="Ruta de navegación">
        <Link
          href="/admin/certificates"
          className="inline-flex min-h-[44px] items-center gap-1.5 py-2 text-sm text-gray-500 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
        >
          {/* Arrow left */}
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Certificados
        </Link>
      </nav>

      <CertificateDetail certificate={certificate} />
    </div>
  )
}
