const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'secret-for-demo-integration-tests';
const { crearApp } = require('../src/app');
const User = require('../src/models/User');
const Student = require('../src/models/Student');
const Company = require('../src/models/Company');
const Organization = require('../src/models/Organization');
const Membership = require('../src/models/OrganizationMembership');
const Practice = require('../src/models/Practice');
let mongo, server, org, tutor, admin, student, company;
async function session(user) {
  const agent = request.agent(server);
  let token = (await agent.get('/api/auth/csrf-token')).body.data.csrfToken;
  const logged = await agent.post('/api/auth/login').set('X-CSRF-Token',token).send({email:user.email,password:'Password123'});
  assert.equal(logged.status,200);
  token = (await agent.get('/api/auth/csrf-token')).body.data.csrfToken;
  const selected = await agent.put('/api/auth/organizations/active').set('X-CSRF-Token',token).send({organizationId:String(org._id)});
  assert.equal(selected.status,200);
  return agent;
}
async function mutation(agent, method, url, body) {
  const token=(await agent.get('/api/auth/csrf-token')).body.data.csrfToken;
  return agent[method](url).set('X-CSRF-Token',token).send(body);
}
before(async()=>{
  mongo=await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(),Organization.init(),Membership.init()]);
  const hash=await bcrypt.hash('Password123',4);
  admin=await User.create({nombre:'Admin Demo',email:'admin-practicas@demo.test',passwordHash:hash,role:'administrador'});
  tutor=await User.create({nombre:'Tutor Demo',email:'tutor-practicas@demo.test',passwordHash:hash,role:'tutor'});
  org=await Organization.create({nombre:'Institución Demo',codigo:'DEMO-TUTOR-01',creadoPor:admin._id});
  await Membership.create({usuario:admin._id,organizacion:org._id,role:'administrador',asignadoPor:admin._id});
  await Membership.create({usuario:tutor._id,organizacion:org._id,role:'tutor',asignadoPor:admin._id});
  student=await Student.create({organizationId:org._id,codigo:'DEMO-01',nombre:'Estudiante Demo',email:'estudiante-practicas@demo.test',programa:'Ingeniería de Software',semestre:3});
  company=await Company.create({organizationId:org._id,razonSocial:'Empresa Demo',nit:'DEMO-PRAC-01',ciudad:'Cartagena'});
  server=crearApp().listen(0);
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();await mongo.stop()});
test('docente crea práctica propia y administrador puede editarla',async()=>{
  const teacher=await session(tutor);
  assert.equal((await teacher.get('/api/organization/students')).status,200);
  assert.equal((await teacher.get('/api/organization/companies')).status,200);
  const payload={estudiante:String(student._id),empresa:String(company._id),tutor:String(admin._id),titulo:'Práctica demostrativa docente',fechaInicio:'2026-11-15',fechaFin:'2026-12-15',estado:'planificada'};
  const created=await mutation(teacher,'post','/api/organization/practices',payload);
  assert.equal(created.status,201,JSON.stringify(created.body));
  const id=created.body.data.practica._id;
  assert.equal(String((await Practice.findById(id)).tutor),String(tutor._id),'el tutor se asigna automáticamente');
  assert.equal((await mutation(teacher,'patch','/api/organization/practices/'+id,{titulo:'Cambio no permitido'})).status,403);
  const duplicate=await mutation(teacher,'post','/api/organization/practices',payload);
  assert.equal(duplicate.status,409);
  const administrator=await session(admin);
  const edited=await mutation(administrator,'patch','/api/organization/practices/'+id,{titulo:'Práctica revisada por administrador'});
  assert.equal(edited.status,200,JSON.stringify(edited.body));
  assert.equal((await Practice.findById(id)).titulo,'Práctica revisada por administrador');
});
test('usuario autenticado puede modificar su nombre sin modificar el rol',async()=>{
  const agent=await session(admin);
  const changed=await mutation(agent,'patch','/api/auth/profile',{nombre:'Administrador de Demostración'});
  assert.equal(changed.status,200,JSON.stringify(changed.body));
  assert.equal(changed.body.data.usuario.nombre,'Administrador de Demostración');
  assert.equal((await User.findById(admin._id)).role,'administrador');
});
