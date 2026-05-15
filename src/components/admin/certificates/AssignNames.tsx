'use client'

import { useState } from 'react'

interface CertItem {
  folio: string
}

interface Props {
  certs: CertItem[]
}

type SaveState = 'idle' | 'saving' | 'done' | 'error'

export function AssignNames({ certs }: Props) {
  const [names, setNames] = useState<Record<string, string>>({})
  const [states, setStates] = useState<Record<string, SaveState>>({})

  const handleSave = async (folio: string) => {
    const name = names[folio]?.trim()
    if (!name) return

    setStates(prev => ({ ...prev, [folio]: 'saving' }))
    try {
      const res = await fetch(`/api/certificates/${folio}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_name: name }),
      })
      if (!res.ok) throw new Error()
      setStates(prev => ({ ...prev, [folio]: 'done' }))
    } catch {
      setStates(prev => ({ ...prev, [folio]: 'error' }))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, folio: string) => {
    if (e.key === 'Enter') handleSave(folio)
  }

  return (
    <div className="space-y-2">
      {certs.map(cert => {
        const state = states[cert.folio] ?? 'idle'
        const isDone = state === 'done'
        return (
          <div key={cert.folio} className="flex items-center gap-3">
            <span className="w-36 flex-shrink-0 font-mono text-sm text-gray-400">
              {cert.folio}
            </span>
            <input
              type="text"
              placeholder="Nombre del participante"
              value={names[cert.folio] ?? ''}
              onChange={e =>
                setNames(prev => ({ ...prev, [cert.folio]: e.target.value }))
              }
              onKeyDown={e => handleKeyDown(e, cert.folio)}
              disabled={isDone}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
            />
            {isDone ? (
              <span className="w-20 text-right text-sm text-green-600">Guardado</span>
            ) : (
              <button
                onClick={() => handleSave(cert.folio)}
                disabled={!names[cert.folio]?.trim() || state === 'saving'}
                className="w-20 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                {state === 'saving' ? '...' : 'Guardar'}
              </button>
            )}
            {state === 'error' && (
              <span className="text-sm text-red-500">Error</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
