'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  {
    href: '/admin/generations',
    label: 'Generaciones',
    icon: (
      <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: '/admin/certificates',
    label: 'Certificados',
    icon: (
      <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-gray-200 bg-white',
        'transition-transform duration-200 ease-in-out',
        'lg:static lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
      aria-label="Navegación principal"
    >
      {/* Logo */}
      <div className="flex h-16 flex-shrink-0 items-center border-b border-gray-200 px-6">
        <span className="text-lg font-semibold tracking-tight text-gray-900">Seneto</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Secciones del panel">
        {NAV_LINKS.map((link) => {
          const active = pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500',
              ].join(' ')}
            >
              {link.icon}
              {link.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
