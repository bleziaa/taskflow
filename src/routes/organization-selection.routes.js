const { Router } = require('express');
const { body } = require('express-validator');
const { protegerCsrf } = require('../middleware/csrf');
const validate = require('../middleware/validate');
const controller = require('../controllers/organization-context.controller');
const router = Router();

router.get('/', controller.listarOrganizacionesDelUsuario);
router.put('/active', protegerCsrf, body('organizationId').isMongoId().withMessage('Identificador de organización inválido.'), validate, controller.seleccionarOrganizacionActiva);
router.delete('/active', protegerCsrf, controller.limpiarOrganizacionActiva);

module.exports = router;
