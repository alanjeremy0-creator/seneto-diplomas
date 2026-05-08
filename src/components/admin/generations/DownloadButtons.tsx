'use client'

import { useState } from 'react'
import type { GenerationStatus } from '@/types/index'

interface Props {
  generationId: string
  status: GenerationStatus
  errorCount: number
}

async function fetchAndDownload(url: string, fallbackFilename: string): Promise<string | null> {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    return data?.error?.message ?? 'No se pudo descargar el archivo.'
  }
  const disposition = res.headers.get('Content-Disposition')
  const match = disposition?.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? fallbackFilename

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  return null
}

function DownloadButton({
  label,
  onClick,
  disabled,
  loading,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  loading: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
        disabled || loading
          ? 'cursor-not-allowed bg-gray-100 text-gray-400'
          : 'bg-gray-900 text-white hover:bg-gray-700'
      }`}
    >
      {loading ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Descargando...
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {label}
        </>
      )}
    </button>
  )
}

export function DownloadButtons({ generationId, status, errorCount }: Props) {
  const [zipLoading, setZipLoading] = useState(false)
  const [zipError, setZipError] = useState('')
  const [errCsvLoading, setErrCsvLoading] = useState(false)
  const [errCsvError, setErrCsvError] = useState('')

  const isCompleted = status === 'completed'

  async function handleZipDownload() {
    setZipError('')
    setZipLoading(true)
    try {
      const err = await fetchAndDownload(
        `/api/generations/${generationId}/download`,
        'diplomas.zip'
      )
      if (err) setZipError(err)
    } catch {
      setZipError('Error de red. Intenta de nuevo.')
    } finally {
      setZipLoading(false)
    }
  }

  async function handleErrCsvDownload() {
    setErrCsvError('')
    setErrCsvLoading(true)
    try {
      const err = await fetchAndDownload(
        `/api/generations/${generationId}/errors/csv`,
        'errores.csv'
      )
      if (err) setErrCsvError(err)
    } catch {
      setErrCsvError('Error de red. Intenta de nuevo.')
    } finally {
      setErrCsvLoading(false)
    }
  }

  const showErrCsv = errorCount > 0

  if (!isCompleted && !showErrCsv) {
    return (
      <p className="text-sm text-gray-400">
        La descarga estará disponible una vez completada la generación.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* ZIP de diplomas */}
      <div className="space-y-1.5">
        <DownloadButton
          label="Descargar ZIP de diplomas"
          onClick={handleZipDownload}
          disabled={!isCompleted}
          loading={zipLoading}
        />
        {!isCompleted && (
          <p className="text-xs text-gray-400">Disponible cuando la generación esté completada.</p>
        )}
        {zipError && (
          <div role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {zipError}
          </div>
        )}
      </div>

      {/* Reporte de errores CSV */}
      {showErrCsv && (
        <div className="space-y-1.5">
          <DownloadButton
            label={`Descargar reporte de errores (${errorCount})`}
            onClick={handleErrCsvDownload}
            disabled={false}
            loading={errCsvLoading}
          />
          {errCsvError && (
            <div role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errCsvError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
