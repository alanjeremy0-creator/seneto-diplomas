# DOCS INDEX — Sistema de Diplomas Seneto

_Índice maestro de documentación · Última actualización: 2026-05-07 (rev. Sprint 0 Orchestration)_
_Mantenido por: Technical Orchestrator / Documentation QA_

> Este documento es el **punto de entrada único** para cualquier agente antes de iniciar trabajo en el proyecto.
> Lee este índice antes de leer cualquier otro documento.

---

## Regla general de lectura para agentes

1. Lee siempre `PROJECT_EXECUTION_PLAN.md` primero.
2. Si hay conflicto con otro documento, prevalece el orden de jerarquía de la Sección 1.
3. Cualquier referencia a `/v/:folio`, `/v/{folio}`, `/api/verify/:folio` en documentos marcados como **histórico** o **requiere actualización** es obsoleta — la URL vigente es `/v/[token]`.
4. `email` en CSV/tipos de datos viejos está fuera del MVP — no recolectar ni exponer.
5. `AuditLog` es obligatorio desde Sprint 0 — cualquier doc que lo marque como post-MVP está desactualizado.

---

## 1. Jerarquía de fuentes de verdad (orden de prevalencia)

| Prioridad | Documento | Rol en conflictos |
|-----------|-----------|-------------------|
| 1 | `PROJECT_EXECUTION_PLAN.md` | Documento maestro. Gana siempre. |
| 2 | `SECURITY_REMEDIATION_PLAN.md` | Trabajo ejecutable de seguridad. |
| 3 | `SECURITY_AUDIT.md` | Evidencia técnica de riesgos. |
| 4 | `UX_REMEDIATION_PLAN.md` | Trabajo ejecutable de UX/privacidad. |
| 5 | `UX_AUDIT.md` | Hallazgos UX/Product Design. |
| 6 | `UI_KIT.md` + `UI_KIT_FUNCTIONAL_P1.md` + `UI_KIT_FUNCTIONAL_P2.md` | Tokens visuales y reglas de accesibilidad. |
| 7 | `ARCHITECTURE_HANDOFF.md` | Handoff técnico inicial — histórico. |
| 8 | `UX_SPEC.md`, `USER_FLOWS.md`, `WIREFRAMES.md`, `COPY.md`, `UI_STATES.md` | Documentos UX originales — requieren actualización. |

---

## 2. Inventario completo de documentos

### Documentos en `docs/`

---

#### `SPRINT0_ORCHESTRATION.md`
- **Estado:** ✅ Vigente — plan de ejecución activo
- **Última actualización:** 2026-05-07
- **Qué es:** Plan operativo de Sprint 0. Contiene: estado actual confirmado del repo, orden de tickets SEC-001 a SEC-008 con detalle de implementación, gates de salida verificables, riesgos, y los tres prompts de agente (Backend Security Engineer, Architect Reviewer, Security QA). Único documento con los prompts completos de Sprint 0.
- **Fuente de verdad para:** Ejecución de Sprint 0. Prompts de agentes de Sprint 0. Gates de salida antes de Sprint 1.
- **Agentes que deben leerlo:** Backend Security Engineer, Architect Reviewer, Security QA — todos antes de iniciar cualquier trabajo de Sprint 0.
- **Notas:** En caso de conflicto con este documento y `PROJECT_EXECUTION_PLAN.md`, prevalece el plan maestro.

---

#### `PROJECT_EXECUTION_PLAN.md`
- **Estado:** ✅ Vigente — fuente operativa principal
- **Última actualización:** 2026-05-07
- **Qué es:** Documento maestro de orquestación. Define qué construir, en qué orden, qué sprints existen, qué decisiones están cerradas y qué gates bloquean el avance.
- **Fuente de verdad para:** Todo. Prevalece sobre todos los demás documentos en caso de conflicto.
- **Agentes que deben leerlo:** Todos, siempre, antes que cualquier otro documento.
- **Notas:** Incluye decisiones consolidadas (Sección 5) que corrigen documentos anteriores. Incluye la regla de conflicto de URLs (Sección 1). Incluye la tabla de docs que deben actualizarse (Sección 14).

---

#### `SECURITY_REMEDIATION_PLAN.md`
- **Estado:** ✅ Vigente — plan de remediación ejecutable
- **Última actualización:** 2026-05-07
- **Qué es:** Plan detallado de tareas de seguridad derivadas del Security Audit. Organizado por criticidad (C1–C5) y por sprint.
- **Fuente de verdad para:** Implementación de seguridad. Orden de prioridad de correcciones.
- **Agentes que deben leerlo:** Backend Security Engineer, Architect Reviewer, Security QA.
- **Notas:** Contiene specs técnicas de implementación para cada hallazgo. Prevalece sobre `SECURITY_AUDIT.md` en caso de discrepancia en el cómo corregir.

---

#### `SECURITY_AUDIT.md`
- **Estado:** ✅ Vigente — evidencia de riesgos
- **Última actualización:** 2026-05-07
- **Qué es:** Auditoría técnica de seguridad que identificó 5 criticidades (C1–C5) y hallazgos menores. Es la evidencia que justifica el Sprint 0.
- **Fuente de verdad para:** Descripción de riesgos identificados. Evidencia de por qué se toman decisiones de seguridad específicas.
- **Agentes que deben leerlo:** Backend Security Engineer, Architect Reviewer, Security QA.
- **Notas:** C1–C5 son bloqueantes para pasar de Sprint 0 a Sprint 1. El documento describe los hallazgos; `SECURITY_REMEDIATION_PLAN.md` dice cómo resolverlos.

---

#### `UX_REMEDIATION_PLAN.md`
- **Estado:** ✅ Vigente — plan de remediación UX ejecutable
- **Última actualización:** 2026-05-07
- **Qué es:** Plan de correcciones UX derivadas de la auditoría. Abarca privacidad, accesibilidad, mobile-first, copy y estados críticos.
- **Fuente de verdad para:** Decisiones UX post-auditoría. Correcciones a documentos UX originales.
- **Agentes que deben leerlo:** Frontend Engineer, Product Designer Reviewer, Technical Orchestrator.
- **Notas:** Contiene las decisiones UX vigentes que reemplazan instrucciones antiguas de `WIREFRAMES.md`, `USER_FLOWS.md` y `UX_SPEC.md`.

---

#### `UX_AUDIT.md`
- **Estado:** ✅ Vigente — hallazgos UX
- **Última actualización:** 2026-05-07
- **Qué es:** Auditoría de UX/Product Design que identificó conflictos de URL, privacidad de foto, copy insuficiente y problemas de accesibilidad.
- **Fuente de verdad para:** Descripción de hallazgos UX. Justificación de las correcciones en `UX_REMEDIATION_PLAN.md`.
- **Agentes que deben leerlo:** Frontend Engineer, Product Designer Reviewer.
- **Notas:** El hallazgo HC2 (URLs con folio) ya está resuelto en `PROJECT_EXECUTION_PLAN.md`. No implementar sin cruzar con la remediación.

---

#### `UI_KIT.md`
- **Estado:** ✅ Vigente — tokens visuales oficiales
- **Última actualización:** 2026-05-07
- **Qué es:** Tokens de diseño de la Dirección B "Cálida elevada": paleta de color, tipografía, espaciado, radios, sombras, componentes base, iconografía, assets de marca, config Tailwind.
- **Fuente de verdad para:** Identidad visual. Tokens CSS y Tailwind. Dirección estética.
- **Agentes que deben leerlo:** Frontend Engineer, Product Designer Reviewer.
- **Notas:** La sección 11 enlaza a los documentos de hardening funcional. Leer siempre en conjunto con `UI_KIT_FUNCTIONAL_P1.md` y `UI_KIT_FUNCTIONAL_P2.md`.

---

#### `UI_KIT_FUNCTIONAL_P1.md`
- **Estado:** ✅ Vigente — reglas funcionales de accesibilidad
- **Última actualización:** 2026-05-07
- **Qué es:** Auditoría funcional del UI Kit. Cubre: token `--touch-min: 44px`, focus global `:focus-visible`, auditoría de contrastes WCAG AA con ajustes propuestos, reglas de motion accesible, tokens Tailwind actualizados.
- **Fuente de verdad para:** Accesibilidad WCAG AA. Touch targets. Motion.
- **Agentes que deben leerlo:** Frontend Engineer, Product Designer Reviewer.
- **Notas:** Propone ajustes mínimos a 5 tokens de color de badge para cumplir WCAG AA sin cambiar identidad visual.

---

#### `UI_KIT_FUNCTIONAL_P2.md`
- **Estado:** ✅ Vigente — reglas funcionales de componentes
- **Última actualización:** 2026-05-07
- **Qué es:** Continuación del hardening funcional. Cubre: 10 estados críticos de UI, specs de la página pública `/v/[token]`, tabla admin responsive (desktop→cards en mobile), ZoneEditor completo, checklist final de 35 ítems para Frontend.
- **Fuente de verdad para:** Estados de UI. Layout de página pública. ZoneEditor. Checklist de implementación.
- **Agentes que deben leerlo:** Frontend Engineer, Product Designer Reviewer.
- **Notas:** El checklist final es un contrato de calidad que el Product Designer debe validar antes del gate de Sprint 2.

---

#### `ARCHITECTURE_HANDOFF.md`
- **Estado:** ⚠️ Histórico — referencia técnica inicial con referencias obsoletas
- **Última actualización:** 2026-05-07 (documento original — no actualizado post-auditoría)
- **Qué es:** Documento de handoff de la fase de arquitectura. Describe el scaffold, dependencias, modelos de datos iniciales, decisiones técnicas y el storage adapter.
- **Fuente de verdad para:** Contexto de cómo se construyó el scaffold. Prisma 7 breaking change. StorageAdapter.
- **Agentes que deben leerlo:** Backend Security Engineer, Architect Reviewer, PDF/Image Generation Agent.
- **Notas:** ⚠️ Contiene referencias obsoletas: `VerifyResponse` incluye `photo_url` (desactualizado — no incluir en MVP), columnas CSV incluyen `email` (fuera de MVP), URL `/verify/{folio}` (obsoleta — usar `/v/[token]`). Leer siempre cruzando con `PROJECT_EXECUTION_PLAN.md` Sección 5. Válido como referencia técnica de implementación de librerías y patterns.

---

#### `UX_SPEC.md`
- **Estado:** ⚠️ Requiere actualización — base válida con referencias obsoletas
- **Última actualización:** Original — no actualizado post-auditoría
- **Qué es:** Especificación UX original. Principios de diseño, perfiles de usuario, terminología del sistema, reglas de la validación pre-vuelo.
- **Fuente de verdad para:** Terminología oficial ("Generación", "Diploma", "Zona", etc.). Principios UX base. Validación pre-vuelo.
- **Agentes que deben leerlo:** Frontend Engineer, Product Designer Reviewer.
- **Notas:** ⚠️ Contiene: `/v/:folio` (obsoleto → `/v/[token]`), `email` como campo opcional del CSV (fuera de MVP), "audit log no existe" (obsoleto → ya es obligatorio en MVP). Ver `PROJECT_EXECUTION_PLAN.md` Sección 14 para correcciones requeridas antes de Sprint 2.

---

#### `USER_FLOWS.md`
- **Estado:** ⚠️ Requiere actualización — flujos válidos con referencias obsoletas
- **Última actualización:** Original — no actualizado post-auditoría
- **Qué es:** Flujos de usuario completos para admin y visitante público. Cubre F-01 a F-15+ (login, generación, subida de CSV/fotos, generación, descarga, revocación, verificación pública).
- **Fuente de verdad para:** Flujos de interacción base. Secuencia de pasos por feature.
- **Agentes que deben leerlo:** Frontend Engineer, Backend Security Engineer, Product Designer Reviewer.
- **Notas:** ⚠️ Contiene: F-11 (verificación pública) con URL `/v/{folio}` (obsoleta → `/v/[token]`), F-14 (revocación) sin AuditLog obligatorio (obsoleto), campo `email` en CSV preview (fuera de MVP). Ver `PROJECT_EXECUTION_PLAN.md` Sección 14.

---

#### `WIREFRAMES.md`
- **Estado:** ⚠️ Requiere actualización — referencia visual con referencias obsoletas
- **Última actualización:** Original — no actualizado post-auditoría
- **Qué es:** Wireframes textuales de todas las pantallas del sistema (admin + pública). Referencia para el layout y estructura visual.
- **Fuente de verdad para:** Estructura visual de pantallas. Orden de elementos en cada vista.
- **Agentes que deben leerlo:** Frontend Engineer, Product Designer Reviewer.
- **Notas:** ⚠️ Contiene: pantalla de verificación pública con `/v/[folio]` y foto del participante visible (ambos obsoletos), CSV preview con columna `email` (fuera de MVP), motivo de revocación sin mínimo de 10 caracteres. Ver `PROJECT_EXECUTION_PLAN.md` Sección 14.

---

#### `COPY.md`
- **Estado:** ⚠️ Requiere actualización — textos base con gaps post-auditoría
- **Última actualización:** Original — no actualizado post-auditoría
- **Qué es:** Repositorio de todos los textos de la UI en español. Cubre login, dashboard, generaciones, estados de carga, errores, página pública.
- **Fuente de verdad para:** Textos oficiales de la UI. Terminología aprobada por Seneto.
- **Agentes que deben leerlo:** Frontend Engineer, Product Designer Reviewer.
- **Notas:** ⚠️ Faltan: copy para página pública `/v/[token]` con estados `revocado`, `expirado`, `no encontrado`, `error 500`; copy para estados `no válido` vs `revocado` (decisión pendiente de Seneto UX-010); copy de motivo de revocación con validación mínima 10 caracteres. Ver `PROJECT_EXECUTION_PLAN.md` Sección 14.

---

#### `UI_STATES.md`
- **Estado:** ⚠️ Requiere actualización — estados con referencias obsoletas
- **Última actualización:** Original — no actualizado post-auditoría
- **Qué es:** Especificación de estados de UI por componente: formularios, tablas, modales, estados de generación, página pública.
- **Fuente de verdad para:** Definición de estados visuales por componente base.
- **Agentes que deben leerlo:** Frontend Engineer, Product Designer Reviewer.
- **Notas:** ⚠️ Contiene: página pública con URL `/v/:folio` (obsoleta → `/v/[token]`), foto del participante visible en estado válido (no por defecto en MVP), "audit log post-MVP" (obsoleto → obligatorio desde MVP), ZoneEditor sin estado empty documentado. Usar `UI_KIT_FUNCTIONAL_P2.md` para estados actualizados. Ver `PROJECT_EXECUTION_PLAN.md` Sección 14.

---

## 3. Fuente de verdad por dominio

| Dominio | Fuente de verdad principal | Fuente secundaria |
|---------|---------------------------|-------------------|
| **Seguridad** | `SECURITY_REMEDIATION_PLAN.md` | `SECURITY_AUDIT.md` |
| **UX / Flujos** | `UX_REMEDIATION_PLAN.md` | `UX_AUDIT.md` |
| **UI / Tokens visuales** | `UI_KIT.md` | `UI_KIT_FUNCTIONAL_P1.md`, `UI_KIT_FUNCTIONAL_P2.md` |
| **Accesibilidad** | `UI_KIT_FUNCTIONAL_P1.md` | `UX_REMEDIATION_PLAN.md` |
| **Estados de UI** | `UI_KIT_FUNCTIONAL_P2.md` | `UI_STATES.md` (verificar conflictos) |
| **Ejecución / Sprints** | `PROJECT_EXECUTION_PLAN.md` | — |
| **Arquitectura técnica** | `PROJECT_EXECUTION_PLAN.md` §8 | `ARCHITECTURE_HANDOFF.md` |
| **Endpoints API** | `PROJECT_EXECUTION_PLAN.md` §9 | `ARCHITECTURE_HANDOFF.md` |
| **Copy / textos UI** | `COPY.md` + `PROJECT_EXECUTION_PLAN.md` §5 | `UX_REMEDIATION_PLAN.md` |
| **Página pública `/v/[token]`** | `PROJECT_EXECUTION_PLAN.md` §3.2, §7.3 | `UI_KIT_FUNCTIONAL_P2.md` §7 |
| **ZoneEditor** | `UI_KIT_FUNCTIONAL_P2.md` §9 | `UX_SPEC.md` (verificar) |
| **Decisiones pendientes Seneto** | `PROJECT_EXECUTION_PLAN.md` §12 | `SENETO_DECISIONS.md` (si existe) |

---

## 4. Documentos que DEBEN actualizarse antes de Sprint 2

Estos documentos tienen instrucciones de corrección en `PROJECT_EXECUTION_PLAN.md` Sección 14.
**No actualizar durante Sprint 0 o Sprint 1 — solo cuando el Technical Orchestrator lo indique.**

| Documento | Correcciones pendientes | Bloqueante para |
|-----------|------------------------|-----------------|
| `WIREFRAMES.md` | `/v/:folio` → `/v/[token]`; remover foto pública MVP; quitar `email` de CSV preview; motivo revocación mínimo 10 | Sprint 2 Frontend |
| `USER_FLOWS.md` | F-11 a token; F-14 con AuditLog; remover "no audit log" | Sprint 2 Frontend |
| `COPY.md` | Copy para `/v/[token]` con todos los estados; copy estado no válido/revocado | Sprint 2 Frontend |
| `UI_STATES.md` | URL `/v/[token]`; sin foto pública; ZoneEditor empty; AuditLog obligatorio | Sprint 2 Frontend |
| `UX_SPEC.md` | `/v/:folio` → `/v/[token]`; audit log ya en MVP; email fuera MVP | Sprint 2 Frontend |

---

## 5. Documentos fuera de `docs/` relevantes para el proyecto

| Archivo | Qué es | Notas |
|---------|--------|-------|
| `PLAN.md` (raíz) | Plan técnico inicial de arquitectura | Histórico. Superado por `PROJECT_EXECUTION_PLAN.md`. Leer solo como referencia de contexto original. |
| `prisma/schema.prisma` | Schema de base de datos | Requiere migración de Sprint 0: agregar `verification_token`, `AuditLog`, `UserRole enum`. |
| `prisma.config.ts` | Config de Prisma 7 | Vigente. `DATABASE_URL` va aquí, NO en `schema.prisma`. |
| `src/types/index.ts` | Modelos de dominio TypeScript | Requiere actualización post Sprint 0 para reflejar campos nuevos. |
| `src/types/api.ts` | Contratos de API TypeScript | Requiere actualización: `VerifyResponse` no debe incluir `photo_url` ni `email` por defecto. |
| `src/lib/storage/adapter.ts` | StorageAdapter — abstracción de archivos | Vigente. Requiere fix de path traversal en Sprint 0. |
| `src/lib/auth.ts` | Config de NextAuth | Vigente. Requiere route handler y JWT maxAge. |
| `.env.example` | Variables de entorno requeridas | Vigente. Requiere corrección de NODE_ENV. |
| `fixtures/students-sample.csv` | CSV de prueba con 5 alumnos | Vigente como fixture de QA. Notar que incluye `email` — en MVP el CSV no debe requerir email, pero puede ignorarlo si está presente. |

---

_Preparado por: Technical Orchestrator / Documentation QA_
_En caso de conflicto entre cualquier documento y `PROJECT_EXECUTION_PLAN.md`, prevalece `PROJECT_EXECUTION_PLAN.md`._
