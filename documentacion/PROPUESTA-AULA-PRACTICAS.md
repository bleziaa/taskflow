# Propuesta funcional — Aula de prácticas TaskFlow

Fecha: 5 de noviembre de 2026  
Estado: definición funcional; pendiente de validación antes de implementar cambios de backend.

## 1. Objetivo

Convertir el seguimiento de prácticas en un aula virtual organizada. El docente tutor planifica, publica y evalúa actividades; el estudiante consulta instrucciones y recursos, participa, entrega evidencias y revisa sus calificaciones y retroalimentación. La experiencia toma referencias de plataformas académicas como los cursos del SENA y los espacios de aprendizaje universitarios, adaptadas al contexto de prácticas empresariales.

## 2. Modelo de trabajo

La unidad de organización es el **espacio de práctica** (o grupo de prácticas), con un tutor y uno o varios estudiantes según la asignación autorizada. Dentro del espacio se organizan:

- **Módulos o unidades:** etapas del proceso de práctica (inducción, diagnóstico, ejecución, seguimiento y cierre), configurables por el docente.
- **Actividades:** trabajo publicado por el docente, con instrucciones, fechas, recursos, tipo de entrega y puntuación máxima.
- **Entregas/evidencias:** archivos o respuestas enviados por el estudiante para una actividad, con fecha/hora e historial de intentos.
- **Revisión:** estado de revisión, observaciones, solicitud de corrección o aprobación.
- **Calificación:** nota por actividad, retroalimentación y estado de publicación.
- **Foro/consultas:** conversación temática asociada a una unidad o actividad; no sustituye la entrega formal.
- **Libro de calificaciones:** vista del estudiante con notas publicadas, ponderaciones y progreso; vista del docente con notas pendientes de calificar.

## 3. Flujo del docente

1. Entra a su espacio de práctica y ve estudiantes asignados, actividades publicadas, entregas pendientes, atrasos y notas por publicar.
2. Crea una unidad o selecciona una existente.
3. Crea una actividad con título, objetivo, instrucciones detalladas, fecha de apertura, fecha límite, tipo de entrega, formatos permitidos, puntuación máxima, ponderación opcional y recursos adjuntos.
4. Guarda como borrador o publica. Solo lo publicado se muestra como actividad disponible al estudiante.
5. Consulta entregas por estado: sin entregar, entregada, atrasada, en revisión, requiere corrección o calificada.
6. Abre la evidencia, descarga el archivo, escribe retroalimentación, solicita correcciones o califica.
7. Publica la calificación. La publicación debe ser una acción explícita; guardar un borrador de nota no debe hacerla visible al estudiante.
8. Consulta el libro de calificaciones y el resumen de avance.

## 4. Flujo del estudiante

1. Entra a su espacio de práctica y ve anuncios, unidades y próximas fechas.
2. Abre una actividad publicada, lee las instrucciones y descarga los recursos.
3. Participa en el foro o hilo de consultas cuando esté habilitado.
4. Entrega una respuesta o archivo antes de la fecha límite. El sistema registra fecha/hora y versión de la entrega.
5. Consulta el estado de revisión y los comentarios. Si se solicitan cambios, puede volver a entregar y conservar el historial anterior.
6. Cuando el docente publica la nota, el estudiante ve la calificación, la retroalimentación y el criterio/rúbrica aplicado.
7. Consulta sus notas por actividad y el resumen del curso/práctica. Las notas no publicadas no deben mostrarse.

## 5. Estados propuestos

**Actividad:** borrador, publicada, cerrada, archivada.  
**Entrega:** pendiente, entregada, atrasada, en revisión, requiere corrección, corregida, calificada.  
**Calificación:** borrador, publicada, modificada (con registro de auditoría).

Los estados deben distinguir si una entrega llegó tarde aunque posteriormente se revise o califique. No se debe convertir automáticamente una evidencia aprobada en una calificación académica.

## 6. Diseño de calificación

- Cada actividad puede tener puntuación máxima (por ejemplo, 100 o 5) y ponderación configurable.
- El docente puede usar rúbrica o criterios de evaluación, además de una nota y observación general.
- Debe existir una acción explícita **Publicar calificación**.
- El estudiante solo ve notas publicadas y retroalimentación destinada a él.
- El libro de calificaciones calcula el resultado según las actividades ponderadas que el docente haya definido; debe indicar qué actividades aún no tienen nota y evitar asumir que una actividad no entregada equivale a cero, salvo que el docente aplique esa regla de forma explícita.
- Las evaluaciones globales de la práctica pueden mantenerse como instrumento adicional, separadas de las notas de actividades.

## 7. Foro y comunicación

Cada unidad puede tener un foro temático y cada actividad puede tener un hilo de preguntas/respuestas. El docente puede publicar avisos, responder dudas y fijar instrucciones. Los mensajes deben pertenecer a la organización y al espacio de práctica correctos. Las respuestas del foro no reemplazan el envío de evidencia solicitado.

## 8. Pantallas propuestas

### Docente
- Inicio docente: resumen de prácticas, estudiantes, entregas por revisar, atrasos y calificaciones pendientes de publicar.
- Mis espacios de práctica: selector de grupo/curso autorizado.
- Contenido: unidades, anuncios y actividades.
- Crear/editar actividad: editor con instrucciones, fechas, recursos, entrega y calificación.
- Seguimiento de entregas: filtros por estudiante, actividad y estado; vista de evidencia y revisión.
- Libro de calificaciones: notas por estudiante/actividad, ponderaciones, borradores y publicación.
- Foros: temas, preguntas y respuestas.

### Estudiante
- Mi aula de prácticas: unidades, anuncios, próximas actividades y progreso.
- Detalle de actividad: instrucciones, materiales, fecha límite, foro/hilo y formulario de entrega.
- Mis entregas: estado, fecha de envío, correcciones e historial.
- Mis calificaciones: notas publicadas, retroalimentación y resumen ponderado.

## 9. Permisos y seguridad

- El docente solo puede administrar espacios y estudiantes asignados a su membresía institucional activa.
- El estudiante solo puede consultar espacios, actividades, entregas y notas propios.
- Los archivos deben descargarse mediante endpoints autorizados; no se exponen rutas físicas públicas.
- Todas las operaciones de creación, edición, entrega, revisión y publicación deben validar CSRF y pertenencia a organización/espacio.
- Mantener historial de entregas, cambios de nota y publicaciones para trazabilidad.
- No generar estudiantes, actividades, entregas ni notas ficticias.

## 10. Situación técnica encontrada en TaskFlow

- `public/activities.html` y `public/js/activities.js` ya permiten a roles no estudiantes crear actividades ligadas a prácticas, con título, fecha límite, prioridad, estado y descripción.
- El estudiante ya puede adjuntar PDF, DOCX o ZIP (límite actual 10 MB) a una actividad.
- El docente ya puede consultar evidencias, aprobarlas o solicitar correcciones con observaciones.
- `public/evaluations.html` y `public/js/evaluations.js` permiten registrar una evaluación asociada a una práctica, con nota 0–5, concepto, fortalezas, aspectos de mejora y observaciones.
- **Brecha principal:** la calificación no está asociada a la entrega/actividad individual ni tiene una acción clara de publicación al estudiante.
- **Brechas adicionales:** no hay editor de recursos adjuntos a la actividad, unidades/módulos de aula, foro, historial de reentregas ni libro de calificaciones por actividad.
- El esquema SQL `003_course_workspaces.sql` prepara espacios académicos por curso, pero sus repositorios/endpoints aún no están conectados al frontend. La experiencia actual sigue operando con las rutas académicas existentes.

## 11. Plan de implementación recomendado

1. **Cerrar el modelo funcional:** decidir si el aula se organiza por práctica individual, grupo de prácticas o curso académico; definir tipos de entrega y escala de notas.
2. **Publicación de actividades:** estados borrador/publicada/cerrada, recursos adjuntos y unidades.
3. **Seguimiento y entregas:** bandeja docente, atraso, historial de intentos, revisión y solicitudes de corrección.
4. **Calificación por actividad:** rúbrica/criterios, nota, retroalimentación, borrador y publicación explícita.
5. **Libro de calificaciones:** vista docente y estudiante, cálculo ponderado y visibilidad de notas publicadas.
6. **Foros y anuncios:** comunicación temática moderada por el docente.
7. **Analítica:** gráficos de cumplimiento, atrasos, entregas y rendimiento con datos reales.

No ejecutar migraciones, alterar datos ni cambiar controladores/API hasta aprobar el modelo y preparar pruebas de aislamiento por organización, espacio, docente y estudiante.


## 7.1 Gobierno académico y pautas de evaluación por asignatura

El modelo será mixto para mantener coherencia académica sin quitar flexibilidad al docente:

- **Pautas oficiales:** la coordinación académica o el administrador institucional define y mantiene los resultados de aprendizaje, competencias, criterios obligatorios, escala de calificación, reglas de aprobación y ponderaciones institucionales que correspondan a cada asignatura.
- **Configuración docente:** el docente consulta esas pautas y puede complementarlas con criterios específicos, indicadores, rúbricas, instrucciones y actividades propias de su espacio de práctica. No puede eliminar ni alterar los criterios oficiales obligatorios.
- **Versionado:** cada pauta o rúbrica debe conservar su versión y fecha de vigencia. Una modificación posterior no debe cambiar retroactivamente las evaluaciones ya realizadas.
- **Trazabilidad:** debe quedar registrado quién creó o modificó una pauta, cuándo lo hizo y qué versión se aplicó a cada evaluación.

Cada asignatura podrá tener una plantilla de evaluación propia. La plantilla podrá incluir criterios, descripción de niveles de desempeño, puntaje máximo por criterio, ponderación, escala final y observaciones obligatorias. Las plantillas se reutilizan en los espacios de práctica de esa asignatura, pero cada docente puede añadir criterios complementarios cuando la configuración institucional lo permita.

## 7.2 Justificación de las calificaciones

Una calificación no será solamente un número. Cada evaluación deberá permitir:

1. Seleccionar la pauta o rúbrica vigente de la asignatura.
2. Puntuar cada criterio por separado.
3. Añadir una justificación del resultado de cada criterio, explicando qué evidencia observó el docente.
4. Escribir una retroalimentación general con fortalezas, aspectos por mejorar y recomendaciones concretas.
5. Guardar la evaluación como borrador y revisarla antes de publicarla.
6. Publicar explícitamente la nota y los comentarios destinados al estudiante.

El sistema debe distinguir entre nota pendiente, nota en borrador y nota publicada. El estudiante no verá borradores ni comentarios internos. Una corrección posterior a la publicación debe conservar el valor anterior, el nuevo valor, el motivo del cambio, el autor y la fecha.

La vista de calificaciones del docente permitirá consultar notas por estudiante, asignatura, módulo, actividad y criterio; identificar evaluaciones pendientes y comparar resultados con los criterios oficiales. La vista del estudiante mostrará únicamente sus resultados publicados, junto con la rúbrica aplicada y la explicación del docente.

## 7.3 Módulos y recursos didácticos

Cada espacio de asignatura/práctica podrá organizarse en módulos o unidades. La estructura inicial sugerida es inducción, reconocimiento/diagnóstico, desarrollo, seguimiento y cierre, pero la coordinación o el docente autorizado podrá adaptarla a la asignatura.

Un módulo podrá incluir:
- Texto introductorio, objetivos y competencias.
- Videos explicativos mediante enlace o archivo, con título y descripción.
- Guías PDF, documentos, presentaciones y material complementario.
- Instrucciones y avisos del docente.
- Actividades relacionadas y fechas.
- Evaluaciones o rúbricas asociadas.
- Foro temático o espacio de preguntas, si está habilitado.

Los recursos tendrán título, descripción, orden, módulo al que pertenecen, autor y visibilidad (borrador/publicado/archivado). Solo los recursos publicados estarán disponibles para estudiantes matriculados en el espacio. Las descargas y reproducciones deberán respetar los permisos del curso y de la organización; no se expondrán rutas físicas ni archivos de otros espacios.

## 7.4 Alcance del panel docente — orden de finalización

La implementación se organizará primero desde la experiencia del profesor:

1. Inicio docente y resumen de asignaturas/espacios asignados.
2. Mis estudiantes y seguimiento individual.
3. Bandeja de actividades, entregas, evidencias y atrasos.
4. Gestión de módulos, videos, guías y materiales.
5. Creación y publicación de actividades grupales o individuales.
6. Evaluación con pautas oficiales, rúbricas, justificación por criterio y retroalimentación.
7. Libro de calificaciones, publicación y trazabilidad de cambios.
8. Foros, consultas y anuncios.
9. Revisión integral de permisos, accesibilidad, diseño adaptable y pruebas.

Solo después de completar y validar estos flujos docentes se construirá la experiencia estudiantil correspondiente, consumiendo las mismas actividades, recursos, entregas y calificaciones reales. No se duplicará la lógica académica ni se crearán datos ficticios para aparentar que un módulo está terminado.


## 7.5 Estructura académica: curso, unidades y actividades

La jerarquía recomendada será:

**Organización → Programa (cuando aplique) → Asignatura/curso → Unidades o módulos → Contenidos, actividades y evaluaciones.**

- El curso/asignatura es el espacio principal administrado por uno o varios docentes autorizados.
- Las unidades o módulos dividen el curso en bloques temáticos o etapas de aprendizaje. Por ejemplo: Unidad 1 — Inducción; Unidad 2 — Diagnóstico; Unidad 3 — Desarrollo; Unidad 4 — Seguimiento; Unidad 5 — Cierre.
- Cada unidad puede contener videos, guías, lecturas, protocolos, anuncios, foros, actividades y evaluaciones.
- El curso también puede tener recursos generales que no pertenecen a una unidad concreta, como el programa de la asignatura, calendario, reglamento o guía general.
- Una actividad o evaluación pertenece al curso y, preferiblemente, a una unidad. Se permitirá marcarla como contenido general del curso cuando no corresponda a una unidad.
- La práctica empresarial se relaciona con el curso cuando corresponda, pero no sustituye la estructura académica del curso.

Así se evita elegir entre “módulos por curso” y “módulos por unidad”: el curso contiene las unidades, y cada unidad organiza el material y el trabajo.

## 7.6 Fechas, ventanas de entrega y vencimientos

Las actividades y evaluaciones deberán manejar fechas diferenciadas, no un único campo de vencimiento:

- **Fecha de publicación:** cuándo se hace visible el elemento.
- **Fecha y hora de inicio/disponibilidad:** desde cuándo el estudiante puede consultar o entregar, según la configuración.
- **Fecha límite de entrega:** plazo ordinario para enviar el trabajo.
- **Fecha límite extendida:** plazo especial individual o grupal, si el docente está autorizado a concederlo.
- **Fecha de cierre:** momento a partir del cual el sistema bloquea nuevas entregas, si se configura el cierre.
- **Fecha de revisión/calificación:** opcional, para indicar cuándo se espera que el docente termine de revisar.
- **Fecha de evaluación:** para pruebas, sustentaciones o encuentros programados; puede incluir hora, duración y modalidad.

El sistema debe mostrar zona horaria institucional, avisar próximos vencimientos y distinguir entrega puntual, tardía, pendiente y cerrada. La política de entregas tardías será explícita por actividad: permitir con marca de retraso, permitir con penalización configurada o no permitir. No se aplicará una penalización silenciosa o automática sin regla visible.

Las fechas deben validarse entre sí (inicio anterior al vencimiento y vencimiento no posterior al cierre, cuando exista). Las extensiones individuales deben quedar registradas y no alterar el plazo del resto del grupo.

## 7.7 Correcciones y reentregas con historial

La revisión de una entrega podrá terminar en:
- Aprobada / lista para calificar.
- Requiere corrección.
- No cumple los requisitos (con justificación).
- Calificada.

Cuando solicite corrección, el docente deberá señalar el criterio o requisito afectado y explicar qué debe cambiar. El estudiante podrá responder y cargar una nueva versión dentro del plazo de corrección definido. Cada intento conservará archivos, respuestas, fecha/hora, autor y observaciones; no se sobrescribirá ni borrará la versión anterior.

El docente podrá comparar versiones y marcar qué observaciones quedaron resueltas. El sistema distinguirá entre corrección solicitada y calificación publicada: pedir una corrección no equivale a poner una nota de cero ni a cerrar la actividad.

La configuración de cada actividad determinará si admite reentregas, cuántos intentos permite, el plazo para corregir y si la nota máxima puede verse afectada por entregas tardías o intentos adicionales. Estas reglas deben ser visibles antes de entregar.

## 7.8 Protocolos y matrices de evidencia reutilizables

Las actividades podrán partir de plantillas institucionales o de asignatura para reutilizar protocolos y rúbricas ya aprobados. Una plantilla podrá definir:

- Objetivo, alcance, instrucciones y procedimiento.
- Requisitos obligatorios y opcionales.
- Entregables y formatos permitidos.
- Evidencias requeridas y matriz de verificación.
- Criterios de aceptación y rúbrica.
- Puntuación, ponderación y reglas de aprobación.

La matriz de evidencia podrá registrar, según el tipo de actividad: dato o insumo utilizado, resultado esperado, resultado obtenido, estado de cumplimiento, soporte adjunto y observación del revisor. Los estados de seguimiento podrán incluir pendiente, en proceso, completado y pendiente de verificación, sin confundir “archivo adjunto” con “requisito validado”.

Cada actividad conservará una copia/versionado del protocolo y rúbrica que tenía al publicarse. Si la plantilla cambia después, no se alterarán actividades ni calificaciones históricas. El docente podrá complementar la plantilla con instrucciones específicas, manteniendo los requisitos oficiales obligatorios.


## 7.9 Corrección de calificaciones y modificación de fechas

El docente autorizado podrá corregir calificaciones y fechas cuando detecte un error o exista una justificación académica válida. Estas operaciones no deben sobrescribir silenciosamente el historial.

### Corrección de calificaciones
- Se podrá editar una calificación en borrador sin afectar al estudiante, porque todavía no ha sido publicada.
- Una calificación ya publicada también podrá corregirse, pero el docente deberá indicar obligatoriamente el motivo del cambio.
- El sistema conservará el valor anterior y el nuevo, los criterios/rúbrica afectados, la justificación, el usuario que realizó el cambio y la fecha/hora.
- Si cambia una nota publicada, la nueva versión deberá quedar identificada como corregida y publicarse expresamente para actualizar lo que ve el estudiante.
- El estudiante recibirá una notificación de que su calificación fue actualizada y podrá consultar la retroalimentación y el historial visible de correcciones, sin acceso a notas internas ni a datos de auditoría restringidos.
- Los cambios no deben recalcular ni modificar evaluaciones históricas que usaron otra versión de una rúbrica. Si una modificación afecta una ponderación o fórmula, se debe mostrar el impacto antes de confirmar y conservar el cálculo anterior.
- El docente solo podrá modificar notas de cursos, actividades y estudiantes sobre los que tenga autorización vigente. Las políticas institucionales podrán exigir aprobación de coordinación para cambios posteriores al cierre definitivo de notas.

### Modificación de fechas
- El docente autorizado podrá modificar publicación, inicio, fecha límite, cierre y fechas de evaluación mientras el elemento esté bajo su responsabilidad.
- Si la actividad todavía está en borrador, podrá ajustar las fechas sin notificación al estudiante.
- Si ya fue publicada, todo cambio de fecha deberá registrar el valor anterior, el nuevo, el motivo, autor y fecha/hora del cambio.
- Los estudiantes afectados deberán recibir una notificación clara del cambio y de la nueva fecha. La actividad mostrará que el plazo fue actualizado.
- El cambio de fecha general aplica al grupo completo. Las extensiones individuales se gestionan como excepciones por estudiante y no alteran el plazo del resto.
- Una modificación no debe borrar ni cambiar las marcas originales de entrega puntual/tardía ni reescribir la fecha/hora real en que se recibió cada intento.
- Antes de guardar, el sistema validará la coherencia entre inicio, vencimiento y cierre, y advertirá si ya existen entregas, calificaciones o eventos asociados.
- Cuando el curso o periodo esté cerrado, la modificación podrá requerir autorización de coordinación, según la política institucional.

### Registro de auditoría
Cada cambio sensible debe generar un evento de auditoría no editable desde la interfaz ordinaria, con entidad afectada, identificador, tipo de cambio, valores anterior y nuevo, motivo, actor, organización/curso y marca temporal. El historial debe estar protegido por permisos y no permitir que un docente borre sus propios cambios. La auditoría no reemplaza la versión visible de la nota o la fecha: ambas deben poder consultarse por separado.

