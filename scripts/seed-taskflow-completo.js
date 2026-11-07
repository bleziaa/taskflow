#!/usr/bin/env node
/**
 * Carga idempotente de datos ficticios para demostracion integral de TaskFlow.
 * Uso: node scripts/seed-taskflow-completo.js --target=offline [--dry-run]
 *      node scripts/seed-taskflow-completo.js --target=online  [--dry-run]
 * Nunca elimina colecciones ni modifica cuentas fuera del espacio demo dedicado.
 */
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const args = process.argv.slice(2);
const targetArg = args.find(x => x.startsWith('--target='));
const target = targetArg?.split('=')[1];
const dryRun = args.includes('--dry-run');
if (!['offline', 'online'].includes(target)) {
  console.error('Indica --target=offline o --target=online. No se ejecutaron cambios.');
  process.exit(2);
}
const root = path.resolve(__dirname, '..');
const envFile = path.join(root, target === 'offline' ? '.env.offline' : '.env');
if (!fs.existsSync(envFile)) throw new Error(`No existe el archivo de entorno para ${target}: ${path.basename(envFile)}`);
const fileEnv = dotenv.parse(fs.readFileSync(envFile));
const uri = fileEnv.MONGODB_URI;
if (!uri) throw new Error(`MONGODB_URI no está definido en ${path.basename(envFile)}`);
if (target === 'offline' && !/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(uri)) {
  throw new Error('Protección: el destino offline debe ser MongoDB local.');
}
if (target === 'online' && !/^mongodb\+srv:\/\//.test(uri)) {
  throw new Error('Protección: el destino online debe ser un clúster MongoDB Atlas mongodb+srv.');
}

const User = require('../src/models/User');
const Organization = require('../src/models/Organization');
const Membership = require('../src/models/OrganizationMembership');
const Student = require('../src/models/Student');
const Company = require('../src/models/Company');
const Practice = require('../src/models/Practice');
const Activity = require('../src/models/Activity');
const Evidence = require('../src/models/Evidence');
const Evaluation = require('../src/models/Evaluation');

const PASSWORD = process.env.DEMO_TASKFLOW_PASSWORD;
const PREFIX = 'TF-DEMO-2026';
const DEMO_ORG_CODE = 'TF-DEMO-2026';
const evidenceDir = path.join(root, 'storage', 'evidences');
const demoPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 67>>stream\nBT /F1 12 Tf 30 150 Td (TaskFlow - evidencia ficticia de demostracion) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const plusDays = n => { const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d; };
const userDefs = [
  { key:'admin', name:'Administrador general DEMO', email:'admin@demo.taskflow.test', role:'administrador' },
  { key:'tutor1', name:'Laura Méndez (DEMO)', email:'laura.mendez@demo.taskflow.test', role:'tutor' },
  { key:'tutor2', name:'Andrés Castillo (DEMO)', email:'andres.castillo@demo.taskflow.test', role:'tutor' },
  ...[
    ['ana','Ana Sofía Pérez'],['mateo','Mateo Rodríguez'],['valeria','Valeria Gómez'],
    ['santiago','Santiago Herrera'],['camila','Camila Torres'],['daniel','Daniel Rojas']
  ].map(([key,name],i)=>({key,name:`${name} (DEMO)`,email:`${key}@demo.taskflow.test`,role:'estudiante',studentIndex:i}))
];
const companyDefs = [
  {key:'tech',razonSocial:'Innovación Digital Caribe S.A.S. (DEMO)',nit:'TFD-900001',sector:'Tecnología y desarrollo de software',direccion:'Sede demostrativa, zona industrial',ciudad:'Cartagena',contactoNombre:'María Fernanda Díaz',contactoEmail:'contacto.tech@demo.taskflow.test',telefono:'3000000101'},
  {key:'services',razonSocial:'Soluciones Empresariales del Norte S.A.S. (DEMO)',nit:'TFD-900002',sector:'Servicios empresariales',direccion:'Sede demostrativa centro',ciudad:'Sincelejo',contactoNombre:'Carlos Pérez',contactoEmail:'contacto.services@demo.taskflow.test',telefono:'3000000102'},
  {key:'data',razonSocial:'Analítica y Datos del Caribe S.A.S. (DEMO)',nit:'TFD-900003',sector:'Datos y consultoría',direccion:'Sede demostrativa',ciudad:'Barranquilla',contactoNombre:'Diana Martínez',contactoEmail:'contacto.data@demo.taskflow.test',telefono:'3000000103'}
];
const activityTemplates = [
  ['Levantamiento de requisitos y diagnóstico','Identificar necesidades, actores, alcance y criterios de aceptación.','alta'],
  ['Diseño de solución y planificación','Documentar la propuesta técnica, responsables y cronograma.','media'],
  ['Implementación de entregable','Construir y documentar el componente asignado.','alta'],
  ['Pruebas, evidencias y cierre','Ejecutar verificaciones, registrar hallazgos y presentar resultados.','media']
];
const moduleTemplates = [
  {nombre:'Inducción y diagnóstico',descripcion:'Contexto de la empresa, reconocimiento del proceso y diagnóstico inicial.',ponderacion:20,orden:1},
  {nombre:'Planeación y diseño',descripcion:'Requisitos, planificación y diseño de la solución.',ponderacion:25,orden:2},
  {nombre:'Ejecución y desarrollo',descripcion:'Realización de actividades y elaboración de entregables.',ponderacion:35,orden:3},
  {nombre:'Evaluación y cierre',descripcion:'Verificación de resultados, documentación y reflexión final.',ponderacion:20,orden:4}
];

async function upsertUser(def, passwordHash) {
  const user = await User.findOneAndUpdate(
    { email:def.email },
    { $set:{ nombre:def.name, role:def.role, activo:true, passwordHash, debeCambiarPassword:false } },
    { upsert:true, returnDocument:'after', setDefaultsOnInsert:true, runValidators:true }
  );
  return user;
}
async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS:10000 });
  const dbName = mongoose.connection.name;
  if (dryRun) {
    console.log(JSON.stringify({mode:'DRY_RUN',target,database:dbName,planned:{users:userDefs.length,companies:companyDefs.length,students:6,practices:6,activities:24,evidences:12,evaluations:5},note:'Conexión validada; no se escribió ningún documento.'},null,2));
    return;
  }
  if (!PASSWORD || PASSWORD.length < 12) throw new Error('Define DEMO_TASKFLOW_PASSWORD en el entorno (mínimo 12 caracteres).');
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const users = {};
  for (const def of userDefs) users[def.key] = await upsertUser(def,passwordHash);
  const org = await Organization.findOneAndUpdate(
    {codigo:DEMO_ORG_CODE},
    {$set:{nombre:'TaskFlow - Organización de demostración',descripcion:'Espacio ficticio para presentar y probar los módulos de TaskFlow. No representa una institución ni prácticas reales.',emailContacto:'soporte@demo.taskflow.test',telefono:'3000000000',direccion:'Sede de demostración',ciudad:'Cartagena',estado:'activa',creadoPor:users.admin._id}},
    {upsert:true,returnDocument:'after',setDefaultsOnInsert:true,runValidators:true}
  );
  for (const u of Object.values(users)) {
    const role = u.role;
    await Membership.findOneAndUpdate(
      {organizacion:org._id,usuario:u._id},
      {$set:{role,estado:'activo',asignadoPor:users.admin._id}},
      {upsert:true,returnDocument:'after',setDefaultsOnInsert:true,runValidators:true}
    );
  }
  const companies=[];
  for (const c of companyDefs) companies.push(await Company.findOneAndUpdate(
    {organizationId:org._id,nit:c.nit},
    {$set:{organizationId:org._id,razonSocial:c.razonSocial,nit:c.nit,sector:c.sector,direccion:c.direccion,ciudad:c.ciudad,contactoNombre:c.contactoNombre,contactoEmail:c.contactoEmail,telefono:c.telefono,estado:'activa'}},
    {upsert:true,returnDocument:'after',setDefaultsOnInsert:true,runValidators:true}
  ));
  const students=[];
  for(let i=0;i<6;i++){
    const u=users[userDefs.find(x=>x.studentIndex===i).key];
    students.push(await Student.findOneAndUpdate(
      {organizationId:org._id,codigo:`${PREFIX}-EST-${String(i+1).padStart(3,'0')}`},
      {$set:{organizationId:org._id,codigo:`${PREFIX}-EST-${String(i+1).padStart(3,'0')}`,nombre:u.nombre,email:u.email,telefono:`30000001${String(i+10).padStart(2,'0')}`,programa:'Ingeniería de Software',semestre:3+(i%3),estado:'activo',usuario:u._id,empresa:companies[i%companies.length]._id,tutor:users[i%2?'tutor2':'tutor1']._id}},
      {upsert:true,returnDocument:'after',setDefaultsOnInsert:true,runValidators:true}
    ));
  }
  fs.mkdirSync(evidenceDir,{recursive:true});
  let evidenceCount=0, activityCount=0, evaluationCount=0;
  const practices=[];
  for(let i=0;i<students.length;i++){
    const tutor=users[i%2?'tutor2':'tutor1'];
    const practiceTitle=`Práctica demostrativa ${i+1}: ${['Desarrollo web','Gestión de datos','Soporte tecnológico'][i%3]}`;
    const status=i===5?'finalizada':i===4?'planificada':'en_curso';
    const practice=await Practice.findOneAndUpdate(
      {organizationId:org._id,estudiante:students[i]._id,titulo:practiceTitle},
      {$set:{organizationId:org._id,estudiante:students[i]._id,empresa:companies[i%companies.length]._id,tutor:tutor._id,titulo:practiceTitle,objetivo:'Desarrollar competencias profesionales mediante actividades planificadas, seguimiento tutorial, evidencias verificables y evaluación formativa. Registro completamente ficticio.',fechaInicio:plusDays(-20+i*2),fechaFin:plusDays(70+i*2),estado:status,observaciones:'DATOS DE DEMOSTRACIÓN: no corresponde a una práctica real.',estructuraAcademica:moduleTemplates,estructuraActualizadaPor:tutor._id,estructuraActualizadaEn:new Date()}},
      {upsert:true,returnDocument:'after',setDefaultsOnInsert:true,runValidators:true}
    );
    practices.push(practice);
    for(let j=0;j<4;j++){
      const [titulo,descripcion,prioridad]=activityTemplates[j];
      const completed=status==='finalizada'||(status!=='planificada'&&j===0);
      const inReview=status!=='finalizada'&&status!=='planificada'&&j===1;
      const activityStatus=completed?'completada':inReview?'en_revision':'pendiente';
      const due=plusDays(completed?-3:inReview?2:7+j*3);
      const module=practice.estructuraAcademica[j];
      const activity=await Activity.findOneAndUpdate(
        {organizationId:org._id,practica:practice._id,titulo},
        {$set:{organizationId:org._id,practica:practice._id,moduloAcademicoId:module._id,titulo,descripcion,fechaInicio:plusDays(-15+j*5),fechaLimite:due,prioridad,estado:activityStatus,creadoPor:tutor._id,...(completed?{evaluacionTutor:{calificacion:4.2+j*0.1,observaciones:'Entregable de demostración revisado.',fortalezas:'Cumple el propósito y presenta información organizada.',aspectosMejora:'Continuar fortaleciendo la documentación.',evaluadoPor:tutor._id,evaluadoEn:new Date()}}:{})}},
        {upsert:true,returnDocument:'after',setDefaultsOnInsert:true,runValidators:true}
      );
      activityCount++;
      if(completed||inReview){
        const stored=`taskflow-demo-${students[i]._id}-${j}.pdf`;
        const full=path.join(evidenceDir,stored);
        if(!fs.existsSync(full)) fs.writeFileSync(full,demoPdf,{flag:'wx'});
        const evidenceState=completed?'aprobada':'pendiente';
        await Evidence.findOneAndUpdate(
          {nombreAlmacenado:stored},
          {$set:{organizationId:org._id,actividad:activity._id,estudiante:students[i]._id,nombreOriginal:`Evidencia_${i+1}_${j+1}_DEMO.pdf`,nombreAlmacenado:stored,mimeType:'application/pdf',tamano:demoPdf.length,estado:evidenceState,observacionTutor:completed?'Evidencia ficticia aprobada para mostrar el flujo de revisión.':'Evidencia ficticia pendiente de revisión por el tutor.',revisadoPor:completed?tutor._id:null,revisadoEn:completed?new Date():null}},
          {upsert:true,returnDocument:'after',setDefaultsOnInsert:true,runValidators:true}
        );
        evidenceCount++;
      }
    }
    if(status!=='planificada'){
      const grade=i===5?4.7:4.1+(i%4)*0.2;
      await Evaluation.findOneAndUpdate(
        {organizationId:org._id,practica:practice._id},
        {$set:{organizationId:org._id,practica:practice._id,estudiante:students[i]._id,tutor:tutor._id,calificacion:grade,concepto:grade>=4.5?'excelente':grade>=4?'bueno':'satisfactorio',fortalezas:'Responsabilidad, disposición para aprender y cumplimiento de actividades demostrativas.',aspectosMejora:'Profundizar la documentación técnica y la justificación de decisiones.',observaciones:'Evaluación ficticia de demostración; no constituye una nota académica real.',evaluadoEn:new Date()}},
        {upsert:true,returnDocument:'after',setDefaultsOnInsert:true,runValidators:true}
      );
      evaluationCount++;
    }
  }
  const counts={
    users:await User.countDocuments({email:{$in:userDefs.map(x=>x.email)}}),
    memberships:await Membership.countDocuments({organizacion:org._id,estado:'activo'}),
    organizations:await Organization.countDocuments({_id:org._id}),
    companies:await Company.countDocuments({organizationId:org._id}),
    students:await Student.countDocuments({organizationId:org._id}),
    practices:await Practice.countDocuments({organizationId:org._id}),
    activities:await Activity.countDocuments({organizationId:org._id}),
    evidences:await Evidence.countDocuments({organizationId:org._id}),
    evaluations:await Evaluation.countDocuments({organizationId:org._id})
  };
  console.log(JSON.stringify({status:'SUCCESS',target,database:dbName,organization:org.nombre,counts,accounts:userDefs.map(x=>({email:x.email,role:x.role})),passwordConfigured:true,evidenceFilesCreated:evidenceCount,note:'Todos los registros y archivos son ficticios. Repetir la carga actualiza el espacio demo; no elimina datos ni toca cuentas ajenas a @demo.taskflow.test.'},null,2));
}
main().catch(err=>{console.error('SEED_ERROR',err.name,err.code||'',String(err.message).slice(0,500));process.exitCode=1;}).finally(async()=>{if(mongoose.connection.readyState)await mongoose.disconnect();});
