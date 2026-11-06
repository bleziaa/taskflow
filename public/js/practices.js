(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const state = { user: null, role: null, practices: [], students: [], companies: [], tutors: [] };
  const message = $('#practice-message');
  const statusNames = { planificada: 'Planificada', en_curso: 'En curso', finalizada: 'Finalizada', suspendida: 'Suspendida' };
  function notify(text, error = false) {
    message.textContent = text;
    message.className = 'form-mensaje ' + (error ? 'error' : 'exito');
  }
  async function api(url, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) location.replace('/login.html');
      throw new Error(result?.error?.message || 'No se pudo completar la solicitud.');
    }
    return result.data || {};
  }
  async function mutate(url, method, data) {
    const token = (await api('/api/auth/csrf-token')).csrfToken;
    return api(url, { method, headers: { 'X-CSRF-Token': token }, body: data ? JSON.stringify(data) : '{}' });
  }
  function node(tag, text) { const e = document.createElement(tag); e.textContent = text || ''; return e; }
  function addOption(select, label, value) { select.add(new Option(label, value)); }
  async function loadOptions() {
    const [students, companies, users] = await Promise.all([
      api('/api/organization/students'), api('/api/organization/companies'), api('/api/organization/tutors')
    ]);
    state.students = students.estudiantes || [];
    state.companies = companies.empresas || [];
    state.tutors = (users.usuarios || []).filter((u) => u.activo !== false);
    const fields = [
      ['p-estudiante', state.students.filter((s) => s.estado === 'activo'), (s) => s.codigo + ' — ' + s.nombre, (s) => s._id],
      ['p-empresa', state.companies.filter((c) => c.estado === 'activa'), (c) => c.razonSocial, (c) => c._id],
      ['p-tutor', state.tutors, (u) => u.nombre + ' (' + u.email + ')', (u) => u._id]
    ];
    fields.forEach(([id, items, label, value]) => {
      const select = $('#' + id); select.replaceChildren();
      addOption(select, 'Seleccionar…', '');
      items.forEach((item) => addOption(select, label(item), value(item)));
    });
  }
  function render() {
    const root = $('#practice-list');
    if (!state.practices.length) {
      root.replaceChildren(node('p', 'Todavía no hay prácticas asignadas para esta cuenta.'));
      return;
    }
    root.replaceChildren(...state.practices.map((p) => {
      const card = node('article', '');
      card.className = 'practice-card';
      const head = node('div', ''); head.className = 'practice-card-head';
      const title = node('h2', p.titulo); const status = node('span', statusNames[p.estado] || p.estado);
      status.className = 'practice-status status-' + p.estado; head.append(title, status);
      const detail = node('p', 'Estudiante: ' + (p.estudiante?.nombre || '—') + ' · Tutor: ' + (p.tutor?.nombre || '—'));
      const company = node('p', 'Empresa: ' + (p.empresa?.razonSocial || '—') + (p.empresa?.ciudad ? ' · ' + p.empresa.ciudad : ''));
      const dates = node('p', 'Periodo: ' + new Date(p.fechaInicio).toLocaleDateString('es-CO') + ' — ' + new Date(p.fechaFin).toLocaleDateString('es-CO'));
      const objective = node('p', p.objetivo || 'Sin objetivo registrado.'); objective.className = 'practice-objective';
      card.append(head, detail, company, dates, objective);
      if (p.observaciones) card.append(node('p', 'Observaciones: ' + p.observaciones));
      if (state.role === 'administrador') {
        const actions = node('div', ''); actions.className = 'practice-actions';
        const edit = node('button', 'Editar'); edit.type = 'button'; edit.className = 'btn btn-secundario btn-sm'; edit.dataset.action = 'edit'; edit.dataset.id = p._id;
        const del = node('button', 'Eliminar'); del.type = 'button'; del.className = 'btn btn-secundario btn-sm'; del.dataset.action = 'delete'; del.dataset.id = p._id;
        actions.append(edit, del); card.append(actions);
      }
      return card;
    }));
  }
  async function load() {
    const data = await api('/api/organization/practices');
    state.practices = data.practicas || [];
    render();
  }
  function resetForm() {
    $('#form-practice').reset(); $('#form-practice').elements.id.value = '';
    $('#practice-admin-form').hidden = true;
  }
  $('#btn-nueva').addEventListener('click', () => {
    resetForm(); $('#form-title').textContent = 'Registrar práctica';
    $('#practice-admin-form').hidden = false;
    $('#practice-admin-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('#btn-cancelar').addEventListener('click', resetForm);
  $('#form-practice').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const id = data.id; delete data.id;
    try {
      await mutate(id ? '/api/organization/practices/' + encodeURIComponent(id) : '/api/organization/practices', id ? 'PATCH' : 'POST', data);
      resetForm(); await load(); notify(id ? 'Práctica actualizada.' : 'Práctica creada y vinculada al estudiante.');
    } catch (error) { notify(error.message, true); }
  });
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const p = state.practices.find((item) => item._id === button.dataset.id);
    if (!p) return;
    try {
      if (button.dataset.action === 'edit') {
        const form = $('#form-practice');
        const values = {
          id: p._id, estudiante: p.estudiante?._id, empresa: p.empresa?._id, tutor: p.tutor?._id,
          titulo: p.titulo, fechaInicio: String(p.fechaInicio).slice(0, 10), fechaFin: String(p.fechaFin).slice(0, 10),
          estado: p.estado, objetivo: p.objetivo, observaciones: p.observaciones
        };
        Object.entries(values).forEach(([key, value]) => { if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value || ''; });
        $('#form-title').textContent = 'Editar práctica';
        $('#practice-admin-form').hidden = false;
        $('#practice-admin-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (button.dataset.action === 'delete') {
        if (!confirm('¿Eliminar esta práctica?')) return;
        await mutate('/api/organization/practices/' + encodeURIComponent(p._id), 'DELETE');
        await load(); notify('Práctica eliminada.');
      }
    } catch (error) { notify(error.message, true); }
  });
  $('#btn-logout').addEventListener('click', async () => {
    try { await mutate('/api/auth/logout', 'POST', {}); location.replace('/login.html'); }
    catch (error) { notify(error.message, true); }
  });
  (async function init() {
    try {
      const session = await api('/api/auth/me');
      state.user = session.usuario;
      $('#practice-user').textContent = state.user.nombre;
      const orgs = await api('/api/auth/organizations'); state.role = orgs.organizacionActiva?.role || null;
      if (!state.role) { notify('Selecciona una organización activa para consultar las prácticas.', true); return; }
      if (state.role === 'administrador') {
        $('#admin-link').hidden = false; $('#btn-nueva').hidden = false;
        $('#practice-admin-form').hidden = true;
        await loadOptions();
      }
      await load();
    } catch (error) { notify(error.message, true); }
  })();
})();
