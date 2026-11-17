const Student = require('../models/Student');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { validarTelefonoDisponible } = require('../utils/student-phone');
const FIELD_RULES = require('../../shared/field-rules');
const asyncHandler = require('../utils/asyncHandler');

function filtroPropio(req) {
  return {
    organizationId: req.organization._id,
    $or: [{ usuario: req.user._id }, { email: String(req.user.email).toLowerCase() }],
  };
}

const obtenerMiFicha = asyncHandler(async (req, res) => {
  const estudiante = await Student.findOne(filtroPropio(req))
    .populate('empresa', 'razonSocial')
    .populate('tutor', 'nombre email');
  if (!estudiante) {
    throw new ApiError(404, 'Tu cuenta aún no tiene una ficha de estudiante vinculada. Solicita al administrador que registre tu ficha con el mismo correo de tu cuenta.', { code: 'STUDENT_PROFILE_NOT_FOUND' });
  }
  res.json({ ok: true, data: { estudiante } });
});

const actualizarMiFicha = asyncHandler(async (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  const telefono = String(req.body.telefono || '').trim();
  const programa = String(req.body.programa || '').trim();
  const semestre = Number(req.body.semestre);
  if (nombre.length < FIELD_RULES.studentNameMin || nombre.length > FIELD_RULES.profileNameMax) throw new ApiError(400, 'Escribe tu nombre completo (entre 2 y 120 caracteres).', { code: 'INVALID_NAME' });
  if (telefono.length > FIELD_RULES.studentPhoneMax || !FIELD_RULES.isValidPhone(telefono)) throw new ApiError(400, 'El teléfono debe contener entre 7 y 15 dígitos (sin contar espacios ni símbolos).', { code: 'INVALID_PHONE' });
  if (programa.length < FIELD_RULES.studentProgramMin || programa.length > FIELD_RULES.studentProgramMax) throw new ApiError(400, 'Escribe tu programa académico.', { code: 'INVALID_PROGRAM' });
  if (!Number.isInteger(semestre) || semestre < FIELD_RULES.semesterMin || semestre > FIELD_RULES.semesterMax) throw new ApiError(400, 'Selecciona un semestre válido entre 1 y 12.', { code: 'INVALID_SEMESTER' });

  const estudiante = await Student.findOne(filtroPropio(req));
  if (!estudiante) throw new ApiError(404, 'No encontramos tu ficha. Solicita al administrador que vincule tu cuenta.', { code: 'STUDENT_PROFILE_NOT_FOUND' });

  const telefonoNormalizado = await validarTelefonoDisponible({ organizationId: req.organization._id, telefono, excludeId: estudiante._id });

  estudiante.nombre = nombre;
  estudiante.telefono = telefono;
  estudiante.telefonoNormalizado = telefonoNormalizado || undefined;
  estudiante.programa = programa;
  estudiante.semestre = semestre;
  estudiante.usuario = req.user._id;
  estudiante.perfilCompletado = true;
  estudiante.perfilCompletadoEn = estudiante.perfilCompletadoEn || new Date();
  await estudiante.save();
  await User.updateOne({ _id: req.user._id }, { $set: { nombre } });

  res.json({ ok: true, data: { estudiante, mensaje: 'Los datos de tu ficha se guardaron correctamente. Puedes volver a editarlos cuando necesites corregir algo.' } });
});

module.exports = { obtenerMiFicha, actualizarMiFicha };
