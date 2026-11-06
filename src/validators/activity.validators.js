const { body, param, query } = require('express-validator');
const estados = ['pendiente', 'en_revision', 'completada'];
const prioridades = ['baja', 'media', 'alta'];
const validarId = param('id').isMongoId().withMessage('El identificador de la actividad no es válido.');
const validarNueva = [
  body('practica').isMongoId().withMessage('Selecciona una práctica válida.'),
  body('titulo').isString().trim().isLength({ min: 3, max: 120 }).withMessage('El título debe tener entre 3 y 120 caracteres.'),
  body('descripcion').optional().isString().isLength({ max: 3000 }),
  body('moduloAcademicoId').optional({ nullable: true }).isMongoId(),
  body('fechaLimite').isISO8601().withMessage('Indica una fecha límite válida.'),
  body('prioridad').optional().isIn(prioridades),
  body('estado').optional().isIn(estados),
];
const validarActualizacion = [
  body('titulo').optional().isString().trim().isLength({ min: 3, max: 120 }),
  body('descripcion').optional().isString().isLength({ max: 3000 }),
  body('moduloAcademicoId').optional({ nullable: true }).isMongoId(),
  body('fechaLimite').optional().isISO8601(),
  body('prioridad').optional().isIn(prioridades),
  body('estado').optional().isIn(estados),
];
const validarFiltro = query('practica').optional().isMongoId();
module.exports = { validarId, validarNueva, validarActualizacion, validarFiltro };
