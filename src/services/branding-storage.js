const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const ApiError = require('../utils/ApiError');
const ROOT = path.resolve(__dirname, '..', '..', 'storage', 'branding');
const MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
function validImage(buffer, mime) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mime === 'image/jpeg') return buffer.length > 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (mime === 'image/png') return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === 'image/webp') return buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}
async function saveImage(file) {
  if (!MIME_EXT[file.mimetype] || !validImage(file.buffer, file.mimetype)) throw new ApiError(400, 'Formato no válido. Sube una imagen JPG, PNG o WEBP.', { code: 'BRANDING_IMAGE_INVALID' });
  if (process.env.NODE_ENV === 'production') return saveCloud(file);
  await fs.mkdir(ROOT, { recursive: true });
  const name = crypto.randomUUID() + MIME_EXT[file.mimetype];
  await fs.writeFile(path.join(ROOT, name), file.buffer, { flag: 'wx', mode: 0o640 });
  return { url: '/media/branding/' + name, storage: 'local', filename: name, mimeType: file.mimetype, size: file.size };
}
async function saveCloud(file) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME, preset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloud || !preset) throw new ApiError(503, 'El almacenamiento de producción aún no está configurado. Define CLOUDINARY_CLOUD_NAME y CLOUDINARY_UPLOAD_PRESET.', { code: 'BRANDING_CLOUD_NOT_CONFIGURED' });
  const form = new FormData();
  form.append('file', new Blob([file.buffer], { type: file.mimetype }), 'taskflow-branding' + MIME_EXT[file.mimetype]);
  form.append('upload_preset', preset); form.append('folder', 'taskflow/branding');
  const response = await fetch('https://api.cloudinary.com/v1_1/' + encodeURIComponent(cloud) + '/image/upload', { method: 'POST', body: form });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.secure_url) throw new ApiError(502, 'No se pudo guardar la imagen en la nube.', { code: 'BRANDING_CLOUD_UPLOAD_FAILED' });
  return { url: result.secure_url, storage: 'cloudinary', publicId: result.public_id, mimeType: file.mimetype, size: file.size };
}
async function removeLocal(url) {
  if (typeof url !== 'string' || !url.startsWith('/media/branding/')) return;
  const name = path.basename(url);
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(name)) return;
  await fs.unlink(path.join(ROOT, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
module.exports = { saveImage, removeLocal, validImage };
