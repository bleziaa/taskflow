const { Router } = require('express');

const {
  obtenerCsrfToken,
  iniciarSesion,
  obtenerSesion,
  cambiarPassword,
  solicitarRestablecimientoPassword,
  confirmarRestablecimientoPassword,
  cerrarSesion,
} = require('../controllers/auth.controller');
const { protegerCsrf } = require('../middleware/csrf');
const { requireAuth } = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const { loginLimiter, passwordResetLimiter } = require('../middleware/rateLimiters');
const { validarLogin } = require('../validators/auth.validators');
const organizationSelectionRoutes = require('./organization-selection.routes');

const router = Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/csrf-token', obtenerCsrfToken);
router.post('/login', loginLimiter, protegerCsrf, validarLogin, validate, iniciarSesion);
router.post('/forgot-password', passwordResetLimiter, protegerCsrf, solicitarRestablecimientoPassword);
router.post('/reset-password', passwordResetLimiter, protegerCsrf, confirmarRestablecimientoPassword);
router.get('/me', requireAuth, obtenerSesion);
router.post('/change-password', requireAuth, protegerCsrf, cambiarPassword);
router.use('/organizations', requireAuth, organizationSelectionRoutes);
router.post('/logout', protegerCsrf, cerrarSesion);

module.exports = router;
