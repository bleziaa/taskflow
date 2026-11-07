const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  calificacion: { type: Number, min: 0, max: 5, default: null },
  observaciones: { type: String, trim: true, default: '', maxlength: 2000 },
  fortalezas: { type: String, trim: true, default: '', maxlength: 2000 },
  aspectosMejora: { type: String, trim: true, default: '', maxlength: 2000 },
  evaluadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  evaluadoEn: { type: Date, default: null },
}, { _id: false });

const selfAssessmentSchema = new mongoose.Schema({
  calificacion: { type: Number, min: 0, max: 5, default: null },
  reflexion: { type: String, trim: true, default: '', maxlength: 2000 },
  evaluadoEn: { type: Date, default: null },
}, { _id: false });

const activityChangeSchema = new mongoose.Schema({
  motivo: { type: String, trim: true, default: 'Actualización de actividad', maxlength: 500 },
  cambios: [{
    campo: { type: String, required: true, maxlength: 40 },
    valorAnterior: { type: String, default: '', maxlength: 3000 },
    valorNuevo: { type: String, default: '', maxlength: 3000 },
  }],
  modificadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  modificadoEn: { type: Date, default: Date.now },
}, { _id: true });

const activitySchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, default: null },
  practica: { type: mongoose.Schema.Types.ObjectId, ref: 'Practice', required: true, index: true },
  moduloAcademicoId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  titulo: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  descripcion: { type: String, trim: true, default: '', maxlength: 3000 },
  recurso: { nombreOriginal: { type: String, maxlength: 180 }, nombreAlmacenado: { type: String }, mimeType: { type: String }, tamano: { type: Number, min: 1, max: 10 * 1024 * 1024 } },
  fechaInicio: { type: Date, default: null },
  fechaLimite: { type: Date, required: true },
  historialModificaciones: { type: [activityChangeSchema], default: [] },
  prioridad: { type: String, enum: ['baja', 'media', 'alta'], default: 'media' },
  estado: { type: String, enum: ['pendiente', 'en_revision', 'completada'], default: 'pendiente' },
  autoevaluacion: { type: selfAssessmentSchema, default: () => ({}) },
  valoracionEmpresarial: { type: assessmentSchema, default: () => ({}) },
  evaluacionTutor: { type: assessmentSchema, default: () => ({}) },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
activitySchema.index({ practica: 1, moduloAcademicoId: 1, fechaLimite: 1 });
module.exports = mongoose.model('Activity', activitySchema);
