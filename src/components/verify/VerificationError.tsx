type ErrorKind = 'invalid' | 'not-found' | 'server-error'

interface Props {
  kind: ErrorKind
  token: string
}

function SearchXIcon() {
  return (
    <svg
      className="h-12 w-12 text-gray-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
      <path d="m8 8 6 6" />
      <path d="m14 8-6 6" />
    </svg>
  )
}

function ServerCrashIcon() {
  return (
    <svg
      className="h-12 w-12 text-gray-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <path d="M6 6h.01" />
      <path d="M6 18h.01" />
      <path d="m13 6-4 6h6l-4 6" />
    </svg>
  )
}

export function VerificationError({ kind, token }: Props) {
  if (kind === 'server-error') {
    return (
      <div role="alert" className="rounded-2xl border bg-white px-6 py-10 text-center shadow-md" style={{ borderColor: 'rgba(107,114,128,0.15)' }}>
        <div className="mb-4 flex justify-center">
          <ServerCrashIcon />
        </div>
        <h1 className="text-base font-semibold text-gray-800">
          No se pudo verificar el diploma en este momento.
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Intenta de nuevo en unos minutos. Si el problema persiste, contacta a Seneto.
        </p>
        <a
          href={`/v/${token}`}
          className="mt-6 inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a8ab5]"
        >
          Reintentar
        </a>
      </div>
    )
  }

  const isInvalid = kind === 'invalid'

  return (
    <div role="status" className="rounded-2xl border bg-white px-6 py-10 text-center shadow-md" style={{ borderColor: 'rgba(107,114,128,0.15)' }}>
      <div className="mb-4 flex justify-center">
        <SearchXIcon />
      </div>
      <h1 className="text-base font-semibold text-gray-800">
        {isInvalid
          ? 'El enlace de verificación no es válido.'
          : 'No encontramos un diploma emitido por Seneto con este enlace de verificación.'}
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        {isInvalid
          ? 'Verifica que el código QR esté completo y vuelve a intentarlo.'
          : 'Verifica que el enlace o el código QR sean correctos, o contacta a Seneto si crees que es un error.'}
      </p>
    </div>
  )
}
