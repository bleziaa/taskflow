(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const message = $('#student-message');
  const state = { practices: [], activities: [], evaluations: [], report: null };

  function setMessage(text, type = 'info') {
    message.textContent = text;
    message.className = 'student-message' + (type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : '');
    message.hidden = !text;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || 'No se pudo cargar la información.');
      error.status = response.status;
      error.code = body?.error?.code;
      throw error;
    }
    return body.data || {};
  }

  function date(value) {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
  }

  function setText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value == null || value === '' ? '—' : String(value);
  }

  function createActivityRow(activity) {
    const row = document.createElement('article');
    row.className = 'deadline-item';
    const dateBox = document.createElement('div');
    dateBox.className = 'deadline-date';
    const due = activity.fechaLimite ? new Date(activity.fechaLimite) : null;
    const day = document.createElement('strong');
    day.textContent = due && !Number.isNaN(due.getTime()) ? String(due.getDate()).padStart(2, '0') : '—';
    const month = document.createElement('span');
    month.textContent = due && !Number.isNaN(due.getTime()) ? new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(due).replace('.', '') : 'Fecha';
    dateBox.append(day, month);
    const info = document.createElement('div');
    info.className = 'deadline-info';
    const title = document.createElement('b');
    title.textContent = activity.titulo || 'Actividad sin título';
    const description = document.createElement('span');
    description.textContent = activity.practica?.titulo || 'Actividad de mi práctica';
    info.append(title, description);
    const chip = document.createElement('span');
    chip.className = 'activity-chip ' + (activity.estado === 'completada' ? 'is-done' : activity.estado === 'en_revision' ? 'is-review' : 'is-pending');
    chip.textContent = activity.estado === 'completada' ? 'Completada' : activity.estado === 'en_revision' ? 'En revisión' : 'Pendiente';
    row.append(dateBox, info, chip);
    return row;
  }

  function render() {
    const report = state.report || {};
    const summary = report.resumen || {};
    const practices = state.practices;
    const activities = state.activities;
    const practice = practices[0] || null;
    const completed = activities.filter((item) => item.estado === 'completada').length;
    const review = activities.filter((item) => item.estado === 'en_revision').length;
    const pending = activities.length - completed - review;
    const percent = activities.length ? Math.round((completed / activities.length) * 100) : 0;
    const evaluation = state.evaluations[0] || null;

    setText('#kpi-practice', practice ? (practice.estado === 'en_curso' ? 'En curso' : practice.estado === 'planificada' ? 'Planificada' : practice.estado === 'finalizada' ? 'Finalizada' : 'Suspendida') : 'Sin asignar');
    setText('#kpi-practice-note', practice ? (practice.empresa?.razonSocial || 'Tu experiencia académica') : 'Aún no tienes una práctica');
    setText('#kpi-completed', completed);
    setText('#kpi-activities-note', 'De ' + activities.length + ' actividades');
    setText('#kpi-pending', pending);
    setText('#kpi-grade', evaluation && Number.isFinite(Number(evaluation.calificacion)) ? Number(evaluation.calificacion).toFixed(1) + '/5' : '—');
    setText('#kpi-grade-note', evaluation ? (evaluation.concepto || 'Evaluación registrada') : 'Aún no tienes evaluación');

    setText('#progress-percent', percent + '%');
    setText('#legend-done', completed);
    setText('#legend-review', review);
    setText('#legend-pending', pending);
    const fill = $('#progress-fill');
    if (fill) fill.style.width = percent + '%';
    const bar = $('#progress-bar');
    if (bar) bar.setAttribute('aria-valuenow', String(percent));
    setText('#progress-insight', activities.length ? (percent === 100 ? '¡Excelente! Has completado todas las actividades registradas.' : 'Has completado ' + completed + ' de ' + activities.length + ' actividades. ¡Sigue avanzando!') : 'Cuando se registren tus actividades, aquí verás cómo avanza tu práctica.');

    if (practice) {
      setText('#practice-name', practice.titulo);
      setText('#practice-company', practice.empresa?.razonSocial || 'Empresa por confirmar');
      setText('#practice-tutor', practice.tutor?.nombre || 'Docente por asignar');
      setText('#practice-period', date(practice.fechaInicio) + ' — ' + date(practice.fechaFin));
      setText('#practice-status', practice.estado === 'en_curso' ? 'En curso' : practice.estado === 'planificada' ? 'Planificada' : practice.estado === 'finalizada' ? 'Finalizada' : 'Suspendida');
    }

    const list = $('#upcoming-activities');
    list.replaceChildren();
    const upcoming = activities
      .filter((item) => item.estado !== 'completada')
      .sort((a, b) => new Date(a.fechaLimite || 8640000000000000) - new Date(b.fechaLimite || 8640000000000000))
      .slice(0, 4);
    if (!upcoming.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = activities.length ? '¡Muy bien! No tienes actividades pendientes.' : 'Todavía no tienes actividades asignadas.';
      list.append(empty);
    } else {
      upcoming.forEach((activity) => list.append(createActivityRow(activity)));
    }
  }

  async function load() {
    try {
      const me = await request('/api/auth/me');
      const user = me.usuario || {};
      setText('#usuario-nombre', user.nombre || 'Estudiante');
      setText('#usuario-email', user.email || '');
      setText('#student-first-name', (user.nombre || 'estudiante').trim().split(/\s+/)[0]);

      const organizationsData = await request('/api/auth/organizations');
      const organizations = organizationsData.organizaciones || [];
      let active = organizationsData.organizacionActiva;
      if (!active && organizations.length === 1) {
        const csrf = await request('/api/auth/csrf-token');
        await request('/api/auth/organizations/active', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
          body: JSON.stringify({ organizationId: organizations[0].id }),
        });
        active = organizations[0];
      }
      if (!active) {
        setMessage(organizations.length ? 'Selecciona tu institución en “Espacio de trabajo” para consultar tu información.' : 'Tu cuenta todavía no está vinculada a una institución. Solicita al administrador que complete tu vinculación.', 'info');
        return;
      }
      if (active.role === 'tutor') {
        window.location.replace('teacher-home.html');
        return;
      }

      if (active.role !== 'estudiante') {
        setMessage('Este inicio está diseñado para estudiantes. Tu espacio correspondiente se habilitará según tu rol institucional.', 'info');
        return;
      }

      const base = '/api/organization';
      const [practices, activities, evaluations, reports] = await Promise.all([
        request(base + '/practices'),
        request(base + '/activities'),
        request(base + '/evaluations'),
        request(base + '/reports'),
      ]);
      state.practices = practices.practicas || [];
      state.activities = activities.actividades || [];
      state.evaluations = evaluations.evaluaciones || [];
      state.report = (reports.reportes || [])[0] || null;
      render();
      setMessage('Tu información académica está actualizada.', 'success');
      window.setTimeout(() => { if (message.classList.contains('is-success')) message.hidden = true; }, 3500);
    } catch (error) {
      if (error.status === 401) {
        window.location.replace('/login.html');
        return;
      }
      if (error.code === 'ORGANIZATION_CONTEXT_REQUIRED') {
        setMessage('Selecciona tu institución en “Espacio de trabajo” para consultar tu información.');
        return;
      }
      setMessage(error.message || 'No fue posible cargar tu espacio académico.', 'error');
    }
  }

  async function logout() {
    const button = $('#btn-logout');
    button.disabled = true;
    try {
      const csrf = await request('/api/auth/csrf-token');
      await request('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken }, body: JSON.stringify({}) });
      window.location.replace('/login.html');
    } catch (error) {
      button.disabled = false;
      setMessage('No se pudo cerrar la sesión. Inténtalo nuevamente.', 'error');
    }
  }

  $('#btn-logout')?.addEventListener('click', logout);
  load();
})();
