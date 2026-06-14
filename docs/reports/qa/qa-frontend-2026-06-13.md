# Reporte QA Frontend — 2026-06-13

## Resumen

| Severidad | Cantidad |
|-----------|----------|
| CRÍTICO   | 0        |
| ALTO      | 2        |
| MEDIO     | 6        |
| BAJO      | 5        |
| OK        | 18       |

---

## Hallazgos

### [ALTO] — Botones de descarga con touch target de 40px (< 44px mínimo WCAG)

**Archivo:** `src/components/admin/generations/DownloadButtons.tsx:50`

**Descripción:** El componente `DownloadButton` interno usa `min-h-[40px]` en lugar de `min-h-[44px]`. Esto viola el criterio WCAG 2.1 AA 2.5.5 (Touch Target Size). Afecta a todos los botones de descarga (ZIP de diplomas y CSV de errores), que son la acción final más importante del flujo para el administrador.

**Recomendación:** Cambiar `min-h-[40px]` a `min-h-[44px]` en la línea 50.

---

### [ALTO] — `focus:outline-none` sin ring alternativo en inputs del ZoneEditor

**Archivo:** `src/components/admin/generations/ZoneEditor.tsx:140`

**Descripción:** El componente `NumInput` elimina el foco nativo con `focus:outline-none` pero NO agrega ninguna alternativa visible (`focus:ring-*`, `focus-visible:*`). Esto hace que el campo sea inaccesible para usuarios de teclado o tecnologías de asistencia. Afecta a los 6 inputs numéricos de coordenadas (X, Y, Ancho, Alto, Tamaño) del editor de zonas.

**Recomendación:** Agregar `focus:ring-1 focus:ring-gray-400` en el className del `<input>` de `NumInput`, o reemplazar `focus:outline-none` por `focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500` (patrón ya usado en el resto del proyecto).

---

### [MEDIO] — Input de nombre en `AssignNames` no tiene `aria-label` ni `<label>` asociado

**Archivo:** `src/components/admin/certificates/AssignNames.tsx:51-60`

**Descripción:** El `<input type="text">` para asignar el nombre del participante no tiene `id`, `htmlFor`, ni `aria-label`. Los lectores de pantalla no pueden anunciar el propósito del campo. El placeholder `"Nombre del participante"` no es suficiente — los placeholders desaparecen al escribir y no son leídos de manera confiable por todos los screen readers.

**Recomendación:** Agregar `aria-label={`Nombre del participante para folio ${cert.folio}`}` al `<input>`, o envolver en un `<label>` asociado con `htmlFor`/`id`.

---

### [MEDIO] — Columna CSV visible con nombre técnico `student_name` en lugar de término del producto

**Archivo:** `src/components/admin/generations/CsvUpload.tsx:113`

**Descripción:** La instrucción visible dice "Columnas requeridas: `student_name`, `program`." — el nombre de columna `student_name` es la clave de BD, no un término de UX. Aunque es necesario para la especificación técnica del CSV, genera confusión porque el sistema usa "participante" en toda la UI. No es un bug crítico, pero crea inconsistencia percibida.

**Recomendación:** Mantener `student_name` como nombre de columna CSV (necesario para el parser), pero agregar una aclaración inline: "Columnas requeridas: `student_name` (nombre del participante), `program`." — el equipo de producto debería decidir si renombrar la columna en el parser a `participante` para alinearse con la terminología.

---

### [MEDIO] — URL de descarga de plantilla CSV usa "alumnos" (terminología incorrecta)

**Archivo:** `src/components/admin/generations/CsvUpload.tsx:118`

**Descripción:** El enlace de descarga de la plantilla CSV apunta a `/plantilla-alumnos.csv`. El término "alumnos" viola la convención establecida en el sistema: debe usarse "participantes". La URL es visible al inspeccionar el HTML y el archivo descargado lleva ese nombre.

**Recomendación:** Renombrar el archivo en `/public/` a `plantilla-participantes.csv` y actualizar el `href` en la línea 118. Verificar que el archivo exista con el nombre correcto en `/public/`.

---

### [MEDIO] — `"Privacidad"` en el footer sin enlace funcional

**Archivo:** `src/app/v/[token]/page.tsx:91`

**Descripción:** El enlace "Privacidad" está renderizado como `<span>` en lugar de `<a>`. No es clicable, no tiene `href`, y visualmente aparece como texto del mismo color que el resto del footer de manera que simula un enlace pero no lo es. Para un usuario que quiere consultar la política de privacidad, es un dead-end.

**Recomendación:** Si existe una página de privacidad, reemplazar el `<span>` por `<a href="/privacidad" ...>Privacidad</a>`. Si no existe aún, eliminar el elemento hasta que haya destino, o convertirlo en texto plano explícitamente no-clicable.

---

### [MEDIO] — Modal de dialogo `CreateGenerationModal` no retorna el foco al cerrarse

**Archivo:** `src/components/admin/generations/CreateGenerationModal.tsx:41-71`

**Descripción:** El modal usa `role="dialog"` y `aria-modal="true"` correctamente, pero al cerrarse (con Escape o botón Cancelar), el foco no regresa explícitamente al botón que abrió el modal. El componente padre `CreateGenerationButton` no gestiona una ref al botón trigger. Para usuarios de teclado, el foco queda en un estado indefinido al cerrar el modal.

**Recomendación:** En `CreateGenerationButton`, almacenar una `ref` al `<button>` trigger. Al recibir `onClose`, invocar `triggerRef.current?.focus()`. Alternativamente, el modal puede hacer `document.activeElement` tracking al abrirse y restaurarlo al cerrarse.

---

### [MEDIO] — `focus:outline-none` sin alternativa en inputs de `LoginForm` y `CreateGenerationModal`

**Archivos:**
- `src/components/auth/LoginForm.tsx:77` y `LoginForm.tsx:98`
- `src/components/admin/generations/CreateGenerationModal.tsx:114` y `CreateGenerationModal.tsx:130`

**Descripción:** Los inputs de email/password en `LoginForm` y los inputs de nombre/prefijo en `CreateGenerationModal` usan `focus:outline-none focus:ring-1 focus:ring-gray-500`. El outline nativo se elimina, pero SÍ existe un `focus:ring` como alternativa — la combinación es aceptable. Sin embargo, el ring (`ring-gray-500`) tiene contraste bajo sobre fondo blanco con borde gris, lo que puede ser marginal para WCAG 2.1 AA (criterio 1.4.11 Non-text Contrast). Este hallazgo es de severidad MEDIO y requiere revisión visual con herramienta de contraste.

**Recomendación:** Verificar contraste del ring con herramienta (ej. Chrome DevTools > Accessibility) y considerar `focus:ring-gray-900` para garantizar contraste suficiente.

---

### [BAJO] — `<img>` nativa en ZoneEditor en lugar de `next/image`

**Archivo:** `src/components/admin/generations/ZoneEditor.tsx:378`

**Descripción:** El editor de zonas usa `<img>` nativa para renderizar la plantilla del diploma (`// eslint-disable-next-line @next/next/no-img-element`). El comentario eslint-disable indica que fue una decisión consciente (probablemente para evitar el comportamiento de layout de `next/image` que interferiría con el canvas drag-and-drop). Aun así, en la auditoría se registra como BAJO porque la imagen se carga sin optimización de Next.js.

**Recomendación:** La decisión de usar `<img>` es razonable en este contexto de editor visual (el aspect-ratio y el posicionamiento absoluto son incompatibles con el wrapper de `next/image`). Documentar el motivo con un comentario más descriptivo. Si el rendimiento se convierte en problema, explorar `next/image` con `fill` y `unoptimized={true}`.

---

### [BAJO] — Botón "Guardar" en `AssignNames` sin `type` explícito

**Archivo:** `src/components/admin/certificates/AssignNames.tsx:65`

**Descripción:** El `<button>` que llama a `handleSave` no tiene `type="button"`. Aunque no hay un `<form>` contenedor en este componente, la ausencia del atributo `type` hace que el botón tenga el valor por defecto `type="submit"` según la spec HTML, lo cual puede generar comportamiento inesperado si en el futuro se envuelve en un form.

**Recomendación:** Agregar `type="button"` al botón de Guardar en la línea 65.

---

### [BAJO] — `CsvErrorsTable` y `PhotoErrorsTable` usan índice de array como `key`

**Archivos:**
- `src/components/admin/generations/CsvErrorsTable.tsx:49` — `key={i}`
- `src/components/admin/generations/PhotoErrorsTable.tsx:63` — `key={i}`

**Descripción:** Las filas de las tablas de errores usan el índice del array como `key`. Aunque estas listas son estáticas (no reordenables ni filtrables), React puede generar warnings o reconciliaciones innecesarias. No impacta al usuario en el estado actual.

**Recomendación:** Usar una clave más estable: para `CsvErrorsTable`, `key={err.row_number}`; para `PhotoErrorsTable`, `key={err.entry}` (el nombre del archivo es único dentro de un ZIP).

---

### [BAJO] — Icono 3D de estado en `VerificationCard` tiene `alt=""` vacío pero está en contexto semántico relevante

**Archivo:** `src/components/verify/VerificationCard.tsx:170-176`

**Descripción:** El `<Image>` del icono 3D de estado (diploma válido/revocado/inválido) usa `alt=""`, lo que lo oculta a lectores de pantalla. El estado ya está comunicado por el banner con `role="status"` y `aria-label`, así que el `alt=""` es correcto en este caso — el icono es decorativo. Sin embargo, el mismo icono aparece en el trust ribbon (línea 249-255) también con `alt=""`, y allí sí es el único elemento visual de estatus.

**Recomendación:** El `alt=""` en ambas instancias es aceptable porque el estado del diploma ya se comunica vía el banner `role="status"` y el texto del trust ribbon. Confirmar que en todas las rutas de render existe siempre el banner de estado visible.

---

### [BAJO] — `AssignNames` muestra error como texto simple sin `role="alert"`

**Archivo:** `src/components/admin/certificates/AssignNames.tsx:73-75`

**Descripción:** Cuando `state === 'error'`, se muestra `<span className="text-sm text-red-500">Error</span>` sin `role="alert"` ni `aria-live`. El mensaje es demasiado genérico ("Error") y no tiene semántica de alerta para lectores de pantalla. El usuario de teclado no sabe qué falló.

**Recomendación:** (1) Agregar `role="alert"` al span. (2) Mejorar el mensaje: capturar el error de la API o mostrar "No se pudo guardar. Intenta de nuevo." en lugar de solo "Error".

---

## Items OK

### [OK] — Polling de GenerationProgress se limpia correctamente

**Archivo:** `src/components/admin/generations/GenerationProgress.tsx:34-69`

El `useEffect` retorna un cleanup que llama `clearInterval(interval)` y setea `isMounted = false`. El interval también se limpia desde dentro cuando `status === 'completed' || status === 'failed'`. No hay memory leak.

---

### [OK] — Server Components: datos de BD se fetchen en Server Components

Las páginas `GenerationsPage`, `CertificatesPage`, `CertificateDetailPage` y `VerifyPage` obtienen datos de Prisma directamente. Ningún Client Component hace fetch a la BD directamente.

---

### [OK] — Ningún Client Component importa módulos server-only (sharp, pdf-lib, canvas)

Verificado con grep. Los Client Components (`'use client'`) no importan ningún módulo server-only.

---

### [OK] — Todos los formularios deshabilitan el submit durante la petición

`LoginForm`, `CreateGenerationModal`, `GenerationProgress.handleStart`, `PreflightPanel.runPreflight`: todos usan `disabled={loading}` o equivalente en el botón de acción principal.

---

### [OK] — Estados de loading visibles en todas las operaciones async

Todos los uploads (CSV, ZIP, plantilla), el preflight, el inicio de generación, las descargas y el login muestran spinner o texto de estado mientras la petición está en vuelo.

---

### [OK] — Estados de error con mensaje accionable en todas las operaciones async

Todos los componentes async muestran mensajes de error con `role="alert"` y `aria-live="assertive"`. Los mensajes incluyen instrucciones ("Intenta de nuevo.", "Error de red.").

---

### [OK] — Terminología "participante/participantes" correcta en componentes visibles

Los componentes usan "participante" y "participantes" en toda la UI visible. Se detectó `student_name` en el CSV (registrado como MEDIO por separado) pero en labels, placeholders y mensajes se usa la terminología correcta.

---

### [OK] — Terminología "generación" correcta (no "campaña" ni "lote")

Grep negativo para "campaña" y "lote". Toda la UI usa "generación".

---

### [OK] — Terminología "revocar/revocado" correcta

El sistema no ofrece actualmente UI de acción de revocación en las páginas auditadas (solo muestra el estado). El `StatusBadge` muestra "Revocado" y el `RevocationBlock` en `CertificateDetail` usa "revocado". Los botones "Cancelar" que aparecen en los modales son para cancelar acciones (no para revocar diplomas), contexto correcto.

---

### [OK] — Imágenes usan `next/image` en casi todos los casos

`VerificationCard`, `VerificationError` y la página de verificación (`/v/[token]/page.tsx`) usan `next/image` con `width`, `height` y `alt` correctos. La excepción del ZoneEditor está registrada como BAJO con justificación.

---

### [OK] — `<html lang="es">` presente en root layout

**Archivo:** `src/app/layout.tsx:18` — `<html lang="es">`. Correcto para WCAG 3.1.1.

---

### [OK] — Todos los botones con solo icono tienen `aria-label`

El botón hamburger en `Header` tiene `aria-label="Abrir menú de navegación"`. Los SVG decorativos tienen `aria-hidden="true"`.

---

### [OK] — Touch targets de 44px en todos los controles interactivos principales

Botones de acción en `GenerationProgress`, `PreflightPanel`, `CsvUpload`, `PhotosUpload`, `TemplateUpload`, `CreateGenerationModal`, `Header`, `Sidebar`, `CertificateList` usan `min-h-[44px]`. La excepción es `DownloadButtons` (registrada como ALTO).

---

### [OK] — Formularios tienen `<label>` con `htmlFor` asociado correctamente

`LoginForm` (email/password), `CreateGenerationModal` (gen-name/gen-prefix), `CertificateFilters` (cert-search/cert-status/cert-generation) tienen labels con `htmlFor` e `id` correctamente vinculados.

---

### [OK] — Empty states presentes en listas

`GenerationsPage` y `CertificatesPage` usan `<EmptyState>` cuando no hay resultados. `DownloadButtons` muestra mensaje cuando la generación no está completa. `ZoneEditor` muestra mensaje cuando no hay imagen de plantilla.

---

### [OK] — `SessionProviderWrapper` y `AdminShell` justifican `'use client'`

`SessionProviderWrapper` necesita `useSession`/`SessionProvider` de next-auth (exclusivamente client). `AdminShell`, `Header` y `Sidebar` manejan estado de UI interactivo. Ningún `'use client'` es innecesario en este scope.

---

### [OK] — No existe `dangerouslySetInnerHTML` en el scope auditado

Grep negativo en todos los archivos del scope.

---

### [OK] — `aria-live` y `role="alert"` aplicados en mensajes de error y progreso

Los mensajes de error usan `role="alert" aria-live="assertive"`. Las regiones de progreso usan `aria-live="polite"`. El polling de generación tiene `<div aria-live="polite">` y `aria-live="assertive"` para el estado failed.

---

*Auditoría realizada sobre commit `6da32d8` (rama main) el 2026-06-13 por agente QA Frontend.*
