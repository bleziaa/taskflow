const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Membership = require('../models/OrganizationMembership');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { conectarMySQL, obtenerPoolMySQL } = require('../config/mysql');

const id = () => crypto.randomBytes(12).toString('hex');
const validId = value => /^[a-f0-9]{24}$/i.test(String(value || ''));

async function poolForRequest() {
  await conectarMySQL();
  return obtenerPoolMySQL();
}

async function courseForRequest(req, courseId, roles = ['administrador', 'tutor', 'estudiante']) {
  if (!validId(courseId)) throw new ApiError(400, 'Identificador de curso inválido.', { code: 'INVALID_COURSE_ID' });
  const pool = await poolForRequest();
  const orgId = String(req.organization._id);
  const userId = String(req.user._id);
  const role = req.organizationMembership.role;
  if (!roles.includes(role)) throw new ApiError(403, 'No tienes permiso para acceder a este curso.', { code: 'COURSE_FORBIDDEN' });
  const [courses] = await pool.execute(
    'SELECT id, course_code, name, description, status FROM academic_courses WHERE organization_id=? AND id=? LIMIT 1',
    [orgId, courseId]
  );
  if (!courses.length || courses[0].status !== 'activo') throw new ApiError(404, 'No se encontró el curso activo.', { code: 'COURSE_NOT_FOUND' });
  if (role === 'tutor') {
    const [assigned] = await pool.execute(
      "SELECT id FROM academic_course_teachers WHERE organization_id=? AND course_id=? AND teacher_user_id=? AND status='activo' LIMIT 1",
      [orgId, courseId, userId]
    );
    if (!assigned.length) throw new ApiError(403, 'Este curso no está asignado a tu perfil docente.', { code: 'COURSE_NOT_ASSIGNED' });
  } else if (role === 'estudiante') {
    const [enrolled] = await pool.execute(
      "SELECT id FROM academic_course_students WHERE organization_id=? AND course_id=? AND student_id IN (SELECT id FROM academic_students WHERE organization_id=? AND user_id=?) AND status='activo' LIMIT 1",
      [orgId, courseId, orgId, userId]
    );
    if (!enrolled.length) throw new ApiError(403, 'No estás matriculado en este curso.', { code: 'COURSE_NOT_ENROLLED' });
  }
  return { pool, course: courses[0], orgId, userId, role };
}

async function validateTeachers(organizationId, teacherIds) {
  const ids = [...new Set((teacherIds || []).map(String))];
  if (!ids.length) return [];
  if (ids.some(value => !mongoose.isValidObjectId(value))) throw new ApiError(400, 'Uno de los docentes seleccionados no es válido.', { code: 'INVALID_TEACHER_ID' });
  const found = await Membership.find({
    organizacion: organizationId, usuario: { $in: ids }, role: 'tutor', estado: 'activo'
  }).select('usuario').lean();
  const valid = new Set(found.map(item => String(item.usuario)));
  if (ids.some(value => !valid.has(value))) throw new ApiError(400, 'Todos los docentes deben tener una membresía activa de docente en esta institución.', { code: 'TEACHER_MEMBERSHIP_REQUIRED' });
  return ids;
}

const listarCursosAdministracion = asyncHandler(async (req, res) => {
  const pool = await poolForRequest();
  const orgId = String(req.organization._id);
  const [courses] = await pool.execute(
    "SELECT id, course_code, name, description, status, created_at FROM academic_courses WHERE organization_id=? ORDER BY name",
    [orgId]
  );
  if (!courses.length) return res.json({ ok: true, data: { courses: [] } });
  const ids = courses.map(item => item.id);
  const marks = ids.map(() => '?').join(',');
  const [modules] = await pool.execute(
    'SELECT id, course_id, module_number, title, description, status FROM academic_course_modules WHERE organization_id=? AND course_id IN (' + marks + ') ORDER BY course_id, module_number',
    [orgId, ...ids]
  );
  const [teachers] = await pool.execute(
    "SELECT course_id, teacher_user_id, status FROM academic_course_teachers WHERE organization_id=? AND course_id IN (" + marks + ") ORDER BY assigned_at",
    [orgId, ...ids]
  );
  const teacherIds = [...new Set(teachers.map(item => item.teacher_user_id))];
  const users = teacherIds.length ? await require('../models/User').find({ _id: { $in: teacherIds } }).select('nombre email').lean() : [];
  const userMap = new Map(users.map(item => [String(item._id), item]));
  res.json({ ok: true, data: { courses: courses.map(course => ({
    id: course.id, code: course.course_code, name: course.name, description: course.description,
    status: course.status, modules: modules.filter(item => item.course_id === course.id),
    teachers: teachers.filter(item => item.course_id === course.id).map(item => ({
      userId: item.teacher_user_id, status: item.status, user: userMap.get(item.teacher_user_id) || null
    }))
  })) } });
});

const crearCurso = asyncHandler(async (req, res) => {
  const pool = await poolForRequest();
  const orgId = String(req.organization._id);
  const userId = String(req.user._id);
  const code = String(req.body.code || '').trim().toUpperCase();
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const moduleCount = Number(req.body.moduleCount);
  if (!/^[A-Z0-9_-]{2,40}$/.test(code) || name.length < 2 || name.length > 140) {
    throw new ApiError(400, 'Completa un código válido y un nombre de curso de al menos 2 caracteres.', { code: 'INVALID_COURSE_DATA' });
  }
  if (!Number.isInteger(moduleCount) || moduleCount < 1 || moduleCount > 50) {
    throw new ApiError(400, 'Cada curso debe tener entre 1 y 50 módulos.', { code: 'INVALID_MODULE_COUNT' });
  }
  const teacherIds = await validateTeachers(req.organization._id, req.body.teacherUserIds || []);
  const connection = await pool.getConnection();
  const courseId = id();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'INSERT INTO academic_courses (id, organization_id, course_code, name, description, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [courseId, orgId, code, name, description, userId]
    );
    for (let number = 1; number <= moduleCount; number += 1) {
      await connection.execute(
        'INSERT INTO academic_course_modules (id, organization_id, course_id, module_number, title, description, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id(), orgId, courseId, number, 'Unidad ' + number, '', userId]
      );
    }
    for (const teacherId of teacherIds) {
      await connection.execute(
        'INSERT INTO academic_course_teachers (id, organization_id, course_id, teacher_user_id, assigned_by_user_id) VALUES (?, ?, ?, ?, ?)',
        [id(), orgId, courseId, teacherId, userId]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'Ya existe un curso con ese código en esta institución.', { code: 'COURSE_CODE_EXISTS' });
    throw error;
  } finally { connection.release(); }
  res.status(201).json({ ok: true, data: { course: { id: courseId, code, name, description, moduleCount, teacherUserIds: teacherIds } } });
});

const actualizarCurso = asyncHandler(async (req, res) => {
  const pool = await poolForRequest();
  const orgId = String(req.organization._id);
  const courseId = String(req.params.courseId);
  if (!validId(courseId)) throw new ApiError(400, 'Identificador de curso inválido.', { code: 'INVALID_COURSE_ID' });
  const fields = [];
  const values = [];
  if (req.body.code !== undefined) {
    const code = String(req.body.code).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) throw new ApiError(400, 'El código del curso no es válido.', { code: 'INVALID_COURSE_CODE' });
    fields.push('course_code=?'); values.push(code);
  }
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name.length < 2 || name.length > 140) throw new ApiError(400, 'El nombre del curso debe tener entre 2 y 140 caracteres.', { code: 'INVALID_COURSE_NAME' });
    fields.push('name=?'); values.push(name);
  }
  if (req.body.description !== undefined) {
    const description = String(req.body.description).trim();
    if (description.length > 4000) throw new ApiError(400, 'La descripción es demasiado larga.', { code: 'INVALID_COURSE_DESCRIPTION' });
    fields.push('description=?'); values.push(description);
  }
  if (req.body.status !== undefined) {
    if (!['activo', 'inactivo', 'archivado'].includes(req.body.status)) throw new ApiError(400, 'Estado de curso inválido.', { code: 'INVALID_COURSE_STATUS' });
    fields.push('status=?'); values.push(req.body.status);
  }
  if (!fields.length) throw new ApiError(400, 'No hay cambios para guardar.', { code: 'EMPTY_UPDATE' });
  values.push(orgId, courseId);
  const [result] = await pool.execute('UPDATE academic_courses SET ' + fields.join(', ') + ' WHERE organization_id=? AND id=?', values);
  if (!result.affectedRows) throw new ApiError(404, 'No se encontró el curso.', { code: 'COURSE_NOT_FOUND' });
  res.json({ ok: true, data: { updated: true } });
});

const asignarDocente = asyncHandler(async (req, res) => {
  const { pool, orgId, userId } = await courseForRequest(req, req.params.courseId, ['administrador']);
  const teacherIds = await validateTeachers(req.organization._id, [req.body.teacherUserId]);
  try {
    await pool.execute(
      'INSERT INTO academic_course_teachers (id, organization_id, course_id, teacher_user_id, assigned_by_user_id) VALUES (?, ?, ?, ?, ?)',
      [id(), orgId, req.params.courseId, teacherIds[0], userId]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'Este docente ya está asignado al curso.', { code: 'TEACHER_ALREADY_ASSIGNED' });
    throw error;
  }
  res.status(201).json({ ok: true, data: { assigned: true } });
});

const guardarModulos = asyncHandler(async (req, res) => {
  const { pool, orgId, userId, role } = await courseForRequest(req, req.params.courseId, ['administrador', 'tutor']);
  const modules = req.body.modules;
  if (!Array.isArray(modules) || modules.length < 1 || modules.length > 50) {
    throw new ApiError(400, 'El curso debe conservar entre 1 y 50 módulos.', { code: 'INVALID_MODULES' });
  }
  const normalized = modules.map((item, index) => ({
    id: item.id && validId(item.id) ? String(item.id) : id(),
    number: index + 1,
    title: String(item.title || '').trim(),
    description: String(item.description || '').trim()
  }));
  if (normalized.some(item => item.title.length < 2 || item.title.length > 160 || item.description.length > 2000)) {
    throw new ApiError(400, 'Cada módulo necesita un título de 2 a 160 caracteres y una descripción de hasta 2000.', { code: 'INVALID_MODULE_DATA' });
  }
  if (new Set(normalized.map(item => item.title.toLocaleLowerCase('es'))).size !== normalized.length) {
    throw new ApiError(400, 'Los nombres de los módulos no pueden repetirse.', { code: 'DUPLICATE_MODULE_TITLE' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [current] = await connection.execute(
      'SELECT id FROM academic_course_modules WHERE organization_id=? AND course_id=?',
      [orgId, req.params.courseId]
    );
    const currentIds = new Set(current.map(item => item.id));
    if (role === 'tutor' && (normalized.length !== current.length || normalized.some(item => !item.id || !currentIds.has(item.id)))) {
      throw new ApiError(403, 'El docente puede editar los nombres y descripciones, pero la cantidad de unidades la administra la institución.', { code: 'TUTOR_CANNOT_CHANGE_UNIT_COUNT' });
    }
    if (normalized.some(item => item.id && !currentIds.has(item.id) && modules.some(source => source.id === item.id))) {
      throw new ApiError(400, 'Uno de los módulos no pertenece a este curso.', { code: 'MODULE_NOT_IN_COURSE' });
    }
    const keep = new Set(normalized.map(item => item.id));
    for (const existing of current) {
      if (!keep.has(existing.id)) {
        const [used] = await connection.execute(
          'SELECT id FROM academic_course_activities WHERE organization_id=? AND course_id=? AND module_id=? LIMIT 1',
          [orgId, req.params.courseId, existing.id]
        );
        if (used.length) throw new ApiError(409, 'No puedes quitar un módulo que ya contiene actividades. Cambia primero esas actividades de módulo.', { code: 'MODULE_HAS_ACTIVITIES' });
        await connection.execute('DELETE FROM academic_course_modules WHERE organization_id=? AND course_id=? AND id=?', [orgId, req.params.courseId, existing.id]);
      }
    }
    // Evita colisiones de la clave única al reordenar módulos existentes.
    await connection.execute(
      'UPDATE academic_course_modules SET module_number = module_number + 100 WHERE organization_id=? AND course_id=?',
      [orgId, req.params.courseId]
    );
    for (const item of normalized) {
      if (currentIds.has(item.id)) {
        await connection.execute(
          'UPDATE academic_course_modules SET module_number=?, title=?, description=?, status=\'activo\' WHERE organization_id=? AND course_id=? AND id=?',
          [item.number, item.title, item.description, orgId, req.params.courseId, item.id]
        );
      } else {
        await connection.execute(
          'INSERT INTO academic_course_modules (id, organization_id, course_id, module_number, title, description, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [item.id, orgId, req.params.courseId, item.number, item.title, item.description, userId]
        );
      }
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
  res.json({ ok: true, data: { modules: normalized } });
});

const crearActividadCurso = asyncHandler(async (req, res) => {
  const { pool, orgId, userId } = await courseForRequest(req, req.params.courseId, ['administrador', 'tutor']);
  const moduleId = String(req.body.moduleId || '');
  if (!validId(moduleId)) throw new ApiError(400, 'Selecciona un módulo válido del curso.', { code: 'MODULE_REQUIRED' });
  const [modules] = await pool.execute(
    "SELECT id FROM academic_course_modules WHERE organization_id=? AND course_id=? AND id=? AND status='activo'",
    [orgId, req.params.courseId, moduleId]
  );
  if (!modules.length) throw new ApiError(400, 'El módulo seleccionado no pertenece a este curso o está inactivo.', { code: 'MODULE_NOT_IN_COURSE' });
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const instructions = String(req.body.instructions || '').trim();
  if (title.length < 3 || title.length > 160) throw new ApiError(400, 'El título debe tener entre 3 y 160 caracteres.', { code: 'INVALID_ACTIVITY_TITLE' });
  const opensAt = req.body.opensAt ? new Date(req.body.opensAt) : null;
  const dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
  if ((opensAt && Number.isNaN(opensAt.getTime())) || (dueAt && Number.isNaN(dueAt.getTime())) || (opensAt && dueAt && dueAt < opensAt)) {
    throw new ApiError(400, 'Revisa las fechas de apertura y entrega.', { code: 'INVALID_ACTIVITY_DATES' });
  }
  const activityId = id();
  await pool.execute(
    'INSERT INTO academic_course_activities (id, organization_id, course_id, module_id, title, description, instructions, opens_at, due_at, status, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [activityId, orgId, req.params.courseId, moduleId, title, description, instructions, opensAt, dueAt, req.body.status === 'publicada' ? 'publicada' : 'borrador', userId]
  );
  res.status(201).json({ ok: true, data: { activity: { id: activityId, moduleId, title, description, instructions, opensAt, dueAt, status: req.body.status === 'publicada' ? 'publicada' : 'borrador' } } });
});

const actualizarActividadCurso = asyncHandler(async (req, res) => {
  const { pool, orgId } = await courseForRequest(req, req.params.courseId, ['administrador', 'tutor']);
  if (!validId(req.params.activityId)) throw new ApiError(400, 'Identificador de actividad inválido.', { code: 'INVALID_ACTIVITY_ID' });
  const allowed = { title: 'title', description: 'description', instructions: 'instructions', status: 'status', dueAt: 'due_at', opensAt: 'opens_at', moduleId: 'module_id' };
  const sets = []; const values = [];
  for (const [field, column] of Object.entries(allowed)) {
    if (req.body[field] === undefined) continue;
    let value = req.body[field];
    if (field === 'moduleId') {
      if (!validId(value)) throw new ApiError(400, 'Módulo inválido.', { code: 'MODULE_REQUIRED' });
      const [moduleRows] = await pool.execute('SELECT id FROM academic_course_modules WHERE organization_id=? AND course_id=? AND id=? AND status=\'activo\'', [orgId, req.params.courseId, value]);
      if (!moduleRows.length) throw new ApiError(400, 'El módulo no pertenece a este curso.', { code: 'MODULE_NOT_IN_COURSE' });
    }
    if (field === 'status' && !['borrador', 'publicada', 'cerrada', 'archivada'].includes(value)) throw new ApiError(400, 'Estado de actividad inválido.', { code: 'INVALID_ACTIVITY_STATUS' });
    if (field === 'opensAt' || field === 'dueAt') value = value ? new Date(value) : null;
    sets.push(column + '=?'); values.push(value);
  }
  if (!sets.length) throw new ApiError(400, 'No hay cambios para guardar.', { code: 'EMPTY_UPDATE' });
  values.push(orgId, req.params.courseId, req.params.activityId);
  const [result] = await pool.execute('UPDATE academic_course_activities SET ' + sets.join(', ') + ' WHERE organization_id=? AND course_id=? AND id=?', values);
  if (!result.affectedRows) throw new ApiError(404, 'No se encontró la actividad.', { code: 'COURSE_ACTIVITY_NOT_FOUND' });
  res.json({ ok: true, data: { updated: true } });
});

const eliminarActividadCurso = asyncHandler(async (req, res) => {
  const { pool, orgId } = await courseForRequest(req, req.params.courseId, ['administrador', 'tutor']);
  const [result] = await pool.execute(
    'DELETE FROM academic_course_activities WHERE organization_id=? AND course_id=? AND id=?',
    [orgId, req.params.courseId, req.params.activityId]
  );
  if (!result.affectedRows) throw new ApiError(404, 'No se encontró la actividad.', { code: 'COURSE_ACTIVITY_NOT_FOUND' });
  res.json({ ok: true, data: { deleted: true } });
});

module.exports = {
  listarCursosAdministracion, crearCurso, actualizarCurso, asignarDocente, guardarModulos,
  crearActividadCurso, actualizarActividadCurso, eliminarActividadCurso
};
