# BACKLOG — Sistema de Diplomas Seneto

## 1. Reglas del backlog

- **Este backlog sigue `PROJECT_EXECUTION_PLAN.md`**: Todas las tareas aquí listadas provienen de las definiciones maestras de ejecución y remediación de seguridad. En caso de discrepancia, consultar el plan de ejecución.
- **Dependencia estricta de Sprints**: No se puede iniciar Sprint 1 (Backend Seguro) sin cerrar completamente Sprint 0 (Security Foundation). Las tareas de seguridad base son pre-requisitos absolutos.
- **Bloqueador de Sprint 2**: No se puede iniciar Sprint 2 (Frontend) sin cerrar las decisiones pendientes de negocio con Seneto, documentadas en `SENETO_DECISIONS.md`.
- **Criterios de Aceptación (DoD)**: Cada ticket debe tener criterios de aceptación verificables; una tarea no se considera terminada si no pasa sus verificaciones o si rompe la seguridad/privacidad definida.

---

## 2. Sprint 0 — Security Foundation

### SEC-001 Quick wins de seguridad
- **Objetivo**: Implementar bloqueos inmediatos a riesgos críticos antes de escribir lógica de negocio.
- **Agente responsable**: Backend Security Engineer.
- **Archivos esperados**: Archivos de configuración de Next.js, cabeceras de seguridad.
- **Dependencias**: Ninguna.
- **Criterios de aceptación**: Headers de seguridad (`helmet`, `CSP` básico) configurados. Cors restringido si aplica.
- **Riesgo si no se implementa**: Vulnerabilidades básicas exposición desde el día 0.

### SEC-002 Migración Sprint 0: verification_token, AuditLog, UserRole
- **Objetivo**: Ajustar el esquema de la base de datos para soportar los requerimientos de seguridad y auditoría.
- **Agente responsable**: Backend Security Engineer.
- **Archivos esperados**: `prisma/schema.prisma`, archivos de migración SQL.
- **Dependencias**: SEC-001.
- **Criterios de aceptación**: Modelo `AuditLog` creado (append-only). `verification_token` añadido como UUID único a `Certificate`. `UserRole` (admin, viewer, etc.) implementado.
- **Riesgo si no se implementa**: IDOR en verificación pública (C1/C2) e invisibilidad de acciones críticas (C5).

### SEC-003 NextAuth route handler + middleware admin
- **Objetivo**: Proteger todas las rutas administrativas de acceso no autorizado.
- **Agente responsable**: Backend Security Engineer.
- **Archivos esperados**: `src/lib/auth.ts`, `src/middleware.ts`, route handlers de `/api/auth`.
- **Dependencias**: SEC-002.
- **Criterios de aceptación**: Rutas `/admin/*` y `/api/admin/*` protegidas. Sesión requiere re-autenticación.
- **Riesgo si no se implementa**: Escalación de privilegios y acceso a endpoints protegidos.

### SEC-004 Rate limiting login
- **Objetivo**: Mitigar ataques de fuerza bruta en el inicio de sesión.
- **Agente responsable**: Backend Security Engineer.
- **Archivos esperados**: Middleware o handler de login.
- **Dependencias**: SEC-003.
- **Criterios de aceptación**: Máximo X intentos fallidos por IP/usuario en un tiempo T.
- **Riesgo si no se implementa**: Compromiso de credenciales administrativas por fuerza bruta.

### SEC-005 Helper logAction
- **Objetivo**: Crear la función base para registrar eventos en la tabla AuditLog.
- **Agente responsable**: Backend Security Engineer.
- **Archivos esperados**: Helper file en `src/lib/` (ej. `src/lib/audit.ts`).
- **Dependencias**: SEC-002.
- **Criterios de aceptación**: Función que recibe `actor_id`, `action`, `resource_id`, `details` e inserta en la BD. Uso comprobado sin mutabilidad (append-only).
- **Riesgo si no se implementa**: Imposibilidad de cumplir con el requerimiento de auditoría para el resto del proyecto.

### SEC-006 Helper assertOwnership
- **Objetivo**: Crear función para asegurar que un admin solo puede acceder/modificar recursos de su institución/usuario.
- **Agente responsable**: Backend Security Engineer.
- **Archivos esperados**: Helper file en `src/lib/` o integraciones en middleware/handlers.
- **Dependencias**: SEC-002.
- **Criterios de aceptación**: Función que valida propiedad y lanza 403 Forbidden si no hay match.
- **Riesgo si no se implementa**: IDOR horizontal entre diferentes administradores o instituciones (C3).

### SEC-007 /api/files/[...path] protegido
- **Objetivo**: Asegurar que los archivos subidos (ej. plantillas, fotos) no sean públicamente accesibles a menos que se autorice explícitamente.
- **Agente responsable**: Backend Security Engineer.
- **Archivos esperados**: Endpoints de manejo de archivos, configuración de StorageAdapter.
- **Dependencias**: SEC-003, SEC-006.
- **Criterios de aceptación**: Protección de path traversal implementada (C4). Solo usuarios autenticados con propiedad pueden descargar.
- **Riesgo si no se implementa**: Acceso no autorizado a archivos de otras instituciones y LFI (Path Traversal).

### SEC-008 Actualizar tipos TypeScript seguros
- **Objetivo**: Asegurar que los contratos de la API no incluyan datos sensibles.
- **Agente responsable**: Backend Security Engineer.
- **Archivos esperados**: `src/types/index.ts`, `src/types/api.ts`.
- **Dependencias**: SEC-002.
- **Criterios de aceptación**: `VerifyResponse` sin `photo_url` y `email` por defecto. Tipos DTOs actualizados reflejando los campos omitidos en MVP.
- **Riesgo si no se implementa**: Fugas de datos personales por defecto en los endpoints debido a tipado inseguro.

---

## 3. Sprint 1 — Backend Seguro

*(Nota: Tareas implementadas con los controles de Sprint 0: validación de sesión, origin, ownership y logAction).*

- **BE-001** Route handlers de generations
- **BE-002** Upload template con validación server-side
- **BE-003** Upload CSV sin email requerido
- **BE-004** Validación folio_override
- **BE-005** Upload ZIP fotos con validación segura
- **BE-006** Validación pre-vuelo
- **BE-007** Trigger generación
- **BE-008** Status generación
- **BE-009** Descargar ZIP
- **BE-010** Descargar CSV errores
- **BE-011** Búsqueda certificados
- **BE-012** Detalle certificado
- **BE-013** Revocar/reactivar certificado con AuditLog
- **BE-014** Endpoint/verificación pública por token

---

## 4. Sprint 1b — PDF/Image Generation

- **PDF-001** Composición base del diploma
- **PDF-002** Render foto en diploma final
- **PDF-004** Render texto con EB Garamond
- **PDF-005** Exportar PNG y PDF
- **PDF-006** Crear ZIP final
- **PDF-007** Manejo de errores por participante

### PDF-003 — Generar QR con `verification_token` e incrustar en diploma

**Estado:** Pendiente — Sprint 3 / Sprint 1b.
**Dependencias:** PDF-001 (composición base), FE-015 aprobado (landing `/v/[token]` disponible), `PUBLIC_VERIFY_BASE_URL` definido en `.env`.
**No implementar en Sprint 2.** El contrato de URL y los gates QR-C1 a QR-C8 están documentados en `SPRINT2_ORCHESTRATION.md §13`.

**Regla invariante:**

```
URL del QR = {PUBLIC_VERIFY_BASE_URL}/v/{certificate.verification_token}
```

**Nunca:**
- Usar folio en la URL del QR: ~~`/v/SEN-2026-001`~~
- Apuntar al endpoint API: ~~`/api/verify/{token}`~~
- Incluir datos personales en el payload del QR

**Variable de entorno requerida:**
```bash
# .env / .env.example
PUBLIC_VERIFY_BASE_URL=http://localhost:3000   # local
# PUBLIC_VERIFY_BASE_URL=https://qa.corporativoseneto.com  # QA
```

**Librería:** `qrcode` (`^1.5.4`) — ya instalada. Usar `qrcode.toBuffer()` para generar el QR como PNG en memoria.

**Implementación esperada:**
```ts
import QRCode from 'qrcode'

const baseUrl = process.env.PUBLIC_VERIFY_BASE_URL
if (!baseUrl) throw new Error('PUBLIC_VERIFY_BASE_URL no definida')

const verifyUrl = `${baseUrl}/v/${certificate.verification_token}`
const qrBuffer = await QRCode.toBuffer(verifyUrl, { type: 'png', margin: 1 })
// incrustar qrBuffer en la zona 'qr' definida en Template.field_zones
```

**Gates obligatorios (Sprint 3):**
- **QR-C1:** Payload del QR = `{PUBLIC_VERIFY_BASE_URL}/v/{verification_token}` exacto.
- **QR-C2:** Test falla si se intenta construir URL con folio en lugar de verification_token.
- **QR-C3:** Payload no contiene email, nombre, CURP, RFC ni datos personales.
- **QR-C4:** URL del QR apunta a `/v/{token}` (landing), no a `/api/verify/{token}`.
- Escanear el QR generado con dispositivo móvil → navega a `/v/{token}` → landing muestra datos correctos.
- QR legible a 200px de ancho mínimo (tamaño de impresión estándar en diploma).

**Gates QR-C5 a QR-C8** se verifican en Sprint 2 como parte de FE-015 (ver `SPRINT2_ORCHESTRATION.md §13`).

---

## 5. Sprint 2 — Frontend + Vista Pública

- **FE-001** Login admin
- **FE-002** Layout admin
- **FE-003** Dashboard generaciones
- **FE-004** Crear generación
- **FE-005** Subir plantilla
- **FE-006** ZoneEditor — Editor visual de zonas de render sobre la imagen del template. Lee/escribe `Template.field_zones` (contrato de coordenadas definido en PROD-DEC-002, ver `SENETO_DECISIONS.md §7`). El renderer que consume `field_zones` se implementa en Sprint 3.
- **FE-007** Subir CSV
- **FE-008** Subir ZIP fotos
- **FE-009** Validación pre-vuelo
- **FE-010** Progreso generación
- **FE-011** Descargas
- **FE-012** Búsqueda certificados
- **FE-013** Detalle certificado
- **FE-014** Modal revocación
- **FE-015** Página pública `/v/[token]`
- **FE-016** Estados error/empty/loading
- **FE-017** Aplicar UI Kit funcional

---

## 6. UX/Product Tickets

- **UX-001** Actualizar referencias `/v/:folio` → `/v/[token]`
- **UX-002** Cerrar política de datos públicos
- **UX-003** Confirmar no foto pública MVP
- **UX-004** Definir nombre completo vs parcial
- **UX-005** Copy certificado no válido
- **UX-006** Aviso de privacidad público
- **UX-007** ZoneEditor empty
- **UX-008** Touch targets 44px
- **UX-009** Contraste Dirección B
- **UX-010** Validar UI Kit funcional

---

## 7. Infraestructura / DevOps

### INFRA-001 — Preparar ambiente QA/Staging en `qa.corporativoseneto.com`

- **Objetivo:** Levantar un ambiente QA/Staging funcional, separado de local y de producción, antes del primer deploy de Sprint 1.
- **Dominio asignado:** `qa.corporativoseneto.com` (DNS en GoDaddy — solo apuntar registro, no tocar hasta decisión de hosting)
- **Dependencias:** Cierre formal de Sprint 0. Decisión de hosting (VPS / ECS / otro — ver DEC-007). Decisión de BD en QA (instancia separada o misma instancia con schema distinto).
- **Criterios de aceptación:**
  - Registro DNS `qa.corporativoseneto.com` apuntando al servidor QA.
  - Variables de entorno de QA configuradas (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL propios de QA).
  - `npx prisma migrate deploy` ejecutado contra BD de QA.
  - Sin datos reales — solo datos de prueba.
  - `/v/[token]` no expuesto públicamente hasta Sprint 2.
  - QR oficiales no apuntan a QA en ninguna etapa.
- **Restricciones:**
  - No usar `corporativoseneto.com` ni `www.corporativoseneto.com` para este ambiente.
  - No compartir `NEXTAUTH_SECRET` entre QA y producción.
  - No desplegar en Sprint 0.
- **Prioridad:** Alta — debe estar listo antes del primer deploy de Sprint 1.

---

## 8. Post-MVP — Formatos de carga y captura

*Derivado de PROD-DEC-001. No implementar en Sprint 1. El parser CSV debe mantenerse limpio para que estos tickets no requieran tocar la lógica de negocio.*

### PMVP-001 — Carga directa de Excel `.xlsx`
- **Objetivo:** Permitir que el admin suba `.xlsx` sin exportar a CSV manualmente.
- **Notas técnicas:** Usar `xlsx` o `exceljs`. Transformar el Excel al mismo `StudentCSVRow[]` que usa `parseCsv()`. La lógica de negocio (creación de certificados, folio_override, generation_errors) no cambia.
- **Restricción:** No implementar hasta que el flujo CSV esté validado en producción.

### PMVP-002 — Captura manual de alumnos desde la plataforma
- **Objetivo:** Agregar estudiantes uno a uno desde el panel admin sin subir archivos.
- **Notas técnicas:** `POST /api/generations/[id]/students` con un solo registro `StudentCSVRow` en el body, pasando por las mismas validaciones. Requiere UI de formulario (Sprint 2+).
- **Restricción:** No implementar hasta Sprint 2.

### PMVP-003 — Edición tipo tabla dentro del admin
- **Objetivo:** Editar, agregar y eliminar estudiantes directamente desde una vista de tabla sin resubir el CSV completo.
- **Notas técnicas:** CRUD sobre `certificates` en estado `pending`. Requiere UI tipo spreadsheet o tabla con edición inline. Complejidad alta.
- **Restricción:** Post-MVP 2+. Depende de PMVP-002.

### PMVP-REV-001 — Revocar / Reactivar certificados
- **Objetivo:** Permitir al administrador revocar o reactivar certificados individualmente con motivo obligatorio y trazabilidad completa.
- **Motivo de diferimiento:** Priorización de MVP inicial — verificación pública, generación y QR son bloqueantes. La revocación puede entrar en una iteración posterior sin pérdida de trabajo.
- **Base técnica existente:** `Certificate.status`, `revoked_at`, `revocation_reason`, `AuditLog`, `verification_token`, `ownership/security` ya implementados desde Sprint 0.
- **Endpoint:** `PATCH /api/certificates/[folio]` — body `{ action: 'revoke' | 'reactivate', reason?: string }`.
- **Reglas de negocio:**
  - `action: 'revoke'`: `reason` requerido, mínimo 10 caracteres; solo si `status === 'active'`; actualiza `status = 'revoked'`, `revoked_at = now()`, `revocation_reason = reason`; `logAction('certificate.revoke')`.
  - `action: 'reactivate'`: solo si `status === 'revoked'`; limpia `revoked_at` y `revocation_reason`; `logAction('certificate.reactivate')`.
  - Nunca retornar `revocation_reason` en respuestas públicas (`/api/verify/[token]`).
  - Reflejo inmediato en verificación pública (el endpoint público ya contempla `status`).
- **Mejora post-MVP:** Confirmación tipada ("escribir REVOCAR") — ver DEC-004 en `SENETO_DECISIONS.md`.
- **Restricción:** No implementar en Sprint 1. No quitar campos del schema. No revertir migraciones.

---

## 9. Sprint 3 — QA / Hardening

- **QA-001** Auth y middleware
- **QA-002** Rate limiting login
- **QA-003** Verificación por token, no folio
- **QA-004** Archivos privados
- **QA-005** Path traversal
- **QA-006** Ownership entre admins
- **QA-007** Origin checks
- **QA-008** Uploads maliciosos
- **QA-009** AuditLog
- **QA-010** Privacidad VerifyResponse
- **QA-011** Mobile 375px
- **QA-012** Accesibilidad teclado/screen reader
- **QA-013** Headers seguridad
- **QA-014** Flujo E2E completo
