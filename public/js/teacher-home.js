(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const message = $('#teacher-home-message');
  const state = { reports: [], activities: [], courses: [] };

  function notify(text, type = 'info') {
    message.textContent = text;
    message.className = 'teacher-home-message' + (type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : '');
    message.hidden = !text;
  }
  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', ...(options.headers || {}) }, ...options
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) location.replace('/login.html');
      throw new Error(result?.error?.message || 'No se pudo cargar la información.');
    }
    return result.data || {};
  }
  function setText(selector, value) {
    const target = $(selector);
    if (target) target.textContent = value == null || value === '' ? '—' : String(value);
  }
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = String(text);
    if (className) element.className = className;
    return element;
  }
  function date(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  function formatDate(value) {
    const parsed = date(value);
    return parsed ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed) : 'Sin fecha';
  }
  function renderCourses(courses) {
    const root = $('#teacher-courses-list');
    const summary = $('#teacher-courses-summary');
    if (!root || !summary) return;
    root.replaceChildren();
    const totals = courses.reduce((acc, course) => {
      acc.students += Number(course.counts?.students || 0);
      acc.activities += Number(course.counts?.activities || 0);
      acc.resources += Number(course.counts?.resources || 0);
      acc.units += Number(course.modules?.length || 0);
      return acc;
    }, { students: 0, activities: 0, resources: 0, units: 0 });
    summary.replaceChildren(
      node('span', courses.length + ' cursos asignados'),
      node('span', totals.students + ' matrículas en total'),
      node('span', totals.units + ' unidades'),
      node('span', totals.activities + ' actividades'),
      node('span', totals.resources + ' materiales')
    );
    if (!courses.length) {
      root.append(node('p', 'Todavía no tienes cursos académicos asignados en esta institución.', 'teacher-home-empty'));
      return;
    }
    courses.forEach((course) => {
      const card = node('article', undefined, 'teacher-course-card');
      const top = node('div', undefined, 'teacher-course-card-top');
      top.append(node('span', course.code || 'CURSO', 'teacher-course-code'),
        node('span', course.status === 'activo' ? 'Activo' : (course.status || 'Estado'), 'teacher-course-status'));
      card.append(top, node('h3', course.name || 'Curso sin nombre'),
        node('p', course.description || 'Asignatura del espacio académico activo.', 'teacher-course-description'));
      const metrics = node('div', undefined, 'teacher-course-metrics');
      [
        ['Estudiantes', course.counts?.students ?? 0],
        ['Unidades', course.modules?.length ?? 0],
        ['Actividades', course.counts?.activities ?? 0],
        ['Materiales PDF', course.counts?.resources ?? 0]
      ].forEach(([label, value]) => {
        const metric = node('div', undefined, 'teacher-course-metric');
        metric.append(node('strong', value), node('span', label));
        metrics.append(metric);
      });
      card.append(metrics);
      const activityList = node('div', undefined, 'teacher-course-activities');
      activityList.append(node('b', 'Actividades del curso'));
      const activities = Array.isArray(course.activities) ? course.activities : [];
      if (!activities.length) {
        activityList.append(node('p', 'Aún no hay actividades publicadas.', 'teacher-home-empty'));
      } else {
        activities.slice(0, 3).forEach((activity) => {
          const item = node('div', undefined, 'teacher-course-activity');
          item.append(node('span', activity.title || 'Actividad sin título'),
            node('small', formatDate(activity.dueAt)));
          activityList.append(item);
        });
        if (activities.length > 3) activityList.append(node('small', '+' + (activities.length - 3) + ' actividades más'));
      }
      card.append(activityList);
      const actions = node('div', undefined, 'teacher-course-actions');
      const view = node('a', 'Abrir curso');
      view.href = 'courses.html?course=' + encodeURIComponent(course.id);
      actions.append(view);
      card.append(actions);
      root.append(card);
    });
  }

  function render() {
    const reports = state.reports;
    const uniqueStudents = new Set(reports.map((item) => item.estudiante?._id).filter(Boolean));
    const activePractices = reports.filter((item) => item.practica?.estado === 'en_curso').length;
    const activities = state.activities;
    const pendingActivities = activities.filter((item) => !['completada'].includes(item.estado)).length;
    const evidencePending = reports.reduce((total, report) => total + (report.actividades || []).reduce((sum, activity) =>
      sum + (activity.evidencias || []).filter((evidence) => evidence.estado === 'pendiente').length, 0), 0);

    setText('#kpi-students', uniqueStudents.size);
    setText('#kpi-practices', activePractices);
    setText('#kpi-review', evidencePending);
    setText('#kpi-pending', pendingActivities);

    const reviews = [];
    reports.forEach((report) => {
      (report.actividades || []).forEach((activity) => {
        (activity.evidencias || []).filter((evidence) => evidence.estado === 'pendiente').forEach(() => {
          reviews.push({ student: report.estudiante?.nombre || 'Estudiante', activity: activity.titulo || 'Actividad' });
        });
      });
    });
    const reviewRoot = $('#teacher-reviews');
    reviewRoot.replaceChildren();
    if (!reviews.length) {
      reviewRoot.append(node('p', 'No tienes evidencias pendientes de revisión.', 'teacher-home-empty'));
    } else {
      reviews.slice(0, 5).forEach((review) => {
        const row = document.createElement('article');
        row.className = 'teacher-deadline-item';
        const icon = node('div', '↗', 'teacher-review-icon');
        const info = node('div');
        info.className = 'teacher-deadline-info';
        info.append(node('b', review.activity), node('span', review.student));
        const status = node('span', 'Pendiente', 'teacher-deadline-status');
        row.append(icon, info, status);
        reviewRoot.append(row);
      });
      if (reviews.length > 5) {
        reviewRoot.append(node('p', 'Y ' + (reviews.length - 5) + ' entrega(s) más por revisar.', 'teacher-home-empty'));
      }
    }

    const upcoming = activities.filter((item) => item.estado !== 'completada')
      .map((item) => ({ ...item, due: date(item.fechaLimite) }))
      .sort((a, b) => (a.due?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.due?.getTime() ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 6);
    const root = $('#teacher-deadlines');
    root.replaceChildren();
    if (!upcoming.length) {
      const empty = document.createElement('p');
      empty.className = 'teacher-home-empty';
      empty.textContent = activities.length ? '¡Muy bien! No tienes actividades pendientes.' : 'Todavía no hay actividades asignadas a tus prácticas.';
      root.append(empty);
      return;
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    upcoming.forEach((activity) => {
      const row = document.createElement('article'); row.className = 'teacher-deadline-item';
      const dateBox = document.createElement('div'); dateBox.className = 'teacher-deadline-date';
      const day = document.createElement('b'); day.textContent = activity.due ? String(activity.due.getDate()).padStart(2, '0') : '—';
      const month = document.createElement('span'); month.textContent = activity.due ? new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(activity.due).replace('.', '') : 'Fecha';
      dateBox.append(day, month);
      const info = document.createElement('div'); info.className = 'teacher-deadline-info';
      const title = document.createElement('b'); title.textContent = activity.titulo || 'Actividad sin título';
      const practice = activity.practica || {};
      const subtitle = document.createElement('span'); subtitle.textContent = [practice.estudiante?.nombre, practice.titulo].filter(Boolean).join(' · ') || 'Práctica asignada';
      info.append(title, subtitle);
      const status = document.createElement('span'); status.className = 'teacher-deadline-status';
      status.textContent = !activity.due ? 'Sin fecha' : activity.due < today ? 'Vencida' : activity.estado === 'en_revision' ? 'En revisión' : 'Pendiente';
      if (activity.due && activity.due < today) status.classList.add('is-overdue');
      row.append(dateBox, info, status); root.append(row);
    });
  }
  async function logout() {
    const button = $('#btn-logout'); button.disabled = true;
    try {
      const token = (await api('/api/auth/csrf-token')).csrfToken;
      await api('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: '{}' });
      location.replace('/login.html');
    } catch (error) { button.disabled = false; notify('No se pudo cerrar la sesión. Inténtalo nuevamente.', 'error'); }
  }
  async function init() {
    try {
      const session = await api('/api/auth/me');
      const user = session.usuario || {};
      setText('#teacher-name', user.nombre || 'Docente');
      setText('#teacher-first-name', (user.nombre || 'docente').trim().split(/\s+/)[0]);
      const organizations = await api('/api/auth/organizations');
      const active = organizations.organizacionActiva;
      if (!active) {
        notify('Selecciona un espacio de trabajo para consultar tu actividad docente.');
        return;
      }
      if (active.role === 'administrador') {
        location.replace('/institution-admin.html');
        return;
      }
      if (active.role !== 'tutor') {
        notify('Este panel está disponible para docentes con rol tutor en el espacio activo.', 'error');
        return;
      }
      setText('#active-workspace', active.nombre || active.nombreComercial || 'Espacio institucional activo');
      const [reports, activities, courses] = await Promise.all([
        api('/api/organization/reports'),
        api('/api/organization/activities'),
        api('/api/organization/courses')
      ]);
      state.reports = reports.reportes || [];
      state.activities = activities.actividades || [];
      state.courses = courses.courses || [];
      renderCourses(state.courses);
      render();
      notify('Tu panel docente está actualizado.', 'success');
      window.setTimeout(() => { if (message.classList.contains('is-success')) message.hidden = true; }, 3200);
    } catch (error) {
      notify(error.message || 'No fue posible cargar el panel docente.', 'error');
    }
  }
  $('#btn-logout').addEventListener('click', logout);
  init();
})();