# WIREFRAMES — Sistema de Diplomas Digitales Seneto

Wireframes en ASCII. Priorizados por complejidad e impacto en el desarrollo.

---

## Notas de accesibilidad — aplican a todos los wireframes

1. **Color + icono + texto para estados:** Los chips y badges de estado nunca usan solo color.
   Siempre: icono + etiqueta de texto + color.
   Ejemplo correcto: ✓ Válido (verde) | ✕ Revocado (rojo) | ⚠ Expirado (amarillo)

2. **Botones disabled con explicación:** Los botones deshabilitados tienen cursor `not-allowed`
   y tooltip que explica por qué están deshabilitados.

3. **Modales con Escape:** Todos los modales de confirmación se cierran con la tecla Escape,
   además del botón "Cancelar" visible.

4. **Foco visible:** Todos los elementos interactivos tienen estado de foco visible
   (outline o ring de color) para navegación por teclado.

5. **Tamaños legibles en móvil:** La página pública /v/:folio usa fuente mínima de 16px
   para texto de cuerpo, 24px para el estado principal, y 20px para el nombre.

6. **Mensajes de error con texto:** Los errores nunca se comunican solo con color.
   Siempre incluyen un icono y descripción textual de qué falló y qué hacer.

---

## 1. /admin/generations/:id/template — ZoneEditor

Estado: plantilla cargada, zona "Nombre" seleccionada y siendo arrastrada, con cambios sin guardar.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ← Generación: Diplomado Liderazgo Q1 2026        [Guardar cambios ●]  [Continuar →] │
├──────────────────────────┬──────────────────────────────────────────────────────────┤
│  ZONAS DEL DIPLOMA       │                                                          │
│  ─────────────────────── │                                                          │
│  ✓ Nombre        [editar]│                                                          │
│  ✓ Foto          [editar]│            ╔══════════════════════════════════╗           │
│  ✓ QR            [editar]│            ║                                  ║           │
│  ✓ Folio         [editar]│            ║       [imagen del diploma        ║           │
│  ○ Fecha         [editar]│            ║        base — alta resolución,   ║           │
│  ○ Programa      [editar]│            ║        escalada para caber en    ║           │
│                          │            ║        el panel]                 ║           │
│  ─────────────────────── │            ║                                  ║           │
│  EDITANDO: Nombre        │            ║   ┌────────────────────────────◢ ║           │
│  ─────────────────────── │            ║   │  NOMBRE (seleccionada)     │ ║           │
│  X           [  400    ] │            ║   │  borde azul — arrastrable  │ ║           │
│  Y           [  820    ] │            ║   └────────────────────────────┘ ║           │
│  Ancho       [  900    ] │            ║   (◢ = handle de redimensión     ║           │
│  Alto        [   80    ] │            ║    arrastrable en esquinas)      ║           │
│                          │            ║  ┌──────────────┐               ║           │
│  Tamaño fuente [  36pt ] │            ║  │  [placeholder│               ║           │
│  Tamaño mín.   [  28pt ] │            ║  │    de foto]  │               ║           │
│  Color     [#1A1A2E  ██] │            ║  │  borde gris  │               ║           │
│  Alineación [Centro  ▾ ] │            ║  └──────────────┘               ║           │
│                          │            ║                         ┌─────┐  ║           │
│  Nombre de prueba:       │            ║                         │[QR  │  ║           │
│  [María Fernanda Gonz.. ]│            ║                         │gene-│  ║           │
│  ⚠ Se reduce a 31pt     │            ║                         │rico]│  ║           │
│    (mínimo: 28pt — cabe) │            ║                         └─────┘  ║           │
│                          │            ║                                  ║           │
│                          │            ╚══════════════════════════════════╝           │
│                          │            Plantilla: 2480 × 3508 px                     │
│                          │            Escala de vista: 1:4                          │
└──────────────────────────┴──────────────────────────────────────────────────────────┘
```

Notas:
- "Guardar cambios ●" — el punto indica cambios pendientes. Sin punto = "Sin cambios" (gris, deshabilitado).
- Las zonas en el panel derecho se muestran siempre sobre la imagen, incluso si no están seleccionadas (borde gris semitransparente con etiqueta). Solo la seleccionada tiene borde azul.
- El admin arrastra cualquier zona para moverla y arrastra las esquinas (◢) para redimensionarla. Las coordenadas x/y/ancho/alto en el panel izquierdo se actualizan automáticamente al arrastrar.
- Los campos numéricos siguen visibles para ajuste fino o verificación exacta.
- ✓ en la lista = zona configurada. ○ = sin configurar.
- Zonas obligatorias: Nombre, Foto, QR y Folio. Las cuatro deben estar configuradas para poder avanzar.
- El botón "Continuar →" está deshabilitado si falta alguna zona obligatoria.
  ```
  [ Continuar → ] ← deshabilitado si falta alguna zona obligatoria
                    tooltip: "Configura las zonas Nombre, Foto, QR y Folio antes de continuar"
  ```
- La zona Foto muestra un placeholder de imagen. La zona QR muestra un QR genérico. Ambos son visuales de referencia, no datos reales.
- El campo "Nombre de prueba" solo existe en la zona Nombre.
- Zonas opcionales sin configurar (○) no generan advertencia, solo se muestra el círculo vacío.
- Zona "fuera del canvas": si el admin arrastra una zona más allá del borde de la imagen,
  el rectángulo se muestra en rojo con label "Zona fuera del diploma — ajusta su posición"
- Botón "Ajustar vista": si la plantilla es más ancha que el panel disponible,
  mostrar botón "Ajustar al panel" que escala la vista sin cambiar las coordenadas reales

---

## 2. /admin/generations/:id/generate — Progreso de generación (en curso)

Estado: generación en progreso, 87 de 150 completados, 3 errores hasta el momento.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ← Diplomado Liderazgo Q1 2026                                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   Generando diplomas…                                                               │
│   ──────────────────────────────────────────────────────────────────────────────   │
│                                                                                     │
│   ████████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░   87 / 150        │
│                                                                     58%             │
│                                                                                     │
│   87 completados  ·  3 con error  ·  60 pendientes                                  │
│   Tiempo estimado restante: ~2 min 14 seg                                           │
│                                                                                     │
│   ℹ Puedes dejar esta pantalla abierta para ver el progreso. Si la cierras,        │
│     la generación continuará y podrás volver después.                               │
│                                                                                     │
│   ─────────────────────────────────────────────────────────────────────────────   │
│   Errores (3)                                                                       │
│   ┌──────────────────────────────────────────────────────────────────────────────┐  │
│   │ Fila 12  Ana Sofía Martínez Ríos    Foto faltante: 'ana_sofia.jpg' no        │  │
│   │          encontrada en el ZIP de fotos                                        │  │
│   │ ──────────────────────────────────────────────────────────────────────────   │  │
│   │ Fila 34  Roberto Gutiérrez Pérez    Error de render: la imagen de foto está   │  │
│   │          dañada o en formato no compatible                                    │  │
│   │ ──────────────────────────────────────────────────────────────────────────   │  │
│   │ Fila 61  Valentina Torres          Error de render: desconocido               │  │
│   └──────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Notas:
- La barra de progreso avanza en tiempo real (polling cada 2 segundos).
- La lista de errores es scrollable si supera la altura disponible. Los errores más recientes se agregan al final.
- El botón de descarga no aparece hasta que el proceso termina.
- El aviso de progreso es informativo, no bloqueante.

---

## 3. /admin/generations/:id/generate — Generación con errores parciales (completada)

Estado: generación terminada. 140 generados correctamente, 10 participantes no pudieron generarse.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ← Diplomado Liderazgo Q1 2026                                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   Generación completada con errores parciales                                       │
│   ─────────────────────────────────────────────────────────────────────────────   │
│                                                                                     │
│   ████████████████████████████████████████████████████████████████  140 / 150       │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓ (barra naranja — no 100%)                           93%             │
│                                                                                     │
│   140 diplomas generados correctamente                                               │
│    10 participantes no pudieron generarse — no incluidos en el ZIP                  │
│                                                                                     │
│   ┌──────────────────────────────┐   ┌────────────────────────────────┐             │
│   │  ↓ Descargar ZIP             │   │  ↓ Descargar CSV de errores    │             │
│   │  140 diplomas en PDF         │   │  Ver qué falló en cada caso    │             │
│   └──────────────────────────────┘   └────────────────────────────────┘             │
│                                                                                     │
│   ─────────────────────────────────────────────────────────────────────────────   │
│   ℹ Para regenerar los diplomas no generados, crea una nueva generación con solo esos│
│     participantes usando el CSV de errores como referencia.                         │
│                                                                                     │
│   10 participantes no pudieron generarse                               [expandir ▾] │
│   ┌──────────────────────────────────────────────────────────────────────────────┐  │
│   │ Fila 12  Ana Sofía Martínez Ríos    missing_photo                            │  │
│   │ Fila 34  Roberto Gutiérrez Pérez    render_error                             │  │
│   │ Fila 61  Valentina Torres           render_error                             │  │
│   │ … 7 más                                                                      │  │
│   └──────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Notas:
- El color de la barra es naranja (no verde) para comunicar que no fue 100% exitosa.
- El botón de descarga del ZIP es el CTA principal. El CSV de errores es secundario.
- La lista de participantes no generados está colapsada por defecto — se puede expandir para ver todos los 10.
- El aviso de "crea una nueva generación" es el único camino en MVP — no hay botón de "reintentar fallidos".

---

## 4. /v/:folio — Página pública (mobile 375px) — 4 estados

### 4a. Estado: activo

```
┌─────────────────────┐
│ [Logo Seneto]       │
├─────────────────────┤
│                     │
│  ✓  Diploma válido  │
│  ─────────────────  │
│  (badge verde)      │
│                     │
│      ╭──────╮       │
│      │ foto │       │
│      │parti-│       │
│      │cipante│      │
│      ╰──────╯       │
│                     │
│  María Fernanda     │
│  González de la     │
│  Vega               │
│                     │
│  Diplomado en       │
│  Liderazgo          │
│  Organizacional     │
│                     │
│  Emitido el:        │
│  15 de enero de     │
│  2026               │
│                     │
│  Folio:             │
│  SEN-2026-042       │
│                     │
│  ─────────────────  │
│  Institución:       │
│  Seneto             │
│                     │
│  Este diploma fue   │
│  emitido por Seneto │
│  y se encuentra     │
│  registrado como    │
│  válido.            │
│                     │
│  [Seneto debe       │
│  validar el texto   │
│  institucional      │
│  definitivo antes   │
│  de producción]     │
│                     │
├─────────────────────┤
│ seneto.com          │
└─────────────────────┘
```

### 4b. Estado: revocado

```
┌─────────────────────┐
│ [Logo Seneto]       │
├─────────────────────┤
│                     │
│  ✕  Este diploma    │
│     ha sido         │
│     revocado        │
│  (badge rojo)       │
│                     │
│  ─────────────────  │
│  Este diploma fue   │
│  emitido por Seneto │
│  pero ha sido       │
│  revocado.          │
│                     │
│  Para más           │
│  información,       │
│  contacta a Seneto. │
│                     │
│  Folio:             │
│  SEN-2026-042       │
│                     │
├─────────────────────┤
│ seneto.com          │
└─────────────────────┘
```

Notas: Sin foto. Sin nombre. Sin programa. Solo el folio para referencia de contacto.

### 4c. Estado: expirado

```
┌─────────────────────┐
│ [Logo Seneto]       │
├─────────────────────┤
│                     │
│  ⚠  Este diploma    │
│     ha expirado     │
│  (badge naranja)    │
│                     │
│  ─────────────────  │
│  María Fernanda     │
│  González de la     │
│  Vega               │
│                     │
│  Emitido el:        │
│  15 de enero de     │
│  2026               │
│                     │
│  Este diploma fue   │
│  válido pero su     │
│  vigencia ha        │
│  expirado.          │
│                     │
│  Folio:             │
│  SEN-2026-042       │
│                     │
├─────────────────────┤
│ seneto.com          │
└─────────────────────┘
```

Notas: Se muestra nombre y fecha pero NO la foto. El estado expirado informa pero no avala.

### 4d. Estado: not_found

```
┌─────────────────────┐
│ [Logo Seneto]       │
├─────────────────────┤
│                     │
│    ☐?               │
│  (ícono documento   │
│   con signo de      │
│   interrogación)    │
│                     │
│  Este folio no      │
│  corresponde a      │
│  ningún diploma     │
│  emitido por        │
│  Seneto.            │
│                     │
│  ─────────────────  │
│  Verifica que el    │
│  folio sea          │
│  correcto o         │
│  contacta a Seneto  │
│  si crees que es    │
│  un error.          │
│                     │
├─────────────────────┤
│ seneto.com          │
└─────────────────────┘
```

Notas: HTTP 404. Sin badge de color. Ícono neutro. Sin ningún dato de diploma.

---

## 5. /admin/generations/:id/students — CSV con errores de parsing

Estado: CSV subido con errores mixtos (un error bloqueante + advertencias por fila).

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ← Diplomado Liderazgo Q1 2026  /  Cargar participantes                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ■ CSV DE PARTICIPANTES                                    [↑ Subir nuevo CSV]      │
│  ─────────────────────────────────────────────────────────────────────────────   │
│                                                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │ ✕ Error — No se puede continuar                                                │ │
│  │                                                                                │ │
│  │  Falta la columna obligatoria: archivo_foto                                    │ │
│  │  Agrega esta columna al CSV y vuelve a subir.                                  │ │
│  │  [Descargar plantilla CSV de ejemplo]                                          │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │ ⚠ Advertencias en filas individuales (2)                                       │ │
│  │                                                                                │ │
│  │  Fila 5:  La fecha '15/03/2026' no tiene el formato correcto. Usa YYYY-MM-DD. │ │
│  │  Fila 12: El campo student_name está vacío.                                    │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│  Vista previa (primeras 5 filas del CSV):                                           │
│  ─────────────────────────────────────────────────────────────────────────────   │
│  ┌───────────────────────┬──────────────┬───────────────┬───────────────────────┐  │
│  │ student_name          │ email        │ program       │ issued_date           │  │
│  ├───────────────────────┼──────────────┼───────────────┼───────────────────────┤  │
│  │ María Fernanda G.     │ mfg@mail.com │ Liderazgo     │ 2026-01-15            │  │
│  │ Roberto Gutiérrez     │ rg@mail.com  │ Liderazgo     │ 2026-01-15            │  │
│  │ Valentina Torres      │ vt@mail.com  │ Liderazgo     │ 2026-01-15            │  │
│  │ …                     │              │               │                       │  │
│  └───────────────────────┴──────────────┴───────────────┴───────────────────────┘  │
│                                                                                     │
│  ■ FOTOS DE PARTICIPANTES                                                           │
│  ─────────────────────────────────────────────────────────────────────────────   │
│  ░░░░ Sube el CSV de participantes sin errores bloqueantes primero ░░░░░░░░░░░░░░   │
│  (área deshabilitada)                                                               │
│                                                                                     │
│                              [Volver]        [Ir a generar →] (deshabilitado)       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Notas:
- El error bloqueante (columna faltante) va en rojo con fondo claro.
- Las advertencias de fila van en amarillo — no bloquean si el error bloqueante se resuelve.
- La tabla preview se muestra aunque haya errores, para que el admin pueda ver los datos.
- El botón "Ir a generar →" permanece deshabilitado mientras haya errores bloqueantes.
- El área de fotos se deshabilita si el CSV tiene errores bloqueantes (no tiene sentido cargar fotos sin saber el nombre de cada archivo).

---

## 6. /admin/generations — Dashboard / lista de generaciones

Estado: con generaciones en múltiples estados.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] Panel de Diplomas                                [Admin]  [Cerrar sesión]    │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│               │  Generaciones                              [+ Nueva generación]      │
│  Generaciones │  ─────────────────────────────────────────────────────────────────  │
│  Certificados │                                                                     │
│               │  ┌──────────────────────────────────────────────────────────────┐  │
│               │  │ Diplomado Liderazgo Q1 2026        ●Procesando    87/150      │  │
│               │  │ Creada el 3 de mayo de 2026        ████████████░░░░ 58%       │  │
│               │  │                                          [Ver progreso]        │  │
│               │  ├──────────────────────────────────────────────────────────────┤  │
│               │  │ Diplomado Finanzas 2025            ●Completada    150/150     │  │
│               │  │ Creada el 12 de enero de 2026                                 │  │
│               │  │                                          [Descargar ZIP]      │  │
│               │  ├──────────────────────────────────────────────────────────────┤  │
│               │  │ Certificados TI 2026               ●Completada con errores   │  │
│               │  │ Creada el 28 de marzo de 2026       140 generados, 10 no generados│
│               │  │                                          [Descargar ZIP]      │  │
│               │  ├──────────────────────────────────────────────────────────────┤  │
│               │  │ Prueba Enero (sin usar)            ○Borrador                  │  │
│               │  │ Creada el 2 de enero de 2026                                  │  │
│               │  │                                     [Continuar configuración] │  │
│               │  └──────────────────────────────────────────────────────────────┘  │
│               │                                                                     │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

Notas:
- El chip "Procesando" pulsa suavemente (animación CSS). Los demás chips son estáticos.
- La barra de progreso mini solo aparece en generaciones en estado Procesando.
- Cada fila es clickeable y lleva al detalle de la generación.
- El botón de acción por fila es el CTA más relevante para ese estado.
- "Completada con errores" usa el color naranja en el chip, no verde.
- Los badges de estado usan texto completo, no abreviaturas.

---

## 7. /admin/certificates/:folio — Detalle de certificado (estado: revocado)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] Panel de Diplomas                                [Admin]  [Cerrar sesión]    │
├───────────────┬─────────────────────────────────────────────────────────────────────┤
│               │  ← Buscar certificados  /  SEN-2026-042                            │
│  Generaciones │  ──────────────────────────────────────────────────────────────   │
│  Certificados │                                                                     │
│               │   Estado:  ● Revocado                                              │
│               │                                                                     │
│               │   ┌───────────────────────────────────────────┬──────────────────┐ │
│               │   │  Participante: María Fernanda González     │                  │ │
│               │   │  Folio:        SEN-2026-042                │  [thumbnail PNG  │ │
│               │   │  Programa:     Liderazgo Organizacional    │   del diploma]   │ │
│               │   │  Emitido:      15 de enero de 2026         │                  │ │
│               │   │  Generación: Diplomado Liderazgo Q1 2026 [→]│                 │ │
│               │   │                                            │                  │ │
│               │   │  ───────────────────────────────────────── │                  │ │
│               │   │  Revocado el:  3 de mayo de 2026           │                  │ │
│               │   │  Motivo:       Diploma emitido por error.  │                  │ │
│               │   │                El participante no completó │                  │ │
│               │   │                el programa.                │                  │ │
│               │   └───────────────────────────────────────────┴──────────────────┘ │
│               │                                                                     │
│               │   [ Reactivar diploma ]                                             │
│               │                                                                     │
└───────────────┴─────────────────────────────────────────────────────────────────────┘
```

Notas:
- El botón "Reactivar diploma" es el único CTA cuando el estado es Revocado. No hay botón de revocar.
- La fecha y motivo de revocación siempre se muestran para referencia del admin.
- El thumbnail del diploma es el PNG generado (el diploma con los datos reales, no la plantilla vacía).
- El enlace a la generación permite navegar al contexto de generación.

---

## 8. Modal de confirmación de revocación

Se superpone sobre el detalle del certificado. El fondo queda oscurecido (overlay semitransparente).

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  (fondo oscurecido — detalle del certificado visible detrás)                        │
│                                                                                     │
│            ┌─────────────────────────────────────────────────────┐                 │
│            │                                                     │                 │
│            │  ¿Revocar este diploma?                             │                 │
│            │                                                     │                 │
│            │  María Fernanda González de la Vega                 │                 │
│            │  Folio: SEN-2026-042                                │                 │
│            │                                                     │                 │
│            │  ⚠ Al revocar, la página pública dejará de          │                 │
│            │    mostrarse como válido en la página pública.      │                 │
│            │                                                     │                 │
│            │  Motivo de revocación *                             │                 │
│            │  ┌───────────────────────────────────────────────┐  │                 │
│            │  │                                               │  │                 │
│            │  │  (campo de texto, obligatorio, máx 200 car.)  │  │                 │
│            │  │                                               │  │                 │
│            │  └───────────────────────────────────────────────┘  │                 │
│            │  0 / 200 caracteres                                  │                 │
│            │                                                     │                 │
│            │  [Cancelar]              [Revocar diploma]          │                 │
│            │               (el botón derecho está deshabilitado  │                 │
│            │                hasta ingresar el motivo)            │                 │
│            └─────────────────────────────────────────────────────┘                 │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Notas:
- El campo de motivo es obligatorio — el botón "Revocar diploma" permanece deshabilitado hasta que tenga al menos un carácter.
- El contador de caracteres (0 / 200) se actualiza en tiempo real.
- "Cancelar" cierra el modal sin cambios. Puede ser también la tecla Escape.
- Al confirmar con éxito: el modal se cierra, el estado en el detalle cambia, aparece toast de confirmación.
- El botón "Revocar diploma" es de color rojo para comunicar la irreversibilidad (aunque puede reactivarse).

---

## 9. /admin/login — Login

```
┌──────────────────────────────────────┐
│              [Logo Seneto]           │
│                                      │
│    Sistema de Diplomas Digitales     │
│                                      │
│    Email                             │
│    [________________________]        │
│                                      │
│    Contraseña                        │
│    [________________________]  [👁]  │
│                                      │
│    [      Iniciar sesión      ]      │
│                                      │
│  ─ Mensaje de error (si aplica) ─    │
│  ✕ Email o contraseña incorrectos.   │
│                                      │
│  ─ Sesión expirada (si redirigido) ─ │
│  ℹ Tu sesión expiró. Inicia sesión   │
│    de nuevo para continuar.          │
└──────────────────────────────────────┘

Notas:
- Sin opción de registro (un solo admin en MVP)
- Sin "¿Olvidaste tu contraseña?" en MVP
- Después de login exitoso: redirect a /admin/generations
- Si viene de sesión expirada: redirect a la URL original
```

---

## 10. /admin/generations — Sin generaciones (estado vacío)

```
┌──────────────────────────────────────────────────────┐
│ Seneto Diplomas      [admin@seneto.com ▾] [Cerrar sesión] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Generaciones                    [+ Nueva generación]│
│  ─────────────────────────────────────────────────── │
│                                                      │
│              [📋 icono ilustración]                  │
│                                                      │
│        Aún no hay generaciones registradas.          │
│    Crea tu primera generación para empezar a         │
│          generar diplomas.                           │
│                                                      │
│              [ + Nueva generación ]                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 11. /admin/generations/new — Nueva generación

```
┌──────────────────────────────────────────────────────┐
│ ← Volver a generaciones                              │
│                                                      │
│  Nueva generación                                    │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  Nombre de la generación *                           │
│  [Ej: Diplomado Liderazgo Q1 2026          ]        │
│                                                      │
│  Prefijo de folio *                                  │
│  [SEN           ] — Folios: SEN-2026-001, SEN-2026-002... │
│                                                      │
│  Año del folio *          Número inicial *           │
│  [2026          ]         [1              ]          │
│                                                      │
│  Vista previa de folio: SEN-2026-001                 │
│                                                      │
│  ─────────────────────────────────────────────────── │
│              [ Cancelar ]  [ Crear generación → ]    │
└──────────────────────────────────────────────────────┘

Notas:
- "Nombre de la generación" es el único campo realmente crítico
- Prefijo y año tienen valor por defecto (SEN / año actual / 1)
- La vista previa de folio se actualiza en tiempo real
```

---

## 12. /admin/generations/:id/template — Sin plantilla aún

```
┌──────────────────────────────────────────────────────┐
│ ← Generación: Diplomado Liderazgo Q1 2026            │
│  Paso 1 de 4 — Plantilla                             │
│  ────────────────────────────────────────────────    │
│                                                      │
│  Sube la plantilla PNG del diploma                   │
│  Esta imagen será la base sobre la que se           │
│  agregarán los datos de cada participante.          │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │                                                │  │
│  │   [📄]  Arrastra el archivo aquí              │  │
│  │         o  [ Seleccionar archivo ]            │  │
│  │                                                │  │
│  │   PNG o JPG · Máximo 50 MB                    │  │
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ─ Errores posibles ─                               │
│  ✕ El archivo supera los 50 MB. Usa una imagen más pequeña. │
│  ✕ Formato no compatible. Usa PNG o JPG.             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 13. /admin/generations/:id/students — Fotos cargadas con faltantes

```
┌──────────────────────────────────────────────────────┐
│ ← Diplomado Liderazgo Q1 2026  │  Paso 3 de 4 — Fotos │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ✓ CSV cargado: 150 participantes                   │
│                                                      │
│  Fotos de participantes                              │
│  ──────────────────────────────────────────────────  │
│  ✓ 140 fotos coinciden con participantes del CSV    │
│                                                      │
│  ⚠ 10 participantes no tienen foto cargada          │
│  ┌──────────────────────────────────────────────┐    │
│  │ • Juan Pérez García (juan_perez.jpg)         │    │
│  │ • María González López (maria_gonzalez.jpg)  │    │
│  │ • ... ver todos (10)                         │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ℹ Las fotos deben llamarse igual que el campo      │
│    "archivo_foto" en tu CSV.                        │
│                                                      │
│  [ Subir ZIP con fotos corregidas ]                 │
│                                                      │
│  ─────────────────────────────────────────────────── │
│   [ ← Volver ]     [ Ir a validación → ] ← deshabilitado │
│                     si hay faltantes                 │
└──────────────────────────────────────────────────────┘

Notas:
- El botón "Ir a validación" se habilita solo cuando 0 participantes sin foto,
  O cuando el admin activa la opción "Continuar omitiendo participantes sin foto"
- Si el admin elige continuar con faltantes, aparece un banner de confirmación antes
```

---

## 14. /admin/generations/:id/students — Validación pre-vuelo: lista para generar

```
┌──────────────────────────────────────────────────────┐
│ ← Diplomado Liderazgo Q1 2026  │  Paso 4 de 4 — Validar │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Resumen antes de generar                            │
│  ──────────────────────────────────────────────────  │
│  ✓ Plantilla: diploma_liderazgo_2026.png            │
│  ✓ Zonas configuradas: Nombre, Foto, QR, Folio      │
│  ✓ Participantes: 150 cargados desde CSV            │
│  ✓ Fotos: 150 de 150 cargadas                       │
│  ✓ Folios listos: SEN-2026-001 → SEN-2026-150       │
│                                                      │
│  ⚠ 3 participantes tienen nombres largos            │
│    Se ajustará la fuente (28pt en lugar de 36pt).   │
│    [ Ver lista ]                                    │
│                                                      │
│  ─────────────────────────────────────────────────── │
│  Vista previa con datos reales:                     │
│  [ Ver preview del primer diploma ]                 │
│                                                      │
│  ─────────────────────────────────────────────────── │
│  [ ← Volver ]          [ 🎓 Generar diplomas → ]   │
└──────────────────────────────────────────────────────┘
```

---

## 15. /admin/certificates — Búsqueda de certificados

```
┌──────────────────────────────────────────────────────┐
│ Seneto Diplomas      [admin@seneto.com ▾] [Cerrar sesión] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Certificados                                        │
│  ──────────────────────────────────────────────────  │
│  🔍 [Busca por nombre o folio (ej. SEN-2026-001)   ] │
│                                                      │
│  ┌────────────┬──────────────┬────────────┬────────┐  │
│  │ Participante│ Folio        │ Generación │ Estado │  │
│  ├────────────┼──────────────┼────────────┼────────┤  │
│  │ Juan Pérez │ SEN-2026-001 │ Lideraz... │ ✓ Válido│ │
│  │ María Glez │ SEN-2026-002 │ Lideraz... │ ✕ Revocado│
│  │ Carlos R.  │ SEN-2026-003 │ Lideraz... │ ✓ Válido│ │
│  └────────────┴──────────────┴────────────┴────────┘  │
│                                                      │
│  Mostrando 3 de 150 resultados                      │
│                                                      │
└──────────────────────────────────────────────────────┘

Notas:
- Búsqueda en tiempo real a partir de 2 caracteres
- El badge de estado usa icono + texto + color (no solo color)
- Clic en cualquier fila abre /admin/certificates/:folio
```

---

## 16. /v/:folio — Error del servidor (500 / fallback)

```
┌──────────────────────────────┐
│     [Logo Seneto]            │
│                              │
│   ⚠                         │
│   No pudimos verificar       │
│   este diploma en            │
│   este momento.              │
│                              │
│   Intenta de nuevo en        │
│   unos minutos.              │
│                              │
│   Si el problema persiste,   │
│   contacta a Seneto.        │
│                              │
│   [Intentar de nuevo]       │
│                              │
│   seneto.com                 │
└──────────────────────────────┘

Notas:
- Este estado NO implica que el diploma sea inválido
- El copy debe evitar alarmar al verificador
- Botón "Intentar de nuevo" hace refresh de la página
- No mostrar detalles técnicos del error
```
