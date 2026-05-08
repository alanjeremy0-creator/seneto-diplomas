# Sprint 1 — Orchestration Plan
# Sistema de Diplomas Seneto

_Technical Orchestrator · 2026-05-07_
_Fuente de verdad para la ejecución de Sprint 1 — Backend Seguro._

---

## Regla de lectura

Este documento debe leerse **después** de `PROJECT_EXECUTION_PLAN.md` y `SPRINT0_ORCHESTRATION.md`.
En caso de conflicto con cualquier otro documento, prevalece `PROJECT_EXECUTION_PLAN.md`.

**Sprint 0 fue declarado cerrado el 2026-05-07.** Todos los helpers de seguridad (`logAction`, `assertOwnership`, `storage`, `handleApiError`) están disponibles. El patrón de route handler está establecido.

---

## 1. Objetivo de Sprint 1

Construir todos los route handlers funcionales de la API admin con seguridad consistente desde el primer commit. No se construye Frontend ni generación de PDFs en este sprint.

**Frontera Sprint 1 vs Sprint 1b:**
- Sprint 1: Route handlers + lógica de negocio (CRUD, uploads, validación, certificados, verificación pública).
- Sprint 1b: Lógica interna de generación de diplomas PDF/PNG, QR, ZIP final.
- `POST /api/generations/[id]/generate` en Sprint 1 **solo** marca el estado a `processing` y valida que pre-vuelo pasó. La generación real de PDFs es Sprint 1b.

---

## 2. Estado del schema — Sprint 0 heredado

El schema ya tiene todos los modelos base. **No se requiere migración antes de Sprint 1**, pero el Backend Engineer debe verificar al inicio de BE-001 si algún campo falta.

| Modelo | Estado | Notas Sprint 1 |
|---|---|---|
| `User` | ✅ Completo | `UserRole` enum, `audit_logs` relation |
| `Template` | ✅ Completo | `file_path`, `field_zones Json?`, `image_width_px`, `image_height_px` — `field_zones` es el contrato de coordenadas de render (PROD-DEC-002). Sprint 1: se persiste pero no se valida. Sprint 2: Zone Editor UI (FE-006). Sprint 3: renderer lo consume. |
| `Generation` | ✅ Completo | `status String`, `zip_path?`, `created_by`, `template_id` |
| `Certificate` | ✅ Completo | `verification_token`, `folio`, `status`, `revocation_reason?` |
| `GenerationError` | ✅ Completo | Por fila del CSV que falló |
| `AuditLog` | ✅ Sprint 0 | Helper `logAction()` disponible |

**Nota:** `Certificate.email String?` existe en schema pero el CSV parser **no debe aceptarlo** (fuera de alcance MVP). No eliminar el campo — migraciones destructivas en prod futuro.

**Nota:** `Generation.status` es `String` libre. El Backend Engineer debe definir constantes de estado en TypeScript para evitar inserciones inválidas. No requiere migración.

---

## 3. Patrón obligatorio — Route Handlers Admin

Todo route handler privado debe seguir **este orden exacto**, sin excepción:

```ts
// 1. Sesión
const session = await getServerSession(authOptions)
if (!session) return NextResponse.json({ error: ... }, { status: 401 })

// 2. Origin (solo POST / PATCH / DELETE)
if (!validateOrigin(req)) return NextResponse.json({ error: ... }, { status: 403 })

// 3. Validar params / body
// (zod o validación manual)

// 4. Buscar recurso en DB (si aplica)

// 5. Ownership (cuando aplica)
await assertOwnership(session, generationId)

// 6. Lógica de negocio

// 7. AuditLog (si la operación fue exitosa y es crítica)
await logAction({ action: '...', userId: session.user.id, targetId: '...', ip })

// 8. Responder con tipos de src/types/api.ts

// 9. catch → handleApiError(error)
```

**Regla de Origin:** `NEXTAUTH_URL` es la fuente de verdad. Si no está en `.env`, el check falla cerrado (403), no abierto.

---

## 4. Tickets — Sprint 1

### SEC-010 — Helper `validateOrigin()`

**Dependencias:** Ninguna. Es el primer entregable.
**Responsable:** Backend Security Engineer.

**Crear `src/lib/api/origin.ts`:**
- Función `validateOrigin(req: NextRequest): boolean`
- Compara `req.headers.get('origin')` contra `process.env.NEXTAUTH_URL`
- Compara también contra `req.headers.get('host')` como fallback para mismo origen
- Si `NEXTAUTH_URL` no está definido → retorna `false` (fail closed)
- No loggear NEXTAUTH_URL en errores

**Validación:**
```bash
npx tsc --noEmit   # 0 errores
```
- Request sin header `Origin` a un endpoint de mutación → 403
- Request con `Origin` correcto → pasa validación

---

### BE-001 — Generations CRUD

**Dependencias:** SEC-010.
**Responsable:** Backend Security Engineer.

**Endpoints:**
```
GET    /api/generations          — lista paginada; admin ve las suyas; superadmin ve todas
POST   /api/generations          — crear generación (name, template opcional)
GET    /api/generations/[id]     — detalle
PATCH  /api/generations/[id]     — actualizar nombre o estado
```

**Archivos:**
- `src/app/api/generations/route.ts`
- `src/app/api/generations/[id]/route.ts`

**Reglas de negocio:**
- `GET /api/generations`: `select` explícito — nunca retornar `created_by` password hash ni IDs internos secundarios en listado.
- `POST /api/generations`: `created_by = session.user.id`. `folio_year` = año actual. `status = 'draft'`.
- `PATCH /api/generations/[id]`: solo campos permitidos (`name`). No exponer cambio de `status` al cliente en este endpoint — `status` lo cambia el sistema, no el admin directamente.
- `assertOwnership` requerido en GET por id, PATCH.
- `logAction` no requerido en CRUD de generación (solo en acciones críticas: revocación, descarga ZIP). Sí requerido si se implementa DELETE.
- No implementar DELETE en Sprint 1 salvo que esté en scope explícito — si se implementa, solo para `draft` y con `logAction`.

**Validación:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/generations        # sin sesión → 401
curl -s -w "%{http_code}" -X POST http://localhost:3000/api/generations ...         # sin Origin → 403
npx tsc --noEmit
```

---

### BE-002 — Template upload con validación magic bytes

**Dependencias:** BE-001.
**Responsable:** Backend Security Engineer.

**Endpoint:**
```
POST /api/generations/[id]/template
```

**Archivos:**
- `src/app/api/generations/[id]/template/route.ts`
- `src/lib/api/upload.ts` — helper `validateMagicBytes(buffer, allowedTypes)` + `validateFileSize(bytes, maxMB)`

**Reglas de negocio:**
- Validar sesión, origin, ownership de la generación.
- Validar magic bytes del archivo antes de cualquier escritura a disco:
  - PNG: bytes `89 50 4E 47 0D 0A 1A 0A`
  - JPG: bytes `FF D8 FF`
  - Rechazar cualquier otro tipo → 400
- Validar tamaño máximo (sugerido: 10MB — confirmar con PEP si hay otro límite definido).
- Guardar con `storage.put(path, buffer)` — nunca concatenación manual de paths.
- `path` = `templates/{generationId}/{timestamp}.{ext}` — nunca usar nombre de archivo del cliente.
- Actualizar `Template.file_path` (o crear Template y actualizar `Generation.template_id` si la generación fue creada sin template).
- No confiar en `Content-Type` del cliente — usar magic bytes.

**Validación:**
```bash
# Subir PNG real → 200
# Subir archivo .txt con extensión .png → 400 (magic bytes no coinciden)
# Subir sin sesión → 401
# Subir con Origin incorrecto → 403
```

---

### BE-003 — CSV upload + parsing + folio_override

**Dependencias:** BE-001.
**Responsable:** Backend Security Engineer.

**Endpoints:**
```
POST /api/generations/[id]/csv
GET  /api/generations/[id]/students
```

**Archivos:**
- `src/app/api/generations/[id]/csv/route.ts`
- `src/app/api/generations/[id]/students/route.ts`
- `src/lib/csv/parser.ts` — `parseCSV(buffer)`, `validateRow(row)`

**Reglas de negocio:**
- Validar sesión, origin (POST), ownership.
- Columnas requeridas del CSV: `student_name`, `program` (el Backend Engineer puede ampliar consultando PEP §7.1 — no agregar `email`).
- `email` en CSV debe ser **ignorado o rechazado** — nunca insertado en BD.
- Si existe columna `folio_override`: validar formato con regex `^[A-Z]+-\d{4}-\d{3,}$` (ej. `SEN-2026-001`). Filas con formato inválido → `GenerationError`, no bloquean el batch completo.
- Crear un `Certificate` stub por cada fila válida: `folio` generado automáticamente, `status = 'pending'`.
- Filas inválidas → crear `GenerationError` con `row_number`, `error_type`, `error_detail`.
- `GET /api/generations/[id]/students` → lista las certificates (stubs) de la generación con select explícito.
- Re-subir CSV: reemplaza las certificates existentes (si status es `draft` o `pending`) — definir comportamiento si hay certificados en estado avanzado.

**Validación:**
```bash
# Subir CSV con columna email → email no aparece en BD ni en respuesta
# Subir CSV con folio_override inválido → GenerationError creado, fila válida continúa
# GET /students → lista con select explícito (no email, no internal IDs)
```

---

### BE-005 — ZIP fotos upload con validación segura

**Dependencias:** BE-001.
**Responsable:** Backend Security Engineer.

**Endpoint:**
```
POST /api/generations/[id]/photos
```

**Archivos:**
- `src/app/api/generations/[id]/photos/route.ts`

**Reglas de negocio:**
- Validar sesión, origin, ownership.
- Validar que el archivo recibido es un ZIP (magic bytes: `50 4B 03 04`).
- Validar tamaño del ZIP antes de extraer (sugerido: 200MB max).
- Extraer con `archiver` / `unzipper` — limitar número de archivos (sugerido: max 500) y tamaño total descomprimido (sugerido: 500MB) para mitigar ZIP bomb.
- Por cada archivo extraído:
  - Validar magic bytes (solo PNG o JPG).
  - Ignorar archivos no-imagen (directorios, `.DS_Store`, `__MACOSX`).
  - Rechazar si magic bytes no coinciden con imagen válida.
- Hacer match de imagen con Certificate por nombre de archivo (`{student_name}.png/jpg` o por folio si se define otra convención).
- Actualizar `Certificate.photo_path` por cada match.
- Certificates sin foto → no bloquean el upload; se reportan en la pre-vuelo.
- Guardar imágenes en storage: `generations/{generationId}/photos/{filename}`.

**Validación:**
```bash
# ZIP con imágenes válidas → 200, certificates actualizadas
# ZIP bomb → 400 antes de agotar memoria
# Archivo .exe dentro del ZIP → ignorado/rechazado
# Sin sesión → 401
```

---

### BE-006 — Validación pre-vuelo

**Dependencias:** BE-002, BE-003, BE-005 (conceptualmente — el endpoint puede existir antes).
**Responsable:** Backend Security Engineer.

**Endpoint:**
```
GET /api/generations/[id]/validate
```

**Archivos:**
- `src/app/api/generations/[id]/validate/route.ts`

**Reglas de negocio:**
- Validar sesión, ownership.
- Verificar checklist:
  1. Template tiene `file_path` no nulo (bloqueante). `field_zones` nulo emite warning `NO_FIELD_ZONES` pero no bloquea — el editor de zonas es Sprint 2 (PROD-DEC-002).
  2. Generación tiene al menos 1 Certificate con status `pending`.
  3. Todos los Certificates tienen `photo_path` no nulo — o reportar cuáles les faltan.
  4. Sin errores críticos en `GenerationError`.
- Respuesta: `{ valid: boolean, issues: Issue[] }`.
- Si todo pasa, actualizar `Generation.status = 'ready'`.
- Nunca bloquear parcialmente — siempre reportar todos los problemas, no solo el primero.

**Validación:**
```bash
# Generación sin template → valid: false, issues incluye template faltante
# Generación sin CSV → valid: false, issues incluye CSV faltante
# Todos los pasos completos → valid: true, Generation.status = 'ready'
```

---

### BE-007 — Trigger generación + Status

**Dependencias:** BE-006.
**Responsable:** Backend Security Engineer.

**Endpoints:**
```
POST /api/generations/[id]/generate
GET  /api/generations/[id]/status
```

**Archivos:**
- `src/app/api/generations/[id]/generate/route.ts`
- `src/app/api/generations/[id]/status/route.ts`

**Reglas de negocio (Sprint 1 — stub):**
- `POST /generate`:
  - Validar sesión, origin, ownership.
  - Verificar que `Generation.status === 'ready'` — si no, retornar 400 con mensaje claro.
  - Actualizar `Generation.status = 'processing'`.
  - `logAction('generation.start', generationId)`.
  - Retornar `{ status: 'processing' }`.
  - **No ejecutar generación real en Sprint 1** — eso es Sprint 1b.
- `GET /status`:
  - Validar sesión, ownership.
  - Retornar `{ status, total_count, processed_count, error_count }`.
  - Polling desde Frontend (Sprint 2).

**Nota para Sprint 1b:** La lógica de generación real se inyecta aquí. Sprint 1 solo establece el scaffold y el cambio de estado.

---

### BE-009 — Descargar ZIP y CSV errores

**Dependencias:** BE-007.
**Responsable:** Backend Security Engineer.

**Endpoints:**
```
GET /api/generations/[id]/download   — ZIP de diplomas
GET /api/generations/[id]/errors     — CSV de errores
```

**Archivos:**
- `src/app/api/generations/[id]/download/route.ts`
- `src/app/api/generations/[id]/errors/route.ts`

**Reglas de negocio:**
- Validar sesión, ownership.
- `download`: si `Generation.zip_path` es nulo (generación no completada) → 404 con mensaje. Si existe → servir via `storage.get()` como `application/zip`. `logAction('generation.zip_download', generationId)`.
- `errors`: si `GenerationError.count === 0` → responder CSV vacío (con headers) o 204. Si hay errores → generar CSV on-the-fly con `GenerationError` rows.
- Ambos deben tener `Content-Disposition: attachment; filename="..."`.
- Cache-Control: `private, no-store`.

---

### BE-011 — Búsqueda y detalle de certificados

**Dependencias:** BE-001 (conceptualmente). Puede implementarse en paralelo.
**Responsable:** Backend Security Engineer.

**Endpoints:**
```
GET /api/certificates?q=...    — búsqueda por nombre o folio
GET /api/certificates/[folio]  — detalle
```

**Archivos:**
- `src/app/api/certificates/route.ts`
- `src/app/api/certificates/[folio]/route.ts`

**Reglas de negocio:**
- Validar sesión.
- `GET /certificates?q=`: buscar por `student_name ILIKE` o `folio ILIKE`. `select` explícito — nunca retornar `email`, `photo_path`, `diploma_pdf_path`, `diploma_png_path` directamente.
- Admin solo ve certificados de sus propias generaciones; superadmin ve todos.
- `GET /certificates/[folio]`: lookup por `folio`. `assertOwnership` via la generación asociada.
- Retornar campos seguros: `folio`, `student_name`, `program`, `issued_date`, `status`, `generation_id`, `created_at`, `revoked_at?`, `revocation_reason?`.

---

### BE-013 — Revocar / Reactivar certificado ⚠️ DIFERIDO — POST-MVP

> **Decisión 2026-05-07:** BE-013 se mueve fuera del alcance de Sprint 1. Ver `PMVP-REV-001` en `BACKLOG.md` y decisión en `SENETO_DECISIONS.md §9`. La base técnica (campos de schema, AuditLog, ownership) ya está implementada. No implementar ahora.

**Dependencias:** BE-011.
**Responsable:** Backend Security Engineer.

**Endpoint:**
```
PATCH /api/certificates/[folio]
```

**Archivos:**
- Actualizar `src/app/api/certificates/[folio]/route.ts`

**Reglas de negocio:**
- Validar sesión, origin, ownership (via generation).
- Body: `{ action: 'revoke' | 'reactivate', reason?: string }`.
- `action: 'revoke'`:
  - `reason` requerido, mínimo 10 caracteres — error 400 si no cumple.
  - Solo válido si `status === 'active'` — error 400 si ya está revocado.
  - Actualizar `Certificate.status = 'revoked'`, `revoked_at = now()`, `revocation_reason = reason`.
  - `logAction('certificate.revoke', { targetId: folio, targetType: 'certificate', detail: { reason } })`.
- `action: 'reactivate'`:
  - Solo válido si `status === 'revoked'`.
  - Actualizar `Certificate.status = 'active'`, limpiar `revoked_at` y `revocation_reason`.
  - `logAction('certificate.reactivate', { targetId: folio, targetType: 'certificate' })`.
- Nunca retornar `revocation_reason` en respuestas públicas.

---

### BE-014 — Verificación pública por token

**Dependencias:** Schema (✓ `verification_token` existe desde Sprint 0). Independiente del resto.
**Responsable:** Backend Security Engineer.

**Endpoint:**
```
GET /api/verify/[token]
```

**Archivos:**
- `src/app/api/verify/[token]/route.ts`

**Reglas de negocio:**
- **Sin autenticación** — endpoint público.
- Validar formato UUID del `token` antes de consultar BD. Si no es UUID válido → 400.
- Lookup **exclusivamente** por `verification_token` — nunca por `folio`.
- `select` explícito de Prisma — nunca retornar objeto Certificate completo:
  ```ts
  select: {
    status: true,
    folio: true,
    student_name: true,
    program: true,
    issued_date: true,
    generation: { select: { name: true } }  // para institución si aplica
  }
  ```
- UUID no encontrado → 404 (sin exponer si el token existe o no en otro estado).
- Retornar `VerifyResponse` de `src/types/api.ts`:
  ```ts
  { status, folio, student_name?, program?, issued_date?, institution }
  ```
- Nunca incluir: `email`, `photo_path`, `diploma_pdf_path`, `verification_token` (redundante), `generation_id`, `id`.
- `institution` hardcodeada como `"Seneto"` para MVP — no en BD.

**Validaciones críticas:**
```bash
# GET /api/verify/{uuid-valido-existente} → 200 con VerifyResponse
# GET /api/verify/SEN-2026-001            → 400 (no es UUID)  ← CRÍTICO
# GET /api/verify/{uuid-no-existe}        → 404
# VerifyResponse: sin email, sin photo_url, sin IDs internos
```

---

## 5. Orden de ejecución

```
SEC-010 (validateOrigin helper)
    │
    ▼
BE-001 (Generations CRUD)
    │
    ├──────────────┬──────────────┐
    ▼              ▼              │
 BE-002         BE-003+004      BE-011+012
(Template)      (CSV+folio)     (Certificates)
                                     │
                                     ▼
 BE-005
(Photos ZIP)
 [BE-013 DIFERIDO — ver PMVP-REV-001]
    │
    ▼
 BE-006
(Pre-vuelo)
    │
    ▼
 BE-007+008
(Generate stub + Status)
    │
    ▼
 BE-009+010
(Downloads)

BE-014 (Public verify) ── independiente, ejecutar temprano
```

**Paralelizables:** BE-002, BE-003, BE-011+012 pueden ejecutarse en paralelo después de BE-001. BE-014 puede ejecutarse en cualquier momento.

---

## 6. Archivos esperados

| Archivo | Ticket |
|---|---|
| `src/lib/api/origin.ts` | SEC-010 |
| `src/lib/api/upload.ts` | BE-002 |
| `src/lib/csv/parser.ts` | BE-003 |
| `src/app/api/generations/route.ts` | BE-001 |
| `src/app/api/generations/[id]/route.ts` | BE-001 |
| `src/app/api/generations/[id]/template/route.ts` | BE-002 |
| `src/app/api/generations/[id]/csv/route.ts` | BE-003 |
| `src/app/api/generations/[id]/students/route.ts` | BE-003 |
| `src/app/api/generations/[id]/photos/route.ts` | BE-005 |
| `src/app/api/generations/[id]/validate/route.ts` | BE-006 |
| `src/app/api/generations/[id]/generate/route.ts` | BE-007 |
| `src/app/api/generations/[id]/status/route.ts` | BE-007 |
| `src/app/api/generations/[id]/download/route.ts` | BE-009 |
| `src/app/api/generations/[id]/errors/route.ts` | BE-009 |
| `src/app/api/certificates/route.ts` | BE-011 |
| `src/app/api/certificates/[folio]/route.ts` | BE-011 (BE-013 diferido) |
| `src/app/api/verify/[token]/route.ts` | BE-014 |

---

## 7. Gates de salida — Sprint 1

**No se habilita Sprint 2 hasta que todos los siguientes gates pasen.**

| Gate | Criterio verificable |
|---|---|
| **S1-TS** | `npx tsc --noEmit` → 0 errores |
| **S1-AUTH** | Todos los endpoints admin retornan 401 sin sesión |
| **S1-ORIGIN** | POST/PATCH/DELETE con Origin incorrecto → 403 |
| **S1-OWN** | Admin A no puede acceder a Generation/Certificate de Admin B → 403 |
| **S1-AUDIT-REV** | ~~`certificate.revoke` registra en `audit_logs`~~ — diferido (PMVP-REV-001) |
| **S1-AUDIT-REACT** | ~~`certificate.reactivate` registra en `audit_logs`~~ — diferido (PMVP-REV-001) |
| **S1-AUDIT-DL** | `generation.zip_download` registra en `audit_logs` |
| **S1-VERIFY-UUID** | `GET /api/verify/{uuid-valido}` → 200 con VerifyResponse correcta |
| **S1-VERIFY-FOLIO** | `GET /api/verify/SEN-2026-001` → 400 (no es UUID) |
| **S1-VERIFY-DATA** | VerifyResponse no contiene `email`, `photo_url`, IDs internos |
| **S1-MAGIC** | Upload de plantilla con magic bytes de `.exe` → 400 |
| **S1-CSV-EMAIL** | CSV con columna email → campo ignorado, no aparece en BD ni respuesta |
| **S1-FOLIO-RE** | `folio_override` con formato inválido → GenerationError, no bloquea batch |
| **S1-ZIP-SAFETY** | ZIP con archivo no-imagen → ignorado; ZIP bomb → 400 antes de OOM |
| **S1-PREFLIGHT** | Pre-vuelo con template faltante → `valid: false` con issue descriptivo |
| **S1-GEN-STUB** | `POST /generate` con status ≠ 'ready' → 400; con 'ready' → status 'processing' |
| **S1-REVOKE-MIN** | ~~Revocar con motivo < 10 caracteres → 400~~ — diferido (PMVP-REV-001) |
| **S1-REACTIVATE** | ~~Reactivar certificado activo → 400; reactivar revocado → 200~~ — diferido (PMVP-REV-001) |
| **Review** | Architect Reviewer emite: "**Aprobado para Sprint 2**" |
| **QA** | Security QA valida dinámicamente S1-AUTH, S1-ORIGIN, S1-OWN, S1-VERIFY-FOLIO, S1-VERIFY-DATA |

---

## 8. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `Generation.status` sin enum — inserciones inválidas | Media | Definir constantes TypeScript (`GENERATION_STATUS`) en Sprint 1. Migración a enum en Sprint 3 si es necesario. |
| Template ownership indirecto — un admin accede a templates ajenos | Media | `assertOwnership` siempre via la Generation que referencia el Template. |
| ZIP bomb en upload de fotos | Alta | Límite de tamaño descomprimido (500MB) y número de archivos (500) antes de extraer. |
| Timeout en `POST /generate` si se intenta generación real | Alta | Sprint 1 solo cambia estado. La generación real es Sprint 1b. Documentar explícitamente en el stub. |
| `folio_override` regex sin definición oficial | Baja | Backend Engineer documenta el regex elegido al implementar BE-003. Candidato: `^[A-Z]+-\d{4}-\d{3,}$`. |
| `Certificate.email` en schema — riesgo de fuga por error | Media | CSV parser rechaza/ignora `email` explícitamente. Ningún `select` lo incluye en respuestas. |
| Nueva migración necesaria si el schema tiene gaps | Baja | Backend Engineer verifica al inicio de BE-001. Si hay gaps, migración nueva antes de BE-002. |
| Ownership dinámico Admin A vs B (gate ND4 estático Sprint 0) | Alta — Sprint 1 lo cierra | BE-001 crea 2 usuarios y generaciones de prueba para validar. Security QA lo verifica dinámicamente. |

---

## 9. Agentes — Sprint 1

| Rol | Tipo | Tickets |
|---|---|---|
| **Backend Security Engineer** | Builder | SEC-010, BE-001 a BE-014 |
| **Architect Reviewer** | Solo lectura — al cierre de Sprint 1 | Revisión estática de todos los route handlers |
| **Security QA** | Solo pruebas — al cierre de Sprint 1 | Gates S1-AUTH, S1-ORIGIN, S1-OWN, S1-VERIFY-*, S1-REVOKE |

**No se construye Frontend, PDF, ni ZoneEditor en Sprint 1.**
**No se tocan DNS, GoDaddy ni se despliega QA en Sprint 1.**

---

## 10. Entregable de confirmación

El Backend Security Engineer debe declarar al inicio de cada ticket:
> "Iniciando [TICKET-ID]: [descripción en una línea]."

Y al finalizar cada ticket:
> "Listo [TICKET-ID]: [archivos creados/modificados]. Gates verificados: [lista]."

El Orchestrator no avanza al siguiente ticket hasta recibir esa declaración.

---

_Documento preparado por: Technical Orchestrator_
_Fecha: 2026-05-07_
_En caso de conflicto con cualquier sección de este documento y `PROJECT_EXECUTION_PLAN.md`, prevalece `PROJECT_EXECUTION_PLAN.md`._
