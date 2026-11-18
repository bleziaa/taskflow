const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const request=require('supertest'),mongoose=require('mongoose'),bcrypt=require('bcryptjs');
process.env.NODE_ENV='test';process.env.SESSION_SECRET='welcome-email-tests-only';
const nodemailer=require('nodemailer');const {MongoMemoryServer}=require('mongodb-memory-server');const {env}=require('../src/config/env');
const User=require('../src/models/User'),Organization=require('../src/models/Organization'),Membership=require('../src/models/OrganizationMembership');const {crearApp}=require('../src/app');const {enviarCredenciales}=require('../src/services/email.service');
let mongo,server,admin,org,messages=[],accepted=true,closed=0,originalTransport,originalSmtp;
async function csrf(a){return (await a.get('/api/auth/csrf-token')).body.data.csrfToken;}
before(async()=>{
 originalSmtp={...env.smtp};Object.assign(env.smtp,{host:'smtp.example.test',port:587,secure:false,user:'sender@example.test',pass:'test-only-placeholder',from:'sender@example.test'});
 originalTransport=nodemailer.createTransport;nodemailer.createTransport=()=>({sendMail:async message=>{messages.push(message);return {accepted:accepted?[message.to]:[],rejected:accepted?[]:[message.to]};},close:()=>{closed++;}});
 mongo=await MongoMemoryServer.create();await mongoose.connect(mongo.getUri());await Promise.all([User.init(),Organization.init(),Membership.init()]);
 admin=await User.create({nombre:'Admin Test',email:'admin@welcome.test',role:'administrador',passwordHash:await bcrypt.hash('Password123',4)});
 org=await Organization.create({nombre:'Institución Test',codigo:'MAILTEST',creadoPor:admin._id});await Membership.create({organizacion:org._id,usuario:admin._id,role:'administrador',asignadoPor:admin._id});
 server=crearApp({sessionStore:new(require('express-session').MemoryStore)()}).listen(0);
});
after(async()=>{nodemailer.createTransport=originalTransport;Object.assign(env.smtp,originalSmtp);await new Promise(r=>server.close(r));await mongoose.disconnect();await mongo.stop();});
async function create(email){const a=request.agent(server);let token=await csrf(a);assert.equal((await a.post('/api/auth/login').set('X-CSRF-Token',token).send({email:admin.email,password:'Password123'})).status,200);token=await csrf(a);return a.post('/api/admin/users').set('X-CSRF-Token',token).send({nombre:'Cuenta de prueba',email,role:'estudiante',membershipRole:'estudiante',organizationId:String(org._id)});}
test('crear usuario envía sus propias credenciales a su correo y obliga a cambiarlas',async()=>{
 const result=await create('persona@welcome.test');assert.equal(result.status,201,JSON.stringify(result.body));assert.equal(result.body.data.correo.status,'sent');assert.equal(result.body.data.credenciales,undefined);
 const message=messages.at(-1);assert.equal(message.to,'persona@welcome.test');assert.equal(message.subject,'Tu acceso a TaskFlow');assert.match(message.text,/Correo: persona@welcome.test/);assert.match(message.text,/login.html/);
 const temporary=message.text.match(/Contraseña temporal: (\S+)/)[1];const account=await User.findOne({email:message.to}).select('+passwordHash');assert.equal(await bcrypt.compare(temporary,account.passwordHash),true);assert.equal(account.debeCambiarPassword,true);
 const s=request.agent(server),token=await csrf(s);assert.equal((await s.post('/api/auth/login').set('X-CSRF-Token',token).send({email:account.email,password:temporary})).status,200);
 const dashboard=await s.get('/dashboard.html');assert.equal(dashboard.status,302);assert.equal(dashboard.headers.location,'/cambiar-password.html');
});
test('rechazo del destinatario no se anuncia como correo enviado y conserva alternativa administrativa',async()=>{
 accepted=false;const result=await create('rechazado@welcome.test');assert.equal(result.status,201);assert.equal(result.body.data.correo.status,'failed');assert.ok(result.body.data.credenciales.passwordTemporal);assert.equal(messages.at(-1).to,'rechazado@welcome.test');accepted=true;
});
test('mensaje de demostración identifica que no existe una cuenta y escapa HTML',async()=>{
 const result=await enviarCredenciales({nombre:'<Prueba>',email:'demo@welcome.test',passwordTemporal:'NO-VALIDA',organizacion:'<Institución>',url:'https://example.test/login.html',esPrueba:true});assert.equal(result.status,'sent');const mail=messages.at(-1);assert.match(mail.subject,/sin cuenta real/);assert.match(mail.text,/no se creó una cuenta real/);assert.match(mail.html,/&lt;Prueba&gt;/);assert.ok(closed>=3);
});
