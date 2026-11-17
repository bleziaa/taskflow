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
const Student = require('../src/models/Student');
const Company = require('../src/models/Company');
let mongo, server, admin, student, company;
async function csrf(agent) { return (await agent.get('/api/auth/csrf-token')).body.data.csrfToken; }
async function mutate(agent, method, url, body) { return agent[method](url).set('X-CSRF-Token', await csrf(agent)).send(body); }
async function login(agent) { const token = await csrf(agent); const result = await agent.post('/api/auth/login').set('X-CSRF-Token', token).send({ email: admin.email, password: 'Password123' }); assert.equal(result.status, 200); }
before(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); server = crearApp().listen(0); });
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Student.deleteMany({}), Company.deleteMany({})]);
  const passwordHash = await bcrypt.hash('Password123', 4);
  admin = await User.create({ nombre: 'Admin pruebas', email: 'admin-crud@test.local', passwordHash, role: 'administrador' });
  student = await Student.create({ codigo: 'ST-001', nombre: 'Estudiante Prueba', email: 'estudiante@test.local', programa: 'Ingeniería de Software', semestre: 3 });
  company = await Company.create({ razonSocial: 'Empresa Prueba', nit: 'NIT-001', ciudad: 'Cartagena' });
});
after(async () => { await mongoose.disconnect(); await new Promise(resolve => server.close(resolve)); await mongo.stop(); });

test('PATCH de estudiante valida los campos enviados y conserva los no enviados', async () => {
  const agent = request.agent(server); await login(agent);
  const invalid = await mutate(agent, 'patch', `/api/admin/students/${student._id}`, { nombre: ' ' });
  assert.equal(invalid.status, 400); assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
  assert.ok(invalid.body.error.details.some(item => item.campo === 'nombre'));
  const valid = await mutate(agent, 'patch', `/api/admin/students/${student._id}`, { semestre: 4 });
  assert.equal(valid.status, 200); assert.equal(valid.body.data.estudiante.semestre, 4);
  assert.equal(valid.body.data.estudiante.nombre, 'Estudiante Prueba');
});

test('PATCH de empresa rechaza correo de contacto inválido y acepta actualización parcial válida', async () => {
  const agent = request.agent(server); await login(agent);
  const invalid = await mutate(agent, 'patch', `/api/admin/companies/${company._id}`, { contactoEmail: 'correo-no-valido' });
  assert.equal(invalid.status, 400); assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
  const valid = await mutate(agent, 'patch', `/api/admin/companies/${company._id}`, { ciudad: 'Sincelejo' });
  assert.equal(valid.status, 200); assert.equal(valid.body.data.empresa.ciudad, 'Sincelejo');
  assert.equal(valid.body.data.empresa.razonSocial, 'Empresa Prueba');
});

test('PATCH de estudiante rechaza código con caracteres no permitidos y teléfono inválido', async () => {
  const agent = request.agent(server); await login(agent);
  const invalidCode = await mutate(agent, 'patch', `/api/admin/students/${student._id}`, { codigo: 'ST 001' });
  assert.equal(invalidCode.status, 400);
  assert.equal(invalidCode.body.error.code, 'VALIDATION_ERROR');
  const invalidPhone = await mutate(agent, 'patch', `/api/admin/students/${student._id}`, { telefono: '300ABC1234' });
  assert.equal(invalidPhone.status, 400);
  assert.equal(invalidPhone.body.error.code, 'VALIDATION_ERROR');
  const validPhone = await mutate(agent, 'patch', `/api/admin/students/${student._id}`, { telefono: '+57 300 123 4567' });
  assert.equal(validPhone.status, 200);
});

test('PATCH de empresa rechaza nombre demasiado corto y conserva actualización válida', async () => {
  const agent = request.agent(server); await login(agent);
  const invalid = await mutate(agent, 'patch', `/api/admin/companies/${company._id}`, { razonSocial: 'A' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
  const valid = await mutate(agent, 'patch', `/api/admin/companies/${company._id}`, { razonSocial: 'Empresa Actualizada' });
  assert.equal(valid.status, 200);
  assert.equal(valid.body.data.empresa.razonSocial, 'Empresa Actualizada');
});


test('POST de estudiante rechaza códigos con espacios y teléfonos con menos de 7 dígitos', async () => {
  const agent = request.agent(server); await login(agent);
  const base = { codigo: 'ST-002', nombre: 'Nuevo Estudiante', email: 'nuevo@test.local', programa: 'Ingeniería de Software', semestre: 2 };
  const badCode = await mutate(agent, 'post', '/api/admin/students', { ...base, codigo: 'ST 002' });
  assert.equal(badCode.status, 400);
  assert.ok(badCode.body.error.details.some(item => item.campo === 'codigo'));
  const badPhone = await mutate(agent, 'post', '/api/admin/students', { ...base, telefono: '12345' });
  assert.equal(badPhone.status, 400);
  assert.ok(badPhone.body.error.details.some(item => item.campo === 'telefono'));
});

test('POST de estudiante acepta código permitido y teléfono internacional válido', async () => {
  const agent = request.agent(server); await login(agent);
  const result = await mutate(agent, 'post', '/api/admin/students', {
    codigo: '2026-IS_003', nombre: 'Nuevo Estudiante', email: 'nuevo2@test.local',
    telefono: '+57 300 123 4567', programa: 'Ingeniería de Software', semestre: 2,
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.estudiante.codigo, '2026-IS_003');
});

test('PATCH de estudiante aplica las mismas reglas de código y teléfono', async () => {
  const agent = request.agent(server); await login(agent);
  const invalidCode = await mutate(agent, 'patch', '/api/admin/students/' + student._id, { codigo: 'ST/001' });
  assert.equal(invalidCode.status, 400);
  const invalidPhone = await mutate(agent, 'patch', '/api/admin/students/' + student._id, { telefono: 'abc1234567' });
  assert.equal(invalidPhone.status, 400);
  const valid = await mutate(agent, 'patch', '/api/admin/students/' + student._id, { telefono: '+57 300 555 1212' });
  assert.equal(valid.status, 200);
});
