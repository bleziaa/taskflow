const mongoose = require('mongoose');

const ROLES = ['administrador', 'tutor', 'estudiante'];

const userSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'estudiante' },
    activo: { type: Boolean, default: true },
    debeCambiarPassword: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.pre('validate', function normalizarRolAntiguo() {
  if (this.role === 'user') this.role = 'estudiante';
  if (this.role === 'admin') this.role = 'administrador';
});
userSchema.statics.ROLES = ROLES;

module.exports = mongoose.model('User', userSchema);
