# USER_FLOWS — Sistema de Diplomas Digitales Seneto

Flujo completo del administrador. Para cada paso: qué hace el admin, qué muestra el sistema, validaciones, errores posibles, recuperación y siguiente paso.

---

## Índice

1. [Login](#1-login)
2. [Dashboard / lista de generaciones](#2-dashboard--lista-de-generaciones)
3. [Crear generación](#3-crear-generación)
4. [Subir plantilla PNG](#4-subir-plantilla-png)
5. [Configurar zonas (ZoneEditor)](#5-configurar-zonas-zoneeditor)
6. [Subir CSV de participantes](#6-subir-csv-de-participantes)
7. [Subir ZIP de fotos](#7-subir-zip-de-fotos)
8. [Validación pre-vuelo](#8-validación-pre-vuelo)
9. [Generar diplomas](#9-generar-diplomas)
10. [Generación con errores parciales](#10-generación-con-errores-parciales)
11. [Descargar ZIP](#11-descargar-zip)
12. [Buscar certificados](#12-buscar-certificados)
13. [Detalle de certificado](#13-detalle-de-certificado)
14. [Revocar certificado](#14-revocar-certificado)
15. [Reactivar certificado](#15-reactivar-certificado)

---

## 1. Login

**Ruta:** `/admin/login`
**Objetivo:** El administrador se autentica para acceder al panel de gestión de generaciones.

### Qué hace el usuario
Navega a `/admin/login`. Ingresa su email y contraseña. Presiona "Entrar".

### Qué muestra el sistema
- Formulario con dos campos: Email y Contraseña.
- Botón "Entrar" deshabilitado si algún campo está vacío.
- Logo de Seneto en la parte superior.
- Sin enlace de registro (no existe en MVP).

### Validaciones
- Ambos campos deben estar completos para habilitar el botón "Entrar".
- Las credenciales se verifican contra la tabla `users` de la base de datos.

> ⚠ **Recomendación de seguridad (pendiente de confirmar con Backend para MVP):** bloquear el formulario temporalmente después de 5 intentos fallidos en 10 minutos. Si no está implementado en MVP, documentarlo como post-MVP.

### Errores posibles
- **Credenciales incorrectas:** mensaje inline debajo del formulario — "Email o contraseña incorrectos." (no se especifica cuál para no revelar información). El formulario no se limpia; el admin puede corregir sin reescribir todo.
- **Servidor no disponible:** "No se pudo conectar. Verifica tu conexión a internet."

### Recuperación
No hay flujo de "olvidé mi contraseña" en MVP. El admin debe contactar al administrador del sistema para restablecer sus credenciales.

### Siguiente paso
Si las credenciales son correctas, el sistema redirige a `/admin/generations` (Dashboard).

---

## 2. Dashboard / lista de generaciones

**Ruta:** `/admin/generations`
**Objetivo:** El administrador ve el estado de todas sus generaciones y accede a las acciones disponibles por cada una.

### Qué hace el usuario
Llega al dashboard después del login o presionando el logo de Seneto desde cualquier sección del panel.

### Qué muestra el sistema

**Primera vez (sin generaciones):**
Estado vacío con ilustración o icono, texto "Aún no has creado ninguna generación" y botón principal "Crear primera generación" que lleva a `/admin/generations/new`.

**Con generaciones:**
Lista en orden cronológico descendente (más reciente primero). Cada fila muestra:
- Nombre de la generación.
- Fecha de creación.
- Estado con etiqueta de color:
  - Borrador — gris
  - Procesando — azul pulsante
  - Completada — verde
  - Fallida — rojo
- Para estado Completada: "X diplomas generados" (o "X generados, Y con error" si hubo errores parciales).
- Para estado Procesando: barra de progreso compacta con porcentaje.
- Botón de acción principal por estado:
  - Borrador → "Continuar configuración"
  - Procesando → "Ver progreso" (solo lectura durante el proceso)
  - Completada → "Descargar ZIP"
  - Fallida → "Ver errores"

Botón "Nueva generación" siempre visible en la esquina superior derecha.

### Validaciones
Ninguna. La pantalla es de solo lectura.

### Errores posibles
- **Error al cargar la lista:** "No se pudo cargar la lista de generaciones. [Reintentar]"

### Recuperación
Presionar "Reintentar" para volver a solicitar la lista de generaciones.

### Siguiente paso
- Presionar "Nueva generación" → flujo 3 (Crear generación).
- Presionar "Continuar configuración" en una generación en Borrador → flujo 4 (Subir plantilla PNG), o al paso donde se quedó.
- Presionar "Descargar ZIP" en una generación Completada → flujo 11 (Descargar ZIP).

---

## 3. Crear generación

**Ruta:** `/admin/generations/new`
**Objetivo:** El administrador define los parámetros de la nueva generación antes de subir plantilla o participantes.

### Qué hace el usuario
Presiona "Nueva generación" desde el dashboard. Completa el formulario y presiona "Crear generación".

### Qué muestra el sistema
Formulario con los siguientes campos:

| Campo | Tipo | Requerido | Valor por defecto | Reglas |
|-------|------|-----------|-------------------|--------|
| Nombre de la generación | Texto | Sí | — | Máx. 100 caracteres. Ej: "Diplomado Liderazgo Q1 2026" |
| Prefijo de folio | Texto | Sí | SEN | 2–5 caracteres, solo letras mayúsculas |
| Año del folio | Número | Sí | Año actual | 4 dígitos, 2020–2099 |
| Número inicial del contador | Número | Sí | 1 | Entero positivo ≥ 1 |

Debajo del formulario, vista previa del folio: "Los folios serán: SEN-2026-001, SEN-2026-002, ..."

Botones: "Cancelar" (vuelve al dashboard) y "Crear generación".

### Validaciones
- Nombre vacío → mensaje inline: "El nombre de la generación es obligatorio."
- Prefijo con caracteres inválidos → "Solo se permiten letras mayúsculas (ej: SEN)."
- Contador no numérico → "Debe ser un número entero mayor a 0."
- Las validaciones se ejecutan en tiempo real mientras el admin escribe.

### Errores posibles
- **Error de red al crear:** "No se pudo crear la generación. Intenta de nuevo."

### Recuperación
Si hay error de red, el formulario mantiene los datos ingresados. El admin puede presionar "Crear generación" nuevamente.

### Siguiente paso
Si el formulario es válido, el sistema crea la generación en estado Borrador y redirige a `/admin/generations/:id/template` (flujo 4). La generación queda en Borrador hasta completar todos los pasos; el admin puede cerrar y retomar desde el dashboard.

---

## 4. Subir plantilla PNG

**Ruta:** `/admin/generations/:id/template`
**Objetivo:** El administrador sube la imagen base del diploma (sin datos del participante) que servirá como fondo para la generación.

### Qué hace el usuario
Ve un área de carga de archivo. Arrastra el PNG de la plantilla o presiona para seleccionar desde el explorador de archivos.

### Qué muestra el sistema
- Área de carga con instrucciones ("Arrastra aquí el PNG de tu plantilla o haz clic para buscar").
- Durante la carga: barra de progreso con porcentaje y texto "Subiendo plantilla… X MB de Y MB". El área de carga queda bloqueada mientras se sube.
- Al completarse: la imagen se muestra en el panel del ZoneEditor. Las dimensiones detectadas aparecen debajo: "Plantilla: 2480 × 3508 px".
- Si ya existía una plantilla en esta generación: modal de confirmación "¿Reemplazar la plantilla actual? Las zonas configuradas se reiniciarán." Con botones "Reemplazar" y "Cancelar".

### Validaciones
Antes de iniciar la subida:
- Formatos aceptados: PNG, JPG.
- Tamaño máximo: 50 MB.

### Errores posibles
- **Formato no compatible:** "Este formato no es compatible. Sube un archivo PNG o JPG." (no se inicia la subida).
- **Archivo supera 50 MB:** "El archivo pesa más de 50 MB. Exporta la plantilla en menor resolución o recorta el canvas." (no se inicia la subida).
- **Subida interrumpida:** "La subida falló. El archivo no se guardó. Intenta de nuevo."
- **Error del servidor:** "No se pudo procesar la imagen. Asegúrate de que el archivo no esté dañado."

### Recuperación
En todos los casos de error, el área de carga vuelve al estado inicial. El admin puede intentar subir el archivo nuevamente o seleccionar otro archivo.

### Siguiente paso
La plantilla subida activa el ZoneEditor (flujo 5). El sistema permanece en la misma ruta `/admin/generations/:id/template` y muestra el editor sobre la plantilla cargada.

---

## 5. Configurar zonas (ZoneEditor)

**Ruta:** `/admin/generations/:id/template`
**Objetivo:** El administrador posiciona visualmente las zonas sobre la plantilla para indicar dónde se renderizará cada dato del diploma.

### Qué hace el usuario
- Ve la plantilla PNG cargada como fondo en el panel derecho del editor.
- En el panel izquierdo, ve la lista de zonas disponibles con su estado (Configurada / Sin configurar).
- Hace clic en una zona de la lista para seleccionarla.
- Arrastra la zona sobre la imagen para reposicionarla.
- Redimensiona la zona arrastrando sus esquinas o bordes.
- Para la zona de Nombre: escribe un nombre de prueba corto y uno largo en el campo "Nombre de prueba" para verificar que el texto cabe.
- Cuando está conforme con la posición de todas las zonas, presiona "Guardar zonas".

### Qué muestra el sistema
- La plantilla PNG como fondo a escala en el panel derecho.
- Rectángulos semitransparentes con etiqueta sobre cada zona configurada (ej. "Nombre", "Foto", "QR", "Folio").
- La zona seleccionada resaltada con borde azul y handles de redimensión en las esquinas y bordes.
- Las demás zonas con borde gris.
- Preview en tiempo real:
  - El nombre de prueba renderizado en la zona de Nombre, con la fuente EB Garamond. Si el texto necesita reducirse, aparece un aviso: "Este nombre requiere reducir la fuente a 30pt. El mínimo configurado es 28pt — cabe." Si el texto no cabe ni a 28pt: "Este nombre no cabe en la zona. Agranda la zona o acorta el nombre."
  - Imagen placeholder en la zona de Foto.
  - QR genérico en la zona de QR.
- Las coordenadas x/y/ancho/alto de la zona seleccionada se actualizan en tiempo real en el panel izquierdo (modo avanzado para ajuste fino).
- Indicador "Cambios sin guardar" en la barra superior si hay modificaciones no guardadas.
- Advertencia si dos zonas se superponen en más del 10% de su área: "⚠ La zona [A] y la zona [B] se superponen. Los diplomas podrían quedar con texto encima de texto."

**Panel izquierdo — lista de zonas disponibles:**

| Zona | Obligatoria | Campos configurables |
|------|-------------|---------------------|
| Nombre | Sí | x, y, ancho, alto, tamaño de fuente (36pt base), tamaño mínimo (28pt), color, alineación |
| Foto | Sí | x, y, ancho, alto |
| QR | Sí | x, y, tamaño (cuadrado) |
| Folio | Sí | x, y, ancho, alto, tamaño de fuente, color, alineación |
| Fecha | No | x, y, ancho, alto, tamaño de fuente, color, alineación |
| Programa | No | x, y, ancho, alto, tamaño de fuente, color, alineación |

**Zonas obligatorias:** Nombre, Foto, QR y Folio. Las cuatro deben estar configuradas para poder avanzar al siguiente paso.

### Validaciones
- El botón "Continuar" (hacia Subir CSV) permanece deshabilitado con tooltip hasta que las cuatro zonas obligatorias (Nombre, Foto, QR, Folio) estén configuradas: "Configura las zonas obligatorias: Nombre, Foto, QR y Folio antes de continuar."
- La advertencia de superposición no bloquea el guardado — el admin puede guardar con zonas superpuestas, pero la advertencia persiste hasta corregirlo.

### Errores posibles
- **Error al guardar zonas:** "No se pudieron guardar las zonas. Intenta de nuevo." Los cambios en pantalla no se pierden.
- **Dos zonas superpuestas:** advertencia visual (no bloqueante) que persiste hasta resolverse.

### Recuperación
- Si el guardado falla, el admin puede intentar de nuevo sin perder los cambios en pantalla.
- Si el admin intenta navegar a otra sección con cambios sin guardar, un modal pregunta: "Tienes cambios sin guardar en el editor de zonas. ¿Salir de todas formas?" — Botones: "Salir sin guardar" y "Quedarse y guardar".

### Siguiente paso
Cuando las cuatro zonas obligatorias están configuradas y guardadas, el admin presiona "Continuar" para ir a `/admin/generations/:id/students` (flujo 6).

---

## 6. Subir CSV de participantes

**Ruta:** `/admin/generations/:id/students`
**Objetivo:** El administrador carga la lista de participantes que recibirán diploma en esta generación.

### Qué hace el usuario
- Opcionalmente descarga la plantilla de ejemplo presionando "Descargar plantilla CSV de ejemplo".
- Arrastra el archivo CSV o lo selecciona desde el explorador.

### Qué muestra el sistema
- Enlace "Descargar plantilla CSV de ejemplo" en la parte superior. El archivo se llama `plantilla_participantes.csv` y contiene encabezados + 2 filas de ejemplo con datos ficticios.
- Área de carga del CSV.

**Columnas del CSV:**

| Columna | Requerida | Descripción |
|---------|-----------|-------------|
| student_name | Sí | Nombre completo del participante |
| email | No | Email del participante |
| program | No | Nombre del programa o diplomado |
| issued_date | Sí | Fecha de emisión (formato: YYYY-MM-DD) |
| archivo_foto | Sí | Nombre del archivo de foto incluyendo extensión (ej: juan_perez.jpg) |
| folio_override | No | Si se especifica, sobreescribe el folio autogenerado (ej: SEN-2026-099) |

**Después de subir el CSV, el sistema muestra:**
1. Resumen de parsing: "Se encontraron X participantes en el archivo."
2. Tabla preview de las primeras 5 filas (nombre, programa, fecha, archivo_foto, folio si aplica).
3. Errores de columnas faltantes (si los hay).
4. Errores de datos por fila (si los hay).

### Validaciones
**Errores bloqueantes (deshabilitan "Continuar"):**

| Error | Mensaje |
|-------|---------|
| Columna obligatoria faltante | "Falta la columna `[nombre]`. Revisa que el encabezado esté exactamente así en tu CSV." |
| CSV vacío (solo encabezados) | "El archivo no contiene datos de participantes. Agrega al menos una fila de datos." |
| Archivo no es CSV | "El archivo no es un CSV válido. Asegúrate de guardarlo en formato CSV desde Excel u otro programa." |

**Errores por fila (no bloquean, pero se marcan en la generación):**

| Error | Mensaje |
|-------|---------|
| Fecha en formato incorrecto | "Fila [N]: La fecha '[valor]' no tiene el formato correcto. Usa YYYY-MM-DD (ej: 2026-03-15)." |
| student_name vacío | "Fila [N]: El nombre del participante está vacío. Todas las filas deben tener un nombre." |
| archivo_foto vacío | "Fila [N]: El campo `archivo_foto` está vacío. Escribe el nombre del archivo de foto de este participante." |
| folio_override duplicado | "Fila [N]: El folio '[valor]' ya existe en este CSV. Los folios deben ser únicos." |

### Errores posibles
- **Error de red al subir el CSV:** "No se pudo procesar el archivo. Intenta de nuevo."

### Recuperación
- Si hay errores bloqueantes: el admin debe corregir el archivo externo y volver a subirlo.
- Si hay errores por fila: el admin puede continuar con advertencias; los participantes con error se marcarán como fallidos en la generación.

### Siguiente paso
Cuando el CSV está subido sin errores bloqueantes, el sistema habilita la sección de subida de fotos (flujo 7), visible más abajo en la misma pantalla.

---

## 7. Subir ZIP de fotos

**Ruta:** `/admin/generations/:id/students` (sección inferior, después del CSV)
**Objetivo:** El administrador carga las fotos de los participantes para que el sistema las coloque en cada diploma.

### Qué hace el usuario
Arrastra el archivo ZIP con las fotos o lo selecciona desde el explorador.

### Qué muestra el sistema

**Convención de nombres:** las fotos dentro del ZIP deben tener exactamente el mismo nombre que el valor en la columna `archivo_foto` del CSV. El sistema no hace coincidencia aproximada. Las fotos deben estar en la raíz del ZIP (no en subcarpetas).

**Después de procesar el ZIP:**
1. Total de fotos encontradas: "Se encontraron X fotos en el ZIP."
2. Estado de coincidencia:
   - Lista de participantes que SÍ tienen foto (check verde).
   - Lista de participantes que NO tienen foto (icono naranja): "Sin foto: [nombre], [nombre], ..."
   - Lista de fotos en el ZIP que no corresponden a ningún participante del CSV (icono informativo azul): "Fotos no usadas: archivo1.jpg, archivo2.jpg"
3. Resumen: "X de Y participantes tienen foto cargada."

### Validaciones
- El área de subida de fotos está deshabilitada si el CSV no ha sido subido previamente, con texto: "Sube el CSV de participantes primero."
- Formatos aceptados: JPG, PNG, WEBP.
- Tamaño máximo por foto: 10 MB.

### Errores posibles
- **ZIP con archivos en subcarpetas:** "Las fotos deben estar en la raíz del ZIP, no dentro de carpetas. [Ver cómo hacerlo]"
- **ZIP vacío:** "El ZIP no contiene ningún archivo de imagen."
- **Error de red al subir:** "No se pudo procesar el ZIP. Intenta de nuevo."

### Recuperación
El admin puede subir un nuevo ZIP en cualquier momento; el sistema reemplaza las fotos anteriores y recalcula las coincidencias.

### Siguiente paso
Después de procesar el ZIP, el sistema actualiza el resumen de validación pre-vuelo visible al final de la pantalla (flujo 8).

---

## 8. Validación pre-vuelo

**Ruta:** `/admin/generations/:id/students` (parte inferior, o como modal al intentar avanzar a generar)
**Objetivo:** El sistema verifica que todo está en orden antes de habilitar la generación, para evitar errores sorpresa durante el proceso.

### Qué hace el usuario
Revisa el resumen de validación. Si hay errores bloqueantes, los corrige. Si solo hay advertencias, las confirma y avanza.

### Qué muestra el sistema
Resumen de verificación automática con los siguientes ítems:

**Errores bloqueantes (impiden generar):**

| Condición | Mensaje |
|-----------|---------|
| Plantilla no subida | "No hay plantilla configurada para esta generación." |
| Zonas obligatorias sin configurar | "Faltan zonas obligatorias: [lista]. Configúralas en el editor de zonas." |
| CSV no subido | "No se ha subido el CSV de participantes." |
| CSV sin participantes | "El CSV no contiene participantes." |
| Participantes sin foto | "X participantes no tienen foto. Sube el ZIP de fotos o corrige los nombres de los archivos antes de generar." — el botón "Generar diplomas" está deshabilitado. Si el admin desea continuar omitiendo a quienes no tienen foto, debe usar la acción explícita descrita abajo. |

**Errores bloqueantes individuales (impiden generar ese participante específico):**

| Condición | Mensaje |
|-----------|---------|
| Nombre que no cabe ni a 28pt | "Error: el nombre de [participante] no cabe en la zona de nombre incluso al tamaño mínimo (28pt). Agranda la zona o abrevia el nombre." — ese participante no puede generar. |

**Advertencias (permiten generar con confirmación):**

| Condición | Mensaje |
|-----------|---------|
| Nombre que cabe a 28pt pero no a 36pt | "Advertencia: el nombre de [participante] requiere reducir la fuente a [N]pt. El diploma se generará con fuente reducida." |
| Campos opcionales vacíos | "X participantes no tienen programa o fecha registrados." |
| Folios duplicados con folio_override | "Hay folios duplicados en el CSV. Revisa la columna folio_override." |

**Estado del botón "Generar diplomas":**
- Errores bloqueantes presentes → botón deshabilitado + tooltip describiendo qué falta.
- Solo advertencias → botón activo + banner amarillo listando las advertencias.
- Todo correcto → botón activo + indicador verde "Listo para generar".

**Acción para continuar con participantes sin foto (escape explícito):**
Si el admin quiere generar solo los participantes que sí tienen foto, debe presionar el botón secundario:
> "Generar solo participantes válidos (omitir X sin foto)"

Esto abre un modal de confirmación:
> "Se generarán N diplomas. X participantes serán omitidos porque no tienen foto. Esta acción no se puede deshacer. ¿Continuar?"

Con botones "Cancelar" y "Confirmar y generar". Solo después de confirmar se habilita la generación parcial.

### Validaciones
Ver tabla de errores bloqueantes y advertencias arriba.

### Errores posibles
- **Error al ejecutar la validación:** "No se pudo verificar el estado de la generación. Intenta de nuevo."

### Recuperación
- Para errores bloqueantes: corregir el problema (subir fotos, ajustar zonas, corregir CSV) y la validación se actualiza automáticamente.
- Para advertencias: el admin puede continuar o regresar a corregir.

### Siguiente paso
Si no hay errores bloqueantes, el admin presiona "Generar diplomas" y avanza a `/admin/generations/:id/generate` (flujo 9).

---

## 9. Generar diplomas

**Ruta:** `/admin/generations/:id/generate`
**Objetivo:** El administrador lanza la generación y monitorea el progreso en tiempo real.

### Qué hace el usuario
Llega a la pantalla de confirmación, revisa el resumen y presiona "Generar diplomas". Luego monitorea el progreso.

### Qué muestra el sistema

**Pantalla de confirmación (antes de iniciar):**
Página completa de revisión que muestra:
- Nombre de la generación.
- Thumbnail de la plantilla asignada.
- Total de participantes: X.
- Participantes con foto: X.
- Participantes que serán omitidos (sin foto, si el admin confirmó el escape): X.
- Ejemplo de folios: SEN-2026-001 … SEN-2026-0XX.

Aviso prominente:
> "Una vez iniciada la generación, no podrás editar la plantilla ni los participantes de esta generación. El proceso continuará aunque cierres esta ventana."

Botones: "Volver a revisar" y "Generar diplomas".

**Vista de progreso (después de presionar "Generar diplomas"):**
- Barra de progreso: "X de Y diplomas completados" (actualizada cada 2 segundos por polling).
- Porcentaje numérico visible.
- Tiempo estimado restante (calculado a partir de la velocidad promedio actual).
- Animación de actividad que confirma que el proceso está corriendo.
- Lista deslizable de errores en tiempo real: si un diploma falla, aparece con el nombre del participante y el tipo de error.
- Contadores en vivo: "87 completados, 3 con error, 60 pendientes."
- Aviso: "No es necesario mantener esta pestaña abierta. El proceso continuará aunque cierres esta ventana."

**Si un diploma individual falla:**
- El sistema registra el error en `GenerationError`.
- Continúa con el siguiente participante sin detener el proceso.
- El diploma fallido no se incluye en el ZIP final.
- El error aparece en la lista de progreso en tiempo real.

### Validaciones
La generación no se puede iniciar si hay errores bloqueantes pendientes (el sistema redirige de vuelta a la validación pre-vuelo si el admin llega a esta ruta con errores sin resolver).

### Errores posibles
- **El proceso falla completamente (0 diplomas generados):** La generación pasa a estado Fallida. El sistema muestra: "La generación falló. No se generó ningún diploma. Revisa los errores y vuelve a intentarlo." Con botón "Ver errores detallados".
- **Errores parciales (algunos diplomas fallan):** Ver flujo 10.

### Recuperación
- Si el proceso falla completamente: el admin puede revisar los errores, corregir los archivos y reiniciar el proceso (desde el dashboard, estado Fallida → "Ver errores").
- En MVP no hay reintento individual de diplomas fallidos.

### Siguiente paso
- Si todos los diplomas se generaron correctamente: pantalla de generación completada con botón "Descargar ZIP" (flujo 11).
- Si hubo errores parciales: pantalla de generación con errores parciales (flujo 10).

---

## 10. Generación con errores parciales

**Ruta:** `/admin/generations/:id/generate`
**Objetivo:** Informar al administrador sobre los diplomas que fallaron y permitirle descargar los que sí se generaron.

### Qué hace el usuario
Revisa el resumen de errores, descarga el ZIP con los diplomas generados correctamente y, opcionalmente, descarga el CSV de errores para saber qué corregir.

### Qué muestra el sistema
Al terminar el proceso con errores parciales (ejemplo: 140 generados, 10 con error):

```
Generación completada con errores parciales

140 diplomas generados correctamente
10 diplomas con error

[Descargar ZIP (140 diplomas)]    [Descargar CSV de errores]
```

Aviso contextual:
> "Los 10 diplomas con error no están incluidos en el ZIP. Descarga el CSV de errores para ver qué falló en cada caso."

**CSV de errores:** al descargarlo, contiene las siguientes columnas por cada diploma fallido:

| Columna | Contenido |
|---------|-----------|
| fila_csv | Número de fila en el CSV original |
| student_name | Nombre del participante |
| error_type | `missing_photo`, `invalid_data`, o `render_error` |
| error_detail | Descripción específica del error |

Ejemplo de fila:
```
12,"Ana Sofía Martínez Ríos",missing_photo,"No se encontró el archivo 'ana_sofia.jpg' en el ZIP de fotos"
```

**Aviso sobre reintento:**
> "Para generar los diplomas con error, crea una nueva generación con solo esos participantes usando el CSV de errores como referencia."

No hay reintento individual en MVP.

### Validaciones
Ninguna en esta pantalla. Es solo lectura.

### Errores posibles
- **Error al descargar el ZIP:** ver flujo 11.
- **Error al descargar el CSV de errores:** "No se pudo descargar el reporte de errores. Intenta de nuevo."

### Recuperación
Reintentar la descarga.

### Siguiente paso
El admin puede ir al dashboard para ver el estado de la generación (estado Completada con indicador de errores) o crear una nueva generación para los participantes que fallaron.

---

## 11. Descargar ZIP

**Ruta:** `/admin/generations/:id/generate` o desde el dashboard
**Objetivo:** El administrador descarga el archivo ZIP con todos los diplomas generados en esta generación.

### Qué hace el usuario
Presiona "Descargar ZIP" desde la pantalla de generación completada o desde el dashboard (en generaciones con estado Completada).

### Qué muestra el sistema
- La descarga del archivo ZIP se inicia directamente en el navegador.
- Si el ZIP aún está en preparación (la compresión no terminó): botón deshabilitado con spinner y texto "Preparando ZIP…"

**Nombre del archivo ZIP:**
```
seneto_{nombre_generación_slug}_{N}_diplomas.zip
```

Donde:
- `nombre_generación_slug`: nombre de la generación en minúsculas, sin acentos, espacios reemplazados por guiones bajos.
- `N`: número de PDFs incluidos en el ZIP (excluye los que fallaron).
- Si N < total (hubo errores): el nombre refleja solo los incluidos, no el total.

Ejemplos:
- `seneto_diplomado_liderazgo_q1_2026_148_diplomas.zip`
- `seneto_marketing_digital_enero_2026_150_diplomas.zip`

### Validaciones
Ninguna. La descarga se inicia si el archivo existe en el servidor.

### Errores posibles
- **ZIP no disponible en servidor (archivo eliminado):** "El archivo ZIP ya no está disponible. Genera los diplomas nuevamente."
- **Error de red durante la descarga:** el navegador maneja el reintento de forma nativa.

### Recuperación
Si el ZIP no está disponible, el admin debe volver a generar los diplomas desde el dashboard.

### Siguiente paso
El admin regresa al dashboard para gestionar otras generaciones.

---

## 12. Buscar certificados

**Ruta:** `/admin/certificates`
**Objetivo:** El administrador localiza el certificado de un participante específico para consultar su estado o realizar acciones sobre él.

### Qué hace el usuario
Escribe en el campo de búsqueda el nombre del participante o el folio. Los resultados se filtran en tiempo real.

### Qué muestra el sistema

| Estado | Qué ve el administrador |
|--------|------------------------|
| **Vacío inicial** | Campo de búsqueda vacío + mensaje "Busca por nombre del participante o por folio (ej. SEN-2026-001)" |
| **Escribiendo** | Resultados se filtran en tiempo real a partir de 2 caracteres (debounce 300ms) |
| **Con resultados** | Lista de certificados con: Nombre, Folio, Programa, Fecha, Estado (badge de color), Generación. Máximo 50 resultados. Si hay más: "Se muestran los primeros 50 resultados. Refina la búsqueda para ver menos." |
| **Sin resultados** | "No se encontraron diplomas para '[término]'. Verifica el nombre o el folio." |
| **Error al buscar** | "No se pudo realizar la búsqueda. Intenta de nuevo." + botón "Reintentar" |

**Criterios de búsqueda:**
- Por nombre parcial del participante: coincidencia parcial en `student_name` (insensible a mayúsculas/minúsculas).
- Por folio exacto o parcial: ej. "SEN-2026" muestra todos los del año 2026.

### Validaciones
La búsqueda se activa a partir de 2 caracteres para evitar consultas demasiado amplias.

### Errores posibles
- **Error de conexión al buscar:** "No se pudo realizar la búsqueda. Intenta de nuevo."

### Recuperación
Presionar "Reintentar" para ejecutar la búsqueda nuevamente.

### Siguiente paso
Al hacer clic en un resultado, el admin navega al detalle del certificado (flujo 13).

---

## 13. Detalle de certificado

**Ruta:** `/admin/certificates/:folio`
**Objetivo:** El administrador consulta la información completa de un diploma emitido y puede actuar sobre él (revocar o reactivar).

### Qué hace el usuario
Llega desde la búsqueda de certificados o desde un enlace directo al folio. Revisa los datos y, si necesita, usa los botones de acción.

### Qué muestra el sistema
Información completa del diploma:
- Nombre del participante.
- Folio.
- Programa.
- Fecha de emisión.
- Estado (etiqueta de color).
- Generación de origen (con enlace a la generación).
- Thumbnail del diploma generado (PNG).

**Estados posibles:**

| Estado | Color de etiqueta | Información adicional |
|--------|------------------|-----------------------|
| Activo | Verde | — |
| Revocado | Rojo | "Última revocación: [fecha] — [motivo]" |
| Expirado | Naranja | — |

**Acciones disponibles por estado:**

| Estado del diploma | Acciones visibles |
|--------------------|------------------|
| Activo | Botón "Revocar diploma" |
| Revocado | Botón "Reactivar diploma" |
| Expirado | Sin acciones (solo lectura) |

### Validaciones
Ninguna en la vista. Las validaciones se aplican al ejecutar acciones (flujos 14 y 15).

### Errores posibles
- **Certificado no encontrado:** "No se encontró ningún diploma con el folio [folio]." Con botón "Volver a la búsqueda".
- **Error al cargar el detalle:** "No se pudo cargar la información del diploma. Intenta de nuevo."

### Recuperación
Regresar a la búsqueda y localizar el certificado nuevamente.

### Siguiente paso
- Si el diploma está Activo → flujo 14 (Revocar certificado).
- Si el diploma está Revocado → flujo 15 (Reactivar certificado).

---

## 14. Revocar certificado

**Ruta:** `/admin/certificates/:folio` (modal sobre el detalle)
**Objetivo:** El administrador quita la validez de un diploma activo, registrando la fecha y el motivo.

### Qué hace el usuario
Desde el detalle de un certificado activo, presiona "Revocar diploma". En el modal, escribe el motivo de la revocación y confirma.

### Qué muestra el sistema
Modal de confirmación con:
- Título: "¿Revocar este diploma?"
- Nombre del participante y folio como contexto.
- Campo de texto obligatorio: "Motivo de revocación" (máx. 200 caracteres).
- Aviso: "Al revocar el diploma, la página pública dejará de mostrar los datos del participante de inmediato."
- Botones: "Cancelar" y "Revocar diploma" (deshabilitado hasta que se ingrese el motivo).

**Al confirmar:**
- El sistema actualiza el registro: `status = revoked`, `revoked_at = [timestamp actual]`, `revocation_reason = [motivo ingresado]`.
- El modal se cierra.
- La etiqueta de estado cambia a "Revocado" en rojo.
- El detalle muestra: "Última revocación: [fecha] — [motivo]".
- Toast de confirmación: "Diploma revocado. La página pública refleja el cambio de inmediato."

### Validaciones
- El campo "Motivo de revocación" es obligatorio. No puede estar vacío.
- El botón "Revocar diploma" permanece deshabilitado hasta que haya texto en el campo.

### Errores posibles
- **Error de API al revocar:** "No se pudo revocar el diploma. Intenta de nuevo."

### Recuperación
Si hay error de API, el modal permanece abierto con los datos intactos. El admin puede intentar de nuevo.

### Siguiente paso
El admin regresa al detalle del certificado, ahora en estado Revocado, con la opción de reactivarlo (flujo 15).

---

## 15. Reactivar certificado

**Ruta:** `/admin/certificates/:folio` (modal sobre el detalle)
**Objetivo:** El administrador restaura la validez de un diploma revocado.

### Qué hace el usuario
Desde el detalle de un certificado revocado, presiona "Reactivar diploma". Confirma la acción en el modal.

### Qué muestra el sistema
Modal de confirmación con:
- Título: "¿Reactivar este diploma?"
- Nombre del participante y folio como contexto.
- Aviso: "Al reactivar el diploma, la página pública volverá a mostrarlo como válido."
- Sin campo de motivo (la reactivación no requiere justificación en MVP).
- Botones: "Cancelar" y "Reactivar diploma".

**Al confirmar:**
- El sistema actualiza el registro: `status = active`, `revoked_at` se limpia, `revocation_reason` se limpia.
- El modal se cierra.
- La etiqueta de estado cambia a "Activo" en verde.
- El campo "Última revocación" desaparece del detalle (los datos se limpiaron del registro).
- Toast: "Diploma reactivado. La página pública lo muestra como válido."

**Nota para Frontend:** no existe historial de revocaciones anteriores en el modelo de datos del MVP. Al reactivar, `revoked_at` y `revocation_reason` se limpian del registro `Certificate`. No hay tabla de audit log que mostrar.

### Validaciones
Ninguna. El admin solo confirma la acción.

### Errores posibles
- **Error de API al reactivar:** "No se pudo reactivar el diploma. Intenta de nuevo."

### Recuperación
Si hay error de API, el modal permanece abierto. El admin puede intentar de nuevo.

### Siguiente paso
El admin regresa al detalle del certificado, ahora en estado Activo, con la opción de volver a revocarlo si fuera necesario.
