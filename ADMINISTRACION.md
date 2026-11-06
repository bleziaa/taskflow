# Administración de TaskFlow

## Acceso y seguridad
El registro público está deshabilitado: no se pueden crear cuentas desde `register.html` ni desde `/api/auth/register`. Las cuentas de tutor y estudiante se crean exclusivamente desde el panel de administración; la cuenta administradora inicial se provisiona desde la terminal. El módulo requiere una sesión autenticada con rol `administrador`. Las operaciones de escritura requieren token CSRF. Las contraseñas se cifran con bcrypt y nunca se devuelven en las respuestas de la API. Las cuentas desactivadas no pueden iniciar sesión ni seguir usando endpoints protegidos.

La creación de la primera cuenta administradora se realiza desde la terminal con `npm run create-admin`; el panel no permite crear ni eliminar administradores.

## Funciones administrativas
- Crear, consultar, editar y eliminar estudiantes.
- Crear, consultar, editar y eliminar empresas.
- Crear cuentas de acceso para tutores y estudiantes desde el panel privado. La contraseña inicial se entrega al usuario por el canal institucional definido por el administrador; el envío automático por correo aún no está integrado.
- Editar nombre y correo, restablecer contraseña y activar/desactivar cuentas.
- Asignar un tutor activo y una empresa a cada estudiante.
- Vincular automáticamente la cuenta de estudiante con el registro académico cuando coinciden los correos, tanto si se crea primero la cuenta como si se crea primero el registro.
- Impedir eliminar empresas vinculadas a estudiantes.
- Impedir eliminar cuentas de tutor/estudiante que estén vinculadas a registros académicos.
- Buscar estudiantes, empresas y cuentas desde el panel mediante campos de búsqueda; filtrar cuentas por nombre/correo y registros por sus datos principales.

## Endpoints
- `GET/POST /api/admin/students`
- `GET/PATCH/DELETE /api/admin/students/:id`
- `GET/POST /api/admin/companies`
- `GET/PATCH/DELETE /api/admin/companies/:id`
- `GET/POST /api/admin/users`
- `PATCH/DELETE /api/admin/users/:id`

Para crear una cuenta de tutor o estudiante se envían `nombre`, `email`, `password` (mínimo 12 caracteres) y `role`. No se permite crear administradores desde esta API.

## Puesta en marcha
1. Inicia MongoDB y el servidor con `npm start`.
2. Abre `http://127.0.0.1:3000/login.html`.
3. Inicia sesión con una cuenta administradora.
4. Abre `http://127.0.0.1:3000/admin.html`.


## Administración académica institucional

La interfaz `institution-admin.html` está destinada a una cuenta que tenga una membresía activa con rol **Administrador institucional** en la organización seleccionada. El selector de espacio de trabajo muestra el acceso a este módulo solo para ese rol.

Desde este módulo se puede:
- Registrar, consultar, editar y eliminar fichas de estudiantes.
- Asignar a cada estudiante una empresa de prácticas y un tutor activo de la misma organización.
- Registrar, consultar, editar y eliminar empresas de prácticas.
- Buscar registros por los datos principales.

Las operaciones usan exclusivamente las rutas `/api/organization/students`, `/api/organization/companies` y `/api/organization/tutors`. El servidor valida la membresía y limita las consultas y cambios a la organización activa. La interfaz no concede permisos por sí sola.

Las cuentas de acceso son independientes de las fichas académicas. El administrador general crea las cuentas y las membresías desde `admin-usuarios.html`; luego el usuario inicia sesión y selecciona la institución donde tiene el rol administrativo.

## Acceso a la administración institucional

1. El administrador general crea una organización desde `admin-organizaciones.html`.
2. Desde el módulo Usuarios crea una cuenta de docente/tutor y la vincula a la organización con rol institucional **Administrador**.
3. La persona inicia sesión y selecciona esa organización en el selector de espacio de trabajo.
4. El menú muestra **Administración institucional**, que abre `institution-admin.html`.
5. Desde allí administra estudiantes y empresas; las prácticas se gestionan en el módulo Prácticas.
