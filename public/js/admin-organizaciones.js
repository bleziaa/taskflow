(function () {
'use strict';
const $ = s => document.querySelector(s);
const state = { organizaciones: [], actual: null };
const message = $('#admin-mensaje');
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'No se pudo completar la solicitud.');
  return body.data || {};
}
async function mutate(url, method, body) {
  const csrf = await api('/api/auth/csrf-token');
  return api(url, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken }, body: JSON.stringify(body || {}) });
}
function msg(text, error = false) { message.textContent = text; message.dataset.type = error ? 'error' : 'success'; }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function metrics() {
  $('#metric-organizaciones').textContent = state.organizaciones.length;
  $('#metric-usuarios').textContent = state.organizaciones.reduce((n, x) => n + (x.usuariosVinculados || 0), 0);
  $('#metric-admins').textContent = state.organizaciones.reduce((n, x) => n + (x.administradoresAsignados || 0), 0);
}
function renderList() {
  const q = $('#buscar-organizacion').value.trim().toLowerCase();
  const items = state.organizaciones.filter(x => [x.nombre,x.codigo,x.ciudad].join(' ').toLowerCase().includes(q));
  const root = $('#lista-organizaciones');
  if (!items.length) {
    root.innerHTML = '<div class="admin-vacio"><span>▦</span><h3>' + (q ? 'No hay coincidencias' : 'Todavía no hay organizaciones') + '</h3><p>' + (q ? 'Prueba con otro nombre, código o ciudad.' : 'Registra la primera institución para gestionar sus usuarios y administradores.') + '</p></div>';
    return;
  }
  root.innerHTML = '<div class="org-grid">' + items.map(x => {
    const active = x.estado === 'activa';
    return '<article class="org-card"><div class="org-card-top"><span class="org-avatar">' + esc(x.nombre.slice(0,1).toUpperCase()) + '</span><span class="org-state ' + (active ? 'is-active' : 'is-inactive') + '">' + (active ? 'Activa' : 'Inactiva') + '</span></div><h3>' + esc(x.nombre) + '</h3><p class="org-code">' + esc(x.codigo) + (x.ciudad ? ' · ' + esc(x.ciudad) : '') + '</p><div class="org-card-stats"><span><strong>' + (x.usuariosVinculados || 0) + '</strong> miembros</span><span><strong>' + (x.administradoresAsignados || 0) + '</strong> administradores</span></div><button class="btn btn-secundario org-open" data-open-org="' + x._id + '" type="button">Abrir organización →</button></article>';
  }).join('') + '</div>';
}
async function loadList() {
  const data = await api('/api/admin/organizations');
  state.organizaciones = data.organizaciones || [];
  metrics(); renderList();
  $('#estado-modulo').textContent = 'Backend conectado';
  $('#estado-modulo').classList.add('is-connected');
}
function showForm(show) {
  $('#form-organizacion-panel').hidden = !show;
  if (show) $('#form-organizacion').elements.nombre.focus();
}
async function loadUsers() {
  const data = await api('/api/admin/organizations/available-users?organizationId=' + encodeURIComponent(state.actual._id));
  $('#miembro-usuario').innerHTML = '<option value="">Selecciona una cuenta</option>' + (data.usuarios || []).map(u => '<option value="' + u._id + '">' + esc(u.nombre) + ' · ' + esc(u.email) + ' (' + esc(u.role) + ')</option>').join('');
}
function renderMembers(items) {
  const root = $('#tabla-miembros');
  if (!items.length) {
    root.innerHTML = '<div class="admin-vacio"><h3>Sin miembros asignados</h3><p>Agrega administradores, docentes o estudiantes a esta institución.</p></div>';
    return;
  }
  root.innerHTML = '<div class="org-table-wrap"><table class="org-table"><thead><tr><th>Cuenta</th><th>Rol institucional</th><th>Estado</th><th>Acción</th></tr></thead><tbody>' + items.map(m => {
    const u = m.usuario || {};
    const roles = {administrador:'Administrador',tutor:'Docente / tutor',estudiante:'Estudiante'};
    return '<tr><td><strong>' + esc(u.nombre || 'Cuenta no disponible') + '</strong><small>' + esc(u.email || '') + '</small></td><td>' + roles[m.role] + '</td><td><span class="org-state ' + (m.estado === 'activo' ? 'is-active' : 'is-inactive') + '">' + (m.estado === 'activo' ? 'Activo' : 'Inactivo') + '</span></td><td><button class="btn btn-secundario btn-sm" type="button" data-toggle-member="' + m._id + '" data-next="' + (m.estado === 'activo' ? 'inactivo' : 'activo') + '">' + (m.estado === 'activo' ? 'Desactivar' : 'Activar') + '</button></td></tr>';
  }).join('') + '</tbody></table></div>';
}
async function openOrg(id) {
  const data = await api('/api/admin/organizations/' + encodeURIComponent(id));
  state.actual = data.organizacion;
  const org = data.organizacion;
  $('#detalle-organizacion').hidden = false;
  $('#detalle-nombre').textContent = org.nombre;
  $('#detalle-meta').textContent = org.codigo + (org.ciudad ? ' · ' + org.ciudad : '') + ' · ' + (org.emailContacto || 'Sin correo de contacto');
  $('#detalle-miembros').textContent = data.resumen.usuariosVinculados;
  $('#detalle-admins').textContent = data.resumen.administradoresAsignados;
  $('#detalle-estado').textContent = org.estado === 'activa' ? 'Activa' : 'Inactiva';
  renderMembers(data.miembros || []);
  await loadUsers();
  $('#detalle-organizacion').scrollIntoView({behavior:'smooth',block:'start'});
}
$('#btn-nueva-organizacion').addEventListener('click', () => showForm($('#form-organizacion-panel').hidden));
$('#btn-cancelar-org').addEventListener('click', () => { $('#form-organizacion').reset(); showForm(false); });
$('#form-organizacion').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const button = form.querySelector('button[type=submit]');
  button.disabled = true; button.textContent = 'Guardando…';
  try {
    await mutate('/api/admin/organizations','POST',Object.fromEntries(new FormData(form).entries()));
    form.reset(); showForm(false); await loadList(); msg('Organización registrada correctamente.');
  } catch (error) { msg(error.message,true); }
  finally { button.disabled = false; button.textContent = 'Guardar organización'; }
});
$('#buscar-organizacion').addEventListener('input',renderList);
$('#lista-organizaciones').addEventListener('click',async e => {
  const b=e.target.closest('[data-open-org]'); if(!b)return;
  try { await openOrg(b.dataset.openOrg); } catch(error) { msg(error.message,true); }
});
$('#btn-cerrar-detalle').addEventListener('click',() => { $('#detalle-organizacion').hidden=true; state.actual=null; });
$('#form-miembro').addEventListener('submit',async e => {
  e.preventDefault(); if(!state.actual)return;
  const form=e.currentTarget, button=form.querySelector('button[type=submit]'), feedback=$('#miembro-feedback');
  const organizationId=state.actual._id;
  button.disabled=true; button.textContent='Asignando…';
  feedback.textContent='Estamos verificando la cuenta y creando la asignación…'; feedback.dataset.type='';
  try {
    await mutate('/api/admin/organizations/'+organizationId+'/members','POST',Object.fromEntries(new FormData(form).entries()));
    form.reset(); await openOrg(organizationId); await loadList();
    feedback.textContent='Miembro asignado correctamente.'; feedback.dataset.type='success'; msg('Miembro asignado correctamente.');
  } catch(error) {
    feedback.textContent=error.message; feedback.dataset.type='error';
    feedback.scrollIntoView({behavior:'smooth',block:'center'}); msg(error.message,true);
  } finally { button.disabled=false; button.textContent='＋ Asignar miembro'; }
});
$('#tabla-miembros').addEventListener('click',async e => {
  const b=e.target.closest('[data-toggle-member]'); if(!b||!state.actual)return;
  try {
    await mutate('/api/admin/organizations/'+state.actual._id+'/members/'+b.dataset.toggleMember,'PATCH',{estado:b.dataset.next});
    await openOrg(state.actual._id); await loadList(); msg('Estado de la asignación actualizado.');
  } catch(error) { msg(error.message,true); }
});
loadList().catch(error => {
  $('#estado-modulo').textContent='No se pudo conectar';
  $('#lista-organizaciones').innerHTML='<div class="admin-vacio"><span>!</span><h3>No fue posible cargar el directorio</h3><p>'+esc(error.message)+'</p><button class="btn btn-secundario" id="btn-reintentar" type="button">Reintentar</button></div>';
  msg(error.message,true);
  $('#lista-organizaciones').addEventListener('click',e => { if(e.target.id==='btn-reintentar')loadList().catch(err=>msg(err.message,true)); });
});
})();