const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, default: null },
  codigo: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
  nombre: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  telefono: { type: String, trim: true, default: '', maxlength: 25 },
  programa: { type: String, required: true, trim: true, maxlength: 120 },
  semestre: { type: Number, required: true, min: 1, max: 12 },
  estado: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: undefined },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

studentSchema.index({ organizationId: 1, codigo: 1 }, { unique: true, partialFilterExpression: { organizationId: { $type: 'objectId' } } });
studentSchema.index({ organizationId: 1, email: 1 }, { unique: true, partialFilterExpression: { organizationId: { $type: 'objectId' } } });
studentSchema.index({ nombre: 'text', codigo: 'text', email: 'text' });

module.exports = mongoose.model('Student', studentSchema);
