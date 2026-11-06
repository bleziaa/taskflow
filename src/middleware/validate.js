const { validationResult } = require('express-validator');

const ApiError = require('../utils/ApiError');

function validate(req, res, next) {
  const resultado = validationResult(req);

  if (!resultado.isEmpty()) {
    return next(
      new ApiError(400, 'Datos invalidos.', {
        code: 'VALIDATION_ERROR',
        details: resultado.array().map((error) => ({
          campo: error.path,
          mensaje: error.msg,
        })),
      })
    );
  }

  return next();
}

module.exports = validate;
