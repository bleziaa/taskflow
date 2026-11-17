process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '8.2.5';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Student = require('../src/models/Student');
const ApiError = require('../src/utils/ApiError');
const { normalizarTelefono, validarTelefonoDisponible } = require('../src/utils/student-phone');

let mongo;
let organizationId;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Student.init();
});
beforeEach(async () => {
  await Student.deleteMany({});
  organizationId = new mongoose.Types.ObjectId();
});
after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('normaliza espacios, guiones y prefijo colombiano para reconocer el mismo teléfono', () => {
  assert.equal(normalizarTelefono('300 123-4567'), '3001234567');
  assert.equal(normalizarTelefono('+57 300 123 4567'), '3001234567');
  assert.equal(normalizarTelefono(' (300) 123.4567 '), '3001234567');
  assert.equal(normalizarTelefono(''), null);
});

test('rechaza un teléfono repetido en fichas de la misma institución', async () => {
  await Student.create({ organizationId, codigo: 'EST-001', nombre: 'Estudiante Uno', email: 'uno@test.edu', telefono: '300 123 4567', programa: 'Software', semestre: 3 });
  await assert.rejects(
    () => validarTelefonoDisponible({ organizationId, telefono: '+57 300-123-4567' }),
    (error) => error instanceof ApiError && error.statusCode === 409 && error.code === 'PHONE_ALREADY_REGISTERED'
  );
});

test('permite el mismo teléfono en otra institución y no bloquea la ficha que lo conserva', async () => {
  await Student.create({ organizationId, codigo: 'EST-001', nombre: 'Estudiante Uno', email: 'uno@test.edu', telefono: '3001234567', programa: 'Software', semestre: 3 });
  const otherOrganizationId = new mongoose.Types.ObjectId();
  assert.equal(await validarTelefonoDisponible({ organizationId: otherOrganizationId, telefono: '+57 300 123 4567' }), '3001234567');
  const own = await Student.findOne({ organizationId });
  assert.equal(await validarTelefonoDisponible({ organizationId, telefono: own.telefono, excludeId: own._id }), '3001234567');
});

test('el índice único de MongoDB impide duplicados incluso ante escrituras simultáneas', async () => {
  const base = { organizationId, nombre: 'Estudiante', programa: 'Software', semestre: 3 };
  await Student.create({ ...base, codigo: 'EST-001', email: 'uno@test.edu', telefono: '3001234567' });
  await assert.rejects(
    () => Student.create({ ...base, codigo: 'EST-002', email: 'dos@test.edu', telefono: '+57 300 123 4567' }),
    (error) => error.code === 11000
  );
});
