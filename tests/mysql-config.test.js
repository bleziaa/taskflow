const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.MYSQL_ENABLED = 'false';
const { conectarMySQL, obtenerPoolMySQL, estadoMySQL, desconectarMySQL } = require('../src/config/mysql');

test('MySQL permanece aislado y opcional mientras se prepara la migracion', async () => {
  assert.deepEqual(estadoMySQL(), {
    enabled: false,
    status: 'disabled',
    database: null,
    error: null,
  });
  assert.equal(await conectarMySQL(), null);
  assert.throws(() => obtenerPoolMySQL(), /MySQL no esta conectado/);
  await desconectarMySQL();
  assert.equal(estadoMySQL().status, 'disabled');
});
