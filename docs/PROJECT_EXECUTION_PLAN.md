# Project Execution Plan — Sistema de Diplomas Seneto

> Documento maestro de ejecución y orquestación.
> Última actualización: 2026-05-07.
> Propósito: guiar a Claude/Antigravity y a los agentes especializados en qué construir, en qué orden, qué documentos prevalecen, qué decisiones están cerradas, qué sigue pendiente y qué gates bloquean el avance.

---

## 0. Regla principal de uso

Este documento es la **fuente operativa principal** para orquestar la construcción del Sistema de Diplomas Seneto.

No reemplaza a los documentos especializados; los ordena y resuelve conflictos entre ellos.

Cuando Claude, Antigravity o cualquier agente necesite decidir qué hacer después, debe consultar este documento primero y luego profundizar en los documentos fuente correspondientes.

---

## 1. Jerarquía de fuentes de verdad

En caso de conflicto entre documentos, prevalece este orden:

1. `docs/PROJECT_EXECUTION_PLAN.md` — este documento maestro.
2. `docs/SECURITY_REMEDIATION_PLAN.md` — trabajo ejecutable de seguridad.
3. `docs/SECURITY_AUDIT.md` — auditoría técnica y evidencia de riesgos.
4. `docs/UX_REMEDIATION_PLAN.md` — trabajo ejecutable de UX, privacidad y accesibilidad.
5. `docs/UX_AUDIT.md` — hallazgos UX/Product Design.
6. `docs/UI_KIT_HARDENING.md`, si existe — endurecimiento funcional del UI Kit.
7. `docs/UI_KIT.md` — tokens visuales oficiales Dirección B.
8. `docs/UI_KIT_FUNCTIONAL_P1.md` - Functional states, touch targets, focus global, WCAG AA contrasts, motion, Tailwind tokens.
9. `docs/UI_KIT_FUNCTIONAL_P2.md` - states, page, admin table, ZoneEditor, checklist for Frontend.
10. `docs/ARCHITECTURE_HANDOFF.md` — estado técnico inicial y handoff de arquitectura.
11. `docs/UX_SPEC.md`, `docs/USER_FLOWS.md`, `docs/WIREFRAMES.md`, `docs/COPY.md`, `docs/UI_STATES.md` — documentos UX originales.
12. Conversaciones previas con Claude/Antigravity — contexto histórico, no fuente final si contradicen documentos posteriores.

### Regla de conflicto

Si un documento viejo dice `/v/:folio`, `/v/{folio}`, `/v/[folio]`, `/api/verify/:folio` o `/verify/{folio}`, debe considerarse **obsoleto**. La decisión vigente es:

```txt
/v/[token]
/api/verify/[token]
QR → {BASE_URL}/v/{verification_token}
```

El folio (`SEN-2026-001`) sigue existiendo como identificador humano visible, pero **nunca como llave pública de verificación**.

---

## 2. Qué se está construyendo

Se construye un sistema web para que Seneto pueda generar diplomas digitales en lote y permitir su verificación pública mediante QR.

El sistema resuelve dos necesidades principales:

1. **Generación masiva de diplomas** mediante panel administrativo.
2. **Verificación pública de autenticidad** mediante una URL pública escaneada desde el QR del diploma.

---

## 3. Módulos del producto

## 3.1 Panel admin

Ruta base:

```txt
/admin/*
```

Debe estar protegido por autenticación desde el primer sprint de código.

Incluye:

- Login protegido con NextAuth.
- Dashboard/lista de generaciones.
- Crear generación.
- Subir plantilla PNG/JPG del diploma.
- Configurar zonas del diploma en ZoneEditor.
- Subir CSV de participantes.
- Subir ZIP de fotos.
- Validación pre-vuelo.
- Generación en background o proceso async controlado.
- Progreso de generación.
- Descargar ZIP de PDFs generados.
- Descargar CSV de errores.
- Buscar certificados.
- Ver detalle de certificado.
- Revocar certificado con motivo.
- Reactivar certificado.
- Registrar acciones críticas en AuditLog.

## 3.2 Página pública de verificación

Ruta oficial:

```txt
/v/[token]
```

Donde `[token]` es `verification_token`, un UUID no enumerable generado para cada certificado.

Incluye:

- Acceso público sin login.
- Renderizado server-side.
- Mobile-first real, optimizado para 375px.
- Estado destacado en los primeros segundos:
  - certificado válido;
  - certificado no válido/revocado;
  - certificado expirado, si aplica;
  - token no encontrado;
  - token inválido;
  - error temporal;
  - error inesperado.
- Folio visible como referencia humana.
- Token nunca visible como texto en la UI.
- Foto pública excluida por defecto en MVP.
- Footer con enlace a aviso de privacidad.

---

## 4. Estado actual del proyecto

Estado actual: **planning completo / pre-desarrollo funcional**.

Formulación precisa:

> El proyecto ya tiene scaffold, librerías base, tipos TypeScript y documentación técnica/UX. Sin embargo, todavía no existe producto funcional: no hay route handlers de API implementados, no hay páginas admin funcionales y no hay flujo público `/v/[token]` construido.

### Estado técnico resumido

| Capa | Estado | Notas |
|---|---|---|
| Scaffold Next.js | Existente | Next.js 14 App Router, TypeScript, Tailwind. |
| Dependencias | Instaladas | Prisma, NextAuth, sharp, canvas, pdf-lib, qrcode, archiver, bcryptjs. |
| Prisma schema base | Existente, requiere cambios | Faltan `verification_token`, `AuditLog`, `UserRole enum`. |
| Prisma 7 config | Documentado | `DATABASE_URL` va en `prisma.config.ts`, no en `schema.prisma`. |
| Tipos TypeScript | Existentes | Deben actualizarse para seguridad y scope MVP. |
| StorageAdapter | Existente | Requiere fix de path traversal y route handler protegido. |
| NextAuth options | Existente | Falta route handler `src/app/api/auth/[...nextauth]/route.ts`. |
| Middleware admin | No existe | Bloqueante C1. |
| Route handlers API | No existen | Deben crearse después de Sprint 0. |
| Páginas admin | No implementadas funcionalmente | Sprint 2. |
| Página pública | No implementada | Debe ser `/v/[token]`. |
| UX docs | Existentes | Algunos están desactualizados y deben alinearse. |
| Security audit | Completa | Riesgo general ALTO antes de remediación. |
| UX audit | Completa | Señala privacidad, mobile-first y copy faltante. |
| UI Kit | Existente | Dirección B confirmada; requiere hardening si aún no se hizo. |

---

## 5. Decisiones consolidadas que corrigen documentos anteriores

Estas decisiones deben prevalecer aunque documentos viejos indiquen otra cosa.

| Tema | Documentos viejos / plan inicial | Decisión vigente |
|---|---|---|
| URL pública | `/v/:folio`, `/v/{folio}` | `/v/[token]` con `verification_token`. |
| API pública | `/api/verify/:folio` | `/api/verify/[token]` o lógica equivalente server-side usando token. |
| QR | Apunta al folio secuencial | Apunta a `{BASE_URL}/v/{verification_token}`. |
| Folio | Identificador público y llave de lookup | Visible como texto; nunca llave pública. |
| Audit log | Post-MVP / inexistente | Obligatorio desde MVP y Sprint 0. |
| Foto pública | Visible en algunos wireframes | No pública por defecto en MVP. |
| Email | Aparece en CSV/tipos/docs viejos | Fuera de alcance MVP; no recolectar ni exponer. |
| Datos sensibles | Algunos docs contemplan más campos | No incluir teléfono, CURP, RFC, dirección ni IDs internos. |
| Revocación | Motivo débil o sin historial | Motivo obligatorio mínimo 10 caracteres; registrar AuditLog. |
| Estado revocado público | “Diploma revocado” con detalle | Preferir “Certificado no válido”, sin motivo ni fecha pública. |
| Seguridad | Resolver en fases posteriores | Sprint 0 antes de features. |
| Frontend | Puede empezar con wireframes viejos | No empezar vista pública hasta cerrar decisiones UX-010. |

---

## 6. Alcance MVP

## 6.1 Incluido en MVP

- Login admin con NextAuth.
- Protección de `/admin/*` con middleware.
- Rate limiting de login.
- Schema seguro:
  - `verification_token`;
  - `AuditLog`;
  - `UserRole enum`.
- Generaciones de diplomas.
- Subida de plantilla PNG/JPG.
- ZoneEditor visual básico.
- Subida y validación server-side de CSV.
- Subida y validación server-side de ZIP de fotos.
- Generación de diplomas con foto en el PDF final.
- QR seguro con `verification_token`.
- Exportación PDF individual y ZIP grupal.
- Página pública `/v/[token]`.
- Búsqueda de certificados en admin.
- Revocación/reactivación de certificados.
- Audit log append-only para acciones críticas.
- UI mobile-first para página pública.
- Accesibilidad WCAG AA razonable para MVP.

## 6.2 Fuera del MVP

- Envío de diplomas por email.
- Portal del participante.
- Analytics de escaneos QR.
- API pública para terceros.
- Firma digital PDF PKCS#7.
- Firma HMAC de certificado, salvo que se decida adelantar.
- 2FA para superadmin.
- Gestión avanzada de usuarios/roles.
- Detección automática de zonas por computer vision.
- Reintento individual de diplomas fallidos.
- R2/S3 con URLs prefirmadas, salvo que hosting lo requiera.
- Expiración automática de archivos temporales.

---

## 7. Datos del MVP

## 7.1 Datos que sí contempla el MVP

- Foto del participante para componer el diploma/PDF.
- Nombre completo o parcial, decisión pendiente de Seneto.
- Programa/curso.
- Institución emisora: Seneto.
- Fecha de emisión.
- Fecha de expiración, si aplica.
- Folio público.
- Token de verificación.
- Estado del certificado.

## 7.2 Datos fuera de alcance MVP

Los siguientes datos no serán recolectados ni almacenados en MVP y no deben agregarse a `VerifyResponse`, CSV requerido, UI pública ni modelos nuevos salvo decisión explícita posterior:

- Email.
- Teléfono.
- Documento oficial.
- CURP.
- RFC.
- Dirección.

## 7.3 Política pública base para `/v/[token]`

| Dato | MVP |
|---|---|
| Foto | No pública por defecto. |
| Token | Nunca visible como texto. |
| Folio | Visible como referencia humana. |
| Estado | Visible y prominente. |
| Institución | Visible. |
| Programa | Visible si Seneto lo aprueba como dato verificable. |
| Fecha emisión | Visible. |
| Nombre completo/parcial | Pendiente de decisión Seneto. Recomendación actual: nombre completo si se requiere verificación efectiva. |
| Motivo de revocación | Nunca público. |
| Fecha de revocación | No pública por defecto. |

---

## 8. Arquitectura técnica vigente

## 8.1 Stack

- Next.js 14 App Router.
- TypeScript.
- Tailwind CSS.
- PostgreSQL.
- Prisma 7.
- NextAuth 4 con Credentials Provider.
- sharp.
- canvas.
- pdf-lib.
- qrcode.
- archiver.
- bcryptjs.
- LocalStorageAdapter para MVP.

## 8.2 Arquitectura de alto nivel

Un solo repositorio Next.js maneja:

- rutas públicas `/v/[token]`;
- panel admin `/admin/*`;
- route handlers `/api/*`;
- lógica server-side de generación;
- acceso a DB con Prisma;
- acceso a archivos con `StorageAdapter`.

## 8.3 Hosting

El sistema no debe asumirse compatible con serverless estricto para generación masiva de PDFs. La generación de 150+ diplomas puede superar límites de tiempo de ejecución.

Opciones recomendadas:

- VPS.
- Railway/Render/Fly con proceso long-running.
- Infra con almacenamiento persistente.

Evitar Vercel para el proceso de generación si no se separa a worker externo.

## 8.4 Storage

MVP puede usar storage local si el hosting tiene disco persistente.

Si el hosting no garantiza persistencia o se usan múltiples instancias, migrar antes a R2/S3.

---

## 9. Endpoints objetivo — versión vigente

Los endpoints deben implementarse en Sprint 1, después del Sprint 0.

Todas las rutas admin/API privadas deben usar:

1. sesión;
2. Origin check si mutan estado;
3. validación server-side;
4. ownership;
5. lógica de negocio;
6. `logAction`.

## 9.1 Auth

NextAuth es la base oficial.

```txt
GET/POST /api/auth/[...nextauth]
```

Archivo requerido:

```txt
src/app/api/auth/[...nextauth]/route.ts
```

Opcional:

```txt
GET /api/auth/me
```

Solo si Frontend lo necesita y sin duplicar la lógica de NextAuth.

## 9.2 Generations

```txt
GET    /api/generations
POST   /api/generations
GET    /api/generations/[id]
PATCH  /api/generations/[id]
DELETE /api/generations/[id]   # solo draft, si se decide incluir
```

Reglas:

- `GET /api/generations` lista solo generaciones del admin autenticado.
- `superadmin` puede ver todas.
- `DELETE` debe evitarse si no es necesario; si existe, solo en draft y con AuditLog.

## 9.3 CSV / fotos / validación

```txt
POST /api/generations/[id]/csv
GET  /api/generations/[id]/students
POST /api/generations/[id]/photos
GET  /api/generations/[id]/validate
```

Reglas:

- Validar magic bytes y tamaño server-side.
- No confiar en extensión ni `Content-Type`.
- Validar `folio_override` con regex.
- CSV MVP no debe requerir ni incluir email.

## 9.4 Job de generación

```txt
POST /api/generations/[id]/generate
GET  /api/generations/[id]/status
GET  /api/generations/[id]/download
GET  /api/generations/[id]/errors
```

Reglas:

- `status` puede usar polling inicialmente.
- La generación no debe bloquear una request larga si el hosting no lo soporta.
- Descargar ZIP debe registrar `zip.download` en AuditLog.

## 9.5 Certificates

```txt
GET   /api/certificates?q=...
GET   /api/certificates/[folio]
PATCH /api/certificates/[folio]
```

Reglas:

- Admin puede buscar por nombre o folio.
- Rutas protegidas por sesión.
- Verificar ownership vía generación asociada.
- Revocación requiere motivo mínimo 10 caracteres.
- Reactivación registra AuditLog.

## 9.6 Public verify

Ruta pública recomendada:

```txt
GET /api/verify/[token]
```

O lógica equivalente directamente en:

```txt
src/app/v/[token]/page.tsx
```

Reglas:

- Sin autenticación.
- Lookup por `verification_token`.
- Nunca lookup por folio.
- Token inválido en formato → 400.
- Token UUID no encontrado → 404.
- Certificado encontrado en cualquier estado → 200 con estado.
- No retornar objeto `Certificate` completo.
- Usar `select` explícito de Prisma.
- Nunca incluir email, teléfono, CURP, RFC, dirección, ID interno ni `photo_url` por defecto.

## 9.7 Files

```txt
GET /api/files/[...path]
```

Reglas:

- Requiere sesión.
- Rechaza path traversal.
- Sirve `templates/` y `generations/` solo a admins autorizados.

Endpoint futuro/opcional si Seneto aprueba foto pública:

```txt
GET /api/public/photos/[token]
```

Para MVP no debe usarse salvo decisión explícita de Seneto.

---

## 10. Agentes requeridos y responsabilidades

## 10.1 Orchestrator / Technical Lead

Responsable de:

- Mantener este plan.
- Asignar tareas a agentes.
- Validar gates entre sprints.
- Resolver conflictos entre documentos.
- No implementar código como builder principal salvo ajustes menores.

## 10.2 Backend Security Engineer

Primer agente de ejecución.

Responsable de:

- Sprint 0 completo.
- Schema seguro.
- Auth/middleware.
- Rate limiting.
- AuditLog.
- Ownership.
- Files protegidos.
- Route handlers seguros en Sprint 1.

## 10.3 Database / Prisma Agent

Puede ser rol separado o parte del Backend Security Engineer.

Responsable de:

- Cambios a `prisma/schema.prisma`.
- Migraciones.
- Prisma 7 config.
- Validar que tipos TypeScript coincidan.

## 10.4 PDF/Image Generation Agent

Responsable de:

- `src/lib/diploma/`.
- Composición de diploma.
- Foto en PDF.
- QR con `verification_token`.
- Render de texto.
- Exportación PNG/PDF.
- ZIP.

No debe trabajar antes de que `verification_token` esté en schema.

## 10.5 Frontend Engineer

Responsable de:

- Sprint 2.
- UI admin.
- Vista pública `/v/[token]`.
- Aplicación del UI Kit.
- Estados loading/error/empty/success.
- Accesibilidad básica.

No debe iniciar la vista pública hasta cerrar decisiones UX-010.

## 10.6 Product Designer Reviewer

Responsable de revisar implementación, no rediseñar desde cero.

Valida:

- mobile-first en 375px;
- privacidad visible;
- no foto pública por defecto;
- copy correcto;
- UI Kit aplicado;
- touch targets;
- focus visible;
- estados sensibles.

## 10.7 Security QA

Responsable de:

- Probar C1–C5.
- Probar ownership.
- Probar path traversal.
- Probar rate limiting.
- Probar exposición de datos.
- Probar Origin checks.
- Probar headers.

## 10.8 Architect Reviewer

Responsable de revisar gates técnicos y seguridad.

No debe ser el builder principal.

---

## 11. Estrategia de ejecución por sprints

## Sprint 0 — Security Foundation

### Objetivo

Iniciar el código real construyendo la base segura antes de cualquier feature.

Este sprint marca el comienzo de la implementación.

### Responsable principal

Backend Security Engineer.

### Reviewer

Architect Reviewer.

### Tareas obligatorias

1. Agregar `.env` al `.gitignore`.
2. Corregir `StorageAdapter.resolve()` contra path traversal.
3. Configurar JWT `maxAge: 8 * 60 * 60`.
4. Corregir `NODE_ENV` en `.env.example`.
5. Agregar headers de seguridad en `next.config.mjs`.
6. Crear migración única de seguridad:
   - `verification_token` en `Certificate`;
   - `UserRole enum`;
   - `AuditLog`.
7. Actualizar tipos TypeScript.
8. Crear `src/app/api/auth/[...nextauth]/route.ts`.
9. Crear `src/middleware.ts` para proteger `/admin/*`.
10. Implementar rate limiting login: 5 intentos / 10 min / IP; lockout 15 min.
11. Crear `src/lib/api/audit.ts` con `logAction()`.
12. Crear `src/lib/api/ownership.ts` con `assertOwnership()`.
13. Crear `/api/files/[...path]` protegido.

### Gate de salida

No pasar a Sprint 1 hasta que se cumpla:

- C1 resuelto: auth route + middleware existen.
- C2 resuelto: `verification_token` existe.
- C3 resuelto: login rate limiting funciona.
- C4 resuelto: archivos privados requieren sesión.
- C5 resuelto: `AuditLog` existe y helper disponible.
- `.env` no aparece en `git status`.
- Path traversal bloqueado.
- JWT expira en 8h.
- Architect Reviewer aprueba.

---

## Sprint 1 — Backend Seguro

### Objetivo

Construir route handlers funcionales con seguridad consistente desde el primer commit.

### Responsable principal

Backend Security Engineer.

### Colaboradores

Database/Prisma Agent y PDF/Image Generation Agent cuando aplique.

### Patrón obligatorio de route handlers admin

Todo route handler privado debe seguir este orden:

1. `getServerSession(authOptions)`.
2. Si no hay sesión → 401.
3. En POST/PATCH/DELETE validar `Origin` contra `NEXTAUTH_URL`.
4. Validar params/body server-side.
5. Buscar recurso en DB.
6. `assertOwnership(session, resource)` cuando aplique.
7. Ejecutar lógica de negocio.
8. `logAction(...)` si la operación fue exitosa.
9. Responder con tipos de `src/types/api.ts`.
10. Manejar errores con `handleApiError`.

### Tareas principales

- CRUD de templates.
- Upload de plantilla con magic bytes.
- CRUD de generations.
- Upload y parsing de CSV.
- Validación de `folio_override`.
- Upload y extracción segura de ZIP de fotos.
- Validación pre-vuelo.
- Trigger de generación.
- Status de generación.
- Descarga ZIP.
- Descarga CSV errores.
- Búsqueda de certificados.
- Detalle certificado.
- Revocar/reactivar certificado.
- Endpoint o Server Component de verificación por token.

### Gate de salida

No pasar a Sprint 2 hasta que:

- Auth funcione.
- Endpoints admin requieran sesión.
- Mutaciones validen Origin.
- Ownership funcione.
- AuditLog registre acciones críticas.
- `/v/[token]` o API verify por token esté definido.
- `/v/[folio]` no haga lookup válido.
- Backend no retorne datos fuera de política pública.

---

## Sprint 2 — Frontend + Vista Pública

### Objetivo

Construir la experiencia visible admin y pública, usando la base segura de Backend.

### Responsable principal

Frontend Engineer.

### Reviewer

Product Designer Reviewer.

### Gate de entrada

No iniciar Sprint 2 hasta que Seneto cierre/documente estas decisiones:

1. ¿Foto pública en `/v/[token]`? Recomendación: no para MVP.
2. ¿Nombre completo o parcial?
3. Texto exacto para estado no válido/revocado.
4. ¿Revocación requiere solo motivo o confirmación tipada? Recomendación MVP: solo motivo mínimo 10 caracteres.
5. Texto/enlace de aviso de privacidad.

### Tareas principales

- Login `/admin/login`.
- Layout admin.
- Dashboard generaciones.
- Crear generación.
- Subir plantilla.
- ZoneEditor.
- Subir CSV.
- Subir ZIP fotos.
- Validación pre-vuelo.
- Progreso generación.
- Descarga ZIP y errores.
- Búsqueda certificados.
- Detalle certificado.
- Modal revocación con motivo.
- Modal reactivación.
- Página pública `/v/[token]` mobile-first.
- Estados 400/404/500/503.
- Empty states.
- Lockout por rate limiting.
- Aplicar UI Kit Dirección B.

### Gate de salida

- Product Designer aprueba mobile 375px.
- No hay foto pública por defecto.
- No se muestra token.
- No se muestran datos fuera del MVP.
- Copy sensible coincide con docs vigentes.
- Touch targets ≥44px.
- Focus visible.
- Página pública funciona sin JS crítico.
- Open Graph no expone nombre del participante.

---

## Sprint 3 — Hardening y QA

### Objetivo

Validar seguridad, privacidad, accesibilidad y preparación para deploy.

### Responsables

Security QA, Architect Reviewer y Product Designer Reviewer.

### Pruebas obligatorias

- `/admin/*` sin sesión redirige a login.
- `/api/*` admin sin sesión retorna 401.
- 6 intentos de login fallidos → 429.
- `/v/SEN-2026-001` retorna 404.
- `/v/{uuid_valido}` funciona.
- Archivos privados sin sesión retornan 401.
- Path traversal retorna 400/error seguro.
- Admin A no accede a recursos de Admin B.
- POST/PATCH/DELETE con Origin incorrecto retorna 403.
- Upload falso PNG retorna 400.
- ZIP bomb retorna 400.
- `folio_override` inválido genera error de fila.
- AuditLog registra login, login fallido, revocación, reactivación, descarga ZIP.
- VerifyResponse no contiene email, teléfono, CURP, RFC, dirección, ID interno ni `photo_url` por defecto.
- Headers de seguridad presentes.
- Mobile 375px validado.
- Contraste WCAG AA validado.
- Navegación teclado validada.
- Screen reader básico validado para página pública.

### Gate de salida

No deploy si falla cualquier punto crítico de seguridad, privacidad o exposición pública de datos.

---

## 12. Decisiones pendientes de Seneto

Estas decisiones deben documentarse con fecha y aprobador antes de Sprint 2.

| Decisión | Recomendación actual | Bloquea | Responsable |
|---|---|---|---|
| Foto pública en `/v/[token]` | No en MVP | Página pública | Seneto |
| Nombre completo vs parcial | Nombre completo si verificación lo requiere | Página pública | Seneto |
| Texto para certificado no válido/revocado | “Certificado no válido” sin motivo ni fecha | Página pública | Seneto/Product |
| Confirmación tipada en revocación | Post-MVP; motivo mínimo 10 en MVP | Modal revocación | Product/Seneto |
| Aviso de privacidad | Footer visible en `/v/[token]` | Página pública | Seneto/legal |
| Dominio final | Ideal mismo dominio de Seneto | Deploy/QR | Seneto/Infra |
| Hosting | No serverless estricto para generación | Deploy | Seneto/Tech |

---

## 13. Reglas para agentes

## 13.1 Reglas para Backend

- No crear route handlers admin antes de Sprint 0.
- No usar folio como lookup público.
- No retornar objetos Prisma completos en respuestas públicas.
- No incluir email ni foto pública por defecto.
- No instanciar PrismaClient directamente; usar singleton.
- No instanciar LocalStorage directamente; usar singleton `storage`.
- No agregar `url = env("DATABASE_URL")` en `schema.prisma` por Prisma 7.
- No omitir `assertOwnership` en recursos de generación/certificados.
- No omitir `logAction` en acciones críticas.
- No confiar en validación del cliente.

## 13.2 Reglas para Frontend

- No construir `/v/[folio]`.
- No mostrar token como texto.
- No mostrar foto pública por defecto.
- No inventar copy sensible.
- No usar botón `sm` en mobile si queda bajo 44px.
- No depender de hover.
- No ocultar estado del certificado bajo interacción.
- No exponer errores técnicos.
- No duplicar auth guard del middleware como única protección.

## 13.3 Reglas para Product Designer

- Revisar implementación, no rediseñar desde cero.
- Mantener Dirección B.
- Validar mobile-first por journey del QR.
- Validar privacidad visible.
- Validar estado no válido/revocado sin exponer motivo.
- Validar touch targets y focus.

## 13.4 Reglas para QA

- Probar seguridad antes de UX fina.
- Probar API directa con curl/Postman, no solo UI.
- Probar mobile real si es posible.
- Capturar evidencia de estados críticos.
- Cualquier exposición de datos fuera de política es blocker.

---

## 14. Documentos que deben actualizarse antes de Frontend

Estos docs contienen referencias antiguas y deben alinearse antes o durante Sprint 1, pero antes de Sprint 2.

| Documento | Corrección requerida |
|---|---|
| `WIREFRAMES.md` | `/v/:folio` → `/v/[token]`; remover foto pública MVP; quitar email de previews MVP; motivo revocación mínimo 10. |
| `USER_FLOWS.md` | Actualizar F-11 a token; F-14 revocación con AuditLog; remover notas de “no audit log”. |
| `COPY.md` | Página pública `/v/[token]`; copy 500; estados no válido/expirado/no encontrado; remover “revocado” público si Seneto aprueba “no válido”. |
| `UI_STATES.md` | Página pública `/v/[token]`; sin foto pública; ZoneEditor empty; audit log ya existe. |
| `UX_SPEC.md` | `/v/:folio` → `/v/[token]`; audit log ya no fuera de MVP; email fuera MVP. |
| `ARCHITECTURE_HANDOFF.md` | Mantener como handoff histórico; corregir `/verify/{folio}` mentalmente a `/v/{verification_token}`. |

---

## 15. Tickets maestros sugeridos

## 15.1 Security / Backend

- `SEC-001` Quick wins inmediatos.
- `SEC-002` Migración Sprint 0: `verification_token`, `AuditLog`, `UserRole`.
- `SEC-003` NextAuth route + middleware admin.
- `SEC-004` Rate limiting login.
- `SEC-005` Helper `logAction`.
- `SEC-006` Helper `assertOwnership`.
- `SEC-007` `/api/files` protegido.
- `SEC-008` Validación magic bytes uploads.
- `SEC-009` Validación `folio_override`.
- `SEC-010` Origin checks.
- `SEC-011` `/v/[token]` / verify por token.
- `SEC-012` QR usa `verification_token`.

## 15.2 UX / Frontend

- `UX-001` Corregir referencias `/v/{folio}`.
- `UX-002` Página pública `/v/[token]` mobile-first.
- `UX-003` ZoneEditor empty state.
- `UX-004` Modal revocación con motivo.
- `UX-005` Copy error 500 y estados sensibles.
- `UX-006` Focus ring y teclado.
- `UX-007` Contraste Dirección B.
- `UX-008` Touch targets.
- `UX-009` Aviso de privacidad.
- `UX-010` Decisiones pendientes de Seneto.

---

## 16. Criterios globales de avance

### No pasar a Sprint 1 si:

- C1–C5 no están resueltos.
- No existe `verification_token`.
- No existe `AuditLog`.
- No existe middleware admin.
- No existe rate limiting login.
- No existe protección de archivos privados.

### No pasar a Sprint 2 si:

- Backend seguro no está operativo.
- `/v/[token]` no está definido.
- `/v/[folio]` no retorna 404.
- Falta decisión Seneto sobre datos visibles.
- Falta política de foto pública.

### No pasar a deploy si:

- QA no valida seguridad.
- QA no valida privacidad.
- QA no valida mobile 375px.
- QA no valida headers.
- QA no valida AuditLog.
- Hay datos fuera de política en VerifyResponse.

---

## 17. Definition of Done del MVP

El MVP puede considerarse terminado cuando:

- Un admin puede iniciar sesión.
- `/admin/*` está protegido.
- El admin puede crear una generación.
- El admin puede subir plantilla.
- El admin puede configurar zonas obligatorias.
- El admin puede subir CSV sin email requerido.
- El admin puede subir ZIP de fotos.
- El sistema valida pre-vuelo.
- El sistema genera diplomas con nombre, foto en PDF, folio y QR.
- El QR apunta a `/v/[verification_token]`.
- El admin puede descargar ZIP.
- El admin puede buscar certificados.
- El admin puede revocar con motivo.
- El admin puede reactivar.
- AuditLog registra acciones críticas.
- La página pública verifica por token.
- La página pública no muestra token.
- La página pública no muestra foto por defecto.
- La página pública no muestra email ni otros datos fuera de scope.
- Seguridad QA aprueba C1–C5.
- Product Designer aprueba mobile-first y accesibilidad mínima.

---

## 18. Siguiente paso concreto

El siguiente paso no es construir UI ni features visibles.

El siguiente paso es iniciar:

```txt
Sprint 0 — Security Foundation
```

Secuencia recomendada:

1. Crear/activar agente **Backend Security Engineer**.
2. Entregarle `SECURITY_REMEDIATION_PLAN.md` y este documento.
3. Ejecutar `SEC-001` a `SEC-007`.
4. Correr migraciones y validaciones.
5. Pasar a **Architect Reviewer**.
6. Solo si aprueba, iniciar Sprint 1 Backend Seguro.

---

## 19. Nota final para Claude/Antigravity

No todos los documentos existentes están actualizados. Este proyecto pasó por una fase de auditoría donde se corrigieron decisiones iniciales.

Si encuentras instrucciones que digan:

- usar `/v/:folio`;
- usar `/api/verify/:folio`;
- QR con folio;
- audit log post-MVP;
- foto pública por defecto;
- email dentro del MVP;
- revocación sin AuditLog;

considéralas obsoletas y sigue este documento.

La prioridad del proyecto es construir un MVP funcional, pero **no a costa de seguridad de datos personales ni de una solución enumerable por folios secuenciales**.
