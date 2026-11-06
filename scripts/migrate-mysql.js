const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { conectarMySQL, obtenerPoolMySQL, desconectarMySQL } = require('../src/config/mysql');

async function main() {
  await conectarMySQL();
  const pool = obtenerPoolMySQL();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) NOT NULL PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const dir = path.join(__dirname, '..', 'database', 'mysql', 'migrations');
  const files = (await fs.readdir(dir)).filter((f) => /^\d+_[\w-]+\.sql$/.test(f)).sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(dir, file), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const [existing] = await pool.execute('SELECT checksum FROM schema_migrations WHERE version = ?', [file]);
    if (existing.length) {
      if (existing[0].checksum !== checksum) throw new Error(`La migracion aplicada ${file} fue modificada; crea una nueva migracion.`);
      console.log(`[mysql:migrate] Ya aplicada: ${file}`);
      continue;
    }
    const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const [index, statement] of statements.entries()) {
        try { await connection.query(statement); }
        catch (error) { console.error(`[mysql:migrate] Fallo en sentencia ${index + 1}: ${statement.slice(0, 180).replace(/\s+/g, ' ')}`); throw error; }
      }
      await connection.execute('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)', [file, checksum]);
      await connection.commit();
      console.log(`[mysql:migrate] Aplicada: ${file}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  const [tables] = await pool.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'academic_%' ORDER BY TABLE_NAME");
  console.log(`[mysql:migrate] Tablas academicas disponibles: ${tables.map((t) => t.TABLE_NAME).join(', ')}`);
}

main().catch((error) => {
  console.error('[mysql:migrate] Error:', error.code || error.message);
  process.exitCode = 1;
}).finally(async () => {
  await desconectarMySQL().catch(() => {});
});
