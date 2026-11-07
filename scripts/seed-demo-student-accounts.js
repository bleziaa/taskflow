const crypto = require('node:crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { env } = require('../src/config/env');
const { conectarMySQL, obtenerPoolMySQL, desconectarMySQL } = require('../src/config/mysql');

const ORG_ID = '6ae8d1083020512c8f5d8067';
const TEACHER_ID = '6aebf1df9e618a1a83af1a8d';
const PASSWORD = process.env.DEMO_STUDENT_PASSWORD;
const ROOT = require('node:path').resolve(__dirname, '..');
const stableId = key => crypto.createHash('sha256').update('taskflow-demo-login:' + key).digest('hex').slice(0, 24);
const profiles = [
  { key:'camila', code:'DEMO-BDII-002', name:'Camila Torres (DEMO)', email:'camila.torres.demo@example.invalid' },
  { key:'andres', code:'DEMO-BDII-003', name:'Andrés Pérez (DEMO)', email:'andres.perez.demo@example.invalid' },
  { key:'valentina', code:'DEMO-BDII-004', name:'Valentina Gómez (DEMO)', email:'valentina.gomez.demo@example.invalid' }
];

async function main(){
  if(!PASSWORD || PASSWORD.length < 12) throw new Error('Define DEMO_STUDENT_PASSWORD en el entorno (mínimo 12 caracteres).');
  if(!env.mysql.enabled) throw new Error('MYSQL_ENABLED no está habilitado.');
  await mongoose.connect(env.mongoUri);
  const User = require('../src/models/User');
  const Organization = require('../src/models/Organization');
  const Membership = require('../src/models/OrganizationMembership');
  const org = await Organization.findById(ORG_ID).lean();
  const teacher = await User.findById(TEACHER_ID).lean();
  if(!org || org.estado !== 'activa') throw new Error('La organización DEMO no está activa.');
  if(!teacher || teacher.role !== 'tutor' || !teacher.activo) throw new Error('No se encontró el docente activo de demostración.');
  const teacherMembership = await Membership.findOne({organizacion:ORG_ID,usuario:TEACHER_ID,role:'tutor',estado:'activo'}).lean();
  if(!teacherMembership) throw new Error('El docente no tiene membresía institucional activa.');
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const ids = {};
  for(const profile of profiles){
    const id = stableId('user-' + profile.key);
    ids[profile.key] = id;
    const existing = await User.findOne({email:profile.email});
    if(existing && existing.role !== 'estudiante') throw new Error('El correo DEMO ya existe con otro rol: ' + profile.email);
    if(!existing){
      await User.create({_id:id,nombre:profile.name,email:profile.email,passwordHash,role:'estudiante',activo:true,debeCambiarPassword:false});
    } else {
      existing.nombre = profile.name;
      existing.activo = true;
      await existing.save();
    }
    await Membership.updateOne(
      {organizacion:ORG_ID,usuario:id},
      {$set:{role:'estudiante',estado:'activo',asignadoPor:TEACHER_ID}},
      {upsert:true}
    );
  }
  await conectarMySQL();
  const pool = obtenerPoolMySQL();
  const db = await pool.getConnection();
  try{
    await db.beginTransaction();
    for(const profile of profiles){
      const [result] = await db.execute(
        "UPDATE academic_students SET user_id=? WHERE organization_id=? AND student_code=?",
        [ids[profile.key],ORG_ID,profile.code]
      );
      if(result.affectedRows !== 1) throw new Error('No se encontró una ficha académica DEMO única para ' + profile.code);
    }
    await db.commit();
  }catch(error){await db.rollback();throw error;}
  finally{db.release();await desconectarMySQL();}
  console.log('[seed-demo-student-accounts] SUCCESS',JSON.stringify({
    organization:org.nombre,
    accounts:profiles.map(p=>({name:p.name,email:p.email,role:'estudiante'})),
    passwordConfigured:true,
    note:'Cuentas ficticias etiquetadas DEMO; correos .invalid; no representan personas reales. Cambiar la clave antes de cualquier despliegue público.'
  }));
}
main().catch(async error=>{
  console.error('[seed-demo-student-accounts] ERROR',error.code||error.message);
  await desconectarMySQL().catch(()=>{});
  await mongoose.disconnect().catch(()=>{});
  process.exitCode=1;
});
