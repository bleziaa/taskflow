const { test } = require('node:test');
const assert = require('node:assert/strict');
const RULES = require('../shared/field-rules');

test('reglas compartidas mantienen límites consistentes entre ficha y administración', () => {
  assert.equal(RULES.studentNameMax, 120);
  assert.equal(RULES.profileNameMax, RULES.studentNameMax);
  assert.equal(RULES.studentProgramMin, 2);
  assert.equal(RULES.studentProgramMax, 120);
  assert.equal(RULES.semesterMin, 1);
  assert.equal(RULES.semesterMax, 12);
});

test('validación compartida de teléfono admite vacío y formatos nacionales o internacionales', () => {
  assert.equal(RULES.isValidPhone(''), true);
  assert.equal(RULES.isValidPhone('300 123 4567'), true);
  assert.equal(RULES.isValidPhone('+57 300 123 4567'), true);
  assert.equal(RULES.isValidPhone('12345'), false);
  assert.equal(RULES.isValidPhone('abc1234567'), false);
  assert.equal(RULES.isValidPhone('30012345678901234567890'), false);
});
