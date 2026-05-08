'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GenerationStatus } from '@/types/index'

interface PreflightIssue {
  code: string
  message: string
}

type PanelState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'passed'; warnings: PreflightIssue[] }
  | { kind: 'blocked'; blockers: PreflightIssue[]; warnings: PreflightIssue[] }
  | { kind: 'error'; message: string }

interface Props {
  generationId: string
  status: GenerationStatus
}

function IssueRow({ issue, severity }: { issue: PreflightIssue; severity: 'blocker' | 'warning' }) {
  return (
    <li className="flex items-start gap-2.5">
      {severity === 'blocker' ? (
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      )}
      <span className={`text-sm ${severity === 'blocker' ? 'text-red-700' : 'text-yellow-800'}`}>
        {issue.message}
      </span>
    </li>
  )
}

export function PreflightPanel({ generationId, status }: Props) {
  const router = useRouter()
  const [panel, setPanel] = useState<PanelState>({ kind: 'idle' })

  // ── Static views for non-draft statuses ─────────────────────────────────

  if (status === 'ready') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <svg className="h-5 w-5 shrink-0 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium text-green-800">
          Verificación aprobada — la generación está lista para iniciar.
        </span>
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <p className="text-sm text-gray-500">
        La generación está en proceso. Revisa el estado en la sección de generación.
      </p>
    )
  }

  if (status === 'completed' || status === 'failed') {
    return (
      <p className="text-sm text-gray-500">
        La verificación previa ya fue ejecutada en una etapa anterior.
      </p>
    )
  }

  // ── Interactive panel (status === 'draft') ────────────────────────────────

  async function runPreflight() {
    setPanel({ kind: 'checking' })
    try {
      const res = await fetch(`/api/generations/${generationId}/preflight`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json()

      // 422 = blockers present; 200 = passed
      if (res.status === 422 || (res.ok && data.preflight)) {
        const { passed, blockers, warnings } = data.preflight as {
          passed: boolean
          blockers: PreflightIssue[]
          warnings: PreflightIssue[]
        }
        if (passed) {
          setPanel({ kind: 'passed', warnings })
          router.refresh()
        } else {
          setPanel({ kind: 'blocked', blockers, warnings })
        }
        return
      }

      if (!res.ok) {
        setPanel({
          kind: 'error',
          message: data?.error?.message ?? 'No se pudo ejecutar la verificación.',
        })
        return
      }

      setPanel({ kind: 'error', message: 'Respuesta inesperada del servidor.' })
    } catch {
      setPanel({ kind: 'error', message: 'Error de red. Intenta de nuevo.' })
    }
  }

  // idle
  if (panel.kind === 'idle') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Ejecuta la verificación para confirmar que la generación está lista antes de iniciar.
        </p>
        <button
          type="button"
          onClick={runPreflight}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Verificar antes de generar
        </button>
      </div>
    )
  }

  // checking
  if (panel.kind === 'checking') {
    return (
      <div aria-live="polite" aria-busy="true" className="flex items-center gap-2 text-sm text-gray-500">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Verificando...
      </div>
    )
  }

  // error
  if (panel.kind === 'error') {
    return (
      <div className="space-y-3">
        <div role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {panel.message}
        </div>
        <button
          type="button"
          onClick={runPreflight}
          className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Reintentar verificación
        </button>
      </div>
    )
  }

  // blocked
  if (panel.kind === 'blocked') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            Hay errores que debes corregir antes de generar.
          </p>
        </div>

        <ul className="space-y-2">
          {panel.blockers.map((issue) => (
            <IssueRow key={issue.code} issue={issue} severity="blocker" />
          ))}
          {panel.warnings.map((issue) => (
            <IssueRow key={issue.code} issue={issue} severity="warning" />
          ))}
        </ul>

        <button
          type="button"
          onClick={runPreflight}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver a verificar
        </button>
      </div>
    )
  }

  // passed (warnings may exist) — router.refresh() already fired, page re-renders as 'ready'
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <svg className="h-5 w-5 shrink-0 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium text-green-800">
          Todo listo para generar.
        </span>
      </div>

      {panel.warnings.length > 0 && (
        <ul className="space-y-2">
          {panel.warnings.map((issue) => (
            <IssueRow key={issue.code} issue={issue} severity="warning" />
          ))}
        </ul>
      )}
    </div>
  )
}
