'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

interface TemplateInfo {
  name: string
  image_width_px: number | null
  image_height_px: number | null
}

interface Props {
  generationId: string
  existing: TemplateInfo | null
  disabled?: boolean
}

export function TemplateUpload({ generationId, existing, disabled = false }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [uploaded, setUploaded] = useState<TemplateInfo | null>(null)
  const [confirmPending, setConfirmPending] = useState<File | null>(null)

  const hasImage = uploaded !== null || (existing?.image_width_px ?? null) !== null
  const displayInfo = uploaded ?? (hasImage ? existing : null)

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
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
    if (file.size > MAX_SIZE_BYTES) return 'El archivo supera el límite de 10 MB.'
    if (!file.type.includes('png') && !file.name.toLowerCase().endsWith('.png')) {
      return 'Solo se aceptan archivos PNG.'
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
    if (hasImage) {
      setConfirmPending(file)
    } else {
      uploadFile(file)
    }
  }

  async function uploadFile(file: File) {
    setConfirmPending(null)
    setError('')
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`/api/generations/${generationId}/template`, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudo subir la plantilla.')
        return
      }
      setUploaded(data.template)
      router.refresh()
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  if (disabled) {
    return (
      <div className="space-y-3">
        {displayInfo && (
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <svg className="h-6 w-6 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{displayInfo.name}</p>
              {displayInfo.image_width_px && displayInfo.image_height_px ? (
                <p className="text-xs text-gray-500">{displayInfo.image_width_px} × {displayInfo.image_height_px} px</p>
              ) : null}
            </div>
            <span className="ml-auto shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Subida</span>
          </div>
        )}
        <p className="text-sm text-gray-400">
          La plantilla no puede modificarse una vez iniciada la verificación.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Formato aceptado: <span className="font-medium text-gray-700">PNG</span> · máx. 10 MB.
      </p>

      {/* Current template info */}
      {displayInfo && (
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <svg
            className="h-6 w-6 shrink-0 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{displayInfo.name}</p>
            {displayInfo.image_width_px && displayInfo.image_height_px ? (
              <p className="text-xs text-gray-500">
                {displayInfo.image_width_px} × {displayInfo.image_height_px} px
              </p>
            ) : null}
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Subida
          </span>
        </div>
      )}

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
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>

        {uploading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Subiendo...
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Arrastra una imagen PNG aquí o{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-gray-900 underline hover:text-gray-700"
              >
                selecciona un archivo
              </button>
            </p>
            <p className="mt-1 text-xs text-gray-400">PNG · máx. 10 MB</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".png,image/png"
          className="sr-only"
          disabled={uploading}
          onChange={handleFileChange}
          aria-label="Seleccionar imagen PNG de plantilla"
        />
      </div>

      {/* Error */}
      {error && (
        <div role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Re-upload confirmation */}
      {confirmPending && (
        <div role="dialog" aria-modal="true" aria-label="Confirmar reemplazo de plantilla" className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">
            Esto reemplazará la plantilla actual. ¿Deseas continuar?
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
