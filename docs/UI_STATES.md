# UI_STATES — Sistema de Diplomas Digitales Seneto

Todos los estados posibles de cada pantalla. Frontend debe implementar cada estado — ninguno es opcional.

---

## Estados globales del sistema admin

### Estado: Sesión expirada
**Aplica a:** Todas las rutas /admin/*
**Cuándo ocurre:** El token JWT expiró mientras el admin tenía la sesión abierta (flujos largos de generación o inactividad)
**Comportamiento:**
- Next.js middleware detecta la sesión inválida
- Redirige automáticamente a /admin/login
- La página de login muestra un mensaje contextual: "Tu sesión expiró. Inicia sesión de nuevo para continuar."
- Después de iniciar sesión, redirige de vuelta a la ruta que el admin intentaba acceder

### Estado: No autenticado
**Aplica a:** Todas las rutas /admin/* excepto /admin/login
**Cuándo ocurre:** El admin accede a una ruta protegida sin sesión activa
**Comportamiento:**
- Middleware redirige a /admin/login
- La URL de destino se preserva como query param: /admin/login?callbackUrl=/admin/generations
- No se muestra ningún contenido de la ruta protegida

### Estado: Cargando sesión
**Aplica a:** Primera carga de cualquier ruta /admin/*
**Comportamiento:**
- Skeleton loader de la pantalla (no flash de contenido sin autenticar)
- Duración esperada: < 300ms

---

## /admin/login — Login

### Estado: inicial
Formulario en blanco con dos campos (Email, Contraseña) y botón "Entrar" deshabilitado. Sin mensajes de error.

### Estado: campos incompletos
El botón "Entrar" permanece deshabilitado mientras alguno de los dos campos esté vacío. No hay validación inline hasta que se intenta enviar.

### Estado: cargando (enviando credenciales)
El botón muestra spinner y texto "Entrando…". Ambos campos quedan deshabilitados. Sin timeout visible.

### Estado: error de credenciales
El botón vuelve a su estado normal. Aparece un mensaje debajo del formulario: "Email o contraseña incorrectos." Los campos no se limpian — el admin puede editar sin reescribir.

### Estado: bloqueado por intentos
Botón deshabilitado. Mensaje: "Demasiados intentos fallidos. Espera 10 minutos antes de intentarlo de nuevo." Se muestra tiempo restante si es posible.

**[Recomendación de seguridad — Pendiente de confirmar con Backend si se implementa en MVP. Si no, este estado es post-MVP.]**

### Estado: error de red
Mensaje: "No se pudo conectar. Verifica tu conexión a internet." El botón vuelve a estar habilitado para reintentar.

---

## /admin/generations — Lista de generaciones

### Estado: vacío (primera vez)
Pantalla sin tabla. Ilustración simple (diploma o documento). Texto: "Aún no has creado ninguna generación." Botón prominente: "Crear primera generación".

### Estado: cargando
Skeleton loaders en lugar de las filas de la tabla. La barra lateral y el header están presentes normalmente.

### Estado: con datos
Tabla con una fila por generación. Columnas: Nombre, Fecha de creación, Estado (chip de color), Diplomas, Acción. El estado "Procesando" tiene una barra de progreso mini y el chip pulsa suavemente. Botón "Nueva generación" en esquina superior derecha siempre visible.

### Estado: error de carga
La tabla no carga. Mensaje centrado: "No se pudo cargar la lista de generaciones." Botón: "[Reintentar]".

---

## /admin/generations/new — Nueva generación

### Estado: formulario vacío
Campos en blanco con valores por defecto (prefijo SEN, año actual, contador 1). Vista previa del folio actualizada en tiempo real debajo del formulario. Botones "Cancelar" y "Crear generación" (deshabilitado hasta que el nombre esté lleno).

### Estado: con datos y sin errores
Todos los campos tienen valor válido. Vista previa del folio muestra el formato completo: "SEN-2026-001, SEN-2026-002, …". El botón "Crear generación" está habilitado.

### Estado: con errores de validación
Campos con error muestran borde rojo y mensaje inline debajo del campo. El botón "Crear generación" permanece deshabilitado.

### Estado: cargando (creando)
El botón muestra spinner y texto "Creando generación…". Todos los campos deshabilitados.

### Estado: error de API
El botón vuelve a estar activo. Aparece un toast de error: "No se pudo crear la generación. Intenta de nuevo."

---

## /admin/generations/:id — Detalle de generación (overview)

Esta pantalla actúa como hub de la generación. Muestra el estado general y los pasos completados.

### Estado: Borrador — configuración incompleta
Muestra una lista de pasos tipo checklist:
- [ ] Plantilla configurada
- [ ] Zonas definidas (Nombre, Foto, QR, Folio)
- [ ] CSV de participantes subido
- [ ] Fotos subidas

Botón "Continuar" lleva al primer paso incompleto.

### Estado: Borrador — listo para generar
Todos los pasos tienen check. Resumen de participantes (total, con foto, sin foto). Botón "Ir a generar" en estado habilitado.

### Estado: Procesando
Barra de progreso grande con porcentaje. Contador "X de Y completados". Lista scrollable de errores en tiempo real. Botón "Ver progreso detallado" lleva a `/admin/generations/:id/generate`. El botón de generar no aparece (proceso en curso).

### Estado: Completada sin errores
Chip "Completada" en verde. Texto: "X diplomas generados correctamente." Botón principal "Descargar ZIP". Enlace secundario "Ver certificados de esta generación".

### Estado: Completada con errores parciales
Chip "Completada con errores" en naranja.
Texto: "X diplomas generados. Y con error." Botón "Descargar ZIP (X diplomas)" y botón secundario "Descargar CSV de errores".

### Estado: Fallida (0 diplomas generados)
Chip "Fallida" en rojo. Texto explicando el fallo (ej: "La generación falló al iniciar. Revisa la configuración de zonas y vuelve a intentarlo."). Botón "Intentar generar de nuevo".

### Estado: Generación no encontrada
**Cuándo ocurre:** El ID en la URL no corresponde a ninguna generación en la base de datos
**Comportamiento:**
- HTTP 404
- Mensaje: "No se encontró esta generación."
- Descripción secundaria: "Es posible que haya sido eliminada o que el enlace sea incorrecto."
- Botón principal: "Volver a generaciones"

### Estado: cargando
Skeleton de la pantalla completa.

---

## /admin/generations/:id/template — ZoneEditor

### Estado: sin plantilla subida
Panel derecho muestra un área de drop con instrucciones. Panel izquierdo muestra la lista de zonas con todas en estado "Sin configurar" y deshabilitadas (no se pueden editar hasta tener plantilla).

### Estado: subiendo plantilla
Barra de progreso de subida en el panel derecho. Los controles del panel izquierdo están deshabilitados.

### Estado: plantilla cargada, zonas sin configurar
Panel derecho: imagen del diploma sin overlays.
Panel izquierdo: lista de zonas, todas en estado "Sin configurar" (chips grises). Texto de ayuda: "Arrastra las zonas sobre la plantilla para posicionarlas. Usa los campos numéricos para ajuste fino."

### Estado: zona seleccionada (editando)
Panel izquierdo: el formulario de edición de la zona seleccionada está expandido con todos sus inputs. Panel derecho: el rectángulo de esa zona tiene borde azul y es visualmente distinguible de las demás. El resto de zonas tienen borde gris semitransparente. Los handles de redimensión (esquinas y bordes) están visibles en la zona seleccionada.

### Estado: zona siendo arrastrada (drag en curso)
El cursor cambia a "move" sobre el interior del rectángulo seleccionado, o a "resize" sobre los handles de esquina. Mientras el admin arrastra, el rectángulo sigue al cursor en tiempo real sobre la imagen. Los campos numéricos (x, y, ancho, alto) en el panel izquierdo se actualizan en tiempo real. Al soltar, el sistema registra las coordenadas finales como cambio pendiente de guardar.

### Estado: zonas obligatorias completas, sin cambios pendientes
El botón de guardar está en estado "Sin cambios" (gris). Las 4 zonas obligatorias (Nombre, Foto, QR, Folio) tienen chip verde. El botón "Continuar" está habilitado.

### Estado: con cambios sin guardar
El botón "Guardar cambios" está en estado activo (azul). Si el admin intenta navegar, se muestra modal de confirmación de salida.

### Estado: advertencia de solapamiento
Un banner amarillo de advertencia aparece sobre la lista de zonas: "La zona Nombre y la zona Folio se superponen." El botón guardar sigue funcionando — es solo un warning.

### Estado: error al guardar
Toast de error: "No se pudieron guardar las zonas. Intenta de nuevo." Los cambios en pantalla no se pierden.

### Estado: preview de nombre activo
En el formulario de la zona Nombre, el campo "Nombre de prueba" tiene texto ingresado. En el panel derecho, el texto simulado aparece dentro del rectángulo con la fuente EB Garamond al tamaño configurado. Si se reduce automáticamente, un aviso inline muestra: "Este nombre se renderiza a [Xpt]. El mínimo es [Ypt]."

---

## /admin/generations/:id/students — CSV + fotos

### Estado: vacío (sin CSV ni fotos)
Dos secciones apiladas verticalmente:
1. CSV: área de drop con enlace "Descargar plantilla CSV de ejemplo".
2. Fotos: área de drop deshabilitada con texto "Sube el CSV primero".

### Estado: subiendo CSV
Spinner en la sección de CSV. Texto: "Procesando CSV…"

### Estado: CSV cargado sin errores
Tabla preview de las primeras 5 filas. Resumen: "X participantes cargados." Sección de fotos habilitada.

### Estado: CSV cargado con errores bloqueantes
Tabla preview si hay filas válidas. Lista de errores por encima de la tabla con fondo rojo claro: "No se puede continuar. Corrige estos errores y sube el CSV de nuevo." Sección de fotos deshabilitada hasta que el CSV sea resubido sin errores bloqueantes.

### Estado: CSV con advertencias (no bloqueantes)
Tabla preview. Sección amarilla con lista de advertencias: "X filas tienen problemas pero puedes continuar. Estas filas no están listas para generar. Corrige el CSV o confirma que deseas omitir estos participantes. Los participantes omitidos no estarán en el ZIP final." Sección de fotos habilitada.

### Estado: subiendo ZIP de fotos
Barra de progreso de extracción.
Texto: "Procesando fotos…"

### Estado: fotos cargadas, con coincidencias
Lista dividida en tres grupos: participantes con foto (verde), participantes sin foto (naranja), fotos sin participante (azul informativo). Resumen: "X de Y participantes tienen foto."

### Estado: validación pre-vuelo — participantes sin foto (bloqueante)
Panel de validación con fondo rojo claro. Mensaje: "X participantes no tienen foto. Sube el ZIP de fotos o corrige los nombres de los archivos antes de generar."

El botón "Generar diplomas" está **deshabilitado** por defecto.

Para continuar sin ellas, el admin debe usar la acción explícita secundaria:
> "Generar solo participantes válidos (omitir X sin foto)"

Esa acción abre un modal de confirmación:
> "Se generarán N diplomas. X participantes serán omitidos porque no tienen foto. Esta acción no se puede deshacer. ¿Continuar?"

Con botones "Cancelar" y "Confirmar y generar". Solo después de confirmar se habilita la generación parcial.

### Estado: validación pre-vuelo — con errores bloqueantes
Panel de validación al fondo de la pantalla con fondo rojo claro. Lista de errores bloqueantes. Botón "Ir a generar" deshabilitado con tooltip explicativo.

### Estado: validación pre-vuelo — lista para generar
Panel verde: "Todo listo para generar." Puede incluir advertencias de participantes con campos opcionales vacíos. Botón "Ir a generar" habilitado.



---

## /admin/generations/:id/generate — Progreso de generación

### Estado: confirmación previa
Pantalla de revisión antes de lanzar. Muestra resumen de la generación, aviso de que el proceso continúa en servidor, y los botones "Volver a revisar" / "Generar diplomas".

### Estado: generando (en progreso)
Barra de progreso animada con porcentaje. Contador "X de Y completados." Estimación de tiempo restante. Lista scrollable de errores en tiempo real.

Aviso: "Puedes dejar esta pantalla abierta para ver el progreso en tiempo real. Si la cierras, el proceso continuará en el servidor y podrás volver después para ver el resultado."

### Estado: generando — sin errores hasta el momento
La lista de errores en tiempo real está vacía o tiene texto placeholder: "Los errores aparecerán aquí si ocurren."

### Estado: generando — con errores en curso
La lista de errores muestra filas con: nombre del participante, tipo de error, descripción breve. Los contadores reflejan: "X completados, Y con error, Z pendientes."

### Estado: completada sin errores
Barra de progreso al 100% en verde. Texto: "¡Listo! X diplomas generados correctamente." Botón "Descargar ZIP" en estado principal.

### Estado: completada con errores parciales
Barra en amarillo o naranja. Texto: "X diplomas generados. Y con error." Dos botones: "Descargar ZIP (X diplomas)" y "Descargar CSV de errores". Aviso sobre cómo manejar los fallidos.

### Estado: fallo total
Barra en rojo. Texto: "La generación falló antes de completarse. No se generó ningún diploma." Botón "Volver a revisar configuración".

### Estado: cargando el estado (al retornar a la pantalla)
Skeleton mientras se carga el estado actual vía polling.

### Estado: Preparando ZIP
El proceso de generación terminó, el servidor está comprimiendo los PDFs.
Muestra: spinner + "Preparando archivo para descarga…"

### Estado: ZIP listo
Muestra: botón prominente "Descargar ZIP (N diplomas)" con el nombre de archivo completo visible.
Nombre de archivo: `seneto_{slug}_{N}_diplomas.zip`

### Estado: ZIP no disponible
**Cuándo:** la generación falló completamente (0 diplomas exitosos).
Muestra: "No hay diplomas disponibles para descargar. Revisa los errores y genera de nuevo."

### Estado: Error al descargar
**Cuándo:** el archivo existe pero falla la descarga.
Muestra: "No se pudo descargar el archivo. Intenta de nuevo." + botón de reintentar.

---

## /admin/certificates — Búsqueda de certificados

### Estado: inicial (sin búsqueda)
Campo de búsqueda vacío. Texto de ayuda debajo: "Busca por nombre del participante o folio (ej: SEN-2026-001)." Sin tabla visible.

### Estado: buscando
El campo tiene texto. Spinner pequeño al lado del input mientras el debounce ejecuta la consulta.

### Estado: resultados encontrados
Tabla con columnas: Folio, Nombre, Programa, Fecha, Estado (chip de color), Generación. Filas clickeables.

### Estado: sin resultados
Tabla vacía o mensaje: "No se encontró ningún diploma con ese criterio."

### Estado: más de 50 resultados
Tabla con 50 filas y banner informativo en la parte inferior: "Mostrando los primeros 50 resultados. Refina la búsqueda para ver menos."

### Estado: error de búsqueda
Mensaje: "No se pudo completar la búsqueda. Intenta de nuevo." Botón de reintento.

---

## /admin/certificates/:folio — Detalle de certificado

### Estado: cargando
Skeleton del layout de detalle.

### Estado: activo
Etiqueta verde "Activo". Todos los datos del diploma visibles (nombre, folio, programa, fecha, generación, thumbnail PNG). Botón "Revocar diploma" visible.

### Estado: revocado
Etiqueta roja "Revocado". Todos los datos visibles. Sección adicional: "Fecha de revocación: [fecha]" y "Motivo: [texto]". Botón "Reactivar diploma" visible.

### Estado: expirado
Etiqueta naranja "Expirado". Todos los datos visibles. Sin botones de acción. Nota informativa: "Este diploma ha expirado. No es posible reactivarlo."

**[Estado reservado — La lógica de expiración automática no está implementada en MVP. El estado puede asignarse manualmente via PATCH /api/certificates/:folio. Mantener el estado de UI definido para cuando se implemente.]**

### Estado: modal de revocación abierto
El botón "Revocar diploma" lanzó el modal. El fondo queda oscurecido. Ver wireframe y copy específicos.

### Estado: modal de reactivación abierto
El botón "Reactivar diploma" lanzó el modal de confirmación simple. El fondo queda oscurecido.

### Estado: no encontrado
Si el folio no existe en la base de datos, la página muestra: "No se encontró ningún certificado con el folio [folio]."
Enlace de regreso: "Volver a la búsqueda".

---

## /v/:folio — Página pública de verificación

Esta página es mobile-first. Los estados son exclusivos entre sí — solo uno se muestra.

### Estado: activo

- Badge verde con ícono de check: "Diploma válido"
- Foto del participante (circular o con border-radius)
- Nombre del participante (tipografía prominente)
- Programa
- Fecha de emisión (formateada: "15 de enero de 2026")
- Folio: SEN-2026-001
- Institución: Seneto
- Texto institucional breve
- Logo de Seneto en el header

### Estado: revocado
- Badge rojo con ícono X: "Este diploma ha sido revocado"
- NO se muestra foto ni nombre del participante
- NO se muestra programa ni fecha
- Solo se muestra: "Este diploma fue emitido por Seneto pero ha sido revocado. Para más información, contacta a Seneto."
- Folio visible (para referencia de contacto)
- Logo de Seneto en el header

### Estado: expirado
- Badge naranja con ícono de reloj: "Este diploma ha expirado"
- Nombre del participante visible
- Fecha de emisión visible
- Nota: "Este diploma fue válido pero su vigencia ha expirado."
- Logo de Seneto en el header
- NO se muestra la foto del participante

**[Estado reservado — La lógica de expiración automática no está implementada en MVP. El estado puede asignarse manualmente via PATCH /api/certificates/:folio. Mantener el estado de UI definido para cuando se implemente.]**

### Estado: not_found (folio no existe)
- HTTP 404
- Ícono de documento con interrogación
- Texto principal: "Este código no corresponde a ningún diploma emitido por Seneto."
- Texto secundario: "Verifica que el código sea correcto o contacta a Seneto si crees que es un error."
- Logo de Seneto en el header
- Sin datos de ningún tipo

### Estado: cargando (SSR — no debería verse en condiciones normales)
La página se renderiza en el servidor antes de enviarse. En condiciones degradadas puede mostrarse un skeleton muy simple.

### Estado: error del servidor (500)
Página genérica de error: "Ocurrió un error al verificar este diploma. Intenta de nuevo en unos momentos."

---

## Reglas de accesibilidad — aplicables a todas las pantallas

1. **No depender solo del color para comunicar estados.** Usar siempre icono + texto + color. Ejemplo: no solo un chip verde, sino "✓ Válido" en verde.

2. **Estados disabled deben ser visualmente claros.** Botones deshabilitados con opacidad reducida y cursor `not-allowed`. Agregar tooltip que explique por qué está deshabilitado.

3. **Modales cierran con Escape.** Todos los modales de confirmación deben poder cerrarse con la tecla Escape, además del botón de cancelar.

4. **ZoneEditor: navegación por teclado en inputs y acciones principales.** Las coordenadas numéricas y los botones de guardar/cancelar deben ser navegables por teclado. El drag & drop visual no requiere soporte de teclado en MVP.

5. **Contraste suficiente.** Chips de estado (verde/rojo/amarillo) deben cumplir WCAG AA (4.5:1 para texto). No usar solo saturación — combinar con texto y forma.

6. **Mensajes de error descriptivos.** Nunca solo "Error". Siempre: qué falló + qué puede hacer el usuario.
