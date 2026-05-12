import { prisma } from '../db'
import { storage } from '../storage/adapter'
import { generateQrBuffer } from './qr'
import { composeDiplomaPng, FieldZones as ComposerFieldZones } from './composer'
import { embedPngInPdf } from './pdf'
import { buildDiplomasZipLazy } from './zipper'

export function mapPrismaZonesToComposer(prismaZones: any): ComposerFieldZones | undefined {
  if (!prismaZones) return undefined

  const mapText = (z: any) => (z ? { ...z, color: z.fontColor } : undefined)

  return {
    studentName: mapText(prismaZones.name),
    photo: prismaZones.photo,
    qr: prismaZones.qr ? { ...prismaZones.qr, width: prismaZones.qr.size, height: prismaZones.qr.size } : undefined,
    program: mapText(prismaZones.program),
    folio: mapText(prismaZones.folio),
    issuedDate: mapText(prismaZones.date)
  }
}

function sanitizeError(err: any): string {
  const msg = err?.message || String(err)
  // Remove absolute paths
  const sanitized = msg.replace(/(?:\/|\\)[a-zA-Z0-9_.-]+(?:\/|\\)[a-zA-Z0-9_.-/]+/g, '[PATH]')
  return sanitized.substring(0, 500)
}

export async function runGenerationEngine(generationId: string): Promise<void> {
  const baseUrl = process.env.PUBLIC_VERIFY_BASE_URL
  if (!baseUrl) {
    throw new Error('Fatal: PUBLIC_VERIFY_BASE_URL is not defined in environment')
  }

  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    include: {
      template: true,
      certificates: {
        where: { status: 'pending' }
      }
    }
  })

  if (!generation) {
    throw new Error(`Generation ${generationId} not found`)
  }

  if (generation.status !== 'processing') {
    throw new Error(`Generation ${generationId} is not in processing state. Current: ${generation.status}`)
  }

  if (!generation.template || !generation.template.file_path) {
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: 'failed' }
    })
    throw new Error(`Generation ${generationId} template has no file_path`)
  }

  if (generation.certificates.length === 0) {
    // 0 pending certificates. Mark as completed if previously progressed, otherwise failed.
    const finalStatus = generation.processed_count > 0 ? 'completed' : 'failed'
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: finalStatus }
    })
    return
  }

  const fieldZones = mapPrismaZonesToComposer(generation.template.field_zones)
  
  // Attempt to load the template buffer. If this fails, fail the whole generation.
  let templateBuffer: Buffer
  try {
    templateBuffer = await storage.get(generation.template.file_path)
  } catch (err: any) {
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: 'failed' }
    })
    throw new Error(`Failed to load template buffer: ${err.message}`)
  }

  for (const cert of generation.certificates) {
    try {
      let photoBuffer: Buffer | undefined = undefined
      if (cert.photo_path && await storage.exists(cert.photo_path)) {
        photoBuffer = await storage.get(cert.photo_path)
      }

      const { buffer: qrBuffer } = await generateQrBuffer({
        verificationToken: cert.verification_token,
        baseUrl
      })

      let formattedDate: string | undefined = undefined
      if (cert.issued_date) {
        formattedDate = new Date(cert.issued_date).toISOString().split('T')[0]
      }

      const pngBuffer = await composeDiplomaPng({
        templateBuffer,
        fieldZones,
        studentName: cert.student_name,
        program: cert.program ?? '',
        folio: cert.folio,
        issuedDate: formattedDate,
        qrBuffer,
        photoBuffer
      })

      const pdfBuffer = await embedPngInPdf(pngBuffer, { pagePreset: 'LETTER_PORTRAIT' })
      const pdfNodeBuffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer)

      const pngPath = `diplomas/${generationId}/${cert.folio}.png`
      const pdfPath = `diplomas/${generationId}/${cert.folio}.pdf`

      await storage.put(pngPath, pngBuffer)
      await storage.put(pdfPath, pdfNodeBuffer)

      await prisma.certificate.update({
        where: { id: cert.id },
        data: {
          status: 'active',
          diploma_png_path: pngPath,
          diploma_pdf_path: pdfPath,
          error_message: null
        }
      })

      await prisma.generation.update({
        where: { id: generationId },
        data: { processed_count: { increment: 1 } }
      })

    } catch (err: any) {
      const safeErrorMsg = sanitizeError(err)

      await prisma.certificate.update({
        where: { id: cert.id },
        data: { error_message: safeErrorMsg }
      })

      await prisma.generationError.create({
        data: {
          generation_id: generationId,
          error_type: 'render_error',
          student_name: cert.student_name,
          error_detail: safeErrorMsg
        }
      })

      await prisma.generation.update({
        where: { id: generationId },
        data: { error_count: { increment: 1 } }
      })
    }
  }

  // Finalization: leer PDFs de storage uno por uno para construir el ZIP.
  // Esto evita acumular todos los buffers en RAM (O(1) en lugar de O(N)).
  // También incluye diplomas de runs anteriores, soportando reintento parcial.
  const activeCerts = await prisma.certificate.findMany({
    where: {
      generation_id: generationId,
      status: 'active',
      diploma_pdf_path: { not: null }
    },
    select: { folio: true, diploma_pdf_path: true },
    orderBy: { folio: 'asc' }
  })

  if (activeCerts.length > 0) {
    const zipBuffer = await buildDiplomasZipLazy(
      activeCerts.map(c => ({
        name: `${c.folio}.pdf`,
        getBuffer: () => storage.get(c.diploma_pdf_path!)
      }))
    )
    const zipPath = `zips/${generationId}/diplomas.zip`
    await storage.put(zipPath, zipBuffer)

    await prisma.generation.update({
      where: { id: generationId },
      data: { status: 'completed', zip_path: zipPath }
    })
  } else {
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: 'failed' }
    })
  }
}
