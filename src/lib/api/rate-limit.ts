// Rate limiting en memoria — no persiste entre reinicios del servidor.
// Aceptado para MVP. Post-MVP: reemplazar con Redis para entornos distribuidos.

interface AttemptRecord {
  count: number
  firstAttempt: number
  lockedUntil: number
}

const attempts = new Map<string, AttemptRecord>()

const WINDOW_MS = 10 * 60 * 1000   // 10 minutos
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000  // 15 minutos

export function getClientIp(
  headers: Record<string, string | string[] | undefined>
): string {
  const forwarded = headers['x-forwarded-for']
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]
    return first.trim()
  }
  const realIp = headers['x-real-ip']
  if (realIp) {
    return (Array.isArray(realIp) ? realIp[0] : realIp).trim()
  }
  return 'unknown'
}

export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = attempts.get(ip)

  if (!record) return false

  if (record.lockedUntil > 0 && record.lockedUntil > now) return true

  if (now - record.firstAttempt > WINDOW_MS) {
    attempts.delete(ip)
    return false
  }

  return false
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now()
  const record = attempts.get(ip)

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAttempt: now, lockedUntil: 0 })
    return
  }

  record.count += 1

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS
  }
}

export function clearLoginAttempts(ip: string): void {
  attempts.delete(ip)
}
