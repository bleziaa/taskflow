(function () {
'use strict';
const $ = s => document.querySelector(s);
const state = { users: [], organizations: [], selected: null, memberships: [] };
const roles = { administrador: 'Administrador institucional', tutor: 'Docente / tutor', estudiante: 'Estudiante' };
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
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function msg(text, error = false) { message.textContent = text; message.dataset.type = error ? 'error' : 'success'; }
function renderUsers() {
  const q = $('#buscar-usuario').value.trim().toLowerCase();
  const role = $('#filtro-rol').value;
  const rows = state.users.filter(u => (!role || u.role === role) && [u.nombre,u.email].join(' ').toLowerCase().includes(q));
  const root = $('#lista-usuarios');
  if (!rows.length) { root.innerHTML = '<div class="admin-vacio"><h3>No hay cuentas para mostrar</h3><p>Prueba otra búsqueda o crea una nueva cuenta.</p></div>'; return; }
  root.innerHTML = '<div class="org-table-wrap"><table class="org-table"><thead><tr><th>Cuenta</th><th>Tipo de cuenta</th><th>Instituciones y roles</th><th>Estado</th><th>Creada</th><th>Acción</th></tr></thead><tbody>' + rows.map(u => '<tr><td><strong>'+esc(u.nombre)+'</strong><small>'+esc(u.email)+'</small></td><td>'+esc(roles[u.role] || u.role)+'</td><td>'+((u.organizaciones||[]).length ? u.organizaciones.map(o=>'<div><strong>'+esc(o.nombre)+'</strong><small>'+esc(roles[o.role]||o.role)+' · '+(o.estado==='activo'?'Activa':'Inactiva')+'</small></div>').join('') : '<span class="admin-muted">Sin institución asignada</span>')+'</td><td><span class="org-state '+(u.activo === false ? 'is-inactive' : 'is-active')+'">'+(u.activo === false ? 'Inactiva' : 'Activa')+'</span></td><td>'+ (u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-CO') : '—') +'</td><td><button class="btn btn-secundario btn-sm" data-user="'+u._id+'">Gestionar</button></td></tr>').join('') + '</tbody></table></div>';
}
async function load() {
  const [users, orgs] = await Promise.all([api('/api/admin/users'), api('/api/admin/organizations')]);
  state.users = users.usuarios || [];
  state.organizations = orgs.organizaciones || [];
  $('#metric-cuentas').textContent = state.users.length;
  $('#metric-organizaciones').textContent = state.organizations.length;
  $('#metric-admins').textContent = state.organizations.reduce((n,o)=>n+(o.administradoresAsignados||0),0);
  const options = '<option value="">Selecciona una institución activa</option>' + state.organizations.filter(o=>o.estado==='activa').map(o=>'<option value="'+o._id+'">'+esc(o.nombre)+' · '+esc(o.codigo)+'</option>').join('');
  $('#asignar-organizacion').innerHTML = options;
  $('#crear-organizacion').innerHTML = options;
  renderUsers();
  $('#estado-modulo').textContent = 'Backend conectado';
  $('#estado-modulo').classList.add('is-connected');
}
function toggleCreate(show) {
  $('#panel-crear-usuario').hidden = !show;
  if (show) $('#form-usuario').elements.nombre.focus();
}
async function openUser(id) {
  const user = state.users.find(u => String(u._id) === String(id));
  if (!user) throw new Error('No se encontró la cuenta seleccionada.');
  state.selected = user;
  $('#panel-detalle-usuario').hidden = false;
  $('#detalle-nombre').textContent = user.nombre;
  $('#detalle-correo').textContent = user.email + (user.activo === false ? ' · Cuenta inactiva' : '');
  const details = await Promise.all(state.organizations.map(async org => {
    try { const d = await api('/api/admin/organizations/'+org._id); return (d.miembros||[]).filter(m=>String(m.usuario?._id)===String(user._id)).map(m=>({...m, org})); }
    catch (_) { return []; }
  }));
  state.memberships = details.flat();
  renderMemberships();
  $('#panel-detalle-usuario').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderMemberships() {
  const root = $('#tabla-membresias');
  if (!state.memberships.length) { root.innerHTML = '<div class="admin-vacio"><h3>Sin membresías</h3><p>Esta cuenta todavía no pertenece a ninguna organización.</p></div>'; return; }
  root.innerHTML = '<div class="org-table-wrap"><table class="org-table"><thead><tr><th>Organización</th><th>Rol institucional</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+state.memberships.map(m=>'<tr><td><strong>'+esc(m.org.nombre)+'</strong><small>'+esc(m.org.codigo)+'</small></td><td><select data-role-member="'+m._id+'">'+Object.entries(roles).map(([k,v])=>'<option value="'+k+'" '+(m.role===k?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></td><td><span class="org-state '+(m.estado==='activo'?'is-active':'is-inactive')+'">'+(m.estado==='activo'?'Activa':'Inactiva')+'</span></td><td><button class="btn btn-secundario btn-sm" data-state-member="'+m._id+'" data-next="'+(m.estado==='activo'?'inactivo':'activo')+'">'+(m.estado==='activo'?'Desactivar':'Activar')+'</button></td></tr>').join('')+'</tbody></table></div>';
}
$('#btn-nuevo-usuario').addEventListener('click',()=>toggleCreate($('#panel-crear-usuario').hidden));
$('#form-usuario').elements.role.addEventListener('change',e=>{ const membershipRole=$('#form-usuario').elements.membershipRole; membershipRole.value=e.target.value; const adminOption=membershipRole.querySelector('option[value="administrador"]'); adminOption.hidden=e.target.value==='estudiante'; });
$('#form-usuario').elements.role.dispatchEvent(new Event('change'));
$('#btn-cancelar-usuario').addEventListener('click',()=>{ $('#form-usuario').reset(); toggleCreate(false); });
$('#form-usuario').addEventListener('submit',async e=>{
  e.preventDefault(); const form=e.currentTarget, button=form.querySelector('button[type=submit]');
  button.disabled=true; button.textContent='Creando cuenta…';
  try {
    const result=await mutate('/api/admin/users','POST',Object.fromEntries(new FormData(form).entries()));
    form.reset();
    const enviada = result.correo?.status === 'sent';
    $('#password-temporal').value=result.credenciales?.passwordTemporal || '';
    $('#campo-password-temporal').hidden=enviada;
    $('#copiar-password-temporal').hidden=enviada;
    $('#resultado-alta-titulo').textContent=enviada?'Cuenta creada y correo enviado':'Cuenta creada';
    $('#resultado-alta-mensaje').textContent=enviada?'Las credenciales se enviaron al correo indicado. El usuario deberá cambiar la contraseña al ingresar.':(result.correo?.status==='failed'?'No se pudo enviar el correo. Copia la contraseña temporal y entrégala por un canal seguro.':'El correo automático aún no está configurado. Copia la contraseña temporal y entrégala por un canal seguro.');
    $('#credenciales-temporales').hidden=false;
    msg('Cuenta creada y vinculada a '+result.organizacion.nombre+'. '+(enviada?'Credenciales enviadas por correo.':'Se requiere entregar la contraseña temporal manualmente.'),!enviada);
    try { await load(); } catch (_) { msg('La cuenta fue creada. No se pudo actualizar el directorio; recarga la página.',true); }
  } catch(error){msg(error.message,true);}
  finally {button.disabled=false;button.textContent='Crear cuenta';}
});
$('#copiar-password-temporal').addEventListener('click',async()=>{
  try { await navigator.clipboard.writeText($('#password-temporal').value); msg('Contraseña temporal copiada. Entrégala al usuario por un canal seguro.'); }
  catch (_) { $('#password-temporal').focus(); $('#password-temporal').select(); msg('No se pudo copiar automáticamente. Selecciona y copia la contraseña.'); }
});
$('#cerrar-credenciales').addEventListener('click',()=>{ $('#password-temporal').value=''; $('#campo-password-temporal').hidden=false; $('#copiar-password-temporal').hidden=false; $('#credenciales-temporales').hidden=true; toggleCreate(false); });
$('#buscar-usuario').addEventListener('input',renderUsers);
$('#filtro-rol').addEventListener('change',renderUsers);
$('#lista-usuarios').addEventListener('click',async e=>{
  const b=e.target.closest('[data-user]'); if(!b)return;
  try { await openUser(b.dataset.user); } catch(error){msg(error.message,true);}
});
$('#btn-restablecer-password').addEventListener('click',async()=>{
  if(!state.selected)return;
  const confirmado=window.confirm('¿Generar una nueva contraseña temporal para '+state.selected.email+'? La contraseña actual dejará de funcionar y el usuario deberá cambiarla al ingresar.');
  if(!confirmado)return;
  const button=$('#btn-restablecer-password'); button.disabled=true; button.textContent='Generando…';
  try {
    const result=await mutate('/api/admin/users/'+state.selected._id+'/reset-password','POST');
    $('#reset-password-temporal').value=result.credenciales.passwordTemporal;
    $('#panel-password-temporal').hidden=false;
    msg('Contraseña temporal generada. Entrégala por un canal seguro.');
    $('#panel-password-temporal').scrollIntoView({behavior:'smooth',block:'center'});
  } catch(error){msg(error.message,true);}
  finally {button.disabled=false;button.textContent='Restablecer contraseña';}
});
$('#copiar-reset-password').addEventListener('click',async()=>{
  try { await navigator.clipboard.writeText($('#reset-password-temporal').value); msg('Contraseña temporal copiada. Entrégala por un canal seguro.'); }
  catch (_) { $('#reset-password-temporal').focus(); $('#reset-password-temporal').select(); msg('No se pudo copiar automáticamente. Selecciona y copia la contraseña.'); }
});
$('#cerrar-reset-password').addEventListener('click',()=>{ $('#reset-password-temporal').value=''; $('#panel-password-temporal').hidden=true; });
$('#btn-cerrar-detalle').addEventListener('click',()=>{ $('#panel-detalle-usuario').hidden=true; state.selected=null; });
$('#btn-asignar').addEventListener('click',async()=>{
  if(!state.selected)return;
  const orgId=$('#asignar-organizacion').value;
  if(!orgId){msg('Selecciona una organización.',true);return;}
  try {
    await mutate('/api/admin/organizations/'+orgId+'/members','POST',{usuarioId:state.selected._id,role:$('#asignar-rol').value});
    await load(); await openUser(state.selected._id); msg('Cuenta asignada correctamente.');
  } catch(error){msg(error.message,true);}
});
$('#tabla-membresias').addEventListener('change',async e=>{
  const id=e.target.dataset.roleMember; if(!id)return;
  const membership=state.memberships.find(m=>String(m._id)===String(id)); if(!membership)return;
  try { await mutate('/api/admin/organizations/'+membership.org._id+'/members/'+id,'PATCH',{role:e.target.value}); await openUser(state.selected._id); msg('Rol institucional actualizado.'); }
  catch(error){msg(error.message,true);renderMemberships();}
});
$('#tabla-membresias').addEventListener('click',async e=>{
  const b=e.target.closest('[data-state-member]'); if(!b)return;
  const membership=state.memberships.find(m=>String(m._id)===String(b.dataset.stateMember)); if(!membership)return;
  try { await mutate('/api/admin/organizations/'+membership.org._id+'/members/'+membership._id,'PATCH',{estado:b.dataset.next}); await load(); await openUser(state.selected._id); msg('Estado de la membresía actualizado.'); }
  catch(error){msg(error.message,true);}
});
load().catch(error=>{
  $('#estado-modulo').textContent='No se pudo conectar';
  $('#lista-usuarios').innerHTML='<div class="admin-vacio"><h3>No fue posible cargar las cuentas</h3><p>'+esc(error.message)+'</p><button class="btn btn-secundario" id="btn-reintentar">Reintentar</button></div>';
  msg(error.message,true);
  $('#lista-usuarios').addEventListener('click',e=>{if(e.target.id==='btn-reintentar')load().catch(err=>msg(err.message,true));});
});
})();