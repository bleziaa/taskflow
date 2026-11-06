const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
};
const STORAGE_DIR = process.env.NODE_ENV === 'test' ? path.join(os.tmpdir(), 'taskflow-evidences-test') : path.resolve(__dirname, '..', '..', 'storage', 'evidences');
fs.mkdirSync(STORAGE_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, STORAGE_DIR),
  filename: (_req, _file, callback) => callback(null, crypto.randomUUID()),
});
const upload = multer({
  storage, limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed = TIPOS[ext];
    if (!allowed || !allowed.includes(file.mimetype)) return callback(new ApiError(415, 'Formato no permitido. Adjunta un PDF, DOCX o ZIP válido.', { code: 'FILE_TYPE_NOT_ALLOWED' }));
    callback(null, true);
  },
}).single('archivo');
function subirEvidencia(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new ApiError(413, 'El archivo supera el límite de 10 MB.', { code: 'FILE_TOO_LARGE' }));
    if (error instanceof multer.MulterError) return next(new ApiError(400, 'No se pudo procesar el archivo adjunto.', { code: 'FILE_UPLOAD_ERROR' }));
    return next(error);
  });
}
module.exports = { subirEvidencia, STORAGE_DIR, MAX_BYTES };
