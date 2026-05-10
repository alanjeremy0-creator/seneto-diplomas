'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function CreateGenerationModal({ isOpen, onClose }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [prefix, setPrefix] = useState('SEN')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Autofocus y reset al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    } else {
      setName('')
      setPrefix('SEN')
      setError('')
    }
  }, [isOpen])

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, loading, onClose])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setError('')
    setLoading(true)

    let data: { generation?: { id: string } } = {}
    try {
      const res = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: trimmed, folio_prefix: prefix.trim() || 'SEN' }),
      })
      data = await res.json()
      if (!res.ok) {
        setError((data as any)?.error?.message ?? 'No se pudo crear la generación.')
        setLoading(false)
        return
      }
    } catch {
      setError('Error de red. Intenta de nuevo.')
      setLoading(false)
      return
    }

    router.push(`/admin/generations/${data.generation!.id}`)
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={() => !loading && onClose()}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-gen-title"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="create-gen-title" className="text-base font-semibold text-gray-900">
          Nueva generación
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          {error && (
            <div role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="gen-name" className="block text-sm font-medium text-gray-700">
              Nombre de la generación
            </label>
            <input
              ref={inputRef}
              id="gen-name"
              type="text"
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              placeholder="Ej. Generación Primavera 2026"
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="gen-prefix" className="block text-sm font-medium text-gray-700">
              Prefijo de folio
            </label>
            <input
              id="gen-prefix"
              type="text"
              maxLength={10}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              disabled={loading}
              placeholder="SEN"
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-400">
              Ejemplo: SEN, DEMO o TEST. Se usará para folios como {(prefix.trim() || 'SEN')}-2026-0001.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? 'Creando...' : 'Crear generación'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
