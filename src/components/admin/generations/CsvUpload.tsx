'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CsvErrorsTable } from './CsvErrorsTable'

interface CsvRowError {
  row_number: number
  student_name?: string | null
  error_detail: string
}

interface UploadSummary {
  accepted: number
  rejected: number
  errors: CsvRowError[]
}

interface Props {
  generationId: string
  hasExistingStudents: boolean
  disabled?: boolean
}

export function CsvUpload({ generationId, hasExistingStudents, disabled = false }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<UploadSummary | null>(null)
  const [confirmPending, setConfirmPending] = useState<File | null>(null)

  const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB — matches copy shown in the drop zone

  function clientValidate(file: File): string {
    if (file.size === 0) return 'El archivo está vacío.'
    if (file.size > MAX_SIZE_BYTES) return 'El archivo CSV supera el límite de 5 MB.'
    return ''
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) maybeConfirmThenUpload(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) maybeConfirmThenUpload(file)
    e.target.value = ''
  }

  function maybeConfirmThenUpload(file: File) {
    const validationError = clientValidate(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    if (hasExistingStudents || summary) {
      setConfirmPending(file)
    } else {
      uploadFile(file)
    }
  }

  async function uploadFile(file: File) {
    setConfirmPending(null)
    setError('')
    setSummary(null)
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`/api/generations/${generationId}/csv`, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudo procesar el CSV.')
        return
      }
      setSummary(data.summary)
      router.refresh()
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  const isInteractive = !disabled && !uploading

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Columnas requeridas: <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">student_name</code>,{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">program</code>.{' '}
        Columnas opcionales: <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">issued_date</code>{' '}
        (ejemplo: <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">2026-06-10</code> o <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">10/06/2026</code>).{' '}
        <a
          href="/plantilla-alumnos.csv"
          download
          className="text-gray-700 underline hover:text-gray-900"
        >
          Descargar plantilla
        </a>
      </p>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition ${
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-50'
            : dragging
            ? 'border-gray-500 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <svg
          className={`mb-2 h-8 w-8 ${disabled ? 'text-gray-300' : 'text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"
          />
        </svg>

        {uploading ? (
          <p className="text-sm text-gray-500">Subiendo...</p>
        ) : disabled ? (
          <p className="text-sm text-gray-400">
            Solo disponible cuando la generación está en borrador.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Arrastra un CSV aquí o{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-gray-900 underline hover:text-gray-700"
              >
                selecciona un archivo
              </button>
            </p>
            <p className="mt-1 text-xs text-gray-400">CSV · máx. 5 MB</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={!isInteractive}
          onChange={handleFileChange}
          aria-label="Seleccionar archivo CSV"
        />
      </div>

      {/* Error */}
      {error && (
        <div role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Success summary */}
      {summary && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">CSV procesado</p>
          <div className="mt-2 flex gap-4 text-sm">
            <span>
              <span className="font-semibold text-green-700">{summary.accepted}</span>{' '}
              <span className="text-gray-500">aceptados</span>
            </span>
            {summary.rejected > 0 && (
              <span>
                <span className="font-semibold text-red-700">{summary.rejected}</span>{' '}
                <span className="text-gray-500">rechazados</span>
              </span>
            )}
          </div>
          <CsvErrorsTable errors={summary.errors} />
        </div>
      )}

      {/* Re-upload confirmation dialog */}
      {confirmPending && (
        <div role="dialog" aria-modal="true" aria-label="Confirmar reemplazo de participantes" className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">
            Esto reemplazará los participantes actuales. ¿Deseas continuar?
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => uploadFile(confirmPending)}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Sí, reemplazar
            </button>
            <button
              type="button"
              onClick={() => setConfirmPending(null)}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
