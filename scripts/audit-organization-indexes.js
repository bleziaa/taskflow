/**
 * Diagnóstico de migración de índices multi-organización.
 * SOLO LECTURA: inspecciona listIndexes y duplicados; nunca crea ni elimina índices.
 * Ejecutar: npm run audit:organization-indexes
 */
const mongoose = require('mongoose');
const fs = require('node:fs');
const path = require('node:path');
const { conectarDB, desconectarDB } = require('../src/config/db');

const plans = [
  { collection: 'students', obsoleteUnique: ['codigo_1', 'email_1'], desired: [
    { name: 'organizationId_1_codigo_1', key: { organizationId: 1, codigo: 1 }, unique: true, partialFilterExpression: { organizationId: { $type: 'objectId' } } },
    { name: 'organizationId_1_email_1', key: { organizationId: 1, email: 1 }, unique: true, partialFilterExpression: { organizationId: { $type: 'objectId' } } },
  ], duplicateKeys: [['organizationId', 'codigo'], ['organizationId', 'email']] },
  { collection: 'companies', obsoleteUnique: ['nit_1'], desired: [
    { name: 'organizationId_1_nit_1', key: { organizationId: 1, nit: 1 }, unique: true, partialFilterExpression: { organizationId: { $type: 'objectId' } } },
  ], duplicateKeys: [['organizationId', 'nit']] },
  { collection: 'evaluations', obsoleteUnique: ['practica_1'], desired: [
    { name: 'organizationId_1_practica_1', key: { organizationId: 1, practica: 1 }, unique: true, partialFilterExpression: { organizationId: { $type: 'objectId' } } },
  ], duplicateKeys: [['organizationId', 'practica']] },
];

async function main() {
  await conectarDB();
  const db = mongoose.connection.db;
  const report = { generatedAt: new Date().toISOString(), mode: 'READ_ONLY_INDEX_MIGRATION_DRY_RUN', database: mongoose.connection.name, writesPerformed: false, collections: [], blockers: [] };
  for (const plan of plans) {
    const collection = db.collection(plan.collection);
    let indexes = [];
    try { indexes = await collection.listIndexes().toArray(); }
    catch (error) {
      if (error.codeName !== 'NamespaceNotFound' && error.code !== 26) throw error;
    }
    const existing = indexes.map(index => ({
      name: index.name, key: index.key, unique: Boolean(index.unique),
      partialFilterExpression: index.partialFilterExpression || null,
    }));
    const obsolete = existing.filter(index => plan.obsoleteUnique.includes(index.name) && index.unique);
    const desired = plan.desired.map(spec => {
      const match = existing.find(index => index.name === spec.name);
      return { ...spec, alreadyPresent: Boolean(match), definitionMatches: Boolean(match && match.unique && JSON.stringify(match.key) === JSON.stringify(spec.key) && JSON.stringify(match.partialFilterExpression || null) === JSON.stringify(spec.partialFilterExpression)) };
    });
    const duplicateGroups = [];
    for (const fields of plan.duplicateKeys) {
      const group = { $group: { _id: Object.fromEntries(fields.map(field => [field, `$${field}`])), count: { $sum: 1 }, ids: { $push: '$_id' } } };
      const duplicates = await collection.aggregate([{ $match: { organizationId: { $type: 'objectId' } } }, group, { $match: { count: { $gt: 1 } } }, { $limit: 100 }]).toArray();
      if (duplicates.length) duplicateGroups.push({ fields, groups: duplicates.map(item => ({ key: item._id, count: item.count, ids: item.ids.map(String) })) });
    }
    const blockers = duplicateGroups.map(item => ({ collection: plan.collection, fields: item.fields, duplicateGroups: item.groups.length }));
    report.blockers.push(...blockers);
    report.collections.push({ collection: plan.collection, documentCount: await collection.countDocuments(), existingIndexes: existing, obsoleteUniqueIndexesToReview: obsolete, desiredIndexes: desired, duplicateGroups, proposedActions: [
      ...obsolete.map(index => ({ action: 'DROP_OLD_UNIQUE_INDEX', indexName: index.name, requiresApproval: true })),
      ...desired.filter(index => !index.alreadyPresent).map(index => ({ action: 'CREATE_COMPOUND_UNIQUE_INDEX', indexName: index.name, requiresApproval: true })),
    ] });
  }
  report.safeToPrepareMigration = report.blockers.length === 0;
  report.nextStep = report.blockers.length ? 'Resolve duplicate groups and rerun this read-only audit.' : 'Review existing index definitions, backup the database, then request explicit approval before running a separate migration.';
  const outputDir = path.resolve(__dirname, '..', 'reports');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'organization-index-migration-dry-run.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ outputPath, database: report.database, writesPerformed: false, collections: report.collections.map(item => ({ collection: item.collection, documents: item.documentCount, obsoleteUniqueIndexes: item.obsoleteUniqueIndexesToReview.map(index => index.name), desiredIndexes: item.desiredIndexes.map(index => ({ name: index.name, alreadyPresent: index.alreadyPresent, definitionMatches: index.definitionMatches })), duplicateGroups: item.duplicateGroups.length })), blockers: report.blockers.length, safeToPrepareMigration: report.safeToPrepareMigration }, null, 2));
}
main().catch(error => { console.error('Index audit failed:', error); process.exitCode = 1; }).finally(disconnect);
async function disconnect() { await desconectarDB(); }
