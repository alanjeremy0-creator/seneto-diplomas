import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AdminShell } from '@/components/admin/AdminShell'

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  return <AdminShell>{children}</AdminShell>
}
