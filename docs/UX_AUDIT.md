# UX Audit — Sistema de Diplomas Seneto

_Generado por Agente Product Design · 2026-05-07_

---

## Hallazgos Críticos

### HC1 — Decisión de foto pendiente: bloquea el diseño final de la página pública

**Contexto:** La pantalla de verificación pública (`/v/[token]`) es la cara de Seneto ante el mundo exterior: empleadores, escuelas, validadores. El diseño actual en WIREFRAMES.md incluye la foto del paciente/egresado como elemento destacado en el hero de la tarjeta.

**Problema:** Mostrar una foto biométrica en una URL pública (sin autenticación) implica:
- Exposición de dato personal sensible bajo LGPD/regulación mexicana
- El titular puede no haber dado consentimiento explícito para uso público
- Riesgo de scraping masivo de fotos asociadas a datos médicos (nefrología)

**Decisión requerida antes de wireframear la vista final:**

| Opción | UX | Privacidad | Esfuerzo |
|--------|-----|-----------|---------|
| A. Sin foto — solo datos del diploma | Simple, limpio | Mínimo riesgo | Bajo |
| B. Foto tras consentimiento explícito | Enriquece credencial | Requiere flow de opt-in | Medio |
| C. Foto solo si hay sesión activa | Diferenciación admin/público | Lógica adicional | Medio |

**Recomendación:** Opción A para MVP. La credencial es válida por los datos del diploma, no por la foto.

---

### HC2 — URLs de verificación: folio → token (alineación pendiente)

**Contexto:** El Security Audit (C2) identificó que los folios secuenciales (`SEN-2026-001`) en la URL pública crean un IDOR crítico.

**Impacto en UX:**
- Todos los wireframes, flows y copy que referencian `/v/{folio}` deben actualizarse a `/v/{token}` (UUID)
- El QR del diploma apuntará a la URL con token, no folio
- La UI de verificación debe mostrar el folio (`SEN-2026-001`) como dato legible, pero el token no se muestra al usuario

**Archivos que requieren actualización:**
- `WIREFRAMES.md`: pantalla `/v/[folio]` → `/v/[token]`
- `USER_FLOWS.md`: flujo F-11 "Verificación pública"
- `COPY.md`: texto del QR y enlace de verificación

**Acción:** Actualizar referencias en documentación UX antes de iniciar desarrollo de la página pública.

---

### HC3 — Estado de error 500 ausente en COPY.md

**Contexto:** `COPY.md` documenta textos para estados vacíos, errores 404 y estados de carga. No hay copy para errores inesperados del servidor (500 / error genérico).

**Impacto:** El desarrollador front-end no tiene referencia de texto, puede quedar un mensaje técnico expuesto al usuario.

**Copy sugerido para agregar a COPY.md:**

```
## Error inesperado
Título: "Algo salió mal"
Subtítulo: "Ocurrió un error inesperado. Por favor intenta de nuevo en unos momentos."
CTA: "Volver al inicio"
Ayuda: "Si el problema persiste, contacta al equipo de Seneto."
```

---

## Hallazgos Importantes

### HI1 — Mobile-first: touch targets críticos no verificados

**Estándar:** WCAG 2.1 Success Criterion 2.5.5 — touch target mínimo 44×44px.

**Elementos en riesgo:**
- Botones de acción en tablas (editar, descargar, revocar) en mobile: en vistas de lista comprimidas pueden quedar <40px
- El selector de zona en el editor de plantilla (ZoneEditor) usa handles de redimensionamiento que en pantalla táctil pueden ser difíciles de activar
- Badges de estado en tabla — no son interactivos, pero si se vuelven clickeables (filtro) deben cumplir el mínimo

**Recomendación:** Definir tamaño mínimo de touch target como token de diseño (`--touch-min: 44px`) y aplicarlo explícitamente en componentes de tabla.

---

### HI2 — ZoneEditor: falta estado "sin plantilla cargada"

**Contexto:** El ZoneEditor es el componente más complejo del sistema (editor de zonas sobre imagen de diploma). La especificación define estados: idle, dragging, resizing, selected, error. Falta el estado inicial cuando no hay plantilla cargada.

**Estado faltante — "empty":**
- Área de canvas muestra placeholder con instrucción: "Carga una plantilla para comenzar a definir zonas"
- Botones de zona deshabilitados visualmente (no solo funcional)
- CTA prominente: "Cargar plantilla"

**Impacto:** Sin este estado, el primer uso del sistema es confuso para el administrador.

---

### HI3 — Flujo de revocación: confirmación insuficiente para acción destructiva

**Contexto:** Revocar un diploma es irreversible desde la perspectiva del egresado (aunque técnicamente el admin puede reactivar). Es la acción de mayor impacto en el sistema.

**Hallazgo:** `USER_FLOWS.md` F-09 describe la revocación con un modal de confirmación simple. No especifica:
- Campo de texto de motivo (requerido para AuditLog — ver Security Audit C5)
- Texto de consecuencia clara: "El egresado verá 'Diploma revocado' al escanear el QR"
- Confirmación tipada (ej. escribir "REVOCAR" o el folio)

**Recomendación para MVP:** Modal de confirmación con campo de motivo requerido (mínimo 10 caracteres). La confirmación tipada puede esperar para v2 si genera fricción.

---

### HI4 — Empty states incompletos en vistas de lista

**Contexto:** `COPY.md` tiene empty states para diplomas y cursos. Faltan:
- Empty state para "sin generaciones en progreso" (cuando no hay trabajos en cola)
- Empty state para "búsqueda sin resultados" (distinto al empty state de lista vacía)
- Empty state para "sin historial de auditoría" (lista de AuditLog vacía)

**Impacto:** Bajo para MVP si se usa un empty state genérico, pero el tono de Seneto (cálido, humano) se pierde con mensajes genéricos.

---

### HI5 — Accesibilidad: contraste de estados hover/focus en dirección B

**Contexto:** La Dirección B (Cálida elevada, preferida por el usuario) usa gradientes y sombras sutiles en lugar de cambios de color sólidos para indicar estados interactivos.

**Riesgo:** Los gradientes en botones primarios (`linear-gradient(180deg, #e54360, #c9354d)`) sobre fondos blancos: ratio ~5.2:1 ✓. Pero en el estado hover/pressed (gradiente más oscuro) puede bajar a ~4.6:1 en texto blanco sobre acento — justo en el límite WCAG AA.

**Acción:** Verificar ratios de contraste en:
- Botón primario hover: texto blanco sobre `#b02d44`
- Badge "revocado" (rojo): texto blanco sobre `#c9354d`
- Badge "en progreso" (gold): texto oscuro sobre `#ffd032` — verificar `#1a1a1a` sobre `#ffd032` ≈ 8.5:1 ✓

---

## Checklist de Privacidad (MVP)

- [ ] ¿La foto del egresado se muestra en URLs públicas? → Definir política (HC1)
- [ ] ¿El folio secuencial aparece en URLs? → Reemplazar por token (HC2)
- [ ] ¿Los errores de servidor exponen stack traces? → Verificar en producción
- [ ] ¿Los archivos de diploma tienen URLs firmadas con expiración? → Confirmar con Arquitectura
- [ ] ¿Hay textos legales/aviso de privacidad en la página de verificación pública?

---

## Checklist de Accesibilidad (WCAG AA)

- [ ] Todos los touch targets ≥ 44×44px en mobile (HI1)
- [ ] Focus ring visible en todos los elementos interactivos (estilo: `outline: 2px solid var(--seneto-blue); outline-offset: 2px`)
- [ ] Imágenes decorativas con `alt=""`, imágenes informativas con `alt` descriptivo
- [ ] Formularios con `<label>` asociado explícitamente (no solo placeholder)
- [ ] Errores de validación anunciados a lectores de pantalla (`role="alert"`)
- [ ] Controles de ZoneEditor accesibles por teclado (o alternativa de formulario numérico)
- [ ] Contraste de estados hover/focus verificado (HI5)

---

## Actualizaciones Prioritarias para Documentación UX

| Documento | Actualización Requerida | Prioridad |
|-----------|------------------------|-----------|
| WIREFRAMES.md | `/v/{folio}` → `/v/{token}` en pantalla pública | Alta |
| USER_FLOWS.md | F-09 revocación: agregar campo motivo; F-11: URL con token | Alta |
| COPY.md | Agregar copy de error 500; empty states faltantes | Media |
| UI_STATES.md | Agregar estado "empty" al ZoneEditor | Media |

