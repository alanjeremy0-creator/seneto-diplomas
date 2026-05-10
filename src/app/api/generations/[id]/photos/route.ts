import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import yauzl from 'yauzl'
import path from 'path'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { storage } from '@/lib/storage/adapter'
import { validateOrigin } from '@/lib/api/origin'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'
import { validateMagicBytes, AllowedFileType } from '@/lib/api/upload'

const MAX_ZIP_SIZE_BYTES = 200 * 1024 * 1024       // 200 MB compressed
const MAX_ENTRIES = 500
const MAX_ENTRY_UNCOMPRESSED_BYTES = 10 * 1024 * 1024  // 10 MB per photo
const MAX_TOTAL_UNCOMPRESSED_BYTES = 200 * 1024 * 1024 // 200 MB all photos combined
const MAX_COMPRESSION_RATIO = 50

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])
const ALLOWED_MAGIC_TYPES: AllowedFileType[] = ['png', 'jpg']

type ErrorKind = 'invalid_file' | 'unmatched_name' | 'traversal' | 'size_limit' | 'zip_bomb' | 'duplicate_name' | 'empty_name'

interface PhotoError {
  entry: string
  reason: string
  error_type: ErrorKind
}

interface PhotoData {
  buffer: Buffer
  ext: string
  certId: string
}

function isSafePath(name: string): boolean {
  if (name.includes('..')) return false
  if (name.startsWith('/')) return false
  if (name.startsWith('\\')) return false
  if (name.includes('\x00')) return false
  return true
}

function openZip(buffer: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) reject(err ?? new Error('No se pudo abrir el ZIP'))
      else resolve(zipfile)
    })
  })
}

// Stream-decompress a single entry with a hard byte limit (BLOQ-B2-004).
// Aborts mid-stream if the limit is reached, preventing unbounded memory allocation.
function streamEntry(
  zipfile: yauzl.ZipFile,
  entry: yauzl.Entry,
  limit: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err || !stream) return reject(err ?? new Error('Error al abrir stream'))
      const chunks: Buffer[] = []
      let total = 0
      stream.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > limit) {
          stream.destroy()
          reject(new Error('ENTRY_SIZE_LIMIT'))
          return
        }
        chunks.push(chunk)
      })
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })
  })
}

/**
 * Normalize a participant name for photo matching.
 * - Lowercase
 * - Remove diacritics (NFD → strip combining marks)
 * - Collapse whitespace, treat underscores and hyphens as spaces
 * - Trim
 */
function normalizeParticipantName(raw: string): string {
  return raw
    .replace(/[_-]/g, ' ')           // treat _ and - as spaces
    .normalize('NFD')                  // decompose accented chars
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/\s+/g, ' ')             // collapse multiple spaces
    .trim()
}

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
      select: { id: true, status: true, csv_path: true },
    })
    if (!generation) throw Errors.NOT_FOUND('Generación')

    if (generation.status !== 'draft') {
      throw Errors.VALIDATION(
        `No se puede subir fotos en estado "${generation.status}". La generación debe estar en borrador.`
      )
    }

    if (!generation.csv_path) {
      throw Errors.VALIDATION('Sube el CSV de estudiantes antes de subir las fotos')
    }

    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof Blob)) {
      throw Errors.VALIDATION('Se requiere un archivo en el campo "file"')
    }

    const arrayBuffer = await file.arrayBuffer()
    const zipBuffer = Buffer.from(arrayBuffer)

    if (zipBuffer.length === 0) {
      throw Errors.VALIDATION('El archivo está vacío')
    }

    if (zipBuffer.length > MAX_ZIP_SIZE_BYTES) {
      throw Errors.VALIDATION('El archivo ZIP supera el límite de 200 MB')
    }

    if (!validateMagicBytes(zipBuffer, ['zip'])) {
      throw Errors.VALIDATION('El archivo no es un ZIP válido')
    }

    // Load certificates for this generation (normalized name → id map)
    const certificates = await prisma.certificate.findMany({
      where: { generation_id: params.id },
      select: { id: true, student_name: true },
    })

    // Build name map; track duplicates so we can refuse ambiguous assignments
    const nameMap = new Map<string, string>()         // normalizedName → certId
    const duplicateNames = new Set<string>()           // normalizedName keys that appear >1 time
    for (const c of certificates) {
      const key = normalizeParticipantName(c.student_name)
      if (nameMap.has(key)) {
        duplicateNames.add(key)
      } else {
        nameMap.set(key, c.id)
      }
    }

    // Open ZIP and enumerate entries
    let zipfile: yauzl.ZipFile
    try {
      zipfile = await openZip(zipBuffer)
    } catch {
      throw Errors.VALIDATION('No se pudo leer el archivo ZIP')
    }

    // Collect all entries first (lazyEntries mode)
    const allEntries: yauzl.Entry[] = []
    await new Promise<void>((resolve, reject) => {
      zipfile.on('entry', (entry: yauzl.Entry) => {
        allEntries.push(entry)
        zipfile.readEntry()
      })
      zipfile.on('end', resolve)
      zipfile.on('error', reject)
      zipfile.readEntry()
    })

    const fileEntries = allEntries.filter((e) => !/\/$/.test(e.fileName))

    if (fileEntries.length === 0) {
      throw Errors.VALIDATION('El ZIP no contiene archivos')
    }

    if (fileEntries.length > MAX_ENTRIES) {
      throw Errors.VALIDATION(`El ZIP contiene demasiados archivos (máx. ${MAX_ENTRIES})`)
    }

    // Process entries sequentially with streaming decompression
    const photoMap = new Map<string, PhotoData>()
    const errors: PhotoError[] = []
    let totalUncompressed = 0

    for (const entry of fileEntries) {
      const entryName = entry.fileName

      if (!isSafePath(entryName)) {
        errors.push({ entry: entryName, reason: 'Ruta peligrosa (path traversal)', error_type: 'traversal' })
        continue
      }

      const basename = path.basename(entryName)
      const ext = path.extname(basename).toLowerCase()

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        errors.push({ entry: entryName, reason: `Extensión no permitida: "${ext}"`, error_type: 'invalid_file' })
        continue
      }

      const reportedSize = entry.uncompressedSize
      const compressedSize = entry.compressedSize

      // Pre-check reported size (may be spoofed; streaming limit below is the real guard)
      if (reportedSize > MAX_ENTRY_UNCOMPRESSED_BYTES) {
        errors.push({
          entry: entryName,
          reason: `Archivo demasiado grande según cabecera: ${Math.ceil(reportedSize / 1024 / 1024)} MB`,
          error_type: 'size_limit',
        })
        continue
      }

      if (compressedSize > 0 && reportedSize / compressedSize > MAX_COMPRESSION_RATIO) {
        errors.push({ entry: entryName, reason: 'Ratio de compresión sospechoso en cabecera (posible ZIP bomb)', error_type: 'zip_bomb' })
        continue
      }

      if (totalUncompressed + reportedSize > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        errors.push({ entry: entryName, reason: 'Límite total de descompresión alcanzado', error_type: 'size_limit' })
        continue
      }

      // Stream-decompress with hard byte limit (BLOQ-B2-004: aborts mid-stream)
      let data: Buffer
      try {
        data = await streamEntry(zipfile, entry, MAX_ENTRY_UNCOMPRESSED_BYTES)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : ''
        if (msg === 'ENTRY_SIZE_LIMIT') {
          errors.push({ entry: entryName, reason: 'Tamaño real excede el límite de 10 MB', error_type: 'size_limit' })
        } else {
          errors.push({ entry: entryName, reason: 'Error al descomprimir', error_type: 'invalid_file' })
        }
        continue
      }

      totalUncompressed += data.length

      // Actual compression ratio check against real decompressed size
      if (compressedSize > 0 && data.length / compressedSize > MAX_COMPRESSION_RATIO) {
        errors.push({ entry: entryName, reason: 'Ratio de compresión real sospechoso (posible ZIP bomb)', error_type: 'zip_bomb' })
        continue
      }

      // Validate image magic bytes on actual content
      if (!validateMagicBytes(data, ALLOWED_MAGIC_TYPES)) {
        errors.push({ entry: entryName, reason: 'El contenido no es una imagen válida (PNG/JPG)', error_type: 'invalid_file' })
        continue
      }

      const rawName = path.basename(basename, ext)

      if (!rawName.trim()) {
        errors.push({ entry: entryName, reason: 'Nombre de archivo vacío o inválido', error_type: 'empty_name' })
        continue
      }

      const normalizedKey = normalizeParticipantName(rawName)

      if (duplicateNames.has(normalizedKey)) {
        errors.push({
          entry: entryName,
          reason: `Nombre duplicado: "${rawName}". No se puede asignar la foto automáticamente.`,
          error_type: 'duplicate_name',
        })
        continue
      }

      const certId = nameMap.get(normalizedKey)

      if (!certId) {
        errors.push({
          entry: entryName,
          reason: `Participante no encontrado en esta generación`,
          error_type: 'unmatched_name',
        })
        continue
      }

      photoMap.set(normalizedKey, { buffer: data, ext, certId })
    }

    zipfile.close()

    const zipStoragePath = `photos/${params.id}/photos.zip`
    const photoUpdates = Array.from(photoMap.entries()).map(([normalizedKey, { ext, certId, buffer }]) => ({
      certId,
      storagePath: `photos/${params.id}/${normalizedKey}${ext}`,
      buffer,
    }))

    // Prisma transaction FIRST — storage writes happen only after it commits (BLOQ-B2-002)
    await prisma.$transaction(async (tx) => {
      // Replace previous photo errors for this generation
      await tx.generationError.deleteMany({
        where: { generation_id: params.id, error_type: 'missing_photo' },
      })

      for (const { certId, storagePath } of photoUpdates) {
        await tx.certificate.update({
          where: { id: certId },
          data: { photo_path: storagePath },
        })
      }

      if (errors.length > 0) {
        await tx.generationError.createMany({
          data: errors.map((e) => ({
            generation_id: params.id,
            error_type: 'missing_photo',
            error_detail: `${e.entry}: ${e.reason}`,
          })),
        })
      }

      await tx.generation.update({
        where: { id: params.id },
        data: { photos_zip_path: zipStoragePath },
      })
    })

    // Storage writes after successful transaction
    await storage.put(zipStoragePath, zipBuffer)
    for (const { storagePath, buffer } of photoUpdates) {
      await storage.put(storagePath, buffer)
    }

    const unmatchedCount = errors.filter((e) => e.error_type === 'unmatched_name').length

    return NextResponse.json(
      {
        summary: {
          matched: photoMap.size,
          unmatched: unmatchedCount,
          skipped_errors: errors.length,
          errors,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
