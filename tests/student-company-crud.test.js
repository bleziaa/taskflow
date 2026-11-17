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
const Student = require('../src/models/Student');
const Company = require('../src/models/Company');
const Practice = require('../src/models/Practice');

let mongo; let server; let admin; let organization;
async function csrf(agent) { return (await agent.get('/api/auth/csrf-token')).body.data.csrfToken; }
async function mutate(agent, method, url, body = {}) {
  return agent[method](url).set('X-CSRF-Token', await csrf(agent)).send(body);
}
async function login(agent) {
  const token = await csrf(agent);
  const response = await agent.post('/api/auth/login').set('X-CSRF-Token', token)
    .send({ email: admin.email, password: 'Password123' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const selected = await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(organization._id) });
  assert.equal(selected.status, 200);
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Organization.init(), Membership.init(), Student.init(), Company.init()]);
  server = crearApp().listen(0);
});
beforeEach(async () => {
  await Promise.all([Practice.deleteMany({}), Student.deleteMany({}), Company.deleteMany({}), Membership.deleteMany({}), Organization.deleteMany({}), User.deleteMany({})]);
  await mongoose.connection.db.collection('sessions').deleteMany({});
  const passwordHash = await bcrypt.hash('Password123', 4);
  admin = await User.create({ nombre: 'Admin de prueba', email: 'admin-crud@test.local', passwordHash, role: 'administrador' });
  organization = await Organization.create({ nombre: 'Institución de prueba', codigo: 'INST-CRUD', creadoPor: admin._id });
  await Membership.create({ usuario: admin._id, organizacion: organization._id, role: 'administrador', asignadoPor: admin._id });
});
after(async () => {
  await mongoose.disconnect();
  await new Promise(resolve => server.close(resolve));
  await mongo.stop();
});

test('CRUD completo de estudiantes: crear, listar, consultar, actualizar y eliminar', async () => {
  const agent = request.agent(server); await login(agent);
  const payload = { codigo: 'TCC-EST-001', nombre: 'Estudiante de Prueba', email: 'estudiante-crud@test.local', telefono: '+57 300 555 1212', programa: 'Ingeniería de Software', semestre: 3 };
  const created = await mutate(agent, 'post', '/api/organization/students', payload);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.estudiante._id;
  assert.equal((await Student.findById(id)).nombre, payload.nombre);
  const listed = await agent.get('/api/organization/students');
  assert.equal(listed.status, 200); assert.ok(listed.body.data.estudiantes.some(item => item._id === id));
  const fetched = await agent.get('/api/organization/students/' + id);
  assert.equal(fetched.status, 200); assert.equal(fetched.body.data.estudiante.codigo, payload.codigo);
  const updated = await mutate(agent, 'patch', '/api/organization/students/' + id, { nombre: 'Estudiante Actualizado', semestre: 4 });
  assert.equal(updated.status, 200); assert.equal((await Student.findById(id)).nombre, 'Estudiante Actualizado');
  assert.equal((await Student.findById(id)).semestre, 4);
  const company = await Company.create({ organizationId: organization._id, razonSocial: 'Empresa asociada de prueba', nit: 'TCC-NIT-STU-01', ciudad: 'Sincelejo' });
  await Practice.create({ organizationId: organization._id, estudiante: id, empresa: company._id, tutor: admin._id, titulo: 'Práctica vinculada', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-12-01') });
  const blocked = await mutate(agent, 'delete', '/api/organization/students/' + id);
  assert.equal(blocked.status, 409); assert.equal(blocked.body.error.code, 'STUDENT_HAS_PRACTICES');
  assert.ok(await Student.findById(id));
  await Practice.deleteMany({ estudiante: id });
  const removed = await mutate(agent, 'delete', '/api/organization/students/' + id);
  assert.equal(removed.status, 200); assert.equal(await Student.findById(id), null);
  assert.equal((await agent.get('/api/organization/students/' + id)).status, 404);
});

test('CRUD completo de empresas y protección de eliminación cuando tiene estudiantes vinculados', async () => {
  const agent = request.agent(server); await login(agent);
  const payload = { razonSocial: 'Empresa de Prueba S.A.S.', nit: 'TCC-NIT-001', sector: 'Tecnología', direccion: 'Calle 1', ciudad: 'Sincelejo', contactoNombre: 'Contacto de Prueba', contactoEmail: 'contacto@test.local', telefono: '3005551212' };
  const created = await mutate(agent, 'post', '/api/organization/companies', payload);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.empresa._id;
  assert.equal((await Company.findById(id)).razonSocial, payload.razonSocial);
  const listed = await agent.get('/api/organization/companies');
  assert.equal(listed.status, 200); assert.ok(listed.body.data.empresas.some(item => item._id === id));
  const fetched = await agent.get('/api/organization/companies/' + id);
  assert.equal(fetched.status, 200); assert.equal(fetched.body.data.empresa.nit, payload.nit);
  const updated = await mutate(agent, 'patch', '/api/organization/companies/' + id, { ciudad: 'Cartagena', sector: 'Servicios' });
  assert.equal(updated.status, 200); assert.equal((await Company.findById(id)).ciudad, 'Cartagena');
  const student = await Student.create({ organizationId: organization._id, codigo: 'TCC-EST-002', nombre: 'Vinculado', email: 'vinculado@test.local', programa: 'Software', semestre: 3, empresa: id });
  const blocked = await mutate(agent, 'delete', '/api/organization/companies/' + id);
  assert.equal(blocked.status, 409); assert.equal(blocked.body.error.code, 'COMPANY_HAS_STUDENTS');
  assert.ok(await Company.findById(id)); assert.ok(await Student.findById(student._id));
  await Student.deleteOne({ _id: student._id });
  const removed = await mutate(agent, 'delete', '/api/organization/companies/' + id);
  assert.equal(removed.status, 200); assert.equal(await Company.findById(id), null);
});

test('el CRUD rechaza duplicados, identificadores inválidos y solicitudes sin CSRF', async () => {
  const agent = request.agent(server); await login(agent);
  const base = { codigo: 'TCC-DUP-001', nombre: 'Estudiante Único', email: 'unico@test.local', programa: 'Software', semestre: 3 };
  assert.equal((await mutate(agent, 'post', '/api/organization/students', base)).status, 201);
  const duplicate = await mutate(agent, 'post', '/api/organization/students', { ...base, email: 'otro@test.local' });
  assert.equal(duplicate.status, 409); assert.equal(duplicate.body.error.code, 'DUPLICATE_KEY');
  const invalidId = await agent.get('/api/organization/students/no-es-id');
  assert.equal(invalidId.status, 400); assert.equal(invalidId.body.error.code, 'VALIDATION_ERROR');
  const noCsrf = await agent.post('/api/organization/companies').send({ razonSocial: 'Sin CSRF', nit: 'NIT-X', ciudad: 'Cartagena' });
  assert.equal(noCsrf.status, 403);
});
