const Practice = require('../models/Practice');
const Student = require('../models/Student');
const Attendance = require('../models/PracticeAttendance');
const hours = require('../utils/practice-hours');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
async function context(req) {
  const practice = await Practice.findOne({_id:req.params.id,organizationId:req.organization._id});
  if (!practice) throw new ApiError(404,'No se encontró la práctica.',{code:'PRACTICE_NOT_FOUND'});
  if (req.user.role === 'tutor' && String(practice.tutor) !== String(req.user._id)) throw new ApiError(403,'Solo el tutor asignado puede acceder a estas jornadas.',{code:'FORBIDDEN'});
  if (req.user.role === 'estudiante') {
    const student = await Student.findOne({_id:practice.estudiante,organizationId:req.organization._id,$or:[{usuario:req.user._id},{email:req.user.email}]});
    if (!student) throw new ApiError(403,'Solo puedes consultar tus propias jornadas.',{code:'FORBIDDEN'});
  }
  return practice;
}
const listar = asyncHandler(async(req,res)=>{
  const practice = await context(req);
  const filter = {organizationId:req.organization._id,practica:practice._id};
  const [registros, totals] = await Promise.all([
    Attendance.find(filter).sort({fecha:-1}).limit(100).populate('revisadoPor','nombre').populate('historial.revisadoPor','nombre').lean(),
    Attendance.aggregate([{$match:filter},{$group:{_id:'$estado',minutos:{$sum:'$minutos'},jornadas:{$sum:1}}}])
  ]);
  const resumen = {horasRequeridas:practice.horasRequeridas || 0,aprobada:0,pendiente:0,rechazada:0};
  for(const row of totals) resumen[row._id] = row.minutos;
  res.json({ok:true,data:{registros,resumen,limite:100}});
});
const registrar = asyncHandler(async(req,res)=>{
  const practice = await context(req);
  if (practice.estado !== 'en_curso') throw new ApiError(409,'Solo puedes reportar horas de una práctica en curso.',{code:'PRACTICE_NOT_RUNNING'});
  const fecha = hours.attendanceDate(req.params.fecha,practice);
  const {entrada,salida,descansoMinutos=0,descripcion} = req.body;
  const minutos = hours.duration({entrada,salida,descansoMinutos});
  if (typeof descripcion !== 'string' || descripcion.trim().length < 5 || descripcion.length > 2000) throw new ApiError(400,'Describe lo realizado en la jornada (entre 5 y 2000 caracteres).',{code:'INVALID_ATTENDANCE_DESCRIPTION'});
  const filter={organizationId:req.organization._id,practica:practice._id,fecha};
  const existing=await Attendance.findOne(filter);
  const data={entrada,salida,descansoMinutos,minutos,descripcion:descripcion.trim(),estado:'pendiente',observacion:'',revisadoPor:null,revisadoEn:null};
  let registro;
  if(existing) {
    if(existing.estado !== 'rechazada' || req.body.revision !== existing.revision) throw new ApiError(409,'La jornada ya está enviada. Solo puedes corregirla cuando el tutor la rechace; actualiza su estado.',{code:'ATTENDANCE_CONFLICT'});
    registro=await Attendance.findOneAndUpdate({...filter,estado:'rechazada',revision:req.body.revision},{$set:data,$inc:{revision:1}},{returnDocument:'after',runValidators:true});
    if(!registro) throw new ApiError(409,'La jornada cambió; actualiza la lista.',{code:'ATTENDANCE_CONFLICT'});
  } else {
    try { registro=await Attendance.create({...filter,...data,estudiante:practice.estudiante}); }
    catch(e){if(e.code===11000)throw new ApiError(409,'Ya existe una jornada para esa fecha.',{code:'ATTENDANCE_CONFLICT'});throw e;}
  }
  res.status(existing?200:201).json({ok:true,data:{registro}});
});
const revisar = asyncHandler(async(req,res)=>{
  const practice=await context(req);
  const {estado,observacion='',revision}=req.body;
  if (!['aprobada','rechazada'].includes(estado) || !Number.isInteger(revision) || typeof observacion!=='string' || observacion.length>2000 || (estado==='rechazada' && observacion.trim().length<5)) throw new ApiError(400,'Selecciona una decisión y explica las correcciones cuando rechaces una jornada.',{code:'INVALID_ATTENDANCE_REVIEW'});
  const submitted = await Attendance.findOne({organizationId:req.organization._id,practica:practice._id,_id:req.params.registroId,estado:'pendiente',revision}).lean();
  if (!submitted) throw new ApiError(409,'La jornada ya fue revisada o cambió; actualiza la lista.',{code:'ATTENDANCE_CONFLICT'});
  const snapshot = {entrada:submitted.entrada,salida:submitted.salida,descansoMinutos:submitted.descansoMinutos,minutos:submitted.minutos,descripcion:submitted.descripcion};
  const reviewedAt=new Date();
  const registro=await Attendance.findOneAndUpdate({organizationId:req.organization._id,practica:practice._id,_id:req.params.registroId,estado:'pendiente',revision},{$set:{estado,observacion:observacion.trim(),revisadoPor:req.user._id,revisadoEn:reviewedAt},$inc:{revision:1},$push:{historial:{...snapshot,estado,observacion:observacion.trim(),revisadoPor:req.user._id,revisadoEn:reviewedAt,revision}}},{returnDocument:'after',runValidators:true});
  if(!registro)throw new ApiError(409,'La jornada ya fue revisada o cambió; actualiza la lista.',{code:'ATTENDANCE_CONFLICT'});
  res.json({ok:true,data:{registro}});
});
const guardarHorario=asyncHandler(async(req,res)=>{
  const practice=await context(req);
  const horario=hours.schedule(req.body.horario);
  const horasRequeridas=hours.requiredHours(req.body.horasRequeridas);
  practice.horario=horario; practice.horasRequeridas=horasRequeridas; await practice.save();
  res.json({ok:true,data:{horario:practice.horario,horasRequeridas}});
});
module.exports={listar,registrar,revisar,guardarHorario};
