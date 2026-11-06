/**
 * Configuracion central de variables de entorno.
 *
 * Carga el archivo .env desde la raiz del proyecto y expone un objeto
 * con valores ya normalizados. Tambien valida que las variables
 * obligatorias existan antes de arrancar el servidor.
 */
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env'), quiet: true });

const VARIABLES_OBLIGATORIAS = ['MONGODB_URI', 'SESSION_SECRET'];

/**
 * Lanza un error claro si falta alguna variable obligatoria.
 * Se ejecuta al arrancar el servidor, no al importar el modulo,
 * para que las pruebas puedan definir sus propias variables.
 */
function validarEntorno() {
  const faltantes = VARIABLES_OBLIGATORIAS.filter((clave) => !process.env[clave]);

  if (faltantes.length > 0) {
    throw new Error(
      `Faltan variables de entorno obligatorias: ${faltantes.join(', ')}. ` +
        'Revisa tu archivo .env (puedes basarte en .env.example).'
    );
  }
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI,
  mysql: {
    enabled: process.env.MYSQL_ENABLED === 'true',
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || '',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'taskflow_relational',
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT) || 5,
  },
  sessionName: process.env.SESSION_NAME || 'taskflow.sid',
  sessionSecret: process.env.SESSION_SECRET,
  sessionMaxAgeMs: Number(process.env.SESSION_MAX_AGE_MS) || 86_400_000,
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  },
};

module.exports = { env, validarEntorno };
