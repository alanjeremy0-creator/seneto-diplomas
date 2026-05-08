import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'

export async function GET(
  _req: NextRequest,
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
        total_count: true,
        processed_count: true,
        error_count: true,
        updated_at: true,
      },
    })
    if (!generation) throw Errors.NOT_FOUND('Generación')

    // Return recent generation errors for UI display — no internal paths exposed
    const errors = await prisma.generationError.findMany({
      where: { generation_id: params.id },
      select: {
        id: true,
        student_name: true,
        row_number: true,
        error_type: true,
        error_detail: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
      take: 100,
    })

    return NextResponse.json({ generation, errors })
  } catch (error) {
    return handleApiError(error)
  }
}
