const ApiError = require('../utils/ApiError');

function requireRole(...rolesPermitidos) {
  return function verificarRol(req, res, next) {
    if (!req.session || !req.session.userId) {
      return next(
        new ApiError(401, 'Debes iniciar sesión para acceder a este recurso.', {
          code: 'UNAUTHORIZED',
        })
      );
    }

    req.user = req.user || null;

    const User = require('../models/User');
    User.findById(req.session.userId)
      .then((usuario) => {
        if (!usuario) {
          return next(
            new ApiError(401, 'La sesión ya no es válida.', {
              code: 'UNAUTHORIZED',
            })
          );
        }

        if (usuario.activo === false) {
          return next(new ApiError(401, 'La cuenta está desactivada.', { code: 'ACCOUNT_DISABLED' }));
        }

        const usuarioEfectivo = req.organization && req.user
          ? { ...usuario.toObject(), role: req.user.role }
          : usuario;
        req.user = usuarioEfectivo;
        if (!rolesPermitidos.includes(usuarioEfectivo.role)) {
          return next(
            new ApiError(403, 'No tienes permisos para realizar esta acción.', {
              code: 'FORBIDDEN',
            })
          );
        }

        return next();
      })
      .catch(next);
  };
}

module.exports = requireRole;
