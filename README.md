# TaskFlow

Sistema web para el control y seguimiento de prácticas empresariales.

## Requisitos

- Node.js 20 o superior.
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
