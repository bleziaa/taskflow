const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { env, validarEntorno } = require('../src/config/env');
const User = require('../src/models/User');

async function main() {
  validarEntorno();

  const nombre = String(process.env.ADMIN_NAME || '').trim();
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (!nombre || !email || password.length < 12) {
    throw new Error('Define ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 12 caracteres) antes de ejecutar el comando.');
  }

  await mongoose.connect(env.mongoUri);
  await User.init();

  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error('Ya existe una cuenta con ese correo. No se modificó su rol ni su contraseña.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ nombre, email, passwordHash, role: 'administrador' });
  console.log('Cuenta de administrador creada correctamente para: ' + email);
}

main()
  .catch((error) => {
    console.error('[create-admin]', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
