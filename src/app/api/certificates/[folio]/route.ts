import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'
import { validateOrigin } from '@/lib/api/origin'
import { logAction } from '@/lib/api/audit'

// photo_path and generation_id fetched internally; photo_path stripped, generation_id
// kept in response (not sensitive — mirrors generation.id in nested object)
const CERT_DETAIL_SELECT = {
  id: true,
  folio: true,
  student_name: true,
  program: true,
  issued_date: true,
  status: true,
  revoked_at: true,
  revocation_reason: true,
  photo_path: true,
  generation_id: true,
  created_at: true,
  updated_at: true,
  generation: {
    select: { id: true, name: true, folio_prefix: true, folio_year: true },
  },
} as const

export async function GET(
  _req: NextRequest,
  { params }: { params: { folio: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
        { status: 401 }
      )
    }

    const raw = await prisma.certificate.findUnique({
      where: { folio: params.folio },
      select: CERT_DETAIL_SELECT,
    })

    if (!raw) throw Errors.NOT_FOUND('Certificado')

    // Ownership check via the generation this certificate belongs to
    await assertOwnership(session, raw.generation_id)

    // Strip internal photo_path; expose computed has_photo
    const { photo_path, ...rest } = raw
    const certificate = { ...rest, has_photo: !!photo_path }

    return NextResponse.json({ certificate })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { folio: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
        { status: 401 }
      )
    }

    if (!validateOrigin(req)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Origin no permitido' } },
        { status: 403 }
      )
    }

    const raw = await prisma.certificate.findUnique({
      where: { folio: params.folio },
      select: { id: true, status: true, generation_id: true }
    })
    if (!raw) throw Errors.NOT_FOUND('Certificado')

    await assertOwnership(session, raw.generation_id)

    const body = await req.json()
    const user = session.user as { id: string; role: string }

    // ── Revoke / reactivate ───────────────────────────────────────────────────
    if (body.action === 'revoke' || body.action === 'reactivate') {
      const action = body.action as 'revoke' | 'reactivate'

      if (action === 'revoke') {
        if (raw.status === 'revoked') {
          throw Errors.VALIDATION('El certificado ya está revocado')
        }
        await prisma.certificate.update({
          where: { folio: params.folio },
          data: {
            status: 'revoked',
            revoked_at: new Date(),
            revocation_reason: (body.reason as string | undefined) ?? null,
          },
        })
        await logAction({
          action: 'certificate_revoke',
          userId: user.id,
          targetId: raw.id,
          detail: { folio: params.folio, reason: body.reason },
        })
      } else {
        if (raw.status !== 'revoked') {
          throw Errors.VALIDATION('Solo se puede reactivar un certificado revocado')
        }
        await prisma.certificate.update({
          where: { folio: params.folio },
          data: {
            status: 'active',
            revoked_at: null,
            revocation_reason: null,
          },
        })
        await logAction({
          action: 'certificate_reactivate',
          userId: user.id,
          targetId: raw.id,
          detail: { folio: params.folio },
        })
      }

      const updated = await prisma.certificate.findUnique({
        where: { folio: params.folio },
        select: { status: true, revoked_at: true, revocation_reason: true },
      })
      return NextResponse.json({ ok: true, certificate: updated })
    }

    // ── Update student_name ───────────────────────────────────────────────────
    const { student_name } = body

    if (student_name === undefined) {
      throw Errors.VALIDATION('No hay campos válidos para actualizar')
    }
    if (typeof student_name !== 'string' || !student_name.trim()) {
      throw Errors.VALIDATION('El nombre no puede estar vacío')
    }

    await prisma.certificate.update({
      where: { folio: params.folio },
      data: { student_name: student_name.trim() }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
