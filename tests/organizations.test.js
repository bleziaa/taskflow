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

let mongo;
let app;
let server;
let admin;
let member;

async function csrf(agent) {
  const result = await agent.get('/api/auth/csrf-token');
  return result.body.data.csrfToken;
}
async function login(agent, email) { const token = await csrf(agent); const result = await agent.post('/api/auth/login').set('X-CSRF-Token', token).send({ email, password: 'Password123' }); assert.equal(result.status, 200); }
async function mutate(agent, method, url, body = {}) {
  return agent[method](url).set('X-CSRF-Token', await csrf(agent)).send(body);
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Organization.init(), Membership.init()]);
  app = crearApp();
  server = app.listen(0);
});

beforeEach(async () => {
  await Promise.all([Membership.deleteMany({}), Organization.deleteMany({}), User.deleteMany({})]);
  await mongoose.connection.db.collection('sessions').deleteMany({});
  const passwordHash = await bcrypt.hash('Password123', 4);
  admin = await User.create({ nombre: 'Admin general', email: 'admin-org@example.com', passwordHash, role: 'administrador' });
  member = await User.create({ nombre: 'Docente', email: 'docente-org@example.com', passwordHash, role: 'tutor' });
});

after(async () => {
  await mongoose.disconnect();
  await new Promise((resolve) => server.close(resolve));
  await mongo.stop();
});

test('solo el administrador general puede consultar organizaciones', async () => {
  assert.equal((await request(server).get('/api/admin/organizations')).status, 401);
  const agent = request.agent(server);
  await login(agent, member.email);
  assert.equal((await agent.get('/api/admin/organizations')).status, 403);
});

test('el administrador crea organizaciones y obtiene métricas reales', async () => {
  const agent = request.agent(server);
  await login(agent, admin.email);
  const created = await mutate(agent, 'post', '/api/admin/organizations', {
    nombre: 'Universidad de Prueba', codigo: 'uni-prueba', ciudad: 'Cartagena'
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.organizacion.codigo, 'UNI-PRUEBA');
  const id = created.body.data.organizacion._id;

  const assignment = await mutate(agent, 'post', '/api/admin/organizations/' + id + '/members', {
    usuarioId: String(member._id), role: 'administrador'
  });
  assert.equal(assignment.status, 201);
  assert.equal(assignment.body.data.membresia.role, 'administrador');

  const detail = await agent.get('/api/admin/organizations/' + id);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.resumen.usuariosVinculados, 1);
  assert.equal(detail.body.data.resumen.administradoresAsignados, 1);
  assert.equal(detail.body.data.miembros.length, 1);

  const list = await agent.get('/api/admin/organizations');
  assert.equal(list.status, 200);
  assert.equal(list.body.data.organizaciones[0].usuariosVinculados, 1);
});

test('el selector de miembros ofrece docentes y estudiantes, no administradores generales', async () => {
  const agent = request.agent(server);
  await login(agent, admin.email);
  const response = await agent.get('/api/admin/organizations/available-users');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.usuarios.map((u) => u.role), ['tutor']);
  assert.equal(response.body.data.usuarios[0].email, member.email);
});

test('el selector de miembros excluye las cuentas ya vinculadas a la organización elegida', async () => {
  const agent = request.agent(server);
  await login(agent, admin.email);
  const first = await mutate(agent, 'post', '/api/admin/organizations', { nombre: 'Institución Asignada', codigo: 'inst-asignada' });
  const second = await mutate(agent, 'post', '/api/admin/organizations', { nombre: 'Institución Libre', codigo: 'inst-libre' });
  const firstId = first.body.data.organizacion._id;
  const secondId = second.body.data.organizacion._id;
  assert.equal((await mutate(agent, 'post', '/api/admin/organizations/' + firstId + '/members', { usuarioId: String(member._id), role: 'tutor' })).status, 201);

  const assigned = await agent.get('/api/admin/organizations/available-users?organizationId=' + firstId);
  const free = await agent.get('/api/admin/organizations/available-users?organizationId=' + secondId);
  assert.equal(assigned.status, 200);
  assert.deepEqual(assigned.body.data.usuarios, []);
  assert.equal(free.status, 200);
  assert.deepEqual(free.body.data.usuarios.map((u) => u.email), [member.email]);
});

test('una cuenta puede pertenecer a varias organizaciones y no duplicarse dentro de la misma', async () => {
  const agent = request.agent(server);
  await login(agent, admin.email);
  const first = await mutate(agent, 'post', '/api/admin/organizations', { nombre: 'Institución Uno', codigo: 'inst-uno' });
  const second = await mutate(agent, 'post', '/api/admin/organizations', { nombre: 'Institución Dos', codigo: 'inst-dos' });
  const id1 = first.body.data.organizacion._id;
  const id2 = second.body.data.organizacion._id;

  assert.equal((await mutate(agent, 'post', '/api/admin/organizations/' + id1 + '/members', { usuarioId: String(member._id), role: 'tutor' })).status, 201);
  assert.equal((await mutate(agent, 'post', '/api/admin/organizations/' + id2 + '/members', { usuarioId: String(member._id), role: 'administrador' })).status, 201);
  const duplicate = await mutate(agent, 'post', '/api/admin/organizations/' + id1 + '/members', { usuarioId: String(member._id), role: 'tutor' });
  assert.equal(duplicate.status, 409);
  assert.equal(await Membership.countDocuments({ usuario: member._id }), 2);
});

test('se puede desactivar una asignación sin borrar la cuenta global', async () => {
  const agent = request.agent(server);
  await login(agent, admin.email);
  const org = await mutate(agent, 'post', '/api/admin/organizations', { nombre: 'Institución Tres', codigo: 'inst-tres' });
  const id = org.body.data.organizacion._id;
  const created = await mutate(agent, 'post', '/api/admin/organizations/' + id + '/members', { usuarioId: String(member._id), role: 'tutor' });
  const membershipId = created.body.data.membresia._id;
  const updated = await mutate(agent, 'patch', '/api/admin/organizations/' + id + '/members/' + membershipId, { estado: 'inactivo' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.membresia.estado, 'inactivo');
  assert.equal((await User.findById(member._id)).activo, true);
});


test('una membresía de administrador institucional no concede acceso a la administración global', async () => {
  const organization = await Organization.create({
    nombre: 'Institución de Control',
    codigo: 'INST-CONTROL',
    creadoPor: admin._id,
  });
  await Membership.create({
    organizacion: organization._id,
    usuario: member._id,
    role: 'administrador',
    asignadoPor: admin._id,
  });

  const institutionalAgent = request.agent(server);
  await login(institutionalAgent, member.email);
  const selected = await mutate(institutionalAgent, 'put', '/api/auth/organizations/active', {
    organizationId: String(organization._id),
  });
  assert.equal(selected.status, 200);

  const globalAdminEndpoints = [
    '/api/admin/dashboard',
    '/api/admin/students',
    '/api/admin/companies',
    '/api/admin/users',
    '/api/admin/organizations',
    '/api/admin/branding/platform',
  ];
  for (const endpoint of globalAdminEndpoints) {
    const response = await institutionalAgent.get(endpoint);
    assert.equal(response.status, 403, `La ruta ${endpoint} no debe aceptar un rol institucional.`);
  }

  const globalAgent = request.agent(server);
  await login(globalAgent, admin.email);
  for (const endpoint of globalAdminEndpoints) {
    const response = await globalAgent.get(endpoint);
    assert.equal(response.status, 200, `El administrador general debe conservar acceso a ${endpoint}.`);
  }
});

test('la administración global no elimina cuentas que aún tienen membresías institucionales', async () => {
  const organization = await Organization.create({
    nombre: 'Institución con Miembro',
    codigo: 'INST-MIEMBRO',
    creadoPor: admin._id,
  });
  const membership = await Membership.create({
    organizacion: organization._id,
    usuario: member._id,
    role: 'tutor',
    asignadoPor: admin._id,
  });

  const agent = request.agent(server);
  await login(agent, admin.email);
  const response = await mutate(agent, 'delete', '/api/admin/users/' + member._id);
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'USER_HAS_MEMBERSHIPS');
  assert.ok(await User.findById(member._id));
  assert.ok(await Membership.findById(membership._id));
});


test('impide degradar, desactivar o retirar al último administrador institucional', async () => {
  const organization = await Organization.create({ nombre: 'Institución Segura', codigo: 'INST-SEGURA', creadoPor: admin._id });
  const membership = await Membership.create({
    organizacion: organization._id, usuario: member._id, role: 'administrador',
    estado: 'activo', asignadoPor: admin._id,
  });
  const agent = request.agent(server);
  await login(agent, admin.email);

  const demote = await mutate(agent, 'patch', '/api/admin/organizations/' + organization._id + '/members/' + membership._id, { role: 'tutor' });
  assert.equal(demote.status, 409);
  assert.equal(demote.body.error.code, 'LAST_ORGANIZATION_ADMIN');

  const deactivate = await mutate(agent, 'patch', '/api/admin/organizations/' + organization._id + '/members/' + membership._id, { estado: 'inactivo' });
  assert.equal(deactivate.status, 409);
  assert.equal(deactivate.body.error.code, 'LAST_ORGANIZATION_ADMIN');

  const remove = await mutate(agent, 'delete', '/api/admin/organizations/' + organization._id + '/members/' + membership._id);
  assert.equal(remove.status, 409);
  assert.equal(remove.body.error.code, 'LAST_ORGANIZATION_ADMIN');

  const unchanged = await Membership.findById(membership._id);
  assert.equal(unchanged.role, 'administrador');
  assert.equal(unchanged.estado, 'activo');
});

test('permite cambiar el rol de un administrador cuando queda otro administrador activo', async () => {
  const organization = await Organization.create({ nombre: 'Institución Doble', codigo: 'INST-DOBLE', creadoPor: admin._id });
  const first = await Membership.create({ organizacion: organization._id, usuario: member._id, role: 'administrador', asignadoPor: admin._id });
  const secondUser = await User.create({ nombre: 'Segundo admin', email: 'segundo-admin@example.com', passwordHash: await bcrypt.hash('Password123', 4), role: 'tutor' });
  await Membership.create({ organizacion: organization._id, usuario: secondUser._id, role: 'administrador', asignadoPor: admin._id });

  const agent = request.agent(server);
  await login(agent, admin.email);
  const response = await mutate(agent, 'patch', '/api/admin/organizations/' + organization._id + '/members/' + first._id, { role: 'tutor' });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.membresia.role, 'tutor');
  assert.equal(await Membership.countDocuments({ organizacion: organization._id, role: 'administrador', estado: 'activo' }), 1);
});

test('un usuario desactivado pierde acceso institucional aunque conserve la sesión y membresía', async () => {
  const organization = await Organization.create({ nombre: 'Institución Usuario', codigo: 'INST-USUARIO', creadoPor: admin._id });
  await Membership.create({ organizacion: organization._id, usuario: member._id, role: 'administrador', asignadoPor: admin._id });
  const agent = request.agent(server);
  await login(agent, member.email);
  const selected = await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(organization._id) });
  assert.equal(selected.status, 200);

  await User.updateOne({ _id: member._id }, { $set: { activo: false } });
  const response = await agent.get('/api/organization/students');
  assert.equal(response.status, 401);
});

test('una organización inactiva bloquea operaciones académicas de sesiones previamente seleccionadas', async () => {
  const organization = await Organization.create({ nombre: 'Institución Inactiva', codigo: 'INST-INACTIVA', creadoPor: admin._id });
  await Membership.create({ organizacion: organization._id, usuario: member._id, role: 'administrador', asignadoPor: admin._id });
  const memberAgent = request.agent(server);
  await login(memberAgent, member.email);
  const selected = await mutate(memberAgent, 'put', '/api/auth/organizations/active', { organizationId: String(organization._id) });
  assert.equal(selected.status, 200);

  const adminAgent = request.agent(server);
  await login(adminAgent, admin.email);
  const deactivated = await mutate(adminAgent, 'patch', '/api/admin/organizations/' + organization._id, { estado: 'inactiva' });
  assert.equal(deactivated.status, 200);

  const response = await memberAgent.get('/api/organization/students');
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'ORGANIZATION_INACTIVE');
});


test('serializa dos degradaciones simultáneas y conserva al menos un administrador activo', async () => {
  const organization = await Organization.create({ nombre: 'Institución Concurrente', codigo: 'INST-CONCURRENTE', creadoPor: admin._id });
  const secondUser = await User.create({
    nombre: 'Segundo administrador', email: 'admin-concurrente@example.com',
    passwordHash: await bcrypt.hash('Password123', 4), role: 'tutor',
  });
  const first = await Membership.create({
    organizacion: organization._id, usuario: member._id, role: 'administrador', asignadoPor: admin._id,
  });
  const second = await Membership.create({
    organizacion: organization._id, usuario: secondUser._id, role: 'administrador', asignadoPor: admin._id,
  });

  const agentOne = request.agent(server);
  const agentTwo = request.agent(server);
  await Promise.all([login(agentOne, admin.email), login(agentTwo, admin.email)]);

  const responses = await Promise.all([
    mutate(agentOne, 'patch', '/api/admin/organizations/' + organization._id + '/members/' + first._id, { role: 'tutor' }),
    mutate(agentTwo, 'patch', '/api/admin/organizations/' + organization._id + '/members/' + second._id, { role: 'tutor' }),
  ]);

  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const remaining = await Membership.countDocuments({
    organizacion: organization._id, role: 'administrador', estado: 'activo',
  });
  assert.equal(remaining, 1);
  const guard = await Organization.findById(organization._id).select('+adminGuardLockOwner').lean();
  assert.equal(guard.adminGuardLockOwner, undefined);
});


test('un bloqueo administrativo existente impide cambios concurrentes y no altera membresías', async () => {
  const organization = await Organization.create({ nombre: 'Institución Bloqueada', codigo: 'INST-BLOQUEADA', creadoPor: admin._id });
  const membership = await Membership.create({
    organizacion: organization._id, usuario: member._id, role: 'administrador', asignadoPor: admin._id,
  });
  await Organization.updateOne({ _id: organization._id }, {
    $set: { adminGuardLockOwner: 'proceso-en-revision', adminGuardLockAt: new Date() },
  });
  const agent = request.agent(server);
  await login(agent, admin.email);
  const response = await mutate(agent, 'patch', '/api/admin/organizations/' + organization._id + '/members/' + membership._id, { role: 'tutor' });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'ADMIN_GUARD_BUSY');
  assert.equal((await Membership.findById(membership._id)).role, 'administrador');
});

test('requireAuth invalida la sesion completa al desactivar una cuenta en rutas globales y de seleccion', async () => {
  const organization = await Organization.create({ nombre: 'Institucion Sesion', codigo: 'INST-SESION', creadoPor: admin._id });
  await Membership.create({ organizacion: organization._id, usuario: member._id, role: 'tutor', asignadoPor: admin._id });
  const agent = request.agent(server);
  await login(agent, member.email);
  assert.equal((await agent.get('/api/auth/organizations')).status, 200);
  await User.updateOne({ _id: member._id }, { $set: { activo: false } });
  const selection = await agent.get('/api/auth/organizations');
  assert.equal(selection.status, 401);
  assert.equal(selection.body.error.code, 'ACCOUNT_DISABLED');
  const globalAdmin = await agent.get('/api/admin/dashboard');
  assert.equal(globalAdmin.status, 401);
  assert.equal(globalAdmin.body.error.code, 'UNAUTHORIZED');
  assert.equal((await agent.get('/api/auth/me')).status, 401);
});

test('reactivar una cuenta no reactiva membresias inactivas y exige iniciar sesion otra vez', async () => {
  const activeOrg = await Organization.create({ nombre: 'Institucion Reactivada', codigo: 'INST-REACTIVA', creadoPor: admin._id });
  const inactiveOrg = await Organization.create({ nombre: 'Institucion Pausada', codigo: 'INST-PAUSADA', creadoPor: admin._id });
  await Membership.create({ organizacion: activeOrg._id, usuario: member._id, role: 'tutor', estado: 'activo', asignadoPor: admin._id });
  await Membership.create({ organizacion: inactiveOrg._id, usuario: member._id, role: 'tutor', estado: 'inactivo', asignadoPor: admin._id });
  const agent = request.agent(server);
  await login(agent, member.email);
  await User.updateOne({ _id: member._id }, { $set: { activo: false } });
  assert.equal((await agent.get('/api/auth/organizations')).status, 401);
  await User.updateOne({ _id: member._id }, { $set: { activo: true } });
  assert.equal((await agent.get('/api/auth/me')).status, 401);
  await login(agent, member.email);
  const organizations = await agent.get('/api/auth/organizations');
  assert.equal(organizations.status, 200);
  assert.deepEqual(organizations.body.data.organizaciones.map((item) => item.id), [String(activeOrg._id)]);
  const inactiveSelection = await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(inactiveOrg._id) });
  assert.equal(inactiveSelection.status, 403);
  const activeSelection = await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(activeOrg._id) });
  assert.equal(activeSelection.status, 200);
});


test('reactivar una organizacion restaura solo las membresias que siguen activas', async () => {
  const organization = await Organization.create({ nombre: 'Institucion Reversible', codigo: 'INST-REVERSIBLE', creadoPor: admin._id });
  const activeMembership = await Membership.create({ organizacion: organization._id, usuario: member._id, role: 'tutor', estado: 'activo', asignadoPor: admin._id });
  const inactiveUser = await User.create({ nombre: 'Otra cuenta', email: 'otra-cuenta@example.com', passwordHash: await bcrypt.hash('Password123', 4), role: 'tutor' });
  await Membership.create({ organizacion: organization._id, usuario: inactiveUser._id, role: 'tutor', estado: 'inactivo', asignadoPor: admin._id });
  const agent = request.agent(server);
  await login(agent, member.email);
  const adminAgent = request.agent(server);
  await login(adminAgent, admin.email);
  assert.equal((await mutate(adminAgent, 'patch', '/api/admin/organizations/' + organization._id, { estado: 'inactiva' })).status, 200);
  assert.equal((await agent.get('/api/auth/organizations')).body.data.organizaciones.length, 0);
  assert.equal((await mutate(adminAgent, 'patch', '/api/admin/organizations/' + organization._id, { estado: 'activa' })).status, 200);
  const available = await agent.get('/api/auth/organizations');
  assert.equal(available.status, 200);
  assert.deepEqual(available.body.data.organizaciones.map((item) => item.id), [String(organization._id)]);
  assert.equal(await Membership.countDocuments({ organizacion: organization._id, estado: 'activo' }), 1);
  assert.ok(await Membership.findById(activeMembership._id));
});


test('crea cuenta institucional con contraseña temporal y exige cambiarla al iniciar sesión', async () => {
  const adminAgent = request.agent(server);
  await login(adminAgent, admin.email);
  const org = await mutate(adminAgent, 'post', '/api/admin/organizations', { nombre: 'Universidad Temporal', codigo: 'UNI-TEMPORAL' });
  const created = await mutate(adminAgent, 'post', '/api/admin/users', { nombre: 'Estudiante Nuevo', email: 'nuevo-temporal@example.com', role: 'estudiante', organizationId: org.body.data.organizacion._id, membershipRole: 'estudiante' });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.correo.status, 'not_configured');
  assert.ok(created.body.data.credenciales, 'sin SMTP configurado, la contraseña debe quedar disponible para entrega manual segura');
  const temporary = created.body.data.credenciales.passwordTemporal;
  assert.ok(typeof temporary === 'string' && temporary.length >= 24);
  const user = await User.findOne({ email: 'nuevo-temporal@example.com' });
  assert.equal(user.debeCambiarPassword, true);
  assert.equal(await Membership.countDocuments({ usuario: user._id, organizacion: org.body.data.organizacion._id }), 1);

});
