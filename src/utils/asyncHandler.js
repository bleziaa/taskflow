/**
 * Envuelve un controlador async para que cualquier promesa rechazada
 * se envie automaticamente al manejador central de errores.
 *
 * @param {Function} fn Controlador de Express.
 * @returns {Function} Controlador envuelto.
 */
function asyncHandler(fn) {
  return function envoltura(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
