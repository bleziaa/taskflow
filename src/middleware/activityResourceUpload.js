const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const MAX_BYTES = 10 * 1024 * 1024;
const STORAGE_DIR = process.env.NODE_ENV === 'test' ? path.join(os.tmpdir(), 'taskflow-activity-resources-test') : path.resolve(__dirname, '..', '..', 'storage', 'activity-resources');
fs.mkdirSync(STORAGE_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: (_req, _file, cb) => cb(null, STORAGE_DIR), filename: (_req, _file, cb) => cb(null, crypto.randomUUID()) }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname || '').toLowerCase() !== '.pdf' || file.mimetype !== 'application/pdf') return cb(new ApiError(415, 'Solo puedes adjuntar documentos PDF.', { code: 'RESOURCE_TYPE_NOT_ALLOWED' }));
    cb(null, true);
  },
}).single('archivo');
function subirRecursoActividad(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new ApiError(413, 'El PDF supera el límite de 10 MB.', { code: 'FILE_TOO_LARGE' }));
    if (error instanceof multer.MulterError) return next(new ApiError(400, 'No se pudo procesar el PDF adjunto.', { code: 'FILE_UPLOAD_ERROR' }));
    return next(error);
  });
}
module.exports = { subirRecursoActividad, STORAGE_DIR };
