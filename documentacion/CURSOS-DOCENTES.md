# Organización docente de cursos

## Estructura del curso
Cada asignatura mantiene su propio espacio académico en MariaDB:
- Curso asignado al docente.
- Entre 1 y 50 unidades por curso.
- El docente asignado puede agregar, renombrar, describir y reorganizar unidades desde **Mis cursos → abrir asignatura → Estructura de unidades**.
- Las unidades conservan su identificador al editarse; las nuevas se crean al guardar la estructura.
- Una unidad que ya tenga actividades no se puede eliminar, para proteger las actividades y sus entregas.
- Actividades asociadas obligatoriamente a una unidad.
- Materiales PDF generales del curso o específicos de una actividad.
- Fechas de apertura y entrega, e instrucciones para el estudiante.

## Material PDF por actividad
El docente abre **Mis cursos**, entra a una asignatura y, dentro de la actividad correspondiente, adjunta un PDF de hasta 10 MB. El material queda vinculado a la organización, curso y actividad; el estudiante matriculado puede descargarlo cuando la actividad está publicada.

### API
- `POST /api/organization/courses/:courseId/activities/:activityId/resources` — docente asignado; carga multipart con campos `archivo`, `title` y `description`; requiere CSRF.
- `GET /api/organization/courses/:courseId/activities/:activityId/resources/:resourceId/download` — docente asignado o estudiante matriculado en una actividad publicada.

## Almacenamiento y seguridad
- Metadatos en `academic_course_activity_resources`.
- Archivos privados en `storage/course-activity-resources`, con nombre aleatorio.
- Solo PDF, comprobación de firma `%PDF-` y máximo de 10 MB.
- Las consultas y descargas se limitan a la organización activa y a la matrícula/asignación del usuario.

## Estado y validación pendiente
- La entrega de evidencias del estudiante, la bandeja docente de revisión, la devolución para correcciones y la calificación por actividad están implementadas.
- El avance y las métricas del curso se consultan desde las actividades y entregas registradas.
- Falta completar una validación visual de extremo a extremo con cuentas reales de docente y estudiante.
