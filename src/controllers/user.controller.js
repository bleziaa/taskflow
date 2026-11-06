const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const User = require('../models/User');
const Student = require('../models/Student');
const Membership = require('../models/OrganizationMembership');
const Organization = require('../models/Organization');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { enviarCredenciales } = require('../services/email.service');

const listarUsuarios = asyncHandler(async (req, res) => {
  const filtro = { role: { $in: ['tutor', 'estudiante'] } };
  if (['tutor', 'estudiante'].includes(req.query.role)) filtro.role = req.query.role;
  if (req.query.q) {
    const q = String(req.query.q).trim().slice(0, 80);
    filtro.$or = [{ nombre: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }];
  }
  const usuarios = await User.find(filtro).select('nombre email role activo createdAt updatedAt').sort({ role: 1, nombre: 1 }).limit(300).lean();
  const membresias = await Membership.find({ usuario: { $in: usuarios.map((u) => u._id) } }).populate('organizacion', 'nombre codigo').lean();
  const porUsuario = new Map();
  for (const m of membresias) {
    const key = String(m.usuario);
    if (!porUsuario.has(key)) porUsuario.set(key, []);
    if (m.organizacion) porUsuario.get(key).push({ nombre: m.organizacion.nombre, codigo: m.organizacion.codigo, role: m.role, estado: m.estado });
  }
  res.json({ ok: true, data: { usuarios: usuarios.map((u) => ({ ...u, organizaciones: porUsuario.get(String(u._id)) || [] })) } });
});

const crearUsuario = asyncHandler(async (req, res) => {
  const { nombre, email, role, organizationId, membershipRole } = req.body;
  if (!['tutor', 'estudiante'].includes(role)) throw new ApiError(400, 'El tipo de cuenta debe ser docente/tutor o estudiante.', { code: 'INVALID_ROLE' });
  if (!['administrador', 'tutor', 'estudiante'].includes(membershipRole)) throw new ApiError(400, 'Selecciona un rol institucional válido.', { code: 'INVALID_MEMBERSHIP_ROLE' });
  if (role === 'estudiante' && membershipRole !== 'estudiante') throw new ApiError(400, 'Una cuenta de estudiante debe tener el rol institucional de estudiante.', { code: 'INVALID_MEMBERSHIP_ROLE' });
  const organizacion = await Organization.findOne({ _id: organizationId, estado: 'activa' });
  if (!organizacion) throw new ApiError(404, 'Selecciona una institución activa.', { code: 'ORGANIZATION_NOT_FOUND' });
  const correo = email.trim().toLowerCase();
  if (await User.exists({ email: correo })) throw new ApiError(409, 'Ya existe una cuenta con ese correo. Usa «Cuenta existente» para vincularla.', { code: 'EMAIL_IN_USE' });
  const estudiante = role === 'estudiante' ? await Student.findOne({ email: correo, organizationId: organizacion._id }) : null;
  if (estudiante?.usuario) throw new ApiError(409, 'El registro del estudiante ya tiene una cuenta vinculada.', { code: 'STUDENT_ACCOUNT_EXISTS' });
  const passwordTemporal = randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(passwordTemporal, 12);
  let usuario;
  let membresia;
  try {
    usuario = await User.create({ nombre: nombre.trim(), email: correo, passwordHash, role, activo: true, debeCambiarPassword: true });
    membresia = await Membership.create({ organizacion: organizacion._id, usuario: usuario._id, role: membershipRole, asignadoPor: req.session.userId });
    if (estudiante) { estudiante.usuario = usuario._id; await estudiante.save(); }
  } catch (error) {
    if (membresia) await Membership.deleteOne({ _id: membresia._id });
    if (usuario) await User.deleteOne({ _id: usuario._id });
    if (error.code === 11000) throw new ApiError(409, 'Ya existe una cuenta o asignación con esos datos.', { code: 'EMAIL_IN_USE' });
    throw error;
  }
  const correoResultado = await enviarCredenciales({ nombre: usuario.nombre, email: usuario.email, passwordTemporal, organizacion: organizacion.nombre });
  const data = { usuario: usuario.toJSON(), membresia: { _id: membresia._id, role: membresia.role }, organizacion: { _id: organizacion._id, nombre: organizacion.nombre, codigo: organizacion.codigo }, correo: correoResultado };
  // Solo devolver la clave al administrador cuando no se pudo entregar por correo.
  if (correoResultado.status !== 'sent') data.credenciales = { passwordTemporal };
  res.status(201).json({ ok: true, data });
});

const actualizarUsuario = asyncHandler(async (req, res) => {
  const usuario = await User.findById(req.params.id);
  if (!usuario || usuario.role === 'administrador') throw new ApiError(404, 'No se encontró la cuenta administrable.', { code: 'USER_NOT_FOUND' });
  const { nombre, email, password, activo } = req.body;
  if (nombre !== undefined) usuario.nombre = nombre.trim();
  if (email !== undefined) usuario.email = email.trim().toLowerCase();
  if (activo !== undefined) usuario.activo = activo;
  if (password) usuario.passwordHash = await bcrypt.hash(password, 12);
  await usuario.save();
  res.json({ ok: true, data: { usuario: usuario.toJSON() } });
});

const restablecerPassword = asyncHandler(async (req, res) => {
  const usuario = await User.findById(req.params.id);
  if (!usuario || usuario.role === 'administrador') throw new ApiError(404, 'No se encontró la cuenta administrable.', { code: 'USER_NOT_FOUND' });
  if (usuario.activo === false) throw new ApiError(409, 'No se puede restablecer la contraseña de una cuenta inactiva.', { code: 'ACCOUNT_DISABLED' });
  const passwordTemporal = randomBytes(24).toString('base64url');
  usuario.passwordHash = await bcrypt.hash(passwordTemporal, 12);
  usuario.debeCambiarPassword = true;
  await usuario.save();
  res.json({ ok: true, data: { usuario: usuario.toJSON(), credenciales: { passwordTemporal } } });
});

const eliminarUsuario = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.session.userId)) throw new ApiError(409, 'No puedes eliminar tu propia cuenta.', { code: 'CANNOT_DELETE_SELF' });
  const usuario = await User.findById(req.params.id);
  if (!usuario || usuario.role === 'administrador') throw new ApiError(404, 'No se encontró la cuenta administrable.', { code: 'USER_NOT_FOUND' });
  const [vinculados, membresias] = await Promise.all([
    Student.countDocuments({ $or: [{ tutor: usuario._id }, { usuario: usuario._id }] }),
    Membership.countDocuments({ usuario: usuario._id }),
  ]);
  if (vinculados) throw new ApiError(409, 'La cuenta está vinculada a estudiantes. Desactívala o retira primero sus vinculaciones.', { code: 'USER_HAS_STUDENTS' });
  if (membresias) throw new ApiError(409, 'La cuenta pertenece a una o más organizaciones. Retira sus membresías antes de eliminarla.', { code: 'USER_HAS_MEMBERSHIPS' });
  await usuario.deleteOne();
  res.json({ ok: true, data: { mensaje: 'Cuenta eliminada.' } });
});

module.exports = { listarUsuarios, crearUsuario, actualizarUsuario, restablecerPassword, eliminarUsuario };
