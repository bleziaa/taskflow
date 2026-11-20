const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const config = path.join(root, '.env');

if (!fs.existsSync(config)) {
  const secret = randomBytes(32).toString('hex');
  fs.writeFileSync(config, [
    'MONGODB_URI=mongodb://127.0.0.1:27017/taskflow',
    'SESSION_SECRET=' + secret,
    'PORT=3000',
    'MYSQL_ENABLED=false',
    ''
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Se creó la configuración local en .env.');
}

process.env.TASKFLOW_HOST ||= '127.0.0.1';
const { env } = require('../src/config/env');

async function main() {
  const server = await require('../src/server').iniciar();
  server.once('error', error => {
    console.error('No se pudo abrir el puerto de TaskFlow. ' + error.message);
    process.exit(1);
  });
  if (process.argv.includes('--no-browser')) return;
  server.once('listening', () => {
    const url = 'http://127.0.0.1:' + server.address().port;
    const executable = process.platform === 'win32' ? 'rundll32.exe' : 'xdg-open';
    const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
    const browser = spawn(executable, args, { stdio: 'ignore', windowsHide: true });
    browser.on('error', () => console.log('Abre ' + url + ' en el navegador.'));
    browser.unref();
  });
}

main().catch(error => {
  console.error('TaskFlow no inició. Comprueba que MongoDB esté en ejecución y revisa .env.');
  console.error(error.message);
  process.exitCode = 1;
});
