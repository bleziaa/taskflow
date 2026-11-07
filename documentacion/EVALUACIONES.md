# Módulo de evaluaciones y seguimiento

## Alcance
Permite registrar una evaluación por práctica y consultar el historial de valoraciones. La nota utiliza una escala de 0 a 5.

## Datos
- Calificación numérica de 0 a 5 (permite decimales).
- Concepto: excelente, bueno, satisfactorio o insuficiente.
- Fortalezas, aspectos por mejorar y observaciones.
- Tutor evaluador y fecha de evaluación.

## Permisos
- Administrador: consulta y registra evaluaciones de todas las prácticas.
- Tutor: consulta y evalúa únicamente las prácticas que tiene asignadas.
- Estudiante: consulta exclusivamente las evaluaciones de su práctica; no puede modificarlas.

## API
- GET /api/evaluations
- PUT /api/evaluations/:practicaId (administrador/tutor, protegido con CSRF)

La operación PUT crea la evaluación si no existe y la actualiza si ya hay una para esa práctica. Las prácticas suspendidas no admiten evaluación. Los datos se guardan en MongoDB y se muestran en evaluations.html.
