# COPY — Sistema de Diplomas Digitales Seneto

Todos los textos de la UI. Si un desarrollador tiene que inventar un texto, falta aquí.

Terminología consistente con UX_SPEC.md: Generación, Zona, Diploma/Certificado (ver spec), Plantilla, Folio, Revocar, Participante.

---

## Navegación y layout admin

### Sidebar — ítem de navegación
- `Generaciones`
- `Certificados`

### Header
- Nombre del admin logueado: solo mostrar email
- Botón de sesión: `Cerrar sesión`

### Breadcrumbs
- Inicio del panel: `Generaciones`
- Detalle de generación: `Generaciones / [Nombre de la generación]`
- Editor de zonas: `Generaciones / [Nombre] / Plantilla`
- Carga de participantes: `Generaciones / [Nombre] / Participantes`
- Generación: `Generaciones / [Nombre] / Generar`
- Lista de certificados: `Certificados`
- Detalle de certificado: `Certificados / [Folio]`

### Tooltip del botón "Continuar" cuando está deshabilitado (ZoneEditor)
`Configura las zonas obligatorias antes de continuar: Nombre, Foto, QR y Folio.`

---

## Login — /admin/login

### Labels y placeholders
- Label campo email: `Email`
- Placeholder campo email: `tu@seneto.com`
- Label campo contraseña: `Contraseña`
- Placeholder campo contraseña: (vacío, solo tipo password)
- Botón de envío: `Entrar`
- Botón en estado cargando: `Entrando…`

### Mensajes de error
- Credenciales incorrectas: `Email o contraseña incorrectos.`
- Demasiados intentos: `Demasiados intentos fallidos. Espera 10 minutos antes de intentarlo de nuevo.`
- Error de red: `No se pudo conectar. Verifica tu conexión a internet.`

### Sesión expirada
Mensaje contextual en /admin/login cuando se llega por redirección de sesión expirada:
`Tu sesión expiró. Inicia sesión de nuevo para continuar.`

Mensaje de error inline (si aplica):
`Tu sesión ya no es válida. Por seguridad, inicia sesión de nuevo.`

---

## Generaciones — Lista (/admin/generations)

### Header de sección
- Título de página: `Generaciones`
- Botón principal: `+ Nueva generación`

### Empty state (sin generaciones)
- Texto principal: `Aún no has creado ninguna generación.`
- Texto secundario: `Crea tu primera generación para comenzar a generar diplomas.`
- Botón: `Crear primera generación`

### Etiquetas de estado de generación
- `Borrador`
- `Procesando`
- `Completada`
- `Completada con errores`
- `Fallida`

### Información por fila de generación
- Generación procesando: `[X] / [Y] diplomas completados`
- Generación completada sin errores: `[X] diplomas generados`
- Generación completada con errores: `[X] generados · [Y] con error`
- Generación fallida: `No se generó ningún diploma`

### Botones de acción por estado
- Borrador: `Continuar configuración`
- Procesando: `Ver progreso`
- Completada: `Descargar ZIP`
- Completada con errores: `Descargar ZIP`
- Fallida: `Ver errores`

### Error al cargar lista
- `No se pudo cargar la lista de generaciones.`
- Botón inline: `Reintentar`

---

## Generaciones — Crear (/admin/generations/new)

### Header
- Título: `Nueva generación`

### Formulario
- Label nombre: `Nombre de la generación`
- Placeholder nombre: `Ej: Diplomado Liderazgo Q1 2026`
- Helper text nombre: `Máximo 100 caracteres.`
- Label prefijo: `Prefijo de folio`
- Placeholder prefijo: `SEN`
- Helper text prefijo: `2–5 letras mayúsculas. Se usará en todos los folios de esta generación.`
- Label año: `Año del folio`
- Placeholder año: (año actual como valor, ej: `2026`)
- Label contador: `Número inicial del contador`
- Placeholder contador: `1`
- Helper text contador: `El primer diploma tendrá este número. Útil si continúas una secuencia existente.`

### Vista previa del folio
- Texto: `Los folios de esta generación serán:`
- Ejemplo: `SEN-2026-001, SEN-2026-002, SEN-2026-003, …`

### Botones
- Cancelar: `Cancelar`
- Crear: `Crear generación`
- Crear cargando: `Creando generación…`

### Errores de validación
- Nombre vacío: `El nombre de la generación es obligatorio.`
- Prefijo inválido: `El prefijo solo puede contener letras mayúsculas (ej: SEN).`
- Prefijo demasiado corto: `El prefijo debe tener al menos 2 letras.`
- Prefijo demasiado largo: `El prefijo no puede tener más de 5 letras.`
- Año inválido: `Ingresa un año válido (ej: 2026).`
- Contador no numérico: `Debe ser un número entero mayor a 0.`

### Error de API al crear
- Toast: `No se pudo crear la generación. Intenta de nuevo.`

---

## Generaciones — Detalle / overview (/admin/generations/:id)

### Checklist de pasos (estado Borrador)
- Título sección: `Pasos de configuración`
- Paso 1: `Plantilla configurada`
- Paso 2: `Zonas definidas (Nombre, Foto, QR y Folio)`
- Paso 3: `CSV de participantes subido`
- Paso 4: `Fotos subidas`
- Botón cuando hay pasos incompletos: `Continuar configuración`
- Botón cuando todo está listo: `Ir a generar`

### Resumen antes de generar
- Total de participantes: `[X] participantes en el CSV`
- Participantes con foto: `[X] con foto cargada`
- Participantes sin foto: `[X] participantes no tienen foto cargada. Sube sus fotos antes de generar o elige omitirlos.`

### Estado Completada sin errores
- Texto: `[X] diplomas generados correctamente.`
- Botón: `Descargar ZIP`
- Enlace secundario: `Ver certificados de esta generación`

### Estado Completada con errores
- Texto: `[X] diplomas generados. [Y] con error.`

### Estado Procesando
- Texto debajo de la barra: `[X] completados · [Y] con error · [Z] pendientes`

### Estado Fallida
- Texto: `La generación falló antes de completarse. No se generó ningún diploma.`
- Helper: `Revisa la configuración de zonas y los datos de participantes antes de intentar de nuevo.`
- Botón: `Intentar generar de nuevo`

---

## ZoneEditor — Labels, hints y errores (/admin/generations/:id/template)

### Sección de subida de plantilla (cuando no hay plantilla)
- Texto del área de drop: `Arrastra el PNG del diploma aquí`
- Texto secundario: `o haz clic para seleccionar un archivo`
- Formatos aceptados: `PNG, JPG · Máximo 50 MB`

### Durante la subida de plantilla
- Texto: `Subiendo plantilla… [X] MB de [Y] MB`

### Plantilla cargada exitosamente
- Texto informativo: `Plantilla: [ancho] × [alto] px`
- Texto de escala: `Escala de vista: 1:[N]`

### Errores de subida de plantilla
- Formato inválido: `Este formato no es compatible. Sube un archivo PNG o JPG.`
- Tamaño excedido: `El archivo pesa más de 50 MB. Exporta el diploma en menor resolución o recorta el canvas.`
- Subida interrumpida: `La subida falló. El archivo no se guardó. Intenta de nuevo.`
- Archivo dañado: `No se pudo procesar la imagen. Asegúrate de que el archivo no esté dañado.`

### Modal de reemplazo de plantilla
- Título: `¿Reemplazar la plantilla actual?`
- Descripción: `Las zonas configuradas se reiniciarán si reemplazas la plantilla.`
- Botón cancelar: `Cancelar`
- Botón confirmar: `Reemplazar`

### Banner de instrucciones inicial (primera configuración de zonas)
- Texto principal: `Configura las zonas obligatorias: Nombre, Foto, QR y Folio.`
- Texto secundario: `Arrastra las zonas sobre la plantilla para posicionarlas. Redimensiónalas desde las esquinas. Las zonas de Fecha y Programa son opcionales.`

### Ayuda para uso de campos numéricos
- `Usa los campos numéricos para ajuste fino o para ingresar una posición exacta. Los valores se actualizan automáticamente al arrastrar las zonas.`

### Lista de zonas — estados
- Zona configurada: `✓ [Nombre de zona]`
- Zona sin configurar: `○ [Nombre de zona]`
- Badge obligatoria: `Obligatoria`

### Nombres de zonas en la UI
- `Nombre`
- `Foto`
- `QR`
- `Folio`
- `Fecha`
- `Programa`

### Formulario de edición de zona (campos)
- Label X: `X (píxeles desde la izquierda)`
- Label Y: `Y (píxeles desde arriba)`
- Label ancho: `Ancho`
- Label alto: `Alto`
- Label tamaño fuente: `Tamaño de fuente (pt)`
- Label tamaño mínimo: `Tamaño mínimo (pt)`
- Helper tamaño mínimo: `Si el nombre no cabe, se reducirá automáticamente hasta este tamaño.`
- Label color: `Color de texto`
- Label alineación: `Alineación`
- Opciones alineación: `Izquierda`, `Centro`, `Derecha`
- Label tamaño QR: `Tamaño (píxeles, cuadrado)`

### Campo de preview de nombre
- Label: `Nombre de prueba`
- Placeholder: `Ej: María Fernanda González de la Vega`
- Helper: `Ingresa un nombre largo para verificar que cabe en la zona configurada.`

### Mensajes de preview de nombre
- Nombre cabe sin reducción: `Este nombre cabe a [X]pt.`
- Nombre requiere reducción (dentro del mínimo): `Este nombre se renderiza a [X]pt. El mínimo configurado es [Y]pt — cabe.`
- Nombre no cabe ni en mínimo: `⚠ Este nombre no cabe ni en [Y]pt (el mínimo). Amplía la zona o reduce el tamaño mínimo.`

### Advertencia de solapamiento entre zonas
- `⚠ La zona [Nombre A] y la zona [Nombre B] se superponen. Los diplomas podrían quedar con elementos encima de otros.`

### Botón de guardar
- Sin cambios (deshabilitado): `Sin cambios`
- Con cambios (activo): `Guardar cambios`
- Guardando: `Guardando…`

### Modal de salida sin guardar
- Título: `Tienes cambios sin guardar`
- Descripción: `¿Salir del editor de zonas sin guardar los cambios?`
- Botón secundario: `Salir sin guardar`
- Botón principal: `Quedarse y guardar`

### Toast de éxito al guardar
- `Zonas guardadas.`

### Error al guardar
- Toast: `No se pudieron guardar las zonas. Intenta de nuevo.`

---

## Carga de participantes — CSV y fotos (/admin/generations/:id/students)

### Header de sección
- Título: `Cargar participantes`

### Sección CSV
- Subtítulo: `CSV de participantes`
- Enlace de descarga: `Descargar plantilla CSV de ejemplo`
- Texto del área de drop: `Arrastra el archivo CSV aquí`
- Texto secundario: `o haz clic para seleccionar`
- Formatos: `CSV · Máximo 5 MB`

### Después de subir CSV exitosamente
- Texto resumen: `[X] participantes cargados.`
- Botón si se quiere cambiar: `Subir nuevo CSV`

### Errores de CSV — bloqueantes (en rojo)
- Título del bloque de error: `Error — No se puede continuar`
- Columna faltante: `Falta la columna obligatoria: [nombre]. Agrega esta columna al CSV y vuelve a subir.`
- Enlace dentro del error: `Descargar plantilla CSV de ejemplo`
- CSV vacío: `El archivo no contiene datos de participantes. Agrega al menos una fila.`
- Archivo no válido: `El archivo no es un CSV válido. Asegúrate de guardarlo en formato CSV desde Excel u otro programa.`

### Advertencias de CSV por fila (en amarillo)
- Título del bloque: `Advertencias en filas individuales ([N])`
- Fecha inválida: `Fila [N]: La fecha '[valor]' no tiene el formato correcto. Usa YYYY-MM-DD (ej: 2026-03-15).`
- Nombre vacío: `Fila [N]: El campo student_name está vacío.`
- Archivo foto vacío: `Fila [N]: El campo archivo_foto está vacío.`
- Folio duplicado: `Fila [N]: El folio '[valor]' ya aparece en otra fila. Los folios deben ser únicos.`
- Mensaje de continuación: `Estas filas no están listas para generar. Puedes corregir el CSV y volver a subirlo, o continuar de todas formas.`

### Sección de fotos
- Subtítulo: `Fotos de participantes`
- Estado deshabilitado: `Sube el CSV de participantes primero.`
- Texto del área de drop (habilitada): `Arrastra el archivo ZIP con las fotos aquí`
- Texto secundario: `o haz clic para seleccionar`
- Formatos: `ZIP · Máximo 500 MB`
- Helper: `Las fotos deben estar en la raíz del ZIP y nombrarse igual que el campo archivo_foto del CSV.`

### Después de procesar el ZIP
- Texto resumen: `[X] de [Y] participantes tienen foto cargada.`
- Grupo con foto (verde): `Con foto ([X]):`
- Grupo sin foto (naranja): `Sin foto ([X]):`
- Grupo fotos sin participante (azul): `Fotos no usadas ([X]):`
- Texto bajo "sin foto": `[X] participantes no tienen foto cargada.`
- Texto bajo "fotos no usadas": `Estas fotos están en el ZIP pero no corresponden a ningún participante del CSV.`

### Errores de procesamiento del ZIP
- ZIP vacío: `El ZIP no contiene ningún archivo de imagen.`
- Fotos en subcarpetas: `Las fotos deben estar en la raíz del ZIP, no dentro de carpetas. Comprime solo los archivos de imagen directamente.`
- Error de descompresión: `No se pudo procesar el ZIP. Verifica que el archivo no esté dañado.`

---

## Validación pre-vuelo

### Panel de errores bloqueantes
- Título: `No es posible generar aún`
- Plantilla sin zonas: `La plantilla no tiene configuradas las zonas obligatorias (Nombre, Foto, QR y Folio).`
- Sin CSV: `No se ha cargado el CSV de participantes.`
- Sin participantes: `El CSV no contiene participantes.`
- Participantes sin foto (estado bloqueante, botón Generar deshabilitado): `[X] participantes no tienen foto cargada. Sube sus fotos antes de generar o elige omitirlos.`
- Botón de escape (acción secundaria): `Generar solo participantes listos (omitir [X] sin foto)`
- Acción sugerida: `Corrige los problemas y regresa a esta pantalla.`

### Modal de confirmación al usar el escape (generar sin todos los participantes)
- Título: `¿Generar sin todos los participantes?`
- Cuerpo: `Se generarán [N] diplomas. [X] participantes serán omitidos porque no tienen foto asociada. Los participantes omitidos no estarán en el ZIP final.`
- Botón confirmar: `Sí, generar [N] diplomas`
- Botón cancelar: `Cancelar — quiero subir las fotos`

### Panel de advertencias (no bloqueantes)
- Título: `Revisa antes de continuar`
- Sin foto: `[X] participantes no tienen foto cargada.`
- Nombre demasiado largo: `[X] participantes tienen nombres que podrían no caber a [Y]pt mínimo.`
- Pregunta de continuación: `¿Continuar de todas formas? Los participantes no listos no se incluirán en el ZIP final.`

### Panel listo para generar
- Texto: `Todo listo para generar [X] diplomas.`
- Advertencia adicional si hay participantes a omitir: `[X] participantes no se incluirán en la generación.`

---

## Generación — Confirmación, progreso y estados

### Pantalla de confirmación antes de generar
- Título: `¿Iniciar la generación de diplomas?`
- Subtítulo con nombre de generación: `Generación: [Nombre]`
- Estadísticas: `[X] participantes en total`
- Con foto: `[X] con foto cargada`
- No listos (omitidos): `[X] participantes no se incluirán en la generación`
- Aviso importante: `Una vez iniciada la generación, no podrás editar la plantilla ni los participantes de esta generación. El proceso continuará aunque cierres esta ventana.`
- Botón cancelar: `Volver a revisar`
- Botón confirmar: `Generar diplomas`

### Durante la generación
- Título: `Generando diplomas…`
- Contador: `[X] de [Y] diplomas completados`
- Estados del contador: `[X] completados · [Y] con error · [Z] pendientes`
- Estimación: `Tiempo estimado restante: ~[X] min [Y] seg`
- Aviso: `Puedes dejar esta pantalla abierta para ver el progreso en tiempo real. Si la cierras, la generación continuará en el servidor y podrás volver después para ver el resultado.`
- Título de la lista de errores: `Errores ([N])`
- Placeholder de errores vacíos: `Los errores aparecerán aquí si ocurren.`

### Errores en tiempo real durante la generación
- Formato de fila de error: `Fila [N]  [Nombre del participante]  [Descripción del error]`
- Descripción para missing_photo: `Foto faltante: '[archivo]' no encontrada en el ZIP de fotos.`
- Descripción para invalid_data: `Datos inválidos: [detalle específico].`
- Descripción para render_error: `No se pudo generar el diploma: [detalle específico].`

### Generación completada sin errores
- Título: `¡Listo! [X] diplomas generados correctamente.`
- Botón principal: `Descargar archivo ZIP`

### Generación completada con errores parciales
- Título: `Generación completada con errores parciales`
- Resumen: `[X] diplomas generados correctamente · [Y] con error`
- Aviso: `Los [Y] diplomas con error no están incluidos en el ZIP.`
- Botón primario: `Descargar archivo ZIP ([X] diplomas)`
- Botón secundario: `Descargar CSV de errores`
- Instrucción post-MVP: `Para regenerar los diplomas con error, crea una nueva generación con solo esos participantes usando el CSV de errores como referencia.`

### Nombre del archivo ZIP
`seneto_{nombre_generación_slug}_{N}_diplomas.zip`

### Generación fallida (0 diplomas)
- Título: `La generación falló`
- Descripción: `No se generó ningún diploma. Puede haber un problema de configuración o con los archivos.`
- Botón: `Volver a revisar configuración`

---

## Gestión de certificados — Búsqueda, detalle, revocar, reactivar

### Búsqueda (/admin/certificates)
- Título de página: `Certificados`
- Placeholder del campo de búsqueda: `Buscar por nombre del participante o por folio…`
- Helper text: `Busca por nombre parcial (ej: "González") o folio exacto (ej: "SEN-2026-042").`
- Empty state inicial: `Busca un diploma por nombre del participante o folio.`
- Sin resultados: `No se encontró ningún diploma con ese criterio.`
- Más de 50 resultados: `Mostrando los primeros 50 resultados. Refina la búsqueda para ver menos.`
- Error de búsqueda: `No se pudo completar la búsqueda. Intenta de nuevo.`

### Columnas de la tabla de resultados
- `Folio`
- `Participante`
- `Programa`
- `Fecha de emisión`
- `Estado`
- `Generación`

### Detalle de certificado (/admin/certificates/:folio)
- Título: `Detalle del certificado`
- Label participante: `Participante`
- Label folio: `Folio`
- Label programa: `Programa`
- Label fecha: `Fecha de emisión`
- Label generación: `Generación de origen`
- Label estado: `Estado`

### Sección de revocación (solo si estado = revocado)
- Label fecha revocación: `Revocado el`
- Label motivo: `Motivo de revocación`

### Botones de acción por estado
- Activo: `Revocar diploma`
- Revocado: `Reactivar diploma`
- Expirado: (ningún botón)

### Nota informativa para expirado
- `Este diploma ha expirado. No es posible modificar su estado.`

### Certificado no encontrado en admin
- `No se encontró ningún certificado con el folio [folio].`
- Enlace: `Volver a la búsqueda`

### Modal de revocación
- Título: `¿Revocar este diploma?`
- Contexto: `[Nombre del participante] · Folio: [folio]`
- Aviso: `Al revocar el diploma, la página pública dejará de mostrar los datos del participante de inmediato.`
- Label campo motivo: `Motivo de revocación`
- Placeholder motivo: `Describe el motivo de la revocación`
- Helper motivo: `Obligatorio · Máximo 200 caracteres`
- Botón cancelar: `Cancelar`
- Botón confirmar (deshabilitado hasta tener motivo): `Revocar diploma`
- Botón confirmando: `Revocando…`

### Modal de reactivación
- Título: `¿Reactivar este diploma?`
- Contexto: `[Nombre del participante] · Folio: [folio]`
- Aviso: `Al reactivar el diploma, la página pública volverá a mostrar el diploma como válido.`
- Botón cancelar: `Cancelar`
- Botón confirmar: `Reactivar diploma`
- Botón confirmando: `Reactivando…`

### Toasts de confirmación
- Revocación exitosa: `Diploma revocado. La página pública refleja el cambio de inmediato.`
- Reactivación exitosa: `Diploma reactivado. La página pública lo muestra como válido.`
- Error al revocar: `No se pudo revocar el diploma. Intenta de nuevo.`
- Error al reactivar: `No se pudo reactivar el diploma. Intenta de nuevo.`

---

## Página pública de verificación — /v/:folio

### Estado: activo

- Badge: `Diploma válido`
- Sección datos — Label institución: `Institución`
- Valor institución: `Seneto`
- Label fecha: `Emitido el`
- Formato de fecha: `15 de enero de 2026` (en español, sin abreviar)
- Label folio: `Folio`
- Texto institucional:
  `Este diploma fue emitido por Seneto y se encuentra registrado como válido en nuestros sistemas.`
- [Seneto debe validar el texto institucional definitivo antes de producción.]

### Estado: revocado

- Badge: `Este diploma ha sido revocado`
- Cuerpo del texto:
  `Este diploma fue emitido por Seneto pero ha sido revocado.`
- Texto de contacto:
  `Para más información, contacta a Seneto.`
- Label folio: `Folio`

### Estado: expirado

- Badge: `Este diploma ha expirado`
- Nota:
  `Este diploma fue válido pero su vigencia ha expirado. Puedes contactar a Seneto para más información.`
- Label fecha: `Emitido el`
- Label folio: `Folio`

### Estado: not_found

- Texto principal: `Este folio no corresponde a ningún diploma emitido por Seneto.`
- Texto secundario: `Verifica que el folio del diploma sea correcto o contacta a Seneto si crees que es un error.`

### Footer de la página pública
- Enlace: `seneto.com`
- Separador: `·`
- Enlace opcional: `Privacidad`

---

## Mensajes de error genéricos de la API

Estos se muestran cuando la causa específica no está disponible o no se puede comunicar al usuario.

| Código HTTP | Dónde se muestra | Texto |
|-------------|-----------------|-------|
| 401 | Admin intenta acceder a ruta protegida sin sesión | `Tu sesión ha expirado. Inicia sesión para continuar.` |
| 403 | Admin intenta acción no permitida | `No tienes permiso para realizar esta acción.` |
| 404 | Recurso no encontrado en admin | `No se encontró el recurso solicitado.` |
| 500 | Cualquier error inesperado del servidor | `Ocurrió un error inesperado. Intenta de nuevo en unos momentos. Si el problema persiste, contacta al administrador del sistema.` |
| Sin conexión | Cualquier llamada que falla por red | `No se pudo conectar. Verifica tu conexión a internet e intenta de nuevo.` |

---

## Empty states de cada sección

| Sección | Empty state |
|---------|-------------|
| Lista de generaciones | `Aún no has creado ninguna generación.` |
| Buscar certificados (sin término) | `Busca un diploma por nombre del participante o folio.` |
| Buscar certificados (sin resultados) | `No se encontró ningún diploma con ese criterio.` |
| Lista de errores durante generación | `Los errores aparecerán aquí si ocurren.` |
| Participantes sin foto (si todos tienen foto) | `Todos los participantes tienen foto cargada.` |
| Fotos sin participante (si no hay sobrantes) | `Todas las fotos corresponden a participantes del CSV.` |
