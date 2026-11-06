/**
 * Conexion a MongoDB mediante Mongoose.
 *
 * No se conecta al importar el modulo: la conexion se inicia de forma
 * explicita desde server.js (o desde las pruebas) llamando a conectarDB().
 */
const mongoose = require('mongoose');
const { env } = require('./env');

const ESTADOS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Abre la conexion principal con MongoDB.
 * @param {string} [uri] Cadena de conexion (por defecto MONGODB_URI).
 * @returns {Promise<import('mongoose').Connection>}
 */
async function conectarDB(uri = env.mongoUri) {
  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  return mongoose.connection;
}

/**
 * Cierra la conexion de forma ordenada, si esta abierta.
 */
async function desconectarDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Devuelve el estado actual de la conexion para el endpoint de salud.
 * @returns {{ status: string, name: string | null }}
 */
function estadoDB() {
  return {
    status: ESTADOS[mongoose.connection.readyState] || 'unknown',
    name: mongoose.connection.name || null,
  };
}

module.exports = { conectarDB, desconectarDB, estadoDB };
