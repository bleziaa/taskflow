const { body, param } = require('express-validator');
const validarActividadId = param('actividadId').isMongoId().withMessage('La actividad no es válida.');
const validarId = param('id').isMongoId().withMessage('La evidencia no es válida.');
const validarRevision = [
  body('estado').isIn(['aprobada', 'requiere_cambios']).withMessage('Selecciona aprobar o solicitar correcciones.'),
  body('observacion').optional().isString().trim().isLength({ max: 2000 }),
];
module.exports = { validarActividadId, validarId, validarRevision };
