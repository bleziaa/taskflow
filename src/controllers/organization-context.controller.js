const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const Membership = require('../models/OrganizationMembership');
const User = require('../models/User');
const Branding = require('../models/Branding');
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

const obtenerIdentidadOrganizacionActiva = asyncHandler(async (req, res) => {
  const organizationId = req.session.activeOrganizationId;
  if (!organizationId) return res.json({ ok: true, data: { branding: null } });
  const org = await Organization.findById(organizationId).select('_id nombre codigo estado').lean();
  if (!org || org.estado !== 'activa') return res.json({ ok: true, data: { branding: null } });
  const saved = await Branding.findOne({ scope: 'organization', organization: org._id }).lean();
  const normalized = org.nombre.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
  const preset = normalized.includes('universidad nacional')
    ? { primaryColor: '#009638', secondaryColor: '#006b2c', accentColor: '#f3ae00' }
    : normalized.includes('universidad de cartagena')
      ? { primaryColor: '#027f3e', secondaryColor: '#015b2d', accentColor: '#f7f028' }
      : {};
  const branding = {
    displayName: org.nombre,
    logoUrl: saved?.logoUrl || (normalized.includes('universidad de cartagena') ? '/media/branding/unicartagena.png' : ''),
    primaryColor: preset.primaryColor || '#6d4bd1',
    secondaryColor: preset.secondaryColor || '#8b75dc',
    accentColor: preset.accentColor || '#26a69a',
    ...(saved || {}),
    ...(preset.primaryColor && (!saved?.primaryColor || saved.primaryColor === '#6d4bd1') ? { primaryColor: preset.primaryColor } : {}),
    ...(preset.secondaryColor && (!saved?.secondaryColor || saved.secondaryColor === '#8b75dc') ? { secondaryColor: preset.secondaryColor } : {}),
    ...(preset.accentColor && (!saved?.accentColor || saved.accentColor === '#26a69a') ? { accentColor: preset.accentColor } : {}),
    organization: String(org._id),
  };
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, data: { organizacion: org, branding } });
});

module.exports = { listarOrganizacionesDelUsuario, listarTutoresDeOrganizacion, seleccionarOrganizacionActiva, limpiarOrganizacionActiva, obtenerIdentidadOrganizacionActiva };
