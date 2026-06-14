import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateOrigin } from '@/lib/api/origin'
import { handleApiError, Errors } from '@/lib/api/errors'
import { logAction } from '@/lib/api/audit'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })
    }

    if (!validateOrigin(req)) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Origin no permitido' } }, { status: 403 })
    }

    const user = session.user as { id: string; role: string }
    if (user.role !== 'superadmin') {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Solo superadmin puede usar este endpoint' } }, { status: 403 })
    }

    const { generationIds, studentNames, action = 'revoke' }: {
      generationIds: string[]
      studentNames: string[]
      action?: 'revoke' | 'delete'
    } = await req.json()

    if (!generationIds?.length || !studentNames?.length) {
      throw Errors.VALIDATION('generationIds y studentNames son requeridos')
    }

    const found = await prisma.certificate.findMany({
      where: {
        generation_id: { in: generationIds },
        student_name: { in: studentNames },
      },
      select: { id: true, folio: true, student_name: true, status: true, generation_id: true }
    })

    if (found.length === 0) {
      return NextResponse.json({ ok: true, affected: 0, detail: 'No se encontraron certificados con esos nombres.' })
    }

    const ids = found.map(c => c.id)

    if (action === 'delete') {
      await prisma.certificate.deleteMany({ where: { id: { in: ids } } })
      await logAction({ action: 'certificates_bulk_delete', userId: user.id, detail: { count: ids.length, generationIds, studentNames } })
      return NextResponse.json({
        ok: true,
        deleted: found.length,
        detail: found.map(c => ({ folio: c.folio, name: c.student_name, action: 'eliminado' }))
      })
    }

    // default: revoke
    await prisma.certificate.updateMany({
      where: { id: { in: ids } },
      data: { status: 'revoked', revoked_at: new Date() }
    })
    await logAction({ action: 'certificates_bulk_revoke', userId: user.id, detail: { count: ids.length, generationIds, studentNames } })

    return NextResponse.json({
      ok: true,
      revoked: found.length,
      detail: found.map(c => ({ folio: c.folio, name: c.student_name, action: 'revocado' }))
    })
  } catch (error) {
    return handleApiError(error)
  }
}
