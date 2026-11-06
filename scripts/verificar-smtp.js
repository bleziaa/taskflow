const nodemailer = require('nodemailer');
const { env } = require('../src/config/env');

async function main() {
  const s = env.smtp;
  if (!s.host || !s.user || !s.pass) {
    console.error('SMTP incompleto. Configura SMTP_PASS en el archivo .env.');
    process.exitCode = 2;
    return;
  }
  const transporter = nodemailer.createTransport({
    host: s.host, port: s.port, secure: s.secure,
    auth: { user: s.user, pass: s.pass },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  try {
    await transporter.verify();
    console.log('SMTP verificado: conexión y autenticación correctas. No se envió ningún correo.');
  } catch (error) {
    console.error('No se pudo verificar SMTP:', error.code || error.name || 'SMTP_ERROR');
    process.exitCode = 1;
  } finally {
    transporter.close();
  }
}
main();
