const ApiError = require('../utils/ApiError');
const Membership = require('../models/OrganizationMembership');
const Organization = require('../models/Organization');
const User = require('../models/User');

function requireOrganization(...rolesPermitidos) {
  return async function validarContextoOrganizacional(req, res, next) {
    try {
      if (!req.session || !req.session.userId) {
        return next(new ApiError(401, 'Debes iniciar sesión.', { code: 'UNAUTHORIZED' }));
      }
      const organizationId = req.session.activeOrganizationId;
      if (!organizationId) {
        return next(new ApiError(409, 'Selecciona una organización para continuar.', { code: 'ORGANIZATION_CONTEXT_REQUIRED' }));
      }
      const [membership, user] = await Promise.all([
        Membership.findOne({ usuario: req.session.userId, organizacion: organizationId, estado: 'activo' }).lean(),
        User.findOne({ _id: req.session.userId, activo: { $ne: false } }),
      ]);
      if (!user) return next(new ApiError(401, 'La sesión ya no es válida.', { code: 'UNAUTHORIZED' }));
      if (!membership) {
        delete req.session.activeOrganizationId;
        return next(new ApiError(403, 'La membresía de esta organización no está activa.', { code: 'ORGANIZATION_ACCESS_DENIED' }));
      }
      const organization = await Organization.findOne({ _id: organizationId, estado: 'activa' }).lean();
      if (!organization) {
        delete req.session.activeOrganizationId;
        return next(new ApiError(403, 'La organización no está activa.', { code: 'ORGANIZATION_INACTIVE' }));
      }
      if (rolesPermitidos.length && !rolesPermitidos.includes(membership.role)) {
        return next(new ApiError(403, 'Tu rol no permite realizar esta acción en esta organización.', { code: 'ORGANIZATION_ROLE_FORBIDDEN' }));
      }
      // No mutar el documento Mongoose: el rol efectivo solo vive en esta request.
      req.user = { ...user.toObject(), role: membership.role };
      req.organization = organization;
      req.organizationMembership = membership;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = requireOrganization;
