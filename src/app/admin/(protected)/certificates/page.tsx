import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Suspense } from 'react'
import type { CertificateStatus } from '@/types/index'
import type { CertificateListItem, CertificateListResponse } from '@/types/api'
import { CertificateList } from '@/components/admin/certificates/CertificateList'
import { CertificateFilters } from '@/components/admin/certificates/CertificateFilters'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSkeletonCard } from '@/components/ui/LoadingSkeleton'

export const metadata = { title: 'Certificados — Seneto' }

const PAGE_SIZE = 20
const VALID_STATUSES = new Set<string>(['pending', 'active', 'revoked', 'expired'])

// Only the fields needed for the generations filter dropdown — no sensitive data
const GENERATION_DROPDOWN_SELECT = { id: true, name: true, folio_prefix: true, folio_year: true } as const

interface PageProps {
  searchParams: {
    q?: string
    status?: string
    generation_id?: string
    page?: string
  }
}

export default async function CertificatesPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)

  // Sanitize query params
  const q = searchParams.q?.trim().slice(0, 200) || undefined
  const status = searchParams.status && VALID_STATUSES.has(searchParams.status)
    ? (searchParams.status as CertificateStatus)
    : undefined
  const generationId = searchParams.generation_id?.slice(0, 50) || undefined
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  // Ownership filter: non-superadmin can only see their own generations' certs
  const ownershipFilter =
    session?.user.role !== 'superadmin'
      ? { generation: { created_by: session!.user.id } }
      : {}

  const where = {
    ...ownershipFilter,
    ...(generationId ? { generation_id: generationId } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { folio: { contains: q, mode: 'insensitive' as const } },
            { student_name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  // Fetch certificates and total count in parallel
  const [rawCerts, total, generations] = await Promise.all([
    prisma.certificate.findMany({
      where,
      select: {
        // safe fields only — no verification_token, no photo_path, no diploma paths
        id: true,
        folio: true,
        student_name: true,
        program: true,
        issued_date: true,
        status: true,
        photo_path: true, // fetched only to compute has_photo — stripped below
        created_at: true,
        updated_at: true,
        generation: { select: { id: true, name: true, folio_prefix: true, folio_year: true } },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.certificate.count({ where }),
    prisma.generation.findMany({
      where: session?.user.role !== 'superadmin' ? { created_by: session!.user.id } : {},
      select: GENERATION_DROPDOWN_SELECT,
      orderBy: { created_at: 'desc' },
      take: 100,
    }),
  ])

  // Strip photo_path — expose only the computed boolean has_photo
  const certificates: CertificateListItem[] = rawCerts.map(({ photo_path, ...rest }) => ({
    ...rest,
    status: rest.status as CertificateStatus,
    has_photo: !!photo_path,
    issued_date: rest.issued_date?.toISOString() ?? null,
    created_at: rest.created_at.toISOString(),
    updated_at: rest.updated_at.toISOString(),
  }))

  const pages = Math.ceil(total / PAGE_SIZE)
  const pagination: CertificateListResponse['pagination'] = { total, page, limit: PAGE_SIZE, pages }

  // Rebuild query string for pagination links
  const qsObject: Record<string, string> = {}
  if (q) qsObject.q = q
  if (status) qsObject.status = status
  if (generationId) qsObject.generation_id = generationId
  const searchParamsString = new URLSearchParams(qsObject).toString()

  const hasActiveFilter = !!(q || status || generationId)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Certificados</h1>
        <p className="mt-1 text-sm text-gray-500">
          Busca y consulta los certificados generados.
        </p>
      </div>

      {/* Filters — Client Component */}
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <Suspense fallback={<LoadingSkeletonCard />}>
          <CertificateFilters generations={generations} />
        </Suspense>
      </div>

      {/* Results */}
      {certificates.length === 0 ? (
        <EmptyState
          title={hasActiveFilter ? 'Sin resultados' : 'Sin certificados'}
          description={
            hasActiveFilter
              ? `No se encontraron certificados${q ? ` para «${q}»` : ''}.`
              : 'Los certificados aparecerán aquí una vez que completes una generación.'
          }
        />
      ) : (
        <CertificateList
          certificates={certificates}
          pagination={pagination}
          searchParamsString={searchParamsString}
        />
      )}
    </div>
  )
}
