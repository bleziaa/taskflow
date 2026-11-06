const mongoose = require('mongoose');

const ROLES = ['administrador', 'tutor', 'estudiante'];
const membershipSchema = new mongoose.Schema({
  organizacion: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ROLES, required: true },
  estado: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
  asignadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

membershipSchema.index({ organizacion: 1, usuario: 1 }, { unique: true });
membershipSchema.index({ usuario: 1, estado: 1 });
membershipSchema.statics.ROLES = ROLES;
module.exports = mongoose.model('OrganizationMembership', membershipSchema);
