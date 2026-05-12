import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateOrigin } from '@/lib/api/origin'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'
import { SAFE_GENERATION_DETAIL_SELECT } from '@/lib/api/selects'
import type { GenerationUpdateRequest } from '@/types/api'

// ---------------------------------------------------------------------------
// field_zones validation
// ---------------------------------------------------------------------------

function assertNum(val: unknown, label: string): number {
  if (typeof val !== 'number' || !isFinite(val)) {
    throw Errors.VALIDATION(`${label} debe ser un número`)
  }
  return val
}

function validateTextZone(key: string, z: unknown, imgW: number | null, imgH: number | null): void {
  if (!z || typeof z !== 'object') throw Errors.VALIDATION(`Zona "${key}" es requerida y debe ser un objeto`)
  const { x, y, width, height } = z as Record<string, unknown>
  const vx = assertNum(x, `${key}.x`)
  const vy = assertNum(y, `${key}.y`)
  const vw = assertNum(width, `${key}.width`)
  const vh = assertNum(height, `${key}.height`)
  if (vx < 0) throw Errors.VALIDATION(`Zona "${key}": x debe ser >= 0`)
  if (vy < 0) throw Errors.VALIDATION(`Zona "${key}": y debe ser >= 0`)
  if (vw <= 0) throw Errors.VALIDATION(`Zona "${key}": width debe ser > 0`)
  if (vh <= 0) throw Errors.VALIDATION(`Zona "${key}": height debe ser > 0`)
  if (imgW !== null && vx + vw > imgW) throw Errors.VALIDATION(`Zona "${key}": x + width (${vx + vw}) supera el ancho del canvas (${imgW})`)
  if (imgH !== null && vy + vh > imgH) throw Errors.VALIDATION(`Zona "${key}": y + height (${vy + vh}) supera el alto del canvas (${imgH})`)
}

function validateQrZone(z: unknown, imgW: number | null, imgH: number | null): void {
  if (!z || typeof z !== 'object') throw Errors.VALIDATION('Zona "qr" es requerida y debe ser un objeto')
  const { x, y, size } = z as Record<string, unknown>
  const vx = assertNum(x, 'qr.x')
  const vy = assertNum(y, 'qr.y')
  const vs = assertNum(size, 'qr.size')
  if (vx < 0) throw Errors.VALIDATION('Zona "qr": x debe ser >= 0')
  if (vy < 0) throw Errors.VALIDATION('Zona "qr": y debe ser >= 0')
  if (vs <= 0) throw Errors.VALIDATION('Zona "qr": size debe ser > 0')
  if (imgW !== null && vx + vs > imgW) throw Errors.VALIDATION(`Zona "qr": x + size (${vx + vs}) supera el ancho del canvas (${imgW})`)
  if (imgH !== null && vy + vs > imgH) throw Errors.VALIDATION(`Zona "qr": y + size (${vy + vs}) supera el alto del canvas (${imgH})`)
}

function validateFieldZones(fz: unknown, imgW: number | null, imgH: number | null): void {
  if (!fz || typeof fz !== 'object') throw Errors.VALIDATION('field_zones debe ser un objeto')
  const zones = fz as Record<string, unknown>

  validateTextZone('name', zones.name, imgW, imgH)
  validateTextZone('photo', zones.photo, imgW, imgH)
  validateQrZone(zones.qr, imgW, imgH)

  for (const key of ['folio', 'date', 'program'] as const) {
    if (zones[key] !== undefined) validateTextZone(key, zones[key], imgW, imgH)
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
        { status: 401 }
      )
    }

    await assertOwnership(session, params.id)

    const generation = await prisma.generation.findUnique({
      where: { id: params.id },
      select: SAFE_GENERATION_DETAIL_SELECT,
    })

    if (!generation) throw Errors.NOT_FOUND('Generación')

    return NextResponse.json({ generation })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
        { status: 401 }
      )
    }

    await assertOwnership(session, params.id)

    const gen = await prisma.generation.findUnique({
      where: { id: params.id },
      select: { status: true }
    })
    if (!gen) throw Errors.NOT_FOUND('Generación')

    if (gen.status === 'processing') {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'No se puede eliminar una generación en proceso' } },
        { status: 409 }
      )
    }

    await prisma.$transaction([
      prisma.generationError.deleteMany({ where: { generation_id: params.id } }),
      prisma.certificate.deleteMany({ where: { generation_id: params.id } }),
      prisma.generation.delete({ where: { id: params.id } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    // assertOwnership: superadmin → siempre pasa; admin → debe ser created_by
    await assertOwnership(session, params.id)

    const body: GenerationUpdateRequest = await req.json()

    const nameData: { name?: string } = {}
    if (body.name !== undefined) {
      if (!body.name.trim()) throw Errors.VALIDATION('El nombre no puede estar vacío')
      nameData.name = body.name.trim()
    }

    const hasFieldZones = body.field_zones !== undefined
    const hasNameUpdate = Object.keys(nameData).length > 0

    if (!hasNameUpdate && !hasFieldZones) {
      throw Errors.VALIDATION('No hay campos válidos para actualizar')
    }

    // field_zones va al template vinculado a la generación
    if (hasFieldZones) {
      const gen = await prisma.generation.findUnique({
        where: { id: params.id },
        select: {
          template_id: true,
          template: { select: { image_width_px: true, image_height_px: true } },
        },
      })
      if (!gen) throw Errors.NOT_FOUND('Generación')

      // Validar shape y bounds (usa dimensiones reales si la imagen ya fue subida)
      validateFieldZones(body.field_zones, gen.template?.image_width_px ?? null, gen.template?.image_height_px ?? null)

      await prisma.template.update({
        where: { id: gen.template_id },
        data: { field_zones: body.field_zones as unknown as Prisma.InputJsonValue },
      })
    }

    const generation = hasNameUpdate
      ? await prisma.generation.update({
          where: { id: params.id },
          data: nameData,
          select: SAFE_GENERATION_DETAIL_SELECT,
        })
      : await prisma.generation.findUnique({
          where: { id: params.id },
          select: SAFE_GENERATION_DETAIL_SELECT,
        })

    if (!generation) throw Errors.NOT_FOUND('Generación')
    return NextResponse.json({ generation })
  } catch (error) {
    return handleApiError(error)
  }
}
