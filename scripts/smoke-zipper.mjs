/**
 * Smoke test — S3A-007: ZIP builder module
 * Run with: node scripts/smoke-zipper.mjs
 *
 * Validates buildDiplomasZip using adm-zip to inspect the output.
 * No database or running server required.
 */

import archiver from 'archiver'
import AdmZip from 'adm-zip'
import { Readable } from 'stream'

// ── Inline zipper (avoids tsx/tsconfig path resolution) ──────────────────────

const SAFE_NAME_RE = /^[a-zA-Z0-9._\- ]+$/

function validateEntry(entry, index) {
  const { name, buffer } = entry
  const tag = `entry[${index}] "${name}"`

  if (!name || typeof name !== 'string') throw new Error(`[zipper] ${tag}: name must be a non-empty string`)
  if (name.includes('..'))              throw new Error(`[zipper] ${tag}: name must not contain '..' (path traversal)`)
  if (name.startsWith('/') || name.startsWith('\\')) throw new Error(`[zipper] ${tag}: name must not be an absolute path`)
  if (name.includes('/') || name.includes('\\'))     throw new Error(`[zipper] ${tag}: name must not contain path separators`)
  if (name.includes('\x00'))            throw new Error(`[zipper] ${tag}: name must not contain null bytes`)
  if (!SAFE_NAME_RE.test(name))         throw new Error(`[zipper] ${tag}: name contains disallowed characters`)
  if (!name.toLowerCase().endsWith('.pdf')) throw new Error(`[zipper] ${tag}: only .pdf entries allowed`)
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error(`[zipper] ${tag}: buffer must be a non-empty Buffer`)
}

async function buildDiplomasZip(entries, options = {}) {
  if (!Array.isArray(entries) || entries.length === 0)
    throw new Error('[zipper] entries must be a non-empty array')

  entries.forEach((e, i) => validateEntry(e, i))

  const names = entries.map(e => e.name.toLowerCase())
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i)
  if (duplicates.length > 0)
    throw new Error(`[zipper] duplicate entry name(s): ${[...new Set(duplicates)].join(', ')}`)

  const level = options.compressionLevel ?? 6

  return new Promise((resolve, reject) => {
    const archive = archiver.create('zip', { zlib: { level } })
    const chunks = []
    archive.on('data', (chunk) => chunks.push(chunk))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', (err) => reject(new Error(`[zipper] archiver error: ${err.message}`)))
    archive.on('warning', (err) => { if (err.code !== 'ENOENT') reject(new Error(`[zipper] warning: ${err.message}`)) })
    for (const entry of entries) {
      archive.append(Readable.from(entry.buffer), { name: entry.name })
    }
    archive.finalize()
  })
}

// ── Minimal fake PDF buffers ─────────────────────────────────────────────────
// A real PDF starts with %PDF — good enough for ZIP entry validation tests.
// We're testing the ZIP container structure, not PDF correctness.

const MOCK_PDF_1 = Buffer.from('%PDF-1.4 mock diploma content for SEN-2025-001')
const MOCK_PDF_2 = Buffer.from('%PDF-1.4 mock diploma content for SEN-2025-002')

// ── Test runner ──────────────────────────────────────────────────────────────

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

  console.log('\n── S3A-007 ZIP builder smoke test ─────────────────────────\n')

  // T-1: builds a valid ZIP from 2 PDF entries
  await assert('T-1: builds ZIP from 2 entries', async () => {
    const zip = await buildDiplomasZip([
      { name: 'SEN-2025-001.pdf', buffer: MOCK_PDF_1 },
      { name: 'SEN-2025-002.pdf', buffer: MOCK_PDF_2 },
    ])
    if (!Buffer.isBuffer(zip)) throw new Error('Result is not a Buffer')
    if (zip.length < 20) throw new Error(`ZIP too small: ${zip.length} bytes`)
  })

  // T-2: adm-zip can open it and finds exactly 2 entries
  await assert('T-2: adm-zip opens ZIP and finds 2 entries', async () => {
    const zip = await buildDiplomasZip([
      { name: 'SEN-2025-001.pdf', buffer: MOCK_PDF_1 },
      { name: 'SEN-2025-002.pdf', buffer: MOCK_PDF_2 },
    ])
    const admZip = new AdmZip(zip)
    const entries = admZip.getEntries()
    if (entries.length !== 2) throw new Error(`Expected 2 entries, got ${entries.length}`)
  })

  // T-3: entry names inside ZIP match what was passed
  await assert('T-3: entry names match expected', async () => {
    const zip = await buildDiplomasZip([
      { name: 'SEN-2025-001.pdf', buffer: MOCK_PDF_1 },
      { name: 'SEN-2025-002.pdf', buffer: MOCK_PDF_2 },
    ])
    const admZip = new AdmZip(zip)
    const names = admZip.getEntries().map(e => e.entryName).sort()
    const expected = ['SEN-2025-001.pdf', 'SEN-2025-002.pdf'].sort()
    if (JSON.stringify(names) !== JSON.stringify(expected))
      throw new Error(`Names: ${JSON.stringify(names)}, expected: ${JSON.stringify(expected)}`)
  })

  // T-4: entry content matches original buffer
  await assert('T-4: entry content round-trips correctly', async () => {
    const zip = await buildDiplomasZip([
      { name: 'SEN-2025-001.pdf', buffer: MOCK_PDF_1 },
    ])
    const admZip = new AdmZip(zip)
    const entry = admZip.getEntry('SEN-2025-001.pdf')
    if (!entry) throw new Error('Entry not found in ZIP')
    const data = admZip.readFile(entry)
    if (!data) throw new Error('Could not read entry data')
    if (!data.equals(MOCK_PDF_1)) throw new Error('Content does not match original buffer')
  })

  // T-5: empty entries array throws
  await assert('T-5: empty entries array throws', async () => {
    let threw = false
    try { await buildDiplomasZip([]) } catch { threw = true }
    if (!threw) throw new Error('Expected throw for empty entries')
  })

  // T-6: path traversal in name throws — "../etc/passwd.pdf"
  await assert('T-6: "../" in name throws (path traversal)', async () => {
    let threw = false
    try {
      await buildDiplomasZip([{ name: '../etc/passwd.pdf', buffer: MOCK_PDF_1 }])
    } catch { threw = true }
    if (!threw) throw new Error('Expected throw for traversal name')
  })

  // T-7: absolute path in name throws — "/etc/passwd.pdf"
  await assert('T-7: absolute path in name throws', async () => {
    let threw = false
    try {
      await buildDiplomasZip([{ name: '/etc/passwd.pdf', buffer: MOCK_PDF_1 }])
    } catch { threw = true }
    if (!threw) throw new Error('Expected throw for absolute path name')
  })

  // T-8: subdirectory separator throws — "subdir/file.pdf"
  await assert('T-8: path separator in name throws', async () => {
    let threw = false
    try {
      await buildDiplomasZip([{ name: 'subdir/file.pdf', buffer: MOCK_PDF_1 }])
    } catch { threw = true }
    if (!threw) throw new Error('Expected throw for path separator in name')
  })

  // T-9: non-.pdf extension throws
  await assert('T-9: .png extension throws (only .pdf allowed)', async () => {
    let threw = false
    try {
      await buildDiplomasZip([{ name: 'SEN-2025-001.png', buffer: MOCK_PDF_1 }])
    } catch { threw = true }
    if (!threw) throw new Error('Expected throw for non-.pdf extension')
  })

  // T-10: empty buffer throws
  await assert('T-10: empty buffer throws', async () => {
    let threw = false
    try {
      await buildDiplomasZip([{ name: 'SEN-2025-001.pdf', buffer: Buffer.alloc(0) }])
    } catch { threw = true }
    if (!threw) throw new Error('Expected throw for empty buffer')
  })

  // T-11: duplicate names throw
  await assert('T-11: duplicate entry names throw', async () => {
    let threw = false
    try {
      await buildDiplomasZip([
        { name: 'SEN-2025-001.pdf', buffer: MOCK_PDF_1 },
        { name: 'SEN-2025-001.pdf', buffer: MOCK_PDF_2 },
      ])
    } catch { threw = true }
    if (!threw) throw new Error('Expected throw for duplicate names')
  })

  // T-12: ZIP magic bytes PK\x03\x04
  await assert('T-12: ZIP has correct magic bytes (PK\\x03\\x04)', async () => {
    const zip = await buildDiplomasZip([
      { name: 'SEN-2025-001.pdf', buffer: MOCK_PDF_1 },
    ])
    // ZIP local file header signature: 50 4B 03 04
    if (zip[0] !== 0x50 || zip[1] !== 0x4B || zip[2] !== 0x03 || zip[3] !== 0x04)
      throw new Error(`Bad magic: ${zip.slice(0, 4).toString('hex')}`)
  })

  console.log(`\n── Result: ${passed} passed, ${failed} failed ───────────────────────\n`)
  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
