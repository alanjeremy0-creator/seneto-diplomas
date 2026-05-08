# UI Kit Funcional — Parte 1: Accesibilidad y Tokens

_Complemento funcional del UI Kit Seneto · Dirección B (Cálida elevada) · 2026-05-07_
_Auditoría de accesibilidad WCAG AA, mobile-first y reglas de implementación._

> Este documento **complementa** `UI_KIT.md`. No reemplaza la identidad visual ni los tokens base de Dirección B.

---

## 1. Token global de touch target

```css
:root {
  --touch-min: 44px;
}
```

### Regla general

En mobile (viewport < 768px), **ningún elemento interactivo** debe medir menos de 44×44px en su área tappable. Esto aplica a:

| Elemento | Regla |
|----------|-------|
| Botones | `min-height: var(--touch-min)` en mobile |
| Icon buttons | Área clickeable 44×44px mínimo (padding si el ícono es menor) |
| Acciones en tablas | Cada acción: 44×44px de touch area |
| Controles del ZoneEditor | Handles de resize: 44×44px en táctil |
| CTAs de página pública | Siempre ≥ 44px height |
| Links inline en listas | `padding-block: 0.5rem` para ampliar zona táctil |
| Inputs, selects, textareas | `min-height: var(--touch-min)` |

### Restricción del botón `sm` (36px)

| Contexto | `sm` (36px) permitido | `md` (44px) requerido |
|----------|----------------------|----------------------|
| Desktop (≥768px) | ✅ | — |
| Mobile (<768px) | ❌ Prohibido | ✅ Obligatorio |
| Contexto no táctil | ✅ | — |

**Implementación:** Usar clase responsive o media query:
```css
@media (max-width: 767px) {
  .btn-sm { min-height: var(--touch-min); padding: 0.625rem 1rem; }
}
```

---

## 2. Focus global accesible

### Regla CSS global

```css
:focus-visible {
  outline: 2px solid var(--seneto-blue);
  outline-offset: 2px;
}
```

### Reglas de implementación

| Regla | Detalle |
|-------|---------|
| Cobertura | Todos los elementos interactivos: botones, links, inputs, selects, textareas, icon buttons, tabs, rows clickeables, controles del ZoneEditor, modales |
| Prohibición | **Nunca** usar `outline: none` sin reemplazo accesible equivalente |
| Override por componente | Los inputs ya tienen `box-shadow` en focus → mantener ambos: el outline global + el box-shadow del componente |
| Contraste del ring | `--seneto-blue` (#1a8ab5) sobre blanco = **3.9:1** → cumple WCAG 2.1 SC 1.4.11 (3:1 para componentes no textuales) ✅ |
| Sobre fondos oscuros | Usar `outline-color: #4dc1ec` (blue-vivid) para mantener contraste |

### Focus trap en modales

- Al abrir un modal, el focus queda atrapado dentro del modal.
- `Escape` cierra el modal y retorna el focus al elemento que lo activó.
- El primer elemento focuseable del modal recibe focus automáticamente.

---

## 3. Auditoría de contrastes — Dirección B

Análisis calculado con luminancia relativa WCAG 2.1.

### Resultados

| Par de colores | Ratio | AA Normal (4.5:1) | AA Large (3:1) | Acción |
|---------------|-------|-------------------|----------------|--------|
| `#fff` sobre `#c9354d` (btn primary base) | **5.1:1** | ✅ Pass | ✅ Pass | Ninguna |
| `#fff` sobre `#e54360` (btn primary vivid) | **3.96:1** | ⚠️ Fail | ✅ Pass | OK: el gradiente termina en #c9354d que sí pasa; texto es 16px/600 = large text |
| `#fff` sobre btn primary disabled (50% opacity) | **2.2:1** | ❌ Fail | ❌ Fail | Exento WCAG 1.4.3 (inactive components). Agregar `cursor: not-allowed` + `aria-disabled` |
| `#15803d` sobre badge active bg | **4.46:1** | ⚠️ Borderline | ✅ Pass | **Ajustar texto a `#14732c`** (≈4.8:1) |
| `#c9354d` sobre badge revoked bg | **4.3:1** | ⚠️ Fail | ✅ Pass | **Ajustar texto a `#b02e43`** (≈4.7:1) |
| `#8a6d00` sobre badge pending bg | **4.2:1** | ⚠️ Fail | ✅ Pass | **Ajustar texto a `#755c00`** (≈5.0:1) |
| `#1a8ab5` sobre badge info bg | **3.5:1** | ❌ Fail | ✅ Pass | **Ajustar texto a `#15758f`** (≈4.6:1) |
| `#6b7280` sobre `#f0f4f8` (muted/card) | **4.39:1** | ⚠️ Fail | ✅ Pass | **Ajustar a `#5f6672`** (≈4.8:1) |
| `#4b5563` sobre `#f5f5f5` (secondary/bg) | **7.0:1** | ✅ Pass | ✅ Pass | Ninguna |
| `#1a1a1a` sobre `#f5f5f5` (dark/bg) | **15.4:1** | ✅ Pass | ✅ Pass | Ninguna |
| Focus ring `#1a8ab5` sobre blanco | **3.9:1** | N/A (non-text) | ✅ 3:1 req | Cumple SC 1.4.11 ✅ |
| Focus ring `#1a8ab5` sobre `#f5f5f5` | **3.7:1** | N/A | ✅ 3:1 req | Cumple SC 1.4.11 ✅ |

### Ajustes requeridos (sin cambiar identidad visual)

Los ajustes son oscurecimientos mínimos del mismo hue — imperceptibles visualmente, pero cumplen WCAG AA.

```css
/* Badge text ajustado para WCAG AA en texto normal */
--badge-active-text:   #14732c;  /* era #15803d */
--badge-revoked-text:  #b02e43;  /* era #c9354d */
--badge-pending-text:  #755c00;  /* era #8a6d00 */
--badge-info-text:     #15758f;  /* era #1a8ab5 */

/* Texto muted ajustado sobre --seneto-card */
--seneto-text-muted-on-card: #5f6672;  /* era #6b7280 */
```

> Estos tokens son **solo para contextos donde el fondo es el badge tint o card**. En contextos sobre blanco puro, los colores originales siguen siendo válidos.

---

## 4. Reglas de Motion accesible

### Duraciones recomendadas

| Tipo de animación | Duración | Easing |
|-------------------|----------|--------|
| Micro-interacción (hover, focus) | 150ms | `ease-out` |
| Transición de estado (expand, toggle) | 200ms | `ease-in-out` |
| Entrada de componente (modal, toast) | 250ms | `ease-out` |
| Salida de componente | 150ms | `ease-in` |

### Propiedades animables

| ✅ Usar | ❌ Evitar |
|---------|----------|
| `transform` (translate, scale) | `width`, `height` |
| `opacity` | `margin`, `padding` |
| `box-shadow` | `top`, `left`, `right`, `bottom` |
| `background-color` | `font-size` |
| `border-color` | Layout properties |

### `prefers-reduced-motion` — Obligatorio

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Reglas adicionales

| Regla | Detalle |
|-------|---------|
| Hover no es señal única | Todo efecto hover debe tener equivalente visible sin hover (border, underline, color shift permanente) |
| Loading con alternativa | Spinners y barras animadas deben incluir texto alternativo (`Cargando…`) visible sin depender del movimiento |
| Pulse/glow | Limitado a 3 repeticiones; nunca infinito sin `prefers-reduced-motion` |
| Auto-play | Prohibido. Ninguna animación empieza sin interacción del usuario (excepto loading states) |

---

## 5. Tokens Tailwind actualizados

Agregar al `tailwind.config.ts` existente:

```js
// Agregar a theme.extend
spacing: {
  'touch': '2.75rem',  // 44px — --touch-min
},
colors: {
  seneto: {
    // ... tokens existentes sin cambio ...
    // Agregar tokens de badge ajustados:
    'badge-active':  '#14732c',
    'badge-revoked': '#b02e43',
    'badge-pending': '#755c00',
    'badge-info':    '#15758f',
    'muted-on-card': '#5f6672',
  }
},
```

---

_Fin de Parte 1. Ver `UI_KIT_FUNCTIONAL_P2.md` para estados críticos, página pública, tabla responsive, ZoneEditor y checklist._
