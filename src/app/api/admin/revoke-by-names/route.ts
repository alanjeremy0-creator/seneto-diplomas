// TEMPORAL — eliminar después de limpiar los certificados incorrectos.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { generationIds, studentNames, action = 'revoke' }: {
    generationIds: string[]
    studentNames: string[]
    action?: 'revoke' | 'delete'
  } = await req.json()

  if (!generationIds?.length || !studentNames?.length) {
    return NextResponse.json({ error: 'generationIds y studentNames son requeridos' }, { status: 400 })
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
    return NextResponse.json({
      ok: true,
      deleted: found.length,
      detail: found.map(c => ({ folio: c.folio, name: c.student_name, action: 'eliminado' }))
    })
  }

  // default: revoke
  await prisma.certificate.updateMany({
    where: { id: { in: ids } },
    data: { status: 'revoked' }
  })

  return NextResponse.json({
    ok: true,
    revoked: found.length,
    detail: found.map(c => ({ folio: c.folio, name: c.student_name, action: 'revocado' }))
  })
}
