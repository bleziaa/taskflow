const fs = require('node:fs/promises');
const path = require('node:path');
const Activity = require('../models/Activity');
const Evidence = require('../models/Evidence');
const Student = require('../models/Student');
const { STORAGE_DIR } = require('../middleware/evidenceUpload');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
async function obtenerContexto(req, actividadId) {
  const actividad = await Activity.findOne({ _id: actividadId, ...(req.organization ? { organizationId: req.organization._id } : {}) }).populate({ path: 'practica', match: req.organization ? { organizationId: req.organization._id } : {}, populate: [
    { path: 'estudiante', match: req.organization ? { organizationId: req.organization._id } : {}, select: 'nombre codigo email usuario' }, { path: 'tutor', select: 'nombre email' },
  ] });
  if (!actividad) throw new ApiError(404, 'No se encontró la actividad.', { code: 'ACTIVITY_NOT_FOUND' });
  const practica = actividad.practica;
  if (!practica) throw new ApiError(409, 'La actividad no tiene una práctica asociada.', { code: 'PRACTICE_NOT_FOUND' });
  if (req.user.role === 'tutor' && String(practica.tutor?._id) !== String(req.user._id)) throw new ApiError(403, 'No tienes permisos sobre esta práctica.', { code: 'FORBIDDEN' });
  let student = null;
  if (req.user.role === 'estudiante') {
    student = await Student.findOne({ $or: [{ usuario: req.user._id }, { email: req.user.email }], ...(req.organization ? { organizationId: req.organization._id } : {}) });
    if (!student || String(practica.estudiante?._id) !== String(student._id)) throw new ApiError(403, 'Solo puedes entregar evidencias en tus propias actividades.', { code: 'FORBIDDEN' });
  }
  return { actividad, practica, student: student || practica.estudiante };
}
async function comprobarFirma(file) {
  const handle = await fs.open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(8); const { bytesRead } = await handle.read(buffer, 0, 8, 0);
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' && (bytesRead < 5 || buffer.subarray(0, 5).toString() !== '%PDF-')) return false;
    if (['.docx', '.zip'].includes(ext) && (bytesRead < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b)) return false;
    return true;
  } finally { await handle.close(); }
}
function poblarEvidence(query, organizationId = null) { return query.populate({ path: 'estudiante', match: organizationId ? { organizationId } : {}, select: 'nombre codigo' }).populate('revisadoPor', 'nombre role'); }
const subir = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Selecciona un archivo para adjuntar.', { code: 'FILE_REQUIRED' });
  let conservar = false;
  let evidenciaId = null;
  try {
    const { actividad, practica, student } = await obtenerContexto(req, req.params.actividadId);
    if (req.user.role !== 'estudiante') throw new ApiError(403, 'Solo los estudiantes pueden entregar evidencias.', { code: 'FORBIDDEN' });
    if (['finalizada', 'suspendida'].includes(practica.estado)) throw new ApiError(409, 'La práctica está cerrada y no admite entregas.', { code: 'PRACTICE_CLOSED' });
    if (!await comprobarFirma(req.file)) throw new ApiError(415, 'El contenido del archivo no coincide con su formato.', { code: 'FILE_SIGNATURE_INVALID' });
    const original = path.basename(req.file.originalname).replace(/[\r\n"]/g, '_').slice(0, 180);
    const evidencia = await Evidence.create({ actividad: actividad._id, estudiante: student._id, nombreOriginal: original, nombreAlmacenado: req.file.filename, mimeType: req.file.mimetype, tamano: req.file.size, ...(req.organization ? { organizationId: req.organization._id } : {}) });
    evidenciaId = evidencia._id;
    actividad.estado = 'en_revision'; await actividad.save(); conservar = true;
    const result = await poblarEvidence(Evidence.findOne({ _id: evidencia._id, ...(req.organization ? { organizationId: req.organization._id } : {}) }), req.organization?._id);
    res.status(201).json({ ok: true, data: { evidencia: result } });
  } finally {
    if (!conservar) {
      if (evidenciaId) await Evidence.deleteOne({ _id: evidenciaId }).catch(() => {});
      await fs.unlink(req.file.path).catch(() => {});
    }
  }
});
const listarPorActividad = asyncHandler(async (req, res) => {
  const { actividad, student } = await obtenerContexto(req, req.params.actividadId);
  const filter = { actividad: actividad._id, ...(req.organization ? { organizationId: req.organization._id } : {}) }; if (req.user.role === 'estudiante') filter.estudiante = student._id;
  const evidencias = await poblarEvidence(Evidence.find(filter).sort({ createdAt: -1 }).limit(100), req.organization?._id);
  res.json({ ok: true, data: { evidencias } });
});
async function obtenerEvidenciaAccesible(req, id) {
  const evidencia = await Evidence.findOne({ _id: id, ...(req.organization ? { organizationId: req.organization._id } : {}) }).populate({ path: 'actividad', match: req.organization ? { organizationId: req.organization._id } : {}, populate: { path: 'practica', match: req.organization ? { organizationId: req.organization._id } : {}, populate: [
    { path: 'estudiante', match: req.organization ? { organizationId: req.organization._id } : {}, select: 'nombre codigo email usuario' }, { path: 'tutor', select: 'nombre email' },
  ] } });
  if (!evidencia) throw new ApiError(404, 'No se encontró la evidencia.', { code: 'EVIDENCE_NOT_FOUND' });
  const practica = evidencia.actividad?.practica;
  if (!practica) throw new ApiError(404, 'No se encontró la práctica asociada.', { code: 'PRACTICE_NOT_FOUND' });
  if (req.user.role === 'tutor' && String(practica.tutor?._id) !== String(req.user._id)) throw new ApiError(403, 'No tienes permisos sobre esta evidencia.', { code: 'FORBIDDEN' });
  if (req.user.role === 'estudiante') {
    const student = await Student.findOne({ $or: [{ usuario: req.user._id }, { email: req.user.email }], ...(req.organization ? { organizationId: req.organization._id } : {}) });
    if (!student || String(evidencia.estudiante) !== String(student._id)) throw new ApiError(403, 'No tienes acceso a esta evidencia.', { code: 'FORBIDDEN' });
  }
  return { evidencia, practica };
}
const descargar = asyncHandler(async (req, res) => {
  const { evidencia } = await obtenerEvidenciaAccesible(req, req.params.id);
  const filePath = path.resolve(STORAGE_DIR, evidencia.nombreAlmacenado);
  if (path.dirname(filePath) !== path.resolve(STORAGE_DIR)) throw new ApiError(404, 'Archivo no encontrado.', { code: 'FILE_NOT_FOUND' });
  try { await fs.access(filePath); } catch { throw new ApiError(404, 'El archivo ya no está disponible.', { code: 'FILE_NOT_FOUND' }); }
  res.download(filePath, evidencia.nombreOriginal, { headers: { 'Content-Type': evidencia.mimeType } });
});
const revisar = asyncHandler(async (req, res) => {
  const { evidencia, practica } = await obtenerEvidenciaAccesible(req, req.params.id);
  if (!['administrador', 'tutor'].includes(req.user.role)) throw new ApiError(403, 'No tienes permisos para revisar evidencias.', { code: 'FORBIDDEN' });
  if (['finalizada', 'suspendida'].includes(practica.estado)) throw new ApiError(409, 'La práctica está cerrada y no admite revisiones.', { code: 'PRACTICE_CLOSED' });
  evidencia.estado = req.body.estado; evidencia.observacionTutor = req.body.observacion || '';
  evidencia.revisadoPor = req.user._id; evidencia.revisadoEn = new Date(); await evidencia.save();
  const actividad = await Activity.findOne({ _id: evidencia.actividad._id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  if (actividad) { actividad.estado = evidencia.estado === 'aprobada' ? 'completada' : 'pendiente'; await actividad.save(); }
  const result = await poblarEvidence(Evidence.findOne({ _id: evidencia._id, ...(req.organization ? { organizationId: req.organization._id } : {}) }), req.organization?._id);
  res.json({ ok: true, data: { evidencia: result } });
});
module.exports = { subir, listarPorActividad, descargar, revisar };
