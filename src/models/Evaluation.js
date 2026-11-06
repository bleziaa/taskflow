const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, default: null },
  practica: { type: mongoose.Schema.Types.ObjectId, ref: 'Practice', required: true },
  estudiante: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  calificacion: { type: Number, required: true, min: 0, max: 5 },
  concepto: { type: String, required: true, enum: ['excelente', 'bueno', 'satisfactorio', 'insuficiente'] },
  fortalezas: { type: String, trim: true, default: '', maxlength: 2000 },
  aspectosMejora: { type: String, trim: true, default: '', maxlength: 2000 },
  observaciones: { type: String, trim: true, default: '', maxlength: 3000 },
  evaluadoEn: { type: Date, default: Date.now },
}, { timestamps: true });

evaluationSchema.index({ organizationId: 1, practica: 1 }, { unique: true, partialFilterExpression: { organizationId: { $type: 'objectId' } } });
evaluationSchema.index({ tutor: 1, evaluadoEn: -1 });
module.exports = mongoose.model('Evaluation', evaluationSchema);
