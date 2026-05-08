# Sprint 0 — Orchestration Plan
# Sistema de Diplomas Seneto

_Technical Orchestrator · 2026-05-07_
_Fuente de verdad para la ejecución de Sprint 0 — Security Foundation._

---

## Regla de lectura

Este documento debe leerse **después** de `PROJECT_EXECUTION_PLAN.md` y **antes** de ejecutar cualquier ticket de Sprint 0.
En caso de conflicto con cualquier otro documento, prevalece `PROJECT_EXECUTION_PLAN.md`.

---

## 1. Estado actual confirmado

### Archivos que SÍ existen

| Archivo | Estado | Notas |
|---|---|---|
| `src/lib/auth.ts` | ✅ Existe | Incompleto: falta `maxAge`, sin rate limiting |
| `src/lib/db.ts` | ✅ Existe | OK — singleton correcto |
| `src/lib/api/errors.ts` | ✅ Existe | OK |
| `src/lib/storage/adapter.ts` | ✅ Existe | **Bug activo:** `resolve()` sin sanitización — vulnerable a path traversal |
| `src/types/index.ts` | ✅ Existe | Tiene `email?` en `Certificate` — revisar en SEC-008 |
| `src/types/api.ts` | ✅ Existe | **Bug activo:** `VerifyResponse` incluye `photo_url?` — debe eliminarse |
| `prisma/schema.prisma` | ✅ Existe | **Incompleto:** falta `verification_token`, `AuditLog`, `UserRole enum`; `role` es `String` libre |
| `prisma.config.ts` | ✅ Existe | OK — Prisma 7 correcto |
| `.env.example` | ✅ Existe | `NODE_ENV` puede estar incorrecto — validar en SEC-001 |
| `fixtures/` | ✅ Completos | CSV, 5 fotos, template PNG — listos para QA |
| `docs/PROJECT_EXECUTION_PLAN.md` | ✅ Vigente | Fuente de verdad maestra |
| `docs/BACKLOG.md` | ✅ Vigente | Tickets SEC-001 a SEC-008 definidos |
| `docs/AGENT_PROMPTS.md` | ✅ Vigente | Prompts base para todos los agentes |

### Archivos que NO existen (bloqueantes)

| Archivo | Hallazgo | Criticidad |
|---|---|---|
| `src/app/api/auth/[...nextauth]/route.ts` | `/admin/*` es completamente público hoy | C1 |
| `src/middleware.ts` | Sin protección de rutas | C1 |
| `src/lib/api/audit.ts` | Sin `logAction()` | C5 |
| `src/lib/api/ownership.ts` | Sin `assertOwnership()` | ND4 |
| `src/app/api/files/[...path]/route.ts` | Archivos sin autenticación | C4 |
| Migración Prisma Sprint 0 | Schema incompleto — faltan 3 cambios | C2 + C5 + ND5 |

### Inconsistencias críticas en código existente

| ID | Problema | Archivo | Acción en Sprint 0 |
|---|---|---|---|
| C-03 | `VerifyResponse` incluye `photo_url?` | `src/types/api.ts:97` | Eliminar en SEC-008 |
| C-07 | `resolve()` sin sanitización de path | `src/lib/storage/adapter.ts:19-21` | Fix en SEC-001 |
| — | `auth.ts` sin `maxAge` en sesión | `src/lib/auth.ts:35` | Fix en SEC-001 |
| — | `role` como `String` libre en schema | `prisma/schema.prisma:17` | Migración en SEC-002 |
| C-04 | `email?` en tipos de dominio | `src/types/index.ts` | Revisar en SEC-008 — no bloquea Sprint 0 |

**Documentos obsoletos identificados** (no tocar hasta Sprint 2, el Orchestrator los actualiza antes de ese sprint):
`WIREFRAMES.md`, `USER_FLOWS.md`, `UX_SPEC.md`, `UI_STATES.md`, `COPY.md`.

---

## 2. Equipo Sprint 0

| Rol | Tipo | Documentos base |
|---|---|---|
| **Backend Security Engineer** | Builder — ejecuta código | `DOCS_INDEX.md` → `PROJECT_EXECUTION_PLAN.md` → `SECURITY_REMEDIATION_PLAN.md` |
| **Architect Reviewer** | Reviewer — solo lectura y reporte | `DOCS_INDEX.md` → `PROJECT_EXECUTION_PLAN.md` → `SECURITY_AUDIT.md` |
| **Security QA** | Reviewer — valida gates | `DOCS_INDEX.md` → `PROJECT_EXECUTION_PLAN.md` → `SECURITY_AUDIT.md` |

**Regla de equipo:** Architect Reviewer y Security QA **no escriben código**. Validan al final del sprint antes de habilitar Sprint 1. Si detectan un blocker, lo reportan al Orchestrator — no lo corrigen ellos mismos.

---

## 3. Orden de ejecución de tickets

```
SEC-001 ──► SEC-002 ──► SEC-008
                │
                ▼
             SEC-003 ──► SEC-004
                │
                ▼
          SEC-005 / SEC-006  (se pueden ejecutar en paralelo)
                │
                ▼
             SEC-007
```

---

## 4. Detalle de cada ticket

### SEC-001 — Quick Wins de seguridad

**Dependencias:** Ninguna. Es el primer ticket.
**Responsable:** Backend Security Engineer.

| Tarea | Archivo | Cambio exacto |
|---|---|---|
| Agregar `.env` al gitignore | `.gitignore` | Línea `.env` |
| JWT `maxAge` | `src/lib/auth.ts` | `session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }` |
| Fix path traversal | `src/lib/storage/adapter.ts` | `resolve()` debe usar `path.resolve()` + verificar que el resultado empieza con `path.resolve(this.base)` — lanzar error si no |
| Headers de seguridad | `next.config.mjs` | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` |
| `NODE_ENV` comentado | `.env.example` | Comentar la línea: `# NODE_ENV=development` / `# En producción usar NODE_ENV=production` |

**Comandos de validación:**
```bash
git status          # .env no debe aparecer
curl -I http://localhost:3000   # headers de seguridad presentes
npx tsc --noEmit    # 0 errores
```

**Evidencia esperada:** `git status` limpio de `.env`. Headers visibles en respuesta HTTP. Llamada a `resolve('../../../etc/passwd')` lanza error en lugar de escapar del directorio base.

---

### Ajuste confirmado — AuditLog conectado desde Sprint 0

`logAction()` debe invocarse en `src/lib/auth.ts` dentro del `authorize()` del `CredentialsProvider` para registrar:
- `auth.login` al autenticar correctamente (con `userId` y `ip`)
- `auth.login_failed` al fallar la autenticación (solo con `ip`, sin `userId`)

Esto significa que SEC-005 (creación de `logAction`) debe completarse antes o al mismo tiempo que SEC-003/SEC-004, y que `auth.ts` se actualiza nuevamente en SEC-005 para conectar el helper. El gate C5 de Security QA verificará registros reales en `audit_logs` después de intentos de login — si no hay registros, el gate falla.

### Ajuste confirmado — Rate limiting: ubicación condicional

**Opción A (preferida):** Implementar en `authorize()` dentro de `src/lib/auth.ts`. Solo es viable si la IP es accesible desde el contexto de `authorize()`. En NextAuth 4 con App Router, `authorize()` no recibe el objeto `req` directamente — la IP no está disponible de forma confiable en este contexto.

**Opción B (fallback):** Implementar en `src/middleware.ts` interceptando `POST /api/auth/callback/credentials`. El middleware sí tiene acceso a `request.ip` y `x-forwarded-for`. El rate limiting se aplica antes de que la request llegue al handler de NextAuth.

El Backend Security Engineer elige la opción en SEC-004 según lo que el entorno exponga, y documenta la decisión en el reporte de entrega.

### Ajuste confirmado — Gate ND4: validación estática en Sprint 0

La prueba real "Admin A no accede a recurso de Admin B" requiere route handlers y datos en BD — ambos son Sprint 1. En Sprint 0, el gate ND4 se valida de forma **estática y unitaria**:
- El código de `assertOwnership()` es revisado por el Architect Reviewer para confirmar la lógica de comparación y el lanzamiento de 403.
- Security QA verifica que la función existe y exporta la firma correcta.
- La prueba dinámica Admin A vs Admin B se ejecuta en Sprint 1 como parte del gate de salida de ese sprint.

---

### SEC-002 — Migración Prisma: `verification_token`, `AuditLog`, `UserRole`

**Dependencias:** SEC-001.
**Responsable:** Backend Security Engineer.

**Cambios al schema `prisma/schema.prisma`:**

1. `UserRole` — nuevo enum:
```prisma
enum UserRole {
  superadmin
  admin
}
```

2. `User.role` — cambiar de `String @default("admin")` a:
```prisma
role  UserRole  @default(admin)
```

3. `Certificate` — agregar campo:
```prisma
verification_token  String  @unique  @default(uuid())
```

4. `AuditLog` — nuevo modelo:
```prisma
model AuditLog {
  id          String    @id @default(cuid())
  user_id     String?
  action      String
  target_id   String?
  target_type String?
  detail      Json?
  ip          String?
  created_at  DateTime  @default(now())

  user        User?     @relation(fields: [user_id], references: [id])

  @@map("audit_logs")
}
```

5. `User` — agregar relación inversa a `AuditLog`:
```prisma
audit_logs  AuditLog[]
```

**Comandos:**
```bash
npx prisma migrate dev --name sprint0_security_foundation
npx prisma generate
npx tsc --noEmit
```

**Validación:**
```bash
npx prisma migrate status   # Sin migraciones pendientes
npx prisma studio           # Tabla audit_logs visible; Certificate.verification_token existe
npx tsc --noEmit            # 0 errores
```

---

### SEC-008 — Actualizar tipos TypeScript seguros

**Dependencias:** SEC-002 (Prisma regenerado con nuevos tipos).
**Responsable:** Backend Security Engineer.

| Archivo | Cambio |
|---|---|
| `src/types/api.ts` | Eliminar `photo_url?` de `VerifyResponse` |
| `src/types/api.ts` | Verificar que `VerifyResponse` no incluye `email` ni ningún campo fuera de la política pública `PROJECT_EXECUTION_PLAN.md §7.3` |
| `src/types/index.ts` | Agregar `verification_token: string` a la interfaz `Certificate` |
| `src/types/index.ts` | Mantener `email?` en `Certificate` pero agregar comentario que indica que no se expone en respuestas públicas |

**`VerifyResponse` resultante esperada:**
```ts
export interface VerifyResponse {
  status: CertificateStatus
  folio: string
  student_name?: string
  program?: string
  issued_date?: string
  institution: string
}
```

**Validación:** `npx tsc --noEmit` → 0 errores. Grep de `photo_url` en `src/types/api.ts` → sin resultados.

---

### SEC-003 — NextAuth route handler + middleware admin

**Dependencias:** SEC-002.
**Responsable:** Backend Security Engineer.

**Archivo 1 — `src/app/api/auth/[...nextauth]/route.ts`:**
```ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

**Archivo 2 — `src/middleware.ts`:**
```ts
export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/admin/:path*'],
}
```

**Comandos de validación:**
```bash
# Sin sesión activa:
curl -I http://localhost:3000/admin/dashboard
# Esperado: 302 → /admin/login

curl http://localhost:3000/api/auth/csrf
# Esperado: 200 con token CSRF

curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}'
# Esperado: error de credenciales (no 500)
```

---

### SEC-004 — Rate limiting en login

**Dependencias:** SEC-003 (endpoint de login activo).
**Responsable:** Backend Security Engineer.

**Implementación en `src/lib/auth.ts`** dentro del `authorize()` del `CredentialsProvider`:

- Map en memoria: `Map<string, { count: number; firstAttempt: number; lockedUntil: number }>`
- Límite: 5 intentos fallidos / 10 minutos / IP
- Lockout: 15 minutos al superar el límite
- La IP se extrae del header `x-forwarded-for` o `x-real-ip`
- Al superar el límite, lanzar error antes de consultar la BD (no revelar si el usuario existe)
- Limpiar entrada del Map cuando el lockout expire

**Validación:**
```bash
# 6 intentos fallidos consecutivos desde la misma IP:
# Intentos 1-5: error de credenciales inválidas
# Intento 6: error de rate limit / demasiados intentos
```

**Nota:** El Map en memoria no persiste entre reinicios del servidor. Riesgo aceptado para MVP — documentado en `SECURITY_REMEDIATION_PLAN.md §1`.

---

### SEC-005 — Helper `logAction`

**Dependencias:** SEC-002 (tabla `AuditLog` existe en BD).
**Responsable:** Backend Security Engineer.

**Crear `src/lib/api/audit.ts`:**

```ts
interface LogActionParams {
  userId?: string
  action: string
  targetId?: string
  targetType?: string
  detail?: Record<string, unknown>
  ip?: string
}
```

- Función `logAction(params: LogActionParams): Promise<void>`
- Inserta en `AuditLog` usando el singleton `prisma` de `src/lib/db.ts`
- Append-only — el helper nunca expone operaciones de update ni delete sobre `AuditLog`
- Errores de inserción en AuditLog deben loguearse en consola pero **no deben propagar excepción** al caller (no romper el flujo principal por un log fallido)

**Acciones obligatorias a registrar desde Sprint 1:**
- `auth.login` — login exitoso
- `auth.login_failed` — intento fallido (con IP)
- `certificate.revoke` — revocación con `targetId = folio`
- `certificate.reactivate` — reactivación
- `generation.zip_download` — descarga del ZIP

**Validación:** Script o test manual que llama a `logAction(...)` y verifica que se crea un registro en la tabla `audit_logs`.

---

### SEC-006 — Helper `assertOwnership`

**Dependencias:** SEC-002 (relaciones de BD definidas).
**Responsable:** Backend Security Engineer.

**Crear `src/lib/api/ownership.ts`:**

- Función `assertOwnership(session: Session, generationId: string): Promise<void>`
- Busca la generación en BD con `prisma.generation.findUnique({ where: { id: generationId }, select: { created_by: true } })`
- Si no existe → lanza `ApiError` 404
- Si `generation.created_by !== session.user.id` Y `session.user.role !== 'superadmin'` → lanza `ApiError` 403
- Usar `handleApiError` de `src/lib/api/errors.ts` para el formato de error

**Validación:** Admin A no puede acceder a generación creada por Admin B — retorna 403. `superadmin` sí puede acceder a cualquier generación.

---

### SEC-007 — `/api/files/[...path]` protegido

**Dependencias:** SEC-003 (sesión disponible) + SEC-005 (logAction disponible).
**Responsable:** Backend Security Engineer.

**Crear `src/app/api/files/[...path]/route.ts`:**

Patrón del handler:
1. `getServerSession(authOptions)` → 401 si no hay sesión
2. Construir path usando el singleton `storage` — nunca concatenación manual de strings
3. Verificar que el path construido no escapa del `STORAGE_PATH` base (segunda capa de defensa post fix de SEC-001)
4. Verificar que el archivo existe → 404 si no
5. Leer buffer con `storage.get()`
6. Inferir `Content-Type` por extensión — nunca confiar en query param del cliente
7. Responder con el buffer y headers correctos

**Comandos de validación:**
```bash
# Sin sesión:
curl -I http://localhost:3000/api/files/templates/test.png
# Esperado: 401

# Path traversal (con o sin sesión):
curl http://localhost:3000/api/files/../../../etc/passwd
# Esperado: 400 o 403

# Con sesión válida y archivo existente:
# Esperado: 200 con el archivo
```

---

## 5. Gates de salida — Sprint 0

**No se habilita Sprint 1 hasta que todos los siguientes gates pasen.**
El Architect Reviewer verifica cada uno antes de emitir aprobación.

| Gate | Criterio verificable |
|---|---|
| C1-a | `GET /admin/dashboard` sin sesión → 302 a `/admin/login` |
| C1-b | `GET /api/auth/csrf` → 200 con token |
| C2 | `npx prisma migrate status` sin pendientes; `Certificate.verification_token` existe en BD |
| C3 | 6to intento fallido de login desde la misma IP → error de rate limit (no credenciales inválidas) |
| C4-a | `GET /api/files/templates/x.png` sin sesión → 401 |
| C4-b | `GET /api/files/../../../etc/passwd` → 400 o error seguro |
| C5 | Tabla `audit_logs` existe en BD; `logAction()` inserta registro correctamente |
| ND4 | Admin A recibe 403 al acceder a generación de Admin B |
| ND5 | `User.role` es `UserRole` enum en schema — no `String` libre |
| QW-1 | `git status` no muestra `.env` |
| QW-2 | `curl -I localhost:3000` → headers de seguridad presentes en respuesta |
| QW-3 | JWT session `maxAge` = 28800 (8h) en `authOptions` |
| QW-4 | `StorageAdapter.resolve('../../../')` lanza error en lugar de escapar del base path |
| Tipos | `VerifyResponse` en `src/types/api.ts` no contiene `photo_url` |
| TS | `npx tsc --noEmit` → 0 errores |
| Review | Architect Reviewer emite explícitamente: "**Aprobado para Sprint 1**" |

---

## 6. Riesgos identificados

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `DATABASE_URL` no configurada localmente — SEC-002 no puede migrar | Alta | El Backend Engineer configura `.env` local antes de SEC-002 |
| Prisma 7 regenera tipos con `UserRole` enum que rompen código existente | Media | SEC-008 se ejecuta inmediatamente después de SEC-002 |
| Rate limiting en Map de memoria no persiste entre reinicios | Baja | Riesgo aceptado para MVP — documentado en `SECURITY_REMEDIATION_PLAN.md §1` |
| `email?` en `Certificate` — decisión de mantener o eliminar el campo | Baja | SEC-008 revisa, mantiene con comentario, nunca expone en respuestas públicas |
| Decisiones pendientes de Seneto (foto pública, nombre completo/parcial) | No aplica Sprint 0 | Solo bloquean el gate de entrada de Sprint 2 |

---

## 7. Prompts de agentes — Sprint 0

---

### Prompt A — Backend Security Engineer

```
Rol: Backend Security Engineer — Sprint 0 únicamente.

Contexto del proyecto:
Eres parte del equipo de construcción del Sistema de Diplomas Seneto.
El proyecto ya tiene scaffold (Next.js 14, TypeScript, Tailwind, Prisma 7, NextAuth 4),
tipos TypeScript, un StorageAdapter, y documentación técnica completa.
Sin embargo, no existe ningún route handler funcional, ninguna página admin,
ni ninguna capa de seguridad implementada.
Tu misión es construir la base segura antes de que cualquier feature sea posible.

Documentos a leer en este orden:
1. docs/DOCS_INDEX.md
2. docs/PROJECT_EXECUTION_PLAN.md
3. docs/SECURITY_REMEDIATION_PLAN.md
4. docs/BACKLOG.md (solo sección Sprint 0: SEC-001 a SEC-008)
5. docs/SPRINT0_ORCHESTRATION.md (este documento — detalle de implementación)

Tickets a ejecutar en este orden estricto:
SEC-001 → SEC-002 → SEC-008 → SEC-003 → SEC-004 → SEC-005 → SEC-006 → SEC-007

Restricciones absolutas:
- No implementar route handlers de features (generaciones, certificados, CSV, uploads).
- No construir páginas bajo /admin/* (eso es Sprint 2).
- No construir /v/[token] (eso es Sprint 2).
- Solo infraestructura de seguridad y abstracciones base.
- No usar /v/:folio en ningún archivo — la ruta vigente es /v/[token].
- No incluir email ni photo_url en VerifyResponse.
- No instanciar PrismaClient directamente — usar el singleton de src/lib/db.ts.
- No instanciar LocalStorage directamente — usar el singleton storage de src/lib/storage/adapter.ts.
- No agregar url = env("DATABASE_URL") en schema.prisma — esto rompe Prisma 7.

Entregables esperados:
- src/middleware.ts
- src/app/api/auth/[...nextauth]/route.ts
- src/lib/api/audit.ts (con logAction)
- src/lib/api/ownership.ts (con assertOwnership)
- src/app/api/files/[...path]/route.ts
- Migración Prisma: verification_token en Certificate, AuditLog, UserRole enum
- Fixes en: src/lib/auth.ts (maxAge), src/lib/storage/adapter.ts (path traversal), next.config.mjs (headers), .gitignore (.env), .env.example (NODE_ENV)
- src/types/api.ts: VerifyResponse sin photo_url
- src/types/index.ts: Certificate con verification_token

Criterios de aceptación antes de entregar:
- npx tsc --noEmit → 0 errores
- npx prisma migrate status → sin migraciones pendientes
- git status → .env no aparece
- Todos los gates de salida del Sprint 0 verificados (ver sección 5 de este documento)

Al terminar, reporta:
- Lista de archivos creados/modificados
- Evidencia de cada gate de salida
- Cualquier blocker o decisión que hayas tenido que tomar y por qué
```

---

### Prompt B — Architect Reviewer

```
Rol: Architect Reviewer — Sprint 0.

Contexto del proyecto:
El Sistema de Diplomas Seneto acaba de completar Sprint 0 (Security Foundation).
El Backend Security Engineer implementó la infraestructura de seguridad base.
Tu misión es auditar esa entrega de forma independiente, sin escribir código,
y emitir una aprobación formal o un listado de blockers antes de que el equipo avance a Sprint 1.

Documentos a leer en este orden:
1. docs/DOCS_INDEX.md
2. docs/PROJECT_EXECUTION_PLAN.md (Sección 11 — gates de Sprint 0)
3. docs/SECURITY_AUDIT.md (hallazgos C1–C5 como referencia de lo que debe estar resuelto)
4. docs/SPRINT0_ORCHESTRATION.md (Sección 5 — gates de salida)

Restricciones:
- No escribir ni modificar código.
- No sugerir refactors o mejoras de calidad — solo validar seguridad y corrección estructural.
- No aprobar si cualquier gate de salida falla, sin importar cuánto trabajo representa revertirlo.

Qué debes revisar (checklist):

C1 — Auth y middleware:
[ ] src/app/api/auth/[...nextauth]/route.ts existe y exporta GET y POST.
[ ] src/middleware.ts existe y su matcher incluye /admin/:path*.
[ ] GET /admin/* sin sesión redirige a /admin/login (302).

C2 — verification_token:
[ ] prisma/schema.prisma incluye verification_token en Certificate con @unique y @default(uuid()).
[ ] npx prisma migrate status no muestra migraciones pendientes.
[ ] La interfaz Certificate en src/types/index.ts incluye verification_token.

C3 — Rate limiting:
[ ] src/lib/auth.ts implementa rate limiting en el authorize() del CredentialsProvider.
[ ] El límite es de máximo 5 intentos fallidos por IP en 10 minutos.
[ ] El 6to intento retorna error de rate limit antes de consultar la BD.

C4 — Archivos protegidos:
[ ] src/app/api/files/[...path]/route.ts existe.
[ ] Requiere getServerSession — retorna 401 sin sesión.
[ ] Path traversal está bloqueado — no puede escapar del STORAGE_PATH.

C5 — AuditLog:
[ ] Modelo AuditLog existe en schema.prisma con campos: id, user_id, action, target_id, target_type, detail, ip, created_at.
[ ] src/lib/api/audit.ts existe y exporta logAction().
[ ] logAction() es append-only — no expone update ni delete sobre AuditLog.

ND4 — Ownership:
[ ] src/lib/api/ownership.ts existe y exporta assertOwnership().
[ ] assertOwnership() lanza 403 si el usuario no es dueño del recurso y no es superadmin.

ND5 — UserRole enum:
[ ] prisma/schema.prisma define enum UserRole { superadmin admin }.
[ ] User.role usa ese enum, no un String libre.

Quick wins:
[ ] .env está en .gitignore.
[ ] src/lib/auth.ts tiene maxAge: 8 * 60 * 60 en la config de session.
[ ] next.config.mjs tiene headers de seguridad (X-Content-Type-Options, X-Frame-Options, etc.).
[ ] src/lib/storage/adapter.ts resolve() valida que el path resultante esté dentro del base path.
[ ] .env.example tiene NODE_ENV=development.

Tipos:
[ ] VerifyResponse en src/types/api.ts NO contiene photo_url.
[ ] VerifyResponse NO contiene email.
[ ] npx tsc --noEmit retorna 0 errores.

Entregable esperado:
Un reporte con este formato:

---
ARCHITECT REVIEWER — REPORTE SPRINT 0

Fecha: [fecha]
Revisado por: Architect Reviewer

GATES APROBADOS:
- [lista de gates que pasan]

BLOCKERS (impiden pasar a Sprint 1):
- [descripción exacta del problema, archivo y línea si aplica]

OBSERVACIONES (no bloquean, mejoras futuras):
- [lista si hay]

DICTAMEN FINAL:
[ ] Aprobado para Sprint 1
[ ] No aprobado — resolver blockers antes de continuar
---
```

---

### Prompt C — Security QA

```
Rol: Security QA — Sprint 0.

Contexto del proyecto:
El Sistema de Diplomas Seneto acaba de completar Sprint 0 (Security Foundation).
Tu misión es ejecutar pruebas dinámicas sobre el sistema levantado localmente
para validar que los controles de seguridad funcionan en la práctica,
no solo en el código estático.
No escribes código. Solo pruebas y reportas.

Documentos a leer en este orden:
1. docs/DOCS_INDEX.md
2. docs/PROJECT_EXECUTION_PLAN.md (Sección 11 — gates; Sección 16 — criterios de avance)
3. docs/SECURITY_AUDIT.md (C1–C5 como referencia de qué probar)
4. docs/SPRINT0_ORCHESTRATION.md (Sección 5 — gates de salida)

Pre-requisito para probar:
El sistema debe estar corriendo localmente:
  npm run dev  (con DATABASE_URL real en .env y npx prisma migrate dev ejecutado)

Pruebas obligatorias — ejecutar con curl o equivalente:

C1 — Admin sin sesión:
  curl -I http://localhost:3000/admin/dashboard
  Esperado: 302 → /admin/login
  FALLA si: 200, 404, o cualquier contenido de página admin

C1 — CSRF disponible:
  curl http://localhost:3000/api/auth/csrf
  Esperado: 200 con JSON que contiene csrfToken
  FALLA si: 404 o 500

C2 — verification_token en schema:
  npx prisma studio → tabla certificates → columna verification_token existe y tiene UUID
  FALLA si: columna ausente o nula

C3 — Rate limiting login (repetir 6 veces con credenciales incorrectas):
  for i in {1..6}; do
    curl -X POST http://localhost:3000/api/auth/callback/credentials \
      -H "Content-Type: application/json" \
      -d '{"email":"x@x.com","password":"wrong","csrfToken":"TOKEN"}'
    echo "Intento $i"
  done
  Esperado: intento 6 retorna error diferente al de credenciales (rate limit)
  FALLA si: todos retornan el mismo error genérico de credenciales

C4 — Archivo sin sesión:
  curl -I http://localhost:3000/api/files/templates/test.png
  Esperado: 401
  FALLA si: 200, 403 con archivo, o cualquier contenido de archivo

C4 — Path traversal:
  curl "http://localhost:3000/api/files/../../../etc/passwd"
  Esperado: 400 o 403
  FALLA si: 200 con contenido de archivo del sistema

C5 — AuditLog funcional:
  Verificar con npx prisma studio → tabla audit_logs
  Después de un intento de login (fallido o exitoso), debe haber al menos un registro
  FALLA si: tabla vacía o sin registros después de actividad

ND4 — Ownership entre admins:
  (Requiere 2 usuarios admin en BD y un recurso creado por uno de ellos)
  Admin A intenta acceder a generación de Admin B → 403
  FALLA si: 200 o acceso concedido

Headers de seguridad:
  curl -I http://localhost:3000
  Verificar presencia de:
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  FALLA si: alguno de estos headers está ausente

Tipos — verificación estática:
  grep "photo_url" src/types/api.ts
  Esperado: sin resultados
  FALLA si: photo_url aparece en VerifyResponse

Entregable esperado:
Un reporte con este formato:

---
SECURITY QA — REPORTE SPRINT 0

Fecha: [fecha]
Probado por: Security QA
Ambiente: localhost:3000 / npm run dev

PRUEBAS APROBADAS:
- [lista con el comando ejecutado y resultado obtenido]

PRUEBAS FALLIDAS (bloquean Sprint 1):
- [prueba] → [resultado esperado] → [resultado obtenido]
- Archivo/línea involucrada si se puede identificar

OBSERVACIONES:
- [cualquier comportamiento inesperado aunque no bloquee]

DICTAMEN FINAL:
[ ] Aprobado — todos los gates de seguridad pasan
[ ] No aprobado — [número] blockers encontrados — no avanzar a Sprint 1
---
```

---

## 8. Flujo de aprobación Sprint 0 → Sprint 1

```
Backend Security Engineer
        │
        │ entrega archivos + evidencia de gates
        ▼
Architect Reviewer
        │
        │ revisa código estático
        ├─── BLOCKERS encontrados ──► Backend corrige ──► vuelve a revisión
        │
        │ sin blockers
        ▼
Security QA
        │
        │ ejecuta pruebas dinámicas
        ├─── FALLAS encontradas ──► Backend corrige ──► vuelve a pruebas
        │
        │ sin fallas
        ▼
Technical Orchestrator
        │
        │ recibe aprobación de ambos reviewers
        │ habilita Sprint 1 — Backend Seguro
        ▼
     SPRINT 1
```

---

_Documento preparado por: Technical Orchestrator_
_Fecha: 2026-05-07_
_En caso de conflicto con cualquier sección de este documento y `PROJECT_EXECUTION_PLAN.md`, prevalece `PROJECT_EXECUTION_PLAN.md`._
