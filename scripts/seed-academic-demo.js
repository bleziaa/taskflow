const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { env } = require('../src/config/env');
const { conectarMySQL, obtenerPoolMySQL, desconectarMySQL } = require('../src/config/mysql');

const stableId = (key) => crypto.createHash('sha256').update('taskflow-demo:' + key).digest('hex').slice(0, 24);
const ORG_ID = '6ae8d1083020512c8f5d8067';
const STUDENT_USER_ID = '6aea1e4dd405d8c8d2553d09';
const TEACHER_USER_ID = '6aebf1df9e618a1a83af1a8d';
const ROOT = path.resolve(__dirname, '..');
const PDF_DIR = path.join(ROOT, 'storage', 'course-resources');

const courses = [
  {
    code: 'DEMO-ISW49-2026', name: 'Ingeniería de Software 4_9',
    description: 'Espacio demostrativo para organizar requisitos, arquitectura, pruebas y documentación del proyecto TaskFlow. Los registros de este espacio son de práctica y no sustituyen el aula oficial.',
    activities: [
      ['Diagnóstico y alcance del proyecto TaskFlow', 'Identificar el problema, los actores, el alcance y las restricciones del sistema.', 'Entrega un documento breve con contexto, objetivo general, tres objetivos específicos, alcance y actores. Separa hechos comprobados de supuestos. Incluye criterios de aceptación para dos funciones.','2026-11-10 23:55:00'],
      ['Matriz de requisitos y criterios de aceptación', 'Convertir necesidades del sistema en requisitos verificables.', 'Registra al menos cinco requisitos funcionales y tres no funcionales. Para cada uno agrega identificador, prioridad, descripción y criterio de aceptación comprobable.','2026-11-13 23:55:00']
    ]
  },
  {
    code: 'DEMO-DWEB-2026', name: 'Desarrollo de Software Web',
    description: 'Espacio demostrativo para practicar estructura web, accesibilidad, interacción con API y validación. Material de apoyo no oficial.',
    activities: [
      ['Prototipo de interfaz responsive', 'Diseñar una vista adaptable a móvil y escritorio.', 'Construye una pantalla con HTML semántico y CSS responsive. Adjunta capturas de escritorio y móvil y explica dos decisiones de accesibilidad.','2026-11-12 23:55:00'],
      ['Consumo de API y manejo de errores', 'Integrar una interfaz con un endpoint y estados de carga.', 'Implementa una consulta a una API de prueba. Muestra estados de carga, éxito y error; evita insertar datos sensibles en el código.','2026-11-16 23:55:00']
    ]
  },
  {
    code: 'DEMO-BDII-2026', name: 'Base de Datos II',
    description: 'Espacio demostrativo para consultas SQL, procedimientos, integridad y modelado relacional. Material de apoyo no oficial.',
    activities: [
      ['Modelo relacional y restricciones', 'Representar entidades, relaciones y reglas de integridad.', 'Elabora un modelo entidad-relación de un caso académico. Identifica claves primarias, foráneas, cardinalidades y al menos tres restricciones de integridad.','2026-11-11 23:55:00'],
      ['Consultas, funciones y procedimientos', 'Practicar operaciones SQL reutilizables y verificables.', 'Prepara tres consultas SELECT, una función y un procedimiento almacenado. Incluye datos de prueba, resultados esperados y una breve explicación.','2026-11-17 23:55:00']
    ]
  }
];

const pdfs = [
  { file: '01_Guia_Inicio_TaskFlow.pdf', title: 'Guía de inicio de TaskFlow', description: 'Ruta de trabajo, organización de archivos y seguimiento de actividades.' },
  { file: '02_Guia_IA_Responsable.pdf', title: 'Guía de uso responsable de IA', description: 'Privacidad, verificación, autoría y declaración del uso de IA.' },
  { file: '03_Plantilla_Informe_Academico.pdf', title: 'Plantilla de informe académico', description: 'Estructura base para elaborar informes y documentar resultados.' }
];

const aiProfile = {
  key: 'agnes-academica',
  name: 'Agnes — Asistente académica de TaskFlow',
  description: 'Perfil local de apoyo académico para explicar conceptos, organizar tareas, revisar borradores y orientar el trabajo con IA responsable.',
  status: 'configured_local',
  connectionStatus: 'not_connected',
  provider: null,
  model: null,
  systemInstruction: 'Eres Agnes, asistente académica de TaskFlow. Responde en español claro. Ayuda a comprender, planificar, revisar y aprender; no suplantes al docente ni presentes como oficiales notas, entregas o instrucciones que no estén verificadas. No inventes fuentes, resultados ni fechas. Distingue ejemplos demostrativos de datos reales. Protege datos personales y recomienda verificar las respuestas con el material del curso. Si falta información, dilo y pregunta solo lo necesario.',
  capabilities: ['explicar_conceptos', 'planificar_estudio', 'revisar_borradores', 'crear_rubricas', 'orientar_codigo', 'resumir_materiales'],
  safetyRules: ['No inventar citas ni referencias.', 'No generar calificaciones oficiales.', 'No suplantar la autoría del estudiante.', 'No procesar contraseñas ni datos sensibles.', 'Marcar como demostrativo cualquier contenido de ejemplo.'],
  updatedAt: new Date()
};

const prompts = [
  { key: 'explicar-concepto', title: 'Explicar un concepto', category: 'aprendizaje', prompt: 'Explícame el concepto indicado paso a paso, con un ejemplo sencillo, errores frecuentes y tres preguntas para comprobar mi comprensión: [concepto].' },
  { key: 'plan-estudio', title: 'Plan de estudio', category: 'organizacion', prompt: 'Ayúdame a dividir este tema en sesiones cortas. Incluye objetivos, práctica activa y una forma de verificar el aprendizaje: [tema y tiempo disponible].' },
  { key: 'revisar-borrador', title: 'Revisar un borrador', category: 'escritura', prompt: 'Revisa la claridad, coherencia y estructura de este borrador. No inventes fuentes ni cambies el sentido. Señala problemas y propone mejoras justificadas: [borrador].' },
  { key: 'crear-rubrica', title: 'Proponer una rúbrica', category: 'evaluacion', prompt: 'Propón una rúbrica formativa con criterios observables y cuatro niveles de desempeño. Es una propuesta para revisión docente, no una calificación oficial: [actividad].' },
  { key: 'analizar-codigo', title: 'Analizar código', category: 'programacion', prompt: 'Analiza este código. Explica su flujo, identifica errores reproducibles, riesgos y mejoras. No afirmes que una prueba pasó si no se ejecutó: [código y objetivo].' }
];

async function main() {
  if (!env.mysql.enabled) throw new Error('MYSQL_ENABLED no está habilitado; no se escribirán datos.');
  await mongoose.connect(env.mongoUri);
  const User = require('../src/models/User');
  const Organization = require('../src/models/Organization');
  const Membership = require('../src/models/OrganizationMembership');
  const [studentUser, teacherUser, organization] = await Promise.all([
    User.findById(STUDENT_USER_ID).select('_id nombre email role activo').lean(),
    User.findById(TEACHER_USER_ID).select('_id nombre email role activo').lean(),
    Organization.findById(ORG_ID).select('_id nombre codigo estado').lean()
  ]);
  if (!studentUser || !studentUser.activo || studentUser.role !== 'estudiante') throw new Error('La cuenta estudiantil existente no está activa o no tiene el rol esperado.');
  if (!teacherUser || !teacherUser.activo || teacherUser.role !== 'tutor') throw new Error('La cuenta docente existente no está activa o no tiene el rol esperado.');
  if (!organization || organization.estado !== 'activa') throw new Error('La Universidad de Cartagena no está activa.');
  const [studentMembership, teacherMembership] = await Promise.all([
    Membership.findOne({ organizacion: ORG_ID, usuario: STUDENT_USER_ID, role: 'estudiante', estado: 'activo' }).lean(),
    Membership.findOne({ organizacion: ORG_ID, usuario: TEACHER_USER_ID, role: 'tutor', estado: 'activo' }).lean()
  ]);
  if (!studentMembership || !teacherMembership) throw new Error('Falta una membresía institucional activa; se cancela la carga.');

  for (const pdf of pdfs) {
    const full = path.join(PDF_DIR, pdf.file);
    if (!fs.existsSync(full) || fs.statSync(full).size < 500) throw new Error('PDF ausente o inválido: ' + pdf.file);
  }

  await conectarMySQL();
  const pool = obtenerPoolMySQL();
  const db = await pool.getConnection();
  const summary = { organization: organization.nombre, student: studentUser.email, teacher: teacherUser.email, courses: 0, enrollments: 0, activities: 0, resources: 0 };
  try {
    await db.beginTransaction();
    const studentId = stableId('student-luis-udec');
    await db.execute(
      `INSERT INTO academic_students (id, organization_id, student_code, full_name, email, phone, program, semester, status, user_id, tutor_user_id)
       VALUES (?, ?, ?, ?, ?, '', ?, ?, 'activo', ?, ?)
       ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), email=VALUES(email), program=VALUES(program), semester=VALUES(semester), status='activo', user_id=VALUES(user_id), tutor_user_id=VALUES(tutor_user_id)`,
      [studentId, ORG_ID, 'DEMO-LDR-001', 'Luis Daniel Ramírez', studentUser.email, 'Ingeniería de Software', 3, STUDENT_USER_ID, TEACHER_USER_ID]
    );
    const [studentRows] = await db.execute('SELECT id FROM academic_students WHERE organization_id=? AND user_id=?', [ORG_ID, STUDENT_USER_ID]);
    if (studentRows.length !== 1) throw new Error('No se pudo resolver de forma única la ficha académica de Luis.');
    const resolvedStudentId = studentRows[0].id;

    for (const course of courses) {
      const courseId = stableId('course-' + course.code);
      await db.execute(
        `INSERT INTO academic_courses (id, organization_id, course_code, name, description, status, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, 'activo', ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), status='activo'`,
        [courseId, ORG_ID, course.code, course.name, course.description, TEACHER_USER_ID]
      );
      const [courseRows] = await db.execute('SELECT id FROM academic_courses WHERE organization_id=? AND course_code=?', [ORG_ID, course.code]);
      const resolvedCourseId = courseRows[0].id;
      await db.execute(
        `INSERT INTO academic_course_teachers (id, organization_id, course_id, teacher_user_id, assigned_by_user_id, status)
         VALUES (?, ?, ?, ?, ?, 'activo')
         ON DUPLICATE KEY UPDATE status='activo'`,
        [stableId('teacher-' + course.code), ORG_ID, resolvedCourseId, TEACHER_USER_ID, TEACHER_USER_ID]
      );
      await db.execute(
        `INSERT INTO academic_course_students (id, organization_id, course_id, student_id, status)
         VALUES (?, ?, ?, ?, 'activo')
         ON DUPLICATE KEY UPDATE status='activo'`,
        [stableId('enrollment-' + course.code), ORG_ID, resolvedCourseId, resolvedStudentId]
      );
      summary.courses++; summary.enrollments++;

      const moduleId = stableId('module-' + course.code + '-1');
      await db.execute(
        `INSERT INTO academic_course_modules (id, organization_id, course_id, module_number, title, description, created_by_user_id)
         VALUES (?, ?, ?, 1, 'Módulo 1', 'Módulo inicial de demostración.', ?)
         ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), status='activo'`,
        [moduleId, ORG_ID, resolvedCourseId, TEACHER_USER_ID]
      );

      for (const pdf of pdfs) {
        const stored = stableId('resource-' + course.code + '-' + pdf.file) + '.pdf';
        const filePath = path.join(PDF_DIR, pdf.file);
        const size = fs.statSync(filePath).size;
        await db.execute(
          `INSERT INTO academic_course_resources (id, organization_id, course_id, title, description, original_name, stored_name, mime_type, file_size_bytes, uploaded_by_user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'application/pdf', ?, ?)
           ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), file_size_bytes=VALUES(file_size_bytes)`,
          [stableId('resource-' + course.code + '-' + pdf.file), ORG_ID, resolvedCourseId, pdf.title, pdf.description, pdf.file, stored, size, TEACHER_USER_ID]
        );
        const canonical = path.join(PDF_DIR, stored);
        if (!fs.existsSync(canonical)) fs.copyFileSync(filePath, canonical);
        summary.resources++;
      }

      for (let i = 0; i < course.activities.length; i++) {
        const [title, description, instructions, dueAt] = course.activities[i];
        await db.execute(
          `INSERT INTO academic_course_activities (id, organization_id, course_id, module_id, title, description, instructions, opens_at, due_at, status, created_by_user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, '2026-11-05 18:00:00', ?, 'publicada', ?)
           ON DUPLICATE KEY UPDATE module_id=VALUES(module_id), title=VALUES(title), description=VALUES(description), instructions=VALUES(instructions), due_at=VALUES(due_at), status='publicada'`,
          [stableId('activity-' + course.code + '-' + i), ORG_ID, resolvedCourseId, moduleId, title, description, instructions, dueAt, TEACHER_USER_ID]
        );
        summary.activities++;
      }
    }
    await db.commit();

    const aiCollection = mongoose.connection.collection('taskflow_ai_profiles');
    await aiCollection.updateOne({ key: aiProfile.key }, { $set: aiProfile, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    const promptCollection = mongoose.connection.collection('taskflow_ai_prompt_templates');
    for (const prompt of prompts) {
      await promptCollection.updateOne({ key: prompt.key }, { $set: { ...prompt, active: true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    }
    console.log('[seed-academic-demo] SUCCESS', JSON.stringify({
      ...summary,
      studentCode: 'DEMO-LDR-001',
      studentId: resolvedStudentId,
      courseCodes: courses.map(c => c.code),
      aiProfile: aiProfile.key,
      aiPromptTemplates: prompts.length,
      aiConnection: 'not_connected',
      note: 'No se crearon prácticas, empresas, evidencias ni calificaciones ficticias.'
    }));
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
    await desconectarMySQL();
    await mongoose.disconnect();
  }
}

main().catch(async error => {
  console.error('[seed-academic-demo] ERROR', error.code || error.message);
  await desconectarMySQL().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
