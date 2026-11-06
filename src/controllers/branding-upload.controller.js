const mongoose = require('mongoose');
const multer = require('multer');
const Branding = require('../models/Branding');
const Organization = require('../models/Organization');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { saveImage, removeLocal } = require('../services/branding-storage');
const MAX_BYTES = 10 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 2 },
  fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });
function parseUpload(req, res, next) {
  upload.single('image')(req, res, error => {
    if (error?.code === 'LIMIT_FILE_SIZE') return next(new ApiError(413, 'La imagen supera el límite de 10 MB.', { code: 'BRANDING_IMAGE_TOO_LARGE' }));
    if (error) return next(new ApiError(400, 'No se pudo procesar la imagen.', { code: 'BRANDING_UPLOAD_INVALID' }));
    if (!req.file) return next(new ApiError(400, 'Selecciona una imagen JPG, PNG o WEBP.', { code: 'BRANDING_IMAGE_REQUIRED' }));
    next();
  });
}
function assetMetadata(asset) {
  return { storage: asset.storage, filename: asset.filename, publicId: asset.publicId, mimeType: asset.mimeType, size: asset.size };
}
async function storeAsset(req, scope, organization) {
  const field = req.body.field;
  if (!['logoUrl', 'loginBackgroundUrl'].includes(field)) throw new ApiError(400, 'Tipo de imagen no permitido.', { code: 'BRANDING_FIELD_INVALID' });
  const asset = await saveImage(req.file);
  const metaField = field === 'logoUrl' ? 'logoAsset' : 'loginBackgroundAsset';
  const query = { scope, organization };
  const previous = await Branding.findOne(query).select(field + ' ' + metaField);
  const branding = await Branding.findOneAndUpdate(query, {
    $set: { [field]: asset.url, [metaField]: assetMetadata(asset), updatedBy: req.session.userId },
    $setOnInsert: { scope, organization },
  }, { upsert: true, returnDocument: 'after', runValidators: true });
  if (previous?.[field] && previous[metaField]?.storage === 'local') await removeLocal(previous[field]);
  return { asset, branding };
}
const uploadGlobal = asyncHandler(async (req, res) => {
  const result = await storeAsset(req, 'platform', null);
  res.status(201).json({ ok: true, data: result });
});
const uploadOrganization = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Identificador inválido.', { code: 'INVALID_ID' });
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, 'No se encontró la organización.', { code: 'ORGANIZATION_NOT_FOUND' });
  const result = await storeAsset(req, 'organization', org._id);
  res.status(201).json({ ok: true, data: result });
});
const deleteLocal = asyncHandler(async (req, res) => {
  const field = req.body.field;
  if (!['logoUrl', 'loginBackgroundUrl'].includes(field)) throw new ApiError(400, 'Tipo de imagen no permitido.', { code: 'BRANDING_FIELD_INVALID' });
  const query = req.params.id ? { scope: 'organization', organization: req.params.id } : { scope: 'platform', organization: null };
  const branding = await Branding.findOne(query);
  if (!branding) return res.json({ ok: true, data: { deleted: false } });
  const metaField = field === 'logoUrl' ? 'logoAsset' : 'loginBackgroundAsset';
  const oldUrl = branding[field], oldMeta = branding[metaField];
  branding[field] = ''; branding[metaField] = undefined; branding.updatedBy = req.session.userId;
  await branding.save();
  if (oldMeta?.storage === 'local') await removeLocal(oldUrl);
  res.json({ ok: true, data: { deleted: true, branding } });
});
module.exports = { parseUpload, uploadGlobal, uploadOrganization, deleteLocal };
