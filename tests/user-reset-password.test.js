const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskflow-reset-test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '8.2.5';
// Fuerza SMTP deshabilitado aunque el .env local tenga credenciales reales
// de Gmail configuradas, para no enviar correos reales durante la suite
// y mantener el resultado determinista (ver tests/organizations.test.js).
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.SMTP_FROM = '';
const { MongoMemoryServer } = require('mongodb-memory-server');
const { crearApp } = require('../src/app');
const User = require('../src/models/User');
let mongo, app, admin, student;
const ORIGINAL = 'PasswordOriginal123!';
async function csrf(agent) {
  const r = await agent.get('/api/auth/csrf-token');
  assert.equal(r.status, 200);
  return r.body.data.csrfToken;
}
async function login(agent, email, password) {
  const token = await csrf(agent);
  return agent.post('/api/auth/login').set('X-CSRF-Token', token).send({ email, password });
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.init();
  app = crearApp();
});
beforeEach(async () => {
  await User.deleteMany({});
  admin = await User.create({ nombre: 'Admin', email: 'admin@test.local', role: 'administrador', passwordHash: await bcrypt.hash(ORIGINAL, 4) });
  student = await User.create({ nombre: 'Estudiante', email: 'student@test.local', role: 'estudiante', passwordHash: await bcrypt.hash(ORIGINAL, 4) });
});
after(async () => { await mongoose.disconnect(); await mongo.stop(); });
test('administrador puede generar clave temporal de cuenta activa y obliga a cambiarla', async () => {
  const agent = request.agent(app);
  assert.equal((await login(agent, admin.email, ORIGINAL)).status, 200);
  const token = await csrf(agent);
  const res = await agent.post('/api/admin/users/' + student.id + '/reset-password').set('X-CSRF-Token', token).send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.data.usuario.debeCambiarPassword, true);
  const temporal = res.body.data.credenciales.passwordTemporal;
  assert.equal(typeof temporal, 'string');
  assert.ok(temporal.length >= 24);
  const updated = await User.findById(student.id);
  assert.equal(await bcrypt.compare(temporal, updated.passwordHash), true);
  assert.equal(await bcrypt.compare(ORIGINAL, updated.passwordHash), false);
});
test('el restablecimiento requiere token CSRF válido', async () => {
  const agent = request.agent(app);
  await login(agent, admin.email, ORIGINAL);
  const res = await agent.post('/api/admin/users/' + student.id + '/reset-password').set('X-CSRF-Token', 'invalid').send({});
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'CSRF_INVALID');
});
test('no permite restablecer cuentas inactivas ni administradores', async () => {
  const agent = request.agent(app);
  await login(agent, admin.email, ORIGINAL);
  const token = await csrf(agent);
  student.activo = false;
  await student.save();
  const inactive = await agent.post('/api/admin/users/' + student.id + '/reset-password').set('X-CSRF-Token', token).send({});
  assert.equal(inactive.status, 409);
  const adminReset = await agent.post('/api/admin/users/' + admin.id + '/reset-password').set('X-CSRF-Token', token).send({});
  assert.equal(adminReset.status, 404);
});
test('una cuenta sin privilegios administrativos no puede restablecer claves', async () => {
  const agent = request.agent(app);
  await login(agent, student.email, ORIGINAL);
  const token = await csrf(agent);
  const res = await agent.post('/api/admin/users/' + student.id + '/reset-password').set('X-CSRF-Token', token).send({});
  assert.equal(res.status, 403);
});
