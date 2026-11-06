const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const Organization = require('../models/Organization');
const Membership = require('../models/OrganizationMembership');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const CAMPOS = ['nombre', 'codigo', 'descripcion', 'emailContacto', 'telefono', 'direccion', 'ciudad', 'estado'];
function extraerPayload(body, parcial = false) {
  const data = {};
  for (const campo of CAMPOS) {
    if (Object.prototype.hasOwnProperty.call(body, campo)) data[campo] = body[campo];
  }
  if (data.codigo) data.codigo = data.codigo.trim().toUpperCase();
  if (!parcial) {
    data.nombre = String(data.nombre || '').trim();
    data.codigo = String(data.codigo || '').trim().toUpperCase();
  }
  return data;
}
function validarObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Identificador inválido.', { code: 'INVALID_ID' });
}

const listarOrganizaciones = asyncHandler(async (req, res) => {
  const filtro = {};
  if (req.query.estado) filtro.estado = req.query.estado;
  if (req.query.q) {
    const q = String(req.query.q).trim().slice(0, 80);
    filtro.$or = [
      { nombre: { $regex: q, $options: 'i' } },
      { codigo: { $regex: q, $options: 'i' } },
      { ciudad: { $regex: q, $options: 'i' } },
    ];
  }
  const organizaciones = await Organization.find(filtro).sort({ nombre: 1 }).limit(200).lean();
  const ids = organizaciones.map((item) => item._id);
  const conteos = await Membership.aggregate([
    { $match: { organizacion: { $in: ids }, estado: 'activo' } },
    { $group: { _id: '$organizacion', usuarios: { $sum: 1 }, administradores: { $sum: { $cond: [{ $eq: ['$role', 'administrador'] }, 1, 0] } } } },
  ]);
  const porId = new Map(conteos.map((item) => [String(item._id), item]));
  res.json({ ok: true, data: { organizaciones: organizaciones.map((item) => ({
    ...item, usuariosVinculados: porId.get(String(item._id))?.usuarios || 0,
    administradoresAsignados: porId.get(String(item._id))?.administradores || 0,
  })) } });
});

const listarUsuariosDisponibles = asyncHandler(async (req, res) => {
  const filtro = { activo: { $ne: false }, role: { $in: ['tutor', 'estudiante'] } };
  if (req.query.organizationId) {
    validarObjectId(req.query.organizationId);
    const organizacion = await Organization.findById(req.query.organizationId).select('_id').lean();
    if (!organizacion) throw new ApiError(404, 'No se encontró la organización.', { code: 'ORGANIZATION_NOT_FOUND' });
    const yaVinculados = await Membership.distinct('usuario', { organizacion: organizacion._id });
    if (yaVinculados.length) filtro._id = { $nin: yaVinculados };
  }
  if (req.query.q) { const q = String(req.query.q).trim().slice(0, 80); filtro.$or = [{ nombre: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }]; }
  const usuarios = await User.find(filtro).select('nombre email role activo').sort({ nombre: 1 }).limit(100).lean();
  res.json({ ok: true, data: { usuarios } });
});

const crearOrganizacion = asyncHandler(async (req, res) => {
  const organizacion = await Organization.create({ ...extraerPayload(req.body), creadoPor: req.session.userId });
  res.status(201).json({ ok: true, data: { organizacion } });
});

const obtenerOrganizacion = asyncHandler(async (req, res) => {
  validarObjectId(req.params.id);
  const organizacion = await Organization.findById(req.params.id);
  if (!organizacion) throw new ApiError(404, 'No se encontró la organización.', { code: 'ORGANIZATION_NOT_FOUND' });
  const [usuariosVinculados, administradoresAsignados, miembros] = await Promise.all([
    Membership.countDocuments({ organizacion: organizacion._id, estado: 'activo' }),
    Membership.countDocuments({ organizacion: organizacion._id, estado: 'activo', role: 'administrador' }),
    Membership.find({ organizacion: organizacion._id }).populate('usuario', 'nombre email role activo').sort({ role: 1, createdAt: 1 }).lean(),
  ]);
  res.json({ ok: true, data: { organizacion, resumen: { usuariosVinculados, administradoresAsignados }, miembros } });
});

const actualizarOrganizacion = asyncHandler(async (req, res) => {
  validarObjectId(req.params.id);
  const organizacion = await Organization.findByIdAndUpdate(req.params.id, extraerPayload(req.body, true), { returnDocument: 'after', runValidators: true });
  if (!organizacion) throw new ApiError(404, 'No se encontró la organización.', { code: 'ORGANIZATION_NOT_FOUND' });
  res.json({ ok: true, data: { organizacion } });
});

const asignarMiembro = asyncHandler(async (req, res) => {
  validarObjectId(req.params.id);
  const organizacion = await Organization.findById(req.params.id);
  if (!organizacion) throw new ApiError(404, 'No se encontró la organización.', { code: 'ORGANIZATION_NOT_FOUND' });
  if (organizacion.estado !== 'activa') throw new ApiError(409, 'No se pueden asignar usuarios a una organización inactiva.', { code: 'ORGANIZATION_INACTIVE' });
  const usuario = await User.findById(req.body.usuarioId);
  if (!usuario || usuario.activo === false) throw new ApiError(404, 'No se encontró una cuenta activa para asignar.', { code: 'ACTIVE_USER_NOT_FOUND' });
  const existente = await Membership.findOne({ organizacion: organizacion._id, usuario: usuario._id });
  if (existente) throw new ApiError(409, 'La cuenta ya pertenece a esta organización.', { code: 'MEMBERSHIP_EXISTS' });
  const membresia = await Membership.create({
    organizacion: organizacion._id, usuario: usuario._id, role: req.body.role,
    asignadoPor: req.session.userId,
  });
  await membresia.populate('usuario', 'nombre email role activo');
  res.status(201).json({ ok: true, data: { membresia } });
});

async function ejecutarCambioMembresiaProtegido(organizationId, membershipId, cambio) {
  const owner = randomUUID();
  // Bloqueo atómico en el documento de organización: compatible con MongoDB
  // standalone. Se mantiene hasta finalizar y se libera solo por su propietario.
  const lock = await Organization.findOneAndUpdate(
    { _id: organizationId, adminGuardLockOwner: { $exists: false } },
    { $set: { adminGuardLockOwner: owner, adminGuardLockAt: new Date(), adminGuardLockProcessId: process.pid, adminGuardLockHost: require('node:os').hostname() } },
    { returnDocument: 'after', projection: { _id: 1 } },
  ).lean();

  if (!lock) {
    const organizationExists = await Organization.exists({ _id: organizationId });
    if (!organizationExists) throw new ApiError(404, 'No se encontró la organización.', { code: 'ORGANIZATION_NOT_FOUND' });
    throw new ApiError(409, 'Otra operación está modificando las membresías de esta organización. Intenta nuevamente en unos segundos.', { code: 'ADMIN_GUARD_BUSY' });
  }

  try {
    const membresia = await Membership.findOne({ _id: membershipId, organizacion: organizationId });
    if (!membresia) throw new ApiError(404, 'No se encontró la asignación.', { code: 'MEMBERSHIP_NOT_FOUND' });

    const roleNuevo = cambio.eliminar ? null : (cambio.role ?? membresia.role);
    const estadoNuevo = cambio.eliminar ? null : (cambio.estado ?? membresia.estado);
    const dejaDeSerAdminActivo = membresia.role === 'administrador' && membresia.estado === 'activo'
      && (roleNuevo !== 'administrador' || estadoNuevo !== 'activo');

    if (dejaDeSerAdminActivo) {
      const administradoresActivos = await Membership.countDocuments({
        organizacion: organizationId, role: 'administrador', estado: 'activo',
      });
      if (administradoresActivos <= 1) {
        throw new ApiError(409, 'No puedes retirar, desactivar o cambiar el rol del último administrador activo de la organización. Asigna primero otro administrador.', { code: 'LAST_ORGANIZATION_ADMIN' });
      }
    }

    if (cambio.eliminar) {
      await Membership.deleteOne({ _id: membresia._id, organizacion: organizationId });
      return { eliminada: true };
    }
    if (cambio.role !== undefined) membresia.role = cambio.role;
    if (cambio.estado !== undefined) membresia.estado = cambio.estado;
    await membresia.save();
    return { membresiaId: membresia._id };
  } finally {
    // Si la aplicación se interrumpe antes de este punto, el bloqueo queda
    // retenido (fail-closed) y requiere revisión operativa explícita.
    await Organization.updateOne(
      { _id: organizationId, adminGuardLockOwner: owner },
      { $unset: { adminGuardLockOwner: 1, adminGuardLockAt: 1, adminGuardLockProcessId: 1, adminGuardLockHost: 1 } },
    );
  }
}

const actualizarMiembro = asyncHandler(async (req, res) => {
  validarObjectId(req.params.id); validarObjectId(req.params.membershipId);
  const resultado = await ejecutarCambioMembresiaProtegido(req.params.id, req.params.membershipId, req.body);
  const membresia = await Membership.findById(resultado.membresiaId).populate('usuario', 'nombre email role activo');
  res.json({ ok: true, data: { membresia } });
});

const retirarMiembro = asyncHandler(async (req, res) => {
  validarObjectId(req.params.id); validarObjectId(req.params.membershipId);
  await ejecutarCambioMembresiaProtegido(req.params.id, req.params.membershipId, { eliminar: true });
  res.json({ ok: true, data: { mensaje: 'Usuario retirado de la organización.' } });
});

module.exports = {
  listarOrganizaciones, listarUsuariosDisponibles, crearOrganizacion, obtenerOrganizacion, actualizarOrganizacion,
  asignarMiembro, actualizarMiembro, retirarMiembro,
};
