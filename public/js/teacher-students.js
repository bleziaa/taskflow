(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const state = { rows: [], filtered: [], previousFocus: null };
  const statusLabels = { en_curso: 'En curso', planificada: 'Planificada', finalizada: 'Finalizada', suspendida: 'Suspendida' };
  const activityLabels = { pendiente: 'Pendiente', en_revision: 'En revisión', completada: 'Completada' };
  const notice = $('#teacher-notice');

  function message(text, type = 'info') {
    notice.textContent = text;
    notice.className = 'teacher-notice' + (type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : '');
    notice.hidden = !text;
  }
  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', ...(options.headers || {}) }, ...options });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) location.replace('/login.html');
      throw new Error(result?.error?.message || 'No se pudo consultar la información.');
    }
    return result.data || {};
  }
  function node(tag, text, className) {
    const item = document.createElement(tag);
    if (text !== undefined && text !== null) item.textContent = String(text);
    if (className) item.className = className;
    return item;
  }
  function date(value) {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
  }
  function statusChip(value) {
    return node('span', statusLabels[value] || 'Sin estado', 'teacher-status status-' + (value || 'unknown'));
  }
  function progress(value) {
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    const wrap = node('div', null, 'teacher-progress');
    const track = node('span'); track.style.width = safe + '%';
    wrap.append(track);
    const label = node('small', safe + '%');
    const group = node('div', null, 'teacher-progress-group'); group.append(wrap, label);
    return group;
  }
  function getStudentName(row) { return row.estudiante?.nombre || 'Estudiante sin nombre'; }
  function buildRows(reports) {
    const priority = { en_curso: 4, planificada: 3, finalizada: 2, suspendida: 1 };
    const selected = new Map();
    reports.forEach((report) => {
      if (!report.estudiante?._id) return;
      const id = String(report.estudiante._id);
      const current = selected.get(id);
      const nextRank = priority[report.practica?.estado] || 0;
      const currentRank = priority[current?.practica?.estado] || 0;
      const nextDate = new Date(report.practica?.fechaInicio || 0).getTime();
      const currentDate = new Date(current?.practica?.fechaInicio || 0).getTime();
      if (!current || nextRank > currentRank || (nextRank === currentRank && nextDate > currentDate)) {
        selected.set(id, {
          id,
          estudiante: report.estudiante,
          empresa: report.empresa,
          tutor: report.tutor,
          practica: report.practica,
          resumen: report.resumen || {},
          actividades: report.actividades || [],
          evaluacion: report.evaluacion || null,
        });
      }
    });
    return [...selected.values()].sort((a, b) => getStudentName(a).localeCompare(getStudentName(b), 'es'));
  }
  function renderSummary() {
    const rows = state.rows;
    const active = rows.filter((r) => r.practica?.estado === 'en_curso').length;
    const pending = rows.reduce((sum, r) => sum + (r.resumen.pendientes || 0), 0);
    $('#summary-students').textContent = rows.length;
    $('#summary-active').textContent = active;
    $('#summary-pending').textContent = pending;
  }
  function studentAction(row) {
    const button = node('button', 'Ver seguimiento →', 'teacher-view-button');
    button.type = 'button'; button.dataset.studentId = row.id;
    return button;
  }
  function renderTable(rows) {
    const tbody = $('#student-rows'); tbody.replaceChildren();
    if (!rows.length) {
      const tr = node('tr'); const td = node('td', 'No hay estudiantes para mostrar.', 'teacher-empty'); td.colSpan = 6; tr.append(td); tbody.append(tr); return;
    }
    rows.forEach((row) => {
      const tr = node('tr');
      const identity = node('td'); const name = node('strong', getStudentName(row)); const sub = node('small', [row.estudiante.codigo, row.estudiante.programa].filter(Boolean).join(' · ') || row.estudiante.email || ''); identity.append(name, sub);
      const company = node('td', row.empresa?.razonSocial || 'Por confirmar');
      const practice = node('td'); practice.append(node('strong', row.practica?.titulo || 'Práctica'), node('small', date(row.practica?.fechaInicio) + ' — ' + date(row.practica?.fechaFin)));
      const status = node('td'); status.append(statusChip(row.practica?.estado));
      const progressCell = node('td'); progressCell.append(progress(row.resumen.progreso));
      const action = node('td'); action.append(studentAction(row));
      tr.append(identity, company, practice, status, progressCell, action); tbody.append(tr);
    });
  }
  function renderCards(rows) {
    const root = $('#student-cards'); root.replaceChildren();
    rows.forEach((row) => {
      const card = node('article', null, 'teacher-student-card');
      const top = node('div', null, 'student-card-top'); const identity = node('div'); identity.append(node('strong', getStudentName(row)), node('small', row.estudiante.codigo || row.estudiante.email || ''));
      top.append(identity, statusChip(row.practica?.estado));
      const company = node('p', row.empresa?.razonSocial || 'Empresa por confirmar');
      const stats = node('div', null, 'student-card-stats'); stats.append(progress(row.resumen.progreso), node('b', (row.resumen.pendientes || 0) + ' pendientes'));
      card.append(top, company, stats, studentAction(row)); root.append(card);
    });
  }
  function applyFilters() {
    const query = $('#student-search').value.trim().toLocaleLowerCase('es');
    const status = $('#status-filter').value;
    state.filtered = state.rows.filter((row) => {
      const haystack = [getStudentName(row), row.estudiante.codigo, row.estudiante.email, row.estudiante.programa, row.empresa?.razonSocial, row.practica?.titulo].filter(Boolean).join(' ').toLocaleLowerCase('es');
      return (!query || haystack.includes(query)) && (!status || row.practica?.estado === status);
    });
    $('#visible-count').textContent = state.filtered.length + (state.filtered.length === 1 ? ' estudiante' : ' estudiantes');
    $('#empty-filter').hidden = state.filtered.length > 0 || state.rows.length === 0;
    renderTable(state.filtered); renderCards(state.filtered);
  }
  function detailFact(label, value) {
    const item = node('div'); item.append(node('span', label), node('b', value || '—')); return item;
  }
  function openDetail(row, trigger) {
    state.previousFocus = trigger || document.activeElement;
    $('#detail-name').textContent = getStudentName(row);
    $('#detail-code').textContent = [row.estudiante.codigo, row.estudiante.programa, row.estudiante.semestre ? 'Semestre ' + row.estudiante.semestre : ''].filter(Boolean).join(' · ');
    const percent = Number(row.resumen.progreso) || 0;
    $('#detail-progress-value').textContent = percent + '%';
    $('#detail-progress-fill').style.width = percent + '%';
    const facts = $('#detail-facts'); facts.replaceChildren(
      detailFact('Correo', row.estudiante.email), detailFact('Empresa', row.empresa?.razonSocial),
      detailFact('Práctica', row.practica?.titulo), detailFact('Estado', statusLabels[row.practica?.estado] || '—'),
      detailFact('Inicio', date(row.practica?.fechaInicio)), detailFact('Finalización', date(row.practica?.fechaFin)),
      detailFact('Actividades completadas', (row.resumen.completadas || 0) + ' de ' + (row.resumen.totalActividades || 0)),
      detailFact('Pendientes', row.resumen.pendientes || 0)
    );
    const activities = $('#detail-activities'); activities.replaceChildren();
    if (!row.actividades.length) activities.append(node('p', 'Este estudiante aún no tiene actividades registradas.', 'detail-empty'));
    row.actividades.forEach((activity) => {
      const item = node('div', null, 'detail-activity'); const info = node('div'); info.append(node('b', activity.titulo || 'Actividad'), node('small', 'Fecha límite: ' + date(activity.fechaLimite)));
      item.append(info, node('span', activityLabels[activity.estado] || activity.estado || 'Sin estado', 'detail-activity-status')); activities.append(item);
    });
    const evaluationRoot = $('#detail-evaluation');
    evaluationRoot.replaceChildren();
    if (!row.evaluacion) {
      evaluationRoot.append(node('span', 'Aún no hay una evaluación registrada.'));
    } else {
      const evaluation = row.evaluacion;
      const score = Number(evaluation.calificacion);
      evaluationRoot.append(
        node('strong', Number.isFinite(score) ? score.toFixed(2) + ' / 5' : 'Calificación no disponible'),
        node('span', 'Concepto: ' + (evaluation.concepto || 'Sin concepto')),
        node('span', 'Evaluada: ' + date(evaluation.evaluadoEn))
      );
      if (evaluation.fortalezas) evaluationRoot.append(node('p', 'Fortalezas: ' + evaluation.fortalezas));
      if (evaluation.aspectosMejora) evaluationRoot.append(node('p', 'Aspectos por mejorar: ' + evaluation.aspectosMejora));
      if (evaluation.observaciones) evaluationRoot.append(node('p', 'Observaciones: ' + evaluation.observaciones));
    }
    $('#student-detail').classList.add('is-open'); $('#student-detail').setAttribute('aria-hidden', 'false'); document.body.classList.add('detail-open');
    $('.detail-close').focus();
  }
  function closeDetail() {
    $('#student-detail').classList.remove('is-open'); $('#student-detail').setAttribute('aria-hidden', 'true'); document.body.classList.remove('detail-open');
    if (state.previousFocus?.focus) state.previousFocus.focus();
  }
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-student-id]');
    if (button) { const row = state.rows.find((item) => item.id === button.dataset.studentId); if (row) openDetail(row, button); }
    if (event.target.closest('[data-close-detail]')) closeDetail();
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && $('#student-detail').classList.contains('is-open')) closeDetail(); });
  $('#student-search').addEventListener('input', applyFilters);
  $('#status-filter').addEventListener('change', applyFilters);
  $('#btn-logout').addEventListener('click', async () => {
    const button = $('#btn-logout'); button.disabled = true;
    try { const token = (await api('/api/auth/csrf-token')).csrfToken; await api('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: '{}' }); location.replace('/login.html'); }
    catch (error) { button.disabled = false; message(error.message, 'error'); }
  });
  async function init() {
    try {
      const session = await api('/api/auth/me'); $('#teacher-name').textContent = session.usuario?.nombre || 'Docente';
      const orgData = await api('/api/auth/organizations');
      if (!orgData.organizacionActiva) { message('Selecciona un espacio de trabajo para consultar tus estudiantes.'); return; }
      if (orgData.organizacionActiva.role !== 'tutor') { message('Esta sección está disponible para cuentas con rol docente/tutor en el espacio activo.', 'error'); return; }
      const data = await api('/api/organization/reports');
      state.rows = buildRows(data.reportes || []);
      renderSummary(); applyFilters();
      message(state.rows.length ? 'Seguimiento actualizado con tus prácticas asignadas.' : 'Aún no tienes estudiantes vinculados a prácticas en este espacio de trabajo.', 'success');
    } catch (error) { message(error.message || 'No fue posible cargar tus estudiantes.', 'error'); }
  }
  init();
})();
