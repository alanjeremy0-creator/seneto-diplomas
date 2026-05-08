'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PhotoErrorsTable } from './PhotoErrorsTable'

const MAX_SIZE_BYTES = 200 * 1024 * 1024 // 200 MB

type ErrorKind = 'invalid_file' | 'unmatched_folio' | 'traversal' | 'size_limit' | 'zip_bomb'

interface PhotoError {
  entry: string
  reason: string
  error_type: ErrorKind
}

interface UploadSummary {
  matched: number
  unmatched: number
  skipped_errors: number
  errors: PhotoError[]
}

interface Props {
  generationId: string
  hasCsv: boolean
  isDraft: boolean
  hasPhotos?: boolean
}

export function PhotosUpload({ generationId, hasCsv, isDraft, hasPhotos = false }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<UploadSummary | null>(null)
  const [confirmPending, setConfirmPending] = useState<File | null>(null)

  const disabled = !isDraft || !hasCsv

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
    if (file) maybeConfirm(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) maybeConfirm(file)
    e.target.value = ''
  }

  function clientValidate(file: File): string {
    if (file.size === 0) return 'El archivo está vacío.'
    if (file.size > MAX_SIZE_BYTES) return 'El archivo ZIP supera el límite de 200 MB.'
    if (!file.name.toLowerCase().endsWith('.zip') && file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
      return 'Solo se aceptan archivos ZIP.'
    }
    return ''
  }

  function maybeConfirm(file: File) {
    const validationError = clientValidate(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    if (summary !== null || hasPhotos) {
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
      const res = await fetch(`/api/generations/${generationId}/photos`, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudo procesar el ZIP.')
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

  if (!isDraft) {
    return (
      <p className="text-sm text-gray-400">
        Solo disponible cuando la generación está en borrador.
      </p>
    )
  }

  if (!hasCsv) {
    return (
      <p className="text-sm text-gray-400">
        Sube el CSV de alumnos antes de subir las fotos.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        El ZIP debe contener archivos PNG/JPG nombrados con el folio del alumno.{' '}
        Ejemplo: <code className="rounded bg-gray-100 px-1 py-0.5 font-mono">SEN-2026-0001.jpg</code> · máx. 200 MB.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition ${
          dragging ? 'border-gray-500 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <svg
          className="mb-2 h-8 w-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>

        {uploading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Procesando ZIP...
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Arrastra un ZIP aquí o{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-gray-900 underline hover:text-gray-700"
              >
                selecciona un archivo
              </button>
            </p>
            <p className="mt-1 text-xs text-gray-400">ZIP · máx. 200 MB · hasta 500 fotos</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="sr-only"
          disabled={uploading}
          onChange={handleFileChange}
          aria-label="Seleccionar archivo ZIP de fotos"
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
          <p className="text-sm font-medium text-gray-900">ZIP procesado</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span>
              <span className="font-semibold text-green-700">{summary.matched}</span>{' '}
              <span className="text-gray-500">fotos asignadas</span>
            </span>
            {summary.unmatched > 0 && (
              <span>
                <span className="font-semibold text-yellow-700">{summary.unmatched}</span>{' '}
                <span className="text-gray-500">sin folio coincidente</span>
              </span>
            )}
            {summary.skipped_errors > 0 && (
              <span>
                <span className="font-semibold text-red-700">{summary.skipped_errors}</span>{' '}
                <span className="text-gray-500">omitidas con error</span>
              </span>
            )}
          </div>
          <PhotoErrorsTable errors={summary.errors} />
        </div>
      )}

      {/* Re-upload confirmation */}
      {confirmPending && (
        <div role="dialog" aria-modal="true" aria-label="Confirmar reemplazo de fotos" className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">
            Esto reemplazará las fotos anteriores. ¿Deseas continuar?
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
