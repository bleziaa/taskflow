# Módulo de prácticas empresariales

## Objetivo
Registrar el periodo de práctica de cada estudiante y relacionar de forma persistente al estudiante, la empresa y el tutor responsable.

## Estados
- `planificada`: registrada para iniciar posteriormente.
- `en_curso`: práctica en desarrollo.
- `finalizada`: periodo concluido.
- `suspendida`: práctica pausada.

Un estudiante no puede tener más de una práctica en estado planificada o en curso al mismo tiempo. Puede conservar prácticas históricas finalizadas o suspendidas.

## Permisos
- Administrador: crea, consulta, edita y elimina prácticas; asigna estudiante, empresa, tutor, fechas y objetivos.
- Tutor: consulta únicamente las prácticas que tiene asignadas.
- Estudiante: consulta únicamente sus propias prácticas, vinculadas por cuenta de usuario o correo.
- Tutores y estudiantes no pueden crear, editar ni eliminar prácticas desde la API.

## API
- `GET /api/practices`: lista según el rol autenticado.
- `GET /api/practices/:id`: detalle, sujeto a autorización por tutor/estudiante.
- `POST /api/practices`: creación exclusiva del administrador.
- `PATCH /api/practices/:id`: actualización exclusiva del administrador.
- `DELETE /api/practices/:id`: eliminación exclusiva del administrador.

Las escrituras requieren sesión, rol administrador y token CSRF. La API valida que estudiante, empresa y tutor estén activos, que el tutor tenga rol tutor y que las fechas sean coherentes. Al crear o actualizar una práctica, se sincronizan las referencias de tutor y empresa en el registro académico del estudiante.

## Interfaz
Abrir `/practices.html`. El administrador dispone del formulario de gestión. Los tutores y estudiantes ven exclusivamente los registros permitidos por su cuenta.

## Pruebas
El archivo `tests/practices.test.js` cubre autenticación, creación, sincronización de relaciones, alcance de tutor y estudiante, unicidad de prácticas activas, validación de fechas y bloqueo de escrituras no administrativas.
