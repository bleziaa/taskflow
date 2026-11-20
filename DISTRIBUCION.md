# TaskFlow para Windows y Linux

1. Descarga el paquete x64 para tu sistema en Releases y extrae toda la carpeta en una ubicación donde puedas escribir.
2. Inicia MongoDB. En la primera ejecución, TaskFlow crea `.env` con conexión a `mongodb://127.0.0.1:27017/taskflow` y un secreto de sesión generado en tu equipo. Puedes editar `.env` para indicar otra instancia MongoDB.
3. En Windows, abre `start-windows.cmd`. En Linux, ejecuta `./start-linux.sh`. La aplicación abre el navegador en `http://127.0.0.1:3000` cuando está lista.
4. Usa el enlace de registro para una cuenta de estudiante. Para instalar una cuenta de administración, configura `ADMIN_NAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` localmente y ejecuta `runtime\node.exe scripts\create-admin.js` en Windows o `./runtime/node scripts/create-admin.js` en Linux. Se requiere una contraseña de al menos 12 caracteres.

El paquete incluye Node.js y todas las dependencias de producción. MongoDB se administra de forma independiente. Los flujos de cursos y matrícula que usan MySQL requieren habilitarlo y aplicar las [migraciones](database/mysql/README.md). El correo y el asistente IA requieren sus credenciales respectivas. Conserva `.env`, `storage/` y el respaldo de las bases al actualizar.

Para diagnosticar el arranque, abre el iniciador desde una terminal o añade `--no-browser`. Si el puerto 3000 está ocupado, ajusta `PORT` en `.env`. Comprueba `/api/health` en la URL de la consola. En Linux, usa `tar -xzf nombre-del-paquete.tar.gz` al extraer para preservar permisos.

En GitHub Actions se ejecutan las pruebas de Node y MongoDB en Windows y Linux. Un trabajo Linux comprueba además la matrícula con MySQL.
