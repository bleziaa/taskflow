# Bitácora de cambios del frontend

## 1 de noviembre de 2026

### Enlace al video explicativo
- **Archivo:** `public/index.html`.
- **Sección:** «¿Cómo funciona?».
- **Cambio:** se agregó debajo de los cinco pasos un botón «Ver video explicativo» que abre el enlace de YouTube proporcionado.
- **Comportamiento:** el video se abre en una pestaña nueva; se incluyeron `rel="noopener noreferrer"` y una etiqueta accesible para el enlace.
- **Alcance:** cambio limitado a la página de inicio. No modifica lógica, servidor ni base de datos.

### Retiro del enlace «Panel» de la navegación principal
- **Archivo:** `public/index.html`.
- **Sección:** barra de navegación superior del inicio.
- **Cambio:** se eliminó únicamente el elemento de menú «Panel» que apuntaba a `dashboard.html`.
- **Se conserva:** Inicio, Funciones, Cómo funciona, Empresas e Iniciar sesión.
- **Alcance:** no se eliminó `dashboard.html` ni los enlaces a funciones/tableros dentro de las tarjetas; solo desaparece el acceso directo «Panel» de la barra superior.

### Retiro del enlace «Panel» en la página de inicio de sesión
- **Archivo:** `public/login.html`.
- **Sección:** barra de navegación superior.
- **Cambio:** se eliminó únicamente el elemento «Panel» que apuntaba a `dashboard.html`.
- **Se conserva:** Inicio, Funciones, Cómo funciona e Iniciar sesión.
- **Alcance:** no se modificó el formulario ni el dashboard.

### Ajuste de navegación en inicio de sesión
- **Archivo:** `public/login.html`.
- **Cambio:** se retiraron los enlaces de navegación Inicio, Funciones, Cómo funciona, Panel e Iniciar sesión. Se añadió únicamente el botón visible **Volver al inicio**, que dirige a `index.html`.
- **Se conserva:** el formulario de acceso y sus funciones, el enlace de recuperación de contraseña y el pie institucional.
- **Alcance:** cambio visual de navegación; no se modificó la autenticación.

### Corrección del tema en inicio de sesión
- **Archivo:** `public/login.html`.
- **Cambio:** se aplica la preferencia `taskflow-theme` antes de cargar las hojas de estilo; si no hay preferencia guardada, el login inicia en modo claro.
- **Objetivo:** evitar que la pantalla de acceso aparezca en modo oscuro cuando la preferencia activa es clara.
- **Alcance:** no se modificó la autenticación ni el formulario.

- Corrección adicional del tema en `login.html`: `js/theme.js` ya no reemplaza el tema claro preparado por el login con la preferencia del sistema cuando no existe un valor guardado; si hay una preferencia explícita `light` o `dark`, se respeta.

- Se igualó la selección inicial de tema entre portada y login: si existe `taskflow-theme`, se respeta `light` o `dark`; si no existe, ambas páginas recurren a `prefers-color-scheme`.

### Sincronización del tema entre archivos locales
- **Archivos:** `public/index.html`, `public/login.html` y `public/js/theme.js`.
- **Causa identificada:** al abrir las páginas mediante `file://`, el navegador puede aislar `localStorage` por archivo, por lo que la portada y el login no siempre comparten `taskflow-theme`.
- **Cambio:** los enlaces de inicio de sesión transmiten el tema activo mediante el parámetro `?theme=light` o `?theme=dark`; el login lo aplica antes de cargar los estilos. El enlace «Volver al inicio» transmite el tema de regreso y `theme.js` prioriza el valor explícito de la URL.
- **Alcance:** sincronización visual entre páginas locales; no modifica el formulario, la autenticación ni el servidor.
- **Validación:** cambios escritos y revisados en los archivos. Pendiente de prueba visual de navegación en el navegador.

### Panel general de administración
- Se reorientó el encabezado y la navegación para que el administrador gestione la plataforma, no las tareas operativas del docente.
- La gestión de cuentas se presenta como alta y mantenimiento de docentes/tutores y estudiantes.
- Se incorporó un resumen visual en `public/admin.html` con indicadores de estudiantes, docentes/tutores, cuentas, empresas, prácticas, actividades, evidencias y evaluaciones.
- `GET /api/admin/dashboard` calcula los indicadores mediante consultas y agregaciones reales en MongoDB, protegido por autenticación y rol administrador.
- `public/js/admin.js` carga los datos al entrar y permite actualizarlos manualmente; muestra fecha y hora de consulta local.
- Se agregó el desglose de cantidad y promedio de evaluaciones por empresa mediante relaciones Evaluación → Práctica → Empresa.
- Los estados se muestran por separado para no confundir pendientes, revisiones, aprobaciones y finalizaciones.
- No hay todavía entidades/campos de curso o materia en los modelos actuales; por eso no se presenta ese desglose hasta modelarlo correctamente.
- Se amplió la prueba del endpoint administrativo para validar que entregue indicadores y el desglose por empresa; suite completa: 52 pruebas aprobadas, 0 fallidas. Servidor verificado con `/api/health` HTTP 200.

### Búsqueda en administración
- Se añadieron campos de búsqueda para cuentas, estudiantes y empresas en `public/admin.html`.
- `public/js/admin.js` consulta los endpoints existentes con `q` y espera 250 ms tras escribir para evitar solicitudes por cada tecla.
- Los resultados de cuentas/empresas no reemplazan las listas completas usadas en los selectores de asignación de tutores y empresas.
- Se añadieron estilos adaptables en `public/css/admin.css`.

### Acceso privado y cierre del registro público
- Se deshabilitó `POST /api/auth/register`; la creación de cuentas queda reservada al administrador.
- `register.html` redirige al inicio de sesión y explica que el registro público está deshabilitado.
- Se actualizó la prueba de autenticación para comprobar que el endpoint público no crea cuentas.
- El envío automático de credenciales por correo sigue pendiente: el proyecto aún no tiene proveedor SMTP configurado.

### Ajustes del panel de administrador y duración de sesión
- **Archivo:** `public/dashboard.html`.
- **Cambio:** se retiraron de la barra superior los enlaces «Inicio», «Tablero» y «Equipo»; se conservaron las secciones y la navegación lateral del dashboard.
- **Sesión:** `.env` y `.env.example` configuran una duración de 10 minutos (`600000` ms). Se activó `rolling: true` en `src/config/session.js`, de modo que la cookie se renueva mientras el usuario sigue usando la plataforma y vence tras 10 minutos sin actividad.
- **Alcance:** no se modificaron las credenciales ni el flujo de autenticación. El cambio de duración requiere reiniciar el servidor para que tome la nueva configuración.


## 2026-11-04 — Actualización del centro de control global
- Se reemplazó el contenido obsoleto de `public/admin.html`: ya no afirma que organizaciones, membresías o identidad visual estén en preparación.
- El centro de control ahora presenta accesos directos a Organizaciones, Usuarios e Identidad visual.
- Se agregó `public/js/admin-dashboard.js`, que valida la sesión y el rol de administrador general y consulta en paralelo:
  - `GET /api/admin/users` para el total de cuentas.
  - `GET /api/admin/organizations` para el total de instituciones.
  - `GET /api/admin/dashboard` para estudiantes, tutores, empresas y prácticas.
- Los indicadores muestran valores numéricos formateados para Colombia y fecha/hora de actualización. Si una consulta falla, el panel informa que la información es parcial.
- Se conserva el cierre de sesión protegido con token CSRF.
- Verificación inicial: `node --check public/js/admin-dashboard.js` correcto; `admin.html` y el nuevo script responden HTTP 200; las tres APIs administrativas responden 401 sin sesión, como corresponde.
- No se modificaron los módulos de organizaciones, usuarios ni identidad visual ni se alteraron datos de MongoDB/MariaDB.


## Restablecimiento seguro de contraseña desde Usuarios (4 nov 2026)
- Se añadió `POST /api/admin/users/:id/reset-password`, protegido por sesión de administrador global y token CSRF.
- Genera una clave temporal aleatoria criptográficamente segura, guarda únicamente su hash bcrypt (12 rondas), marca `debeCambiarPassword=true` y devuelve la clave temporal una sola vez en la respuesta al administrador.
- Rechaza cuentas inexistentes, administradores globales e inactivas. No envía la clave por correo ni la registra en logs.
- En `admin-usuarios.html`, la ficha de usuario incorpora «Restablecer contraseña», confirmación previa, campo temporal, botón de copiar y opción de ocultar/limpiar el valor.
- La contraseña anterior deja de funcionar; el titular debe cambiar la temporal al iniciar sesión.
- Pruebas nuevas: 4 casos (generación y hash, CSRF, cuentas no elegibles y usuario sin permisos). Suite completa: 61/61 aprobadas.
- Este cambio implementa la acción; no se ha restablecido todavía la contraseña de ninguna cuenta.

## Ajuste de espaciado de acciones administrativas (4 nov 2026)
- Se amplió el espacio entre grupos de botones y acciones en los paneles administrativos.
- Se normalizó la altura mínima, el relleno y la alineación de los botones principales, formularios, selector de identidad y asignación de miembros.
- Se mejoró la separación entre acciones secundarias en tablas y filas de recursos de identidad.
- En pantallas pequeñas, las acciones de formularios e identidad pasan a ocupar filas completas para evitar que queden apretadas.
- Alcance limitado a `public/css/admin.css`; no se modificó lógica, contenido de botones ni datos.
- Se creó respaldo previo en `backup-ui-buttons-20261104/`.
- Pendiente: comprobación visual en navegador de los botones concretos que se perciben vacíos; hace falta identificar esas vistas para ajustar su contenido sin inventar acciones.


## Ampliación y redistribución del panel de trabajo (4 nov 2026)
- **Archivo:** `public/css/dashboard-fix.css`.
- Se amplió el ancho máximo del panel de 1200 a 1600 px para aprovechar mejor monitores grandes.
- Se aumentó moderadamente el ancho de la barra lateral y el espacio entre esta y el contenido principal.
- Se eliminó la restricción de ancho del contenido y se aumentó la separación entre secciones.
- Se mejoró el espacio interior de tarjetas, encabezados, estadísticas, columnas Kanban y celdas de tablas.
- Se mantuvieron puntos de adaptación para tabletas y móviles: la barra lateral pasa arriba del contenido y las columnas se apilan en pantallas pequeñas.
- Se creó respaldo previo en `backup-ui-buttons-20261104/dashboard-fix.css`.
- Alcance exclusivamente visual; no se modificó JavaScript, autenticación, almacenamiento ni bases de datos.
- Pendiente: recargar el dashboard en el navegador y validar visualmente en escritorio y móvil.


## Corrección de navegación del módulo Actividades (4 nov 2026)
- Se restauraron en `public/activities.html` los enlaces principales **Evaluaciones** (`evaluations.html`) e **Informes** (`reports.html`).
- El menú de Actividades ahora mantiene la misma navegación principal que Prácticas, Evaluaciones e Informes: Mi panel, Prácticas, Actividades, Evaluaciones e Informes.
- Se conservó el enlace condicional de Administración, el nombre del usuario y el botón Cerrar sesión.
- Se creó respaldo previo en `backup-ui-buttons-20261104/activities.html`.
- Cambio limitado al HTML de navegación; no se modificaron permisos, JavaScript, API ni bases de datos.
- Validación automatizada: los cinco enlaces principales están presentes. Se comprobó la respuesta HTTP de `activities.html`.


## Refinamiento visual de administración (4 nov 2026)
- Se creó `public/css/admin-polish.css` como capa de estilos adicional, sin sobrescribir la hoja de tema ni la identidad de marca.
- Se mantuvo el morado principal definido en `theme.css` (`#6841b8` en modo claro), junto con la paleta negra/blanca y el modo oscuro existentes.
- Se amplió el espacio entre enlaces de navegación, botones, pestañas, acciones de formularios y controles.
- Se mejoró la respiración de tarjetas métricas, accesos directos, superficies, formularios y directorios en los cuatro paneles administrativos.
- Se añadieron ajustes responsivos para móvil/tablet y respeto a `prefers-reduced-motion`.
- Se aplicó a `admin.html`, `admin-organizaciones.html`, `admin-usuarios.html` y `admin-identidad.html`.
- Respaldo previo de los HTML y CSS existentes en `backup-admin-polish-20261104/`.
- Validación estática: los cuatro HTML cargan una sola vez la nueva hoja; 74 bloques CSS balanceados; el morado original sigue intacto. El CSS y `admin.html` responden HTTP 200.
- No se modificaron JavaScript, API, permisos ni bases de datos.


## Refinamiento visual del panel estudiantil (4 nov 2026)
- Se creó `public/css/student-polish.css` como capa visual adicional, sin cambiar lógica de negocio ni JavaScript.
- Se aplicó a `dashboard.html`, `practices.html`, `activities.html`, `evaluations.html` y `reports.html`.
- Se mejoraron jerarquía de títulos, separación de secciones, navegación lateral y superior, tarjetas, indicadores, columnas Kanban, tablas, formularios, modales y botones.
- Se añadieron ajustes responsivos para tablet/móvil y respeto a `prefers-reduced-motion`.
- Se cambió el favicon azul del dashboard al morado oficial `#6841b8` para mantener coherencia con la marca.
- Respaldo previo en `backup-student-polish-20261104/`.
- Validación: las cinco páginas cargan una sola vez la nueva hoja; CSS con llaves balanceadas; morado original conservado. Prácticas, actividades, evaluaciones e informes y la hoja CSS responden HTTP 200. El dashboard responde HTTP 302 sin sesión, redirigiendo al login como corresponde.
- Suite completa: 61 pruebas aprobadas, 0 fallidas.
- No se modificaron JavaScript, API, permisos ni bases de datos.
