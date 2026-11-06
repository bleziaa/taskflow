const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const Membership = require('../models/OrganizationMembership');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const listarOrganizacionesDelUsuario = asyncHandler(async (req, res) => {
  const memberships = await Membership.find({ usuario: req.session.userId, estado: 'activo' })
    .populate({ path: 'organizacion', match: { estado: 'activa' }, select: 'nombre codigo ciudad estado' })
    .sort({ createdAt: 1 }).lean();
  const organizaciones = memberships.filter((m) => m.organizacion).map((m) => ({
    id: String(m.organizacion._id),
    nombre: m.organizacion.nombre,
    codigo: m.organizacion.codigo,
    ciudad: m.organizacion.ciudad,
    role: m.role,
  }));
  const activeId = req.session.activeOrganizationId ? String(req.session.activeOrganizationId) : null;
  res.json({ ok: true, data: { organizaciones, organizacionActiva: organizaciones.find((o) => o.id === activeId) || null } });
});


const listarTutoresDeOrganizacion = asyncHandler(async (req, res) => {
  const memberships = await Membership.find({ organizacion: req.organization._id, role: 'tutor', estado: 'activo' })
    .select('usuario').lean();
  const ids = memberships.map((item) => item.usuario);
  const usuarios = await User.find({ _id: { $in: ids }, activo: { $ne: false } })
    .select('nombre email activo').sort({ nombre: 1 }).lean();
  res.json({ ok: true, data: { usuarios } });
});

const seleccionarOrganizacionActiva = asyncHandler(async (req, res) => {
  const { organizationId } = req.body || {};
  if (!mongoose.isValidObjectId(organizationId)) {
    throw new ApiError(400, 'Debes indicar una organización válida.', { code: 'INVALID_ORGANIZATION_ID' });
  }
  const membership = await Membership.findOne({
    usuario: req.session.userId, organizacion: organizationId, estado: 'activo',
  }).populate({ path: 'organizacion', match: { estado: 'activa' }, select: 'nombre codigo ciudad estado' });
  if (!membership || !membership.organizacion) {
    throw new ApiError(403, 'No tienes una membresía activa en esa organización.', { code: 'ORGANIZATION_ACCESS_DENIED' });
  }
  req.session.activeOrganizationId = String(membership.organizacion._id);
  await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
  res.json({ ok: true, data: {
    organizacionActiva: {
      id: String(membership.organizacion._id), nombre: membership.organizacion.nombre,
      codigo: membership.organizacion.codigo, ciudad: membership.organizacion.ciudad, role: membership.role,
    },
  } });
});

const limpiarOrganizacionActiva = asyncHandler(async (req, res) => {
  delete req.session.activeOrganizationId;
  await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
  res.json({ ok: true, data: { organizacionActiva: null } });
});

module.exports = { listarOrganizacionesDelUsuario, listarTutoresDeOrganizacion, seleccionarOrganizacionActiva, limpiarOrganizacionActiva };
