const Practice = require('../models/Practice');
const Activity = require('../models/Activity');
const Evidence = require('../models/Evidence');
const Evaluation = require('../models/Evaluation');
const Student = require('../models/Student');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const obtenerInformes = asyncHandler(async (req, res) => {
  const filtro = { ...(req.organization ? { organizationId: req.organization._id } : {}) };
  if (req.user.role === 'tutor') filtro.tutor = req.user._id;
  if (req.user.role === 'estudiante') {
    const student = await Student.findOne({ $or: [{ usuario: req.user._id }, { email: req.user.email }], ...(req.organization ? { organizationId: req.organization._id } : {}) }).select('_id');
    filtro.estudiante = student?._id || null;
  }
  if (req.query.practica) {
    if (req.query.practica.length !== 24 || [...req.query.practica].some(char => !'0123456789abcdef'.includes(char.toLowerCase()))) throw new ApiError(400, 'Identificador de práctica no válido.', { code: 'INVALID_PRACTICE_ID' });
    filtro._id = req.query.practica;
  }
  const matchOrg = req.organization ? { organizationId: req.organization._id } : {};
  const practicas = await Practice.find(filtro).populate({ path: 'estudiante', match: matchOrg, select: 'codigo nombre email programa semestre' })
    .populate({ path: 'empresa', match: matchOrg, select: 'razonSocial ciudad' }).populate('tutor', 'nombre email')
    .sort({ fechaInicio: -1 }).limit(300).lean();
  const ids = practicas.map(p => p._id);
  const actividades = ids.length ? await Activity.find({ practica: { $in: ids }, ...(req.organization ? { organizationId: req.organization._id } : {}) }).sort({ fechaLimite: 1 }).lean() : [];
  const actividadIds = actividades.map(a => a._id);
  const [evidencias, evaluaciones] = await Promise.all([
    actividadIds.length ? Evidence.find({ actividad: { $in: actividadIds }, ...(req.organization ? { organizationId: req.organization._id } : {}) }).select('actividad estado nombreOriginal tamano createdAt revisadoEn').lean() : [],
    ids.length ? Evaluation.find({ practica: { $in: ids }, ...(req.organization ? { organizationId: req.organization._id } : {}) }).select('practica calificacion concepto fortalezas aspectosMejora observaciones evaluadoEn').lean() : [],
  ]);
  const reportes = practicas.map(practica => {
    const acts = actividades.filter(a => String(a.practica) === String(practica._id));
    const actIds = new Set(acts.map(a => String(a._id)));
    const evs = evidencias.filter(e => actIds.has(String(e.actividad)));
    const evaluation = evaluaciones.find(e => String(e.practica) === String(practica._id)) || null;
    const total = acts.length;
    const completadas = acts.filter(a => a.estado === 'completada').length;
    const enRevision = acts.filter(a => a.estado === 'en_revision').length;
    const pendientes = total - completadas - enRevision;
    return {
      practica: { _id: practica._id, titulo: practica.titulo, estado: practica.estado, fechaInicio: practica.fechaInicio, fechaFin: practica.fechaFin, objetivo: practica.objetivo },
      estudiante: practica.estudiante, empresa: practica.empresa, tutor: practica.tutor,
      resumen: { totalActividades: total, completadas, enRevision, pendientes, progreso: total ? Math.round(completadas / total * 100) : 0, totalEvidencias: evs.length, evidenciasAprobadas: evs.filter(e => e.estado === 'aprobada').length, evidenciasConCambios: evs.filter(e => e.estado === 'requiere_cambios').length },
      actividades: acts.map(a => ({ _id: a._id, titulo: a.titulo, fechaLimite: a.fechaLimite, prioridad: a.prioridad, estado: a.estado, evidencias: evs.filter(e => String(e.actividad) === String(a._id)).map(e => ({ nombre: e.nombreOriginal, estado: e.estado, fecha: e.createdAt })) })),
      evaluacion: evaluation,
    };
  });
  // Un docente también debe ver a los estudiantes que tiene asignados en su ficha,
  // aunque todavía no se les haya creado una práctica empresarial.
  const estudiantesAsignados = req.user.role === 'tutor'
    ? await Student.find({ tutor: req.user._id, estado: 'activo', ...(req.organization ? { organizationId: req.organization._id } : {}) })
        .populate({ path: 'empresa', match: matchOrg, select: 'razonSocial ciudad' })
        .select('codigo nombre email programa semestre empresa tutor')
        .sort({ nombre: 1 }).limit(300).lean()
    : [];
  const estudiantesConPractica = new Set(reportes.map(item => String(item.estudiante?._id || '')).filter(Boolean));
  const seguimiento = [...reportes];
  for (const estudiante of estudiantesAsignados) {
    if (estudiantesConPractica.has(String(estudiante._id))) continue;
    seguimiento.push({
      practica: null,
      estudiante,
      empresa: estudiante.empresa || null,
      tutor: { _id: req.user._id, nombre: req.user.nombre, email: req.user.email },
      resumen: { totalActividades: 0, completadas: 0, enRevision: 0, pendientes: 0, progreso: 0, totalEvidencias: 0, evidenciasAprobadas: 0, evidenciasConCambios: 0 },
      actividades: [], evaluacion: null,
      seguimientoSinPractica: true,
    });
  }
  const resumen = {
    practicas: reportes.length,
    activas: reportes.filter(r => r.practica?.estado === 'en_curso').length,
    finalizadas: reportes.filter(r => r.practica?.estado === 'finalizada').length,
    totalActividades: reportes.reduce((n, r) => n + r.resumen.totalActividades, 0),
    actividadesCompletadas: reportes.reduce((n, r) => n + r.resumen.completadas, 0),
    totalEvidencias: reportes.reduce((n, r) => n + r.resumen.totalEvidencias, 0),
    evaluaciones: reportes.filter(r => r.evaluacion).length,
    promedio: reportes.filter(r => r.evaluacion).length ? Number((reportes.filter(r => r.evaluacion).reduce((n, r) => n + r.evaluacion.calificacion, 0) / reportes.filter(r => r.evaluacion).length).toFixed(2)) : null,
  };
  res.json({ ok: true, data: { resumen, reportes: seguimiento } });
});
module.exports = { obtenerInformes };
