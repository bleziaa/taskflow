const { Router } = require('express');

const { protegerCsrf } = require('../middleware/csrf');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const controller = require('../controllers/organization-context.controller');
const requireOrganization = require('../middleware/requireOrganization');
const { validarId, validarEstudiante, validarEmpresa } = require('../validators/admin.validators');
const estudiantes = require('../controllers/student.controller');
const empresas = require('../controllers/company.controller');
const practicas = require('../controllers/practice.controller');
const actividades = require('../controllers/activity.controller');
const evidencias = require('../controllers/evidence.controller');
const evaluaciones = require('../controllers/evaluation.controller');
const informes = require('../controllers/report.controller');
const estructuraAcademica = require('../controllers/academic-structure.controller');
const espaciosCurso = require('../controllers/course-workspace.controller');
const recursosActividadCurso = require('../controllers/course-activity-resource.controller');
const { subirRecursoCursoActividad } = require('../middleware/courseActivityResourceUpload');
const entregasCurso = require('../controllers/course-activity-evidence.controller');
const { subirEvidenciaCurso } = require('../middleware/courseActivityEvidenceUpload');
const gestionCursos = require('../controllers/course-management.controller');
const practiceValidators = require('../validators/practice.validators');
const activityValidators = require('../validators/activity.validators');
const evidenceValidators = require('../validators/evidence.validators');
const { subirEvidencia } = require('../middleware/evidenceUpload');
const { subirRecursoActividad } = require('../middleware/activityResourceUpload');
const { param, body } = require('express-validator');
const router = Router();
router.get('/', controller.listarOrganizacionesDelUsuario);
router.get('/branding', requireOrganization('administrador', 'tutor', 'estudiante'), controller.obtenerIdentidadOrganizacionActiva);
router.put('/active', protegerCsrf, body('organizationId').isMongoId().withMessage('Identificador de organización inválido.'), validate, controller.seleccionarOrganizacionActiva);
router.delete('/active', protegerCsrf, controller.limpiarOrganizacionActiva);

// CRUD institucional: separado del administrador general y siempre ligado
// a la organización activa validada contra la membresía de la sesión.
router.get('/students', requireOrganization('administrador'), estudiantes.listarEstudiantes);
router.get('/tutors', requireOrganization('administrador'), controller.listarTutoresDeOrganizacion);
router.get('/students/:id', requireOrganization('administrador'), validarId, validate, estudiantes.obtenerEstudiante);
router.post('/students', requireOrganization('administrador'), protegerCsrf, validarEstudiante, validate, estudiantes.crearEstudiante);
router.patch('/students/:id', requireOrganization('administrador'), protegerCsrf, validarId, validate, estudiantes.actualizarEstudiante);
router.delete('/students/:id', requireOrganization('administrador'), protegerCsrf, validarId, validate, estudiantes.eliminarEstudiante);

router.get('/companies', requireOrganization('administrador'), empresas.listarEmpresas);
router.get('/companies/:id', requireOrganization('administrador'), validarId, validate, empresas.obtenerEmpresa);
router.post('/companies', requireOrganization('administrador'), protegerCsrf, validarEmpresa, validate, empresas.crearEmpresa);
router.patch('/companies/:id', requireOrganization('administrador'), protegerCsrf, validarId, validate, empresas.actualizarEmpresa);
router.delete('/companies/:id', requireOrganization('administrador'), protegerCsrf, validarId, validate, empresas.eliminarEmpresa);

// Operaciones académicas: el rol efectivo proviene de la membresía institucional.
const rolesAcademicos = requireOrganization('administrador', 'tutor', 'estudiante');
const rolesCursos = requireOrganization('tutor', 'estudiante');
const aiChatLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { ok: false, error: { code: 'AI_RATE_LIMITED', message: 'Has enviado varias consultas. Espera un minuto y vuelve a intentarlo.' } } });
router.get('/courses', rolesCursos, espaciosCurso.listarCursos);
router.get('/courses/manage', requireOrganization('administrador'), gestionCursos.listarCursosAdministracion);
router.post('/courses', requireOrganization('administrador'), protegerCsrf,
  body('code').isString().trim().isLength({ min: 2, max: 40 }),
  body('name').isString().trim().isLength({ min: 2, max: 140 }),
  body('description').optional().isString().isLength({ max: 4000 }),
  body('moduleCount').isInt({ min: 4, max: 4 }).toInt(),
  body('teacherUserIds').optional().isArray({ max: 30 }),
  validate, gestionCursos.crearCurso);
router.patch('/courses/:courseId', requireOrganization('administrador'), protegerCsrf,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  body('code').optional().isString().trim().matches(/^[A-Za-z0-9_-]{2,40}$/),
  body('name').optional().isString().trim().isLength({ min: 2, max: 140 }),
  body('description').optional().isString().isLength({ max: 4000 }),
  body('status').optional().isIn(['activo', 'inactivo', 'archivado']),
  validate, gestionCursos.actualizarCurso);
router.post('/courses/:courseId/teachers', requireOrganization('administrador'), protegerCsrf,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  body('teacherUserId').isMongoId(), validate, gestionCursos.asignarDocente);
router.put('/courses/:courseId/modules', requireOrganization('administrador', 'tutor'), protegerCsrf,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  body('modules').isArray({ min: 4, max: 4 }),
  body('modules.*.id').isHexadecimal().isLength({ min: 24, max: 24 }),
  body('modules.*.title').isString().trim().isLength({ min: 2, max: 160 }),
  body('modules.*.description').optional().isString().isLength({ max: 2000 }),
  validate, gestionCursos.guardarModulos);
router.post('/courses/:courseId/activities', requireOrganization('administrador', 'tutor'), protegerCsrf,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  body('moduleId').isHexadecimal().isLength({ min: 24, max: 24 }),
  body('title').isString().trim().isLength({ min: 3, max: 160 }),
  body('description').optional().isString().isLength({ max: 4000 }),
  body('instructions').optional().isString().isLength({ max: 10000 }),
  body('opensAt').optional({ nullable: true }).isISO8601(),
  body('dueAt').optional({ nullable: true }).isISO8601(),
  body('status').optional().isIn(['borrador', 'publicada']),
  validate, gestionCursos.crearActividadCurso);
router.patch('/courses/:courseId/activities/:activityId', requireOrganization('administrador', 'tutor'), protegerCsrf,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('activityId').isHexadecimal().isLength({ min: 24, max: 24 }),
  body('moduleId').optional().isHexadecimal().isLength({ min: 24, max: 24 }),
  body('title').optional().isString().trim().isLength({ min: 3, max: 160 }),
  body('description').optional().isString().isLength({ max: 4000 }),
  body('instructions').optional().isString().isLength({ max: 10000 }),
  body('status').optional().isIn(['borrador', 'publicada', 'cerrada', 'archivada']),
  body('opensAt').optional({ nullable: true }).isISO8601(),
  body('dueAt').optional({ nullable: true }).isISO8601(),
  body('reason').optional().isString().isLength({ max: 500 }),
  validate, gestionCursos.actualizarActividadCurso);
router.delete('/courses/:courseId/activities/:activityId', requireOrganization('administrador', 'tutor'), protegerCsrf,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('activityId').isHexadecimal().isLength({ min: 24, max: 24 }),
  validate, gestionCursos.eliminarActividadCurso);
router.post('/courses/:courseId/activities/:activityId/resources', requireOrganization('tutor'), protegerCsrf,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('activityId').isHexadecimal().isLength({ min: 24, max: 24 }),
  subirRecursoCursoActividad, recursosActividadCurso.subir);
router.get('/courses/:courseId/activities/:activityId/resources/:resourceId/download', rolesCursos,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('activityId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('resourceId').isHexadecimal().isLength({ min: 24, max: 24 }),
  validate, recursosActividadCurso.descargar);
router.post('/courses/:courseId/activities/:activityId/evidences', requireOrganization('estudiante'), protegerCsrf,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('activityId').isHexadecimal().isLength({ min: 24, max: 24 }),
  validate, subirEvidenciaCurso, entregasCurso.subir);
router.get('/courses/:courseId/activities/:activityId/evidences', rolesCursos,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('activityId').isHexadecimal().isLength({ min: 24, max: 24 }),
  validate, entregasCurso.listar);
router.get('/courses/:courseId/activities/:activityId/evidences/:evidenceId/download', rolesCursos,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('activityId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('evidenceId').isHexadecimal().isLength({ min: 24, max: 24 }),
  validate, entregasCurso.descargar);
router.patch('/courses/:courseId/activities/:activityId/students/:studentId/deadline', requireOrganization('tutor'), protegerCsrf,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('activityId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('studentId').isHexadecimal().isLength({ min: 24, max: 24 }),
  body('dueAt').isISO8601({ strict: true, strictSeparator: true }),
  body('reason').optional().isString().isLength({ max: 500 }),
  validate, entregasCurso.cambiarFechaIndividual);
router.patch('/courses/:courseId/activities/:activityId/evidences/:evidenceId/review', requireOrganization('tutor'), protegerCsrf,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('activityId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('evidenceId').isHexadecimal().isLength({ min: 24, max: 24 }),
  body('status').isIn(['aprobada', 'requiere_cambios']),
  body('feedback').optional().isString().isLength({ max: 4000 }),
  validate, entregasCurso.revisar);
router.put('/courses/:courseId/activities/:activityId/evidences/:evidenceId/grade', requireOrganization('tutor'), protegerCsrf,
  param('courseId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('activityId').isHexadecimal().isLength({ min: 24, max: 24 }),
  param('evidenceId').isHexadecimal().isLength({ min: 24, max: 24 }),
  body('score').isFloat({ min: 0, max: 100 }).toFloat(),
  body('maxScore').optional().isFloat({ gt: 0, max: 100 }).toFloat(),
  body('feedback').optional().isString().isLength({ max: 4000 }),
  validate, entregasCurso.calificar);

router.get('/courses/:courseId/resources/:resourceId/download', rolesCursos, espaciosCurso.descargarRecurso);
router.get('/ai-assistant', rolesCursos, espaciosCurso.obtenerAsistente);
router.post('/ai-assistant/chat', rolesCursos, aiChatLimiter, protegerCsrf,
  body('message').isString().trim().isLength({ min: 1, max: 6000 }).withMessage('El mensaje debe tener entre 1 y 6000 caracteres.'),
  validate, espaciosCurso.conversarConAsistente);
router.get('/practices/:id/academic-structure', rolesAcademicos, practiceValidators.validarIdPractica, validate, estructuraAcademica.obtenerEstructura);
router.put('/practices/:id/academic-structure', requireOrganization('administrador', 'tutor'), protegerCsrf,
  practiceValidators.validarIdPractica,
  body('modulos').isArray({ min: 1, max: 20 }).withMessage('La estructura debe contener entre 1 y 20 módulos.'),
  body('motivoCambio').optional().isString().isLength({ max: 500 }),
  validate, estructuraAcademica.guardarEstructura);
router.get('/practices', rolesAcademicos, practicas.listarPracticas);
router.get('/practices/:id', rolesAcademicos, practiceValidators.validarIdPractica, validate, practicas.obtenerPractica);
router.post('/practices', requireOrganization('administrador'), protegerCsrf, practiceValidators.validarNuevaPractica, validate, practicas.crearPractica);
router.patch('/practices/:id', requireOrganization('administrador'), protegerCsrf, practiceValidators.validarIdPractica, practiceValidators.validarActualizacionPractica, validate, practicas.actualizarPractica);
router.delete('/practices/:id', requireOrganization('administrador'), protegerCsrf, practiceValidators.validarIdPractica, validate, practicas.eliminarPractica);

router.get('/activities', rolesAcademicos, activityValidators.validarFiltro, validate, actividades.listarActividades);
router.post('/activities', requireOrganization('administrador', 'tutor'), protegerCsrf, activityValidators.validarNueva, validate, actividades.crearActividad);
router.patch('/activities/:id', requireOrganization('administrador', 'tutor'), protegerCsrf, activityValidators.validarId, activityValidators.validarActualizacion, validate, actividades.actualizarActividad);
router.put('/activities/:id/self-assessment', requireOrganization('estudiante'), protegerCsrf, activityValidators.validarId,
  body('calificacion').isFloat({ min: 0, max: 5 }).toFloat(), body('reflexion').optional().isString().isLength({ max: 2000 }), validate, actividades.guardarAutoevaluacion);
router.put('/activities/:id/tutor-assessment', requireOrganization('administrador', 'tutor'), protegerCsrf, activityValidators.validarId,
  body('calificacion').isFloat({ min: 0, max: 5 }).toFloat(),
  body('observaciones').optional().isString().isLength({ max: 2000 }),
  body('fortalezas').optional().isString().isLength({ max: 2000 }),
  body('aspectosMejora').optional().isString().isLength({ max: 2000 }), validate, actividades.guardarEvaluacionTutor);
router.delete('/activities/:id', requireOrganization('administrador', 'tutor'), protegerCsrf, activityValidators.validarId, validate, actividades.eliminarActividad);
router.post('/activities/:id/resource', requireOrganization('administrador', 'tutor'), protegerCsrf, activityValidators.validarId, validate, subirRecursoActividad, actividades.subirRecurso);
router.get('/activities/:id/resource/download', rolesAcademicos, activityValidators.validarId, validate, actividades.descargarRecurso);

router.post('/activities/:actividadId/evidences', requireOrganization('estudiante'), protegerCsrf, evidenceValidators.validarActividadId, validate, subirEvidencia, evidencias.subir);
router.get('/evidences/activity/:actividadId', rolesAcademicos, evidenceValidators.validarActividadId, validate, evidencias.listarPorActividad);
router.get('/evidences/:id/download', rolesAcademicos, evidenceValidators.validarId, validate, evidencias.descargar);
router.patch('/evidences/:id/review', requireOrganization('administrador', 'tutor'), protegerCsrf, evidenceValidators.validarId, evidenceValidators.validarRevision, validate, evidencias.revisar);

router.get('/evaluations', rolesAcademicos, evaluaciones.listarEvaluaciones);
router.put('/evaluations/:practicaId', requireOrganization('administrador', 'tutor'), protegerCsrf,
  param('practicaId').isMongoId(), body('calificacion').isFloat({ min: 0, max: 5 }).toFloat(),
  body('concepto').isIn(['excelente', 'bueno', 'satisfactorio', 'insuficiente']),
  body('fortalezas').optional().isString().isLength({ max: 2000 }),
  body('aspectosMejora').optional().isString().isLength({ max: 2000 }),
  body('observaciones').optional().isString().isLength({ max: 3000 }), validate, evaluaciones.guardarEvaluacion);
router.get('/reports', rolesAcademicos, informes.obtenerInformes);

module.exports = router;
