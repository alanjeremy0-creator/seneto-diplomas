import { prisma } from '../db'
import { storage } from '../storage/adapter'
import { generateQrBuffer } from './qr'
import { composeDiplomaPng, FieldZones as ComposerFieldZones } from './composer'
import { embedPngInPdf } from './pdf'
import { createDiplomasZipStream } from './zipper'
import type { FieldZone, FieldZones } from '@/types'

export function mapPrismaZonesToComposer(prismaZones: FieldZones | null | undefined): ComposerFieldZones | undefined {
  if (!prismaZones) return undefined

  const mapText = (z: FieldZone | undefined) => (z ? { ...z, color: z.fontColor } : undefined)

  return {
    studentName: mapText(prismaZones.name),
    photo: prismaZones.photo,
    qr: prismaZones.qr ? { ...prismaZones.qr, width: prismaZones.qr.size, height: prismaZones.qr.size } : undefined,
    program: mapText(prismaZones.program),
    folio: mapText(prismaZones.folio),
    issuedDate: mapText(prismaZones.date)
  }
}

function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
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
    select: {
      id: true,
      status: true,
      processed_count: true,
      template: {
        select: {
          file_path: true,
          field_zones: true,
        }
      },
      certificates: {
        where: { status: 'pending' },
        select: {
          id: true,
          folio: true,
          student_name: true,
          program: true,
          issued_date: true,
          verification_token: true,
          photo_path: true,
        }
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

  const fieldZones = mapPrismaZonesToComposer(generation.template.field_zones as FieldZones | null)

  // Attempt to load the template buffer. If this fails, fail the whole generation.
  let templateBuffer: Buffer
  try {
    templateBuffer = await storage.get(generation.template.file_path)
  } catch (err: unknown) {
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: 'failed' }
    })
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to load template buffer: ${msg}`)
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

      let pngBuffer: Buffer = await composeDiplomaPng({
        templateBuffer,
        fieldZones,
        studentName: cert.student_name,
        program: cert.program ?? '',
        folio: cert.folio,
        issuedDate: formattedDate,
        qrBuffer,
        photoBuffer
      })

      const pdfBuffer = await embedPngInPdf(pngBuffer, { pagePreset: 'DIPLOMA_PORTRAIT' })
      let pdfNodeBuffer: Buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer)

      const pngPath = `diplomas/${generationId}/${cert.folio}.png`
      const pdfPath = `diplomas/${generationId}/${cert.folio}.pdf`

      await storage.put(pngPath, pngBuffer)
      pngBuffer = Buffer.alloc(0)  // liberar referencia para GC

      await storage.put(pdfPath, pdfNodeBuffer)
      pdfNodeBuffer = Buffer.alloc(0)  // liberar referencia para GC

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

    } catch (err: unknown) {
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

    // Yield the event loop so V8 can collect freed buffers before next diploma
    await new Promise<void>(r => setImmediate(r))
  }

  // Finalization: el ZIP se escribe a storage en streaming, un PDF a la vez,
  // sin acumular el archivo completo en RAM (memoria constante, no O(N)).
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
    const zipPath = `zips/${generationId}/diplomas.zip`
    await storage.putStream(
      zipPath,
      createDiplomasZipStream(
        activeCerts.map(c => ({
          name: `${c.folio}.pdf`,
          getStream: () => storage.getStream(c.diploma_pdf_path!)
        }))
      )
    )

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
