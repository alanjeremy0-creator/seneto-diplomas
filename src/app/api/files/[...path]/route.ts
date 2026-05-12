import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { storage } from '@/lib/storage/adapter'
import { handleApiError } from '@/lib/api/errors'
import { assertOwnership } from '@/lib/api/ownership'

const CONTENT_TYPES: Record<string, string> = {
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  gif:  'image/gif',
  webp: 'image/webp',
  pdf:  'application/pdf',
  zip:  'application/zip',
  csv:  'text/csv',
}

function inferContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
        { status: 401 }
      )
    }

    // Primera capa: bloquear segmentos '..' antes de llegar al storage
    if (params.path.some(segment => segment === '..')) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Path no permitido' } },
        { status: 400 }
      )
    }

    // Ownership check: todos los prefijos que contienen assets de una generación
    // requieren verificar que el admin autenticado sea propietario de ese generationId.
    const [prefix, generationId] = params.path
    const PREFIXES_WITH_OWNERSHIP = ['templates', 'photos', 'diplomas', 'zips', 'generations']
    if (PREFIXES_WITH_OWNERSHIP.includes(prefix) && generationId) {
      await assertOwnership(session, generationId)
    }

    const filePath = params.path.join('/')

    const exists = await storage.exists(filePath)
    if (!exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Archivo no encontrado' } },
        { status: 404 }
      )
    }

    const buffer = await storage.get(filePath)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': inferContentType(filePath),
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    // Segunda capa: storage.resolve() lanza Error para traversal que pase el primer filtro
    if (error instanceof Error && error.message.startsWith('Path traversal')) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Path no permitido' } },
        { status: 400 }
      )
    }
    return handleApiError(error)
  }
}
