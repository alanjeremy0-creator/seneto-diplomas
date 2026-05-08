import type { Metadata } from 'next'
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

// ── Page shell (shared across all states) ────────────────────────────────────

function PageShell({ token, children }: { token: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5]">
      <header className="flex items-center justify-center px-4 py-6">
        {/* Brand mark — PNG assets not available in MVP; using logotype text */}
        <div className="text-center">
          <span
            className="text-2xl font-bold tracking-widest text-[#1a1a1a]"
            aria-label="Seneto"
          >
            SENETO
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-10">
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </main>

      <footer className="px-4 py-6 text-center">
        <p className="text-xs text-gray-500">
          <a
            href="https://corporativoseneto.com"
            rel="noopener noreferrer"
            target="_blank"
            className="inline-flex min-h-[44px] items-center px-1 underline hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a8ab5]"
          >
            seneto.com
          </a>
          {/* DEC-005: privacy URL pending — rendered as plain text until URL is confirmed */}
          <span className="mx-1">·</span>
          <span className="px-1 text-gray-400">Privacidad</span>
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
      <PageShell token={token}>
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
      },
    })
    cert = raw ? { ...raw, status: raw.status as CertificateStatus } : null
  } catch {
    return (
      <PageShell token={token}>
        <VerificationError kind="server-error" token={token} />
      </PageShell>
    )
  }

  if (!cert) {
    return (
      <PageShell token={token}>
        <VerificationError kind="not-found" token={token} />
      </PageShell>
    )
  }

  return (
    <PageShell token={token}>
      <VerificationCard
        status={cert.status}
        folio={cert.folio}
        studentName={cert.student_name}
        program={cert.program}
        issuedDate={cert.issued_date ? cert.issued_date.toISOString() : null}
      />
    </PageShell>
  )
}
