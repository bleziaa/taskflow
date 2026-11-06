const Evaluation = require('../models/Evaluation');
const Practice = require('../models/Practice');
const Student = require('../models/Student');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

async function practicaAccesible(req, id) {
  const practica = await Practice.findOne({ _id: id, ...(req.organization ? { organizationId: req.organization._id } : {}) }).populate('estudiante', 'nombre codigo email usuario').populate('tutor', 'nombre email');
  if (!practica) throw new ApiError(404, 'No se encontró la práctica.', { code: 'PRACTICE_NOT_FOUND' });
  if (req.user.role === 'tutor' && String(practica.tutor?._id) !== String(req.user._id))
    throw new ApiError(403, 'No puedes evaluar una práctica que no tienes asignada.', { code: 'FORBIDDEN' });
  if (req.user.role === 'estudiante') {
    const own = String(practica.estudiante?.usuario || '') === String(req.user._id) ||
      String(practica.estudiante?.email || '').toLowerCase() === req.user.email.toLowerCase();
    if (!own) throw new ApiError(403, 'No tienes acceso a esta evaluación.', { code: 'FORBIDDEN' });
  }
  return practica;
}
function poblar(query, organizationId = null) {
  const match = organizationId ? { organizationId } : {};
  return query.populate({ path: 'practica', match, select: 'titulo fechaInicio fechaFin estado' })
    .populate({ path: 'estudiante', match, select: 'nombre codigo email' })
    .populate('tutor', 'nombre email');
}
const listarEvaluaciones = asyncHandler(async (req, res) => {
  let filtro = { ...(req.organization ? { organizationId: req.organization._id } : {}) };
  if (req.user.role === 'tutor') filtro.tutor = req.user._id;
  if (req.user.role === 'estudiante') {
    const student = await Student.findOne({ $or: [{ usuario: req.user._id }, { email: req.user.email }], ...(req.organization ? { organizationId: req.organization._id } : {}) }).select('_id');
    filtro.estudiante = student?._id || null;
  }
  const evaluaciones = await poblar(Evaluation.find(filtro).sort({ evaluadoEn: -1 }).limit(300), req.organization?._id);
  res.json({ ok: true, data: { evaluaciones } });
});
const guardarEvaluacion = asyncHandler(async (req, res) => {
  const practica = await practicaAccesible(req, req.params.practicaId);
  if (req.user.role === 'estudiante') throw new ApiError(403, 'Los estudiantes no pueden crear ni modificar evaluaciones.', { code: 'FORBIDDEN' });
  if (practica.estado === 'suspendida') throw new ApiError(409, 'No se puede evaluar una práctica suspendida.', { code: 'PRACTICE_SUSPENDED' });
  const { calificacion, concepto, fortalezas = '', aspectosMejora = '', observaciones = '' } = req.body;
  if (typeof calificacion !== 'number' || !Number.isFinite(calificacion) || calificacion < 0 || calificacion > 5)
    throw new ApiError(400, 'La calificación debe estar entre 0 y 5.', { code: 'INVALID_SCORE' });
  if (!['excelente', 'bueno', 'satisfactorio', 'insuficiente'].includes(concepto))
    throw new ApiError(400, 'Selecciona un concepto válido.', { code: 'INVALID_CONCEPT' });
  for (const [field, value, max] of [['fortalezas', fortalezas, 2000], ['aspectosMejora', aspectosMejora, 2000], ['observaciones', observaciones, 3000]]) {
    if (typeof value !== 'string' || value.length > max) throw new ApiError(400, 'Revisa el contenido de los campos de texto.', { code: 'INVALID_TEXT' });
  }
  const evaluation = await Evaluation.findOneAndUpdate(
    { practica: practica._id, ...(req.organization ? { organizationId: req.organization._id } : {}) },
    { $set: { ...(req.organization ? { organizationId: req.organization._id } : {}), estudiante: practica.estudiante._id, tutor: practica.tutor._id, calificacion, concepto, fortalezas, aspectosMejora, observaciones, evaluadoEn: new Date() } },
    { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  const result = await poblar(Evaluation.findOne({ _id: evaluation._id, ...(req.organization ? { organizationId: req.organization._id } : {}) }), req.organization?._id);
  res.status(200).json({ ok: true, data: { evaluacion: result } });
});
module.exports = { listarEvaluaciones, guardarEvaluacion };
