const Practice = require('../models/Practice');
const Activity = require('../models/Activity');
const Student = require('../models/Student');
const Company = require('../models/Company');
const User = require('../models/User');
const Membership = require('../models/OrganizationMembership');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const CAMPOS = ['estudiante', 'empresa', 'tutor', 'titulo', 'objetivo', 'fechaInicio', 'fechaFin', 'estado', 'observaciones'];
const ESTADOS_ACTIVOS = ['planificada', 'en_curso'];

function datosPermitidos(body) {
  const data = {};
  for (const campo of CAMPOS) {
    if (Object.prototype.hasOwnProperty.call(body, campo)) data[campo] = body[campo];
  }
  return data;
}

async function validarRelaciones(data, actual = null, organizationId = null) {
  const estudianteId = data.estudiante || actual?.estudiante;
  const empresaId = data.empresa || actual?.empresa;
  const tutorId = data.tutor || actual?.tutor;

  const [estudiante, empresa, tutor] = await Promise.all([
    Student.findOne({ _id: estudianteId, ...(organizationId ? { organizationId } : {}) }),
    Company.findOne({ _id: empresaId, ...(organizationId ? { organizationId } : {}) }),
    User.findOne({ _id: tutorId, activo: { $ne: false } }),
  ]);
  if (!estudiante || estudiante.estado !== 'activo') {
    throw new ApiError(400, 'El estudiante no existe o está inactivo.', { code: 'INVALID_STUDENT' });
  }
  if (!empresa || empresa.estado !== 'activa') {
    throw new ApiError(400, 'La empresa no existe o está inactiva.', { code: 'INVALID_COMPANY' });
  }
  if (!tutor) {
    throw new ApiError(400, 'El tutor no existe o su cuenta está desactivada.', { code: 'INVALID_TUTOR' });
  }
  if (organizationId) {
    const membership = await Membership.exists({ organizacion: organizationId, usuario: tutor._id, role: 'tutor', estado: 'activo' });
    if (!membership) throw new ApiError(400, 'El tutor no tiene una membresía activa en esta organización.', { code: 'TUTOR_NOT_IN_ORGANIZATION' });
  }

  const inicio = new Date(data.fechaInicio || actual?.fechaInicio);
  const fin = new Date(data.fechaFin || actual?.fechaFin);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin < inicio) {
    throw new ApiError(400, 'La fecha de finalización debe ser igual o posterior a la fecha de inicio.', { code: 'INVALID_DATE_RANGE' });
  }
  return { estudiante, empresa, tutor };
}

function poblar(query, organizationId = null) {
  const match = organizationId ? { organizationId } : {};
  return query.populate({ path: 'estudiante', match, select: 'codigo nombre email programa semestre estado usuario' })
    .populate({ path: 'empresa', match, select: 'razonSocial nit ciudad' })
    .populate('tutor', 'nombre email');
}

const listarPracticas = asyncHandler(async (req, res) => {
  let filtro = req.organization ? { organizationId: req.organization._id } : {};
  if (req.user.role === 'tutor') filtro.tutor = req.user._id;
  if (req.user.role === 'estudiante') {
    const estudiante = await Student.findOne({ $or: [{ usuario: req.user._id }, { email: req.user.email }], ...(req.organization ? { organizationId: req.organization._id } : {}) }).select('_id');
    filtro.estudiante = estudiante?._id || null;
  }
  const practicas = await poblar(Practice.find(filtro).sort({ fechaInicio: -1 }).limit(300), req.organization?._id);
  res.json({ ok: true, data: { practicas } });
});

const obtenerPractica = asyncHandler(async (req, res) => {
  const practica = await poblar(Practice.findOne({ _id: req.params.id, ...(req.organization ? { organizationId: req.organization._id } : {}) }), req.organization?._id);
  if (!practica) throw new ApiError(404, 'No se encontró la práctica.', { code: 'PRACTICE_NOT_FOUND' });
  if (req.user.role === 'tutor' && String(practica.tutor?._id) !== String(req.user._id)) {
    throw new ApiError(403, 'No tienes acceso a esta práctica.', { code: 'FORBIDDEN' });
  }
  if (req.user.role === 'estudiante' && String(practica.estudiante?.usuario || '') !== String(req.user._id) && String(practica.estudiante?.email).toLowerCase() !== req.user.email.toLowerCase()) {
    throw new ApiError(403, 'No tienes acceso a esta práctica.', { code: 'FORBIDDEN' });
  }
  res.json({ ok: true, data: { practica } });
});

const crearPractica = asyncHandler(async (req, res) => {
  const data = datosPermitidos(req.body);
  const relaciones = await validarRelaciones(data, null, req.organization?._id || null);
  const existente = await Practice.exists({ estudiante: relaciones.estudiante._id, ...(req.organization ? { organizationId: req.organization._id } : {}), estado: { $in: ESTADOS_ACTIVOS } });
  if (existente && ESTADOS_ACTIVOS.includes(data.estado || 'planificada')) {
    throw new ApiError(409, 'El estudiante ya tiene una práctica planificada o en curso.', { code: 'ACTIVE_PRACTICE_EXISTS' });
  }
  const practica = await Practice.create({ ...data, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  relaciones.estudiante.empresa = relaciones.empresa._id;
  relaciones.estudiante.tutor = relaciones.tutor._id;
  await relaciones.estudiante.save();
  const resultado = await poblar(Practice.findOne({ _id: practica._id, ...(req.organization ? { organizationId: req.organization._id } : {}) }), req.organization?._id);
  res.status(201).json({ ok: true, data: { practica: resultado } });
});

const actualizarPractica = asyncHandler(async (req, res) => {
  const actual = await Practice.findOne({ _id: req.params.id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  if (!actual) throw new ApiError(404, 'No se encontró la práctica.', { code: 'PRACTICE_NOT_FOUND' });
  const data = datosPermitidos(req.body);
  const relaciones = await validarRelaciones(data, actual, req.organization?._id || null);
  const estadoNuevo = data.estado || actual.estado;
  const estudianteNuevo = data.estudiante || actual.estudiante;
  if (ESTADOS_ACTIVOS.includes(estadoNuevo)) {
    const conflicto = await Practice.exists({ _id: { $ne: actual._id }, estudiante: estudianteNuevo, ...(req.organization ? { organizationId: req.organization._id } : {}), estado: { $in: ESTADOS_ACTIVOS } });
    if (conflicto) throw new ApiError(409, 'El estudiante ya tiene otra práctica planificada o en curso.', { code: 'ACTIVE_PRACTICE_EXISTS' });
  }
  const estudianteAnteriorId = String(actual.estudiante);
  Object.assign(actual, data);
  await actual.save();
  if (estudianteAnteriorId !== String(relaciones.estudiante._id)) {
    const anterior = await Student.findOne({ _id: estudianteAnteriorId, ...(req.organization ? { organizationId: req.organization._id } : {}) });
    if (anterior) {
      if (String(anterior.empresa) === String(actual.empresa)) anterior.empresa = null;
      if (String(anterior.tutor) === String(actual.tutor)) anterior.tutor = null;
      await anterior.save();
    }
  }
  relaciones.estudiante.empresa = relaciones.empresa._id;
  relaciones.estudiante.tutor = relaciones.tutor._id;
  await relaciones.estudiante.save();
  const practica = await poblar(Practice.findOne({ _id: actual._id, ...(req.organization ? { organizationId: req.organization._id } : {}) }), req.organization?._id);
  res.json({ ok: true, data: { practica } });
});

const eliminarPractica = asyncHandler(async (req, res) => {
  const existente = await Practice.findOne({ _id: req.params.id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  if (!existente) throw new ApiError(404, 'No se encontró la práctica.', { code: 'PRACTICE_NOT_FOUND' });
  const tieneActividades = await Activity.exists({ practica: existente._id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  if (tieneActividades) throw new ApiError(409, 'No se puede eliminar una práctica que ya tiene actividades; conserva su historial.', { code: 'PRACTICE_HAS_ACTIVITIES' });
  const practica = await Practice.findOneAndDelete({ _id: req.params.id, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  const estudiante = await Student.findOne({ _id: practica.estudiante, ...(req.organization ? { organizationId: req.organization._id } : {}) });
  if (estudiante) {
    if (String(estudiante.empresa) === String(practica.empresa)) estudiante.empresa = null;
    if (String(estudiante.tutor) === String(practica.tutor)) estudiante.tutor = null;
    await estudiante.save();
  }
  res.json({ ok: true, data: { mensaje: 'Práctica eliminada.' } });
});

module.exports = { listarPracticas, obtenerPractica, crearPractica, actualizarPractica, eliminarPractica };
