import Image from 'next/image'

type ErrorKind = 'invalid' | 'not-found' | 'server-error'

interface Props {
  kind: ErrorKind
  token: string
}

const CARD_CLASS =
  'overflow-hidden rounded-[2rem] border border-[#ececec] bg-white px-[22px] py-10 text-center sm:px-8'
const CARD_SHADOW = '0 1px 2px rgba(17,24,39,.04), 0 24px 48px -28px rgba(17,24,39,.18)'

export function VerificationError({ kind, token }: Props) {
  if (kind === 'server-error') {
    return (
      <article role="alert" className={CARD_CLASS} style={{ boxShadow: CARD_SHADOW }}>
        <div aria-hidden="true" className="mb-5 flex justify-center">
          <Image
            src="/icons/diploma_invalido_3d.png"
            alt=""
            width={64}
            height={64}
            className="h-16 w-16"
          />
        </div>
        <h1 className="text-base font-semibold text-[#1a1a1a]">
          No se pudo verificar el diploma en este momento.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#4b5563]">
          Intenta de nuevo en unos minutos. Si el problema persiste, contacta a Seneto.
        </p>
        <a
          href={`/v/${token}`}
          className="mt-6 inline-flex min-h-[44px] items-center rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-[#1a1a1a] hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a8ab5]"
        >
          Reintentar
        </a>
      </article>
    )
  }

  const isInvalid = kind === 'invalid'

  return (
    <article role="status" className={CARD_CLASS} style={{ boxShadow: CARD_SHADOW }}>
      <div aria-hidden="true" className="mb-5 flex justify-center">
        <Image
          src="/icons/diploma_invalido_3d.png"
          alt=""
          width={64}
          height={64}
          className="h-16 w-16"
        />
      </div>
      <h1 className="text-base font-semibold text-[#1a1a1a]">
        {isInvalid
          ? 'El enlace de verificación no es válido.'
          : 'No encontramos un diploma emitido por Seneto con este enlace de verificación.'}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#4b5563]">
        {isInvalid
          ? 'Verifica que el código QR esté completo y vuelve a intentarlo.'
          : 'Verifica que el enlace o el código QR sean correctos, o contacta a Seneto si crees que es un error.'}
      </p>
    </article>
  )
}
