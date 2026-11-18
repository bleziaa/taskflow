const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  organizationId: {type:mongoose.Schema.Types.ObjectId,ref:'Organization',required:true,index:true},
  practica: {type:mongoose.Schema.Types.ObjectId,ref:'Practice',required:true,index:true},
  estudiante: {type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},
  fecha: {type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/},
  entrada: {type:String,required:true}, salida: {type:String,required:true},
  descansoMinutos: {type:Number,required:true,min:0}, minutos: {type:Number,required:true,min:1,max:1439},
  descripcion: {type:String,required:true,trim:true,minlength:5,maxlength:2000},
  estado: {type:String,enum:['pendiente','aprobada','rechazada'],default:'pendiente'},
  revision: {type:Number,default:0},
  observacion: {type:String,default:'',maxlength:2000},
  revisadoPor: {type:mongoose.Schema.Types.ObjectId,ref:'User',default:null}, revisadoEn: {type:Date,default:null},
  historial: [{estado:String,observacion:String,revisadoPor:{type:mongoose.Schema.Types.ObjectId,ref:'User'},revisadoEn:Date,revision:Number,entrada:String,salida:String,descansoMinutos:Number,minutos:Number,descripcion:String}],
},{timestamps:true});
schema.index({organizationId:1,practica:1,fecha:1},{unique:true});
module.exports=mongoose.model('PracticeAttendance',schema);
