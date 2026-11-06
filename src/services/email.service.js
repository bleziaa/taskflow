const nodemailer = require('nodemailer');
const { env } = require('../config/env');

function configuracionCompleta() {
  const s = env.smtp;
  return Boolean(s.host && s.port && s.user && s.pass && s.from);
}

function escaparHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function enviarCredenciales({ nombre, email, passwordTemporal, organizacion }) {
  if (!configuracionCompleta()) return { status: 'not_configured' };
  const s = env.smtp;
  const transporter = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: s.user, pass: s.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    await transporter.sendMail({
      from: s.from,
      to: email,
      subject: 'Tu acceso a TaskFlow',
      text: `Hola ${nombre},\n\nSe creó tu cuenta de TaskFlow para ${organizacion}.\nCorreo: ${email}\nContraseña temporal: ${passwordTemporal}\n\nIngresa a TaskFlow y cambia esta contraseña en tu primer acceso. No compartas estas credenciales.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#24212d"><h1>Bienvenido a TaskFlow</h1><p>Hola ${escaparHtml(nombre)},</p><p>Se creó tu cuenta para <strong>${escaparHtml(organizacion)}</strong>.</p><p><strong>Correo:</strong> ${escaparHtml(email)}</p><p><strong>Contraseña temporal:</strong></p><p style="padding:14px;background:#f3f1f7;border-radius:8px;font-family:monospace;word-break:break-all">${escaparHtml(passwordTemporal)}</p><p>Al ingresar, TaskFlow te solicitará cambiar esta contraseña antes de continuar.</p><p>Por seguridad, no compartas este mensaje ni tus credenciales.</p></div>`,
    });
    return { status: 'sent' };
  } catch (error) {
    // No registrar credenciales ni contenido del mensaje.
    console.error('[email] No se pudo enviar el correo de alta:', error.code || error.name || 'SMTP_ERROR');
    return { status: 'failed' };
  } finally {
    transporter.close();
  }
}

module.exports = { enviarCredenciales, configuracionCompleta };
