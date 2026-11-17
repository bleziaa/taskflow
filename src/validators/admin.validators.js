const { body, param } = require('express-validator');
const RULES = require('../../shared/field-rules');

const validarId = param('id').isMongoId().withMessage('El identificador no es válido.');

const validarTelefonoOpcional = (field, max) => body(field)
  .optional({ checkFalsy: true })
  .isString().trim().isLength({ max })
  .bail().custom(RULES.isValidPhone)
  .withMessage('El teléfono debe contener entre 7 y 15 dígitos y usar solo números, +, espacios, paréntesis o guiones.');

const validarEstudiante = [
  body('codigo').isString().trim().notEmpty().withMessage('El código es obligatorio.')
    .isLength({ min: 1, max: RULES.studentCodeMax }).withMessage('El código debe tener entre 1 y 30 caracteres.')
    .matches(new RegExp(RULES.studentCodePattern)).withMessage('El código solo puede contener letras, números, punto, guion y guion bajo.'),
  body('nombre').isString().trim().isLength({ min: RULES.studentNameMin, max: RULES.studentNameMax })
    .withMessage('El nombre debe tener entre 2 y 120 caracteres.'),
  body('email').isEmail().isLength({ max: RULES.studentEmailMax }).normalizeEmail()
    .withMessage('Escribe un correo válido de máximo 254 caracteres.'),
  validarTelefonoOpcional('telefono', RULES.studentPhoneMax),
  body('programa').isString().trim().isLength({ min: RULES.studentProgramMin, max: RULES.studentProgramMax })
    .withMessage('El programa debe tener entre 2 y 120 caracteres.'),
  body('semestre').isInt({ min: RULES.semesterMin, max: RULES.semesterMax })
    .withMessage('El semestre debe estar entre 1 y 12.'),
  body('estado').optional().isIn(['activo', 'inactivo']),
  body('empresa').optional({ nullable: true, checkFalsy: true }).isMongoId(),
  body('tutor').optional({ nullable: true, checkFalsy: true }).isMongoId(),
];

const validarEstudianteParcial = [
  body('codigo').optional().isString().trim().notEmpty()
    .isLength({ min: 1, max: RULES.studentCodeMax })
    .matches(new RegExp(RULES.studentCodePattern))
    .withMessage('El código solo puede contener letras, números, punto, guion y guion bajo.'),
  body('nombre').optional().isString().trim().isLength({ min: RULES.studentNameMin, max: RULES.studentNameMax })
    .withMessage('El nombre debe tener entre 2 y 120 caracteres.'),
  body('email').optional().isEmail().isLength({ max: RULES.studentEmailMax }).normalizeEmail()
    .withMessage('Escribe un correo válido de máximo 254 caracteres.'),
  validarTelefonoOpcional('telefono', RULES.studentPhoneMax),
  body('programa').optional().isString().trim().isLength({ min: RULES.studentProgramMin, max: RULES.studentProgramMax })
    .withMessage('El programa debe tener entre 2 y 120 caracteres.'),
  body('semestre').optional().isInt({ min: RULES.semesterMin, max: RULES.semesterMax })
    .withMessage('El semestre debe estar entre 1 y 12.'),
  body('estado').optional().isIn(['activo', 'inactivo']),
  body('empresa').optional({ nullable: true, checkFalsy: true }).isMongoId(),
  body('tutor').optional({ nullable: true, checkFalsy: true }).isMongoId(),
];

const validarEmpresa = [
  body('razonSocial').isString().trim().isLength({ min: RULES.companyNameMin, max: RULES.companyNameMax })
    .withMessage('La razón social debe tener entre 2 y 140 caracteres.'),
  body('nit').isString().trim().isLength({ min: 1, max: RULES.companyNitMax })
    .withMessage('El NIT debe tener entre 1 y 30 caracteres.'),
  body('sector').optional().isString().trim().isLength({ max: RULES.companySectorMax }),
  body('direccion').optional().isString().trim().isLength({ max: RULES.companyAddressMax }),
  body('ciudad').isString().trim().isLength({ min: RULES.companyCityMin, max: RULES.companyCityMax })
    .withMessage('La ciudad debe tener entre 2 y 100 caracteres.'),
  body('contactoNombre').optional().isString().trim().isLength({ max: RULES.companyContactNameMax }),
  body('contactoEmail').optional({ checkFalsy: true }).isEmail().isLength({ max: RULES.companyContactEmailMax })
    .normalizeEmail().withMessage('El correo de contacto debe ser válido y no superar 254 caracteres.'),
  validarTelefonoOpcional('telefono', RULES.companyPhoneMax),
  body('estado').optional().isIn(['activa', 'inactiva']),
];

const validarEmpresaParcial = [
  body('razonSocial').optional().isString().trim().isLength({ min: RULES.companyNameMin, max: RULES.companyNameMax })
    .withMessage('La razón social debe tener entre 2 y 140 caracteres.'),
  body('nit').optional().isString().trim().isLength({ min: 1, max: RULES.companyNitMax })
    .withMessage('El NIT debe tener entre 1 y 30 caracteres.'),
  body('sector').optional().isString().trim().isLength({ max: RULES.companySectorMax }),
  body('direccion').optional().isString().trim().isLength({ max: RULES.companyAddressMax }),
  body('ciudad').optional().isString().trim().isLength({ min: RULES.companyCityMin, max: RULES.companyCityMax }),
  body('contactoNombre').optional().isString().trim().isLength({ max: RULES.companyContactNameMax }),
  body('contactoEmail').optional({ checkFalsy: true }).isEmail().isLength({ max: RULES.companyContactEmailMax })
    .normalizeEmail().withMessage('Escribe un correo de contacto válido de máximo 254 caracteres.'),
  validarTelefonoOpcional('telefono', RULES.companyPhoneMax),
  body('estado').optional().isIn(['activa', 'inactiva']),
];

module.exports = { validarId, validarEstudiante, validarEstudianteParcial, validarEmpresa, validarEmpresaParcial };
