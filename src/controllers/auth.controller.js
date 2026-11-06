const bcrypt = require('bcryptjs');

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { env } = require('../config/env');
const { obtenerTokenCsrf } = require('../middleware/csrf');
const { regenerarSesion, guardarSesion, destruirSesion } = require('../utils/session');

const BCRYPT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH =
  '$2b$12$vd4dwbpSrl5rvKURiBAJsecGxP32dUDNkw.ImdMCRCCUqtsA0aPmW';
const MENSAJE_CREDENCIALES = 'Correo o contrasena incorrectos.';

async function iniciarSesionConUsuario(req, usuario) {
  const tokenCsrf = req.session.csrfToken;

  await regenerarSesion(req);
  req.session.userId = usuario.id;
  req.session.csrfToken = tokenCsrf || obtenerTokenCsrf(req);
  await guardarSesion(req);
}

function limpiarCookieSesion(res) {
  res.clearCookie(env.sessionName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
  });
}

const obtenerCsrfToken = (req, res) => {
  res.json({
    ok: true,
    data: {
      csrfToken: obtenerTokenCsrf(req),
    },
  });
};

const registrar = asyncHandler(async (req, res) => {
  const { nombre, email, password } = req.body;

  const existente = await User.exists({ email });
  if (existente) {
    throw new ApiError(409, 'Ya existe una cuenta con ese correo electronico.', {
      code: 'EMAIL_IN_USE',
    });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let usuario;
  try {
    usuario = await User.create({ nombre, email, passwordHash });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'Ya existe una cuenta con ese correo electronico.', {
        code: 'EMAIL_IN_USE',
      });
    }
    throw error;
  }

  await iniciarSesionConUsuario(req, usuario);

  res.status(201).json({
    ok: true,
    data: {
      usuario: usuario.toJSON(),
    },
  });
});

const iniciarSesion = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const usuario = await User.findOne({ email });
  const hash = usuario ? usuario.passwordHash : DUMMY_PASSWORD_HASH;
  const coincide = await bcrypt.compare(password, hash);

  if (!usuario || !coincide || usuario.activo === false) {
    throw new ApiError(401, MENSAJE_CREDENCIALES, {
      code: 'INVALID_CREDENTIALS',
    });
  }

  await iniciarSesionConUsuario(req, usuario);

  res.json({
    ok: true,
    data: {
      usuario: usuario.toJSON(),
    },
  });
});

const obtenerSesion = asyncHandler(async (req, res) => {
  const usuario = await User.findById(req.session.userId);

  if (!usuario || usuario.activo === false) {
    await destruirSesion(req);
    limpiarCookieSesion(res);
    throw new ApiError(401, usuario ? 'La cuenta está desactivada.' : 'La sesion ya no es valida.', {
      code: usuario ? 'ACCOUNT_DISABLED' : 'UNAUTHORIZED',
    });
  }

  res.json({
    ok: true,
    data: {
      usuario: usuario.toJSON(),
    },
  });
});

const cambiarPassword = asyncHandler(async (req, res) => {
  const nuevaPassword = String(req.body.newPassword || '');
  if (nuevaPassword.length < 12 || nuevaPassword.length > 128) {
    throw new ApiError(400, 'La nueva contraseña debe tener entre 12 y 128 caracteres.', { code: 'INVALID_PASSWORD' });
  }
  const usuario = await User.findById(req.session.userId);
  if (!usuario || usuario.activo === false) throw new ApiError(401, 'La sesión ya no es válida.', { code: 'UNAUTHORIZED' });
  usuario.passwordHash = await bcrypt.hash(nuevaPassword, BCRYPT_ROUNDS);
  usuario.debeCambiarPassword = false;
  await usuario.save();
  res.json({ ok: true, data: { mensaje: 'Contraseña actualizada correctamente.', usuario: usuario.toJSON() } });
});

const cerrarSesion = asyncHandler(async (req, res) => {
  await destruirSesion(req);
  limpiarCookieSesion(res);

  res.json({
    ok: true,
    data: {
      mensaje: 'Sesion cerrada correctamente.',
    },
  });
});

module.exports = {
  obtenerCsrfToken,
  registrar,
  iniciarSesion,
  obtenerSesion,
  cambiarPassword,
  cerrarSesion,
};
