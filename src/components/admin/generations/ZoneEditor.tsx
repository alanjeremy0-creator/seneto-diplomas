'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FieldZones, FieldZone, QRZone } from '@/types/index'

type ZoneKey = keyof FieldZones

const ZONE_META: Record<ZoneKey, { label: string; required: boolean; border: string; bg: string; text: string; ring: string }> = {
  name:    { label: 'Nombre',    required: true,  border: 'border-blue-500',   bg: 'bg-blue-500/25',   text: 'text-blue-700',   ring: 'ring-blue-400' },
  photo:   { label: 'Foto',      required: true,  border: 'border-purple-500', bg: 'bg-purple-500/25', text: 'text-purple-700', ring: 'ring-purple-400' },
  qr:      { label: 'Código QR', required: true,  border: 'border-green-500',  bg: 'bg-green-500/25',  text: 'text-green-700',  ring: 'ring-green-400' },
  program: { label: 'Programa',  required: false, border: 'border-teal-500',   bg: 'bg-teal-500/25',   text: 'text-teal-700',   ring: 'ring-teal-400' },
  folio:   { label: 'Folio',     required: false, border: 'border-amber-500',  bg: 'bg-amber-500/25',  text: 'text-amber-700',  ring: 'ring-amber-400' },
  date:    { label: 'Fecha',     required: false, border: 'border-pink-500',   bg: 'bg-pink-500/25',   text: 'text-pink-700',   ring: 'ring-pink-400' },
}

const ZONE_ORDER: ZoneKey[] = ['name', 'photo', 'qr', 'program', 'folio', 'date']

interface ZoneState {
  enabled: boolean
  x: number
  y: number
  width: number  // QR: also height (kept square)
  height: number // QR: mirrors width
}

interface DragState {
  key: ZoneKey
  pointerId: number
  originClientX: number
  originClientY: number
  originZoneX: number
  originZoneY: number
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function buildDefaults(imgW: number, imgH: number): Record<ZoneKey, ZoneState> {
  const p = (pct: number, dim: number) => Math.round((pct / 100) * dim)
  return {
    name:    { enabled: true,  x: p(13, imgW), y: p(39, imgH), width: p(75, imgW), height: p(11, imgH) },
    photo:   { enabled: true,  x: p(6,  imgW), y: p(15, imgH), width: p(16, imgW), height: p(28, imgH) },
    qr:      { enabled: true,  x: p(83, imgW), y: p(74, imgH), width: p(10, imgW), height: p(10, imgW) },
    program: { enabled: false, x: p(13, imgW), y: p(52, imgH), width: p(60, imgW), height: p(7,  imgH) },
    folio:   { enabled: false, x: p(13, imgW), y: p(83, imgH), width: p(20, imgW), height: p(6,  imgH) },
    date:    { enabled: false, x: p(60, imgW), y: p(83, imgH), width: p(20, imgW), height: p(6,  imgH) },
  }
}

function fromFieldZones(fz: FieldZones | null, imgW: number, imgH: number): Record<ZoneKey, ZoneState> {
  const d = buildDefaults(imgW, imgH)
  if (!fz) return d
  const toState = (z: FieldZone): ZoneState => ({ enabled: true, x: z.x, y: z.y, width: z.width, height: z.height })
  return {
    name:    fz.name    ? toState(fz.name)    : d.name,
    photo:   fz.photo   ? toState(fz.photo)   : d.photo,
    qr:      fz.qr      ? { enabled: true, x: fz.qr.x, y: fz.qr.y, width: fz.qr.size, height: fz.qr.size } : d.qr,
    program: fz.program ? toState(fz.program) : { ...d.program, enabled: false },
    folio:   fz.folio   ? toState(fz.folio)   : { ...d.folio,   enabled: false },
    date:    fz.date    ? toState(fz.date)     : { ...d.date,    enabled: false },
  }
}

function toFieldZones(zones: Record<ZoneKey, ZoneState>): FieldZones {
  const toFZ = (z: ZoneState): FieldZone => ({ x: z.x, y: z.y, width: z.width, height: z.height })
  const toQR = (z: ZoneState): QRZone => ({ x: z.x, y: z.y, size: z.width })
  return {
    name:  toFZ(zones.name),
    photo: toFZ(zones.photo),
    qr:    toQR(zones.qr),
    ...(zones.program.enabled ? { program: toFZ(zones.program) } : {}),
    ...(zones.folio.enabled   ? { folio:   toFZ(zones.folio)   } : {}),
    ...(zones.date.enabled    ? { date:    toFZ(zones.date)     } : {}),
  }
}

function validateZones(zones: Record<ZoneKey, ZoneState>, imgW: number, imgH: number): string | null {
  for (const key of ZONE_ORDER) {
    const z = zones[key]
    if (!z.enabled) continue
    const label = ZONE_META[key].label
    if (z.x < 0)             return `Zona "${label}": X debe ser ≥ 0`
    if (z.y < 0)             return `Zona "${label}": Y debe ser ≥ 0`
    if (z.width <= 0)        return `Zona "${label}": ancho debe ser > 0`
    if (z.height <= 0)       return `Zona "${label}": alto debe ser > 0`
    if (z.x + z.width > imgW)  return `Zona "${label}": se sale del ancho del canvas (${z.x} + ${z.width} > ${imgW})`
    if (z.y + z.height > imgH) return `Zona "${label}": se sale del alto del canvas (${z.y} + ${z.height} > ${imgH})`
  }
  return null
}

interface Props {
  generationId: string
  disabled?: boolean
  hasImage: boolean
  imageWidthPx: number | null
  imageHeightPx: number | null
  initialZones: FieldZones | null
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          if (!isNaN(n)) onChange(n)
        }}
        className="w-full rounded border border-gray-200 px-2 py-1 text-sm tabular-nums text-gray-900 focus:border-gray-400 focus:outline-none"
      />
    </label>
  )
}

export function ZoneEditor({ generationId, disabled = false, hasImage, imageWidthPx, imageHeightPx, initialZones }: Props) {
  const router = useRouter()
  const imgW = imageWidthPx ?? 1920
  const imgH = imageHeightPx ?? 1080

  const [zones, setZones] = useState<Record<ZoneKey, ZoneState>>(() =>
    fromFieldZones(initialZones, imgW, imgH)
  )
  const [selected, setSelected] = useState<ZoneKey | null>(null)
  const [draggingKey, setDraggingKey] = useState<ZoneKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Drag state in a ref to avoid re-renders during pointer move
  const activeDrag = useRef<DragState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  if (disabled) {
    return (
      <p className="text-sm text-gray-400">
        Las zonas no pueden editarse una vez iniciada la verificación.
      </p>
    )
  }

  // ── Zone update helpers ──────────────────────────────────────────────────

  function updateZone(key: ZoneKey, patch: Partial<ZoneState>) {
    setSaved(false)
    setZones((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  function updateField(key: ZoneKey, field: 'x' | 'y' | 'width' | 'height', raw: number) {
    const patch: Partial<ZoneState> = { [field]: raw }
    // QR stays square: mirror width ↔ height
    if (key === 'qr' && field === 'width')  patch.height = raw
    if (key === 'qr' && field === 'height') patch.width  = raw
    updateZone(key, patch)
  }

  // ── Pointer / drag handlers ──────────────────────────────────────────────

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, key: ZoneKey) {
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    activeDrag.current = {
      key,
      pointerId: e.pointerId,
      originClientX: e.clientX,
      originClientY: e.clientY,
      originZoneX: zones[key].x,
      originZoneY: zones[key].y,
    }
    setDraggingKey(key)
    setSelected(key)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = activeDrag.current
    if (!drag || drag.pointerId !== e.pointerId) return

    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const scale = rect.width / imgW

    const dx = Math.round((e.clientX - drag.originClientX) / scale)
    const dy = Math.round((e.clientY - drag.originClientY) / scale)

    // Skip tiny sub-pixel noise
    if (dx === 0 && dy === 0) return

    const z = zones[drag.key]
    const newX = clamp(drag.originZoneX + dx, 0, imgW - z.width)
    const newY = clamp(drag.originZoneY + dy, 0, imgH - z.height)

    setZones((prev) => ({
      ...prev,
      [drag.key]: { ...prev[drag.key], x: newX, y: newY },
    }))
    setSaved(false)
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>, key: ZoneKey) {
    const drag = activeDrag.current
    if (!drag || drag.pointerId !== e.pointerId) return

    // If the pointer barely moved, treat as a click → toggle selection
    const movedPx = Math.abs(e.clientX - drag.originClientX) + Math.abs(e.clientY - drag.originClientY)
    if (movedPx <= 4) {
      setSelected((prev) => (prev === key ? null : key))
    }

    activeDrag.current = null
    setDraggingKey(null)
  }

  function onPointerCancel() {
    activeDrag.current = null
    setDraggingKey(null)
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    const validationError = validateZones(zones, imgW, imgH)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/generations/${generationId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_zones: toFieldZones(zones) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error?.message ?? 'No se pudieron guardar las zonas.')
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Image canvas with draggable zone overlays */}
      {hasImage ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          <div
            ref={containerRef}
            className="relative w-full select-none"
            style={{ aspectRatio: `${imgW}/${imgH}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/templates/${generationId}/template.png`}
              alt="Plantilla"
              className="absolute inset-0 h-full w-full object-fill"
              draggable={false}
            />

            {ZONE_ORDER.filter((k) => zones[k].enabled).map((key) => {
              const z = zones[key]
              const meta = ZONE_META[key]
              const isSelected = selected === key
              const isDragging = draggingKey === key

              return (
                <div
                  key={key}
                  role="presentation"
                  onPointerDown={(e) => onPointerDown(e, key)}
                  onPointerMove={onPointerMove}
                  onPointerUp={(e) => onPointerUp(e, key)}
                  onPointerCancel={onPointerCancel}
                  className={`absolute border-2 transition-shadow ${meta.border} ${meta.bg} ${
                    isDragging
                      ? 'cursor-grabbing opacity-90 shadow-lg'
                      : 'cursor-grab opacity-80 hover:opacity-95'
                  } ${isSelected ? `ring-2 ring-offset-1 ${meta.ring}` : ''}`}
                  style={{
                    left:   `${(z.x / imgW) * 100}%`,
                    top:    `${(z.y / imgH) * 100}%`,
                    width:  `${(z.width  / imgW) * 100}%`,
                    height: `${(z.height / imgH) * 100}%`,
                  }}
                >
                  <span className={`pointer-events-none absolute left-1 top-0.5 text-[10px] font-bold leading-none ${meta.text}`}>
                    {meta.label}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="px-3 py-1.5 text-[11px] text-gray-400">
            Arrastra una zona para reposicionarla. Usa los inputs para ajustar dimensiones.
          </p>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
          Sube una imagen de plantilla para ver y arrastrar las zonas sobre el diploma.
        </p>
      )}

      {/* Zone configuration panels */}
      <div className="grid gap-3 sm:grid-cols-2">
        {ZONE_ORDER.map((key) => {
          const z = zones[key]
          const meta = ZONE_META[key]
          const isQr = key === 'qr'
          const isActive = selected === key

          return (
            <div
              key={key}
              className={`rounded-lg border p-4 transition-colors ${
                isActive ? `${meta.border} ring-1 ring-inset ${meta.ring}` : 'border-gray-200'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelected((prev) => (prev === key ? null : key))}
                  className={`text-sm font-medium ${meta.text} hover:underline`}
                >
                  {meta.label}
                </button>
                {meta.required ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Requerida</span>
                ) : (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={z.enabled}
                      onChange={(e) => {
                        updateZone(key, { enabled: e.target.checked })
                        if (!e.target.checked && selected === key) setSelected(null)
                      }}
                      className="h-3.5 w-3.5 rounded border-gray-300 accent-gray-700"
                    />
                    Activa
                  </label>
                )}
              </div>

              {z.enabled ? (
                <div className="grid grid-cols-2 gap-2">
                  <NumInput label="X (px)" value={z.x} onChange={(v) => updateField(key, 'x', v)} />
                  <NumInput label="Y (px)" value={z.y} onChange={(v) => updateField(key, 'y', v)} />
                  {isQr ? (
                    <NumInput
                      label="Tamaño (px)"
                      value={z.width}
                      onChange={(v) => updateField(key, 'width', v)}
                    />
                  ) : (
                    <>
                      <NumInput label="Ancho (px)" value={z.width}  onChange={(v) => updateField(key, 'width',  v)} />
                      <NumInput label="Alto (px)"   value={z.height} onChange={(v) => updateField(key, 'height', v)} />
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Zona desactivada — no se renderizará en el diploma.</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {saving ? 'Guardando...' : 'Guardar zonas'}
        </button>
        {saved && <span className="text-sm text-green-700">Zonas guardadas.</span>}
      </div>
    </div>
  )
}
