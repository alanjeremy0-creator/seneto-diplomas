'use client'

import { useState, useEffect } from 'react'
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
  
  // Local state for polling
  const [currentStatus, setCurrentStatus] = useState<GenerationStatus>(status)
  const [currentProcessed, setCurrentProcessed] = useState(processedCount)
  const [currentErrors, setCurrentErrors] = useState(errorCount)

  const [confirming, setConfirming] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  // ── Polling logic ────────────────────────────────────────────────────────
  useEffect(() => {
    if (currentStatus !== 'processing') return

    let isMounted = true

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/generations/${generationId}/status`, {
          credentials: 'same-origin',
        })
        if (!res.ok) return // Ignore temp errors, don't spam requests

        const data = await res.json()
        if (!isMounted || !data?.generation) return

        const gen = data.generation
        
        setCurrentProcessed(gen.processed_count)
        setCurrentErrors(gen.error_count)

        if (gen.status === 'completed' || gen.status === 'failed') {
          setCurrentStatus(gen.status)
          clearInterval(interval)
          // Refresh router so the parent can show DownloadButtons or full status
          router.refresh()
        }
      } catch {
        // Network error — ignore silently to retry next tick without spam
      }
    }, 2500)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [currentStatus, generationId, router])

  // ── Static views for non-actionable statuses ────────────────────────────

  if (currentStatus === 'draft') {
    return (
      <p className="text-sm text-gray-400">
        Completa la verificación previa antes de iniciar la generación.
      </p>
    )
  }

  if (currentStatus === 'processing') {
    const progressPercent = totalCount > 0 ? Math.round((currentProcessed / totalCount) * 100) : 0

    return (
      <div className="space-y-3" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="h-4 w-4 animate-spin text-gray-900" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="font-medium text-gray-900">Generación en proceso...</span>
        </div>
        <div 
          className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de generación"
        >
          <div
            className="h-full bg-gray-900 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">
          Procesados {currentProcessed} de {totalCount} diplomas 
          {currentErrors > 0 && ` · ${currentErrors} errores`}
        </p>
      </div>
    )
  }

  if (currentStatus === 'completed') {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3" aria-live="polite">
        <svg className="mt-0.5 h-5 w-5 shrink-0 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        <div>
          <p className="text-sm font-medium text-green-800">Generación completada</p>
          <p className="text-xs text-green-700">
            {currentProcessed} {currentProcessed === 1 ? 'diploma procesado' : 'diplomas procesados'}
            {currentErrors > 0 && ` · ${currentErrors} con error`}
          </p>
        </div>
      </div>
    )
  }

  if (currentStatus === 'failed') {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3" aria-live="assertive">
        <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
        </svg>
        <div>
          <p className="text-sm font-medium text-red-800">La generación falló</p>
          <p className="mt-0.5 text-xs text-red-700">
            Revisa los errores en la sección de alumnos y vuelve a ejecutar el proceso desde la verificación previa.
          </p>
        </div>
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
      
      // Start polling immediately
      setCurrentStatus('processing')
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
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="inline-flex w-full sm:w-auto min-h-[44px] items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
              className="inline-flex w-full sm:w-auto min-h-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setError(''); setConfirming(true) }}
          className="inline-flex w-full sm:w-auto min-h-[44px] items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          Iniciar generación
        </button>
      )}
    </div>
  )
}
