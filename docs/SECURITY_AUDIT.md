# Auditoría de Seguridad — Sistema de Diplomas Seneto
> Generada el 2026-05-07. Basada en revisión del código real del proyecto.

---

## 1. Resumen ejecutivo

- **Nivel de riesgo general: ALTO** (pre-desarrollo; la base está bien, pero hay riesgos de diseño que deben resolverse antes de escribir los primeros route handlers)
- **Principales preocupaciones:**
  1. El folio secuencial `SEN-2026-001` es el identificador público y es directamente enumerable — un actor externo puede iterar todos los certificados del sistema
  2. No existe middleware de autenticación (`src/middleware.ts`) ni route handler de NextAuth (`src/app/api/auth/[...nextauth]/route.ts`) — las rutas `/admin/*` están completamente desprotegidas en el estado actual
  3. No hay rate limiting en ninguna capa; el endpoint de login es vulnerable a fuerza bruta sin ningún mecanismo de defensa
  4. No existe audit log — las acciones administrativas críticas (revocación, reactivación, descarga de ZIP masivo) son completamente invisibles
  5. La `VerifyResponse` pública incluye `photo_url` y `student_name` — datos personales expuestos sin control a cualquier persona que escanee un QR
  6. El `StorageAdapter.url()` genera rutas como `/api/files/{path}` sin ningún mecanismo de autorización descrito — los archivos de diplomas podrían ser accesibles sin autenticación
  7. La lógica de generación de folios no está implementada aún, pero el diseño propuesto es secuencial y vulnerable a IDOR
- **Recomendación general:** No avanzar al desarrollo activo de Backend/Frontend hasta resolver los hallazgos críticos C1–C3. Los hallazgos C4–C5 y los importantes son necesarios antes de despliegue en producción.

---

## 2. Hallazgos críticos

### C1. Middleware de autenticación ausente — rutas /admin/* completamente abiertas

- **Riesgo:** CRÍTICO
- **Impacto:** Cualquier persona puede acceder a todas las rutas administrativas sin autenticarse. No existe ninguna barrera entre el público general y el panel de administración.
- **Evidencia:** `src/middleware.ts` no existe (confirmado por `find`). `src/app/api/auth/[...nextauth]/route.ts` tampoco existe. `docs/ARCHITECTURE_HANDOFF.md` sección 10 confirma ambos como "❌ Pendiente Agente Backend".
- **Recomendación:** El Agente Backend debe crear `src/middleware.ts` y `src/app/api/auth/[...nextauth]/route.ts` como primera tarea, antes que cualquier otro route handler. Sin estos dos archivos, todo el panel admin es público.

---

### C2. IDOR por folio secuencial — enumeración trivial de certificados

- **Riesgo:** CRÍTICO
- **Impacto:** El folio `SEN-2026-001` es secuencial y predecible. Un actor externo puede iterar `SEN-2026-001`, `SEN-2026-002`, `SEN-2026-003`... para obtener los datos personales de todos los certificados emitidos (nombre, programa, foto). No necesita credenciales — solo escanear un QR para conocer el patrón y luego iterar automáticamente.
- **Evidencia:**
  - `prisma/schema.prisma` línea 66: `folio String @unique` — el folio es el identificador único del certificado en la URL de verificación
  - `src/types/api.ts` líneas 90–98: `VerifyResponse` expone `student_name`, `program`, `issued_date`, `photo_url` — datos personales reales, sin autenticación
  - `docs/ARCHITECTURE_HANDOFF.md` sección 9: "el formato es `{prefix}-{year}-{counter padded to 3}`, ej. `SEN-2026-001`" — confirma la secuencialidad explícita
  - `prisma/schema.prisma` líneas 48–49: `folio_prefix String @default("SEN")` + `folio_counter Int @default(1)` — el contador arranca en 1 y sube secuencialmente
  - `docs/USER_FLOWS.md` línea 125: "Los folios serán: SEN-2026-001, SEN-2026-002, ..." — el patrón es documentado y público
- **Recomendación:**
  1. Separar el **folio público** (legible, impreso en el diploma: `SEN-2026-001`) del **token de verificación** (no enumerable, usado en la URL del QR)
  2. La URL del QR debe apuntar a `/v/{verification_token}`, donde el token es un UUID v4 generado aleatoriamente al crear el certificado — nunca al folio
  3. El folio sigue siendo visible en el diploma impreso y en la página de verificación como identificador legible, pero no es la llave de acceso a la URL
  4. Agregar campo `verification_token String @unique @default(uuid())` al modelo `Certificate` en `prisma/schema.prisma`
  5. La ruta pública pasa a ser `/v/[token]` — nunca `/v/[folio]`

---

### C3. Sin rate limiting — endpoint de login vulnerable a fuerza bruta

- **Riesgo:** CRÍTICO
- **Impacto:** El endpoint de login en `/api/auth/[...nextauth]` (cuando sea creado) no tiene ningún mecanismo de rate limiting, lockout ni CAPTCHA. Un atacante puede hacer miles de intentos de login sin impedimento, probando diccionarios de contraseñas contra cuentas de administrador.
- **Evidencia:**
  - `src/lib/auth.ts` líneas 14–31: el handler de `authorize()` no tiene contador de intentos fallidos, bloqueo temporal ni detección de IPs abusivas
  - `package.json`: no hay ninguna librería de rate limiting instalada (`express-rate-limit`, `@upstash/ratelimit`, `next-rate-limit` o similar)
  - `docs/USER_FLOWS.md` línea 45: "⚠ Recomendación de seguridad (pendiente de confirmar con Backend para MVP): bloquear el formulario temporalmente después de 5 intentos fallidos en 10 minutos." — confirma que no está implementado
  - `next.config.mjs`: no hay configuración de rate limiting a nivel de infraestructura
- **Recomendación:**
  1. Implementar rate limiting en el middleware de Next.js, interceptando las requests a `/api/auth/callback/credentials`
  2. Para MVP sin Redis: `Map<string, { count: number, resetAt: number }>` en memoria, con clave por IP. Límite: 5 intentos en 10 minutos, lockout de 15 minutos
  3. Para producción: usar `@upstash/ratelimit` con Redis o Vercel KV para que el estado persista entre instancias
  4. Registrar intentos fallidos de login en la tabla `AuditLog` (ver hallazgo C5) con IP anonimizada
  5. El mensaje de error actual en USER_FLOWS es correcto: "Email o contraseña incorrectos" — no revelar cuál campo falló, mantenerlo así

---

### C4. Route handler de archivos sin autorización — `/api/files/{path}` expone diplomas y fotos

- **Riesgo:** CRÍTICO
- **Impacto:** `StorageAdapter.url()` genera URLs como `/api/files/generations/{id}/diplomas/{folio}.pdf` y `/api/files/generations/{id}/photos/{filename}`. Si el route handler `/api/files/[...path]` sirve archivos sin verificar sesión, cualquier persona con la URL puede descargar PDFs de diplomas y fotos de participantes sin autenticación alguna.
- **Evidencia:**
  - `src/lib/storage/adapter.ts` líneas 46–48: `url(p: string): string { return '/api/files/' + p }` — genera la URL; no hay autenticación en la interfaz
  - El route handler `/api/files/[...path]/route.ts` **no existe aún** (el `find` solo encontró 8 archivos en `src/`, ninguno en `src/app/api/`)
  - `docs/ARCHITECTURE_HANDOFF.md` sección 6: la convención de paths incluye `generations/{generation_id}/photos/{filename}` — fotos de participantes reales
  - `src/types/api.ts` línea 98: `VerifyResponse` incluye `photo_url` — esta URL apunta a `/api/files/...`
- **Recomendación:**
  1. El route handler `/api/files/[...path]/route.ts` debe verificar sesión (`getServerSession`) antes de servir cualquier archivo bajo `generations/` y `templates/`
  2. Excepción controlada para fotos en la página de verificación pública: servirlas desde un path diferente (ej. `/api/public/photos/[verification_token]`) que no exponga la estructura interna del storage
  3. En producción con R2/S3: usar URLs pre-firmadas con TTL corto (15 minutos) para archivos privados; CDN con acceso controlado para fotos públicas de verificación

---

### C5. Ausencia total de audit log — acciones críticas sin trazabilidad

- **Riesgo:** CRÍTICO (para sistema con datos personales)
- **Impacto:** No existe ningún mecanismo para registrar quién revocó un certificado, cuándo, o por qué. Si un admin comete un error o actúa de mala fe, no hay forma de detectarlo ni de reconstruir el historial. Las revocaciones además borran `revoked_at` y `revocation_reason` al reactivar, destruyendo el historial permanentemente.
- **Evidencia:**
  - `prisma/schema.prisma`: no existe modelo `AuditLog` — los cinco modelos actuales son `User`, `Template`, `Generation`, `Certificate`, `GenerationError`
  - `docs/USER_FLOWS.md` línea 699: "No existe historial de revocaciones anteriores en el modelo de datos del MVP. Al reactivar, `revoked_at` y `revocation_reason` se limpian del registro." — la pérdida de historial es intencional en el diseño actual
  - `src/types/index.ts` líneas 72–89: el modelo `Certificate` tiene un único par `revoked_at`/`revocation_reason` — sobreescrito en cada ciclo revocar/reactivar
  - `src/lib/auth.ts` líneas 26–29: `last_login_at` se actualiza en login exitoso, pero no hay registro de intentos fallidos ni de ninguna otra acción administrativa
- **Recomendación:**
  1. Agregar modelo `AuditLog` al schema de Prisma **antes del desarrollo de Backend**:
     ```prisma
     model AuditLog {
       id          String   @id @default(cuid())
       user_id     String?
       action      String   // 'login.success', 'login.failed', 'certificate.revoke',
                            // 'certificate.reactivate', 'generation.create',
                            // 'zip.download', 'template.upload'
       target_id   String?
       target_type String?
       detail      Json?
       ip          String?
       created_at  DateTime @default(now())
       user        User?    @relation(fields: [user_id], references: [id])

       @@map("audit_logs")
     }
     ```
  2. El audit log debe ser **append-only** — nunca modificar ni eliminar entradas existentes
  3. Acciones a registrar obligatoriamente: login exitoso, login fallido (con IP), revocación (con motivo), reactivación, descarga de ZIP, creación/eliminación de templates, cambio de estado de generación

---

## 3. Hallazgos importantes

### I1. Validación de archivos insuficiente en uploads — riesgo de archivos maliciosos

- **Riesgo:** ALTO
- **Impacto:** Los flujos de subida de archivos (CSV, ZIP de fotos, PNG de plantilla) describen validaciones de extensión en el cliente, pero no existe validación server-side del contenido real del archivo. Un atacante podría subir un archivo malicioso con extensión `.png` o `.csv`.
- **Evidencia:**
  - `docs/USER_FLOWS.md` líneas 162–168: validaciones de formato/tamaño para el flujo 4 (template PNG) — validación solo mencionada para el cliente
  - `docs/USER_FLOWS.md` líneas 317–319: flujo 7 (ZIP de fotos) — acepta JPG/PNG/WEBP, sin verificación de magic bytes
  - `src/lib/storage/adapter.ts` líneas 23–27: `put()` escribe el buffer directamente sin validación del contenido
  - No existe ningún módulo de validación de archivos en `src/lib/`
- **Recomendación:**
  1. Validar magic bytes en todos los route handlers de upload: PNG inicia con `\x89PNG\r\n\x1A\n`, JPEG con `\xFF\xD8\xFF`, ZIP con `PK\x03\x04`
  2. Limitar el tamaño del buffer en el route handler antes de procesarlo — no depender de la validación client-side
  3. Para el ZIP de fotos: descomprimir en directorio temporal aislado, verificar que el contenido son solo imágenes, limitar número de archivos y tamaño total extraído (protección contra ZIP bombs con ratio > 100:1)
  4. Para imágenes: usar `sharp(buffer).metadata()` — sharp lanza error si el contenido no es una imagen válida, lo que sirve como segunda capa de validación
  5. Para CSV: usar un parser estricto que rechace contenido no esperado; nunca ejecutar ni evaluar contenido del CSV

---

### I2. Path traversal potencial en StorageAdapter

- **Riesgo:** ALTO
- **Impacto:** El método `LocalStorage.resolve()` usa `path.join(this.base, p)` sin sanitizar el path de entrada. Si un atacante controla el parámetro `path` — por ejemplo a través de la URL del futuro route handler `/api/files/[...path]` — puede intentar leer archivos fuera del directorio de storage.
- **Evidencia:**
  - `src/lib/storage/adapter.ts` líneas 19–21: `private resolve(p: string) { return path.join(this.base, p) }` — si `p` es un path absoluto (empieza con `/`), `path.join` ignora el prefijo base
  - `src/lib/storage/adapter.ts` línea 47: el path se incluye directamente en la URL sin sanitización
  - El futuro route handler `/api/files/[...path]` tomará el path de la URL y lo pasará a `storage.get()` sin sanitización adicional
- **Recomendación:**
  Agregar validación en `resolve()` en `src/lib/storage/adapter.ts`:
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
  El route handler `/api/files/[...path]` debe adicionalmente rechazar paths que contengan `..` antes de pasarlos al storage.

---

### I3. Foto del participante expuesta públicamente en VerifyResponse

- **Riesgo:** ALTO (privacidad)
- **Impacto:** La respuesta pública del endpoint de verificación incluye `photo_url` — la foto del participante es accesible por cualquier persona que escanee el QR, sin ningún consentimiento explícito documentado en el sistema ni control de acceso.
- **Evidencia:**
  - `src/types/api.ts` líneas 90–98: `VerifyResponse { status, folio, student_name?, program?, issued_date?, institution, photo_url? }` — `photo_url` es parte del contrato público
  - La página `/v/[token]` es pública y sin autenticación — accesible por cualquier persona que escanee un QR
  - `src/types/index.ts` línea 78: `email?: string` existe en el modelo `Certificate` — el Backend debe asegurarse de que nunca se filtre en la respuesta pública
- **Recomendación:**
  1. Evaluar con Seneto si la foto es necesaria en la página pública — para verificación de autenticidad, nombre + folio + programa + estado puede ser suficiente
  2. Si se mantiene la foto pública: servirla desde un endpoint que requiera el mismo token de verificación (ej. `/api/public/photos/[verification_token]`), no desde una URL directa al storage
  3. Documentar explícitamente qué datos se muestran en la página pública y en qué términos se comunica esto a los participantes
  4. El email del participante no debe aparecer nunca en `VerifyResponse` — `src/types/api.ts` ya lo excluye correctamente; el Backend debe respetar esto estrictamente

---

### I4. Rol de usuario almacenado como String libre en la base de datos

- **Riesgo:** MEDIO-ALTO
- **Impacto:** El campo `role` en la tabla `users` es un `String` sin restricción de valores. Si un bug escribe un valor inválido (ej. `"superAdmin"` con mayúscula, o `"super_admin"` con guion bajo), la lógica de autorización puede comportarse de forma impredecible.
- **Evidencia:**
  - `prisma/schema.prisma` línea 16: `role String @default("admin")` — tipo libre, sin constraint de valores válidos en la BD
  - `src/types/index.ts` línea 3: `export type UserRole = 'superadmin' | 'admin'` — el enum TypeScript existe a nivel de aplicación pero no se refleja en la base de datos
  - `src/lib/auth.ts` línea 30: `return { id: user.id, email: user.email, role: user.role }` — el rol se toma de la BD sin validación adicional y se incluye en el JWT
- **Recomendación:**
  1. Cambiar a enum de Prisma en `prisma/schema.prisma`:
     ```prisma
     enum UserRole {
       superadmin
       admin
     }
     // En el modelo User:
     role UserRole @default(admin)
     ```
  2. En `src/lib/auth.ts`, validar que `user.role` sea un valor válido antes de incluirlo en el JWT — rechazar login si el valor es inválido
  3. En los route handlers que verifican rol, usar una función helper centralizada en lugar de comparaciones directas de string

---

### I5. JWT sin expiración configurada — ventana de exposición de 30 días

- **Riesgo:** ALTO
- **Impacto:** Con estrategia `jwt` (stateless), no hay forma de invalidar una sesión activa si las credenciales de un admin son comprometidas. NextAuth usa el default de 30 días sin `maxAge` explícito — un token comprometido es válido durante ese período completo.
- **Evidencia:**
  - `src/lib/auth.ts` línea 35: `session: { strategy: 'jwt' }` — sin `maxAge` configurado; NextAuth default = 30 días
  - No hay tabla de `sessions` ni de `revoked_tokens` en `prisma/schema.prisma` — imposible invalidar tokens activos
- **Recomendación:**
  1. Configurar `maxAge` en `src/lib/auth.ts`:
     ```ts
     session: { strategy: 'jwt', maxAge: 8 * 60 * 60 } // 8 horas
     ```
  2. Para invalidación de emergencia: agregar campo `session_version Int @default(0)` al modelo `User`. Incluirlo en el JWT. En cada request verificado, comparar el `session_version` del token contra el de la BD — si difieren, la sesión es inválida. Para revocar todas las sesiones de un usuario, incrementar su `session_version`.

---

### I6. Ausencia de verificación de ownership — IDOR en recursos de generación

- **Riesgo:** ALTO
- **Impacto:** Un admin autenticado podría acceder a generaciones, certificados y archivos ZIP de otros admins. El modelo `Generation` tiene `created_by` pero si los route handlers no verifican ownership, cualquier admin autenticado puede operar sobre recursos de otros.
- **Evidencia:**
  - `prisma/schema.prisma` línea 55: `created_by String` — el campo existe pero no hay lógica de enforcement definida
  - `src/types/api.ts` líneas 70–77: `StatusResponse` y `GenerateResponse` no incluyen información de ownership
  - `docs/USER_FLOWS.md` línea 66: el dashboard muestra "todas sus generaciones" — implica filtrado por `created_by`, pero no está formalizado como requisito de seguridad
- **Recomendación:**
  1. En todos los route handlers que operan sobre `Generation` o `Certificate`, verificar `generation.created_by === session.user.id` antes de retornar datos o ejecutar acciones
  2. Excepción: el rol `superadmin` puede ver y operar sobre todas las generaciones
  3. Implementar como helper reutilizable: `assertOwnership(session, resource)` que lanza `Errors.FORBIDDEN()` si no hay match

---

### I7. `.env` (sin `.local`) no está en `.gitignore` — riesgo de commit accidental de credenciales

- **Riesgo:** ALTO
- **Impacto:** El flujo de setup documentado indica `cp .env.example .env`. El `.env` resultante contendrá `DATABASE_URL` real y `NEXTAUTH_SECRET`. Si se hace commit accidentalmente, las credenciales quedan expuestas en el historial de git.
- **Evidencia:**
  - `.gitignore` solo excluye `.env*.local` — **no excluye `.env` simple**
  - `git status` muestra `?? .env` — el archivo ya existe sin trackear, confirmando que podría commitearse accidentalmente
- **Recomendación:** Agregar la línea `.env` al `.gitignore` hoy mismo, antes de cualquier desarrollo.

---

### I8. Datos sensibles en logs de Prisma si NODE_ENV no está configurado correctamente

- **Riesgo:** MEDIO
- **Impacto:** Con `log: ['query', 'error', 'warn']` en desarrollo, Prisma registra valores de parámetros SQL — incluyendo hashes de contraseñas y datos personales. Si `NODE_ENV` no es `production` en el deploy, los logs exponen datos sensibles.
- **Evidencia:**
  - `src/lib/db.ts`: `log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']` — correcto en concepto, depende de que `NODE_ENV` esté bien configurado en producción
  - `.env.example`: `NODE_ENV="development"` — el valor por defecto del archivo de ejemplo es `development`
- **Recomendación:** En `.env.example`, cambiar `NODE_ENV="development"` a un comentario que indique que en producción debe ser `production`. El comportamiento actual de `db.ts` es correcto — mantenerlo.

---

### I9. CSRF — route handlers POST/PATCH/DELETE sin protección explícita

- **Riesgo:** MEDIO-ALTO
- **Impacto:** Los route handlers de Next.js App Router no incluyen protección CSRF por defecto. NextAuth 4.x protege sus propios endpoints, pero los route handlers custom (revocación, generaciones, uploads, etc.) son vulnerables a requests cross-site si el navegador del admin tiene sesión activa.
- **Evidencia:**
  - `next.config.mjs`: no configura headers de seguridad (`X-Frame-Options`, `Content-Security-Policy`, etc.)
  - `package.json`: no hay librería de protección CSRF instalada
  - Los route handlers de la API no existen aún — el riesgo debe prevenirse en el diseño, no remediarse después
- **Recomendación:**
  1. En todos los route handlers POST/PATCH/DELETE, verificar que el header `Origin` coincide con `process.env.NEXTAUTH_URL`
  2. Agregar headers de seguridad en `next.config.mjs`:
     ```js
     async headers() {
       return [{
         source: '/(.*)',
         headers: [
           { key: 'X-Frame-Options', value: 'DENY' },
           { key: 'X-Content-Type-Options', value: 'nosniff' },
           { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
         ],
       }]
     }
     ```

---

### I10. Validación de folio_override sin verificación de formato ni sanitización de paths

- **Riesgo:** MEDIO
- **Impacto:** El campo `folio_override` del CSV permite especificar cualquier valor de folio. Los folios se usan como nombres de archivos (`generations/{id}/diplomas/{folio}.pdf`). Un folio con caracteres como `/`, `..` o `\0` podría crear paths de archivos inesperados o causar errores en la generación.
- **Evidencia:**
  - `src/types/index.ts` línea 107: `folio_override?: string` — sin validación de formato en el tipo
  - `docs/ARCHITECTURE_HANDOFF.md` sección 6: `generations/{generation_id}/diplomas/{folio}.pdf` — el folio se usa directamente como nombre de archivo
  - `prisma/schema.prisma` línea 66: `folio String @unique` — la unicidad está en la BD, pero la validación de formato debe ser pre-insert
- **Recomendación:**
  1. Validar `folio_override` contra regex estricto en el server-side al procesar el CSV: `/^[A-Z]{2,5}-\d{4}-\d{3,6}$/`
  2. Al usar el folio como nombre de archivo, sanitizarlo: reemplazar cualquier carácter que no sea `A-Z`, `a-z`, `0-9` o `-` por `_`
  3. Esta validación debe ocurrir en el route handler del CSV — nunca confiar en la validación del cliente

---

## 4. Mejoras recomendadas

### Quick wins (bajo esfuerzo, alto impacto)

**QW1. Agregar `.env` al `.gitignore` — hoy mismo**
`.gitignore` actual excluye `.env*.local` pero no `.env`. El archivo `.env` ya existe en el repo sin trackear. Agregar la línea `.env` al `.gitignore`. Tiempo: 1 minuto. Previene commit accidental de credenciales reales.

**QW2. Headers de seguridad en `next.config.mjs`**
Agregar `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` y `Referrer-Policy`. Tiempo: 30 minutos. Previene clickjacking y MIME sniffing sin costo de desarrollo significativo.

**QW3. Duración de sesión JWT**
Agregar `maxAge: 8 * 60 * 60` al objeto `session` en `src/lib/auth.ts`. Tiempo: 5 minutos. Reduce la ventana de exposición de 30 días a 8 horas.

**QW4. Corrección de path traversal en `StorageAdapter.resolve()`**
Agregar la verificación `resolved.startsWith(base)` en `src/lib/storage/adapter.ts`. Tiempo: 15 minutos. Previene lectura de archivos fuera del directorio de storage.

**QW5. Validar rol en callback JWT**
En `src/lib/auth.ts`, validar que `user.role` sea `'admin'` o `'superadmin'` antes de incluirlo en el token. Tiempo: 10 minutos.

**QW6. Cambiar `NODE_ENV` en `.env.example`**
Cambiar `NODE_ENV="development"` a un comentario que indique los valores válidos. Tiempo: 2 minutos.

---

### Cambios necesarios antes del desarrollo activo

**ND1. Separar folio público de token de verificación (resuelve C2)**
Agregar `verification_token String @unique @default(uuid())` al modelo `Certificate` en `prisma/schema.prisma`. Cambiar la URL del QR de `/v/{folio}` a `/v/{verification_token}`. El folio sigue siendo el identificador legible en el diploma impreso y visible en la página de verificación. Esta es la modificación de schema más importante del proyecto antes de cualquier desarrollo.

**ND2. Crear modelo AuditLog (resuelve C5)**
Agregar el modelo `AuditLog` al schema de Prisma antes de que Backend implemente cualquier acción administrativa. Ver especificación completa en hallazgo C5.

**ND3. Rate limiting en login (resuelve C3)**
Implementar en el middleware de Next.js interceptando requests a `/api/auth/callback/credentials`. Para MVP: Map en memoria con TTL. Límite: 5 intentos por IP en 10 minutos.

**ND4. Verificar ownership en route handlers de generaciones/certificados (resuelve I6)**
Implementar `assertOwnership(session, resource)` como helper en `src/lib/api/` y llamarlo en todos los route handlers que operan sobre recursos con `created_by`.

**ND5. Enum de roles en Prisma (resuelve I4)**
Cambiar `role String @default("admin")` a `role UserRole @default(admin)` con enum declarado en `prisma/schema.prisma`.

**ND6. Protección del route handler `/api/files/[...path]` (resuelve C4)**
Cuando Backend implemente este handler: requerir sesión para `generations/` y `templates/`, sanitizar el path contra traversal, y exponer fotos de verificación pública desde un endpoint separado.

---

### Cambios para fase posterior al MVP

**PM1. Firma digital de certificados**
Implementar HMAC-SHA256 sobre los datos del certificado (verification_token + student_name + program + issued_date + folio). Incluir la firma en la página de verificación. Permite verificar la integridad del certificado incluso si la base de datos es comprometida.

**PM2. Migración a almacenamiento en la nube con URLs pre-firmadas (resuelve C4 definitivamente)**
Migrar de `LocalStorage` a `R2Storage` o `S3Storage`. PDFs de diplomas y fotos de participantes nunca deben ser accesibles por URL pública directa — siempre URLs temporales (TTL: 15 minutos) generadas en el servidor bajo demanda.

**PM3. Invalidación de sesión por `session_version` (resuelve I5)**
Agregar `session_version Int @default(0)` al modelo `User`. Incluir en el JWT. Comparar en cada request autenticado. Permite invalidar todas las sesiones de un usuario comprometido en tiempo real sin necesidad de tabla de tokens revocados.

**PM4. Two-factor authentication para superadmin**
Dado que la plataforma tiene acceso a datos personales de cientos de participantes, agregar TOTP (RFC 6238) como segundo factor obligatorio para el rol `superadmin`.

**PM5. Expiración automática de archivos temporales**
Job periódico que elimine ZIPs de generaciones completadas después de 30 días y fotos originales de participantes después de que el diploma esté generado, reduciendo la superficie de exposición de datos personales almacenados.

**PM6. Rate limiting en el endpoint de verificación pública**
Aunque `/v/[token]` es público, limitar a ~60 requests/minuto por IP para prevenir scraping masivo de datos de participantes una vez que los tokens no sean enumerables.

---

## 5. Checklist de seguridad mínima

Lo que debe estar resuelto **antes de pasar a desarrollo activo**:

### Infraestructura crítica (bloqueante — sin esto no se puede desarrollar con seguridad)
- [ ] **C1** — Crear `src/middleware.ts` con `matcher: ['/admin/:path*']`
- [ ] **C1** — Crear `src/app/api/auth/[...nextauth]/route.ts`
- [ ] **C2** — Agregar campo `verification_token String @unique @default(uuid())` al modelo `Certificate`
- [ ] **C2** — Cambiar la URL del QR de `/v/{folio}` a `/v/{verification_token}` en la lógica de generación
- [ ] **C3** — Implementar rate limiting en el endpoint de login (5 intentos / 10 min / IP)
- [ ] **C4** — Implementar `/api/files/[...path]` con verificación de sesión para rutas privadas
- [ ] **C5** — Agregar modelo `AuditLog` al schema de Prisma

### Seguridad de código (antes del primer deploy)
- [ ] **QW1** — Agregar `.env` (sin wildcard) al `.gitignore` — hacer hoy
- [ ] **QW3** — Agregar `maxAge: 8 * 60 * 60` a la sesión JWT en `src/lib/auth.ts`
- [ ] **QW4** — Corrección de path traversal en `StorageAdapter.resolve()` en `src/lib/storage/adapter.ts`
- [ ] **QW2** — Headers de seguridad (`X-Frame-Options`, `X-Content-Type-Options`) en `next.config.mjs`
- [ ] **ND4** — Helper `assertOwnership()` y uso en todos los route handlers de generaciones/certificados
- [ ] **ND5** — Cambiar `role String` a `enum UserRole` en `prisma/schema.prisma`

### Validación de datos (antes del primer deploy)
- [ ] **I1** — Validación de magic bytes en uploads (PNG, JPEG, ZIP) en los route handlers
- [ ] **I10** — Validación de `folio_override` contra regex en el server-side (route handler del CSV)
- [ ] **I9** — Verificación del header `Origin` en todos los route handlers POST/PATCH/DELETE

### Privacidad (antes del primer deploy)
- [ ] **I3** — Decisión documentada y aprobada por Seneto: qué datos personales se exponen en `/v/[token]`
- [ ] **I3** — Confirmar que el email nunca aparece en respuestas públicas (ya correcto en `VerifyResponse`, mantener)
- [ ] **I7/I8** — `.env` en `.gitignore` y `NODE_ENV` corregido en `.env.example`

---

*Auditoría basada en la revisión directa de: `prisma/schema.prisma`, `src/lib/auth.ts`, `src/lib/db.ts`, `src/lib/storage/adapter.ts`, `src/lib/api/errors.ts`, `src/types/index.ts`, `src/types/api.ts`, `next.config.mjs`, `package.json`, `.env.example`, `.gitignore`, `docs/ARCHITECTURE_HANDOFF.md`, `docs/USER_FLOWS.md`. Los route handlers de API y el middleware no existen aún — los riesgos correspondientes se auditaron contra el diseño propuesto en los documentos y los tipos definidos.*
