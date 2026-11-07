const fs = require('node:fs');
const path = require('node:path');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { conectarMySQL, obtenerPoolMySQL } = require('../config/mysql');
const { env } = require('../config/env');
const { consultarGemini } = require('../services/ai-assistant.service');

const STORAGE = path.resolve(__dirname, '..', '..', 'storage', 'course-resources');

async function getCoursesForRequest(req) {
  await conectarMySQL();
  const pool = obtenerPoolMySQL();
  const orgId = String(req.organization._id);
  const userId = String(req.user._id);
  const role = req.organizationMembership.role;
  let rows;
  if (role === 'tutor') {
    [rows] = await pool.execute(
      `SELECT c.id, c.course_code, c.name, c.description, c.status, c.created_at,
        (SELECT COUNT(*) FROM academic_course_activities a WHERE a.organization_id=c.organization_id AND a.course_id=c.id) AS activities_count,
        (SELECT COUNT(*) FROM academic_course_resources r WHERE r.organization_id=c.organization_id AND r.course_id=c.id) AS resources_count,
        (SELECT COUNT(*) FROM academic_course_students s WHERE s.organization_id=c.organization_id AND s.course_id=c.id AND s.status='activo') AS students_count
       FROM academic_courses c
       JOIN academic_course_teachers t ON t.organization_id=c.organization_id AND t.course_id=c.id AND t.teacher_user_id=? AND t.status='activo'
       WHERE c.organization_id=? AND c.status='activo' ORDER BY c.name`,
      [userId, orgId]
    );
  } else {
    [rows] = await pool.execute(
      `SELECT c.id, c.course_code, c.name, c.description, c.status, c.created_at, s.id AS student_id,
        (SELECT COUNT(*) FROM academic_course_activities a WHERE a.organization_id=c.organization_id AND a.course_id=c.id) AS activities_count,
        (SELECT COUNT(*) FROM academic_course_resources r WHERE r.organization_id=c.organization_id AND r.course_id=c.id) AS resources_count,
        1 AS students_count
       FROM academic_courses c
       JOIN academic_course_students cs ON cs.organization_id=c.organization_id AND cs.course_id=c.id AND cs.status='activo'
       JOIN academic_students s ON s.organization_id=cs.organization_id AND s.id=cs.student_id AND s.user_id=? AND s.status='activo'
       WHERE c.organization_id=? AND c.status='activo' ORDER BY c.name`,
      [userId, orgId]
    );
  }
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);
  const marks = ids.map(() => '?').join(',');
  const studentVisibility = role === 'estudiante' ? " AND status='publicada' AND (opens_at IS NULL OR opens_at <= CURRENT_TIMESTAMP(3))" : '';
  const [activities] = await pool.execute(
    `SELECT id, course_id, module_id, title, description, instructions, opens_at, due_at, status
     FROM academic_course_activities WHERE organization_id=? AND course_id IN (${marks})${studentVisibility}
     ORDER BY due_at IS NULL, due_at, title`,
    [orgId, ...ids]
  );
  const [modules] = await pool.execute(
    `SELECT id, course_id, module_number, title, description, status
     FROM academic_course_modules WHERE organization_id=? AND course_id IN (${marks})
     ORDER BY course_id, module_number`,
    [orgId, ...ids]
  );
  const [resources] = await pool.execute(
    `SELECT id, course_id, title, description, original_name, mime_type, file_size_bytes
     FROM academic_course_resources WHERE organization_id=? AND course_id IN (${marks})
     ORDER BY title`,
    [orgId, ...ids]
  );
  const [activityResources] = await pool.execute(
    `SELECT id, course_id, activity_id, title, description, original_name, file_size_bytes
     FROM academic_course_activity_resources WHERE organization_id=? AND course_id IN (${marks})
     ORDER BY activity_id, created_at`,
    [orgId, ...ids]
  );
  const [activityHistory] = role === 'tutor'
    ? await pool.execute(
      `SELECT id, course_id, activity_id, actor_user_id, changed_fields, before_values, after_values, changed_at
       FROM academic_course_activity_history WHERE organization_id=? AND course_id IN (${marks})
       ORDER BY changed_at DESC`,
      [orgId, ...ids]
    )
    : [[]];
  const historyActorIds = [...new Set(activityHistory.map(item => String(item.actor_user_id)))];
  const historyActors = historyActorIds.length
    ? await require('../models/User').find({ _id: { $in: historyActorIds } }).select('nombre').lean()
    : [];
  const historyActorNames = new Map(historyActors.map(item => [String(item._id), item.nombre]));
  const parseJson = value => {
    if (value && typeof value === 'object') return value;
    try { return JSON.parse(value || '{}'); } catch { return {}; }
  };
  const progress = new Map();
  for (const course of rows) {
    if (role === 'tutor') {
      const [stats] = await pool.execute(
        `SELECT
          COUNT(DISTINCT CASE WHEN e.status='pendiente' THEN e.id END) AS pending_reviews,
          COUNT(DISTINCT e.id) AS submissions,
          COUNT(DISTINCT CASE WHEN e.status='aprobada' THEN e.id END) AS approved
         FROM academic_course_activities a
         LEFT JOIN academic_course_evidences e ON e.organization_id=a.organization_id AND e.activity_id=a.id
         WHERE a.organization_id=? AND a.course_id=?`,
        [orgId, course.id]
      );
      progress.set(course.id, { pendingReviews: Number(stats[0].pending_reviews), submissions: Number(stats[0].submissions), approved: Number(stats[0].approved) });
    } else {
      const [stats] = await pool.execute(
        `SELECT COUNT(*) AS total,
          SUM(CASE WHEN EXISTS (SELECT 1 FROM academic_course_evidences e WHERE e.organization_id=a.organization_id AND e.activity_id=a.id AND e.student_id=?) THEN 1 ELSE 0 END) AS submitted,
          SUM(CASE WHEN EXISTS (SELECT 1 FROM academic_course_evidences e WHERE e.organization_id=a.organization_id AND e.activity_id=a.id AND e.student_id=? AND e.status='aprobada') THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN EXISTS (SELECT 1 FROM academic_course_evaluations v WHERE v.organization_id=a.organization_id AND v.course_id=a.course_id AND v.activity_id=a.id AND v.student_id=?) THEN 1 ELSE 0 END) AS graded
         FROM academic_course_activities a
         WHERE a.organization_id=? AND a.course_id=? AND a.status='publicada'`,
        [course.student_id, course.student_id, course.student_id, orgId, course.id]
      );
      const total = Number(stats[0].total || 0);
      const approved = Number(stats[0].approved || 0);
      progress.set(course.id, { total, submitted: Number(stats[0].submitted || 0), approved, graded: Number(stats[0].graded || 0), percent: total ? Math.round(approved / total * 100) : 0 });
    }
  }
  return rows.map(course => ({
    id: course.id,
    code: course.course_code,
    name: course.name,
    description: course.description,
    status: course.status,
    counts: { activities: Number(course.activities_count), resources: Number(course.resources_count), students: Number(course.students_count) },
    progress: progress.get(course.id) || {},
    modules: modules.filter(item => item.course_id === course.id).map(item => ({
      id: item.id, number: Number(item.module_number), title: item.title,
      description: item.description, status: item.status
    })),
    activities: activities.filter(item => item.course_id === course.id).map(item => ({
      id: item.id, moduleId: item.module_id, title: item.title, description: item.description, instructions: item.instructions,
      opensAt: item.opens_at, dueAt: item.due_at, status: item.status,
      history: activityHistory.filter(entry => entry.activity_id === item.id).map(entry => {
        const changed = parseJson(entry.changed_fields);
        return {
          fields: Array.isArray(changed.fields) ? changed.fields : [],
          reason: changed.reason || '',
          before: parseJson(entry.before_values),
          after: parseJson(entry.after_values),
          actorName: historyActorNames.get(String(entry.actor_user_id)) || 'Docente',
          changedAt: entry.changed_at
        };
      }),
      resources: activityResources.filter(resource => resource.activity_id === item.id).map(resource => ({
        id: resource.id, title: resource.title, description: resource.description, fileName: resource.original_name,
        sizeBytes: Number(resource.file_size_bytes),
        downloadUrl: `/api/organization/courses/${course.id}/activities/${item.id}/resources/${resource.id}/download`
      }))
    })),
    resources: resources.filter(item => item.course_id === course.id).map(item => ({
      id: item.id, title: item.title, description: item.description, fileName: item.original_name,
      mimeType: item.mime_type, sizeBytes: Number(item.file_size_bytes),
      downloadUrl: `/api/organization/courses/${course.id}/resources/${item.id}/download`
    }))
  }));
}

const listarCursos = asyncHandler(async (req, res) => {
  const courses = await getCoursesForRequest(req);
  res.json({ ok: true, data: { role: req.organizationMembership.role, courses } });
});

const descargarRecurso = asyncHandler(async (req, res, next) => {
  const { courseId, resourceId } = req.params;
  if (!/^[a-f0-9]{24}$/i.test(courseId) || !/^[a-f0-9]{24}$/i.test(resourceId)) {
    throw new ApiError(400, 'Identificador de recurso inválido.', { code: 'INVALID_RESOURCE_ID' });
  }
  await conectarMySQL();
  const pool = obtenerPoolMySQL();
  const orgId = String(req.organization._id);
  const userId = String(req.user._id);
  const role = req.organizationMembership.role;
  const permission = role === 'tutor'
    ? 'EXISTS (SELECT 1 FROM academic_course_teachers t WHERE t.organization_id=c.organization_id AND t.course_id=c.id AND t.teacher_user_id=? AND t.status=\'activo\')'
    : 'EXISTS (SELECT 1 FROM academic_course_students cs JOIN academic_students s ON s.organization_id=cs.organization_id AND s.id=cs.student_id WHERE cs.organization_id=c.organization_id AND cs.course_id=c.id AND cs.status=\'activo\' AND s.user_id=?)';
  const [rows] = await pool.execute(
    `SELECT r.original_name, r.stored_name FROM academic_course_resources r
     JOIN academic_courses c ON c.organization_id=r.organization_id AND c.id=r.course_id
     WHERE r.organization_id=? AND c.id=? AND r.id=? AND ${permission}`,
    [orgId, courseId, resourceId, userId]
  );
  if (!rows.length) throw new ApiError(404, 'No se encontró el recurso o no tienes permiso para descargarlo.', { code: 'RESOURCE_NOT_FOUND' });
  const stored = rows[0].stored_name;
  if (!/^[a-f0-9]{24}\.pdf$/i.test(stored)) throw new ApiError(404, 'La referencia del archivo no es válida.', { code: 'RESOURCE_FILE_INVALID' });
  const fullPath = path.resolve(STORAGE, stored);
  if (!fullPath.startsWith(STORAGE + path.sep) || !fs.existsSync(fullPath)) {
    throw new ApiError(404, 'El archivo no está disponible en el almacenamiento.', { code: 'RESOURCE_FILE_MISSING' });
  }
  res.download(fullPath, rows[0].original_name, error => {
    if (error && !res.headersSent) next(error);
  });
});

const obtenerAsistente = asyncHandler(async (_req, res) => {
  const db = require('mongoose').connection;
  const profile = await db.collection('taskflow_ai_profiles').findOne(
    { key: 'agnes-academica' },
    { projection: { _id: 0, key: 1, name: 1, description: 1, status: 1, connectionStatus: 1, capabilities: 1, updatedAt: 1 } }
  );
  const prompts = await db.collection('taskflow_ai_prompt_templates').find(
    { active: true }, { projection: { _id: 0, key: 1, title: 1, category: 1, prompt: 1 } }
  ).sort({ title: 1 }).toArray();
  res.json({ ok: true, data: {
    profile: profile ? { ...profile, provider: env.ai.geminiApiKey ? 'gemini' : null, model: env.ai.geminiApiKey ? env.ai.geminiModel : null, connectionStatus: env.ai.geminiApiKey ? 'configured' : 'not_connected' } : null,
    prompts
  } });
});

const conversarConAsistente = asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  const result = await consultarGemini({
    message: req.body.message,
    role: req.organizationMembership.role,
    organizationName: req.organization.nombre
  });
  // Se registra solo metadato de uso; no se almacenan preguntas ni respuestas.
  try {
    await require('mongoose').connection.collection('taskflow_ai_usage').insertOne({
      organizationId: String(req.organization._id),
      userId: String(req.user._id),
      role: req.organizationMembership.role,
      provider: 'gemini', model: result.model,
      status: 'success', latencyMs: Date.now() - startedAt, createdAt: new Date()
    });
  } catch (error) {
    // La disponibilidad de la conversación no depende del registro estadístico.
  }
  res.json({ ok: true, data: { answer: result.answer, provider: 'gemini', model: result.model } });
});

module.exports = { listarCursos, descargarRecurso, obtenerAsistente, conversarConAsistente };
