# Estructura académica configurable por práctica

## Objetivo
Permitir que cada docente configure los módulos o etapas que utilizará para organizar y ponderar la evaluación de una práctica empresarial, sin imponer una estructura fija a todas las empresas o procesos.

## Alcance implementado
- Cada práctica puede tener entre 1 y 20 módulos.
- Cada módulo tiene nombre, descripción, orden y ponderación porcentual.
- La suma de las ponderaciones debe ser exactamente 100 % (tolerancia técnica de 0,01).
- Los nombres de los módulos no pueden repetirse dentro de la misma estructura.
- La estructura queda asociada a una práctica y aislada por organización.
- El tutor solo puede consultar y modificar estructuras de prácticas que tenga asignadas.
- El administrador institucional puede consultar y modificar las estructuras de su organización.
- Las prácticas finalizadas o suspendidas no admiten cambios.
- Toda modificación posterior a la primera configuración exige un motivo y conserva una versión anterior con fecha y responsable.

## Interfaz docente
Abrir `/teacher-academic.html` desde el panel docente. Permite seleccionar una práctica, agregar/eliminar módulos, editar descripciones, distribuir porcentajes y consultar el historial de cambios.

## API institucional
- `GET /api/organization/practices/:id/academic-structure`
- `PUT /api/organization/practices/:id/academic-structure`

La escritura requiere sesión, membresía institucional con rol administrador o tutor y token CSRF. El identificador de organización proviene del contexto validado de sesión; nunca se acepta desde el cuerpo de la petición.

## Pendiente para completar la evaluación automática
Esta etapa guarda la estructura y sus ponderaciones. Aún falta asociar actividades a módulos, registrar por separado la autoevaluación del estudiante, la valoración empresarial y la evaluación oficial del tutor, y calcular/publicar la nota final a partir de las ponderaciones configuradas. No se debe presentar todavía la nota final automática como funcionalidad terminada.

## Consideraciones de arquitectura
La estructura se añade al documento de práctica en MongoDB para mantener compatibilidad con los controladores actuales. No se ejecutó ninguna migración SQL ni se cambiaron datos existentes. La futura transición del módulo académico a MySQL deberá incluir estos campos y su historial en el corte vertical correspondiente.
