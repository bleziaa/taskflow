const mongoose = require('mongoose');

const moduloAcademicoSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  descripcion: { type: String, trim: true, default: '', maxlength: 1000 },
  ponderacion: { type: Number, required: true, min: 0, max: 100 },
  orden: { type: Number, required: true, min: 1, max: 20 },
}, { _id: true });

const historialEstructuraSchema = new mongoose.Schema({
  modulos: { type: [moduloAcademicoSchema], default: [] },
  motivo: { type: String, required: true, trim: true, maxlength: 500 },
  modificadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  modificadoEn: { type: Date, default: Date.now },
}, { _id: false });

const practiceSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, default: null },
  estudiante: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  titulo: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  objetivo: { type: String, trim: true, default: '', maxlength: 2000 },
  fechaInicio: { type: Date, required: true },
  fechaFin: { type: Date, required: true },
  estado: { type: String, enum: ['planificada', 'en_curso', 'finalizada', 'suspendida'], default: 'planificada' },
  observaciones: { type: String, trim: true, default: '', maxlength: 2000 },
  estructuraAcademica: { type: [moduloAcademicoSchema], default: [] },
  historialEstructuraAcademica: { type: [historialEstructuraSchema], default: [] },
  estructuraActualizadaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  estructuraActualizadaEn: { type: Date, default: null },
}, { timestamps: true });

practiceSchema.index({ estudiante: 1, fechaInicio: -1 });
practiceSchema.index({ tutor: 1, estado: 1 });
practiceSchema.index({ empresa: 1, estado: 1 });

module.exports = mongoose.model('Practice', practiceSchema);
