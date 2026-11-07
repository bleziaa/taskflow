const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { env } = require('../src/config/env');
const User = require('../src/models/User');
const Student = require('../src/models/Student');
const Company = require('../src/models/Company');
const Practice = require('../src/models/Practice');
const Activity = require('../src/models/Activity');
const Evaluation = require('../src/models/Evaluation');

const PASS = process.env.DEMO_TEST_PASSWORD;
const users = [
  { nombre: 'Administrador Demo', email: 'admin.pruebas@taskflow.test', role: 'administrador' },
  { nombre: 'Tutor Demo', email: 'tutor.pruebas@taskflow.test', role: 'tutor' },
  { nombre: 'Estudiante Demo Uno', email: 'estudiante1.pruebas@taskflow.test', role: 'estudiante' },
  { nombre: 'Estudiante Demo Dos', email: 'estudiante2.pruebas@taskflow.test', role: 'estudiante' },
];

async function ensureUser(data) {
  const passwordHash = await bcrypt.hash(PASS, 10);
  return User.findOneAndUpdate(
    { email: data.email },
    { $set: { nombre: data.nombre, role: data.role, activo: true, passwordHash } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function run() {
  if (!PASS || PASS.length < 12) throw new Error('Define DEMO_TEST_PASSWORD en el entorno (mínimo 12 caracteres).');
  await mongoose.connect(env.mongoUri);
  const accounts = {};
  for (const data of users) accounts[data.role + (data.email.includes('estudiante2') ? '2' : data.email.includes('estudiante1') ? '1' : '')] = await ensureUser(data);

  const companyData = [
    { razonSocial: 'Empresa Demo Tecnología SAS', nit: '901999001-1', sector: 'Tecnología', direccion: 'Sede de demostración', ciudad: 'Cartagena', contactoNombre: 'Contacto Demo', contactoEmail: 'contacto1@empresa.test', telefono: '3000000001', estado: 'activa' },
    { razonSocial: 'Soluciones Académicas Demo SAS', nit: '901999002-1', sector: 'Servicios educativos', direccion: 'Sede de demostración', ciudad: 'Sincelejo', contactoNombre: 'Contacto Demo Dos', contactoEmail: 'contacto2@empresa.test', telefono: '3000000002', estado: 'activa' }
  ];
  const companies = [];
  for (const data of companyData) companies.push(await Company.findOneAndUpdate({ nit: data.nit }, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true }));

  const studentData = [
    { codigo: 'DEMO-EST-001', nombre: 'Estudiante Demo Uno', email: 'estudiante1.pruebas@taskflow.test', programa: 'Ingeniería de Software', semestre: 4, estado: 'activo', usuario: accounts.estudiante1._id, empresa: companies[0]._id, tutor: accounts.tutor._id },
    { codigo: 'DEMO-EST-002', nombre: 'Estudiante Demo Dos', email: 'estudiante2.pruebas@taskflow.test', programa: 'Ingeniería de Software', semestre: 5, estado: 'activo', usuario: accounts.estudiante2._id, empresa: companies[1]._id, tutor: accounts.tutor._id }
  ];
  const students = [];
  for (const data of studentData) students.push(await Student.findOneAndUpdate({ codigo: data.codigo }, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true }));

  const now = new Date();
  const end = new Date(now); end.setDate(end.getDate() + 90);
  const practiceData = [
    { estudiante: students[0]._id, empresa: companies[0]._id, tutor: accounts.tutor._id, titulo: 'Práctica demo: Desarrollo de software', objetivo: 'Caso ficticio para validar el seguimiento de prácticas. Áreas: Programación Web, Bases de Datos, Ingeniería de Requisitos y Pruebas de Software.', fechaInicio: now, fechaFin: end, estado: 'en_curso', observaciones: 'Registro de demostración; no corresponde a una práctica real.' },
    { estudiante: students[1]._id, empresa: companies[1]._id, tutor: accounts.tutor._id, titulo: 'Práctica demo: Soporte y gestión tecnológica', objetivo: 'Caso ficticio para validar actividades y evaluación. Áreas: Soporte Técnico, Gestión de Proyectos, Documentación Técnica y Seguridad Informática.', fechaInicio: now, fechaFin: end, estado: 'en_curso', observaciones: 'Registro de demostración; no corresponde a una práctica real.' }
  ];
  const practices = [];
  for (const data of practiceData) {
    let practice = await Practice.findOne({ titulo: data.titulo, estudiante: data.estudiante });
    if (!practice) practice = await Practice.create(data);
    else { Object.assign(practice, data); await practice.save(); }
    practices.push(practice);
  }

  const activitySets = [
    [
      ['Programación Web: construir una interfaz funcional', 'Implementar una pantalla de consulta y formularios con validaciones.', 'alta'],
      ['Bases de Datos: diseñar y consultar colecciones', 'Crear consultas de prueba y documentar relaciones entre datos.', 'media'],
      ['Ingeniería de Requisitos: documentar historias de usuario', 'Redactar requisitos funcionales y criterios de aceptación.', 'media'],
      ['Pruebas de Software: ejecutar casos de prueba', 'Registrar resultados, errores encontrados y correcciones.', 'alta']
    ],
    [
      ['Soporte Técnico: diagnóstico de incidencias', 'Documentar el diagnóstico y la solución de incidencias ficticias.', 'alta'],
      ['Gestión de Proyectos: planificar actividades', 'Definir tareas, responsables y fechas de seguimiento.', 'media'],
      ['Documentación Técnica: elaborar manual de usuario', 'Preparar instrucciones de uso y procedimientos.', 'media'],
      ['Seguridad Informática: revisar buenas prácticas', 'Aplicar una lista de comprobación de seguridad básica.', 'alta']
    ]
  ];
  let activityCount = 0;
  for (let i = 0; i < practices.length; i++) {
    for (const [titulo, descripcion, prioridad] of activitySets[i]) {
      const fechaLimite = new Date(now); fechaLimite.setDate(fechaLimite.getDate() + 14 + activityCount);
      await Activity.findOneAndUpdate(
        { practica: practices[i]._id, titulo },
        { $set: { practica: practices[i]._id, titulo, descripcion, prioridad, fechaLimite, estado: 'pendiente', creadoPor: accounts.tutor._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      activityCount++;
    }
  }

  for (let i = 0; i < practices.length; i++) {
    await Evaluation.findOneAndUpdate(
      { practica: practices[i]._id },
      { $set: { practica: practices[i]._id, estudiante: students[i]._id, tutor: accounts.tutor._id, calificacion: i === 0 ? 4.5 : 4.0, concepto: i === 0 ? 'excelente' : 'bueno', fortalezas: 'Buen desempeño en el caso de demostración.', aspectosMejora: 'Continuar fortaleciendo la documentación y las pruebas.', observaciones: 'Evaluación ficticia para validar el módulo.' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const summary = {
    database: mongoose.connection.name,
    demoUsers: users.map(u => ({ email: u.email, role: u.role })),
    companies: await Company.countDocuments({ nit: { $in: companyData.map(c => c.nit) } }),
    students: await Student.countDocuments({ codigo: { $in: studentData.map(s => s.codigo) } }),
    practices: await Practice.countDocuments({ _id: { $in: practices.map(p => p._id) } }),
    activities: await Activity.countDocuments({ practica: { $in: practices.map(p => p._id) } }),
    evaluations: await Evaluation.countDocuments({ practica: { $in: practices.map(p => p._id) } }),
    passwordConfigured: true,
    note: 'Todos los registros creados/actualizados por este script son ficticios y están identificados como demo.'
  };
  console.log(JSON.stringify(summary, null, 2));
}
run().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => { if (mongoose.connection.readyState) await mongoose.disconnect(); });
