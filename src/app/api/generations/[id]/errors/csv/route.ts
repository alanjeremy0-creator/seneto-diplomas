import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'

// Sanitizes a value for a CSV cell: strips formula-injection starters, wraps in quotes
function csvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/^[=+\-@|%\t\r\n]+/, '')
  return `"${str.replace(/"/g, '""')}"`
}

function buildErrorCsv(
  errors: {
    row_number: number | null
    student_name: string | null
    error_type: string
    error_detail: string | null
  }[]
): string {
  const header = '"row_number","student_name","error_type","error_detail"'
  const rows = errors.map((e) =>
    [
      csvCell(e.row_number),
      csvCell(e.student_name),
      csvCell(e.error_type),
      csvCell(e.error_detail),
    ].join(',')
  )
  return [header, ...rows].join('\r\n')
}

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
      select: { id: true, name: true },
    })
    if (!generation) throw Errors.NOT_FOUND('Generación')

    const errors = await prisma.generationError.findMany({
      where: { generation_id: params.id },
      select: {
        row_number: true,
        student_name: true,
        error_type: true,
        error_detail: true,
      },
      orderBy: { row_number: 'asc' },
    })

    const csv = buildErrorCsv(errors)
    const safeName = generation.name.replace(/[^a-zA-Z0-9_\-.]/g, '_').slice(0, 80) || 'generacion'

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="errores-${safeName}.csv"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
