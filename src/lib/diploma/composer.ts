import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join } from 'path'

// Disable libvips cache and limit worker threads to reduce peak memory
sharp.cache(false)
sharp.concurrency(1)

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

// ── Font ──────────────────────────────────────────────────────────────────────

// Cached at module level — read once, reused for every diploma in the batch
let _ebGaramondBase64: string | null = null

function getEbGaramondBase64(): string {
  if (!_ebGaramondBase64) {
    const fontPath = join(process.cwd(), 'src/lib/fonts/eb-garamond-500-italic.woff')
    _ebGaramondBase64 = readFileSync(fontPath).toString('base64')
  }
  return _ebGaramondBase64
}

// ── Constants & Defaults ──────────────────────────────────────────────────────

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// EB Garamond 500 italic runs wider than generic sans-serif — 0.60 prevents overflow
const AVG_CHAR_WIDTH_RATIO = 0.60
const LINE_HEIGHT_RATIO = 1.3

// 0.85 leaves breathing room so glyphs never touch zone edges
const ZONE_FILL_FACTOR = 0.85

export const DEFAULT_ZONES: {
  studentName: TextZone
  program: TextZone
  issuedDate: TextZone
  folio: TextZone
  qr: ImageZone
  photo: ImageZone
} = {
  studentName: { x: 200, y: 500, width: 1600, height: 200, fontSize: 72, color: '#000000', fontFamily: 'sans-serif', align: 'center' },
  program:     { x: 200, y: 700, width: 1600, height: 80,  fontSize: 48, color: '#333333', fontFamily: 'sans-serif', align: 'center' },
  issuedDate:  { x: 200, y: 900, width: 1600, height: 50,  fontSize: 36, color: '#666666', fontFamily: 'sans-serif', align: 'center' },
  folio:       { x: 200, y: 1300, width: 1600, height: 40, fontSize: 24, color: '#999999', fontFamily: 'sans-serif', align: 'center' },
  qr:          { x: 1600, y: 1000, width: 250, height: 250 },
  photo:       { x: 150,  y: 1000, width: 250, height: 250 }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPngBuffer(buffer: Buffer): boolean {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return false
  return PNG_MAGIC.equals(buffer.subarray(0, 8))
}

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

// Generic text SVG used for non-name fields (folio small label, etc.)
function buildTextSvg(text: string, zone: TextZone): string {
  const escaped = escapeXml(text)
  let textAnchor = 'start'
  let x = '0'
  if (zone.align === 'center') { textAnchor = 'middle'; x = '50%' }
  else if (zone.align === 'right') { textAnchor = 'end'; x = '100%' }

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

// ── Name rendering: dynamic font size + EB Garamond ──────────────────────────

/**
 * Splits a name into N balanced lines (minimising longest-line length).
 * N=1 returns the name as-is.
 */
function splitIntoNLines(name: string, n: number): string[] {
  const words = name.trim().split(/\s+/)
  if (n === 1 || words.length === 1) return [name]
  if (words.length <= n) return words  // one word per line

  if (n === 2) {
    let bestSplit = 1
    let bestMax = Infinity
    for (let i = 1; i < words.length; i++) {
      const l1 = words.slice(0, i).join(' ').length
      const l2 = words.slice(i).join(' ').length
      const maxLen = Math.max(l1, l2)
      if (maxLen < bestMax) { bestMax = maxLen; bestSplit = i }
    }
    return [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')]
  }

  // n=3: greedy thirds by character count
  const totalLen = words.reduce((s, w) => s + w.length + 1, 0)
  const targetLen = totalLen / n
  const lines: string[] = []
  let current: string[] = []
  let currentLen = 0
  let linesLeft = n

  for (const word of words) {
    if (linesLeft > 1 && currentLen >= targetLen) {
      lines.push(current.join(' '))
      current = [word]
      currentLen = word.length + 1
      linesLeft--
    } else {
      current.push(word)
      currentLen += word.length + 1
    }
  }
  lines.push(current.join(' '))
  return lines
}

/**
 * Determines the optimal number of lines and font size so the name
 * fills the zone both horizontally and vertically.
 *
 * Strategy: for N = 1, 2, 3 — calculate the largest font size that
 * respects both width and height constraints, then pick the N that
 * yields the largest font (i.e., best fills the zone).
 */
function calcNameLayout(
  name: string,
  zoneWidth: number,
  zoneHeight: number
): { lines: string[]; fontSize: number } {
  let bestFontSize = 0
  let bestLines: string[] = [name]

  for (const n of [1, 2, 3]) {
    const lines = splitIntoNLines(name, n)
    const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b)

    // Largest font where the longest line fits the zone width
    const fsByWidth = (zoneWidth * ZONE_FILL_FACTOR) / (longestLine.length * AVG_CHAR_WIDTH_RATIO)
    // Largest font where all lines (with line height) fit the zone height
    const fsByHeight = (zoneHeight * ZONE_FILL_FACTOR) / (n * LINE_HEIGHT_RATIO)

    const fontSize = Math.min(fsByWidth, fsByHeight)

    if (fontSize > bestFontSize) {
      bestFontSize = fontSize
      bestLines = lines
    }
  }

  return { lines: bestLines, fontSize: Math.round(bestFontSize) }
}

/**
 * Builds the SVG for the name zone with EB Garamond 500 italic,
 * dynamic font size, and textLength fill per line.
 */
function buildNameSvg(name: string, zone: TextZone): string {
  const fontBase64 = getEbGaramondBase64()
  const { lines, fontSize } = calcNameLayout(name, zone.width, zone.height)

  const lineHeight = fontSize * LINE_HEIGHT_RATIO
  const totalTextHeight = (lines.length - 1) * lineHeight + fontSize
  const firstBaselineY = (zone.height - totalTextHeight) / 2 + fontSize * 0.85

  const textElements = lines.map((line, i) => {
    const y = firstBaselineY + i * lineHeight
    return `<text
        x="0"
        y="${y.toFixed(1)}"
        text-anchor="start"
        font-family="'EB Garamond', serif"
        font-size="${fontSize}px"
        font-weight="500"
        font-style="italic"
        fill="${escapeXml(zone.color)}"
      >${escapeXml(line)}</text>`
  }).join('\n      ')

  return `<svg width="${zone.width}" height="${zone.height}" overflow="hidden" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        @font-face {
          font-family: 'EB Garamond';
          src: url('data:font/woff;base64,${fontBase64}') format('woff');
          font-weight: 500;
          font-style: italic;
        }
      </style>
    </defs>
    ${textElements}
  </svg>`
}

// ── Main Export ───────────────────────────────────────────────────────────────

export async function composeDiplomaPng(params: ComposeDiplomaParams): Promise<Buffer> {
  const {
    templateBuffer,
    fieldZones,
    studentName,
    folio,
    qrBuffer,
    photoBuffer
  } = params

  if (!Buffer.isBuffer(templateBuffer) || templateBuffer.length === 0) {
    throw new Error('[composer] templateBuffer must be a non-empty Buffer')
  }
  if (!isPngBuffer(qrBuffer)) {
    throw new Error('[composer] qrBuffer must be a valid PNG')
  }
  if (photoBuffer && !Buffer.isBuffer(photoBuffer)) {
    throw new Error('[composer] photoBuffer must be a Buffer if provided')
  }

  const template = sharp(templateBuffer)
  const meta = await template.metadata()

  if (!meta.width || !meta.height) {
    throw new Error('[composer] Could not determine template dimensions')
  }

  // Resolve zones
  const zStudent = { ...DEFAULT_ZONES.studentName, ...fieldZones?.studentName }
  const zQr      = { ...DEFAULT_ZONES.qr,          ...fieldZones?.qr }
  const zPhoto   = { ...DEFAULT_ZONES.photo,        ...fieldZones?.photo }

  const overlays: sharp.OverlayOptions[] = []

  // QR code
  const resizedQr = await sharp(qrBuffer)
    .resize(zQr.width, zQr.height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer()
  overlays.push({ input: resizedQr, top: Math.round(zQr.y), left: Math.round(zQr.x) })

  // Photo
  if (photoBuffer) {
    const resizedPhoto = await sharp(photoBuffer)
      .resize(zPhoto.width, zPhoto.height, { fit: 'cover' })
      .toBuffer()
    overlays.push({ input: resizedPhoto, top: Math.round(zPhoto.y), left: Math.round(zPhoto.x) })
  }

  // Name — EB Garamond italic, dynamic size, fills zone
  const nameSvg = buildNameSvg(studentName, zStudent)
  overlays.push({
    input: Buffer.from(nameSvg),
    top: Math.round(zStudent.y),
    left: Math.round(zStudent.x)
  })

  // Folio — small text below QR, harmonious with the design
  if (folio) {
    const folioHeight = Math.max(30, Math.round(zQr.height * 0.15))
    const folioZone: TextZone = {
      x: 0, y: 0,
      width: zQr.width,
      height: folioHeight,
      fontSize: Math.max(14, Math.round(zQr.width * 0.07)),
      color: '#888888',
      fontFamily: 'sans-serif',
      align: 'center'
    }
    const folioSvg = buildTextSvg(folio, folioZone)
    overlays.push({
      input: Buffer.from(folioSvg),
      top: Math.round(zQr.y + zQr.height + 6),
      left: Math.round(zQr.x)
    })
  }

  return template.composite(overlays).png().toBuffer()
}
