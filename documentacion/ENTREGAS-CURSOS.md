# Entregas, revisión y calificación de actividades de cursos

## Flujo para estudiantes
1. El estudiante entra a **Mis cursos** y abre una actividad publicada.
2. Puede enviar una evidencia PDF, DOCX o ZIP de hasta 10 MB.
3. La plataforma registra fecha y hora. Si ya pasó la fecha límite, la entrega queda identificada como tardía en la respuesta de la API.
4. Puede consultar el estado de su última entrega y su calificación.
5. Si el docente marca la entrega `Por corregir`, el estudiante consulta directamente con él los ajustes y puede enviar una nueva versión.

## Flujo para docentes
1. En cada actividad aparece la bandeja de entregas.
2. El docente descarga el archivo y puede aprobarlo o solicitar correcciones.
3. El docente puede marcar una entrega como `Por corregir`; la plataforma no funciona como chat ni envía una conversación de corrección. El docente explica los ajustes directamente al estudiante.
4. Registra la nota en escala de 0 a 5. Al guardarla, la entrega queda revisada automáticamente: desde 3.0 queda `Aprobada`; por debajo de 3.0 queda `Reprobada`. No existe un botón separado para aprobar; `Por corregir` se conserva como acción independiente.
5. La bandeja muestra estudiante, código, archivo, fecha, estado y nota.
6. La bandeja parte de la matrícula activa del curso, no solo de las evidencias: muestra a todos los estudiantes matriculados aunque no hayan enviado archivo.
7. Antes del vencimiento, quienes no han enviado aparecen como `Pendiente`; al vencer el plazo o cerrar la actividad, aparecen como `No entregó`.
8. Las entregas se identifican como tardías cuando su fecha/hora de envío supera el vencimiento. Se conserva la última versión enviada por estudiante para mostrar el estado vigente.
9. El resumen por actividad cuenta estudiantes matriculados, entregas por revisar, aprobadas, por corregir y no entregadas. No muestra un contador redundante de pendientes dentro del plazo.
10. El docente puede conceder o modificar una fecha límite individual desde la ficha de un estudiante. La excepción se guarda por actividad y estudiante; no cambia la fecha general ni la de los demás.
11. El estudiante consulta su fecha efectiva, incluida cualquier prórroga individual. La entrega tardía se calcula contra esa fecha efectiva.

## Progreso del curso
- Para el estudiante, el progreso representa el porcentaje de actividades publicadas que tienen una entrega aprobada.
- También se devuelven los conteos de entregas realizadas, aprobadas y calificadas.
- Para el docente se muestra el número de entregas pendientes de revisión.
- El cálculo se consulta desde MariaDB y no se almacena como un porcentaje manual.

## Rutas API
- `POST /api/organization/courses/:courseId/activities/:activityId/evidences` — entrega del estudiante matriculado; multipart `archivo`; requiere CSRF.
- `GET /api/organization/courses/:courseId/activities/:activityId/evidences` — lista de entregas (docente asignado o solo la propia para el estudiante).
- `PATCH /api/organization/courses/:courseId/activities/:activityId/students/:studentId/deadline` — concede o modifica el vencimiento de un estudiante sin cambiar el de los demás.
- `GET /api/organization/courses/:courseId/activities/:activityId/evidences/:evidenceId/download` — descarga protegida.
- `PATCH /api/organization/courses/:courseId/activities/:activityId/evidences/:evidenceId/review` — aprobación o solicitud de corrección por el docente asignado.
- `PUT /api/organization/courses/:courseId/activities/:activityId/evidences/:evidenceId/grade` — registro o actualización de nota y comentarios.

## Seguridad y almacenamiento
- Metadatos y estados en `academic_course_evidences`; calificaciones en `academic_course_evaluations`; excepciones de fecha en `academic_course_activity_student_deadlines`.
- Archivos privados en `storage/course-activity-evidences`, con nombre aleatorio.
- Firma PDF/ZIP verificada y límites de 10 MB.
- Cada operación valida la organización activa, matrícula o asignación docente, curso y actividad.
- Las entregas anteriores se conservan para mantener el historial de correcciones.

## Datos de demostración para revisión docente
- El script `npm run seed:course-evidence-demo` agrega tres perfiles académicos de demostración (sin cuenta de acceso) al curso Base de Datos II.
- Crea tres evidencias marcadas con prefijo `DEMO_`: una pendiente, una aprobada y una con correcciones solicitadas. También crea una calificación demostrativa para la entrega aprobada.
- Los perfiles usan códigos `DEMO-` y correos reservados bajo `.invalid`; no representan estudiantes reales ni generan cuentas de inicio de sesión.
- Los archivos de ejemplo se copian al almacenamiento privado de evidencias. No deben confundirse con entregas oficiales.

## Validación pendiente
La suite automatizada existente y las verificaciones relacionales pasaron, pero aún falta una prueba de extremo a extremo en navegador con cuentas reales de estudiante y docente que incluya cargar, descargar, devolver, volver a entregar y calificar un archivo.
