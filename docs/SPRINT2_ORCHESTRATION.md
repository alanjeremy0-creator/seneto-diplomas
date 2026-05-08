# Sprint 2 — Orchestration Plan
# Sistema de Diplomas Seneto

_Technical Orchestrator · 2026-05-07_
_Fuente de verdad para la ejecución de Sprint 2 — Frontend Admin + Landing Pública._

---

## Regla de lectura

Este documento debe leerse **después** de `PROJECT_EXECUTION_PLAN.md`, `SPRINT1_ORCHESTRATION.md` y `SENETO_DECISIONS.md`.
En caso de conflicto con cualquier otro documento, prevalece `PROJECT_EXECUTION_PLAN.md`.

**Sprint 1 fue declarado cerrado el 2026-05-07.** Todos los endpoints del API admin están disponibles y revisados. Los contratos de respuesta son estables. No se modifica ningún route handler de Sprint 1 en este sprint salvo corrección de bug confirmado.

---

## 1. Objetivo de Sprint 2

Construir el panel de administración y la landing pública de verificación. No se toca lógica de generación de PDFs/PNGs ni QR (Sprint 1b/3). No se implementa Zone Editor hasta confirmar que entra en este sprint.

**Frontera Sprint 2:**
- Sprint 2: Toda la UI que consume los endpoints de Sprint 1. Mobile-first en toda la capa pública.
- Sprint 1b: Lógica interna de generación de diplomas PDF/PNG, QR, ZIP final — fuera de este sprint.
- Sprint 3: Renderer, Zone Editor (si no entra en Sprint 2), QA/Hardening, deploys.

---

## 2. Estado heredado de Sprint 1

### Endpoints disponibles (contratos estables)

| Endpoint | Método | Ticket Sprint 1 | Descripción |
|---|---|---|---|
| `/api/generations` | GET | BE-001 | Lista paginada de generaciones del admin |
| `/api/generations` | POST | BE-001 | Crear generación |
| `/api/generations/[id]` | GET | BE-001 | Detalle de generación |
| `/api/generations/[id]` | PATCH | BE-001 | Actualizar nombre |
| `/api/generations/[id]/template` | POST | BE-002 | Subir imagen de plantilla (PNG/JPG) |
| `/api/generations/[id]/csv` | POST | BE-003 | Subir CSV de alumnos |
| `/api/generations/[id]/students` | GET | BE-003 | Listar estudiantes/certificados de generación |
| `/api/generations/[id]/photos` | POST | BE-005 | Subir ZIP de fotos |
| `/api/generations/[id]/preflight` | GET | BE-006 | Validación pre-vuelo |
| `/api/generations/[id]/generate` | POST | BE-007 | Iniciar generación (status → processing) |
| `/api/generations/[id]/status` | GET | BE-008 | Status y progreso de generación |
| `/api/generations/[id]/download` | GET | BE-009 | Descargar ZIP de diplomas |
| `/api/generations/[id]/errors/csv` | GET | BE-010 | Descargar CSV de errores |
| `/api/certificates` | GET | BE-011 | Búsqueda y listado de certificados |
| `/api/certificates/[folio]` | GET | BE-012 | Detalle de certificado por folio |
| `/api/verify/[token]` | GET | BE-014 | Verificación pública por `verification_token` |

### Tipos TypeScript disponibles (src/types/api.ts)

- `Generation`, `GenerationStatus` (`draft | ready | processing | completed | failed`)
- `Certificate`, `CertificateStatus` (`pending | active | revoked | expired`)
- `VerifyResponse` — `{ valid, status, folio, student_name?, program?, issued_date?, institution, message }`
- `ApiError` — `{ error: { code, message } }`

### Utilidades instaladas

| Paquete | Versión | Uso en Sprint 2 |
|---|---|---|
| `tailwindcss` | ^3.4.1 | Estilos — ya configurado |
| `@fontsource/eb-garamond` | ^5.2.7 | Tipografía de diploma/landing pública |
| `next-auth` | ^4.24.14 | Sesión ya configurada — usar `useSession()` en cliente |

### Paquetes aún no instalados — decisión requerida en FE-001

El Frontend Engineer debe elegir y documentar antes de iniciar FE-002:

| Rol | Recomendación | Alternativa |
|---|---|---|
| Data fetching | SWR (`swr`) | TanStack Query (`@tanstack/react-query`) |
| Form validation | React Hook Form (`react-hook-form`) | Formularios con estado local para forms simples |
| Componentes UI | shadcn/ui (Radix + Tailwind) | Headless UI + Tailwind manual |
| Notificaciones toast | `sonner` | `react-hot-toast` |

La elección debe ser consistente en todos los tickets. Declarar la decisión en el primer comentario de FE-002.

---

## 3. Decisiones pendientes que afectan Sprint 2

Las decisiones de `SENETO_DECISIONS.md §2` deben cerrarse **antes de implementar los tickets indicados**. El Frontend Engineer no debe inventar el comportamiento — esperar aprobación.

| Decisión | Bloquea ticket | Estado | Recomendación |
|---|---|---|---|
| **DEC-001** — Foto pública | FE-015 (landing) | Pendiente | **Opción A: Sin foto en MVP.** Marcar con `has_photo` solo en admin (FE-013). |
| **DEC-002** — Nombre completo vs parcial | FE-015 (landing) | Pendiente | Implementar componente `<StudentName>` que acepta prop `displayMode: 'full' \| 'partial'` — la decisión cambia solo la prop. |
| **DEC-003** — Texto certificado no válido | FE-015 (landing) | Pendiente | **Opción A recomendada:** Mostrar solo "Diploma no válido" sin motivo ni fecha. |
| **DEC-005** — Aviso de privacidad | FE-015 (landing) | Pendiente | Footer con enlace. Si no se tiene URL del aviso, usar placeholder `#`. |
| **DEC-008** — Datos públicos visibles | FE-015 (landing) | Pendiente | Campos aprobados: `valid`+`status`, `folio`, `institution`, `program`, `issued_date`, `student_name` (según DEC-002). |

**Si DEC-002 no se resuelve antes de FE-015:** implementar con nombre completo y dejar el componente `<StudentName>` preparado para el switch. Documentar como deuda UX.

**DEC-004** (confirmación de revocación) no aplica en Sprint 2 — FE-014 (modal revocación) está diferido a post-MVP (PMVP-REV-001).

---

## 4. Patrón obligatorio — Componentes Frontend

### Fetch autenticado

Todo fetch a la API admin debe:
1. Usar la sesión de NextAuth — `useSession()` en Client Components, `getServerSession(authOptions)` en Server Components.
2. No hardcodear URLs — usar rutas relativas `/api/...`.
3. Manejar explícitamente: loading, error (`ApiError`), empty state.
4. Nunca mostrar errores crudos del servidor al usuario — mapear a mensajes en español.

```ts
// Patrón base para fetch con error handling
const res = await fetch('/api/generations', { credentials: 'include' })
if (!res.ok) {
  const body = await res.json().catch(() => ({}))
  throw new Error(body?.error?.message ?? 'Error inesperado')
}
return res.json()
```

### Server Components vs Client Components

- **Server Components por defecto** — páginas de solo lectura (listados, detalles).
- **Client Components (`'use client'`)** — únicamente cuando hay interactividad: formularios, uploads, polling, toasts.
- No usar `useEffect` para fetch de datos iniciales si puede hacerse en Server Component.

### Uploads de archivos

- Usar `FormData` — nunca JSON para uploads.
- Mostrar progreso si el archivo puede ser grande (template, ZIP).
- Mostrar resumen de resultado (fotos: `matched`, `unmatched`, `errors`).
- No recargar la página completa tras upload exitoso — actualizar estado local.

### Polling de status

- `GET /api/generations/[id]/status` — polling cada 3 segundos mientras `status === 'processing'`.
- Detener polling cuando `status` sea `completed` o `failed`.
- No bloquear la UI durante el polling — mostrar indicador de progreso.
- Timeout máximo de polling: 5 minutos — mostrar error si supera ese tiempo.

### Mobile-first

- Diseñar para 375px primero, escalar a 768px+.
- Toda interacción táctil con touch target mínimo de 44px (UX-008).
- Contraste mínimo WCAG AA (4.5:1 para texto normal, 3:1 para texto grande).
- La landing pública `/v/[token]` es **100% mobile** — el caso de uso principal es escaneo de QR desde teléfono.

---

## 5. Tickets — Sprint 2

### Bloque 1 — Auth + Layout Foundation

---

#### FE-001 — Login admin `/admin/login`

**Dependencias:** Sprint 1 (NextAuth configurado).
**Responsable:** Frontend Engineer.
**Revisores al cierre:** UX Reviewer.

**Pantalla:** Formulario de login centrado, branding Seneto.
- Campos: `email`, `password`.
- Validación: ambos requeridos, email con formato válido.
- Error: "Credenciales inválidas" si NextAuth retorna error — nunca mostrar el error crudo.
- Loading state: botón deshabilitado + spinner mientras hace submit.
- Redirect: tras login exitoso → `/admin/generations`.
- Si ya está autenticado y navega a `/admin/login` → redirect a `/admin/generations`.

**Decisión de paquetes:** Declarar aquí la elección de SWR/React Hook Form/shadcn/ui e instalar.

**Archivos:**
- `src/app/admin/login/page.tsx`
- `src/components/auth/LoginForm.tsx`

**Validación:**
```
- Credenciales correctas → redirect a /admin/generations
- Credenciales incorrectas → "Credenciales inválidas" visible
- Email sin formato → error inline antes de submit
- Sin JS (SSR) → form funcional
- Mobile 375px: form centrado, campos full width, botón full width
```

---

#### FE-002 — Admin layout + guard de autenticación

**Dependencias:** FE-001.
**Responsable:** Frontend Engineer.
**Revisores al cierre:** Architect Reviewer (estructura de layout), Security Reviewer (guard).

**Layout:** Sidebar/nav lateral con links:
- Generaciones (`/admin/generations`)
- Certificados (`/admin/certificates`)
- Avatar/nombre de usuario + botón logout

**Guard:** El middleware de Next.js (ya configurado en Sprint 0 — `src/middleware.ts`) protege `/admin/*`. El layout verifica adicionalmente con `getServerSession` — si no hay sesión → redirect a `/admin/login`.

**Archivos:**
- `src/app/admin/layout.tsx`
- `src/components/admin/Sidebar.tsx`
- `src/components/admin/Header.tsx`

**Estados de UI:**
```
- Sesión activa → layout completo con nav
- Sin sesión → redirect a /admin/login (middleware primero)
- Mobile: sidebar colapsable (hamburger menu)
```

**Validación:**
```
- GET /admin/generations sin sesión → redirect /admin/login
- Layout visible con sesión activa
- Logout → limpia sesión → redirect /admin/login
- Mobile 375px: nav colapsable funcional
```

---

### Bloque 2 — Flujo de Generaciones

---

#### FE-003 — Dashboard generaciones `/admin/generations`

**Dependencias:** FE-002.
**Responsable:** Frontend Engineer.
**Revisores al cierre:** UX Reviewer.

**Contrato backend:** `GET /api/generations` — paginación incluida.

**Pantalla:** Lista de generaciones del admin.
- Cada card/fila muestra: nombre, `folio_prefix`-`folio_year`, status badge, `total_count`, `processed_count`, fecha de creación, acciones.
- Status badge por color:
  - `draft` → gris ("Borrador")
  - `ready` → azul ("Listo")
  - `processing` → amarillo + spinner ("Procesando")
  - `completed` → verde ("Completado")
  - `failed` → rojo ("Error")
- Paginación: siguiente/anterior, total visible.
- Botón "Nueva Generación" → abre FE-004 modal.
- Estado vacío: "No tienes generaciones aún. Crea la primera." + botón CTA.
- Estado loading: skeleton cards.
- Estado error: "No se pudo cargar las generaciones. Reintentar."

**Archivos:**
- `src/app/admin/generations/page.tsx`
- `src/components/admin/generations/GenerationList.tsx`
- `src/components/admin/generations/GenerationCard.tsx`
- `src/components/admin/StatusBadge.tsx`

**No incluir:** csv_path, file_path, photos_zip_path, zip_path — el backend no los retorna.

---

#### FE-004 — Crear generación (modal)

**Dependencias:** FE-003.
**Responsable:** Frontend Engineer.
**Revisores al cierre:** UX Reviewer.

**Contrato backend:** `POST /api/generations` — body `{ name: string }`.

**Pantalla:** Modal sobre el dashboard.
- Campo: "Nombre de la generación" (requerido, max 200 chars).
- Folio prefix y año son asignados automáticamente por el backend — no mostrar en el form.
- Botones: "Cancelar" | "Crear generación".
- Loading: botón deshabilitado + spinner.
- Éxito: cerrar modal → navegar a `/admin/generations/[id]` para continuar el flujo.
- Error: mensaje inline en el modal — "No se pudo crear la generación."

**Archivos:**
- `src/components/admin/generations/CreateGenerationModal.tsx`

---

#### FE-005 — Subir plantilla (template)

**Dependencias:** FE-004 (generación existe).
**Responsable:** Frontend Engineer.
**Revisores al cierre:** UX Reviewer.

**Contrato backend:** `POST /api/generations/[id]/template` — multipart `file` (PNG/JPG).

**Pantalla:** En la página de detalle de la generación (`/admin/generations/[id]`), sección "Plantilla".
- Drop zone o botón para seleccionar archivo.
- Formatos aceptados: PNG, JPG. Mostrar restricción en la UI.
- Tamaño máximo: 10MB. Validar en cliente antes de subir.
- Preview de la imagen subida (thumbnail) si ya existe — usar `has_template` o detectar que la generación tiene template.
- Estado: idle → uploading (barra progreso) → success (thumbnail visible) → error.
- Error de magic bytes: "El archivo no es una imagen válida (PNG/JPG)."
- Re-subir: el nuevo archivo reemplaza el anterior — mostrar advertencia.

**Archivos:**
- `src/app/admin/generations/[id]/page.tsx` (página principal de generación)
- `src/components/admin/generations/TemplateUpload.tsx`

**Nota:** No mostrar `file_path` — el backend no lo retorna. La confirmación de template es implícita: si la respuesta es 200, el template existe.

---

#### FE-007 — Subir CSV de alumnos

**Dependencias:** FE-005 (template debe existir — el backend lo valida pero la UI puede guiar el orden).
**Responsable:** Frontend Engineer.
**Revisores al cierre:** UX Reviewer.

**Contrato backend:** `POST /api/generations/[id]/csv` — multipart `file` (CSV).

**Pantalla:** En `/admin/generations/[id]`, sección "Alumnos".
- Drop zone o botón para CSV.
- Formato: CSV, delimitado por coma. Mostrar columnas requeridas: `student_name`, `program`.
- Enlace de descarga de plantilla CSV (CSV vacío con headers — puede ser un archivo estático en `/public/`).
- Resultado del upload: tabla con resumen — `created`, `errors` por fila.
- Errores de fila: mostrar tabla colapsable: fila, campo, motivo.
- Estado vacío de alumnos: "Sube el CSV para agregar alumnos a esta generación."
- Re-subir: advertencia "Esto reemplazará los alumnos actuales".

**Archivos:**
- `src/components/admin/generations/CsvUpload.tsx`
- `src/components/admin/generations/CsvErrorsTable.tsx`
- `public/plantilla-alumnos.csv` — archivo estático de ejemplo

---

#### FE-008 — Subir ZIP de fotos

**Dependencias:** FE-007 (alumnos/certificados existen — el backend lo valida).
**Responsable:** Frontend Engineer.
**Revisores al cierre:** UX Reviewer.

**Contrato backend:** `POST /api/generations/[id]/photos` — multipart `file` (ZIP).

**Pantalla:** En `/admin/generations/[id]`, sección "Fotos".
- Drop zone para ZIP.
- Límite: 200 MB. Validar en cliente antes de subir.
- Instrucción de formato: "El ZIP debe contener archivos PNG/JPG nombrados con el folio del alumno. Ejemplo: `SEN-2026-001.jpg`."
- Resultado: resumen `{ matched, unmatched, skipped_errors }`.
- Lista de errores por foto: tabla colapsable con `entry`, `reason`, `error_type`.
  - `invalid_file` → "Archivo no válido"
  - `unmatched_folio` → "Folio no encontrado en esta generación"
  - `traversal` → "Nombre de archivo no permitido"
  - `size_limit` → "Archivo demasiado grande"
  - `zip_bomb` → "Archivo comprimido sospechoso"
- Upload de fotos es opcional — la generación puede avanzar sin fotos.

**Archivos:**
- `src/components/admin/generations/PhotosUpload.tsx`
- `src/components/admin/generations/PhotoErrorsTable.tsx`

---

#### FE-009 — Validación pre-vuelo (preflight)

**Dependencias:** FE-007 (CSV subido al menos).
**Responsable:** Frontend Engineer.
**Revisores al cierre:** UX Reviewer.

**Contrato backend:** `GET /api/generations/[id]/preflight` — retorna `{ valid, issues[] }`.

**Pantalla:** En `/admin/generations/[id]`, sección "Validación" o botón "Verificar antes de generar".
- Lista de issues con severidad:
  - `error` → ícono rojo ✗ — bloqueante
  - `warning` → ícono amarillo ⚠ — no bloqueante
- Si `valid: true` → "Todo listo para generar" + botón "Iniciar generación" habilitado.
- Si `valid: false` → "Hay errores que debes corregir antes de generar." + lista de blockers. Botón "Iniciar" deshabilitado.
- Issues conocidos a mapear:
  - `NO_TEMPLATE` → "No hay plantilla subida"
  - `NO_STUDENTS` → "No hay alumnos en esta generación"
  - `NO_FIELD_ZONES` → "La plantilla no tiene zonas configuradas" (warning, no blocker)
  - `MISSING_PHOTOS` → "Hay N alumnos sin foto" (warning)
- Botón "Volver a verificar" para re-ejecutar el preflight.

**Archivos:**
- `src/components/admin/generations/PreflightPanel.tsx`

---

#### FE-010 — Iniciar generación + polling de status

**Dependencias:** FE-009 (preflight `valid: true`).
**Responsable:** Frontend Engineer.
**Revisores al cierre:** UX Reviewer, Security Reviewer.

**Contratos backend:**
- `POST /api/generations/[id]/generate` — inicia generación.
- `GET /api/generations/[id]/status` — status + `{ processed_count, total_count, error_count }`.

**Pantalla:** Modal de progreso o sección de progreso en la página de generación.
- Botón "Iniciar generación" → confirm dialog → POST `/generate`.
- Si la generación ya está en `processing`: mostrar barra de progreso sin volver a hacer POST.
- Barra de progreso: `processed_count / total_count`.
- Polling: cada 3 segundos mientras `status === 'processing'`.
- Estados finales:
  - `completed` → "Generación completada. N diplomas listos." + botón "Descargar ZIP".
  - `failed` → "La generación falló. Revisa los errores." + botón "Descargar reporte de errores".
- Timeout: si polling supera 5 minutos sin cambio → "La generación está tardando más de lo esperado. Recarga la página para verificar el estado."
- Error en POST (conflicto — generación no está en `ready`) → "La generación ya fue iniciada o no está lista."

**Archivos:**
- `src/components/admin/generations/GenerationProgress.tsx`

**Importante:** `POST /generate` con status ≠ `ready` devuelve 409. La UI debe manejarlo sin romper.

---

#### FE-011 — Descargas

**Dependencias:** FE-010 (status `completed`).
**Responsable:** Frontend Engineer.
**Revisores al cierre:** Security Reviewer (Content-Disposition, no exposición de paths).

**Contratos backend:**
- `GET /api/generations/[id]/download` — ZIP binario, `Content-Disposition: attachment; filename=...`
- `GET /api/generations/[id]/errors/csv` — CSV binario.

**Pantalla:** Botones de descarga en la página de generación.
- "Descargar ZIP de diplomas" — disponible solo si `status === 'completed'`.
- "Descargar reporte de errores" — disponible si hay `error_count > 0` (cualquier status post-CSV).
- Descarga mediante `fetch` + `blob` + `URL.createObjectURL` — o link directo `<a href="/api/..." download>` con sesión.
- Loading state en el botón durante la descarga.
- Error: "No se pudo descargar el archivo. Intenta de nuevo."

**Nota de seguridad:** El frontend no maneja `zip_path` ni `csv_path` — el backend gestiona el storage. El link de descarga es siempre a la ruta de la API, nunca a un path interno.

**Archivos:**
- `src/components/admin/generations/DownloadButtons.tsx`

---

### Bloque 3 — Certificados

---

#### FE-012 — Búsqueda y listado de certificados

**Dependencias:** FE-002 (layout).
**Responsable:** Frontend Engineer.
**Revisores al cierre:** UX Reviewer.

**Contrato backend:** `GET /api/certificates?q=&status=&generation_id=&page=&limit=`

**Pantalla:** `/admin/certificates`
- Buscador: campo de texto `q` (folio o nombre del alumno). Debounce 300ms antes de hacer fetch.
- Filtros: dropdown de `status` (`pending`, `active`, `revoked`, `expired`).
- Filtro opcional: generación (dropdown de generaciones del admin).
- Tabla/lista: folio, nombre, programa, status badge, fecha de emisión, has_photo (ícono).
- Link a detalle: cada fila enlaza a `/admin/certificates/[folio]`.
- Paginación: siguiente/anterior.
- Estado vacío: "No se encontraron certificados."
- Estado loading: skeleton rows.

**Status badge (certificados):**
- `pending` → gris ("Pendiente")
- `active` → verde ("Activo")
- `revoked` → rojo ("Revocado")
- `expired` → naranja ("Expirado")

**Archivos:**
- `src/app/admin/certificates/page.tsx`
- `src/components/admin/certificates/CertificateList.tsx`
- `src/components/admin/certificates/CertificateFilters.tsx`

**No exponer:** `verification_token`, `photo_path`, IDs internos.

---

#### FE-013 — Detalle de certificado

**Dependencias:** FE-012.
**Responsable:** Frontend Engineer.
**Revisores al cierre:** UX Reviewer, Security Reviewer.

**Contrato backend:** `GET /api/certificates/[folio]`

**Pantalla:** `/admin/certificates/[folio]`
- Información del certificado: folio, nombre, programa, status, fecha de emisión, generación.
- `has_photo: true` → mostrar indicador "Tiene foto" (no mostrar la foto — requiere endpoint separado no implementado en Sprint 1).
- `has_photo: false` → indicador "Sin foto".
- Si `status === 'revoked'`: mostrar `revoked_at` formateado + `revocation_reason`.
- `generation_id` no se muestra — mostrar `generation.name` + link a la generación.
- Botón "Revocar" → **DESHABILITADO / NO IMPLEMENTAR** — FE-014 diferido a post-MVP (PMVP-REV-001). Puede mostrarse como botón visible pero con tooltip "Próximamente" o simplemente omitirse del MVP.
- Breadcrumb: Admin > Certificados > [folio].

**Archivos:**
- `src/app/admin/certificates/[folio]/page.tsx`
- `src/components/admin/certificates/CertificateDetail.tsx`

---

### Bloque 4 — Landing Pública de Verificación

---

#### FE-015 — Landing pública `/v/[token]`

**Dependencias:** BE-014 (✓ listo). Decisiones DEC-001, DEC-002, DEC-003, DEC-005, DEC-008 — ver §3.
**Responsable:** Frontend Engineer.
**Revisores obligatorios antes de implementar:** UX Reviewer (aprobar wireframe), Security Reviewer.
**Revisores al cierre:** UX Reviewer, Security Reviewer, Architect Reviewer.

**Contrato backend:** `GET /api/verify/[token]` — VerifyResponse:
```ts
{
  valid: boolean
  status: 'pending' | 'active' | 'revoked' | 'expired'
  folio: string
  student_name?: string | null
  program?: string | null
  issued_date?: string | null
  institution: string  // "Seneto"
  message: string      // "Certificado válido" | "Certificado no válido"
}
```

**Pantalla:** `/v/[token]` — **mobile-first, sin autenticación, sin layout admin.**

**Layout visual:**
```
┌─────────────────────────────────────┐
│           Logo / Marca Seneto        │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │   Estado: ✓ DIPLOMA VÁLIDO   │  │  ← verde
│  │   o: ✗ DIPLOMA NO VÁLIDO     │  │  ← rojo
│  └───────────────────────────────┘  │
│                                     │
│  Nombre:    [student_name]           │
│  Programa:  [program]                │
│  Institución: Seneto                 │
│  Folio:     [folio]                  │
│  Emisión:   [issued_date formateada] │
│                                     │
│  ─────────────────────────────────  │
│  [footer con aviso de privacidad]   │
└─────────────────────────────────────┘
```

**Estados de UI por status:**

| Estado | `valid` | UI |
|---|---|---|
| `active` | `true` | Badge verde "DIPLOMA VÁLIDO", checkmark, datos completos |
| `revoked` | `false` | Badge rojo "DIPLOMA NO VÁLIDO" — sin motivo ni fecha de revocación (DEC-003) |
| `expired` | `false` | Badge rojo "DIPLOMA NO VÁLIDO" — sin distinción de motivo en MVP |
| `pending` | `false` | Badge amarillo "DIPLOMA EN PROCESO" — puede no estar emitido aún |

**Manejo de errores HTTP:**

| HTTP | Causa | UI |
|---|---|---|
| 400 | Token con formato inválido | "El enlace de verificación no es válido." |
| 404 | Token no existe | "No se encontró el diploma. Verifica el código QR." |
| 5xx | Error del servidor | "No se pudo verificar el diploma en este momento. Intenta más tarde." |

**Reglas de seguridad y privacidad:**
- **No mostrar foto** (DEC-001 — pendiente, asumir Opción A: sin foto).
- **Nombre:** implementar componente `<StudentName value={student_name} />` — aceptar prop futura `displayMode` para DEC-002.
- **No exponer:** email, token, IDs internos, rutas de storage.
- **No usar folio como URL** — la URL siempre es `/v/[token]` con el UUID.
- Footer visible con aviso de privacidad (DEC-005): enlace a URL institucional de Seneto.
- `Cache-Control: no-store` ya está en el backend — no sobreescribir en el frontend.

**Accesibilidad:**
- Contraste WCAG AA en badge de estado.
- `aria-label` descriptivo en el badge de estado.
- Funcional con lector de pantalla.
- Touch targets mínimo 44px.

**Copy final:** El campo `message` del backend dice "Certificado válido/no válido". **La UI debe mostrar "Diploma válido/no válido"** — renderizar copy propio, no usar `message` directamente.

**Archivos:**
- `src/app/v/[token]/page.tsx`
- `src/components/verify/VerificationCard.tsx`
- `src/components/verify/StudentName.tsx`
- `src/components/verify/VerificationError.tsx`

---

### Bloque 5 — Zone Editor (condicional)

---

#### FE-006 — Zone Editor visual sobre imagen de template

**Estado:** Ticket separado — **no iniciar sin aprobación explícita** del Orchestrator.

**Decisión para este sprint:** El Zone Editor es complejo (drag/resize sobre canvas o DOM, persistencia de coordenadas JSON). Debe evaluarse si entra en Sprint 2 o se difiere a Sprint 3. Criterio de entrada:
- Bloque 1–4 completados y aprobados.
- Tiempo disponible estimado ≥ 5 días.
- Design Reviewer ha aprobado wireframe del editor antes de iniciar.

**Contrato backend:** `PATCH /api/generations/[id]` — body `{ field_zones: FieldZone[] }`.
La estructura interna de `FieldZone` se define al implementar este ticket (ver PROD-DEC-002, `SENETO_DECISIONS.md §7`).

**Descripción:** Editor visual donde el admin arrastra y ajusta zonas sobre la imagen de la plantilla. Cada zona tiene tipo (`text`, `image`, `qr`), posición, dimensiones, y propiedades de render (fuente, tamaño).

**Requerimientos mínimos para MVP:**
- Mostrar la imagen del template como fondo.
- Permitir agregar/mover/redimensionar zonas rectangulares.
- Tipos de zona: `text` (nombre, programa, fecha), `photo`, `qr`.
- Guardar el JSON de zonas vía PATCH.
- Empty state: "Define las zonas antes de generar los diplomas."

**Si no entra en Sprint 2:** La generación puede completarse sin field_zones (el pre-vuelo emite WARNING, no ERROR). Diferir a Sprint 3 sin bloquear el resto.

---

### Tickets transversales

---

#### FE-016 — Estados error/empty/loading (componentes globales)

**Dependencias:** FE-002.
**Responsable:** Frontend Engineer.
**Ejecutar al inicio de Bloque 2** — los estados se usan en todos los tickets siguientes.

**Componentes:**
- `<LoadingSkeleton rows={n} />` — skeleton genérico para listas.
- `<EmptyState icon title description action? />` — estado vacío con CTA opcional.
- `<ErrorState message onRetry />` — error con botón de reintento.
- `<Toast />` — notificaciones de éxito/error (integrar con la librería elegida en FE-001).

**Archivos:**
- `src/components/ui/LoadingSkeleton.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/ErrorState.tsx`

---

#### FE-017 — Aplicar UI Kit funcional

**Dependencias:** FE-016.
**Ejecutar transversalmente** — no es un ticket bloqueante, es una revisión de consistencia visual al final de cada bloque.

**Checklist mínimo:**
- Colores: verde (success/valid), rojo (error/revoked), amarillo (warning/processing), gris (draft/pending).
- Tipografía: sans-serif para admin, EB Garamond solo en la landing pública `/v/[token]`.
- Botones: primario, secundario, destructivo (disabled state visible).
- Touch targets: mínimo 44px en todas las acciones.
- Contraste WCAG AA verificado en badges de status.

---

## 6. Pantallas y rutas

| Ruta | Componente principal | Auth | Sprint 2 Ticket |
|---|---|---|---|
| `/admin/login` | LoginForm | No | FE-001 |
| `/admin/generations` | GenerationList | Sí | FE-003 |
| `/admin/generations/[id]` | GenerationDetail | Sí | FE-005/007/008/009/010/011 |
| `/admin/certificates` | CertificateList | Sí | FE-012 |
| `/admin/certificates/[folio]` | CertificateDetail | Sí | FE-013 |
| `/v/[token]` | VerificationCard | No (público) | FE-015 |

---

## 7. Orden de ejecución

```
FE-016 (UI components base)
    │
FE-001 (Login page + instalación de paquetes)
    │
FE-002 (Admin layout + auth guard)
    │
    ├─────────────────────┬───────────────────────────────────┐
    │                     │                                   │
FE-003                 FE-012                             FE-015
(Generation list)      (Certificate search)              (Landing pública)
    │                     │
FE-004                 FE-013
(Crear generación)     (Detalle certificado)
    │
FE-005 → FE-007 → FE-008 → FE-009 → FE-010 → FE-011
(Template→CSV→Fotos→Preflight→Generate→Download)

FE-006 (Zone Editor) ── si entra en Sprint 2: después de FE-005
FE-017 (UI Kit review) ── al cierre de cada bloque
```

**Paralelizables después de FE-002:** FE-003/FE-004/FE-012/FE-015 pueden ejecutarse en paralelo (diferentes rutas, sin dependencia entre sí). FE-015 puede iniciarse en paralelo si las decisiones DEC-001/002/003/005 están resueltas.

---

## 8. Archivos esperados

| Archivo | Ticket |
|---|---|
| `src/app/admin/login/page.tsx` | FE-001 |
| `src/components/auth/LoginForm.tsx` | FE-001 |
| `src/app/admin/layout.tsx` | FE-002 |
| `src/components/admin/Sidebar.tsx` | FE-002 |
| `src/components/admin/Header.tsx` | FE-002 |
| `src/components/ui/LoadingSkeleton.tsx` | FE-016 |
| `src/components/ui/EmptyState.tsx` | FE-016 |
| `src/components/ui/ErrorState.tsx` | FE-016 |
| `src/components/admin/StatusBadge.tsx` | FE-003 |
| `src/app/admin/generations/page.tsx` | FE-003 |
| `src/components/admin/generations/GenerationList.tsx` | FE-003 |
| `src/components/admin/generations/GenerationCard.tsx` | FE-003 |
| `src/components/admin/generations/CreateGenerationModal.tsx` | FE-004 |
| `src/app/admin/generations/[id]/page.tsx` | FE-005 |
| `src/components/admin/generations/TemplateUpload.tsx` | FE-005 |
| `src/components/admin/generations/CsvUpload.tsx` | FE-007 |
| `src/components/admin/generations/CsvErrorsTable.tsx` | FE-007 |
| `public/plantilla-alumnos.csv` | FE-007 |
| `src/components/admin/generations/PhotosUpload.tsx` | FE-008 |
| `src/components/admin/generations/PhotoErrorsTable.tsx` | FE-008 |
| `src/components/admin/generations/PreflightPanel.tsx` | FE-009 |
| `src/components/admin/generations/GenerationProgress.tsx` | FE-010 |
| `src/components/admin/generations/DownloadButtons.tsx` | FE-011 |
| `src/app/admin/certificates/page.tsx` | FE-012 |
| `src/components/admin/certificates/CertificateList.tsx` | FE-012 |
| `src/components/admin/certificates/CertificateFilters.tsx` | FE-012 |
| `src/app/admin/certificates/[folio]/page.tsx` | FE-013 |
| `src/components/admin/certificates/CertificateDetail.tsx` | FE-013 |
| `src/app/v/[token]/page.tsx` | FE-015 |
| `src/components/verify/VerificationCard.tsx` | FE-015 |
| `src/components/verify/StudentName.tsx` | FE-015 |
| `src/components/verify/VerificationError.tsx` | FE-015 |

---

## 9. Gates de salida — Sprint 2

**No se habilita Sprint 3 hasta que todos los siguientes gates pasen.**

| Gate | Criterio verificable |
|---|---|
| **S2-TS** | `npx tsc --noEmit` → 0 errores |
| **S2-AUTH-LOGIN** | Login con credenciales correctas → redirect a /admin/generations |
| **S2-AUTH-WRONG** | Login con credenciales incorrectas → mensaje "Credenciales inválidas" |
| **S2-AUTH-GUARD** | GET /admin/generations sin sesión → redirect /admin/login |
| **S2-AUTH-GUARD-API** | GET /api/generations sin sesión → 401 (backend, ya verificado S1) |
| **S2-GEN-LIST** | Lista de generaciones renderiza con paginación funcional |
| **S2-GEN-EMPTY** | Sin generaciones → estado vacío con CTA visible |
| **S2-GEN-CREATE** | Modal crear generación → POST → redirect a /admin/generations/[id] |
| **S2-TEMPLATE** | Subir PNG → preview visible; subir .exe → error "archivo no válido" |
| **S2-CSV** | Subir CSV válido → resumen de alumnos; CSV con errores → tabla de errores |
| **S2-PHOTOS** | Subir ZIP → resumen matched/unmatched; ZIP con folio inexistente → error listado |
| **S2-PREFLIGHT** | Pre-vuelo sin template → issue "NO_TEMPLATE" visible; pre-vuelo OK → botón "Iniciar" habilitado |
| **S2-GENERATE** | POST /generate → polling visible → status completed/failed |
| **S2-DOWNLOAD-ZIP** | Botón descargar ZIP → descarga el archivo (completed) |
| **S2-DOWNLOAD-ERR** | Botón descargar errores CSV → descarga el CSV |
| **S2-CERT-SEARCH** | Búsqueda por nombre → lista filtrada; búsqueda vacía → estado vacío |
| **S2-CERT-DETAIL** | GET /admin/certificates/[folio] → datos del certificado visibles |
| **S2-VERIFY-VALID** | GET /v/{uuid-certificado-activo} → badge verde "DIPLOMA VÁLIDO" |
| **S2-VERIFY-REVOKED** | GET /v/{uuid-revocado} → badge rojo "DIPLOMA NO VÁLIDO" sin motivo |
| **S2-VERIFY-404** | GET /v/{uuid-no-existe} → mensaje "No se encontró el diploma" |
| **S2-VERIFY-BADTOKEN** | GET /v/SEN-2026-001 → mensaje "El enlace de verificación no es válido" |
| **S2-VERIFY-NOTOKEN** | GET /v/ (sin token) → 404 de Next.js o redirect |
| **S2-MOBILE-375** | /v/[token] y /admin/generations funcionales en 375px sin scroll horizontal |
| **S2-A11Y-CONTRAST** | Badges de status pasan WCAG AA (verificar con DevTools) |
| **S2-A11Y-TOUCH** | Touch targets ≥ 44px en botones críticos (Chrome DevTools mobile) |
| **S2-NO-SENSITIVE** | DevTools Network: ninguna respuesta de `/api/verify/[token]` contiene `verification_token`, `photo_path`, IDs internos |
| **S2-NO-FOLIO-URL** | No existe ninguna ruta `/v/[folio]` ni link que use folio como parámetro de URL |
| **Review-UX** | UX Reviewer emite "Aprobado para Sprint 3" tras revisar FE-015 y flujo de generación |
| **Review-SEC** | Security Reviewer emite "Aprobado para Sprint 3" — especialmente FE-015 y FE-011 |
| **Review-ARCH** | Architect Reviewer emite "Aprobado para Sprint 3" — contratos, patterns, TypeScript |

---

## 10. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| DEC-002 no resuelta al implementar FE-015 | Alta | Implementar `<StudentName>` con `displayMode` prop. Default: nombre completo. Cambio de decisión solo afecta 1 prop. |
| Polling de generación bloqueando UI en mobile | Media | Polling en background con `setInterval` y cleanup en `useEffect`. No bloquear render. |
| Upload de ZIP de 200MB en conexión lenta — timeout | Alta | Mostrar barra de progreso con `XMLHttpRequest` (soporta `onprogress`). Informar al usuario del tamaño límite antes del upload. |
| Zone Editor subestimado en complejidad | Alta | No iniciar FE-006 sin estimación formal. Si no entra en Sprint 2, el preflight solo emite WARNING, no bloquea. |
| Caché de browser en `/v/[token]` — datos obsoletos | Media | `Cache-Control: no-store` ya está en el backend. El frontend no debe agregar caché adicional a esta ruta. |
| `getServerSession` en pages de App Router — SSR vs Client | Media | Usar Server Components para fetch inicial; Client Components solo para interactividad. Consultar patrón en NextAuth v4 docs. |
| Contraste de badge `pending` (amarillo sobre blanco) | Media | Verificar con DevTools antes de cierre. Ajustar shade si no pasa WCAG AA. |
| `student_name` null en landing pública | Baja | `<StudentName>` debe renderizar "—" o texto omitido si es null. Nunca `null` ni `undefined` visible. |

---

## 11. Equipo y agentes — Sprint 2

### Roster — Resumen ejecutivo

| # | Rol | Tipo | Tickets principales | Momento de intervención |
|---|---|---|---|---|
| 1 | **Frontend Engineer** | Builder | FE-016, FE-001 → FE-015, FE-017 | Cada ticket — implementa y declara cierre |
| 2 | **UX Reviewer** | `product-design` | FE-003→011, FE-012/013, FE-015 | Cierre Bloques 1–4; obligatorio **antes** de FE-015 |
| 3 | **UI/Design Reviewer** | `general-purpose` | **FE-016**, FE-001/002, FE-017 | FE-016 (primer review); cierre Bloques 1–2; cierre Sprint 2 |
| 4 | **Accessibility QA** | `general-purpose` | **FE-016**, **FE-001**, FE-015 | FE-016 (componentes base); cierre Bloque 1 (login); FE-015; cierre Sprint 2 |
| 5 | **Security Reviewer** | `general-purpose` | FE-002, **FE-001**, FE-011, FE-015 | **FE-001** (auth/login); FE-011 (downloads); FE-015 (landing pública); cierre Sprint 2 |
| 6 | **QA / E2E Tester** | `general-purpose` | Todos (smoke por bloque) | Smoke al cierre de cada bloque; E2E completo al cierre Sprint 2 |
| 7 | **Product Owner** | Humano (Seneto) | FE-015 | Obligatorio **antes** de iniciar FE-015 — cierra DEC-001/002/003/005/008 |
| 8 | **Architect Reviewer** | `arquitectura` | Sprint 2 completo | Review final de integración — habilita Sprint 3 |

---

### Flujo de revisión por ticket

```
Frontend Engineer implementa ticket
          │
          ▼
Reviewer(es) del ticket revisan
    (UX / UI/Design / Security / Accessibility QA)
          │
          ├── observaciones no bloqueantes → Frontend aplica o documenta deuda
          │
          └── bloqueante → Frontend corrige → re-review
                    │
                    ▼
         QA / E2E valida gates del bloque
                    │
                    ▼
         Orchestrator declara ticket cerrado
```

**El Orchestrator no cierra un ticket sin que todos los revisores obligatorios de ese ticket hayan emitido su veredicto.**

---

### Confirmaciones explícitas de revisión por ticket

| Ticket | Revisores obligatorios | Gates que aprueban |
|---|---|---|
| **FE-016** (componentes base) | **UI/Design Reviewer** · **Accessibility QA** | role="status"/role="alert", touch target 44px, animate-pulse correcto, jerarquía visual de EmptyState/ErrorState |
| **FE-001** (login page) | **Security Reviewer** · UI/Design Reviewer · Accessibility QA | S2-AUTH-LOGIN, S2-AUTH-WRONG, labels correctos, focus states visibles, contraste |
| **FE-002** (layout + guard) | **Security Reviewer** · UI/Design Reviewer | S2-AUTH-GUARD, S2-AUTH-GUARD-API, nav mobile colapsable |
| **FE-003→011** (generaciones) | UX Reviewer · Security Reviewer (FE-011) · QA/E2E | S2-GEN-*, S2-TEMPLATE, S2-CSV, S2-PHOTOS, S2-PREFLIGHT, S2-GENERATE, S2-DOWNLOAD-* |
| **FE-012/013** (certificados) | UX Reviewer · QA/E2E | S2-CERT-SEARCH, S2-CERT-DETAIL |
| **FE-015** (landing pública) | **Product Owner** · **UX Reviewer** · **Security Reviewer** · **Accessibility QA** · UI/Design Reviewer | S2-VERIFY-*, S2-NO-SENSITIVE, S2-NO-FOLIO-URL, S2-MOBILE-375, S2-A11Y-* |
| **Cierre Sprint 2** | Architect Reviewer · Security Reviewer · QA/E2E · UI/Design Reviewer | Todos los gates S2-* + Review-UX + Review-SEC + Review-ARCH |

---

### Roles — Detalle

#### 1. Frontend Engineer — Builder principal
- **Tipo:** Builder.
- **Tickets:** FE-016, FE-001 a FE-015, FE-017.
- **Responsabilidad:** Implementar todos los tickets. Declara inicio y cierre de cada ticket con gates verificados. No avanza al siguiente ticket sin declaración explícita.

#### 2. UX Reviewer
- **Tipo:** `product-design`.
- **Tickets / momentos:**
  - Cierre de Bloque 1 (FE-001/002): flujo de login y navegación.
  - Cierre de Bloque 2 (FE-003→011): flujo completo de generación — estados vacíos, errores, progreso.
  - Cierre de Bloque 3 (FE-012/013): búsqueda y detalle de certificados.
  - **Obligatorio antes de iniciar FE-015:** aprobar wireframe, estados de UI (valid/revoked/expired/pending), copy ("DIPLOMA VÁLIDO"/"DIPLOMA NO VÁLIDO"), campos visibles según DEC-002/DEC-008.
  - Cierre de Bloque 4 (FE-015): landing pública final.
- **Entregable:** "UX aprobado — [ticket/bloque]" con observaciones o lista de cambios requeridos.

#### 3. UI/Design Reviewer
- **Tipo:** `general-purpose` (con enfoque visual/diseño).
- **Tickets / momentos:**
  - FE-016/FE-017: componentes base y UI Kit — primer review de consistencia visual.
  - Cierre de Bloque 1: jerarquía visual del login y layout admin.
  - Cierre de Bloque 2: consistencia de cards, badges, tablas, upload zones.
  - Cierre de Sprint 2 (review final): revisión integral de consistencia visual, responsive 375px, jerarquía, y UI Kit aplicado.
- **Checklist:**
  - Paleta de colores: verde/rojo/amarillo/gris aplicada consistentemente.
  - Tipografía: sans-serif en admin, EB Garamond solo en `/v/[token]`.
  - Botones: estados primary/secondary/destructive/disabled visibles y distintos.
  - Badges de status: color semántico, tamaño legible, contraste AA.
  - Responsive 375px sin scroll horizontal.
- **Entregable:** "Design aprobado — [bloque]" con lista de ajustes si aplica.

#### 4. Accessibility QA
- **Tipo:** `general-purpose` (con enfoque a11y).
- **Tickets / momentos:**
  - Bloque 1 (FE-001/002): formulario de login — labels, focus states, errores anunciados.
  - FE-015: landing pública — aria-labels en badge de estado, lectura lógica en screen reader.
  - Cierre de Sprint 2: revisión integral de accesibilidad.
- **Checklist:**
  - Contraste WCAG AA (4.5:1 texto normal, 3:1 texto grande) en todos los badges y textos clave.
  - Labels asociados a todos los inputs (`<label htmlFor>` o `aria-label`).
  - Navegación completa por teclado: Tab, Enter, Escape en modales y dropdowns.
  - Focus states visibles (no `outline: none` sin reemplazo).
  - Mensajes de error anunciados con `role="alert"` o `aria-live`.
  - Touch targets ≥ 44px en mobile (gate S2-A11Y-TOUCH).
- **Entregable:** "Accessibility aprobado — [bloque]" o lista de issues con severidad (bloqueante/no bloqueante).

#### 5. Security Reviewer
- **Tipo:** `general-purpose` (con enfoque seguridad).
- **Tickets / momentos:**
  - FE-002: auth guard — middleware + Server Component session check.
  - FE-011: downloads — ninguna URL interna expuesta, Content-Disposition correcto.
  - FE-015: landing pública — no expone verification_token, photo_path, IDs internos; no usa folio como llave de URL.
  - Cierre de Sprint 2: revisión final — S2-NO-SENSITIVE, S2-NO-FOLIO-URL, S2-AUTH-GUARD.
- **Entregable:** "Security aprobado — [ticket/sprint]" con blockers si los hay.

#### 6. QA / E2E Tester
- **Tipo:** `general-purpose`.
- **Momento:** Al cierre de cada bloque (smoke test) y review final de Sprint 2 (E2E completo).
- **Flujo E2E a verificar al cierre de Sprint 2:**
  1. Login → `/admin/generations`
  2. Crear generación → subir template → subir CSV → subir ZIP fotos
  3. Preflight → iniciar generación → polling hasta completed
  4. Descargar ZIP → descargar CSV errores
  5. Buscar certificado → ver detalle
  6. Navegar a `/v/[token]` de un certificado activo → badge "DIPLOMA VÁLIDO"
  7. Navegar a `/v/SEN-2026-001` → error "enlace no válido"
  8. Logout → intentar `/admin/generations` → redirect a login
- **Entregable:** Reporte de gates verificados: PASS/FAIL con evidencia de los gates S2-*.

#### 7. Product Owner / Decision Reviewer
- **Tipo:** Humano (stakeholder Seneto) — no es un agente automático.
- **Momento:** Obligatorio antes de iniciar FE-015.
- **Responsabilidad:** Cerrar o confirmar fallback para las decisiones pendientes:
  - **DEC-001:** Foto pública → fallback MVP: sin foto.
  - **DEC-002:** Nombre completo vs parcial → fallback: nombre completo + componente `<StudentName>` preparado.
  - **DEC-003:** Texto certificado no válido → fallback: "DIPLOMA NO VÁLIDO" genérico.
  - **DEC-005:** Aviso de privacidad → fallback: footer con enlace `#` (placeholder).
  - **DEC-008:** Datos visibles en landing → fallback: campos aprobados técnicamente (valid, folio, institution, program, issued_date, student_name).
- **Si no hay decisión antes de FE-015:** aplicar fallback documentado arriba y continuar. El Product Owner puede actualizar después sin cambio de arquitectura.

#### 8. Architect Reviewer
- **Tipo:** `arquitectura`.
- **Momento:** Review final de Sprint 2 — integración completa.
- **Checklist:**
  - Patrones de fetch (Server vs Client Components) consistentes.
  - No hay fetch de datos sensibles en el cliente que debería estar en el servidor.
  - TypeScript strict — `npx tsc --noEmit` → 0 errores.
  - Contratos de API usados correctamente (shapes, paginación, errores).
  - Ninguna ruta usa folio como parámetro de URL pública.
  - `/v/[token]` no tiene lógica que quebraría si el backend cambia el copy de `message`.
- **Entregable:** "Arquitectura aprobada — Sprint 2. Listo para Sprint 3."

---

### Gates por bloque

| Bloque | Revisores obligatorios al cierre |
|---|---|
| **Bloque 1** — Auth + Layout (FE-001/002/016) | Frontend Engineer ✓ · UI/Design Reviewer · Accessibility QA (formulario login) |
| **Bloque 2** — Generaciones (FE-003→011) | Frontend Engineer ✓ · UX Reviewer · Security Reviewer (FE-011) · QA/E2E (smoke test flujo generación) |
| **Bloque 3** — Certificados (FE-012/013) | Frontend Engineer ✓ · UX Reviewer · QA/E2E (smoke test búsqueda) |
| **Bloque 4** — Landing pública (FE-015) | **Product Owner (DEC-001/002/003/005/008)** · UX Reviewer · Security Reviewer · Accessibility QA · UI/Design Reviewer |
| **Cierre Sprint 2** | Architect Reviewer · Security Reviewer · QA/E2E (E2E completo) · UI/Design Reviewer |

**No se construye PDF, QR, Zone Editor (si no entra en Sprint 2), ni se tocan DNS/GoDaddy en Sprint 2.**

---

## 13. QR Generator — Contrato de URL y ticket verificable

### Alcance por sprint

| Sprint | Alcance |
|---|---|
| **Sprint 2** | Validar que el contrato de URL está correcto en la landing `/v/[token]`. Definir `PUBLIC_VERIFY_BASE_URL`. No generar QR visual todavía. |
| **Sprint 3 / Sprint 1b** | Generar QR e incrustarlo en PNG/PDF del diploma. Ticket: **PDF-003** (ver `BACKLOG.md §4`). |

### Ticket QR-CONTRACT-001 — Contrato de URL de verificación para QR

**Estado:** Validación Sprint 2 — implementación visual Sprint 3.
**Bloquea:** PDF-003 (generación visual de QR en diploma).

**Regla absoluta e invariante:**

```
URL del QR = {PUBLIC_VERIFY_BASE_URL}/v/{certificate.verification_token}
```

- **Correcto:** `https://qa.corporativoseneto.com/v/550e8400-e29b-41d4-a716-446655440000`
- **Incorrecto:** `https://qa.corporativoseneto.com/v/SEN-2026-001` ← PROHIBIDO — folio en URL
- **Incorrecto:** `https://qa.corporativoseneto.com/api/verify/550e8400-...` ← PROHIBIDO — URL de API, no landing
- **Incorrecto:** cualquier URL con email, nombre, CURP, RFC, datos personales en el payload

**El folio puede aparecer visualmente en el diploma como texto impreso, pero nunca como parámetro de URL del QR.**

### Variable de entorno: `PUBLIC_VERIFY_BASE_URL`

Definir en `.env` y `.env.example` antes de PDF-003:

| Ambiente | Valor |
|---|---|
| Local | `http://localhost:3000` |
| QA | `https://qa.corporativoseneto.com` |
| Producción | Pendiente — no definir hasta aprobación DEC-006 |

```bash
# .env.example
PUBLIC_VERIFY_BASE_URL=http://localhost:3000
```

**No hardcodear la URL base** — siempre leer de `process.env.PUBLIC_VERIFY_BASE_URL`.
En Next.js App Router, usar `NEXT_PUBLIC_VERIFY_BASE_URL` si el componente que construye la URL está en el cliente. Si es solo servidor, usar `PUBLIC_VERIFY_BASE_URL`.

### Gates verificables (Sprint 2 — contrato; Sprint 3 — implementación)

| Gate | Criterio | Sprint |
|---|---|---|
| **QR-C1** | Dado `verification_token`, el payload del QR es exactamente `{PUBLIC_VERIFY_BASE_URL}/v/{verification_token}` | Sprint 3 |
| **QR-C2** | Intentar construir URL con `folio` en lugar de `verification_token` → falla test / no compila | Sprint 3 |
| **QR-C3** | El payload del QR no contiene email, nombre, CURP, RFC ni ningún dato personal | Sprint 3 |
| **QR-C4** | El QR no apunta a `/api/verify/[token]` — solo apunta a `/v/[token]` (landing pública) | Sprint 3 |
| **QR-C5** | `GET /v/{verification_token}` (landing) consulta backend por `verification_token` | Sprint 2 — FE-015 |
| **QR-C6** | `GET /v/{uuid-inexistente}` → landing muestra estado "no encontrado" seguro (sin filtrar si existe o no en BD) | Sprint 2 — FE-015 |
| **QR-C7** | `GET /v/{uuid-activo}` → landing muestra datos públicos permitidos (DEC-008) | Sprint 2 — FE-015 |
| **QR-C8** | `GET /v/SEN-2026-001` → backend retorna 400; landing muestra "enlace no válido" | Sprint 2 — FE-015 + BE-014 ✓ |

**QR-C5 a QR-C8 se verifican en Sprint 2 como parte del gate S2-VERIFY-\* de FE-015.**
**QR-C1 a QR-C4 se verifican en Sprint 3 como parte de PDF-003.**

### Relación con landing `/v/[token]`

La landing pública (FE-015) es el destino final del QR. Su URL siempre tiene la forma `/v/{uuid}`. La landing:
1. Recibe el `token` como param de ruta.
2. Llama a `GET /api/verify/[token]`.
3. Renderiza el estado de verificación con los datos públicos permitidos.
4. Nunca redirige a `/api/verify/[token]` ni expone ese endpoint al usuario.

---

## 14. Entregable de confirmación

El Frontend Engineer debe declarar al inicio de cada ticket:
> "Iniciando [TICKET-ID]: [descripción en una línea]."

Y al finalizar cada ticket:
> "Listo [TICKET-ID]: [archivos creados/modificados]. Gates verificados: [lista de gates del ticket]."

El Orchestrator no avanza al siguiente ticket hasta recibir esa declaración.

**Antes de iniciar FE-015, el Frontend Engineer debe obtener aprobación explícita del UX Reviewer en los estados de UI y el copy de verificación.**

---

_Documento preparado por: Technical Orchestrator_
_Fecha: 2026-05-07_
_Sprint 1 cerrado: 2026-05-07_
