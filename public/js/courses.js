(function () {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = { role: null, courses: [] };
  const message = $('#courses-message');

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json', ...(options.headers || {}) }, ...options
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) location.replace('/login.html');
      throw new Error(result?.error?.message || 'No se pudo completar la solicitud.');
    }
    return result.data || {};
  }
  async function mutate(url, method, data) {
    const token = (await api('/api/auth/csrf-token')).csrfToken;
    return api(url, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify(data || {}) });
  }
  function el(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = String(text);
    if (className) element.className = className;
    return element;
  }
  function note(text, type = '') {
    message.textContent = text;
    message.className = 'courses-message' + (type ? ' is-' + type : '');
  }
  function formatDate(value) {
    if (!value) return 'Sin fecha límite';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Sin fecha límite'
      : new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
  function dateInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  function renderActivity(activity, course, module) {
    const item = el('article', null, 'course-activity');
    const top = el('div', null, 'course-activity-top');
    top.append(el('b', activity.title), el('span', activity.status === 'publicada' ? 'Publicada' : activity.status || 'Borrador', 'course-activity-status'));
    item.append(top);
    if (activity.description) item.append(el('p', activity.description));
    if (activity.instructions) item.append(el('p', activity.instructions, 'course-activity-instructions'));
    item.append(el('small', 'Fecha límite: ' + formatDate(activity.dueAt)));
    if (state.role === 'tutor') {
      const actions = el('div', null, 'course-activity-actions');
      const edit = el('button', 'Editar', 'btn btn-secundario btn-sm');
      edit.type = 'button';
      edit.addEventListener('click', async () => {
        const title = window.prompt('Título de la actividad', activity.title);
        if (title === null) return;
        const description = window.prompt('Descripción', activity.description || '');
        if (description === null) return;
        try {
          await mutate('/api/organization/courses/' + course.id + '/activities/' + activity.id, 'PATCH', { title, description });
          await loadCourses();
          note('Actividad actualizada dentro de ' + course.name + '.', 'success');
        } catch (error) { note(error.message, 'error'); }
      });
      const remove = el('button', 'Eliminar', 'btn btn-secundario btn-sm');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!window.confirm('¿Eliminar esta actividad del curso?')) return;
        try {
          await mutate('/api/organization/courses/' + course.id + '/activities/' + activity.id, 'DELETE');
          await loadCourses();
          note('Actividad eliminada del curso.', 'success');
        } catch (error) { note(error.message, 'error'); }
      });
      actions.append(edit, remove); item.append(actions);
    }
    return item;
  }
  function renderModuleEditor(course, card) {
    const section = el('section', null, 'course-module-editor');
    section.append(el('h3', 'Estructura de unidades'));
    const form = el('form', null, 'course-modules-form');
    const rows = el('div', null, 'course-module-rows');
    function addRow(module = {}) {
      const row = el('div', null, 'course-module-row');
      row.dataset.id = module.id || '';
      const title = el('input'); title.type = 'text'; title.required = true; title.minLength = 2; title.maxLength = 160;
      title.placeholder = 'Nombre de la unidad'; title.value = module.id ? displayUnitTitle(module) : (module.title || '');
      const description = el('input'); description.type = 'text'; description.maxLength = 2000;
      description.placeholder = 'Descripción (opcional)'; description.value = module.description || '';
      const remove = el('button', 'Quitar', 'btn btn-secundario btn-sm'); remove.type = 'button';
      remove.addEventListener('click', () => row.remove());
      row.append(title, description, remove); rows.append(row);
    }
    (course.modules || []).forEach(module => addRow(module));
    if (!rows.children.length) {
      section.append(el('p', 'El administrador institucional todavía no ha configurado unidades para este curso.', 'course-empty'));
      return;
    }
    const save = el('button', 'Guardar nombres y descripciones', 'btn btn-primario btn-sm'); save.type = 'submit';
    form.append(rows, save);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const modules = [...rows.children].map(row => ({
        ...(row.dataset.id ? { id: row.dataset.id } : {}),
        title: row.querySelector('input:nth-child(1)').value.trim(),
        description: row.querySelector('input:nth-child(2)').value.trim()
      }));
      if (!modules.length) { note('El curso debe conservar al menos una unidad.', 'error'); return; }
      save.disabled = true;
      try {
        await mutate('/api/organization/courses/' + course.id + '/modules', 'PUT', { modules });
        await loadCourses();
        note('Estructura de ' + course.name + ' guardada correctamente.', 'success');
      } catch (error) { note(error.message, 'error'); }
      finally { save.disabled = false; }
    });
    section.append(form);
    card.append(section);
  }
  function renderActivityForm(course, card) {
    const section = el('section', null, 'course-create-activity');
    section.append(el('h3', 'Crear actividad para este curso'));
    const form = el('form', null, 'course-activity-form');
    const module = el('select'); module.required = true; module.name = 'moduleId';
    module.add(new Option('Selecciona la unidad', ''));
    (course.modules || []).filter(item => item.status === 'activo').forEach(item => module.add(new Option(item.number + '. ' + item.title, item.id)));
    const title = el('input'); title.required = true; title.minLength = 3; title.maxLength = 160; title.placeholder = 'Nombre de la actividad';
    const description = el('textarea'); description.rows = 2; description.maxLength = 4000; description.placeholder = 'Descripción';
    const instructions = el('textarea'); instructions.rows = 3; instructions.maxLength = 10000; instructions.placeholder = 'Instrucciones para los estudiantes';
    const opensAt = el('input'); opensAt.type = 'datetime-local';
    const dueAt = el('input'); dueAt.type = 'datetime-local';
    const status = el('select'); status.add(new Option('Guardar como borrador', 'borrador')); status.add(new Option('Publicar para estudiantes', 'publicada'));
    const fields = el('div', null, 'course-activity-fields');
    [[module, 'Unidad'], [title, 'Título'], [description, 'Descripción'], [instructions, 'Instrucciones'], [opensAt, 'Fecha de apertura'], [dueAt, 'Fecha de entrega'], [status, 'Visibilidad']].forEach(([input, label]) => {
      const wrap = el('label', null, 'course-form-field'); wrap.append(el('span', label), input); fields.append(wrap);
    });
    const submit = el('button', 'Crear actividad en ' + course.name, 'btn btn-primario'); submit.type = 'submit';
    form.append(fields, submit);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!module.value) { note('Selecciona la unidad a la que pertenece la actividad.', 'error'); return; }
      submit.disabled = true;
      try {
        await mutate('/api/organization/courses/' + course.id + '/activities', 'POST', {
          moduleId: module.value, title: title.value.trim(), description: description.value.trim(),
          instructions: instructions.value.trim(), opensAt: opensAt.value || null,
          dueAt: dueAt.value || null, status: status.value
        });
        await loadCourses();
        note('Actividad creada dentro de ' + course.name + ', en la unidad seleccionada.', 'success');
      } catch (error) { note(error.message, 'error'); }
      finally { submit.disabled = false; }
    });
    section.append(form); card.append(section);
  }
  function displayUnitTitle(module) {
    const title = String(module.title || '').trim();
    const legacy = title.match(/^módulo\s+(\d+)$/i);
    return legacy ? 'Unidad ' + legacy[1] : (title || 'Unidad ' + module.number);
  }
  function renderCourseWorkspace(course) {
    const summary = $('#courses-summary');
    const listRoot = $('#courses-list');
    const workspace = $('#course-workspace');
    summary.hidden = true; listRoot.hidden = true; workspace.hidden = false;
    workspace.replaceChildren();

    const heading = el('div', null, 'course-workspace-heading');
    const back = el('button', '← Volver a Mis cursos', 'btn btn-secundario btn-sm');
    back.type = 'button'; back.addEventListener('click', () => { location.href = 'courses.html'; });
    const intro = el('div', null, 'course-workspace-intro');
    intro.append(el('span', course.code || 'CURSO', 'course-code'), el('h2', course.name), el('p', course.description || 'Espacio académico de esta asignatura.'));
    const metrics = el('div', null, 'course-counts');
    metrics.append(el('span', (course.modules || []).length + ' unidades'), el('span', course.counts.activities + ' actividades'), el('span', course.counts.students + ' estudiantes'));
    heading.append(back, intro, metrics); workspace.append(heading);

    if (state.role === 'tutor') {
      const teacherTools = el('div', null, 'course-teacher-tools');
      renderModuleEditor(course, teacherTools);
      renderActivityForm(course, teacherTools);
      workspace.append(teacherTools);
    }

    const modules = course.modules || [];
    const activitySection = el('section', null, 'course-activities-by-module');
    activitySection.append(el('h3', 'Actividades por unidad', 'course-subheading'));
    if (!modules.length) activitySection.append(el('p', 'Este curso todavía no tiene unidades configuradas.', 'course-empty'));
    modules.forEach(module => {
      const group = el('section', null, 'course-module-group');
      group.append(el('h4', module.number + '. ' + displayUnitTitle(module)));
      if (module.description) group.append(el('p', module.description));
      const activities = (course.activities || []).filter(item => item.moduleId === module.id);
      if (!activities.length) group.append(el('p', 'Todavía no hay actividades en esta unidad.', 'course-empty'));
      activities.forEach(activity => group.append(renderActivity(activity, course, module)));
      activitySection.append(group);
    });
    workspace.append(activitySection);

    const resourceSection = el('section', null, 'course-general-resources');
    resourceSection.append(el('h3', 'Materiales generales del curso', 'course-subheading'));
    const resources = el('div', null, 'course-resource-list');
    if (!(course.resources || []).length) resources.append(el('p', 'No hay recursos generales adjuntos.', 'course-empty'));
    (course.resources || []).forEach(resource => {
      const row = el('div', null, 'course-resource'); const info = el('div');
      info.append(el('b', resource.title), el('small', (resource.description || '') + ' · ' + (resource.sizeBytes / 1024).toFixed(1) + ' KB'));
      const link = el('a', 'Descargar PDF'); link.href = resource.downloadUrl; link.setAttribute('download', resource.fileName);
      row.append(info, link); resources.append(row);
    });
    resourceSection.append(resources); workspace.append(resourceSection);
  }
  function renderCourses(list) {
    const root = $('#courses-list'); root.replaceChildren();
    const workspace = $('#course-workspace');
    const selectedId = new URLSearchParams(location.search).get('course');
    if (selectedId) {
      const selected = list.find(course => String(course.id) === selectedId);
      if (selected) { renderCourseWorkspace(selected); return; }
      $('#courses-summary').hidden = false; root.hidden = false; workspace.hidden = true;
      note('Ese curso no está asignado a tu perfil o ya no está disponible.', 'error');
    } else {
      $('#courses-summary').hidden = false; root.hidden = false; workspace.hidden = true;
    }
    const activityCount = list.reduce((total, course) => total + Number(course.counts?.activities || 0), 0);
    const resourceCount = list.reduce((total, course) => total + Number(course.counts?.resources || 0), 0);
    $('#courses-summary').replaceChildren(
      el('span', list.length + ' cursos'),
      el('span', activityCount + ' actividades'),
      el('span', resourceCount + ' recursos PDF')
    );
    if (!list.length) { root.append(el('p', 'No tienes cursos asignados en este espacio.', 'course-empty')); return; }
    list.forEach(course => {
      const card = el('article', null, 'course-card course-card-overview');
      card.append(el('span', course.code, 'course-code'), el('h2', course.name), el('p', course.description, 'course-description'));
      const counts = el('div', null, 'course-counts');
      counts.append(el('span', (course.modules || []).length + ' unidades'), el('span', course.counts.activities + ' actividades'), el('span', course.counts.students + ' estudiantes'));
      const open = el('a', 'Abrir curso →', 'course-open-link');
      open.href = 'courses.html?course=' + encodeURIComponent(course.id);
      card.append(counts, open); root.append(card);
    });
  }
  async function loadCourses() {
    const result = await api('/api/organization/courses');
    state.courses = result.courses || [];
    renderCourses(state.courses);
  }
  async function logout() {
    const button = $('#btn-logout'); button.disabled = true;
    try {
      const token = (await api('/api/auth/csrf-token')).csrfToken;
      await api('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: '{}' });
      location.replace('/login.html');
    } catch (error) { button.disabled = false; note('No se pudo cerrar la sesión. ' + error.message, 'error'); }
  }
  async function init() {
    try {
      const session = await api('/api/auth/me');
      $('#course-user').textContent = session.usuario?.nombre || 'Usuario';
      const organizations = await api('/api/auth/organizations');
      const active = organizations.organizacionActiva;
      if (!active) { note('Selecciona primero un espacio institucional.'); return; }
      if (!['tutor', 'estudiante'].includes(active.role)) { note('Este apartado es para docentes y estudiantes.', 'error'); return; }
      state.role = active.role;
      $('#home-link').href = active.role === 'tutor' ? 'teacher-home.html' : 'dashboard.html';
      if (state.role === 'tutor') {
        $('.courses-hero p:last-child').textContent = 'Abre cada asignatura para consultar sus unidades y organizar actividades dentro del curso correspondiente.';
      } else {
        $('.courses-hero p:last-child').textContent = 'Consulta las actividades publicadas y materiales de cada uno de tus cursos.';
      }
      await loadCourses();
      note('Cursos y unidades cargados desde MariaDB.', 'success');
    } catch (error) { note(error.message || 'No fue posible cargar tus cursos.', 'error'); }
  }
  $('#btn-logout').addEventListener('click', logout);
  init();
})();