import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError } from '@/lib/api/errors'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const VALID_STATUSES = new Set(['pending', 'active', 'revoked', 'expired'])

// photo_path fetched to compute has_photo; stripped before response
const CERT_LIST_SELECT = {
  id: true,
  folio: true,
  student_name: true,
  program: true,
  issued_date: true,
  status: true,
  photo_path: true,
  created_at: true,
  updated_at: true,
  generation: {
    select: { id: true, name: true, folio_prefix: true, folio_year: true },
  },
} as const

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)

    // q — folio or student_name substring, capped to prevent excessively long queries
    const q = searchParams.get('q')?.trim().slice(0, 200) || undefined

    // status — validated against known values to avoid noise in DB queries
    const rawStatus = searchParams.get('status')
    const status = rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : undefined

    // generation_id — optional filter
    const generationId = searchParams.get('generation_id')?.slice(0, 50) || undefined

    // pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    )
    const skip = (page - 1) * limit

    const where = {
      // Non-superadmin users only see certificates from generations they own
      ...(session.user.role !== 'superadmin'
        ? { generation: { created_by: session.user.id } }
        : {}),
      ...(generationId ? { generation_id: generationId } : {}),
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { folio: { contains: q, mode: 'insensitive' as const } },
              { student_name: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [rawCerts, total] = await prisma.$transaction([
      prisma.certificate.findMany({
        where,
        select: CERT_LIST_SELECT,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.certificate.count({ where }),
    ])

    // Strip internal photo_path; expose computed has_photo instead
    const certificates = rawCerts.map(({ photo_path, ...rest }) => ({
      ...rest,
      has_photo: !!photo_path,
    }))

    return NextResponse.json({
      certificates,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
