(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const state = { user: null, role: null, practices: [], evaluations: [] };
  const message = $('#evaluation-message');
  const concepts = { excelente: 'Excelente', bueno: 'Bueno', satisfactorio: 'Satisfactorio', insuficiente: 'Insuficiente' };
  function notify(text, error = false) { message.textContent = text; message.className = 'form-mensaje ' + (error ? 'error' : 'exito'); }
  async function api(url, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { if (response.status === 401) location.replace('/login.html'); throw new Error(result?.error?.message || 'No se pudo completar la solicitud.'); }
    return result.data || {};
  }
  async function mutate(url, data) {
    const token = (await api('/api/auth/csrf-token')).csrfToken;
    return api(url, { method: 'PUT', headers: { 'X-CSRF-Token': token }, body: JSON.stringify(data) });
  }
  function el(tag, value, className) { const n = document.createElement(tag); n.textContent = value || ''; if (className) n.className = className; return n; }
  function render() {
    const root = $('#evaluation-list');
    if (!state.evaluations.length) { root.replaceChildren(el('p', 'Todavía no hay evaluaciones registradas.')); return; }
    root.replaceChildren(...state.evaluations.map((ev) => {
      const card = el('article', '', 'practice-card evaluation-card');
      const head = el('div', '', 'practice-card-head');
      const score = Number(ev.calificacion);
      const scoreLabel = Number.isFinite(score) ? score.toFixed(1) + ' / 5' : 'Sin calificación';
      const practiceTitle = typeof ev.practica === 'object' ? ev.practica?.titulo : '';
      const studentName = typeof ev.estudiante === 'object' ? ev.estudiante?.nombre : '';
      const tutorName = typeof ev.tutor === 'object' ? ev.tutor?.nombre : '';
      const conceptLabel = concepts[ev.concepto] || ev.concepto || 'Sin concepto';
      const date = ev.evaluadoEn ? new Date(ev.evaluadoEn) : null;
      const dateLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('es-CO') : 'Fecha no disponible';
      head.append(el('h2', practiceTitle || 'Práctica sin título'), el('span', scoreLabel, 'evaluation-score'));
      card.append(head, el('p', 'Estudiante: ' + (studentName || '—') + ' · Tutor: ' + (tutorName || '—')));
      card.append(el('p', 'Concepto: ' + conceptLabel));
      if (ev.fortalezas) card.append(el('p', 'Fortalezas: ' + ev.fortalezas));
      if (ev.aspectosMejora) card.append(el('p', 'Aspectos por mejorar: ' + ev.aspectosMejora));
      if (ev.observaciones) card.append(el('p', 'Observaciones: ' + ev.observaciones));
      card.append(el('p', 'Evaluada el: ' + dateLabel));
      root.append(card);
    }));
  }
  $('#ev-practice').addEventListener('change', (event) => {
    const ev = state.evaluations.find((item) => String(item.practica?._id || item.practica) === event.currentTarget.value);
    $('#ev-score').value = ev?.calificacion ?? '';
    $('#ev-concept').value = ev?.concepto || 'bueno';
    $('#ev-strengths').value = ev?.fortalezas || '';
    $('#ev-improve').value = ev?.aspectosMejora || '';
    $('#ev-notes').value = ev?.observaciones || '';
  });
  $('#evaluation-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const practiceId = data.practica; delete data.practica; data.calificacion = Number(data.calificacion);
    try { await mutate('/api/organization/evaluations/' + encodeURIComponent(practiceId), data); await load(); notify('Evaluación guardada correctamente.'); }
    catch (error) { notify(error.message, true); }
  });
  $('#btn-logout').addEventListener('click', async () => {
    try { const token = (await api('/api/auth/csrf-token')).csrfToken; await api('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': token }, body: '{}' }); location.replace('/login.html'); }
    catch (error) { notify(error.message, true); }
  });
  async function load() {
    const [evaluations, practices] = await Promise.all([api('/api/organization/evaluations'), api('/api/organization/practices')]);
    state.evaluations = evaluations.evaluaciones || [];
    state.practices = practices.practicas || [];
    if (state.role !== 'estudiante') {
      const select = $('#ev-practice'); select.replaceChildren(new Option('Seleccionar práctica…', ''));
      state.practices.filter((p) => p.estado !== 'suspendida').forEach((p) => select.add(new Option(p.titulo + ' — ' + (p.estudiante?.nombre || 'Estudiante'), p._id)));
    }
    render();
  }
  (async function init() {
    try {
      const session = await api('/api/auth/me'); state.user = session.usuario;
      $('#evaluation-user').textContent = state.user.nombre;
      const orgs = await api('/api/auth/organizations'); state.role = orgs.organizacionActiva?.role || null;
      if (!state.role) { notify('Selecciona una organización activa para consultar las evaluaciones.'); return; }
      if (state.role === 'administrador') $('#admin-link').hidden = false;
      if (state.role !== 'estudiante') $('#evaluation-form-wrap').hidden = false;
      await load();
    } catch (error) { notify(error.message, true); }
  })();
})();
