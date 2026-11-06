const { obtenerPoolMySQL } = require('../config/mysql');
const { mapCompany } = require('./academic-mappers');

function filtros({ organizationId, estado, q } = {}) {
  if (!organizationId) throw new TypeError('organizationId es obligatorio para consultar empresas.');
  const where = ['organization_id = ?'];
  const values = [String(organizationId)];
  if (['activa', 'inactiva'].includes(estado)) { where.push('status = ?'); values.push(estado); }
  if (q) {
    where.push('(legal_name LIKE ? OR tax_id LIKE ? OR city LIKE ?)');
    const term = `%${String(q).trim().slice(0, 80)}%`;
    values.push(term, term, term);
  }
  return { where: where.join(' AND '), values };
}

async function listar({ organizationId, estado, q, executor } = {}) {
  const db = executor || obtenerPoolMySQL();
  const f = filtros({ organizationId, estado, q });
  const [rows] = await db.execute(`SELECT * FROM academic_companies WHERE ${f.where} ORDER BY legal_name ASC LIMIT 200`, f.values);
  return rows.map(mapCompany);
}

async function obtenerPorId(id, organizationId, executor) {
  if (!organizationId) throw new TypeError('organizationId es obligatorio para consultar empresas.');
  const db = executor || obtenerPoolMySQL();
  const [rows] = await db.execute('SELECT * FROM academic_companies WHERE id = ? AND organization_id = ? LIMIT 1', [String(id), String(organizationId)]);
  return mapCompany(rows[0]);
}

async function crear(data, executor) {
  const db = executor || obtenerPoolMySQL();
  const organizationId = String(data.organizationId || '');
  if (!organizationId) throw new TypeError('organizationId es obligatorio para crear empresas.');
  const id = String(data._id || '');
  if (!/^[a-f\d]{24}$/i.test(id)) throw new TypeError('El ID de empresa debe ser un ObjectId de 24 caracteres.');
  await db.execute(`INSERT INTO academic_companies
    (id, organization_id, legal_name, tax_id, sector, address, city, contact_name, contact_email, phone, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, organizationId, String(data.razonSocial || '').trim(), String(data.nit || '').trim(),
    String(data.sector || ''), String(data.direccion || ''), String(data.ciudad || '').trim(),
    String(data.contactoNombre || ''), String(data.contactoEmail || '').trim().toLowerCase(),
    String(data.telefono || ''), data.estado || 'activa',
  ]);
  return obtenerPorId(id, organizationId, db);
}

async function actualizar(id, organizationId, changes, executor) {
  if (!organizationId) throw new TypeError('organizationId es obligatorio para actualizar empresas.');
  const columns = { razonSocial: 'legal_name', nit: 'tax_id', sector: 'sector', direccion: 'address', ciudad: 'city', contactoNombre: 'contact_name', contactoEmail: 'contact_email', telefono: 'phone', estado: 'status' };
  const sets = []; const values = [];
  for (const [field, column] of Object.entries(columns)) {
    if (Object.prototype.hasOwnProperty.call(changes, field)) {
      sets.push(`${column} = ?`);
      values.push(field === 'contactoEmail' ? String(changes[field] || '').trim().toLowerCase() : changes[field]);
    }
  }
  if (!sets.length) return obtenerPorId(id, organizationId, executor);
  const db = executor || obtenerPoolMySQL();
  values.push(String(id), String(organizationId));
  const [result] = await db.execute(`UPDATE academic_companies SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`, values);
  if (!result.affectedRows) return null;
  return obtenerPorId(id, organizationId, db);
}

async function eliminar(id, organizationId, executor) {
  if (!organizationId) throw new TypeError('organizationId es obligatorio para eliminar empresas.');
  const db = executor || obtenerPoolMySQL();
  const [result] = await db.execute('DELETE FROM academic_companies WHERE id = ? AND organization_id = ?', [String(id), String(organizationId)]);
  return result.affectedRows > 0;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
