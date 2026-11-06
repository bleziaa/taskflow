const mongoose = require('mongoose');
const Branding = require('../models/Branding');
const Organization = require('../models/Organization');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const FIELDS = ['displayName', 'welcomeMessage', 'logoUrl', 'logoAlt', 'secondaryColor', 'accentColor', 'loginBackgroundUrl'];
const PLATFORM_FIELDS = [...FIELDS, 'primaryColor'];
const DEFAULTS = {
  displayName: 'TaskFlow', welcomeMessage: 'Organiza y acompaña tus prácticas.',
  logoUrl: '', logoAlt: 'Logotipo de TaskFlow', primaryColor: '#6d4bd1',
  secondaryColor: '#8b75dc', accentColor: '#26a69a', loginBackgroundUrl: ''
};
function cleanUrl(value, field) {
  if (!value) return '';
  let parsed;
  try { parsed = new URL(value); } catch (_) { throw new ApiError(400, field + ' debe ser una URL válida.', { code: 'BRANDING_INVALID_URL' }); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new ApiError(400, field + ' solo admite HTTP o HTTPS.', { code: 'BRANDING_INVALID_URL' });
  return parsed.toString();
}
function cleanPayload(body, scope) {
  const data = {};
  const allowed = scope === 'platform' ? PLATFORM_FIELDS : FIELDS;
  for (const field of allowed) if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = body[field];
  for (const field of ['displayName', 'welcomeMessage', 'logoUrl', 'logoAlt', 'secondaryColor', 'accentColor', 'loginBackgroundUrl']) {
    if (data[field] !== undefined && typeof data[field] !== 'string') throw new ApiError(400, 'El campo ' + field + ' debe ser texto.', { code: 'BRANDING_INVALID_FIELD' });
    if (typeof data[field] === 'string') data[field] = data[field].trim();
  }
  for (const field of ['primaryColor', 'secondaryColor', 'accentColor']) {
    if (data[field] !== undefined && !/^#[0-9a-fA-F]{6}$/.test(data[field])) throw new ApiError(400, 'El color ' + field + ' debe usar formato hexadecimal #RRGGBB.', { code: 'BRANDING_INVALID_COLOR' });
  }
  for (const field of ['logoUrl', 'loginBackgroundUrl']) if (data[field] !== undefined) data[field] = cleanUrl(data[field], field);
  return data;
}
async function get(scope, organization = null, fallbackName = '') {
  const saved = await Branding.findOne({ scope, organization }).lean();
  return { ...DEFAULTS, ...(saved || {}), ...(saved ? {} : (fallbackName ? { displayName: fallbackName } : {})), scope, organization: organization ? String(organization) : null };
}
const obtenerGlobal = asyncHandler(async (_req, res) => res.json({ ok: true, data: { branding: await get('platform') } }));
const guardarGlobal = asyncHandler(async (req, res) => {
  const branding = await Branding.findOneAndUpdate({ scope: 'platform', organization: null },
    { $set: { ...cleanPayload(req.body, 'platform'), updatedBy: req.session.userId }, $setOnInsert: { scope: 'platform', organization: null } },
    { upsert: true, returnDocument: 'after', runValidators: true });
  res.json({ ok: true, data: { branding } });
});
const obtenerOrganizacion = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Identificador inválido.', { code: 'INVALID_ID' });
  const org = await Organization.findById(req.params.id).select('_id nombre estado').lean();
  if (!org) throw new ApiError(404, 'No se encontró la organización.', { code: 'ORGANIZATION_NOT_FOUND' });
  res.json({ ok: true, data: { organizacion: org, branding: await get('organization', org._id, org.nombre) } });
});
const guardarOrganizacion = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Identificador inválido.', { code: 'INVALID_ID' });
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, 'No se encontró la organización.', { code: 'ORGANIZATION_NOT_FOUND' });
  const branding = await Branding.findOneAndUpdate({ scope: 'organization', organization: org._id },
    { $set: { ...cleanPayload(req.body, 'organization'), updatedBy: req.session.userId }, $setOnInsert: { scope: 'organization', organization: org._id } },
    { upsert: true, returnDocument: 'after', runValidators: true });
  res.json({ ok: true, data: { organizacion: { _id: org._id, nombre: org.nombre }, branding } });
});
module.exports = { obtenerGlobal, guardarGlobal, obtenerOrganizacion, guardarOrganizacion };
