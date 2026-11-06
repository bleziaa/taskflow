/**
 * Manejo centralizado de errores.
 *
 * Traduce errores de Mongoose y errores inesperados a una respuesta JSON
 * uniforme: { ok: false, error: { code, message, details? } }.
 * El stack solo se expone fuera de produccion y para errores 5xx.
 */
const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');

// Express reconoce este middleware como manejador de errores por tener 4 parametros.
function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof ApiError)) {
    if (error.name === 'ValidationError') {
      const details = Object.values(error.errors).map((item) => item.message);
      error = new ApiError(400, 'Datos invalidos', {
        code: 'VALIDATION_ERROR',
        details,
      });
    } else if (error.name === 'CastError') {
      error = new ApiError(400, `Identificador invalido: ${error.path}`, {
        code: 'CAST_ERROR',
      });
    } else if (error.code === 11000) {
      const campos = Object.keys(error.keyValue || {});
      error = new ApiError(409, `Valor duplicado: ${campos.join(', ') || 'desconocido'}`, {
        code: 'DUPLICATE_KEY',
        details: campos,
      });
    } else {
      error = new ApiError(500, 'Error interno del servidor', {
        code: 'INTERNAL_ERROR',
      });
    }
  }

  if (error.statusCode >= 500) {
    console.error('[error]', err);
  }

  const cuerpo = {
    ok: false,
    error: {
      code: error.code || 'ERROR',
      message: error.message,
    },
  };

  if (error.details) {
    cuerpo.error.details = error.details;
  }

  if (env.nodeEnv !== 'production' && error.statusCode >= 500) {
    cuerpo.error.stack = err.stack;
  }

  res.status(error.statusCode).json(cuerpo);
}

module.exports = errorHandler;
