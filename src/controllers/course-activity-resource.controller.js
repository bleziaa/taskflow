const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { conectarMySQL, obtenerPoolMySQL } = require('../config/mysql');
const { STORAGE_DIR } = require('../middleware/courseActivityResourceUpload');

const id = () => crypto.randomBytes(12).toString('hex');
const validId = value => /^[a-f0-9]{24}$/i.test(String(value || ''));

async function context(req, courseId, activityId, teacherOnly = false) {
  if (!validId(courseId) || !validId(activityId)) throw new ApiError(400, 'Identificador de curso o actividad inválido.', { code: 'INVALID_RESOURCE_CONTEXT' });
  await conectarMySQL();
  const pool = obtenerPoolMySQL();
  const orgId = String(req.organization._id);
  const userId = String(req.user._id);
  const role = req.organizationMembership.role;
  const [rows] = await pool.execute(
    'SELECT a.id, a.title, a.status FROM academic_course_activities a JOIN academic_courses c ON c.organization_id=a.organization_id AND c.id=a.course_id WHERE a.organization_id=? AND a.course_id=? AND a.id=? AND c.status=\'activo\' LIMIT 1',
    [orgId, courseId, activityId]
  );
  if (!rows.length) throw new ApiError(404, 'No se encontró la actividad del curso.', { code: 'COURSE_ACTIVITY_NOT_FOUND' });
  if (role === 'tutor') {
    const [assigned] = await pool.execute("SELECT id FROM academic_course_teachers WHERE organization_id=? AND course_id=? AND teacher_user_id=? AND status='activo' LIMIT 1", [orgId, courseId, userId]);
    if (!assigned.length) throw new ApiError(403, 'Este curso no está asignado a tu perfil docente.', { code: 'COURSE_NOT_ASSIGNED' });
  } else if (role === 'estudiante' && !teacherOnly) {
    const [enrolled] = await pool.execute("SELECT cs.id FROM academic_course_students cs JOIN academic_students s ON s.organization_id=cs.organization_id AND s.id=cs.student_id WHERE cs.organization_id=? AND cs.course_id=? AND s.user_id=? AND cs.status='activo' LIMIT 1", [orgId, courseId, userId]);
    if (!enrolled.length || rows[0].status !== 'publicada') throw new ApiError(403, 'No tienes acceso a los materiales de esta actividad.', { code: 'COURSE_NOT_ENROLLED' });
  } else {
    throw new ApiError(403, 'Solo el docente asignado puede gestionar materiales.', { code: 'RESOURCE_FORBIDDEN' });
  }
  return { pool, orgId, userId };
}

const subir = asyncHandler(async (req, res) => {
  let keep = false;
  try {
    if (!req.file) throw new ApiError(400, 'Selecciona un PDF para adjuntar.', { code: 'FILE_REQUIRED' });
    const { pool, orgId, userId } = await context(req, req.params.courseId, req.params.activityId, true);
    const handle = await fs.open(req.file.path, 'r');
    let valid = false;
    try { const buffer = Buffer.alloc(5); const read = await handle.read(buffer, 0, 5, 0); valid = read.bytesRead === 5 && buffer.toString() === '%PDF-'; }
    finally { await handle.close(); }
    if (!valid) throw new ApiError(415, 'El archivo no contiene un PDF válido.', { code: 'FILE_SIGNATURE_INVALID' });
    const title = String(req.body.title || path.basename(req.file.originalname, '.pdf')).trim().slice(0, 160);
    const description = String(req.body.description || '').trim().slice(0, 1000);
    if (title.length < 2) throw new ApiError(400, 'Escribe un nombre para el material.', { code: 'INVALID_RESOURCE_TITLE' });
    const resourceId = id();
    await pool.execute(
      'INSERT INTO academic_course_activity_resources (id, organization_id, course_id, activity_id, title, description, original_name, stored_name, mime_type, file_size_bytes, uploaded_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [resourceId, orgId, req.params.courseId, req.params.activityId, title, description, path.basename(req.file.originalname).replace(/[\\r\\n\\"]/g, '_').slice(0, 180), path.basename(req.file.filename), 'application/pdf', req.file.size, userId]
    );
    keep = true;
    res.status(201).json({ ok: true, data: { resource: { id: resourceId, title, description } } });
  } finally {
    if (req.file && !keep) await fs.unlink(req.file.path).catch(() => {});
  }
});

const descargar = asyncHandler(async (req, res) => {
  const { pool, orgId } = await context(req, req.params.courseId, req.params.activityId, false);
  const [rows] = await pool.execute(
    'SELECT original_name, stored_name FROM academic_course_activity_resources WHERE organization_id=? AND course_id=? AND activity_id=? AND id=? LIMIT 1',
    [orgId, req.params.courseId, req.params.activityId, req.params.resourceId]
  );
  if (!rows.length) throw new ApiError(404, 'No se encontró el material solicitado.', { code: 'RESOURCE_NOT_FOUND' });
  const stored = rows[0].stored_name;
  if (!/^[a-f0-9]{24}\\.pdf$/i.test(stored)) throw new ApiError(404, 'La referencia del archivo no es válida.', { code: 'RESOURCE_FILE_INVALID' });
  const full = path.resolve(STORAGE_DIR, stored);
  if (path.dirname(full) !== path.resolve(STORAGE_DIR)) throw new ApiError(404, 'Archivo no encontrado.', { code: 'FILE_NOT_FOUND' });
  try { await fs.access(full); } catch { throw new ApiError(404, 'El PDF ya no está disponible.', { code: 'FILE_NOT_FOUND' }); }
  res.download(full, rows[0].original_name, { headers: { 'Content-Type': 'application/pdf', 'X-Content-Type-Options': 'nosniff' } });
});

module.exports = { subir, descargar };
