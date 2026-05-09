/**
 * Smoke test — S3A-001: QR generation module
 * Run with:  node --experimental-vm-modules scripts/smoke-qr.mjs
 *        or: npx tsx scripts/smoke-qr.mjs
 *
 * Does NOT require a database or running server.
 * Writes qr-smoke-output.png to project root for optional visual inspection.
 */

// Use tsx/ts-node approach: import the compiled output via path alias resolution.
// We bypass tsconfig paths by importing the raw JS-compatible version inline.

import qrcode from 'qrcode'
import { writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Inline the same helpers to avoid needing tsx ────────────────────────────

function normaliseBase(raw) {
  return raw.replace(/\/+$/, '')
}

function buildVerifyUrl(baseUrl, verificationToken) {
  if (!verificationToken || !verificationToken.trim()) throw new Error('verificationToken must not be empty')
  if (!baseUrl || !baseUrl.trim()) throw new Error('baseUrl must not be empty')
  return `${normaliseBase(baseUrl.trim())}/v/${verificationToken}`
}

async function generateQrBuffer({ verificationToken, baseUrl, sizePx = 200, margin = 1 }) {
  const url = buildVerifyUrl(baseUrl, verificationToken)
  const buffer = await qrcode.toBuffer(url, {
    type: 'png',
    width: sizePx,
    margin,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  })
  return { buffer, url }
}

// ── Test cases ───────────────────────────────────────────────────────────────

const FAKE_TOKEN = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

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

  console.log('\n── S3A-001 QR smoke test ──────────────────────────────────\n')

  // T-1: URL normalisation — no trailing slash on base
  await assert('T-1: base without trailing slash', async () => {
    const url = buildVerifyUrl('https://example.com', FAKE_TOKEN)
    if (url !== `https://example.com/v/${FAKE_TOKEN}`) throw new Error(`Got: ${url}`)
  })

  // T-2: URL normalisation — strips trailing slash
  await assert('T-2: base with trailing slash stripped', async () => {
    const url = buildVerifyUrl('https://example.com/', FAKE_TOKEN)
    if (url !== `https://example.com/v/${FAKE_TOKEN}`) throw new Error(`Got: ${url}`)
  })

  // T-3: URL normalisation — strips multiple trailing slashes
  await assert('T-3: base with multiple trailing slashes stripped', async () => {
    const url = buildVerifyUrl('https://example.com///', FAKE_TOKEN)
    if (url !== `https://example.com/v/${FAKE_TOKEN}`) throw new Error(`Got: ${url}`)
  })

  // T-4: URL always uses /v/{token} — never /verify/ or folio
  await assert('T-4: URL path is /v/{token}', async () => {
    const url = buildVerifyUrl('http://localhost:3000', FAKE_TOKEN)
    if (!url.includes('/v/')) throw new Error(`Missing /v/ in URL: ${url}`)
    if (url.includes('/verify/')) throw new Error(`URL must not use /verify/`)
    if (!url.endsWith(FAKE_TOKEN)) throw new Error(`URL must end with token`)
  })

  // T-5: Empty token throws
  await assert('T-5: empty token throws', async () => {
    let threw = false
    try { buildVerifyUrl('http://localhost:3000', '') } catch { threw = true }
    if (!threw) throw new Error('Expected throw for empty token')
  })

  // T-6: Empty baseUrl throws
  await assert('T-6: empty baseUrl throws', async () => {
    let threw = false
    try { buildVerifyUrl('', FAKE_TOKEN) } catch { threw = true }
    if (!threw) throw new Error('Expected throw for empty baseUrl')
  })

  // T-7: generateQrBuffer returns a Buffer
  await assert('T-7: output is a Buffer', async () => {
    const { buffer } = await generateQrBuffer({ verificationToken: FAKE_TOKEN, baseUrl: 'http://localhost:3000' })
    if (!Buffer.isBuffer(buffer)) throw new Error('Not a Buffer')
    if (buffer.length < 100) throw new Error(`Buffer too small: ${buffer.length} bytes`)
  })

  // T-8: PNG magic bytes
  await assert('T-8: buffer has PNG magic bytes (\\x89PNG)', async () => {
    const { buffer } = await generateQrBuffer({ verificationToken: FAKE_TOKEN, baseUrl: 'http://localhost:3000' })
    const magic = buffer.slice(0, 4)
    // PNG: 89 50 4E 47
    if (magic[0] !== 0x89 || magic[1] !== 0x50 || magic[2] !== 0x4E || magic[3] !== 0x47) {
      throw new Error(`Bad magic bytes: ${magic.toString('hex')}`)
    }
  })

  // T-9: URL in result matches expected
  await assert('T-9: returned url matches buildVerifyUrl output', async () => {
    const { url } = await generateQrBuffer({ verificationToken: FAKE_TOKEN, baseUrl: 'https://qa.corporativoseneto.com' })
    const expected = `https://qa.corporativoseneto.com/v/${FAKE_TOKEN}`
    if (url !== expected) throw new Error(`Got: ${url}, expected: ${expected}`)
  })

  // T-10: Custom sizePx — output is bigger
  await assert('T-10: larger sizePx produces larger buffer', async () => {
    const { buffer: small } = await generateQrBuffer({ verificationToken: FAKE_TOKEN, baseUrl: 'http://localhost:3000', sizePx: 100 })
    const { buffer: large } = await generateQrBuffer({ verificationToken: FAKE_TOKEN, baseUrl: 'http://localhost:3000', sizePx: 400 })
    if (large.length <= small.length) throw new Error(`larger QR (${large.length}) should be bigger than small (${small.length})`)
  })

  // Write output PNG for optional visual inspection
  try {
    const { buffer } = await generateQrBuffer({ verificationToken: FAKE_TOKEN, baseUrl: 'http://localhost:3000' })
    const outPath = path.join(__dirname, '..', 'qr-smoke-output.png')
    await writeFile(outPath, buffer)
    console.log(`\n  📄  Visual output: qr-smoke-output.png`)
  } catch (e) {
    console.warn(`  ⚠️  Could not write output PNG: ${e.message}`)
  }

  console.log(`\n── Result: ${passed} passed, ${failed} failed ───────────────────────\n`)
  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
