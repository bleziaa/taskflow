const { obtenerPoolMySQL } = require('../config/mysql');
const { mapStudent, mapCompany } = require('./academic-mappers');

function filtros({ organizationId, estado, q } = {}) {
  if (!organizationId) throw new TypeError('organizationId es obligatorio para consultar estudiantes.');
  const where = ['s.organization_id = ?'];
  const values = [String(organizationId)];
  if (['activo', 'inactivo'].includes(estado)) { where.push('s.status = ?'); values.push(estado); }
  if (q) {
    where.push('(s.full_name LIKE ? OR s.student_code LIKE ? OR s.email LIKE ?)');
    const term = `%${String(q).trim().slice(0, 80)}%`;
    values.push(term, term, term);
  }
  return { where: where.join(' AND '), values };
}

const SELECT = `SELECT s.*, c.id AS c_id, c.organization_id AS c_organization_id, c.legal_name AS c_legal_name,
 c.tax_id AS c_tax_id, c.sector AS c_sector, c.address AS c_address, c.city AS c_city,
 c.contact_name AS c_contact_name, c.contact_email AS c_contact_email, c.phone AS c_phone,
 c.status AS c_status, c.created_at AS c_created_at, c.updated_at AS c_updated_at
 FROM academic_students s LEFT JOIN academic_companies c
 ON c.id = s.company_id AND c.organization_id = s.organization_id`;
function rowCompany(row) {
  return row.c_id ? {
    id: row.c_id, organization_id: row.c_organization_id, legal_name: row.c_legal_name,
    tax_id: row.c_tax_id, sector: row.c_sector, address: row.c_address, city: row.c_city,
    contact_name: row.c_contact_name, contact_email: row.c_contact_email, phone: row.c_phone,
    status: row.c_status, created_at: row.c_created_at, updated_at: row.c_updated_at,
  } : null;
}
function mapJoined(row) { return mapStudent(row, rowCompany(row)); }

async function listar({ organizationId, estado, q, executor } = {}) {
  const db = executor || obtenerPoolMySQL();
  const f = filtros({ organizationId, estado, q });
  const [rows] = await db.execute(`${SELECT} WHERE ${f.where} ORDER BY s.created_at DESC LIMIT 200`, f.values);
  return rows.map(mapJoined);
}

async function obtenerPorId(id, organizationId, executor) {
  if (!organizationId) throw new TypeError('organizationId es obligatorio para consultar estudiantes.');
  const db = executor || obtenerPoolMySQL();
  const [rows] = await db.execute(`${SELECT} WHERE s.id = ? AND s.organization_id = ? LIMIT 1`, [String(id), String(organizationId)]);
  return rows[0] ? mapJoined(rows[0]) : null;
}

async function crear(data, executor) {
  const db = executor || obtenerPoolMySQL();
  const organizationId = String(data.organizationId || '');
  if (!organizationId) throw new TypeError('organizationId es obligatorio para crear estudiantes.');
  const id = String(data._id || '');
  if (!/^[a-f\d]{24}$/i.test(id)) throw new TypeError('El ID de estudiante debe ser un ObjectId de 24 caracteres.');
  await db.execute(`INSERT INTO academic_students
    (id, organization_id, student_code, full_name, email, phone, program, semester, status, user_id, company_id, tutor_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, organizationId, String(data.codigo || '').trim().toUpperCase(), String(data.nombre || '').trim(),
    String(data.email || '').trim().toLowerCase(), String(data.telefono || ''),
    String(data.programa || 'Ingeniería de Software').trim(), Number(data.semestre), data.estado || 'activo',
    data.usuario || null, data.empresa || null, data.tutor || null,
  ]);
  return obtenerPorId(id, organizationId, db);
}

async function actualizar(id, organizationId, changes, executor) {
  if (!organizationId) throw new TypeError('organizationId es obligatorio para actualizar estudiantes.');
  const columns = { codigo: 'student_code', nombre: 'full_name', email: 'email', telefono: 'phone', programa: 'program', semestre: 'semester', estado: 'status', empresa: 'company_id', tutor: 'tutor_user_id', usuario: 'user_id' };
  const sets = []; const values = [];
  for (const [field, column] of Object.entries(columns)) {
    if (Object.prototype.hasOwnProperty.call(changes, field)) {
      sets.push(`${column} = ?`);
      let value = changes[field];
      if (field === 'codigo') value = String(value).trim().toUpperCase();
      if (field === 'email') value = String(value).trim().toLowerCase();
      if (value === '') value = null;
      values.push(value);
    }
  }
  if (!sets.length) return obtenerPorId(id, organizationId, executor);
  const db = executor || obtenerPoolMySQL();
  values.push(String(id), String(organizationId));
  const [result] = await db.execute(`UPDATE academic_students SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`, values);
  if (!result.affectedRows) return null;
  return obtenerPorId(id, organizationId, db);
}

async function eliminar(id, organizationId, executor) {
  if (!organizationId) throw new TypeError('organizationId es obligatorio para eliminar estudiantes.');
  const db = executor || obtenerPoolMySQL();
  const [result] = await db.execute('DELETE FROM academic_students WHERE id = ? AND organization_id = ?', [String(id), String(organizationId)]);
  return result.affectedRows > 0;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
