# Reporte QA Arquitectura — 2026-06-13

> Auditor: Claude (Sonnet 4.6) — modo lectura pura, sin modificación de código.
> Alcance: codebase completo al 2026-06-13. Referencia principal: `ARCHITECTURE_HANDOFF.md`.

---

## Resumen

| Severidad | Cantidad |
|-----------|----------|
| CRÍTICO   | 2        |
| ALTO      | 4        |
| MEDIO     | 4        |
| BAJO      | 3        |
| OK        | 15       |

---

## Hallazgos

---

### [CRÍTICO] — Sin índices de BD en tabla `certificates`

**Archivos afectados:** `prisma/schema.prisma`

**Descripción:** La tabla `certificates` no tiene ningún `@@index` declarado. Las columnas de alta frecuencia de consulta (`generation_id`, `status`, `verification_token`, `folio`) solo tienen constraint `@unique` donde aplica, pero sin índice compuesto ni índice sobre `status`.

Con 500 diplomas por generación y 10 generaciones (5 000 certificados), las queries actuales ya son lentas. Con 10× el volumen (50 000+ certificados):

- `GET /api/generations/[id]/status` hace `certificate.findMany({ where: { generation_id: ..., status: 'active' } })` — sin índice sobre `(generation_id, status)`, full-scan de tabla.
- El engine en `runGenerationEngine()` carga `where: { status: 'pending' }` de todos los certificados de una generación al arrancar — sin índice, scan completo.
- `GET /api/certificates` filtra por `status`, `generation_id` y hace un `OR` sobre `folio`/`student_name` — sin índices, P50 de latencia sube de forma lineal.
- `certificate.findFirst({ where: { folio: { startsWith: ... }, NOT: { generation_id: ... } } })` en el route de CSV — potencialmente el query más caro de todo el sistema: full-scan de `certificates` buscando prefijo de folio entre generaciones.

El `@unique` en `folio` y `verification_token` crea índices únicos implícitos, pero eso no cubre búsquedas `startsWith`, búsquedas por status, ni los filtros combinados.

**Recomendación:** Agregar al modelo `Certificate` en `schema.prisma`:

```prisma
@@index([generation_id])
@@index([generation_id, status])
@@index([status])
@@index([folio(ops: raw("text_pattern_ops"))])   // para startsWith en Postgres
```

Y ejecutar `npx prisma migrate dev --name add_certificate_indexes`.

---

### [CRÍTICO] — Endpoints temporales en producción sin ownership completo

**Archivos afectados:**
- `src/app/api/generations/[id]/reset/route.ts` (línea 1: `// TEMPORAL`)
- `src/app/api/admin/revoke-by-names/route.ts` (línea 1: `// TEMPORAL`)

**Descripción:** Ambos archivos tienen el comentario `// TEMPORAL — eliminar después de...` pero están activos en producción. Los problemas concretos son:

1. **`/api/generations/[id]/reset`**: No usa `handleApiError` ni `Errors.*`. Las respuestas de error son strings planos (`{ error: 'No autorizado' }`) en lugar del shape estándar `{ error: { code, message } }`. El body del catch está ausente — cualquier error en la transacción de Prisma retorna un 500 sin procesar. El ownership se comprueba manualmente replicando la lógica de `assertOwnership` (riesgo de divergencia futura).

2. **`/api/admin/revoke-by-names`**: Acepta `action: 'delete'` que elimina físicamente certificados con datos de audit ilegibles — sin `logAction`, sin `validateOrigin`, sin `assertOwnership` sobre cada generación referenciada. Cualquier admin autenticado puede borrar certificados de generaciones ajenas si conoce los `generationIds`. El parámetro `action` permite una operación destructiva no documentada ni auditada.

Con 10 generaciones simultáneas y múltiples admins, el segundo endpoint es un vector de pérdida de datos.

**Recomendación:** Eliminar ambos archivos o refactorizarlos completamente para usar `assertOwnership`, `handleApiError`, `validateOrigin` y `logAction`. Si son endpoints de mantenimiento solo para `superadmin`, agregar `if (session.user.role !== 'superadmin') throw Errors.FORBIDDEN()` al inicio.

---

### [ALTO] — `readFileSync` bloqueante en hot path de generación

**Archivos afectados:** `src/lib/diploma/composer.ts` (líneas 2, 57)

**Descripción:** El compositor usa `readFileSync` de Node.js en el módulo `composer.ts`:

```ts
import { readFileSync } from 'fs'
// ...
_ebGaramondBase64 = readFileSync(fontPath).toString('base64')
```

La función `getEbGaramondBase64()` se llama dentro de `buildNameSvg()`, que a su vez es llamada dentro de `composeDiplomaPng()` — es decir, dentro del `for...of` del engine, en el hot path de procesamiento por diploma.

Aunque el resultado está cacheado en `_ebGaramondBase64` y solo se lee una vez por proceso, `readFileSync` bloquea el event loop de Node.js completamente durante la lectura (la fuente `.woff` puede tener cientos de KB). Si el proceso levanta con el cache frío y se llaman múltiples generaciones concurrentes, la primera llamada bloquea el event loop para todos los requests activos.

El problema es mayor porque este módulo no importa `next/` (correcto), pero sí usa una API síncrona de I/O en un entorno donde Next.js espera operaciones asíncronas.

**Recomendación:** Reemplazar por una inicialización asíncrona en un `init()` que se llame una vez al arrancar el engine, o usar `fs.promises.readFile` con un mutex simple:

```ts
let _fontPromise: Promise<string> | null = null
async function getEbGaramondBase64(): Promise<string> {
  if (!_fontPromise) {
    _fontPromise = fs.promises.readFile(fontPath).then(b => b.toString('base64'))
  }
  return _fontPromise
}
```

---

### [ALTO] — ZIP se acumula completo en RAM antes de escribirse a storage

**Archivos afectados:** `src/lib/diploma/zipper.ts` (líneas 129–134), `src/lib/diploma/engine.ts` (línea 182)

**Descripción:** `buildDiplomasZipLazy()` lee los PDFs uno a uno (correcto, O(1) en lectura), pero acumula los chunks del archiver en un array en memoria antes de retornar el `Buffer`:

```ts
const chunks: Buffer[] = []
archive.on('data', (chunk: Buffer) => chunks.push(chunk))
archive.on('end', () => resolve(Buffer.concat(chunks)))
```

Esto significa que el ZIP completo vive en RAM hasta que `storage.put()` lo escribe. Con 500 diplomas de 500 KB cada uno, el ZIP puede ser ~200–250 MB en RAM en el proceso de Next.js, adicional al buffer del PDF del diploma que se está procesando actualmente.

Si hay 3 generaciones en `processing` al mismo tiempo, el pico de RAM puede superar 750 MB solo por ZIPs, más el overhead del proceso.

El nombre `buildDiplomasZipLazy` sugiere que es lazy, pero solo lo es en la lectura — el output sigue siendo eager.

**Recomendación:** Usar un stream pipeline hacia storage directamente. Si `StorageAdapter` no soporta streams (actualmente solo acepta `Buffer`), añadir un método `putStream(path, readable): Promise<void>` a la interfaz. Para LocalStorage sería `pipeline(readable, fs.createWriteStream(full))`. Para R2/S3 en el futuro, multipart upload. Esto elimina el pico de RAM del ZIP.

---

### [ALTO] — Inconsistencia crítica de paths entre documentación y código

**Archivos afectados:** `docs/ARCHITECTURE_HANDOFF.md` (sección 6), `src/lib/diploma/engine.ts` (líneas 117–118), `src/app/api/generations/[id]/photos/route.ts` (línea 342)

**Descripción:** La sección 6 de `ARCHITECTURE_HANDOFF.md` documenta esta convención de paths:

```
generations/{generation_id}/photos/{filename}
generations/{generation_id}/diplomas/{folio}.pdf
generations/{generation_id}/diplomas_png/{folio}.png
generations/{generation_id}/output/{nombre-generación}.zip
```

El código real usa una convención completamente diferente:

| Destino | Documentado | Real (código) |
|---------|------------|---------------|
| PDFs de diploma | `generations/{id}/diplomas/{folio}.pdf` | `diplomas/{generationId}/{folio}.pdf` |
| PNGs de diploma | `generations/{id}/diplomas_png/{folio}.png` | `diplomas/{generationId}/{folio}.png` |
| ZIP output | `generations/{id}/output/{name}.zip` | `zips/{generationId}/diplomas.zip` |
| Fotos | `generations/{id}/photos/{filename}` | `photos/{id}/{normalizedKey}{ext}` |
| Template | `templates/{template_id}/base.png` | `templates/{generation_id}/template.png` |

Son 5 de 5 paths documentados que no coinciden con el código. Cualquier desarrollador nuevo que lea `ARCHITECTURE_HANDOFF.md` y use esas rutas va a generar paths incorrectos, datos huérfanos en storage, y bugs silenciosos (los archivos existen en storage pero con paths distintos a los que la BD referencia).

El ownership check en `/api/files/[...path]` extrae `generationId` de `params.path[1]` asumiendo que el segundo segmento es el ID de generación, pero el path real de fotos es `photos/{generationId}/...` (correcto) mientras que diplomas es `diplomas/{generationId}/...` (también correcto para ese check). Sin embargo, la documentación del equipo está desincronizada.

**Recomendación:** Actualizar `ARCHITECTURE_HANDOFF.md` sección 6 para reflejar los paths reales. Considerar crear un módulo `src/lib/storage/paths.ts` con funciones tipadas como `diplomaPdfPath(generationId, folio): string` para que los paths sean un contrato de código en lugar de strings hardcodeados dispersos.

---

### [ALTO] — Páginas admin con queries a BD sin `force-dynamic`

**Archivos afectados:**
- `src/app/admin/(protected)/generations/page.tsx`
- `src/app/admin/(protected)/generations/[id]/page.tsx`
- `src/app/admin/(protected)/certificates/page.tsx`
- `src/app/admin/(protected)/certificates/[folio]/page.tsx`

**Descripción:** Todas las páginas del admin hacen queries directas a Prisma en tiempo de render (Server Components). Next.js 14 en modo App Router puede cachear el resultado de páginas estáticas en build time. Sin `export const dynamic = 'force-dynamic'`, Next.js puede intentar prerenderizar estas páginas y almacenar el resultado — o al menos comportarse de forma impredecible si `DATABASE_URL` no está disponible en build time.

La única página con `dynamic = 'force-dynamic'` en todo el proyecto es `src/app/v/[token]/page.tsx` (verificación pública).

Con 10 generaciones simultáneas y admins distintos, servir una página cacheada con datos stale de otra sesión sería un bug de integridad visible para el usuario.

**Recomendación:** Agregar `export const dynamic = 'force-dynamic'` a todas las páginas bajo `src/app/admin/`. Como alternativa, usar `unstable_noStore()` de `next/cache` en las funciones de data fetching. La opción de `dynamic` es más explícita y fácil de auditar.

---

### [MEDIO] — `assertOwnership` hace N+1 queries por request

**Archivos afectados:** `src/lib/api/ownership.ts`, todos los route handlers bajo `src/app/api/generations/[id]/`

**Descripción:** `assertOwnership()` siempre hace una query a BD para obtener `created_by`. En la mayoría de los route handlers, el handler ya hace una query a la misma generation inmediatamente después (para validar status, obtener datos, etc.). Esto crea un patrón N+1 sistemático: 2 queries donde podría haber 1.

Ejemplo en `start/route.ts` (líneas 52–61 y 65–78): después de `assertOwnership`, el handler hace `prisma.generation.findUnique` con un select diferente. Son 2 round-trips a la BD en el path crítico de inicio de generación.

A 10 generaciones simultáneas con polling cada 2s desde el frontend (ver `status/route.ts`), esto multiplica la carga en Postgres innecesariamente.

**Recomendación:** Refactorizar `assertOwnership` para aceptar un objeto pre-fetched:

```ts
export async function assertOwnership(
  session: AuthSession,
  generationId: string,
  prefetched?: { created_by: string }
): Promise<void>
```

Cuando el handler ya tiene el objeto, lo pasa y se evita la segunda query. Si no lo tiene, `assertOwnership` hace la query internamente.

---

### [MEDIO] — `next.config.mjs` silencia errores de TypeScript y ESLint en build

**Archivos afectados:** `next.config.mjs` (líneas 6–11)

**Descripción:**

```js
eslint: {
  ignoreDuringBuilds: true,
},
typescript: {
  ignoreBuildErrors: true,
},
```

Estas flags hacen que `npm run build` nunca falle por errores de tipado o linting. En un sistema donde `src/types/index.ts` es la "fuente de verdad" entre agentes, silenciar TypeScript en build significa que una regresión de tipos puede llegar a producción sin ser detectada por CI.

Con un nuevo desarrollador entrando al proyecto, el build no es un safety net — lo que típicamente es la primera línea de defensa automática.

**Recomendación:** Eliminar ambas flags. Si hay errores existentes, capturarlos con `npx tsc --noEmit` y `npx eslint src/` en un sprint de limpieza. Agregar a CI: `npm run build` debe fallar si hay errores de tipos.

---

### [MEDIO] — `folio_counter` en Generation no se actualiza tras CSV upload

**Archivos afectados:** `src/app/api/generations/[id]/csv/route.ts` (líneas 106–125), `prisma/schema.prisma`

**Descripción:** Al subir un CSV, el contador de folios se calcula localmente (variable `folioCounter`) y se usa para generar los folios. Sin embargo, `generation.folio_counter` en la BD no se actualiza para reflejar el último folio asignado. Si el CSV se sube dos veces (o hay un retry), el código recalcula desde `generation.folio_counter` original + consulta de conflictos.

El mecanismo de skip-conflicting-folios (líneas 97–112) funciona correctamente para evitar colisiones entre generaciones, pero `generation.folio_counter` queda desincronizado de la realidad. Esto puede confundir al equipo si depuran o consultan ese campo para saber "hasta qué folio llegamos".

Adicionalmente, el campo `folio_counter` en el schema se describe como el punto de inicio, no el siguiente disponible — pero tras el primer upload, esa semántica cambia implícitamente.

**Recomendación:** Al final de la transacción de CSV, actualizar `generation.folio_counter` al valor de `folioCounter` (que ya es el siguiente disponible):

```ts
data: {
  csv_path: storagePath,
  total_count: rows.length,
  error_count: parseErrors.length,
  folio_counter: folioCounter,  // ← siguiente folio libre
},
```

---

### [MEDIO] — ZIP de 500 fotos se acumula en RAM durante upload

**Archivos afectados:** `src/app/api/generations/[id]/photos/route.ts` (líneas 143–155, 381)

**Descripción:** El ZIP de fotos se lee completo como `Buffer` antes de procesarse (`zipBuffer = Buffer.from(arrayBuffer)`). Con el límite de 200 MB y hasta 500 fotos, el proceso puede tener 200 MB del ZIP en RAM, más los buffers individuales de las fotos ya descomprimidas mientras se procesan secuencialmente. El ZIP original se guarda en storage (`await storage.put(zipStoragePath, zipBuffer)`) sin liberar la referencia hasta que el handler retorna.

A diferencia del engine de diplomas (que libera buffers explícitamente con `Buffer.alloc(0)`), este handler no tiene ningún mecanismo de liberación intermedia.

**Recomendación:** El ZIP de fotos original (200 MB) probablemente no necesita guardarse — ya se extraen las fotos individuales a storage. Evaluar si `photos_zip_path` es necesario o si puede eliminarse. Si se necesita para auditoría, guardarlo pero liberar el `zipBuffer` después de la transacción y antes de las escrituras individuales de fotos:

```ts
await storage.put(zipStoragePath, zipBuffer)
// Liberar referencia inmediatamente
(zipBuffer as unknown as null)  // o reasignar a Buffer.alloc(0)
```

---

### [BAJO] — `CertificateStatus` en documentación omite `'pending'`

**Archivos afectados:** `docs/ARCHITECTURE_HANDOFF.md` (sección 5), `src/types/index.ts` (línea 1)

**Descripción:** La sección 5 de `ARCHITECTURE_HANDOFF.md` documenta:

> `CertificateStatus` — union type: `'active' | 'revoked' | 'expired'`

El código real en `src/types/index.ts` línea 1 define:

```ts
export type CertificateStatus = 'pending' | 'active' | 'revoked' | 'expired'
```

`'pending'` es el estado inicial de todos los certificados al crearse desde CSV y es el estado que filtra el engine (`where: { status: 'pending' }`). Es el estado más frecuente del sistema durante el ciclo de vida de una generación. Su ausencia en la documentación puede hacer que un desarrollador nuevo asuma que los certificados nacen en estado `'active'`.

La documentación también lista `GenerationStatus` como `'draft' | 'processing' | 'completed' | 'failed'` pero el código real en `src/types/index.ts` línea 2 incluye `'ready'` — estado clave en el flujo preflight → start.

**Recomendación:** Actualizar la sección 5 de `ARCHITECTURE_HANDOFF.md` para reflejar los tipos exactos del código.

---

### [BAJO] — `ARCHITECTURE_HANDOFF.md` sección 8 describe archivos como no existentes cuando ya existen

**Archivos afectados:** `docs/ARCHITECTURE_HANDOFF.md` (sección 8, checklist sección 10)

**Descripción:** La sección 8 dice:

> "El archivo `src/app/api/auth/[...nextauth]/route.ts` NO existe aún. Backend debe crearlo."
> "Backend debe crear `src/middleware.ts`"

Ambos archivos existen y están implementados correctamente. El checklist de sección 10 los marca como ❌ pendientes. Esto puede confundir a un nuevo agente o desarrollador que crea que hay trabajo pendiente cuando ya está hecho.

**Recomendación:** Actualizar la sección 8 y el checklist de sección 10 para reflejar el estado actual: archivos implementados y funcionales.

---

### [BAJO] — `generateMetadata` en page.tsx de detail no usa el nombre real de la generación

**Archivos afectados:** `src/app/admin/(protected)/generations/[id]/page.tsx` (líneas 18–20)

**Descripción:**

```ts
export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: `Generación — Seneto` }
}
```

La función `generateMetadata` tiene acceso a `params.id` pero no lo usa para obtener el nombre real de la generación. Todas las pestañas del admin muestran "Generación — Seneto" en lugar de "Diplomado en Enfermería 2026 — Seneto", lo que dificulta identificar la pestaña cuando hay múltiples generaciones abiertas.

Esto también implica una query a BD duplicada si `generateMetadata` la hiciera (aunque actualmente no la hace), que en Next.js 14 se puede resolver con `cache()` de React. El impacto funcional es bajo, pero es una convención de Next.js no seguida.

**Recomendación:** Hacer la query de nombre en `generateMetadata` o usar `unstable_cache` para compartir el resultado con el page component.

---

## Items OK

### [OK] — Engine usa `for...of` serial, sin `Promise.all` sobre arrays grandes

**Archivo:** `src/lib/diploma/engine.ts` (líneas 86–166)

El loop de procesamiento es estrictamente serial con `for...of`. Cada certificado se procesa uno a la vez. Se libera el event loop entre diplomas con `setImmediate`. No hay `Promise.all` sobre el array de certificados. Correcto para controlar consumo de RAM y evitar saturar Postgres.

---

### [OK] — ZIP se construye lazy en lectura (O(1) en buffers de entrada)

**Archivo:** `src/lib/diploma/zipper.ts` (función `buildDiplomasZipLazy`)

Los PDFs se leen del storage uno a la vez mediante `getBuffer()` callbacks. En ningún momento todos los PDFs están en RAM simultáneamente. El diseño es correcto para la fase de lectura.

---

### [OK] — `StorageAdapter` es la única abstracción de I/O de archivos

**Archivos:** `src/lib/storage/adapter.ts`, todos los módulos en `src/lib/diploma/`, todos los route handlers

No se encontró ningún `fs.readFile`, `fs.writeFile`, `fs.mkdir` ni `fs.unlink` fuera de `adapter.ts`. El único `readFileSync` encontrado es el de la fuente EB Garamond en `composer.ts` (reportado como ALTO separado). El patrón de StorageAdapter está respetado en todo el codebase.

---

### [OK] — `src/lib/db.ts` es el único punto de acceso a Prisma

**Archivo:** `src/lib/db.ts`

No se encontró ninguna instanciación directa de `PrismaClient()` fuera de `db.ts`. El singleton está correctamente implementado con el patrón `globalThis` para evitar múltiples conexiones en hot reload de desarrollo.

---

### [OK] — El engine es independiente de Next.js

**Archivo:** `src/lib/diploma/engine.ts`

No hay ningún import de `next/` en `engine.ts`, `composer.ts`, `pdf.ts`, `qr.ts`, ni `zipper.ts`. El módulo de generación es framework-agnostic y podría ejecutarse en un worker process separado sin cambios.

---

### [OK] — Path traversal en storage tiene doble capa de protección

**Archivos:** `src/lib/storage/adapter.ts` (líneas 19–22), `src/app/api/files/[...path]/route.ts` (líneas 38–42)

Primera capa en el route handler: bloquea segmentos `'..'` antes de llegar a storage. Segunda capa en `LocalStorage.resolve()`: verifica que el path resuelto empiece con el base path. El diseño de defensa en profundidad es correcto.

---

### [OK] — Transición de estado `processing` es atómica (previene doble-start)

**Archivo:** `src/app/api/generations/[id]/start/route.ts` (líneas 65–78)

El uso de `updateMany({ where: { status: 'ready' } })` y verificar que `count === 0` para detectar concurrencia es el patrón correcto para una CAS (compare-and-swap) sobre Postgres sin locks explícitos. Documentado con referencia a BLOQ-B3-002.

---

### [OK] — Rutas admin protegidas por middleware de NextAuth

**Archivo:** `src/middleware.ts`

El middleware con `withAuth` y `matcher: ['/admin/:path*']` protege correctamente todas las rutas del admin. No hay duplicación de lógica de auth en los layouts.

---

### [OK] — Helpers de API reutilizables y sin duplicación de auth

**Archivos:** `src/lib/api/errors.ts`, `src/lib/api/ownership.ts`, `src/lib/api/audit.ts`, `src/lib/api/selects.ts`, `src/lib/api/rate-limit.ts`, `src/lib/api/upload.ts`, `src/lib/api/origin.ts`

La separación en helpers reutilizables está bien ejecutada. `assertOwnership`, `handleApiError`, `validateOrigin`, `logAction`, `SAFE_GENERATION_SELECT` y `validateMagicBytes` se usan consistentemente en todos los handlers. No se encontró duplicación de lógica de auth entre handlers.

---

### [OK] — Solo App Router (sin mezcla con Pages Router)

No se encontraron archivos en `src/pages/`. El proyecto usa exclusivamente App Router. No hay imports de `next/router` (Pages Router) en ningún componente.

---

### [OK] — Route handlers usan `params` de los argumentos (no `req.query`)

Todos los handlers con parámetros dinámicos (ej. `[id]`, `[folio]`, `[token]`) reciben `params` como segundo argumento de la función. No se encontró uso de `req.query` (patrón de Pages Router).

---

### [OK] — Fire-and-forget documentado con riesgos y condiciones de validez

**Archivo:** `docs/ARCHITECTURE_HANDOFF.md` (sección 12)

La decisión de fire-and-forget está documentada con la condición exacta de validez (proceso long-running), el riesgo en serverless, y el fallback `.catch()` con actualización de estado a `failed`. La deuda de Sprint 3B está registrada. La implementación del fallback en `start/route.ts` coincide con lo documentado.

---

### [OK] — `POST /api/generations/[id]/reset` existe y está documentado

**Archivo:** `src/app/api/generations/[id]/reset/route.ts`

El endpoint de recovery existe. La documentación en sección 12 menciona la necesidad de un mecanismo de recovery. (Los problemas de calidad de ese endpoint se reportan en CRÍTICO-2.)

---

### [OK] — Protección contra ZIP bomb en upload de fotos

**Archivo:** `src/app/api/generations/[id]/photos/route.ts`

Implementa límite de ratio de compresión (50×) tanto en cabecera como en tamaño real descomprimido. Usa `streamEntry()` con hard byte limit que aborta el stream mid-decompression. Protección correcta y documentada con `BLOQ-B2-004`.

---

### [OK] — Folio format como convención documentada y aplicada consistentemente

El formato `{PREFIX}-{YEAR}-{NNNN}` (4 dígitos, no 3 como dice la doc de sección 9) se genera en `csv/route.ts` con `padStart(4, '0')`. El override de folio se valida con regex `FOLIO_OVERRIDE_RE = /^[A-Z]{2,10}-\d{4}-\d{1,6}$/`. La convención es consistente entre parser y route.

> Nota menor: `ARCHITECTURE_HANDOFF.md` sección 9 dice "padded to 3" (`SEN-2026-001`) pero el código genera 4 dígitos (`SEN-2026-0001`). No es un bug funcional pero es inconsistencia de documentación.

---

## Notas para siguientes sprints

1. **Sprint 3B priority**: Los índices de BD (CRÍTICO-1) deben hacerse antes de cualquier prueba de carga. Sin ellos, el sistema no puede escalar.

2. **Endpoints temporales (CRÍTICO-2)**: Ambos archivos marcados `// TEMPORAL` deben eliminarse del codebase o promovidos a endpoints de producción con todas las protecciones. Dejarlos indefinidamente es deuda de seguridad activa.

3. **`force-dynamic` pages (ALTO-4)**: Se puede añadir con un script sed de una línea o como parte del próximo PR de las páginas admin. No requiere refactor — solo agregar una export.

4. **Paths module (ALTO-3)**: Crear `src/lib/storage/paths.ts` es un refactor de 30 minutos con alto valor preventivo. Centraliza los 5+ paths distintos que actualmente son string literals dispersos.

5. **TypeScript en build (MEDIO-2)**: Eliminar `ignoreBuildErrors: true` requiere resolver los errores de tipos existentes primero. Ejecutar `npx tsc --noEmit` para ver el estado actual antes de remover el flag.
