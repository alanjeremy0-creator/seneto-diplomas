import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateOrigin } from '@/lib/api/origin'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'
import { logAction } from '@/lib/api/audit'

interface PreflightIssue {
  code: string
  message: string
}

// Safe response select — no internal storage paths exposed to clients
const PREFLIGHT_RESPONSE_SELECT = {
  id: true,
  name: true,
  status: true,
  folio_prefix: true,
  folio_year: true,
  total_count: true,
  processed_count: true,
  error_count: true,
  created_at: true,
  updated_at: true,
  template: {
    select: { id: true, name: true },
  },
} as const

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
        { status: 401 }
      )
    }

    if (!validateOrigin(req)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Origin no permitido' } },
        { status: 403 }
      )
    }

    await assertOwnership(session, params.id)

    // Internal query — paths used for business logic only, never returned to client
    const generation = await prisma.generation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        csv_path: true,
        photos_zip_path: true,
        total_count: true,
        error_count: true,
        template: {
          select: { file_path: true, field_zones: true },
        },
      },
    })

    if (!generation) throw Errors.NOT_FOUND('Generación')

    if (generation.status !== 'draft') {
      throw Errors.VALIDATION(
        `La generación ya está en estado "${generation.status}" y no puede volver a pre-vuelo`
      )
    }

    const blockers: PreflightIssue[] = []
    const warnings: PreflightIssue[] = []

    // --- Blockers ---
    if (!generation.template.file_path) {
      blockers.push({
        code: 'NO_TEMPLATE_IMAGE',
        message: 'La plantilla no tiene imagen cargada',
      })
    }

    if (!generation.csv_path) {
      blockers.push({
        code: 'NO_CSV',
        message: 'No se ha subido el CSV de estudiantes',
      })
    }

    if (generation.total_count === 0) {
      blockers.push({
        code: 'NO_STUDENTS',
        message: 'No hay estudiantes registrados en esta generación',
      })
    }

    // --- Warnings (do not block 'ready' transition) ---
    if (!generation.photos_zip_path) {
      warnings.push({
        code: 'NO_PHOTOS',
        message: 'No se han subido fotos; los diplomas se generarán sin fotografía',
      })
    }

    if (!generation.template.field_zones) {
      warnings.push({
        code: 'NO_FIELD_ZONES',
        message:
          'Las zonas de campo no están configuradas; se usarán valores por defecto en la generación',
      })
    }

    if (generation.error_count > 0) {
      warnings.push({
        code: 'CSV_HAS_ERRORS',
        message: `${generation.error_count} fila(s) del CSV tienen errores y no se procesarán`,
      })
    }

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          preflight: {
            passed: false,
            blockers,
            warnings,
          },
        },
        { status: 422 }
      )
    }

    // All blockers passed — transition to 'ready', return safe response shape
    const updated = await prisma.generation.update({
      where: { id: params.id },
      data: { status: 'ready' },
      select: PREFLIGHT_RESPONSE_SELECT,
    })

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      undefined

    // Audit outside main flow — best effort, never blocks response
    await logAction({
      userId: session.user.id,
      action: 'generation.preflight_passed',
      targetId: params.id,
      targetType: 'generation',
      ip,
    })

    return NextResponse.json({
      preflight: {
        passed: true,
        blockers: [],
        warnings,
      },
      generation: updated,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
