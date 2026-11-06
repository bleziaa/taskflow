const { Router } = require('express');
const { param } = require('express-validator');
const { protegerCsrf } = require('../middleware/csrf');
const validate = require('../middleware/validate');
const controller = require('../controllers/organization.controller');
const v = require('../validators/organization.validators');

const router = Router();
const validarMembershipId = [param('membershipId').isMongoId().withMessage('Identificador de asignación inválido.')];

router.get('/available-users', controller.listarUsuariosDisponibles);
router.get('/', v.validarFiltroOrganizaciones, validate, controller.listarOrganizaciones);
router.post('/', protegerCsrf, v.validarNuevaOrganizacion, validate, controller.crearOrganizacion);
router.get('/:id', v.validarIdOrganizacion, validate, controller.obtenerOrganizacion);
router.patch('/:id', protegerCsrf, v.validarActualizacionOrganizacion, validate, controller.actualizarOrganizacion);
router.post('/:id/members', protegerCsrf, v.validarMembresia, validate, controller.asignarMiembro);
router.patch('/:id/members/:membershipId', protegerCsrf, v.validarActualizacionMembresia, validate, controller.actualizarMiembro);
router.delete('/:id/members/:membershipId', protegerCsrf, v.validarIdOrganizacion, validarMembershipId, validate, controller.retirarMiembro);

module.exports = router;
