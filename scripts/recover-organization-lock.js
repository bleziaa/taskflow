/**
 * Diagnostica bloqueos administrativos por organización.
 * Por defecto es SOLO LECTURA. Solo libera bloqueos nuevos si el proceso
 * propietario está en este host y se ha comprobado que ya no existe.
 * Uso:
 *   node scripts/recover-organization-lock.js
 *   node scripts/recover-organization-lock.js --organization <ObjectId>
 *   node scripts/recover-organization-lock.js --release --organization <ObjectId> --confirm <mismo-ObjectId>
 */
const mongoose = require('mongoose');
const os = require('node:os');
const { conectarDB, desconectarDB } = require('../src/config/db');
const Organization = require('../src/models/Organization');

const args = process.argv.slice(2);
function arg(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; }
function has(name) { return args.includes(name); }

async function processIsAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; if (error.code === 'EPERM') return true; throw error; }
}

async function main() {
  const organizationId = arg('--organization');
  const releasing = has('--release');
  const confirmation = arg('--confirm');
  if (releasing && (!organizationId || confirmation !== organizationId)) {
    throw new Error('Para liberar, indica --organization ID --release --confirm ID (el mismo ObjectId exacto).');
  }
  if (organizationId && !mongoose.isValidObjectId(organizationId)) throw new Error('ObjectId de organización inválido.');

  await conectarDB();
  const filter = organizationId ? { _id: organizationId } : { adminGuardLockOwner: { $exists: true } };
  const organizations = await Organization.find(filter)
    .select('+adminGuardLockOwner +adminGuardLockAt +adminGuardLockProcessId +adminGuardLockHost nombre codigo')
    .lean();

  if (!organizations.length) {
    console.log(JSON.stringify({ mode: releasing ? 'RELEASE' : 'READ_ONLY', locksFound: 0, message: 'No se encontraron bloqueos.' }, null, 2));
    return;
  }

  const results = [];
  for (const organization of organizations) {
    if (!organization.adminGuardLockOwner) {
      results.push({ organizationId: String(organization._id), nombre: organization.nombre, locked: false, action: 'NONE' });
      continue;
    }
    const result = {
      organizationId: String(organization._id), nombre: organization.nombre,
      codigo: organization.codigo, locked: true,
      lockedAt: organization.adminGuardLockAt || null,
      owner: organization.adminGuardLockOwner,
      processId: organization.adminGuardLockProcessId || null,
      host: organization.adminGuardLockHost || null,
    };

    if (!releasing) {
      result.action = 'INSPECT_ONLY';
      if (!organization.adminGuardLockProcessId || !organization.adminGuardLockHost) result.warning = 'Bloqueo antiguo sin metadatos de proceso; requiere mantenimiento manual con todas las instancias detenidas.';
      else if (organization.adminGuardLockHost !== os.hostname()) result.warning = 'El proceso pertenece a otro host; verificarlo en ese host. No se libera desde aquí.';
      else result.processAlive = await processIsAlive(organization.adminGuardLockProcessId);
    } else {
      if (String(organization._id) !== organizationId) throw new Error('La liberación requiere una única organización exacta.');
      if (!organization.adminGuardLockProcessId || !organization.adminGuardLockHost) throw new Error('Bloqueo legado sin PID/host: no se libera automáticamente. Detén todas las instancias y realiza revisión manual controlada.');
      if (organization.adminGuardLockHost !== os.hostname()) throw new Error('El propietario está en otro host. Ejecuta el diagnóstico allí; no se libera.');
      if (await processIsAlive(organization.adminGuardLockProcessId)) throw new Error(`El proceso propietario PID ${organization.adminGuardLockProcessId} sigue activo. No se libera.`);
      const filterExact = {
        _id: organization._id,
        adminGuardLockOwner: organization.adminGuardLockOwner,
        adminGuardLockProcessId: organization.adminGuardLockProcessId,
        adminGuardLockHost: organization.adminGuardLockHost,
        adminGuardLockAt: organization.adminGuardLockAt,
      };
      const update = await Organization.updateOne(filterExact, { $unset: {
        adminGuardLockOwner: 1, adminGuardLockAt: 1,
        adminGuardLockProcessId: 1, adminGuardLockHost: 1,
      } });
      if (update.modifiedCount !== 1) throw new Error('El bloqueo cambió durante la revisión; no se modificó. Repite el diagnóstico.');
      result.action = 'RELEASED_CONFIRMED_DEAD_OWNER';
    }
    results.push(result);
  }
  console.log(JSON.stringify({ mode: releasing ? 'GUARDED_RELEASE' : 'READ_ONLY', currentHost: os.hostname(), locksFound: results.filter(x => x.locked).length, results }, null, 2));
}

main().catch(error => { console.error('[organization-lock-recovery]', error.message); process.exitCode = 1; })
  .finally(async () => { await desconectarDB(); });
