/**
 * QR generation module — Sprint 3A (S3A-001)
 *
 * Generates a PNG Buffer encoding the public verification URL for a diploma.
 * The URL always uses the verification_token, never the folio.
 *
 *   URL format: {PUBLIC_VERIFY_BASE_URL}/v/{verification_token}
 *
 * The base URL is normalised to prevent double-slash:
 *   "https://example.com/" + "v/token" → "https://example.com/v/token"  ✓
 *   "https://example.com"  + "v/token" → "https://example.com/v/token"  ✓
 */

import qrcode from 'qrcode'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QrParams {
  /** UUID v4 — verification_token from the Certificate record. Never the folio. */
  verificationToken: string
  /**
   * Public base URL, e.g. process.env.PUBLIC_VERIFY_BASE_URL.
   * Trailing slash is normalised internally.
   */
  baseUrl: string
  /** Width (and height) of the QR PNG in pixels. Defaults to 200. */
  sizePx?: number
  /** Quiet zone cells around the QR. Defaults to 1. */
  margin?: number
}

export interface QrResult {
  /** PNG image Buffer, ready to write to storage or composite with sharp. */
  buffer: Buffer
  /** The exact URL encoded in the QR — useful for audit/tests. */
  url: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalise base URL: strip trailing slash(es). */
function normaliseBase(raw: string): string {
  return raw.replace(/\/+$/, '')
}

/** Build the canonical public verification URL for a token. */
export function buildVerifyUrl(baseUrl: string, verificationToken: string): string {
  if (!verificationToken || !verificationToken.trim()) {
    throw new Error('[qr] verificationToken must not be empty')
  }
  if (!baseUrl || !baseUrl.trim()) {
    throw new Error('[qr] baseUrl must not be empty')
  }
  const base = normaliseBase(baseUrl.trim())
  return `${base}/v/${verificationToken}`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate a QR PNG Buffer encoding the public diploma verification URL.
 *
 * @example
 * const { buffer, url } = await generateQrBuffer({
 *   verificationToken: cert.verification_token,
 *   baseUrl: process.env.PUBLIC_VERIFY_BASE_URL ?? 'http://localhost:3000',
 * })
 */
export async function generateQrBuffer({
  verificationToken,
  baseUrl,
  sizePx = 200,
  margin = 1,
}: QrParams): Promise<QrResult> {
  const url = buildVerifyUrl(baseUrl, verificationToken)

  const buffer: Buffer = await qrcode.toBuffer(url, {
    type: 'png',
    width: sizePx,
    margin,
    errorCorrectionLevel: 'M', // ~15 % recovery — good balance for diploma use
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })

  return { buffer, url }
}
