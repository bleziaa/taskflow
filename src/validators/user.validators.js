const { body } = require('express-validator');

const validarNuevoUsuario = [
  body('nombre').isString().trim().isLength({ min: 2, max: 80 }).withMessage('El nombre debe tener entre 2 y 80 caracteres.'),
  body('email').isEmail().normalizeEmail().withMessage('Escribe un correo válido.'),
  body('role').isIn(['tutor', 'estudiante']).withMessage('El tipo de cuenta debe ser docente/tutor o estudiante.'),
  body('organizationId').isMongoId().withMessage('Selecciona una institución válida.'),
  body('membershipRole').isIn(['administrador', 'tutor', 'estudiante']).withMessage('Selecciona un rol institucional válido.'),
];

const validarActualizacionUsuario = [
  body('nombre').optional().isString().trim().isLength({ min: 2, max: 80 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional({ checkFalsy: true }).isString().isLength({ min: 12, max: 128 }),
  body('activo').optional().isBoolean().toBoolean(),
];

module.exports = { validarNuevoUsuario, validarActualizacionUsuario };
