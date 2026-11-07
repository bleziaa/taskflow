const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Activity = require('../src/models/Activity');

test('una actividad admite fecha de apertura e historial de modificaciones', async () => {
  const actor = new mongoose.Types.ObjectId();
  const activity = new Activity({
    practica: new mongoose.Types.ObjectId(),
    creadoPor: actor,
    titulo: 'Entregar diagnóstico',
    fechaInicio: new Date('2026-11-08T00:00:00.000Z'),
    fechaLimite: new Date('2026-11-20T00:00:00.000Z'),
    historialModificaciones: [{
      motivo: 'Se amplía el plazo por ajuste del cronograma',
      cambios: [{ campo: 'Fecha límite', valorAnterior: '2026-11-18', valorNuevo: '2026-11-20' }],
      modificadoPor: actor,
      modificadoEn: new Date('2026-11-06T15:00:00.000Z')
    }]
  });
  await assert.doesNotReject(() => activity.validate());
  assert.equal(activity.historialModificaciones.length, 1);
  assert.equal(activity.historialModificaciones[0].cambios[0].campo, 'Fecha límite');
});

test('las actividades anteriores siguen siendo válidas sin fecha de apertura', async () => {
  const activity = new Activity({
    practica: new mongoose.Types.ObjectId(),
    creadoPor: new mongoose.Types.ObjectId(),
    titulo: 'Actividad heredada',
    fechaLimite: new Date('2026-11-20T00:00:00.000Z')
  });
  await assert.doesNotReject(() => activity.validate());
  assert.equal(activity.fechaInicio, null);
  assert.deepEqual(activity.historialModificaciones, []);
});
