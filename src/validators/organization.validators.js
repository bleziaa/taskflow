const { body, param, query } = require('express-validator');

const validarIdOrganizacion = [param('id').isMongoId().withMessage('Identificador de organización inválido.')];
const validarNuevaOrganizacion = [
  body('nombre').isString().trim().isLength({ min: 2, max: 140 }),
  body('codigo').isString().trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_-]+$/),
  body('descripcion').optional().isString().trim().isLength({ max: 1000 }),
  body('emailContacto').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('telefono').optional().isString().trim().isLength({ max: 25 }),
  body('direccion').optional().isString().trim().isLength({ max: 180 }),
  body('ciudad').optional().isString().trim().isLength({ max: 100 }),
];
const validarActualizacionOrganizacion = [
  ...validarIdOrganizacion,
  body('nombre').optional().isString().trim().isLength({ min: 2, max: 140 }),
  body('codigo').optional().isString().trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_-]+$/),
  body('descripcion').optional().isString().trim().isLength({ max: 1000 }),
  body('emailContacto').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('telefono').optional().isString().trim().isLength({ max: 25 }),
  body('direccion').optional().isString().trim().isLength({ max: 180 }),
  body('ciudad').optional().isString().trim().isLength({ max: 100 }),
  body('estado').optional().isIn(['activa', 'inactiva']),
];
const validarMembresia = [
  ...validarIdOrganizacion,
  body('usuarioId').isMongoId(),
  body('role').isIn(['administrador', 'tutor', 'estudiante']),
];
const validarActualizacionMembresia = [
  param('id').isMongoId(),
  param('membershipId').isMongoId(),
  body('role').optional().isIn(['administrador', 'tutor', 'estudiante']),
  body('estado').optional().isIn(['activo', 'inactivo']),
];
const validarFiltroOrganizaciones = [
  query('estado').optional().isIn(['activa', 'inactiva']),
  query('organizationId').optional().isMongoId().withMessage('Identificador de organización inválido.'),
];
module.exports = {
  validarIdOrganizacion, validarNuevaOrganizacion, validarActualizacionOrganizacion,
  validarMembresia, validarActualizacionMembresia, validarFiltroOrganizaciones,
};
