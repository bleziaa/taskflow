# TaskFlow

Sistema web de control y seguimiento de prácticas empresariales, con espacios académicos para cursos, actividades, evidencias, evaluaciones e informes. Incluye gestión de usuarios y roles, organizaciones y asignaciones de docentes y estudiantes.

## Tecnologías y arquitectura

- Node.js y JavaScript del lado del servidor.
- Express 5 para rutas y servicios HTTP.
- MongoDB con Mongoose para identidad, organizaciones, sesiones y flujos de prácticas.
- MySQL mediante mysql2 para la estructura académica relacional cuando se habilita su integración.
- HTML, CSS y JavaScript para la interfaz web.
- PDF.js para visualizar documentos dentro de la aplicación.
- Nodemailer para correo y Gemini opcional para el asistente.

El servidor sirve la aplicación desde `public/`, valida formularios, aplica permisos y expone la API. MongoDB es obligatorio. MySQL es opcional para las funciones relacionales de cursos y matrícula. El correo, Cloudinary y Gemini se configuran solo cuando se necesitan.

## Requisitos

- Node.js 20.16 o superior al ejecutar desde el código fuente. Los paquetes descargables incluyen Node.js.
- npm.
- Acceso a las bases de datos configuradas para el entorno que se vaya a utilizar.

## Puesta en marcha desde el código fuente

1. Abrir una terminal en esta carpeta.
2. Instalar dependencias si aún no están instaladas:

   ```bash
   npm install
   ```

3. Revisar la configuración del entorno. Usar `.env.example` como guía y completar las variables localmente. No compartir ni subir archivos `.env` ni credenciales.
4. Iniciar el servidor:

   ```bash
   npm start
   ```

Para desarrollo con recarga automática:

```bash
npm run dev
```

## Pruebas y automatización

```bash
npm test
```

GitHub Actions ejecuta las pruebas en Windows y Linux y verifica el inicio del paquete descargable. Un trabajo adicional prueba los flujos de matrícula con MySQL.

## Mapa del proyecto

| Ruta | Contenido |
| --- | --- |
| `src/` | Código del servidor: rutas, controladores, modelos, repositorios y servicios |
| `public/` | Interfaz web y recursos públicos |
| `database/` | Estructuras y recursos de bases de datos |
| `scripts/` | Migraciones, verificaciones y utilidades de mantenimiento |
| `tests/` | Pruebas automatizadas |
| `storage/` | Archivos cargados y recursos locales |
| `documentacion/` | Documentación técnica y funcional en Markdown |
| `escrito/` | TCC, informes y documentos académicos Word |
| `evidencias/` | Capturas y soportes de funcionamiento |
| `backups/` | Copias de seguridad de versiones anteriores |
| `reports/` | Reportes y artefactos históricos; conservar separado del código activo |
| `_/` | Copia/estructura auxiliar de publicación web; no confundir con el código fuente principal |

## Documentación

Los archivos de `documentacion/` describen módulos, administración, prácticas, evaluaciones, evidencias, cursos, informes, cambios de frontend y propuestas funcionales.

## Calificaciones e informes

- El estudiante puede solicitar formalmente la revisión de una calificación oficial desde la actividad.
- El tutor asignado responde aceptando o rechazando la solicitud; si la acepta, puede ajustar la nota. Se conserva el historial de la solicitud y la calificación anterior.
- La página de informes permite filtrar y exportar CSV o imprimir/guardar en PDF.
- Detalles funcionales y rutas: documentacion/revision-notas-y-exportacion.md.

## Bases de datos y configuración

La aplicación utiliza los adaptadores y variables definidos en el código para MongoDB y MySQL. Los archivos de entorno y credenciales contienen configuración privada: no copiarlos a repositorios públicos ni compartirlos.

- `.env.example`: plantilla sin secretos.
- `.env`: configuración local activa.
- `.env.offline`: configuración local/offline.
- `atlas-credentials.env`: credenciales auxiliares de Atlas; mantener privado.

## Reglas para mantener el orden

- El código activo permanece en `src/`, `public/`, `scripts/` y `tests/`.
- No guardar copias de seguridad dentro de `src/` ni `public/`.
- Antes de reemplazar archivos de producción, crear una copia en `backups/`.
- No borrar archivos de entorno, bases de datos, evidencias ni copias anteriores sin verificar primero su uso.
## Informe del TCC de Desarrollo Web

La documentación de formularios, validaciones, modelo MongoDB, operaciones CRUD y matriz de pruebas está en [`documentacion/tcc/INFORME_TCC_DESARROLLO_WEB.md`](documentacion/tcc/INFORME_TCC_DESARROLLO_WEB.md). Los casos manuales sin ejecutar se identifican como pendientes y no se presentan como evidencias realizadas.

## Paquetes para usuarios finales

Descarga el paquete con Node.js y dependencias desde [GitHub Releases](https://github.com/bleziaa/taskflow/releases/tag/cross-v0.1.0). MongoDB debe estar iniciado. MySQL/MariaDB se requiere para los flujos académicos relacionales. Consulta [la guía de distribución](DISTRIBUCION.md).

