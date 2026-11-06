(function () {
'use strict';
const $ = s => document.querySelector(s);
const state = { user: null, role: null, reports: [], summary: {} };
function node(tag, text, cls) { const e = document.createElement(tag); e.textContent = text || ''; if (cls) e.className = cls; return e; }
function notify(text, error = false) { const e = $('#report-message'); e.textContent = text; e.className = 'form-mensaje mostrar ' + (error ? 'error' : 'exito'); }
async function api(url, options = {}) {
 const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
 const body = await r.json().catch(() => ({}));
 if (!r.ok) { if (r.status === 401) location.replace('/login.html'); throw new Error(body?.error?.message || 'No se pudo cargar el informe.'); }
 return body.data || {};
}
function metric(label, value) { const card = node('div', '', 'report-metric'); card.append(node('span', value, 'report-number'), node('span', label, 'report-label')); return card; }
function renderSummary(s) {
 const root = $('#report-summary'); root.replaceChildren(
 metric('Prácticas', s.practicas), metric('En curso', s.activas), metric('Finalizadas', s.finalizadas),
 metric('Actividades completadas', s.actividadesCompletadas + ' / ' + s.totalActividades),
 metric('Evidencias entregadas', s.totalEvidencias), metric('Promedio de evaluación', s.promedio == null ? '—' : s.promedio + ' / 5')
 );
}
function render() {
 renderSummary(state.summary);
 const root = $('#report-list'); root.replaceChildren();
 if (!state.reports.length) { root.append(node('p', 'No hay prácticas disponibles para generar informes.')); return; }
 state.reports.forEach(r => {
  const card = node('article', '', 'report-card');
  const head = node('div', '', 'report-card-head');
  const title = node('div', '', 'report-title'); title.append(node('h2', r.practica.titulo), node('p', (r.estudiante?.nombre || 'Estudiante') + ' · ' + (r.empresa?.razonSocial || 'Empresa sin asignar')));
  head.append(title, node('span', r.practica.estado.replace('_', ' '), 'report-status')); card.append(head);
  const details = node('p', 'Tutor: ' + (r.tutor?.nombre || '—') + ' · Periodo: ' + new Date(r.practica.fechaInicio).toLocaleDateString('es-CO') + ' – ' + new Date(r.practica.fechaFin).toLocaleDateString('es-CO'), 'report-meta'); card.append(details);
  const bar = node('div', '', 'report-progress'); const fill = node('div', '', 'report-progress-fill'); fill.style.width = r.resumen.progreso + '%'; bar.append(fill);
  card.append(node('p', r.resumen.progreso + '% de actividades completadas · ' + r.resumen.completadas + '/' + r.resumen.totalActividades, 'report-meta'), bar);
  const stats = node('div', '', 'report-inline-stats');
  stats.append(node('span', 'Pendientes: ' + r.resumen.pendientes), node('span', 'En revisión: ' + r.resumen.enRevision), node('span', 'Evidencias: ' + r.resumen.totalEvidencias + ' (' + r.resumen.evidenciasAprobadas + ' aprobadas)'));
  card.append(stats);
  if (r.evaluacion) card.append(node('p', 'Evaluación: ' + Number(r.evaluacion.calificacion).toFixed(1) + '/5 · ' + r.evaluacion.concepto, 'report-evaluation'));
  else card.append(node('p', 'Evaluación: pendiente', 'report-meta'));
  const tableWrap = node('div', '', 'tabla-scroll'); const table = document.createElement('table'); const thead = document.createElement('thead'); const tr = document.createElement('tr');
  ['Actividad','Fecha límite','Prioridad','Estado','Evidencias'].forEach(t => tr.append(node('th', t))); thead.append(tr); table.append(thead);
  const tbody = document.createElement('tbody');
  r.actividades.forEach(a => { const row = document.createElement('tr'); [a.titulo,new Date(a.fechaLimite).toLocaleDateString('es-CO'),a.prioridad,a.estado,a.evidencias.length ? a.evidencias.map(e => e.nombre + ' (' + e.estado + ')').join('; ') : 'Sin evidencias'].forEach(t => row.append(node('td', t))); tbody.append(row); });
  if (!r.actividades.length) { const row = document.createElement('tr'); row.append(node('td','No hay actividades registradas.')); tbody.append(row); }
  table.append(tbody); tableWrap.append(table); card.append(tableWrap); root.append(card);
 });
}
function csvEscape(v) { return '"' + String(v ?? '').replace(/"/g, '""') + '"'; }
function exportCsv() {
 const rows = [['Estudiante','Código','Práctica','Empresa','Tutor','Estado práctica','Progreso (%)','Actividades','Completadas','En revisión','Pendientes','Evidencias','Evidencias aprobadas','Calificación','Concepto']];
 state.reports.forEach(r => rows.push([r.estudiante?.nombre,r.estudiante?.codigo,r.practica.titulo,r.empresa?.razonSocial,r.tutor?.nombre,r.practica.estado,r.resumen.progreso,r.resumen.totalActividades,r.resumen.completadas,r.resumen.enRevision,r.resumen.pendientes,r.resumen.totalEvidencias,r.resumen.evidenciasAprobadas,r.evaluacion?.calificacion,r.evaluacion?.concepto].map(csvEscape)));
 const blob = new Blob(['\uFEFF' + rows.map(row => row.join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'informe-taskflow.csv'; a.click(); URL.revokeObjectURL(url);
}
async function load() {
 const filter = $('#report-filter').value;
 const data = await api('/api/organization/reports' + (filter ? '?practica=' + encodeURIComponent(filter) : ''));
 state.reports = data.reportes || []; state.summary = data.resumen || {};
 render();
}
$('#report-filter').addEventListener('change', () => load().catch(e => notify(e.message, true)));
$('#btn-csv').addEventListener('click', exportCsv);
$('#btn-pdf').addEventListener('click', () => window.print());
$('#btn-logout').addEventListener('click', async () => {
 try { const token = (await api('/api/auth/csrf-token')).csrfToken; await api('/api/auth/logout', { method: 'POST', headers: { 'Content-Type':'application/json','X-CSRF-Token': token }, body: '{}' }); location.replace('/login.html'); }
 catch (e) { notify(e.message, true); }
});
(async function init() {
 try {
  const session = await api('/api/auth/me'); state.user = session.usuario;
  $('#report-user').textContent = state.user.nombre;
  const orgs = await api('/api/auth/organizations'); state.role = orgs.organizacionActiva?.role || null;
  if (!state.role) { notify('Selecciona una organización activa para consultar los informes.'); return; }
  if (state.role === 'administrador') $('#admin-link').hidden = false;
  const practices = await api('/api/organization/practices');
  const select = $('#report-filter');
  (practices.practicas || []).forEach(p => select.add(new Option(p.titulo + ' — ' + (p.estudiante?.nombre || 'Estudiante'), p._id)));
  await load();
 } catch (e) { notify(e.message, true); }
})();
})();
