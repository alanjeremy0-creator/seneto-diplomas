# Plan Técnico: Sistema de Diplomas Digitales — Seneto

---

## Decisiones técnicas confirmadas

| Decisión | Resolución |
|----------|-----------|
| Integración al dominio | Opción A — nginx reverse proxy: `/v/*` y `/admin/*` apuntan al nuevo sistema |
| Hosting | Pendiente de definir (no usar Vercel — límites de tiempo en serverless impiden generar 150+ PDFs) |
| Job queue | Sin Bull/Redis para MVP — async simple |
| Formato de salida | PDF + PNG; ZIP descargable contiene solo PDFs |
| Tipografía del nombre | EB Garamond Medium Italic (peso 500, italic), 36pt base, auto-reduce hasta ~28pt si el nombre no cabe |
| Instalación de fuente | `npm install @fontsource/eb-garamond` — sin dependencia del sistema operativo |
| Folio | Sistema genera `SEN-2026-001` (3 dígitos); CSV puede traer `folio_override` opcional |
| Info pública en QR | Estado, nombre del alumno, programa, fecha, folio, institución, foto del alumno |
| Foto en página pública | Confirmada — se muestra intencionalmente |

---

## Preguntas críticas — supuestos adoptados

| # | Pregunta | Resolución |
|---|----------|------------|
| 1 | ¿Cómo está construido seneto.com? | Integración vía reverse proxy (Opción A) — el sistema es independiente |
| 2 | ¿Control de DNS y servidor propio? | Nginx/proxy disponible para redirigir `/v/*` |
| 3 | ¿El archivo de Illustrator se puede exportar como PNG de alta resolución? | **[SUPUESTO]** Sí — el equipo entregará el diploma como PNG de alta resolución como plantilla base |
| 4 | ¿Qué fuentes tipográficas usa el diseño? | EB Garamond Medium Italic — solo el nombre del alumno cambia de tipografía |
| 5 | ¿Las fotos de estudiantes tienen formato/dimensión estándar? | **[SUPUESTO]** JPG/PNG de tamaño variable; el sistema las recortará a la zona definida |
| 6 | ¿Los diplomas deben tener firma digital o protección PDF? | No para MVP — PDF plano sin protección |
| 7 | ¿Se necesita enviar diplomas por email? | No en MVP — solo descarga en panel admin |
| 8 | ¿Los IDs de folio vienen en el CSV o los genera el sistema? | El sistema genera; CSV puede incluir `folio_override` opcional |
| 9 | ¿Debe registrarse quién escaneó el QR? | No — solo mostrar la página, sin analytics de escaneo en MVP |
| 10 | ¿Hay más de un administrador? | **[SUPUESTO]** Uno para MVP — el modelo soportará más adelante |

---

## 1. Resumen ejecutivo

Se construirá un sistema web independiente alojado bajo el dominio de Seneto que resuelve dos problemas:

**Generación masiva**: Un panel administrativo privado permite subir una plantilla de diploma, cargar datos de alumnos vía CSV y fotos en ZIP, configurar visualmente las zonas de cada campo, y generar todos los diplomas en lote como archivos PDF descargables.

**Verificación pública**: Cada diploma tiene un ID único (formato `SEN-2026-001`) y una URL pública `https://seneto.com/v/SEN-2026-001` que muestra una página institucional de validación con foto del alumno, accesible desde el QR impreso en el diploma.

El sistema es una aplicación web full-stack con base de datos, almacenamiento de archivos, y dos interfaces distintas: panel privado y micrositio público. Se diseña para 150–500 diplomas por generación con capacidad de escalar a miles sin rediseño.

---

## 2. Alcance del MVP

| Funcionalidad | Incluida en MVP |
|---------------|----------------|
| Subir plantilla PNG de alta resolución | Sí |
| Editor de zonas con coordenadas manuales (x, y, w, h) | Sí |
| Carga de CSV con datos de alumnos | Sí |
| Carga de fotos en ZIP | Sí |
| Generación de folio único por diploma (SEN-2026-001) | Sí |
| Campo `folio_override` opcional en CSV | Sí |
| Generación de QR apuntando a URL pública | Sí |
| Composición del diploma final (texto + foto + QR sobre plantilla) | Sí |
| Exportación como PDF individual y ZIP grupal (solo PDFs) | Sí |
| PNG por diploma (almacenado, no incluido en ZIP principal) | Sí |
| Página pública `/v/:folio` con foto del alumno | Sí |
| Panel admin con login, generaciones, estado de generación | Sí |
| Revocar / reactivar certificados | Sí |
| Buscar certificados por nombre o folio | Sí |
| Manejo de errores por diploma sin abortar el lote | Sí |

---

## 3. Fuera del MVP (post-MVP)

- Envío de diplomas por email a estudiantes
- Detección automática de zonas en la plantilla (computer vision)
- Múltiples plantillas activas simultáneamente por generación
- Historial de cambios de estado de certificados (audit log completo)
- API pública para terceros que quieran verificar certificados
- Firma digital PDF (PKCS#7)
- Analytics de cuántos escaneos recibió cada QR
- Portal del estudiante para ver/descargar su propio diploma
- Múltiples roles de admin (superadmin, operador, readonly)
- Integración con plataforma LMS de Seneto

---

## 4. Arquitectura propuesta

```
┌─────────────────────────────────────────────────────────────────┐
│                         seneto.com                              │
│                                                                 │
│   ┌────────────────────┐     ┌──────────────────────────────┐  │
│   │  Reverse Proxy     │     │  Sistema de Diplomas         │  │
│   │  (nginx)           │────▶│  Next.js App                 │  │
│   │                    │     │                              │  │
│   │  /v/*     ──────────────▶│  Páginas públicas            │  │
│   │  /admin/* ──────────────▶│  Panel administrativo        │  │
│   │  /api/*   ──────────────▶│  API routes                  │  │
│   └────────────────────┘     └──────────────┬───────────────┘  │
└─────────────────────────────────────────────┼───────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────┐
                    │                         │                     │
           ┌────────▼────────┐    ┌───────────▼───────┐   ┌────────▼────────┐
           │   PostgreSQL    │    │  File Storage     │   │  Async Worker   │
           │   (Base de      │    │  (local /storage  │   │  (generación    │
           │   datos)        │    │   → R2 post-MVP)  │   │  en background) │
           └─────────────────┘    └───────────────────┘   └─────────────────┘
```

**Decisión arquitectónica clave**: Un único repositorio Next.js que maneja:
- Rutas públicas (`/v/:folio`)
- Panel admin (`/admin/*`)
- API (`/api/*`)
- Proceso de generación (worker async interno)

Esto elimina la complejidad de manejar múltiples servicios en el MVP.

---

## 5. Stack tecnológico

### Frontend + Backend: Next.js 14 (App Router)
**Por qué**: Resuelve en un solo proyecto las páginas públicas de verificación (SSR para velocidad en móvil), el panel administrativo, y las API routes. Evita mantener dos proyectos separados.

### Base de datos: PostgreSQL + Prisma ORM
**Por qué**: Datos relacionales claros (generaciones → certificados → plantillas). Prisma acelera el desarrollo y genera tipos TypeScript automáticamente. PostgreSQL escala bien y tiene soporte JSONB para almacenar configuración de zonas.

### Generación de imágenes: Sharp + node-canvas
**Por qué**:
- **Sharp** (libvips): composición de imágenes de alta velocidad — superpone foto del alumno y QR sobre la plantilla PNG.
- **node-canvas**: renderizado de texto con tipografías personalizadas sobre canvas — para el nombre del alumno con EB Garamond Medium Italic.
- Ambas corren dentro del mismo proceso Next.js sin servicios externos.

### Tipografía: EB Garamond Medium Italic via @fontsource
- Instalación: `npm install @fontsource/eb-garamond`
- Variante: peso 500, italic
- Tamaño base: 36pt (150px a 300 DPI); auto-reduce hasta ~28pt si el nombre no cabe en la zona
- Registro en node-canvas con `registerFont()` apuntando al archivo OTF del paquete

### Generación de PDF: pdf-lib
**Por qué**: Toma el PNG final y lo envuelve en un PDF de una página con las dimensiones correctas. Ligero, sin dependencias externas, 100% JavaScript.

### Generación de QR: qrcode (npm)
**Por qué**: Estándar de facto, sin dependencias de red, genera PNG en memoria.

### Almacenamiento de archivos: Local (MVP) → Cloudflare R2 (post-MVP)
**Por qué MVP local**: Simplifica el desarrollo inicial. La abstracción `StorageAdapter` se diseña desde el inicio para que el switch a R2/S3 sea de una función.

### Procesamiento en background: Async simple (MVP)
**Por qué**: Para 150 diplomas el procesamiento async sin job queue formal es suficiente. La generación corre en background, el cliente hace polling al endpoint de status para ver progreso.

### Autenticación admin: NextAuth.js (Credentials provider)
**Por qué**: Integración nativa con Next.js, maneja sesiones con cookies seguras.

### Hosting: Pendiente
No usar Vercel (límites de 60s en Serverless Functions impedirían generar 150 PDFs). Opciones viables: Railway, Render, VPS (Hetzner/DigitalOcean).

---

## 6. Modelo de datos

```
Table: users
─────────────────────────────────────────────────
id              UUID        PK
email           VARCHAR     UNIQUE NOT NULL
password_hash   VARCHAR     NOT NULL
role            ENUM        'superadmin' | 'admin'
created_at      TIMESTAMP
last_login_at   TIMESTAMP

Table: templates
─────────────────────────────────────────────────
id              UUID        PK
name            VARCHAR     NOT NULL
file_path       VARCHAR     (ruta al PNG base almacenado)
image_width_px  INTEGER     (dimensiones reales del PNG)
image_height_px INTEGER
field_zones     JSONB       (ver estructura abajo)
created_at      TIMESTAMP
updated_at      TIMESTAMP
is_active       BOOLEAN

field_zones JSONB structure:
{
  "name":    { "x": 400, "y": 820, "width": 900, "height": 80,
               "fontSize": 36, "fontSizeMin": 28,
               "fontColor": "#1A1A2E", "fontFamily": "EBGaramond",
               "fontWeight": "500", "fontStyle": "italic",
               "align": "center" },
  "photo":   { "x": 120, "y": 680, "width": 200, "height": 260 },
  "qr":      { "x": 1600, "y": 1800, "size": 220 },
  "folio":   { "x": 400, "y": 920, "width": 900, "height": 40,
               "fontSize": 24, "fontColor": "#666666", "align": "center" },
  "date":    { "x": 400, "y": 980, "width": 400, "height": 40,
               "fontSize": 24, "fontColor": "#666666", "align": "left" },
  "program": { "x": 400, "y": 760, "width": 900, "height": 50,
               "fontSize": 32, "fontColor": "#333333", "align": "center" }
}

Table: generations
─────────────────────────────────────────────────
id              UUID        PK
name            VARCHAR     NOT NULL
template_id     UUID        FK → templates.id
status          ENUM        'draft' | 'processing' | 'completed' | 'failed'
folio_prefix    VARCHAR     default 'SEN'
folio_year      INTEGER     default año actual
folio_counter   INTEGER     contador secuencial inicial (default: 1)
total_count     INTEGER     total de alumnos cargados
processed_count INTEGER     cuántos se han generado
error_count     INTEGER
zip_path        VARCHAR     ruta al ZIP final
created_by      UUID        FK → users.id
created_at      TIMESTAMP
updated_at      TIMESTAMP

Table: certificates
─────────────────────────────────────────────────
id              UUID        PK (ID interno)
folio           VARCHAR     UNIQUE 'SEN-2026-001' — ID público
generation_id   UUID        FK → generations.id
student_name    VARCHAR     NOT NULL
email           VARCHAR     (opcional)
program         VARCHAR
issued_date     DATE
status          ENUM        'active' | 'revoked' | 'expired'
photo_path      VARCHAR     (foto original del alumno)
diploma_pdf_path VARCHAR    (PDF final generado)
diploma_png_path VARCHAR    (PNG final generado)
error_message   VARCHAR     (si falló la generación)
created_at      TIMESTAMP
updated_at      TIMESTAMP
revoked_at      TIMESTAMP
revocation_reason VARCHAR

Table: generation_errors
─────────────────────────────────────────────────
id              UUID
generation_id   UUID        FK → generations.id
student_name    VARCHAR
row_number      INTEGER
error_type      VARCHAR     'missing_photo' | 'invalid_data' | 'render_error'
error_detail    VARCHAR
created_at      TIMESTAMP
```

---

## 7. Rutas y API necesarias

### Rutas públicas (sin autenticación)

```
GET  /v/:folio                    → Página de verificación pública
GET  /v/not-found                 → Página "certificado no encontrado"
```

### Rutas admin (UI)

```
GET  /admin/login                 → Formulario de login
GET  /admin                       → Dashboard (redirect a /admin/generations)
GET  /admin/generations           → Lista de generaciones
GET  /admin/generations/new       → Nueva generación
GET  /admin/generations/:id       → Detalle de generación
GET  /admin/generations/:id/template  → Editor de zonas de plantilla
GET  /admin/generations/:id/students  → Carga de alumnos
GET  /admin/generations/:id/generate  → Vista de progreso de generación
GET  /admin/certificates          → Búsqueda de certificados
GET  /admin/certificates/:folio   → Detalle de certificado
```

### API routes (JSON)

```
# Auth
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

# Templates
GET    /api/templates
POST   /api/templates              (multipart: sube PNG base)
GET    /api/templates/:id
PUT    /api/templates/:id          (actualiza field_zones)
DELETE /api/templates/:id

# Generations
GET    /api/generations
POST   /api/generations            (crea nueva generación)
GET    /api/generations/:id
PATCH  /api/generations/:id        (renombrar, cambiar plantilla)
DELETE /api/generations/:id        (solo en draft)

# Students / datos
POST   /api/generations/:id/csv    (multipart: sube CSV)
GET    /api/generations/:id/students  (lista de alumnos con estado)
POST   /api/generations/:id/photos (multipart: sube ZIP de fotos)
GET    /api/generations/:id/validate  (pre-flight: lista errores antes de generar)

# Generation job
POST   /api/generations/:id/generate  (dispara la generación async)
GET    /api/generations/:id/status    (polling: progreso en tiempo real)
GET    /api/generations/:id/download  (descarga ZIP de PDFs)
GET    /api/generations/:id/errors    (descarga CSV de errores)

# Certificates
GET    /api/certificates           (search: ?q=nombre&folio=SEN-2026-001)
GET    /api/certificates/:folio
PATCH  /api/certificates/:folio    (body: { status: 'revoked', reason: '...' })

# Public verify (sin auth)
GET    /api/verify/:folio          (usado por la página /v/:folio)
```

---

## 8. Flujo del administrador

```
1. LOGIN
   └── /admin/login → ingresa email + password → sesión con cookie segura

2. CREAR GENERACIÓN
   └── /admin/generations/new
       ├── Nombre de generación (ej. "Diplomado Liderazgo Q1 2026")
       ├── Prefijo de folio (default: SEN)
       └── Año y número inicial del contador

3. SUBIR PLANTILLA
   └── /admin/generations/:id/template
       ├── Sube PNG de alta resolución del diploma (≤50MB)
       ├── El sistema muestra la imagen en un editor
       └── Admin dibuja/arrastra rectángulos sobre las zonas:
           - Zona de nombre (tipografía: EB Garamond Medium Italic 36pt)
           - Zona de foto
           - Zona de QR
           - Zona de folio (opcional)
           - Zona de fecha / programa (opcional)
           Cada zona guarda: x, y, width, height + configuración de tipografía

4. CARGAR ALUMNOS
   └── /admin/generations/:id/students
       ├── Descarga plantilla CSV de ejemplo
       ├── Sube CSV con datos de alumnos
       ├── Vista previa de primeras filas + errores de parsing
       ├── Sube ZIP con fotos (nombradas igual que el campo "archivo_foto" del CSV)
       └── Sistema valida: ¿cada alumno tiene su foto?
           → Muestra lista de faltantes / problemas

5. VALIDACIÓN PRE-VUELO
   └── Botón "Validar antes de generar"
       ├── Lista de alumnos sin foto
       ├── Nombres demasiado largos para la zona (que no cabrían ni en 28pt)
       ├── Datos faltantes
       └── Admin decide: corregir o continuar ignorando errores

6. GENERAR DIPLOMAS
   └── Botón "Generar todos los diplomas"
       ├── Job se lanza en background (async)
       ├── Pantalla de progreso: barra con X/150 completados (polling)
       ├── Errores individuales visibles en tiempo real
       └── Al terminar: botón "Descargar ZIP"

7. REVISIÓN Y GESTIÓN
   └── /admin/certificates
       ├── Buscar por nombre o folio
       ├── Ver estado de cada certificado
       ├── Revocar con motivo
       └── Reactivar certificado revocado
```

---

## 9. Flujo del usuario que escanea el QR

```
1. Escanea QR del diploma físico o impreso
   └── QR contiene: https://seneto.com/v/SEN-2026-042

2. Llega a /v/SEN-2026-042
   └── El servidor busca el folio en la base de datos (SSR)

3a. Certificado ACTIVO → muestra página con:
    ├── ✓ "Diploma válido" (color verde, mensaje institucional)
    ├── Foto del alumno
    ├── Nombre del alumno
    ├── Programa o diplomado
    ├── Fecha de emisión
    ├── Folio: SEN-2026-042
    ├── Institución: Seneto
    ├── Logo e identidad visual de Seneto
    └── Mensaje: "Este diploma fue emitido por Seneto..."

3b. Certificado REVOCADO → muestra:
    ├── ✗ "Diploma revocado"
    └── No se muestra información adicional del alumno

3c. Certificado EXPIRADO → muestra:
    ├── ⚠ "Diploma expirado"
    └── Nombre y fecha de emisión

3d. Folio no existe → muestra:
    └── Página clara "Este código no corresponde a ningún diploma emitido por Seneto"

4. La página es completamente pública, sin login, optimizada para móvil
   └── Tiempo de carga objetivo: < 1 segundo
```

---

## 10. Proceso de generación de diplomas paso a paso

```
Para cada alumno en el CSV:

PASO 1: Cargar base
  ├── Leer PNG de plantilla desde almacenamiento
  └── Crear buffer Sharp con la imagen base

PASO 2: Procesar foto del alumno
  ├── Leer foto del alumno desde almacenamiento
  ├── Redimensionar y recortar al tamaño de la zona definida (ej. 200×260px)
  ├── Aplicar recorte centrado (equivalente a object-fit: cover)
  └── Preparar como overlay

PASO 3: Generar QR
  ├── Construir URL: https://seneto.com/v/SEN-2026-042
  ├── Generar QR como PNG en memoria (sin escribir a disco)
  ├── Error correction level: M (15%)
  ├── Redimensionar al tamaño de la zona QR (ej. 220×220px)
  └── Preparar como overlay

PASO 4: Renderizar texto del nombre
  ├── Cargar EB Garamond Medium Italic desde @fontsource con registerFont()
  ├── Crear canvas con las dimensiones de la zona del nombre
  ├── Intentar renderizar a 36pt (150px a 300 DPI)
  ├── Si el texto no cabe en el ancho de la zona:
  │   └── Reducir font-size en pasos de 2pt hasta que quepa (mínimo 28pt)
  ├── Renderizar texto centrado/alineado
  └── Convertir canvas a PNG buffer para overlay

PASO 5: Renderizar otros campos de texto (folio, fecha, programa)
  ├── Mismo proceso para cada zona de texto configurada
  └── Fuente: la configurada por zona (puede ser diferente a EB Garamond)

PASO 6: Componer imagen final
  ├── Sharp composite en orden: [foto, qr, texto_nombre, texto_folio, ...]
  └── Aplicar todos los overlays sobre la imagen base

PASO 7: Exportar
  ├── Guardar PNG final en /storage/generations/:id/diplomas_png/SEN-2026-042.png
  ├── Crear PDF de una página con pdf-lib usando el PNG
  ├── Guardar PDF en /storage/generations/:id/diplomas/SEN-2026-042.pdf
  └── Actualizar certificate en DB: diploma_pdf_path, diploma_png_path, status

PASO 8: Manejo de errores individuales
  ├── Si falla un diploma: registrar en generation_errors, continuar con siguiente
  ├── Incrementar generation.error_count
  └── El diploma con error queda sin archivo generado pero el registro existe en DB

PASO 9: Finalizar lote
  ├── Comprimir todos los PDFs generados en un ZIP
  ├── Guardar ZIP en /storage/generations/:id/output/nombre_generación.zip
  ├── Actualizar generation.status = 'completed'
  └── El admin puede ver el botón "Descargar ZIP" en el panel
```

---

## 11. Manejo de archivos

### Estructura de directorios en almacenamiento

```
/storage
  /templates
    /{template_id}/
      base.png                     ← PNG alta resolución del diploma
      fonts/                       ← fuentes adicionales si se necesitan

  /generations
    /{generation_id}/
      /photos/                     ← fotos individuales extraídas del ZIP
        juan_perez.jpg
        maria_garcia.png
      /diplomas/                   ← PDFs generados (van en el ZIP)
        SEN-2026-001.pdf
        SEN-2026-002.pdf
      /diplomas_png/               ← PNGs generados (preview, no en ZIP)
        SEN-2026-001.png
      /output/
        nombre_generación.zip      ← ZIP final descargable

  /uploads/temp/                   ← archivos temporales (se eliminan tras procesar)
    {uuid}_students.csv
    {uuid}_photos.zip
```

### Políticas de archivos

| Tipo | Límite | Tipos permitidos | Eliminación |
|------|--------|------------------|-------------|
| Plantilla PNG | 50 MB | PNG, JPG | Manual desde admin |
| Foto individual | 10 MB | JPG, PNG, WEBP | Con la generación |
| ZIP de fotos | 500 MB | ZIP | Después de extraer |
| CSV de alumnos | 5 MB | CSV, XLSX | Después de procesar |
| ZIP de salida | Sin límite | ZIP | Manual o tras N días |

### Abstracción de storage

Se define una interfaz `StorageAdapter` con métodos `put(path, buffer)`, `get(path)`, `delete(path)`, `url(path)`. El MVP usa implementación local. Post-MVP se conecta Cloudflare R2 sin cambiar el resto del código.

---

## 12. Estrategia de generación de QR

- **Biblioteca**: `qrcode` (npm) — genera PNG, sin red, determinista
- **Contenido del QR**: URL completa `https://seneto.com/v/SEN-2026-042`
- **Formato de salida**: PNG en buffer (no se escribe a disco como paso intermedio)
- **Tamaño**: configurable por zona (ej. 220×220px), margen blanco incluido
- **Error correction level**: `M` (15% — balance entre tamaño y robustez para impresión)
- **Color**: negro sobre blanco; fondo blanco garantizado para legibilidad del scanner
- **Cuándo se genera**: durante el proceso de composición, en memoria, sin almacenamiento separado

---

## 13. Estrategia de páginas públicas de validación

### Renderizado: Server-Side Rendering (SSR)

La ruta `/v/:folio` se renderiza en el servidor en cada request. Garantiza:
- Datos siempre frescos (si un certificado se revoca, se refleja inmediatamente)
- Velocidad de carga desde celular (HTML completo, no requiere JS para renderizar)
- Indexable si Seneto lo desea

### Estructura de la página pública

```
Header: Logo Seneto
────────────────────────────────────
[Estado visual prominente]
✓ Diploma Válido          (verde)
✗ Diploma Revocado        (rojo)
⚠ Certificado No Encontrado

────────────────────────────────────
[Foto del alumno]
Nombre del alumno
Programa / Diplomado
Fecha de emisión: 15 de enero de 2026
Folio: SEN-2026-042
Institución: Seneto
────────────────────────────────────
Mensaje institucional:
"Este documento fue emitido por Seneto..."

Footer: seneto.com | Privacidad
```

### Performance y seguridad

- **Cache**: Respuesta cacheable en nginx por 60 segundos — balance entre frescura y rendimiento
- **Rate limiting**: máximo 30 requests por IP por minuto a `/api/verify/:folio`
- **No exponer**: email del alumno, ruta interna de archivos, UUID interno
- **404 semántico**: si el folio no existe, HTTP 404 + página amigable
- **Si revocado**: no se muestra foto ni nombre del alumno — solo el estado

---

## 14. Riesgos técnicos y mitigaciones

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|-------------|-----------|
| Generación de 150 PDFs bloquea el servidor | Alto | Alto | Procesamiento en background async; endpoint de polling para progreso |
| Fuente EB Garamond no carga correctamente en node-canvas | Alto | Medio | Probar carga de fuente en entorno de CI antes de merge; incluir test de renderizado |
| ZIP de fotos muy grande (>500MB) | Medio | Medio | Extracción streaming sin cargar todo en RAM |
| Nombre de alumno demasiado largo para la zona | Medio | Alto | Auto-reduce de 36pt a 28pt; alerta en validación pre-vuelo |
| Pérdida del ZIP generado si el servidor se reinicia | Medio | Bajo | Guardar en almacenamiento persistente, no en `/tmp` |
| Integración nginx con seneto.com es compleja | Medio | Medio | Documentar config nginx; tener subdomain como fallback |
| Foto del alumno con proporción muy diferente a la zona | Medio | Alto | Recorte automático centrado (object-fit: cover equivalente en Sharp) |
| Inyección en nombre del alumno (XSS) | Medio | Bajo | Sanitización en input y escape en output HTML |
| Suplantación de páginas de verificación | Bajo | Bajo | HTTPS obligatorio; URL canónica es seneto.com |

---

## 15. Decisiones pendientes antes de construir

| Decisión | Estado |
|----------|--------|
| Integración con seneto.com | ✅ Opción A — nginx reverse proxy |
| Hosting del sistema | ⏳ Pendiente |
| Job queue | ✅ Async simple para MVP |
| Formato de salida | ✅ PDF + PNG; ZIP contiene solo PDFs |
| Tipografía | ✅ EB Garamond Medium Italic, 36pt, auto-reduce a 28pt |
| Folio | ✅ SEN-2026-001 generado por sistema; `folio_override` en CSV |
| Info pública | ✅ Estado, nombre, foto, programa, fecha, folio, institución |
| ¿Hay consentimiento de los alumnos para mostrar su foto públicamente? | ⏳ Seneto debe confirmar |

---

## 16. Plan de desarrollo por fases

### Fase 1 — MVP funcional (4–6 semanas)
Generar y verificar diplomas. Todo lo esencial.

### Fase 2 — Estabilidad y experiencia (2 semanas)
- Editor visual de zonas mejorado (drag & drop en lugar de solo coordenadas numéricas)
- Preview en tiempo real del diploma antes de generar
- Exportación de errores como CSV
- Logs de acciones admin

### Fase 3 — Escala y features extra (según demanda)
- Envío de diplomas por email
- Analytics de escaneos de QR
- Portal del estudiante
- API pública de verificación
- Switch a Cloudflare R2

---

## 17. Tareas concretas para la Fase 1

### Sprint 1 (días 1–7): Infraestructura base

- [ ] Inicializar proyecto Next.js 14 con TypeScript, Tailwind, ESLint
- [ ] Configurar PostgreSQL + Prisma, definir schema inicial
- [ ] Crear migraciones: `users`, `templates`, `generations`, `certificates`, `generation_errors`
- [ ] Implementar autenticación con NextAuth.js (Credentials provider, bcrypt)
- [ ] Crear layout del panel admin con sidebar y header
- [ ] Implementar ruta de login `/admin/login`
- [ ] Configurar estructura de almacenamiento local (`/storage`)
- [ ] Definir interfaz `StorageAdapter` con implementación local
- [ ] Configurar variables de entorno: `DATABASE_URL`, `NEXTAUTH_SECRET`, `BASE_URL`, `STORAGE_PATH`

### Sprint 2 (días 8–14): Plantilla y editor de zonas

- [ ] Crear página de nueva generación (`/admin/generations/new`)
- [ ] Implementar subida de PNG de plantilla (multipart, validación de tipo y tamaño)
- [ ] Crear editor de zonas: mostrar imagen de plantilla con overlay de zonas configuradas
- [ ] Formulario de edición de zona: x, y, width, height, fontSize, fontSizeMin, fontColor, fontFamily, align
- [ ] Implementar preview de zona sobre la imagen (marcadores visuales)
- [ ] Guardar `field_zones` como JSONB en template
- [ ] Instalar `@fontsource/eb-garamond` y probar registro de fuente en node-canvas

### Sprint 3 (días 15–21): Carga de alumnos y validación

- [ ] Implementar parser de CSV con validación de columnas esperadas (incluyendo `folio_override` opcional)
- [ ] Formulario de carga de CSV con preview de primeras filas y errores
- [ ] Implementar extracción de ZIP de fotos (streaming, sin cargar todo en RAM)
- [ ] Validación de coincidencia foto-alumno: listar faltantes
- [ ] API `GET /api/generations/:id/validate` con resultado de pre-vuelo
- [ ] Crear registros de `certificates` en DB al cargar CSV (estado: `pending`)
- [ ] UI de validación pre-vuelo

### Sprint 4 (días 22–28): Motor de generación

- [ ] Instalar y configurar `sharp`, `node-canvas`, `qrcode`, `pdf-lib`
- [ ] Registrar EB Garamond Medium Italic con `registerFont()` al iniciar el worker
- [ ] Implementar `renderText(text, zone) → Buffer` con auto-reduce de font-size
- [ ] Implementar `generateQR(url, size) → Buffer`
- [ ] Implementar `composeDiploma(certificate, template, zones) → { png, pdf }`
- [ ] Implementar `generateBatch(generationId)` — itera alumnos, llama `composeDiploma`, maneja errores
- [ ] Implementar compresión ZIP de todos los PDFs generados
- [ ] Endpoint `POST /api/generations/:id/generate` — dispara generación async
- [ ] Endpoint `GET /api/generations/:id/status` — progreso via polling

### Sprint 5 (días 29–35): Página pública de verificación

- [ ] Crear ruta `/v/[folio]/page.tsx` con SSR
- [ ] Endpoint `GET /api/verify/:folio` — busca en DB, devuelve datos públicos
- [ ] Diseño mobile-first de la página de verificación:
  - Estado visual prominente (activo/revocado/no encontrado)
  - Foto del alumno (solo si activo)
  - Datos del diploma
  - Identidad visual de Seneto
- [ ] Página de "certificado no encontrado"
- [ ] Rate limiting en la ruta de verificación (middleware Next.js)

### Sprint 6 (días 36–42): Gestión de certificados y QA

- [ ] Página de búsqueda de certificados en admin
- [ ] Detalle de certificado con botón de revocar/reactivar
- [ ] Endpoint `PATCH /api/certificates/:folio`
- [ ] Dashboard de generación: progreso, errores, descarga ZIP
- [ ] Descarga de ZIP y CSV de errores desde panel admin
- [ ] Pruebas end-to-end del flujo completo con datos reales
- [ ] Revisión de seguridad: validación de inputs, tipos de archivo, autenticación en rutas protegidas
- [ ] Configurar nginx en ambiente de producción de Seneto
- [ ] Deploy a producción

---

## 18. Criterios de aceptación del MVP

El MVP está terminado cuando:

- [ ] Un admin puede iniciar sesión y crear una generación desde cero
- [ ] El admin puede subir un PNG de plantilla y definir al menos 4 zonas (nombre, foto, QR, folio) con coordenadas manuales
- [ ] El admin puede subir un CSV con 10+ alumnos y un ZIP con sus fotos
- [ ] El sistema valida que cada alumno tenga su foto antes de generar
- [ ] Se pueden generar 150 diplomas sin que la página expire o el servidor se caiga
- [ ] El nombre del alumno se renderiza en EB Garamond Medium Italic a 36pt (o menor si no cabe)
- [ ] Cada diploma generado tiene: nombre correcto, foto del alumno, QR funcional, folio visible
- [ ] El ZIP descargable contiene todos los diplomas en PDF
- [ ] Escanear el QR del diploma lleva a `seneto.com/v/SEN-2026-001`
- [ ] La página de verificación muestra foto, estado, nombre, programa, fecha y folio correctamente
- [ ] La página de verificación carga en menos de 2 segundos en un celular con 4G
- [ ] Si un diploma es revocado, la página pública refleja el cambio inmediatamente (sin foto ni nombre)
- [ ] Los diplomas con errores (foto faltante, datos incompletos) se reportan sin detener el lote
- [ ] Las rutas del panel admin requieren autenticación
- [ ] Las rutas públicas (`/v/*`) no requieren autenticación y no exponen datos sensibles

---

## 19. División de trabajo entre agentes de Claude Code

### Agente de Arquitectura
**Rol**: Punto de partida. Define la estructura del proyecto antes que todos.

**Entregables**:
- Inicialización del repositorio Next.js con la estructura de carpetas
- Schema de Prisma completo con todas las tablas
- Interfaces TypeScript compartidas (`Certificate`, `Template`, `Generation`, `FieldZones`)
- Interfaz `StorageAdapter` y su implementación local
- Variables de entorno documentadas en `.env.example`
- Configuración de Tailwind, ESLint, path aliases

**No hace**: nada de lógica de negocio, UI, ni generación de PDFs.

---

### Agente Backend
**Rol**: Toda la API y lógica de negocio excepto la generación de imágenes.

**Entregables**:
- API routes de autenticación (NextAuth)
- CRUD de templates, generations, certificates
- Parser y validador de CSV (incluyendo campo `folio_override`)
- Generación de folios secuenciales formato `SEN-2026-001`
- Extractor de ZIP de fotos con validación
- Endpoint de generación (dispara el job, no lo implementa)
- Endpoint de status con polling
- Endpoint de verificación pública con rate limiting
- Descarga de ZIP

**Dependencias**: Schema de Prisma e interfaces del Agente de Arquitectura.

---

### Agente Frontend
**Rol**: Toda la UI — panel admin y página pública.

**Entregables**:
- Layout del panel admin (sidebar, header, auth guard)
- Página de login
- Dashboard de generaciones (lista, crear)
- Editor de zonas de plantilla (formulario con inputs numéricos + preview visual)
- Formulario de carga de CSV con preview
- Formulario de carga de fotos + validación
- Vista de progreso de generación (polling al endpoint de status)
- Búsqueda y detalle de certificados
- Botones de revocar/reactivar
- Página pública `/v/:folio` — mobile-first, diseño institucional Seneto, con foto del alumno

**Dependencias**: API routes del Agente Backend.

---

### Agente Generación PDF/Imagen
**Rol**: El motor de composición — la parte técnicamente más delicada.

**Entregables**:
- Instalación y configuración de `sharp`, `node-canvas`, `qrcode`, `pdf-lib`, `@fontsource/eb-garamond`
- Registro de EB Garamond Medium Italic (peso 500, italic) con `registerFont()`
- Función `renderText(text, zone) → Buffer` con auto-reduce 36pt → 28pt
- Función `generateQR(url, size) → Buffer` (error correction M)
- Función `composeDiploma(certificate, templateBuffer, fieldZones) → { png: Buffer, pdf: Buffer }`
- Función `generateBatch(generationId)` — itera certificados, registra errores individuales
- Función `createZip(pdfPaths) → Buffer`
- Tests con datos reales de un diploma de ejemplo

**Dependencias**: Interfaz `StorageAdapter`, interfaces de tipos, y una plantilla PNG de prueba.

---

### Agente QA/Reviewer
**Rol**: Revisión cruzada, pruebas de integración y criterios de aceptación.

**Entregables**:
- Prueba del flujo completo end-to-end con dataset de 10 alumnos
- Verificación de que EB Garamond Medium Italic se renderiza correctamente en el diploma
- Verificación de que el QR apunta a la URL correcta y la página carga
- Verificación de foto del alumno visible en la página pública cuando activo
- Prueba de revocación: foto y nombre desaparecen de la página pública
- Revisión de seguridad: rutas protegidas, tipos de archivo, rate limiting
- Verificación de la página pública en móvil (Chrome DevTools mobile)
- Revisión de manejo de errores: alumno sin foto, nombre muy largo, CSV con datos faltantes
- Informe de hallazgos con referencias al código

**Dependencias**: Sistema funcionando; trabaja al final de cada sprint.

---

### Secuencia de activación de agentes

```
Semana 1:    Arquitectura → [desbloquea a todos]
                  ↓
Semana 1-2:  Backend + Frontend (paralelo, desde interfaces compartidas)
                  ↓
Semana 2-3:  PDF/Imagen (paralelo con Frontend)
                  ↓
Semana 3-4:  QA/Reviewer (después de Backend + PDF/Imagen)
                  ↓
Semana 4:    Frontend conecta a API real + QA final + deploy
```
