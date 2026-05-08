# UI Kit Funcional — Parte 2: Estados, Componentes y Checklist

_Complemento funcional del UI Kit Seneto · Dirección B (Cálida elevada) · 2026-05-07_

> Continuación de `UI_KIT_FUNCTIONAL_P1.md`. Cubre estados críticos, página pública, tabla admin, ZoneEditor y checklist final.

---

## 6. Estados críticos de UI

Cada estado tiene definición visual, icono, contenido y reglas de accesibilidad.

### 6.1 Loading

| Propiedad | Valor |
|-----------|-------|
| Color | `--seneto-blue` (#1a8ab5) |
| Icono Lucide | `Loader2` (con animación spin) |
| Título | `Cargando…` |
| Mensaje | Contexto específico: `Cargando generaciones…`, `Verificando diploma…` |
| CTA | Ninguno |
| Accesibilidad | `role="status"` + `aria-live="polite"` + texto visible `Cargando…` como alternativa a la animación |
| Implementación | Skeleton loaders para listas/tablas. Spinner centrado para acciones puntuales. Texto siempre presente junto al spinner. |

### 6.2 Empty state

| Propiedad | Valor |
|-----------|-------|
| Color | `--seneto-text-muted` (#6b7280) |
| Icono Lucide | `FileQuestion` (48px, color muted) |
| Título | Contextual: `Aún no has creado ninguna generación.` |
| Mensaje | Breve instrucción: `Crea tu primera generación para comenzar.` |
| CTA | Botón primary: `Crear primera generación` |
| Accesibilidad | Región con `aria-label` descriptivo. CTA recibe focus automático si es la única acción. |

### 6.3 Error state

| Propiedad | Valor |
|-----------|-------|
| Color | `--color-error` (#c9354d) |
| Icono Lucide | `AlertCircle` (48px) |
| Título | `No se pudo completar la operación.` |
| Mensaje | Causa específica + acción sugerida. Nunca solo "Error". |
| CTA | `Reintentar` (botón ghost) |
| Accesibilidad | `role="alert"` + `aria-live="assertive"`. Banner con borde izquierdo rojo 4px. |

### 6.4 Success state

| Propiedad | Valor |
|-----------|-------|
| Color | `--color-success` (#16a34a) |
| Icono Lucide | `CheckCircle2` |
| Título | Contextual: `¡Listo! [X] diplomas generados.` |
| Mensaje | Información de seguimiento. |
| CTA | Acción siguiente: `Descargar ZIP`, `Ver certificados` |
| Accesibilidad | `role="status"` + `aria-live="polite"`. Toast auto-dismiss en 5s con `aria-live`. |

### 6.5 Warning state

| Propiedad | Valor |
|-----------|-------|
| Color | `--color-warning` (#8a6d00) → usar ajustado `#755c00` para texto |
| Icono Lucide | `AlertTriangle` |
| Título | Contextual: `Revisa antes de continuar.` |
| Mensaje | Lista de advertencias no bloqueantes. |
| CTA | `Continuar de todas formas` (ghost) + `Corregir` (primary) |
| Accesibilidad | `role="status"` + banner amarillo con borde izquierdo 4px gold. |

### 6.6 Invalid state (formularios)

| Propiedad | Valor |
|-----------|-------|
| Color | `--color-error` (#c9354d) |
| Icono Lucide | `XCircle` (inline 16px junto al campo) |
| Mensaje | Debajo del campo: texto rojo, 12px. Ej: `El nombre es obligatorio.` |
| Accesibilidad | `aria-invalid="true"` + `aria-describedby` apuntando al mensaje de error. El campo con error recibe focus si se intenta submit. |

### 6.7 Certificado revocado (página pública)

| Propiedad | Valor |
|-----------|-------|
| Color badge | `--color-error` (#c9354d) sobre fondo `rgba(201,53,77,0.08)` |
| Icono Lucide | `ShieldX` (32px) |
| Título | `Este diploma ha sido revocado` |
| Mensaje | `Este diploma fue emitido por Seneto pero ha sido revocado.` |
| Datos mostrados | Solo folio legible. **No** mostrar nombre, programa ni foto. |
| CTA | `Para más información, contacta a Seneto.` (texto, no botón) |

### 6.8 Certificado expirado (página pública)

| Propiedad | Valor |
|-----------|-------|
| Color badge | `--color-warning` (#755c00) sobre fondo `rgba(138,109,0,0.08)` |
| Icono Lucide | `Clock` (32px) |
| Título | `Este diploma ha expirado` |
| Mensaje | `Este diploma fue válido pero su vigencia ha expirado.` |
| Datos mostrados | Folio + fecha de emisión. **No** foto. |

### 6.9 Not found

| Propiedad | Valor |
|-----------|-------|
| Color | `--seneto-text-secondary` (#4b5563) |
| Icono Lucide | `SearchX` (48px) |
| Título | `Este folio no corresponde a ningún diploma emitido por Seneto.` |
| Mensaje | `Verifica que el folio sea correcto o contacta a Seneto.` |
| CTA | Ninguno |

### 6.10 Error 500 / Error temporal

| Propiedad | Valor |
|-----------|-------|
| Color | `--seneto-text-secondary` (#4b5563) |
| Icono Lucide | `ServerCrash` (48px) |
| Título | `No se pudo verificar el diploma en este momento.` |
| Mensaje | `Intenta de nuevo en unos minutos. Si el problema persiste, contacta a Seneto.` |
| CTA | `Reintentar` (botón ghost) |
| Accesibilidad | `role="alert"`. No revelar detalles técnicos del error. |

### Patrón visual de banners de estado (admin)

```css
.state-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-sm);
  border-left: 4px solid;
}
.state-banner--error   { border-color: #c9354d; background: rgba(201,53,77,0.06); }
.state-banner--warning { border-color: #8a6d00; background: rgba(138,109,0,0.06); }
.state-banner--success { border-color: #16a34a; background: rgba(22,163,74,0.06); }
.state-banner--info    { border-color: #1a8ab5; background: rgba(26,138,181,0.06); }
```

---

## 7. Página pública de verificación — `/v/[token]`

### Principios

1. **Mobile-first** — diseñada para 375px como target primario.
2. **Estado visible en <3 segundos** — SSR, sin dependencia de JS para el estado.
3. **El `verification_token` NUNCA se muestra al usuario** — es solo una clave de acceso interna.
4. **El folio SÍ se muestra** como identificador legible (ej: `SEN-2026-042`).
5. **No mostrar foto pública por defecto en MVP** — decisión de privacidad pendiente de aprobación legal.

### Layout mobile (375px)

```
┌──────────────────────────┐
│  Logo Seneto (centrado)  │  56px height
├──────────────────────────┤
│                          │
│  [Ícono estado 32px]     │
│  Badge estado             │  Elemento más prominente
│                          │
├──────────────────────────┤
│  Nombre del participante │  Solo si estado = active
│  Programa                │  Solo si estado = active
│  ───────────────         │
│  Emitido el: [fecha]     │
│  Folio: SEN-2026-042     │
│  Institución: Seneto     │
├──────────────────────────┤
│  Texto institucional     │  Contextual por estado
│                          │
├──────────────────────────┤
│  seneto.com · Privacidad │  Footer
└──────────────────────────┘
```

### Estados de la página

| Estado | Badge | Color | Datos visibles | Ícono |
|--------|-------|-------|----------------|-------|
| Válido | `Diploma válido` | success green | Nombre, programa, fecha, folio, institución | `ShieldCheck` |
| Revocado | `Este diploma ha sido revocado` | error red | Solo folio | `ShieldX` |
| Expirado | `Este diploma ha expirado` | warning gold | Folio, fecha | `Clock` |
| No encontrado | `Folio no válido` | neutral gray | Ninguno | `SearchX` |
| Token inválido | Misma UI que "No encontrado" | neutral gray | Ninguno | `SearchX` |
| Error temporal | `No pudimos verificar` | neutral gray | Ninguno + CTA reintentar | `ServerCrash` |
| Loading | `Verificando diploma…` | info blue | Spinner + texto | `Loader2` |

### Reglas de implementación

| Regla | Detalle |
|-------|---------|
| Renderizado | SSR obligatorio — datos frescos en cada request |
| Token en URL | `/v/[token]` donde token = `verification_token` UUID. No es el folio. |
| Redirección token inválido | No redirigir — mostrar estado "no encontrado" en la misma URL |
| Datos sensibles | No exponer: email, ruta de archivos, UUID interno, verification_token |
| Datos de revocado | No mostrar nombre ni datos del participante. Solo folio + estado. |
| Foto del participante | **No mostrar en MVP**. Campo reservado para post-MVP con consentimiento. |
| Meta tags | `<title>Verificación de Diploma — Seneto</title>`. `noindex, nofollow` en meta robots. |
| Footer | `seneto.com` (enlace externo) · `Privacidad` (enlace a aviso de privacidad) |
| Performance | Target < 2s en 4G. HTML completo sin JS para estado. |
| Viewport | `<meta name="viewport" content="width=device-width, initial-scale=1">` |
| Idioma | `<html lang="es">` |

### Accesibilidad de la página pública

- Badge de estado: `role="status"` + `aria-live="polite"`.
- Ícono decorativo: `aria-hidden="true"`.
- Estructura semántica: `<main>` + `<header>` + `<footer>`.
- Contraste del badge: verificado en sección 3 de P1 con ajustes aplicados.
- Touch targets: links del footer ≥ 44px de área táctil.

---

## 8. Tabla admin responsive

### Principio

Las tablas desktop **no deben comprimirse** en mobile. Se transforman en listas de cards.

### Desktop (≥768px) — Tabla tradicional

Usar los estilos definidos en `UI_KIT.md` sección 6 (Tabla de datos admin).

Adiciones:

| Regla | Detalle |
|-------|---------|
| Acciones por fila | Cada botón de acción: `min-height: 36px` (sm permitido en desktop) |
| Acciones destructivas | Color `--color-error`. Ícono `Trash2` o `ShieldX`. Siempre requieren confirmación modal. |
| Row clickeable | `cursor: pointer` + focus visible + `aria-label` descriptivo |
| Sorting | Header sorteable con ícono `ArrowUpDown` (16px). Estado activo: `ArrowUp` o `ArrowDown` |
| Empty state | Fila única spanning todas las columnas con mensaje centrado + ícono 48px |

### Mobile (<768px) — Cards apiladas

```css
.table-mobile-card {
  background: #ffffff;
  border: 1px solid rgba(107,114,128,0.1);
  border-radius: var(--radius-sm);
  padding: 1rem;
  margin-bottom: 0.5rem;
}

.table-mobile-card__label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--seneto-text-muted);
  margin-bottom: 0.25rem;
}

.table-mobile-card__value {
  font-size: 1rem;
  color: var(--seneto-dark);
}

.table-mobile-card__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(107,114,128,0.1);
}

.table-mobile-card__actions button {
  min-height: var(--touch-min);  /* 44px */
  min-width: var(--touch-min);
}
```

### Estructura de la card mobile

```
┌─────────────────────────────┐
│ [Badge estado]    [Folio]   │
│ Nombre del participante     │
│ Programa · 15 ene 2026      │
│ ─────────────────────────── │
│ [Acción 1]     [Acción 2]  │  ← Botones ≥44px
└─────────────────────────────┘
```

### Reglas responsive

| Regla | Detalle |
|-------|---------|
| Breakpoint de cambio | `768px` — tabla en desktop, cards en mobile |
| Scroll horizontal | **Prohibido** salvo tablas de datos puros (ej: CSV preview) |
| Hover en filas | Solo desktop. No es señal única de interactividad. |
| Paginación | Botones `Anterior` / `Siguiente` con touch target 44px |
| Empty state (sin resultados) | Mensaje centrado: `No se encontró ningún diploma con ese criterio.` + ícono `SearchX` |
| Empty state (sin datos) | Mensaje + CTA: `Aún no hay certificados.` + botón apropiado |

### Acciones destructivas

| Acción | Estilo visual | Comportamiento |
|--------|--------------|----------------|
| Revocar | Botón ghost con texto `--color-error` + ícono `ShieldX` | Siempre abre modal de confirmación con campo de motivo obligatorio |
| Eliminar borrador | Botón ghost con texto `--color-error` + ícono `Trash2` | Modal de confirmación sin campo adicional |
| Reactivar | Botón ghost con texto `--color-success` + ícono `ShieldCheck` | Modal de confirmación simple |

---

## 9. ZoneEditor — Lineamientos funcionales

### Estado empty (sin plantilla)

| Propiedad | Valor |
|-----------|-------|
| Mensaje | `Carga una plantilla para comenzar a definir zonas.` |
| Ícono | `ImagePlus` (48px, color muted) |
| CTA | `Cargar plantilla` (botón primary) |
| Controles | Todos los controles de zona: **deshabilitados** visual y funcionalmente |
| Panel lateral | Visible pero con inputs deshabilitados (`opacity: 0.5`, `pointer-events: none`) |

### Estados de zona

| Estado | Visual |
|--------|--------|
| Default (no seleccionada) | Borde 1px dashed `rgba(26,138,181,0.4)` + label semitransparente |
| Selected | Borde 2px solid `--seneto-blue` + handles de resize visibles + label opaco |
| Dragging | `opacity: 0.8` + `cursor: grabbing` + sombra md |
| Resizing | Borde 2px solid `--seneto-blue` + handle activo highlighted |
| Error (zona inválida) | Borde 2px solid `--color-error` + mensaje de error debajo |
| Obligatoria sin configurar | Badge `Obligatoria` en rojo claro junto al nombre de zona |

### Controles táctiles

| Regla | Detalle |
|-------|---------|
| Handles de resize | **44×44px** mínimo en dispositivos táctiles. Visualmente pueden ser 12px con padding invisible expandido. |
| Alternativa accesible | Formulario numérico siempre visible: inputs de X, Y, Ancho, Alto. Sincronizados bidireccionalmente con drag/resize. |
| Teclado | Zona seleccionada movible con flechas (1px por step, 10px con Shift). |
| Tab order | Zonas ordenadas por DOM: Nombre → Foto → QR → Folio → Fecha → Programa |

### Formulario numérico (panel lateral)

```
┌─ Zona: Nombre ──────────────────┐
│ [✓ Obligatoria]                 │
│                                 │
│ X _____ px    Y _____ px        │
│ Ancho _____ px  Alto _____ px   │
│                                 │
│ Fuente: EB Garamond 500 italic  │
│ Tamaño: [36]pt  Mín: [28]pt    │
│ Color: [■ #1A1A2E]             │
│ Alineación: [Izq] [Centro] [Der]│
│                                 │
│ ── Preview de nombre ────────── │
│ [María Fernanda González______] │
│ "Este nombre cabe a 36pt." ✓   │
└─────────────────────────────────┘
```

### Reglas de validación del ZoneEditor

| Validación | Mensaje |
|-----------|---------|
| Zona fuera de los límites de la plantilla | `La zona [Nombre] está fuera de la imagen. Muévela dentro del área de la plantilla.` |
| Solapamiento entre zonas | `⚠ La zona [A] y [B] se superponen.` (warning, no bloqueante) |
| Zona obligatoria sin configurar (al intentar continuar) | Tooltip en botón deshabilitado: `Configura las zonas obligatorias: Nombre, Foto, QR y Folio.` |
| Dimensiones inválidas | `El ancho y alto deben ser mayores a 0.` |

---

## 10. Checklist final para Frontend

### Tokens y base

- [ ] `--touch-min: 44px` definido en `:root`
- [ ] `:focus-visible` global implementado con `--seneto-blue`
- [ ] Tokens de badge ajustados para WCAG AA implementados
- [ ] Token `--seneto-text-muted-on-card` usado en contextos sobre `--seneto-card`
- [ ] `prefers-reduced-motion` media query aplicada globalmente

### Mobile-first

- [ ] Ningún target interactivo mobile mide menos de 44×44px
- [ ] Botón `sm` (36px) NO usado en viewport < 768px
- [ ] Tabla admin usa cards/lista apilada en mobile (< 768px)
- [ ] Página `/v/[token]` validada para 375px
- [ ] Inputs y selects tienen `min-height: var(--touch-min)` en mobile
- [ ] Links del footer público tienen área táctil ≥ 44px

### Accesibilidad

- [ ] Focus visible en todos los elementos interactivos (botones, links, inputs, tabs, modales)
- [ ] `outline: none` nunca usado sin reemplazo accesible
- [ ] Focus trap implementado en modales
- [ ] Campos inválidos tienen `aria-invalid="true"` + `aria-describedby`
- [ ] Banners de error usan `role="alert"` + `aria-live="assertive"`
- [ ] Banners de estado usan `role="status"` + `aria-live="polite"`
- [ ] Loading states tienen texto visible `Cargando…` además de spinner

### Página pública `/v/[token]`

- [ ] Token de verificación NUNCA visible al usuario
- [ ] Folio visible como identificador legible
- [ ] Foto del participante NO mostrada en MVP
- [ ] Estados definidos: válido / revocado / expirado / no encontrado / error 500 / loading
- [ ] SSR — estado visible sin JavaScript del cliente
- [ ] `<html lang="es">` + meta robots `noindex, nofollow`
- [ ] Footer con enlace a aviso de privacidad
- [ ] Badge de estado como elemento más prominente de la página

### Componentes

- [ ] ZoneEditor tiene estado empty con CTA y controles deshabilitados
- [ ] ZoneEditor tiene alternativa accesible por formulario numérico
- [ ] Handles de resize ≥ 44px en dispositivos táctiles
- [ ] Acciones destructivas (Revocar) visualmente distintas con `--color-error`
- [ ] Acciones destructivas siempre requieren modal de confirmación
- [ ] Hover effects no son la única señal de interactividad

### Contrastes WCAG AA

- [ ] Contrastes de badges verificados con tokens ajustados
- [ ] Texto `--seneto-text-muted` sobre `--seneto-card` usa `#5f6672`
- [ ] Botón primary gradient: texto blanco sobre extremo oscuro (#c9354d) = 5.1:1 ✅
- [ ] Botón disabled: `aria-disabled="true"` + `cursor: not-allowed` (exento de contraste)
- [ ] Focus ring sobre fondos claros: ≥ 3:1 ✅
- [ ] Focus ring sobre fondos oscuros usa `--seneto-blue-vivid` (#4dc1ec)

### Motion

- [ ] Duraciones: 150–250ms máximo
- [ ] Solo `transform`, `opacity`, `box-shadow`, `background-color` animados
- [ ] `prefers-reduced-motion: reduce` respetado globalmente
- [ ] Loading animations tienen alternativa de texto no dependiente del movimiento

---

_Dirección B — Cálida elevada — sin cambios en identidad visual._
_Ajustes de contraste son oscurecimientos mínimos del mismo hue para cumplir WCAG AA._
