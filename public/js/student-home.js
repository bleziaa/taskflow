(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const message = $('#student-message');
  const fieldRules = window.TaskFlowFieldRules;
  function bindProfilePhoneValidation() {
    const input = $('#profile-phone');
    if (!input || !fieldRules) return;
    const validatePhone = () => input.setCustomValidity(fieldRules.isValidPhone(input.value) ? '' : 'El teléfono debe contener entre 7 y 15 dígitos.');
    input.addEventListener('input', validatePhone);
    validatePhone();
  }

  const state = { practices: [], activities: [], evaluations: [], report: null, profileCompleted: false };

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

  function profileFeedback(text, type = 'info') {
    const box = $('#student-profile-feedback');
    if (!box) return;
    box.textContent = text;
    box.className = 'student-profile-feedback' + (type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : '');
    box.hidden = !text;
  }

  async function loadStudentProfile() {
    const form = $('#student-profile-form');
    if (!form) return;
    try {
      const data = await request('/api/organization/profile');
      const student = data.estudiante || {};
      $('#profile-code').value = student.codigo || '';
      $('#profile-name').value = student.nombre || '';
      $('#profile-email').value = student.email || '';
      $('#profile-phone').value = student.telefono || '';
      $('#profile-program').value = student.programa || '';
      $('#profile-semester').value = student.semestre ? String(student.semestre) : '';
      setText('#profile-company', student.empresa?.razonSocial || 'Pendiente de asignación');
      setText('#profile-tutor', student.tutor?.nombre || 'Pendiente de asignación');
      const completed = student.perfilCompletado === true;
      state.profileCompleted = completed;
      $('#student-profile-completed').hidden = !completed;
      form.hidden = completed;
      const heading = $('#student-profile-title');
      if (heading) heading.textContent = completed ? 'Mi ficha académica' : 'Completa tu ficha académica';
    } catch (error) {
      if (error.status === 404 || error.code === 'STUDENT_PROFILE_NOT_FOUND') {
        profileFeedback(error.message || 'Tu cuenta aún no tiene una ficha vinculada. Solicita al administrador que la registre con el correo de tu cuenta.', 'error');
        form.querySelectorAll('input:not([disabled]), select, button').forEach((control) => { control.disabled = true; });
        return;
      }
      profileFeedback(error.message || 'No se pudo cargar tu ficha académica.', 'error');
    }
  }

  async function saveStudentProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('#save-student-profile');
    if (!form.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.semestre = Number(payload.semestre);
    button.disabled = true;
    button.textContent = 'Guardando…';
    try {
      const csrf = await request('/api/auth/csrf-token');
      const result = await request('/api/organization/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
        body: JSON.stringify(payload),
      });
      const student = result.estudiante || {};
      $('#profile-name').value = student.nombre || payload.nombre;
      setText('#usuario-nombre', student.nombre || payload.nombre);
      setText('#student-first-name', (student.nombre || payload.nombre).trim().split(/\s+/)[0]);
      profileFeedback(result.mensaje || (state.profileCompleted ? 'Los cambios de tu ficha se guardaron correctamente.' : 'Tu ficha se guardó correctamente.'), 'success');
      state.profileCompleted = true;
      form.hidden = true;
      $('#student-profile-completed').hidden = false;
      $('#cancel-student-profile').hidden = true;
    } catch (error) {
      profileFeedback(error.message || 'No fue posible guardar tus datos.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = state.profileCompleted ? 'Guardar cambios' : 'Guardar mis datos';
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

      await loadStudentProfile();

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
  $('#student-profile-form')?.addEventListener('submit', saveStudentProfile);
  $('#edit-student-profile')?.addEventListener('click', () => {
    const form = $('#student-profile-form');
    if (form) {
      form.hidden = false;
      $('#student-profile-completed').hidden = true;
      $('#cancel-student-profile').hidden = false;
      $('#save-student-profile').textContent = 'Guardar cambios';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('#profile-name')?.focus();
    }
  });
  $('#cancel-student-profile')?.addEventListener('click', async () => {
    const form = $('#student-profile-form');
    const cancel = $('#cancel-student-profile');
    cancel.disabled = true;
    await loadStudentProfile();
    if (state.profileCompleted) {
      form.hidden = true;
      $('#student-profile-completed').hidden = false;
    }
    cancel.hidden = true;
    cancel.disabled = false;
    $('#save-student-profile').textContent = state.profileCompleted ? 'Guardar cambios' : 'Guardar mis datos';
    profileFeedback('Edición cancelada. Se conservaron los datos guardados.', 'info');
  });
  bindProfilePhoneValidation();
  load();
})();
