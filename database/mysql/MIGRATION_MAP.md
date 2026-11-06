# TaskFlow — mapa de migración académica a MySQL

Fecha de inspección: 2026-11-04.

## 1. Contrato actual de la API

Las rutas institucionales se encuentran en `src/routes/organization-context.routes.js` y conservan los nombres de campo en español que consume el frontend. La migración debe mantener las respuestas `{ ok: true, data: { estudiantes|empresas } }`, los IDs de 24 caracteres y los códigos de error existentes.

### Estudiantes: API → SQL

| API / Mongo actual | MySQL `academic_students` | Conversión |
|---|---|---|
| `_id` | `id` | ObjectId como cadena de 24 caracteres |
| `organizationId` | `organization_id` | ID de organización validado por middleware Mongo |
| `codigo` | `student_code` | trim + mayúsculas |
| `nombre` | `full_name` | texto |
| `email` | `email` | trim + minúsculas |
| `telefono` | `phone` | texto, default vacío |
| `programa` | `program` | texto |
| `semestre` | `semester` | entero 1–12 |
| `estado` | `status` | `activo` / `inactivo` |
| `usuario` | `user_id` | referencia externa Mongo, nullable |
| `empresa` | `company_id` | FK compuesta dentro de la misma organización |
| `tutor` | `tutor_user_id` | referencia externa Mongo, nullable |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` | DATETIME(3) |

### Empresas: API → SQL

| API / Mongo actual | MySQL `academic_companies` | Conversión |
|---|---|---|
| `_id` | `id` | ObjectId como cadena de 24 caracteres |
| `organizationId` | `organization_id` | ID de organización validado por middleware Mongo |
| `razonSocial` | `legal_name` | texto |
| `nit` | `tax_id` | texto, conservar ceros y formato |
| `sector` | `sector` | texto, default vacío |
| `direccion` | `address` | texto, default vacío |
| `ciudad` | `city` | texto |
| `contactoNombre` | `contact_name` | texto, default vacío |
| `contactoEmail` | `contact_email` | texto normalizado |
| `telefono` | `phone` | texto, default vacío |
| `estado` | `status` | `activa` / `inactiva` |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` | DATETIME(3) |

Las respuestas deben reconstruir el formato público actual (`_id`, `razonSocial`, `nit`, `contactoNombre`, `empresa` poblada, etc.) para no obligar a reescribir `public/js/admin.js`, `public/js/practices.js` ni consumidores posteriores durante esta fase.

## 2. Dependencias que impiden migrar solo dos controladores

La inspección encontró dependencias directas de los modelos Mongoose `Student` y `Company` fuera de sus CRUD:

- `practice.controller.js`: crea, consulta, actualiza y elimina prácticas; popula estudiante y empresa; valida la empresa y actualiza relaciones del estudiante.
- `activity.controller.js`: resuelve estudiante y prácticas para permisos/visibilidad; popula estudiantes en resultados.
- `evidence.controller.js`: resuelve el estudiante autenticado y popula datos del estudiante.
- `evaluation.controller.js`: resuelve estudiante y popula datos académicos.
- `report.controller.js`: popula estudiante y empresa para informes.
- `user.controller.js`: consulta estudiantes asociados a cuentas al gestionar usuarios.
- `admin.routes.js`: el resumen administrativo consulta modelos académicos directamente.
- `company.controller.js` y `student.controller.js`: validan referencias y bloquean eliminaciones cuando existen estudiantes/prácticas relacionadas.

Por tanto, cambiar únicamente `student.controller.js` y `company.controller.js` dejaría prácticas, evidencias, evaluaciones, informes y paneles consultando colecciones Mongo vacías. No se debe activar ese corte parcial.

## 3. Orden técnico seguro

1. Crear repositorios SQL y mapeadores API↔SQL para estudiantes/empresas; añadir pruebas de repositorio contra MariaDB.
2. Migrar en el mismo corte vertical los consumidores que necesitan esas entidades para que no dependan de `populate()` Mongoose: prácticas y sus validaciones; después actividades, evidencias, evaluaciones e informes según dependencias.
3. Mantener MongoDB como autoridad de identidad, organización y membresía. Antes de cada operación académica se usa `req.organization`/`req.user` ya validados por `requireOrganization`; SQL recibe `organization_id` desde ese contexto, nunca desde el body.
4. Mantener IDs de usuario/tutor como referencias externas; comprobar cuenta y membresía activa en Mongo cuando se asignen.
5. Conservar el almacenamiento binario de evidencias; MySQL guarda solo metadatos.
6. Retirar modelos/consultas académicas Mongoose únicamente después de pruebas de regresión y recorrido autenticado completo. No implementar doble escritura.

## 4. Reglas de seguridad y compatibilidad

- Toda consulta SQL debe filtrar por `organization_id`, incluso si la ruta ya exige una organización.
- No aceptar `organization_id` enviado por el cliente.
- Las relaciones estudiante↔empresa y práctica↔estudiante/empresa deben validar organización; las FK compuestas SQL son la última barrera.
- Preservar unicidad de código/correo de estudiante y NIT de empresa por organización.
- Preservar los estados y códigos de error de la API; mapear duplicados SQL (`ER_DUP_ENTRY`) a errores 409 comprensibles.
- Las rutas globales heredadas `/api/admin/*` necesitan una decisión explícita de compatibilidad, pues comparten controladores pero no siempre establecen `req.organization`. No deben convertirse en una vía para consultar todos los tenants.
- No hay datos académicos existentes en las colecciones Mongo inspeccionadas (conteo previo: cero); no se requiere copiar registros en esta fase.

## 5. Estado

- Esquema y migraciones MySQL: aplicados y verificados.
- Conexión MongoDB y MySQL: conectadas.
- CRUD académico operativo: todavía en MongoDB.
- Cambio de fuente de verdad: no realizado.
- Siguiente incremento de código: repositorios/mapeadores y pruebas SQL; migración coordinada de consumidores, no un reemplazo aislado de dos controladores.
