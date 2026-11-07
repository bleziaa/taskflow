const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const MAX_BYTES = 10 * 1024 * 1024;
const STORAGE_DIR = path.resolve(__dirname, '..', '..', 'storage', 'course-activity-evidences');
fs.mkdirSync(STORAGE_DIR, { recursive: true });
const allowed = new Set(['.pdf', '.docx', '.zip']);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, STORAGE_DIR),
    filename: (_req, _file, cb) => cb(null, crypto.randomBytes(12).toString('hex'))
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const valid = (ext === '.pdf' && file.mimetype === 'application/pdf') ||
      (ext === '.docx' && file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
      (ext === '.zip' && ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(file.mimetype));
    if (!allowed.has(ext) || !valid) return cb(new ApiError(415, 'Adjunta un PDF, DOCX o ZIP válido.', { code: 'EVIDENCE_TYPE_NOT_ALLOWED' }));
    cb(null, true);
  }
}).single('archivo');
function subirEvidenciaCurso(req, res, next) {
  upload(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new ApiError(413, 'La evidencia supera el límite de 10 MB.', { code: 'FILE_TOO_LARGE' }));
    if (error instanceof multer.MulterError) return next(new ApiError(400, 'No se pudo procesar la evidencia.', { code: 'FILE_UPLOAD_ERROR' }));
    next(error);
  });
}
module.exports = { subirEvidenciaCurso, STORAGE_DIR };
