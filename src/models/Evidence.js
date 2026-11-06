const mongoose = require('mongoose');
const evidenceSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, default: null },
  actividad: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
  estudiante: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  nombreOriginal: { type: String, required: true, maxlength: 180 },
  nombreAlmacenado: { type: String, required: true, unique: true },
  mimeType: { type: String, required: true },
  tamano: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
  estado: { type: String, enum: ['pendiente', 'aprobada', 'requiere_cambios'], default: 'pendiente' },
  observacionTutor: { type: String, trim: true, default: '', maxlength: 2000 },
  revisadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revisadoEn: { type: Date, default: null },
}, { timestamps: true });
evidenceSchema.index({ actividad: 1, createdAt: -1 });
module.exports = mongoose.model('Evidence', evidenceSchema);
