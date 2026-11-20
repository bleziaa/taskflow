const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { once } = require('node:events');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const socket = net.createServer().listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const { port } = socket.address();
  socket.close();
  await once(socket, 'close');

  const mongo = await MongoMemoryServer.create();
  const root = path.resolve('dist/TaskFlow');
  const config = path.join(root, '.env');
  fs.writeFileSync(config, [
    'MONGODB_URI=' + mongo.getUri(),
    'SESSION_SECRET=' + randomBytes(32).toString('hex'),
    'PORT=' + port,
    'MYSQL_ENABLED=false', ''
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  const runtime = process.platform === 'win32' ? 'node.exe' : 'node';
  const child = spawn(path.join(root, 'runtime', runtime), ['scripts/start-local.js', '--no-browser'],
    { cwd: root, stdio: 'inherit' });
  const exit = once(child, 'exit');
  try {
    const url = 'http://127.0.0.1:' + port;
    for (let attempt = 0; attempt < 80 && child.exitCode === null; attempt++) {
      const health = await fetch(url + '/api/health').catch(() => null);
      if (health?.ok) {
        const login = await fetch(url + '/login.html');
        const script = await fetch(url + '/js/auth.js');
        if (!login.ok || !script.ok) throw new Error('Faltan recursos web en el paquete.');
        console.log('Paquete verificado por HTTP: salud, formulario de inicio de sesión y recursos estáticos.');
        return;
      }
      await delay(250);
    }
    throw new Error('El servidor empaquetado no respondió correctamente.');
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await exit;
    }
    fs.unlinkSync(config);
    await mongo.stop();
  }
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
