(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const state = { practices: [], selected: null, modules: [], history: [], originalCount: 0, loading: false, gradeSummary: null, requestId: 0 };
  const message = $('#academic-message');

  function notify(text, type = 'info') {
    message.textContent = text;
    message.className = 'academic-message' + (type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : '');
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
      throw new Error(result?.error?.message || 'No se pudo completar la solicitud.');
    }
    return result.data || {};
  }
  async function mutate(url, data) {
    const token = (await api('/api/auth/csrf-token')).csrfToken;
    return api(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify(data) });
  }
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = String(text);
    if (className) element.className = className;
    return element;
  }
  function renderPracticeSummary(practice) {
    const root = $('#practice-summary'); root.replaceChildren();
    if (!practice) { root.append(node('p', 'Selecciona una práctica para configurar sus etapas de evaluación.')); return; }
    root.append(
      node('h3', practice.titulo || 'Práctica'),
      node('p', 'Estudiante: ' + (practice.estudiante?.nombre || '—')),
      node('p', 'Estado: ' + (practice.estado || '—')),
      node('p', 'Fechas: ' + formatDate(practice.fechaInicio) + ' — ' + formatDate(practice.fechaFin))
    );
  }
  function formatDate(value) {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
  function renderModules() {
    const root = $('#module-list'); root.replaceChildren();
    $('#empty-structure').hidden = state.modules.length > 0;
    $('#module-count').textContent = state.modules.length + (state.modules.length === 1 ? ' etapa' : ' etapas');
    state.modules.forEach((module, index) => {
      const card = node('article', null, 'module-card');
      const top = node('div', null, 'module-card-top');
      top.append(node('span', 'ETAPA ' + String(index + 1).padStart(2, '0'), 'module-index'));
      const remove = node('button', 'Eliminar', 'module-remove'); remove.type = 'button'; remove.dataset.removeModule = String(index);
      top.append(remove);
      const result = node('p', module.actividadesTotal
        ? (module.actividadesCalificadas || 0) + ' de ' + module.actividadesTotal + ' actividades calificadas · ' + (module.nota === null || module.nota === undefined ? 'Nota pendiente' : 'Promedio ' + Number(module.nota).toFixed(2) + '/5')
        : 'Aún no tiene actividades asignadas a esta etapa', 'module-grade-status');
      const fields = node('div', null, 'module-fields');
      const nameWrap = node('label', null, 'module-field'); nameWrap.append(node('span', 'Nombre de la etapa'));
      const name = node('input'); name.type = 'text'; name.maxLength = 120; name.required = true; name.value = module.nombre || ''; name.placeholder = 'Ej. Inducción y reconocimiento'; name.dataset.moduleField = 'nombre'; name.dataset.index = String(index);
      nameWrap.append(name);
      const weightWrap = node('label', null, 'module-field module-weight-field'); weightWrap.append(node('span', 'Ponderación (%)'));
      const weight = node('input'); weight.type = 'number'; weight.min = '0'; weight.max = '100'; weight.step = '0.01'; weight.required = true; weight.value = module.ponderacion ?? 0; weight.dataset.moduleField = 'ponderacion'; weight.dataset.index = String(index);
      weightWrap.append(weight);
      const descriptionWrap = node('label', null, 'module-field module-description'); descriptionWrap.append(node('span', 'Descripción / alcance'));
      const description = node('textarea'); description.rows = 2; description.maxLength = 1000; description.value = module.descripcion || ''; description.placeholder = 'Describe qué se trabajará y qué se espera alcanzar…'; description.dataset.moduleField = 'descripcion'; description.dataset.index = String(index);
      descriptionWrap.append(description);
      fields.append(nameWrap, weightWrap, descriptionWrap);
      card.append(top, result, fields);
      root.append(card);
    });
    updateWeights();
    renderFinalGrade();
    $('#change-reason-wrap').hidden = state.originalCount === 0;
    $('#save-structure').disabled = !state.selected || ['finalizada', 'suspendida'].includes(state.selected.estado);
  }
  function renderFinalGrade() {
    const summary = state.gradeSummary || {};
    $('#final-grade-value').textContent = summary.estado === 'completa' && Number.isFinite(Number(summary.notaFinal))
      ? Number(summary.notaFinal).toFixed(2) + ' / 5' : 'Pendiente';
    const pending = state.modules.filter((module) => module.estadoCalculo !== 'completo').length;
    $('#final-grade-note').textContent = summary.estado === 'completa'
      ? 'Todas las actividades tienen calificación oficial. Resultado ponderado por las etapas configuradas.'
      : pending + ' etapa(s) todavía necesitan actividades calificadas por el tutor. Las actividades sin nota no se cuentan como cero.';
  }
  function updateWeights() {
    const total = state.modules.reduce((sum, module) => sum + (Number(module.ponderacion) || 0), 0);
    const rounded = Math.round(total * 100) / 100;
    $('#weight-total').textContent = rounded.toFixed(2).replace(/\.00$/, '') + ' %';
    $('#weight-fill').style.width = Math.min(100, Math.max(0, total)) + '%';
    const valid = state.modules.length > 0 && Math.abs(total - 100) <= 0.01;
    $('#weight-fill').classList.toggle('is-valid', valid);
    $('#weight-feedback').textContent = valid ? 'Distribución completa: 100 %.' : 'Faltan ' + Math.max(0, 100 - total).toFixed(2) + ' puntos porcentuales para completar el 100 %.';
    $('#save-structure').disabled = !state.selected || !valid || ['finalizada', 'suspendida'].includes(state.selected.estado) || state.modules.some((m) => !String(m.nombre || '').trim());
    $('#save-status').textContent = valid ? 'La distribución está lista para guardarse.' : 'Ajusta las ponderaciones hasta completar el 100 %.';
  }
  function renderHistory() {
    const root = $('#structure-history'); root.replaceChildren();
    if (!state.history.length) { root.append(node('p', 'No hay modificaciones anteriores registradas.', 'history-empty')); return; }
    [...state.history].reverse().forEach((entry, index) => {
      const card = node('article', null, 'history-item');
      const date = entry.modificadoEn ? new Date(entry.modificadoEn).toLocaleString('es-CO') : 'Fecha no disponible';
      card.append(node('b', 'Versión anterior ' + (state.history.length - index)), node('span', date));
      card.append(node('p', 'Motivo: ' + (entry.motivo || 'No especificado')));
      const list = node('ul');
      (entry.modulos || []).forEach((module) => list.append(node('li', module.nombre + ' · ' + Number(module.ponderacion).toFixed(2) + '%')));
      card.append(list); root.append(card);
    });
  }
  async function loadStructure(practiceId, requestId = state.requestId) {
    const data = await api('/api/organization/practices/' + encodeURIComponent(practiceId) + '/academic-structure');
    if (requestId !== state.requestId) return;
    state.modules = (data.modulos || []).map((module) => ({ ...module, _id: module._id, nombre: module.nombre, descripcion: module.descripcion, ponderacion: Number(module.ponderacion), orden: module.orden }));
    state.gradeSummary = data.resumenCalificacion || null;
    state.history = data.historial || [];
    state.originalCount = state.modules.length;
    renderModules(); renderHistory();
  }
  async function selectPractice(practiceId) {
    const requestId = ++state.requestId;
    state.selected = state.practices.find((practice) => String(practice._id) === practiceId) || null;
    state.modules = []; state.history = []; state.gradeSummary = null; state.originalCount = 0;
    renderPracticeSummary(state.selected); renderModules(); renderHistory();
    if (!state.selected) return;
    try {
      notify('Consultando las etapas de evaluación…');
      await loadStructure(practiceId, requestId);
      if (requestId !== state.requestId) return;
      notify('Etapas cargadas. Puedes organizar la evaluación de esta práctica.');
    } catch (error) { if (requestId === state.requestId) notify(error.message, 'error'); }
  }
  $('#practice-select').addEventListener('change', (event) => selectPractice(event.target.value));
  $('#add-module').addEventListener('click', () => {
    if (!state.selected || state.modules.length >= 20) return;
    state.modules.push({ nombre: '', descripcion: '', ponderacion: 0 });
    renderModules();
    const inputs = $('#module-list').querySelectorAll('input[data-module-field="nombre"]');
    inputs[inputs.length - 1]?.focus();
  });
  $('#module-list').addEventListener('input', (event) => {
    const field = event.target.dataset.moduleField;
    const index = Number(event.target.dataset.index);
    if (!field || !Number.isInteger(index) || !state.modules[index]) return;
    state.modules[index][field] = field === 'ponderacion' ? Number(event.target.value) : event.target.value;
    updateWeights();
  });
  $('#module-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-module]');
    if (!button) return;
    state.modules.splice(Number(button.dataset.removeModule), 1);
    renderModules();
  });
  $('#save-structure').addEventListener('click', async () => {
    if (!state.selected) return;
    const total = state.modules.reduce((sum, module) => sum + (Number(module.ponderacion) || 0), 0);
    if (Math.abs(total - 100) > 0.01) { notify('Las ponderaciones deben sumar exactamente 100 %.','error'); return; }
    const motivoCambio = $('#change-reason').value.trim();
    if (state.originalCount && !motivoCambio) { notify('Escribe el motivo del cambio para conservar la trazabilidad.','error'); $('#change-reason').focus(); return; }
    const button = $('#save-structure'); button.disabled = true; button.textContent = 'Guardando…';
    try {
      await mutate('/api/organization/practices/' + encodeURIComponent(state.selected._id) + '/academic-structure', {
        modulos: state.modules.map(({ _id, nombre, descripcion, ponderacion }) => ({ _id, nombre, descripcion, ponderacion })),
        motivoCambio,
      });
      await loadStructure(String(state.selected._id));
      $('#change-reason').value = '';
      notify('Etapas de evaluación guardadas correctamente.','success');
    } catch (error) { notify(error.message,'error'); }
    finally { button.textContent = 'Guardar estructura'; updateWeights(); }
  });
  $('#btn-logout').addEventListener('click', async () => {
    const button = $('#btn-logout'); button.disabled = true;
    try {
      const token = (await api('/api/auth/csrf-token')).csrfToken;
      await api('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: '{}' });
      location.replace('/login.html');
    } catch (error) { button.disabled = false; notify('No se pudo cerrar la sesión. Inténtalo nuevamente.','error'); }
  });
  async function init() {
    try {
      const session = await api('/api/auth/me');
      const user = session.usuario || {};
      $('#teacher-name').textContent = user.nombre || 'Docente';
      const organizations = await api('/api/auth/organizations');
      const active = organizations.organizacionActiva;
      if (!active || active.role !== 'tutor') { notify('Este apartado está disponible para docentes con rol tutor en el espacio institucional activo.','error'); $('#practice-select').disabled = true; $('#add-module').disabled = true; return; }
      const practices = await api('/api/organization/practices');
      state.practices = practices.practicas || [];
      const select = $('#practice-select'); select.replaceChildren(new Option('Seleccionar práctica…',''));
      state.practices.forEach((practice) => select.add(new Option((practice.titulo || 'Práctica') + ' — ' + (practice.estudiante?.nombre || 'Estudiante'), practice._id)));
      if (!state.practices.length) { notify('Todavía no tienes prácticas asignadas.','info'); return; }
      await selectPractice(state.practices[0]._id);
    } catch (error) { notify(error.message || 'No fue posible cargar la planificación académica.','error'); }
  }
  init();
})();
