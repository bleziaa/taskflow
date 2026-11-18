const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),request=require('supertest'),mongoose=require('mongoose'),bcrypt=require('bcryptjs');
process.env.NODE_ENV='test';process.env.SESSION_SECRET='practice-hours-tests-only';process.env.SMTP_HOST='';
const {MongoMemoryServer}=require('mongodb-memory-server');const {crearApp}=require('../src/app');
const User=require('../src/models/User'),Organization=require('../src/models/Organization'),Membership=require('../src/models/OrganizationMembership'),Student=require('../src/models/Student'),Company=require('../src/models/Company'),Practice=require('../src/models/Practice'),Attendance=require('../src/models/PracticeAttendance');
const hours=require('../src/utils/practice-hours');
let mongo,server,admin,teacher,student,other,otherStudent,org,record,practice,company,agents;
async function mutate(agent,method,url,body){const token=(await agent.get('/api/auth/csrf-token')).body.data.csrfToken;return agent[method](url).set('X-CSRF-Token',token).send(body);}
async function login(user){const a=request.agent(server);const token=(await a.get('/api/auth/csrf-token')).body.data.csrfToken;assert.equal((await a.post('/api/auth/login').set('X-CSRF-Token',token).send({email:user.email,password:'Password123'})).status,200);assert.equal((await mutate(a,'put','/api/auth/organizations/active',{organizationId:String(org._id)})).status,200);return a;}
const schedule={dias:[1,2,3,4,5],entrada:'08:00',salida:'17:00',descansoMinutos:60};
const day={entrada:'08:00',salida:'17:00',descansoMinutos:60,descripcion:'Actualicé documentación y apoyé al equipo de desarrollo.'};
before(async()=>{
 mongo=await MongoMemoryServer.create();await mongoose.connect(mongo.getUri());await Promise.all([User.init(),Organization.init(),Membership.init(),Attendance.init()]);
 const passwordHash=await bcrypt.hash('Password123',4),users=[];
 for(const [key,role]of [['admin','administrador'],['teacher','tutor'],['student','estudiante'],['other','tutor'],['otherStudent','estudiante']])users.push(await User.create({nombre:'Demo '+key,email:key+'@hours.test',role,passwordHash}));
 [admin,teacher,student,other,otherStudent]=users;org=await Organization.create({nombre:'Institución Horas',codigo:'HORAS',creadoPor:admin._id});
 for(const user of users)await Membership.create({usuario:user._id,organizacion:org._id,role:user.role,asignadoPor:admin._id});
 record=await Student.create({organizationId:org._id,codigo:'H01',nombre:student.nombre,email:student.email,usuario:student._id,programa:'Software',semestre:3});
 company=await Company.create({organizationId:org._id,razonSocial:'Empresa Prueba',nit:'HORAS01',ciudad:'Cartagena'});
 practice=await Practice.create({organizationId:org._id,estudiante:record._id,empresa:company._id,tutor:teacher._id,titulo:'Práctica de software',fechaInicio:'2020-01-01',fechaFin:'2030-12-31',estado:'en_curso'});
 server=crearApp({sessionStore:new(require('express-session').MemoryStore)()}).listen(0);agents=await Promise.all(users.map(login));
});
after(async()=>{await new Promise(r=>server.close(r));await mongoose.disconnect();await mongo.stop();});
test('horarios calculan descansos y rechazan rangos y días inválidos',()=>{
 assert.equal(hours.duration(schedule),480);assert.deepEqual(hours.schedule({}),{dias:[],entrada:'',salida:'',descansoMinutos:0});
 for(const invalid of [{...schedule,salida:'07:00'},{...schedule,descansoMinutos:540},{...schedule,descansoMinutos:-1},{...schedule,dias:[1,1]},{...schedule,dias:[8]},{...schedule,entrada:'8:00'}])assert.throws(()=>hours.schedule(invalid));
 assert.throws(()=>hours.requiredHours(10.5));assert.throws(()=>hours.requiredHours(-1));
});
test('solo tutor asignado y administrador configuran horario; prácticas anteriores siguen legibles',async()=>{
 const [a,t,s,o]=agents;const url=`/api/organization/practices/${practice._id}/schedule`;
 assert.equal((await mutate(t,'put',url,{horario:schedule,horasRequeridas:160})).status,200);
 assert.equal((await mutate(s,'put',url,{horario:schedule,horasRequeridas:1})).status,403);
 assert.equal((await mutate(o,'put',url,{horario:schedule,horasRequeridas:1})).status,403);
 assert.equal((await mutate(a,'put',url,{horario:{...schedule,dias:[1,1]},horasRequeridas:160})).status,400);
 assert.equal((await mutate(a,'put',url,{horario:schedule,horasRequeridas:80})).status,200);
 const listed=await s.get('/api/organization/practices');assert.equal(listed.body.data.practicas[0].horasRequeridas,80);assert.deepEqual(listed.body.data.practicas[0].horario.dias,[1,2,3,4,5]);
});
test('registro pendiente no suma horas aprobadas; revisión cuenta 8 h y bloquea duplicados y autores ajenos',async()=>{
 const [a,t,s,o,os]=agents;const base=`/api/organization/practices/${practice._id}/attendance`;
 assert.equal((await request(server).get(base)).status,401);
 assert.equal((await o.get(base)).status,403);assert.equal((await os.get(base)).status,403);
 assert.equal((await mutate(t,'put',base+'/2026-01-05',day)).status,403);
 assert.equal((await s.put(base+'/2026-01-05').send(day)).status,403);
 assert.equal((await mutate(s,'put',base+'/2026-02-30',day)).status,400);
 assert.equal((await mutate(s,'put',base+'/2019-01-01',day)).status,400);
 assert.equal((await mutate(s,'put',base+'/2099-01-01',day)).status,400);
 assert.equal((await mutate(s,'put',base+'/2026-01-05',{...day,minutos:9999})).status,201);
 assert.equal((await mutate(s,'put',base+'/2026-01-05',day)).status,409);
 let list=(await s.get(base)).body.data;assert.equal(list.resumen.aprobada,0);assert.equal(list.resumen.pendiente,480);const entry=list.registros[0];assert.equal(entry.minutos,480);
 const review=base+'/'+entry._id+'/review';
 assert.equal((await mutate(s,'patch',review,{estado:'aprobada',revision:0})).status,403);
 assert.equal((await mutate(o,'patch',review,{estado:'aprobada',revision:0})).status,403);
 assert.equal((await mutate(t,'patch',review,{estado:'aprobada',revision:0,observacion:'Jornada comprobada'})).status,200);
 assert.equal((await mutate(a,'patch',review,{estado:'aprobada',revision:0})).status,409);
 list=(await s.get(base)).body.data;assert.equal(list.resumen.aprobada,480);assert.equal(list.resumen.pendiente,0);assert.equal(list.registros[0].revisadoPor.nombre,teacher.nombre);
 assert.equal((await mutate(a,'delete',`/api/organization/practices/${practice._id}`,{})).status,409);
 assert.equal((await mutate(a,'patch',`/api/organization/practices/${practice._id}`,{fechaInicio:'2026-02-01'})).status,409);
});
test('rechazo exige motivo, permite corrección, conserva revisión y no duplica fecha',async()=>{
 const [a,t,s]=agents,base=`/api/organization/practices/${practice._id}/attendance`;
 const created=await mutate(s,'put',base+'/2026-01-06',day);assert.equal(created.status,201);
 const id=created.body.data.registro._id,review=base+'/'+id+'/review';
 assert.equal((await mutate(t,'patch',review,{estado:'rechazada',revision:0})).status,400);
 assert.equal((await mutate(t,'patch',review,{estado:'rechazada',revision:0,observacion:'Corrige el horario de salida'})).status,200);
 assert.equal((await mutate(s,'put',base+'/2026-01-06',{...day,salida:'16:00',revision:0})).status,409);
 const corrected=await mutate(s,'put',base+'/2026-01-06',{...day,salida:'16:00',revision:1});assert.equal(corrected.status,200);assert.equal(corrected.body.data.registro.minutos,420);assert.equal(corrected.body.data.registro.historial.length,1);
 assert.equal((await mutate(a,'patch',review,{estado:'aprobada',revision:2})).status,200);
 const list=(await s.get(base)).body.data;assert.equal(list.resumen.aprobada,900);assert.equal(list.registros.find(x=>x._id===id).historial.length,2);
 assert.equal(await Attendance.countDocuments({practica:practice._id,fecha:'2026-01-06'}),1);
});
test('práctica cerrada y otra organización no admiten reportes',async()=>{
 const s=agents[2],base=`/api/organization/practices/${practice._id}/attendance`;
 await Practice.updateOne({_id:practice._id},{$set:{estado:'finalizada'}});
 assert.equal((await mutate(s,'put',base+'/2026-01-07',day)).status,409);
 const foreign=await Practice.create({organizationId:new mongoose.Types.ObjectId(),estudiante:record._id,empresa:company._id,tutor:teacher._id,titulo:'Otra institución',fechaInicio:'2020-01-01',fechaFin:'2030-01-01',estado:'en_curso'});
 assert.equal((await s.get(`/api/organization/practices/${foreign._id}/attendance`)).status,404);
});
