/**
 * Smoke test — S3A-003: PDF embedding module
 * Run with: node scripts/smoke-pdf.mjs
 *
 * Generates a minimal real PNG (via qrcode) and embeds it in a PDF.
 * Validates the result with pdf-lib itself.
 * No database or server required.
 */

import qrcode from 'qrcode'
import { PDFDocument } from 'pdf-lib'

// ── Inline pdf module (avoids tsx/tsconfig paths) ────────────────────────────

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function isPngBuffer(buffer) {
  if (buffer.length < 8) return false
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (buffer[i] !== PNG_MAGIC[i]) return false
  }
  return true
}

const PAGE_A4_LANDSCAPE = [841.89, 595.28]

async function embedPngInPdf(pngBuffer, options = {}) {
  if (!Buffer.isBuffer(pngBuffer) || pngBuffer.length === 0)
    throw new Error('[pdf] pngBuffer must be a non-empty Buffer')
  if (!isPngBuffer(pngBuffer)) {
    const actual = pngBuffer.slice(0, 4).toString('hex')
    throw new Error(`[pdf] invalid PNG magic bytes (got: ${actual})`)
  }

  const [pageW, pageH] = options.pageSizePts ?? PAGE_A4_LANDSCAPE
  const padding = options.paddingPts ?? 0
  const availW = pageW - padding * 2
  const availH = pageH - padding * 2
  if (availW <= 0 || availH <= 0)
    throw new Error('[pdf] paddingPts too large — no space left for image')

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([pageW, pageH])
  const pngImage = await pdfDoc.embedPng(pngBuffer)
  const { width: imgW, height: imgH } = pngImage

  const scaleX = availW / imgW
  const scaleY = availH / imgH
  const scale = Math.min(scaleX, scaleY)
  const drawW = imgW * scale
  const drawH = imgH * scale
  const x = padding + (availW - drawW) / 2
  const y = padding + (availH - drawH) / 2

  page.drawImage(pngImage, { x, y, width: drawW, height: drawH })
  return pdfDoc.save()
}

// ── Generate a real PNG using qrcode (valid PNG, no fixture file needed) ──────

async function makePng(sizePx = 200) {
  return qrcode.toBuffer('https://smoke-test.example.com', {
    type: 'png',
    width: sizePx,
    margin: 1,
  })
}

// ── Test runner ───────────────────────────────────────────────────────────────

async function run() {
  let passed = 0
  let failed = 0

  async function assert(label, fn) {
    try {
      await fn()
      console.log(`  ✅  ${label}`)
      passed++
    } catch (err) {
      console.error(`  ❌  ${label}`)
      console.error(`      ${err.message}`)
      failed++
    }
  }

  console.log('\n── S3A-003 PDF embedding smoke test ────────────────────────\n')

  const realPng = await makePng(200)

  // T-1: isPngBuffer returns true for a real PNG
  await assert('T-1: isPngBuffer → true for real PNG', async () => {
    if (!isPngBuffer(realPng)) throw new Error('Expected true')
  })

  // T-2: isPngBuffer returns false for non-PNG
  await assert('T-2: isPngBuffer → false for PDF bytes', async () => {
    const fake = Buffer.from('%PDF-1.4 not a png')
    if (isPngBuffer(fake)) throw new Error('Expected false')
  })

  // T-3: isPngBuffer returns false for empty buffer
  await assert('T-3: isPngBuffer → false for empty buffer', async () => {
    if (isPngBuffer(Buffer.alloc(0))) throw new Error('Expected false')
  })

  // T-4: embedPngInPdf returns a Uint8Array
  await assert('T-4: result is Uint8Array', async () => {
    const result = await embedPngInPdf(realPng)
    if (!(result instanceof Uint8Array)) throw new Error(`Got: ${typeof result}`)
  })

  // T-5: result starts with %PDF magic bytes
  await assert('T-5: result starts with %PDF', async () => {
    const result = await embedPngInPdf(realPng)
    const header = Buffer.from(result.slice(0, 4)).toString('ascii')
    if (header !== '%PDF') throw new Error(`Got: ${header}`)
  })

  // T-6: pdf-lib can load the result without error
  await assert('T-6: pdf-lib can load the PDF', async () => {
    const result = await embedPngInPdf(realPng)
    await PDFDocument.load(result) // throws if corrupt
  })

  // T-7: PDF has exactly 1 page
  await assert('T-7: PDF has exactly 1 page', async () => {
    const result = await embedPngInPdf(realPng)
    const doc = await PDFDocument.load(result)
    const pages = doc.getPageCount()
    if (pages !== 1) throw new Error(`Expected 1 page, got ${pages}`)
  })

  // T-8: Page dimensions match A4 landscape (default)
  await assert('T-8: page is A4 landscape (841.89 × 595.28 pts)', async () => {
    const result = await embedPngInPdf(realPng)
    const doc = await PDFDocument.load(result)
    const page = doc.getPage(0)
    const { width, height } = page.getSize()
    const closeEnough = (a, b) => Math.abs(a - b) < 0.5
    if (!closeEnough(width, 841.89) || !closeEnough(height, 595.28))
      throw new Error(`Got: ${width.toFixed(2)} × ${height.toFixed(2)} pts`)
  })

  // T-9: Custom page size is respected
  await assert('T-9: custom pageSizePts respected', async () => {
    const result = await embedPngInPdf(realPng, { pageSizePts: [500, 400] })
    const doc = await PDFDocument.load(result)
    const page = doc.getPage(0)
    const { width, height } = page.getSize()
    const closeEnough = (a, b) => Math.abs(a - b) < 0.5
    if (!closeEnough(width, 500) || !closeEnough(height, 400))
      throw new Error(`Got: ${width.toFixed(2)} × ${height.toFixed(2)}`)
  })

  // T-10: Empty pngBuffer throws
  await assert('T-10: empty pngBuffer throws', async () => {
    let threw = false
    try { await embedPngInPdf(Buffer.alloc(0)) } catch { threw = true }
    if (!threw) throw new Error('Expected throw for empty buffer')
  })

  // T-11: Non-PNG buffer throws
  await assert('T-11: non-PNG buffer throws', async () => {
    let threw = false
    try { await embedPngInPdf(Buffer.from('%PDF-fake')) } catch { threw = true }
    if (!threw) throw new Error('Expected throw for non-PNG magic bytes')
  })

  // T-12: Padding too large throws
  await assert('T-12: excessive paddingPts throws', async () => {
    let threw = false
    try {
      await embedPngInPdf(realPng, { pageSizePts: [100, 100], paddingPts: 60 })
    } catch { threw = true }
    if (!threw) throw new Error('Expected throw for excessive padding')
  })

  // T-13: Large PNG (400px) round-trips correctly
  await assert('T-13: large PNG (400px) produces valid single-page PDF', async () => {
    const largePng = await makePng(400)
    const result = await embedPngInPdf(largePng)
    const doc = await PDFDocument.load(result)
    if (doc.getPageCount() !== 1) throw new Error('Expected 1 page')
  })

  console.log(`\n── Result: ${passed} passed, ${failed} failed ───────────────────────\n`)
  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
