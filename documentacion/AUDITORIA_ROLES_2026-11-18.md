# Auditoría funcional de TaskFlow — 18 de noviembre de 2026

Base revisada: `2944df63c595a18603e82754932573c984f30fa8`, coincidente con el HEAD local y el HEAD remoto de `bleziaa/taskflow` al comenzar. Las comprobaciones se realizaron localmente con datos ficticios; este informe no certifica un despliegue de producción.

## Qué ya existía

- Inicio del estudiante con resumen de su práctica, tareas pendientes, progreso y acceso a entregas.
- Actividades de prácticas con envío de evidencias, solicitud de correcciones, aprobación, autoevaluación y nota oficial del tutor.
- Espacios de cursos con unidades, actividades, evidencias, reemplazos antes de revisión y calificación.
- Administración institucional con fichas de estudiantes, empresas, docentes disponibles y asignaciones. La administración global ya presentaba conteos de cuentas, organizaciones, estudiantes, tutores, empresas y prácticas.
- Control de acceso por organización, membresía y tutor responsable, con protección CSRF para las operaciones de escritura.

## Faltantes y correcciones

| Hallazgo comprobado | Corrección |
| --- | --- |
| Se aceptaban ZIP y faltaba DOC clásico. | Ambas cargas de evidencias aceptan únicamente PDF, DOC y DOCX por extensión y MIME; se mantiene el límite de 10 MB y la comprobación de firmas iniciales. ZIP y ejecutables se rechazan. |
| Las evidencias de prácticas y los materiales PDF forzaban descarga. | Se añadió respuesta inline autorizada para PDF y enlaces separados para ver y descargar. Word conserva la descarga. |
| El visor nativo del navegador integrado quedaba en blanco. | Visor propio con PDF.js 5.4.624 servido localmente (Node 20.16 o superior), navegación por páginas y mensajes de error. Las solicitudes del visor siguen pasando por los mismos permisos del archivo. No se envían documentos a servicios externos. |
| Editar estudiantes y empresas no conservaba el ID del formulario. Guardar intentaba crear otro registro y producía errores por duplicados. | Se conserva explícitamente `_id` en el campo oculto; comprobación visual de edición y asignación exitosa sin aumentar el conteo. |
| El total de estudiantes se calculaba sobre una lista de hasta 200 elementos. | La API devuelve `countDocuments` y el panel utiliza ese total. Regresión probada con 202 estudiantes y 200 filas devueltas. |
| Los avisos de revisión y calificación se escribían, pero permanecían ocultos. | Los avisos usan la clase de visibilidad prevista por los estilos. Se verificó visualmente la confirmación de nota guardada. |
| El estudiante no veía directamente toda la retroalimentación de la nota. | Se presenta una sección «Mi calificación» con la nota y observaciones, además de las observaciones de la entrega. |
| La limpieza de nombres de archivos de cursos reemplazaba letras normales como r y n. | Normalización compartida que conserva nombres como `informe-demo.pdf` y elimina caracteres de control, comillas y separadores. Se comprobó mediante nueva entrega. |
| Faltaba claridad en varios campos y enlaces. | Instrucciones para estudiante, formatos y tamaño visibles, etiquetas accesibles en evaluación y carga, separación de enlaces de documentos y explicación del responsable de las asignaciones. |

## Quién asigna

- **Administrador institucional:** edita la ficha del estudiante para vincular empresa y docente/tutor, y asigna docentes a cursos de su institución.
- **Docente:** puede crear una práctica; el servidor lo establece como su tutor responsable. No puede usar la edición administrativa de fichas para reasignar estudiantes.
- **Administrador:** puede editar una práctica existente. La vinculación de la ficha del estudiante y el tutor de una práctica son registros distintos; modificar la ficha no cambia retroactivamente el tutor de prácticas existentes.
- **Administración global:** gestiona cuentas y membresías institucionales.

## Pruebas funcionales visuales ejecutadas

Entorno aislado: MongoDB en memoria y una instancia MariaDB independiente en el puerto 3307, con esquema propio de auditoría y migraciones 001–009. Se usaron cuentas ficticias de estudiante, docente y administrador. No se modificaron registros reales.

| Rol / recorrido | Resultado observado |
| --- | --- |
| Estudiante → inicio y actividades de práctica | Práctica, docente y tarea visibles; envío de `informe-demo.pdf`; estado «Ya enviada · En espera de revisión». |
| Estudiante → ver PDF | Documento renderizado dentro del visor de TaskFlow: «Documento listo para leer», página 1 de 1 y contenido del PDF visible. |
| Docente → evidencia de práctica | Acceso al mismo PDF, aprobación y observación guardadas. |
| Docente → nota oficial de práctica | Nota 4,5 y observación guardadas; confirmación visible. |
| Estudiante → resultado de práctica | Entrega aprobada, nota 4,5/5 y retroalimentación del docente visibles. |
| Administrador → asignación | Conteos 1 estudiante / 1 docente; ficha actualizada con Empresa Ficticia y Profesora Demo, conservando 1 estudiante. |
| Administrador → edición de empresa | Sector actualizado y confirmación «Empresa actualizada», sin duplicado. |
| Estudiante → actividad de curso | Envío y reemplazo de PDF; estado pendiente y nombre original conservado. |
| Docente → actividad de curso | PDF renderizado y nota 4,2/5 guardada; estado aprobado. |
| Estudiante → resultado del curso | «Actividad aprobada» y «Calificación: 4.2 / 5» visibles. |

Las capturas de estos recorridos se entregan junto con el informe local. Contienen únicamente datos ficticios.

## Pruebas automáticas

`npm test`: **101 pruebas aprobadas, 0 fallidas, 0 omitidas**.

Se añadió `tests/academic-delivery-audit.test.js`, que cubre el ciclo de entrega, bloqueo de entrega duplicada, corrección, nota y lectura por estudiante; PDF inline frente a descarga; rechazo de acceso anónimo, estudiante revisor y tutor ajeno; asignación administrativa; conteo de 202 estudiantes; filtros de ambas cargas y límite de 10 MB; disponibilidad local de PDF.js y conservación de nombres de archivos.

Comprobación adicional contra el servidor real de pruebas con MariaDB: aceptación de DOC/DOCX con firmas de prueba, rechazo de ZIP en ambas actividades, nombres originales conservados, Word servido como descarga, PDF de curso inline para docente autorizado y acceso anónimo rechazado.

## Alcance y pendientes conocidos

- La certificación es local y cubre los recorridos descritos; no se verificó un despliegue remoto ni todos los navegadores/dispositivos.
- DOC/DOCX se aceptan como entregas descargables; no se añadió un visor Word. Los materiales de apoyo continúan limitados a PDF.
- Las firmas iniciales detectan discrepancias básicas; no constituyen validación completa de estructuras Word ni análisis antivirus.
- La tabla administrativa sigue mostrando hasta 200 registros y su búsqueda es local a los registros cargados. El conteo total ya es correcto; la paginación o búsqueda remota para instituciones más grandes queda pendiente.
- Hay dos modelos académicos existentes: prácticas en MongoDB y cursos en MySQL/MariaDB. No se rediseñó su sincronización.
- La fecha de práctica almacenada como medianoche UTC puede aparecer un día antes en Colombia en algunas pantallas existentes; no se modificó el modelo de fechas en esta auditoría.
- La auditoría de dependencias detectó seis avisos en la cadena de desarrollo de nodemon. No se aplicaron actualizaciones forzadas ajenas a esta corrección. El visor se integra mediante la biblioteca local PDF.js; referencia técnica: https://mozilla.github.io/pdf.js/examples/.

## Conservación del trabajo local

Los documentos, scripts, respaldos y borradores que ya estaban sin seguimiento se conservaron. Se excluyeron de la actualización los archivos de entorno, credenciales, bases de prueba, archivos entregados por usuarios, capturas locales y temporales de auditoría. Se añadió `/work/` y las copias `*.before-refresh.bak` a las exclusiones de Git.
