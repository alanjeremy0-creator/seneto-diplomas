/**
 * Smoke test — S3A-002: PNG Composer module
 * Run with: npx tsx scripts/smoke-composer.ts
 *
 * Validates the sharp + SVG inline composition logic.
 * Imports and executes the real production module.
 */

import sharp from 'sharp'
import qrcode from 'qrcode'
import { composeDiplomaPng, escapeXml } from '../src/lib/diploma/composer'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Generates a blank 2000x1414 PNG (typical A4 landscape ratio)
async function makeTemplate(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2000,
      height: 1414,
      channels: 4,
      background: { r: 240, g: 240, b: 240, alpha: 1 }
    }
  })
  .png()
  .toBuffer()
}

// Generates a mock QR PNG
async function makeQr(): Promise<Buffer> {
  return qrcode.toBuffer('https://smoke.example.com', { type: 'png', width: 250 })
}

// Generates a mock Photo PNG
async function makePhoto(): Promise<Buffer> {
  return sharp({
    create: {
      width: 400,
      height: 400,
      channels: 4,
      background: { r: 100, g: 150, b: 200, alpha: 1 }
    }
  })
  .png()
  .toBuffer()
}

// ── Test runner ───────────────────────────────────────────────────────────────

async function run() {
  let passed = 0
  let failed = 0

  async function assert(label: string, fn: () => Promise<void> | void) {
    try {
      await fn()
      console.log(`  ✅  ${label}`)
      passed++
    } catch (err: any) {
      console.error(`  ❌  ${label}`)
      console.error(`      ${err.stack || err.message}`)
      failed++
    }
  }

  console.log('\n── S3A-002 PNG Composer smoke test ────────────────────────\n')

  const templateBuffer = await makeTemplate()
  const qrBuffer = await makeQr()
  const photoBuffer = await makePhoto()

  const baseParams = {
    templateBuffer,
    qrBuffer,
    studentName: 'Jane Doe',
    program: 'Software Engineering',
    folio: 'SEN-2025-001',
    issuedDate: '2026-05-08'
  }

  // T-1: compose without photo succeeds
  await assert('T-1: Compose without photo succeeds', async () => {
    const result = await composeDiplomaPng(baseParams)
    const meta = await sharp(result).metadata()
    if (meta.format !== 'png') throw new Error(`Expected png, got ${meta.format}`)
  })

  // T-2: compose with photo succeeds
  await assert('T-2: Compose with photo succeeds', async () => {
    const result = await composeDiplomaPng({ ...baseParams, photoBuffer })
    const meta = await sharp(result).metadata()
    if (meta.format !== 'png') throw new Error(`Expected png, got ${meta.format}`)
  })

  // T-3: output dimensions match template
  await assert('T-3: Dimensions match original template (2000x1414)', async () => {
    const result = await composeDiplomaPng(baseParams)
    const meta = await sharp(result).metadata()
    if (meta.width !== 2000 || meta.height !== 1414) {
      throw new Error(`Dimensions mismatch: ${meta.width}x${meta.height}`)
    }
  })

  // T-4: Special characters (SVG escape)
  await assert('T-4: Handles special SVG characters (<, >, &, \', ") safely', async () => {
    const result = await composeDiplomaPng({
      ...baseParams,
      studentName: 'O\'Connor & "Friends" <tag>'
    })
    const meta = await sharp(result).metadata()
    if (!meta) throw new Error('Result failed to render')
  })

  // T-5: Very long text does not crash
  await assert('T-5: Handles very long text without crash', async () => {
    const longText = 'A'.repeat(500)
    const result = await composeDiplomaPng({
      ...baseParams,
      studentName: longText
    })
    const meta = await sharp(result).metadata()
    if (!meta) throw new Error('Result failed to render')
  })

  // T-6: Invalid QR buffer throws
  await assert('T-6: Invalid QR buffer throws', async () => {
    let threw = false
    try {
      await composeDiplomaPng({ ...baseParams, qrBuffer: Buffer.from('not a png') })
    } catch (e) { threw = true }
    if (!threw) throw new Error('Expected throw for invalid QR')
  })

  // T-7: Missing template throws
  await assert('T-7: Empty template buffer throws', async () => {
    let threw = false
    try {
      await composeDiplomaPng({ ...baseParams, templateBuffer: Buffer.alloc(0) })
    } catch (e) { threw = true }
    if (!threw) throw new Error('Expected throw for empty template')
  })
  
  // T-8: Escape XML helper works
  await assert('T-8: escapeXml works correctly', () => {
    const res = escapeXml('a & b < c > d " e \' f')
    if (res !== 'a &amp; b &lt; c &gt; d &quot; e &apos; f') {
      throw new Error(`Escape failed: ${res}`)
    }
  })

  console.log(`\n── Result: ${passed} passed, ${failed} failed ───────────────────────\n`)
  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
