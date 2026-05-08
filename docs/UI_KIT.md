# UI Kit — Sistema de Diplomas Seneto

_Tokens extraídos del UI Kit oficial · Dirección B (Cálida elevada) · 2026-05-07_

---

## Fuente de verdad

Tokens extraídos del archivo `UI Kit SENETO.html` generado por el equipo de diseño de Seneto.
Dirección visual aplicada: **B — Cálida elevada** (preferida por el cliente).

---

## 1. Paleta de Color

### Colores primarios (accessible = aptos para texto sobre blanco)

| Token CSS | Hex | Uso |
|-----------|-----|-----|
| `--seneto-red` | `#c9354d` | PRIMARY ACCESSIBLE — CTAs, texto, focus ring |
| `--seneto-red-vivid` | `#e54360` | PRIMARY VIVID — gradientes, fills grandes |
| `--seneto-blue` | `#1a8ab5` | SECONDARY ACCESSIBLE — links, info, iconos |
| `--seneto-blue-vivid` | `#4dc1ec` | SECONDARY VIVID — ilustración, pulse |
| `--seneto-gold` | `#8a6d00` | TERTIARY ACCESSIBLE — warning, highlight texto |
| `--seneto-gold-vivid` | `#ffd032` | TERTIARY VIVID — badges, ornamento |

### Neutros

| Token CSS | Hex | Uso |
|-----------|-----|-----|
| `--seneto-dark` | `#1a1a1a` | INK — texto body, contraste 15:1 |
| `--seneto-bg` | `#f5f5f5` | PAGE BACKGROUND |
| `--seneto-card` | `#f0f4f8` | Card/superficie elevada |
| `--seneto-text-secondary` | `#4b5563` | Texto secundario |
| `--seneto-text-muted` | `#6b7280` | Texto muted/caption |

### Semánticos (mapeo sobre paleta)

| Token | Color base | Hex |
|-------|-----------|-----|
| `--color-success` | green-600 | `#16a34a` |
| `--color-warning` | gold accessible | `#8a6d00` |
| `--color-error` | red accessible | `#c9354d` |
| `--color-info` | blue accessible | `#1a8ab5` |

### Acento (configurable — default: red)

El sistema soporta 4 acentos intercambiables. Default para diplomas: **Red**.

| Acento | Accessible | Vivid |
|--------|-----------|-------|
| Red (default) | `#c9354d` | `#e54360` |
| Blue | `#1a8ab5` | `#4dc1ec` |
| Gold | `#8a6d00` | `#ffd032` |
| Plum | `#7a3552` | `#a64372` |

---

## 2. Tipografía

### Familias (Dirección B — Cálida elevada)

| Rol | Familia | Fallback |
|-----|---------|---------|
| Display / Headings | `'Inter'` | `system-ui, sans-serif` |
| Body | `'Inter'` | `system-ui, sans-serif` |
| Diploma (nombre) | `'EB Garamond'` 500 italic | `Georgia, serif` |

> La fuente para el nombre en el diploma físico es **EB Garamond Medium Italic (500-italic)** — renderizada con canvas/sharp, no CSS.

### Escala tipográfica (base: 17px / 1.0625rem)

| Token | Tamaño | Line-height | Peso | Uso |
|-------|--------|------------|------|-----|
| `--text-xs` | 0.75rem (12px) | 1.5 | 400 | Caption, badge label |
| `--text-sm` | 0.875rem (14px) | 1.57 | 400 | Texto secundario, tabla |
| `--text-base` | 1.0625rem (17px) | 1.65 | 400 | Body text |
| `--text-lg` | 1.25rem (20px) | 1.5 | 500 | Body grande, card subtitle |
| `--text-xl` | 1.5rem (24px) | 1.4 | 600 | H4, sección title |
| `--text-2xl` | 2rem (32px) | 1.3 | 700 | H3 |
| `--text-3xl` | 2.5rem (40px) | 1.2 | 700 | H2 |
| `--text-4xl` | 3.5rem (56px) | 1.1 | 700 | H1, hero |

---

## 3. Espaciado

Sistema basado en múltiplos de 4px (Tailwind scale).

| Token | Valor | px equiv |
|-------|-------|---------|
| `--space-1` | 0.25rem | 4px |
| `--space-2` | 0.5rem | 8px |
| `--space-3` | 0.75rem | 12px |
| `--space-4` | 1rem | 16px |
| `--space-6` | 1.5rem | 24px |
| `--space-8` | 2rem | 32px |
| `--space-12` | 3rem | 48px |
| `--space-16` | 4rem | 64px |

---

## 4. Radios de borde

Dirección B usa radios medios — no pill, no sharp.

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-sm` | `0.5rem` (8px) | Inputs, badges |
| `--radius-md` | `1rem` (16px) | Botones, cards — **default en Dir B** |
| `--radius-lg` | `1.5rem` (24px) | Modales, panels |
| `--radius-xl` | `2rem` (32px) | Hero cards, feature panels |
| `--radius-pill` | `9999px` | Solo avatares, loaders |

---

## 5. Sombras

| Token | Valor | Uso |
|-------|-------|-----|
| `--shadow-sm` | `0 1px 2px rgba(17,24,39,.06)` | Inputs en reposo |
| `--shadow-md` | `0 8px 24px -8px rgba(17,24,39,.12)` | Cards, dropdowns |
| `--shadow-lg` | `0 24px 48px -16px rgba(201,53,77,.18)` | Hero card, modales |
| `--shadow-glow` | `0 0 0 6px rgba(201,53,77,.08)` | Focus ring extendido, pulse |

---

## 6. Componentes

### Botón — Variantes (Dirección B)

#### Primary (CTA principal)
```css
background: linear-gradient(180deg, #e54360, #c9354d);
box-shadow: inset 0 1px 0 rgba(255,255,255,.15);
color: #ffffff;
border-radius: var(--radius-md);  /* 1rem */
font-weight: 600;
```
Estados: hover → `brightness(1.05)` + `translateY(-1px)` + shadow-md; active → `brightness(0.95)` + translateY(0); disabled → `opacity: 0.5`

#### Ghost
```css
background: transparent;
border: 1.5px solid #1a1a1a;
color: #1a1a1a;
border-radius: var(--radius-md);
```

#### Soft
```css
background: rgba(201, 53, 77, 0.12);  /* 12% accent tint */
color: #c9354d;
border: none;
border-radius: var(--radius-md);
```

#### Dark
```css
background: #1a1a1a;
color: #ffffff;
border-radius: var(--radius-md);
```

### Tamaños de botón

| Tamaño | Height | Padding X | Font |
|--------|--------|----------|------|
| sm | 36px | 1rem | 0.875rem |
| md | 44px | 1.5rem | 1rem |
| lg | 52px | 2rem | 1.0625rem |

> **Touch target mínimo: 44px height** — usar `md` como mínimo en mobile.

---

### Input / Select / Textarea

```css
border: 1.5px solid rgba(107, 114, 128, 0.3);
border-radius: var(--radius-sm);  /* 0.5rem */
background: #ffffff;
padding: 0.75rem 1rem;
font-size: var(--text-base);
color: var(--seneto-dark);
```

**Focus:**
```css
border-color: #c9354d;
outline: none;
box-shadow: 0 0 0 3px rgba(201, 53, 77, 0.15);
```

**Error:**
```css
border-color: #c9354d;
box-shadow: 0 0 0 3px rgba(201, 53, 77, 0.08);
```

**Label:** `font-size: 0.875rem; font-weight: 500; color: var(--seneto-dark); margin-bottom: 0.5rem`

**Helper text / error message:** `font-size: 0.75rem; color: var(--seneto-text-muted)` / `color: var(--seneto-red)`

---

### Badge — Semánticos

| Variante | Background | Text | Uso |
|----------|-----------|------|-----|
| `active` | `rgba(22, 163, 74, 0.12)` | `#15803d` | Diploma activo |
| `revoked` | `rgba(201, 53, 77, 0.12)` | `#c9354d` | Diploma revocado |
| `pending` | `rgba(138, 109, 0, 0.12)` | `#8a6d00` | En proceso / pendiente |
| `info` | `rgba(26, 138, 181, 0.12)` | `#1a8ab5` | Estado informativo |
| `neutral` | `rgba(107, 114, 128, 0.12)` | `#4b5563` | Estado neutro |

```css
/* Base badge */
display: inline-flex;
align-items: center;
padding: 0.25rem 0.75rem;
border-radius: var(--radius-sm);
font-size: 0.75rem;
font-weight: 600;
letter-spacing: 0.025em;
```

---

### Card (Service Card — Dirección B)

```css
background: linear-gradient(135deg, rgba(201,53,77,.06), rgba(26,138,181,.04));
border: 1px solid rgba(201,53,77,.12);
border-radius: var(--radius-lg);  /* 1.5rem */
padding: 2rem;
box-shadow: var(--shadow-md);
transition: transform 0.2s, box-shadow 0.2s;
```

Hover: `translateY(-4px)` + `shadow-lg`

---

### Hero Card (con glow)

```css
background: linear-gradient(135deg, rgba(201,53,77,.08), rgba(26,138,181,.06));
border: 1px solid rgba(201,53,77,.15);
border-radius: var(--radius-xl);
box-shadow: var(--shadow-lg), var(--shadow-glow);
```

---

### Tabla de datos (admin)

```css
/* Header */
background: var(--seneto-card);
font-size: 0.75rem;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.05em;
color: var(--seneto-text-muted);
padding: 0.75rem 1rem;

/* Row */
border-bottom: 1px solid rgba(107,114,128,.1);
padding: 1rem;
transition: background 0.15s;

/* Row hover */
background: rgba(201,53,77,.03);
```

---

### Modal

```css
background: #ffffff;
border-radius: var(--radius-lg);
box-shadow: var(--shadow-lg);
max-width: 480px;
width: calc(100% - 2rem);
padding: 2rem;
```

Overlay: `rgba(0,0,0,0.5)` con `backdrop-filter: blur(4px)`

---

## 7. Iconografía

**Librería:** Lucide React — `lucide-react` npm package

Íconos de especialidad Seneto (assets propios en `/public/assets/icons/`):
- `cardiologia.svg`
- `nutricion.svg`
- `psicologia.svg`
- `urologia.svg`

Tamaños de ícono:
| Contexto | Tamaño |
|----------|--------|
| Inline en texto | 16px |
| Botón con ícono | 20px |
| Card feature | 24px |
| Hero / empty state | 48px |

---

## 8. Marca — Assets

Logos disponibles en `/public/assets/brand/`:

| Archivo | Uso |
|---------|-----|
| `SENETO_logo.png` | Logo principal — header, documentos |
| `SENETO_logo_highcontrast.png` | Logo alto contraste — footer oscuro |
| `SENETO_isotipo.png` | Isotipo solo — favicon, espacios reducidos |

---

## 9. Tokens Tailwind — Configuración

Mapeado a `tailwind.config.js` existente del proyecto:

```js
// tailwind.config.js (fragmento)
theme: {
  extend: {
    colors: {
      seneto: {
        red:        '#c9354d',
        'red-vivid': '#e54360',
        blue:       '#1a8ab5',
        'blue-vivid': '#4dc1ec',
        gold:       '#8a6d00',
        'gold-vivid': '#ffd032',
        dark:       '#1a1a1a',
        bg:         '#f5f5f5',
        card:       '#f0f4f8',
      }
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      diploma: ['"EB Garamond"', 'Georgia', 'serif'],
    },
    borderRadius: {
      sm:   '0.5rem',
      md:   '1rem',
      lg:   '1.5rem',
      xl:   '2rem',
      pill: '9999px',
    },
    boxShadow: {
      sm:   '0 1px 2px rgba(17,24,39,.06)',
      md:   '0 8px 24px -8px rgba(17,24,39,.12)',
      lg:   '0 24px 48px -16px rgba(201,53,77,.18)',
      glow: '0 0 0 6px rgba(201,53,77,.08)',
    }
  }
}
```

---

## 10. Patrones de Layout

### Grid de cards

```css
display: grid;
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
gap: 1.5rem;
```

### Container máximo

```css
max-width: 1200px;
margin: 0 auto;
padding: 0 1.5rem;
```

### Mobile breakpoints (mobile-first)

| Breakpoint | Ancho | Notas |
|-----------|-------|-------|
| base | 375px | Primary design target |
| sm | 640px | Tablet portrait |
| md | 768px | Tablet landscape |
| lg | 1024px | Desktop |
| xl | 1280px | Wide desktop |

---

---

## 11. Complemento funcional — Accesibilidad y Mobile-first

> La auditoría funcional del UI Kit está documentada en dos archivos complementarios. **Frontend debe leer ambos antes de implementar.**

| Documento | Contenido |
|-----------|-----------|
| [`UI_KIT_FUNCTIONAL_P1.md`](./UI_KIT_FUNCTIONAL_P1.md) | Touch targets, focus global, auditoría de contrastes WCAG AA, motion accesible, tokens Tailwind actualizados |
| [`UI_KIT_FUNCTIONAL_P2.md`](./UI_KIT_FUNCTIONAL_P2.md) | Estados críticos (loading, error, success, etc.), página pública `/v/[token]`, tabla admin responsive, ZoneEditor, checklist final para Frontend |

---

_Dirección B — Cálida elevada — es la dirección visual confirmada por el cliente._
_Logo source: `/tmp/seneto_kit/branding-seneto/project/assets/` — copiar a `/public/assets/brand/`._
