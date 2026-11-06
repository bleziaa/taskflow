const test = require('node:test');
const assert = require('node:assert/strict');
const { consultarGemini, validarEntrada } = require('../src/services/ai-assistant.service');

test('rechaza mensajes vacíos y demasiado largos', () => {
  assert.throws(() => validarEntrada('   '), error => error.statusCode === 400);
  assert.throws(() => validarEntrada('x'.repeat(6001)), error => error.statusCode === 400);
  assert.equal(validarEntrada('  Hola  '), 'Hola');
});

test('no intenta llamar al proveedor si no hay clave', async () => {
  await assert.rejects(
    consultarGemini({ message: 'Explícame SQL', role: 'estudiante', apiKey: '' }),
    error => error.statusCode === 503 && error.code === 'AI_PROVIDER_NOT_CONFIGURED'
  );
});

test('construye una petición Gemini y extrae la respuesta sin exponer datos', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Una tabla organiza datos en filas y columnas.' }] } }] }) };
  };
  const result = await consultarGemini({
    message: '¿Qué es una tabla?', role: 'estudiante', organizationName: 'Universidad demo',
    apiKey: 'test-secret', model: 'gemini-test', fetchImpl
  });
  assert.match(request.url, /gemini-test:generateContent$/);
  assert.equal(request.options.headers['x-goog-api-key'], 'test-secret');
  assert.match(request.options.body, /estudiante/);
  assert.equal(result.answer, 'Una tabla organiza datos en filas y columnas.');
  assert.equal(result.model, 'gemini-test');
});

test('convierte errores del proveedor en errores controlados', async () => {
  await assert.rejects(
    consultarGemini({ message: 'Hola', role: 'tutor', apiKey: 'test', fetchImpl: async () => ({ ok: false, status: 403 }) }),
    error => error.statusCode === 502 && error.code === 'AI_PROVIDER_AUTH_FAILED'
  );
});
