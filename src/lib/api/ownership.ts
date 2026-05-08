import { prisma } from '../db'
import { Errors } from './errors'
import type { UserRole } from '../../types'

// Forma mínima de sesión compatible con NextAuth + campos custom (id, role)
interface AuthSession {
  user?: {
    id?: string
    role?: UserRole | string
  }
}

export async function assertOwnership(
  session: AuthSession,
  generationId: string
): Promise<void> {
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { created_by: true },
  })

  if (!generation) {
    throw Errors.NOT_FOUND('Generación')
  }

  if (session.user?.role === 'superadmin') return

  if (!session.user?.id || generation.created_by !== session.user.id) {
    throw Errors.FORBIDDEN()
  }
}
