# Módulo de evidencias — TaskFlow

## Alcance
Los estudiantes entregan archivos asociados a actividades de sus propias prácticas. Los tutores asignados y los administradores pueden consultar, descargar y revisar esas entregas.

## Reglas
- Formatos permitidos: PDF, DOCX y ZIP.
- Tamaño máximo: 10 MB por archivo.
- Los archivos se guardan fuera de la carpeta pública, con nombre interno aleatorio.
- Las descargas pasan por una ruta autenticada y autorizada.
- Se comprueba extensión, tipo MIME y firma básica del archivo.
- Estados de revisión: pendiente, aprobada y requiere cambios.
- El tutor puede dejar observaciones de hasta 2.000 caracteres.
- Al aprobar una evidencia, la actividad queda completada; si solicita cambios, vuelve a pendiente.

## API
- POST /api/activities/:actividadId/evidences — entrega de estudiante; multipart, campo archivo.
- GET /api/evidences/activity/:actividadId — consulta de entregas autorizadas.
- GET /api/evidences/:id/download — descarga protegida.
- PATCH /api/evidences/:id/review — revisión por administrador o tutor; recibe estado y observacion.

Las operaciones de escritura requieren sesión, rol autorizado y token CSRF.
