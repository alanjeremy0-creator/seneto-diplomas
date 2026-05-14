import type { Metadata } from 'next'
import Image from 'next/image'
import { prisma } from '@/lib/db'
import { VerificationCard } from '@/components/verify/VerificationCard'
import { VerificationError } from '@/components/verify/VerificationError'
import type { CertificateStatus } from '@/types/index'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Verificación de Diploma — Seneto',
  description: 'Verifica la autenticidad de un diploma emitido por Seneto.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Verificación de diploma — Seneto',
    description: 'Verifica la autenticidad de un diploma emitido por Seneto.',
    siteName: 'Seneto',
  },
}

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ── Page shell ────────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#f5f5f5]">
      {/* Warm red blob — top-right fixed, very subtle */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-0"
        style={{
          inset: '-10% -10% auto auto',
          width: '60vw',
          height: '60vw',
          maxWidth: 700,
          maxHeight: 700,
          background: 'radial-gradient(circle, rgba(201,53,77,.07) 0%, transparent 60%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Topbar */}
      <header className="relative z-10 flex items-center justify-center border-b border-[#ececec] bg-white/70 px-5 py-4 backdrop-blur-md sm:px-8 sm:py-5">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/brand/SENETO_logo.png"
            alt="SENETO"
            width={72}
            height={72}
            className="h-9 w-auto"
            priority
          />
          <span className="h-5 w-px bg-[#e5e7eb]" aria-hidden="true" />
          <Image
            src="/assets/brand/SENETO_ensenanza_logo.png"
            alt="Seneto enseñanza"
            width={4424}
            height={1189}
            className="h-6 w-auto mix-blend-multiply"
          />
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 items-start justify-center px-4 py-6 sm:px-6 sm:py-14">
        <div className="flex w-full max-w-[480px] flex-col gap-4">{children}</div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#ececec] px-6 pb-10 pt-8 text-center text-[12px] text-[#6b7280]">
        <div className="mb-3 flex justify-center">
          <Image
            src="/assets/brand/SENETO_logo.png"
            alt="SENETO"
            width={72}
            height={72}
            className="h-10 w-auto opacity-60 mix-blend-multiply"
          />
        </div>
        <div className="flex justify-center gap-4">
          <a
            href="https://corporativoseneto.com"
            rel="noopener noreferrer"
            target="_blank"
            className="text-[#4b5563] no-underline hover:text-[#c9354d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a8ab5]"
          >
            corporativoseneto.com
          </a>
          <span className="text-[#9ca3af]">Privacidad</span>
        </div>
        <p className="mx-auto mt-2 max-w-[480px] leading-relaxed">
          Esta página confirma la autenticidad de credenciales emitidas por Seneto. No expone datos
          personales sensibles. Para reportar uso indebido escribe a admin@corporativoseneto.com.
        </p>
      </footer>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function VerifyPage({
  params,
}: {
  params: { token: string }
}) {
  const { token } = params

  if (!UUID_V4_RE.test(token)) {
    return (
      <PageShell>
        <VerificationError kind="invalid" token={token} />
      </PageShell>
    )
  }

  let cert: {
    status: CertificateStatus
    folio: string
    student_name: string
    program: string | null
    issued_date: Date | null
    generation_id: string
  } | null

  try {
    const raw = await prisma.certificate.findUnique({
      where: { verification_token: token },
      select: {
        status: true,
        folio: true,
        student_name: true,
        program: true,
        issued_date: true,
        generation_id: true,
      },
    })
    cert = raw ? { ...raw, status: raw.status as CertificateStatus } : null
  } catch {
    return (
      <PageShell>
        <VerificationError kind="server-error" token={token} />
      </PageShell>
    )
  }

  if (!cert) {
    return (
      <PageShell>
        <VerificationError kind="not-found" token={token} />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <VerificationCard
        status={cert.status}
        folio={cert.folio}
        studentName={cert.student_name}
        program={cert.program}
        issuedDate={cert.issued_date ? cert.issued_date.toISOString() : null}
        generationId={cert.generation_id}
      />
    </PageShell>
  )
}
