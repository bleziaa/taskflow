const Student = require('../models/Student');
const ApiError = require('./ApiError');

function normalizarTelefono(value) {
  let digits = String(value || '').replace(/\D/g, '');
  // En Colombia, 3001234567 y +57 3001234567 representan el mismo número.
  if (digits.length === 12 && digits.startsWith('57')) digits = digits.slice(2);
  return digits || null;
}

async function validarTelefonoDisponible({ organizationId, telefono, excludeId = null }) {
  const telefonoNormalizado = normalizarTelefono(telefono);
  if (!telefonoNormalizado || !organizationId) return telefonoNormalizado;
  const filtro = { organizationId, telefonoNormalizado };
  if (excludeId) filtro._id = { $ne: excludeId };
  const existente = await Student.exists(filtro);
  if (existente) {
    throw new ApiError(409, 'Este número de teléfono ya está registrado en otra ficha de estudiante de esta institución. Verifica el número o utiliza uno diferente.', {
      code: 'PHONE_ALREADY_REGISTERED',
    });
  }
  return telefonoNormalizado;
}

module.exports = { normalizarTelefono, validarTelefonoDisponible };
