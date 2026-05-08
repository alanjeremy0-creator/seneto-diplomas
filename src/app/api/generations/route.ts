import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateOrigin } from '@/lib/api/origin'
import { handleApiError, Errors } from '@/lib/api/errors'
import { SAFE_GENERATION_SELECT } from '@/lib/api/selects'
import type { GenerationCreateRequest } from '@/types/api'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
        { status: 401 }
      )
    }

    const where =
      session.user.role === 'superadmin' ? {} : { created_by: session.user.id }

    const generations = await prisma.generation.findMany({
      where,
      select: SAFE_GENERATION_SELECT,
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({ generations })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
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

    const body: GenerationCreateRequest = await req.json()

    if (!body.name?.trim()) {
      throw Errors.VALIDATION('El nombre es requerido')
    }

    const name = body.name.trim()

    // Template se crea junto con la generación; BE-002 actualiza file_path y field_zones
    const generation = await prisma.$transaction(async (tx) => {
      const template = await tx.template.create({
        data: { name: `${name} — plantilla` },
      })
      return tx.generation.create({
        data: {
          name,
          template_id: template.id,
          folio_prefix: body.folio_prefix?.trim() || 'SEN',
          folio_year: body.folio_year ?? new Date().getFullYear(),
          folio_counter: body.folio_counter ?? 1,
          created_by: session.user.id,
        },
        select: SAFE_GENERATION_SELECT,
      })
    })

    return NextResponse.json({ generation }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
