const ApiError = require('../utils/ApiError');

/**
 * Middleware para cualquier ruta no definida.
 * Debe registrarse despues de todas las rutas y antes del errorHandler.
 */
function notFound(req, res, next) {
  next(
    new ApiError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`, {
      code: 'NOT_FOUND',
    })
  );
}

module.exports = notFound;
