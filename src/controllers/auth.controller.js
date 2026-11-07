const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');

const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const { enviarEnlaceRestablecimiento } = require('../services/email.service');
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

const solicitarRestablecimientoPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'Escribe un correo electrónico válido.', { code: 'INVALID_EMAIL' });
  }

  const usuario = await User.findOne({ email, activo: { $ne: false } }).select('_id nombre email');
  if (usuario) {
    await PasswordResetToken.deleteMany({ user: usuario._id, usedAt: null });
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await PasswordResetToken.create({ user: usuario._id, tokenHash, expiresAt });
    const baseUrl = String(env.publicUrl || 'http://127.0.0.1:3000').replace(/\/$/, '');
    const resultado = await enviarEnlaceRestablecimiento({
      nombre: usuario.nombre,
      email: usuario.email,
      url: `${baseUrl}/restablecer-password.html?token=${encodeURIComponent(token)}`,
    });
    if (resultado.status !== 'sent') {
      await PasswordResetToken.deleteOne({ tokenHash });
    }
  }

  // Misma respuesta exista o no la cuenta: evita enumeración de correos.
  res.json({
    ok: true,
    data: { mensaje: 'Si existe una cuenta activa con ese correo, recibirás instrucciones para restablecer tu contraseña.' },
  });
});

const confirmarRestablecimientoPassword = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '');
  const nuevaPassword = String(req.body.newPassword || '');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    throw new ApiError(400, 'El enlace no es válido o ha vencido. Solicita uno nuevo.', { code: 'RESET_TOKEN_INVALID' });
  }
  if (nuevaPassword.length < 12 || nuevaPassword.length > 128) {
    throw new ApiError(400, 'La contraseña debe tener entre 12 y 128 caracteres.', { code: 'INVALID_PASSWORD' });
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const registro = await PasswordResetToken.findOneAndUpdate(
    { tokenHash, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!registro) {
    throw new ApiError(400, 'El enlace no es válido o ha vencido. Solicita uno nuevo.', { code: 'RESET_TOKEN_INVALID' });
  }
  const usuario = await User.findOne({ _id: registro.user, activo: { $ne: false } });
  if (!usuario) {
    throw new ApiError(400, 'El enlace no es válido o ha vencido. Solicita uno nuevo.', { code: 'RESET_TOKEN_INVALID' });
  }
  usuario.passwordHash = await bcrypt.hash(nuevaPassword, BCRYPT_ROUNDS);
  usuario.debeCambiarPassword = false;
  await usuario.save();
  await PasswordResetToken.deleteMany({ user: usuario._id });
  res.json({ ok: true, data: { mensaje: 'Tu contraseña se actualizó. Ya puedes iniciar sesión.' } });
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
  solicitarRestablecimientoPassword,
  confirmarRestablecimientoPassword,
  cerrarSesion,
};
