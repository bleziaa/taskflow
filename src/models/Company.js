const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, default: null },
  razonSocial: { type: String, required: true, trim: true, minlength: 2, maxlength: 140 },
  nit: { type: String, required: true, trim: true, maxlength: 30 },
  sector: { type: String, trim: true, default: '', maxlength: 100 },
  direccion: { type: String, trim: true, default: '', maxlength: 180 },
  ciudad: { type: String, required: true, trim: true, maxlength: 100 },
  contactoNombre: { type: String, trim: true, default: '', maxlength: 120 },
  contactoEmail: { type: String, trim: true, lowercase: true, default: '', maxlength: 254 },
  telefono: { type: String, trim: true, default: '', maxlength: 25 },
  estado: { type: String, enum: ['activa', 'inactiva'], default: 'activa' },
}, { timestamps: true });

companySchema.index({ organizationId: 1, nit: 1 }, { unique: true, partialFilterExpression: { organizationId: { $type: 'objectId' } } });
companySchema.index({ razonSocial: 'text', nit: 'text', ciudad: 'text' });

module.exports = mongoose.model('Company', companySchema);
