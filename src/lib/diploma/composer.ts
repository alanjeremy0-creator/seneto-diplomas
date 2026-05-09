/**
 * PNG Composer module — Sprint 3A (S3A-002)
 *
 * Composites a diploma PNG by overlaying text (via SVG inline) and images
 * (QR code, optional photo) onto a base template.
 *
 * Architecture decisions:
 * - sharp + SVG inline (no canvas dependency)
 * - Sequential execution per diploma
 * - Preserves original template dimensions
 * - Validates input buffers to prevent crash loops
 */

import sharp from 'sharp'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TextZone {
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  color: string
  fontFamily: string
  align: 'left' | 'center' | 'right'
}

export interface ImageZone {
  x: number
  y: number
  width: number
  height: number
}

export interface FieldZones {
  studentName?: Partial<TextZone>
  program?: Partial<TextZone>
  issuedDate?: Partial<TextZone>
  folio?: Partial<TextZone>
  qr?: Partial<ImageZone>
  photo?: Partial<ImageZone>
}

export interface ComposeDiplomaParams {
  templateBuffer: Buffer
  fieldZones?: FieldZones
  studentName: string
  program: string
  folio: string
  issuedDate?: Date | string | null
  qrBuffer: Buffer
  photoBuffer?: Buffer | null
}

// ── Constants & Defaults ──────────────────────────────────────────────────────

// PNG magic bytes: \x89 P N G \r \n \x1a \n
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * Standard A4 landscape proportions assumed if no template dimensions are available,
 * though normally the template dictates the size.
 * These are base default coordinates for a ~2000px wide template.
 */
export const DEFAULT_ZONES: {
  studentName: TextZone
  program: TextZone
  issuedDate: TextZone
  folio: TextZone
  qr: ImageZone
  photo: ImageZone
} = {
  studentName: { x: 200, y: 500, width: 1600, height: 100, fontSize: 72, color: '#000000', fontFamily: 'sans-serif', align: 'center' },
  program: { x: 200, y: 700, width: 1600, height: 80, fontSize: 48, color: '#333333', fontFamily: 'sans-serif', align: 'center' },
  issuedDate: { x: 200, y: 900, width: 1600, height: 50, fontSize: 36, color: '#666666', fontFamily: 'sans-serif', align: 'center' },
  folio: { x: 200, y: 1300, width: 1600, height: 40, fontSize: 24, color: '#999999', fontFamily: 'sans-serif', align: 'center' },
  qr: { x: 1600, y: 1000, width: 250, height: 250 },
  photo: { x: 150, y: 1000, width: 250, height: 250 }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Validates PNG magic bytes.
 */
function isPngBuffer(buffer: Buffer): boolean {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return false
  return PNG_MAGIC.equals(buffer.slice(0, 8))
}

/**
 * Escapes characters for safe inclusion in SVG text.
 */
export function escapeXml(unsafe: string): string {
  if (!unsafe) return ''
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}

/**
 * Generates an SVG string for a single text zone to be overlaid.
 */
function buildTextSvg(text: string, zone: TextZone): string {
  const escaped = escapeXml(text)
  
  // Convert align to SVG text-anchor
  let textAnchor = 'start'
  let x = '0'
  
  if (zone.align === 'center') {
    textAnchor = 'middle'
    x = '50%'
  } else if (zone.align === 'right') {
    textAnchor = 'end'
    x = '100%'
  }

  // The viewbox matches the zone width/height.
  // We use dominant-baseline central and position y at 50% to vertically center.
  return `
    <svg width="${zone.width}" height="${zone.height}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="${x}"
        y="50%"
        dominant-baseline="central"
        text-anchor="${textAnchor}"
        font-family="${escapeXml(zone.fontFamily)}"
        font-size="${zone.fontSize}px"
        fill="${escapeXml(zone.color)}"
      >${escaped}</text>
    </svg>
  `
}

/**
 * Formats date into a simple string if it's a Date object
 */
function formatIssuedDate(date?: Date | string | null): string {
  if (!date) return ''
  if (typeof date === 'string') return date
  return date.toISOString().split('T')[0] // Simple YYYY-MM-DD fallback
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Composes a diploma PNG by overlaying text and images on a base template.
 */
export async function composeDiplomaPng(params: ComposeDiplomaParams): Promise<Buffer> {
  const {
    templateBuffer,
    fieldZones,
    studentName,
    program,
    folio,
    issuedDate,
    qrBuffer,
    photoBuffer
  } = params

  // 1. Validation
  if (!Buffer.isBuffer(templateBuffer) || templateBuffer.length === 0) {
    throw new Error('[composer] templateBuffer must be a non-empty Buffer')
  }
  if (!isPngBuffer(qrBuffer)) {
    throw new Error('[composer] qrBuffer must be a valid PNG')
  }
  if (photoBuffer && !Buffer.isBuffer(photoBuffer)) {
    throw new Error('[composer] photoBuffer must be a Buffer if provided')
  }

  // 2. Load template and get metadata to preserve dimensions
  const template = sharp(templateBuffer)
  const meta = await template.metadata()
  
  if (!meta.width || !meta.height) {
    throw new Error('[composer] Could not determine template dimensions')
  }

  // 3. Resolve Zones
  const zStudent = { ...DEFAULT_ZONES.studentName, ...fieldZones?.studentName }
  const zProgram = { ...DEFAULT_ZONES.program, ...fieldZones?.program }
  const zFolio = { ...DEFAULT_ZONES.folio, ...fieldZones?.folio }
  const zDate = { ...DEFAULT_ZONES.issuedDate, ...fieldZones?.issuedDate }
  const zQr = { ...DEFAULT_ZONES.qr, ...fieldZones?.qr }
  const zPhoto = { ...DEFAULT_ZONES.photo, ...fieldZones?.photo }

  // 4. Prepare overlays (sharp composite format)
  const overlays: sharp.OverlayOptions[] = []

  // Add QR code (resized to fit zone)
  const resizedQr = await sharp(qrBuffer)
    .resize(zQr.width, zQr.height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer()
    
  overlays.push({
    input: resizedQr,
    top: Math.round(zQr.y),
    left: Math.round(zQr.x)
  })

  // Add Photo if present
  if (photoBuffer) {
    const resizedPhoto = await sharp(photoBuffer)
      .resize(zPhoto.width, zPhoto.height, { fit: 'cover' })
      .toBuffer()
      
    overlays.push({
      input: resizedPhoto,
      top: Math.round(zPhoto.y),
      left: Math.round(zPhoto.x)
    })
  }

  // Add Texts via SVG
  const texts = [
    { text: studentName, zone: zStudent },
    { text: program, zone: zProgram },
    { text: formatIssuedDate(issuedDate), zone: zDate },
    { text: folio, zone: zFolio }
  ]

  for (const { text, zone } of texts) {
    if (!text) continue
    
    const svg = buildTextSvg(text, zone)
    overlays.push({
      input: Buffer.from(svg),
      top: Math.round(zone.y),
      left: Math.round(zone.x)
    })
  }

  // 5. Composite and output
  return template
    .composite(overlays)
    .png()
    .toBuffer()
}
