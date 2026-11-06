const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { env } = require('../src/config/env');
const User = require('../src/models/User');

const demo = [
  ['Admin Demo TaskFlow', 'admin.demo@taskflow.test', 'administrador'],
  ['Tutor Demo Uno', 'tutor1.demo@taskflow.test', 'tutor'],
  ['Tutor Demo Dos', 'tutor2.demo@taskflow.test', 'tutor'],
  ['Estudiante Demo Uno', 'estudiante1.demo@taskflow.test', 'estudiante'],
  ['Estudiante Demo Dos', 'estudiante2.demo@taskflow.test', 'estudiante'],
];

(async () => {
  await mongoose.connect(env.mongoUri);
  await User.init();
  const resultado = [];
  for (const [nombre, email, role] of demo) {
    let usuario = await User.findOne({ email });
    let accion = 'ya_existia';
    if (!usuario) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      usuario = await User.create({ nombre, email, role, passwordHash });
      accion = 'creado';
    }
    resultado.push({ id: String(usuario._id), nombre: usuario.nombre, email: usuario.email, role: usuario.role, accion, createdAt: usuario.createdAt });
  }
  const consulta = await User.find({ email: { $in: demo.map(x => x[1]) } })
    .select('_id nombre email role createdAt updatedAt')
    .sort({ role: 1, email: 1 })
    .lean();
  const salida = {
    baseDatos: mongoose.connection.name,
    coleccion: User.collection.name,
    totalEncontrados: consulta.length,
    usuarios: consulta.map(u => ({ id: String(u._id), nombre: u.nombre, email: u.email, role: u.role, createdAt: u.createdAt, updatedAt: u.updatedAt })),
    acciones: resultado
  };
  console.log(JSON.stringify(salida, null, 2));
  await mongoose.disconnect();
})().catch(async error => {
  console.error(error.message);
  if (mongoose.connection.readyState) await mongoose.disconnect();
  process.exit(1);
});
