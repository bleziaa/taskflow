const Practice = require('../models/Practice');
const Activity = require('../models/Activity');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

async function obtenerPractica(req, id) {
  const practica = await Practice.findOne({ _id: id, ...(req.organization ? { organizationId: req.organization._id } : {}) })
    .populate('estudiante', 'nombre codigo email usuario')
    .populate('tutor', 'nombre email');
  if (!practica) throw new ApiError(404, 'No se encontró la práctica.', { code: 'PRACTICE_NOT_FOUND' });
  if (req.user.role === 'tutor' && String(practica.tutor?._id) !== String(req.user._id)) {
    throw new ApiError(403, 'No tienes acceso a la estructura de una práctica que no tienes asignada.', { code: 'FORBIDDEN' });
  }
  if (req.user.role === 'estudiante') {
    const own = String(practica.estudiante?.usuario || '') === String(req.user._id) ||
      String(practica.estudiante?.email || '').toLowerCase() === String(req.user.email || '').toLowerCase();
    if (!own) throw new ApiError(403, 'No tienes acceso a esta práctica.', { code: 'FORBIDDEN' });
  }
  return practica;
}

function normalizarModulos(modulos) {
  if (!Array.isArray(modulos) || modulos.length < 1 || modulos.length > 20) {
    throw new ApiError(400, 'La estructura debe contener entre 1 y 20 módulos.', { code: 'INVALID_ACADEMIC_STRUCTURE' });
  }
  const nombres = new Set();
  const normalizados = modulos.map((modulo, index) => {
    const nombre = String(modulo?.nombre || '').trim();
    const descripcion = String(modulo?.descripcion || '').trim();
    const ponderacion = Number(modulo?.ponderacion);
    if (nombre.length < 2 || nombre.length > 120 || descripcion.length > 1000 ||
        !Number.isFinite(ponderacion) || ponderacion < 0 || ponderacion > 100) {
      throw new ApiError(400, 'Revisa el nombre, la descripción y la ponderación de cada módulo.', { code: 'INVALID_ACADEMIC_MODULE' });
    }
    const key = nombre.toLocaleLowerCase('es');
    if (nombres.has(key)) throw new ApiError(400, 'No puede haber módulos con el mismo nombre.', { code: 'DUPLICATE_ACADEMIC_MODULE' });
    nombres.add(key);
    const item = { nombre, descripcion, ponderacion, orden: index + 1 };
    if (modulo?._id && /^[a-f\d]{24}$/i.test(String(modulo._id))) item._id = String(modulo._id);
    return item;
  });
  const total = normalizados.reduce((sum, item) => sum + item.ponderacion, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new ApiError(400, 'Las ponderaciones de los módulos deben sumar exactamente el 100 %.', {
      code: 'ACADEMIC_WEIGHTS_MUST_TOTAL_100',
      details: { total: Number(total.toFixed(2)) },
    });
  }
  return normalizados;
}

const obtenerEstructura = asyncHandler(async (req, res) => {
  const practica = await obtenerPractica(req, req.params.id);
  const actividades = await Activity.find({ practica: practica._id, ...(req.organization ? { organizationId: req.organization._id } : {}) })
    .select('titulo moduloAcademicoId fechaLimite evaluacionTutor autoevaluacion valoracionEmpresarial estado').lean();
  const modulos = (practica.estructuraAcademica || []).map((modulo) => {
    const relacionadas = actividades.filter((actividad) => String(actividad.moduloAcademicoId || '') === String(modulo._id));
    const calificadas = relacionadas.filter((actividad) => Number.isFinite(actividad.evaluacionTutor?.calificacion));
    const completa = relacionadas.length > 0 && calificadas.length === relacionadas.length;
    const promedio = completa ? calificadas.reduce((sum, actividad) => sum + actividad.evaluacionTutor.calificacion, 0) / calificadas.length : null;
    return {
      _id: modulo._id, nombre: modulo.nombre, descripcion: modulo.descripcion, ponderacion: modulo.ponderacion, orden: modulo.orden,
      actividadesTotal: relacionadas.length, actividadesCalificadas: calificadas.length,
      nota: promedio === null ? null : Number(promedio.toFixed(2)), estadoCalculo: completa ? 'completo' : 'pendiente',
    };
  });
  const calculable = modulos.length > 0 && modulos.every((modulo) => modulo.estadoCalculo === 'completo');
  const notaFinal = calculable ? Number(modulos.reduce((sum, modulo) => sum + modulo.nota * modulo.ponderacion / 100, 0).toFixed(2)) : null;
  res.json({ ok: true, data: {
    practica: { _id: practica._id, titulo: practica.titulo, estado: practica.estado, estudiante: practica.estudiante },
    modulos,
    resumenCalificacion: { notaFinal, estado: calculable ? 'completa' : 'pendiente', escala: '0 a 5' },
    actividades: actividades.map((actividad) => ({
      _id: actividad._id, titulo: actividad.titulo, moduloAcademicoId: actividad.moduloAcademicoId,
      calificacionTutor: actividad.evaluacionTutor?.calificacion ?? null,
      autoevaluacion: actividad.autoevaluacion?.calificacion ?? null,
      valoracionEmpresarial: actividad.valoracionEmpresarial?.calificacion ?? null,
    })),
    historial: practica.historialEstructuraAcademica || [],
    actualizadaEn: practica.estructuraActualizadaEn,
  } });
});

const guardarEstructura = asyncHandler(async (req, res) => {
  const practica = await obtenerPractica(req, req.params.id);
  if (req.user.role === 'estudiante') throw new ApiError(403, 'Los estudiantes no pueden modificar la estructura académica.', { code: 'FORBIDDEN' });
  if (['finalizada', 'suspendida'].includes(practica.estado)) {
    throw new ApiError(409, 'No se puede modificar la estructura de una práctica cerrada.', { code: 'PRACTICE_CLOSED' });
  }
  const modulos = normalizarModulos(req.body.modulos);
  const idsNuevos = new Set(modulos.map((item) => String(item._id || '')).filter(Boolean));
  const idsAnteriores = (practica.estructuraAcademica || []).map((item) => String(item._id));
  const eliminados = idsAnteriores.filter((id) => !idsNuevos.has(id));
  if (eliminados.length) {
    const actividadVinculada = await Activity.exists({
      practica: practica._id,
      moduloAcademicoId: { $in: eliminados },
      ...(req.organization ? { organizationId: req.organization._id } : {}),
    });
    if (actividadVinculada) throw new ApiError(409, 'No puedes eliminar un módulo que ya tiene actividades vinculadas. Reasigna primero esas actividades.', { code: 'MODULE_HAS_ACTIVITIES' });
  }
  const anteriores = (practica.estructuraAcademica || []).map((item) => ({
    _id: item._id, nombre: item.nombre, descripcion: item.descripcion,
    ponderacion: item.ponderacion, orden: item.orden,
  }));
  const motivo = String(req.body.motivoCambio || '').trim();
  if (anteriores.length && !motivo) {
    throw new ApiError(400, 'Indica el motivo para modificar una estructura académica existente.', { code: 'CHANGE_REASON_REQUIRED' });
  }
  if (anteriores.length) {
    practica.historialEstructuraAcademica.push({
      modulos: anteriores,
      motivo,
      modificadoPor: req.user._id,
      modificadoEn: new Date(),
    });
  }
  practica.estructuraAcademica = modulos;
  practica.estructuraActualizadaPor = req.user._id;
  practica.estructuraActualizadaEn = new Date();
  await practica.save();
  res.json({ ok: true, data: {
    mensaje: 'Estructura académica guardada.',
    modulos: practica.estructuraAcademica,
    historial: practica.historialEstructuraAcademica,
    actualizadaEn: practica.estructuraActualizadaEn,
  } });
});

module.exports = { obtenerEstructura, guardarEstructura };
