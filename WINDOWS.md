# TaskFlow en Windows

Instala Node.js >=20.16 y MongoDB (local o Atlas). Si habilitas MySQL, instala/configura también MySQL. Abre PowerShell en el proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-windows.ps1
```

En el primer inicio el lanzador crea una copia local de `.env.example` como `.env` y **se detiene** para permitir rellenar la conexión MongoDB, `SESSION_SECRET` y el resto de parámetros. No genera credenciales ni inicia una base de datos por sí solo. En las ejecuciones siguientes instala las dependencias con `npm ci` si faltan y ejecuta `npm start`.

Pruebas: `npm test`. La dirección web por defecto es http://127.0.0.1:3000. No publiques el servidor ni subas `.env` al repositorio. Esta guía no migra los datos del equipo Linux: realiza una exportación/importación respaldada si necesitas conservarlos.
