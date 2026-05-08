import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = { title: 'Iniciar sesión — Seneto' }

export default async function LoginPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/admin/generations')

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Seneto</h1>
          <p className="mt-1 text-sm text-gray-500">Panel de administración</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
