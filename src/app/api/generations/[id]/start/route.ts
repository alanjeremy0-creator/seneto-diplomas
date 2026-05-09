import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateOrigin } from '@/lib/api/origin'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'
import { logAction } from '@/lib/api/audit'

import { runGenerationEngine } from '@/lib/diploma/engine'

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

    // Atomic check + transition — prevents concurrent double-start (BLOQ-B3-002)
    // Only succeeds if status is currently 'ready'; second concurrent request gets count=0
    const transitioned = await prisma.generation.updateMany({
      where: { id: params.id, status: 'ready' },
      data: { status: 'processing' },
    })

    if (transitioned.count === 0) {
      const current = await prisma.generation.findUnique({
        where: { id: params.id },
        select: { status: true },
      })
      throw Errors.CONFLICT(
        `La generación está en estado "${current?.status ?? 'desconocido'}" y no puede iniciarse. Se requiere estado "ready".`
      )
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      undefined

    // Audit log — best effort, never blocks the main flow
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
        stub: false,
      },
    })

    // S3A-005: Fire-and-forget generation engine
    runGenerationEngine(params.id).catch(async (err) => {
      console.error(`Fatal Engine Error [${params.id}]:`, err)
      // Fallback in case engine fails before its internal try-catch 
      // or if internal try-catch fails to update status.
      try {
        await prisma.generation.update({
          where: { id: params.id },
          data: { status: 'failed' }
        })
      } catch (dbErr) {
        console.error(`Failed to set generation ${params.id} to failed state:`, dbErr)
      }
    })

    return NextResponse.json({ status: 'processing' }, { status: 202 })
  } catch (error) {
    return handleApiError(error)
  }
}
