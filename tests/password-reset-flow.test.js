const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskflow-password-reset-test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-password-reset-secret';
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '8.2.5';
process.env.SMTP_HOST = '';
process.env.SMTP_PASS = '';

const { MongoMemoryServer } = require('mongodb-memory-server');
const { crearApp } = require('../src/app');
const User = require('../src/models/User');
const PasswordResetToken = require('../src/models/PasswordResetToken');

let mongo, app, student;
const OLD_PASSWORD = 'ClaveAnteriorSegura123!';
async function csrf(agent) {
  const response = await agent.get('/api/auth/csrf-token');
  assert.equal(response.status, 200);
  return response.body.data.csrfToken;
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app = crearApp();
});
beforeEach(async () => {
  await User.deleteMany({});
  await PasswordResetToken.deleteMany({});
  student = await User.create({
    nombre: 'Estudiante de prueba',
    email: 'estudiante@taskflow.test',
    role: 'estudiante',
    passwordHash: await bcrypt.hash(OLD_PASSWORD, 4),
    debeCambiarPassword: true,
  });
});
after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('la solicitud de recuperación responde igual para correos no registrados y no revela cuentas', async () => {
  const agent = request.agent(app);
  const token = await csrf(agent);
  const response = await agent.post('/api/auth/forgot-password')
    .set('X-CSRF-Token', token)
    .send({ email: 'no-existe@taskflow.test' });
  assert.equal(response.status, 200);
  assert.match(response.body.data.mensaje, /Si existe una cuenta activa/);
  assert.equal(await PasswordResetToken.countDocuments({}), 0);
});

test('el enlace de un solo uso cambia la contraseña y quita el bloqueo de primer acceso', async () => {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await PasswordResetToken.create({
    user: student._id,
    tokenHash,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  const agent = request.agent(app);
  const csrfToken = await csrf(agent);
  const response = await agent.post('/api/auth/reset-password')
    .set('X-CSRF-Token', csrfToken)
    .send({ token: rawToken, newPassword: 'NuevaClaveSegura2026!' });
  assert.equal(response.status, 200);
  const updated = await User.findById(student._id);
  assert.equal(await bcrypt.compare('NuevaClaveSegura2026!', updated.passwordHash), true);
  assert.equal(updated.debeCambiarPassword, false);
  assert.equal(await bcrypt.compare(OLD_PASSWORD, updated.passwordHash), false);
  const replay = await agent.post('/api/auth/reset-password')
    .set('X-CSRF-Token', csrfToken)
    .send({ token: rawToken, newPassword: 'OtraClaveSegura2026!' });
  assert.equal(replay.status, 400);
  assert.equal(replay.body.error.code, 'RESET_TOKEN_INVALID');
});

test('rechaza tokens vencidos y contraseñas demasiado cortas', async () => {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  await PasswordResetToken.create({
    user: student._id,
    tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
    expiresAt: new Date(Date.now() - 1000),
  });
  const agent = request.agent(app);
  const csrfToken = await csrf(agent);
  const expired = await agent.post('/api/auth/reset-password')
    .set('X-CSRF-Token', csrfToken)
    .send({ token: rawToken, newPassword: 'NuevaClaveSegura2026!' });
  assert.equal(expired.status, 400);
  const short = await agent.post('/api/auth/reset-password')
    .set('X-CSRF-Token', csrfToken)
    .send({ token: 'a'.repeat(43), newPassword: 'corta' });
  assert.equal(short.status, 400);
  assert.equal(short.body.error.code, 'INVALID_PASSWORD');
});

test('la página de recuperación está disponible sin iniciar sesión', async () => {
  const response = await request(crearApp()).get('/restablecer-password.html');
  assert.equal(response.status, 200);
  assert.match(response.text, /form-restablecer/);
});
