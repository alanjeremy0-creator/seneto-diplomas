'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CertificateStatus } from '@/types/index'

// Only the fields needed for the generations dropdown
interface GenerationOption {
  id: string
  name: string
}

interface CertificateFiltersProps {
  generations: GenerationOption[]
}

const STATUS_OPTIONS: Array<{ value: CertificateStatus | ''; label: string }> = [
  { value: '',          label: 'Todos los estados' },
  { value: 'active',   label: 'Activo' },
  { value: 'pending',  label: 'Pendiente' },
  { value: 'revoked',  label: 'Revocado' },
  { value: 'expired',  label: 'Expirado' },
]

const INPUT_CLASS =
  'w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 ' +
  'placeholder:text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ' +
  'focus-visible:outline-gray-500'

export function CertificateFilters({ generations }: CertificateFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [generationFilter, setGenerationFilter] = useState(searchParams.get('generation_id') ?? '')
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build and push updated URL preserving unrelated params
  const updateParams = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(overrides).forEach(([k, v]) => {
        if (v) {
          params.set(k, v)
        } else {
          params.delete(k)
        }
      })
      // Reset page when filters change
      params.delete('page')
      router.replace(`/admin/certificates?${params.toString()}`)
    },
    [router, searchParams]
  )

  // Debounced text search
  useEffect(() => {
    setSearching(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParams({ q: query })
      setSearching(false)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, updateParams])

  function handleStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    setStatusFilter(e.target.value)
    updateParams({ status: e.target.value })
  }

  function handleGeneration(e: React.ChangeEvent<HTMLSelectElement>) {
    setGenerationFilter(e.target.value)
    updateParams({ generation_id: e.target.value })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {/* Búsqueda por nombre o folio */}
      <div className="flex-1">
        <label htmlFor="cert-search" className="mb-1 block text-xs font-medium text-gray-600">
          Buscar
        </label>
        <div className="relative">
          <input
            id="cert-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre o folio…"
            className={INPUT_CLASS}
            aria-label="Buscar certificados por nombre o folio"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
              <svg className="h-4 w-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Filtro por estado */}
      <div className="sm:w-44">
        <label htmlFor="cert-status" className="mb-1 block text-xs font-medium text-gray-600">
          Estado
        </label>
        <select
          id="cert-status"
          value={statusFilter}
          onChange={handleStatus}
          className={INPUT_CLASS}
          aria-label="Filtrar por estado de certificado"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Filtro por generación */}
      {generations.length > 0 && (
        <div className="sm:w-52">
          <label htmlFor="cert-generation" className="mb-1 block text-xs font-medium text-gray-600">
            Generación
          </label>
          <select
            id="cert-generation"
            value={generationFilter}
            onChange={handleGeneration}
            className={INPUT_CLASS}
            aria-label="Filtrar por generación"
          >
            <option value="">Todas las generaciones</option>
            {generations.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
