const { randomBytes } = require('node:crypto');
const { conectarMySQL, obtenerPoolMySQL, desconectarMySQL } = require('../src/config/mysql');
const companies = require('../src/repositories/academic-company.repository');
const students = require('../src/repositories/academic-student.repository');

const id = () => randomBytes(12).toString('hex');

async function main() {
  await conectarMySQL();
  const pool = obtenerPoolMySQL();
  const db = await pool.getConnection();
  const orgA = id(); const orgB = id();
  const companyId = id(); const studentId = id();
  try {
    await db.beginTransaction();
    const company = await companies.crear({
      _id: companyId, organizationId: orgA, razonSocial: 'Empresa repositorio QA', nit: `QA-${companyId}`,
      sector: 'Tecnología', direccion: 'Calle de prueba', ciudad: 'San Jacinto', contactoNombre: 'Contacto QA',
      contactoEmail: 'qa@example.invalid', telefono: '3000000000', estado: 'activa',
    }, db);
    if (!company || company.razonSocial !== 'Empresa repositorio QA' || company.nit !== `QA-${companyId}`) throw new Error('Mapeo/creación de empresa no coincide.');

    const student = await students.crear({
      _id: studentId, organizationId: orgA, codigo: `qa-${studentId.slice(0, 8)}`, nombre: 'Estudiante Repositorio QA',
      email: `${studentId}@example.invalid`, telefono: '3000000001', programa: 'Ingeniería de Software',
      semestre: 3, estado: 'activo', empresa: companyId,
    }, db);
    if (!student || student.empresa?._id !== companyId || student.codigo !== `QA-${studentId.slice(0, 8).toUpperCase()}`) { console.error('[academic-repositories] Diagnóstico estudiante:', JSON.stringify({ found: !!student, companyMatched: student?.empresa?._id === companyId, codeMatched: student?.codigo === `QA-${studentId.slice(0, 8).toUpperCase()}`, code: student?.codigo, companyIdReturned: student?.empresa?._id })); throw new Error('Mapeo/creación de estudiante no coincide.'); }

    const listedStudents = await students.listar({ organizationId: orgA, q: 'Repositorio QA', executor: db });
    if (!listedStudents.some((item) => item._id === studentId)) throw new Error('Listado/búsqueda de estudiantes falló.');
    const listedCompanies = await companies.listar({ organizationId: orgA, q: 'Repositorio QA', executor: db });
    if (!listedCompanies.some((item) => item._id === companyId)) throw new Error('Listado/búsqueda de empresas falló.');

    if (await students.obtenerPorId(studentId, orgB, db)) throw new Error('Fuga cross-tenant al consultar estudiante.');
    if (await companies.obtenerPorId(companyId, orgB, db)) throw new Error('Fuga cross-tenant al consultar empresa.');
    if (await students.actualizar(studentId, orgB, { nombre: 'No permitido' }, db)) throw new Error('Actualización cross-tenant no fue bloqueada.');
    if (await companies.actualizar(companyId, orgB, { razonSocial: 'No permitido' }, db)) throw new Error('Actualización cross-tenant no fue bloqueada.');

    const updatedStudent = await students.actualizar(studentId, orgA, { nombre: 'Estudiante QA Actualizado', email: `${studentId}@example.invalid` }, db);
    if (updatedStudent?.nombre !== 'Estudiante QA Actualizado') throw new Error('Actualización de estudiante falló.');
    const updatedCompany = await companies.actualizar(companyId, orgA, { ciudad: 'Cartagena' }, db);
    if (updatedCompany?.ciudad !== 'Cartagena') throw new Error('Actualización de empresa falló.');

    if (!await students.eliminar(studentId, orgA, db)) throw new Error('Eliminación de estudiante falló.');
    if (!await companies.eliminar(companyId, orgA, db)) throw new Error('Eliminación de empresa falló.');
    console.log('[academic-repositories] CRUD de estudiantes y empresas: OK.');
    console.log('[academic-repositories] Aislamiento por organization_id en lectura/actualización: OK.');
  } catch (error) {
    throw error;
  } finally {
    await db.rollback();
    db.release();
    await desconectarMySQL();
    console.log('[academic-repositories] Transacción revertida; no se conservaron registros de prueba.');
  }
}

main().catch((error) => {
  console.error(`[academic-repositories] ERROR: ${error.code || error.message}`);
  process.exitCode = 1;
});
