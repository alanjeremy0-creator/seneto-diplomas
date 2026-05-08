'use client'

import { signOut, useSession } from 'next-auth/react'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession()

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      {/* Hamburger — mobile only */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Abrir menú de navegación"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500 lg:hidden"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Spacer so user section stays right-aligned on desktop (no hamburger) */}
      <div className="hidden lg:block" aria-hidden="true" />

      {/* User section */}
      <div className="flex items-center gap-3">
        {session?.user?.email && (
          <span className="hidden max-w-[200px] truncate text-sm text-gray-500 sm:block">
            {session.user.email}
          </span>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/admin/login' })}
          className="min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
