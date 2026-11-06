const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { conectarMySQL, obtenerPoolMySQL, desconectarMySQL } = require('../src/config/mysql');

const id = () => crypto.randomBytes(12).toString('hex');

async function main() {
  await conectarMySQL();
  const pool = obtenerPoolMySQL();
  const db = await pool.getConnection();
  const orgA = id();
  const orgB = id();
  const courseA = id();
  const courseB = id();
  const studentA = id();
  const teacherA = id();
  const moduleA = id();
  const activityA = id();
  const resourceA = id();
  const evidenceA = id();
  const evaluationA = id();

  try {
    await db.beginTransaction();
    await db.execute(
      'INSERT INTO academic_students (id, organization_id, student_code, full_name, email, program, semester) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [studentA, orgA, 'COURSE-VERIFY', 'Estudiante de verificación', 'course-verify@example.test', 'Informática', 1]
    );
    await db.execute(
      'INSERT INTO academic_courses (id, organization_id, course_code, name, created_by_user_id) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
      [courseA, orgA, 'INF-101', 'Informática', teacherA, courseB, orgB, 'MAT-101', 'Matemáticas', teacherA]
    );
    await db.execute(
      'INSERT INTO academic_course_teachers (id, organization_id, course_id, teacher_user_id, assigned_by_user_id) VALUES (?, ?, ?, ?, ?)',
      [id(), orgA, courseA, teacherA, teacherA]
    );
    await db.execute(
      'INSERT INTO academic_course_students (id, organization_id, course_id, student_id) VALUES (?, ?, ?, ?)',
      [id(), orgA, courseA, studentA]
    );
    await db.execute(
      'INSERT INTO academic_course_resources (id, organization_id, course_id, title, original_name, stored_name, mime_type, file_size_bytes, uploaded_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [resourceA, orgA, courseA, 'Guía de inicio', 'guia.pdf', resourceA + '.pdf', 'application/pdf', 128, teacherA]
    );
    await db.execute(
      'INSERT INTO academic_course_modules (id, organization_id, course_id, module_number, title, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [moduleA, orgA, courseA, 1, 'Módulo de verificación', teacherA]
    );
    await db.execute(
      'INSERT INTO academic_course_activities (id, organization_id, course_id, module_id, title, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [activityA, orgA, courseA, moduleA, 'Actividad inicial', teacherA]
    );
    await db.execute(
      'INSERT INTO academic_course_evidences (id, organization_id, activity_id, student_id, original_name, stored_name, mime_type, file_size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [evidenceA, orgA, activityA, studentA, 'entrega.pdf', evidenceA + '.pdf', 'application/pdf', 256]
    );
    await db.execute(
      'INSERT INTO academic_course_evaluations (id, organization_id, course_id, student_id, activity_id, teacher_user_id, title, score, max_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [evaluationA, orgA, courseA, studentA, activityA, teacherA, 'Evaluación inicial', 4.5, 5]
    );

    const [teacherCourses] = await db.execute(
      'SELECT c.course_code FROM academic_courses c JOIN academic_course_teachers t ON t.organization_id = c.organization_id AND t.course_id = c.id WHERE t.organization_id = ? AND t.teacher_user_id = ? AND t.status = ? ORDER BY c.course_code',
      [orgA, teacherA, 'activo']
    );
    assert.deepEqual(teacherCourses.map(row => row.course_code), ['INF-101']);

    const [courseSummary] = await db.execute(
      'SELECT c.course_code, COUNT(DISTINCT s.student_id) AS students, COUNT(DISTINCT a.id) AS activities, COUNT(DISTINCT e.id) AS evidences, COUNT(DISTINCT v.id) AS evaluations FROM academic_courses c LEFT JOIN academic_course_students s ON s.organization_id = c.organization_id AND s.course_id = c.id AND s.status = \'activo\' LEFT JOIN academic_course_activities a ON a.organization_id = c.organization_id AND a.course_id = c.id LEFT JOIN academic_course_evidences e ON e.organization_id = a.organization_id AND e.activity_id = a.id LEFT JOIN academic_course_evaluations v ON v.organization_id = c.organization_id AND v.course_id = c.id WHERE c.organization_id = ? AND c.id = ? GROUP BY c.id',
      [orgA, courseA]
    );
    assert.equal(courseSummary[0].students, 1);
    assert.equal(courseSummary[0].activities, 1);
    assert.equal(courseSummary[0].evidences, 1);
    assert.equal(courseSummary[0].evaluations, 1);

    await assert.rejects(
      db.execute('INSERT INTO academic_course_teachers (id, organization_id, course_id, teacher_user_id, assigned_by_user_id) VALUES (?, ?, ?, ?, ?)', [id(), orgA, courseB, teacherA, teacherA]),
      error => error.code === 'ER_NO_REFERENCED_ROW_2'
    );
    await assert.rejects(
      db.execute('INSERT INTO academic_course_students (id, organization_id, course_id, student_id) VALUES (?, ?, ?, ?)', [id(), orgB, courseB, studentA]),
      error => error.code === 'ER_NO_REFERENCED_ROW_2'
    );

    console.log('[course-workspaces] OK: un profesor puede asignarse por curso; documentos, actividades, evidencias y evaluaciones quedan ligados al curso; los cruces de organización son rechazados.');
  } finally {
    await db.rollback();
    db.release();
    await desconectarMySQL();
  }
}

main().catch(error => {
  console.error('[course-workspaces] ERROR:', error.code || error.message);
  process.exitCode = 1;
});
