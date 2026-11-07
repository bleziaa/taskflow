const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { conectarMySQL, obtenerPoolMySQL } = require('../config/mysql');
const { STORAGE_DIR } = require('../middleware/courseActivityEvidenceUpload');

const newId = () => crypto.randomBytes(12).toString('hex');
const validId = value => /^[a-f0-9]{24}$/i.test(String(value || ''));
async function baseContext(req, courseId, activityId) {
  if (!validId(courseId) || !validId(activityId)) throw new ApiError(400, 'Identificador de curso o actividad inválido.', { code: 'INVALID_COURSE_ACTIVITY' });
  await conectarMySQL();
  const pool = obtenerPoolMySQL();
  const orgId = String(req.organization._id);
  const userId = String(req.user._id);
  const role = req.organizationMembership.role;
  const [activities] = await pool.execute(
    'SELECT a.id, a.title, a.status, a.opens_at, a.due_at, a.course_id FROM academic_course_activities a JOIN academic_courses c ON c.organization_id=a.organization_id AND c.id=a.course_id WHERE a.organization_id=? AND a.course_id=? AND a.id=? AND c.status=\'activo\' LIMIT 1',
    [orgId, courseId, activityId]
  );
  if (!activities.length) throw new ApiError(404, 'No se encontró la actividad.', { code: 'COURSE_ACTIVITY_NOT_FOUND' });
  let studentId = null;
  if (role === 'tutor') {
    const [assigned] = await pool.execute("SELECT id FROM academic_course_teachers WHERE organization_id=? AND course_id=? AND teacher_user_id=? AND status='activo' LIMIT 1", [orgId, courseId, userId]);
    if (!assigned.length) throw new ApiError(403, 'No tienes asignado este curso.', { code: 'COURSE_NOT_ASSIGNED' });
  } else if (role === 'estudiante') {
    const [students] = await pool.execute("SELECT s.id FROM academic_students s JOIN academic_course_students cs ON cs.organization_id=s.organization_id AND cs.student_id=s.id WHERE s.organization_id=? AND s.user_id=? AND cs.course_id=? AND cs.status='activo' AND s.status='activo' LIMIT 1", [orgId, userId, courseId]);
    if (!students.length) throw new ApiError(403, 'No estás matriculado en este curso.', { code: 'COURSE_NOT_ENROLLED' });
    studentId = students[0].id;
  } else throw new ApiError(403, 'Este espacio no está disponible para tu rol.', { code: 'COURSE_ROLE_FORBIDDEN' });
  return { pool, orgId, userId, role, studentId, courseId, activity: activities[0] };
}
async function checkFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const handle = await fs.open(file.path, 'r');
  try {
    const b = Buffer.alloc(8); const { bytesRead } = await handle.read(b, 0, 8, 0);
    if (ext === '.pdf') return bytesRead >= 5 && b.subarray(0, 5).toString() === '%PDF-';
    return bytesRead >= 4 && b[0] === 0x50 && b[1] === 0x4b;
  } finally { await handle.close(); }
}
const subir = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Selecciona un archivo para entregar.', { code: 'FILE_REQUIRED' });
  let keep = false;
  try {
    const ctx = await baseContext(req, req.params.courseId, req.params.activityId);
    if (ctx.role !== 'estudiante') throw new ApiError(403, 'Solo el estudiante puede entregar evidencias.', { code: 'STUDENT_UPLOAD_ONLY' });
    if (ctx.activity.status !== 'publicada') throw new ApiError(409, 'La actividad todavía no está publicada o ya fue cerrada.', { code: 'ACTIVITY_NOT_OPEN' });
    if (ctx.activity.opens_at && new Date(ctx.activity.opens_at) > new Date()) throw new ApiError(409, 'La actividad aún no está abierta.', { code: 'ACTIVITY_NOT_OPEN_YET' });
    if (!await checkFile(req.file)) throw new ApiError(415, 'El contenido del archivo no coincide con su formato.', { code: 'FILE_SIGNATURE_INVALID' });
    const [previous] = await ctx.pool.execute("SELECT id, status FROM academic_course_evidences WHERE organization_id=? AND activity_id=? AND student_id=? ORDER BY submitted_at DESC LIMIT 1", [ctx.orgId, ctx.activity.id, ctx.studentId]);
    if (previous.length && previous[0].status !== 'requiere_cambios') throw new ApiError(409, 'Ya entregaste esta actividad. Espera la revisión del docente o una solicitud de corrección.', { code: 'EVIDENCE_ALREADY_SUBMITTED' });
    const evidenceId = newId();
    const original = path.basename(req.file.originalname).replace(/[\\r\\n\\"]/g, '_').slice(0, 180);
    const [deadlineRows] = await ctx.pool.execute('SELECT due_at FROM academic_course_activity_student_deadlines WHERE organization_id=? AND activity_id=? AND student_id=? LIMIT 1', [ctx.orgId, ctx.activity.id, ctx.studentId]);
    const effectiveDueAt = deadlineRows[0]?.due_at || ctx.activity.due_at;
    const isLate = effectiveDueAt ? new Date() > new Date(effectiveDueAt) : false;
    await ctx.pool.execute(
      'INSERT INTO academic_course_evidences (id, organization_id, activity_id, student_id, original_name, stored_name, mime_type, file_size_bytes, status, teacher_feedback, reviewed_by_user_id, reviewed_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'pendiente\', NULL, NULL, NULL, CURRENT_TIMESTAMP(3))',
      [evidenceId, ctx.orgId, ctx.activity.id, ctx.studentId, original, path.basename(req.file.filename), req.file.mimetype, req.file.size]
    );
    keep = true;
    res.status(201).json({ ok: true, data: { evidence: { id: evidenceId, originalName: original, status: 'pendiente', late: isLate } } });
  } finally { if (!keep) await fs.unlink(req.file.path).catch(() => {}); }
});
const listar = asyncHandler(async (req, res) => {
  const ctx = await baseContext(req, req.params.courseId, req.params.activityId);
  const whereStudent = ctx.role === 'estudiante' ? ' AND s.id=?' : '';
  const [rows] = await ctx.pool.execute(
    `SELECT
      e.id AS evidence_id, s.id AS student_id, s.full_name AS student_name, s.student_code AS student_code,
      e.original_name, e.mime_type, e.file_size_bytes, e.status AS evidence_status, e.teacher_feedback,
      e.submitted_at, e.reviewed_at, COALESCE(sd.due_at, a.due_at) AS due_at,
      CASE
        WHEN e.id IS NOT NULL THEN e.status
        WHEN a.status='cerrada' OR (COALESCE(sd.due_at, a.due_at) IS NOT NULL AND COALESCE(sd.due_at, a.due_at) < CURRENT_TIMESTAMP(3)) THEN 'no_entregada'
        ELSE 'pendiente_entrega'
      END AS delivery_status,
      CASE WHEN e.id IS NOT NULL AND COALESCE(sd.due_at, a.due_at) IS NOT NULL AND e.submitted_at > COALESCE(sd.due_at, a.due_at) THEN 1 ELSE 0 END AS is_late,
      sd.updated_at AS deadline_updated_at, sd.reason AS deadline_reason,
      ev.score, ev.max_score, ev.feedback AS grade_feedback, ev.evaluated_at
     FROM academic_course_students cs
     JOIN academic_students s ON s.organization_id=cs.organization_id AND s.id=cs.student_id AND s.status='activo'
     JOIN academic_course_activities a ON a.organization_id=cs.organization_id AND a.course_id=cs.course_id AND a.id=?
     LEFT JOIN academic_course_activity_student_deadlines sd
       ON sd.organization_id=cs.organization_id AND sd.activity_id=a.id AND sd.student_id=s.id
     LEFT JOIN academic_course_evidences e
       ON e.organization_id=cs.organization_id AND e.activity_id=a.id AND e.student_id=s.id
       AND e.id=(SELECT latest.id FROM academic_course_evidences latest
                 WHERE latest.organization_id=cs.organization_id AND latest.activity_id=a.id AND latest.student_id=s.id
                 ORDER BY latest.submitted_at DESC, latest.id DESC LIMIT 1)
     LEFT JOIN academic_course_evaluations ev
       ON ev.organization_id=cs.organization_id AND ev.course_id=cs.course_id
       AND ev.activity_id=a.id AND ev.student_id=s.id
     WHERE cs.organization_id=? AND cs.course_id=? AND cs.status='activo'${whereStudent}
     ORDER BY CASE WHEN e.id IS NULL THEN 1 ELSE 0 END, e.submitted_at DESC, s.full_name ASC`,
    [ctx.activity.id, ctx.orgId, ctx.courseId, ...(ctx.role === 'estudiante' ? [ctx.studentId] : [])]
  );
  const items = rows.map(row => ({
    id: row.evidence_id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentCode: row.student_code,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.file_size_bytes === null ? null : Number(row.file_size_bytes),
    status: row.delivery_status,
    evidenceStatus: row.evidence_status,
    late: Boolean(row.is_late),
    dueAt: row.due_at,
    deadlineCustomized: Boolean(row.deadline_updated_at),
    deadlineReason: row.deadline_reason || '',
    feedback: row.teacher_feedback,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    score: row.score === null ? null : Number(row.score),
    maxScore: row.max_score === null ? 5 : Number(row.max_score),
    gradeFeedback: row.grade_feedback,
    evaluatedAt: row.evaluated_at,
    downloadUrl: row.evidence_id ? `/api/organization/courses/${req.params.courseId}/activities/${req.params.activityId}/evidences/${row.evidence_id}/download` : null
  }));
  const summary = items.reduce((total, item) => {
    total[item.status] = (total[item.status] || 0) + 1;
    return total;
  }, { total: items.length });
  res.json({ ok: true, data: { evidences: items, summary } });
});
const cambiarFechaIndividual = asyncHandler(async (req, res) => {
  const ctx = await baseContext(req, req.params.courseId, req.params.activityId);
  if (ctx.role !== 'tutor') throw new ApiError(403, 'Solo el docente asignado puede cambiar una fecha individual.', { code: 'TEACHER_DEADLINE_ONLY' });
  const studentId = String(req.params.studentId || '');
  if (!validId(studentId)) throw new ApiError(400, 'Identificador de estudiante inválido.', { code: 'INVALID_STUDENT_ID' });
  const rawDate = String(req.body.dueAt || '');
  if (rawDate.length !== 16 || !rawDate.includes('T') || Number.isNaN(new Date(rawDate).getTime())) {
    throw new ApiError(400, 'Selecciona una fecha y hora válidas.', { code: 'INVALID_STUDENT_DEADLINE' });
  }
  const dueAt = rawDate.replace('T', ' ') + ':00';
  if (ctx.activity.opens_at && new Date(rawDate) < new Date(ctx.activity.opens_at)) {
    throw new ApiError(400, 'La fecha individual no puede ser anterior a la apertura de la actividad.', { code: 'DEADLINE_BEFORE_OPEN' });
  }
  const [enrolled] = await ctx.pool.execute(
    "SELECT s.id FROM academic_course_students cs JOIN academic_students s ON s.organization_id=cs.organization_id AND s.id=cs.student_id WHERE cs.organization_id=? AND cs.course_id=? AND cs.student_id=? AND cs.status='activo' AND s.status='activo' LIMIT 1",
    [ctx.orgId, ctx.courseId, studentId]
  );
  if (!enrolled.length) throw new ApiError(404, 'El estudiante no tiene matrícula activa en este curso.', { code: 'STUDENT_NOT_ENROLLED' });
  const reason = String(req.body.reason || '').trim().slice(0, 500);
  await ctx.pool.execute(
    'INSERT INTO academic_course_activity_student_deadlines (organization_id, course_id, activity_id, student_id, due_at, reason, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE due_at=VALUES(due_at), reason=VALUES(reason), updated_by_user_id=VALUES(updated_by_user_id), updated_at=CURRENT_TIMESTAMP(3)',
    [ctx.orgId, ctx.courseId, ctx.activity.id, studentId, dueAt, reason, ctx.userId]
  );
  res.json({ ok: true, data: { updated: true, studentId, dueAt, reason, individual: true } });
});
const descargar = asyncHandler(async (req, res) => {
  const ctx = await baseContext(req, req.params.courseId, req.params.activityId);
  const [rows] = await ctx.pool.execute('SELECT e.original_name, e.stored_name, e.mime_type FROM academic_course_evidences e WHERE e.organization_id=? AND e.activity_id=? AND e.id=?' + (ctx.role === 'estudiante' ? ' AND e.student_id=?' : ''), [ctx.orgId, ctx.activity.id, req.params.evidenceId, ...(ctx.role === 'estudiante' ? [ctx.studentId] : [])]);
  if (!rows.length) throw new ApiError(404, 'No se encontró la evidencia.', { code: 'EVIDENCE_NOT_FOUND' });
  const stored = rows[0].stored_name;
  if (!/^[a-f0-9]{24}$/i.test(stored)) throw new ApiError(404, 'Referencia de archivo inválida.', { code: 'EVIDENCE_FILE_INVALID' });
  const full = path.resolve(STORAGE_DIR, stored);
  if (path.dirname(full) !== path.resolve(STORAGE_DIR)) throw new ApiError(404, 'Archivo no encontrado.', { code: 'FILE_NOT_FOUND' });
  try { await fs.access(full); } catch { throw new ApiError(404, 'El archivo ya no está disponible.', { code: 'FILE_NOT_FOUND' }); }
  if (req.query.view === '1') {
    const safeName = String(rows[0].original_name || 'entrega').replace(/[\\r\\n\"\\\\]/g, '_');
    res.setHeader('Content-Type', rows[0].mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename=\"${safeName}\"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(full);
  }
  res.download(full, rows[0].original_name, { headers: { 'X-Content-Type-Options': 'nosniff' } });
});
const revisar = asyncHandler(async (req, res) => {
  const ctx = await baseContext(req, req.params.courseId, req.params.activityId);
  if (ctx.role !== 'tutor') throw new ApiError(403, 'Solo el docente asignado puede revisar.', { code: 'TEACHER_REVIEW_ONLY' });
  const status = req.body.status;
  if (!['aprobada', 'requiere_cambios'].includes(status)) throw new ApiError(400, 'Selecciona aprobar o solicitar correcciones.', { code: 'INVALID_REVIEW_STATUS' });
  const [result] = await ctx.pool.execute("UPDATE academic_course_evidences SET status=?, teacher_feedback=NULL, reviewed_by_user_id=?, reviewed_at=CURRENT_TIMESTAMP(3) WHERE organization_id=? AND activity_id=? AND id=?", [status, ctx.userId, ctx.orgId, ctx.activity.id, req.params.evidenceId]);
  if (!result.affectedRows) throw new ApiError(404, 'No se encontró la entrega.', { code: 'EVIDENCE_NOT_FOUND' });
  res.json({ ok: true, data: { reviewed: true, status } });
});
const calificar = asyncHandler(async (req, res) => {
  const ctx = await baseContext(req, req.params.courseId, req.params.activityId);
  if (ctx.role !== 'tutor') throw new ApiError(403, 'Solo el docente asignado puede calificar.', { code: 'TEACHER_GRADE_ONLY' });
  const evidenceId = req.params.evidenceId;
  if (!validId(evidenceId)) throw new ApiError(400, 'Identificador de entrega inválido.', { code: 'INVALID_EVIDENCE_ID' });
  const score = Number(req.body.score); const maxScore = Number(req.body.maxScore || 5);
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore || maxScore > 100) throw new ApiError(400, 'La calificación debe estar dentro de la escala indicada.', { code: 'INVALID_GRADE' });
  const [evidences] = await ctx.pool.execute('SELECT student_id FROM academic_course_evidences WHERE organization_id=? AND activity_id=? AND id=?', [ctx.orgId, ctx.activity.id, evidenceId]);
  if (!evidences.length) throw new ApiError(404, 'No se encontró la entrega.', { code: 'EVIDENCE_NOT_FOUND' });
  const studentId = evidences[0].student_id;
  const title = ctx.activity.title.slice(0, 160);
  const feedback = String(req.body.feedback || '').trim().slice(0, 4000);
  const [previous] = await ctx.pool.execute('SELECT id FROM academic_course_evaluations WHERE organization_id=? AND course_id=? AND student_id=? AND activity_id=? ORDER BY evaluated_at DESC LIMIT 1', [ctx.orgId, req.params.courseId, studentId, ctx.activity.id]);
  if (previous.length) {
    await ctx.pool.execute('UPDATE academic_course_evaluations SET score=?, max_score=?, feedback=?, teacher_user_id=?, title=?, evaluated_at=CURRENT_TIMESTAMP(3) WHERE id=? AND organization_id=?', [score, maxScore, feedback, ctx.userId, title, previous[0].id, ctx.orgId]);
  } else {
    await ctx.pool.execute('INSERT INTO academic_course_evaluations (id, organization_id, course_id, student_id, activity_id, teacher_user_id, title, score, max_score, feedback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), ctx.orgId, req.params.courseId, studentId, ctx.activity.id, ctx.userId, title, score, maxScore, feedback]);
  }
  const outcomeStatus = (score / maxScore) * 5 >= 3 ? 'aprobada' : 'reprobada';
  await ctx.pool.execute(
    'UPDATE academic_course_evidences SET status=?, teacher_feedback=NULL, reviewed_by_user_id=?, reviewed_at=CURRENT_TIMESTAMP(3) WHERE organization_id=? AND activity_id=? AND id=?',
    [outcomeStatus, ctx.userId, ctx.orgId, ctx.activity.id, evidenceId]
  );
  res.json({ ok: true, data: { graded: true, score, maxScore, status: outcomeStatus } });
});
module.exports = { subir, listar, descargar, revisar, calificar, cambiarFechaIndividual };
