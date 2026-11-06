const { Router } = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const rejectLegacyOrganizationAccess = require('../middleware/rejectLegacyOrganizationAccess');
const controller = require('../controllers/report.controller');
const router = Router();
router.get('/', requireAuth, rejectLegacyOrganizationAccess, requireRole('administrador', 'tutor', 'estudiante'), controller.obtenerInformes);
module.exports = router;
