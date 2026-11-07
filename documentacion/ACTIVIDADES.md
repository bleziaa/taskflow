# Módulo de actividades — TaskFlow

## Objetivo
Gestionar actividades vinculadas a prácticas empresariales, con fechas límite, prioridad y estado.

## Funcionalidades
- Administradores y tutores crean actividades en prácticas accesibles.
- Tutores solo operan sobre prácticas que tienen asignadas.
- Administradores consultan y gestionan todas las actividades.
- Estudiantes consultan únicamente actividades de sus propias prácticas.
- Estados: pendiente, en revisión y completada.
- Prioridad: baja, media y alta.
- Prácticas finalizadas o suspendidas no admiten nuevas actividades ni modificaciones.

## API
- GET /api/activities — lista según el rol; admite filtro ?practica=ID.
- POST /api/activities — crea actividad (administrador/tutor).
- PATCH /api/activities/:id — actualiza actividad (administrador/tutor).
- DELETE /api/activities/:id — elimina actividad (administrador/tutor).

Las operaciones de escritura requieren sesión, rol autorizado y token CSRF. Las actividades se guardan en MongoDB.
