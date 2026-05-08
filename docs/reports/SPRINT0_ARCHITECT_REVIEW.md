# ARCHITECT REVIEWER — REPORTE SPRINT 0

**Fecha:** 2026-05-07
**Revisado por:** Architect Reviewer (subagente independiente)
**Sprint:** Sprint 0 — Security Foundation
**Versión revisada:** Incluye `logAction()` integrado en `auth.ts` (login exitoso, fallido, rate limited) y `src/app/api/files/[...path]/route.ts` (SEC-007 completo).
**Restricción verificada:** No se escribió ni modificó código durante la revisión.

---

## GATES APROBADOS

### C1 — Auth y middleware

- `src/app/api/auth/[...nextauth]/route.ts` existe y exporta correctamente `handler as GET` y `handler as POST` (líneas 4–5).
- `src/middleware.ts` existe, usa `withAuth({ pages: { signIn: '/admin/login' } })` (líneas 3–7) y `config.matcher` incluye `'/admin/:path*'` (línea 10).

### C2 — verification_token

- `prisma/schema.prisma` contiene `verification_token String @unique @default(uuid())` en el modelo `Certificate` (línea 74).
- La interfaz `Certificate` en `src/types/index.ts` incluye `verification_token: string` (línea 75).

### C3 — Rate limiting

- `src/lib/api/rate-limit.ts` define `WINDOW_MS = 10 * 60 * 1000`, `MAX_ATTEMPTS = 5`, `LOCKOUT_MS = 15 * 60 * 1000` (líneas 12–14).
- `src/lib/auth.ts` llama a `checkLoginRateLimit(ip)` dentro de `authorize()` antes de cualquier consulta a la BD (líneas 25–28).
- Traza de ejecución verificada: intentos 1–5 fallan con error de credenciales; en el 5to fallo `recordFailedLogin` establece `lockedUntil`; el 6to intento pasa por `checkLoginRateLimit` → retorna `true` → `auth.ts` lanza `TooManyAttempts` sin consultar BD. Comportamiento correcto.

### C4 — Archivos protegidos

- `src/app/api/files/[...path]/route.ts` existe.
- Llama a `getServerSession(authOptions)` y retorna 401 si no hay sesión (líneas 28–34).
- Primera capa: verifica que ningún segmento del path sea `'..'` antes de construir el path (líneas 37–41).
- Segunda capa: el `catch` detecta errores con mensaje `'Path traversal...'` provenientes de `storage.resolve()` y retorna 400 (líneas 66–72).
- `src/lib/storage/adapter.ts` — `resolve()` usa `path.resolve(base, p)` y verifica `resolved.startsWith(base + path.sep)` lanzando `Error('Path traversal attempt: ...')` si no cumple (líneas 20–25).

### C5 — AuditLog

- `prisma/schema.prisma` define el modelo `AuditLog` con todos los campos requeridos: `id`, `user_id`, `action`, `target_id`, `target_type`, `detail (Json?)`, `ip`, `created_at` (líneas 109–122).
- `AuditLog` tiene relación con `User` via `user_id → users.id`; `User` tiene relación inversa `audit_logs AuditLog[]`.
- `src/lib/api/audit.ts` exporta `logAction()` — append-only: solo usa `prisma.auditLog.create`, sin `update` ni `delete`.
- `logAction()` captura excepciones internamente con `try/catch` y solo emite `console.error` sin propagar (líneas 25–27).
- `auth.ts` llama a `logAction()` en: login exitoso con `action: 'auth.login'` + `userId` (línea 57), login fallido con `action: 'auth.login_failed'` sin `userId` (líneas 39, 46), rate limit con `action: 'auth.login_rate_limited'` (línea 26).

### ND4 — Ownership

- `src/lib/api/ownership.ts` existe y exporta `assertOwnership()`.
- Lanza `Errors.NOT_FOUND('Generación')` (404) si la generación no existe (líneas 23–25).
- Permite acceso a `superadmin` sin restricción (línea 27).
- Lanza `Errors.FORBIDDEN()` (403) si `session.user.id !== generation.created_by` o si no hay `session.user.id` (líneas 29–31).
- Usa la interfaz `AuthSession` propia (líneas 6–11) — sin dependencia de tipos externos de NextAuth.

### ND5 — UserRole enum

- `prisma/schema.prisma` define `enum UserRole { superadmin admin }` (líneas 12–15).
- `User.role` usa `UserRole @default(admin)` — no es `String` libre (línea 21).

### Quick Wins

- `.gitignore` contiene `.env` como línea propia (línea 29), separada de `.env*.local`.
- `src/lib/auth.ts` tiene `session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }` (línea 63).
- `next.config.mjs` incluye los 5 headers de seguridad: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- `src/lib/storage/adapter.ts` — `resolve()` usa `path.resolve()` y verifica `base + path.sep`.

### Tipos

- `VerifyResponse` en `src/types/api.ts` contiene exactamente: `status`, `folio`, `student_name?`, `program?`, `issued_date?`, `institution`. Sin `photo_url`, `email`, `token` ni IDs internos.

### TypeScript

- `npx tsc --noEmit` → salida vacía, 0 errores.

---

## BLOCKERS

Ninguno.

---

## OBSERVACIONES (no bloquean)

1. **`auth.login_rate_limited` como acción adicional** — No estaba en el plan original de Sprint 0. Su inclusión es apropiada y defensiva: registra intentos de bloqueo sin revelar si el usuario existe. Se evalúa como mejora correcta, no como desviación problemática.

2. **Rate limiting en Opción A (auth.ts)** — El Backend Security Engineer eligió `authorize()` de NextAuth 4 CredentialsProvider, que sí expone `req.headers`, lo que permite extraer IP via `getClientIp()`. Válido técnicamente. Tradeoff documentado: Map en memoria no persiste entre reinicios. Riesgo aceptado para MVP.

3. **`ownership.ts` importa `UserRole` desde `../../types`** — Es el alias TypeScript (`'superadmin' | 'admin'`), no el enum de Prisma. `AuthSession` también acepta `string`, correcto dado que NextAuth serializa el rol como string en el JWT.

4. **Primera capa en `/api/files/` verifica solo el segmento exacto `'..'`** — Suficiente en App Router: Next.js decodifica `%2E%2E` antes de llegar al handler. La segunda capa en `storage.resolve()` cubre cualquier caso residual.

---

## DICTAMEN FINAL

**[x] Aprobado para Sprint 1**

Todos los gates de salida definidos en la Sección 5 de `SPRINT0_ORCHESTRATION.md` han sido verificados estáticamente. Ningún blocker encontrado. El equipo puede avanzar a Sprint 1 — Backend Seguro.
