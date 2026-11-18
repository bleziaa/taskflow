# TaskFlow

Sistema web para el control y seguimiento de prácticas empresariales.

## Requisitos

- Node.js 20.16 o superior (requerido por el visor PDF).
- npm.
- Acceso a las bases de datos configuradas para el entorno que se vaya a utilizar.

## Puesta en marcha local

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

## Pruebas

```bash
npm test
```

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
