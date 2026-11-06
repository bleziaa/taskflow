const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const { env } = require('../config/env');

async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next(new ApiError(401, 'Debes iniciar sesion para acceder a este recurso.', { code: 'UNAUTHORIZED' }));
  }
  try {
    const usuario = await User.findById(req.session.userId).select('_id activo debeCambiarPassword');
    if (!usuario || usuario.activo === false) {
      const code = usuario ? 'ACCOUNT_DISABLED' : 'UNAUTHORIZED';
      const message = usuario ? 'La cuenta está desactivada.' : 'La sesión ya no es válida.';
      await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
      res.clearCookie(env.sessionName, { httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production' });
      return next(new ApiError(401, message, { code }));
    }
    const ruta = String(req.originalUrl || req.url || '').split('?')[0];
    if (usuario.debeCambiarPassword && !['/api/auth/me', '/api/auth/change-password'].includes(ruta)) {
      return next(new ApiError(403, 'Debes cambiar tu contraseña temporal antes de continuar.', { code: 'PASSWORD_CHANGE_REQUIRED' }));
    }
    return next();
  } catch (error) { return next(error); }
}

function redirigirSiNoAutenticado(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.redirect(302, '/login.html');
}

module.exports = { requireAuth, redirigirSiNoAutenticado };
