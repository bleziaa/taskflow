# Bitácora técnica — TaskFlow

Última actualización: 2 de noviembre de 2026

## Arquitectura multi-organización

### Decisiones confirmadas
- **Organización** representa a la institución cliente que utiliza TaskFlow.
- **Empresa de prácticas** es una entidad distinta, registrada dentro del contexto de una organización.
- Una cuenta global puede pertenecer a varias organizaciones.
- La membresía guarda el rol y estado del usuario dentro de cada organización; no cambia el rol global de la cuenta.
- El administrador general conserva la administración global de la plataforma.
- Las organizaciones inactivas no admiten nuevas asignaciones.
- Se evita borrar cuentas globales al retirar una membresía.

### Implementado
- [x] Modelo `Organization` con nombre, código único, descripción, contacto, ubicación y estado.
- [x] Modelo `OrganizationMembership` con relación usuario-organización, rol institucional y estado.
- [x] Índice único para impedir que una cuenta tenga dos membresías duplicadas en la misma organización.
- [x] Endpoints de administrador general para listar, crear, consultar y actualizar organizaciones.
- [x] Endpoints para consultar cuentas disponibles, asignar miembros, cambiar rol/estado y retirar una membresía.
- [x] Resumen por organización con miembros activos y administradores asignados.
- [x] Página de Organizaciones conectada al backend: alta de instituciones, directorio, búsqueda, detalle y gestión básica de miembros.
- [x] Pruebas automatizadas para permisos, creación, métricas, membresías múltiples y desactivación.
- [x] Validación de sintaxis JavaScript y rutas.

### Pendiente — no considerar multi-tenant terminado
- [ ] Definir cómo se selecciona la organización activa al iniciar sesión.
- [ ] Crear middleware de contexto institucional y autorización por membresía.
- [ ] Añadir referencia de organización a empresas, estudiantes, prácticas, actividades, evidencias y evaluaciones.
- [ ] Diseñar una migración explícita para registros académicos preexistentes. No asignar datos antiguos automáticamente a una institución sin confirmación.
- [ ] Aplicar filtros por organización en todos los controladores, informes, descargas y consultas.
- [ ] Crear panel institucional con analítica, miembros, administradores y configuración conectados a datos reales.
- [ ] Completar la gestión de usuarios institucionales desde su módulo propio.
- [ ] Añadir pruebas de aislamiento: una organización no puede consultar ni modificar registros de otra.

## Seguridad y datos existentes
Los registros académicos actuales todavía no tienen una organización propietaria. Por eso, el trabajo de esta fase no los migra ni afirma que estén aislados por institución. Hasta completar el contexto institucional y la migración revisada, las rutas académicas existentes conservan su comportamiento previo. No se debe habilitar uso multiinstitucional en producción antes de cerrar los pendientes de aislamiento.

## Validación
- Pruebas de organizaciones: 4 casos añadidos, todos aprobados.
- Suite completa: 56 pruebas aprobadas, 0 fallidas.
- Base de datos real: no se ejecutó migración ni se alteraron registros existentes durante esta fase.


## Identidad visual — 2 de noviembre de 2026

### Implementado en esta fase
- [x] Modelo MongoDB `Branding` con ámbitos separados: `platform` y `organization`.
- [x] Configuración global: nombre visible, bienvenida, logo por URL, texto alternativo, color principal, secundario, acento y fondo de acceso por URL.
- [x] Configuración por organización: nombre visible, bienvenida, logo, color secundario/acento y fondo; el color principal morado de TaskFlow permanece fijo.
- [x] Endpoints protegidos bajo `/api/admin/branding`; escritura con CSRF y acceso limitado al administrador general.
- [x] Validación de colores hexadecimales y URLs HTTP/HTTPS; no se aceptan protocolos ejecutables.
- [x] Editor de identidad visual con selector de ámbito, selector de organización, vista previa y guardado/descartar cambios.
- [x] Configuraciones de marca almacenadas en MongoDB por separado de las entidades académicas/relacionales.
- [x] Las imágenes se referencian por URL; no se almacenan binarios dentro de MongoDB.
- [x] Tres pruebas automatizadas de branding aprobadas: permisos, separación global/institucional, validación de colores y URLs.

### Límites actuales
- El editor institucional lo opera por ahora el administrador general. No se habilitó acceso a administradores institucionales porque aún falta el contexto institucional activo y la autorización por membresía.
- El logo y el fondo se configuran mediante URL; todavía no existe carga directa de archivos ni almacenamiento de objetos.
- La configuración se persiste, pero todavía no se aplica automáticamente a todas las pantallas públicas/autenticadas. Falta el consumidor de branding en login, navegación y paneles.
- La identidad institucional no modifica permisos ni completa el aislamiento multi-tenant.
- No se migraron datos académicos ni se cambió la fuente de verdad relacional.

### Validación
- `node --check` aprobado para controlador, rutas y JavaScript del editor.
- `node --test tests/branding.test.js`: 3 aprobadas, 0 fallidas.
- La suite completa no pudo validarse en este entorno: varios tests antiguos fuerzan una ruta de MongoDB para Windows (`C:\\Program Files\\MongoDB...`) que no existe en CachyOS. No se atribuye ese fallo a la nueva funcionalidad; queda pendiente corregir la configuración de MongoMemoryServer en esos tests y repetir la suite.


## Carga directa de imágenes de identidad — 2 de noviembre de 2026

### Implementado
- [x] Se sustituyeron los campos de URL por controles para subir logotipo y fondo directamente desde el equipo.
- [x] Vista previa de logotipo y fondo dentro del editor; acciones para quitar imágenes.
- [x] Límite de 10 MB por archivo, validado en navegador y servidor.
- [x] Formatos admitidos: JPEG, PNG y WEBP. El servidor comprueba MIME y firma binaria real.
- [x] Subida multipart con Multer en memoria, CSRF y sesión de administrador.
- [x] En desarrollo, archivos guardados localmente en `storage/branding/` con nombres UUID; publicados mediante `/media/branding/`.
- [x] En producción, adaptador Cloudinary preparado; requiere `CLOUDINARY_CLOUD_NAME` y `CLOUDINARY_UPLOAD_PRESET` en variables de entorno.
- [x] MongoDB guarda URL y metadatos (proveedor, nombre/public ID, MIME y tamaño), nunca el binario.
- [x] Archivos de branding excluidos de Git mediante `.gitignore`.
- [x] Al reemplazar o quitar una imagen local, se elimina el archivo anterior.
- [x] Se corrigió la configuración de MongoMemoryServer en pruebas antiguas: se retiraron rutas absolutas de mongod de Windows, dejando que el paquete gestione su binario. Esto permitió ejecutar la suite en CachyOS.

### Validación
- `node --test tests/branding.test.js`: 5 aprobadas, 0 fallidas.
- `npm test`: 27 aprobadas, 0 fallidas.
- Editor HTML y JS responden HTTP 200; API de branding sin sesión responde 401.
- Health del servidor confirma MongoDB conectado.
- Servidor reiniciado con los cambios cargados.

### Pendiente para producción
- Configurar las dos variables de Cloudinary en el entorno de despliegue y crear un unsigned upload preset restringido a imágenes y al tamaño máximo esperado.
- El entorno de desarrollo actual usa almacenamiento local. No se ha configurado ni probado una cuenta Cloudinary real.
- La eliminación remota de recursos Cloudinary requiere implementar una operación firmada de borrado; por ahora el botón quitar limpia la referencia de MongoDB y elimina el archivo local cuando corresponde.

## Presets de universidades para probar identidad institucional — 2 de noviembre de 2026

- [x] Se añadió un selector de demostraciones para Universidad de Cartagena, Universidad Nacional de Colombia y Universidad del Atlántico.
- [x] Cada preset carga nombre, mensaje, logotipo y paleta de ejemplo en la vista previa.
- [x] Los logotipos se muestran desde recursos públicos encontrados en portales institucionales o repositorios de imágenes; no se copian ni se registran como activos de TaskFlow.
- [x] La demostración no crea organizaciones ni modifica la base de datos. Se bloquea el guardado mientras está activa.
- [x] El usuario puede limpiar la demostración y volver a la configuración real.
- [x] Prueba de sintaxis JavaScript aprobada; `tests/branding.test.js`: 5 aprobadas; editor HTML y JS responden HTTP 200.
- Nota: los colores de las tarjetas son propuestas visuales de demostración, no una certificación de la paleta oficial de cada universidad. Para uso real deben validarse con los manuales institucionales. La identidad de la Universidad Nacional tiene restricciones de uso institucional, por lo que el preset es únicamente demostrativo.


## Identidades institucionales cargadas (2 nov 2026)
- Se crearon las organizaciones reales Universidad de Cartagena (`UDEC`), Universidad Nacional de Colombia (`UNAL`) y Universidad del Atlántico (`UNIATLANTICO`) en la base local `taskflow`, usando como creador el administrador ya asociado al branding global.
- Se cargaron en almacenamiento local los PNG de Universidad de Cartagena (`storage/branding/unicartagena.png`) y Universidad del Atlántico (`storage/branding/uniatlantico.png`), y se asociaron a sus documentos `Branding` institucionales.
- Atribución/licencia de logos: Universidad de Cartagena: Esteban B.H., “Logo Oficial Unicartagena”, Wikimedia Commons, CC BY-SA 4.0, https://commons.wikimedia.org/wiki/File:Logo_Oficial_Unicartagena.png. Universidad del Atlántico: “Imagotipo Universidad del Atlántico”, fuente declarada Manual de Identidad Visual UniAtlántico (junio 2024), Wikimedia Commons, CC BY-SA 4.0, https://commons.wikimedia.org/wiki/File:Imagotipo_Universidad_del_Atl%C3%A1ntico.png. Los archivos se conservaron sin modificación.
- El logo de Universidad Nacional de Colombia quedó pendiente (`logoUrl` vacío). Aunque el usuario confirmó que cuenta con autorización, la guía oficial establece que el logosímbolo debe solicitarse a Unimedios y contar con su aval; se debe usar el archivo institucional autorizado que proporcione el usuario, sin sustituirlo por una versión no verificada. Referencia: https://identidad.unal.edu.co/guia-identidad-visual/b-directrices-y-especificaciones/b1-elementos-de-identidad-visual/.
- Las tres identidades conservan `primaryColor: #6d4bd1` de TaskFlow; los colores secundarios/acento son ajustes de presentación para la vista de marca y deben validarse contra los manuales institucionales antes de uso oficial.
- Alcance: cambios solo en la base Mongo local `taskflow`; no se crearon membresías ni se migraron datos académicos. Los logos locales son servidos por `/media/branding/`.


## Fase siguiente — Gestión global de usuarios y membresías (2 nov 2026)
- [x] Se reemplazó el placeholder `public/admin-usuarios.html` por un módulo funcional conectado a la API.
- [x] Directorio de cuentas con búsqueda por nombre/correo y filtro por rol base.
- [x] Métricas de cuentas, organizaciones y administradores institucionales activos.
- [x] Formulario para crear cuentas de estudiante/tutor; la contraseña inicial exige mínimo 12 caracteres según el validador backend.
- [x] Vista de detalle por cuenta que reúne sus membresías de las organizaciones existentes.
- [x] Asignación de una cuenta a una organización activa con rol institucional independiente.
- [x] Cambio de rol y activación/desactivación de membresías desde el detalle de cuenta.
- [x] Estilos responsive y compatibles con variables de tema existentes.
- [x] Se mantuvo la administración de cuentas globales separada de las membresías. No se crearon cuentas ni se asignaron miembros automáticamente.

### Validación
- `node --check public/js/admin-usuarios.js` aprobado.
- `node --test tests/organizations.test.js tests/branding.test.js`: 9 aprobadas, 0 fallidas.
- `npm test`: 27 aprobadas, 0 fallidas.
- `admin-usuarios.html`, `admin-usuarios.js` y `admin.css` responden HTTP 200 en el servidor local.

### Pendiente / siguiente bloque
- El módulo de usuarios está disponible para el administrador general. No se ha autorizado a administradores institucionales a entrar aún: falta el selector de organización activa, middleware de membresía y protección de todas las rutas.
- No se considera completado el aislamiento multi-tenant. Los controladores académicos siguen pendientes de recibir `organizationId` y filtros de pertenencia; los datos antiguos no se han migrado.
- Falta integrar el branding en login y navegación, una vez que se defina cómo resolver la organización activa en cada sesión.
- No se modificó la base local de universidades durante esta fase, ni se creó ninguna membresía.

### Corrección de bitácora
- La sección anterior titulada “Presets de universidades” describe un experimento temporal que fue retirado a petición del usuario. No existe actualmente selector de demos ni presets en el editor; la configuración institucional se realiza con organizaciones reales y archivos de logo guardados como activos.

## Selector de organización activa y contexto institucional (2 nov 2026)
- [x] Se añadió `GET /api/auth/organizations`: devuelve únicamente organizaciones activas en las que la cuenta autenticada conserva una membresía activa, incluyendo el rol de esa membresía.
- [x] Se añadió `PUT /api/auth/organizations/active`: establece el contexto en la sesión solo después de comprobar en servidor la membresía activa y que la organización siga activa.
- [x] Se añadió `DELETE /api/auth/organizations/active`: limpia el contexto de organización de la sesión.
- [x] Se añadió middleware reutilizable `src/middleware/requireOrganization.js`. Obtiene el ID exclusivamente desde la sesión, vuelve a comprobar membresía y estado de organización en cada solicitud, y puede exigir roles institucionales. No confía en un `organizationId` enviado por el navegador.
- [x] Las rutas de contexto están montadas bajo `/api/auth/organizations` y requieren sesión autenticada; los cambios de contexto están protegidos con CSRF.
- [x] Pruebas nuevas `tests/organization-context.test.js`: listado filtrado por membresías activas, rechazo de organización ajena/inactiva, selección válida, sesión anónima y limpieza del contexto.
- [ ] El middleware todavía no se ha aplicado a las rutas académicas ni se ha habilitado acceso institucional. Esto se mantiene bloqueado hasta auditar y filtrar cada controlador/modelo por organización.
- [ ] El selector visual aún no se ha integrado en el frontend. La API ya permite construirlo; falta conectar login/navegación y actualizar el estado de sesión.
- Alcance: solo código local. No se crearon membresías, no se alteraron registros académicos y no se tocó producción.

## Selector de organización en la interfaz (2 nov 2026)
- [x] Se creó `public/js/organization-switcher.js`, componente compartido que consulta las organizaciones de la sesión y crea un selector accesible en la navegación.
- [x] El selector muestra el nombre y rol institucional; al cambiar, solicita token CSRF y actualiza la organización activa en la sesión mediante `PUT /api/auth/organizations/active`, y recarga la vista para aplicar el contexto nuevo.
- [x] Si la cuenta solo tiene una organización activa, la selecciona automáticamente tras validación del servidor. Si tiene varias, solicita una elección explícita. Si no tiene membresías, el selector permanece oculto para no alterar cuentas globales/antiguas.
- [x] Estilos responsive en `public/css/organization-switcher.css`.
- [x] Integrado en `dashboard.html`, `practices.html`, `activities.html`, `evaluations.html` e `reports.html`.
- [x] `node --check public/js/organization-switcher.js` y comprobación de inclusión en las cinco páginas aprobadas.
- [x] Suite completa `npm test`: 30 aprobadas, 0 fallidas.
- [ ] El selector no habilita todavía permisos institucionales ni garantiza aislamiento de registros académicos. Los modelos académicos actuales no contienen un propietario organizacional obligatorio y existen datos antiguos sin organización asignada.
- [ ] Antes de activar el aislamiento: definir migración explícita de estudiantes, empresas, prácticas, actividades, evidencias y evaluaciones; asignar propietarios solo con evidencia verificable; filtrar cada consulta y relación; bloquear registros sin organización en sesiones institucionales; probar intentos cruzados entre organizaciones.
- Seguridad: no activar administradores institucionales en rutas académicas hasta completar el bloque anterior. No se alteraron documentos ni membresías existentes.


## Auditoría de aislamiento multi-organización — 2 de noviembre de 2026
- [x] Se auditó el grafo académico: Student, Company, Practice, Activity, Evidence, Evaluation y sus relaciones principales.
- [x] Se confirmó que los modelos académicos actuales no incluyen organizationId; las consultas de los controladores siguen usando búsquedas globales por _id o filtros funcionales sin propietario institucional.
- [x] Se detectaron rutas que requieren protección antes de habilitar acceso institucional: prácticas, actividades, evidencias, evaluaciones, informes y CRUD administrativo de estudiantes/empresas.
- [x] Se creó scripts/audit-organizations.js y el comando npm run audit:organizations. Es estrictamente de solo lectura: cuenta documentos, detecta campos de organización y referencias huérfanas, lista organizaciones y membresías, y genera reports/organization-audit-dry-run.json.
- [x] Ejecución de auditoría sobre la base local taskflow: 3 organizaciones (UdeC, UNAL, UniAtlántico), 0 membresías y 0 documentos en las seis colecciones académicas inspeccionadas. No hay registros académicos existentes que migrar en esta base local.
- [x] El diagnóstico no encontró referencias huérfanas en esas colecciones (todas están vacías).
- [x] Se confirmó que no se escribió ni modificó ningún documento Mongo durante la auditoría. No se tocó producción.
- [ ] No se añadieron todavía filtros parciales ni se activaron rutas institucionales: hacerlo por partes dejaría endpoints vulnerables. La implementación debe cubrir en conjunto modelos, consultas, relaciones, agregaciones, archivos/evidencias, reportes y pruebas de acceso cruzado.
- [ ] Antes de crear los primeros datos académicos institucionales, implementar organizationId obligatorio en entidades propietarias y derivarlo exclusivamente de req.organization._id, con middleware requireOrganization en todas las rutas académicas.
- [ ] Las entidades hijas (Activity, Evidence, Evaluation) deben comprobar que el padre y el estudiante pertenecen a la misma organización; las lecturas, actualizaciones y eliminaciones deben consultar por _id + organización o por relación al padre ya acotado.
- [ ] Resolver unicidad por ámbito institucional: Student.codigo/email y Company.nit hoy son índices globales únicos; deben convertirse en índices compuestos por organizationId tras validar duplicados. No cambiar índices hasta preparar migración y pruebas.
- [ ] admin.routes.js tiene dashboard y CRUD académico globales exclusivos de administrador general. Deben separarse las operaciones de plataforma de las institucionales; no reutilizar rutas globales para administradores de institución.
- [ ] La auditoría no habilita acceso ni implica que el sistema ya esté aislado. Mantener bloqueado el acceso de administradores institucionales a módulos académicos hasta completar todas las pruebas multi-tenant.

## Preparación de modelos para aislamiento institucional — 2 de noviembre de 2026
- [x] Se añadió `organizationId` opcional (default `null`) a `Practice`, `Activity`, `Evidence` y `Evaluation`; `Student` y `Company` ya lo tenían de la intervención anterior.
- [x] Se conservó la unicidad global de `Student.codigo` y `Student.email` y de `Company.nit` mientras no estén implementados los filtros institucionales completos. No se introducen duplicados entre organizaciones antes de cerrar la seguridad de consultas.
- [x] Se verificó sintaxis de los seis modelos y se ejecutó `npm test`: 30 aprobadas, 0 fallidas.
- [ ] Esta preparación de esquema no equivale a aislamiento: `organizationId` aún permite `null`, las rutas académicas siguen sin exigir contexto y los controladores aún no filtran de forma integral. No habilitar administradores institucionales ni crear registros académicos multi-organización hasta completar la siguiente fase.
- Alcance: código local; sin migraciones ni escrituras en documentos académicos.

## Primer ajuste de consultas institucionales — 2 de noviembre de 2026
- [x] `practice.controller.js`: validación de estudiante y empresa ahora acepta el ámbito organizacional y, cuando existe contexto validado, solo encuentra relaciones dentro de `req.organization._id`.
- [x] Listado y detalle de prácticas incorporan filtro por organización cuando el middleware proporciona contexto; la búsqueda del estudiante propio también queda acotada.
- [x] Creación de prácticas valida estudiante/empresa dentro de la organización y guarda el `organizationId` derivado de `req.organization`, nunca del body.
- [x] Sintaxis verificada y `npm test`: 30 aprobadas, 0 fallidas.
- [ ] La adaptación del controlador está incompleta: actualización/eliminación, actividades, evidencias, evaluaciones, informes y CRUD institucional de estudiantes/empresas todavía requieren filtros y validación de relaciones.
- [ ] Las rutas existentes aún no exigen `requireOrganization`; no habilitar acceso institucional ni tratar este cambio como aislamiento completo. Continuar con rutas institucionales separadas y pruebas cruzadas antes de exponerlo.

## Aislamiento parcial de actividades y evidencias — 2 de noviembre de 2026
- [x] `activity.controller.js`: práctica padre consultada con `organizationId` cuando existe contexto institucional.
- [x] Listado de actividades filtra por organización y limita las prácticas de estudiantes/tutores a la misma organización.
- [x] Creación de actividades deriva `organizationId` desde `req.organization`; no acepta el propietario desde el body.
- [x] Actualización y eliminación de actividades buscan por identificador y organización; la comprobación de evidencias relacionadas también queda acotada.
- [x] `evidence.controller.js`: contexto de actividad y estudiante se consulta dentro de la organización activa.
- [x] Las evidencias nuevas guardan `organizationId`; listado, descarga y revisión consultan evidencias dentro del mismo ámbito.
- [x] La actividad actualizada al revisar evidencia se vuelve a consultar con filtro organizacional.
- [x] `node --check` aprobado para `activity.controller.js` y `evidence.controller.js`.
- [x] `npm test`: 30 aprobadas, 0 fallidas.
- [ ] Faltan pruebas específicas de acceso cruzado entre dos organizaciones; la suite existente no demuestra por sí sola el aislamiento multi-tenant.
- [ ] El middleware `requireOrganization` aún no está aplicado a estas rutas. Los filtros se activan cuando el middleware adjunta `req.organization`; las rutas actuales conservan el comportamiento anterior sin contexto.
- [ ] Pendiente revisar informes, evaluaciones, CRUD institucional de estudiantes/empresas y actualizar las rutas institucionales separadas antes de habilitar administradores institucionales.
- Alcance: cambios locales de código. No se migraron ni alteraron documentos académicos y no se tocó producción.

## Ajuste parcial de evaluaciones e informes — 2 de noviembre de 2026
- [x] `evaluation.controller.js`: práctica evaluada, listado de evaluaciones y estudiante propio incorporan filtro por organización cuando existe contexto.
- [x] El guardado de evaluación limita el upsert a práctica + organización y deriva `organizationId` desde `req.organization`.
- [x] `report.controller.js`: prácticas, actividades, evidencias y evaluaciones usadas en los informes quedan filtradas por organización cuando existe contexto.
- [x] Sintaxis de `evaluation.controller.js` y `report.controller.js` verificada; `npm test`: 30 aprobadas, 0 fallidas.
- [ ] Las rutas académicas todavía no exigen `requireOrganization`; no habilitar administradores institucionales ni considerar cerrado el aislamiento.
- [ ] Pendiente pruebas A/B de acceso cruzado, validar integridad de relaciones pobladas, adaptar CRUD institucional de estudiantes/empresas y separar rutas globales/institucionales.
- Alcance: solo código local; sin migración de datos ni cambios en producción.

## Preparación del CRUD institucional de estudiantes y empresas — 2 de noviembre de 2026
- [x] `student.controller.js`: listado y detalle filtran por `organizationId` cuando existe contexto; creación asigna organización desde `req.organization`; actualización y eliminación consultan por ID + organización.
- [x] La validación de empresa vinculada a estudiante limita la referencia a la misma organización; la comprobación de prácticas al eliminar estudiante también queda acotada.
- [x] `company.controller.js`: listado, detalle, actualización y eliminación filtran por organización cuando existe contexto; creación asigna `organizationId` desde la sesión; el conteo de estudiantes vinculados se acota al mismo ámbito.
- [x] `node --check` aprobado para ambos controladores; `npm test`: 30 aprobadas, 0 fallidas.
- [ ] No se añadieron todavía rutas institucionales para este CRUD. Las rutas `/api/admin/students` y `/api/admin/companies` siguen siendo de administración global y no deben usarse para administradores institucionales.
- [ ] Pendiente comprobar membresía del tutor asignado dentro de la organización, añadir pruebas A/B de aislamiento y crear rutas institucionales separadas con `requireOrganization('administrador')` y CSRF.
- [ ] La unicidad de código/email/NIT continúa global; no se cambian índices hasta diseñar una migración e índices compuestos seguros.
- Alcance: cambios locales de controladores; sin migraciones, sin creación de membresías y sin cambios en producción.

## Primeras rutas institucionales de estudiantes y empresas — 2 de noviembre de 2026
- [x] Se añadieron rutas institucionales separadas bajo `/api/organization/students` y `/api/organization/companies`, sin reutilizar el CRUD global de `/api/admin`.
- [x] Cada operación exige sesión autenticada y `requireOrganization('administrador')`; el middleware obtiene organización desde la sesión y revalida membresía activa y estado institucional.
- [x] Las operaciones de escritura conservan protección CSRF y los validadores de entrada existentes.
- [x] La creación de estudiantes/empresas deriva `organizationId` del contexto del servidor; el identificador enviado en el body no controla el ámbito.
- [x] La referencia de tutor ahora exige una membresía activa de rol tutor en la misma organización.
- [x] La asociación automática de cuenta estudiante por correo solo enlaza una cuenta que tenga membresía activa de rol estudiante en la organización; si no, el registro académico no se vincula a una cuenta global ajena.
- [x] Se montó el router institucional en `src/app.js` bajo `/api/organization`.
- [x] `node --check` aprobado para `student.controller.js`, `organization-context.routes.js` y `app.js`.
- [x] Suite ejecutada tras la primera conexión de rutas: 30 pruebas aprobadas, 0 fallidas.
- [ ] Faltan pruebas A/B específicas de acceso cruzado para estas nuevas rutas y pruebas de creación con referencias válidas/inválidas; la suite existente no demuestra por sí sola el aislamiento completo.
- [ ] Las rutas académicas de prácticas, actividades, evidencias, evaluaciones e informes todavía no exigen contexto institucional; no habilitar administradores institucionales para esos módulos.
- [ ] Los CRUD globales `/api/admin/students` y `/api/admin/companies` siguen reservados al administrador general.
- [ ] La unicidad global de código/email/NIT no se ha cambiado. No hay migración ni cambios en producción.
- Alcance: código local; no se crearon membresías, no se migraron documentos y no se alteró la base de datos real.

## Rutas académicas institucionales y pruebas A/B — 2 de noviembre de 2026
- [x] `requireOrganization` ahora carga la cuenta autenticada, verifica que siga activa y adjunta `req.user`; el rol efectivo de la solicitud se toma de la membresía activa de la organización, no del rol global de la cuenta.
- [x] Se expusieron rutas institucionales independientes bajo `/api/organization`: prácticas, actividades, evidencias, evaluaciones e informes, además del CRUD de estudiantes y empresas.
- [x] Cada ruta académica exige una membresía activa con rol institucional permitido. Las operaciones de escritura mantienen CSRF y validadores de entrada; las operaciones de evidencia mantienen el middleware de carga y comprobación de archivo.
- [x] Se añadieron pruebas de dos organizaciones para verificar que el listado institucional de estudiantes, empresas y prácticas solo devuelve registros del contexto activo y que consultar por ID un estudiante/práctica ajenos responde 404.
- [x] Se probó rechazo por rol institucional insuficiente para el CRUD administrativo.
- [x] `node --check` aprobado para middleware y router institucional.
- [x] `npm test`: 33 pruebas aprobadas, 0 fallidas.
- [x] `npm run audit:organizations` ejecutado en modo dry-run: 3 organizaciones, 0 membresías y 0 documentos en Student, Company, Practice, Activity, Evidence y Evaluation; `migrationReady: false`. El informe se generó en `reports/organization-audit-dry-run.json`.
- [ ] La suite A/B cubre listados y lectura cruzada de Student, Company y Practice; faltan pruebas cruzadas explícitas para Activity, Evidence, Evaluation, Reports, escrituras, descargas y referencias anidadas.
- [ ] Las rutas antiguas `/api/practices`, `/api/activities`, `/api/evaluations`, `/api/reports` y rutas de evidencias siguen existiendo para compatibilidad y conservan el esquema anterior de autorización global. Antes de habilitar miembros institucionales en producción hay que decidir su retirada/redirección o imponerles una política de compatibilidad segura para impedir que sirvan como vía alternativa de acceso global.
- [ ] Los `populate` de relaciones y las comprobaciones de pertenencia entre estudiante, tutor, práctica, actividad, evidencia y evaluación necesitan una auditoría adicional integral; no se declara aislamiento total ni se habilita producción.
- [ ] Los índices únicos globales de Student.codigo/email, Company.nit, Evidence.nombreAlmacenado y Evaluation.practica siguen sin cambios; la unicidad por organización requiere migración/índices compuestos planificados.
- Alcance: código local y base local de pruebas/auditoría; no se crearon membresías reales, no se migraron datos académicos ni se modificó producción.

## Endurecimiento de contexto y referencias institucionales — 2 de noviembre de 2026

- [x] Se corrigió `requireOrganization.js` para no mutar el documento Mongoose de usuario al aplicar el rol de membresía. Ahora adjunta a `req.user` un objeto plano de la solicitud con el rol efectivo institucional.
- [x] Se separó el router de selección de organización (`organization-selection.routes.js`) del router académico/institucional (`organization-context.routes.js`). Los endpoints de selección siguen bajo `/api/auth/organizations`; los módulos institucionales permanecen únicamente bajo `/api/organization`. Se eliminó la duplicación accidental de rutas CRUD académicas bajo `/api/auth/organizations`.
- [x] Se cerró una referencia cruzada detectada en la creación/actualización de prácticas: el tutor ahora debe tener una membresía activa con rol `tutor` en la misma organización, además de una cuenta activa con rol global tutor.
- [x] Se ejecutó `npm test` después de estos cambios: 33 pruebas aprobadas, 0 fallidas.
- [x] Se ejecutó nuevamente `npm run audit:organizations` en modo dry-run: 3 organizaciones, 0 membresías y 0 documentos en Student, Company, Practice, Activity, Evidence y Evaluation; 0 referencias huérfanas; `migrationReady: false`. Reporte actualizado en `reports/organization-audit-dry-run.json`.
- [ ] Pendiente ampliar pruebas A/B para escrituras de prácticas con tutor de otra organización, actividades, evidencias, evaluaciones, informes y descargas.
- [ ] Pendiente auditar cada `populate` y relación anidada con datos potencialmente inconsistentes (por ejemplo, una práctica con estudiante/empresa de organización distinta), y añadir validación de integridad antes de aceptar escrituras.
- [ ] Las rutas legacy globales `/api/practices`, `/api/activities`, `/api/evaluations`, `/api/reports` y evidencias siguen disponibles por compatibilidad. No habilitar membresías institucionales reales ni producción hasta imponer una política segura a esas rutas y completar pruebas de aislamiento.
- [ ] No se modificaron índices únicos, no se migraron documentos, no se crearon membresías reales y no se tocó producción.

## Cierre de acceso por rutas académicas heredadas — 2 de noviembre de 2026

- Se añadió `src/middleware/rejectLegacyOrganizationAccess.js`: las cuentas con cualquier registro de membresía institucional deben operar por `/api/organization/*`, incluso si limpian el contexto activo o su membresía está inactiva. Esto evita usar los endpoints globales antiguos como vía alternativa para consultar datos de otros tenants.
- Se aplicó la protección a las rutas heredadas de prácticas, actividades, evidencias, evaluaciones e informes. Las cuentas sin membresía conservan compatibilidad temporal con el flujo legado; el administrador general sin membresía conserva su administración global.
- Se evitó un bloqueo accidental de rutas API inexistentes: la protección de evidencias se aplica solo a sus cuatro endpoints, no a todo el prefijo `/api`.
- Se añadió prueba A/B que verifica que una cuenta institucional no puede acceder a las cinco familias de rutas globales, incluso sin organización activa.
- Verificación: `node --check` de los archivos modificados aprobado; `npm test` = 34/34 pruebas aprobadas; `npm run audit:organizations` exit 0.
- Auditoría local: 3 organizaciones, 0 membresías, 0 documentos académicos en Student/Company/Practice/Activity/Evidence/Evaluation, 0 referencias huérfanas; `migrationReady:false`. Reporte `reports/organization-audit-dry-run.json`.
- Sin migraciones, sin membresías reales, sin cambios de producción y sin escrituras en documentos académicos. Próximo bloque: pruebas A/B de creación y lectura cruzada de actividades/evidencias/evaluaciones/informes y revisión de referencias anidadas en populate.

## Aislamiento de relaciones anidadas y validación A/B — 2 de noviembre de 2026

- Se endurecieron los `populate` de actividades, evidencias, evaluaciones e informes para aplicar `match: { organizationId }` en relaciones de Student, Company y Practice cuando existe contexto institucional.
- Los listados y respuestas posteriores a escritura de actividades/evidencias/evaluaciones pasan el ID de organización al helper de población; las relaciones de otra organización no se serializan en esas respuestas.
- En evidencias, la cadena Evidence -> Activity -> Practice ahora limita cada nivel al tenant activo. Las comprobaciones de acceso continúan validando que la práctica y el estudiante correspondan al usuario.
- Se agregó prueba A/B con referencias deliberadamente inconsistentes entre organizaciones: una actividad de la institución A que apunta a una práctica de B y una práctica de A que referencia estudiante/empresa de B. La API devuelve esas relaciones como null, sin exponer sus datos.
- Verificación: `node --check` de activity/evidence/evaluation/report controllers y test actualizado aprobado; `npm test` = 35/35, 0 fallos.
- Sin cambios de datos reales, sin migraciones y sin despliegue.
- Pendiente para cerrar el bloque: pruebas específicas de subida/revisión/descarga de evidencias bajo membresías institucionales y de upsert de evaluación bajo dos organizaciones; luego auditoría final.

## Pruebas de evidencias y evaluaciones multiinstitucionales — 2 de noviembre de 2026

- Se amplió `tests/organization-context.test.js` con pruebas integrales bajo dos organizaciones.
- Evidencias: se creó una cuenta estudiante con membresía institucional, se seleccionó su organización, se cargó un PDF de prueba por el endpoint institucional, y un administrador de esa organización lo revisó y descargó. Se verificó que intentar descargar una evidencia de la segunda organización devuelve 404.
- Evaluaciones: se crearon prácticas independientes en dos organizaciones, se guardó una evaluación en cada contexto y se verificó que la lista y el informe solo devuelven la evaluación de la organización activa. La evaluación de la primera organización permaneció intacta al cambiar de contexto.
- Verificación: `node --check tests/organization-context.test.js` aprobado; `npm test` = 37/37, 0 fallos.
- Estas pruebas usan MongoMemoryServer y almacenamiento temporal de pruebas; no generan datos académicos reales.
- Pendiente: revisar índices/constraints multi-organización y validar todos los endpoints legacy/institucionales con matriz de roles antes de conectar el frontend. Sin migraciones ni despliegue.

## Integridad de índices y matriz de permisos — 2 de noviembre de 2026

- Se corrigió `requireRole` para que, cuando una ruta institucional ya validó la membresía, las comprobaciones posteriores respeten el rol efectivo de esa organización en lugar de sustituirlo por el rol global de la cuenta.
- Se retiró la unicidad global de `Student.codigo`, `Student.email` y `Company.nit`; se definieron índices únicos compuestos por `organizationId` + identificador, con filtro para documentos que ya tienen un ObjectId de organización. Así dos instituciones pueden registrar su propio estudiante/empresa, pero no duplicar esos identificadores dentro de sí mismas.
- Se sustituyó la unicidad declarativa global de `Evaluation.practica` por índice único compuesto `organizationId + practica` para documentos institucionales.
- Se endurecieron poblaciones anidadas de prácticas, estudiantes y evidencias para que empresa, estudiante y práctica relacionados también pertenezcan al tenant activo.
- Se añadió prueba de índices: códigos y correos de estudiantes y NIT pueden repetirse entre organizaciones distintas, pero se rechazan duplicados dentro de la misma organización.
- Verificación final: `npm test` = 38/38, 0 fallos; `npm run audit:organizations` ejecutado correctamente. Auditoría local: 3 organizaciones, 0 membresías, 0 documentos académicos y 0 referencias huérfanas.
- Importante: los índices antiguos ya creados en una base persistente no se eliminan automáticamente al cambiar los esquemas. Hace falta una migración de índices controlada (revisar nombres y definiciones actuales, respaldo y ejecución aprobada) antes de activar datos institucionales. No se ejecutó ninguna migración ni se modificaron datos persistentes.
- Estado: esquema y pruebas preparados; migración de índices, matriz exhaustiva de roles para todas las combinaciones y pruebas con datos académicos reales siguen pendientes. No desplegado.

## Diagnóstico de índices y matriz de roles — 2 de noviembre de 2026

- Se añadió `scripts/audit-organization-indexes.js` y el comando `npm run audit:organization-indexes`. Es estrictamente de solo lectura: inspecciona índices reales con `listIndexes()`, busca duplicados por claves compuestas y genera `reports/organization-index-migration-dry-run.json`. No ejecuta createIndex ni dropIndex.
- Diagnóstico en Mongo local `taskflow`: colecciones students/companies/evaluations con 0 documentos; no se encontraron grupos duplicados. Los índices compuestos nuevos ya aparecen presentes y sus definiciones coinciden con los esquemas. Siguen presentes índices únicos antiguos: students `codigo_1`, `email_1`; companies `nit_1`; evaluations `practica_1`. Esos índices antiguos deben retirarse en una migración aprobada, porque aún imponen unicidad global. No se retiraron.
- Resultado: 0 bloqueos por duplicados; seguro preparar la migración, pero no se ejecutó. Se requiere respaldo y aprobación explícita para eliminar índices antiguos en la base persistente.
- Se añadió prueba de matriz de roles para administrador, tutor y estudiante sobre consulta de estudiantes, creación de actividades, evaluaciones y entrega de evidencias. Se verificó que el rol institucional, no el rol global, determina los permisos.
- Verificación final: `npm test` = 39/39 aprobadas, 0 fallos. `node --check` de script de diagnóstico y prueba pasó.
- Pendiente antes de habilitar producción: revisar los índices de base persistente y su respaldo, aprobar/ejecutar migración, auditar todos los endpoints administrativos globales, y validar roles con cuentas reales de prueba. Sin despliegue ni cambios de datos académicos.

## Auditoría de administración global y protección de membresías — 3 de noviembre de 2026

- [x] Se revisó el montaje de `/api/admin`: todas sus rutas heredan autenticación y rol global `administrador`; el rol institucional de una membresía no concede acceso a la administración global.
- [x] Se añadieron pruebas que verifican que una cuenta con rol global tutor y membresía institucional de administrador recibe 403 en dashboard, estudiantes, empresas, usuarios, organizaciones y branding global; el administrador general conserva acceso (200).
- [x] Se detectó un riesgo de integridad al eliminar cuentas: el controlador comprobaba relaciones con estudiantes, pero no membresías. Una cuenta podía borrarse dejando asignaciones institucionales huérfanas.
- [x] Se corrigió `user.controller.js`: antes de eliminar una cuenta se comprueban también todas sus membresías (activas e inactivas). Si existen, la API responde 409 `USER_HAS_MEMBERSHIPS`; primero deben retirarse las membresías.
- [x] Pruebas añadidas para ambos comportamientos: separación de administración global/institucional y bloqueo de eliminación de cuentas con membresías.
- [x] Validación final: `npm test` = 41 aprobadas, 0 fallidas. `node --check` de los archivos modificados aprobado.
- [x] Auditoría organizacional dry-run: 3 organizaciones, 0 membresías y 0 documentos académicos en Student/Company/Practice/Activity/Evidence/Evaluation; 0 referencias huérfanas; `migrationReady: false`.
- [x] Auditoría de índices dry-run: índices compuestos deseados presentes y coincidentes; 0 grupos duplicados; siguen presentes índices únicos antiguos `students.codigo_1`, `students.email_1`, `companies.nit_1` y `evaluations.practica_1`. No se ejecutó ninguna operación de escritura.
- Alcance: cambios locales en código y pruebas. No se crearon membresías reales, no se migraron datos, no se eliminaron índices ni se modificó producción.
- Próximo bloque: auditoría detallada de operaciones de gestión de membresías (último administrador institucional, usuario desactivado, organización inactiva y consistencia de asignaciones), y revisión de los flujos de administración de cuentas antes de habilitar uso institucional real.

## Protección de membresías y ciclo de vida institucional — 3 de noviembre de 2026

- [x] Se agregó una validación en la gestión de membresías para impedir degradar, desactivar o retirar al último administrador institucional activo.
- [x] La API responde 409 con código `LAST_ORGANIZATION_ADMIN` y exige asignar primero otro administrador activo.
- [x] Se verificó el caso positivo: si hay dos administradores activos, se permite cambiar el rol de uno y permanece uno activo.
- [x] Se añadieron pruebas de sesión persistente: un usuario desactivado pierde acceso institucional (401) aunque conserve cookie/sesión y membresía.
- [x] Se añadieron pruebas de sesión persistente: al desactivar una organización, las operaciones académicas quedan bloqueadas (403, `ORGANIZATION_INACTIVE`); la selección de organización también filtra organizaciones inactivas.
- [x] Validación final: `npm test` = 45 pruebas aprobadas, 0 fallidas. Archivos modificados pasan `node --check`.
- [x] No se cambiaron datos reales de organizaciones, usuarios ni membresías. Pruebas ejecutadas sobre MongoMemoryServer.
- Consideración técnica pendiente: la protección del último administrador valida el conteo antes de actualizar/eliminar. Para blindar también carreras concurrentes de dos solicitudes simultáneas, evaluar serialización/operación transaccional antes de producción.
- Próximo bloque: auditoría de concurrencia y ciclo de vida de membresías; revisar consistencia al reactivar organizaciones/usuarios y política de reasignación de administrador. Después preparar checklist de migración con respaldo y aprobación explícita.

## Serialización de cambios de membresías — 3 de noviembre de 2026

- [x] Se verificó la topología de la MongoDB local: servidor standalone (sin replica set y sin capacidad de transacciones). Se descartó implementar transacciones como requisito porque romperían el entorno local actual.
- [x] Se implementó un bloqueo atómico por organización usando `findOneAndUpdate` sobre el propio documento de Organization. Las modificaciones de membresías pasan por ese bloqueo antes de leer/verificar/actualizar o retirar una membresía.
- [x] Dos degradaciones simultáneas quedan serializadas: una se procesa y la otra recibe conflicto; la prueba confirma que queda exactamente un administrador activo.
- [x] Se añadió prueba de bloqueo ocupado: la API devuelve 409 `ADMIN_GUARD_BUSY` y no modifica la membresía.
- [x] Se conserva la protección `LAST_ORGANIZATION_ADMIN` para degradar, desactivar o retirar al último administrador.
- [x] Validación final: `npm test` = 47 pruebas aprobadas, 0 fallidas; verificaciones `node --check` correctas.
- [x] Los campos `adminGuardLockOwner` y `adminGuardLockAt` son opcionales; no requieren migración ni modificación de documentos existentes.
- [!] Recuperación segura: el bloqueo se libera en `finally`. Si el proceso muere abruptamente mientras lo posee, queda retenido deliberadamente (fail-closed) y requiere inspección operativa antes de liberarlo; no se aplica expiración automática que pudiera permitir una carrera si el proceso sigue ejecutándose.
- [ ] Antes de producción: añadir procedimiento administrativo documentado para inspeccionar y liberar bloqueos huérfanos con comprobación de que no hay operación activa.
- [ ] Próximo bloque: revisar coherencia de activación/desactivación de usuarios y organizaciones, y preparar la migración institucional con respaldo y autorización explícita.

## Cierre de sesión al desactivar cuentas y reactivación controlada — 3 de noviembre de 2026

- [x] Se detectó que `requireAuth` verificaba únicamente la existencia de `session.userId`; una cuenta desactivada podía conservar una sesión válida en endpoints que no pasaban por `requireOrganization`.
- [x] Se reforzó `src/middleware/requireAuth.js`: cada solicitud protegida consulta el estado actual de la cuenta. Si el usuario fue eliminado o desactivado, destruye la sesión, limpia la cookie y responde 401 (`UNAUTHORIZED` o `ACCOUNT_DISABLED`). Esto también protege selección institucional y administración global.
- [x] Se añadieron pruebas para comprobar que una sesión previamente abierta pierde acceso a selección de organizaciones y rutas globales inmediatamente después de desactivar la cuenta.
- [x] Se probó la reactivación de una cuenta: la sesión invalidada no revive; el usuario debe autenticarse nuevamente. Tras volver a entrar, solo aparecen las membresías que permanecen activas y no puede seleccionar una membresía inactiva.
- [x] Se probó el ciclo de una organización: al desactivarla desaparece del selector; al reactivarla, vuelve a estar disponible únicamente para membresías activas. La operación no reactiva membresías inactivas.
- [x] Pruebas focalizadas de organizaciones: 15 aprobadas, 0 fallidas. Suite completa final: 50 pruebas aprobadas, 0 fallidas (incluye la prueba de reactivación institucional).
- [x] No se modificaron usuarios, organizaciones ni membresías de la base local persistente; las pruebas utilizan MongoMemoryServer.
- [ ] Consideración operativa: la validación de cuenta activa en `requireAuth` consulta MongoDB por cada solicitud autenticada. Si más adelante se optimiza con caché, debe conservarse revocación inmediata o un TTL muy corto y probado.
- [ ] Antes de producción sigue pendiente documentar y probar la recuperación manual de bloqueos `adminGuardLockOwner` huérfanos; no liberar automáticamente por antigüedad.


## Diagnóstico y recuperación controlada de bloqueos administrativos — 3 de noviembre de 2026

- [x] Se amplió el bloqueo de membresías con metadatos de proceso: PID y hostname, además del owner UUID y fecha. Estos campos son opcionales y `select: false`; no requieren migración ni cambian documentos que no tengan bloqueos.
- [x] Se añadió `scripts/recover-organization-lock.js` y `npm run recover:organization-lock`. El modo predeterminado es estrictamente de solo lectura y permite inspeccionar todos los bloqueos o una organización específica.
- [x] La liberación requiere `--release`, un ObjectId explícito y `--confirm` con el mismo ObjectId. Solo libera si el bloqueo tiene PID/host, pertenece al host actual y el PID ya no existe. La actualización compara owner, PID, host y fecha para evitar borrar un bloqueo que haya cambiado durante el diagnóstico.
- [x] Si el proceso propietario sigue activo, pertenece a otro host o el bloqueo es legado y no tiene metadatos, el script se niega a liberar. No existe liberación automática por antigüedad. Los bloqueos legados requieren mantenimiento manual coordinado: detener todas las instancias, verificar que no haya operaciones en curso y revisar el documento antes de retirar los campos.
- [x] Comandos documentados: `npm run recover:organization-lock`; `npm run recover:organization-lock -- --organization <ID>`; y, únicamente tras confirmar que el PID propietario ya terminó, `npm run recover:organization-lock -- --organization <ID> --release --confirm <ID>`.
- [x] `node --check` aprobado para script, controlador y modelo; `npm run recover:organization-lock` ejecutado en modo solo lectura: 0 bloqueos encontrados, 0 escrituras.
- [x] `npm test`: 50 pruebas aprobadas, 0 fallidas. Servidor reiniciado y MongoDB reconectada.
- [ ] Antes de producción, probar este procedimiento en un entorno de staging con un bloqueo de prueba y validar la coordinación cuando existan varias instancias/hosts.
- [ ] No se liberó ni modificó ningún bloqueo real durante esta implementación.

## Claridad del panel de organizaciones y selector de miembros — 3 de noviembre de 2026

- [x] Se revisó el flujo real de «Cuenta existente»: no crea usuarios, solo vincula una identidad ya registrada a una organización.
- [x] Se confirmó que «Administrador Demo» (sin membresías) y «Administrador de Prueba» (con membresía de tutor en Universidad del Atlántico) son cuentas globales de rol administrador. No se borraron ni modificaron sus registros.
- [x] El selector de miembros ahora ofrece únicamente cuentas activas cuyo tipo global sea docente/tutor o estudiante. El administrador institucional se sigue asignando como rol de la membresía, sin mezclarlo con el administrador general de la plataforma.
- [x] Se aclaró el texto del formulario para explicar qué cuenta puede seleccionarse y que el rol elegido aplica solo a esa institución.
- [x] Se agregó feedback junto al formulario de asignación, estado «Asignando…», bloqueo temporal del botón y desplazamiento al mensaje de error para evitar que el resultado quede oculto al final de la página.
- [x] Se aclaró en Usuarios que la cuenta es una identidad global y que sus instituciones/roles se gestionan desde «Gestionar».
- [x] Se añadió prueba de integración para verificar que el selector excluye administradores generales y conserva docentes/estudiantes. `npm test`: 51 pruebas aprobadas, 0 fallidas. `node --check` aprobado para JS y controladores revisados.
- [ ] Pendiente: verificar en navegador el flujo visual y el mensaje exacto del botón en una sesión real.
- [ ] Pendiente: rediseñar creación de cuentas para asignar institución desde el mismo formulario y generar contraseña temporal criptográficamente segura con cambio obligatorio en el primer ingreso. No se implementó todavía; el formulario actual sigue solicitando contraseña manual.
- [ ] Pendiente: mostrar la institución de cada cuenta directamente en la tabla principal del directorio de usuarios.
- Sin cambios en cuentas reales, membresías existentes ni datos académicos.



## Alta institucional con contraseña temporal y cambio obligatorio — 3 de noviembre de 2026

- [x] El formulario de alta global ahora solicita tipo de cuenta (estudiante o docente/tutor), institución activa y rol dentro de esa institución. La identidad global y la membresía institucional permanecen separadas.
- [x] La API valida organización activa y rol institucional. Una cuenta de estudiante solo puede recibir rol institucional de estudiante; docente/tutor puede ser tutor o administrador institucional.
- [x] La contraseña temporal se genera con crypto.randomBytes(24) y se deriva a hash con bcrypt (12 rondas). No se guarda ni registra en texto plano.
- [x] La creación de usuario y su membresía se realizan desde la misma operación de aplicación. Ante fallo al crear la membresía o enlazar el registro de estudiante, se eliminan la membresía/cuenta recién creadas para evitar cuentas parciales.
- [x] La respuesta devuelve la contraseña temporal solo en la respuesta de creación. La interfaz la muestra una sola vez, ofrece copiar y la limpia al cerrar el panel. Si falla la recarga del directorio, conserva las credenciales visibles y avisa al administrador.
- [x] Las cuentas nuevas quedan marcadas debeCambiarPassword=true. El middleware bloquea las rutas autenticadas excepto /api/auth/me y /api/auth/change-password hasta cambiarla.
- [x] Se añadió pantalla de cambio obligatorio, validación de mínimo 12 caracteres, confirmación y endpoint protegido por CSRF. Tras el cambio se redirige al panel según rol global.
- [x] El directorio muestra las instituciones, rol institucional y estado de cada membresía.
- [x] Se añadió prueba de integración para alta + vinculación y prueba de autenticación para bloqueo/cambio de contraseña temporal.
- [x] npm test: 53 pruebas aprobadas, 0 fallidas. node --check aprobado en los controladores, rutas, middleware y scripts frontend modificados.
- [ ] Pendiente: verificación visual manual en navegador con una cuenta de prueba nueva y entrega de credenciales por canal seguro.
- Sin creación de cuentas reales ni modificaciones a registros de estudiantes existentes fuera del vínculo de un registro coincidente durante una futura alta explícita.

## Integración de correo SMTP para altas institucionales — 4 de noviembre de 2026

- [x] Se incorporó Nodemailer y un servicio SMTP reutilizable en `src/services/email.service.js`.
- [x] El alta institucional intenta enviar al correo registrado el nombre de la organización, el correo de acceso y la contraseña temporal, junto con la obligación de cambiarla en el primer inicio.
- [x] El mensaje incluye versión texto y HTML; los valores dinámicos se escapan en HTML y los errores SMTP no registran contraseñas ni contenido del correo.
- [x] La API diferencia `sent`, `failed` y `not_configured`. Si el envío se confirma, no devuelve la contraseña temporal al navegador; si no está configurado o falla, la muestra al administrador para entrega manual segura.
- [x] El panel de usuarios muestra confirmación de correo enviado o instrucciones de entrega manual según el resultado real.
- [x] Se documentaron variables opcionales SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS y SMTP_FROM en `.env.example`; no se leyeron ni modificaron secretos del `.env` real.
- [x] `node --check` pasó para servicio, controlador, configuración y JS del panel. `npm test`: 53 pruebas aprobadas, 0 fallidas.
- [ ] Pendiente configurar credenciales SMTP reales y verificar entrega en una bandeja de prueba. El entorno actual no tiene variables SMTP configuradas; por tanto, no se afirma que el correo haya sido enviado.
- [ ] Pendiente verificación visual en navegador del mensaje de éxito/error y del formulario de alta.
- Alcance: cambios locales de código y dependencias. No se enviaron correos ni se crearon cuentas reales.


## 4 de noviembre de 2026 — Configuración Gmail SMTP
- Se configuró el remitente TaskFlow con `luis132kj@gmail.com` y servidor `smtp.gmail.com:587` (STARTTLS).
- Se preservó cualquier valor previo de `SMTP_PASS`; no se leyó ni se mostró ningún secreto.
- Se añadió `npm run smtp:verify` para comprobar conexión/autenticación sin enviar correos.
- Pendiente: introducir una contraseña de aplicación de Google en `.env` y ejecutar la verificación.


## 4 de noviembre de 2026 — Revisión del flujo de alta y permisos
- [x] Se detectó y corrigió un texto obsoleto en el panel de usuarios que indicaba que el aislamiento multiempresa todavía estaba pendiente. Ahora describe la separación global/institucional y el filtrado por membresía e institución activa.
- [x] Se reforzó la prueba de alta institucional para exigir el estado real `not_configured` cuando SMTP no tiene contraseña y comprobar que las credenciales quedan disponibles para entrega manual segura.
- [x] Se corrigieron permisos del archivo `.env` a `600`; no se inspeccionó ni se imprimió el contenido secreto.
- [ ] Pendiente: revisión visual autenticada con datos dinámicos y prueba de correo real después de configurar la contraseña de aplicación.
- [x] Verificación posterior a los ajustes: `npm test` = 53/53 aprobadas, 0 fallidas.
- [x] Verificación HTTP con servidor activo y MongoDB conectada: `/api/health`, `/admin-usuarios.html`, `/js/admin-usuarios.js` y `/css/admin.css` respondieron HTTP 200.
- [x] Se confirmó que `.env` está excluido por `.gitignore` y tiene permisos `600`.


## 4 de noviembre de 2026 — Mejora del selector de miembros
- [x] El selector de cuentas ahora consulta la organización abierta y excluye cuentas que ya tienen una membresía en ella (también si está inactiva), evitando ofrecer acciones que terminarían en conflicto 409.
- [x] Se agregó validación del identificador de organización y respuesta 404 si no existe.
- [x] Se añadió una prueba de integración para comprobar que el mismo docente se excluye de una institución donde ya está vinculado y sigue disponible en otra.
- [x] Se bloquea el botón de guardado de organización mientras se procesa el formulario para evitar dobles envíos accidentales.
- [x] Suite completa posterior a la mejora: `npm test` = 54/54 aprobadas, 0 fallidas.
- [x] Sintaxis verificada en controlador, validador y JavaScript del panel de organizaciones y usuarios.
- [x] Servidor de desarrollo reiniciado con el código actualizado; `/api/health` devolvió HTTP 200 y MongoDB `connected`.
- [x] Revisión visual estática de la página de organizaciones con Firefox headless: estructura, navegación, métricas, directorio y nota institucional se renderizan con estilos. La vista autenticada con datos dinámicos requiere sesión real, por lo que no se marcó como validada.
- [x] Comprobación final del servidor actualizado: health 200 con MongoDB conectada; cuatro páginas administrativas y sus dos scripts principales devolvieron HTTP 200.
- [x] La API de cuentas disponibles responde 401 sin sesión, confirmando que no quedó expuesta públicamente.
- [x] No se crearon cuentas reales ni se enviaron mensajes durante esta revisión; las pruebas corrieron sobre MongoDB en memoria.

## 2026-11-04 — Auditoría de alineación con los TCC de esta semana

Se contrastó el alcance del código y los cambios administrativos recientes con la guía CIPA/SIMA y el documento `escrito/INGSOFT_4_9_TCC_CON_EVIDENCIAS.docx`.

### Criterios que deben gobernar los siguientes cambios
- **Ingeniería de Software (cierre 06/11/2026, 23:55):** conservar el propósito de TaskFlow como sistema de control y seguimiento de prácticas empresariales; mantener los tres perfiles académicos (administrador, tutor y estudiante), prácticas, empresas, estudiantes, actividades, evidencias, evaluaciones, fechas e informes; proteger permisos y aislamiento de datos por organización.
- **Desarrollo de Software Web (cierre 07/11/2026, 23:03):** demostrar una aplicación web para una necesidad real con formularios validados, errores comprensibles, CRUD real y persistente en MongoDB. El módulo académico de actividades ya consume `/api/activities` y soporta POST/PATCH/DELETE; la demostración debe comprobar también lectura y persistencia tras recargar.
- Los cambios de organizaciones, membresías, permisos e identidad institucional son soporte de administración multiempresa y control de acceso; no deben desplazar ni romper el flujo académico central.
- SMTP/correo de credenciales es una mejora complementaria, no un requisito central de los TCC identificados. Mantenerlo aislado y no bloquear la demostración académica por falta de contraseña de aplicación.
- El tablero auxiliar `dashboard.html` conserva tareas/miembros en `localStorage`; no presentarlo como persistencia académica en MongoDB. La evidencia de persistencia debe salir de los módulos conectados a la API y MongoDB.

### Verificación registrada
- Suite ejecutada el 2026-11-04: **54 pruebas aprobadas, 0 fallidas**.
- El documento de entrega todavía menciona 56 pruebas aprobadas en sus apartados 4.2, 4.4 y conclusión. Ese número está desactualizado frente a la ejecución actual y debe corregirse solo después de repetir la suite final y guardar el resultado con fecha.
- Pendiente de demostración manual autenticada con los tres roles, incluyendo CRUD, carga/revisión de evidencias, evaluación, informes, validaciones y aislamiento entre organizaciones.
- Pendiente de capturas reales y actualización de manuales/evidencias para reflejar la versión final.

### Regla de alcance
Antes de incorporar una funcionalidad nueva, comprobar que resuelve un requisito del TCC, una necesidad necesaria para operar/asegurar el sistema o una mejora que no comprometa el alcance. Priorizar correcciones y pruebas del flujo académico antes de añadir módulos accesorios.

## 2026-11-04 — Corrección de rutas académicas multiempresa

### Hallazgo
Las pantallas `practices.js`, `activities.js`, `evaluations.js` y `reports.js` seguían consumiendo rutas académicas globales (`/api/practices`, `/api/activities`, `/api/evaluations`, `/api/reports` y rutas de evidencias globales). El middleware `rejectLegacyOrganizationAccess` bloquea expresamente esas rutas para cualquier cuenta con membresía institucional, por lo que las pantallas podían fallar aunque existieran endpoints tenant-scoped.

### Cambios aplicados
- [x] Migradas las cuatro pantallas para consultar y mutar exclusivamente `/api/organization/*`.
- [x] Las pantallas obtienen el rol efectivo desde la organización activa (`/api/auth/organizations`) en vez de asumir el rol global de la cuenta.
- [x] Selector de estudiantes y empresas de prácticas ahora usa `/api/organization/students` y `/api/organization/companies`.
- [x] Se creó `GET /api/organization/tutors`, protegido por rol administrador institucional, que devuelve solo docentes activos con membresía activa en esa organización.
- [x] Las cargas, consultas, descargas y revisiones de evidencias se dirigen ahora a las rutas institucionales.
- [x] Se añadió prueba de integración del selector de tutores, comprobando que no expone docentes vinculados a otra organización.
- [x] Se añadió prueba de extremo a extremo del CRUD de actividades en la organización activa: crear, leer, actualizar, eliminar, comprobar persistencia en MongoDB y confirmar que la ruta antigua responde 409 `ORGANIZATION_ROUTE_REQUIRED`.
- [x] `node --check` pasó para los cuatro scripts frontend, controlador, rutas y prueba de integración.
- [x] Suite completa posterior a los cambios: `npm test` = **56/56 aprobadas, 0 fallidas**.

### Pendiente
- [ ] Verificación manual en navegador con sesión autenticada para cada rol y una organización seleccionada.
- [ ] Verificar el recorrido completo de prácticas, actividades, evidencias, evaluaciones e informes desde la interfaz; las pruebas de API no sustituyen la demostración visual.
- [x] Servidor Node reiniciado para cargar la nueva ruta y el controlador actualizado; log confirma conexión a MongoDB `taskflow` y escucha en `127.0.0.1:3000`.
- [x] Health HTTP 200; rutas institucionales sin sesión responden 401 y las cuatro páginas/scripts académicos responden HTTP 200.

## 2026-11-04 — Ajuste de roles multiempresa y formulario de evaluación

- [x] Corregido el selector institucional de tutores: ahora toma la membresía `role=tutor` como fuente de verdad y no exige que el rol global de la cuenta también sea `tutor`.
- [x] Corregida la validación de asignación de tutor en prácticas con el mismo criterio: cuenta activa + membresía activa de tutor en la organización, sin depender del rol global.
- [x] Añadida cobertura al selector para una cuenta cuyo rol global es `estudiante` pero su rol efectivo en la organización es `tutor`.
- [x] Corregido el formulario de evaluación para registrar el evento `change` una sola vez; antes añadía un listener nuevo cada vez que se recargaba la lista y podía reutilizar datos obsoletos.
- [x] `node --check` correcto en los scripts/controladores modificados.
- [x] Suite completa después de estos ajustes: **56/56 aprobadas, 0 fallidas**.

### Límite de validación
No se ha realizado todavía una sesión de navegador autenticada con credenciales institucionales reales. La revisión funcional actual está respaldada por pruebas de integración sobre MongoDB en memoria y comprobaciones HTTP del servidor; no equivale a una demostración visual final.

## 2026-11-04 — Preparación de la segunda base de datos (MySQL/MariaDB)

### Cambios realizados
- [x] Incorporado `mysql2` como dependencia para conexión mediante pool compatible con MySQL y MariaDB.
- [x] Creado `src/config/mysql.js` con conexión explícita, pool limitado, ping inicial, estado observable, cierre ordenado y errores sin imprimir credenciales.
- [x] Añadidas variables `MYSQL_*` a `src/config/env.js` y `.env.example`. La conexión es opt-in (`MYSQL_ENABLED=false`) para no interrumpir el funcionamiento actual mientras se prepara el esquema y la migración.
- [x] El arranque y apagado del servidor ya contemplan la conexión MySQL cuando se habilite.
- [x] `/api/health` informa separadamente el estado de MongoDB y MySQL; MySQL deshabilitado no se presenta como una caída.
- [x] Añadida prueba de aislamiento que verifica que la aplicación continúa funcionando sin abrir una conexión MySQL y que no se puede obtener un pool inexistente.
- [x] Se preservó la conexión MongoDB existente y no se modificaron colecciones ni registros académicos.

### Verificación y limitaciones
- [x] `mysql2` instalado (versión declarada en package.json: `^3.24.6`).
- [x] Sintaxis comprobada en los archivos nuevos/modificados.
- [x] Suite completa después de esta fase: **57/57 pruebas aprobadas, 0 fallidas**; incluye prueba de aislamiento MySQL deshabilitado.
- [x] Incidencia inicial resuelta: el administrador creó `taskflow_relational` y el usuario restringido `taskflow_app`; ver sección de conexión verificada del 2026-11-04.
- [x] Credenciales locales configuradas en `.env`; ping real y estado `connected` confirmados con `MYSQL_ENABLED=true`.
- [ ] Pendiente definir y aprobar la distribución de entidades entre motores, crear migraciones SQL y migrar gradualmente los módulos sin duplicar datos ni romper MongoDB.
- La contraseña no se expuso en el repositorio ni en el chat; `.env` permanece excluido del control de versiones y con permisos `600`.

### 2026-11-04 — Conexión MySQL/MariaDB activada y verificada
- Se configuró el usuario de aplicación `taskflow_app` con permisos limitados a `taskflow_relational`; la contraseña se generó localmente y se conserva en un archivo privado fuera del repositorio.
- Se probó la autenticación real con `mysql2`: conexión correcta a `taskflow_relational` como `taskflow_app@localhost`.
- Se actualizaron únicamente las variables `MYSQL_*` de `.env`, preservando el resto de la configuración; permisos del archivo `.env`: `600`.
- Se reinició el servidor y se verificó `GET /api/health`: MongoDB `connected` y MySQL `enabled: true`, `status: connected`, base `taskflow_relational`.
- La integración queda habilitada como segunda conexión independiente. No se han migrado datos desde MongoDB ni creado todavía tablas relacionales; el diseño del esquema y su uso funcional quedan pendientes.

### 2026-11-04 — Diseño y creación del esquema académico MySQL
- Se inspeccionaron los modelos actuales de MongoDB y los conteos antes de migrar. Las colecciones académicas `Student`, `Company`, `Practice`, `Activity`, `Evidence` y `Evaluation` contienen **0 registros**; por ello no se ejecutó una copia de datos ficticios ni se modificaron datos existentes.
- Se definió la separación inicial: MongoDB conserva usuarios/credenciales, organizaciones, membresías, roles, branding y sesiones; MySQL queda preparado para el núcleo académico (estudiantes, empresas, prácticas, actividades, metadatos de evidencias y evaluaciones).
- Se crearon migraciones versionadas `database/mysql/migrations/001_academic_core.sql` y `002_tenant_integrity.sql`, más `scripts/migrate-mysql.js` con control de versión y checksum.
- Se añadieron claves foráneas compuestas con `organization_id` para impedir relaciones académicas entre organizaciones distintas. Los IDs de usuarios y organizaciones se conservan como referencias externas `CHAR(24)` sin duplicar credenciales.
- Se añadieron comandos `npm run db:mysql:migrate` y `npm run db:mysql:verify`, y documentación en `database/mysql/README.md`.
- Verificación real en MariaDB: **6 tablas académicas creadas**; flujo CRUD transaccional estudiante → empresa → práctica → actividad → evidencia → evaluación aprobado; intento de cruzar empresa de otra organización rechazado; datos de prueba revertidos.
- La suite existente quedó en **57/57 pruebas aprobadas, 0 fallidas**. La prueba de salud fija MySQL deshabilitado en su entorno aislado para que el `.env` de desarrollo no altere las pruebas.
- Se repitieron las migraciones y la verificación: ambas migraciones se reconocieron como aplicadas (checksum intacto), y el flujo relacional volvió a pasar sin dejar datos de prueba.
- Límite explícito: las rutas y controladores actuales siguen usando Mongoose. No hay doble escritura, migración de datos reales ni cambio de fuente de verdad todavía. La integración funcional por repositorios y la migración controlada quedan como siguiente fase.

### 2026-11-04 — Decisión oficial de arquitectura MongoDB + MySQL
- Aprobado por el usuario: **MongoDB se reserva para administración e identidad** (usuarios, credenciales, organizaciones, membresías, roles, permisos, sesiones y branding); **MySQL/MariaDB será la fuente de verdad de toda la operación académica** (estudiantes, empresas, prácticas, actividades, evidencias y evaluaciones).
- Los IDs de usuarios y organizaciones se referenciarán desde MySQL como `CHAR(24)`; no se duplican cuentas ni contraseñas. Las membresías activas se validarán desde MongoDB en la capa de servicio.
- Se actualizó `database/mysql/README.md` con la decisión, responsabilidades, referencias cruzadas y plan de migración por módulos.
- La implementación de controladores todavía no se ha cortado a MySQL. Los módulos actuales permanecen en MongoDB hasta migrar cada flujo completo y validar regresión; no se habilitará doble escritura.
- Se verificó que el código de la aplicación sigue íntegro tras la preparación: **57/57 pruebas aprobadas, 0 fallidas**.

### 2026-11-04 — Inspección de dependencias para la migración académica
- [x] Se inspeccionaron el esquema SQL, modelos Mongoose, validadores, rutas institucionales, middleware de organización, controladores y consumidores del frontend.
- [x] Se documentó el mapeo de campos API/Mongo → MySQL para estudiantes y empresas en `database/mysql/MIGRATION_MAP.md`, incluyendo preservación del contrato JSON actual.
- [x] Hallazgo crítico: no es seguro cambiar únicamente los controladores de estudiantes y empresas. Prácticas, actividades, evidencias, evaluaciones, informes, administración y gestión de usuarios todavía consultan/populan esos modelos Mongoose. Un corte aislado dejaría referencias rotas y pantallas incompletas.
- [x] Se identificó que las rutas globales heredadas `/api/admin/*` también comparten controladores y deben quedar explícitamente tenant-safe durante la migración.
- [x] Se definió el siguiente incremento seguro: crear repositorios/mapeadores SQL y pruebas reales; luego migrar coordinadamente los consumidores dependientes por un flujo vertical, manteniendo validación de identidad/membresía en MongoDB y sin doble escritura.
- [x] No se modificaron controladores, datos ni credenciales durante esta inspección. No se expuso ningún secreto.
- [ ] Pendiente implementar repositorios SQL y pruebas de integración para CRUD de estudiantes/empresas antes de cambiar la fuente de verdad de cualquier ruta.

### 2026-11-04 — Repositorios SQL de estudiantes y empresas (sin corte de rutas)
- [x] Creados `src/repositories/academic-mappers.js`, `academic-company.repository.js` y `academic-student.repository.js`.
- [x] Los repositorios implementan listar, obtener, crear, actualizar y eliminar con consultas parametrizadas; exigen `organizationId` y aplican el filtro de tenant en todas las operaciones.
- [x] El listado de estudiantes incluye JOIN con empresa restringido por el mismo `organization_id`; los mapeadores devuelven los nombres de campo compatibles con el contrato español de la API.
- [x] Creado `scripts/verify-academic-repositories.js` y comando `npm run db:mysql:verify-repositories`.
- [x] Prueba real contra MariaDB: CRUD de empresa y estudiante, mapeo, búsqueda, actualización y rechazo de lectura/actualización desde otra organización aprobados.
- [x] La prueba usa una transacción y ejecuta ROLLBACK; no conserva registros temporales.
- [x] Sintaxis JavaScript verificada en repositorios y script.
- [ ] No se han conectado todavía los controladores ni las rutas a estos repositorios. La fuente de verdad de la aplicación sigue siendo MongoDB hasta migrar sus dependencias académicas coordinadamente.


## 2026-11-04 — Panel principal del administrador general
**Estado: implementado; verificación automatizada inicial completada.**

Se actualizó `public/admin.html` para retirar los mensajes heredados que describían como pendientes los módulos de organizaciones, asignación de miembros e identidad visual, que ya cuentan con páginas y backend propios.

Se creó `public/js/admin-dashboard.js` para validar sesión y rol global, cerrar sesión con CSRF y consultar los indicadores mediante las rutas existentes de usuarios, organizaciones y dashboard global. Las consultas son independientes: un fallo parcial no convierte datos faltantes en cero ni bloquea los indicadores que sí respondan.

El panel muestra accesos a los tres módulos globales y aclara la diferencia entre organización (institución cliente) y empresa de prácticas.

**Validaciones realizadas:** sintaxis del nuevo JavaScript correcta; página y script servidos con HTTP 200; rutas administrativas protegidas devuelven HTTP 401 sin sesión; MongoDB y MariaDB conectados en `/api/health`.

**Pendiente:** abrir el panel con una sesión real de administrador general y verificar visualmente los valores mostrados. La verificación sin sesión no permite confirmar el contenido de los indicadores en el navegador. No se modificaron registros ni otros módulos.


## Restablecimiento seguro de contraseña desde Usuarios (4 nov 2026)
- Se añadió `POST /api/admin/users/:id/reset-password`, protegido por sesión de administrador global y token CSRF.
- Genera una clave temporal aleatoria criptográficamente segura, guarda únicamente su hash bcrypt (12 rondas), marca `debeCambiarPassword=true` y devuelve la clave temporal una sola vez en la respuesta al administrador.
- Rechaza cuentas inexistentes, administradores globales e inactivas. No envía la clave por correo ni la registra en logs.
- En `admin-usuarios.html`, la ficha de usuario incorpora «Restablecer contraseña», confirmación previa, campo temporal, botón de copiar y opción de ocultar/limpiar el valor.
- La contraseña anterior deja de funcionar; el titular debe cambiar la temporal al iniciar sesión.
- Pruebas nuevas: 4 casos (generación y hash, CSRF, cuentas no elegibles y usuario sin permisos). Suite completa: 61/61 aprobadas.
- Este cambio implementa la acción; no se ha restablecido todavía la contraseña de ninguna cuenta.


## 2026-11-04 — Base de datos de espacios de trabajo por curso

### Decisión funcional aplicada
Los cursos/asignaturas no se modelan como prácticas empresariales. Se conserva el flujo de prácticas y se crea un espacio académico separado por curso. Un mismo profesor puede tener asignaciones activas en Informática, Matemáticas u otras asignaturas; cada curso mantiene sus propios estudiantes, documentos, actividades, evidencias, evaluaciones e informes.

### Implementación
- [x] Creada la migración inmutable `database/mysql/migrations/003_course_workspaces.sql`.
- [x] Añadidas las tablas `academic_courses`, `academic_course_teachers`, `academic_course_students`, `academic_course_resources`, `academic_course_activities`, `academic_course_evidences` y `academic_course_evaluations`.
- [x] Cada tabla lleva `organization_id`; las relaciones curso-profesor, curso-estudiante, curso-actividad, actividad-evidencia y curso-evaluación están delimitadas por claves foráneas compuestas.
- [x] Los IDs de profesor/creador/revisor siguen siendo referencias a cuentas de MongoDB. La asignación y autorización debe validar la membresía activa con rol institucional `tutor` antes de operar.
- [x] Añadido `scripts/verify-course-workspaces.js` y comando `npm run db:mysql:verify-courses`; el verificador usa una transacción y ROLLBACK, sin dejar datos de prueba.
- [x] Documentada la separación en `database/mysql/README.md`.

### Validación real
- [x] `node --check scripts/verify-course-workspaces.js` aprobado.
- [x] `package.json` parsea correctamente.
- [x] `npm run db:mysql:migrate`: migraciones 001 y 002 reconocidas sin cambios; migración 003 aplicada correctamente.
- [x] MariaDB confirma las siete tablas nuevas de cursos además de las seis tablas académicas existentes.
- [x] `npm run db:mysql:verify-courses`: aprobado; verificó asignación de docente por curso, matrícula, recurso documental, actividad, evidencia, evaluación y resumen por curso.
- [x] Las restricciones SQL rechazaron una asignación docente a curso de otra organización y una matrícula que intentaba cruzar el estudiante de otra organización.
- [x] El verificador terminó con ROLLBACK; no dejó cursos, estudiantes ni archivos ficticios.

### Pendiente para completar la experiencia del profesor
- [ ] Repositorios SQL parametrizados para cursos, asignaciones docentes, matrículas, documentos, actividades, evidencias y evaluaciones.
- [ ] Validación de cada profesor contra su membresía institucional activa y su asignación específica al curso solicitado.
- [ ] API institucional para listar/crear cursos, asignar docentes/estudiantes y consultar el panel de un curso.
- [ ] Carga segura y descarga autorizada de documentos por curso; límites, tipos MIME, almacenamiento y CSRF.
- [ ] CRUD de actividades del curso, entrega/revisión de evidencias, evaluaciones e informes filtrados por curso.
- [ ] Interfaz del profesor con selector de curso y navegación que mantenga el contexto sin mezclar asignaturas.
- [ ] Pruebas de aislamiento entre cursos de una misma organización y entre organizaciones distintas.

**Límite actual:** esta fase solo crea y verifica el esquema relacional. No se han creado cursos ni cuentas docentes reales, no se habilitaron endpoints o pantallas nuevos y no se modificó el flujo actual de prácticas empresariales.


## Experiencia estudiantil — 5 de noviembre de 2026

- [x] Inspección inicial del dashboard y de los módulos estudiantiles existentes.
- [x] Investigación de referencias reales: ImBlaze, SONIA, WIL Portal y CareerHive WIL.
- [x] Creación de `PROPUESTA-EXPERIENCIA-ESTUDIANTE.md` con arquitectura de información, dirección visual, fases y criterios de aceptación.
- [ ] Aprobar la navegación y el contenido del nuevo Inicio antes de implementar cambios visuales.
- [ ] Resolver la contradicción de identidad: `styles.css` define azul `#3da9fc`, mientras `theme.css` redefine el tema principal en morado `#6841b8`.
- [ ] Sustituir el dashboard de demostración basado en `localStorage` por una experiencia estudiantil conectada únicamente a datos reales, cuando se apruebe el diseño y se confirme el contrato de API.

**Hallazgo importante:** `public/dashboard.html` sigue siendo un tablero de demostración de tareas y miembros locales; no representa todavía el panel académico del estudiante. Las páginas de Prácticas, Actividades, Evaluaciones e Informes sí existen como módulos separados y deben conservar sus flujos actuales durante el rediseño.

**Alcance de esta intervención:** documentación e inspección solamente. No se modificó código de la aplicación, no se ejecutaron migraciones y no se alteraron bases de datos.


### Corrección de identidad visual — 5 de noviembre de 2026

- [x] Corrección aplicada a `PROPUESTA-EXPERIENCIA-ESTUDIANTE.md`: el color corporativo principal de TaskFlow es **morado**, no azul.
- [x] Se descarta la recomendación anterior de usar azul como color principal. El azul podrá considerarse solo como acento secundario si armoniza con el diseño.
- [ ] Unificar los estilos CSS respetando el morado corporativo cuando se apruebe la implementación visual.

**Nota:** no se ha definido aquí un nuevo código hexadecimal; conservar el morado corporativo que ya utiliza el tema actual y validar sus tonos antes de modificar CSS.


### Primera intervención visual del frontend — 5 de noviembre de 2026

- [x] Se respaldaron `public/css/styles.css` y `public/css/theme.css` antes de modificarlos.
- [x] Se unificaron las variables principales de `styles.css` con el morado corporativo (`#6841b8`, tono oscuro `#513093`).
- [x] Se reemplazaron los acentos azules residuales de la hoja base por tonos morados.
- [x] Se mejoró la coherencia del menú móvil con las superficies del tema claro y oscuro.
- [x] Se mantuvo el soporte de tema oscuro y el resto de colores funcionales (éxito, alerta y peligro).
- [x] Validación: `npm test` — 61 pruebas aprobadas, 0 fallidas.
- [x] Validación HTTP local: `/api/health`, portada, login, prácticas, actividades, evaluaciones, informes y administración respondieron correctamente (HTTP 200).
- [ ] Siguiente fase: pulir navegación y jerarquía visual de las pantallas académicas sin sustituir datos ni funcionalidades reales.

**Alcance de esta intervención:** únicamente CSS compartido y bitácora. No se modificaron controladores, APIs, autenticación ni bases de datos.


### Navegación móvil de módulos académicos — 5 de noviembre de 2026

- [x] Se añadió el botón de menú móvil accesible a Prácticas, Actividades, Evaluaciones e Informes.
- [x] Se conectó el comportamiento al módulo compartido `js/ui.js` (apertura/cierre, Escape y actualización de `aria-expanded`).
- [x] Se identificó cada sección actual con `aria-current="page"`.
- [x] Se crearon respaldos de los cuatro HTML antes de editarlos.
- [x] Validación posterior: 61 pruebas aprobadas, 0 fallidas; las cuatro páginas y `/api/health` responden HTTP 200.

## 5 de noviembre de 2026 — Inicio del estudiante

### Cambios realizados
- Se reemplazó el tablero genérico de tareas locales de demostración en `public/dashboard.html` por un inicio académico orientado al estudiante.
- Se incorporó bienvenida personalizada, resumen de práctica, actividades completadas y pendientes, promedio de evaluación, progreso visual, datos de empresa/docente tutor y próximas actividades.
- Se añadieron accesos directos a Mi práctica, Actividades, Evaluaciones y Mi progreso.
- Se creó `public/js/student-home.js`, que consulta sesión, organización activa y datos mediante las rutas institucionales existentes (`/api/organization/practices`, `activities`, `evaluations`, `reports`). No crea ni inventa registros.
- Se creó `public/css/student-home.css` con identidad morada, tarjetas, jerarquía visual y adaptación responsive.
- Se conservó el selector de organización y el cierre de sesión. El inicio identifica el rol institucional y evita mostrar el panel estudiantil a cuentas con otro rol.
- Se crearon copias de respaldo de dashboard.html, dashboard.js y student-polish.css antes de modificar.

### Verificación
- `node --check public/js/student-home.js`: correcto.
- `npm test`: 61 pruebas aprobadas, 0 fallidas.
- `/css/student-home.css` y `/js/student-home.js`: HTTP 200.
- `/dashboard.html` sin sesión: HTTP 302 al login, comportamiento esperado.
- No se modificaron controladores, rutas, modelos, credenciales ni bases de datos.

### Pendiente de validación visual/funcional
- Revisar el inicio con una cuenta real de estudiante que tenga membresía activa y práctica/actividades asociadas.
- Ajustar detalles visuales tras observarlo en navegador y confirmar estados vacíos con datos reales.
- El dashboard docente se desarrollará por separado; este inicio está diseñado para el rol estudiante.

## 5 de noviembre de 2026 — Panel docente: Mis estudiantes (primera versión)

### Cambios realizados
- Se creó `public/teacher-students.html`, una sección independiente para el rol institucional tutor/docente.
- Se creó `public/js/teacher-students.js`, que consulta `/api/auth/me`, organizaciones activas y `/api/organization/reports`; esta última ruta ya filtra las prácticas por el tutor autenticado y respeta el espacio institucional activo.
- Se creó `public/css/teacher-students.css` con identidad morada, resumen de indicadores, tabla adaptable a tarjetas móviles, filtros y panel lateral de seguimiento.
- La vista presenta estudiantes vinculados a prácticas asignadas, empresa, estado, progreso de actividades y calificación cuando exista.
- Se añadió búsqueda por nombre/código/empresa y filtro por estado de práctica.
- El detalle individual presenta datos académicos disponibles, actividades y evaluación registrada.
- Se limitó la vista a cuentas con membresía institucional de rol tutor. No se amplió el acceso de endpoints ni se tocaron controladores, modelos o base de datos.
- Se guardó respaldo de la bitácora antes de actualizarla.

### Verificación
- `node --check public/js/teacher-students.js`: correcto.
- `npm test`: 61 pruebas aprobadas, 0 fallidas.
- Pendiente: validar visualmente con una cuenta docente real y datos asignados; el contenido se limita a prácticas que el backend ya autoriza al tutor.

### Alcance / siguiente paso
- Esta sección es el apartado “Mis estudiantes”, no el dashboard completo del docente.
- El siguiente apartado será el seguimiento detallado de actividades/evidencias y después se integrarán las gráficas analíticas del panel docente.

### Ajuste de acceso al módulo docente desde el panel principal — 5 de noviembre de 2026
- Se detectó que el panel principal no ofrecía una entrada visible al módulo `Mis estudiantes` para cuentas con rol institucional `tutor`.
- Se añadió el acceso en la navegación del dashboard y se muestra únicamente cuando la organización activa identifica el rol `tutor`.
- El acceso dirige a `teacher-students.html`; no se modificaron API, permisos, base de datos ni datos académicos.
- Validación: sintaxis de `student-home.js` correcta; pruebas automatizadas en ejecución al registrar este cambio.


## 5 de noviembre de 2026 — Definición del aula virtual de prácticas

- Se documentó `PROPUESTA-AULA-PRACTICAS.md` para convertir las prácticas en un aula organizada por unidades, actividades, entregas, revisión, calificaciones publicadas y foros temáticos.
- Se inspeccionaron los módulos existentes: el docente ya puede crear actividades y revisar evidencias; el estudiante puede adjuntar archivos; las evaluaciones actuales están asociadas a la práctica completa, no a cada actividad.
- Se identificaron brechas: publicación/borradores, recursos adjuntos a actividades, unidades, foro, historial de reentregas, calificación individual por actividad y libro de notas con publicación explícita.
- Se recomienda implementar por fases, manteniendo separadas actividad, entrega, revisión y calificación. No se modificaron controladores, APIs, modelos, bases de datos ni datos académicos durante esta definición.
- Pendiente confirmar si el aula se organiza por práctica individual, grupo de prácticas o curso académico, y definir la escala/ponderación de notas antes de diseñar el modelo de datos.


### 2026-11-05 — Pautas académicas, rúbricas y recursos didácticos del aula

- [x] Se aprobó el modelo mixto de evaluación: coordinación/administración académica define las pautas oficiales por asignatura y el docente puede añadir criterios complementarios sin eliminar ni alterar los obligatorios.
- [x] Se especificó que cada calificación debe desglosarse por criterios y acompañarse de una justificación docente basada en las evidencias observadas, además de retroalimentación general.
- [x] Se establecieron estados diferenciados de calificación (pendiente, borrador y publicada), publicación explícita y trazabilidad de cambios posteriores.
- [x] Se incorporó versionado y vigencia de pautas/rúbricas para evitar que cambios nuevos alteren evaluaciones históricas.
- [x] Se definieron módulos didácticos con videos, guías, documentos, objetivos, actividades, evaluaciones y foros; los recursos tendrán estados borrador/publicado/archivado y acceso restringido al espacio correspondiente.
- [x] Se fijó el orden de trabajo: completar primero el panel y los flujos del docente; después construir la experiencia estudiantil conectada a esos mismos datos.
- [x] Se amplió PROPUESTA-AULA-PRACTICAS.md con gobierno académico, rúbricas, justificación de notas, recursos didácticos y el orden de finalización del panel docente.
- [ ] Pendiente de implementación: diseño detallado de pantallas docentes, contratos API/repositorios SQL y pruebas de aislamiento antes de conectar datos.
- **Alcance de esta actualización:** documentación funcional solamente. No se modificaron controladores, rutas, modelos, migraciones, bases de datos, cuentas ni registros académicos.


### 2026-11-05 — Estructura por unidades, calendario y ciclo de correcciones

- [x] Se definió la jerarquía académica: organización → programa (si aplica) → asignatura/curso → unidades/módulos → contenidos, actividades y evaluaciones.
- [x] Se acordó que el curso contendrá unidades; cada unidad agrupará videos, guías, protocolos, foros, actividades y evaluaciones. También habrá recursos generales del curso.
- [x] Se definieron fechas separadas para publicación, inicio/disponibilidad, entrega, extensión, cierre, revisión y eventos de evaluación.
- [x] Se estableció que la política de retrasos debe ser explícita por actividad y visible antes de entregar; no habrá penalizaciones silenciosas.
- [x] Se especificó el ciclo de revisión con solicitud de corrección, explicación por criterio/requisito, reentrega y comparación de versiones, conservando todos los intentos.
- [x] Se incorporó la reutilización/versionado de protocolos, rúbricas y matrices de evidencia. Se preservan los estados pendiente, en proceso, completado y pendiente de verificación; adjuntar un archivo no significa que el requisito esté validado.
- [x] Se amplió PROPUESTA-AULA-PRACTICAS.md con estos acuerdos.
- [ ] Pendiente: diseñar pantallas, definir contratos API y preparar modelo/repositorios SQL con pruebas de aislamiento antes de conectar los flujos.
- **Alcance:** actualización funcional/documental; no se modificaron datos académicos, controladores, rutas ni bases de datos.


### 2026-11-05 — Edición controlada de notas y fechas
- [x] Se definió que el docente autorizado puede corregir notas y modificar fechas cuando exista un error o una justificación válida.
- [x] Las correcciones de notas, incluso después de publicadas, requieren motivo obligatorio y conservan valor anterior/nuevo, autor, fecha/hora y criterios afectados.
- [x] Una nota publicada que se corrija debe volver a publicarse expresamente; el estudiante será notificado y verá la versión vigente y su retroalimentación.
- [x] Se definió que los cambios de fechas en actividades publicadas requieren motivo, historial y notificación a los estudiantes afectados.
- [x] Se separaron los cambios de plazo grupales de las extensiones individuales; una excepción individual no altera el calendario de los demás.
- [x] Se conservarán las marcas y marcas temporales originales de cada entrega, aunque se amplíe o cambie un plazo.
- [x] Se estableció auditoría protegida para cambios sensibles y la posibilidad de exigir aprobación de coordinación para correcciones posteriores al cierre institucional.
- [ ] Pendiente: diseñar la interfaz de edición con confirmación y motivo, definir permisos/reglas API, persistencia de auditoría y notificaciones; cubrir con pruebas de autorización, historial y aislamiento por organización/curso.
- **Alcance:** definición funcional/documental. No se modificaron controladores, rutas, modelos, migraciones, bases de datos ni registros académicos.


## 2026-11-05 — Inicio y navegación del modo profesor

### Implementación
- [x] Se creó `public/teacher-home.html` como inicio independiente para el rol docente/tutor.
- [x] Se creó `public/js/teacher-home.js`, que consulta los informes y actividades mediante las rutas institucionales existentes. Los datos se limitan al tutor y organización activos por las autorizaciones actuales del backend.
- [x] Se creó `public/css/teacher-home.css` con identidad morada, resumen de estudiantes y prácticas, entregas por revisar, actividades pendientes, fechas próximas y promedio de evaluaciones.
- [x] El acceso general `dashboard.html` redirige a `teacher-home.html` cuando la membresía activa corresponde al rol tutor; el panel del estudiante se conserva para estudiantes.
- [x] Se añadió navegación de regreso al inicio desde “Mis estudiantes”.
- [x] Se corrigió la consolidación de estudiantes en “Mis estudiantes”: si una persona tiene varias prácticas, se muestra la práctica más relevante (en curso, luego planificada, finalizada y suspendida) y sus propios datos, sin mezclar actividades ni evaluaciones de prácticas diferentes.

### Alcance y seguridad
- Se reutilizaron `/api/auth/me`, `/api/auth/organizations`, `/api/organization/reports` y `/api/organization/activities`.
- No se modificaron controladores, rutas, permisos del backend, modelos, migraciones ni bases de datos.
- No se crearon actividades, evaluaciones, estudiantes ni registros ficticios.
- No se inició trabajo del modo estudiante ni del administrador.

### Verificación pendiente
- [x] `node --check` correcto en `teacher-home.js`, `student-home.js` y `teacher-students.js`.
- [x] `npm test`: suite completa aprobada (61 pruebas, 0 fallidas).
- [x] La pantalla, sus recursos CSS/JS y las páginas relacionadas responden HTTP 200; `/api/health` confirma MongoDB y MariaDB conectados.
- [ ] Validación visual con una sesión real de docente y prácticas asignadas.


## 2026-11-05 — Publicación de actividades con PDF descargable

### Implementación
- [x] Se hizo visible en el inicio docente el acceso directo “Crear y asignar actividad”.
- [x] En Actividades se renombró y destacó la acción “Crear / asignar actividad”.
- [x] El formulario permite seleccionar una o varias prácticas/estudiantes; al seleccionar varias, crea una actividad individual vinculada a cada práctica seleccionada. Incluye selección rápida de todo el grupo y limpieza de selección.
- [x] Se añadió adjunto de material PDF del docente (guía, protocolo, taller o lectura), separado de las evidencias que sube el estudiante.
- [x] Los estudiantes pueden descargar el PDF desde su actividad; el endpoint comprueba organización y práctica accesible.
- [x] Los PDF se guardan en almacenamiento privado con nombre aleatorio, validación MIME/extensión/firma y límite de 10 MB.

### Seguridad y alcance
- La descarga respeta el aislamiento institucional y la relación del estudiante con su práctica; el tutor solo puede adjuntar a prácticas que le pertenecen.
- No se alteraron los endpoints de entrega/revisión de evidencias ni se modificaron datos existentes.
- No se ejecutaron migraciones.

### Verificación
- [x] Sintaxis validada en `activities.js`, `activity.controller.js`, `organization-context.routes.js` y `activityResourceUpload.js`.
- [x] `npm test`: 61 pruebas aprobadas, 0 fallidas.
- [x] Pantallas y recursos estáticos responden HTTP 200; rutas protegidas de subida/descarga responden 401 sin sesión (autenticación obligatoria).
- [x] Servidor de desarrollo reiniciado con conexiones a MongoDB y MariaDB activas; se evitó ejecutar el bloque de sincronización de roles del arranque habitual.
- [ ] Prueba funcional de subida y descarga con cuentas reales de docente y estudiante.

## 2026-11-05 — Primera etapa de planificación académica docente

### Implementación
- [x] Se añadió el apartado docente `teacher-academic.html` para configurar la estructura académica de cada práctica.
- [x] El docente puede seleccionar una práctica asignada, crear entre 1 y 20 módulos, describirlos y distribuir sus ponderaciones.
- [x] Se valida que la suma de ponderaciones sea 100 % y que los nombres de módulos no se repitan.
- [x] Se añadieron endpoints institucionales GET/PUT para consultar y guardar la estructura académica.
- [x] Se valida el acceso del tutor sobre sus prácticas y el aislamiento por organización.
- [x] Los cambios posteriores a la primera configuración requieren motivo y conservan una versión anterior con responsable y fecha.
- [x] Se añadió acceso desde el panel docente y la vista de estudiantes.
- [x] Se documentó el contrato en `ESTRUCTURA-ACADEMICA.md`.

### Alcance y límites de esta etapa
- La estructura configurable queda guardada en el documento de práctica de MongoDB para mantener compatibilidad con la fuente de datos actual.
- No se ejecutaron migraciones SQL ni operaciones sobre datos existentes.
- Esta etapa todavía no conecta actividades con módulos ni calcula la nota final. Tampoco incorpora aún las cuentas/permisos del supervisor empresarial para proponer el plan de trabajo ni las tres valoraciones independientes. Esos pasos deben desarrollarse antes de declarar terminado el flujo académico completo.
- El plan de trabajo propuesto por la empresa y su aprobación por el tutor siguen siendo parte del flujo funcional acordado; esta pantalla cubre por ahora la configuración de módulos y ponderaciones docentes.

### Verificación
- [x] Sintaxis validada en el modelo, controlador, rutas y JavaScript de la nueva pantalla.
- [x] Pruebas específicas de estructura académica: 16/16 aprobadas.
- [x] Suite completa después de añadir las pruebas de estructura académica: 63/63 aprobadas, 0 fallidas.
- [ ] Prueba visual y de guardado desde navegador con una cuenta docente real.
- [x] Servidor de desarrollo reiniciado de forma segura sin ejecutar sincronizaciones ni migraciones; MongoDB y MariaDB conectadas.
- [x] Página, JavaScript y CSS responden HTTP 200; la API protegida responde 401 sin sesión, como corresponde.
- [ ] Cálculo de nota final y asociación de actividades a módulos pendientes.


## 2026-11-05 — Correcciones de presentación y verificación de evaluaciones

- [x] Se corrigió el enlace de navegación de Evaluaciones: apuntaba al literal `{active}` en lugar de `evaluations.html`.
- [x] Se robusteció el renderizado de evaluaciones para manejar referencias pobladas o identificadores sin mostrar `undefined`/valores inválidos; las notas y fechas ausentes ahora tienen textos de respaldo.
- [x] Se corrigió un error de renderizado en Estructura académica: el encabezado del módulo se insertaba dos veces y desplazaba el indicador de actividades/nota fuera de la tarjeta. Ahora cada tarjeta muestra encabezado, estado de actividades y campos.
- [x] Sintaxis JavaScript verificada con `node --check` en `teacher-academic.js` y `evaluations.js`.
- [x] Suite completa ejecutada después de los cambios: 63 pruebas aprobadas, 0 fallidas.
- [ ] Pendiente validación visual con sesión real y datos de una práctica; la suite automatizada no sustituye la prueba de navegador.
- **Alcance:** correcciones de interfaz. No se eliminaron modelos ni registros; no se añadieron exámenes/cuestionarios; se conservaron las evaluaciones de prácticas.


## 2026-11-05 — Integración módulo → actividad → calificación

- [x] Se verificó que el formulario de actividades consulta los módulos de la práctica seleccionada y exige elegir uno.
- [x] El backend valida que el módulo enviado pertenezca a la estructura académica de esa práctica; se rechazan IDs ajenos o inexistentes.
- [x] La actividad se devuelve con la práctica y su estructura pobladas, de modo que las vistas pueden identificar a qué módulo pertenece.
- [x] Se amplió la prueba de integración institucional para crear actividades ligadas a módulos, comprobar su consulta y rechazo de módulo inválido.
- [x] La prueba de integración también comprueba el cálculo ponderado de la nota final: con ponderaciones 20/50/30 y notas 4/3/5, el resultado esperado es 3.80/5.
- [x] Prueba específica de contexto institucional: 16/16 aprobadas, 0 fallidas.

## 2026-11-05 — Corrección adicional de navegación académica

- [x] Se corrigieron enlaces activos que todavía contenían el texto literal `{active}` en Prácticas, Actividades e Informes; cada página apunta ahora a su propio archivo HTML.
- [x] Se confirmó que la copia de seguridad antigua conserva el enlace anterior; no se modificó ni eliminó ningún respaldo.
- [ ] Pendiente: prueba visual real en navegador con cuentas de administrador, tutor y estudiante; confirmar carga, descarga y revisión de evidencias en sesión real.


## 2026-11-05 — Verificación integral posterior a los ajustes

- [x] Se amplió la prueba académica para comprobar que una actividad conserva su `moduloAcademicoId` y que la consulta devuelve la estructura académica asociada a la práctica.
- [x] Se comprobó que no se puede crear una actividad con un módulo que no pertenezca a la práctica.
- [x] Se comprobó el cálculo ponderado final con tres módulos y notas de prueba (resultado 3.80/5).
- [x] Se ejecutó `node --check` en los JavaScript modificados y relacionados: `teacher-academic.js`, `evaluations.js`, `activities.js`, `reports.js`.
- [x] Suite completa final: 63 pruebas aprobadas, 0 fallidas.
- [ ] Validación manual en navegador y generación de capturas reales siguen pendientes; no se declaran como realizadas.


## 2026-11-05 — Comprobación HTTP local

- [x] `/api/health` respondió HTTP 200.
- [x] Prácticas, Actividades, Evaluaciones, Informes, Estructura académica docente y Mis estudiantes respondieron HTTP 200.
- [x] Búsqueda en las páginas actuales: cero enlaces activos con el literal `href="{active}"`.
- **Límite:** HTTP 200 confirma disponibilidad de página/recursos, no sustituye la validación visual y de flujo con sesiones reales.


## 2026-11-05 — Actualización del protocolo INGSOFT 4_9

- [x] Se creó respaldo de `escrito/INGSOFT_4_9_TCC_CON_EVIDENCIAS.docx` antes de editarlo.
- [x] Se actualizaron los resultados documentados de pruebas de 56 a 63 aprobadas y 0 fallidas.
- [x] Se actualizó la descripción de actividades para explicar su relación con los módulos académicos.
- [x] Se actualizó la explicación de evaluaciones para describir el cálculo ponderado por módulos.
- [x] Se corrigió la nota del dashboard: ahora refleja el inicio académico del estudiante y la derivación al panel docente.
- [x] Se verificó que el DOCX conserva sus 32 imágenes después de la edición.
- [ ] Las capturas del anexo todavía deben revisarse visualmente y renovarse si muestran pantallas antiguas; no se sustituyeron imágenes sin comprobarlas.


## 2026-11-05 — Auditoría de integración MongoDB + MariaDB

### Estado real observado
- [x] `/api/health` respondió `ok`; MongoDB figura `connected` con base `taskflow` y MariaDB/MySQL `connected` con base `taskflow_relational`.
- [x] Servicios locales MariaDB y MongoDB activos; puertos observados: 3306 y 27017. PostgreSQL no está activo y no aparece como dependencia de TaskFlow.
- [x] MariaDB tiene aplicadas las migraciones `001_academic_core.sql`, `002_tenant_integrity.sql` y `003_course_workspaces.sql`.
- [x] MariaDB contiene tablas `academic_*` de estudiantes, empresas, prácticas, actividades, evidencias, evaluaciones y espacios académicos/cursos.
- [x] Recuentos observados en MariaDB: 0 filas en todas las tablas `academic_*`.
- [x] Recuentos observados en MongoDB: 4 usuarios, 3 organizaciones, 4 membresías, 4 configuraciones de marca; 0 empresas, estudiantes, prácticas, actividades, evidencias y evaluaciones al consultar.

### Hallazgo de arquitectura (importante)
- [x] Los controladores operativos de estudiantes y empresas siguen usando modelos Mongoose (`Student` y `Company`) y consultas MongoDB.
- [x] Prácticas, actividades, evidencias, evaluaciones, informes, usuarios, organizaciones, membresías y branding también usan modelos Mongoose/MongoDB.
- [x] Los repositorios `academic-student.repository.js` y `academic-company.repository.js` existen y pasan pruebas aisladas, pero la búsqueda de referencias en el código de la aplicación no encontró controladores/rutas que los invoquen. Actualmente no constituyen la ruta de persistencia de la interfaz.
- [x] Las pruebas SQL CRUD/relaciones, repositorios académicos y espacios de cursos pasaron; sus transacciones se revirtieron y no conservaron datos de prueba.

### Conclusión y siguiente decisión
- MariaDB está conectada, migrada y preparada con esquema académico, pero su integración funcional con los controladores de TaskFlow está incompleta/no conectada en los flujos actuales.
- MongoDB sigue siendo la fuente efectiva de persistencia para los módulos de negocio activos.
- No se migraron ni eliminaron datos y no se cambiaron controladores durante esta auditoría.
- Antes de conectar MariaDB a producción, definir fuente única por entidad, plan de migración y estrategia de compatibilidad; evitar escrituras dobles o dos fuentes de verdad.
- PostgreSQL no se incorpora.


## 2026-11-05 — Auditoría del módulo de evidencias y preparación de entrega

### Revisión técnica
- [x] Se revisó el controlador de evidencias, rutas, middleware de carga, modelo y flujo de interfaz.
- [x] Se verificó límite de 10 MB y formatos admitidos PDF, DOCX y ZIP mediante extensión/MIME.
- [x] Se verificó almacenamiento privado con nombre aleatorio y metadatos en MongoDB.
- [x] Se verificaron controles de autenticación, CSRF, rol de estudiante para subir, propiedad de la práctica, tutor asignado para revisar, aislamiento institucional y bloqueo de prácticas finalizadas/suspendidas.
- [x] Se verificó protección de ruta de descarga para evitar salir del directorio de almacenamiento.
- [x] La prueba de integración existente realizó subida PDF, revisión, descarga y rechazo de descarga de evidencia de otra organización.

### Pruebas ejecutadas
- [x] Suite completa npm test: 63 aprobadas, 0 fallidas.
- [x] Sintaxis Node validada en controlador de evidencias, middleware de carga, rutas de evidencias, JavaScript de actividades y JavaScript de informes: 5/5 correctas.
- [x] Comprobaciones HTTP: /api/health, activities.html, practices.html, evaluations.html, reports.html y teacher-academic.html respondieron HTTP 200.
- [ ] No se declara prueba visual manual con cuentas reales en navegador; queda como validación final antes de la demostración/entrega.
- [ ] Se recomienda endurecer inspección estructural DOCX/ZIP y análisis antimalware antes de un despliegue productivo.

### Documentación generada
- [x] Se creó el informe formal escrito/INFORME_AUDITORIA_TECNICA_TASKFLOW_INGSOFT_4_9.docx.
- [x] El informe contiene objetivo, alcance, auditoría de MongoDB/MariaDB/PostgreSQL, matriz de los ocho requisitos, controles de evidencias, pruebas, hallazgos, limitaciones y conclusión.
- [x] Se generó mediante scripts/generar-informe-auditoria.py para permitir regenerarlo.
- [x] Se verificó el DOCX con python-docx: 78 párrafos y 3 tablas.
- [x] El informe declara expresamente que las pruebas automatizadas no sustituyen la prueba visual manual.


## 2026-11-05 — Avance de administración institucional y panel docente

### Administración institucional
- [x] Se identificó que el backend ya tenía CRUD institucional para estudiantes y empresas, protegido por membresía activa con rol administrador y limitado a la organización seleccionada.
- [x] Se creó `public/institution-admin.html` como nueva interfaz de administración académica institucional.
- [x] Se creó `public/js/institution-admin.js` para consultar, registrar, editar y eliminar fichas de estudiantes y empresas mediante rutas `/api/organization/*`.
- [x] La ficha del estudiante permite asignar empresa y tutor activo de la organización; el formulario incluye código, nombre, correo, teléfono, programa, semestre y estado.
- [x] La administración de empresas contempla razón social, NIT, sector, ciudad, dirección y datos de contacto.
- [x] Se creó `public/css/institution-admin.css` con tablas para escritorio, tarjetas para móvil, formularios adaptables y estados visibles.
- [x] El selector de espacio de trabajo muestra el acceso a Administración institucional únicamente cuando el rol activo de la membresía es `administrador`.
- [x] La página comprueba nuevamente el rol efectivo en el servidor; el enlace visual no sustituye los controles de autorización.
- [x] La creación de cuentas de acceso y membresías sigue separada del registro académico y se gestiona desde Administración global > Usuarios.
- [ ] Falta probar el nuevo módulo en navegador con una cuenta real que tenga rol administrador institucional; no se realizaron escrituras de prueba sobre datos reales.

### Panel docente
- [x] Se añadió al inicio docente una segunda bandeja para visualizar hasta cinco evidencias pendientes de revisión, con estudiante y actividad.
- [x] Se completó la navegación principal del inicio docente con acceso a Prácticas.
- [x] Se homogeneizó la navegación de Estructura académica para incluir Prácticas e Informes.
- [x] Se corrigió el texto de ayuda de Estructura académica para reflejar que la calificación final ponderada ya está conectada con las notas oficiales de actividades.
- [ ] Sigue pendiente revisar visualmente y probar con una cuenta docente real el panel de inicio, seguimiento, estructura académica, actividades, prácticas e informes.

### Validación posterior a los cambios
- [x] `node --check public/js/institution-admin.js` y `node --check public/js/organization-switcher.js` pasaron.
- [x] El parser HTML de Python procesó `public/institution-admin.html` sin errores.
- [x] Suite completa `npm test`: 63 aprobadas, 0 fallidas.
- [ ] Pendiente validación manual de interacción y presentación en navegador con cuentas de los roles correspondientes.

- [x] Se amplió la ficha de seguimiento docente para mostrar la evaluación oficial de cada práctica: nota, concepto, fecha, fortalezas, aspectos de mejora y observaciones.
- [x] La información de evaluación se toma del mismo informe institucional que ya alimenta el seguimiento; no se creó una fuente de datos paralela.
- [ ] La nueva sección de evaluación requiere validación visual con una práctica que tenga evaluación registrada y otra sin evaluación.


## 2026-11-05 — Cierre de consistencia del panel docente

- Se unificó la navegación del docente para que Inicio, Mis estudiantes y Evaluación de prácticas tengan acceso directo a Mis cursos.
- Se aclaró la separación conceptual entre las **unidades de los cursos** y las **etapas/ponderaciones de evaluación de las prácticas empresariales**. La interfaz de evaluación de prácticas y el gestor de actividades de prácticas ya no presentan esas etapas como unidades de cursos.
- Se corrigió el resumen responsive de Mis estudiantes (tres indicadores en tres columnas) y el `colSpan` de la tabla vacía.
- Se protegió el selector de prácticas ante respuestas asíncronas fuera de orden y se limpia la estructura anterior al cambiar de práctica.
- Se conservaron copias de respaldo de los archivos modificados (`*.bak-teacher-finish-*` y `*.bak-final-polish-*`).
- Validación: `node --check` en los cuatro scripts docentes/actividades; lectura sintáctica de cuatro páginas HTML; HTTP 200 para teacher-home, teacher-students y teacher-academic; `npm test`: 68 aprobadas, 0 fallidas.
- Alcance pendiente deliberado: todavía no se ha implementado el flujo nuevo de materiales por actividad y entregas/versiones por estudiante; se abordará después de cerrar el panel docente, sin confundirlo con las evidencias de prácticas existentes.
