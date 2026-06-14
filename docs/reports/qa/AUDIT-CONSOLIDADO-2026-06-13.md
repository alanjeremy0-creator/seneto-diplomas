# Auditoría QA Consolidada — 2026-06-13

> Pre-Sprint 3B. 5 agentes especializados corrieron en paralelo. Este reporte sintetiza los hallazgos críticos y altos, elimina duplicados entre agentes, y propone el orden de remediación.

## Resumen global

| Agente | Crítico | Alto | Medio | Bajo | OK |
|---|---|---|---|---|---|
| qa-backend | 3 | 4 | 5 | 4 | 16 |
| qa-arquitectura | 2 | 4 | 4 | 3 | 15 |
| qa-tecnologia | 0 | 4 | 4 | 3 | 12 |
| qa-uxui | 2 | 5 | 6 | 4 | 14 |
| qa-frontend | 0 | 2 | 6 | 5 | 18 |
| **TOTAL (sin deduplicar)** | **7** | **19** | **25** | **19** | **75** |

**Críticos únicos: 6** (un hallazgo —endpoints temporales— aparece en backend y arquitectura simultáneamente).

---

## Top 10 hallazgos por impacto

### 1. [CRÍTICO] Endpoints temporales activos sin protecciones CSRF
**Agentes:** Backend + Arquitectura  
**Archivos:** `src/app/api/generations/[id]/reset/route.ts`, `src/app/api/admin/revoke-by-names/route.ts`  
**Impacto:** `revoke-by-names` no llama `validateOrigin()`, no verifica rol `superadmin`, y no tiene `logAction`. Cualquier admin autenticado puede borrar certificados de generaciones ajenas vía CSRF. El endpoint de reset tampoco tiene `validateOrigin` ni `try/catch`.  
**Remediación:** Agregar `validateOrigin()`, `assertOwnership()` donde aplique, y `logAction()` en ambos endpoints. Evaluar si son necesarios en producción o deben eliminarse.

---

### 2. [CRÍTICO] `DELETE /api/generations/[id]` sin `validateOrigin()`
**Agente:** Backend  
**Archivo:** `src/app/api/generations/[id]/route.ts`  
**Impacto:** Una petición cross-site puede eliminar una generación completa (cascade: todos sus certificados) si el admin tiene sesión activa.  
**Remediación:** Agregar `validateOrigin()` antes de la lógica de eliminación.

---

### 3. [CRÍTICO] Sin índices en tabla `certificates`
**Agente:** Arquitectura  
**Archivo:** `prisma/schema.prisma`  
**Impacto:** Con 50,000+ certificados a 10× volumen actual, las queries del engine (`status = 'pending'`), el listado con filtros, y la búsqueda de folios serán full-scans. Degradación severa de performance en producción.  
**Remediación:** Migración de Prisma para agregar `@@index([generation_id])`, `@@index([status])`, `@@index([verification_token])`, `@@index([folio])` en el modelo `Certificate`.

---

### 4. [CRÍTICO] No existe UI de revocación de certificados
**Agente:** UX/UI  
**Archivo:** `src/components/admin/certificates/CertificateDetail.tsx`  
**Impacto:** El flujo de revocar está documentado en `USER_FLOWS.md` y existe en el backend, pero no hay botón visible en el panel admin. El administrador no puede revocar diplomas.  
**Remediación:** Agregar botón "Revocar diploma" con confirmación en `CertificateDetail.tsx`.

---

### 5. [CRÍTICO] Trust ribbon dice "cancelado" en lugar de "revocado"
**Agente:** UX/UI  
**Archivo:** `src/components/v/VerificationCard.tsx`  
**Impacto:** Contradice la terminología oficial del sistema y el banner en la misma pantalla. Un participante con diploma revocado ve información inconsistente.  
**Remediación:** Cambiar el copy de "cancelado" a "revocado" en `VerificationCard.tsx`.

---

### 6. [ALTO] ZIP se acumula completo en RAM antes de escribir a storage
**Agente:** Arquitectura  
**Archivo:** `src/lib/diploma/zipper.ts`  
**Impacto:** Una generación de 500 diplomas puede acumular hasta 250 MB en RAM antes de escribirse. OOM posible en el servidor.  
**Remediación:** Usar streaming real con `archiver` piped directamente a un write stream del storage adapter, liberando cada PDF después de comprimirlo.

---

### 7. [ALTO] Faltan headers de seguridad: CSP y HSTS
**Agente:** Tecnología  
**Archivo:** `next.config.mjs`  
**Impacto:** Sin CSP: riesgo XSS elevado en un sistema con documentos de valor legal. Sin HSTS: conexiones HTTP no forzadas a HTTPS. Ambos estaban ya documentados como deuda en `SECURITY_AUDIT_2026-05-11.md` (SEC-H01, SEC-H02).  
**Remediación:** Agregar `Content-Security-Policy` y `Strict-Transport-Security` al bloque `headers()` de `next.config.mjs`.

---

### 8. [ALTO] `typescript.ignoreBuildErrors: true` y `eslint.ignoreDuringBuilds: true`
**Agente:** Tecnología  
**Archivo:** `next.config.mjs:6-9`  
**Impacto:** Errores de tipo y reglas críticas de React hooks no protegen el build. Errores de runtime pueden pasar silenciosamente a producción. Ya documentado como SEC-H07.  
**Remediación:** Resolver los errores existentes (`tsc --noEmit`) y luego poner ambos flags en `false`.

---

### 9. [ALTO] Paths documentados en `ARCHITECTURE_HANDOFF.md` no coinciden con el código (5/5)
**Agente:** Arquitectura  
**Archivos:** `docs/ARCHITECTURE_HANDOFF.md`, `src/lib/diploma/engine.ts`, `src/lib/storage/adapter.ts`  
**Impacto:** Un nuevo desarrollador sigue la documentación y escribe código con paths incorrectos. Ya documentado como deuda 3B-D07.  
**Remediación:** Actualizar `ARCHITECTURE_HANDOFF.md` con los paths reales del código, o estandarizar los paths del código a la convención documentada.

---

### 10. [ALTO] `engine.ts` usa `include:` en lugar de `select:` — carga PII en memoria
**Agente:** Backend  
**Archivo:** `src/lib/diploma/engine.ts`  
**Impacto:** Cada diploma generado carga en RAM todos los campos del template y el certificado, incluyendo `email`, `photo_path`, y otros campos sensibles que no son necesarios para el render del PDF.  
**Remediación:** Reemplazar `include: { ... }` con `select: { ... }` que traiga solo los campos que el engine necesita.

---

## Hallazgos duplicados entre agentes

| Hallazgo | Agentes que lo detectaron |
|---|---|
| Endpoints temporales sin validateOrigin | Backend (CRÍTICO) + Arquitectura (CRÍTICO) |
| Paths de storage divergen del código | Backend (MEDIO) + Arquitectura (ALTO) |
| `plantilla-alumnos.csv` (terminología) | Frontend (MEDIO) + UX/UI (ALTO) |
| `student_name` visible en instrucciones | Frontend (MEDIO) + UX/UI (ALTO) |
| "Privacidad" sin href en footer | Frontend (MEDIO) + UX/UI (CRÍTICO) |
| Touch target 40px en botones de descarga | Frontend (ALTO) + UX/UI (ALTO) |
| `readFileSync` en composer.ts | Backend (BAJO) + Arquitectura (ALTO) |

---

## Orden de remediación antes de Sprint 3B

### Bloque 1 — Seguridad (hacer antes de cualquier deploy)
1. Agregar `validateOrigin()` en `DELETE /api/generations/[id]` — 30 min
2. Evaluar y proteger/eliminar `reset/route.ts` y `revoke-by-names/route.ts` — 1-2 h
3. Agregar CSP y HSTS en `next.config.mjs` — 2 h (implica resolver errores de build primero)
4. Resolver `tsc --noEmit` y poner `ignoreBuildErrors: false` — tiempo variable

### Bloque 2 — Performance y escalabilidad (antes de correr con datos reales grandes)
5. Migración Prisma: agregar índices en `certificates` — 1 h
6. Fix `engine.ts`: cambiar `include:` por `select:` mínimo — 30 min
7. Fix `zipper.ts`: streaming real para ZIPs grandes — 2-3 h

### Bloque 3 — UX bloqueante (antes de entregar el panel al cliente)
8. Agregar botón "Revocar diploma" en `CertificateDetail.tsx` — 2 h
9. Fix copy "cancelado" → "revocado" en `VerificationCard.tsx` — 15 min
10. Fix `plantilla-alumnos.csv` → `plantilla-participantes.csv` (confirma deuda 3B-D10) — 30 min

### Bloque 4 — Documentación y deuda técnica (Sprint 3B o posterior)
- Actualizar `ARCHITECTURE_HANDOFF.md` con paths reales
- Agregar `.nvmrc` con Node ≥18.17.0
- Evaluar y remover `canvas` de dependencies
- CI básico: `tsc --noEmit` + `next lint` en GitHub Actions

---

## Deudas de Sprint 3B confirmadas por esta auditoría

| Deuda | Agente que confirmó |
|---|---|
| 3B-D07: Paths de storage divergen del código | Arquitectura (ALTO) + Backend (MEDIO) |
| 3B-D10: Renombrar `plantilla-alumnos.csv` | Frontend (MEDIO) + UX/UI (ALTO) |
| SEC-H01: CSP ausente | Tecnología (ALTO) |
| SEC-H02: HSTS ausente | Tecnología (ALTO) |
| SEC-H07: ignoreBuildErrors=true | Tecnología (ALTO) |
| 3B-D06: Backoff en polling | Frontend (OK — el polling ya para en completed/failed) |

> **Nota sobre 3B-D06:** El agente QA Frontend encontró que el polling SÍ para cuando `status === 'completed' || status === 'failed'`. La deuda pendiente es el backoff exponencial durante la generación, no el stop condition.
