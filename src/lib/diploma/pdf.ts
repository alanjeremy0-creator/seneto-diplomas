/**
 * PDF embedding module — Sprint 3A (S3A-003)
 *
 * Wraps a PNG diploma image inside a single-page PDF.
 * The PNG is scaled to fit the page while preserving aspect ratio (letterbox).
 *
 * Default page size: A4 landscape (diploma proportions).
 * Override via options.pageSize or options.pageSizePx.
 */

import { PDFDocument, PageSizes } from 'pdf-lib'

// ── Constants ─────────────────────────────────────────────────────────────────

// PNG magic bytes: \x89 P N G \r \n \x1a \n
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// Named presets — pdf-lib PageSizes are [width, height] in points (72 pt = 1 inch)
export const PAGE_PRESETS = {
  A4_PORTRAIT:   PageSizes.A4,                           // [595.28, 841.89]
  A4_LANDSCAPE:  [PageSizes.A4[1], PageSizes.A4[0]] as [number, number], // [841.89, 595.28]
  LETTER_PORTRAIT:  PageSizes.Letter,                    // [612, 792]
  LETTER_LANDSCAPE: [PageSizes.Letter[1], PageSizes.Letter[0]] as [number, number],
} as const

export type PagePreset = keyof typeof PAGE_PRESETS

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmbedPngOptions {
  /**
   * Named page size preset.
   * Defaults to 'A4_LANDSCAPE' (standard diploma orientation).
   */
  pagePreset?: PagePreset
  /**
   * Custom page size in PDF points [width, height].
   * Takes precedence over pagePreset when provided.
   */
  pageSizePts?: [number, number]
  /**
   * Padding in PDF points to keep between image and page edge.
   * Defaults to 0 (image fills the page).
   */
  paddingPts?: number
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate PNG magic bytes.
 * Returns true if the buffer starts with the 8-byte PNG signature.
 */
export function isPngBuffer(buffer: Buffer): boolean {
  if (buffer.length < 8) return false
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (buffer[i] !== PNG_MAGIC[i]) return false
  }
  return true
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Embed a PNG image inside a single-page PDF.
 *
 * The image is scaled to fit within the page (preserving aspect ratio).
 * If paddingPts is provided, the image is inset by that amount on all sides.
 *
 * @param pngBuffer  PNG diploma image — must have valid PNG magic bytes.
 * @param options    Optional page size and padding overrides.
 * @returns          PDF as a Uint8Array (compatible with Buffer / storage.put).
 *
 * @example
 * const pdf = await embedPngInPdf(pngBuffer)
 * await storage.put(`diplomas/${genId}/${folio}.pdf`, Buffer.from(pdf))
 */
export async function embedPngInPdf(
  pngBuffer: Buffer,
  options: EmbedPngOptions = {}
): Promise<Uint8Array> {
  // ── Input validation ───────────────────────────────────────────────────────

  if (!Buffer.isBuffer(pngBuffer) || pngBuffer.length === 0) {
    throw new Error('[pdf] pngBuffer must be a non-empty Buffer')
  }

  if (!isPngBuffer(pngBuffer)) {
    const actual = pngBuffer.slice(0, 4).toString('hex')
    throw new Error(
      `[pdf] pngBuffer does not have valid PNG magic bytes (got: ${actual})`
    )
  }

  // ── Resolve page dimensions ────────────────────────────────────────────────

  let [pageW, pageH]: [number, number] =
    options.pageSizePts ?? PAGE_PRESETS[options.pagePreset ?? 'A4_LANDSCAPE']

  const padding = options.paddingPts ?? 0

  // Available area after padding
  const availW = pageW - padding * 2
  const availH = pageH - padding * 2

  if (availW <= 0 || availH <= 0) {
    throw new Error('[pdf] paddingPts is too large — no space left for image')
  }

  // ── Build PDF ──────────────────────────────────────────────────────────────

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([pageW, pageH])

  // Embed the PNG — pdf-lib reads the PNG dimensions internally
  const pngImage = await pdfDoc.embedPng(pngBuffer)
  const { width: imgW, height: imgH } = pngImage

  // Scale to fit (letterbox) — preserves aspect ratio
  const scaleX = availW / imgW
  const scaleY = availH / imgH
  const scale = Math.min(scaleX, scaleY)

  const drawW = imgW * scale
  const drawH = imgH * scale

  // Centre on the page
  const x = padding + (availW - drawW) / 2
  const y = padding + (availH - drawH) / 2

  page.drawImage(pngImage, { x, y, width: drawW, height: drawH })

  return pdfDoc.save()
}
