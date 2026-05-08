import { StudentName } from './StudentName'
import type { CertificateStatus } from '@/types/index'

interface Props {
  status: CertificateStatus
  folio: string
  studentName: string | null
  program: string | null
  issuedDate: string | null
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return null
  }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

function ShieldXIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function PendingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

// ── Badge config per status ───────────────────────────────────────────────────

type BadgeConfig = {
  bg: string
  textColor: string
  label: string
  icon: React.ReactNode
  borderColor: string
}

function getBadgeConfig(status: CertificateStatus): BadgeConfig {
  switch (status) {
    case 'active':
      return {
        bg: 'rgba(22, 163, 74, 0.10)',
        textColor: '#14732c',
        label: 'Diploma válido',
        icon: <ShieldCheckIcon className="h-8 w-8" />,
        borderColor: 'rgba(22, 163, 74, 0.20)',
      }
    case 'revoked':
      return {
        bg: 'rgba(201, 53, 77, 0.10)',
        textColor: '#b02e43',
        label: 'Este diploma ha sido revocado',
        icon: <ShieldXIcon className="h-8 w-8" />,
        borderColor: 'rgba(201, 53, 77, 0.20)',
      }
    case 'expired':
      return {
        bg: 'rgba(138, 109, 0, 0.10)',
        textColor: '#755c00',
        label: 'Este diploma ha expirado',
        icon: <ClockIcon className="h-8 w-8" />,
        borderColor: 'rgba(138, 109, 0, 0.18)',
      }
    case 'pending':
    default:
      return {
        bg: 'rgba(138, 109, 0, 0.10)',
        textColor: '#755c00',
        label: 'Diploma en proceso',
        icon: <PendingIcon className="h-8 w-8" />,
        borderColor: 'rgba(107, 114, 128, 0.20)',
      }
  }
}

// ── Data row ─────────────────────────────────────────────────────────────────

function DataRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-widest text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-800">{value}</dd>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function VerificationCard({ status, folio, studentName, program, issuedDate }: Props) {
  const badge = getBadgeConfig(status)
  const formattedDate = formatDate(issuedDate)

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white shadow-md"
      style={{ borderColor: badge.borderColor }}
    >
      {/* ── Status badge ─────────────────────────────────────────────────── */}
      <div
        className="flex flex-col items-center gap-3 px-6 py-8 text-center"
        style={{ background: badge.bg, color: badge.textColor }}
      >
        <div aria-hidden="true">{badge.icon}</div>
        <div
          role="status"
          aria-live="polite"
          aria-label={`Estado del diploma: ${badge.label}`}
          className="text-lg font-semibold leading-snug"
        >
          {badge.label}
        </div>
      </div>

      {/* ── Certificate data ──────────────────────────────────────────────── */}
      <div className="px-6 py-6">
        {status === 'active' && (
          <>
            {/* Participant name — large and prominent */}
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
                Participante
              </p>
              <p className="mt-1 text-xl font-semibold leading-snug text-gray-900">
                <StudentName value={studentName} />
              </p>
              {program && (
                <p className="mt-1 text-sm text-gray-500">{program}</p>
              )}
            </div>
            <hr className="border-gray-100" />
            <dl className="mt-5 space-y-4">
              {formattedDate && <DataRow label="Emitido el" value={formattedDate} />}
              <DataRow label="Folio" value={folio} />
              <DataRow label="Institución" value="Seneto" />
            </dl>
          </>
        )}

        {status === 'revoked' && (
          <dl className="space-y-4">
            <DataRow label="Folio" value={folio} />
          </dl>
        )}

        {status === 'expired' && (
          <dl className="space-y-4">
            <DataRow label="Folio" value={folio} />
            {formattedDate && <DataRow label="Emitido el" value={formattedDate} />}
          </dl>
        )}

        {status === 'pending' && (
          <dl className="space-y-4">
            <DataRow label="Folio" value={folio} />
          </dl>
        )}
      </div>

      {/* ── Institutional text ────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 px-6 py-5">
        {status === 'active' && (
          <p className="text-sm leading-relaxed text-gray-500">
            Este diploma fue emitido por Seneto y se encuentra registrado como válido en nuestros sistemas.
          </p>
        )}
        {status === 'revoked' && (
          <>
            <p className="text-sm leading-relaxed text-gray-500">
              Este diploma fue emitido por Seneto pero ha sido revocado.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Para más información, contacta a Seneto.
            </p>
          </>
        )}
        {status === 'expired' && (
          <p className="text-sm leading-relaxed text-gray-500">
            Este diploma fue válido pero su vigencia ha expirado. Puedes contactar a Seneto para más información.
          </p>
        )}
        {status === 'pending' && (
          <p className="text-sm leading-relaxed text-gray-500">
            Este diploma está siendo procesado. Por favor, inténtalo de nuevo más tarde o contacta a Seneto.
          </p>
        )}
      </div>
    </div>
  )
}
