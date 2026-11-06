const Student = require('../models/Student');
const Company = require('../models/Company');
const User = require('../models/User');
const Practice = require('../models/Practice');
const Membership = require('../models/OrganizationMembership');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const campos = ['codigo', 'nombre', 'email', 'telefono', 'programa', 'semestre', 'estado', 'empresa', 'tutor'];
function payload(body, parcial = false) {
  const data = {}; for (const campo of campos) if (Object.prototype.hasOwnProperty.call(body, campo)) data[campo] = body[campo];
  if (!parcial) { data.codigo = String(data.codigo || '').trim().toUpperCase(); data.nombre = String(data.nombre || '').trim(); data.email = String(data.email || '').trim().toLowerCase(); data.programa = String(data.programa || 'Ingeniería de Software').trim(); data.semestre = Number(data.semestre); }
  if (data.empresa === '') data.empresa = null; if (data.tutor === '') data.tutor = null; return data;
}
async function validarReferencias(data, organizationId = null) {
  if (data.empresa) { const empresa = await Company.exists({ _id: data.empresa, ...(organizationId ? { organizationId } : {}) }); if (!empresa) throw new ApiError(400, 'La empresa seleccionada no existe en esta organización.', { code: 'INVALID_COMPANY' }); }
  if (data.tutor) { const tutor = await User.findOne({ _id: data.tutor, role: 'tutor' }).select('_id'); if (!tutor) throw new ApiError(400, 'El tutor seleccionado no existe o no tiene el rol de tutor.', { code: 'INVALID_TUTOR' }); if (organizationId) { const membership = await Membership.exists({ organizacion: organizationId, usuario: tutor._id, role: 'tutor', estado: 'activo' }); if (!membership) throw new ApiError(400, 'El tutor no tiene una membresía activa en esta organización.', { code: 'TUTOR_NOT_IN_ORGANIZATION' }); } }
}
async function buscarCuentaEstudiante(email, organizationId = null) { const cuenta = await User.findOne({ email, role: 'estudiante' }).select('_id'); if (!cuenta || !organizationId) return cuenta; const membership = await Membership.exists({ organizacion: organizationId, usuario: cuenta._id, role: 'estudiante', estado: 'activo' }); return membership ? cuenta : null; }
const listarEstudiantes = asyncHandler(async (req, res) => {
  const filtro = { ...(req.organization ? { organizationId: req.organization._id } : {}) }; if (req.query.estado && ['activo','inactivo'].includes(req.query.estado)) filtro.estado=req.query.estado;
  if (req.query.q) { const q=String(req.query.q).trim().slice(0,80); filtro.$or=[{nombre:{$regex:q,$options:'i'}},{codigo:{$regex:q,$options:'i'}},{email:{$regex:q,$options:'i'}}]; }
  const estudiantes=await Student.find(filtro).populate({path:'empresa',match:req.organization?{organizationId:req.organization._id}:{},select:'razonSocial nit'}).populate('tutor','nombre email').sort({createdAt:-1}).limit(200); res.json({ok:true,data:{estudiantes}});
});
const obtenerEstudiante=asyncHandler(async(req,res)=>{const estudiante=await Student.findOne({_id:req.params.id,...(req.organization?{organizationId:req.organization._id}:{})}).populate({path:'empresa',match:req.organization?{organizationId:req.organization._id}:{},select:'razonSocial nit'}).populate('tutor','nombre email');if(!estudiante)throw new ApiError(404,'No se encontró el estudiante.',{code:'STUDENT_NOT_FOUND'});res.json({ok:true,data:{estudiante}});});
const crearEstudiante=asyncHandler(async(req,res)=>{const datos=payload(req.body);await validarReferencias(datos,req.organization?._id||null);if(req.organization)datos.organizationId=req.organization._id;const cuenta=await buscarCuentaEstudiante(datos.email,req.organization?._id||null);if(cuenta)datos.usuario=cuenta._id;const estudiante=await Student.create(datos);res.status(201).json({ok:true,data:{estudiante}});});
const actualizarEstudiante=asyncHandler(async(req,res)=>{const datos=payload(req.body,true);await validarReferencias(datos,req.organization?._id||null);let cambios=datos;if(Object.prototype.hasOwnProperty.call(datos,'email')){const cuenta=await buscarCuentaEstudiante(datos.email,req.organization?._id||null);cambios=cuenta?{$set:{...datos,usuario:cuenta._id}}:{$set:datos,$unset:{usuario:1}};}const estudiante=await Student.findOneAndUpdate({_id:req.params.id,...(req.organization?{organizationId:req.organization._id}:{})},cambios,{returnDocument:'after',runValidators:true}).populate({path:'empresa',match:req.organization?{organizationId:req.organization._id}:{},select:'razonSocial nit'}).populate('tutor','nombre email');if(!estudiante)throw new ApiError(404,'No se encontró el estudiante.',{code:'STUDENT_NOT_FOUND'});res.json({ok:true,data:{estudiante}});});
const eliminarEstudiante=asyncHandler(async(req,res)=>{const tienePracticas=await Practice.exists({estudiante:req.params.id,...(req.organization?{organizationId:req.organization._id}:{})});if(tienePracticas)throw new ApiError(409,'No se puede eliminar un estudiante con historial de prácticas. Inactívalo para conservar su información académica.',{code:'STUDENT_HAS_PRACTICES'});const estudiante=await Student.findOneAndDelete({_id:req.params.id,...(req.organization?{organizationId:req.organization._id}:{})});if(!estudiante)throw new ApiError(404,'No se encontró el estudiante.',{code:'STUDENT_NOT_FOUND'});res.json({ok:true,data:{mensaje:'Estudiante eliminado.'}});});
module.exports={listarEstudiantes,obtenerEstudiante,crearEstudiante,actualizarEstudiante,eliminarEstudiante};
