/**
 * ZIP builder module — Sprint 3A (S3A-007)
 *
 * Packages a list of PDF buffers into a single ZIP archive.
 * MVP scope: ZIP contains only PDFs (DEC-S3-004).
 *
 * Security guarantees:
 *  - Each entry name is validated against path traversal, absolute paths,
 *    null bytes, and reserved characters before being added to the archive.
 *  - Only .pdf extension accepted.
 *  - Empty buffers and empty entry lists are rejected.
 */

import archiver from 'archiver'
import { Readable } from 'stream'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ZipEntry {
  /**
   * Filename inside the ZIP, e.g. "SEN-2025-001.pdf".
   * Must not contain path separators or parent-directory traversal sequences.
   */
  name: string
  /** PDF content. Must not be empty. */
  buffer: Buffer
}

export interface BuildZipOptions {
  /**
   * zlib compression level 0–9.
   * 0 = store only (fastest, larger file).
   * 6 = default — good balance for PDFs (already compressed internally).
   * Defaults to 6.
   */
  compressionLevel?: number
}

// ── Validation ────────────────────────────────────────────────────────────────

const SAFE_NAME_RE = /^[a-zA-Z0-9._\- ]+$/

/**
 * Validate a single ZIP entry name.
 * Throws a descriptive error if the name is unsafe or the buffer is invalid.
 */
function validateEntry(entry: ZipEntry, index: number): void {
  const { name, buffer } = entry
  const tag = `entry[${index}] "${name}"`

  if (!name || typeof name !== 'string') {
    throw new Error(`[zipper] ${tag}: name must be a non-empty string`)
  }

  // Block path traversal sequences
  if (name.includes('..')) {
    throw new Error(`[zipper] ${tag}: name must not contain '..' (path traversal)`)
  }

  // Block absolute paths
  if (name.startsWith('/') || name.startsWith('\\')) {
    throw new Error(`[zipper] ${tag}: name must not be an absolute path`)
  }

  // Block path separators (no subdirectories in MVP)
  if (name.includes('/') || name.includes('\\')) {
    throw new Error(`[zipper] ${tag}: name must not contain path separators`)
  }

  // Block null bytes
  if (name.includes('\x00')) {
    throw new Error(`[zipper] ${tag}: name must not contain null bytes`)
  }

  // Allowlist characters — prevents shell-special and header-injection chars
  if (!SAFE_NAME_RE.test(name)) {
    throw new Error(
      `[zipper] ${tag}: name contains disallowed characters (allowed: a-z A-Z 0-9 . _ - space)`
    )
  }

  // Enforce .pdf extension (DEC-S3-004)
  if (!name.toLowerCase().endsWith('.pdf')) {
    throw new Error(`[zipper] ${tag}: only .pdf entries are allowed in MVP ZIP`)
  }

  // Reject empty buffers
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error(`[zipper] ${tag}: buffer must be a non-empty Buffer`)
  }
}

/**
 * Validate every entry name up-front (without loading any buffer): traversal,
 * absolute paths, separators, null bytes, allowlisted chars, .pdf only, no duplicates.
 */
function assertSafeEntryNames(entryNames: string[]): void {
  entryNames.forEach((name, i) => {
    const tag = `entry[${i}] "${name}"`
    if (!name || typeof name !== 'string') throw new Error(`[zipper] ${tag}: name must be a non-empty string`)
    if (name.includes('..')) throw new Error(`[zipper] ${tag}: name must not contain '..'`)
    if (name.startsWith('/') || name.startsWith('\\')) throw new Error(`[zipper] ${tag}: absolute path not allowed`)
    if (name.includes('/') || name.includes('\\')) throw new Error(`[zipper] ${tag}: path separators not allowed`)
    if (name.includes('\x00')) throw new Error(`[zipper] ${tag}: null bytes not allowed`)
    if (!SAFE_NAME_RE.test(name)) throw new Error(`[zipper] ${tag}: disallowed characters`)
    if (!name.toLowerCase().endsWith('.pdf')) throw new Error(`[zipper] ${tag}: only .pdf allowed`)
  })

  const names = entryNames.map(n => n.toLowerCase())
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i)
  if (duplicates.length > 0) {
    throw new Error(`[zipper] duplicate entry name(s): ${Array.from(new Set(duplicates)).join(', ')}`)
  }
}

/**
 * Build a ZIP as a Readable stream, feeding one PDF at a time from a stream
 * and waiting for each entry to be flushed before opening the next. Pipe the
 * result straight to storage: memory stays flat regardless of batch size,
 * unlike buildDiplomasZipLazy which accumulates the whole archive in RAM.
 *
 * PDFs embed PNGs (already compressed), so entries are stored, not deflated.
 */
export function createDiplomasZipStream(
  entries: { name: string; getStream: () => Readable }[]
): Readable {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('[zipper] entries must be a non-empty array')
  }
  assertSafeEntryNames(entries.map(e => e.name))

  const archive = archiver.create('zip', { store: true })

  // Rejects if the archive errors or is closed early (e.g. the consumer failed),
  // so the feeder below never waits forever on an 'entry' that won't come.
  const aborted = new Promise<never>((_, reject) => {
    archive.once('error', reject)
    archive.once('close', () => reject(new Error('[zipper] archive closed before finalize')))
  })
  aborted.catch(() => {})

  ;(async () => {
    for (const entry of entries) {
      const flushed = new Promise<void>(resolve => archive.once('entry', () => resolve()))
      archive.append(entry.getStream(), { name: entry.name })
      await Promise.race([flushed, aborted])
    }
    await archive.finalize()
  })().catch(err => archive.destroy(err instanceof Error ? err : new Error(String(err))))

  return archive
}

// ── Streaming export ──────────────────────────────────────────────────────────

/**
 * Build a ZIP archive reading each PDF lazily (one at a time) via a callback.
 * Avoids holding all PDF buffers in RAM simultaneously — peak memory is O(1)
 * instead of O(N), which es crítico para lotes grandes en servidores con poca RAM.
 */
export async function buildDiplomasZipLazy(
  entries: { name: string; getBuffer: () => Promise<Buffer> }[],
  options: BuildZipOptions = {}
): Promise<Buffer> {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('[zipper] entries must be a non-empty array')
  }

  assertSafeEntryNames(entries.map(e => e.name))

  const level = options.compressionLevel ?? 6
  const archive = archiver.create('zip', { zlib: { level } })
  const chunks: Buffer[] = []

  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on('data', (chunk: Buffer) => chunks.push(chunk))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', (err: Error) => reject(new Error(`[zipper] archiver error: ${err.message}`)))
    archive.on('warning', (err: archiver.ArchiverError) => {
      if (err.code !== 'ENOENT') reject(new Error(`[zipper] archiver warning: ${err.message}`))
    })
  })

  // Read and append one PDF at a time — only one buffer in RAM per iteration
  for (const entry of entries) {
    const buffer = await entry.getBuffer()
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error(`[zipper] empty buffer for ${entry.name}`)
    }
    archive.append(Readable.from(buffer), { name: entry.name })
  }
  archive.finalize()

  return done
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build a ZIP archive containing the given PDF entries.
 *
 * @param entries  Array of { name, buffer } — each name must be a safe .pdf filename.
 * @param options  Optional compression level (default: 6).
 * @returns        ZIP archive as a Buffer.
 *
 * @throws  If entries is empty, or any entry fails validation.
 *
 * @example
 * const zip = await buildDiplomasZip([
 *   { name: 'SEN-2025-001.pdf', buffer: pdfBuf1 },
 *   { name: 'SEN-2025-002.pdf', buffer: pdfBuf2 },
 * ])
 * await storage.put(`zips/${generationId}/diplomas.zip`, zip)
 */
export async function buildDiplomasZip(
  entries: ZipEntry[],
  options: BuildZipOptions = {}
): Promise<Buffer> {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('[zipper] entries must be a non-empty array')
  }

  // Validate all entries up-front before touching archiver
  entries.forEach((entry, i) => validateEntry(entry, i))

  // Check for duplicate names — prevents silent overwrites inside the ZIP
  const names = entries.map((e) => e.name.toLowerCase())
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i)
  if (duplicates.length > 0) {
    throw new Error(`[zipper] duplicate entry name(s): ${Array.from(new Set(duplicates)).join(', ')}`)
  }

  const level = options.compressionLevel ?? 6

  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver.create('zip', { zlib: { level } })
    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => chunks.push(chunk))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', (err: Error) => reject(new Error(`[zipper] archiver error: ${err.message}`)))
    archive.on('warning', (err: archiver.ArchiverError) => {
      // Treat warnings as errors — no silent failures
      if (err.code !== 'ENOENT') {
        reject(new Error(`[zipper] archiver warning: ${err.message}`))
      }
    })

    for (const entry of entries) {
      const readable = Readable.from(entry.buffer)
      archive.append(readable, { name: entry.name })
    }

    archive.finalize()
  })
}
