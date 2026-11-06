const crypto = require('node:crypto');

const ApiError = require('../utils/ApiError');

const CSRF_HEADER = 'x-csrf-token';

function generarTokenCsrf() {
  return crypto.randomBytes(32).toString('hex');
}

function obtenerTokenCsrf(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generarTokenCsrf();
  }

  return req.session.csrfToken;
}

function tokensIguales(recibido, esperado) {
  if (typeof recibido !== 'string' || typeof esperado !== 'string' || !recibido || !esperado) {
    return false;
  }

  const bufferRecibido = Buffer.from(recibido);
  const bufferEsperado = Buffer.from(esperado);

  if (bufferRecibido.length !== bufferEsperado.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferRecibido, bufferEsperado);
}

function protegerCsrf(req, res, next) {
  const recibido = req.get(CSRF_HEADER);
  const esperado = req.session && req.session.csrfToken;

  if (!tokensIguales(recibido, esperado)) {
    return next(
      new ApiError(403, 'Token CSRF invalido o ausente.', {
        code: 'CSRF_INVALID',
      })
    );
  }

  return next();
}

module.exports = {
  CSRF_HEADER,
  generarTokenCsrf,
  obtenerTokenCsrf,
  protegerCsrf,
};
