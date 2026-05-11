import Image from 'next/image'
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

const CARD_SHADOW = '0 1px 2px rgba(17,24,39,.04), 0 24px 48px -28px rgba(17,24,39,.18)'

function getIcon3d(status: CertificateStatus): string {
  switch (status) {
    case 'active': return '/icons/diploma_valido_3d.png'
    case 'revoked': return '/icons/diploma_revocado_3d.png'
    case 'expired':
    case 'pending':
    default: return '/icons/diploma_invalido_3d.png'
  }
}

// ── Status banner config ──────────────────────────────────────────────────────

type BannerCfg = { bg: string; border: string; color: string; label: string; pulse: boolean }

function getBanner(status: CertificateStatus): BannerCfg {
  switch (status) {
    case 'active':
      return {
        bg: '#ecf7f0',
        border: '#bfe3cc',
        color: '#1f7a4d',
        label: 'Diploma válido y vigente',
        pulse: true,
      }
    case 'revoked':
      return {
        bg: '#fdecec',
        border: '#f3c2c2',
        color: '#b91c1c',
        label: 'Diploma revocado por la institución',
        pulse: false,
      }
    case 'expired':
      return {
        bg: '#fbf4dc',
        border: '#ead38a',
        color: '#8a6d00',
        label: 'Diploma vencido — requiere recertificación',
        pulse: false,
      }
    case 'pending':
    default:
      return {
        bg: '#fbf4dc',
        border: '#ead38a',
        color: '#8a6d00',
        label: 'Diploma en proceso',
        pulse: false,
      }
  }
}

// ── Trust ribbon config ───────────────────────────────────────────────────────

type TrustCfg = { icoColor: string; icoBg: string; strong: string; body: string }

function getTrust(status: CertificateStatus): TrustCfg {
  switch (status) {
    case 'active':
      return {
        icoColor: '#1f7a4d',
        icoBg: '#ecf7f0',
        strong: 'Verificado en tiempo real.',
        body: 'Este registro se consultó directamente en los sistemas de SENETO Nefrología. La información mostrada es pública y se actualiza al momento de cada escaneo.',
      }
    case 'revoked':
      return {
        icoColor: '#b91c1c',
        icoBg: '#fdecec',
        strong: 'Esta credencial no es válida.',
        body: 'Seneto ha cancelado este diploma desde el panel administrativo. No debe aceptarse como prueba de capacitación.',
      }
    case 'expired':
      return {
        icoColor: '#8a6d00',
        icoBg: '#fbf4dc',
        strong: 'Vigencia expirada.',
        body: 'La capacitación es real, pero su vigencia ha caducado conforme a la política de recertificación de Seneto.',
      }
    case 'pending':
    default:
      return {
        icoColor: '#8a6d00',
        icoBg: '#fbf4dc',
        strong: 'En proceso.',
        body: 'Este diploma está siendo procesado. Inténtalo de nuevo más tarde o contacta a Seneto.',
      }
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function VerificationCard({ status, folio, studentName, program, issuedDate }: Props) {
  const banner = getBanner(status)
  const trust = getTrust(status)
  const icon3d = getIcon3d(status)
  const formattedDate = formatDate(issuedDate)

  return (
    <>
      {/* Status banner — pill above card */}
      <div
        role="status"
        aria-live="polite"
        aria-label={`Estado del diploma: ${banner.label}`}
        className="flex items-center gap-3 rounded-full border-[1.5px] px-[18px] py-3.5 text-[14px] font-semibold tracking-[.02em]"
        style={{ background: banner.bg, borderColor: banner.border, color: banner.color }}
      >
        <span className="relative flex h-2.5 w-2.5 flex-none" aria-hidden="true">
          {banner.pulse && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          )}
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
        </span>
        <span>{banner.label}</span>
      </div>

      {/* Credential card */}
      <article
        className="overflow-hidden rounded-[2rem] border border-[#ececec] bg-white"
        style={{ boxShadow: CARD_SHADOW }}
      >
        {/* Header: eyebrow + title + 3D status icon + logos strip */}
        <div className="border-b border-dashed border-[#ececec]">
          <div className="flex items-start justify-between gap-4 px-[22px] pb-4 pt-7 sm:px-8">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#6b7280]">
                Diploma · Seneto
              </div>
              <h1 className="mt-1.5 text-[13px] font-semibold leading-snug tracking-[-0.005em] text-[#1a1a1a]">
                Diploma emitido por la institución
              </h1>
            </div>
            <Image
              src={icon3d}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 flex-none mix-blend-multiply"
            />
          </div>
          <div className="px-[22px] pb-5 sm:px-8">
            <Image
              src="/assets/brand/logos_instituciones-01.png"
              alt="Instituciones avaladoras"
              width={1782}
              height={444}
              className="h-auto w-full"
            />
            <p className="mt-2.5 text-center text-[11px] leading-relaxed text-[#6b7280]">
              El diploma tiene aval de la Facultad de Enfermería y Obstetricia, UAEMéx, Colegio de
              Enfermería del Estado de México y Colegio de Nefrólogos de Puebla.
            </p>
          </div>
        </div>

        {/* Body: participant + program + meta grid */}
        <div className="flex flex-col gap-6 px-[22px] py-7 sm:px-8">
          {/* Participant — hero */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#6b7280]">
              Participante
            </span>
            <span className="mt-0.5 text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[#1a1a1a] sm:text-[28px]">
              <StudentName value={studentName} />
            </span>
          </div>

          {/* Diplomado */}
          {program && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#6b7280]">
                Diplomado
              </span>
              <span className="mt-0.5 text-[17px] font-semibold leading-[1.4] text-[#1a1a1a]">
                {program}
              </span>
            </div>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-[18px] border-t border-dashed border-[#ececec] pt-6 sm:grid-cols-2 sm:gap-y-5">
            {formattedDate && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#6b7280]">
                  Emitido el
                </span>
                <span className="font-mono text-[13px] text-[#1a1a1a]">{formattedDate}</span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#6b7280]">
                Folio
              </span>
              <span className="font-mono text-[13px] text-[#1a1a1a]">{folio}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#6b7280]">
                Institución
              </span>
              <span className="text-[14px] text-[#1a1a1a]">Seneto · México</span>
            </div>
          </div>
        </div>

        {/* Trust ribbon */}
        <div className="flex items-center gap-3.5 border-t border-white/20 bg-[#e54360] px-[22px] py-5 sm:px-8">
          <div
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/20"
            aria-hidden="true"
          >
            <Image
              src={icon3d}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7"
            />
          </div>
          <p className="m-0 text-[12.5px] leading-[1.5] text-white">
            <strong className="font-semibold text-white">{trust.strong}</strong>{' '}
            {trust.body}
          </p>
        </div>
      </article>
    </>
  )
}
