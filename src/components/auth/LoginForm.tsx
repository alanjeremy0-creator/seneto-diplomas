'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'Credenciales inválidas. Verifica tu correo y contraseña.',
  TooManyAttempts: 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.',
}

function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? 'Error al iniciar sesión. Intenta de nuevo.'
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    })

    if (!result?.ok) {
      setError(getErrorMessage(result?.error ?? ''))
      setLoading(false)
      return
    }

    router.push('/admin/generations')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-200"
    >
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-50"
            placeholder="admin@seneto.mx"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-50"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>
      </div>
    </form>
  )
}
