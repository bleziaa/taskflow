const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function createFixture(port = 0) {
  if (!process.env.TASKFLOW_TEST_MYSQL_PORT) throw new Error('Specify an isolated local MySQL port with TASKFLOW_TEST_MYSQL_PORT.');
  const database = 'taskflow_enrollment_test_' + Date.now();
  Object.assign(process.env, { NODE_ENV: 'test', SESSION_SECRET: 'enrollment-tests-only', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', GEMINI_API_KEY: '', MYSQL_ENABLED: 'true', MYSQL_HOST: '127.0.0.1', MYSQL_PORT: process.env.TASKFLOW_TEST_MYSQL_PORT, MYSQL_USER: process.env.TASKFLOW_TEST_MYSQL_USER || 'root', MYSQL_PASSWORD: process.env.TASKFLOW_TEST_MYSQL_PASSWORD || '', MYSQL_DATABASE: database });
  const sql = await mysql.createConnection({ host: '127.0.0.1', port: Number(process.env.MYSQL_PORT), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD });
  await sql.query('CREATE DATABASE `' + database + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await sql.changeUser({ database });
  const migrations = path.join(__dirname, '../../database/mysql/migrations');
  for (const file of (await fs.readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) {
    for (const statement of (await fs.readFile(path.join(migrations, file), 'utf8')).split(';').map(s => s.trim()).filter(Boolean)) await sql.query(statement);
  }
  const mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri());
  const User = require('../../src/models/User'), Organization = require('../../src/models/Organization'), Membership = require('../../src/models/OrganizationMembership'), Student = require('../../src/models/Student');
  await Promise.all([User.init(), Organization.init(), Membership.init(), Student.init()]);
  const users = {};
  const passwordHash = await bcrypt.hash('AuditDemo123!', 4);
  for (const [key, role, nombre] of [['admin','administrador','Administradora Demo'],['teacher','tutor','Profesora Demo'],['otherTeacher','tutor','Otra Profesora'],['student','estudiante','Estudiante Demo']]) users[key] = await User.create({ nombre, email: key.toLowerCase() + '@enrollment.demo.test', role, passwordHash });
  const org = await Organization.create({ nombre: 'Institución Matrícula Demo', codigo: 'MATRICULA-DEMO', creadoPor: users.admin._id });
  for (const user of Object.values(users)) await Membership.create({ usuario: user._id, organizacion: org._id, role: user.role, asignadoPor: users.admin._id });
  const student = await Student.create({ organizationId: org._id, codigo: 'MAT-01', nombre: users.student.nombre, email: users.student.email, usuario: users.student._id, programa: 'Ingeniería de Software', semestre: 3, perfilCompletado: true });
  const noAccount = await Student.create({ organizationId: org._id, codigo: 'MAT-02', nombre: 'Estudiante sin cuenta', email: 'nocuenta@enrollment.demo.test', programa: 'Software', semestre: 3 });
  const foreignStudent = await Student.create({ organizationId: new mongoose.Types.ObjectId(), codigo: 'EXT-01', nombre: 'Otra institución', email: 'external@enrollment.demo.test', usuario: users.student._id, programa: 'Software', semestre: 3 });
  const courseId = String(new mongoose.Types.ObjectId());
  await sql.execute('INSERT INTO academic_courses (id, organization_id, course_code, name, description, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)', [courseId, String(org._id), 'SOFT-01', 'Desarrollo de Software', 'Materia de demostración para verificar matrícula y acceso.', String(users.admin._id)]);
  await sql.execute('INSERT INTO academic_course_teachers (id, organization_id, course_id, teacher_user_id, assigned_by_user_id) VALUES (?, ?, ?, ?, ?)', [String(new mongoose.Types.ObjectId()), String(org._id), courseId, String(users.teacher._id), String(users.admin._id)]);
  for (let i = 1; i <= 4; i++) await sql.execute('INSERT INTO academic_course_modules (id, organization_id, course_id, module_number, title, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)', [String(new mongoose.Types.ObjectId()), String(org._id), courseId, i, 'Unidad ' + i, String(users.admin._id)]);
  const server = require('../../src/app').crearApp({ sessionStore: new (require('express-session').MemoryStore)() }).listen(port, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return { server, sql, mongo, users, org, student, noAccount, foreignStudent, courseId, database,
    async close() { await new Promise(r => server.close(r)); await require('../../src/config/mysql').desconectarMySQL(); await mongoose.disconnect(); await mongo.stop(); await sql.query('DROP DATABASE `' + database + '`'); await sql.end(); } };
}
module.exports = { createFixture };
