# Reporte QA Backend — 2026-06-13

## Resumen

| Severidad | Cantidad |
|-----------|----------|
| CRÍTICO   | 3        |
| ALTO      | 4        |
| MEDIO     | 5        |
| BAJO      | 4        |
| OK        | 16       |

---

## Hallazgos

### [CRÍTICO] — Endpoint admin/revoke-by-names sin validación de rol, sin validateOrigin y sin assertOwnership

**Archivo:** `src/app/api/admin/revoke-by-names/route.ts:7-56`

**Descripción:** Este POST solo verifica que el usuario esté autenticado (`getServerSession`), pero NO verifica que sea `superadmin`, no llama a `validateOrigin()`, y no usa `assertOwnership()`. Cualquier usuario `admin` puede: (1) revocar o eliminar permanentemente certificados de cualquier generación, incluyendo las de otros administradores; (2) hacerlo desde cualquier origen externo (CSRF posible). La acción `delete` es irreversible — borra registros de la BD permanentemente. Aunque el archivo tiene el comentario `// TEMPORAL`, está en producción y protegido únicamente por autenticación básica.

**Recomendación:** Agregar inmediatamente:
1. `if (!validateOrigin(req)) return 403`
2. Verificar `session.user.role === 'superadmin'` antes de proceder, devolver 403 si no
3. Loguear la acción con `logAction()` (borrado de certificados es crítico)
4. O eliminar el endpoint si ya cumplió su propósito temporal.

---

### [CRÍTICO] — Endpoint reset sin validateOrigin, sin try/catch, y con `as any` innecesario

**Archivo:** `src/app/api/generations/[id]/reset/route.ts:7-49`

**Descripción:** El POST `/api/generations/[id]/reset` tiene tres problemas críticos:
1. **No llama `validateOrigin()`** — CSRF posible desde cualquier origen.
2. **No tiene try/catch ni usa `handleApiError()`** — cualquier excepción de Prisma o de red produce un 500 no manejado que puede exponer stack traces al cliente según el hosting.
3. **Usa `as any`** en línea 22 (`(session.user as any).id`, `(session.user as any).role`) cuando `src/types/next-auth.d.ts` ya extiende el tipo de sesión con `id` y `role` — esto además bypasea la augmentación de tipo.
4. **No tiene `logAction()`** — resetear una generación (que pone a `status: 'ready'` y borra paths) es una acción crítica que debe auditarse.

**Recomendación:** Aplicar los mismos patrones del resto de routes: `validateOrigin`, try/catch con `handleApiError`, eliminar los `as any`, agregar `logAction`. O eliminar el endpoint si ya cumplió su propósito temporal.

---

### [CRÍTICO] — DELETE en `/api/generations/[id]` no llama `validateOrigin()`

**Archivo:** `src/app/api/generations/[id]/route.ts:96-134`

**Descripción:** El handler `DELETE` tiene sesión y `assertOwnership`, pero NO llama `validateOrigin()`. Un atacante puede emitir un DELETE cross-origin desde cualquier sitio web si la víctima tiene una sesión activa (CSRF). El DELETE desencadena una transacción que elimina la generación, todos sus certificados y todos sus errores — destrucción de datos irreversible.

**Recomendación:** Agregar la validación de origen inmediatamente después de la comprobación de sesión, siguiendo el mismo patrón del `PATCH` en el mismo archivo (líneas 149-154).

---

### [ALTO] — Tipos `CertificateStatus` y `GenerationStatus` definidos como string literal en TypeScript pero como `String` en Prisma schema

**Archivo:** `prisma/schema.prisma:51` y `prisma/schema.prisma:85`

**Descripción:** Los campos `Generation.status` y `Certificate.status` están tipados como `String` sin enum en Prisma, mientras que `src/types/index.ts:1-2` define `CertificateStatus` y `GenerationStatus` como union types. Prisma no enforcea en BD que solo valores del enum sean válidos — un bug en el engine o una query raw podría escribir valores arbitrarios como `'error'` en la BD sin que TypeScript lo detecte en tiempo de compilación. El engine en `src/lib/diploma/engine.ts:63` usa strings literales `'completed'`, `'failed'`, `'processing'` directamente sin los tipos compartidos.

**Recomendación:** Declarar enums en el schema de Prisma (`enum CertificateStatus` y `enum GenerationStatus`) y referenciarlos desde los modelos. Esto garantiza integridad a nivel de BD y genera tipos precisos desde Prisma Client.

---

### [ALTO] — `as any` en `src/lib/auth.ts` con augmentación de tipos ya existente

**Archivo:** `src/lib/auth.ts:69,75,76`

**Descripción:** `token.role = (user as any).role` (línea 69) y `(session.user as any).id` / `(session.user as any).role` (líneas 75-76) usan `as any` para acceder a propiedades que ya están declaradas en `src/types/next-auth.d.ts`. El archivo declara `Session.user.{ id, role }` y `JWT.role`. El uso de `as any` es evidencia de que la augmentación no está siendo recogida correctamente por el compilador, o que se agregó la augmentación después sin actualizar el código. En producción este patrón oculta potenciales `undefined` en `session.user.id` si el JWT expire o sea manipulado.

**Recomendación:** Verificar que `src/types/next-auth.d.ts` es recogido por el compilador (`tsconfig.json` incluye `src/types`). Si lo es, reemplazar los `as any` con acceso tipado directo. Si `user` en el callback `jwt` no tiene `role`, usar un type guard explícito.

---

### [ALTO] — `as any` en `reset/route.ts:22` bypasea la type extension ya definida

**Archivo:** `src/app/api/generations/[id]/reset/route.ts:22`

**Descripción:** `(session.user as any).id` y `(session.user as any).role` cuando `src/types/next-auth.d.ts` ya augmenta `Session.user` con `id: string` y `role: string`. Los `as any` no solo son innecesarios — también indican que este archivo fue escrito sin la augmentación en scope o sin referencias al tipo extendido, creando una divergencia. Si `id` o `role` fuera `undefined`, el check de línea 22 pasaría silenciosamente (string !== undefined es siempre true).

**Recomendación:** Eliminar los `as any` y usar `session.user.id` / `session.user.role` directamente. Dado que este archivo es temporal, eliminar el endpoint es la solución preferida.

---

### [ALTO] — `src/lib/diploma/engine.ts` usa `include:` en lugar de `select:` exponiendo todos los campos del template y certificados en memoria

**Archivo:** `src/lib/diploma/engine.ts:38-44`

**Descripción:** La query principal del engine usa `include: { template: true, certificates: { where: { status: 'pending' } } }` en lugar de `select:` con campos explícitos. Esto carga en memoria campos internos como `template.file_path`, `certificate.diploma_pdf_path`, `certificate.diploma_png_path`, `certificate.photo_path`, `certificate.email`, y todos los campos del modelo. Aunque el engine es un proceso interno (no expone estos datos a clientes), la práctica: (1) carga datos innecesarios en memoria en lotes grandes; (2) contradice el principio de least-privilege en queries; (3) si el engine fuera refactorizado para devolver datos al cliente en el futuro, sería trivial exponer campos sensibles sin notarlo. Adicionalmente, los parámetros de la función interna `mapPrismaZonesToComposer` y `sanitizeError` usan `any` explícito.

**Recomendación:** Reemplazar `include:` con `select:` enumerando solo los campos necesarios. Tipar los parámetros `mapPrismaZonesToComposer(prismaZones: unknown)` y `sanitizeError(err: unknown)`.

---

### [MEDIO] — N+1 queries en el engine: 3 queries por certificado en el bucle principal

**Archivo:** `src/lib/diploma/engine.ts:86-162`

**Descripción:** Para cada certificado en el array `generation.certificates`, el engine realiza en el happy path: (1) `prisma.certificate.update` (línea 126), (2) `prisma.generation.update({ processed_count: { increment: 1 } })` (línea 136). En el error path: (1) `prisma.certificate.update`, (2) `prisma.generationError.create`, (3) `prisma.generation.update`. Un lote de 100 certificados genera entre 200 y 300 queries individuales. El contador `processed_count` se incrementa uno a uno, lo que es particularmente ineficiente.

**Recomendación:** Acumular los updates de certificados en un array y usar `prisma.$transaction([...])` al final del batch (o en sub-lotes de 50). El contador `processed_count` se puede calcular con un único `prisma.certificate.count({ where: { status: 'active', generation_id } })` al finalizar en lugar de incrementar por cada uno.

---

### [MEDIO] — Paths de storage no siguen la convención documentada

**Archivos:**
- `src/app/api/generations/[id]/template/route.ts:72` — usa `templates/{generationId}/template.png` en lugar de `templates/{id}/base.png`
- `src/app/api/generations/[id]/photos/route.ts:342` — usa `photos/{generationId}/photos.zip` en lugar de `generations/{generationId}/photos/{filename}`
- `src/app/api/generations/[id]/photos/route.ts:345` — usa `photos/{generationId}/{normalizedName}{ext}` en lugar de `generations/{generationId}/photos/{filename}`
- `src/lib/diploma/engine.ts:117-118` — usa `diplomas/{generationId}/{folio}.png` y `diplomas/{generationId}/{folio}.pdf` (correcto)
- `src/lib/diploma/engine.ts:188` — usa `zips/{generationId}/diplomas.zip` (correcto)

**Descripción:** La convención documentada en el checklist indica `templates/{id}/base.png` y `generations/{generationId}/photos/{filename}`. El código usa nombres distintos (`template.png`, prefijo `photos/` en lugar de `generations/`). La inconsistencia no es explotable actualmente porque el `files/[...path]` handler y `assertOwnership` usan el segundo segmento como `generationId`, pero los paths bajo el prefijo `photos/` no están en `PREFIXES_WITH_OWNERSHIP` y por tanto no son controlados por ownership — ver siguiente hallazgo.

**Recomendación:** Alinear los paths con la convención oficial o actualizar la convención para reflejar la implementación real.

---

### [MEDIO] — El handler `/api/files/[...path]` no protege paths bajo el prefijo `photos/`

**Archivo:** `src/app/api/files/[...path]/route.ts:48`

**Descripción:** `PREFIXES_WITH_OWNERSHIP = ['templates', 'photos', 'diplomas', 'zips', 'generations']` incluye `photos`, pero el código guarda las fotos bajo `photos/{generationId}/...` y el ZIP de fotos bajo `photos/{generationId}/photos.zip`. El handler extrae `[prefix, generationId] = params.path` (línea 47), lo que con un path como `photos/cmp123abc/juan.jpg` daría `prefix='photos'` y `generationId='cmp123abc'`, lo cual SÍ es controlado por ownership. Sin embargo, el handler del /files no está en la lista de prefijos que devuelven la URL pública — lo relevante es que la lógica de ownership en `/files` funciona correctamente para paths de fotos porque el segundo segmento es siempre el generationId. Este hallazgo es de atención media: la convención diverge del spec, pero el control de acceso es efectivo en la práctica.

**Recomendación:** Confirmar que todos los paths de storage siguen el patrón `{prefix}/{generationId}/...` para garantizar que el ownership check en `/api/files` siempre use el generationId correcto en la posición 2 del path.

---

### [MEDIO] — `src/lib/diploma/composer.ts` usa `readFileSync` de `fs` directamente

**Archivo:** `src/lib/diploma/composer.ts:2,56-59`

**Descripción:** `import { readFileSync } from 'fs'` en el composer lee el archivo de fuente EB Garamond directamente del filesystem usando `readFileSync(join(process.cwd(), 'src/lib/fonts/...'))`. La regla del checklist indica que ningún código fuera de `src/lib/storage/adapter.ts` debe usar `fs` directamente. Aunque en este caso el archivo es un asset del bundle (no un archivo de usuario), la regla es violada. Si el path se configura externamente o si el proyecto migra a un runtime sin acceso al FS (Edge Runtime, serverless containers), esto fallará silenciosamente.

**Recomendación:** Mover la carga del font a `src/lib/storage/adapter.ts` como un método `getAsset(path)` que opere sobre el directorio del bundle, o usar `import` estático del font (Next.js soporta asset imports). Alternativamente, documentar explícitamente que `composer.ts` es una excepción permitida para assets del bundle.

---

### [MEDIO] — `src/lib/api/origin.ts` rechaza requests sin header `Origin` (bloquea clientes server-side legítimos)

**Archivo:** `src/lib/api/origin.ts:4-5`

**Descripción:** `validateOrigin` devuelve `false` cuando el header `Origin` no está presente (`if (!origin) return false`). Los browsers siempre envían `Origin` en POST/PATCH/DELETE. Sin embargo, peticiones server-to-server (e.g., desde scripts de admin, cron jobs, o el propio Next.js calling su API internamente) no incluyen `Origin`. Esto significa que cualquier cliente legítimo que no sea un browser quedará bloqueado con 403. El rate-limit (`src/lib/api/rate-limit.ts`) usa en-memoria por IP, y los llamados internos pueden compartir IP. Adicionalmente, en entornos de desarrollo el `NEXTAUTH_URL` puede ser `http://localhost:3000`, lo que hace la verificación trivial de pasar con cualquier herramienta que setee el header.

**Recomendación:** Revisar si hay clientes no-browser que necesiten llamar estos endpoints. Si los hay, implementar autenticación por API key para server-to-server calls en lugar de depender de `Origin`. Si no los hay, documentar esta decisión explícitamente.

---

### [BAJO] — `revoke-by-names` y `reset` marcados como TEMPORAL pero sin fecha límite ni ticket de eliminación

**Archivos:**
- `src/app/api/admin/revoke-by-names/route.ts:1`
- `src/app/api/generations/[id]/reset/route.ts:1`

**Descripción:** Ambos tienen el comentario `// TEMPORAL — eliminar después de...`. Los endpoints temporales con brechas de seguridad (CSRF, sin validación de rol) acumulan deuda de seguridad indefinidamente si no hay un mecanismo de seguimiento. Dado que están en el repositorio sin un issue asignado ni una fecha de expiración, pueden sobrevivir indefinidamente.

**Recomendación:** Crear un issue de seguimiento en el tracker del proyecto. Considerar agregar un check de fecha de expiración (`if (process.env.NODE_ENV === 'production') return 404`) hasta que sean eliminados, o establecer un feature flag.

---

### [BAJO] — `handleApiError` en `errors.ts` usa `console.error` sin sanitizar

**Archivo:** `src/lib/api/errors.ts:30`

**Descripción:** `console.error('[API Error]', error)` puede loguear objetos de error completos que incluyan stack traces con paths del filesystem del servidor, variables de entorno interpoladas, o datos de usuarios si el error contiene un objeto de request. Aunque no se expone al cliente, el log puede contener PII en entornos donde los logs son visibles por múltiples personas.

**Recomendación:** Sanitizar el error antes de loguearlo, o al menos loguear solo `error.message` y el stack, omitiendo propiedades que puedan contener datos de request.

---

### [BAJO] — `src/app/api/generations/[id]/download/route.ts` no tiene `logAction` para descarga fallida

**Archivo:** `src/app/api/generations/[id]/download/route.ts:51-53`

**Descripción:** El éxito de la descarga se audita en `logAction` (línea 66), pero si `storage.get` falla (línea 50-53), la excepción lanza `Errors.NOT_FOUND('Archivo ZIP')` que es capturada por el catch final sin auditar. Un operador investigando una descarga fallida no tendrá evidencia en el audit log.

**Recomendación:** Agregar un `logAction` con `action: 'generation.zip_download_failed'` en el bloque catch del `storage.get`.

---

### [BAJO] — El `mapPrismaZonesToComposer` en engine usa `any` y no valida la forma del JSON antes de pasarlo al compositor

**Archivo:** `src/lib/diploma/engine.ts:8-21`

**Descripción:** `function mapPrismaZonesToComposer(prismaZones: any)` acepta cualquier valor sin validación. El campo `template.field_zones` es `Json?` en Prisma — puede ser `null`, un array, un string, o cualquier objeto. Si `field_zones` tiene una forma inesperada (e.g., un objeto sin la clave `name`, o con valores no numéricos en `x/y`), el compositor no lanzará error hasta el momento de renderizar con sharp, produciendo un diploma malformado que se guarda como `active` sin indicar el error específico.

**Recomendación:** Agregar validación de la forma de `field_zones` en `mapPrismaZonesToComposer` antes de pasarlo al compositor. Alternativamente, reutilizar `validateFieldZones` de `generations/[id]/route.ts` como función compartida en un módulo de validación.

---

## Verificaciones OK

### [OK] — Autenticación en todos los route handlers del scope (excepto `/verify`)

Todos los handlers en `src/app/api/` (excepto `/api/verify/[token]` y `/api/auth/`) llaman `getServerSession(authOptions)` como primera acción dentro del try/catch y devuelven 401 si la sesión es nula.

### [OK] — `assertOwnership` presente en todos los handlers con `generationId`

Los handlers `GET/PATCH` en `generations/[id]/route.ts`, y los handlers `POST/GET` en `csv`, `download`, `errors/csv`, `photos`, `preflight`, `start`, `status`, `students`, `template` llaman correctamente `assertOwnership(session, params.id)` después de verificar la sesión.

### [OK] — `/api/verify/[token]` no expone email, teléfono ni paths internos

`src/app/api/verify/[token]/route.ts` usa `PUBLIC_CERT_SELECT = { status, folio, student_name, program, issued_date }`. No incluye email, verification_token, generation_id, ni campos `*_path`. El UUID del token es validado contra un regex antes de consultar la BD.

### [OK] — `photo_path`, `diploma_pdf_path`, `diploma_png_path` nunca en respuestas JSON de clientes

- `GET /api/generations/[id]/students` (línea 49): desestructura `photo_path` fuera del objeto y expone `has_photo: !!photo_path`.
- `GET /api/certificates` (línea 87): mismo patrón.
- `GET /api/certificates/[folio]` (línea 53): mismo patrón.
- Los selects compartidos en `SAFE_GENERATION_SELECT` y `SAFE_GENERATION_DETAIL_SELECT` no incluyen `csv_path`, `zip_path`, `photos_zip_path`.
- `SAFE_TEMPLATE_SELECT` no incluye `file_path`.

### [OK] — `validateOrigin` en todos los POST/PATCH/DELETE handlers (con excepciones documentadas)

`validateOrigin` está presente en: `POST /api/generations`, `PATCH /api/generations/[id]`, `POST /api/generations/[id]/csv`, `POST /api/generations/[id]/photos`, `POST /api/generations/[id]/preflight`, `POST /api/generations/[id]/start`, `POST /api/generations/[id]/template`, `PATCH /api/certificates/[folio]`. Excepciones documentadas en hallazgos: DELETE en `generations/[id]` y POST en `reset` y `revoke-by-names`.

### [OK] — `new PrismaClient()` solo en `src/lib/db.ts`

La única instancia de `new PrismaClient(...)` está en `src/lib/db.ts:18`. Todos los demás archivos importan `{ prisma }` de `@/lib/db`.

### [OK] — `SAFE_*_SELECT` cubre los casos de respuesta pública correctamente

`src/lib/api/selects.ts` define selectores exhaustivos sin paths internos. Su uso es consistente en los handlers que retornan datos de generación y template a clientes.

### [OK] — `CertificateStatus` no incluye `'error'`

`src/types/index.ts:1`: `type CertificateStatus = 'pending' | 'active' | 'revoked' | 'expired'`. El valor `'error'` no está en la unión.

### [OK] — `GenerationStatus` tiene los valores correctos

`src/types/index.ts:2`: `type GenerationStatus = 'draft' | 'ready' | 'processing' | 'completed' | 'failed'`. Valores correctos.

### [OK] — `handleApiError` en todos los route handlers principales

Todos los handlers correctamente formados tienen try/catch que llama a `handleApiError(error)`. Los mensajes de error al cliente son genéricos (`'Error interno del servidor'`) para errores no-ApiError. Stack traces no se exponen al cliente.

### [OK] — `sanitizeError` aplicada en el engine antes de guardar en BD

`src/lib/diploma/engine.ts:23-28`: `sanitizeError` limpia paths absolutos con regex antes de guardar en `Certificate.error_message` y `GenerationError.error_detail`.

### [OK] — `sanitizeTextField` en el CSV parser previene CSV injection

`src/lib/csv/parser.ts:7-9`: strip de `=`, `+`, `-`, `@` al inicio. Aplicado a `student_name` (línea 169) y `program` (línea 165).

### [OK] — Magic bytes validados en todos los uploads

- Template: `validateMagicBytes(buffer, ['png'])` — `template/route.ts:57`.
- CSV: `validateMagicBytes(buffer, ['png', 'jpg', 'zip'])` con detección invertida (si detecta binario, rechaza) — `csv/route.ts:67-70`.
- ZIP de fotos: `validateMagicBytes(zipBuffer, ['zip'])` — `photos/route.ts:153-155`. Magic bytes por archivo extraído: `validateMagicBytes(data, ALLOWED_MAGIC_TYPES)` — línea 303.

### [OK] — Protección anti-zip-bomb en el upload de fotos

`photos/route.ts` implementa: límite de entradas (`MAX_ENTRIES = 500`), límite por entrada por header (`MAX_ENTRY_UNCOMPRESSED_BYTES = 10MB`), ratio de compresión máximo por header y por bytes reales (`MAX_COMPRESSION_RATIO = 50`), límite total descomprimido (`MAX_TOTAL_UNCOMPRESSED_BYTES = 200MB`), streaming con abort mid-stream en `streamEntry`.

### [OK] — Storage adapter encapsula `fs` correctamente

`src/lib/storage/adapter.ts` es el único archivo que usa `fs/promises` en el ámbito de storage. Tiene protección anti-path-traversal en el método `resolve()`. Excepción: `composer.ts` usa `readFileSync` para el font (documentado en hallazgo MEDIO).

### [OK] — `prisma.$transaction()` en operaciones atómicas

Usado correctamente en: creación de template+generación (`generations/route.ts:61`), reemplazo de certificados al subir CSV (`csv/route.ts:129`), actualización de fotos (`photos/route.ts:350`), eliminación de generación (`generations/[id]/route.ts:124`), lista+count de certificates (`certificates/route.ts:75`).

### [OK] — `logAction` en acciones críticas principales

Llamado en: login (`auth.ts:58`), login fallido (`auth.ts:47`), rate limit (`auth.ts:26`), `generation.started` (`start/route.ts:86`), `generation.preflight_passed` (`preflight/route.ts:152`), `generation.zip_download` (`download/route.ts:66`).

---

## Notas adicionales

1. **Endpoints temporales**: Los dos endpoints marcados `// TEMPORAL` (`reset` y `revoke-by-names`) representan el mayor riesgo acumulado. Su superficie de ataque es mayor que la de cualquier endpoint definitivo porque carecen de varias capas de seguridad. Deben eliminarse o asegurarse en el próximo sprint.

2. **Schema de Prisma sin enums**: La ausencia de enums en Prisma para `status` en `Generation` y `Certificate` es una deuda técnica moderada. No existe validación a nivel de BD que impida escribir valores arbitrarios, lo que puede causar comportamientos indefinidos en el UI si ocurre un bug en la lógica de transición de estados.

3. **Rate limiting en memoria**: `src/lib/api/rate-limit.ts:10` usa un `Map` en memoria. En reinicios del servidor (deploys, crashes) el contador se resetea. Para entornos con múltiples instancias (horizontal scaling), el rate limit no es efectivo. Aceptable para MVP según el comentario del código, pero debe documentarse como limitación conocida.
