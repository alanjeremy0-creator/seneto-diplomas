# Documentation Consistency Audit — Sistema de Diplomas Seneto

_Auditoría de conflictos documentales · 2026-05-07_
_Basada en búsqueda exhaustiva de patrones conflictivos en todos los `.md` del proyecto._

> **Propósito:** Identificar inconsistencias entre documentos para que los agentes sepan qué instrucciones están vigentes y cuáles son obsoletas, sin tener que leer todo el corpus.
>
> **Regla general:** En caso de conflicto, prevalece `PROJECT_EXECUTION_PLAN.md`.

---

## Resumen ejecutivo de conflictos encontrados

| ID | Patrón conflictivo | Documentos afectados | Urgencia |
|----|-------------------|--------------------|---------|
| C-01 | URL pública con folio (`/v/:folio`, `/v/{folio}`, `/v/[folio]`) | `UX_SPEC.md`, `UI_STATES.md`, `WIREFRAMES.md`, `USER_FLOWS.md`, `UX_AUDIT.md` | 🔴 Bloqueante Sprint 2 |
| C-02 | API pública con folio (`/api/verify/:folio`) | `ARCHITECTURE_HANDOFF.md` | 🔴 Bloqueante Sprint 1 |
| C-03 | `photo_url` en `VerifyResponse` pública | `ARCHITECTURE_HANDOFF.md`, `src/types/api.ts` | 🔴 Bloqueante Sprint 1 |
| C-04 | `email` en CSV, tipos y UI | `ARCHITECTURE_HANDOFF.md`, `USER_FLOWS.md`, `WIREFRAMES.md`, `UX_SPEC.md`, `src/types/index.ts` | 🟡 Bloqueante Sprint 2 |
| C-05 | AuditLog marcado como "no existe" o "post-MVP" | `UX_SPEC.md`, `UI_STATES.md`, `SECURITY_AUDIT.md` (descripción histórica) | 🟡 Informativo — no bloquea si se lee `PROJECT_EXECUTION_PLAN.md` |
| C-06 | Foto pública visible por defecto en wireframes | `WIREFRAMES.md`, `ARCHITECTURE_HANDOFF.md` | 🔴 Bloqueante Sprint 2 |
| C-07 | QR apunta a folio secuencial | `ARCHITECTURE_HANDOFF.md`, `UX_SPEC.md` (implícito) | 🔴 Bloqueante Sprint 0 |
| C-08 | Confirmación tipada en revocación como requerimiento MVP | `UX_AUDIT.md` | 🟡 Decisión pendiente Seneto |
| C-09 | "nombre completo" vs dato visible en página pública sin decisión | `PROJECT_EXECUTION_PLAN.md`, `UX_REMEDIATION_PLAN.md` | 🟡 Decisión pendiente Seneto |

---

## C-01 — URL pública con folio en lugar de token

**Decisión vigente:** `/v/[token]` donde `[token]` es `verification_token` (UUID). El folio visible en la UI como texto, pero nunca como llave de acceso.

| Archivo | Sección / Línea | Texto conflictivo | Decisión vigente | Acción recomendada |
|---------|----------------|------------------|------------------|--------------------|
| `UX_SPEC.md` | L69 — Perfil Egresado | `Llega directamente a /v/:folio — no pasa por ningún menú ni login.` | `/v/[token]` con UUID | Actualizar antes de Sprint 2. Reemplazar `:folio` por `[token]`. |
| `UX_SPEC.md` | L99 — Terminología | `En la UI pública (/v/:folio) se usa "Diploma"` | `/v/[token]` | Actualizar antes de Sprint 2. |
| `USER_FLOWS.md` | F-11 — Verificación pública | URL del flujo referencia folio en URL | `/v/[token]` | Actualizar F-11 para usar token antes de Sprint 2. |
| `WIREFRAMES.md` | Pantalla verificación pública | `/v/[folio]` como URL de la pantalla | `/v/[token]` | Actualizar wireframe de pantalla pública antes de Sprint 2. |
| `UI_STATES.md` | Estados página pública | URL de la pantalla como `/v/:folio` | `/v/[token]` | Actualizar antes de Sprint 2. |
| `UX_AUDIT.md` | HC2 L35–40 | Describe el problema y menciona `/v/{folio}` como la URL actual problemática | Hallazgo correcto — la corrección está en `PROJECT_EXECUTION_PLAN.md` | No modificar — es evidencia del hallazgo, no instrucción. |
| `UX_REMEDIATION_PLAN.md` | L16, L84 | Menciona `/v/{folio}` como lo que hay que corregir | Corrección ya documentada | No modificar — es la instrucción de corrección. |

**Nota:** `UX_AUDIT.md` y `UX_REMEDIATION_PLAN.md` no están en conflicto — describen el problema y su solución, no instruyen usarlo.

---

## C-02 — API pública con folio como parámetro

**Decisión vigente:** La verificación pública usa token UUID. Endpoint: `/api/verify/[token]` o lógica en `src/app/v/[token]/page.tsx`. **Nunca lookup por folio.**

| Archivo | Sección / Línea | Texto conflictivo | Decisión vigente | Acción recomendada |
|---------|----------------|------------------|------------------|--------------------|
| `ARCHITECTURE_HANDOFF.md` | L248 — tabla VerifyResponse | `VerifyResponse { status, folio, student_name?, program?, issued_date?, institution, photo_url? }` — implica URL con folio como context | Lookup siempre por `verification_token` | Backend no implementar lookup por folio. Archivo histórico — no modificar. |
| `ARCHITECTURE_HANDOFF.md` | Referencias a `/verify/{folio}` | URL de verificación con folio | `/api/verify/[token]` o lógica en server component | Mantener como histórico. Cualquier agente que lea esto debe cruzar con `PROJECT_EXECUTION_PLAN.md` §9.6. |
| `PROJECT_EXECUTION_PLAN.md` | L36, L158 | Documenta explícitamente que `/api/verify/:folio` es obsoleto | `/api/verify/[token]` | Sin acción — ya resuelto en el documento maestro. |

---

## C-03 — `photo_url` en `VerifyResponse` pública

**Decisión vigente:** `photo_url` NO se incluye en `VerifyResponse` por defecto en MVP. Decisión de mostrar foto pública está pendiente de aprobación de Seneto. Hasta entonces, campo excluido.

| Archivo | Sección / Línea | Texto conflictivo | Decisión vigente | Acción recomendada |
|---------|----------------|------------------|------------------|--------------------|
| `ARCHITECTURE_HANDOFF.md` | L248 | `VerifyResponse { ..., photo_url? }` — `photo_url` como campo opcional de la respuesta pública | `photo_url` excluido del MVP | Histórico — no modificar. Backend debe ignorar esta spec y usar `PROJECT_EXECUTION_PLAN.md` §9.6. |
| `src/types/api.ts` | L90–98 | `VerifyResponse` incluye campo `photo_url?` | Excluir de MVP | **Acción:** Backend debe actualizar el tipo en Sprint 0 o Sprint 1. Eliminar `photo_url` de `VerifyResponse` hasta que Seneto apruebe. |
| `SECURITY_AUDIT.md` | L14, L38, L77, L165–167 | Identifica `photo_url` en `VerifyResponse` como riesgo de privacidad | `photo_url` excluido por defecto | Sin acción — documento de evidencia. Correctamente identificado como riesgo. |
| `SECURITY_REMEDIATION_PLAN.md` | L747 | `Privacy-2: La decisión sobre photo_url en la respuesta pública está documentada y aprobada por Seneto` | Pendiente decisión Seneto | Sin acción — es el checklist de validación correcto. |
| `UX_REMEDIATION_PLAN.md` | L470, L647, L687 | Instrucciones correctas: `VerifyResponse` no incluye `photo_url` | Alineado con decisión vigente | Sin acción — ya correcto. |
| `PROJECT_EXECUTION_PLAN.md` | L116, L162, L428, L753 | Define explícitamente la exclusión de `photo_url` por defecto | Fuente de verdad | Sin acción — es la fuente vigente. |

---

## C-04 — Campo `email` en CSV, tipos de datos y UI

**Decisión vigente:** `email` está **fuera del alcance MVP**. No recolectar, no almacenar como requerido, no exponer en respuestas. El CSV de MVP no debe requerir `email`.

| Archivo | Sección / Línea | Texto conflictivo | Decisión vigente | Acción recomendada |
|---------|----------------|------------------|------------------|--------------------|
| `ARCHITECTURE_HANDOFF.md` | L222, L307 | `StudentCSVRow` incluye `email?`; tabla CSV incluye columna `email` | `email` fuera de MVP — no requerido | Histórico — no modificar. Backend ignorar email como campo requerido. |
| `ARCHITECTURE_HANDOFF.md` | L220 | `Certificate` interface incluye `email?` | `email` excluido del scope de datos MVP | Histórico. Backend: no incluir `email` en `select` de Prisma para respuestas. |
| `USER_FLOWS.md` | L254 | Tabla de columnas CSV incluye `email | No | Email del participante` | CSV MVP sin email requerido | Actualizar antes de Sprint 2. Eliminar fila de `email` o marcar como "excluido MVP". |
| `WIREFRAMES.md` | L370 | Preview de CSV con columna `email` visible | CSV MVP sin `email` | Actualizar antes de Sprint 2. |
| `UX_SPEC.md` | L142 | Checklist de validación pre-vuelo incluye `email` como campo opcional | `email` fuera de MVP | Actualizar antes de Sprint 2. Eliminar referencia a email. |
| `src/types/index.ts` | `email?` en `Certificate` y `StudentCSVRow` | Campo `email` en los tipos | Excluido del scope MVP | **Acción:** Backend revisar si debe eliminar el campo de los tipos o marcarlo explícitamente como post-MVP. Nunca incluir en `VerifyResponse`. |
| `fixtures/students-sample.csv` | Encabezados | Puede incluir columna `email` | CSV MVP no requiere ni usa email | Backend: el parser debe ignorar `email` sin error. No bloquear CSV que incluya email — simplemente ignorar. |
| `PROJECT_EXECUTION_PLAN.md` | L163, L233, L371 | Define explícitamente que `email` está fuera de MVP | Fuente de verdad | Sin acción — es la fuente vigente. |

---

## C-05 — AuditLog marcado como inexistente o post-MVP

**Decisión vigente:** `AuditLog` es **obligatorio desde MVP y Sprint 0**. No es post-MVP. Bloquea el paso de Sprint 0 a Sprint 1.

| Archivo | Sección / Línea | Texto conflictivo | Decisión vigente | Acción recomendada |
|---------|----------------|------------------|------------------|--------------------|
| `UX_SPEC.md` | L178 | `Historial de cambios de estado (audit log) — No existe. La fecha de revocación sí se muestra, pero sin historial previo.` | AuditLog obligatorio desde Sprint 0 | Actualizar antes de Sprint 2. Texto debe decir: "Implementado desde Sprint 0". |
| `UI_STATES.md` | L51 | `[Recomendación de seguridad — Pendiente de confirmar con Backend si se implementa en MVP. Si no, este estado es post-MVP.]` | AuditLog es MVP obligatorio | Actualizar antes de Sprint 2. Eliminar nota post-MVP. |
| `SECURITY_AUDIT.md` | L13, L85 | Describe C5 como "ausencia total de audit log" | Descripción histórica del estado antes del audit | Sin acción — es evidencia del hallazgo. El plan de remediación ya lo resuelve. |
| `UX_REMEDIATION_PLAN.md` | L107, L508, L510, L658 | Referencias correctas a AuditLog como obligatorio | Alineado con decisión vigente | Sin acción. |
| `PROJECT_EXECUTION_PLAN.md` | L161, L194, L597 | Define AuditLog como obligatorio MVP, bloqueante en gate de Sprint 0 | Fuente de verdad | Sin acción. |

---

## C-06 — Foto pública visible por defecto en wireframes/handoff

**Decisión vigente:** La foto del participante **no se muestra por defecto en MVP** en la página pública `/v/[token]`. Requiere aprobación explícita de Seneto.

| Archivo | Sección / Línea | Texto conflictivo | Decisión vigente | Acción recomendada |
|---------|----------------|------------------|------------------|--------------------|
| `WIREFRAMES.md` | Pantalla verificación pública | Wireframe muestra foto del participante en el estado "válido" | No mostrar foto por defecto en MVP | Actualizar wireframe antes de Sprint 2. Reemplazar foto con espacio vacío o placeholder marcado como "post-MVP". |
| `ARCHITECTURE_HANDOFF.md` | L248 | `VerifyResponse` incluye `photo_url?` como parte del contrato | `photo_url` excluido del MVP | Histórico. No modificar — Backend toma la decisión en implementación. |
| `UX_REMEDIATION_PLAN.md` | L50, L94 | Instrucciones correctas: no foto pública por defecto; datos mínimos mostrados | Alineado con decisión vigente | Sin acción — ya correcto. |
| `PROJECT_EXECUTION_PLAN.md` | §7.3, L116, L162, L772 | Define explícitamente: foto no pública por defecto en MVP | Fuente de verdad | Sin acción. |

---

## C-07 — QR apunta a folio secuencial en lugar de token

**Decisión vigente:** El código QR del diploma debe apuntar a `{BASE_URL}/v/{verification_token}` (UUID). Nunca al folio secuencial.

| Archivo | Sección / Línea | Texto conflictivo | Decisión vigente | Acción recomendada |
|---------|----------------|------------------|------------------|--------------------|
| `ARCHITECTURE_HANDOFF.md` | Referencias a generación de QR | Generación de QR sin especificar que usa `verification_token` | QR → `{BASE_URL}/v/{verification_token}` | Histórico. PDF/Image Generation Agent debe implementar según `PROJECT_EXECUTION_PLAN.md` SEC-012. |
| `PLAN.md` (raíz) | Sección de generación | Puede referenciar QR con folio | QR usa `verification_token` | Histórico — superado por `PROJECT_EXECUTION_PLAN.md`. |
| `PROJECT_EXECUTION_PLAN.md` | L41, L159, L497, L918 | Define explícitamente: `QR → {BASE_URL}/v/{verification_token}` | Fuente de verdad | Sin acción. Ticket SEC-012. |
| `src/types/index.ts` | Si contiene lógica de QR | Verificar que no referencia folio | QR usa `verification_token` | PDF/Image Generation Agent: validar en implementación. |

---

## C-08 — Confirmación tipada en revocación como requerimiento MVP

**Decisión vigente:** Confirmación tipada (escribir "REVOCAR" o el folio) es **post-MVP**. En MVP solo se requiere motivo de texto mínimo 10 caracteres.

| Archivo | Sección / Línea | Texto conflictivo | Decisión vigente | Acción recomendada |
|---------|----------------|------------------|------------------|--------------------|
| `UX_AUDIT.md` | L101 | `Confirmación tipada (ej. escribir "REVOCAR" o el folio)` listada como mejora | Post-MVP — en MVP solo motivo obligatorio | No modificar — es un hallazgo de la auditoría, no una instrucción de implementación. Frontend no implementar en MVP. |
| `PROJECT_EXECUTION_PLAN.md` | L165, L775 | Define: "motivo mínimo 10 en MVP; confirmación tipada post-MVP" | Fuente de verdad | Sin acción. |
| `UX_REMEDIATION_PLAN.md` | L104, L508 | Alineado: campo de motivo requerido, mínimo 10 caracteres | Alineado con decisión vigente | Sin acción. |

---

## C-09 — Nombre del participante visible en página pública (decisión pendiente)

**Estado:** No es un conflicto documental — es una **decisión pendiente de Seneto**. Pero existe ambigüedad entre documentos.

| Archivo | Sección | Texto | Estado |
|---------|---------|-------|--------|
| `UX_REMEDIATION_PLAN.md` | L94 | `Los datos mínimos mostrados son: nombre completo, programa, institución, fecha de emisión, folio (texto), estado.` | Recomendación del auditor |
| `PROJECT_EXECUTION_PLAN.md` | L251 | `Nombre completo o parcial — Pendiente de decisión Seneto. Recomendación actual: nombre completo si se requiere verificación efectiva.` | Decisión pendiente — no cerrada |
| `PROJECT_EXECUTION_PLAN.md` | L773 | Tabla de decisiones pendientes: `Nombre completo vs parcial` | Bloquea Sprint 2 |

**Acción recomendada:** No implementar lógica de nombre en Frontend hasta que Seneto documente la decisión. El Backend puede almacenar nombre completo; el Frontend lo mostrará cuando Seneto apruebe.

---

## Matriz de acciones requeridas

### Sprint 0 (Backend Security Engineer)

| Conflicto | Archivo a corregir | Acción concreta |
|-----------|--------------------|-----------------|
| C-03 | `src/types/api.ts` | Eliminar `photo_url` de `VerifyResponse` |
| C-07 | Implementación de QR | Generar QR con `{BASE_URL}/v/{verification_token}` |

### Sprint 1 (Backend Security Engineer)

| Conflicto | Archivo a corregir | Acción concreta |
|-----------|--------------------|-----------------|
| C-02 | Implementación | Lookup de verificación solo por `verification_token`, nunca por folio |
| C-04 | `src/types/index.ts` | Revisar si `email` debe eliminarse o marcarse como post-MVP |

### Antes de Sprint 2 (Technical Orchestrator)

| Conflicto | Archivo a corregir | Acción concreta |
|-----------|--------------------|-----------------|
| C-01 | `UX_SPEC.md`, `USER_FLOWS.md`, `WIREFRAMES.md`, `UI_STATES.md` | Reemplazar todas las referencias a `/v/:folio` o `/v/{folio}` por `/v/[token]` |
| C-04 | `USER_FLOWS.md`, `WIREFRAMES.md`, `UX_SPEC.md` | Eliminar `email` de CSV previews y specs |
| C-05 | `UX_SPEC.md`, `UI_STATES.md` | Actualizar estado de AuditLog a "obligatorio desde Sprint 0" |
| C-06 | `WIREFRAMES.md` | Eliminar foto del wireframe de verificación pública; marcar como post-MVP |

### No requieren acción de código (históricos)

| Conflicto | Archivos | Motivo |
|-----------|---------|--------|
| C-02 | `ARCHITECTURE_HANDOFF.md` | Histórico. Leer con `PROJECT_EXECUTION_PLAN.md`. |
| C-03 | `ARCHITECTURE_HANDOFF.md`, `SECURITY_AUDIT.md` | Histórico / evidencia. No modificar. |
| C-04 | `ARCHITECTURE_HANDOFF.md` | Histórico. Backend ignora en implementación. |
| C-07 | `ARCHITECTURE_HANDOFF.md` | Histórico. PDF Agent implementa según plan maestro. |

---

## Patrones de búsqueda — Referencia para futuras auditorías

Si un agente encuentra alguno de estos patrones en documentos que NO sean `PROJECT_EXECUTION_PLAN.md`, debe considerarlo potencialmente obsoleto:

| Patrón | Reemplazar por | Urgencia |
|--------|----------------|---------|
| `/v/:folio` | `/v/[token]` | 🔴 Crítico |
| `/v/{folio}` | `/v/[token]` | 🔴 Crítico |
| `/v/[folio]` | `/v/[token]` | 🔴 Crítico |
| `/api/verify/:folio` | `/api/verify/[token]` | 🔴 Crítico |
| `/verify/{folio}` | `/api/verify/[token]` | 🔴 Crítico |
| `photo_url` en respuestas públicas | Excluir del MVP | 🔴 Crítico |
| `email` en CSV como requerido | Email fuera de MVP | 🟡 Importante |
| "audit log no existe" | AuditLog obligatorio desde Sprint 0 | 🟡 Importante |
| "audit log post-MVP" | AuditLog obligatorio desde Sprint 0 | 🟡 Importante |
| QR con folio secuencial | QR con `verification_token` | 🔴 Crítico |
| Foto visible en `/v/...` | No foto por defecto en MVP | 🔴 Crítico |

---

_Auditoría realizada el 2026-05-07 · Technical Orchestrator / Documentation QA_
_Basada en búsqueda textual de todos los archivos `.md` del proyecto._
_Actualizar este documento si se agregan nuevos documentos con conflictos potenciales._
