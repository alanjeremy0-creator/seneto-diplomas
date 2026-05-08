# Security Remediation Plan — Sistema de Diplomas Seneto

> Generado por el Agente de Arquitectura el 2026-05-07.
> Basado en la auditoría completa en `docs/SECURITY_AUDIT.md`.
> Este documento NO repite el análisis — lo convierte en trabajo ejecutable.

---

## 1. Decisión arquitectónica general

### Por qué no se avanza a features antes de resolver seguridad mínima

El estado actual tiene un problema estructural: **los route handlers de Backend no existen aún, y el schema de Prisma todavía no refleja las decisiones de seguridad necesarias**. Construir sobre esta base significaría que cada route handler que se cree tendría que ser reescrito posteriormente para agregar autenticación, ownership checks, audit logging y validación de paths. El costo de remediar después es al menos 3x mayor que diseñar correctamente desde el principio.

Los hallazgos C1–C5 no son optimizaciones — son la ausencia de infraestructura de seguridad básica. Sin ellos, el panel admin es literalmente público, cualquier admin puede ver los datos de otro, y no hay rastro de quién hizo qué. Construir features sobre esto es construir sobre arena.

### Qué hallazgos son bloqueantes

Los siguientes hallazgos bloquean el inicio de desarrollo activo de Backend y Frontend. No se puede escribir ningún route handler administrativo ni ninguna página admin hasta que estén resueltos:

| Hallazgo | Por qué bloquea |
|---|---|
| C1 — Middleware/NextAuth ausentes | Sin `src/middleware.ts` y el route handler de auth, `/admin/*` es completamente público. Cualquier página admin creada sería accesible sin credenciales. |
| C2 — IDOR por folio secuencial | El campo `verification_token` debe existir en el schema antes de que Backend lo use. Si Backend crea la lógica de generación sin este campo, habrá que reescribir el generador de QR, el endpoint `/v/[token]`, y hacer una migración destructiva. |
| C3 — Sin rate limiting en login | El endpoint de NextAuth se crea en Sprint 0. Si se crea sin rate limiting, el vector de fuerza bruta queda abierto desde el primer día. |
| C4 — Archivos sin autorización | El route handler `/api/files/[...path]` debe nacer con autenticación. Si se crea sin ella, todo archivo subido (fotos, PDFs) es accesible por URL directa. |
| C5 — Sin AuditLog | El modelo debe existir antes de que Backend implemente revocación, reactivación o descarga ZIP. Si se agrega después, esas acciones quedarán sin registrar permanentemente. |
| ND4 — assertOwnership ausente | Toda la API de generaciones requiere este helper. Sin él, un admin autenticado puede operar sobre generaciones de otro. |
| ND5 — UserRole como String libre | El enum debe estar en el schema antes de las migraciones. Cambiar de `String` a `enum` después de tener datos en producción requiere una migración destructiva. |

### Qué riesgos se aceptan temporalmente para MVP

Los siguientes riesgos se posponen conscientemente. Son reales pero no ponen en riesgo la operación básica del sistema si el acceso a producción es controlado (URL privada, credenciales fuertes):

- **PM1 (Firma HMAC)**: los certificados se pueden verificar por contenido en BD sin firma criptográfica.
- **PM2 (URLs pre-firmadas S3/R2)**: el almacenamiento local con autenticación de sesión es suficiente para MVP.
- **PM3 (session_version)**: con `maxAge` de 8h el riesgo de token comprometido se reduce a una ventana manejable.
- **PM4 (2FA)**: aceptable si el deploy inicial no es de acceso público amplio.
- **PM5 y PM6**: limpieza de archivos temporales y rate limiting en verificación pública son mejoras post-launch.

### Qué queda fuera del MVP

- Firma digital de diplomas (HMAC o certificados X.509)
- Invalidación de sesión en tiempo real por `session_version`
- 2FA para superadmin
- Migración a R2/S3 con URLs pre-firmadas
- Expiración automática de archivos temporales
- Rate limiting en el endpoint público `/v/[token]`

---

## 2. Clasificación de trabajo

### A. Bloqueante antes de desarrollo activo

Estos ítems deben resolverse en **Sprint 0**, antes de que Backend escriba cualquier route handler administrativo. El Agente Backend los ejecuta en el orden indicado.

---

#### C1 — Middleware de autenticación y route handler de NextAuth

**Problema:** `src/middleware.ts` y `src/app/api/auth/[...nextauth]/route.ts` no existen. Las rutas `/admin/*` son completamente públicas.

**Por qué bloquea:** Sin el middleware, cualquier page o layout creado bajo `src/app/admin/` es accesible sin autenticación. Frontend podría implementar guards, pero el middleware es la única barrera real en Next.js App Router. Sin el route handler de NextAuth, el endpoint de login no funciona — es imposible probar ninguna funcionalidad protegida.

**Archivos afectados:**
- `src/middleware.ts` — a crear
- `src/app/api/auth/[...nextauth]/route.ts` — a crear
- `src/lib/auth.ts` — ya existe con `authOptions`, solo necesita que el route handler lo consuma

**Cambio esperado:**
```ts
// src/middleware.ts
export { default } from 'next-auth/middleware'
export const config = { matcher: ['/admin/:path*'] }
```
```ts
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```
Adicionalmente, en `src/lib/auth.ts`, agregar `maxAge: 8 * 60 * 60` al objeto `session` (resuelve también I5).

**Agente responsable:** Backend

**Criterio de aceptación:**
- GET `/admin/dashboard` sin sesión redirige a `/admin/login` con código 307
- POST `/api/auth/callback/credentials` con credenciales válidas retorna token JWT
- POST `/api/auth/callback/credentials` con credenciales inválidas retorna 401
- Token JWT tiene expiración de 8 horas (verificable en JWT.io)
- `src/middleware.ts` existe y exporta el matcher correcto

---

#### C2 — Separación de folio público y verification_token

**Problema:** El folio `SEN-2026-001` es secuencial y predecible. La URL del QR usa el folio como clave, permitiendo enumerar todos los certificados del sistema sin autenticación.

**Por qué bloquea:** El campo `verification_token` debe existir en `prisma/schema.prisma` y la migración debe correrse antes de que Backend implemente la generación de diplomas o el endpoint `/v/[token]`. Si se implementa sin este campo, el generador de QR apuntará al folio y habrá que reescribir toda la lógica de generación y el endpoint público.

**Archivos afectados:**
- `prisma/schema.prisma` — modelo `Certificate`
- `prisma/migrations/` — nueva migración
- `src/types/index.ts` — agregar `verification_token` al tipo `Certificate`
- `src/types/api.ts` — `VerifyResponse` ya usa este campo implícitamente; la ruta pasa a ser `/v/[token]`

**Cambio esperado en `prisma/schema.prisma`:**
```prisma
model Certificate {
  // ... campos existentes ...
  verification_token  String   @unique @default(uuid())
  // ... resto de campos ...
}
```

**Cambio esperado en `src/types/index.ts`:**
```ts
export interface Certificate {
  // ... campos existentes ...
  verification_token: string
  // ...
}
```

La URL del QR generada por `src/lib/diploma/` debe apuntar a `{BASE_URL}/v/{verification_token}`. El folio sigue imprimiéndose en el diploma y apareciendo en la página de verificación como referencia legible.

**Agente responsable:** Backend (schema + migración), Agente PDF/Imagen (URL del QR en el generador)

**Criterio de aceptación:**
- `prisma migrate status` muestra la migración aplicada
- El modelo `Certificate` tiene campo `verification_token` con valor UUID v4 generado automáticamente
- El endpoint `/v/[token]` acepta un UUID, no un folio
- Intentar acceder a `/v/SEN-2026-001` retorna 404
- El QR generado en el diploma apunta a `/v/{uuid}`, no a `/v/{folio}`

---

#### C3 — Rate limiting en el endpoint de login

**Problema:** No existe ningún mecanismo de rate limiting. El endpoint de login es vulnerable a fuerza bruta ilimitada.

**Por qué bloquea:** El route handler de NextAuth se crea en Sprint 0. Si se crea sin rate limiting, el vector queda abierto desde el primer commit. Añadirlo después es trivial en código pero requiere testing adicional y hay riesgo de olvidarlo.

**Archivos afectados:**
- `src/middleware.ts` — interceptar requests a `/api/auth/callback/credentials`
- `src/lib/auth.ts` — registrar intentos fallidos en AuditLog (cuando C5 esté resuelto)

**Cambio esperado:** El middleware debe interceptar requests POST a `/api/auth/callback/credentials` y aplicar rate limiting por IP antes de pasarlas al handler de NextAuth. Para MVP sin Redis, usar un `Map<string, { count: number; resetAt: number }>` en memoria del proceso de Node.

```
Límite: 5 intentos fallidos por IP en una ventana de 10 minutos
Lockout: bloquear la IP por 15 minutos al superar el límite
Respuesta: HTTP 429 con header Retry-After
```

Para producción con múltiples instancias, migrar a `@upstash/ratelimit` con Vercel KV. No instalarlo para MVP — la implementación en memoria es suficiente para un deploy de instancia única.

**Agente responsable:** Backend

**Criterio de aceptación:**
- 5 intentos fallidos desde la misma IP en menos de 10 minutos resultan en HTTP 429 en el intento número 6
- La respuesta 429 incluye header `Retry-After` con segundos hasta el reset
- Un intento exitoso dentro de los primeros 4 intentos fallidos funciona normalmente
- El lockout se levanta automáticamente después de 15 minutos
- Los intentos fallidos se registran en `AuditLog` con acción `login.failed` e IP anonimizada (últimos 3 octetos visibles)

---

#### C4 — Route handler de archivos privados con autorización

**Problema:** `StorageAdapter.url()` genera URLs `/api/files/{path}` pero el route handler `/api/files/[...path]` no existe. Cuando se cree, debe verificar sesión para archivos privados; de lo contrario, PDFs de diplomas y fotos de participantes serían accesibles sin autenticación.

**Por qué bloquea:** El handler debe crearse con autenticación desde el principio. Crearlo sin autenticación y "arreglarlo después" significa que durante el período de desarrollo los archivos subidos a staging/producción serían accesibles públicamente.

**Archivos afectados:**
- `src/app/api/files/[...path]/route.ts` — a crear
- `src/lib/storage/adapter.ts` — corregir `resolve()` para prevenir path traversal (resuelve también I2)
- `src/app/api/public/photos/[token]/route.ts` — a crear (endpoint separado para fotos de verificación pública)

**Cambio esperado:**

El handler de archivos privados debe:
1. Llamar a `getServerSession(authOptions)` — si no hay sesión, retornar 401
2. Sanitizar el path recibido de la URL: rechazar cualquier segmento que contenga `..`
3. Pasar el path sanitizado a `storage.get()`
4. Retornar el buffer con el `Content-Type` correcto

El endpoint `/api/public/photos/[token]/route.ts` (sin autenticación):
1. Recibir el `verification_token`
2. Buscar en BD el certificado con ese token
3. Si existe y está activo, retornar la foto desde `storage.get(cert.photo_path)`
4. Si no existe o está revocado, retornar 404

Adicionalmente, en `src/lib/storage/adapter.ts`, corregir `resolve()`:
```ts
private resolve(p: string) {
  const base = path.resolve(this.base)
  const resolved = path.resolve(base, p)
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('Path traversal detectado: ' + p)
  }
  return resolved
}
```

**Agente responsable:** Backend

**Criterio de aceptación:**
- GET `/api/files/generations/test/diplomas/test.pdf` sin sesión retorna 401
- GET `/api/files/generations/test/diplomas/test.pdf` con sesión válida retorna el archivo
- GET `/api/files/../../../etc/passwd` retorna 400 (path traversal bloqueado)
- GET `/api/public/photos/{token_valido}` retorna la foto sin sesión
- GET `/api/public/photos/{token_inexistente}` retorna 404

---

#### C5 — Modelo AuditLog en el schema

**Problema:** No existe tabla de auditoría. Las acciones administrativas críticas (revocación, reactivación, descarga ZIP, login) no dejan ningún rastro.

**Por qué bloquea:** El modelo debe existir y la migración debe correrse antes de que Backend implemente cualquier acción administrativa. Si se agrega después, las primeras acciones ejecutadas en producción quedarán sin registrar permanentemente — no hay forma de reconstruir el historial retroactivamente.

**Archivos afectados:**
- `prisma/schema.prisma` — agregar modelo `AuditLog` y relación en `User`
- `prisma/migrations/` — nueva migración (puede combinarse con la de C2 en una sola migración de Sprint 0)
- `src/types/index.ts` — agregar tipo `AuditLog`
- `src/lib/api/audit.ts` — a crear: helper `logAction()` para uso en route handlers

**Cambio esperado en `prisma/schema.prisma`:**
```prisma
model AuditLog {
  id          String   @id @default(cuid())
  user_id     String?
  action      String   // 'login.success' | 'login.failed' | 'certificate.revoke' |
                       // 'certificate.reactivate' | 'generation.create' |
                       // 'zip.download' | 'template.upload' | 'template.delete'
  target_id   String?
  target_type String?
  detail      Json?
  ip          String?
  created_at  DateTime @default(now())
  user        User?    @relation(fields: [user_id], references: [id])

  @@map("audit_logs")
}
```

En el modelo `User`, agregar: `audit_logs AuditLog[]`

El helper `src/lib/api/audit.ts` debe exportar una función `logAction()` que encapsule la escritura al log y nunca lance excepciones al código llamante (si el log falla, la operación principal debe continuar).

**Agente responsable:** Backend

**Criterio de aceptación:**
- `prisma migrate status` muestra la migración de `audit_logs` aplicada
- Un login exitoso crea un registro con `action: 'login.success'` y el `user_id` correcto
- Un intento de login fallido crea un registro con `action: 'login.failed'` e `ip` anonimizada
- Una revocación de certificado crea un registro con `action: 'certificate.revoke'`, `target_id: certificateId`, `target_type: 'certificate'`, y `detail` con el motivo
- La tabla `audit_logs` no tiene endpoints de DELETE ni UPDATE expuestos

---

#### ND4 — Helper assertOwnership para route handlers de generaciones

**Problema:** No existe ningún mecanismo que impida que un admin autenticado acceda o modifique generaciones de otro admin. El campo `created_by` existe en el schema pero no hay enforcement.

**Por qué bloquea:** Todos los route handlers de generaciones y certificados deben llamar a este helper. Crearlo después de implementar los handlers obliga a revisitar cada handler individualmente, con riesgo de omitir alguno.

**Archivos afectados:**
- `src/lib/api/ownership.ts` — a crear
- Todos los route handlers bajo `src/app/api/admin/generations/` y `src/app/api/admin/certificates/`

**Cambio esperado:**
```ts
// src/lib/api/ownership.ts
import { Session } from 'next-auth'
import { Errors } from './errors'

export function assertOwnership(
  session: Session,
  resource: { created_by: string }
): void {
  if (session.user.role === 'superadmin') return
  if (resource.created_by !== session.user.id) {
    throw Errors.FORBIDDEN()
  }
}
```

**Agente responsable:** Backend

**Criterio de aceptación:**
- Un admin autenticado que intenta GET/PATCH/DELETE sobre una generación que no le pertenece recibe HTTP 403
- Un superadmin autenticado puede operar sobre cualquier generación
- `assertOwnership` se llama en todos los route handlers que operan sobre `Generation` o `Certificate` por ID

---

#### ND5 — UserRole como enum de Prisma

**Problema:** `role String @default("admin")` en el modelo `User` no tiene restricción de valores en la BD. Un bug podría escribir un rol inválido y causar comportamiento impredecible en la autorización.

**Por qué bloquea:** Cambiar de `String` a `enum` después de tener datos en producción requiere una migración más compleja. Hacerlo en Sprint 0, antes de las primeras migraciones aplicadas en producción, es trivial.

**Archivos afectados:**
- `prisma/schema.prisma` — agregar `enum UserRole` y cambiar el campo `role` en `User`
- `src/lib/auth.ts` — validar que `user.role` sea un valor válido antes de incluirlo en el JWT

**Cambio esperado en `prisma/schema.prisma`:**
```prisma
enum UserRole {
  superadmin
  admin
}

model User {
  // ...
  role  UserRole  @default(admin)
  // ...
}
```

En `src/lib/auth.ts`, en el callback `authorize()`, validar antes de retornar:
```ts
if (!['admin', 'superadmin'].includes(user.role)) {
  return null // rechazar login si el rol es inválido
}
```

**Agente responsable:** Backend

**Criterio de aceptación:**
- `prisma migrate status` muestra la migración del enum aplicada
- Intentar insertar un usuario con `role = 'superAdmin'` (capitalización incorrecta) lanza error de BD
- El callback de NextAuth rechaza (retorna `null`) si `user.role` no es `'admin'` ni `'superadmin'`
- El tipo `UserRole` de TypeScript en `src/types/index.ts` coincide con los valores del enum de Prisma

---

### B. Antes del primer deploy

Estos ítems deben resolverse antes de exponer el sistema a usuarios reales, pero no bloquean el desarrollo local ni las pruebas internas.

---

#### I1 — Validación de uploads con magic bytes

**Riesgo:** Un atacante puede subir un archivo malicioso con extensión `.png` o `.csv`. La validación client-side es trivialmente bypasseable. El buffer se escribe al storage sin ninguna verificación del contenido real.

**Implementación recomendada:**
- En el route handler de upload de template PNG: verificar que el buffer inicia con `\x89PNG\r\n\x1A\n`. Adicionalmente, pasar el buffer por `sharp(buffer).metadata()` — sharp lanza error si no es una imagen válida.
- En el route handler de upload de ZIP de fotos: verificar magic bytes `PK\x03\x04`. Descomprimir en directorio temporal (`uploads/temp/{uuid}/`). Verificar que cada archivo extraído sea imagen válida (magic bytes JPEG `\xFF\xD8\xFF` o PNG). Límites: máximo 500 archivos, máximo 200MB total extraído, rechazar si ratio de compresión > 100:1 (protección contra ZIP bombs).
- En el route handler de CSV: usar un parser estricto (no `eval`, no ejecutar contenido). Verificar que las columnas obligatorias (`student_name`, `archivo_foto`) estén presentes antes de procesar.
- Nunca confiar en `Content-Type` del request — siempre verificar el contenido real del buffer.

**Criterio de aceptación:**
- Subir un archivo `.png` que en realidad es un ejecutable ELF retorna HTTP 400
- Subir un ZIP con ratio de compresión 200:1 retorna HTTP 400
- Subir un CSV válido con las columnas correctas procesa sin errores
- Los magic bytes se verifican antes de que el buffer se pase al storage

---

#### I2 — Path traversal en StorageAdapter.resolve()

**Riesgo:** `path.join(base, p)` con `p = '/etc/passwd'` ignora el prefijo `base` y retorna `/etc/passwd`. El futuro route handler pasará el path de la URL directamente a `storage.get()`.

**Implementación recomendada:** Aplicar el fix documentado en SECURITY_AUDIT.md hallazgo I2. El código concreto está también en el hallazgo C4 de esta sección. Aplicar en `src/lib/storage/adapter.ts` durante Sprint 0.

**Criterio de aceptación:**
- `storage.get('../../../etc/passwd')` lanza `Error('Path traversal detectado')`
- `storage.get('/etc/passwd')` lanza el mismo error
- `storage.get('templates/test/base.png')` funciona normalmente

---

#### I5 — JWT maxAge de 8 horas

**Riesgo:** Sin `maxAge` explícito, NextAuth usa el default de 30 días. Un token comprometido es válido durante 30 días completos. Con JWT stateless no hay forma de invalidarlo.

**Implementación recomendada:** En `src/lib/auth.ts`, cambiar:
```ts
session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }
```
Quick win de 5 minutos. Se hace en Sprint 0 junto con C1.

**Criterio de aceptación:**
- El JWT generado en login tiene campo `exp` con valor `iat + 28800` (8 horas en segundos)
- Una sesión inactiva por más de 8 horas redirige a `/admin/login`

---

#### I7 — .env en .gitignore

**Riesgo:** `.gitignore` solo excluye `.env*.local`. El archivo `.env` con `DATABASE_URL` real y `NEXTAUTH_SECRET` puede commitearse accidentalmente. `git status` ya muestra `.env` como untracked — el archivo existe en el repo sin protección.

**Implementación recomendada:** Agregar la línea `.env` al `.gitignore`. Quick win de 1 minuto. Debe hacerse **hoy mismo**, antes de cualquier otro trabajo de desarrollo.

**Criterio de aceptación:**
- `git status` no muestra `.env` como untracked ni como staged
- `git check-ignore .env` retorna `.env`

---

#### I8 — NODE_ENV en .env.example

**Riesgo:** `.env.example` tiene `NODE_ENV="development"` como valor activo. Si alguien copia el archivo sin cambiar este valor y hace deploy, Prisma logueará queries completas con valores de parámetros — incluyendo hashes de contraseñas y datos personales.

**Implementación recomendada:** En `.env.example`, cambiar la línea por:
```
# NODE_ENV: usar "development" en local, "production" en deploy
# NODE_ENV="development"
```

**Criterio de aceptación:**
- `.env.example` no contiene el string `NODE_ENV="development"` como valor activo (solo como comentario)
- El comentario indica claramente qué valor usar en cada entorno

---

#### I9 — CSRF: verificación de Origin en route handlers

**Riesgo:** Los route handlers POST/PATCH/DELETE de Next.js App Router no tienen protección CSRF automática. Un atacante puede construir una página que haga requests cross-site al panel admin si el admin tiene sesión activa en el navegador.

**Implementación recomendada:**
1. En todos los route handlers que mutean estado (POST, PATCH, DELETE), verificar al inicio:
```ts
const origin = request.headers.get('origin')
if (origin !== process.env.NEXTAUTH_URL) {
  return NextResponse.json(
    { error: { code: 'FORBIDDEN', message: 'Origin inválido' } },
    { status: 403 }
  )
}
```
2. Agregar headers de seguridad en `next.config.mjs` (detallado en el ítem de Headers más abajo).

**Criterio de aceptación:**
- Un POST a `/api/admin/generations` con `Origin: https://attacker.com` retorna 403
- Un POST desde la misma URL configurada en `NEXTAUTH_URL` funciona normalmente
- Los headers `X-Frame-Options` y `X-Content-Type-Options` aparecen en todas las respuestas

---

#### I10 — Validación de folio_override

**Riesgo:** `folio_override` del CSV se usa como nombre de archivo (`generations/{id}/diplomas/{folio}.pdf`). Un valor con `/`, `..` o caracteres especiales puede crear paths inesperados en el storage o causar conflictos.

**Implementación recomendada:**
1. En el procesador de CSV (server-side), antes de procesar cada fila:
```ts
const FOLIO_REGEX = /^[A-Z]{2,5}-\d{4}-\d{3,6}$/
if (row.folio_override && !FOLIO_REGEX.test(row.folio_override)) {
  // registrar como error de fila — no procesar este alumno
}
```
2. Al usar el folio como nombre de archivo, sanitizarlo adicionalmente: reemplazar cualquier carácter que no sea `[A-Za-z0-9-]` por `_`.

**Criterio de aceptación:**
- Un CSV con `folio_override = "../../../etc/test"` genera un error de validación para esa fila sin abortar el proceso completo
- Un CSV con `folio_override = "SEN-2026-099"` procesa correctamente
- El archivo generado se llama `SEN-2026-099.pdf`, sin caracteres especiales

---

#### Headers de seguridad en next.config.mjs

**Riesgo:** Sin headers de seguridad, el navegador puede embeber el panel admin en un iframe (clickjacking), inferir tipos MIME incorrectamente, o filtrar el origen en el referer.

**Implementación recomendada:** En `next.config.mjs`, agregar:
```js
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
      ],
    },
  ]
},
```

**Criterio de aceptación:**
- Respuesta a cualquier ruta incluye `X-Frame-Options: DENY`
- Respuesta incluye `X-Content-Type-Options: nosniff`
- Verificable con `curl -I https://dominio/admin/login`

---

### C. Decisiones de producto/privacidad

Estos ítems requieren una decisión de Seneto antes de que Backend implemente el endpoint `/v/[token]`. No son decisiones técnicas — son decisiones de política de privacidad.

---

#### I3 — Foto del participante en la página pública de verificación

**Decisión pendiente:** ¿La foto del participante debe aparecer en `/v/[token]`, accesible por cualquier persona que escanee el QR?

**Recomendación del arquitecto:** La foto no es necesaria para verificar la autenticidad del certificado. Nombre completo + folio + programa + estado (activo/no válido) + fecha de emisión es suficiente para verificación. La foto agrega valor de presentación pero multiplica el riesgo de privacidad: cualquier persona con acceso al QR puede ver la foto, y no hay forma de controlar quién escanea.

**Riesgo si se expone la foto:**
- La foto de un participante queda indexable públicamente si el QR se comparte en redes sociales
- No hay documentación de consentimiento explícito para exposición pública de foto en el sistema actual
- La foto está vinculada a nombre completo y programa — combinación suficiente para perfilado

**Si Seneto decide incluir la foto:** Servirla desde `/api/public/photos/[verification_token]`, no desde una URL directa al storage. El endpoint usa el token de verificación como clave de acceso, no el path del archivo. Agregar un aviso en la interfaz de carga de fotos indicando que se mostrarán públicamente.

**Quién debe validarlo:** Seneto (decisión de producto y privacidad). El arquitecto recomienda excluirla del MVP y añadirla en V2 con aviso de consentimiento.

---

#### Datos visibles en /v/[token] — nombre completo vs parcial

**Decisión pendiente:** La `VerifyResponse` actual incluye `student_name` completo (ej. "Juan Pérez García"). ¿Se expone el nombre completo o una versión parcial (ej. "Juan P. G.")?

**Recomendación del arquitecto:** Exponer el nombre completo. La página de verificación tiene el propósito de confirmar que el certificado pertenece a una persona específica. Un nombre parcial reduce la utilidad verificadora sin mejorar significativamente la privacidad — el folio y programa ya identifican al participante, y el verificador ya tiene el QR del diploma que presumiblemente también muestra el nombre.

**Quién debe validarlo:** Seneto.

---

#### Mensajes de estado en /v/[token] para certificados revocados

**Decisión pendiente:** Cuando un certificado está revocado, ¿qué se muestra en la página pública? Opciones:
1. "Este certificado ha sido revocado" con fecha de revocación
2. "Certificado no válido" sin detalles
3. "No se encontró información" (igual que token inexistente)

**Recomendación del arquitecto:** Opción 2 — "Certificado no válido" sin detalles adicionales. Revelar la fecha de revocación y el motivo puede exponer información sensible sobre el participante. La distinción entre "revocado" y "no encontrado" tampoco aporta valor al verificador legítimo.

**Quién debe validarlo:** Seneto.

---

#### Consentimiento de foto

**Decisión pendiente:** Si la foto se incluye en la verificación pública, ¿dónde se documenta el consentimiento del participante?

**Recomendación del arquitecto:** Agregar un campo `photo_consent Boolean @default(false)` al modelo `Certificate` y mostrar la foto solo si `photo_consent = true`. El consentimiento debe obtenerse en el proceso de registro del participante (fuera de scope del sistema actual) y registrarse al subir el CSV.

**Quién debe validarlo:** Seneto y equipo legal si aplica.

---

### D. Posterior al MVP

---

#### PM1 — Firma HMAC de certificados

**Por qué no bloquea MVP:** Los certificados se verifican contra la base de datos. La BD es la fuente de verdad. La firma HMAC agrega verificación offline (sin consultar la BD), que no es un requisito del MVP.

**Cuándo se recomienda:** Cuando el volumen de verificaciones justifique reducir queries a BD, o cuando se requiera verificación offline (ej. exportar certificados con QR autocontenido).

**Riesgo de postergar:** Sin firma, un certificado PDF modificado (ej. cambio de nombre) no es detectable comparando solo el QR. El verificador confía en los datos de la BD, no en el contenido del PDF.

---

#### PM2 — Migración a S3/R2 con URLs pre-firmadas

**Por qué no bloquea MVP:** El handler `/api/files/[...path]` con autenticación de sesión (C4) es suficiente para MVP. Las URLs pre-firmadas son más eficientes pero no son requisito de seguridad crítico para un deploy de instancia única.

**Cuándo se recomienda:** Obligatorio antes de cualquier deploy en plataformas PaaS sin filesystem persistente (Vercel, Railway, Fly.io). También antes de escalar a múltiples instancias.

**Riesgo de postergar:** El storage local no escala horizontalmente. En un deploy multi-instancia, los archivos subidos a una instancia no son accesibles desde otras. Para entornos efímeros, los archivos se pierden en cada redeploy.

---

#### PM3 — Invalidación de sesión por session_version

**Por qué no bloquea MVP:** Con `maxAge` de 8 horas, la ventana de exposición es manejable. La invalidación en tiempo real es importante pero no crítica para un sistema con pocos admins en un contexto controlado.

**Cuándo se recomienda:** Cuando haya más de 5 admins activos o cuando el sistema maneje datos que requieran revocación inmediata de acceso.

**Riesgo de postergar:** Si las credenciales de un admin son comprometidas, el atacante tiene hasta 8 horas de acceso válido sin posibilidad de revocar el token activo. Requiere cambiar contraseña Y esperar que expire el token.

---

#### PM4 — Two-factor authentication para superadmin

**Por qué no bloquea MVP:** Si el número de superadmins es pequeño (1–2 personas) y el acceso a producción es controlado (URL no pública), contraseña fuerte + rate limiting (C3) es suficiente para MVP.

**Cuándo se recomienda:** Antes de abrir el acceso a más de 5 admins o antes de hacer la URL de producción públicamente conocida.

**Riesgo de postergar:** El rol `superadmin` tiene acceso total al sistema. Una contraseña comprometida sin 2FA equivale a compromiso total: datos de todos los participantes, capacidad de revocar cualquier certificado.

---

#### PM5 — Expiración automática de archivos temporales

**Por qué no bloquea MVP:** El directorio `uploads/temp/` es de corta vida por diseño — los archivos se procesan y eliminan. El riesgo es acumulación si hay errores en el procesamiento que dejen archivos huérfanos.

**Cuándo se recomienda:** Sprint 3 o post-MVP como job de limpieza simple (cron o trigger en el pipeline de generación).

**Riesgo de postergar:** Acumulación de archivos temporales con datos personales (fotos originales de participantes) en el storage local. Si el storage no se limpia manualmente, los datos se retienen indefinidamente.

---

#### PM6 — Rate limiting en endpoint de verificación pública

**Por qué no bloquea MVP:** Con `verification_token` UUID aleatorio (C2), la enumeración es computacionalmente imposible. El rate limiting de verificación pública es defensa adicional contra scraping con tokens conocidos, no contra enumeración.

**Cuándo se recomienda:** Cuando el sistema esté en producción con usuarios reales y el volumen lo justifique.

**Riesgo de postergar:** Un actor con tokens válidos (obtenidos escaneando muchos QRs) podría hacer scraping de los datos de verificación. Con nombre + programa expuestos, esto es un riesgo de privacidad menor pero real a escala.

---

## 3. Plan de ejecución por sprint

### Sprint 0 — Security foundation

**Objetivo:** El sistema tiene autenticación funcional, schema seguro y defensas básicas. Al final del sprint, Backend puede escribir route handlers con la fundación correcta.

**Duración estimada:** 2–3 días

| Tarea | Hallazgo | Agente | Archivos |
|---|---|---|---|
| Agregar `.env` al `.gitignore` | I7/QW1 | Backend (inmediato) | `.gitignore` |
| Corregir `resolve()` en StorageAdapter | I2/QW4 | Backend | `src/lib/storage/adapter.ts` |
| Agregar `maxAge: 8h` a la sesión JWT | I5/QW3 | Backend | `src/lib/auth.ts` |
| Corregir `NODE_ENV` en `.env.example` | I8/QW6 | Backend | `.env.example` |
| Agregar headers de seguridad | I9/QW2 | Backend | `next.config.mjs` |
| Schema: `verification_token` + enum `UserRole` + modelo `AuditLog` | C2, ND5, C5 | Backend | `prisma/schema.prisma` |
| Correr migración única de Sprint 0 | — | Backend | `prisma/migrations/` |
| Actualizar `src/types/index.ts` con nuevos campos y tipos | C2, C5, ND5 | Backend | `src/types/index.ts` |
| Crear `src/app/api/auth/[...nextauth]/route.ts` | C1 | Backend | nuevo archivo |
| Crear `src/middleware.ts` con matcher `/admin/*` y rate limiting | C1, C3 | Backend | nuevo archivo |
| Crear `src/lib/api/audit.ts` con helper `logAction()` | C5 | Backend | nuevo archivo |
| Crear `src/lib/api/ownership.ts` con `assertOwnership()` | ND4 | Backend | nuevo archivo |
| Crear `/api/files/[...path]/route.ts` con auth de sesión | C4 | Backend | nuevo archivo |
| Crear `/api/public/photos/[token]/route.ts` | C4 | Backend | nuevo archivo |

**Entregables del Sprint 0:**
- `npx prisma migrate status` muestra todas las migraciones aplicadas
- Login con credenciales válidas funciona y redirige al dashboard
- GET `/admin/dashboard` sin sesión redirige a `/admin/login`
- 5 intentos fallidos de login generan HTTP 429
- GET `/api/files/...` sin sesión retorna 401
- `.env` no aparece en `git status`

---

### Sprint 1 — Backend seguro

**Objetivo:** Todos los route handlers administrativos implementados con autenticación, ownership, validación server-side y audit logging desde el primer commit de cada handler.

**Duración estimada:** 5–7 días

| Tarea | Hallazgo | Nota |
|---|---|---|
| Route handlers de Templates (CRUD) | — | Con `getServerSession`, `assertOwnership`, `logAction` |
| Route handler de upload de template PNG | I1 | Validar magic bytes PNG + `sharp.metadata()` |
| Route handlers de Generations (CRUD) | — | Con ownership check y audit log |
| Route handler de upload CSV | I1, I10 | Magic bytes, regex folio_override, validación server-side |
| Route handler de upload ZIP de fotos | I1 | Magic bytes ZIP, límite de archivos, anti-ZIP-bomb |
| Route handler de validación pre-generación | — | |
| Route handler de trigger de generación | C5 | `logAction('generation.create')` |
| Route handler de status de generación | — | |
| Route handler de descarga ZIP | C5 | `logAction('zip.download')` |
| Route handler de revocación/reactivación | C5 | `logAction` con motivo |
| Verificación de `Origin` en todos los handlers POST/PATCH/DELETE | I9 | |
| Endpoint de búsqueda de certificados | — | |
| Endpoint público `/v/[token]` | C2 | Usar `verification_token`, nunca el folio |

---

### Sprint 2 — Frontend y vista pública

**Objetivo:** Interfaz de administración completa con estados seguros. Vista pública de verificación implementada con las decisiones de privacidad confirmadas por Seneto.

**Duración estimada:** 5–7 días

| Tarea | Hallazgo | Nota |
|---|---|---|
| Layout admin con auth (usa middleware de Sprint 0) | C1 | No duplicar guards en cliente |
| Página de login `/admin/login` | — | Mensaje de error genérico sin distinguir campo |
| Dashboard de generaciones | — | Solo muestra las del admin actual |
| Flujo de creación de generación (pasos 1–6) | — | |
| Página de detalle de generación con progreso | — | Polling a `/api/status/[id]` mientras `status === 'processing'` |
| Página de certificados con búsqueda | — | |
| Modal de revocación con motivo | — | |
| Página pública `/v/[token]` | C2, I3 | Usar `VerifyResponse`; foto según decisión de Seneto (Sección 2C) |
| Estados de error en UI (404, 401, 403, 429) | — | Incluir estado de lockout por rate limiting |
| QR code en el generador apunta a `/v/{verification_token}` | C2 | Coordinar con Agente PDF/Imagen |

---

### Sprint 3 — Hardening antes de deploy

**Objetivo:** El sistema está listo para producción. Todos los criterios de aceptación de seguridad verificados y documentados.

**Duración estimada:** 2–3 días

| Tarea | Hallazgo | Nota |
|---|---|---|
| Test: `/admin/*` sin sesión redirige a login | C1 | |
| Test: `/api/admin/*` sin sesión retorna 401 | C1 | |
| Test: admin A no puede acceder a generaciones de admin B | ND4 | Requiere dos usuarios de prueba en BD |
| Test: path traversal en `/api/files` bloqueado | I2, C4 | |
| Test: 5 intentos de login → 429 | C3 | |
| Test: subir ejecutable como PNG → 400 | I1 | |
| Test: `folio_override` inválido → error de fila | I10 | |
| Test: `/v/{token_invalido}` → 404 | C2 | |
| Test: `/v/SEN-2026-001` → 404 | C2 | |
| Test: POST con Origin incorrecto → 403 | I9 | |
| Test: headers de seguridad con `curl -I` | QW2 | |
| Verificar que `.env` está en `.gitignore` | I7 | |
| Verificar que `NODE_ENV=production` en staging | I8 | |
| Verificar que `AuditLog` registra todas las acciones críticas | C5 | |
| Checklist final de los 22 puntos de la Sección 4 | — | |

---

## 4. Criterios de aceptación globales

Checklist verificable antes del primer deploy en producción:

- [ ] **Auth-1**: GET `/admin/dashboard` sin sesión retorna redirect 307 a `/admin/login`
- [ ] **Auth-2**: POST `/api/admin/generations` sin sesión retorna HTTP 401
- [ ] **Auth-3**: Login con credenciales correctas retorna token JWT con expiración de 8 horas
- [ ] **Auth-4**: Login con credenciales incorrectas retorna mensaje genérico sin distinguir cuál campo falló
- [ ] **Auth-5**: 5 intentos fallidos de login desde la misma IP en 10 minutos resultan en HTTP 429 en el intento 6
- [ ] **IDOR-1**: El campo `verification_token` existe en el modelo `Certificate` con valor UUID v4
- [ ] **IDOR-2**: La URL del QR en diplomas generados apunta a `/v/{uuid}`, no a `/v/{folio}`
- [ ] **IDOR-3**: GET `/v/SEN-2026-001` (folio directamente) retorna 404
- [ ] **IDOR-4**: Un admin autenticado que intenta operar sobre generaciones de otro admin recibe 403
- [ ] **Files-1**: GET `/api/files/generations/{id}/diplomas/{folio}.pdf` sin sesión retorna 401
- [ ] **Files-2**: GET `/api/files/../../../etc/passwd` retorna 400
- [ ] **Files-3**: GET `/api/public/photos/{token_valido}` retorna la foto sin sesión
- [ ] **Audit-1**: La tabla `audit_logs` tiene registros para: login exitoso, login fallido, revocación y descarga ZIP
- [ ] **Audit-2**: La tabla `audit_logs` no tiene endpoints de DELETE ni UPDATE expuestos
- [ ] **Schema-1**: El campo `role` en la tabla `users` es de tipo enum `UserRole`, no `String`
- [ ] **Schema-2**: `.env` está en `.gitignore` y no aparece en `git status`
- [ ] **Upload-1**: Subir un archivo con extensión `.png` cuyo contenido no es una imagen retorna HTTP 400
- [ ] **Upload-2**: Subir un CSV con `folio_override` inválido registra error de fila pero no aborta el proceso
- [ ] **Headers-1**: Todas las respuestas HTTP incluyen `X-Frame-Options: DENY` y `X-Content-Type-Options: nosniff`
- [ ] **CSRF-1**: POST a cualquier route handler admin con `Origin` incorrecto retorna HTTP 403
- [ ] **Privacy-1**: La `VerifyResponse` nunca incluye el campo `email` del participante
- [ ] **Privacy-2**: La decisión sobre `photo_url` en la respuesta pública está documentada y aprobada por Seneto

---

## 5. Tickets sugeridos para Backend

### SEC-001 — Quick wins inmediatos (pre-Sprint 0)

**Descripción:** Cambios de una línea que deben aplicarse antes de cualquier otra tarea de desarrollo. Sin dependencias externas.

**Archivos afectados:**
- `.gitignore` — agregar línea `.env`
- `src/lib/auth.ts` — agregar `maxAge: 8 * 60 * 60` en el objeto `session`
- `src/lib/storage/adapter.ts` — reemplazar `resolve()` con versión que previene path traversal
- `.env.example` — comentar el valor literal `NODE_ENV="development"`
- `next.config.mjs` — agregar bloque `headers()` con `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`

**Criterios de aceptación:**
- `git check-ignore .env` retorna `.env`
- El JWT tiene expiración de 8h
- `storage.get('../../../etc/passwd')` lanza error
- `.env.example` no contiene `NODE_ENV="development"` como valor activo
- `curl -I http://localhost:3000` incluye `X-Frame-Options: DENY`

**Dependencias:** Ninguna

**Riesgo si no se implementa:** Commit accidental de credenciales; tokens válidos 30 días; path traversal en storage; logs de queries sensibles en producción; clickjacking del panel admin

---

### SEC-002 — Schema de Sprint 0: tres cambios en una migración

**Descripción:** Única migración de Prisma que agrupa todos los cambios de schema necesarios antes del desarrollo de Backend: campo `verification_token` en `Certificate`, enum `UserRole` en `User`, y modelo `AuditLog`. Agruparlos en una sola migración evita estados intermedios inseguros.

**Archivos afectados:**
- `prisma/schema.prisma`
- `prisma/migrations/` (nueva migración: `sprint0_security`)
- `src/types/index.ts` — agregar `verification_token: string` a `Certificate`, agregar interfaz `AuditLog`

**Criterios de aceptación:**
- `npx prisma migrate dev --name sprint0_security` corre sin errores
- El modelo `Certificate` tiene `verification_token String @unique @default(uuid())`
- El modelo `User` tiene `role UserRole @default(admin)` con enum declarado
- El modelo `AuditLog` existe con todos los campos del hallazgo C5
- `src/types/index.ts` refleja los tres cambios

**Dependencias:** SEC-001 (aplicar quick wins primero para tener el entorno correcto)

**Riesgo si no se implementa:** Hallazgos C2, C5 y ND5 permanecen abiertos; Backend no puede comenzar los route handlers de Sprint 1 con la fundación correcta

---

### SEC-003 — Middleware de autenticación y route handler de NextAuth

**Descripción:** Crear `src/middleware.ts` y `src/app/api/auth/[...nextauth]/route.ts`. Primera tarea de Backend con componente de infraestructura — sin estos dos archivos, `/admin/*` es completamente público.

**Archivos afectados:**
- `src/middleware.ts` — a crear (incluye el rate limiting de SEC-004)
- `src/app/api/auth/[...nextauth]/route.ts` — a crear

**Criterios de aceptación:** Ver hallazgo C1, criterios de aceptación completos.

**Dependencias:** SEC-001 (para `maxAge` en JWT)

**Riesgo si no se implementa:** Panel admin completamente público; ninguna página admin está protegida

---

### SEC-004 — Rate limiting en login

**Descripción:** Implementar rate limiting en `src/middleware.ts` interceptando requests POST a `/api/auth/callback/credentials`. Map en memoria para MVP (5 intentos / 10 min / IP, lockout 15 min). Puede implementarse en el mismo archivo que SEC-003 para evitar overhead de un segundo middleware.

**Archivos afectados:**
- `src/middleware.ts` — extender el middleware de SEC-003

**Criterios de aceptación:** Ver hallazgo C3.

**Dependencias:** SEC-003

**Riesgo si no se implementa:** Endpoint de login vulnerable a fuerza bruta ilimitada desde el primer día

---

### SEC-005 — Helper logAction para audit logging

**Descripción:** Crear `src/lib/api/audit.ts` con `logAction()`. La función debe ser fire-and-forget desde el punto de vista del código llamante: capturar internamente cualquier error de escritura a BD y nunca propagarlo.

**Archivos afectados:**
- `src/lib/api/audit.ts` — a crear

**Criterios de aceptación:**
- Función `logAction()` exportada con firma: `(params: { userId?: string, action: string, targetId?: string, targetType?: string, detail?: object, ip?: string }) => Promise<void>`
- Si la escritura a BD falla, la función loggea el error internamente y retorna sin lanzar
- Verificable: llamar `logAction()` con BD no disponible no rompe el flujo de la operación principal

**Dependencias:** SEC-002 (modelo `AuditLog` debe existir)

**Riesgo si no se implementa:** Las acciones críticas (revocación, descarga ZIP) quedan sin registrar; imposible reconstruir historial de auditoría

---

### SEC-006 — Helper assertOwnership para route handlers

**Descripción:** Crear `src/lib/api/ownership.ts` con `assertOwnership()`. Debe ser creado antes de que Backend implemente los route handlers de Sprint 1 para garantizar que todos los handlers lo usen desde el primer commit.

**Archivos afectados:**
- `src/lib/api/ownership.ts` — a crear

**Criterios de aceptación:** Ver hallazgo ND4.

**Dependencias:** SEC-003 (la sesión debe estar disponible en los route handlers)

**Riesgo si no se implementa:** IDOR entre admins — cualquier admin autenticado puede leer y modificar recursos de otros admins

---

### SEC-007 — Route handler /api/files con autenticación y path traversal protection

**Descripción:** Crear `src/app/api/files/[...path]/route.ts` que requiere sesión. Crear `src/app/api/public/photos/[token]/route.ts` para fotos de verificación pública. El handler privado usa el `resolve()` corregido de SEC-001 como segunda capa de defensa.

**Archivos afectados:**
- `src/app/api/files/[...path]/route.ts` — a crear
- `src/app/api/public/photos/[token]/route.ts` — a crear

**Criterios de aceptación:** Ver hallazgo C4.

**Dependencias:** SEC-001 (fix de path traversal), SEC-002 (para buscar certificado por `verification_token` en el endpoint público), SEC-003 (sesión disponible)

**Riesgo si no se implementa:** Todos los archivos del storage accesibles sin autenticación vía URL directa

---

### SEC-008 — Validación de magic bytes en uploads

**Descripción:** Implementar validación del contenido real de archivos en los route handlers de upload. Cubrir PNG/JPEG (template y fotos), ZIP (batch de fotos), y CSV. La validación ocurre en el route handler antes de pasar el buffer al storage o al procesador.

**Archivos afectados:**
- Route handler de upload de template PNG (a crear en Sprint 1)
- Route handler de upload de CSV (a crear en Sprint 1)
- Route handler de upload de ZIP de fotos (a crear en Sprint 1)

**Criterios de aceptación:** Ver hallazgo I1.

**Dependencias:** SEC-003 (los route handlers requieren sesión); los route handlers de Sprint 1 deben crearse con esta validación desde el inicio

**Riesgo si no se implementa:** Upload de archivos maliciosos al storage del servidor; posible ejecución de código o corrupción de datos

---

### SEC-009 — Validación de folio_override en procesamiento CSV

**Descripción:** En el procesador de CSV (server-side), validar `folio_override` contra regex estricto antes de usar el valor como nombre de archivo. Sanitizar el folio al usarlo como nombre de archivo como segunda capa.

**Archivos afectados:**
- El módulo de procesamiento CSV en `src/lib/diploma/` o en el route handler de CSV (a determinar por Backend)

**Criterios de aceptación:** Ver hallazgo I10.

**Dependencias:** SEC-008 (el CSV ya pasa validación básica de magic bytes y columnas)

**Riesgo si no se implementa:** Paths inesperados en el storage; posibles conflictos de archivos con nombres que contengan caracteres de control o separadores de path

---

### SEC-010 — Verificación de Origin en route handlers

**Descripción:** En todos los route handlers POST/PATCH/DELETE, agregar verificación del header `Origin` contra `process.env.NEXTAUTH_URL` al inicio del handler. Esta verificación es la primera línea de código después de la verificación de sesión.

**Archivos afectados:**
- Todos los route handlers admin que mutan estado (a crear en Sprint 1)

**Criterios de aceptación:** Ver hallazgo I9.

**Dependencias:** Los route handlers deben crearse con esta verificación desde el inicio (no agregar retroactivamente)

**Riesgo si no se implementa:** Vulnerabilidad CSRF en todos los endpoints administrativos que mutan estado

---

### SEC-011 — Endpoint público /v/[token] con verification_token

**Descripción:** Implementar `src/app/v/[token]/page.tsx` (o route handler equivalente) que usa el `verification_token` UUID para buscar el certificado. El folio nunca es aceptado como clave de acceso en este endpoint.

**Archivos afectados:**
- `src/app/v/[token]/page.tsx` — a crear (Server Component recomendado)
- `src/app/api/verify/[token]/route.ts` — route handler opcional si se separa la lógica de la página

**Criterios de aceptación:**
- GET `/v/{uuid_valido}` retorna datos del certificado
- GET `/v/SEN-2026-001` retorna 404
- GET `/v/{uuid_de_certificado_revocado}` muestra estado "no válido" (texto según decisión de Seneto en Sección 2C)
- `VerifyResponse` nunca incluye el campo `email`
- La foto solo aparece si Seneto confirmó la decisión (Sección 2C, I3)

**Dependencias:** SEC-002 (campo `verification_token` en schema), decisión de Seneto sobre datos visibles

**Riesgo si no se implementa:** El QR apunta al folio secuencial — enumeración trivial de todos los certificados del sistema

---

### SEC-012 — QR code en generador apunta a verification_token

**Descripción:** En el módulo de generación de diplomas (`src/lib/diploma/`), el código que genera el QR debe construir la URL usando `certificate.verification_token`, no `certificate.folio`. Tarea de coordinación entre Backend y Agente PDF/Imagen.

**Archivos afectados:**
- El módulo de generación en `src/lib/diploma/` (a crear por Agente PDF/Imagen)

**Criterios de aceptación:**
- El QR generado en un diploma apunta a `{BASE_URL}/v/{verification_token}`
- Escanear el QR abre la página de verificación correcta
- El folio sigue apareciendo impreso en el diploma como texto legible, pero no como URL del QR

**Dependencias:** SEC-002 (campo `verification_token` en schema), SEC-011 (el endpoint `/v/[token]` debe existir)

**Riesgo si no se implementa:** Aunque el endpoint esté correctamente implementado, todos los diplomas generados tendrán QRs que apuntan al folio — los documentos ya emitidos quedarán permanentemente con URLs vulnerables

---

## 6. Notas para otros agentes

### Para el Agente Backend

**Orden obligatorio de ejecución en Sprint 0:**
1. SEC-001 — quick wins (ejecutar antes que cualquier otra tarea; sin dependencias)
2. SEC-002 — schema único con los tres cambios de seguridad
3. SEC-003 — middleware + route handler de NextAuth (incluye SEC-004)
4. SEC-005 y SEC-006 — helpers de audit y ownership (crearlos antes de los route handlers de Sprint 1)
5. SEC-007 — handler de archivos con autenticación

**Reglas de construcción de route handlers (Sprint 1 en adelante):**

Todo route handler admin debe tener esta estructura en el siguiente orden:
1. Verificación de sesión: `const session = await getServerSession(authOptions); if (!session) return handleApiError(Errors.UNAUTHORIZED())`
2. Verificación de Origin (handlers POST/PATCH/DELETE): `if (origin !== process.env.NEXTAUTH_URL) return handleApiError(Errors.FORBIDDEN())`
3. Validación del body/params con tipos de `src/types/api.ts`
4. Fetch del recurso de BD
5. `assertOwnership(session, resource)` si aplica
6. Lógica de negocio
7. `await logAction(...)` al final, solo si la operación tuvo éxito

Reglas adicionales:
- Usar `handleApiError` de `src/lib/api/errors.ts` en el bloque `catch` de todos los handlers
- No instanciar `PrismaClient` directamente — usar el singleton `prisma` de `src/lib/db.ts`
- No instanciar `LocalStorage` directamente — usar el singleton `storage` de `src/lib/storage/adapter.ts`
- La URL del QR en diplomas usa `certificate.verification_token`, nunca `certificate.folio`
- `DATABASE_URL` va en `prisma.config.ts`, NO en `schema.prisma` (Prisma 7)

---

### Para el Agente Frontend

**Lo que Backend provee y Frontend NO debe duplicar:**
- El middleware en `src/middleware.ts` protege `/admin/*` automáticamente — no implementar guards adicionales en el cliente
- Los errores de API siguen el formato `{ error: { code, message } }` de `src/lib/api/errors.ts`
- El estado de sesión se accede con `useSession()` de `next-auth/react`

**Reglas de seguridad en UI:**
- Nunca mostrar el folio como URL de verificación — la URL es siempre `/v/{verification_token}`
- El folio se muestra como texto en la UI (ej. "Folio: SEN-2026-001") pero nunca como `href`
- Los mensajes de error de login no deben distinguir entre "email no existe" y "contraseña incorrecta" — mantener el mensaje genérico "Email o contraseña incorrectos"
- No incluir datos del usuario (email, rol) en URLs, query params ni localStorage
- Para la página pública `/v/[token]`: implementar como Server Component para no exponer lógica de negocio al cliente
- Si se implementa foto en verificación pública: usar `<img src="/api/public/photos/{token}">`, nunca una URL directa al storage
- Diseñar el estado de lockout por rate limiting (mensaje: "Demasiados intentos. Intenta de nuevo en 15 minutos.")

**Decisiones pendientes de Seneto que afectan el diseño (no implementar hasta confirmación):**
- Si la foto del participante aparece en `/v/[token]`
- Texto exacto para certificado con estado revocado en la vista pública

---

### Para el Product Designer

**Restricciones de seguridad que afectan el diseño de UI/UX:**

1. **URL de verificación pública:** La URL es `/v/{uuid-largo}`. El QR apunta a esta URL. No se puede simplificar a `/v/{folio}` por razones de seguridad (IDOR). El folio sigue siendo visible como texto en la página de verificación — diseñar la jerarquía visual considerando que el UUID no aparece como texto legible, solo en la URL.

2. **Foto en verificación pública:** Pendiente de decisión de Seneto (Sección 2C, I3). Diseñar la página `/v/[token]` para ambos estados: con foto y sin foto. No asumir que la foto estará presente en el MVP.

3. **Estado de certificado revocado:** El texto recomendado para la vista pública es "Certificado no válido" sin mostrar fecha ni motivo. No diseñar una UI que exponga detalles de revocación a visitantes públicos.

4. **Formulario de login:** El mensaje de error es "Email o contraseña incorrectos" — siempre el mismo mensaje, nunca indicar cuál campo falló. El diseño del formulario no debe sugerir cuál campo es incorrecto mediante estilos de error diferenciados por campo.

5. **Estado de lockout por rate limiting:** Diseñar el estado de bloqueo temporal del formulario de login. Texto sugerido: "Demasiados intentos fallidos. Por favor espera 15 minutos antes de intentar de nuevo." Incluir un contador visual si es posible.

6. **Dashboard de generaciones:** Solo muestra las generaciones del admin autenticado. El superadmin ve todas. Diseñar el estado vacío para admins nuevos sin generaciones.

---

### Para el Agente QA

**Casos de prueba de seguridad obligatorios (deben estar en el plan de QA antes de cada deploy):**

| # | Caso | Input | Resultado esperado | Hallazgo |
|---|---|---|---|---|
| 1 | Auth bypass | GET `/admin/dashboard` sin sesión | Redirect 307 a `/admin/login` | C1 |
| 2 | Auth bypass API | POST `/api/admin/generations` sin sesión | HTTP 401 | C1 |
| 3 | Enumeración de folios | GET `/v/SEN-2026-001` | HTTP 404 | C2 |
| 4 | Verificación por token | GET `/v/{uuid_valido}` | Datos del certificado | C2 |
| 5 | Rate limiting | 6 intentos de login fallidos < 10 min | HTTP 429 en el intento 6 | C3 |
| 6 | Archivos sin auth | GET `/api/files/generations/x/diplomas/x.pdf` sin sesión | HTTP 401 | C4 |
| 7 | Path traversal | GET `/api/files/../../../etc/passwd` | HTTP 400 | I2, C4 |
| 8 | IDOR entre admins | Admin A opera sobre generación de Admin B | HTTP 403 | ND4 |
| 9 | Upload malicioso | Subir ejecutable ELF con extensión `.png` | HTTP 400 | I1 |
| 10 | ZIP bomb | Subir ZIP con ratio compresión > 100:1 | HTTP 400 | I1 |
| 11 | folio_override inválido | CSV con `folio_override = "../../../test"` | Error de fila, proceso continúa | I10 |
| 12 | CSRF | POST admin con `Origin: https://evil.com` | HTTP 403 | I9 |
| 13 | Email en respuesta pública | GET `/v/{uuid_valido}` | Respuesta no contiene campo `email` | I3 |
| 14 | Headers de seguridad | `curl -I https://dominio/` | `X-Frame-Options: DENY` presente | QW2 |

**Fixture adicional necesario para QA:** Crear un segundo usuario admin en la BD de pruebas para ejecutar el caso #8 (IDOR entre admins). El fixture actual `fixtures/students-sample.csv` cubre los datos de alumnos pero no usuarios del sistema.

**Caso de prueba de regresión crítico del fixture existente:** `María González López` tiene `folio_override = SEN-2026-099`. Verificar que el sistema respeta este valor y no lo sobreescribe con el contador automático. Este caso prueba tanto la lógica de negocio como la validación del formato del folio_override.

---

_Plan generado por el Agente de Arquitectura el 2026-05-07. Basado en `docs/SECURITY_AUDIT.md` y en revisión directa del código real del proyecto. Este documento es el input principal para el Agente Backend en Sprint 0. Cualquier decisión tomada en la Sección 2C debe documentarse en este archivo antes de iniciar Sprint 2._
