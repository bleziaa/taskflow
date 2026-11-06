const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskflow-test-env';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'secreto-solo-para-pruebas';
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '8.2.5';

const { MongoMemoryServer } = require('mongodb-memory-server');
const { crearApp } = require('../src/app');
const User = require('../src/models/User');

const PASSWORD = 'Password123';
const EMAIL = 'usuario@example.com';
const NOMBRE = 'Usuario de prueba';

let mongo;
let app;

function agente() {
  return request.agent(app);
}

async function obtenerToken(agent) {
  const res = await agent.get('/api/auth/csrf-token');

  assert.equal(res.status, 200);
  const token = res.body && res.body.data && res.body.data.csrfToken;
  assert.equal(typeof token, 'string');
  assert.ok(token.length > 0);

  return token;
}

async function crearUsuario({ email = EMAIL, password = PASSWORD } = {}) {
  const passwordHash = await bcrypt.hash(password, 4);

  return User.create({
    nombre: NOMBRE,
    email,
    passwordHash,
  });
}

async function iniciarSesion(agent, { email = EMAIL, password = PASSWORD } = {}) {
  const token = await obtenerToken(agent);
  const res = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', token)
    .send({ email, password });

  return { res, token };
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.init();
  app = crearApp();
});

beforeEach(async () => {
  await User.deleteMany({});
  await mongoose.connection.db.collection('sessions').deleteMany({});
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('el registro público está deshabilitado; las cuentas las crea el administrador', async () => {
  const agent = agente();
  const res = await agent.post('/api/auth/register').send({ nombre: NOMBRE, email: EMAIL, password: PASSWORD });
  assert.equal(res.status, 404);
  assert.equal(await User.countDocuments({ email: EMAIL }), 0);
});

test('inicio de sesión exitoso devuelve el usuario y permite consultar /me', async () => {
  await crearUsuario();
  const agent = agente();

  const { res } = await iniciarSesion(agent);

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.usuario.email, EMAIL);
  assert.equal(res.body.data.usuario.passwordHash, undefined);

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.data.usuario.email, EMAIL);
});

test('inicio de sesión con contraseña incorrecta devuelve 401', async () => {
  await crearUsuario();
  const agent = agente();

  const { res } = await iniciarSesion(agent, { password: 'OtraPassword123' });

  assert.equal(res.status, 401);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
});

test('consulta del usuario autenticado devuelve sus datos sin el hash', async () => {
  await crearUsuario();
  const agent = agente();
  await iniciarSesion(agent);

  const res = await agent.get('/api/auth/me');

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.data.usuario.nombre, NOMBRE);
  assert.equal(res.body.data.usuario.email, EMAIL);
  assert.equal(res.body.data.usuario.passwordHash, undefined);
});

test('consulta de usuario sin sesión devuelve 401', async () => {
  const agent = agente();

  const res = await agent.get('/api/auth/me');

  assert.equal(res.status, 401);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
});

test('cierre de sesión devuelve 200 y elimina el acceso', async () => {
  await crearUsuario();
  const agent = agente();
  const { token } = await iniciarSesion(agent);

  const logout = await agent
    .post('/api/auth/logout')
    .set('X-CSRF-Token', token)
    .send({});

  assert.equal(logout.status, 200);
  assert.equal(logout.body.ok, true);

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 401);
  assert.equal(me.body.error.code, 'UNAUTHORIZED');
});

test('la sesión se destruye en MongoDB después del logout', async () => {
  await crearUsuario();
  const agent = agente();
  const { token } = await iniciarSesion(agent);

  const antes = await mongoose.connection.db
    .collection('sessions')
    .countDocuments();
  assert.ok(antes > 0);

  const logout = await agent
    .post('/api/auth/logout')
    .set('X-CSRF-Token', token)
    .send({});
  assert.equal(logout.status, 200);

  const despues = await mongoose.connection.db
    .collection('sessions')
    .countDocuments();
  assert.equal(despues, 0);
});

test('el dashboard redirige al login sin sesión y responde con sesión', async () => {
  const sinSesion = agente();
  const redireccion = await sinSesion.get('/dashboard.html');

  assert.equal(redireccion.status, 302);
  assert.equal(redireccion.headers.location, '/login.html');

  await crearUsuario();
  const conSesion = agente();
  await iniciarSesion(conSesion);

  const dashboard = await conSesion.get('/dashboard.html');
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.text, /TaskFlow/);
});

test('un token CSRF incorrecto es rechazado', async () => {
  await crearUsuario();
  const agent = agente();
  await obtenerToken(agent);

  const res = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', 'token-incorrecto')
    .send({ email: EMAIL, password: PASSWORD });

  assert.equal(res.status, 403);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'CSRF_INVALID');
});


test('una cuenta con contraseña temporal solo puede consultar sesión y cambiar la clave', async () => {
  const user = await crearUsuario({ email: 'temporal@example.com' });
  user.debeCambiarPassword = true;
  await user.save();
  const agent = agente();
  const { res } = await iniciarSesion(agent, { email: user.email });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.usuario.debeCambiarPassword, true);
  const blocked = await agent.get('/api/organization/students');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error.code, 'PASSWORD_CHANGE_REQUIRED');
  const token = await obtenerToken(agent);
  const changed = await agent.post('/api/auth/change-password').set('X-CSRF-Token', token).send({ newPassword: 'ClaveNuevaSegura123!' });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.data.usuario.debeCambiarPassword, false);
  const me = await agent.get('/api/auth/me');
  assert.equal(me.body.data.usuario.debeCambiarPassword, false);
});
