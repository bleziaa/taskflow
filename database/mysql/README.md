# Arquitectura de datos TaskFlow

## Decisión arquitectónica aprobada — 2026-11-04

TaskFlow utilizará dos motores con responsabilidades distintas. No se mantendrán dos fuentes de verdad para una misma entidad.

### MongoDB — administración e identidad

Fuente de verdad para:
- Cuentas globales, contraseñas hash, recuperación y estado de usuario (`User`).
- Organizaciones (`Organization`).
- Membresías, roles y permisos por organización (`OrganizationMembership`).
- Configuración visual institucional/global (`Branding`).
- Sesiones de autenticación y datos administrativos asociados.

### MySQL/MariaDB — operación académica

Fuente de verdad prevista para:
- Estudiantes (`academic_students`).
- Empresas (`academic_companies`).
- Prácticas (`academic_practices`).
- Actividades y fechas (`academic_activities`).
- Metadatos y revisión de evidencias (`academic_evidences`).
- Evaluaciones (`academic_evaluations`).

Los archivos binarios de evidencias permanecen en el almacenamiento de archivos de TaskFlow. MySQL conserva sus metadatos y referencia, no el binario.

### Relaciones entre motores

`organization_id`, `user_id`, `tutor_user_id`, `created_by_user_id` y `reviewed_by_user_id` guardan los ObjectId de MongoDB como `CHAR(24)`. No se replica la cuenta, su contraseña ni la colección de membresías en MySQL. La capa de servicio validará que la cuenta y su membresía sigan activas antes de aceptar operaciones académicas.

Las entidades académicas se relacionan dentro de MySQL mediante claves foráneas compuestas por `organization_id` e ID, para impedir cruces entre organizaciones.

## Esquema relacional

| Tabla | Propósito |
|---|---|
| `academic_students` | Registro académico y referencias externas a cuenta/tutor |
| `academic_companies` | Empresas por organización |
| `academic_practices` | Práctica del estudiante, empresa y tutor |
| `academic_activities` | Actividades de una práctica |
| `academic_evidences` | Metadatos, estado de revisión y referencia de archivo |
| `academic_evaluations` | Nota, concepto y observaciones por práctica |
| `schema_migrations` | Versiones y checksum de migraciones |

## Migraciones y verificación

```bash
npm run db:mysql:migrate
npm run db:mysql:verify
```

Las migraciones aplicadas no se editan; cualquier cambio futuro se implementa en una migración nueva. La verificación usa datos ficticios dentro de una transacción y revierte todo al terminar.

## Estado real de la transición

- La conexión MySQL/MariaDB está activa y el esquema de seis tablas está creado.
- Se comprobó el flujo relacional de prueba y el rechazo de referencias cruzadas entre organizaciones.
- **La transición de los controladores académicos aún no está ejecutada.** Los módulos actuales continúan operando sobre MongoDB hasta migrar cada módulo completo y pasar sus pruebas.
- Las colecciones académicas de MongoDB estaban vacías en la inspección inicial; no se copiaron registros reales.
- La próxima implementación debe migrar verticalmente y en orden: estudiantes/empresas, prácticas, actividades, evidencias, evaluaciones e informes/dashboard. Cada etapa debe incluir validación de permisos, aislamiento multiempresa y pruebas de regresión antes de retirar el modelo Mongoose correspondiente.
- No habilitar doble escritura. Durante la transición, cada módulo debe tener una única fuente de verdad claramente definida.

## Repositorios académicos (fase de preparación)

Se añadieron repositorios SQL parametrizados para `academic_students` y `academic_companies` en `src/repositories/`, con mapeo de nombres SQL a la forma pública española que utiliza la API. Las operaciones requieren `organizationId` explícito y filtran por él en SELECT, UPDATE y DELETE; el estudiante se devuelve con su empresa asociada mediante un JOIN condicionado por el mismo tenant.

Verificación transaccional real:

```bash
npm run db:mysql:verify-repositories
```

El script crea empresa y estudiante temporales, comprueba mapeo, lectura, búsqueda, actualización, aislamiento entre dos organizaciones y eliminación; finalmente revierte la transacción. No cambia los controladores ni la fuente de verdad todavía. Los controladores Mongoose siguen activos hasta completar la migración coordinada de prácticas, actividades, evidencias, evaluaciones, informes y administración.


## Espacios de trabajo por curso — migración 003

La operación de asignaturas se modela separada de las prácticas empresariales. Un profesor puede impartir varios cursos dentro de una organización y solo verá los cursos en los que tenga una asignación activa.

La migración `003_course_workspaces.sql` añade:

| Tabla | Responsabilidad |
|---|---|
| `academic_courses` | Catálogo de cursos por organización |
| `academic_course_teachers` | Relación profesor↔curso, con estado independiente |
| `academic_course_students` | Matrícula de estudiantes por curso |
| `academic_course_resources` | Documentos y materiales cargados en cada curso |
| `academic_course_activities` | Actividades, instrucciones, publicación y fechas del curso |
| `academic_course_evidences` | Entregas de estudiantes asociadas a actividades del curso |
| `academic_course_evaluations` | Calificaciones y retroalimentación por curso/estudiante |

Todas las tablas llevan `organization_id`. Las relaciones internas usan claves foráneas compuestas para impedir mezclar cursos, estudiantes, actividades y evidencias de organizaciones distintas. La asignación del profesor guarda su ID de usuario de MongoDB; la aplicación debe validar la membresía institucional activa con rol `tutor` antes de asignarlo o permitirle operar.

Los binarios de documentos y evidencias seguirán en almacenamiento de archivos; SQL guarda metadatos y nombres almacenados. Los documentos del curso admiten hasta 25 MiB y las evidencias hasta 10 MiB según las restricciones de esquema.

### Estado de esta fase

- La migración y el verificador transaccional preparan y prueban el esquema, sin introducir datos permanentes.
- El comando `npm run db:mysql:verify-courses` comprueba asignación de profesor, matrícula, documento, actividad, evidencia, evaluación, resumen por curso y rechazo de referencias cruzadas entre organizaciones.
- Esta migración no cambia la fuente de verdad de las rutas existentes ni habilita todavía pantallas o cargas de archivos. Los endpoints y la interfaz se implementarán por etapas después de validar el esquema.

## Datos demostrativos y consulta de cursos — 2026-11-05

Se creó un conjunto inicial idempotente para validar el espacio de cursos en la Universidad de Cartagena. Los registros están identificados explícitamente como demostrativos:
- Una ficha académica relacional para la cuenta existente del estudiante, enlazada mediante su ObjectId de MongoDB; código `DEMO-LDR-001`.
- Tres cursos: Ingeniería de Software 4_9, Desarrollo de Software Web y Base de Datos II, cada uno con asignación de la cuenta docente existente y matrícula del estudiante.
- Dos actividades publicadas por curso, con instrucciones y fechas de trabajo de demostración.
- Tres recursos PDF por curso (guía de inicio, uso responsable de IA y plantilla de informe). Los binarios se guardan en `storage/course-resources`; MariaDB almacena metadatos y referencias.
- No se crean empresas, prácticas empresariales, entregas ni calificaciones ficticias.

El script reproducible es `npm run seed:academic-demo`; utiliza IDs estables y operaciones idempotentes. Antes de escribir, comprueba que las cuentas y membresías de estudiante/tutor y la organización estén activas.

La consulta se expone mediante:
- `GET /api/organization/courses`: devuelve cursos, actividades y recursos según la membresía institucional activa.
- `GET /api/organization/courses/:courseId/resources/:resourceId/download`: descarga un PDF solo si el usuario tiene matrícula o asignación docente en ese curso.
- `GET /api/organization/ai-assistant`: devuelve el perfil y las plantillas de Agnes Académica.

La vista `/courses.html` permite consultar los cursos y descargar recursos. El perfil de Agnes y sus cinco plantillas se guardan en MongoDB (`taskflow_ai_profiles` y `taskflow_ai_prompt_templates`). **La conexión a un proveedor de IA sigue pendiente**; no se almacena una API key ni se simula una conexión activa.

Verificación posterior a la carga: 1 estudiante, 3 cursos, 3 asignaciones docentes, 3 matrículas, 9 recursos y 6 actividades. Evidencias y evaluaciones permanecen en cero hasta que exista una entrega o valoración real. El verificador transaccional de cursos pasó y la suite automatizada registró 63 pruebas aprobadas.
