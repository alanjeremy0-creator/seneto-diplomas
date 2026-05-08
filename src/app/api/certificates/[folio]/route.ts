import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'

// photo_path and generation_id fetched internally; photo_path stripped, generation_id
// kept in response (not sensitive — mirrors generation.id in nested object)
const CERT_DETAIL_SELECT = {
  id: true,
  folio: true,
  student_name: true,
  program: true,
  issued_date: true,
  status: true,
  revoked_at: true,
  revocation_reason: true,
  photo_path: true,
  generation_id: true,
  created_at: true,
  updated_at: true,
  generation: {
    select: { id: true, name: true, folio_prefix: true, folio_year: true },
  },
} as const

export async function GET(
  _req: NextRequest,
  { params }: { params: { folio: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
        { status: 401 }
      )
    }

    const raw = await prisma.certificate.findUnique({
      where: { folio: params.folio },
      select: CERT_DETAIL_SELECT,
    })

    if (!raw) throw Errors.NOT_FOUND('Certificado')

    // Ownership check via the generation this certificate belongs to
    await assertOwnership(session, raw.generation_id)

    // Strip internal photo_path; expose computed has_photo
    const { photo_path, ...rest } = raw
    const certificate = { ...rest, has_photo: !!photo_path }

    return NextResponse.json({ certificate })
  } catch (error) {
    return handleApiError(error)
  }
}
