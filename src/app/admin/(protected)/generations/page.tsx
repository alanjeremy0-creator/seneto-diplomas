import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { SAFE_GENERATION_SELECT } from '@/lib/api/selects'
import { GenerationList } from '@/components/admin/generations/GenerationList'
import { CreateGenerationButton } from '@/components/admin/generations/CreateGenerationButton'
import { EmptyState } from '@/components/ui/EmptyState'

export const metadata = { title: 'Generaciones — Seneto' }

export default async function GenerationsPage() {
  const session = await getServerSession(authOptions)

  const where =
    session?.user.role !== 'superadmin'
      ? { created_by: session!.user.id }
      : {}

  const generations = await prisma.generation.findMany({
    where,
    select: SAFE_GENERATION_SELECT,
    orderBy: { created_at: 'desc' },
    take: 20,
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">Generaciones</h1>
        <CreateGenerationButton />
      </div>

      {generations.length === 0 ? (
        <EmptyState
          title="Sin generaciones todavía"
          description="Crea tu primera generación para comenzar a cargar participantes y generar diplomas."
        />
      ) : (
        <GenerationList generations={generations} />
      )}
    </div>
  )
}
