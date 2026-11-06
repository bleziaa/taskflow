/**
 * Auditoria multi-organizacion de TaskFlow.
 * Solo lectura: no crea, modifica ni elimina documentos.
 * Ejecutar: npm run audit:organizations
 */
const mongoose = require('mongoose');
const fs = require('node:fs');
const path = require('node:path');
const { conectarDB, desconectarDB } = require('../src/config/db');
const Student = require('../src/models/Student');
const Company = require('../src/models/Company');
const Practice = require('../src/models/Practice');
const Activity = require('../src/models/Activity');
const Evidence = require('../src/models/Evidence');
const Evaluation = require('../src/models/Evaluation');
const Membership = require('../src/models/OrganizationMembership');
const Organization = require('../src/models/Organization');

async function count(model, filter = {}) {
  return model.countDocuments(filter);
}

async function main() {
  await conectarDB();
  const models = { Student, Company, Practice, Activity, Evidence, Evaluation };
  const totals = {};
  for (const [name, Model] of Object.entries(models)) {
    const [total, conOrganizacion, sinOrganizacion] = await Promise.all([
      count(Model), count(Model, { organizationId: { $exists: true, $ne: null } }),
      count(Model, { $or: [{ organizationId: { $exists: false } }, { organizationId: null }] }),
    ]);
    totals[name] = { total, conOrganizacion, sinOrganizacion };
  }

  const [organizations, memberships, practices, activities, evidences, evaluations] = await Promise.all([
    Organization.find({}, '_id nombre codigo estado').lean(),
    Membership.countDocuments(),
    Practice.find({}, '_id estudiante empresa tutor').lean(),
    Activity.find({}, '_id practica').lean(),
    Evidence.find({}, '_id actividad estudiante').lean(),
    Evaluation.find({}, '_id practica estudiante').lean(),
  ]);

  const practiceIds = new Set(practices.map(x => String(x._id)));
  const studentIds = new Set((await Student.find({}, '_id').lean()).map(x => String(x._id)));
  const companyIds = new Set((await Company.find({}, '_id').lean()).map(x => String(x._id)));
  const activityIds = new Set(activities.map(x => String(x._id)));
  const orphanReferences = {
    practicesWithoutStudent: practices.filter(x => !studentIds.has(String(x.estudiante))).map(x => String(x._id)),
    practicesWithoutCompany: practices.filter(x => !companyIds.has(String(x.empresa))).map(x => String(x._id)),
    activitiesWithoutPractice: activities.filter(x => !practiceIds.has(String(x.practica))).map(x => String(x._id)),
    evidencesWithoutActivity: evidences.filter(x => !activityIds.has(String(x.actividad))).map(x => String(x._id)),
    evidencesWithoutStudent: evidences.filter(x => !studentIds.has(String(x.estudiante))).map(x => String(x._id)),
    evaluationsWithoutPractice: evaluations.filter(x => !practiceIds.has(String(x.practica))).map(x => String(x._id)),
    evaluationsWithoutStudent: evaluations.filter(x => !studentIds.has(String(x.estudiante))).map(x => String(x._id)),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY_DRY_RUN',
    database: mongoose.connection.name,
    warning: 'No se asignaron organizationId ni se modifico ningun documento.',
    organizations: organizations.map(o => ({ id: String(o._id), nombre: o.nombre, codigo: o.codigo, estado: o.estado })),
    memberships,
    collections: totals,
    references: {
      practices: practices.length, activities: activities.length,
      evidences: evidences.length, evaluations: evaluations.length,
    },
    orphanReferences,
    migrationReadiness: {
      readyForAutomaticAssignment: false,
      reason: 'Los modelos academicos no contienen un propietario institucional verificable. La pertenencia debe resolverse con evidencia de cada registro y aprobacion explicita.',
      nextStep: 'Revisar relaciones y documentar reglas de asignacion; generar un plan por registro antes de cualquier escritura.',
    },
  };

  const outputDir = path.resolve(__dirname, '..', 'reports');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'organization-audit-dry-run.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' });
  console.log(JSON.stringify({ outputPath, database: report.database, organizations: organizations.length, memberships, collections: totals, orphanReferenceCounts: Object.fromEntries(Object.entries(orphanReferences).map(([k, v]) => [k, v.length])), migrationReady: false }, null, 2));
}

main().catch(error => {
  console.error('La auditoria fallo:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  await desconectarDB();
});
