'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  folio: string
  currentStatus: string
  onClose: () => void
}

export function RevokeDialog({ folio, currentStatus, onClose }: Props) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRevoked = currentStatus === 'revoked'
  const action = isRevoked ? 'reactivate' : 'revoke'
  const label = isRevoked ? 'Reactivar diploma' : 'Revocar diploma'
  const confirmColor = isRevoked
    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/certificates/${encodeURIComponent(folio)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error?.message ?? 'Error al actualizar el certificado')
      }
      router.refresh()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="revoke-dialog-title" className="text-lg font-semibold text-gray-900">
          {label}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {isRevoked
            ? `¿Confirmar reactivación del diploma ${folio}? El QR volverá a mostrar "Diploma válido y vigente".`
            : `¿Confirmar revocación del diploma ${folio}? El QR mostrará "Diploma revocado" inmediatamente.`}
        </p>

        {!isRevoked && (
          <div className="mt-4">
            <label htmlFor="revoke-reason" className="block text-sm font-medium text-gray-700">
              Motivo de revocación{' '}
              <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              id="revoke-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ej. Error en nombre del participante"
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${confirmColor}`}
          >
            {loading ? 'Procesando...' : label}
          </button>
        </div>
      </div>
    </div>
  )
}
