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
const Activity = require('../src/models/Activity');
const Evidence = require('../src/models/Evidence');
const Evaluation = require('../src/models/Evaluation');
const fs = require('node:fs/promises');
const path = require('node:path');
const { STORAGE_DIR } = require('../src/middleware/evidenceUpload');

let mongo;
let app;
let server;
let user;
let org;
let otherOrg;

async function csrf(agent) {
  return (await agent.get('/api/auth/csrf-token')).body.data.csrfToken;
}
async function login(agent) {
  const token = await csrf(agent);
  const response = await agent.post('/api/auth/login').set('X-CSRF-Token', token)
    .send({ email: user.email, password: 'Password123' });
  assert.equal(response.status, 200);
}
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
  user = await User.create({ nombre: 'Usuario Multiempresa', email: 'multi@example.com', passwordHash, role: 'tutor' });
  const admin = await User.create({ nombre: 'Admin', email: 'admin@example.com', passwordHash, role: 'administrador' });
  org = await Organization.create({ nombre: 'Institución Uno', codigo: 'INST-UNO', creadoPor: admin._id });
  otherOrg = await Organization.create({ nombre: 'Institución Dos', codigo: 'INST-DOS', creadoPor: admin._id });
});
after(async () => {
  await mongoose.disconnect();
  await new Promise((resolve) => server.close(resolve));
  await mongo.stop();
});

test('el usuario solo recibe las organizaciones con membresía activa', async () => {
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'tutor', asignadoPor: user._id });
  await Membership.create({ usuario: user._id, organizacion: otherOrg._id, role: 'estudiante', estado: 'inactivo', asignadoPor: user._id });
  const agent = request.agent(server);
  await login(agent);
  const response = await agent.get('/api/auth/organizations');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.organizaciones.length, 1);
  assert.equal(response.body.data.organizaciones[0].id, String(org._id));
  assert.equal(response.body.data.organizacionActiva, null);
});

test('permite seleccionar una organización solo si existe membresía activa', async () => {
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'tutor', asignadoPor: user._id });
  const agent = request.agent(server);
  await login(agent);
  const denied = await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(otherOrg._id) });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'ORGANIZATION_ACCESS_DENIED');
  const selected = await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) });
  assert.equal(selected.status, 200);
  assert.equal(selected.body.data.organizacionActiva.id, String(org._id));
  const listing = await agent.get('/api/auth/organizations');
  assert.equal(listing.body.data.organizacionActiva.id, String(org._id));
});

test('rechaza selección sin sesión y limpia el contexto activo', async () => {
  const anonymous = request.agent(server);
  assert.equal((await mutate(anonymous, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 401);
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'tutor', asignadoPor: user._id });
  const agent = request.agent(server);
  await login(agent);
  assert.equal((await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);
  assert.equal((await mutate(agent, 'delete', '/api/auth/organizations/active')).status, 200);
  assert.equal((await agent.get('/api/auth/organizations')).body.data.organizacionActiva, null);
});

test('el asistente IA permite tutor/estudiante, exige CSRF y no concede acceso al administrador institucional', async () => {
  const { env } = require('../src/config/env');
  const previousKey = env.ai.geminiApiKey;
  env.ai.geminiApiKey = '';
  try {
    await Membership.create({ usuario: user._id, organizacion: org._id, role: 'tutor', asignadoPor: user._id });
    const teacherAgent = request.agent(server);
    await login(teacherAgent);
    assert.equal((await mutate(teacherAgent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);
    assert.equal((await teacherAgent.get('/api/organization/ai-assistant')).status, 200);
    assert.equal((await teacherAgent.post('/api/organization/ai-assistant/chat').send({ message: 'Hola' })).status, 403);
    const unavailable = await mutate(teacherAgent, 'post', '/api/organization/ai-assistant/chat', { message: 'Explícame SQL' });
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.body.error.code, 'AI_PROVIDER_NOT_CONFIGURED');

    await Membership.create({ usuario: user._id, organizacion: otherOrg._id, role: 'administrador', asignadoPor: user._id });
    const adminAgent = request.agent(server);
    await login(adminAgent);
    assert.equal((await mutate(adminAgent, 'put', '/api/auth/organizations/active', { organizationId: String(otherOrg._id) })).status, 200);
    assert.equal((await adminAgent.get('/api/organization/ai-assistant')).status, 403);
  } finally {
    env.ai.geminiApiKey = previousKey;
  }
});

test('el selector de tutores solo ofrece docentes activos vinculados a la organización', async () => {
  const passwordHash = await bcrypt.hash('Password123', 4);
  const orgAdmin = await User.create({ nombre: 'Admin institucional', email: 'admin-institucional@example.com', passwordHash, role: 'administrador' });
  const otherTutor = await User.create({ nombre: 'Tutor de otra institución', email: 'otro-tutor@example.com', passwordHash, role: 'tutor' });
  const tutorWithDifferentGlobalRole = await User.create({ nombre: 'Tutor asignado por membresía', email: 'tutor-membresia@example.com', passwordHash, role: 'estudiante' });
  await Membership.create({ usuario: orgAdmin._id, organizacion: org._id, role: 'administrador', asignadoPor: orgAdmin._id });
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'tutor', asignadoPor: orgAdmin._id });
  await Membership.create({ usuario: tutorWithDifferentGlobalRole._id, organizacion: org._id, role: 'tutor', asignadoPor: orgAdmin._id });
  await Membership.create({ usuario: otherTutor._id, organizacion: otherOrg._id, role: 'tutor', asignadoPor: orgAdmin._id });
  const agent = request.agent(server);
  const token = await csrf(agent);
  assert.equal((await agent.post('/api/auth/login').set('X-CSRF-Token', token).send({ email: orgAdmin.email, password: 'Password123' })).status, 200);
  assert.equal((await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);
  const response = await agent.get('/api/organization/tutors');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.usuarios.map((item) => item.email), [tutorWithDifferentGlobalRole.email, user.email]);
});

test('el CRUD institucional solo lista estudiantes y empresas de la organización activa', async () => {
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'administrador', asignadoPor: user._id });
  await Membership.create({ usuario: user._id, organizacion: otherOrg._id, role: 'administrador', asignadoPor: user._id });
  const firstStudent = await Student.create({ organizationId: org._id, codigo: 'A-001', nombre: 'Estudiante A', email: 'a@demo.edu', programa: 'Software', semestre: 3 });
  const secondStudent = await Student.create({ organizationId: otherOrg._id, codigo: 'B-001', nombre: 'Estudiante B', email: 'b@demo.edu', programa: 'Software', semestre: 3 });
  const firstCompany = await Company.create({ organizationId: org._id, razonSocial: 'Empresa A', nit: 'NIT-A', ciudad: 'Cartagena' });
  await Company.create({ organizationId: otherOrg._id, razonSocial: 'Empresa B', nit: 'NIT-B', ciudad: 'Bogotá' });
  const agent = request.agent(server);
  await login(agent);
  assert.equal((await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);
  const students = await agent.get('/api/organization/students');
  const companies = await agent.get('/api/organization/companies');
  assert.equal(students.status, 200);
  assert.deepEqual(students.body.data.estudiantes.map(item => String(item._id)), [String(firstStudent._id)]);
  assert.equal(companies.status, 200);
  assert.deepEqual(companies.body.data.empresas.map(item => String(item._id)), [String(firstCompany._id)]);
  assert.equal((await agent.get(`/api/organization/students/${secondStudent._id}`)).status, 404);
});

test('el CRUD institucional rechaza usuarios sin membresía de administrador en la organización activa', async () => {
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'tutor', asignadoPor: user._id });
  const agent = request.agent(server);
  await login(agent);
  assert.equal((await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);
  const response = await agent.get('/api/organization/students');
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'ORGANIZATION_ROLE_FORBIDDEN');
});

test('el CRUD de actividades usa el espacio institucional activo y persiste en MongoDB', async () => {
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'administrador', asignadoPor: user._id });
  const student = await Student.create({ organizationId: org._id, codigo: 'CRUD-001', nombre: 'Estudiante CRUD', email: 'crud@student.test', programa: 'Software', semestre: 3 });
  const company = await Company.create({ organizationId: org._id, razonSocial: 'Empresa CRUD', nit: 'NIT-CRUD', ciudad: 'Cartagena' });
  const practice = await Practice.create({ organizationId: org._id, estudiante: student._id, empresa: company._id, tutor: user._id, titulo: 'Práctica CRUD', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-12-01'), estado: 'en_curso' });
  const agent = request.agent(server);
  await login(agent);
  assert.equal((await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);

  const created = await mutate(agent, 'post', '/api/organization/activities', {
    practica: String(practice._id), titulo: 'Informe inicial', descripcion: 'Preparar el informe de avance',
    fechaLimite: '2026-11-20', prioridad: 'alta',
  });
  assert.equal(created.status, 201);
  const activityId = created.body.data.actividad._id;
  assert.equal(String(created.body.data.actividad.organizationId), String(org._id));
  assert.equal((await Activity.findById(activityId)).titulo, 'Informe inicial');

  const listed = await agent.get('/api/organization/activities');
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.data.actividades.map((item) => String(item._id)), [String(activityId)]);

  const updated = await mutate(agent, 'patch', `/api/organization/activities/${activityId}`, { titulo: 'Informe actualizado', estado: 'en_revision' });
  assert.equal(updated.status, 200);
  assert.equal((await Activity.findById(activityId)).titulo, 'Informe actualizado');
  assert.equal((await Activity.findById(activityId)).estado, 'en_revision');

  const legacy = await agent.get('/api/activities');
  assert.equal(legacy.status, 409);
  assert.equal(legacy.body.error.code, 'ORGANIZATION_ROUTE_REQUIRED');

  const removed = await mutate(agent, 'delete', `/api/organization/activities/${activityId}`);
  assert.equal(removed.status, 200);
  assert.equal(await Activity.findById(activityId), null);
});

test('las prácticas de una institución no aparecen al consultar otra', async () => {
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'administrador', asignadoPor: user._id });
  await Membership.create({ usuario: user._id, organizacion: otherOrg._id, role: 'administrador', asignadoPor: user._id });
  const studentA = await Student.create({ organizationId: org._id, codigo: 'PA-001', nombre: 'Practicante A', email: 'pa@demo.edu', programa: 'Software', semestre: 3 });
  const studentB = await Student.create({ organizationId: otherOrg._id, codigo: 'PB-001', nombre: 'Practicante B', email: 'pb@demo.edu', programa: 'Software', semestre: 3 });
  const companyA = await Company.create({ organizationId: org._id, razonSocial: 'Empresa PA', nit: 'NIT-PA', ciudad: 'Cartagena' });
  const companyB = await Company.create({ organizationId: otherOrg._id, razonSocial: 'Empresa PB', nit: 'NIT-PB', ciudad: 'Bogotá' });
  const practiceA = await Practice.create({ organizationId: org._id, estudiante: studentA._id, empresa: companyA._id, tutor: user._id, titulo: 'Práctica A', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-06-01') });
  await Practice.create({ organizationId: otherOrg._id, estudiante: studentB._id, empresa: companyB._id, tutor: user._id, titulo: 'Práctica B', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-06-01') });
  const agent = request.agent(server);
  await login(agent);
  assert.equal((await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);
  const response = await agent.get('/api/organization/practices');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.practicas.map(item => String(item._id)), [String(practiceA._id)]);
  assert.equal((await agent.get(`/api/organization/practices/${String((await Practice.findOne({ organizationId: otherOrg._id }))._id)}`)).status, 404);
});

test('las cuentas vinculadas a una institución no pueden usar rutas académicas globales', async () => {
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'tutor', asignadoPor: user._id });
  const agent = request.agent(server);
  await login(agent);
  // La protección también aplica si la cuenta limpia su organización activa.
  const paths = [
    '/api/practices',
    '/api/activities',
    '/api/evaluations',
    '/api/reports',
    '/api/evidences/activity/507f1f77bcf86cd799439011',
  ];
  for (const path of paths) {
    const response = await agent.get(path);
    assert.equal(response.status, 409, path);
    assert.equal(response.body.error.code, 'ORGANIZATION_ROUTE_REQUIRED', path);
  }
});

test('las relaciones anidadas de otra institución no se exponen en actividades ni informes', async () => {
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'administrador', asignadoPor: user._id });
  const studentB = await Student.create({ organizationId: otherOrg._id, codigo: 'X-901', nombre: 'Dato ajeno', email: 'ajeno@demo.edu', programa: 'Software', semestre: 3 });
  const companyB = await Company.create({ organizationId: otherOrg._id, razonSocial: 'Empresa ajena', nit: 'NIT-X901', ciudad: 'Bogotá' });
  const practiceB = await Practice.create({ organizationId: otherOrg._id, estudiante: studentB._id, empresa: companyB._id, tutor: user._id, titulo: 'Práctica ajena', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-06-01') });
  await Activity.create({ organizationId: org._id, practica: practiceB._id, titulo: 'Actividad con referencia inconsistente', fechaLimite: new Date('2026-12-01'), creadoPor: user._id });
  await Practice.create({ organizationId: org._id, estudiante: studentB._id, empresa: companyB._id, tutor: user._id, titulo: 'Práctica con referencias inconsistentes', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-06-01') });
  const agent = request.agent(server);
  await login(agent);
  assert.equal((await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);
  const activities = await agent.get('/api/organization/activities');
  assert.equal(activities.status, 200);
  assert.equal(activities.body.data.actividades.length, 1);
  assert.equal(activities.body.data.actividades[0].practica, null);
  const reports = await agent.get('/api/organization/reports');
  assert.equal(reports.status, 200);
  assert.equal(reports.body.data.reportes.length, 1);
  assert.equal(reports.body.data.reportes[0].estudiante, null);
  assert.equal(reports.body.data.reportes[0].empresa, null);
});

test('las evidencias se suben, revisan y descargan solo dentro de su organización', async () => {
  const studentUser = await User.create({ nombre: 'Estudiante', email: 'student@multi.test', passwordHash: user.passwordHash, role: 'estudiante' });
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'administrador', asignadoPor: user._id });
  await Membership.create({ usuario: studentUser._id, organizacion: org._id, role: 'estudiante', asignadoPor: user._id });
  const student = await Student.create({ organizationId: org._id, usuario: studentUser._id, codigo: 'EV-001', nombre: 'Estudiante Evidencia', email: studentUser.email, programa: 'Software', semestre: 3 });
  const company = await Company.create({ organizationId: org._id, razonSocial: 'Empresa Evidencia', nit: 'NIT-EV1', ciudad: 'Cartagena' });
  const practice = await Practice.create({ organizationId: org._id, estudiante: student._id, empresa: company._id, tutor: user._id, titulo: 'Práctica evidencia', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-12-01'), estado: 'en_curso' });
  const activity = await Activity.create({ organizationId: org._id, practica: practice._id, titulo: 'Entregar informe', fechaLimite: new Date('2026-12-01'), creadoPor: user._id });
  const otherStudent = await Student.create({ organizationId: otherOrg._id, codigo: 'EV-002', nombre: 'Estudiante Otra', email: 'other@multi.test', programa: 'Software', semestre: 3 });
  const otherCompany = await Company.create({ organizationId: otherOrg._id, razonSocial: 'Empresa Otra', nit: 'NIT-EV2', ciudad: 'Bogotá' });
  const otherPractice = await Practice.create({ organizationId: otherOrg._id, estudiante: otherStudent._id, empresa: otherCompany._id, tutor: user._id, titulo: 'Práctica otra', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-12-01'), estado: 'en_curso' });
  const otherActivity = await Activity.create({ organizationId: otherOrg._id, practica: otherPractice._id, titulo: 'Actividad otra', fechaLimite: new Date('2026-12-01'), creadoPor: user._id });
  const otherFile = 'evidence-other-tenant.pdf';
  await fs.writeFile(path.join(STORAGE_DIR, otherFile), '%PDF-1.7\ncontenido privado');
  const otherEvidence = await Evidence.create({ organizationId: otherOrg._id, actividad: otherActivity._id, estudiante: otherStudent._id, nombreOriginal: 'privado.pdf', nombreAlmacenado: otherFile, mimeType: 'application/pdf', tamano: 25 });
  const studentAgent = request.agent(server);
  const studentToken = await csrf(studentAgent);
  assert.equal((await studentAgent.post('/api/auth/login').set('X-CSRF-Token', studentToken).send({ email: studentUser.email, password: 'Password123' })).status, 200);
  assert.equal((await mutate(studentAgent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);
  const upload = await studentAgent.post(`/api/organization/activities/${activity._id}/evidences`)
    .set('X-CSRF-Token', await csrf(studentAgent))
    .attach('archivo', Buffer.from('%PDF-1.7\ncontenido de prueba'), { filename: 'informe.pdf', contentType: 'application/pdf' });
  assert.equal(upload.status, 201, JSON.stringify(upload.body));
  const evidenceId = upload.body.data.evidencia._id;
  const adminAgent = request.agent(server);
  await login(adminAgent);
  assert.equal((await mutate(adminAgent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);
  const review = await mutate(adminAgent, 'patch', `/api/organization/evidences/${evidenceId}/review`, { estado: 'aprobada', observacion: 'Correcto' });
  assert.equal(review.status, 200, JSON.stringify(review.body));
  assert.equal(review.body.data.evidencia.estado, 'aprobada');
  assert.equal((await adminAgent.get(`/api/organization/evidences/${evidenceId}/download`)).status, 200);
  assert.equal((await adminAgent.get(`/api/organization/evidences/${otherEvidence._id}/download`)).status, 404);
  await fs.unlink(path.join(STORAGE_DIR, otherFile));
});

test('las evaluaciones se crean y consultan por organización sin modificar las de otra institución', async () => {
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'administrador', asignadoPor: user._id });
  await Membership.create({ usuario: user._id, organizacion: otherOrg._id, role: 'administrador', asignadoPor: user._id });
  const studentA = await Student.create({ organizationId: org._id, codigo: 'EA-001', nombre: 'Evaluado A', email: 'ea@test.edu', programa: 'Software', semestre: 3 });
  const studentB = await Student.create({ organizationId: otherOrg._id, codigo: 'EB-001', nombre: 'Evaluado B', email: 'eb@test.edu', programa: 'Software', semestre: 3 });
  const companyA = await Company.create({ organizationId: org._id, razonSocial: 'Empresa EA', nit: 'NIT-EA', ciudad: 'Cartagena' });
  const companyB = await Company.create({ organizationId: otherOrg._id, razonSocial: 'Empresa EB', nit: 'NIT-EB', ciudad: 'Bogotá' });
  const practiceA = await Practice.create({ organizationId: org._id, estudiante: studentA._id, empresa: companyA._id, tutor: user._id, titulo: 'Evaluación A', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-12-01') });
  const practiceB = await Practice.create({ organizationId: otherOrg._id, estudiante: studentB._id, empresa: companyB._id, tutor: user._id, titulo: 'Evaluación B', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-12-01') });
  const agent = request.agent(server);
  await login(agent);
  assert.equal((await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);
  const saveA = await mutate(agent, 'put', `/api/organization/evaluations/${practiceA._id}`, { calificacion: 4.5, concepto: 'excelente', fortalezas: 'Buen desempeño' });
  assert.equal(saveA.status, 200, JSON.stringify(saveA.body));
  assert.equal(saveA.body.data.evaluacion.organizationId, String(org._id));
  assert.equal((await mutate(agent, 'put', `/api/organization/evaluations/${practiceB._id}`, { calificacion: 2, concepto: 'insuficiente' })).status, 404);
  assert.equal((await agent.get('/api/organization/evaluations')).body.data.evaluaciones.length, 1);
  assert.equal((await agent.get('/api/organization/reports')).body.data.reportes[0].evaluacion.calificacion, 4.5);
  assert.equal((await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(otherOrg._id) })).status, 200);
  const saveB = await mutate(agent, 'put', `/api/organization/evaluations/${practiceB._id}`, { calificacion: 3.5, concepto: 'bueno' });
  assert.equal(saveB.status, 200, JSON.stringify(saveB.body));
  assert.equal((await agent.get('/api/organization/evaluations')).body.data.evaluaciones.length, 1);
  assert.equal((await Evaluation.findOne({ practica: practiceA._id })).calificacion, 4.5);
});

test('los identificadores académicos son únicos por organización y pueden repetirse entre organizaciones', async () => {
  const first = await Student.create({ organizationId: org._id, codigo: 'DUP-001', nombre: 'Estudiante Uno', email: 'repetido@demo.edu', programa: 'Software', semestre: 3 });
  const second = await Student.create({ organizationId: otherOrg._id, codigo: 'DUP-001', nombre: 'Estudiante Dos', email: 'repetido@demo.edu', programa: 'Software', semestre: 3 });
  assert.ok(first._id);
  assert.ok(second._id);
  await assert.rejects(
    Student.create({ organizationId: org._id, codigo: 'DUP-001', nombre: 'Duplicado Código', email: 'otro@demo.edu', programa: 'Software', semestre: 3 }),
    error => error.code === 11000
  );
  await assert.rejects(
    Student.create({ organizationId: org._id, codigo: 'DUP-002', nombre: 'Duplicado Email', email: 'repetido@demo.edu', programa: 'Software', semestre: 3 }),
    error => error.code === 11000
  );
  const companyA = await Company.create({ organizationId: org._id, razonSocial: 'Empresa Uno', nit: 'NIT-DUP', ciudad: 'Cartagena' });
  const companyB = await Company.create({ organizationId: otherOrg._id, razonSocial: 'Empresa Dos', nit: 'NIT-DUP', ciudad: 'Bogotá' });
  assert.ok(companyA._id);
  assert.ok(companyB._id);
  await assert.rejects(
    Company.create({ organizationId: org._id, razonSocial: 'Empresa Duplicada', nit: 'NIT-DUP', ciudad: 'Sincelejo' }),
    error => error.code === 11000
  );
});

test('la matriz de roles institucionales aplica permisos distintos sin usar el rol global', async () => {
  const agent = request.agent(server);
  await login(agent);
  const expected = {
    administrador: { students: 200, activities: 400, evaluations: 400, evidence: 403 },
    tutor: { students: 403, activities: 400, evaluations: 400, evidence: 403 },
    estudiante: { students: 403, activities: 403, evaluations: 403, evidence: 400 },
  };
  for (const role of ['administrador', 'tutor', 'estudiante']) {
    await Membership.deleteMany({ usuario: user._id, organizacion: org._id });
    await Membership.create({ usuario: user._id, organizacion: org._id, role, asignadoPor: user._id });
    const selected = await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) });
    assert.equal(selected.status, 200, role);
    const students = await agent.get('/api/organization/students');
    const activities = await mutate(agent, 'post', '/api/organization/activities', {});
    const evaluations = await mutate(agent, 'put', '/api/organization/evaluations/507f1f77bcf86cd799439011', {});
    const evidence = await agent.post('/api/organization/activities/507f1f77bcf86cd799439011/evidences')
      .set('X-CSRF-Token', await csrf(agent));
    assert.equal(students.status, expected[role].students, `${role}: students`);
    assert.equal(activities.status, expected[role].activities, `${role}: activities`);
    assert.equal(evaluations.status, expected[role].evaluations, `${role}: evaluations`);
    assert.equal(evidence.status, expected[role].evidence, `${role}: evidence`);
  }
});

test('el docente configura módulos con ponderaciones del 100 % y conserva el historial de cambios', async () => {
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'tutor', asignadoPor: user._id });
  const student = await Student.create({ organizationId: org._id, codigo: 'EST-ESTRUCT', nombre: 'Estudiante Estructura', email: 'estructura@test.edu', programa: 'Software', semestre: 3 });
  const company = await Company.create({ organizationId: org._id, razonSocial: 'Empresa Estructura', nit: 'NIT-ESTRUCT', ciudad: 'Cartagena' });
  const practice = await Practice.create({ organizationId: org._id, estudiante: student._id, empresa: company._id, tutor: user._id, titulo: 'Práctica con estructura', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-12-01'), estado: 'planificada' });
  const agent = request.agent(server);
  await login(agent);
  assert.equal((await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);

  const initial = await agent.get(`/api/organization/practices/${practice._id}/academic-structure`);
  assert.equal(initial.status, 200);
  assert.deepEqual(initial.body.data.modulos, []);

  const invalid = await mutate(agent, 'put', `/api/organization/practices/${practice._id}/academic-structure`, {
    modulos: [{ nombre: 'Inducción', ponderacion: 40 }, { nombre: 'Proyecto', ponderacion: 40 }],
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'ACADEMIC_WEIGHTS_MUST_TOTAL_100');

  const saved = await mutate(agent, 'put', `/api/organization/practices/${practice._id}/academic-structure`, {
    modulos: [{ nombre: 'Inducción', ponderacion: 20 }, { nombre: 'Desarrollo', ponderacion: 50 }, { nombre: 'Informe final', ponderacion: 30 }],
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.data.modulos.length, 3);
  assert.equal(saved.body.data.modulos.reduce((sum, item) => sum + item.ponderacion, 0), 100);
  assert.equal((await Practice.findById(practice._id)).estructuraAcademica.length, 3);

  const moduleId = String(saved.body.data.modulos[0]._id);
  const activity = await mutate(agent, 'post', '/api/organization/activities', {
    practica: String(practice._id), moduloAcademicoId: moduleId,
    titulo: 'Diagnóstico inicial', descripcion: 'Reconocer el contexto de la empresa.',
    fechaLimite: '2026-11-20', prioridad: 'media',
  });
  assert.equal(activity.status, 201, JSON.stringify(activity.body));
  assert.equal(String(activity.body.data.actividad.moduloAcademicoId), moduleId);
  const visibleActivities = await agent.get('/api/organization/activities?practica=' + practice._id);
  assert.equal(visibleActivities.status, 200);
  assert.equal(visibleActivities.body.data.actividades[0].practica.estructuraAcademica.length, 3);
  assert.equal(String(visibleActivities.body.data.actividades[0].moduloAcademicoId), moduleId);

  const invalidModule = await mutate(agent, 'post', '/api/organization/activities', {
    practica: String(practice._id), moduloAcademicoId: '507f1f77bcf86cd799439011',
    titulo: 'Actividad sin módulo válido', fechaLimite: '2026-11-20', prioridad: 'media',
  });
  assert.equal(invalidModule.status, 400);
  assert.equal(invalidModule.body.error.code, 'INVALID_ACADEMIC_MODULE');

  const otherActivities = [];
  for (const [index, module] of saved.body.data.modulos.slice(1).entries()) {
    const createdActivity = await mutate(agent, 'post', '/api/organization/activities', {
      practica: String(practice._id), moduloAcademicoId: String(module._id),
      titulo: 'Actividad del módulo ' + (index + 2),
      fechaLimite: '2026-11-25', prioridad: 'media',
    });
    assert.equal(createdActivity.status, 201, JSON.stringify(createdActivity.body));
    otherActivities.push(createdActivity.body.data.actividad);
  }
  const gradedActivities = [activity.body.data.actividad, ...otherActivities];
  const scores = [4, 3, 5];
  for (let index = 0; index < gradedActivities.length; index += 1) {
    const grade = await mutate(agent, 'put', '/api/organization/activities/' + gradedActivities[index]._id + '/tutor-assessment', {
      calificacion: scores[index], observaciones: 'Retroalimentación de prueba.',
    });
    assert.equal(grade.status, 200, JSON.stringify(grade.body));
  }
  const calculated = await agent.get('/api/organization/practices/' + practice._id + '/academic-structure');
  assert.equal(calculated.status, 200);
  assert.equal(calculated.body.data.resumenCalificacion.estado, 'completa');
  assert.equal(calculated.body.data.resumenCalificacion.notaFinal, 3.8);

  const withoutReason = await mutate(agent, 'put', `/api/organization/practices/${practice._id}/academic-structure`, {
    modulos: [{ _id: saved.body.data.modulos[0]._id, nombre: 'Inducción', ponderacion: 25 }, { _id: saved.body.data.modulos[1]._id, nombre: 'Desarrollo', ponderacion: 45 }, { _id: saved.body.data.modulos[2]._id, nombre: 'Informe final', ponderacion: 30 }],
  });
  assert.equal(withoutReason.status, 400);
  assert.equal(withoutReason.body.error.code, 'CHANGE_REASON_REQUIRED');

  const changed = await mutate(agent, 'put', `/api/organization/practices/${practice._id}/academic-structure`, {
    modulos: [{ _id: saved.body.data.modulos[0]._id, nombre: 'Inducción', ponderacion: 25 }, { _id: saved.body.data.modulos[1]._id, nombre: 'Desarrollo', ponderacion: 45 }, { _id: saved.body.data.modulos[2]._id, nombre: 'Informe final', ponderacion: 30 }],
    motivoCambio: 'Ajuste de la ponderación acordado con el tutor.',
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.data.historial.length, 1);
  assert.equal(changed.body.data.historial[0].motivo, 'Ajuste de la ponderación acordado con el tutor.');
});

test('el tutor no puede consultar ni modificar la estructura de una práctica ajena', async () => {
  await Membership.create({ usuario: user._id, organizacion: org._id, role: 'tutor', asignadoPor: user._id });
  const otherTutor = await User.create({ nombre: 'Otro tutor', email: 'otro-estructura@test.edu', passwordHash: await bcrypt.hash('Password123', 4), role: 'tutor' });
  const student = await Student.create({ organizationId: org._id, codigo: 'EST-OTRO', nombre: 'Estudiante Otro', email: 'otro-est@test.edu', programa: 'Software', semestre: 3 });
  const company = await Company.create({ organizationId: org._id, razonSocial: 'Empresa Otro Tutor', nit: 'NIT-OTRO', ciudad: 'Cartagena' });
  const practice = await Practice.create({ organizationId: org._id, estudiante: student._id, empresa: company._id, tutor: otherTutor._id, titulo: 'Práctica ajena', fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-12-01'), estado: 'planificada' });
  const agent = request.agent(server);
  await login(agent);
  assert.equal((await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: String(org._id) })).status, 200);
  const read = await agent.get(`/api/organization/practices/${practice._id}/academic-structure`);
  assert.equal(read.status, 403);
  const write = await mutate(agent, 'put', `/api/organization/practices/${practice._id}/academic-structure`, {
    modulos: [{ nombre: 'Módulo único', ponderacion: 100 }],
  });
  assert.equal(write.status, 403);
});
