import { NextRequest } from 'next/server'

export function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false

  const baseUrl = process.env.NEXTAUTH_URL
  if (!baseUrl) return false

  try {
    const allowed = new URL(baseUrl).origin
    return origin === allowed
  } catch {
    return false
  }
}
