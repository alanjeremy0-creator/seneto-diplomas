import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { storage } from '@/lib/storage/adapter'
import { validateOrigin } from '@/lib/api/origin'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'
import { validateMagicBytes } from '@/lib/api/upload'
import { parseCsv } from '@/lib/csv/parser'

const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(
  req: NextRequest,
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

    if (!validateOrigin(req)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Origin no permitido' } },
        { status: 403 }
      )
    }

    await assertOwnership(session, params.id)

    const generation = await prisma.generation.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, folio_prefix: true, folio_year: true, folio_counter: true },
    })
    if (!generation) throw Errors.NOT_FOUND('Generación')

    if (generation.status !== 'draft') {
      throw Errors.VALIDATION(
        `No se puede subir CSV en estado "${generation.status}". La generación debe estar en borrador.`
      )
    }

    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof Blob)) {
      throw Errors.VALIDATION('Se requiere un archivo en el campo "file"')
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length === 0) {
      throw Errors.VALIDATION('El archivo está vacío')
    }

    if (buffer.length > MAX_CSV_SIZE_BYTES) {
      throw Errors.VALIDATION('El archivo supera el límite de 5 MB')
    }

    const detectedBinary = validateMagicBytes(buffer, ['png', 'jpg', 'zip'])
    if (detectedBinary) {
      throw Errors.VALIDATION('El archivo no es un CSV válido')
    }

    const csvText = buffer.toString('utf-8')

    if (csvText.includes('\x00')) {
      throw Errors.VALIDATION('El archivo contiene bytes nulos y no es un CSV válido')
    }

    const { rows, errors: parseErrors } = parseCsv(csvText)

    if (rows.length === 0 && parseErrors.length > 0) {
      throw Errors.VALIDATION(
        `El CSV no contiene filas válidas. Primer error: ${parseErrors[0].error_detail}`
      )
    }

    if (rows.length === 0) {
      throw Errors.VALIDATION('El CSV no contiene filas de datos')
    }

    const storagePath = `generations/${params.id}/upload.csv`

    // Build certificate data BEFORE the transaction so folio assignments are
    // deterministic even if the transaction is retried internally.
    //
    // Skip folio numbers already occupied by other generations sharing the same
    // prefix+year. This prevents P2002 conflicts without requiring DB cleanup.
    const folioPattern = `${generation.folio_prefix}-${generation.folio_year}-`
    const lastConflicting = await prisma.certificate.findFirst({
      where: {
        folio: { startsWith: folioPattern },
        NOT: { generation_id: params.id },
      },
      orderBy: { folio: 'desc' },
      select: { folio: true },
    })
    let folioCounter = generation.folio_counter
    if (lastConflicting) {
      const existingMax = parseInt(lastConflicting.folio.slice(folioPattern.length), 10)
      if (!isNaN(existingMax) && existingMax >= folioCounter) {
        folioCounter = existingMax + 1
      }
    }
    const certificateData = rows.map(({ data }) => {
      const folio =
        data.folio_override ??
        `${generation.folio_prefix}-${generation.folio_year}-${String(folioCounter++).padStart(4, '0')}`
      return {
        generation_id: params.id,
        folio,
        student_name: data.student_name ?? '',
        program: data.program ?? null,
        issued_date: data.issued_date ? new Date(data.issued_date) : null,
        status: 'pending' as const,
      }
    })

    // Transaction: delete stubs + create new stubs + update generation.
    // Storage write happens AFTER the transaction succeeds (BLOQ-B2-002).
    const result = await prisma.$transaction(async (tx) => {
      await tx.certificate.deleteMany({ where: { generation_id: params.id } })
      await tx.generationError.deleteMany({ where: { generation_id: params.id } })

      await tx.certificate.createMany({ data: certificateData })

      if (parseErrors.length > 0) {
        await tx.generationError.createMany({
          data: parseErrors.map((e) => ({
            generation_id: params.id,
            student_name: e.student_name ?? null,
            row_number: e.row_number,
            error_type: 'invalid_data',
            error_detail: e.error_detail,
          })),
        })
      }

      return tx.generation.update({
        where: { id: params.id },
        data: {
          csv_path: storagePath,
          total_count: rows.length,
          error_count: parseErrors.length,
        },
        select: {
          id: true,
          name: true,
          status: true,
          total_count: true,
          error_count: true,
        },
      })
    })

    // Write to storage only after DB transaction commits (BLOQ-B2-002).
    // If this fails, the client receives 500 and can retry; re-upload will overwrite.
    await storage.put(storagePath, buffer)

    return NextResponse.json(
      {
        generation: result,
        summary: {
          accepted: rows.length,
          rejected: parseErrors.length,
          errors: parseErrors,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Prisma 7 + adapter-pg does not populate meta.target; any P2002 here is a
      // folio conflict since verification_token is auto-generated (no realistic collision).
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Uno o más folios ya están en uso en otra generación',
          },
        },
        { status: 400 }
      )
    }
    return handleApiError(error)
  }
}
