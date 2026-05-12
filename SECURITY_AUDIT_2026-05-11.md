# Reporte de Auditoría de Seguridad — Sistema de Diplomas Seneto
**Fecha:** 2026-05-11  
**Método:** Revisión de código estático (4 agentes especializados en paralelo)  
**Versión auditada:** commit `2068796` (rama `main`)  
**Cobertura:** Autenticación/Middleware · API Endpoints · Pipeline de Generación · Frontend/Infraestructura

---

## Resumen Ejecutivo

El sistema **no tiene vulnerabilidades críticas explotables sin autenticación**. La base de seguridad es sólida y hay patrones bien ejecutados. Sin embargo, existen **2 hallazgos críticos** relacionados con control de acceso a archivos, **10 hallazgos de severidad alta** (varios de los cuales convergen en el mismo vector: el rate limiter), y un conjunto de hallazgos medios que requieren atención antes de producción real.

| Severidad | Hallazgos |
|-----------|-----------|
| 🔴 Crítico | 2 |
| 🟠 Alto | 10 |
| 🟡 Medio | 12 |
| 🔵 Bajo | 10 |
| ✅ Buenas prácticas | 16 |
| 💡 Oportunidades | 12 |

---

## 🔴 Hallazgos Críticos

### SEC-C01 — Ownership bypass en `/api/files/[...path]`: diplomas, ZIPs y CSVs accesibles entre admins

**Archivos:** `src/app/api/files/[...path]/route.ts` línea ~47  
**Impacto:** Un admin autenticado puede descargar diplomas (PNG/PDF), ZIPs y CSVs crudos de generaciones que pertenecen a otros admins.

El endpoint wildcard verifica ownership **únicamente** cuando el primer segmento del path es `templates` o `photos`. Los prefijos `diplomas`, `zips` y `generations` (para CSV) no tienen este control. Un admin con sesión válida puede iterar IDs de generaciones (CUIDs visibles en la URL de la UI) y descargar:
- `GET /api/files/diplomas/{generationId}/{folio}.pdf` → diploma PDF de otra generación
- `GET /api/files/zips/{generationId}/diplomas.zip` → ZIP completo de otra generación
- `GET /api/files/generations/{generationId}/upload.csv` → CSV original con datos de participantes

Adicionalmente, este endpoint sirve archivos ZIP sin verificar el estado de la generación (`completed`), evadiendo el control que sí implementa el endpoint dedicado `/api/generations/[id]/download`.

**Solución:**
```typescript
// src/app/api/files/[...path]/route.ts
const PREFIXES_WITH_OWNERSHIP = ['templates', 'photos', 'diplomas', 'zips', 'generations'];

if (PREFIXES_WITH_OWNERSHIP.includes(prefix) && generationId) {
  await assertOwnership(session, generationId);
}
```
Extender el bloque condicional para incluir todos los prefijos que usan un `generationId` como segundo segmento. Considerar también bloquear acceso a `diplomas/` y `zips/` desde este endpoint genérico y forzar que pasen por el endpoint dedicado que verifica estado.

---

### SEC-C02 — Rate limiting de login completamente bypasseable

**Archivos:** `src/lib/api/rate-limit.ts`, `src/lib/auth.ts`  
**Impacto:** Un atacante puede realizar fuerza bruta ilimitada contra el login sin activar ningún bloqueo.

El rate limiter tiene tres vulnerabilidades que se suman:

1. **IP spoofing:** `getClientIp()` confía en el header `X-Forwarded-For` del cliente sin validar que provenga de un proxy de confianza. Enviando `X-Forwarded-For: <IP-diferente>` en cada request, el atacante rota su IP efectiva y nunca alcanza el límite.

2. **Sin persistencia:** El `Map<string, AttemptRecord>` vive en memoria del proceso. Cualquier reinicio del servidor (deploy, crash, OOM) borra todos los lockouts. Un atacante que monitoree uptime puede sincronizar intentos con reinicios.

3. **Sin eviction:** El mapa crece sin límite. Un ataque DDoS distribuido desde muchas IPs únicas puede agotar la memoria del servidor (memory leak).

4. **Solo por IP, no por cuenta:** Un atacante con botnet puede hacer 5 intentos desde cada IP sin activar bloqueo de la cuenta objetivo.

**Solución inmediata (MVP):**
```typescript
// Usar IP real del socket, no del header cliente
const ip = request.headers.get('x-real-ip') // si Render lo garantiza
          ?? request.ip                       // Next.js Edge Runtime
          ?? 'unknown';

// Eviction periódica
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts.entries()) {
    if (record.lockedUntil < now && record.firstAttempt < now - WINDOW_MS) {
      attempts.delete(key);
    }
  }
}, 5 * 60 * 1000);
```

**Solución post-MVP:** Migrar a Redis con TTL nativo (Upstash + `@upstash/ratelimit`) e implementar rate limiting bidimensional (por IP + por cuenta de usuario).

---

## 🟠 Hallazgos de Alta Severidad

### SEC-H01 — Content Security Policy (CSP) completamente ausente

**Archivos:** `next.config.mjs`  
`next.config.mjs` configura X-Frame-Options, nosniff, Referrer-Policy y Permissions-Policy, pero no define ninguna directiva `Content-Security-Policy`. Sin CSP, un XSS exitoso en cualquier parte del sistema puede:
- Realizar requests autenticados en nombre de la víctima (exfiltrar datos de certificados)
- Robar credenciales del formulario de login antes de que se envíen
- Inyectar scripts arbitrarios en la página de verificación pública

**Solución:**
```javascript
// next.config.mjs — agregar en el array de headers
{ key: 'Content-Security-Policy',
  value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" }
```
Para Next.js 14 con hidratación, considerar CSP basada en nonces via middleware.

---

### SEC-H02 — HSTS ausente: no se fuerza HTTPS en browsers

**Archivos:** `next.config.mjs`  
Sin `Strict-Transport-Security`, un atacante en red intermedia (MitM) puede degradar la conexión a HTTP y capturar tokens de verificación en la URL (`/v/[token]`) o iniciar ataques de sslstrip. El sistema está en producción en Render (HTTPS), pero el browser no lo sabe sin HSTS.

**Solución:**
```javascript
{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }
```

---

### SEC-H03 — API Routes fuera del matcher del middleware: cada nuevo endpoint es un riesgo

**Archivos:** `src/middleware.ts` línea 9–11  
El matcher es `['/admin/:path*']`. Las rutas `/api/generations/*`, `/api/certificates/*`, `/api/files/*` no pasan por `withAuth`. La protección depende exclusivamente de que cada handler llame `getServerSession()`. Si un desarrollador agrega un endpoint y olvida la verificación (error humano frecuente), el endpoint queda expuesto sin ninguna red de seguridad.

**Solución:**
```typescript
// src/middleware.ts
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/generations/:path*',
    '/api/certificates/:path*',
    '/api/files/:path*',
  ],
};
```
Excluir explícitamente `/api/verify/:path*` y `/api/auth/:path*` del control de sesión.

---

### SEC-H04 — Timing side-channel en login: enumeración de usuarios via tiempo de respuesta

**Archivos:** `src/lib/auth.ts` líneas 37–41  
Cuando el usuario **no existe**, el código retorna `null` inmediatamente sin ejecutar `bcrypt.compare()`. `bcrypt` con cost factor 10-12 tarda ~150ms. Un atacante puede medir la diferencia entre "usuario no existe" (~5ms) y "usuario existe, contraseña incorrecta" (~155ms) para construir una lista de emails registrados, incluso con mensajes de error genéricos.

**Solución:**
```typescript
// Ejecutar siempre bcrypt, independientemente de si el usuario existe
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uR6JOsJI4h3EW2yGJ5X5h9WXf9ZIlO6e';
const passwordToCheck = user?.password_hash ?? DUMMY_HASH;
const isValid = await bcrypt.compare(password, passwordToCheck);
if (!user || !isValid) return null;
```

---

### SEC-H05 — PII (student_name) en tabla GenerationError sin TTL ni purga

**Archivos:** `src/lib/diploma/engine.ts` línea ~155  
Cuando un diploma falla, el engine escribe `cert.student_name` directamente en `GenerationError.student_name`. La tabla no tiene restricciones de borrado automático: los nombres de participantes quedan persistidos indefinidamente, incluso si el certificado se revoca o la generación se elimina. En un breach de la BD, los registros de errores expondrían PII sin utilidad operacional.

**Solución:** Sustituir el nombre real por el `folio` o `cert.id` en `GenerationError`. El folio identifica unívocamente el registro fallido sin almacenar PII. Añadir una tarea de purga programada que elimine registros de error tras 90 días.

---

### SEC-H06 — Sin límite de certificados por generación: riesgo de OOM

**Archivos:** `src/lib/diploma/engine.ts`, `src/app/api/generations/[id]/csv/route.ts`  
El CSV tiene límite de 5MB (permite ~50.000 filas mínimas). El engine carga todos los certificados en RAM en un único bucle y acumula todos los PDFs en `zipEntries` simultáneamente. Un PDF de diploma puede pesar 500KB–2MB. Con 500 diplomas, el ZIP en memoria puede superar 1GB. Sin límite de certificados por generación, un lote grande puede crashear el servidor completo.

**Solución:** Implementar un límite máximo de certificados por generación (recomendado: 500). Modificar `buildDiplomasZip` para trabajar en modo streaming con `archiver` en lugar de acumular Buffers. `archiver` ya soporta streaming nativo.

---

### SEC-H07 — `ignoreBuildErrors` y `ignoreDuringBuilds` desactivan seguridad estática en CI/CD

**Archivos:** `next.config.mjs` líneas 7, 10  
`eslint.ignoreDuringBuilds: true` y `typescript.ignoreBuildErrors: true` hacen que errores de TypeScript y ESLint nunca bloqueen el build. Los `(user as any).role` y `(session.user as any).id` en `auth.ts` no tienen type safety. Si un refactor cambia la estructura del JWT, el error no se detectaría en CI/CD.

**Solución:** Revertir ambas flags a `false`. Resolver los errores de tipo existentes usando module augmentation de NextAuth:
```typescript
// src/types/next-auth.d.ts
declare module 'next-auth' {
  interface Session {
    user: { id: string; role: 'admin' | 'superadmin'; email: string }
  }
  interface JWT {
    role: 'admin' | 'superadmin'
  }
}
```

---

### SEC-H08 — Rol del usuario propagado desde JWT sin revalidación contra BD

**Archivos:** `src/lib/auth.ts` líneas 66–76  
Con estrategia JWT, el rol se guarda en el token y se lee en cada request sin consultar la BD. Si un admin es degradado, eliminado o comprometido, su token JWT existente permanece válido hasta expiración (máximo 8 horas). Durante esa ventana, el usuario revocado mantiene acceso completo al sistema.

**Solución:** Añadir revalidación periódica en el callback `jwt()`:
```typescript
if (Date.now() - (token.lastChecked ?? 0) > 5 * 60 * 1000) {
  const user = await prisma.user.findUnique({ where: { id: token.sub } });
  if (!user) return null; // invalida el token inmediatamente
  token.role = user.role;
  token.lastChecked = Date.now();
}
```

---

### SEC-H09 — Next.js 14 y next-auth v4 en ramas EOL

**Archivos:** `package.json`  
`next@14.2.35` está en maintenance-only (Next.js 15 es la rama activa). `next-auth@^4.24.14` es la rama v4 (EOL upstream; la rama activa es Auth.js v5). Ambas ramas acumulan CVEs sin soporte upstream activo.

**Solución:** Activar Dependabot o Renovate en el repositorio para PRs automáticos. Ejecutar `npm audit` semanalmente. Planificar migración a Next.js 15 y Auth.js v5 en el siguiente ciclo de mantenimiento mayor.

---

### SEC-H10 — Audit log incompleto: no registra accesos denegados ni operaciones críticas

**Archivos:** `src/lib/api/audit.ts`  
Se auditan únicamente: login, login fallido, login bloqueado, generación iniciada, preflight, descarga de ZIP. **No se auditan:** intentos de acceso a recursos de otro usuario (FORBIDDEN de `assertOwnership`), uploads de CSV/fotos/plantilla, modificaciones de generaciones (PATCH), accesos a `/api/files/`. Para un sistema de certificados con potencial valor legal, la trazabilidad es esencial.

**Solución:** Añadir `logAction()` en: `assertOwnership` cuando lanza FORBIDDEN, cada PATCH/POST de generaciones y certificados, todos los uploads, y cualquier respuesta 401/403. Considerar un wrapper de middleware que audite automáticamente todas las respuestas de error de seguridad.

---

## 🟡 Hallazgos de Severidad Media

### SEC-M01 — Sin validación UUID en parámetros `[id]` de generaciones
**Archivos:** Todos los handlers en `src/app/api/generations/[id]/`  
`params.id` se pasa directamente a Prisma sin validar formato UUID. Agregar: `if (!UUID_RE.test(params.id)) throw Errors.VALIDATION('ID no válido')` al inicio de cada handler (centralizar en un helper).

### SEC-M02 — validateOrigin() no es protección CSRF real
**Archivos:** `src/lib/api/origin.ts`  
Rechaza requests sin header `Origin` (bloqueando clientes server-side legítimos) y falla silenciosamente si `NEXTAUTH_URL` no está definido (bloquea todos los POST en producción). No es un CSRF token. Complementar con CSRF tokens explícitos de NextAuth para endpoints sensibles.

### SEC-M03 — Sin rate limiting en `/api/verify/[token]` y `/api/generations/[id]/download`
El endpoint público de verificación puede ser consultado ilimitadamente. El de descarga de ZIP puede saturar memoria con descargas concurrentes. Implementar rate limiting ligero (60 req/min/IP en verify; 10 descargas/hora/usuario en download).

### SEC-M04 — `error_message` sin sanitizar expuesto en `/api/generations/[id]/students`
**Archivos:** `src/app/api/generations/[id]/students/route.ts` línea 15  
`error_message` puede contener rutas internas del sistema o mensajes de error de Prisma. Sanitizar antes de incluir en la respuesta.

### SEC-M05 — Descarga de ZIP completa en RAM sin streaming
**Archivos:** `src/app/api/generations/[id]/download/route.ts`  
`storage.get()` carga el ZIP completo en memoria (potencialmente cientos de MB). 5-10 descargas concurrentes pueden agotar la RAM del servidor. Implementar streaming. Si se migra a cloud storage, usar signed URLs con expiración corta en lugar de proxiar el archivo.

### SEC-M06 — Folio override sin pre-validación cross-generación
**Archivos:** `src/app/api/generations/[id]/csv/route.ts`  
No se verifica si un `folio_override` ya existe en otra generación antes del INSERT. Puede usarse para invalidar intencionalmente un upload ajeno (DoS entre admins). Pre-validar antes de la transacción.

### SEC-M07 — Engine fire-and-forget en el hilo principal de Next.js
**Archivos:** `src/app/api/generations/[id]/start/route.ts` línea 101  
`runGenerationEngine(...).catch(...)` sin `await` bloquea el event loop durante la generación. En entornos serverless, el proceso termina cuando se envía la respuesta 202, cancelando el engine a mitad. Documentar que el deploy debe ser en servidor long-running (non-serverless). Agregar un mecanismo de recovery: cron que detecte generaciones en `processing` con `updated_at > 30min` y las marque como `failed`.

### SEC-M08 — Pool de Prisma sin timeouts de query o conexión
**Archivos:** `src/lib/db.ts`  
`new Pool({ connectionString })` usa defaults de pg (max: 10 conexiones, sin timeouts). Una query colgada bloquea una conexión indefinidamente. Configurar: `{ max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 }` y agregar `statement_timeout` en la connectionString.

### SEC-M09 — Validación de archivo CSV por blacklist, no por allowlist positivo
**Archivos:** `src/app/api/generations/[id]/csv/route.ts`  
`validateMagicBytes` rechaza PNG/JPG/ZIP pero acepta cualquier otro formato de texto (HTML, XML, JS). Agregar validación positiva: verificar que el contenido sea UTF-8 imprimible esperado en un CSV.

### SEC-M10 — Mass assignment: requests JSON sin validación de schema en runtime
**Archivos:** `src/app/api/generations/route.ts`, `src/app/api/generations/[id]/route.ts`  
`GenerationCreateRequest` y `GenerationUpdateRequest` son tipos TypeScript (compile-time only). En runtime, cualquier campo puede tener cualquier valor. Implementar schemas Zod con `.strict()` para rechazar campos inesperados.

### SEC-M11 — IP spoofeable en audit log
**Archivos:** `src/app/api/generations/[id]/start/route.ts` línea 81  
`req.headers.get('x-forwarded-for')?.split(',')[0]` puede ser manipulado por el cliente. Documentar que la IP es best-effort en el log. Para el rate limiting, ver SEC-C02.

### SEC-M12 — Verify endpoint público expone PII indefinidamente para certificados revocados
**Archivos:** `src/app/api/verify/[token]/route.ts`  
El endpoint devuelve `student_name`, `folio`, `program`, `issued_date` para certificados revocados. Evaluar si los datos del participante deben retornarse cuando `status = 'revoked'`, o solo un mensaje genérico de invalidez.

---

## 🔵 Hallazgos de Baja Severidad

### SEC-L01 — NEXTAUTH_SECRET con placeholder funcional en `.env.example`
`"cambia-esto-por-un-secreto-de-minimo-32-caracteres"` puede ser copiado tal cual. Agregar validación de inicio que verifique que el secret no sea igual al placeholder: `if (process.env.NEXTAUTH_SECRET?.startsWith('cambia-esto')) throw new Error(...)`.

### SEC-L02 — JWT sin revocación server-side
Logout no invalida el token. Si un token es comprometido, permanece válido hasta expiración (8h). Implementar lista negra de JTI en Redis o BD para tokens revocados.

### SEC-L03 — X-XSS-Protection header obsoleto
Deprecado en todos los browsers modernos desde 2019. Eliminarlo del bloque de headers (no aporta seguridad; puede ser explotado en IE antiguo). Reemplazado por CSP (ver SEC-H01).

### SEC-L04 — Template sobreescrito sin versionado ni bloqueo por estado
**Archivos:** `src/app/api/generations/[id]/template/route.ts`  
Re-upload sobreescribe sin backup. Si la generación ya fue ejecutada, un nuevo upload crea inconsistencia entre diplomas generados y template actual. Bloquear re-upload si `status !== 'draft'`, o usar nombre con timestamp.

### SEC-L05 — displayMode='partial' en StudentName no implementado (DEC-002 pendiente)
**Archivos:** `src/components/verify/StudentName.tsx`  
La página pública `/v/[token]` siempre muestra el nombre completo del participante. El prop `displayMode='partial'` existe en el código pero no está implementado. Resolver DEC-002 evaluando requisitos LGPDP/LFPDPPP.

### SEC-L06 — logAction() falla silenciosamente
**Archivos:** `src/lib/api/audit.ts` líneas 25–27  
Si la tabla `audit_logs` tiene problemas, todos los eventos de seguridad se pierden sin alerta. Enviar fallo de auditoría a un sistema de monitoreo (Sentry, Datadog, o log estructurado de nivel CRITICAL).

### SEC-L07 — Types `as any` en auth.ts para propagación de role/id
**Archivos:** `src/lib/auth.ts` líneas 67–76  
`(user as any).role`, `(session.user as any).id`. Sin type safety en el sistema de permisos. Resolver con module augmentation de NextAuth (ver SEC-H07).

### SEC-L08 — Prisma datasource sin `url` explícita en schema
**Archivos:** `prisma/schema.prisma`  
Válido con el adapter PrismaPg, pero dificulta el uso de `prisma migrate` en entornos que no usen el adapter custom. Agregar `url = env("DATABASE_URL")` para compatibilidad con herramientas Prisma CLI.

### SEC-L09 — console.error en engine loggea objeto de error sin sanitización
**Archivos:** `src/app/api/generations/[id]/start/route.ts` línea 102  
`console.error('Fatal Engine Error:', err)` puede incluir stack traces con rutas del filesystem o datos de Prisma (incluyendo PII). Aplicar `sanitizeError()` también en el logging del handler.

### SEC-L10 — Content-Disposition sin RFC 6266 filename* para nombres con caracteres especiales
**Archivos:** `src/app/api/generations/[id]/download/route.ts`  
Agregar `filename*=UTF-8''...` junto al `filename=` existente para compatibilidad completa con browsers modernos.

---

## ✅ Buenas Prácticas Detectadas

Estas son fortalezas reales del sistema que deben mantenerse y usarse como referencia:

| # | Práctica | Módulo |
|---|----------|--------|
| 1 | **Sin `dangerouslySetInnerHTML`** en ningún componente — React escapa todos los datos de BD | Frontend completo |
| 2 | **assertOwnership centralizado** — verificación de propiedad en un único punto con escape correcto para superadmin | `src/lib/api/ownership.ts` |
| 3 | **Magic bytes en todos los uploads** — PNG (8 bytes), JPG (3 bytes), ZIP (4 bytes) verificados en server-side | `src/lib/api/upload.ts` |
| 4 | **Doble protección anti-zip-bomb** — ratio en cabecera + ratio real en streaming con abort mid-flight | `src/app/api/generations/[id]/photos/route.ts` |
| 5 | **UUID v4 para tokens de verificación** — 122 bits de entropía, validados con regex estricta antes de consultar BD | `src/app/api/verify/[token]/route.ts` |
| 6 | **Protección double-submit atómica** — `updateMany WHERE status='ready'` como compare-and-swap para el engine | `src/app/api/generations/[id]/start/route.ts` |
| 7 | **Rutas de storage nunca en respuestas API** — SELECTs explícitos excluyen todos los `*_path` fields; `photo_path` → `has_photo: boolean` | `src/lib/api/selects.ts` |
| 8 | **bcrypt para hashing de contraseñas** — resistente a GPU/rainbow tables | `src/lib/auth.ts` |
| 9 | **Mensajes de error genéricos en login** — no revelan existencia de usuario | `src/lib/auth.ts` |
| 10 | **Escape XML completo en compositor SVG** — `<`, `>`, `&`, `'`, `"` escapados en todos los campos de usuario | `src/lib/diploma/composer.ts` |
| 11 | **Sin procesos externos** — todo el pipeline usa librerías Node.js in-process; zero riesgo de command injection | `src/lib/diploma/engine.ts` |
| 12 | **Sin variables NEXT_PUBLIC_* con secretos** — todos los secretos son server-side | Codebase completo |
| 13 | **Middleware global protege /admin/*** — ninguna ruta admin accesible sin autenticación | `src/middleware.ts` |
| 14 | **Prevención CSV injection** — `sanitizeTextField()` elimina prefijos de fórmula (=, +, -, @) | `src/lib/csv/parser.ts` |
| 15 | **Singleton de Prisma correcto** para hot-reload en Next.js (patrón `globalForPrisma`) | `src/lib/db.ts` |
| 16 | **Logging de queries Prisma desactivado en producción** — previene PII en logs de plataforma | `src/lib/db.ts` |

---

## 💡 Oportunidades de Mejora

Estas no son vulnerabilidades, pero mejorarían la postura de seguridad y la calidad del sistema:

| ID | Oportunidad | Impacto |
|----|-------------|---------|
| OPP-01 | **Migrar validaciones de body a Zod** con `.strict()` en todos los endpoints | Elimina mass assignment, mejora DX |
| OPP-02 | **Module augmentation de NextAuth** para eliminar todos los `as any` | Type safety en sistema de permisos |
| OPP-03 | **Migrar rate limiting a Upstash Redis** con `@upstash/ratelimit` | Persiste entre reinicios, escala horizontalmente |
| OPP-04 | **Signed URLs para descargas** (cuando se migre a S3/GCS/R2) | Elimina DoS por memoria, reduce latencia |
| OPP-05 | **Implementar S3StorageAdapter / GCSStorageAdapter** | Preparación para producción multi-instancia |
| OPP-06 | **Streaming del ZIP en el engine** con `archiver` append incremental | Reduce peak de memoria de O(N×pdf) a O(chunk×pdf) |
| OPP-07 | **npm audit en CI/CD** con fallo en severidad high+ | Detección continua de CVEs en dependencias |
| OPP-08 | **CSRF tokens explícitos** para endpoints de escritura críticos | Complementa validateOrigin() incompleto |
| OPP-09 | **Rate limiting bidimensional** (por IP + por cuenta de usuario) | Resiste ataques de password spraying con botnet |
| OPP-10 | **Cifrado en reposo para campos PII** (student_name, email) con Prisma Middleware + AES-256-GCM | Cumplimiento LFPDPPP/LGPDP México |
| OPP-11 | **Resolver DEC-002**: implementar `displayMode='partial'` en StudentName | Privacy-by-design en verificación pública |
| OPP-12 | **Índice compuesto en `certificates.(generation_id, status)`** | Performance del engine con lotes grandes |

---

## Hoja de Ruta de Remediación

### Inmediato (antes de siguiente deploy a producción)
1. **SEC-C01** — Extender ownership check en `/api/files/[...path]` a todos los prefijos
2. **SEC-C02** (incluido en SEC-C01) — Bloquear acceso directo a diplomas/zips sin verificar estado
3. **SEC-H01** — Agregar CSP header en `next.config.mjs`
4. **SEC-H02** — Agregar HSTS header en `next.config.mjs`
5. **SEC-L03** — Eliminar `X-XSS-Protection` obsoleto

### Corto plazo (Sprint 3B)
6. **SEC-C02** (rate limiter) — Arreglar IP spoofing usando socket IP; agregar eviction periódica
7. **SEC-H04** — Implementar constant-time comparison en login (dummy bcrypt)
8. **SEC-H07** — Revertir `ignoreBuildErrors` y `ignoreDuringBuilds`; agregar types de NextAuth
9. **SEC-H03** — Extender matcher del middleware a rutas API
10. **SEC-H10** — Extender audit log a accesos FORBIDDEN, uploads y modificaciones

### Medio plazo (Sprint 4 / pre-producción)
11. **SEC-C02** (rate limiter completo) — Migrar a Redis; rate limiting bidimensional
12. **SEC-H05** — PII en GenerationError: usar folio en lugar de nombre; implementar purga TTL
13. **SEC-H06** — Límite de certificados por generación + streaming del ZIP
14. **SEC-H08** — Revalidación periódica de rol en JWT callback
15. **SEC-M07** — Mecanismo de recovery para generaciones en `processing` sin actividad
16. **SEC-M08** — Configurar pool de Prisma con timeouts explícitos
17. **OPP-01** — Schemas Zod para todos los endpoints
18. **SEC-L05** — Resolver DEC-002 (displayMode='partial')

---

*Reporte generado por auditoría multi-agente en paralelo: auth/middleware · api-endpoints · pipeline/storage · frontend/infra.*  
*Ejecutar `npm audit --json` manualmente para completar la auditoría de dependencias (no fue posible en este entorno).*
