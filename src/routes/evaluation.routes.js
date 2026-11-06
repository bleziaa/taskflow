const { Router } = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const rejectLegacyOrganizationAccess = require('../middleware/rejectLegacyOrganizationAccess');
const { protegerCsrf } = require('../middleware/csrf');
const { param, body } = require('express-validator');
const validate = require('../middleware/validate');
const controller = require('../controllers/evaluation.controller');
const router = Router();
router.use(requireAuth, rejectLegacyOrganizationAccess, requireRole('administrador', 'tutor', 'estudiante'));
router.get('/', controller.listarEvaluaciones);
router.put('/:practicaId', requireRole('administrador', 'tutor'), protegerCsrf,
  param('practicaId').isMongoId(), body('calificacion').isFloat({ min: 0, max: 5 }).toFloat(),
  body('concepto').isIn(['excelente', 'bueno', 'satisfactorio', 'insuficiente']),
  body('fortalezas').optional().isString().isLength({ max: 2000 }),
  body('aspectosMejora').optional().isString().isLength({ max: 2000 }),
  body('observaciones').optional().isString().isLength({ max: 3000 }),
  validate, controller.guardarEvaluacion);
module.exports = router;
