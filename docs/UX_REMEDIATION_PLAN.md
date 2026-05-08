# UX Remediation Plan — Sistema de Diplomas Seneto

> Generado por el Agente Product Design el 2026-05-07.
> Basado en `docs/UX_AUDIT.md` (hallazgos HC1–HC3, HI1–HI5) y alineado con `docs/SECURITY_REMEDIATION_PLAN.md`.
> Este documento NO repite la auditoría — convierte sus hallazgos en trabajo ejecutable.

---

## 1. Decisión UX general para MVP

### Qué problemas UX bloquean el diseño final

Los siguientes hallazgos impiden cerrar el diseño de la vista pública y del flujo de revocación. Sin resolverlos, el Frontend no puede implementar pantallas definitivas:

- **HC1 — Foto del egresado en `/v/[token]`:** Mientras no exista una decisión aprobada por Seneto, el diseño de la tarjeta de verificación pública no puede cerrarse. El wireframe actual tiene un placeholder de foto que puede o no estar presente en producción.
- **HC2 — URLs de verificación:** Todos los documentos UX aún referencian `/v/{folio}`. El diseño de QR, la jerarquía visual de la tarjeta pública y el copy del enlace de verificación dependen de que esta referencia esté corregida antes de que Frontend comience a maquetar.
- **HC3 — Copy de error 500:** Sin este texto documentado, el desarrollador puede dejar mensajes técnicos o vacíos ante fallos inesperados del servidor.

### Qué decisiones deben cerrarse antes de desarrollo frontend

| Decisión | Urgencia | Quién aprueba |
|---|---|---|
| ¿La foto del egresado aparece en la vista pública MVP? | Bloqueante Sprint 2 | Seneto |
| ¿Se muestra nombre completo o parcial en `/v/[token]`? | Bloqueante Sprint 2 | Seneto |
| Texto para certificado revocado en vista pública | Bloqueante Sprint 2 | Seneto |
| ¿El modal de revocación exige confirmación tipada ("REVOCAR") o solo motivo de texto? | Bloqueante Sprint 1 | Product |

### Qué riesgos de privacidad existen en la página pública

- La URL del QR con folio secuencial (`/v/SEN-2026-001`) permite enumerar todos los certificados del sistema sin autenticación (IDOR — hallazgo C2 de la auditoría de seguridad). Riesgo resuelto en Backend con `verification_token` UUID, pero la UI no debe revelar el token como texto visible.
- Mostrar la foto biométrica del egresado en una URL pública sin consentimiento explícito expone un dato personal sensible bajo la regulación mexicana. La foto está vinculada a nombre completo y programa — combinación suficiente para perfilado.
- El estado "revocado" con fecha y motivo visible expone información sensible del egresado a cualquier visitante que escanee el QR. El texto recomendado es genérico: no revelar fecha ni motivo en la vista pública.
- Sin aviso de privacidad en la página de verificación pública, Seneto incumple el requisito de informar al titular sobre el tratamiento de sus datos.

### Qué se recomienda para MVP vs v2

**MVP:**
- Sin foto del egresado en la vista pública.
- Nombre completo visible (necesario para verificación efectiva).
- Estado de certificado revocado como "Certificado no válido" sin detalles adicionales.
- Aviso de privacidad breve en el footer de `/v/[token]`.
- Modal de revocación con campo de motivo requerido (mínimo 10 caracteres), sin confirmación tipada.
- Folio visible como texto de referencia; token UUID solo en la URL, nunca como texto visible.

**v2:**
- Foto del egresado tras opt-in explícito documentado en el proceso de carga del CSV.
- Confirmación tipada en modal de revocación para acción crítica reforzada.
- Página de verificación pública con avatar generativo (iniciales) cuando no hay foto consentida.

**Para MVP, la vista pública de verificación no debe mostrar foto del egresado por defecto. La credencial debe validarse por datos mínimos del diploma, estatus, institución, folio visible y token privado en la URL.**

---

## 2. Política de datos visibles en /v/[token]

La siguiente tabla define exactamente qué datos retorna el endpoint público `GET /v/[token]` y qué se muestra en la tarjeta de verificación. Esta política se aplica a `VerifyResponse` en `src/types/api.ts`.

| Dato | Visibilidad MVP | Justificación UX/privacidad | Requiere aprobación |
|---|---|---|---|
| Foto del egresado | Oculta — no se muestra ni se incluye en la respuesta | Dato biométrico sensible; sin consentimiento documentado; riesgo de scraping con nombre y programa. Reservado para v2 con opt-in. | Seneto debe confirmar exclusión antes de Sprint 2 |
| Nombre completo | Visible | Necesario para que el verificador (empleador, institución) confirme que el diploma pertenece a la persona que se lo presenta. Un nombre parcial reduce la utilidad verificadora. | Seneto (recomendación: mostrar) |
| Nombre parcial (alternativa) | No recomendado para MVP | Si se elige nombre parcial, definir formato exacto ("Juan P. G.") antes de implementar. | Seneto |
| Programa / curso | Visible | Es el objeto principal de la verificación. Sin él, la tarjeta no cumple su función. | No requiere aprobación adicional |
| Institución (Seneto) | Visible | Establece la autoridad emisora. Texto fijo: "Seneto". | No requiere aprobación adicional |
| Fecha de emisión | Visible | Contexto temporal necesario para la verificación. | No requiere aprobación adicional |
| Fecha de expiración | Visible si aplica | Solo mostrar si el certificado tiene expiración configurada. Si no aplica, no mostrar el campo. | No requiere aprobación adicional |
| Folio público (SEN-2026-001) | Visible como referencia | Identificador legible para el humano. El verificador puede citarlo en comunicaciones. Nunca usar como URL. | No requiere aprobación adicional |
| Token UUID | No visible como texto | Solo existe en la URL del QR y del navegador. Nunca renderizar como texto en la tarjeta. | N/A — decisión técnica |
| ID interno de BD | No visible | Dato interno sin valor para el verificador externo. Riesgo de exposición de estructura interna. | N/A — excluido por defecto |
| Estado del certificado | Visible | Información central de la verificación: "Válido", "No válido". Sin estado, la página no tiene utilidad. | Texto exacto requiere aprobación de Seneto |

**Nota explícita:** Los campos `email`, `teléfono`, `CURP`, `RFC` y `dirección` del egresado están fuera del scope del MVP y no deben incluirse en `VerifyResponse` bajo ninguna circunstancia. No agregar estos campos aunque el modelo de BD los tenga disponibles.

**Nota para Backend:** La interfaz `VerifyResponse` en `src/types/api.ts` no debe incluir ningún campo personal del egresado más allá de los marcados como "Visible" en esta tabla. El endpoint `GET /api/verify/[token]` o la Server Component `src/app/v/[token]/page.tsx` debe seleccionar explícitamente los campos retornados — nunca retornar el objeto `Certificate` completo desde la BD.

---

## 3. Actualizaciones obligatorias a documentos UX

Los siguientes cambios deben aplicarse en los documentos UX antes de que Frontend comience a maquetar. Son cambios de alineación, no de diseño nuevo.

### WIREFRAMES.md

- **Renombrar la pantalla pública:** Toda referencia a `/v/{folio}` (incluidos títulos de pantalla, notas de diseño, rutas en el breadcrumb de wireframe) debe actualizarse a `/v/{token}`.
- **Actualizar la tarjeta de verificación pública:** Eliminar el elemento de foto del hero de la tarjeta. Marcar el espacio con una nota: "Foto — variante v2, requiere consentimiento documentado. No implementar en MVP."
- **Jerarquía visual sin foto:** Con la foto eliminada del MVP, el elemento principal de la tarjeta pasa a ser el nombre del egresado, seguido del programa y la institución. Actualizar el wireframe para reflejar esta jerarquía.
- **Token en URL:** Agregar una nota en el wireframe de la barra de navegación del browser que indique: "La URL contiene un UUID. No es legible por humanos pero tampoco se renderiza en la página."

### USER_FLOWS.md

**F-11 — Verificación pública (actualización completa):**
- El trigger del flujo es "escanear QR del diploma" o "abrir URL con token".
- La URL procesada es `/v/{token}` donde `{token}` es un UUID v4 generado en la emisión del diploma.
- Los datos mínimos mostrados son: nombre completo, programa, institución, fecha de emisión, folio (texto), estado.
- Definir los 5 estados de respuesta del endpoint con sus transiciones:
  1. `certificate.active` — tarjeta verde, texto "Válido"
  2. `certificate.revoked` — tarjeta roja, texto "No válido" (sin detalles de revocación)
  3. `certificate.expired` — tarjeta amarilla, texto "Expirado" (solo si fecha de expiración aplica)
  4. `token.not_found` — pantalla de error 404, texto "No se encontró este certificado"
  5. `token.invalid_format` — pantalla de error 400, texto "El enlace no es válido"

**F-09 — Revocación de diploma (actualización):**
- El modal de confirmación debe incluir:
  1. Nombre del egresado y folio del diploma a revocar (para que el admin confirme que es el correcto).
  2. Campo de texto obligatorio "Motivo de revocación" con mínimo 10 caracteres y máximo 500.
  3. Mensaje de consecuencia visible antes del CTA de confirmar: "Al confirmar, el egresado verá 'Certificado no válido' al escanear el QR. Esta acción queda registrada en el historial de auditoría."
  4. El motivo ingresado se guarda en `AuditLog.detail` (ver hallazgo C5 de la auditoría de seguridad).
  5. La confirmación tipada ("escribir REVOCAR") se posterga para v2.

### COPY.md

Agregar los siguientes 13 estados al documento de copy. Cada estado incluye: título, subtítulo, CTA principal (si aplica), tono.

**1. Certificado válido**
- Título: "Certificado válido"
- Subtítulo: "Este certificado fue emitido por Seneto y se encuentra vigente."
- Tono: Confianza, confirmación clara.

**2. Certificado revocado**
- Título: "Certificado no válido"
- Subtítulo: "Este certificado ya no se encuentra vigente."
- Tono: Neutro, sin alarmismo. Sin revelar motivo ni fecha.
- Nota: No usar la palabra "revocado" en la vista pública — es jerga interna.

**3. Certificado expirado**
- Título: "Certificado expirado"
- Subtítulo: "La vigencia de este certificado ha concluido."
- Tono: Informativo, sin juicio.

**4. Certificado no encontrado (404)**
- Título: "No encontramos este certificado"
- Subtítulo: "El enlace puede ser incorrecto o el certificado no existe en nuestro sistema."
- CTA: "Volver al inicio"
- Tono: Neutral. No sugerir que el certificado fue eliminado.

**5. Token inválido (400)**
- Título: "El enlace no es válido"
- Subtítulo: "Este enlace de verificación tiene un formato incorrecto. Verifica que estás usando el QR original del diploma."
- Tono: Orientado a la acción correctiva.

**6. Error temporal (503 / timeout)**
- Título: "El servicio no está disponible en este momento"
- Subtítulo: "Estamos experimentando dificultades técnicas. Por favor intenta de nuevo en unos minutos."
- CTA: "Intentar de nuevo"
- Tono: Honesto, sin tecnicismos.

**7. Error inesperado (500)**
- Título: "Algo salió mal"
- Subtítulo: "Ocurrió un error inesperado. Por favor intenta de nuevo en unos momentos."
- CTA: "Volver al inicio"
- Ayuda: "Si el problema persiste, contacta al equipo de Seneto."
- Tono: Humano, orientado a la resolución.

**8. Sin permisos (401 / 403 en área admin)**
- Título: "Acceso restringido"
- Subtítulo: "No tienes permisos para ver esta página. Inicia sesión para continuar."
- CTA: "Iniciar sesión"
- Tono: Directo, no amenazante.

**9. Revocación exitosa (confirmación admin)**
- Título: "Certificado revocado"
- Subtítulo: "El certificado de [Nombre del egresado] ha sido marcado como no válido. El cambio es inmediato."
- Tono: Confirmación clara de consecuencia.

**10. Reactivación exitosa (confirmación admin)**
- Título: "Certificado reactivado"
- Subtítulo: "El certificado de [Nombre del egresado] ha sido reactivado y ahora es válido."
- Tono: Positivo, confirmación de reversión.

**11. Motivo de revocación requerido (validación inline)**
- Mensaje: "El motivo es obligatorio y debe tener al menos 10 caracteres."
- Posición: Debajo del campo de texto, visible al intentar confirmar sin motivo.
- Tono: Directo, sin reproche.

**12. Búsqueda sin resultados**
- Título: "Sin resultados"
- Subtítulo: "No encontramos certificados que coincidan con \"[término buscado]\". Verifica el nombre o folio e intenta de nuevo."
- Tono: Orientado a la acción correctiva, no a un error del usuario.

**13. Sin generaciones (empty state)**
- Título: "Aún no hay generaciones"
- Subtítulo: "Cuando crees tu primera generación de diplomas, aparecerá aquí."
- CTA: "Crear primera generación"
- Tono: Invitación, no vacío.

**14. Sin historial de auditoría (empty state)**
- Título: "Sin actividad registrada"
- Subtítulo: "Las acciones importantes del sistema quedarán registradas aquí."
- Tono: Informativo.

### UI_STATES.md

Agregar el estado `empty` al componente ZoneEditor con los siguientes atributos:

- **Trigger:** El ZoneEditor se monta pero no hay plantilla cargada (`template === null`).
- **Descripción visual:** El área de canvas muestra un rectángulo punteado con ícono de carga de archivo centrado. Fondo gris claro. Sin handles de redimensionamiento visibles.
- **Texto:** "Carga una plantilla para comenzar a definir zonas."
- **CTA prominente:** Botón primario "Cargar plantilla" centrado en el área de canvas.
- **Controles de zona:** Todos los botones de agregar/eliminar zona están `disabled` visualmente (`opacity: 0.4`, `pointer-events: none`, `aria-disabled="true"`). No solo deshabilitados funcionalmente — la UI debe comunicar claramente que la acción no está disponible.
- **Accesibilidad:** El área de canvas en estado `empty` tiene `role="region"` y `aria-label="Editor de zonas — sin plantilla cargada"`.

Completar también los 7 estados accesibles del ZoneEditor para que el documento quede íntegro:

1. `empty` — sin plantilla (nuevo, descrito arriba)
2. `idle` — plantilla cargada, ninguna zona seleccionada
3. `selected` — zona seleccionada, handles visibles, coordenadas editables
4. `dragging` — zona en movimiento por arrastre
5. `resizing` — zona en redimensionamiento por handle
6. `error` — zona fuera de límites o con dimensión inválida
7. `keyboard-focus` — zona seleccionada por teclado (Tab/Flechas), sin uso de mouse

---

## 4. Mobile-first por user journey del QR

El journey prioritario es: **ver diploma físico o digital → escanear QR → `/v/[token]` en móvil → entender validez en menos de 5 segundos → confiar en el resultado**.

Este journey ocurre en contextos de baja concentración (entrevista de trabajo, ventanilla, pasillo). El verificador no tiene cuenta en el sistema, puede tener conexión lenta y está mirando la pantalla durante 10–15 segundos máximo.

### 10 criterios de aceptación mobile-first

1. **Viewport base 375px:** La tarjeta de verificación pública debe renderizarse sin scroll horizontal en 375px de ancho. Verificar con Chrome DevTools en "iPhone SE". Ningún elemento debe desbordarse o quedar cortado.

2. **Touch targets mínimo 44×44px:** Todo elemento interactivo tiene al menos 44×44px de área táctil. Esto incluye el CTA "Volver al inicio", cualquier enlace de ayuda y el botón de compartir si se implementa. Verificar con `--touch-min: 44px` aplicado explícitamente en los componentes.

3. **Texto mínimo 16px:** El cuerpo de texto en la tarjeta de verificación (nombre, programa, fecha) usa mínimo `font-size: 16px` para evitar el zoom automático en iOS Safari. El título del estado ("Válido", "No válido") puede ser mayor.

4. **Sin interacciones de hover obligatorias:** Toda la información crítica de la tarjeta es visible sin hover. No ocultar el folio, la fecha ni el estado bajo un tooltip de hover. En mobile no existe el estado hover — si un dato requiere hover para ser legible, debe rediseñarse.

5. **Carga en menos de 3 segundos en 3G:** La página `/v/[token]` es un Server Component que hace una sola query a BD. No debe cargar fuentes de terceros, scripts de analytics ni widgets externos que bloqueen el render. El estado de carga (`loading`) es visible instantáneamente; los datos del certificado llegan en la primera respuesta del servidor.

6. **Badge de estado legible sin color:** El estado del certificado ("Válido", "No válido") debe ser legible incluso en modo de alto contraste o para usuarios con daltonismo. El badge lleva texto explícito además del color. No comunicar el estado solo mediante color verde/rojo.

7. **Sin necesidad de hacer zoom:** Toda la información relevante de la tarjeta cabe en la pantalla sin necesidad de pellizcar para hacer zoom. La jerarquía visual lleva primero el estado (grande), luego el nombre, luego el programa y la fecha.

8. **CTA accesible con el pulgar:** El botón principal (CTA de "Volver al inicio" o "Intentar de nuevo" en estados de error) se ubica en la zona inferior de la pantalla, accesible con el pulgar en posición natural de sujeción del teléfono.

9. **Funciona sin JavaScript habilitado:** La página de verificación pública es un Server Component. El contenido del certificado debe ser visible en el HTML inicial, sin depender de JavaScript para renderizar los datos. El estado del certificado no puede depender de una llamada fetch desde el cliente.

10. **Metadatos Open Graph correctos:** Cuando el enlace `/v/[token]` se comparte en WhatsApp, Telegram o iMessage, la previsualización muestra: "Verificación de diploma — Seneto" como título, y el nombre del programa como descripción. No exponer el nombre del egresado en los metadatos Open Graph — son indexables públicamente.

### Token de diseño: `--touch-min: 44px`

Definir en el sistema de diseño como variable CSS:

```css
:root {
  --touch-min: 44px;
}
```

Aplicar explícitamente en los siguientes componentes:

- **Botones primarios y secundarios:** `min-height: var(--touch-min)` en todos los estados.
- **Icon buttons** (editar, descargar, revocar en tablas): `min-width: var(--touch-min); min-height: var(--touch-min)`. En mobile, ampliar el área táctil con `padding` aunque el ícono sea visualmente más pequeño.
- **Filas de tabla con acción:** La fila completa debe ser táctil si el único destino es ver el detalle. Usar `<tr>` con `onClick` y `cursor: pointer` antes que un link diminuto al final de la fila.
- **Handles del ZoneEditor:** Los handles de redimensionamiento deben tener `min-width: var(--touch-min); min-height: var(--touch-min)` en touch devices. En desktop pueden ser más pequeños (8px visual) con área táctil extendida mediante pseudo-elemento `::after`.
- **CTAs públicas en `/v/[token]`:** El botón "Volver al inicio" y cualquier CTA de error tiene `min-height: var(--touch-min)`.

---

## 5. Accesibilidad WCAG AA

Los siguientes criterios son verificables y deben incluirse en el definition of done de cada ticket de Frontend.

### Contraste de color

- **Botón primario:** Texto blanco (`#ffffff`) sobre fondo `#e54360` — ratio aproximado 4.54:1. Cumple AA para texto normal (4.5:1 mínimo). Verificar en producción con el plugin axe DevTools.
- **Botón primario hover:** Texto blanco (`#ffffff`) sobre fondo `#b02d44` — ratio aproximado 6.2:1. Cumple AA y AAA. El estado hover mejora el contraste, no lo empeora.
- **Badge "revocado" (rojo):** Texto blanco (`#ffffff`) sobre fondo `#c9354d` — ratio aproximado 4.8:1. Cumple AA. Verificar que el texto dentro del badge sea al menos 14px bold o 18px regular.
- **Badge "en progreso" (gold):** Texto oscuro (`#1a1a1a`) sobre fondo `#ffd032` — ratio aproximado 8.5:1. Cumple AAA. No cambiar esta combinación sin reverificar.
- **Texto de cuerpo sobre fondo blanco:** Usar `#1a1a1a` o `#222222` como mínimo. No usar grises con ratio inferior a 4.5:1.

### Focus ring

Todos los elementos interactivos deben mostrar un focus ring visible al navegar con teclado. Estilo obligatorio:

```css
:focus-visible {
  outline: 2px solid var(--seneto-blue);
  outline-offset: 2px;
}
```

Este estilo reemplaza (no complementa) el `outline: none` que a veces se aplica para limpiar el estilo nativo del navegador. No usar `outline: none` en ningún componente sin reemplazarlo por el focus ring de Seneto.

### No solo color

- El estado del certificado en la tarjeta pública usa texto explícito ("Válido", "No válido") además del color del badge. El color es un refuerzo visual, no el único canal de información.
- Los errores de formulario (campo de motivo en modal de revocación) se comunican con texto bajo el campo además de un borde rojo. El campo en error tiene `aria-invalid="true"` y `aria-describedby` apuntando al texto de error.
- Los badges de estado en la tabla de certificados llevan texto, no solo punto de color.

### Labels de formularios

- Todos los `<input>`, `<textarea>` y `<select>` tienen un `<label>` asociado explícitamente mediante `htmlFor` / `id`. No usar solo `placeholder` como label.
- El campo de motivo en el modal de revocación: `<label htmlFor="revoke-reason">Motivo de revocación (obligatorio)</label>`.
- El campo de búsqueda de certificados: `<label htmlFor="cert-search">Buscar por nombre o folio</label>`. El label puede ser visualmente oculto con `sr-only` si el diseño no lo muestra, pero debe existir en el DOM.

### Anuncios para lectores de pantalla

- Los errores de validación y confirmaciones de acciones críticas usan `role="alert"` para ser anunciados automáticamente por lectores de pantalla sin que el usuario navegue hasta el mensaje.
- El toast de confirmación de revocación exitosa usa `role="status"` (anuncio no urgente).
- El estado de carga de la página pública usa `aria-live="polite"` con el texto "Verificando certificado…" mientras se carga la información.

### Textos alternativos

- La imagen del diploma en el ZoneEditor tiene `alt="Plantilla de diploma — [nombre de la plantilla]"`.
- El logo de Seneto en la página pública tiene `alt="Seneto"`.
- El ícono del QR (si se muestra en la interfaz admin) tiene `alt="Código QR del diploma"`.
- Imágenes decorativas (fondos, separadores) tienen `alt=""`.
- Los íconos de acción en tablas (lápiz, papelera, descarga) tienen `aria-label` explícito: `aria-label="Editar generación"`, `aria-label="Revocar diploma de [nombre]"`.

### ZoneEditor con teclado

- Las zonas del editor son seleccionables con `Tab`. La zona seleccionada tiene `tabIndex={0}` y `role="region"` con `aria-label="Zona [nombre]"`.
- Las teclas de flecha (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`) mueven la zona seleccionada en incrementos de 1px (normal) o 10px (con `Shift`).
- `Delete` o `Backspace` elimina la zona seleccionada con confirmación (o sin confirmación si hay undo disponible).
- Como alternativa al arrastre táctil en mobile, los controles numéricos de posición (X, Y, ancho, alto) son la interfaz primaria para usuarios de teclado y lectores de pantalla.

### Validación de la Dirección B (estados hover, badge revocado, badge en progreso, focus)

Los siguientes casos de la Dirección B (Cálida elevada) requieren verificación explícita antes de que el Frontend los implemente:

| Elemento | Estado | Color fondo | Color texto | Ratio objetivo | Verificado |
|---|---|---|---|---|---|
| Botón primario | hover | `#b02d44` | `#ffffff` | >= 4.5:1 | Pendiente |
| Badge "revocado" | normal | `#c9354d` | `#ffffff` | >= 4.5:1 | Pendiente |
| Badge "en progreso" | normal | `#ffd032` | `#1a1a1a` | >= 4.5:1 | Pendiente |
| Cualquier elemento | :focus-visible | Fondo contexto | `var(--seneto-blue)` | Ring visible | Pendiente |

Herramienta de verificación sugerida: WebAIM Contrast Checker o el plugin axe en Chrome DevTools.

---

## 6. Seguridad percibida y confianza

La página `/v/[token]` es el punto de contacto más crítico con el mundo exterior. Un empleador que escanea el QR de un diploma forma su opinión sobre Seneto en los primeros 3 segundos. La confianza no se construye solo con datos correctos — se construye con claridad, consistencia y ausencia de ruido.

### Cómo comunica confianza la página pública

- **Marca visible y consistente:** El logo de Seneto aparece en el header de la página de verificación. No es una página anónima. El dominio es el mismo que el del sistema admin — no un subdominio sospechoso.
- **Estado central y prominente:** El badge de estado ("Válido" / "No válido") ocupa el lugar más prominente de la tarjeta, en tipografía grande y con ícono de checkmark o X. El verificador sabe el resultado antes de leer cualquier otro dato.
- **Datos suficientes, no excesivos:** La tarjeta muestra lo necesario para verificar. No hay campos vacíos, etiquetas sin valor ni filas en gris claro que parezcan "datos ocultos". Lo que no se muestra, no aparece.
- **Footer con aviso de privacidad:** Una línea breve: "Seneto · Política de privacidad · Los datos mostrados son propiedad de Seneto y del titular del diploma." Esto comunica que hay una organización responsable detrás del sistema.
- **URL reconocible:** La URL `/v/{uuid}` es larga pero predecible en su estructura. No contiene parámetros extraños ni subdominios desconocidos. El usuario que ve la barra del navegador puede entender que es una página de verificación.

### Copy para cada estado sensible

**Estado: Válido**

```
[Ícono checkmark verde]
Certificado válido

[Nombre completo del egresado]
[Programa]
Emitido por Seneto · [Fecha de emisión]
Folio: [SEN-XXXX-XXX]

Este certificado es auténtico y fue emitido por Seneto.
```

Tono: Claro, afirmativo. Sin exclamaciones. La confianza se comunica con la estructura, no con entusiasmo.

**Estado: Revocado**

```
[Ícono X rojo]
Certificado no válido

Este certificado ya no se encuentra vigente.

Si tienes dudas, contacta a Seneto.
[Enlace de contacto]
```

Tono: Neutro. No revelar motivo ni fecha. No usar la palabra "revocado" — es jerga interna que puede alarmar innecesariamente o dar información sobre el proceso interno.

**Estado: No encontrado (token no existe)**

```
[Ícono de búsqueda]
No encontramos este certificado

El enlace puede ser incorrecto o el certificado no existe en nuestro sistema.
Verifica que estás usando el QR original del diploma.

Si el problema persiste, contacta a Seneto.
[Enlace de contacto]
```

Tono: No acusatorio. El verificador puede estar usando un QR dañado o un link mal copiado.

**Estado: Error temporal (503)**

```
[Ícono de reloj o nube]
El servicio no está disponible en este momento

Estamos experimentando dificultades técnicas temporales.
Por favor intenta de nuevo en unos minutos.

[Botón: Intentar de nuevo]
```

Tono: Honesto. No minimizar ni alarmar. El botón de reintento da control al usuario.

**Estado: Error 500**

```
[Ícono de herramienta]
Algo salió mal

Ocurrió un error inesperado. Por favor intenta de nuevo en unos momentos.

[Botón: Volver al inicio]

Si el problema persiste, contacta al equipo de Seneto.
```

Tono: Honesto y orientado a la acción. El stack trace nunca aparece en producción. El botón de "Volver al inicio" lleva al homepage de Seneto, no al panel admin.

**Estado: Sin permisos (401 en área admin)**

```
[Ícono de candado]
Acceso restringido

No tienes permisos para ver esta página.
Inicia sesión para continuar.

[Botón: Iniciar sesión]
```

Tono: Directo. No revelar si la página existe o no (evitar enumeración de rutas). Este estado solo aparece en el área admin, nunca en la vista pública.

---

## 7. Tickets sugeridos para Frontend/Product

### UX-001 — Corregir referencias a `/v/{folio}` en documentos UX y UI

**Descripción:** Actualizar WIREFRAMES.md y USER_FLOWS.md para reemplazar toda referencia a `/v/{folio}` por `/v/{token}`. Alinear con la decisión de seguridad C2 (IDOR). Esta tarea es de documentación y debe completarse antes de que Frontend comience a maquetar la vista pública.

**Documento/pantalla afectada:** WIREFRAMES.md (pantalla de verificación pública), USER_FLOWS.md (F-11).

**Criterios de aceptación:**
- No existe ninguna referencia a `/v/{folio}` en WIREFRAMES.md ni en USER_FLOWS.md.
- El wireframe de la tarjeta pública muestra la URL con UUID en la barra del navegador.
- El folio (`SEN-2026-001`) aparece como texto visible en la tarjeta, no como URL.

**Dependencias:** Ninguna (tarea de documentación).

**Riesgo si no se implementa:** El Frontend implementa la página pública con el folio en la URL, creando el IDOR que la auditoría de seguridad identificó como crítico (C2).

---

### UX-002 — Implementar página pública `/v/[token]` mobile-first

**Descripción:** Maquetar e implementar la tarjeta de verificación pública como Server Component. Incluir los 5 estados del certificado (activo, revocado, expirado, no encontrado, token inválido). Sin foto del egresado. Aplicar los 10 criterios mobile-first de la Sección 4.

**Documento/pantalla afectada:** `src/app/v/[token]/page.tsx`, WIREFRAMES.md (pantalla pública).

**Criterios de aceptación:**
- La tarjeta renderiza correctamente en 375px sin scroll horizontal.
- Los 5 estados de respuesta están implementados con el copy de la Sección 6.
- El badge de estado tiene texto explícito (no solo color).
- La página es funcional sin JavaScript habilitado en el navegador.
- No hay foto del egresado en ningún estado.
- `VerifyResponse` no incluye campos `email`, `photo_url` ni datos personales adicionales.
- Los metadatos Open Graph no incluyen el nombre del egresado.

**Dependencias:** UX-001 (documentación actualizada), SEC-002 (campo `verification_token` en schema), SEC-011 (endpoint `/v/[token]` de Backend).

**Riesgo si no se implementa:** La cara pública de Seneto ante empleadores e instituciones no existe o no es confiable.

---

### UX-003 — Agregar estado `empty` al ZoneEditor

**Descripción:** Implementar el estado inicial del ZoneEditor cuando no hay plantilla cargada. Canvas con placeholder punteado, CTA "Cargar plantilla" prominente, botones de zona deshabilitados visualmente. Ver especificación en Sección 3, UI_STATES.md.

**Documento/pantalla afectada:** Componente ZoneEditor, UI_STATES.md.

**Criterios de aceptación:**
- Al montar el ZoneEditor sin plantilla, se muestra el placeholder punteado con el CTA.
- Los botones de agregar/eliminar zona tienen `aria-disabled="true"` y apariencia deshabilitada (`opacity: 0.4`).
- El área de canvas tiene `role="region"` y `aria-label="Editor de zonas — sin plantilla cargada"`.
- Al cargar una plantilla, el estado transiciona a `idle` sin parpadeo.

**Dependencias:** Ninguna (componente aislado).

**Riesgo si no se implementa:** El primer uso del sistema por un administrador nuevo es confuso — no sabe qué hacer ni por qué los botones no responden.

---

### UX-004 — Modal de revocación con campo de motivo obligatorio

**Descripción:** Actualizar el modal de confirmación de revocación (F-09) para incluir: campo de texto de motivo (mínimo 10 caracteres, obligatorio), mensaje de consecuencia visible, nombre del egresado y folio en el encabezado del modal. Ver especificación en Sección 3, USER_FLOWS.md.

**Documento/pantalla afectada:** Modal de revocación en la pantalla de detalle de generación / lista de certificados, USER_FLOWS.md (F-09).

**Criterios de aceptación:**
- El modal muestra el nombre del egresado y el folio del diploma a revocar.
- El campo "Motivo de revocación" es requerido. El botón "Confirmar revocación" está deshabilitado si el campo tiene menos de 10 caracteres.
- El mensaje "Al confirmar, el egresado verá 'Certificado no válido' al escanear el QR. Esta acción queda registrada en el historial de auditoría." es visible antes del CTA.
- El error de validación del campo usa `role="alert"` y `aria-invalid="true"`.
- El motivo se envía al Backend y se registra en `AuditLog.detail`.

**Dependencias:** SEC-005 (helper `logAction` de Backend), SEC-002 (modelo `AuditLog`).

**Riesgo si no se implementa:** Las revocaciones quedan sin motivo documentado, vaciando el valor del AuditLog para este tipo de acción crítica.

---

### UX-005 — Implementar copy de error 500 y estados de error en UI

**Descripción:** Agregar los 13 estados de copy definidos en la Sección 3 (COPY.md) al sistema de UI. Verificar que ningún mensaje técnico (stack trace, error de Prisma, mensaje de Node.js) sea visible para el usuario en producción.

**Documento/pantalla afectada:** COPY.md, componentes de error globales (`error.tsx`, `not-found.tsx` en App Router), empty states de tablas.

**Criterios de aceptación:**
- La página `error.tsx` muestra el copy "Algo salió mal" con CTA "Volver al inicio". No expone ningún detalle técnico.
- La página `not-found.tsx` muestra "No encontramos este certificado" en el contexto de `/v/[token]`.
- Los empty states de "sin generaciones" e "historial vacío" usan el copy de la Sección 3.
- En staging con `NODE_ENV=production`, los errores de servidor no muestran stack traces.

**Dependencias:** Ninguna (puede implementarse en paralelo con otros tickets).

**Riesgo si no se implementa:** Mensajes técnicos visibles al usuario en producción; pérdida de confianza; posible exposición de información de infraestructura.

---

### UX-006 — Focus ring y navegación por teclado en componentes críticos

**Descripción:** Aplicar el estilo de focus ring estándar (`outline: 2px solid var(--seneto-blue); outline-offset: 2px`) en todos los elementos interactivos. Verificar que el ZoneEditor sea navegable por teclado con Tab, flechas y Delete. Eliminar cualquier `outline: none` sin reemplazo.

**Documento/pantalla afectada:** Sistema de estilos global, ZoneEditor, formularios, tablas con acciones, modales.

**Criterios de aceptación:**
- Navegar con Tab por la página de login muestra focus ring visible en cada elemento interactivo.
- Navegar con Tab en la tabla de certificados alcanza todos los botones de acción.
- El ZoneEditor permite seleccionar una zona con Tab, moverla con flechas y eliminarla con Delete.
- No existe ningún elemento interactivo que pierda el focus ring sin reemplazarlo por el estilo de Seneto.
- Verificado con aXe DevTools: cero violaciones de "focus-visible" en las páginas admin y pública.

**Dependencias:** UX-003 (ZoneEditor con estado `empty`).

**Riesgo si no se implementa:** El sistema es inutilizable para usuarios que dependen del teclado para navegar; viola WCAG AA 2.4.7.

---

### UX-007 — Verificar y documentar contraste de la Dirección B

**Descripción:** Verificar los ratios de contraste de los estados hover, badge "revocado" y badge "en progreso" de la Dirección B (Cálida elevada) usando WebAIM Contrast Checker y axe DevTools. Documentar los resultados en la tabla de la Sección 5. Ajustar los valores de color si algún ratio no alcanza 4.5:1.

**Documento/pantalla afectada:** Sistema de diseño (tokens de color), badges en tabla de certificados.

**Criterios de aceptación:**
- Botón primario hover (`#b02d44` / `#ffffff`): ratio >= 4.5:1 documentado.
- Badge "revocado" (`#c9354d` / `#ffffff`): ratio >= 4.5:1 documentado.
- Badge "en progreso" (`#ffd032` / `#1a1a1a`): ratio >= 4.5:1 documentado.
- Si algún ratio falla, el valor de color se ajusta y se documenta el nuevo valor.
- La tabla de la Sección 5 de este documento tiene todos los campos "Verificado" completados.

**Dependencias:** Ninguna (verificación de diseño, no de código).

**Riesgo si no se implementa:** Violación de WCAG AA 1.4.3 en los estados más visibles del sistema.

---

### UX-008 — Touch targets mínimos en componentes de tabla y ZoneEditor

**Descripción:** Aplicar el token `--touch-min: 44px` en los icon buttons de tablas (editar, descargar, revocar), los handles del ZoneEditor y las CTAs públicas. Verificar en Chrome DevTools con simulación de touch en 375px.

**Documento/pantalla afectada:** Tabla de certificados, tabla de generaciones, ZoneEditor, página pública `/v/[token]`.

**Criterios de aceptación:**
- Los icon buttons en tablas tienen `min-width: 44px; min-height: 44px` (o área táctil equivalente con padding/pseudo-elemento).
- Los handles del ZoneEditor tienen área táctil >= 44×44px en touch devices.
- El CTA principal de la página pública tiene `min-height: 44px`.
- Verificado con Chrome DevTools: ningún elemento interactivo tiene área táctil menor a 44×44px en simulación móvil.

**Dependencias:** UX-003 (ZoneEditor actualizado).

**Riesgo si no se implementa:** Violación de WCAG 2.5.5; experiencia deficiente en el journey principal del QR (mobile).

---

### UX-009 — Agregar aviso de privacidad en la página pública

**Descripción:** Agregar un footer breve en `/v/[token]` con aviso de privacidad y enlace de contacto. El texto debe estar en COPY.md. Alinear con el equipo legal de Seneto si es necesario.

**Documento/pantalla afectada:** `src/app/v/[token]/page.tsx`, COPY.md.

**Criterios de aceptación:**
- La página pública tiene un footer visible con el texto aprobado de aviso de privacidad.
- El footer incluye un enlace de contacto a Seneto (email o página de contacto).
- El footer no ocupa más del 15% de la pantalla en mobile para no competir con la tarjeta de verificación.
- El texto del aviso de privacidad está en COPY.md como estado documentado.

**Dependencias:** UX-002 (página pública implementada). Requiere aprobación de Seneto para el texto legal.

**Riesgo si no se implementa:** Incumplimiento del requisito de informar al titular sobre el tratamiento de sus datos personales bajo regulación mexicana.

---

### UX-010 — Definir y documentar decisiones de producto pendientes (Seneto)

**Descripción:** Obtener aprobación de Seneto para las cuatro decisiones de producto que bloquean el diseño final: (1) foto del egresado en la vista pública, (2) nombre completo vs parcial, (3) texto para certificado revocado, (4) confirmación tipada en modal de revocación. Documentar la decisión en `docs/SECURITY_REMEDIATION_PLAN.md` Sección 2C.

**Documento/pantalla afectada:** SECURITY_REMEDIATION_PLAN.md (Sección 2C), WIREFRAMES.md, USER_FLOWS.md.

**Criterios de aceptación:**
- Las cuatro decisiones están documentadas en SECURITY_REMEDIATION_PLAN.md con fecha de aprobación y nombre del aprobador.
- WIREFRAMES.md y USER_FLOWS.md reflejan las decisiones aprobadas.
- El ticket UX-002 (página pública) no comienza implementación hasta que esta decisión esté cerrada.

**Dependencias:** Ninguna técnica. Depende de disponibilidad de Seneto.

**Riesgo si no se implementa:** Frontend implementa la vista pública con suposiciones que luego requieren rediseño. El riesgo más alto es implementar la foto y luego tener que removerla por privacidad — requeriría reabrir componentes ya integrados.

---

## 8. Notas para otros agentes

### Para el Agente Frontend

1. **No implementar la foto del egresado** en la vista pública hasta que UX-010 esté cerrado con aprobación de Seneto. Diseñar la tarjeta para que funcione sin foto — no dejar un placeholder vacío que "se llenará después".

2. **El token UUID no se muestra como texto** en la página de verificación pública. La URL lo contiene, pero la tarjeta solo muestra el folio legible (`SEN-2026-001`). No renderizar `params.token` como contenido visible.

3. **La página `/v/[token]` es un Server Component.** No convertirla a Client Component para agregar interactividad innecesaria. Los datos del certificado deben estar en el HTML inicial — es crítico para el journey del QR en mobile con conexión lenta.

4. **Los mensajes de error usan el copy exacto de la Sección 6 de este documento.** No inventar textos de error en el código. Si un estado no está documentado, abrir un issue antes de implementar.

5. **Aplicar `--touch-min: 44px`** en todos los elementos interactivos antes de marcar cualquier ticket de tabla o formulario como completado.

6. **El formulario de login no distingue entre "email incorrecto" y "contraseña incorrecta"** en su mensaje de error. El mensaje es siempre "Email o contraseña incorrectos". No agregar estilos de error diferenciados por campo en el formulario de login.

7. **El modal de revocación requiere el campo de motivo** antes de habilitar el CTA de confirmación. La validación es client-side (deshabilitar el botón) Y server-side (el Backend rechaza la petición sin motivo). No implementar solo uno de los dos lados.

---

### Para el Agente Backend

1. **`VerifyResponse` nunca incluye `email`, `photo_url`, `phone`, `curp`, `rfc` ni ningún campo personal adicional** más allá de los definidos en la tabla de la Sección 2. Seleccionar explícitamente los campos en la query de Prisma — no usar `findUnique` sin `select`.

2. **El endpoint `/v/[token]` retorna diferentes códigos HTTP según el estado del certificado:**
   - Token con formato inválido (no UUID): HTTP 400
   - Token UUID no encontrado en BD: HTTP 404
   - Certificado encontrado (cualquier estado): HTTP 200 con `status` en el body

   La razón: el Frontend necesita distinguir entre "enlace roto" (400/404) y "certificado encontrado pero no válido" (200 con status). No retornar 404 para un certificado revocado — la tarjeta pública debe mostrarse.

3. **El campo de motivo de revocación es obligatorio en el endpoint de revocación.** Retornar HTTP 422 con mensaje descriptivo si `reason` no se recibe o tiene menos de 10 caracteres. El mensaje de error sigue el formato `{ error: { code: 'VALIDATION_ERROR', message: '...' } }`.

4. **El endpoint de reactivación también registra en `AuditLog`** con `action: 'certificate.reactivate'` y el motivo de reactivación (opcional pero recomendado).

5. **Sobre la foto:** Si en el futuro Seneto decide incluir la foto, servirla desde `/api/public/photos/{verification_token}`, nunca como URL directa al storage. El endpoint valida que el certificado existe y está activo antes de retornar la foto.

---

### Para el Agente de Arquitectura

1. **Los metadatos Open Graph de `/v/[token]`** no deben incluir el nombre del egresado. Usar el nombre del programa o un texto genérico ("Verificación de diploma — Seneto"). El nombre del egresado en los metadatos OG es indexable públicamente por buscadores y scrapers de redes sociales.

2. **El dominio de la página de verificación pública** debe ser el mismo que el del sistema admin (`seneto.mx` o equivalente), no un subdominio separado. Un subdominio diferente (`verify.seneto.mx`) reduce la confianza del verificador que no puede asociar el dominio con la marca.

3. **No se requiere Redis ni almacenamiento externo para el MVP.** El rate limiting de login en memoria (Map de Node.js) es suficiente para un deploy de instancia única. Documentar esta limitación en el README de producción: "el rate limiting se resetea con cada reinicio del proceso."

4. **Los headers de seguridad** (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`) definidos en el SECURITY_REMEDIATION_PLAN.md aplican a `/v/[token]` también, no solo a las rutas admin. Verificar que la configuración de `next.config.mjs` aplica a `/(.*)`  incluyendo la ruta pública.

---

### Para el Agente QA

1. **Journey crítico a probar en mobile real (no solo DevTools):** Escanear el QR de un diploma generado con un teléfono Android o iOS real, verificar que la página carga en menos de 5 segundos en red 3G simulada, y que el estado del certificado es legible sin hacer zoom.

2. **Casos de prueba de accesibilidad obligatorios:**
   - Navegar toda la página de verificación pública con VoiceOver (iOS) o TalkBack (Android) usando solo gestos de swipe. El estado del certificado debe ser el primer elemento anunciado.
   - Navegar el formulario de login con teclado únicamente (Tab, Shift+Tab, Enter). Llegar al botón de login y hacer submit.
   - Verificar que el modal de revocación puede completarse con teclado (abrir modal, llenar motivo, confirmar, ver toast de confirmación) sin usar el mouse.

3. **Casos de prueba de copy:** Para cada uno de los 13 estados de la Sección 3 (COPY.md), verificar que el texto en producción coincide exactamente con el documentado. Cualquier divergencia es un bug de UX, no solo de copy.

4. **Caso de privacidad crítico:** Llamar directamente al endpoint `GET /api/verify/{token_valido}` con un cliente REST (Postman, curl) y verificar que la respuesta JSON no contiene ninguno de los campos: `email`, `phone`, `curp`, `rfc`, `address`, `photo_url` (a menos que Seneto haya aprobado la foto en UX-010).

5. **Verificar los 10 criterios mobile-first de la Sección 4** con Chrome DevTools en modo "iPhone SE (375px)" antes de marcar UX-002 como completado. Capturar screenshot de cada estado de la tarjeta en 375px como evidencia de aceptación.

---

_Plan de remediación generado por el Agente Product Design el 2026-05-07. Basado en `docs/UX_AUDIT.md` (hallazgos HC1–HC3, HI1–HI5) y `docs/SECURITY_REMEDIATION_PLAN.md`. Los tickets UX-001 a UX-010 son el input principal para el Agente Frontend en Sprint 2. Las decisiones pendientes de Seneto (Sección 1 y UX-010) deben cerrarse antes de iniciar Sprint 2._
