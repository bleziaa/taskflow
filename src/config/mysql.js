
const mysql = require('mysql2/promise');
const { env } = require('./env');

let pool = null;
let estado = 'disabled';
let ultimoError = null;

async function conectarMySQL() {
  if (!env.mysql.enabled) {
    estado = 'disabled';
    return null;
  }
  if (pool) return pool;

  if (!env.mysql.user || !env.mysql.database) {
    throw new Error('MYSQL_ENABLED=true requiere MYSQL_USER y MYSQL_DATABASE.');
  }

  const nuevoPool = mysql.createPool({
    host: env.mysql.host,
    port: env.mysql.port,
    user: env.mysql.user,
    password: env.mysql.password,
    database: env.mysql.database,
    waitForConnections: true,
    connectionLimit: env.mysql.connectionLimit,
    queueLimit: 0,
    charset: 'utf8mb4',
    enableKeepAlive: true,
    decimalNumbers: true,
  });

  try {
    const conexion = await nuevoPool.getConnection();
    await conexion.ping();
    conexion.release();
    pool = nuevoPool;
    estado = 'connected';
    ultimoError = null;
    return pool;
  } catch (error) {
    await nuevoPool.end().catch(() => {});
    estado = 'error';
    ultimoError = error.code || 'MYSQL_CONNECTION_ERROR';
    throw new Error(`No fue posible conectar con MySQL (${ultimoError}).`);
  }
}

async function desconectarMySQL() {
  if (pool) await pool.end();
  pool = null;
  estado = env.mysql.enabled ? 'disconnected' : 'disabled';
}

function obtenerPoolMySQL() {
  if (!pool || estado !== 'connected') {
    throw new Error('MySQL no esta conectado.');
  }
  return pool;
}

function estadoMySQL() {
  return {
    enabled: env.mysql.enabled,
    status: estado,
    database: env.mysql.enabled ? env.mysql.database : null,
    error: ultimoError,
  };
}

module.exports = { conectarMySQL, desconectarMySQL, obtenerPoolMySQL, estadoMySQL };
