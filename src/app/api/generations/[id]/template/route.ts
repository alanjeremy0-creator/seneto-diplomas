import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { storage } from '@/lib/storage/adapter'
import { validateOrigin } from '@/lib/api/origin'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'
import {
  validateMagicBytes,
  readPngDimensions,
  MAX_TEMPLATE_SIZE_BYTES,
} from '@/lib/api/upload'
import { SAFE_TEMPLATE_SELECT } from '@/lib/api/selects'

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

    if (buffer.length > MAX_TEMPLATE_SIZE_BYTES) {
      throw Errors.VALIDATION('El archivo supera el límite de 10 MB')
    }

    // Solo PNG permitido para plantillas de diploma
    const detected = validateMagicBytes(buffer, ['png'])
    if (!detected) {
      throw Errors.VALIDATION('Solo se permiten archivos PNG para plantillas de diploma')
    }

    const dimensions = readPngDimensions(buffer)

    // Obtener template_id de la generation
    const generation = await prisma.generation.findUnique({
      where: { id: params.id },
      select: { template_id: true },
    })
    if (!generation) throw Errors.NOT_FOUND('Generación')

    // Ruta determinista: una plantilla por generación, re-upload reemplaza
    const storagePath = `templates/${params.id}/template.png`
    await storage.put(storagePath, buffer)

    const template = await prisma.template.update({
      where: { id: generation.template_id },
      data: {
        file_path: storagePath,
        image_width_px: dimensions?.width ?? null,
        image_height_px: dimensions?.height ?? null,
      },
      select: SAFE_TEMPLATE_SELECT,
    })

    return NextResponse.json({ template }, { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
