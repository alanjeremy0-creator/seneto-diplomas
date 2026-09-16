import { NextRequest } from 'next/server'

// Accepts requests from NEXTAUTH_URL, PUBLIC_VERIFY_BASE_URL, and any origins listed
// in ADDITIONAL_ALLOWED_ORIGINS (comma-separated) — needed while the app is reachable
// under multiple domains (e.g. corporativoseneto.com and corporativoseneto.mx).
function getAllowedOrigins(): Set<string> {
  const allowed = new Set<string>()

  for (const raw of [
    process.env.NEXTAUTH_URL,
    process.env.PUBLIC_VERIFY_BASE_URL,
    ...(process.env.ADDITIONAL_ALLOWED_ORIGINS?.split(',') ?? []),
  ]) {
    const trimmed = raw?.trim()
    if (!trimmed) continue
    try {
      allowed.add(new URL(trimmed).origin)
    } catch {
      // ignore malformed entries
    }
  }

  return allowed
}

export function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false

  return getAllowedOrigins().has(origin)
}
