'use client'

import { useState } from 'react'

type ErrorKind = 'invalid_file' | 'unmatched_folio' | 'traversal' | 'size_limit' | 'zip_bomb'

const ERROR_KIND_LABEL: Record<ErrorKind, string> = {
  invalid_file: 'Archivo no válido',
  unmatched_folio: 'Folio no encontrado en esta generación',
  traversal: 'Nombre de archivo no permitido',
  size_limit: 'Archivo demasiado grande',
  zip_bomb: 'Archivo comprimido sospechoso',
}

interface PhotoError {
  entry: string
  reason: string
  error_type: ErrorKind
}

interface Props {
  errors: PhotoError[]
}

export function PhotoErrorsTable({ errors }: Props) {
  const [open, setOpen] = useState(false)

  if (errors.length === 0) return null

  return (
    <div className="mt-3 rounded-lg border border-red-200 bg-red-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-100"
        aria-expanded={open}
      >
        <span>{errors.length} {errors.length === 1 ? 'foto con error' : 'fotos con error'}</span>
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-red-200">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-red-100 text-left text-red-700">
                <th className="px-4 py-2 font-medium">Archivo</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {errors.map((err, i) => (
                <tr key={i} className="text-red-800">
                  <td className="max-w-[160px] truncate px-4 py-2 font-mono">{err.entry}</td>
                  <td className="whitespace-nowrap px-4 py-2">{ERROR_KIND_LABEL[err.error_type] ?? err.error_type}</td>
                  <td className="px-4 py-2">{err.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
