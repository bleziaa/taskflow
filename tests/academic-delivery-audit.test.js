const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const request=require('supertest');
const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');
const fs=require('node:fs/promises');
const path=require('node:path');
process.env.NODE_ENV='test';process.env.SESSION_SECRET='academic-audit-test-only';
const {MongoMemoryServer}=require('mongodb-memory-server');
const {crearApp}=require('../src/app');
const User=require('../src/models/User'),Organization=require('../src/models/Organization'),Membership=require('../src/models/OrganizationMembership'),Student=require('../src/models/Student'),Company=require('../src/models/Company'),Practice=require('../src/models/Practice'),Activity=require('../src/models/Activity'),Evidence=require('../src/models/Evidence');
const {STORAGE_DIR}=require('../src/middleware/evidenceUpload');
let mongo,server,org,teacher,student,admin,outsider,activity,studentRecord;
async function csrf(agent){return (await agent.get('/api/auth/csrf-token')).body.data.csrfToken;}
async function session(user){const agent=request.agent(server);const token=await csrf(agent);assert.equal((await agent.post('/api/auth/login').set('X-CSRF-Token',token).send({email:user.email,password:'Password123'})).status,200);assert.equal((await mutate(agent,'put','/api/auth/organizations/active',{organizationId:String(org._id)})).status,200);return agent;}
async function mutate(agent,method,url,body){const token=await csrf(agent);return agent[method](url).set('X-CSRF-Token',token).send(body);}
async function upload(agent,filename,contentType,buffer){const token=await csrf(agent);return agent.post(`/api/organization/activities/${activity._id}/evidences`).set('X-CSRF-Token',token).attach('archivo',buffer,{filename,contentType});}
before(async()=>{
 mongo=await MongoMemoryServer.create();await mongoose.connect(mongo.getUri());await Promise.all([User.init(),Organization.init(),Membership.init(),Student.init()]);
 const passwordHash=await bcrypt.hash('Password123',4);
 const users=[];for(const [key,role] of [['admin','administrador'],['teacher','tutor'],['student','estudiante'],['outsider','tutor']])users.push(await User.create({nombre:'Demo '+key,email:key+'@academic.test',role,passwordHash}));
 [admin,teacher,student,outsider]=users;org=await Organization.create({nombre:'Auditoría académica',codigo:'AUDIT',creadoPor:admin._id});
 for(const user of users)await Membership.create({usuario:user._id,organizacion:org._id,role:user.role,asignadoPor:admin._id});
 studentRecord=await Student.create({organizationId:org._id,codigo:'AUDIT01',nombre:student.nombre,email:student.email,usuario:student._id,programa:'Software',semestre:3});
 const company=await Company.create({organizationId:org._id,razonSocial:'Empresa Demo',nit:'TEST01',ciudad:'Cartagena'});
 const practice=await Practice.create({organizationId:org._id,estudiante:studentRecord._id,empresa:company._id,tutor:teacher._id,titulo:'Práctica auditada',fechaInicio:'2026-01-01',fechaFin:'2027-12-31',estado:'en_curso'});
 activity=await Activity.create({organizationId:org._id,practica:practice._id,titulo:'Informe final',fechaLimite:'2027-12-01',creadoPor:teacher._id});
 server=crearApp({sessionStore:new(require('express-session').MemoryStore)()}).listen(0);
});
after(async()=>{for(const file of await Evidence.find({organizationId:org._id}))await fs.unlink(path.join(STORAGE_DIR,file.nombreAlmacenado)).catch(()=>{});await new Promise(r=>server.close(r));await mongoose.disconnect();await mongo.stop();});
test('entrega, previsualización, corrección, calificación y permisos por rol',async()=>{
 const s=await session(student),t=await session(teacher),other=await session(outsider);
 assert.equal((await upload(s,'archivo.zip','application/zip',Buffer.from('PK\x03\x04'))).status,415);
 assert.equal((await upload(s,'archivo.exe','application/octet-stream',Buffer.from('MZ'))).status,415);
 assert.equal((await upload(s,'falso.pdf','application/pdf',Buffer.from('no soy pdf'))).status,415);
 assert.equal((await upload(s,'falso.doc','application/msword',Buffer.from('no soy doc'))).status,415);
 const uploaded=await upload(s,'informe.pdf','application/pdf',Buffer.from('%PDF-1.7\ninforme'));assert.equal(uploaded.status,201,JSON.stringify(uploaded.body));
 assert.equal(uploaded.body.data.evidencia.nombreOriginal,'informe.pdf');
 const id=uploaded.body.data.evidencia._id,url=`/api/organization/evidences/${id}/download`;
 assert.equal((await upload(s,'otra.pdf','application/pdf',Buffer.from('%PDF-1.7\notra'))).status,409);
 const preview=await t.get(url+'?view=1');assert.equal(preview.status,200);assert.match(preview.headers['content-disposition'],/^inline/);assert.match(preview.headers['content-type'],/application\/pdf/);
 assert.match((await s.get(url)).headers['content-disposition'],/^attachment/);
 assert.equal((await other.get(url+'?view=1')).status,403);assert.equal((await request(server).get(url+'?view=1')).status,401);
 assert.equal((await mutate(s,'patch',`/api/organization/evidences/${id}/review`,{estado:'aprobada'})).status,403);
 assert.equal((await mutate(t,'patch',`/api/organization/evidences/${id}/review`,{estado:'requiere_cambios',observacion:'Corrige el informe'})).status,200);
 const word=await upload(s,'corregido.doc','application/msword',Buffer.from('d0cf11e0a1b11ae100000000','hex'));assert.equal(word.status,201,JSON.stringify(word.body));
 const wordId=word.body.data.evidencia._id;
 assert.match((await t.get(`/api/organization/evidences/${wordId}/download?view=1`)).headers['content-disposition'],/^attachment/);
 assert.equal((await mutate(t,'patch',`/api/organization/evidences/${wordId}/review`,{estado:'aprobada',observacion:'Aprobado'})).status,200);
 const grade=await mutate(t,'put',`/api/organization/activities/${activity._id}/tutor-assessment`,{calificacion:4.5,observaciones:'Buen trabajo'});assert.equal(grade.status,200,JSON.stringify(grade.body));
 const tasks=await s.get('/api/organization/activities');assert.equal(tasks.body.data.actividades[0].evaluacionTutor.calificacion,4.5);
 assert.equal((await mutate(other,'put',`/api/organization/activities/${activity._id}/tutor-assessment`,{calificacion:5})).status,403);
});
test('conteo total no se limita a 200 y solo administración asigna tutor',async()=>{
 const a=await session(admin),s=await session(student),t=await session(teacher);
 await Student.insertMany(Array.from({length:201},(_,i)=>({organizationId:org._id,codigo:'BULK'+i,nombre:'Estudiante '+i,email:'bulk'+i+'@academic.test',programa:'Software',semestre:3})));
 const list=await a.get('/api/organization/students');assert.equal(list.body.data.total,202);assert.equal(list.body.data.estudiantes.length,200);
 assert.equal((await mutate(a,'patch',`/api/organization/students/${studentRecord._id}`,{tutor:String(teacher._id)})).status,200);
 assert.equal(String((await Student.findById(studentRecord._id)).tutor),String(teacher._id));
 assert.equal((await mutate(s,'patch',`/api/organization/students/${studentRecord._id}`,{tutor:String(outsider._id)})).status,403);
 assert.equal((await mutate(t,'patch',`/api/organization/students/${studentRecord._id}`,{tutor:String(outsider._id)})).status,403);
});
test('ambas cargas rechazan ZIP y aceptan PDF y Word por extensión y MIME',async()=>{
 const express=require('express');
 for(const uploadMiddleware of [require('../src/middleware/evidenceUpload').subirEvidencia,require('../src/middleware/courseActivityEvidenceUpload').subirEvidenciaCurso]){
 const app=express();app.post('/upload',uploadMiddleware,async(req,res)=>{await fs.unlink(req.file.path);res.sendStatus(201)});app.use((err,_req,res,_next)=>res.status(err.statusCode||err.status||415).json({error:err.message}));
 assert.equal((await request(app).post('/upload').attach('archivo',Buffer.alloc(10*1024*1024+1),{filename:'grande.pdf',contentType:'application/pdf'})).status,413);
 for(const [filename,contentType,expected] of [['test.pdf','application/pdf',201],['test.doc','application/msword',201],['test.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',201],['test.zip','application/zip',415],['test.pdf','application/msword',415]]){
 assert.equal((await request(app).post('/upload').attach('archivo',Buffer.from('fixture'),{filename,contentType})).status,expected);
 }
 }
});
test('el visor y PDF.js se sirven localmente; se conservan nombres normales de documentos',async()=>{
 const filename=require('../src/utils/document-filename');
 assert.equal(filename('informe-entrega.docx'),'informe-entrega.docx');assert.equal(filename('informe\r\n".pdf'),'informe___.pdf');
 assert.equal((await request(server).get('/pdf-viewer.html')).status,200);
 const library=await request(server).get('/vendor/pdfjs/pdf.mjs');assert.equal(library.status,200);assert.match(library.headers['content-type'],/javascript/);
 assert.equal((await request(server).get('/vendor/pdfjs/pdf.worker.mjs')).status,200);
});
