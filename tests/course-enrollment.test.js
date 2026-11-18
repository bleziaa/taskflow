const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');

test('matrícula con MongoDB y SQL reales: roles, aislamiento e historial conservado', { skip: !process.env.TASKFLOW_TEST_MYSQL_PORT }, async t => {
  const fixture = await require('./support/enrollment-fixture.cjs').createFixture();
  const { server, sql, users, org, student, noAccount, foreignStudent, courseId } = fixture;
  const base = `/api/organization/courses/${courseId}/enrollments`;
  const sid = String(student._id), orgId = String(org._id);
  async function mutate(agent, method, url, data) { const token = (await agent.get('/api/auth/csrf-token')).body.data.csrfToken; return agent[method](url).set('X-CSRF-Token', token).send(data); }
  async function login(user) {
    const agent = request.agent(server);
    assert.equal((await mutate(agent, 'post', '/api/auth/login', { email: user.email, password: 'AuditDemo123!' })).status, 200);
    assert.equal((await mutate(agent, 'put', '/api/auth/organizations/active', { organizationId: orgId })).status, 200);
    return agent;
  }
  try {
    const a = await login(users.admin), teacher = await login(users.teacher), other = await login(users.otherTeacher), s = await login(users.student);
    await t.test('permisos, CSRF y pertenencia institucional', async () => {
      assert.equal((await request(server).get(base)).status, 401);
      assert.equal((await s.get(base)).status, 403);
      assert.equal((await other.get(base)).status, 403);
      assert.equal((await mutate(teacher, 'post', base, { studentId: sid })).status, 403);
      assert.equal((await a.post(base).send({ studentId: sid })).status, 403);
      assert.equal((await mutate(a, 'post', base, { studentId: String(foreignStudent._id) })).status, 404);
      assert.equal((await mutate(a, 'post', base, { studentId: String(noAccount._id) })).status, 409);
      assert.equal((await mutate(a, 'post', base, { studentId: 'invalid' })).status, 400);
      assert.equal((await mutate(a, 'patch', base + '/' + sid, { status: 'retirado' })).status, 404);
    });
    await t.test('alta idempotente sincroniza ficha y permite acceso al estudiante y lista al docente', async () => {
      assert.equal((await s.get('/api/organization/courses')).body.data.courses.length, 0);
      const concurrent = await Promise.all([mutate(a, 'post', base, { studentId: sid }), mutate(a, 'post', base, { studentId: sid })]);
      assert.deepEqual(concurrent.map(r => r.status), [200, 200]);
      assert.equal(concurrent.filter(r => r.body.data.changed).length, 1);
      assert.equal((await mutate(a, 'post', base, { studentId: sid })).body.data.changed, false);
      assert.equal((await s.get('/api/organization/courses')).body.data.courses.length, 1);
      const roster = (await teacher.get(base)).body.data;
      assert.equal(roster.enrollments[0].name, student.nombre); assert.deepEqual(roster.candidates, []); assert.deepEqual(roster.history, []);
      const data = (await a.get(base)).body.data;
      assert.equal(data.history.length, 1); assert.equal(data.history[0].actorName, users.admin.nombre);
      assert.equal(data.candidates.find(c => c.id === String(noAccount._id)).eligible, false);
    });
    const activityId = String(new mongoose.Types.ObjectId()), evidenceId = String(new mongoose.Types.ObjectId()), gradeId = String(new mongoose.Types.ObjectId());
    const [modules] = await sql.execute('SELECT id FROM academic_course_modules WHERE course_id=? ORDER BY module_number', [courseId]);
    await sql.execute("INSERT INTO academic_course_activities (id, organization_id, course_id, module_id, title, status, created_by_user_id) VALUES (?, ?, ?, ?, 'Entrega previa', 'publicada', ?)", [activityId, orgId, courseId, modules[0].id, String(users.teacher._id)]);
    await sql.execute("INSERT INTO academic_course_evidences (id, organization_id, activity_id, student_id, original_name, stored_name, mime_type, file_size_bytes) VALUES (?, ?, ?, ?, 'prueba.pdf', ?, 'application/pdf', 100)", [evidenceId, orgId, activityId, sid, evidenceId + '.pdf']);
    await sql.execute("INSERT INTO academic_course_evaluations (id, organization_id, course_id, student_id, activity_id, teacher_user_id, title, score) VALUES (?, ?, ?, ?, ?, ?, 'Nota previa', 4.5)", [gradeId, orgId, courseId, sid, activityId, String(users.teacher._id)]);
    await t.test('retiro revoca acceso y reactivación recupera la misma entrega y nota', async () => {
      assert.equal((await mutate(a, 'patch', base + '/' + sid, { status: 'retirado' })).status, 200);
      assert.equal((await s.get('/api/organization/courses')).body.data.courses.length, 0);
      assert.equal((await s.get(`/api/organization/courses/${courseId}/activities/${activityId}/evidences`)).status, 403);
      assert.equal((await mutate(a, 'patch', base + '/' + sid, { status: 'activo' })).status, 200);
      assert.equal((await s.get('/api/organization/courses')).body.data.courses.length, 1);
      const [evidence] = await sql.execute('SELECT id FROM academic_course_evidences WHERE id=?', [evidenceId]); assert.equal(evidence[0].id, evidenceId);
      const [grade] = await sql.execute('SELECT score FROM academic_course_evaluations WHERE id=?', [gradeId]); assert.equal(Number(grade[0].score), 4.5);
      const [enrolled] = await sql.execute('SELECT id FROM academic_course_students WHERE student_id=?', [sid]); assert.equal(enrolled.length, 1);
      const data = (await a.get(base)).body.data; assert.equal(data.history.length, 3);
    });
    await t.test('curso inactivo conserva lista administrativa pero bloquea cambios y al docente', async () => {
      await sql.execute("UPDATE academic_courses SET status='inactivo' WHERE id=?", [courseId]);
      assert.equal((await a.get(base)).status, 200);
      assert.equal((await teacher.get(base)).status, 404);
      assert.equal((await mutate(a, 'post', base, { studentId: sid })).status, 404);
      await sql.execute("UPDATE academic_courses SET status='activo' WHERE id=?", [courseId]);
    });
    await t.test('cuentas inactivas y reasignación de identidad no heredan historial', async () => {
      await require('../src/models/User').updateOne({ _id: users.student._id }, { activo: false });
      assert.equal((await mutate(a, 'post', base, { studentId: sid })).status, 409);
      await require('../src/models/User').updateOne({ _id: users.student._id }, { activo: true });
      await sql.execute('UPDATE academic_students SET user_id=? WHERE id=?', [String(users.otherTeacher._id), sid]);
      assert.equal((await mutate(a, 'post', base, { studentId: sid })).status, 409);
    });
  } finally { await fixture.close(); }
});
