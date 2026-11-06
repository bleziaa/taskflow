const { body, param } = require('express-validator');

const validarId = param('id').isMongoId().withMessage('El identificador no es válido.');

const validarEstudiante = [
  body('codigo').isString().trim().notEmpty().withMessage('El código es obligatorio.').isLength({ max: 30 }),
  body('nombre').isString().trim().isLength({ min: 2, max: 120 }).withMessage('El nombre debe tener entre 2 y 120 caracteres.'),
  body('email').isEmail().normalizeEmail().withMessage('Escribe un correo válido.'),
  body('telefono').optional().isString().isLength({ max: 25 }),
  body('programa').isString().trim().notEmpty().isLength({ max: 120 }),
  body('semestre').isInt({ min: 1, max: 12 }).withMessage('El semestre debe estar entre 1 y 12.'),
  body('estado').optional().isIn(['activo', 'inactivo']),
  body('empresa').optional({ nullable: true, checkFalsy: true }).isMongoId(),
  body('tutor').optional({ nullable: true, checkFalsy: true }).isMongoId(),
];

const validarEmpresa = [
  body('razonSocial').isString().trim().isLength({ min: 2, max: 140 }).withMessage('La razón social es obligatoria.'),
  body('nit').isString().trim().notEmpty().isLength({ max: 30 }).withMessage('El NIT es obligatorio.'),
  body('sector').optional().isString().isLength({ max: 100 }),
  body('direccion').optional().isString().isLength({ max: 180 }),
  body('ciudad').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('La ciudad es obligatoria.'),
  body('contactoNombre').optional().isString().isLength({ max: 120 }),
  body('contactoEmail').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('telefono').optional().isString().isLength({ max: 25 }),
  body('estado').optional().isIn(['activa', 'inactiva']),
];

module.exports = { validarId, validarEstudiante, validarEmpresa };
