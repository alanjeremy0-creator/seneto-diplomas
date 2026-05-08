# UX_SPEC — Sistema de Diplomas Digitales Seneto

---

## 1. Principios de diseño

### P1. Los errores de configuración se detectan antes de generar, no durante
Un error descubierto en el diploma número 87 de 150 invalida la confianza en todo el proceso. El sistema debe exponer inconsistencias (foto faltante, zona mal configurada, columna CSV ausente) en cada paso antes de que el admin presione "Generar". Una vez iniciada la generación, los errores son inevitables; lo evitable es que sean sorpresa.

### P2. La zona de nombre es el campo más crítico — merece ayuda extra
El nombre del participante es lo único visible a primera vista en un diploma. Si está mal posicionado, truncado, o con tipografía incorrecta, el diploma es inutilizable. El ZoneEditor visual permite al admin arrastrar y redimensionar la zona directamente sobre la imagen del diploma, y ver en tiempo real si el nombre de ejemplo cabe antes de cargar los participantes reales.

### P3. El admin no puede corregir archivos dentro del sistema
No hay editor de CSV ni de fotos en el sistema. Si un dato es incorrecto, el admin debe salir, corregir el archivo externo, y volver a subirlo. El sistema comunica esto con claridad: los mensajes de error siempre dicen qué archivo corregir y qué columna o archivo falta.

### P4. El progreso de generación es visible y granular, el bloqueo no
Generar 150 diplomas tarda minutos. El admin no debe quedarse mirando una pantalla en blanco sin saber si el sistema trabaja o colgó. La pantalla de generación muestra un contador actualizado (X de 150 completados), los errores en tiempo real a medida que ocurren, y una estimación de tiempo restante.

### P5. La página pública de verificación responde en menos de 3 segundos la pregunta "¿es válido?"
El verificador escanea el QR en un evento, posiblemente con señal débil. El estado del diploma (válido / revocado / no encontrado) debe ser el elemento más prominente de la página, cargado mediante SSR. No depende de JavaScript del cliente para renderizar el estado.

---

## 2. Usuario admin

### Perfil
- Una persona del área administrativa de Seneto (coordinación académica o dirección de certificaciones).
- Conoce bien Word, Excel y correo electrónico. Puede manejar archivos ZIP. No tiene conocimientos de programación.
- Está acostumbrada a llenar formularios web y subir archivos a plataformas institucionales.
- No sabe qué son coordenadas en píxeles ni cómo funciona un canvas de imagen.

### Contexto de uso
- Opera desde una computadora de escritorio (Windows o Mac) en oficina.
- Genera diplomas en momentos específicos del año: al cierre de cada diplomado o programa.
- La presión es alta: los diplomas se necesitan para una ceremonia o entrega que ya tiene fecha.
- Puede haber interrupciones (llamadas, reuniones) en medio del flujo. El sistema debe persistir el estado entre sesiones.
- Trabaja con el mismo navegador de siempre (probablemente Chrome).
- Puede pasar semanas sin usar el sistema entre generaciones.

### Sus errores más probables

1. **Subir el CSV sin la columna `archivo_foto`** — no sabe que es obligatoria; la plantilla de ejemplo descargable previene este error mostrando todas las columnas requeridas.
2. **Nombrar las fotos diferente al valor de `archivo_foto`** — escribe "Juan Perez.jpg" en el ZIP pero el CSV dice "juan_perez.jpg"; el sistema muestra explícitamente la lista de desajustes por nombre.
3. **Configurar la zona de nombre demasiado pequeña** — el nombre de ejemplo cabe pero los nombres reales de 20 o más caracteres no; la vista previa con nombre largo en el ZoneEditor visual previene esto.
4. **Intentar generar sin haber cargado plantilla, CSV o fotos** — el botón "Generar diplomas" permanece deshabilitado con tooltip explicando exactamente qué falta.
5. **Cerrar la pestaña durante la generación creyendo que se interrumpe** — el proceso corre en servidor y continúa aunque el admin cierre la ventana; la UI comunica esto con un aviso explícito antes de iniciar.
6. **Confundir generación, plantilla y diplomas como si fueran lo mismo** — el flujo lineal con pasos numerados y etiquetas claras previene la confusión entre los tres conceptos.

### Lo que más necesita: confianza
El admin necesita saber que los 150 diplomas van a salir bien antes de presionar el botón. Esa confianza se construye con:
- Una validación pre-vuelo explícita que lista todo lo que puede fallar.
- Un preview del diploma con datos reales antes de generar.
- Un conteo visible durante la generación.
- Un reporte claro de qué salió mal si algo falla.

---

## 3. Usuario verificador (escanea el QR)

### Quién es
- El participante que recibió el diploma y quiere mostrarlo a alguien.
- Un empleador, institución educativa, o empresa que recibió el diploma como respaldo de la persona.
- Alguien que encontró el QR en un diploma físico impreso y tiene curiosidad.

### Contexto
- Dispositivo: celular (iOS o Android), pantalla de 375–428px.
- Conexión: variable — puede ser 4G en campo, WiFi en oficina, o señal débil en zona rural.
- Primera (y probablemente única) vez en el sitio. No sabe qué es Seneto.
- Llega directamente a `/v/:folio` — no pasa por ningún menú ni login.
- Expectativa: confirmar que el diploma es real. No quiere leer texto largo.

### Lo que necesita ver en menos de 3 segundos

1. **El estado del diploma** — "Diploma válido" en verde, con icono claro, o el estado negativo si aplica. Es el elemento más prominente de la página.
2. **El nombre del participante** — confirma que el diploma pertenece a quien lo presenta.
3. **El programa** — confirma qué estudió.

Todo lo demás (fecha, folio, institución, texto institucional) es secundario y va más abajo en la página.

---

## 4. Terminología oficial del sistema

Usar estos términos de forma consistente en toda la UI, copy, mensajes de error, y documentación. No mezclar sinónimos.

| Concepto | Término oficial | Términos a evitar |
|----------|----------------|-------------------|
| Agrupación de diplomas emitidos juntos para un programa o periodo | **Generación** | Campaña, lote, batch, corrida, proceso |
| PNG base del diploma sin datos del alumno | **Plantilla** | Template, diseño, fondo, formato |
| Área rectangular sobre la plantilla donde va un dato | **Zona** | Campo, región, área, caja, sección |
| Documento digital individual emitido a un alumno | **Diploma** | Constancia, documento (en UI pública) |
| Registro en base de datos con folio, estado y metadatos | **Certificado** | Solo en contexto admin técnico |
| Identificador único alfanumérico del diploma | **Folio** | Código, ID, número, clave |
| Persona que recibe el diploma | **Participante** | Alumno, estudiante, usuario, beneficiario |
| Quitar validez a un diploma emitido | **Revocar** | Cancelar, invalidar, anular, borrar |
| Acción de producir todos los diplomas de una generación | **Generar diplomas** | Procesar, compilar, exportar, crear |

### Nota sobre "Diploma" vs "Certificado"
En la UI pública (`/v/:folio`) se usa "Diploma" porque es el término que ve el público. En el panel admin se puede usar "Certificado" cuando se hace referencia al registro con folio, estado y metadatos (ej: "Buscar certificados", "Detalle del certificado"). Nunca mezclar ambos en el mismo párrafo.

---

## 5. ZoneEditor visual — Alcance del MVP

El ZoneEditor incluye interacción visual completa en el MVP. El admin no necesita conocer coordenadas en píxeles para posicionar zonas.

### Qué incluye el ZoneEditor visual en el MVP

- La plantilla PNG se muestra como fondo en el panel derecho.
- Las zonas configuradas se muestran como rectángulos con etiqueta superpuesta sobre la imagen.
- El admin puede hacer clic en una zona para seleccionarla.
- Puede mover la zona arrastrándola sobre la imagen.
- Puede redimensionarla arrastrando las esquinas o bordes.
- Las coordenadas (x, y, ancho, alto) se actualizan automáticamente en los campos numéricos al mover o redimensionar.
- Los campos numéricos siguen visibles como modo avanzado y para ajuste fino.
- **Preview de nombre:** el admin puede ingresar un nombre de prueba y ver cómo se renderiza dentro de la zona (nombre corto y nombre largo).
- **Preview de foto:** se muestra una imagen placeholder en la zona de foto.
- **Preview de QR:** se muestra un QR genérico en la zona de QR.

### Qué NO incluye (fuera del MVP)

- Detección automática de zonas mediante computer vision.
- Snap a grid o guías de alineación automática.
- Múltiples niveles de zoom.

---

## 6. Checklist de validación pre-vuelo

El botón "Generar diplomas" solo se habilita cuando todos los requisitos bloqueantes están cumplidos. El sistema verifica estos ítems en orden:

**Bloqueantes (impiden generar):**
- [ ] Plantilla subida a la generación
- [ ] Zonas obligatorias configuradas: nombre, foto, QR
- [ ] CSV cargado con al menos un participante
- [ ] Columnas requeridas presentes en CSV: `student_name`, `archivo_foto`
- [ ] Fotos cargadas (al menos el ZIP fue procesado)
- [ ] Cada participante tiene su foto asociada por nombre

**Advertencias (permiten generar con confirmación):**
- [ ] Nombres que exceden el ancho de la zona incluso a 28pt
- [ ] Participantes con campos opcionales vacíos (email, programa, fecha)
- [ ] Folios duplicados si se usó `folio_override` en el CSV

**Estado del botón:**
- Requisitos bloqueantes incompletos → botón deshabilitado + tooltip con qué falta
- Solo advertencias → botón activo + banner amarillo listando las advertencias
- Todo completo → botón activo + estado verde "Listo para generar"

---

## 7. Estados de UI — Definición global

Cada pantalla del sistema puede tener estos estados. La definición global aquí aplica a todas las pantallas; UI_STATES.md los implementa por pantalla.

| Estado | Descripción | Comportamiento esperado |
|--------|-------------|------------------------|
| **Vacío** | Primera vez, sin datos cargados | Ilustración o mensaje de ayuda + call to action principal |
| **Cargando** | Petición en vuelo | Skeleton loader o spinner; no mostrar datos anteriores desactualizados |
| **Éxito** | Operación completada | Feedback positivo breve (toast o banner verde); datos actualizados visibles |
| **Error** | Operación fallida | Banner rojo con causa específica + acción sugerida; nunca solo "Error" |
| **Generación en progreso** | Job corriendo en servidor | Barra de progreso con contador X/N + lista de errores parciales en tiempo real; botón de cancelar no disponible en MVP |
| **Generación con errores parciales** | Job terminó con algunos fallos | Banner amarillo con conteo de errores + enlace a CSV de errores; ZIP disponible con los diplomas que sí generaron |
| **Generación completada** | Job terminó sin errores | Banner verde + botón de descarga del ZIP prominente |

---

## 8. Restricciones de diseño del MVP

Las siguientes funcionalidades están fuera del MVP. Si el admin las busca, el sistema comunica con precisión qué no está disponible y, cuando aplica, qué puede hacer en su lugar.

| Funcionalidad ausente | Cómo se comunica |
|-----------------------|-----------------|
| Envío de diplomas por email | No hay botón de "Enviar". Si el admin pregunta, el sistema no lo menciona. Documentar en onboarding interno. |
| Detección automática de zonas en la plantilla | El sistema no detecta automáticamente dónde va cada campo. El admin las posiciona visualmente con el editor. |
| Reintento de diplomas fallidos individualmente | Al terminar la generación con errores, se muestra: "Los diplomas con error no se incluyen en el ZIP. Para generarlos, crea una nueva generación con solo esos participantes." |
| Múltiples plantillas por generación | Una generación tiene una sola plantilla. No se puede cambiar una vez iniciada la generación. |
| Historial de cambios de estado (audit log) | No existe. La fecha de revocación sí se muestra, pero sin historial previo. |
| Portal del participante | No existe ruta de login para participantes. La única entrada es el QR. |
| Firma digital PDF | Los PDFs son archivos planos. No se menciona firma digital en la UI. |
| Analytics de escaneos QR | No se registran escaneos. La página pública es stateless. |
| Múltiples admins / roles | Un solo admin en MVP. No hay gestión de usuarios. |
