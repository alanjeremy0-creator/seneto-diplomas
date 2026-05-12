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

  // Reset completo: generación + todos sus certificados a estado inicial
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

  return NextResponse.json({ ok: true, message: 'Generación y certificados reseteados. Re-sube el template y genera de nuevo.' })
}
