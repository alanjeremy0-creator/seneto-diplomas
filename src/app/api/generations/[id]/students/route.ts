import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'

const STUDENT_SELECT = {
  id: true,
  folio: true,
  student_name: true,
  program: true,
  issued_date: true,
  status: true,
  photo_path: true,
  error_message: true,
  created_at: true,
  updated_at: true,
} as const

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
      select: { id: true },
    })
    if (!generation) throw Errors.NOT_FOUND('Generación')

    const raw = await prisma.certificate.findMany({
      where: { generation_id: params.id },
      select: STUDENT_SELECT,
      orderBy: { created_at: 'asc' },
    })

    // Expose has_photo (boolean) instead of internal storage path
    const students = raw.map(({ photo_path, ...rest }) => ({
      ...rest,
      has_photo: !!photo_path,
    }))

    return NextResponse.json({ students })
  } catch (error) {
    return handleApiError(error)
  }
}
