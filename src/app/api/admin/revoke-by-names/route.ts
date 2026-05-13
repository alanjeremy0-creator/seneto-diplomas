// TEMPORAL — eliminar después de revocar los certificados incorrectos.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { generationIds, studentNames }: {
    generationIds: string[]
    studentNames: string[]
  } = await req.json()

  if (!generationIds?.length || !studentNames?.length) {
    return NextResponse.json({ error: 'generationIds y studentNames son requeridos' }, { status: 400 })
  }

  // Buscar certificados que coincidan en esas generaciones
  const found = await prisma.certificate.findMany({
    where: {
      generation_id: { in: generationIds },
      student_name: { in: studentNames },
    },
    select: { id: true, folio: true, student_name: true, status: true, generation_id: true }
  })

  if (found.length === 0) {
    return NextResponse.json({ ok: true, revoked: 0, detail: 'No se encontraron certificados con esos nombres.' })
  }

  // Revocar solo los que están activos
  const toRevoke = found.filter(c => c.status === 'active').map(c => c.id)

  if (toRevoke.length > 0) {
    await prisma.certificate.updateMany({
      where: { id: { in: toRevoke } },
      data: { status: 'revoked' }
    })
  }

  return NextResponse.json({
    ok: true,
    revoked: toRevoke.length,
    detail: found.map(c => ({
      folio: c.folio,
      name: c.student_name,
      generation_id: c.generation_id,
      status_before: c.status,
      action: toRevoke.includes(c.id) ? 'revocado' : 'ya estaba en ' + c.status
    }))
  })
}
