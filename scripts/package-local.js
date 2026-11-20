const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'dist', 'TaskFlow');
fs.mkdirSync(path.join(target, 'runtime'), { recursive: true });
const runtime = process.platform === 'win32' ? 'node.exe' : 'node';
fs.copyFileSync(process.execPath, path.join(target, 'runtime', runtime));
const license = path.resolve(path.dirname(process.execPath), process.platform === 'win32' ? 'LICENSE' : '../LICENSE');
if (fs.existsSync(license)) {
  fs.copyFileSync(license, path.join(target, 'runtime', 'LICENSE'));
}
for (const item of ['src', 'public', 'shared', 'database', 'scripts', 'documentacion',
                    'package.json', 'package-lock.json', '.env.example', 'README.md',
                    'WINDOWS.md', 'start-linux.sh', 'start-windows.cmd', 'start-windows.ps1']) {
  fs.cpSync(path.join(root, item), path.join(target, item), { recursive: true });
}
