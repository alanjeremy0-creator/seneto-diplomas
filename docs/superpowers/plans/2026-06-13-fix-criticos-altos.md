# Fix Críticos y Altos — Sistema de Diplomas Seneto

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediar los 6 hallazgos críticos y los altos prioritarios identificados en la auditoría QA del 2026-06-13, en el orden de menor riesgo a mayor, sin romper funcionalidad existente.

**Architecture:** Los fixes se agrupan en 7 tareas independientes por dominio. Las tareas 1-3 son seguridad pura (no cambian comportamiento visible). Las tareas 4-5 son UI/UX (changes visibles pero de bajo riesgo). Las tareas 6-7 son internals de performance y deuda técnica. Cada tarea puede correrse por un agente independiente porque sus archivos no se solapan.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 7, Tailwind CSS 3.4, NextAuth v4, archiver, sharp, pdf-lib.

**Contexto crítico para agentes:**
- `src/lib/api/validateOrigin.ts` (o `src/lib/api/origin.ts`) — importar como `import { validateOrigin } from '@/lib/api/origin'`
- `src/lib/api/ownership.ts` — `assertOwnership(session, generationId)` verifica sesión vs. `created_by`
- `src/lib/api/errors.ts` — `handleApiError(error)` y `Errors.FORBIDDEN`, `Errors.NOT_FOUND`, etc.
- `src/lib/audit.ts` (o `logAction` en `@/lib/audit`) — llamar para acciones críticas
- `src/types/next-auth.d.ts` — define `session.user.id` y `session.user.role` (NO usar `as any`)
- En los route handlers: `const user = session.user as { id: string; role: string }` es el patrón correcto

---

## Mapa de archivos

| Archivo | Tarea | Acción |
|---|---|---|
| `src/app/api/generations/[id]/route.ts` | 1 | Modificar — agregar `validateOrigin` en `DELETE` |
| `src/app/api/generations/[id]/reset/route.ts` | 1 | Modificar — agregar `validateOrigin`, `try/catch`, `logAction`, fix `as any` |
| `src/app/api/admin/revoke-by-names/route.ts` | 1 | Modificar — agregar `validateOrigin`, `logAction`, check superadmin |
| `prisma/schema.prisma` | 2 | Modificar — agregar `@@index` en `Certificate` |
| `prisma/migrations/YYYYMMDD.../migration.sql` | 2 | Crear — migración con `CREATE INDEX` |
| `next.config.mjs` | 3 | Modificar — agregar CSP y HSTS al bloque `headers()` |
| `src/app/api/certificates/[folio]/route.ts` | 4 | Modificar — agregar handlers `PATCH` para revocar/reactivar |
| `src/components/admin/certificates/RevokeDialog.tsx` | 4 | Crear — modal de confirmación de revocación |
| `src/components/admin/certificates/CertificateDetail.tsx` | 4 | Modificar — agregar botón "Revocar diploma" + import RevokeDialog |
| `src/components/verify/VerificationCard.tsx` | 4 | Modificar — fix copy "cancelado" → "revocado" en trust ribbon |
| `src/app/v/[token]/page.tsx` | 4 | Modificar — `<span>Privacidad</span>` → `<a href="/privacidad">` |
| `src/components/admin/generations/CsvUpload.tsx` | 5 | Modificar — fix URL `plantilla-alumnos.csv` y label `student_name` |
| `src/components/admin/generations/DownloadButtons.tsx` | 5 | Modificar — `min-h-[40px]` → `min-h-[44px]` |
| `src/components/admin/generations/ZoneEditor.tsx` | 5 | Modificar — `focus:outline-none` + `focus:ring-1 focus:ring-gray-400` |
| `src/lib/diploma/engine.ts` | 6 | Modificar — `include:` → `select:` para no cargar PII en RAM |
| `src/lib/diploma/composer.ts` | 6 | Modificar — `readFileSync` → `fs.promises.readFile` (async font load) |
| `src/app/admin/**/page.tsx` | 6 | Modificar — agregar `export const dynamic = 'force-dynamic'` donde falte |
| `src/lib/diploma/zipper.ts` | 7 | Modificar — streaming real con pipe a storage |
| `next.config.mjs` | 7 | Modificar — `ignoreBuildErrors: false`, `ignoreDuringBuilds: false` (después de fixes) |
| `docs/ARCHITECTURE_HANDOFF.md` | 7 | Modificar — actualizar sección 6 con paths reales |
| `.nvmrc` | 7 | Crear — `20.17.0` |
| `.github/workflows/ci.yml` | 7 | Crear — `tsc --noEmit` + `next lint` en push/PR |

---

## Task 1: Fix CSRF — validateOrigin en 3 endpoints críticos

**Files:**
- Modify: `src/app/api/generations/[id]/route.ts` (DELETE handler, líneas ~96-134)
- Modify: `src/app/api/generations/[id]/reset/route.ts`
- Modify: `src/app/api/admin/revoke-by-names/route.ts`

**Contexto:** Estos 3 endpoints tienen sesión válida pero no llaman `validateOrigin()`, lo que permite ataques CSRF desde otras páginas si el admin está logueado. `revoke-by-names` además no verifica que el usuario sea `superadmin` y no llama `logAction`. El `reset` usa `as any` para acceder a campos tipados en `next-auth.d.ts`. Ninguno tiene `try/catch`.

- [ ] **Step 1: Leer el helper `validateOrigin` para confirmar su firma**

```bash
cat src/lib/api/origin.ts
```
Expected: exporta `validateOrigin(req: NextRequest): boolean`

- [ ] **Step 2: Leer `src/types/next-auth.d.ts` para confirmar campos de sesión**

```bash
cat src/types/next-auth.d.ts
```
Expected: `session.user.id: string` y `session.user.role: string` están tipados.

- [ ] **Step 3: Leer `src/lib/audit.ts` (o buscar `logAction`) para confirmar su firma**

```bash
grep -r "logAction\|export.*log" src/lib/ --include="*.ts" -l
```
Luego leer el archivo encontrado. Expected: `logAction({ action, userId, targetId?, detail? })`

- [ ] **Step 4: Fix DELETE /api/generations/[id]**

En `src/app/api/generations/[id]/route.ts`, dentro del handler `DELETE` (línea ~96), agregar `validateOrigin` inmediatamente después de verificar la sesión:

```typescript
export async function DELETE(
  req: NextRequest,   // ← cambiar _req por req
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
        { status: 401 }
      )
    }

    if (!validateOrigin(req)) {   // ← AGREGAR esto
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Origin no permitido' } },
        { status: 403 }
      )
    }

    // ... resto del handler sin cambios
```

- [ ] **Step 5: Fix reset/route.ts — validateOrigin + try/catch + tipos + logAction**

Reemplazar `src/app/api/generations/[id]/reset/route.ts` completo:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateOrigin } from '@/lib/api/origin'
import { assertOwnership } from '@/lib/api/ownership'
import { handleApiError, Errors } from '@/lib/api/errors'
import { logAction } from '@/lib/audit'

// TEMPORAL — eliminar después de resetear la generación atascada.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })
    }

    if (!validateOrigin(req)) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Origin no permitido' } }, { status: 403 })
    }

    await assertOwnership(session, params.id)

    const gen = await prisma.generation.findUnique({
      where: { id: params.id },
      select: { id: true, status: true }
    })

    if (!gen) throw Errors.NOT_FOUND('Generación')

    await prisma.$transaction([
      prisma.certificate.updateMany({
        where: { generation_id: params.id },
        data: {
          status: 'pending',
          diploma_pdf_path: null,
          diploma_png_path: null,
          error_message: null,
        }
      }),
      prisma.generation.update({
        where: { id: params.id },
        data: {
          status: 'ready',
          processed_count: 0,
          error_count: 0,
          zip_path: null,
        }
      })
    ])

    const user = session.user as { id: string; role: string }
    await logAction({ action: 'generation_reset', userId: user.id, targetId: params.id })

    return NextResponse.json({ ok: true, message: 'Generación reseteada correctamente.' })
  } catch (error) {
    return handleApiError(error)
  }
}
```

> **Nota:** si `logAction` tiene una firma diferente a la encontrada en el Step 3, ajustar los argumentos.

- [ ] **Step 6: Fix revoke-by-names/route.ts — validateOrigin + superadmin check + logAction**

Reemplazar `src/app/api/admin/revoke-by-names/route.ts` completo:

```typescript
// TEMPORAL — eliminar después de limpiar los certificados incorrectos.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateOrigin } from '@/lib/api/origin'
import { handleApiError, Errors } from '@/lib/api/errors'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })
    }

    if (!validateOrigin(req)) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Origin no permitido' } }, { status: 403 })
    }

    const user = session.user as { id: string; role: string }
    if (user.role !== 'superadmin') {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Solo superadmin puede usar este endpoint' } }, { status: 403 })
    }

    const { generationIds, studentNames, action = 'revoke' }: {
      generationIds: string[]
      studentNames: string[]
      action?: 'revoke' | 'delete'
    } = await req.json()

    if (!generationIds?.length || !studentNames?.length) {
      throw Errors.VALIDATION('generationIds y studentNames son requeridos')
    }

    const found = await prisma.certificate.findMany({
      where: {
        generation_id: { in: generationIds },
        student_name: { in: studentNames },
      },
      select: { id: true, folio: true, student_name: true, status: true, generation_id: true }
    })

    if (found.length === 0) {
      return NextResponse.json({ ok: true, affected: 0, detail: 'No se encontraron certificados con esos nombres.' })
    }

    const ids = found.map(c => c.id)

    if (action === 'delete') {
      await prisma.certificate.deleteMany({ where: { id: { in: ids } } })
      await logAction({ action: 'certificates_bulk_delete', userId: user.id, detail: { count: ids.length, generationIds } })
      return NextResponse.json({
        ok: true,
        deleted: found.length,
        detail: found.map(c => ({ folio: c.folio, name: c.student_name, action: 'eliminado' }))
      })
    }

    await prisma.certificate.updateMany({
      where: { id: { in: ids } },
      data: { status: 'revoked', revoked_at: new Date() }
    })
    await logAction({ action: 'certificates_bulk_revoke', userId: user.id, detail: { count: ids.length, generationIds } })

    return NextResponse.json({
      ok: true,
      revoked: found.length,
      detail: found.map(c => ({ folio: c.folio, name: c.student_name, action: 'revocado' }))
    })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 7: Verificar que TypeScript no reporta errores en los 3 archivos**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | grep -E "reset|revoke|generations/\[id\]/route" | head -20
```

Si hay errores, corregirlos (probablemente la firma de `logAction`).

- [ ] **Step 8: Commit**

```bash
git add src/app/api/generations/[id]/route.ts \
        src/app/api/generations/[id]/reset/route.ts \
        src/app/api/admin/revoke-by-names/route.ts
git commit -m "fix(security): agregar validateOrigin a DELETE /generations y endpoints temporales"
```

---

## Task 2: Índices de BD en tabla certificates

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_certificate_indexes/migration.sql`

**Contexto:** La tabla `certificates` no tiene ningún `@@index`. Todas las queries del engine (`WHERE status = 'pending'`), el listado en el admin (filtros por status, generation_id), y la búsqueda por `verification_token` hacen full-scan. Con crecimiento a 10× volumen esto degrada severamente. El schema actualmente usa `String` para los campos `status` — no se cambia a enum en esta tarea (eso es Task 7).

- [ ] **Step 1: Leer el modelo Certificate actual**

```bash
grep -A 30 "model Certificate" prisma/schema.prisma
```

Confirmar que no existe ningún `@@index`.

- [ ] **Step 2: Agregar los índices al schema**

En `prisma/schema.prisma`, en el modelo `Certificate`, agregar antes del `@@map("certificates")`:

```prisma
  @@index([generation_id])
  @@index([status])
  @@index([verification_token])
  @@index([folio])
```

El bloque final del modelo debe quedar:

```prisma
model Certificate {
  id                  String       @id @default(cuid())
  folio               String       @unique
  verification_token  String       @unique @default(uuid())
  generation_id       String
  student_name        String
  email               String?
  program             String?
  issued_date         DateTime?
  status              String       @default("pending")
  photo_path          String?
  diploma_pdf_path    String?
  diploma_png_path    String?
  error_message       String?
  created_at          DateTime     @default(now())
  updated_at          DateTime     @updatedAt
  revoked_at          DateTime?
  revocation_reason   String?

  generation          Generation   @relation(fields: [generation_id], references: [id])

  @@index([generation_id])
  @@index([status])
  @@index([verification_token])
  @@index([folio])
  @@map("certificates")
}
```

> **Nota:** `folio` y `verification_token` ya tienen `@unique`, que implica un índice. Prisma los acepta también como `@@index` sin conflicto, pero si el linter de Prisma los rechaza, puedes omitir los `@@index` para esos dos.

- [ ] **Step 3: Generar la migración**

```bash
npx prisma migrate dev --name add_certificate_indexes --create-only
```

Expected: crea `prisma/migrations/<timestamp>_add_certificate_indexes/migration.sql`

- [ ] **Step 4: Revisar el SQL generado**

```bash
cat prisma/migrations/$(ls -t prisma/migrations | head -1)/migration.sql
```

Expected: `CREATE INDEX` para los 4 campos (o 2 si Prisma omite los que ya tienen `@unique`).

- [ ] **Step 5: Aplicar la migración en la BD de desarrollo**

```bash
npx prisma migrate dev
```

Expected: `✔ Your database is now in sync with your schema.`

- [ ] **Step 6: Regenerar el cliente Prisma**

```bash
npx prisma generate
```

- [ ] **Step 7: Verificar que el build no tiene errores relacionados con Prisma**

```bash
npx tsc --noEmit 2>&1 | grep -i prisma | head -10
```

Expected: sin errores de Prisma.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "fix(db): agregar índices en certificates (generation_id, status, verification_token, folio)"
```

---

## Task 3: Security headers — CSP y HSTS

**Files:**
- Modify: `next.config.mjs`

**Contexto:** El bloque `headers()` ya tiene 5 headers correctos (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`). Faltan `Content-Security-Policy` y `Strict-Transport-Security`. El sistema maneja autenticación con NextAuth y PDFs con valor legal, por lo que CSP es crítico para prevenir XSS.

**Nota sobre CSP:** Un CSP demasiado estricto puede romper Next.js (inline scripts, hydration). La política recomendada para Next.js 14 en esta etapa es restrictiva pero funcional. Si hay errores de CSP en el browser después del deploy, revisar la consola de red para ajustar.

- [ ] **Step 1: Leer next.config.mjs para confirmar estructura actual**

```bash
cat next.config.mjs
```

Expected: un bloque `headers()` con 5 headers, sin CSP ni HSTS.

- [ ] **Step 2: Agregar CSP y HSTS al bloque headers()**

Reemplazar `next.config.mjs` completo con:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['canvas', 'sharp'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

> **Nota:** `'unsafe-inline'` y `'unsafe-eval'` en `script-src` son necesarios para Next.js 14 App Router (hydration scripts). En una iteración futura se puede endurecer con nonces, pero rompe el build de Next.js sin configuración adicional.

- [ ] **Step 3: Verificar que el archivo se guardó correctamente**

```bash
grep -c "Content-Security-Policy\|Strict-Transport-Security" next.config.mjs
```

Expected: `2`

- [ ] **Step 4: Verificar que el servidor arranca sin errores**

```bash
npm run build 2>&1 | tail -20
```

Expected: build exitoso (puede haber warnings de TS/ESLint pero no errores de config).

- [ ] **Step 5: Commit**

```bash
git add next.config.mjs
git commit -m "fix(security): agregar Content-Security-Policy y Strict-Transport-Security"
```

---

## Task 4: UI de revocación + fixes de copy en página pública

**Files:**
- Modify: `src/app/api/certificates/[folio]/route.ts`
- Create: `src/components/admin/certificates/RevokeDialog.tsx`
- Modify: `src/components/admin/certificates/CertificateDetail.tsx`
- Modify: `src/components/verify/VerificationCard.tsx`
- Modify: `src/app/v/[token]/page.tsx`

**Contexto:** El admin necesita poder revocar diplomas desde el detalle del certificado (`/admin/certificates/[folio]`). La API de revocación individual no existe — hay que crearla. El schema de Prisma ya tiene `revoked_at` y `revocation_reason` en `Certificate`. Además, el trust ribbon en la página pública dice "cancelado" en lugar de "revocado", y "Privacidad" es un `<span>` sin enlace.

**Contexto de tipos:** Revisar `src/types/api.ts` para ver si `CertificateDetailItem` incluye el campo `status` — si sí, el botón de revocar/reactivar puede condicionar sobre `cert.status`. La sesión del admin NO está disponible en el Server Component `CertificateDetail.tsx`; el botón de revocar debe ser un Client Component con fetch.

- [ ] **Step 1: Leer el archivo de tipos para entender CertificateDetailItem**

```bash
cat src/types/api.ts
```

Confirmar los campos de `CertificateDetailItem`. Si no existe, buscar:

```bash
grep -r "CertificateDetailItem" src/types/ src/app/ --include="*.ts" -l
```

- [ ] **Step 2: Leer el route handler existente de certificates/[folio]**

```bash
cat src/app/api/certificates/[folio]/route.ts
```

Ver qué métodos ya existen y cómo manejan la sesión y ownership.

- [ ] **Step 3: Agregar handler PATCH a certificates/[folio]/route.ts**

En `src/app/api/certificates/[folio]/route.ts`, agregar al final del archivo:

```typescript
// PATCH /api/certificates/[folio] — revocar o reactivar un certificado
export async function PATCH(
  req: NextRequest,
  { params }: { params: { folio: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
        { status: 401 }
      )
    }

    if (!validateOrigin(req)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Origin no permitido' } },
        { status: 403 }
      )
    }

    const body: { action: 'revoke' | 'reactivate'; reason?: string } = await req.json()

    if (body.action !== 'revoke' && body.action !== 'reactivate') {
      throw Errors.VALIDATION('action debe ser "revoke" o "reactivate"')
    }

    const cert = await prisma.certificate.findUnique({
      where: { folio: params.folio },
      select: { id: true, status: true, generation: { select: { created_by: true } } }
    })

    if (!cert) throw Errors.NOT_FOUND('Certificado')

    const user = session.user as { id: string; role: string }
    if (cert.generation.created_by !== user.id && user.role !== 'superadmin') {
      throw Errors.FORBIDDEN()
    }

    if (body.action === 'revoke') {
      if (cert.status === 'revoked') {
        throw Errors.VALIDATION('El certificado ya está revocado')
      }
      await prisma.certificate.update({
        where: { folio: params.folio },
        data: {
          status: 'revoked',
          revoked_at: new Date(),
          revocation_reason: body.reason ?? null,
        }
      })
      await logAction({ action: 'certificate_revoke', userId: user.id, targetId: cert.id, detail: { folio: params.folio, reason: body.reason } })
    } else {
      if (cert.status !== 'revoked') {
        throw Errors.VALIDATION('Solo se puede reactivar un certificado revocado')
      }
      await prisma.certificate.update({
        where: { folio: params.folio },
        data: {
          status: 'active',
          revoked_at: null,
          revocation_reason: null,
        }
      })
      await logAction({ action: 'certificate_reactivate', userId: user.id, targetId: cert.id, detail: { folio: params.folio } })
    }

    const updated = await prisma.certificate.findUnique({
      where: { folio: params.folio },
      select: { status: true, revoked_at: true, revocation_reason: true }
    })

    return NextResponse.json({ ok: true, certificate: updated })
  } catch (error) {
    return handleApiError(error)
  }
}
```

> **Nota:** Agregar los imports necesarios al tope del archivo (`validateOrigin`, `logAction`, `Errors`) si no están ya.

- [ ] **Step 4: Crear RevokeDialog.tsx**

Crear `src/components/admin/certificates/RevokeDialog.tsx`:

```typescript
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
  const confirmColor = isRevoked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'

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
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
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
              Motivo de revocación <span className="text-gray-400">(opcional)</span>
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
```

- [ ] **Step 5: Modificar CertificateDetail.tsx para agregar botón de revocar**

En `src/components/admin/certificates/CertificateDetail.tsx`:

1. Agregar `'use client'` al tope (necesita `useState` para el dialog).
2. Importar `RevokeDialog` y `useState`.
3. Agregar el botón después del header card.

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CertificateDetailItem } from '@/types/api'
import type { CertificateStatus } from '@/types/index'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { RevokeDialog } from './RevokeDialog'

// ... (mantener DataRow, PhotoChip, RevocationBlock sin cambios)

export function CertificateDetail({ certificate: cert }: { certificate: CertificateDetailItem }) {
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const isRevoked = cert.status === 'revoked'

  return (
    <div className="space-y-6">
      {showRevokeDialog && (
        <RevokeDialog
          folio={cert.folio}
          currentStatus={cert.status}
          onClose={() => setShowRevokeDialog(false)}
        />
      )}

      {/* Header card */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Folio</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-gray-900">
              {cert.folio}
            </h1>
            <p className="mt-1 text-lg text-gray-700">{cert.student_name}</p>
            {cert.program && (
              <p className="mt-0.5 text-sm text-gray-500">{cert.program}</p>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-3">
            <StatusBadge status={cert.status as CertificateStatus} />
            <button
              type="button"
              onClick={() => setShowRevokeDialog(true)}
              className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isRevoked
                  ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-400'
                  : 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
              }`}
            >
              {isRevoked ? 'Reactivar diploma' : 'Revocar diploma'}
            </button>
          </div>
        </div>
      </div>

      {/* Revocation block — solo cuando está revocado */}
      {isRevoked && (
        <RevocationBlock revokedAt={cert.revoked_at} reason={cert.revocation_reason} />
      )}

      {/* Details — sin cambios */}
      {/* ... resto igual */}
    </div>
  )
}
```

> **Nota:** Si `CertificateDetail` era Server Component y el archivo padre lo usa como tal, agregar `'use client'` puede requerir que el padre le pase los datos como props (que ya hace). Verificar que no haya efectos secundarios en la página padre que lo contenga.

- [ ] **Step 6: Fix copy "cancelado" → "revocado" en VerificationCard.tsx**

En `src/components/verify/VerificationCard.tsx`, en la función `getTrust`, el case `'revoked'` (línea ~103-108), cambiar:

```typescript
// ANTES:
body: 'Seneto ha cancelado este diploma desde el panel administrativo. No debe aceptarse como prueba de capacitación.',

// DESPUÉS:
body: 'Seneto ha revocado este diploma desde el panel administrativo. No debe aceptarse como prueba de capacitación.',
```

- [ ] **Step 7: Fix "Privacidad" sin href en v/[token]/page.tsx**

En `src/app/v/[token]/page.tsx`, línea ~91, cambiar:

```typescript
// ANTES:
<span className="text-[#4b5563] no-underline hover:text-[#c9354d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a8ab5]">
  Privacidad
</span>

// DESPUÉS:
<a
  href="https://corporativoseneto.com/privacidad"
  rel="noopener noreferrer"
  target="_blank"
  className="text-[#4b5563] no-underline hover:text-[#c9354d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a8ab5]"
>
  Privacidad
</a>
```

> **Nota:** Si la URL de privacidad no existe aún en corporativoseneto.com, usar `href="#"` temporalmente y agregar `aria-label="Política de privacidad (próximamente)"`. No dejar el `<span>`.

- [ ] **Step 8: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "CertificateDetail|RevokeDialog|VerificationCard|verify.*page" | head -20
```

Corregir cualquier error de tipos antes de commitear.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/certificates/[folio]/route.ts \
        src/components/admin/certificates/RevokeDialog.tsx \
        src/components/admin/certificates/CertificateDetail.tsx \
        src/components/verify/VerificationCard.tsx \
        src/app/v/[token]/page.tsx
git commit -m "feat: agregar UI de revocación de certificados y fixes de copy en página pública"
```

---

## Task 5: Frontend quick fixes — terminología, accesibilidad, touch targets

**Files:**
- Modify: `src/components/admin/generations/CsvUpload.tsx`
- Modify: `src/components/admin/generations/DownloadButtons.tsx`
- Modify: `src/components/admin/generations/ZoneEditor.tsx`

**Contexto:** 3 fixes independientes en componentes de generación. El agente debe leer cada archivo antes de modificarlo para ubicar la línea exacta — los números orientativos son del reporte QA pero pueden variar si el archivo ha sido editado.

- [ ] **Step 1: Fix CsvUpload.tsx — URL de plantilla y label student_name**

Leer `src/components/admin/generations/CsvUpload.tsx`:
```bash
grep -n "plantilla-alumnos\|student_name\|alumno" src/components/admin/generations/CsvUpload.tsx
```

Cambiar:
- Cualquier referencia a `plantilla-alumnos.csv` → `plantilla-participantes.csv`
- El texto visible `student_name` (que el QA encontró en las instrucciones) → `nombre_completo` o `nombre del participante`
- Si aparece la palabra "alumnos" en texto visible → "participantes"

- [ ] **Step 2: Fix DownloadButtons.tsx — touch target**

```bash
grep -n "min-h-\[40px\]\|h-10\b" src/components/admin/generations/DownloadButtons.tsx
```

Cambiar `min-h-[40px]` → `min-h-[44px]` en los botones de descarga (ZIP y CSV de errores).

- [ ] **Step 3: Fix ZoneEditor.tsx — focus ring**

```bash
grep -n "focus:outline-none" src/components/admin/generations/ZoneEditor.tsx
```

Para cada `focus:outline-none` encontrado, verificar si tiene un ring alternativo. Si no tiene `focus:ring-*`, agregar `focus:ring-1 focus:ring-gray-400`:

```typescript
// ANTES:
className="... focus:outline-none ..."

// DESPUÉS:
className="... focus:outline-none focus:ring-1 focus:ring-gray-400 ..."
```

- [ ] **Step 4: Verificar que no hay regresiones de TS**

```bash
npx tsc --noEmit 2>&1 | grep -E "CsvUpload|DownloadButtons|ZoneEditor" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/generations/CsvUpload.tsx \
        src/components/admin/generations/DownloadButtons.tsx \
        src/components/admin/generations/ZoneEditor.tsx
git commit -m "fix(frontend): terminología participantes, touch targets 44px, focus rings"
```

---

## Task 6: Engine performance — select mínimo, font async, force-dynamic

**Files:**
- Modify: `src/lib/diploma/engine.ts`
- Modify: `src/lib/diploma/composer.ts`
- Modify: `src/app/admin/**/page.tsx` (todas las páginas admin que hacen query a Prisma)

**Contexto:** El engine carga todos los campos de template y certificate (incluyendo PII como email, photo_path, diploma paths) con `include:`. Solo necesita campos específicos. `composer.ts` usa `readFileSync` para cargar la fuente EB Garamond, bloqueando el event loop. Las páginas admin hacen queries a Prisma sin `force-dynamic`, lo que puede causar SSG silencioso.

- [ ] **Step 1: Leer engine.ts para ver exactamente qué campos usa del template y el certificado**

```bash
cat src/lib/diploma/engine.ts
```

Identificar: ¿qué campos de `template` usa el engine? ¿Qué campos de `certificate` usa en el loop de generación?

- [ ] **Step 2: Reemplazar `include:` por `select:` en engine.ts**

Reemplazar el bloque `include:` de la query principal (línea ~36-44 en la versión auditada) con un `select:` mínimo. Basado en el código leído en Step 1, el template solo necesita `file_path` y `field_zones`; el certificate necesita los campos que se pasan a `composeDiplomaPng` y `generateQrBuffer`.

Ejemplo aproximado (ajustar según lo que veas en Step 1):

```typescript
const generation = await prisma.generation.findUnique({
  where: { id: generationId },
  select: {
    id: true,
    status: true,
    folio_prefix: true,
    folio_year: true,
    template: {
      select: {
        file_path: true,
        field_zones: true,
        image_width_px: true,
        image_height_px: true,
      }
    },
    certificates: {
      where: { status: 'pending' },
      select: {
        id: true,
        folio: true,
        student_name: true,
        program: true,
        issued_date: true,
        verification_token: true,
        photo_path: true,
      }
    }
  }
})
```

- [ ] **Step 3: Leer composer.ts para ver el uso de readFileSync**

```bash
cat src/lib/diploma/composer.ts
```

Confirmar que `readFileSync` se usa para cargar la fuente.

- [ ] **Step 4: Convertir readFileSync a async en composer.ts**

Cambiar la carga de fuente a async. Si hay una variable `_ebGaramondBase64` que se inicializa con `readFileSync`, convertirla a una función async con caché:

```typescript
import { readFile } from 'fs/promises'

let _ebGaramondBase64: string | null = null

async function getEbGaramondBase64(): Promise<string> {
  if (_ebGaramondBase64) return _ebGaramondBase64
  const fontPath = /* misma ruta que antes */
  _ebGaramondBase64 = (await readFile(fontPath)).toString('base64')
  return _ebGaramondBase64
}
```

Luego actualizar `composeDiplomaPng` para ser `async` y usar `await getEbGaramondBase64()` en lugar de la variable directa.

> **Nota:** Si `composeDiplomaPng` ya es `async`, solo agregar el `await`. Si es sync, hacerla async y actualizar el caller en `engine.ts`.

- [ ] **Step 5: Agregar force-dynamic a páginas admin**

Buscar todas las páginas admin que hacen queries a Prisma:

```bash
grep -rl "prisma\." src/app/admin --include="page.tsx"
```

Y las que NO tienen `force-dynamic`:

```bash
grep -rL "force-dynamic" src/app/admin --include="page.tsx"
```

Para cada archivo encontrado que no tenga `force-dynamic`, agregar al principio del archivo (después de los imports):

```typescript
export const dynamic = 'force-dynamic'
```

- [ ] **Step 6: Verificar que TypeScript no tiene errores**

```bash
npx tsc --noEmit 2>&1 | grep -E "engine|composer" | head -20
```

Corregir si hay errores de tipo por las conversiones async.

- [ ] **Step 7: Commit**

```bash
git add src/lib/diploma/engine.ts \
        src/lib/diploma/composer.ts \
        src/app/admin/
git commit -m "fix(perf): select mínimo en engine, font async, force-dynamic en páginas admin"
```

---

## Task 7: Deuda técnica — ZIP streaming, build config, CI, docs

**Files:**
- Modify: `src/lib/diploma/zipper.ts`
- Modify: `next.config.mjs`
- Create: `.nvmrc`
- Create: `.github/workflows/ci.yml`
- Modify: `docs/ARCHITECTURE_HANDOFF.md`

**Contexto:** Esta es la tarea de mayor riesgo porque `ignoreBuildErrors: false` puede revelar muchos errores de TypeScript. Hacer los demás fixes primero. La estrategia: primero descubrir cuántos errores hay, luego decidir si se pueden arreglar en esta sesión o si se documenta como deuda.

- [ ] **Step 1: Descubrir errores de TypeScript actuales**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Si hay ≤10 errores, continuar con el fix. Si hay >10, hacer solo el ZIP streaming y CI — documentar `ignoreBuildErrors` como pendiente y crear un issue/deuda en el consolidado.

- [ ] **Step 2: Leer zipper.ts completo**

```bash
cat src/lib/diploma/zipper.ts
```

Confirmar si `buildDiplomasZipLazy` acumula los buffers antes de escribir o si ya usa pipe. Si la función recibe un array de `Buffer` y los pasa todos a archiver antes de finalizar, la solución es cambiar la interfaz para que el engine pase los buffers de uno en uno, liberando cada PDF después de agregarlo.

- [ ] **Step 3: Fix zipper.ts — liberar buffers de PDF después de agregar al ZIP**

Si el problema es que el engine construye el array completo de PDFs antes de llamar al zipper, la solución más efectiva es modificar el engine para que agregue cada PDF al archive inmediatamente después de generarlo, en lugar de acumular:

En `engine.ts`, en el loop `for...of` sobre los certificates, en lugar de acumular `pdfBuffers`, usar un archiver instance que se va alimentando:

```typescript
// Patrón recomendado: el engine agrega cada PDF al ZIP en el loop
// Ver docs/ARCHITECTURE_HANDOFF.md sección ZIP para el diseño elegido
```

> **Nota:** Este fix requiere entender bien el flujo entre engine.ts y zipper.ts. Si el cambio de interfaz es grande, limitarse a verificar que `archiver` libera la referencia al buffer después de `archive.append()` — archiver hace esto internamente cuando el stream consume el chunk. Si el ZIP actual ya hace pipe y no acumula en RAM, marcar como OK.

- [ ] **Step 4: Fix ignoreBuildErrors (solo si Step 1 encontró ≤10 errores)**

Si hay pocos errores de TypeScript, corregirlos y luego cambiar en `next.config.mjs`:

```javascript
eslint: {
  ignoreDuringBuilds: false,  // ← cambiar a false
},
typescript: {
  ignoreBuildErrors: false,   // ← cambiar a false
},
```

Verificar:
```bash
npm run build 2>&1 | tail -30
```

Expected: build exitoso sin errores de TS ni ESLint.

- [ ] **Step 5: Crear .nvmrc**

```bash
echo "20.17.0" > .nvmrc
```

- [ ] **Step 6: Crear CI básico en .github/workflows/ci.yml**

Crear `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck:
    name: Type check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npx tsc --noEmit

  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
```

> **Nota:** Si `ignoreDuringBuilds` y `ignoreBuildErrors` no se pusieron en `false` en Step 4, el CI de lint y typecheck fallará en cuanto alguien tenga un error. Asegurarse de que el CI solo se agrega cuando los flags están en `false`.

- [ ] **Step 7: Actualizar ARCHITECTURE_HANDOFF.md con paths reales**

```bash
grep -n "templates/\|diplomas/\|zips/\|generations/" docs/ARCHITECTURE_HANDOFF.md | head -20
```

Comparar con los paths reales usados en el código:

```bash
grep -rn "storage\.put\|storage\.get" src/lib/ --include="*.ts" | grep -v "node_modules" | head -20
```

Actualizar la sección de paths en `ARCHITECTURE_HANDOFF.md` para que coincida con lo que el código realmente usa.

- [ ] **Step 8: Commit**

```bash
git add src/lib/diploma/zipper.ts next.config.mjs .nvmrc .github/workflows/ci.yml docs/ARCHITECTURE_HANDOFF.md
git commit -m "fix(deuda): ZIP streaming, CI básico, .nvmrc, docs/paths actualizados"
```

---

## Self-Review

**Spec coverage:**
- ✅ CRÍTICO 1+2: validateOrigin en DELETE /generations y endpoints temporales (Task 1)
- ✅ CRÍTICO 3: Índices en certificates (Task 2)
- ✅ CRÍTICO 4: UI de revocación (Task 4)
- ✅ CRÍTICO 5: Copy "cancelado" → "revocado" (Task 4)
- ✅ CRÍTICO 6: "Privacidad" sin href (Task 4)
- ✅ ALTO: CSP + HSTS (Task 3)
- ✅ ALTO: ignoreBuildErrors/ignoreDuringBuilds (Task 7, condicional)
- ✅ ALTO: engine.ts include → select (Task 6)
- ✅ ALTO: composer.ts readFileSync → async (Task 6)
- ✅ ALTO: Páginas admin sin force-dynamic (Task 6)
- ✅ ALTO: ZIP en RAM (Task 7)
- ✅ ALTO: Touch targets 44px (Task 5)
- ✅ ALTO: focus:outline-none (Task 5)
- ✅ ALTO: Terminología en CSV (Task 5)
- ✅ ALTO: CI básico (Task 7)
- ✅ ALTO: ARCHITECTURE_HANDOFF.md desincronizado (Task 7)
- ✅ ALTO: Paths documentados vs código (Task 7)

**Placeholder scan:** Ningún "TBD", ningún "TODO" sin acción concreta.

**Dependencias entre tareas:**
- Task 1 es independiente.
- Task 2 es independiente.
- Task 3 es independiente.
- Task 4 depende de que `src/app/api/certificates/[folio]/route.ts` exista (existe).
- Task 5 es independiente.
- Task 6 debe correrse ANTES de Task 7 (Task 7 pone `ignoreBuildErrors: false` y si Task 6 introduce errores de tipos, Task 7 falla).
- Task 7 debe ser la última.

**Orden recomendado:** 1 → 2 → 3 → 4 → 5 → 6 → 7
