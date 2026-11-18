const crypto = require('node:crypto');
const Student = require('../models/Student');
const User = require('../models/User');
const Membership = require('../models/OrganizationMembership');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { courseForRequest } = require('./course-management.controller');
const id = () => crypto.randomBytes(12).toString('hex');

// MongoDB owns institutional records and accounts. SQL owns course history.
async function eligibleStudent(studentId, orgId) {
  const student = await Student.findOne({ _id: studentId, organizationId: orgId, estado: 'activo' }).lean();
  if (!student) throw new ApiError(404, 'No se encontró un estudiante activo de esta institución.', { code: 'STUDENT_NOT_FOUND' });
  const [user, membership] = await Promise.all([
    student.usuario ? User.findOne({ _id: student.usuario, activo: true }).lean() : null,
    student.usuario ? Membership.exists({ organizacion: orgId, usuario: student.usuario, role: 'estudiante', estado: 'activo' }) : null,
  ]);
  if (!user || !membership) throw new ApiError(409, 'Primero crea o vincula la cuenta del estudiante y su membresía activa en esta institución.', { code: 'STUDENT_ACCOUNT_REQUIRED' });
  return student;
}

const listar = asyncHandler(async (req, res) => {
  const { pool, orgId, role } = await courseForRequest(req, req.params.courseId, ['administrador', 'tutor'], true);
  const [enrollments] = await pool.execute(`SELECT cs.student_id AS studentId, s.student_code AS code,
    s.full_name AS name, s.email, cs.status, cs.enrolled_at AS enrolledAt
    FROM academic_course_students cs JOIN academic_students s ON s.organization_id=cs.organization_id AND s.id=cs.student_id
    WHERE cs.organization_id=? AND cs.course_id=? ORDER BY s.full_name`, [orgId, req.params.courseId]);
  let candidates = [];
  if (role === 'administrador') {
    // Independent from the 200-row student list: all active institutional records are eligible for search.
    const students = await Student.find({ organizationId: orgId, estado: 'activo' }).select('nombre codigo usuario').sort({ nombre: 1 }).lean();
    const userIds = students.map(s => s.usuario).filter(Boolean);
    const [memberships, users] = await Promise.all([
      Membership.find({ organizacion: orgId, usuario: { $in: userIds }, role: 'estudiante', estado: 'activo' }).select('usuario').lean(),
      User.find({ _id: { $in: userIds }, activo: true }).select('_id').lean(),
    ]);
    const members = new Set(memberships.map(m => String(m.usuario)));
    const accounts = new Set(users.map(u => String(u._id)));
    candidates = students.map(s => ({ id: String(s._id), name: s.nombre, code: s.codigo,
      eligible: accounts.has(String(s.usuario)) && members.has(String(s.usuario)) }));
  }
  const [history] = role === 'administrador' ? await pool.execute(`SELECT student_id AS studentId, actor_user_id AS actorUserId,
    previous_status AS previousStatus, new_status AS status, changed_at AS changedAt
    FROM academic_course_enrollment_history WHERE organization_id=? AND course_id=? ORDER BY changed_at DESC, id DESC LIMIT 100`, [orgId, req.params.courseId]) : [[]];
  const actors = history.length ? await User.find({ _id: { $in: history.map(h => h.actorUserId) } }).select('nombre').lean() : [];
  const names = new Map(actors.map(u => [String(u._id), u.nombre]));
  res.json({ ok: true, data: { enrollments, candidates, history: history.map(h => ({ ...h, actorName: names.get(h.actorUserId) || 'Administrador' })) } });
});

async function saveEnrollment(req, res, status, mustExist) {
  const { pool, orgId, userId } = await courseForRequest(req, req.params.courseId, ['administrador']);
  const studentId = req.params.studentId || req.body.studentId;
  const student = status === 'activo' ? await eligibleStudent(studentId, orgId) : null;
  const connection = await pool.getConnection();
  let changed = false;
  try {
    await connection.beginTransaction();
    // Serialize operations for one course, including concurrent first enrollment.
    await connection.execute('SELECT id FROM academic_courses WHERE organization_id=? AND id=? FOR UPDATE', [orgId, req.params.courseId]);
    const [rows] = await connection.execute('SELECT id, status FROM academic_course_students WHERE organization_id=? AND course_id=? AND student_id=? FOR UPDATE', [orgId, req.params.courseId, studentId]);
    if (mustExist && !rows.length) throw new ApiError(404, 'Este estudiante no tiene matrícula en el curso.', { code: 'ENROLLMENT_NOT_FOUND' });
    if (student) {
      // Never overwrite another SQL student's unique identity or move historical work between accounts.
      const [existing] = await connection.execute('SELECT user_id FROM academic_students WHERE organization_id=? AND id=? FOR UPDATE', [orgId, studentId]);
      if (existing[0]?.user_id && existing[0].user_id !== String(student.usuario)) throw new ApiError(409, 'La cuenta vinculada no coincide con el historial académico. Revisa la vinculación antes de matricular.', { code: 'STUDENT_ACCOUNT_CONFLICT' });
      if (!existing.length) {
        await connection.execute(`INSERT INTO academic_students (id, organization_id, student_code, full_name, email, phone, program, semester, status, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activo', ?)`, [studentId, orgId, student.codigo, student.nombre, student.email, student.telefono || '', student.programa, student.semestre, String(student.usuario)]);
      } else {
        await connection.execute(`UPDATE academic_students SET student_code=?, full_name=?, email=?, phone=?, program=?, semester=?, status='activo', user_id=? WHERE organization_id=? AND id=?`,
          [student.codigo, student.nombre, student.email, student.telefono || '', student.programa, student.semestre, String(student.usuario), orgId, studentId]);
      }
    }
    if (!rows.length || rows[0].status !== status) {
      if (rows.length) await connection.execute('UPDATE academic_course_students SET status=? WHERE id=? AND organization_id=?', [status, rows[0].id, orgId]);
      else await connection.execute('INSERT INTO academic_course_students (id, organization_id, course_id, student_id, status) VALUES (?, ?, ?, ?, ?)', [id(), orgId, req.params.courseId, studentId, status]);
      await connection.execute(`INSERT INTO academic_course_enrollment_history (id, organization_id, course_id, student_id, actor_user_id, previous_status, new_status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id(), orgId, req.params.courseId, studentId, userId, rows[0]?.status || null, status]);
      changed = true;
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'Hay un conflicto con el código o correo del estudiante en el registro académico. Revisa sus datos.', { code: 'STUDENT_IDENTITY_CONFLICT' });
    throw error;
  } finally { connection.release(); }
  res.json({ ok: true, data: { studentId, status, changed } });
}

module.exports = { listar, matricular: asyncHandler((req, res) => saveEnrollment(req, res, 'activo', false)),
  cambiarEstado: asyncHandler((req, res) => saveEnrollment(req, res, req.body.status, true)) };
