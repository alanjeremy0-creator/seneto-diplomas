'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GenerationStatus } from '@/types/index'

interface Props {
  generationId: string
  status: GenerationStatus
  totalCount: number
  processedCount: number
  errorCount: number
}

export function GenerationProgress({
  generationId,
  status,
  totalCount,
  processedCount,
  errorCount,
}: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  // ── Static views for non-actionable statuses ────────────────────────────

  if (status === 'draft') {
    return (
      <p className="text-sm text-gray-400">
        Completa la verificación previa antes de iniciar la generación.
      </p>
    )
  }

  if (status === 'processing') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Generación en proceso...
      </div>
    )
  }

  if (status === 'completed') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <svg className="h-5 w-5 shrink-0 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        <div>
          <p className="text-sm font-medium text-green-800">Generación completada.</p>
          <p className="text-xs text-green-700">
            {processedCount} {processedCount === 1 ? 'diploma procesado' : 'diplomas procesados'}
            {errorCount > 0 && ` · ${errorCount} con error`}
          </p>
        </div>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm font-medium text-red-800">La generación falló.</p>
        <p className="mt-0.5 text-xs text-red-700">
          Revisa los errores en la sección de alumnos y vuelve a ejecutar el proceso desde la verificación previa.
        </p>
      </div>
    )
  }

  // ── status === 'ready': interactive flow ─────────────────────────────────

  async function handleStart() {
    setError('')
    setStarting(true)
    setConfirming(false)
    try {
      const res = await fetch(`/api/generations/${generationId}/start`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudo iniciar la generación.')
        return
      }
      router.refresh()
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        La verificación fue aprobada.{' '}
        {totalCount > 0 && (
          <span className="text-gray-500">
            Se procesarán <span className="font-medium text-gray-900">{totalCount}</span>{' '}
            {totalCount === 1 ? 'diploma' : 'diplomas'}.
          </span>
        )}
      </p>

      {/* Error */}
      {error && (
        <div role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Confirm inline dialog */}
      {confirming ? (
        <div role="dialog" aria-modal="true" aria-label="Confirmar inicio de generación" className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">
            ¿Confirmas el inicio de la generación? Esta acción no se puede deshacer.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {starting ? 'Iniciando...' : 'Sí, iniciar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={starting}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setError(''); setConfirming(true) }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Iniciar generación
        </button>
      )}
    </div>
  )
}
