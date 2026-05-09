import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { SAFE_GENERATION_DETAIL_SELECT } from '@/lib/api/selects'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { CsvUpload } from '@/components/admin/generations/CsvUpload'
import { TemplateUpload } from '@/components/admin/generations/TemplateUpload'
import { ZoneEditor } from '@/components/admin/generations/ZoneEditor'
import { PhotosUpload } from '@/components/admin/generations/PhotosUpload'
import { PreflightPanel } from '@/components/admin/generations/PreflightPanel'
import { GenerationProgress } from '@/components/admin/generations/GenerationProgress'
import { DownloadButtons } from '@/components/admin/generations/DownloadButtons'
import type { FieldZones, GenerationStatus } from '@/types/index'

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: `Generación — Seneto` }
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function GenerationDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)

  const where =
    session?.user.role !== 'superadmin'
      ? { id: params.id, created_by: session!.user.id }
      : { id: params.id }

  const generation = await prisma.generation.findFirst({
    where,
    select: { ...SAFE_GENERATION_DETAIL_SELECT, photos_zip_path: true },
  })

  if (!generation) notFound()

  const { name, status, folio_prefix, folio_year, total_count, processed_count, error_count, template, created_at, photos_zip_path } =
    generation

  const hasPhotos = photos_zip_path !== null
  const isDraft = status === 'draft'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href="/admin/generations"
          className="inline-flex min-h-[44px] items-center gap-1.5 py-2 text-sm text-gray-500 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Generaciones
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-gray-900">{name}</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {folio_prefix}-{folio_year}
              {template ? ` · ${template.name}` : ''}
            </p>
          </div>
          <StatusBadge status={status as GenerationStatus} />
        </div>
      </div>

      {/* Stats — hide when draft with no students yet to avoid showing 0/0/0 */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="text-sm font-medium text-gray-700">Resumen</h2>
        {isDraft && total_count === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            Sube la plantilla, define las zonas y carga el CSV de alumnos para comenzar.
          </p>
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-gray-500">Alumnos</dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">{total_count}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Procesados</dt>
              <dd className="mt-1 text-2xl font-semibold text-green-700">{processed_count}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Errores</dt>
              <dd className="mt-1 text-2xl font-semibold text-red-700">{error_count}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Creado</dt>
              <dd className="mt-1 text-sm font-medium text-gray-700">{formatDate(created_at)}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* Template upload — FE-005 */}
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-4 text-sm font-medium text-gray-700">Plantilla</h2>
        <TemplateUpload
          generationId={generation.id}
          disabled={!isDraft}
          existing={
            template
              ? {
                  name: template.name,
                  image_width_px: template.image_width_px,
                  image_height_px: template.image_height_px,
                }
              : null
          }
        />
      </section>

      {/* Zone editor — FE-006 */}
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-4 text-sm font-medium text-gray-700">Zonas del diploma</h2>
        <ZoneEditor
          generationId={generation.id}
          disabled={!isDraft}
          hasImage={(template?.image_width_px ?? null) !== null}
          imageWidthPx={template?.image_width_px ?? null}
          imageHeightPx={template?.image_height_px ?? null}
          initialZones={(template?.field_zones ?? null) as FieldZones | null}
        />
      </section>

      {/* CSV upload — FE-007 */}
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-4 text-sm font-medium text-gray-700">Alumnos (CSV)</h2>
        {total_count === 0 && status === 'draft' ? (
          <p className="mb-4 text-sm text-gray-400">
            Sube el CSV para agregar alumnos a esta generación.
          </p>
        ) : null}
        <CsvUpload
          generationId={generation.id}
          hasExistingStudents={total_count > 0}
          disabled={status !== 'draft'}
        />
      </section>

      {/* Photos upload — FE-008 */}
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-4 text-sm font-medium text-gray-700">Fotos</h2>
        <PhotosUpload
          generationId={generation.id}
          hasCsv={total_count > 0}
          isDraft={isDraft}
          hasPhotos={hasPhotos}
        />
      </section>

      {/* Preflight — FE-009 */}
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-4 text-sm font-medium text-gray-700">Verificación previa</h2>
        <PreflightPanel
          generationId={generation.id}
          status={status as GenerationStatus}
        />
      </section>

      {/* Generation — FE-010 */}
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-4 text-sm font-medium text-gray-700">Generación de diplomas</h2>
        <GenerationProgress
          generationId={generation.id}
          status={status as GenerationStatus}
          totalCount={total_count}
          processedCount={processed_count}
          errorCount={error_count}
        />
      </section>

      {/* Download — FE-011 */}
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-4 text-sm font-medium text-gray-700">Descarga</h2>
        <DownloadButtons
          generationId={generation.id}
          status={status as GenerationStatus}
          errorCount={error_count}
        />
      </section>
    </div>
  )
}
