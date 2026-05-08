import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { storage } from '@/lib/storage/adapter'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'
import { logAction } from '@/lib/api/audit'

export async function GET(
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

    await assertOwnership(session, params.id)

    const generation = await prisma.generation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        status: true,
        zip_path: true,
        folio_prefix: true,
        folio_year: true,
      },
    })
    if (!generation) throw Errors.NOT_FOUND('Generación')

    if (generation.status !== 'completed') {
      throw Errors.CONFLICT(
        `La generación está en estado "${generation.status}". Solo se puede descargar cuando está completada.`
      )
    }

    if (!generation.zip_path) {
      throw Errors.NOT_FOUND('ZIP de resultados')
    }

    let buffer: Buffer
    try {
      buffer = await storage.get(generation.zip_path)
    } catch (e) {
      console.error('[download] storage.get failed:', e)
      throw Errors.NOT_FOUND('Archivo ZIP')
    }

    // Sanitize name for Content-Disposition header — prevent header injection
    const safeName =
      generation.name.replace(/[^a-zA-Z0-9_\-.]/g, '_').slice(0, 80) || 'generacion'

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      undefined

    // Audit outside the main flow — never blocks the download
    await logAction({
      userId: session.user.id,
      action: 'generation.zip_download',
      targetId: params.id,
      targetType: 'generation',
      ip,
      detail: {
        folio_prefix: generation.folio_prefix,
        folio_year: generation.folio_year,
      },
    })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="diplomas-${safeName}.zip"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
