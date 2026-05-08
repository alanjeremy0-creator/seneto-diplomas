# ARCHITECTURE HANDOFF — Sistema de Diplomas Seneto

> Generado por el Agente de Arquitectura el 2026-05-06.
> Todo lo documentado aquí se basa en los archivos reales del proyecto — nada es supuesto.

---

## 1. Estado general

### Qué quedó inicializado

- **Framework**: Next.js 14.2.35 con App Router, TypeScript y Tailwind CSS 3.4.x
- **Node runtime**: paquetes nativos (`sharp`, `canvas`) configurados como `serverExternalPackages` en `next.config.mjs`
- **ORM**: Prisma 7.8.0 configurado con PostgreSQL (breaking change documentado en sección 3)
- **Auth**: NextAuth 4.24.14 con estrategia JWT y Credentials provider
- **Estructura de carpetas**:

```
/
├── prisma/
│   └── schema.prisma         — Modelos de BD (User, Template, Generation, Certificate, GenerationError)
├── prisma.config.ts          — Configuración de Prisma 7 (datasource URL, no va en schema.prisma)
├── src/
│   ├── app/                  — App Router de Next.js (rutas, pages, layouts)
│   │   ├── admin/            — Sección admin (rutas protegidas)
│   │   └── api/              — Route handlers de API
│   ├── components/           — Componentes React compartidos
│   ├── lib/
│   │   ├── auth.ts           — authOptions de NextAuth (listo para usar)
│   │   ├── db.ts             — Singleton de PrismaClient
│   │   ├── api/
│   │   │   └── errors.ts     — Helpers de errores de API (ApiError, Errors, handleApiError)
│   │   ├── diploma/          — Directorio vacío listo para lógica de generación PDF/imagen
│   │   └── storage/
│   │       └── adapter.ts    — StorageAdapter + LocalStorage + singleton `storage`
│   └── types/
│       ├── index.ts          — Entidades de dominio, enums e interfaces (fuente de verdad)
│       └── api.ts            — Contratos de request/response de la API
├── fixtures/                 — Datos de prueba para desarrollo
│   ├── students-sample.csv   — 5 alumnos de prueba
│   ├── photos/               — Fotos de los 5 alumnos (JPG 400×500px)
│   └── template-sample.png   — Plantilla de diploma (PNG 1920×1360px)
├── storage/                  — Directorio de almacenamiento local (runtime, en .gitignore)
├── .env.example              — Variables de entorno requeridas
└── docs/                     — Documentación del proyecto
    ├── UX_SPEC.md
    ├── USER_FLOWS.md
    ├── UI_STATES.md
    ├── WIREFRAMES.md
    └── COPY.md
```

### Dependencias instaladas (de package.json)

**Runtime:**

| Paquete | Versión |
|---|---|
| next | 14.2.35 |
| react / react-dom | ^18 |
| @prisma/client | ^7.8.0 |
| prisma | ^7.8.0 |
| next-auth | ^4.24.14 |
| sharp | ^0.34.5 |
| canvas | ^3.2.3 |
| pdf-lib | ^1.17.1 |
| archiver | ^7.0.1 |
| bcryptjs | ^3.0.3 |
| qrcode | ^1.5.4 |
| @fontsource/eb-garamond | ^5.2.7 |
| dotenv | ^17.4.2 |

**Dev:**

| Paquete | Versión |
|---|---|
| typescript | ^5 |
| tailwindcss | ^3.4.1 |
| eslint | ^8 |
| eslint-config-next | 14.2.35 |
| postcss | ^8 |
| @types/node | ^20 |
| @types/react / react-dom | ^18 |
| @types/bcryptjs | ^2.4.6 |
| @types/archiver | ^7.0.0 |
| @types/qrcode | ^1.5.6 |

---

## 2. Cómo correr el proyecto localmente

```bash
npm install
cp .env.example .env   # completar DATABASE_URL con una instancia PostgreSQL real
npx prisma generate
npm run dev
```

- **Verificar TypeScript sin compilar:** `npx tsc --noEmit`
- **Lint:** `npm run lint`
- **Build de producción:** `npm run build && npm start`

### Variables mínimas para que `next dev` levante

```
DATABASE_URL=postgresql://user:password@localhost:5432/seneto_diplomas
NEXTAUTH_SECRET=<secreto-de-al-menos-32-caracteres>
NEXTAUTH_URL=http://localhost:3000
```

Sin `DATABASE_URL`, Prisma no puede conectarse. Sin `NEXTAUTH_SECRET`, NextAuth arroja error en tiempo de ejecución. `BASE_URL` y `STORAGE_PATH` tienen valores por defecto funcionales para desarrollo.

---

## 3. Prisma 7.8.0 — Breaking change importante

### El cambio

En Prisma 6 y anteriores, la URL de la base de datos se configuraba directamente en `schema.prisma`:

```prisma
// FORMA ANTIGUA — NO usar en este proyecto
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")   // ← YA NO VA AQUÍ
}
```

**En Prisma 7, `DATABASE_URL` ya NO se declara en `schema.prisma`.** Se configura en `prisma.config.ts` en la raíz del proyecto.

### Configuración real del proyecto

**`prisma/schema.prisma`** — solo tiene el provider, sin URL:

```prisma
datasource db {
  provider = "postgresql"
}
```

**`prisma.config.ts`** (raíz del proyecto) — aquí vive la URL:

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

`prisma.config.ts` importa `dotenv/config` para que `DATABASE_URL` del archivo `.env` esté disponible sin que Next.js lo procese.

### Comandos

```bash
# Generar el Prisma Client (después de cualquier cambio al schema)
npx prisma generate

# Crear y aplicar una migración nueva
npx prisma migrate dev --name nombre_migracion

# Ver el estado de migraciones
npx prisma migrate status

# Abrir Prisma Studio (GUI)
npx prisma studio
```

### Lo que Backend NO debe hacer

- No agregar `url = env("DATABASE_URL")` a `schema.prisma` — rompe Prisma 7
- No usar flags `--schema` de versiones anteriores que están deprecados
- No instanciar `PrismaClient` directamente — usar el singleton de `src/lib/db.ts`
- No mover `prisma.config.ts` fuera de la raíz

---

## 4. Variables de entorno

Archivo real: `.env.example`

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL. Formato: `postgresql://user:pass@host:5432/dbname`. Requerida. |
| `NEXTAUTH_SECRET` | Secreto para firmar los JWT de sesión. Mínimo 32 caracteres. Generar con `openssl rand -base64 32`. Requerida. |
| `NEXTAUTH_URL` | URL base de la app para callbacks de NextAuth. En producción = dominio real. Default: `http://localhost:3000`. |
| `BASE_URL` | URL pública de la app, usada para generar QR codes de verificación. Default: `http://localhost:3000`. |
| `STORAGE_PATH` | Ruta del directorio de almacenamiento local de archivos. Default: `./storage`. En producción se reemplaza por configuración de R2/S3. |
| `NODE_ENV` | Entorno de ejecución (`development` / `production`). Controla nivel de logs de Prisma. |

El archivo `.env.example` está completo. Copiar a `.env` y rellenar `DATABASE_URL` y `NEXTAUTH_SECRET` con valores reales.

---

## 5. Contratos compartidos — src/types/

Estos archivos son la **fuente de verdad única** para Backend y Frontend. Ningún agente debe inventar tipos propios — todos los fetch/calls de API y toda la lógica de servidor deben referenciar estos tipos directamente.

### `src/types/index.ts` — Entidades y enums de dominio

**Tipos exportados:**

- `CertificateStatus` — union type: `'active' | 'revoked' | 'expired'`
- `GenerationStatus` — union type: `'draft' | 'processing' | 'completed' | 'failed'`
- `UserRole` — union type: `'superadmin' | 'admin'`
- `ErrorType` — union type: `'missing_photo' | 'invalid_data' | 'render_error'`
- `FieldZone` — interface: `{ x, y, width, height, fontSize?, fontSizeMin?, fontColor?, fontFamily?, fontWeight?, fontStyle?, align? }`
- `QRZone` — interface: `{ x, y, size }`
- `FieldZones` — interface: `{ name: FieldZone, photo: FieldZone, qr: QRZone, folio?, date?, program? }` — define las zonas de texto/imagen del template
- `User` — interface: `{ id, email, role, created_at, last_login_at? }`
- `Template` — interface: `{ id, name, file_path?, image_width_px?, image_height_px?, field_zones?, is_active, created_at, updated_at }`
- `Generation` — interface: `{ id, name, template_id, status, folio_prefix, folio_year, folio_counter, total_count, processed_count, error_count, zip_path?, created_by, created_at, updated_at }`
- `Certificate` — interface: `{ id, folio, generation_id, student_name, email?, program?, issued_date?, status, photo_path?, diploma_pdf_path?, diploma_png_path?, error_message?, created_at, updated_at, revoked_at?, revocation_reason? }`
- `GenerationError` — interface: `{ id, generation_id, student_name?, row_number?, error_type, error_detail?, created_at }`
- `StudentCSVRow` — interface: columnas del CSV de entrada: `{ student_name, email?, program?, issued_date?, archivo_foto, folio_override? }`

### `src/types/api.ts` — Contratos de request/response de la API

**Interfaces exportadas:**

| Interface | Propósito |
|---|---|
| `ApiError` | Shape de error estándar: `{ error: { code, message } }` |
| `LoginRequest` | `{ email, password }` |
| `LoginResponse` | `{ user: User }` (sin password_hash) |
| `TemplateCreateRequest` | `{ name }` |
| `TemplateUpdateRequest` | `{ name?, field_zones? }` |
| `TemplateResponse` | Alias de `Template` |
| `GenerationCreateRequest` | `{ name, template_id?, folio_prefix?, folio_year?, folio_counter? }` |
| `GenerationUpdateRequest` | `{ name?, template_id? }` |
| `GenerationResponse` | `Generation & { template?: Template }` |
| `CSVPreviewRow` | `{ [key: string]: string }` |
| `CSVUploadResponse` | `{ total, preview, errors, missing_columns }` |
| `PhotosUploadResponse` | `{ total_uploaded, matched, unmatched_photos, students_without_photo }` |
| `ValidationIssue` | `{ type, student_name?, row?, detail }` |
| `ValidateResponse` | `{ ready, issues, can_proceed }` |
| `GenerateResponse` | `{ generation_id, status }` |
| `StatusResponse` | `{ status, total, processed, errors, zip_ready }` |
| `CertificatePatchRequest` | `{ status, revocation_reason? }` |
| `CertificateSearchResponse` | `{ certificates, total }` |
| `VerifyResponse` | `{ status, folio, student_name?, program?, issued_date?, institution, photo_url? }` |

**Regla crítica:** Si Backend modifica `src/types/api.ts`, debe documentar el cambio con un comentario en el PR/commit, porque Frontend depende directamente de estos tipos para tipado de fetch calls. Nunca modificar sin comunicación entre agentes.

---

## 6. StorageAdapter — src/lib/storage/adapter.ts

### Qué es y por qué existe

`StorageAdapter` es una interfaz de abstracción para el sistema de archivos. Su propósito es que toda la lógica de negocio (generación de diplomas, upload de fotos, etc.) opere contra la interfaz — no contra el sistema de archivos directamente. Esto permite migrar de almacenamiento local a Cloudflare R2 o AWS S3 post-MVP reemplazando únicamente la implementación concreta, sin tocar ningún otro archivo.

### Implementación actual

La implementación activa es `LocalStorage`, que almacena archivos en el directorio configurado por `STORAGE_PATH` (default: `./storage/` en la raíz del proyecto).

Se exporta como **singleton** listo para usar en cualquier server-side module:

```ts
import { storage } from '@/lib/storage/adapter'
```

No instanciar `LocalStorage` directamente — siempre usar el singleton `storage`.

### Métodos de la interfaz

| Método | Firma | Propósito |
|---|---|---|
| `put` | `(path: string, buffer: Buffer) => Promise<void>` | Guarda un archivo. Crea directorios intermedios automáticamente. |
| `get` | `(path: string) => Promise<Buffer>` | Lee un archivo como Buffer. Lanza error si no existe. |
| `delete` | `(path: string) => Promise<void>` | Elimina un archivo. |
| `exists` | `(path: string) => Promise<boolean>` | Retorna true si el archivo existe, false si no. |
| `url` | `(path: string) => string` | Retorna la URL pública para servir el archivo. En LocalStorage: `/api/files/{path}`. En R2/S3: URL del CDN. |

### Convención de paths — todos los agentes DEBEN respetar esta estructura

```
templates/{template_id}/base.png
generations/{generation_id}/photos/{filename}
generations/{generation_id}/diplomas/{folio}.pdf
generations/{generation_id}/diplomas_png/{folio}.png
generations/{generation_id}/output/{nombre-generación}.zip
uploads/temp/{uuid}_{filename}
```

Ningún agente debe inventar paths ad-hoc. Esta convención garantiza que los paths sean predecibles y que la migración a R2/S3 sea directa.

### Migración a R2/S3 post-MVP

Crear una clase `R2Storage` (o `S3Storage`) que implemente `StorageAdapter`, cambiar el singleton en `adapter.ts` para instanciarla en lugar de `LocalStorage`. Sin tocar ningún otro archivo del codebase.

---

## 7. Fixtures disponibles para pruebas

Todos los fixtures en `/Users/alan.jasso/Project_diplomas/fixtures/` están listos.

### fixtures/students-sample.csv

Columnas: `student_name, email, program, issued_date, archivo_foto, folio_override`

5 alumnos de prueba:

| Alumno | Programa | archivo_foto | folio_override |
|---|---|---|---|
| Juan Pérez García | Diplomado en Liderazgo Empresarial | juan_perez.jpg | — |
| María González López | Diplomado en Marketing Digital | maria_gonzalez.jpg | SEN-2026-099 |
| Carlos Ramírez Torres | Diplomado en Recursos Humanos | carlos_ramirez.jpg | — |
| Ana Martínez Vega | Diplomado en Finanzas Corporativas | ana_martinez.jpg | — |
| Luis Hernández Cruz | Diplomado en Liderazgo Empresarial | luis_hernandez.jpg | — |

### fixtures/photos/

5 imágenes JPEG sólidas de 400×500px, una por alumno, con color distinto para distinguirlas:

| Archivo | Color de fondo (RGB) |
|---|---|
| juan_perez.jpg | Azul (100, 150, 200) |
| maria_gonzalez.jpg | Naranja (200, 150, 100) |
| carlos_ramirez.jpg | Verde (150, 200, 100) |
| ana_martinez.jpg | Rosa (200, 100, 150) |
| luis_hernandez.jpg | Turquesa (100, 200, 180) |

### fixtures/template-sample.png

PNG de **1920×1360px** con fondo sólido crema `#F5F0E8` (RGB 245, 240, 232). Representa un diploma A4 horizontal a ~150dpi. Listo para usar como plantilla base en pruebas del Agente PDF/Imagen.

---

## 8. NextAuth

### Versión y compatibilidad

- **next-auth**: 4.24.14
- Compatible con Next.js 14 App Router usando el pattern de route handler en `src/app/api/auth/[...nextauth]/route.ts`

### Configuración base: src/lib/auth.ts

El archivo `src/lib/auth.ts` exporta `authOptions` con:
- **Provider**: `CredentialsProvider` — email + password contra la tabla `users` de PostgreSQL
- **Flujo de login**: busca el usuario por email, compara la contraseña con `bcrypt.compare()`, actualiza `last_login_at` si el login es exitoso
- **Estrategia de sesión**: `jwt` (stateless, sin sesiones en BD)
- **Página de login personalizada**: `/admin/login`
- **Callbacks JWT**: agrega `role` del usuario al token JWT
- **Callbacks session**: propaga `id` y `role` al objeto de sesión del cliente

### Lo que Backend DEBE crear: route handler de NextAuth

El archivo `src/app/api/auth/[...nextauth]/route.ts` NO existe aún. Backend debe crearlo:

```ts
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

Sin este archivo, los endpoints `/api/auth/*` (login, logout, session) no funcionarán.

### Middleware de protección de rutas /admin/*

Backend debe crear `src/middleware.ts` en la raíz de `src/`:

```ts
// src/middleware.ts
export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/admin/:path*'],
}
```

Este middleware redirige automáticamente a `/admin/login` a cualquier usuario no autenticado que intente acceder a rutas bajo `/admin/`. Frontend no debe duplicar esta lógica.

---

## 9. Riesgos y advertencias para siguientes agentes

### Para Agente Backend

- **Prisma 7**: `DATABASE_URL` va en `prisma.config.ts`, NO en `schema.prisma`. Ver sección 3.
- **NextAuth**: debe crear `src/app/api/auth/[...nextauth]/route.ts` y `src/middleware.ts`. Ver sección 8.
- **Contratos de API**: `src/types/api.ts` es la fuente de verdad para Frontend. Documentar cualquier cambio en ese archivo.
- **PrismaClient**: usar el singleton `prisma` de `src/lib/db.ts`. Nunca instanciar `PrismaClient` directamente — en Next.js dev esto genera múltiples conexiones por hot reload.
- **Storage**: usar el singleton `storage` de `src/lib/storage/adapter.ts` para todos los archivos. Respetar la convención de paths de la sección 6.
- **Errores de API**: usar `handleApiError` de `src/lib/api/errors.ts` en todos los route handlers para respuestas de error consistentes.
- **Folio format**: el formato es `{prefix}-{year}-{counter padded to 3}`, ej. `SEN-2026-001`. La lógica de generación de folios debe ser atómica para evitar duplicados.

### Para Agente Frontend

- **Tipos de API**: `src/types/api.ts` es el contrato de la API. Usarlo para todos los fetch/calls. No inventar tipos propios ni usar `any`.
- **Auth guard**: el middleware en `src/middleware.ts` (creado por Backend) protege `/admin/*`. Frontend no debe duplicar esta lógica.
- **Tailwind**: la configuración ya existe en `tailwind.config.ts`. No reinstalar ni reconfigurar Tailwind.
- **Fuente**: `@fontsource/eb-garamond` ya está instalada. Importar desde `@fontsource/eb-garamond` en el layout global.
- **Server vs Client Components**: `sharp` y `canvas` solo funcionan en Server Components o route handlers. No importarlos en componentes con `'use client'`.
- **State de generación**: el endpoint de status (`StatusResponse`) incluye `processed` y `total` — usar estos para la barra de progreso en tiempo real, con polling cada 2s mientras `status === 'processing'`.

### Para Agente PDF/Imagen

- **Paquetes nativos**: `sharp` y `canvas` están declarados en `serverExternalPackages` en `next.config.mjs`. No los importes en Client Components — solo en `src/lib/diploma/` o route handlers.
- **Directorio de trabajo**: toda la lógica de generación vive en `src/lib/diploma/` (directorio vacío, listo para llenar).
- **Fixtures**: usar los fixtures de `/Users/alan.jasso/Project_diplomas/fixtures/` para todas las pruebas.
- **Storage**: usar el singleton `storage` de `src/lib/storage/adapter.ts` para guardar PNGs y PDFs generados. Respetar la convención de paths (sección 6).
- **Tipos de entrada**: `FieldZones` y `Certificate` de `src/types/index.ts` definen exactamente la estructura que recibirá el módulo de generación. El módulo debe aceptar `Certificate` + `Template` (con `field_zones: FieldZones`) y retornar paths de los archivos generados.
- **Fuente del diploma**: la fuente EB Garamond está en `node_modules/@fontsource/eb-garamond/`. Para `canvas`, usar `registerFont()` con la ruta al archivo `.ttf`.
- **Template base**: leer el PNG de plantilla desde storage con `storage.get('templates/{template_id}/base.png')`, luego compositar encima con sharp o canvas.
- **Output del ZIP**: usar `archiver` (ya instalado) para empaquetar todos los diplomas en `generations/{generation_id}/output/{nombre}.zip`.
- **QR code**: usar el paquete `qrcode` (ya instalado) para generar el QR que apunta a `/verify/{folio}`.

### Para Agente QA

- **Datos de prueba end-to-end**: `fixtures/students-sample.csv` + `fixtures/photos/` + `fixtures/template-sample.png` cubren los 5 alumnos.
- **Levantar el ambiente**: `npm run dev` (requiere `DATABASE_URL` real en `.env` y `npx prisma migrate dev` ejecutado al menos una vez).
- **Criterios de aceptación**: ver `PLAN.md` sección 18.
- **Especificación de UX**: `docs/UX_SPEC.md` y `docs/USER_FLOWS.md`.
- **Estados de UI**: `docs/UI_STATES.md`.
- **Wireframes**: `docs/WIREFRAMES.md`.
- **Caso de prueba crítico**: el alumno `María González López` tiene `folio_override = SEN-2026-099`. Verificar que el sistema respeta el folio manual y no lo reemplaza con el contador automático.

---

## 10. Checklist de desbloqueo

| Item | Estado | Nota |
|---|---|---|
| Proyecto Next.js inicializado y dependencias instaladas | ✅ | Next.js 14.2.35, todas las deps en package.json |
| `npx prisma generate` corre sin errores | ✅ | schema.prisma y prisma.config.ts correctamente configurados |
| Migraciones listas para correr | ❌ | Requiere `DATABASE_URL` real — pendiente de entorno de BD |
| `.env.example` completo | ✅ | 6 variables documentadas |
| `src/types/index.ts` exporta todos los tipos de dominio | ✅ | 11 tipos + interfaces exportados |
| `src/types/api.ts` exporta todos los tipos de API | ✅ | 17 interfaces exportadas |
| StorageAdapter implementado con LocalStorage | ✅ | Singleton `storage` listo en `src/lib/storage/adapter.ts` |
| `fixtures/students-sample.csv` con datos de prueba | ✅ | 5 alumnos con todos los campos |
| `fixtures/photos/` con imágenes de prueba reales | ✅ | 5 JPGs 400×500px creados |
| `fixtures/template-sample.png` existe | ✅ | PNG 1920×1360px fondo crema |
| Prisma 7 breaking change documentado | ✅ | Ver sección 3 de este documento |
| NextAuth documentado con lo que Backend debe completar | ✅ | Route handler y middleware pendientes de Backend |
| `src/app/api/auth/[...nextauth]/route.ts` creado | ❌ | Pendiente Agente Backend |
| `src/middleware.ts` creado | ❌ | Pendiente Agente Backend |
| Lógica de generación en `src/lib/diploma/` | ❌ | Directorio vacío — pendiente Agente PDF/Imagen |

---

## 11. Consideraciones de seguridad

> Auditoría completa disponible en [`docs/SECURITY_AUDIT.md`](./SECURITY_AUDIT.md). Esta sección resume los hallazgos críticos que afectan directamente las decisiones de arquitectura.

### Hallazgos críticos que impactan el schema y el diseño

**C2 — IDOR por folio secuencial (impacto en `prisma/schema.prisma`)**

El folio `SEN-2026-001` es secuencial y predecible. Usarlo como clave en la URL del QR (`/v/{folio}`) permite enumerar todos los certificados del sistema sin autenticación. **Antes de cualquier desarrollo, agregar al modelo `Certificate`:**

```prisma
verification_token String @unique @default(uuid())
```

La URL del QR pasa a ser `/v/{verification_token}`. El folio sigue imprimiéndose en el diploma y apareciendo en la página de verificación como identificador legible, pero deja de ser la clave de acceso.

**C5 — Ausencia de audit log (impacto en `prisma/schema.prisma`)**

No existe tabla de auditoría. Las revocaciones de certificados destruyen el historial al reactivar (`revoked_at` y `revocation_reason` se limpian). Agregar al schema antes de que Backend implemente acciones administrativas:

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  user_id     String?
  action      String
  target_id   String?
  target_type String?
  detail      Json?
  ip          String?
  created_at  DateTime @default(now())
  user        User?    @relation(fields: [user_id], references: [id])

  @@map("audit_logs")
}
```

**I4 — Rol como String libre (impacto en `prisma/schema.prisma`)**

`role String @default("admin")` no restringe los valores válidos en la BD. Cambiar a enum de Prisma:

```prisma
enum UserRole {
  superadmin
  admin
}
```

### Hallazgos críticos que impactan la implementación de Backend

**C1 — Middleware y route handler de NextAuth ausentes**
`src/middleware.ts` y `src/app/api/auth/[...nextauth]/route.ts` deben ser la primera tarea de Backend — sin ellos, `/admin/*` es completamente público.

**C3 — Sin rate limiting en login**
Implementar antes de exponer el endpoint. Para MVP: Map en memoria (5 intentos / 10 min / IP). Ver detalles en `SECURITY_AUDIT.md` sección C3.

**C4 — `/api/files/[...path]` debe verificar sesión**
El route handler que sirve archivos del storage debe requerir `getServerSession` para rutas bajo `generations/` y `templates/`. Las fotos de verificación pública deben servirse desde un endpoint separado (`/api/public/photos/[verification_token]`).

### Quick wins a aplicar antes de empezar a codear

| Acción | Archivo | Tiempo |
|--------|---------|--------|
| Agregar `.env` al `.gitignore` | `.gitignore` | 1 min |
| Configurar `maxAge: 8 * 60 * 60` en la sesión JWT | `src/lib/auth.ts` línea 35 | 5 min |
| Corregir path traversal en `StorageAdapter.resolve()` | `src/lib/storage/adapter.ts` líneas 19–21 | 15 min |
| Agregar headers de seguridad | `next.config.mjs` | 30 min |
| Cambiar `NODE_ENV="development"` en `.env.example` | `.env.example` línea 6 | 2 min |

### Checklist de seguridad mínima antes del primer deploy

Ver checklist completo en [`docs/SECURITY_AUDIT.md` sección 5](./SECURITY_AUDIT.md). Los ítems bloqueantes son: C1, C2 (verification_token), C3 (rate limiting), C4 (archivos autenticados), C5 (AuditLog), QW1 (.gitignore), QW3 (JWT maxAge), QW4 (path traversal), ND4 (assertOwnership), ND5 (enum UserRole).
