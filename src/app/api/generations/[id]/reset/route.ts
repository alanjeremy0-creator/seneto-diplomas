import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateOrigin } from '@/lib/api/origin'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'
import { logAction } from '@/lib/api/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })
    }

    if (!validateOrigin(req)) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Origin no permitido' } }, { status: 403 })
    }

    await assertOwnership(session, params.id)

    const gen = await prisma.generation.findUnique({
      where: { id: params.id },
      select: { id: true, status: true }
    })

    if (!gen) throw Errors.NOT_FOUND('Generación')

    await prisma.$transaction([
      prisma.certificate.updateMany({
        where: { generation_id: params.id },
        data: {
          status: 'pending',
          diploma_pdf_path: null,
          diploma_png_path: null,
          error_message: null,
        }
      }),
      prisma.generation.update({
        where: { id: params.id },
        data: {
          status: 'ready',
          processed_count: 0,
          error_count: 0,
          zip_path: null,
        }
      })
    ])

    const userId = (session.user as { id?: string } | undefined)?.id
    await logAction({ action: 'generation_reset', userId, targetId: params.id })

    return NextResponse.json({ ok: true, message: 'Generación reseteada correctamente.' })
  } catch (error) {
    return handleApiError(error)
  }
}
