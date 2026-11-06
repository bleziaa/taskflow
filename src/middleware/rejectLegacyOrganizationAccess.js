const ApiError = require('../utils/ApiError');
const Membership = require('../models/OrganizationMembership');

// Las cuentas vinculadas a una institución deben usar exclusivamente
// /api/organization/*, donde cada consulta se limita al tenant activo.
// No se permite volver a las rutas globales aunque limpien el contexto activo.
async function rejectLegacyOrganizationAccess(req, res, next) {
  try {
    if (!req.session || !req.session.userId) {
      return next(new ApiError(401, 'Debes iniciar sesión.', { code: 'UNAUTHORIZED' }));
    }
    const linked = await Membership.exists({ usuario: req.session.userId });
    if (linked) {
      return next(new ApiError(409, 'Esta cuenta debe utilizar las rutas de su organización activa.', {
        code: 'ORGANIZATION_ROUTE_REQUIRED',
      }));
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = rejectLegacyOrganizationAccess;
