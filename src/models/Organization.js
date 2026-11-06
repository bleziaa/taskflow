const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, minlength: 2, maxlength: 140 },
  codigo: { type: String, required: true, trim: true, uppercase: true, minlength: 3, maxlength: 30, unique: true },
  descripcion: { type: String, trim: true, default: '', maxlength: 1000 },
  emailContacto: { type: String, trim: true, lowercase: true, default: '', maxlength: 254 },
  telefono: { type: String, trim: true, default: '', maxlength: 25 },
  direccion: { type: String, trim: true, default: '', maxlength: 180 },
  ciudad: { type: String, trim: true, default: '', maxlength: 100 },
  estado: { type: String, enum: ['activa', 'inactiva'], default: 'activa', index: true },
  adminGuardLockOwner: { type: String, select: false },
  adminGuardLockAt: { type: Date, select: false },
  adminGuardLockProcessId: { type: Number, select: false },
  adminGuardLockHost: { type: String, select: false },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });

organizationSchema.index({ nombre: 'text', codigo: 'text', ciudad: 'text' });
module.exports = mongoose.model('Organization', organizationSchema);
