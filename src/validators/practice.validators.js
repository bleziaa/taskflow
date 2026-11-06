const { body, param } = require('express-validator');

const estados = ['planificada', 'en_curso', 'finalizada', 'suspendida'];
const validarIdPractica = param('id').isMongoId().withMessage('El identificador de la práctica no es válido.');

const validarNuevaPractica = [
  body('estudiante').isMongoId().withMessage('Selecciona un estudiante válido.'),
  body('empresa').isMongoId().withMessage('Selecciona una empresa válida.'),
  body('tutor').isMongoId().withMessage('Selecciona un tutor válido.'),
  body('titulo').isString().trim().isLength({ min: 3, max: 120 }).withMessage('El título debe tener entre 3 y 120 caracteres.'),
  body('objetivo').optional().isString().isLength({ max: 2000 }),
  body('fechaInicio').isISO8601().withMessage('Indica una fecha de inicio válida.'),
  body('fechaFin').isISO8601().withMessage('Indica una fecha de finalización válida.'),
  body('estado').optional().isIn(estados),
  body('observaciones').optional().isString().isLength({ max: 2000 }),
];

const validarActualizacionPractica = [
  body('estudiante').optional().isMongoId(),
  body('empresa').optional().isMongoId(),
  body('tutor').optional().isMongoId(),
  body('titulo').optional().isString().trim().isLength({ min: 3, max: 120 }),
  body('objetivo').optional().isString().isLength({ max: 2000 }),
  body('fechaInicio').optional().isISO8601(),
  body('fechaFin').optional().isISO8601(),
  body('estado').optional().isIn(estados),
  body('observaciones').optional().isString().isLength({ max: 2000 }),
];

module.exports = { validarIdPractica, validarNuevaPractica, validarActualizacionPractica };
