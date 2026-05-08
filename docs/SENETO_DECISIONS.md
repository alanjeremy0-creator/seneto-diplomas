# SENETO DECISIONS — Sistema de Diplomas Seneto

## 1. Propósito

Este documento tiene como propósito enlistar, rastrear y formalizar las decisiones de negocio, diseño y privacidad que deben ser aprobadas por el equipo directivo/legal de Seneto. Estas decisiones deben ser cerradas obligatoriamente antes de que se finalice el diseño e implementación del Frontend (Sprint 2), ya que impactan directamente lo que se le muestra al usuario y los datos que se exponen públicamente.

---

## 2. Decisiones bloqueantes antes de Sprint 2

| ID | Decisión | Recomendación | Opciones | Riesgo | Bloquea | Estado | Aprobador | Fecha |
|---|---|---|---|---|---|---|---|---|
| **DEC-001** | **Foto pública en `/v/[token]`** | No mostrar foto pública en MVP por seguridad/privacidad de biométricos. | A: Sin foto pública<br>B: Foto con consentimiento explícito<br>C: Foto solo en panel admin | Riesgo alto de privacidad si se exponen fotos sin consentimiento legal firme. | Sprint 2 (Frontend público) | Pendiente | | |
| **DEC-002** | **Nombre completo vs parcial** | Nombre completo si Seneto requiere verificación efectiva; parcial ("Juan P***") si la prioridad máxima es privacidad. | A: Nombre completo<br>B: Nombre parcial / ofuscado | Fricción en verificación real vs exposición de datos personales. | Sprint 2 (Frontend público) | Pendiente | | |
| **DEC-003** | **Texto público para certificado revocado / no válido** | Mostrar únicamente "Certificado no válido", sin especificar motivo, fecha de revocación ni detalles administrativos. | A: "No válido" (genérico)<br>B: "Revocado el [fecha]" con motivo | Dar demasiada información a terceros sobre procesos internos del instituto. | Sprint 2 (Frontend público) | Pendiente | | |
| **DEC-004** | **Confirmación de revocación** | MVP: Solo campo de texto de motivo (min 10 caracteres). Post-MVP: Obligar confirmación tipada ("REVOCAR" o folio). | A: Solo motivo texto<br>B: Motivo + Confirmación tipada | MVP puede tener ligera fricción menor en UX, pero bloquea el error humano. | Sprint 2 (Admin UI) | Pendiente | | |
| **DEC-005** | **Aviso de privacidad** | Incluir footer visible en `/v/[token]` con enlace al aviso de privacidad institucional de Seneto. | A: Enlace en footer<br>B: Omitir en MVP | Incumplimiento de normativas de datos (LFPDPPP). | Sprint 2 (Frontend público) | Pendiente | | |
| **DEC-006** | **Dominio final** | Usar mismo dominio de Seneto (ej. `certificados.seneto.mx`) para dar confianza al usuario en la vista pública. Subdominio independiente solo si agiliza el despliegue. | A: Subdominio marca<br>B: Dominio separado | Fraude o desconfianza si la URL no parece oficial. | Deploy a Producción | Pendiente | | |
| **DEC-007** | **Hosting / Infraestructura** | Evitar entornos serverless estrictos (Vercel base) por límites en la generación de PDFs pesados. Usar entorno con storage persistente y cómputo adecuado (VPS, ECS, R2/S3). | A: VPS Clásico<br>B: Vercel + AWS S3 / R2 | Errores 504 Timeout en la generación masiva de PDFs. | Arquitectura Base / Deploy | Pendiente | | |
| **DEC-008** | **Datos visibles en página pública** | Solo: Estado, Folio, Institución, Programa, Fecha de Emisión y Nombre (según DEC-002). **Omitir:** Email, Teléfono, CURP, RFC, Dirección, Foto. | A: Recomendación estricta<br>B: Exponer datos adicionales bajo riesgo | Data scraping y violación masiva de privacidad (C2 en Security Audit). | Sprint 2 (Frontend público) | Pendiente | | |

---

## 3. Decisiones ya asumidas para MVP

Las siguientes decisiones ya han sido tomadas e instruidas en la orquestación técnica, por lo que los equipos de desarrollo ya operan bajo estos supuestos:

- **Códigos QR seguros:** El QR usa `verification_token` (UUID inmutable y no adivinable). El folio puede mostrarse como texto público pero nunca es la llave de consulta.
- **Folio no es llave pública:** El folio secuencial ya no se utiliza para URLs públicas; previene acceso no autorizado masivo (IDOR). Ruta pública vigente: `/v/[token]` — **prohibido usar `/v/:folio`, `/v/[folio]` ni `/v/{folio}`**.
- **QR + landing pública (`/v/[token]`) — separación por sprint:**
  - **Sprint 1 / BE-014**: Solo backend — endpoint `GET /api/verify/[token]` que devuelve los datos públicos del certificado (sin email, sin foto, sin rutas internas). Contrato seguro definido.
  - **Sprint 2**: Landing visual pública `/v/[token]`, mobile-first, con branding Seneto. No implementar antes.
  - **Sprint de generación visual (posterior)**: Generación e incrustación del QR en PNG/PDF del diploma usando la URL completa `https://{dominio}/v/{verification_token}`. No implementar antes.
  - **QA/Staging**: URL base `https://qa.corporativoseneto.com/v/[token]`. No tocar DNS hasta decisión de hosting.
- **Datos nunca expuestos en `/v/[token]`:** email, teléfono, CURP, RFC, documento oficial, dirección, photo_url. Foto no va por defecto en MVP (ver DEC-001).
- **Trazabilidad estricta:** La tabla `AuditLog` es obligatoria desde el Sprint 0 para cualquier acción crítica (login, revocaciones, descargas masivas).
- **Alcance de datos:** Email, teléfono, CURP, RFC, documento oficial y dirección están excluidos del MVP.
- **Protección de imagen:** La foto del participante no es pública por defecto hasta que Seneto apruebe lo contrario.
- **Revocaciones controladas:** Revocar un certificado siempre requiere un motivo en el sistema.
- **Diseño inclusivo:** La página pública es mobile-first nativa para favorecer su visualización desde dispositivos móviles de los estudiantes.

---

## 4. Formato de aprobación

Copia y pega la siguiente plantilla para asentar la aprobación de una decisión por parte del equipo directivo.

```text
Decisión: [ID de Decisión - Ej: DEC-001]
Opción aprobada: [Ej: A: Sin foto pública]
Aprobado por: [Nombre / Cargo en Seneto]
Fecha: [YYYY-MM-DD]
Notas: [Cualquier comentario, restricción o condición adicional]
Impacto en docs: [Qué documentos técnicos o de UX deben actualizarse tras esta decisión]
```

---

## 5. Decisiones de infraestructura

| ID | Decisión | Recomendación | Opciones | Restricciones | Estado |
|---|---|---|---|---|---|
| **INFRA-DEC-001** | **Subdominio QA/Staging** | Usar `qa.corporativoseneto.com` como ambiente de pruebas separado de local y producción. DNS en GoDaddy. | A: `qa.corporativoseneto.com` _(recomendado)_<br>B: `staging.corporativoseneto.com`<br>C: `diplomas-qa.corporativoseneto.com` | No tocar DNS todavía. No usar `corporativoseneto.com` ni `www.` para QA. No desplegar en Sprint 0. Hosting y BD se deciden aparte. No usar datos reales. No apuntar QR oficiales a QA. No exponer `/v/[token]` públicamente hasta Sprint 2. | Decisión tomada — pendiente ejecución post Sprint 0 |

**Dominio real del cliente:** `corporativoseneto.com`
**Acceso DNS:** GoDaddy (solo DNS — hosting y BD se definen en ticket INFRA-001)
**Subdominio aprobado:** `qa.corporativoseneto.com`
**Cuándo ejecutar:** Después del cierre formal de Sprint 0, antes de deploy de Sprint 1.

---

## 6. Decisiones de formato de datos / carga masiva

### PROD-DEC-001 — Formato de carga de estudiantes: CSV para Sprint 1/MVP

**Estado:** Decidido — Sprint 1
**Fecha:** 2026-05-07

**Decisión:** CSV es el único formato soportado para carga masiva de estudiantes en Sprint 1/MVP.

**Razón:**
- Simple de implementar y mantener.
- Excel y Google Sheets exportan a CSV sin configuración adicional del admin.
- Reduce complejidad del backend inicial (sin librerías de parsing de Excel).
- Permite validar parser fila por fila, errores por fila y generación de certificados antes de agregar más formatos.

**Restricciones para Sprint 1:**
- No implementar carga de Excel `.xlsx`.
- No implementar captura manual de alumnos/certificados desde la plataforma.
- El parser (`src/lib/csv/parser.ts`) transforma CSV → `StudentCSVRow[]`. Este formato interno es el contrato al que XLSX y captura manual deberán ajustarse en el futuro — la lógica de negocio no debe acoplarse al CSV.

**Mejoras post-MVP documentadas:** PMVP-001, PMVP-002, PMVP-003 (ver BACKLOG.md §9).

---

## 7. Decisiones de renderización y Zone Editor

### PROD-DEC-002 — `Template.field_zones` como contrato de coordenadas de render

**Estado:** Decidido — Sprint 1 (estructura en BD) / Sprint 2 (editor UI) / Sprint 3 (renderer)
**Fecha:** 2026-05-07

**Decisión:** `Template.field_zones` (JSON, almacenado en la tabla `Template`) es el contrato estructurado donde se definen las coordenadas, dimensiones y tipo de cada zona de texto e imagen que el renderer usará para componer el diploma final. Es el único punto de verdad para saber dónde va cada campo sobre la imagen base del template.

**Separación por sprint:**

| Sprint | Alcance | Responsable |
|---|---|---|
| Sprint 1 (actual) | `field_zones` existe en el schema de Prisma como campo `Json`. Se persiste vía `POST /api/templates` pero **no se valida ni se usa** todavía. | Backend |
| Sprint 2 | **Zone Editor UI** — el administrador dibuja/ajusta zonas sobre la imagen del template en el panel de administración. El editor guarda el JSON actualizado vía `PATCH /api/templates/[id]`. | Frontend (FE-006) |
| Sprint 3 | **Renderer** — la lógica de generación de PNG/PDF lee `field_zones` para posicionar texto y foto en cada diploma. El QR siempre usa la `verification_token` URL, nunca el folio. | Backend generación |

**Reglas invariantes (aplicables desde Sprint 1):**
- `field_zones = null` en un template → preflight (`BE-006`) emite warning `NO_FIELD_ZONES` pero **no bloquea** la carga de datos. Sí bloquea la generación visual en Sprint 3.
- La zona de QR, si existe, **siempre** debe apuntar a `https://{dominio}/v/{verification_token}`. Prohibido usar el folio como clave de URL.
- El schema interno de cada zona (tipo, coordenadas, fuente, tamaño) se define y documenta en Sprint 2 junto al Zone Editor. Sprint 1 no implementa validación de ese schema.

**Por qué esta separación:**
- El renderer (generación masiva de PNG/PDF) es la pieza de mayor riesgo técnico y se desarrolla en un sprint dedicado con su propia revisión de seguridad.
- El editor visual requiere Frontend y decisiones de UX que no están disponibles en Sprint 1.
- Definir el contrato ahora evita que Sprint 2/3 tengan que migrar el schema.

---

## 9. Decisiones de alcance del MVP

### PROD-DEC-003 — Revocación/reactivación de certificados diferida a Post-MVP

**Estado:** Decidido — 2026-05-07
**Decisor:** Equipo de producto Seneto

**Decisión:** La revocación y reactivación manual de certificados (`PATCH /api/certificates/[folio]`) **no se implementa en Sprint 1**. Se mueve al backlog post-MVP como `PMVP-REV-001`.

**Razón:**
Para el MVP inicial se prioriza el flujo principal: carga segura de generaciones → certificados → verificación pública por `verification_token` → landing `/v/[token]`. La revocación puede entrar en una iteración posterior sin pérdida del trabajo ya hecho.

**Lo que ya existe y no se toca:**
- `Certificate.status` (`pending | active | revoked | expired`)
- `Certificate.revoked_at`, `Certificate.revocation_reason`
- `AuditLog` con acciones `certificate.revoke` y `certificate.reactivate` ya definidas
- `verification_token` como llave pública inmutable
- `ownership/security` completos

**Restricciones activas:**
- No implementar endpoint de revocación/reactivación.
- No construir UI de revocación.
- No eliminar campos del schema ni revertir migraciones.
- El endpoint público `/api/verify/[token]` debe contemplar el campo `status` existente (mostrar "no válido" si revocado), pero el cambio manual de status queda fuera del MVP.

---

## 8. Impacto si no se cierran

Es imperativo dar resolución a las decisiones bloqueantes (DEC-001 a DEC-005 y DEC-008). 
- **Si no se cierran:** El equipo de Frontend **no debe** finalizar el desarrollo de la vista pública (`/v/[token]`) ni cerrar el Sprint 2.
- **Qué sí se puede avanzar:** El Backend puede avanzar desarrollando la base de seguridad (Sprint 0) y los endpoints lógicos (Sprint 1), implementando restricciones fuertes por defecto. Sin embargo, no se debe exponer ningún dato no aprobado hacia las APIs públicas hasta tener la validación institucional.
