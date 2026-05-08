import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateOrigin } from '@/lib/api/origin'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'
import { logAction } from '@/lib/api/audit'

// Safe response select — no internal storage paths exposed to clients
const GENERATION_SELECT = {
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

    // Fetch audit log details and existence check before entering transaction
    const generation = await prisma.generation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        folio_prefix: true,
        folio_year: true,
        total_count: true,
      },
    })
    if (!generation) throw Errors.NOT_FOUND('Generación')

    // Sprint 1 stub: synchronous generation simulation.
    // Real async PDF/PNG generation is implemented in Sprint 1b.
    const result = await prisma.$transaction(async (tx) => {
      // Atomic check + transition — prevents concurrent double-start (BLOQ-B3-002)
      // Only succeeds if status is currently 'ready'; second concurrent request gets count=0
      const transitioned = await tx.generation.updateMany({
        where: { id: params.id, status: 'ready' },
        data: { status: 'processing' },
      })

      if (transitioned.count === 0) {
        const current = await tx.generation.findUnique({
          where: { id: params.id },
          select: { status: true },
        })
        throw Errors.CONFLICT(
          `La generación está en estado "${current?.status ?? 'desconocido'}" y no puede iniciarse. Se requiere estado "ready".`
        )
      }

      // Stub: mark all pending certificates as active (simulates successful render)
      const updated = await tx.certificate.updateMany({
        where: { generation_id: params.id, status: 'pending' },
        data: { status: 'active' },
      })

      // Transition to completed with updated counters
      return tx.generation.update({
        where: { id: params.id },
        data: {
          status: 'completed',
          processed_count: updated.count,
        },
        select: GENERATION_SELECT,
      })
    })

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      undefined

    // Audit log outside transaction — best effort, never blocks the main flow
    await logAction({
      userId: session.user.id,
      action: 'generation.started',
      targetId: params.id,
      targetType: 'generation',
      ip,
      detail: {
        folio_prefix: generation.folio_prefix,
        folio_year: generation.folio_year,
        total_count: generation.total_count,
        stub: true,
      },
    })

    return NextResponse.json({ generation: result }, { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
