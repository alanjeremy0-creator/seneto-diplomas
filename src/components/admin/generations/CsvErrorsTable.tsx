'use client'

import { useState } from 'react'

interface CsvRowError {
  row_number: number
  student_name?: string | null
  error_detail: string
}

interface Props {
  errors: CsvRowError[]
}

export function CsvErrorsTable({ errors }: Props) {
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
        <span>{errors.length} {errors.length === 1 ? 'fila con error' : 'filas con error'}</span>
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
                <th className="px-4 py-2 font-medium">Fila</th>
                <th className="px-4 py-2 font-medium">Alumno</th>
                <th className="px-4 py-2 font-medium">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {errors.map((err, i) => (
                <tr key={i} className="text-red-800">
                  <td className="px-4 py-2 tabular-nums">{err.row_number}</td>
                  <td className="px-4 py-2">{err.student_name ?? '—'}</td>
                  <td className="px-4 py-2">{err.error_detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
