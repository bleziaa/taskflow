const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { conectarMySQL, obtenerPoolMySQL, desconectarMySQL } = require('../src/config/mysql');

const ORG_ID = '6ae8d1083020512c8f5d8067';
const TEACHER_USER_ID = '6aebf1df9e618a1a83af1a8d';
const COURSE_ID = '8a18bd9764b17a0467e68eb5';
const ACTIVITY_MODEL = '695d3bbcd912f2a685813c3a';
const ACTIVITY_QUERIES = '047c1e6a89a1707b88db897e';
const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'storage', 'course-resources');
const TARGET_DIR = path.join(ROOT, 'storage', 'course-activity-evidences');
const id = key => crypto.createHash('sha256').update('taskflow-course-evidence-demo:' + key).digest('hex').slice(0, 24);

const students = [
  { key: 'camila', code: 'DEMO-BDII-002', name: 'Camila Torres (DEMO)', email: 'camila.torres.demo@example.invalid' },
  { key: 'andres', code: 'DEMO-BDII-003', name: 'Andrés Pérez (DEMO)', email: 'andres.perez.demo@example.invalid' },
  { key: 'valentina', code: 'DEMO-BDII-004', name: 'Valentina Gómez (DEMO)', email: 'valentina.gomez.demo@example.invalid' }
];
const submissions = [
  { key: 'camila-modelo', student: 'camila', activity: ACTIVITY_MODEL, file: '01_Guia_Inicio_TaskFlow.pdf', status: 'pendiente', submitted: '2026-11-06 08:10:00', feedback: null },
  { key: 'andres-modelo', student: 'andres', activity: ACTIVITY_MODEL, file: '03_Plantilla_Informe_Academico.pdf', status: 'aprobada', submitted: '2026-11-05 19:25:00', feedback: 'La entrega cumple los criterios de identificación de entidades, claves y relaciones.' , score: 4.6 },
  { key: 'valentina-consultas', student: 'valentina', activity: ACTIVITY_QUERIES, file: '02_Guia_IA_Responsable.pdf', status: 'requiere_cambios', submitted: '2026-11-06 07:40:00', feedback: 'Revisa las restricciones de integridad y agrega los resultados esperados de cada consulta.' }
];

async function main() {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  await conectarMySQL();
  const pool = obtenerPoolMySQL();
  const db = await pool.getConnection();
  try {
    const [course] = await db.execute("SELECT id FROM academic_courses WHERE organization_id=? AND id=? AND status='activo'", [ORG_ID, COURSE_ID]);
    const [teacher] = await db.execute("SELECT id FROM academic_course_teachers WHERE organization_id=? AND course_id=? AND teacher_user_id=? AND status='activo'", [ORG_ID, COURSE_ID, TEACHER_USER_ID]);
    const [activities] = await db.execute("SELECT id FROM academic_course_activities WHERE organization_id=? AND course_id=? AND id IN (?,?)", [ORG_ID, COURSE_ID, ACTIVITY_MODEL, ACTIVITY_QUERIES]);
    if (!course.length || !teacher.length || activities.length !== 2) throw new Error('No se encontró el curso, el docente asignado o las actividades esperadas. No se insertaron entregas.');
    for (const item of submissions) {
      const source = path.join(SOURCE_DIR, item.file);
      if (!fs.existsSync(source) || fs.statSync(source).size < 500) throw new Error('Falta el PDF de muestra: ' + item.file);
    }

    await db.beginTransaction();
    const studentIds = {};
    for (const student of students) {
      const studentId = id('student-' + student.key);
      studentIds[student.key] = studentId;
      await db.execute(
        `INSERT INTO academic_students (id, organization_id, student_code, full_name, email, program, semester, status, user_id, tutor_user_id)
         VALUES (?, ?, ?, ?, ?, 'Ingeniería de Software', 3, 'activo', NULL, ?)
         ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), email=VALUES(email), status='activo', tutor_user_id=VALUES(tutor_user_id)`,
        [studentId, ORG_ID, student.code, student.name, student.email, TEACHER_USER_ID]
      );
      await db.execute(
        `INSERT INTO academic_course_students (id, organization_id, course_id, student_id, status)
         VALUES (?, ?, ?, ?, 'activo')
         ON DUPLICATE KEY UPDATE status='activo'`,
        [id('enrollment-' + student.key), ORG_ID, COURSE_ID, studentId]
      );
    }

    for (const item of submissions) {
      const evidenceId = id('evidence-' + item.key);
      const storedName = id('file-' + item.key);
      const source = path.join(SOURCE_DIR, item.file);
      const target = path.join(TARGET_DIR, storedName);
      if (!fs.existsSync(target)) fs.copyFileSync(source, target);
      const reviewedAt = item.status === 'pendiente' ? null : '2026-11-06 09:00:00';
      await db.execute(
        `INSERT INTO academic_course_evidences
          (id, organization_id, activity_id, student_id, original_name, stored_name, mime_type, file_size_bytes, status, teacher_feedback, reviewed_by_user_id, reviewed_at, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, 'application/pdf', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status), teacher_feedback=VALUES(teacher_feedback), reviewed_by_user_id=VALUES(reviewed_by_user_id), reviewed_at=VALUES(reviewed_at)`,
        [evidenceId, ORG_ID, item.activity, studentIds[item.student], 'DEMO_' + item.file, storedName, fs.statSync(source).size, item.status, item.feedback, reviewedAt ? TEACHER_USER_ID : null, reviewedAt, item.submitted]
      );
      if (item.score !== undefined) {
        await db.execute(
          `INSERT INTO academic_course_evaluations (id, organization_id, course_id, student_id, activity_id, teacher_user_id, title, score, max_score, feedback)
           VALUES (?, ?, ?, ?, ?, ?, 'Modelo relacional y restricciones (DEMO)', ?, 5, 'Calificación de demostración; no corresponde a una nota oficial.')
           ON DUPLICATE KEY UPDATE score=VALUES(score), feedback=VALUES(feedback)`,
          [id('grade-' + item.key), ORG_ID, COURSE_ID, studentIds[item.student], item.activity, TEACHER_USER_ID, item.score]
        );
      }
    }
    await db.commit();
    const [counts] = await pool.execute(
      "SELECT e.status, COUNT(*) AS total FROM academic_course_evidences e JOIN academic_course_activities a ON a.organization_id=e.organization_id AND a.id=e.activity_id WHERE e.organization_id=? AND a.course_id=? AND e.original_name LIKE 'DEMO_%' GROUP BY e.status",
      [ORG_ID, COURSE_ID]
    );
    console.log('[seed-course-evidence-demo] SUCCESS', JSON.stringify({ course: 'Base de Datos II', demoStudents: students.length, demoSubmissions: submissions.length, statuses: counts, note: 'Perfiles DEMO sin cuenta de acceso; archivos de muestra marcados DEMO; no son entregas ni calificaciones oficiales.' }));
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
    await desconectarMySQL();
  }
}

main().catch(async error => {
  console.error('[seed-course-evidence-demo] ERROR', error.code || error.message);
  await desconectarMySQL().catch(() => {});
  process.exitCode = 1;
});
