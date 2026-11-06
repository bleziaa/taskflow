const crypto = require('node:crypto');
const { conectarMySQL, obtenerPoolMySQL, desconectarMySQL } = require('../src/config/mysql');
const id = () => crypto.randomBytes(12).toString('hex');

async function main() {
  await conectarMySQL();
  const pool = obtenerPoolMySQL();
  const c = await pool.getConnection();
  const org = id();
  const otherOrg = id();
  const student = id();
  const company = id();
  const otherCompany = id();
  const practice = id();
  const activity = id();
  const evidence = id();
  const evaluation = id();
  try {
    await c.beginTransaction();
    await c.execute(`INSERT INTO academic_companies (id, organization_id, legal_name, tax_id, city) VALUES (?, ?, ?, ?, ?)`, [company, org, 'Empresa de prueba', `T-${company}`, 'San Jacinto']);
    await c.execute(`INSERT INTO academic_companies (id, organization_id, legal_name, tax_id, city) VALUES (?, ?, ?, ?, ?)`, [otherCompany, otherOrg, 'Empresa aislada', `T-${otherCompany}`, 'Cartagena']);
    await c.execute(`INSERT INTO academic_students (id, organization_id, student_code, full_name, email, program, semester, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [student, org, `S-${student}`, 'Estudiante de prueba', `${student}@example.test`, 'Ingenieria de Software', 3, company]);
    await c.execute(`INSERT INTO academic_practices (id, organization_id, student_id, company_id, tutor_user_id, title, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [practice, org, student, company, id(), 'Practica de verificacion', '2026-11-01', '2026-12-01']);
    await c.execute(`INSERT INTO academic_activities (id, organization_id, practice_id, title, due_date, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)`, [activity, org, practice, 'Actividad de prueba', '2026-11-20 23:00:00', id()]);
    await c.execute(`INSERT INTO academic_evidences (id, organization_id, activity_id, student_id, original_name, stored_name, mime_type, file_size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [evidence, org, activity, student, 'evidencia.pdf', `${evidence}.pdf`, 'application/pdf', 1024]);
    await c.execute(`INSERT INTO academic_evaluations (id, organization_id, practice_id, student_id, tutor_user_id, score, concept) VALUES (?, ?, ?, ?, ?, ?, ?)`, [evaluation, org, practice, student, id(), 4.5, 'excelente']);
    const [rows] = await c.execute(`SELECT s.full_name, c.legal_name, p.title, a.title AS activity, e.status AS evidence_status, v.score FROM academic_students s JOIN academic_companies c ON c.organization_id=s.organization_id AND c.id=s.company_id JOIN academic_practices p ON p.organization_id=s.organization_id AND p.student_id=s.id JOIN academic_activities a ON a.organization_id=p.organization_id AND a.practice_id=p.id JOIN academic_evidences e ON e.organization_id=a.organization_id AND e.activity_id=a.id JOIN academic_evaluations v ON v.organization_id=p.organization_id AND v.practice_id=p.id WHERE s.id=?`, [student]);
    if (rows.length !== 1 || Number(rows[0].score) !== 4.5) throw new Error('La lectura relacional de extremo a extremo no devolvio el resultado esperado.');
    let tenantBlocked = false;
    try {
      await c.execute(`INSERT INTO academic_practices (id, organization_id, student_id, company_id, tutor_user_id, title, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id(), org, student, otherCompany, id(), 'Cruce de tenant no permitido', '2026-11-01', '2026-12-01']);
    } catch (error) {
      if (error.code !== 'ER_NO_REFERENCED_ROW_2') throw error;
      tenantBlocked = true;
    }
    if (!tenantBlocked) throw new Error('FALLO: se permitio relacionar una practica con empresa de otra organizacion.');
    await c.rollback();
    console.log('[mysql:verify] CRUD relacional completo: OK (estudiante > empresa > practica > actividad > evidencia > evaluacion).');
    console.log('[mysql:verify] Integridad multiempresa: cruce entre organizaciones rechazado correctamente.');
    console.log('[mysql:verify] Datos de prueba revertidos; no se conservaron registros.');
  } catch (error) {
    await c.rollback().catch(() => {});
    throw error;
  } finally {
    c.release();
  }
}

main().catch((error) => {
  console.error('[mysql:verify] Error:', error.code || error.message);
  process.exitCode = 1;
}).finally(async () => {
  await desconectarMySQL().catch(() => {});
});
