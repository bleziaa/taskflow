const { Router } = require('express');

const { requireAuth } = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { protegerCsrf } = require('../middleware/csrf');
const validate = require('../middleware/validate');
const { validarId, validarEstudiante, validarEmpresa } = require('../validators/admin.validators');
const { validarNuevoUsuario, validarActualizacionUsuario } = require('../validators/user.validators');
const estudiantes = require('../controllers/student.controller');
const empresas = require('../controllers/company.controller');
const usuarios = require('../controllers/user.controller');
const User = require('../models/User');
const Student = require('../models/Student');
const Company = require('../models/Company');
const Practice = require('../models/Practice');
const Activity = require('../models/Activity');
const Evidence = require('../models/Evidence');
const Evaluation = require('../models/Evaluation');
const organizationRoutes = require('./organization.routes');
const brandingRoutes = require('./branding.routes');

const router = Router();
router.use(requireAuth, requireRole('administrador'));
router.use('/organizations', organizationRoutes);
router.use('/branding', brandingRoutes);

router.get('/dashboard', async (req, res, next) => {
  try {
    const [estudiantes, tutores, cuentasActivas, cuentasInactivas, empresasActivas, empresasInactivas,
      practicasPlanificadas, practicasEnCurso, practicasFinalizadas, practicasSuspendidas,
      actividadesPendientes, actividadesRevision, actividadesCompletadas,
      evidenciasPendientes, evidenciasAprobadas, evidenciasCambios, evaluaciones, evaluacionesPorEmpresa] = await Promise.all([
      Student.countDocuments(),
      User.countDocuments({ role: 'tutor' }),
      User.countDocuments({ activo: true }),
      User.countDocuments({ activo: false }),
      Company.countDocuments({ estado: 'activa' }),
      Company.countDocuments({ estado: 'inactiva' }),
      Practice.countDocuments({ estado: 'planificada' }),
      Practice.countDocuments({ estado: 'en_curso' }),
      Practice.countDocuments({ estado: 'finalizada' }),
      Practice.countDocuments({ estado: 'suspendida' }),
      Activity.countDocuments({ estado: 'pendiente' }),
      Activity.countDocuments({ estado: 'en_revision' }),
      Activity.countDocuments({ estado: 'completada' }),
      Evidence.countDocuments({ estado: 'pendiente' }),
      Evidence.countDocuments({ estado: 'aprobada' }),
      Evidence.countDocuments({ estado: 'requiere_cambios' }),
      Evaluation.aggregate([{ $group: { _id: null, total: { $sum: 1 }, promedio: { $avg: '$calificacion' } } }]),
      Evaluation.aggregate([
        { $lookup: { from: 'practices', localField: 'practica', foreignField: '_id', as: 'practicaInfo' } },
        { $unwind: '$practicaInfo' },
        { $lookup: { from: 'companies', localField: 'practicaInfo.empresa', foreignField: '_id', as: 'empresaInfo' } },
        { $unwind: { path: '$empresaInfo', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$practicaInfo.empresa', empresa: { $first: '$empresaInfo.razonSocial' }, total: { $sum: 1 }, promedio: { $avg: '$calificacion' } } },
        { $sort: { total: -1, empresa: 1 } },
      ]),
    ]);
    res.json({ ok: true, data: {
      mensaje: 'Acceso autorizado al módulo de administración.', usuario: req.user.toJSON(),
      resumen: {
        estudiantes, tutores, cuentasActivas, cuentasInactivas,
        empresas: { activas: empresasActivas, inactivas: empresasInactivas },
        practicas: { planificadas: practicasPlanificadas, enCurso: practicasEnCurso, finalizadas: practicasFinalizadas, suspendidas: practicasSuspendidas },
        actividades: { pendientes: actividadesPendientes, enRevision: actividadesRevision, completadas: actividadesCompletadas },
        evidencias: { pendientes: evidenciasPendientes, aprobadas: evidenciasAprobadas, requierenCambios: evidenciasCambios },
        evaluaciones: {
          total: evaluaciones[0]?.total || 0,
          promedio: evaluaciones[0]?.promedio == null ? null : Number(evaluaciones[0].promedio.toFixed(2)),
          porEmpresa: evaluacionesPorEmpresa.map((item) => ({ empresa: item.empresa || 'Empresa sin identificar', total: item.total, promedio: Number(item.promedio.toFixed(2)) })),
        },
      },
    } });
  } catch (error) { next(error); }
});

router.get('/students', estudiantes.listarEstudiantes);
router.get('/students/:id', validarId, validate, estudiantes.obtenerEstudiante);
router.post('/students', protegerCsrf, validarEstudiante, validate, estudiantes.crearEstudiante);
router.patch('/students/:id', protegerCsrf, validarId, validate, estudiantes.actualizarEstudiante);
router.delete('/students/:id', protegerCsrf, validarId, validate, estudiantes.eliminarEstudiante);

router.get('/companies', empresas.listarEmpresas);
router.get('/companies/:id', validarId, validate, empresas.obtenerEmpresa);
router.post('/companies', protegerCsrf, validarEmpresa, validate, empresas.crearEmpresa);
router.patch('/companies/:id', protegerCsrf, validarId, validate, empresas.actualizarEmpresa);
router.delete('/companies/:id', protegerCsrf, validarId, validate, empresas.eliminarEmpresa);

router.get('/users', usuarios.listarUsuarios);
router.post('/users', protegerCsrf, validarNuevoUsuario, validate, usuarios.crearUsuario);
router.patch('/users/:id', protegerCsrf, validarId, validarActualizacionUsuario, validate, usuarios.actualizarUsuario);
router.post('/users/:id/reset-password', protegerCsrf, validarId, validate, usuarios.restablecerPassword);
router.delete('/users/:id', protegerCsrf, validarId, validate, usuarios.eliminarUsuario);

module.exports = router;
