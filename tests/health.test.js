/**
 * Pruebas de la Fase 0.
 *
 * Usan node:test como ejecutor y Supertest para las peticiones HTTP.
 * La base de datos es efimera (MongoMemoryServer) y reutiliza el binario
 * de MongoDB ya instalado en el sistema para no descargar nada.
 * Nunca tocan la base real "taskflow".
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
// Las pruebas de salud usan MySQL deshabilitado, aunque el .env local lo active.
process.env.MYSQL_ENABLED = 'false';
process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskflow-test-env';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'secreto-solo-para-pruebas';
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '8.2.5';

const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');

let mongo;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('GET /api/health responde 200 y reporta MongoDB conectado', async () => {
  const res = await request(app).get('/api/health');

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.status, 'ok');
  assert.equal(res.body.data.database.mongodb.status, 'connected');
  assert.ok(res.body.data.database.mongodb.name, 'debe informar el nombre de la base');
  assert.equal(res.body.data.database.mysql.enabled, false);
  assert.equal(res.body.data.database.mysql.status, 'disabled');
  assert.equal(typeof res.body.data.uptimeSeconds, 'number');
});

test('una ruta inexistente responde 404 con formato de error uniforme', async () => {
  const res = await request(app).get('/api/no-existe');

  assert.equal(res.status, 404);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'NOT_FOUND');
  assert.match(res.body.error.message, /Ruta no encontrada/);
});
