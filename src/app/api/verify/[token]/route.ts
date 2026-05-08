import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { handleApiError, Errors } from '@/lib/api/errors'

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PUBLIC_CERT_SELECT = {
  status: true,
  folio: true,
  student_name: true,
  program: true,
  issued_date: true,
} as const

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    if (!UUID_V4_RE.test(params.token)) {
      throw Errors.VALIDATION('Token de verificación no válido')
    }

    const cert = await prisma.certificate.findUnique({
      where: { verification_token: params.token },
      select: PUBLIC_CERT_SELECT,
    })

    if (!cert) throw Errors.NOT_FOUND('Certificado')

    const isValid = cert.status === 'active'

    const response = NextResponse.json({
      valid: isValid,
      status: cert.status,
      folio: cert.folio,
      student_name: cert.student_name,
      program: cert.program,
      issued_date: cert.issued_date?.toISOString() ?? null,
      institution: 'Seneto',
      message: isValid ? 'Certificado válido' : 'Certificado no válido',
    })

    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleApiError(error)
  }
}
