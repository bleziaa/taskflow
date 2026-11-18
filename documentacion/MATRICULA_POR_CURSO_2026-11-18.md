# Matrícula por materia — 18 de noviembre de 2026

## Estado previo y cambio

Ya existían cursos con cuatro unidades, docentes responsables y una tabla SQL de matrícula. El acceso del estudiante dependía de esa tabla, pero administración no tenía una pantalla ni operaciones para mantenerla. La asignación del tutor de prácticas en la ficha del estudiante no matriculaba en materias.

Ahora, Administración institucional → Estructura académica → Gestionar matrícula permite matricular, retirar y reactivar estudiantes. La administración realiza estas asignaciones. El profesor asignado consulta su lista desde Mis cursos → Abrir curso → Ver estudiantes matriculados. El estudiante encuentra sus materias activas en Mis cursos.

La ficha debe estar activa y vinculada a una cuenta activa con membresía de estudiante en la institución. La pantalla identifica las fichas que requieren cuenta. La matrícula sincroniza la ficha necesaria en SQL, valida identidad y pertenencia institucional, impide duplicados y registra autor, fecha y estados. Los cambios son transaccionales e idempotentes, incluso ante altas simultáneas.

Retirar cambia el estado a retirado; no elimina registros académicos. Reactivar reutiliza la misma matrícula. Las entregas y notas permanecen en su curso original: matricular en otra materia no traslada calificaciones.

## Verificación realizada

Pruebas automatizadas con bases MongoDB y MariaDB reales y aisladas:

- Sesión obligatoria, CSRF, validación de identificadores y administración como único rol escritor.
- Docente asignado puede consultar; otro docente y un estudiante no pueden consultar el listado.
- Rechazo de estudiantes de otra institución o sin cuenta/membresía activa.
- Alta simultánea sin duplicados y solicitudes repetidas sin duplicar el historial.
- El curso aparece para el estudiante al matricularlo; desaparece al retirarlo.
- El retiro bloquea el acceso directo a entregas; la reactivación devuelve el acceso.
- Conservación del identificador de la entrega y nota 4,5 tras retiro y reactivación.
- Curso inactivo conserva consulta administrativa, pero bloquea nuevas matrículas y acceso docente.
- Rechazo de cuentas inactivas y conflictos entre cuenta vinculada e historial SQL.

Resultado: 6 pruebas, 6 correctas. La batería general obtuvo 109 pruebas correctas, sin fallos; la prueba SQL se omite en esa ejecución si no se configura un servidor de pruebas aislado. Se ejecutó separadamente con dicho servidor, sin omisiones.

Pruebas funcionales visuales en navegador, con datos ficticios y servidor local aislado:

1. Administración matriculó al estudiante y consultó el historial con su nombre como autora.
2. La profesora abrió la materia y visualizó al estudiante en la lista.
3. El estudiante vio y abrió la materia sin controles de administración.
4. Administración confirmó el retiro con advertencia de conservación de entregas y notas.
5. El estudiante vio cero cursos tras el retiro.
6. Administración reactivó la matrícula y el estudiante volvió a ver la materia.

La conservación de entregas y notas se verificó mediante las pruebas de integración y consultas SQL. Las capturas de esta ronda corresponden al flujo de matrícula; no se presentan como una nueva prueba visual de subida o calificación de archivos.

## Instalación y límites

Aplicar la migración nueva `010_course_enrollment_history.sql` mediante `npm run db:mysql:migrate` antes de usar esta versión. No se modificaron migraciones anteriores ni bases de datos reales durante la prueba.

Para repetir la integración: configurar `TASKFLOW_TEST_MYSQL_PORT` con un servidor local aislado y ejecutar `node --test tests/course-enrollment.test.js`. Opcionalmente configurar `TASKFLOW_TEST_MYSQL_USER` y `TASKFLOW_TEST_MYSQL_PASSWORD`. La prueba crea y elimina su propia base con prefijo `taskflow_enrollment_test_`; usa MongoDB temporal y no envía correos.

Esta entrega cubre la matrícula individual y el listado por docente. No añade matrícula masiva, paginación general, traslado de notas entre materias ni revisión completa de las operaciones antiguas de edición/eliminación de fichas. El selector de matrícula incluye las fichas activas de la institución, independientemente del límite de 200 registros de la tabla general. El despliegue y las pruebas en producción siguen pendientes.
