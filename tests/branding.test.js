const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'secreto-solo-para-pruebas';
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '8.2.5';
const { MongoMemoryServer } = require('mongodb-memory-server');
const { crearApp } = require('../src/app');
const User = require('../src/models/User');
const Organization = require('../src/models/Organization');
const Membership = require('../src/models/OrganizationMembership');
const Branding = require('../src/models/Branding');

let mongo, server, admin, tutor;
async function csrf(agent) { return (await agent.get('/api/auth/csrf-token')).body.data.csrfToken; }
async function login(agent, email) {
  const token = await csrf(agent);
  const response = await agent.post('/api/auth/login').set('X-CSRF-Token', token).send({ email, password: 'Password123' });
  assert.equal(response.status, 200);
}
async function put(agent, url, body) {
  return agent.put(url).set('X-CSRF-Token', await csrf(agent)).send(body);
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Organization.init(), Membership.init(), Branding.init()]);
  server = crearApp().listen(0);
});
beforeEach(async () => {
  await Promise.all([Branding.deleteMany({}), Membership.deleteMany({}), Organization.deleteMany({}), User.deleteMany({})]);
  await mongoose.connection.db.collection('sessions').deleteMany({});
  const passwordHash = await bcrypt.hash('Password123', 4);
  admin = await User.create({ nombre: 'Admin', email: 'admin-brand@example.com', passwordHash, role: 'administrador' });
  tutor = await User.create({ nombre: 'Tutor', email: 'tutor-brand@example.com', passwordHash, role: 'tutor' });
});
after(async () => {
  await mongoose.disconnect();
  await new Promise(resolve => server.close(resolve));
  await mongo.stop();
});

test('solo el administrador general puede consultar y cambiar la marca global', async () => {
  const guest = request.agent(server);
  assert.equal((await guest.get('/api/admin/branding/platform')).status, 401);
  const tutorAgent = request.agent(server);
  await login(tutorAgent, tutor.email);
  assert.equal((await tutorAgent.get('/api/admin/branding/platform')).status, 403);
  const agent = request.agent(server);
  await login(agent, admin.email);
  const saved = await put(agent, '/api/admin/branding/platform', {
    displayName: 'TaskFlow Institucional', primaryColor: '#6d4bd1', logoUrl: 'https://example.com/logo.svg'
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.branding.displayName, 'TaskFlow Institucional');
  assert.equal((await agent.get('/api/admin/branding/platform')).body.data.branding.primaryColor, '#6d4bd1');
});

test('la identidad institucional se guarda separada y conserva el color principal de TaskFlow', async () => {
  const agent = request.agent(server);
  await login(agent, admin.email);
  const org = await Organization.create({ nombre: 'Universidad Demo', codigo: 'UNI-DEMO', creadoPor: admin._id });
  const saved = await put(agent, '/api/admin/branding/organizations/' + org._id, {
    displayName: 'Universidad Demo', secondaryColor: '#456789', accentColor: '#12ab34', primaryColor: '#ffffff'
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.branding.secondaryColor, '#456789');
  assert.equal(saved.body.data.branding.primaryColor, '#6d4bd1');
  assert.equal(await Branding.countDocuments({ scope: 'organization', organization: org._id }), 1);
});

test('rechaza colores inválidos y URLs con protocolos no seguros', async () => {
  const agent = request.agent(server);
  await login(agent, admin.email);
  assert.equal((await put(agent, '/api/admin/branding/platform', { primaryColor: 'red' })).status, 400);
  assert.equal((await put(agent, '/api/admin/branding/platform', { logoUrl: 'javascript:alert(1)' })).status, 400);
});

test('sube una imagen PNG local, guarda su referencia y la sirve como archivo estático', async () => {
  const agent = request.agent(server);
  await login(agent, admin.email);
  const png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
  const response = await agent.post('/api/admin/branding/platform/upload')
    .set('X-CSRF-Token', await csrf(agent))
    .field('field', 'logoUrl')
    .attach('image', png, { filename: 'logo.png', contentType: 'image/png' });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.asset.storage, 'local');
  assert.equal(response.body.data.branding.logoUrl, response.body.data.asset.url);
  assert.equal(response.body.data.branding.logoAsset.mimeType, 'image/png');
  assert.equal(response.body.data.branding.logoAsset.size, png.length);
  assert.equal((await agent.get(response.body.data.asset.url)).status, 200);
});

test('rechaza la carga de imágenes sin autenticación', async () => {
  const agent = request.agent(server);
  const png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
  const response = await agent.post('/api/admin/branding/platform/upload')
    .field('field', 'logoUrl')
    .attach('image', png, { filename: 'logo.png', contentType: 'image/png' });
  assert.equal(response.status, 401);
});
