const { body } = require('express-validator');

const emailValidator = body('email')
  .exists({ checkFalsy: true })
  .withMessage('El correo electronico es obligatorio.')
  .bail()
  .isString()
  .withMessage('El correo electronico no es valido.')
  .bail()
  .trim()
  .isLength({ max: 254 })
  .withMessage('El correo electronico es demasiado largo.')
  .bail()
  .isEmail()
  .withMessage('Escribe un correo electronico valido.')
  .customSanitizer((valor) => String(valor).trim().toLowerCase());

const passwordValidator = body('password')
  .exists({ checkFalsy: true })
  .withMessage('La contrasena es obligatoria.')
  .bail()
  .isString()
  .withMessage('La contrasena no es valida.')
  .bail()
  .isLength({ min: 8, max: 72 })
  .withMessage('La contrasena debe tener entre 8 y 72 caracteres.');

const validarRegistro = [
  body('nombre')
    .exists({ checkFalsy: true })
    .withMessage('El nombre es obligatorio.')
    .bail()
    .isString()
    .withMessage('El nombre no es valido.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('El nombre debe tener entre 2 y 80 caracteres.'),
  emailValidator,
  passwordValidator,
];

const validarLogin = [emailValidator, passwordValidator];

module.exports = { validarRegistro, validarLogin };
