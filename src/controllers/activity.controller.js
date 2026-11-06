const fs = require('node:fs/promises');
const path = require('node:path');
const Activity = require('../models/Activity');
const Evidence = require('../models/Evidence');
const Practice = require('../models/Practice');
const Student = require('../models/Student');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { STORAGE_DIR } = require('../middleware/activityResourceUpload');
const CAMPOS = ['titulo', 'descripcion', 'fechaLimite', 'prioridad', 'estado', 'moduloAcademicoId'];
function datosPermitidos(body) {
  const data = {};
  for (const campo of CAMPOS) if (Object.prototype.hasOwnProperty.call(body, campo)) data[campo] = body[campo];
  return data;
}
async function obtenerPracticaAccesible(req, id) {
  const practica = await Practice.findOne({ _id: id, ...(req.organization ? { organizationId: req.organization._id } : {}) }).populate('estudiante', 'nombre email usuario').populate('tutor', 'nombre email');
  if (!practica) throw new ApiError(404, 'No se encontró la práctica.', { code: 'PRACTICE_NOT_FOUND' });
  if (req.user.role === 'tutor' && String(practica.tutor?._id) !== String(req.user._id))
    throw new ApiError(403, 'No tienes permisos sobre esta práctica.', { code: 'FORBIDDEN' });
  if (req.user.role === 'estudiante') {
    const own = String(practica.estudiante?.usuario || '') === String(req.user._id) ||
      String(practica.estudiante?.email || '').toLowerCase() === req.user.email.toLowerCase();
    if (!own) throw new ApiError(403, 'No tienes acceso a esta práctica.', { code: 'FORBIDDEN' });
  }
  return practica;
}
function poblar(query, organizationId = null) {
  const match = organizationId ? { organizationId } : {};
  return query.populate({ path: 'practica', match, select: 'titulo fechaInicio fechaFin estado estructuraAcademica', populate: [
    { path: 'estudiante', match, select: 'nombre codigo email' }, { path: 'tutor', select: 'nombre email' }
  ] }).populate('creadoPor', 'nombre role').populate('evaluacionTutor.evaluadoPor', 'nombre').populate('valoracionEmpresarial.evaluadoPor', 'nombre');
}
const listarActividades = asyncHandler(async (req, res) => {
  let practiceIds;
  if (req.user.role === 'estudiante') {
    const student = await Student.findOne({ $or: [{ usuario: req.user._id }, { email: req.user.email }], ...(req.organization ? { organizationId: req.organization._id } : {}) }).select('_id');
    const practices = student ? await Practice.find({ estudiante: student._id, ...(req.organization ? { organizationId: req.organization._id } : {}) }).select('_id') : [];
    practiceIds = practices.map((p) => p._id);
  } else if (req.user.role === 'tutor') {
    const practices = await Practice.find({ tutor: req.user._id, ...(req.organization ? { organizationId: req.organization._id } : {}) }).select('_id');
    practiceIds = practices.map((p) => p._id);
  }
  const filter = { ...(req.organization ? { organizationId: req.organization._id } : {}), ...(practiceIds ? { practica: { $in: practiceIds } } : {}) };
  if (req.query.practica) {
    const practice = await obtenerPracticaAccesible(req, req.query.practica);
    filter.practica = practice._id;
  }
  const actividades = await poblar(Activity.find(filter).sort({ fechaLimite: 1, createdAt: -1 }).limit(500), req.organization?._id);
  res.json({ ok: true, data: { actividades } });
});
const crearActividad = asyncHandler(async (req, res) => {
  const practica = await obtenerPracticaAccesible(req, req.body.practica);
  if (req.user.role === 'estudiante') throw new ApiError(403, 'Los estudiantes no pueden crear actividades.', { code: 'FORBIDDEN' });
  if (['finalizada', 'suspendida'].includes(practica.estado))
    throw new ApiError(409, 'No se pueden añadir actividades a una práctica finalizada o suspendida.', { code: 'PRACTICE_CLOSED' });
  const moduleId = req.body.moduloAcademicoId || null;
  if ((practica.estructuraAcademica || []).length) {
    if (!moduleId || !practica.estructuraAcademica.id(moduleId)) throw new ApiError(400, 'Selecciona un módulo válido de la estructura de esta práctica.', { code: 'INVALID_ACADEMIC_MODULE' });
  } else if (moduleId) {
    throw new ApiError(400, 'Primero configura los módulos de esta práctica.', { code: 'ACADEMIC_STRUCTURE_REQUIRED' });
  }
  const actividad = await Activity.create({ ...datosPermitidos(req.body), moduloAcademicoId: moduleId, practica: practica._id, creadoPor: req.user._id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  const result = await poblar(Activity.findOne({ _id: actividad._id, ...(req.organization ? { organizationId: req.organization._id } : {}) }), req.organization?._id);
  res.status(201).json({ ok: true, data: { actividad: result } });
});
const actualizarActividad = asyncHandler(async (req, res) => {
  if (req.user.role === 'estudiante') throw new ApiError(403, 'Los estudiantes no pueden modificar actividades.', { code: 'FORBIDDEN' });
  const actividad = await Activity.findOne({ _id: req.params.id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  if (!actividad) throw new ApiError(404, 'No se encontró la actividad.', { code: 'ACTIVITY_NOT_FOUND' });
  const practica = await obtenerPracticaAccesible(req, actividad.practica);
  if (['finalizada', 'suspendida'].includes(practica.estado))
    throw new ApiError(409, 'La práctica está cerrada y no admite cambios.', { code: 'PRACTICE_CLOSED' });
  const data = datosPermitidos(req.body);
  if (Object.prototype.hasOwnProperty.call(data, 'moduloAcademicoId')) {
    const moduleId = data.moduloAcademicoId || null;
    if ((practica.estructuraAcademica || []).length && (!moduleId || !practica.estructuraAcademica.id(moduleId))) {
      throw new ApiError(400, 'Selecciona un módulo válido de la estructura de esta práctica.', { code: 'INVALID_ACADEMIC_MODULE' });
    }
    data.moduloAcademicoId = moduleId;
  }
  Object.assign(actividad, data);
  await actividad.save();
  const result = await poblar(Activity.findOne({ _id: actividad._id, ...(req.organization ? { organizationId: req.organization._id } : {}) }), req.organization?._id);
  res.json({ ok: true, data: { actividad: result } });
});
const eliminarActividad = asyncHandler(async (req, res) => {
  if (req.user.role === 'estudiante') throw new ApiError(403, 'Los estudiantes no pueden eliminar actividades.', { code: 'FORBIDDEN' });
  const actividad = await Activity.findOne({ _id: req.params.id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  if (!actividad) throw new ApiError(404, 'No se encontró la actividad.', { code: 'ACTIVITY_NOT_FOUND' });
  await obtenerPracticaAccesible(req, actividad.practica);
  const tieneEvidencias = await Evidence.exists({ actividad: actividad._id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  if (tieneEvidencias) throw new ApiError(409, 'No se puede eliminar una actividad que ya tiene evidencias; conserva su historial.', { code: 'ACTIVITY_HAS_EVIDENCES' });
  await actividad.deleteOne();
  res.json({ ok: true, data: { mensaje: 'Actividad eliminada.' } });
});

const subirRecurso = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Selecciona un PDF para adjuntar.', { code: 'FILE_REQUIRED' });
  let conservar = false;
  try {
    if (req.file.mimetype !== 'application/pdf' || path.extname(req.file.originalname).toLowerCase() !== '.pdf') throw new ApiError(415, 'Solo se permiten archivos PDF.', { code: 'RESOURCE_TYPE_NOT_ALLOWED' });
    const handle = await fs.open(req.file.path, 'r');
    let signature;
    try { const buffer = Buffer.alloc(5); const { bytesRead } = await handle.read(buffer, 0, 5, 0); signature = bytesRead === 5 && buffer.toString() === '%PDF-'; }
    finally { await handle.close(); }
    if (!signature) throw new ApiError(415, 'El archivo no contiene un documento PDF válido.', { code: 'FILE_SIGNATURE_INVALID' });
    const actividad = await Activity.findOne({ _id: req.params.id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
    if (!actividad) throw new ApiError(404, 'No se encontró la actividad.', { code: 'ACTIVITY_NOT_FOUND' });
    const practica = await obtenerPracticaAccesible(req, actividad.practica);
    if (req.user.role === 'estudiante') throw new ApiError(403, 'Solo el docente puede adjuntar el material de la actividad.', { code: 'FORBIDDEN' });
    if (['finalizada', 'suspendida'].includes(practica.estado)) throw new ApiError(409, 'La práctica está cerrada y no admite cambios.', { code: 'PRACTICE_CLOSED' });
    const previous = actividad.recurso?.nombreAlmacenado;
    actividad.recurso = { nombreOriginal: path.basename(req.file.originalname).replace(/[\r\n\"]/g, '_').slice(0, 180), nombreAlmacenado: req.file.filename, mimeType: 'application/pdf', tamano: req.file.size };
    await actividad.save(); conservar = true;
    if (previous && previous !== req.file.filename) await fs.unlink(path.resolve(STORAGE_DIR, previous)).catch(() => {});
    res.status(201).json({ ok: true, data: { recurso: actividad.recurso } });
  } finally { if (!conservar) await fs.unlink(req.file.path).catch(() => {}); }
});
const descargarRecurso = asyncHandler(async (req, res) => {
  const actividad = await Activity.findOne({ _id: req.params.id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  if (!actividad) throw new ApiError(404, 'No se encontró la actividad.', { code: 'ACTIVITY_NOT_FOUND' });
  await obtenerPracticaAccesible(req, actividad.practica);
  const recurso = actividad.recurso;
  if (!recurso?.nombreAlmacenado) throw new ApiError(404, 'Esta actividad todavía no tiene un PDF adjunto.', { code: 'RESOURCE_NOT_FOUND' });
  const filePath = path.resolve(STORAGE_DIR, recurso.nombreAlmacenado);
  if (path.dirname(filePath) !== path.resolve(STORAGE_DIR)) throw new ApiError(404, 'Archivo no encontrado.', { code: 'FILE_NOT_FOUND' });
  try { await fs.access(filePath); } catch { throw new ApiError(404, 'El PDF ya no está disponible.', { code: 'FILE_NOT_FOUND' }); }
  res.download(filePath, recurso.nombreOriginal, { headers: { 'Content-Type': 'application/pdf', 'X-Content-Type-Options': 'nosniff' } });
});


const guardarAutoevaluacion = asyncHandler(async (req, res) => {
  const actividad = await Activity.findOne({ _id: req.params.id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  if (!actividad) throw new ApiError(404, 'No se encontró la actividad.', { code: 'ACTIVITY_NOT_FOUND' });
  const practica = await obtenerPracticaAccesible(req, actividad.practica);
  if (req.user.role !== 'estudiante') throw new ApiError(403, 'La autoevaluación corresponde al estudiante.', { code: 'FORBIDDEN' });
  if (['finalizada', 'suspendida'].includes(practica.estado)) throw new ApiError(409, 'La práctica está cerrada.', { code: 'PRACTICE_CLOSED' });
  const calificacion = Number(req.body.calificacion);
  const reflexion = String(req.body.reflexion || '').trim();
  if (!Number.isFinite(calificacion) || calificacion < 0 || calificacion > 5 || reflexion.length > 2000) {
    throw new ApiError(400, 'Indica una autoevaluación válida entre 0 y 5 y una reflexión de máximo 2000 caracteres.', { code: 'INVALID_SELF_ASSESSMENT' });
  }
  actividad.autoevaluacion = { calificacion, reflexion, evaluadoEn: new Date() };
  await actividad.save();
  res.json({ ok: true, data: { autoevaluacion: actividad.autoevaluacion } });
});

const guardarEvaluacionTutor = asyncHandler(async (req, res) => {
  const actividad = await Activity.findOne({ _id: req.params.id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  if (!actividad) throw new ApiError(404, 'No se encontró la actividad.', { code: 'ACTIVITY_NOT_FOUND' });
  const practica = await obtenerPracticaAccesible(req, actividad.practica);
  if (!['tutor', 'administrador'].includes(req.user.role)) throw new ApiError(403, 'Solo el tutor puede registrar la calificación oficial.', { code: 'FORBIDDEN' });
  if (['finalizada', 'suspendida'].includes(practica.estado)) throw new ApiError(409, 'La práctica está cerrada y no admite nuevas calificaciones.', { code: 'PRACTICE_CLOSED' });
  const calificacion = Number(req.body.calificacion);
  const observaciones = String(req.body.observaciones || '').trim();
  const fortalezas = String(req.body.fortalezas || '').trim();
  const aspectosMejora = String(req.body.aspectosMejora || '').trim();
  if (!Number.isFinite(calificacion) || calificacion < 0 || calificacion > 5 ||
      observaciones.length > 2000 || fortalezas.length > 2000 || aspectosMejora.length > 2000) {
    throw new ApiError(400, 'Revisa la calificación y los campos de observación.', { code: 'INVALID_TUTOR_ASSESSMENT' });
  }
  actividad.evaluacionTutor = { calificacion, observaciones, fortalezas, aspectosMejora, evaluadoPor: req.user._id, evaluadoEn: new Date() };
  await actividad.save();
  res.json({ ok: true, data: { evaluacionTutor: actividad.evaluacionTutor } });
});

module.exports = { listarActividades, crearActividad, actualizarActividad, eliminarActividad, subirRecurso, descargarRecurso, guardarAutoevaluacion, guardarEvaluacionTutor };
