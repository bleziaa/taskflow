const { env, validarEntorno } = require('./config/env');
const { conectarDB, desconectarDB, estadoDB } = require('./config/db');
const { conectarMySQL, desconectarMySQL, estadoMySQL } = require('./config/mysql');
const { crearSessionStore } = require('./config/session');
const { crearApp } = require('./app');
const User = require('./models/User');

async function iniciar() {
  validarEntorno();

  await conectarDB();
  await conectarMySQL();
  await User.init();
  const estudiantesMigrados = await User.updateMany({ role: 'user' }, { $set: { role: 'estudiante' } });
  const administradoresMigrados = await User.updateMany({ role: 'admin' }, { $set: { role: 'administrador' } });
  if (estudiantesMigrados.modifiedCount || administradoresMigrados.modifiedCount) {
    console.log(`[db] Roles antiguos migrados: ${estudiantesMigrados.modifiedCount} estudiantes, ${administradoresMigrados.modifiedCount} administradores`);
  }

  const { name } = estadoDB();
  console.log(`[db] Conectado a MongoDB (base: ${name})`);
  const mysql = estadoMySQL();
  console.log(mysql.enabled ? `[db] Conectado a MySQL (base: ${mysql.database})` : '[db] MySQL deshabilitado (integracion opt-in)');

  const app = crearApp({ sessionStore: crearSessionStore() });

  const server = app.listen(env.port, () => {
    console.log(`[server] TaskFlow escuchando en http://127.0.0.1:${env.port}`);
    console.log(`[server] Salud disponible en http://127.0.0.1:${env.port}/api/health`);
  });

  let cerrando = false;

  const apagar = (motivo) => {
    if (cerrando) return;
    cerrando = true;

    console.log(`[server] Cerrando por: ${motivo}`);

    server.close(async () => {
      try {
        await Promise.all([desconectarDB(), desconectarMySQL()]);
        console.log('[server] Conexiones cerradas. Hasta luego.');
        process.exit(0);
      } catch (error) {
        console.error('[server] Error al cerrar la conexion:', error);
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => apagar('SIGINT'));
  process.on('SIGTERM', () => apagar('SIGTERM'));

  process.on('unhandledRejection', (motivo) => {
    console.error('[server] Promesa rechazada sin manejar:', motivo);
    apagar('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    console.error('[server] Excepcion no capturada:', error);
    apagar('uncaughtException');
  });

  return server;
}

if (require.main === module) {
  iniciar().catch((error) => {
    console.error('[server] No se pudo iniciar TaskFlow:', error.message);
    process.exit(1);
  });
}

module.exports = { iniciar };
