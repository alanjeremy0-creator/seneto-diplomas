// TEMPORAL — eliminar después de resetear la generación atascada.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const gen = await prisma.generation.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, created_by: true }
  })

  if (!gen) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (gen.created_by !== (session.user as any).id && (session.user as any).role !== 'superadmin') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }
  if (gen.status !== 'processing') {
    return NextResponse.json({ error: `Estado actual: ${gen.status}. Solo se puede resetear si está en 'processing'.` }, { status: 400 })
  }

  const updated = await prisma.generation.update({
    where: { id: params.id },
    data: { status: 'ready' },
    select: { id: true, status: true, processed_count: true, total_count: true }
  })

  return NextResponse.json({ ok: true, generation: updated })
}
