(function () {
  'use strict';
  const form = document.getElementById('branding-form'), message = document.getElementById('admin-mensaje');
  const status = document.getElementById('branding-status'), orgPicker = document.getElementById('branding-org');
  const pickerWrap = document.getElementById('org-picker-wrap'), primaryField = document.getElementById('primary-field');
  let scope = 'platform', organizationsLoaded = false, loading = false;
  const fields = ['displayName','welcomeMessage','logoAlt','primaryColor','secondaryColor','accentColor'];
  const assets = { logoUrl: '', loginBackgroundUrl: '' };
  async function api(url, options = {}) {
    const response = await fetch(url, { credentials:'same-origin', cache:'no-store', ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || 'No se pudo completar la solicitud.');
    return body.data || {};
  }
  async function csrf() { return (await api('/api/auth/csrf-token')).csrfToken; }
  function currentOrg() { return orgPicker.value; }
  function baseUrl() { return scope === 'platform' ? '/api/admin/branding/platform' : '/api/admin/branding/organizations/' + encodeURIComponent(currentOrg()); }
  function setMessage(text, type='info') { message.textContent = text; message.dataset.type = type; }
  function readForm() { return Object.fromEntries(fields.map(f => [f, form.elements[f].value])); }
  function renderAsset(field) {
    const logo = field === 'logoUrl', img = document.getElementById(logo ? 'logo-thumb' : 'background-thumb');
    const label = document.getElementById(logo ? 'logo-filename' : 'background-filename');
    img.hidden = !assets[field]; img.src = assets[field] || ''; label.textContent = assets[field] ? 'Imagen cargada' : 'Sin imagen seleccionada';
    const preview = document.getElementById('preview-logo');
    if (logo) {
      preview.replaceChildren();
      if (assets.logoUrl) { const image = document.createElement('img'); image.src = assets.logoUrl; image.alt = form.elements.logoAlt.value || ''; image.onerror = () => { preview.textContent = (form.elements.displayName.value || 'T').trim().charAt(0).toUpperCase(); }; preview.append(image); }
      else preview.textContent = (form.elements.displayName.value || 'T').trim().charAt(0).toUpperCase();
    } else {
      const card = document.getElementById('branding-preview');
      card.style.backgroundImage = assets.loginBackgroundUrl ? 'linear-gradient(#17132299,#17132299),url("' + assets.loginBackgroundUrl.replace(/["\\\\]/g, '') + '")' : '';
      card.style.backgroundSize = 'cover'; card.style.backgroundPosition = 'center';
    }
  }
  function renderPreview() {
    const v = readForm();
    const root = document.documentElement;
    const primary = v.primaryColor || '#6d4bd1';
    const secondary = v.secondaryColor || '#8b75dc';
    const accent = v.accentColor || '#26a69a';
    root.style.setProperty('--primario', primary);
    root.style.setProperty('--primario-oscuro', secondary);
    root.style.setProperty('--primario-tenue', 'color-mix(in srgb, ' + primary + ' 12%, transparent)');
    root.style.setProperty('--primario-borde', 'color-mix(in srgb, ' + primary + ' 34%, transparent)');
    root.style.setProperty('--acento', accent);
    document.getElementById('preview-name').textContent = v.displayName || 'Tu organización';
    document.getElementById('preview-welcome').textContent = v.welcomeMessage || 'Mensaje de bienvenida';
    document.getElementById('swatch-primary').style.background = v.primaryColor || '#6d4bd1';
    document.getElementById('swatch-secondary').style.background = v.secondaryColor || '#8b75dc';
    document.getElementById('swatch-accent').style.background = v.accentColor || '#26a69a';
    document.getElementById('branding-preview').style.setProperty('--preview-primary', v.primaryColor || '#6d4bd1');
    document.getElementById('branding-preview').style.setProperty('--preview-secondary', v.secondaryColor || '#8b75dc');
    renderAsset('logoUrl'); renderAsset('loginBackgroundUrl');
  }
  async function load() {
    if (loading) return;
    if (scope === 'organization' && !currentOrg()) { form.reset(); assets.logoUrl=''; assets.loginBackgroundUrl=''; renderPreview(); status.textContent='Selecciona una organización'; return; }
    loading = true; status.textContent='Cargando configuración';
    try {
      const data = await api(baseUrl()), branding = data.branding || {};
      fields.forEach(f => { if (form.elements[f]) form.elements[f].value = branding[f] || ({primaryColor:'#6d4bd1',secondaryColor:'#8b75dc',accentColor:'#26a69a'}[f] || ''); });
      assets.logoUrl=branding.logoUrl || (scope === 'organization' && /universidad de cartagena/i.test(branding.displayName || '') ? '/media/branding/unicartagena.png' : ''); assets.loginBackgroundUrl=branding.loginBackgroundUrl || '';
      if (scope === 'organization') form.elements.primaryColor.value='#6d4bd1';
      renderPreview(); status.textContent='Configuración cargada'; setMessage('');
    } catch(e) { status.textContent='No disponible'; setMessage(e.message,'error'); }
    finally { loading=false; }
  }
  async function loadOrganizations() {
    const data = await api('/api/admin/organizations');
    orgPicker.replaceChildren(new Option('Selecciona una organización',''));
    (data.organizaciones || []).forEach(o => orgPicker.add(new Option(o.nombre+' · '+o.codigo,o._id)));
    organizationsLoaded=true;
  }
  async function upload(field,file) {
    if (!file) return;
    if (file.size > 10*1024*1024) return setMessage('La imagen supera el límite de 10 MB.','error');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return setMessage('Usa una imagen JPG, PNG o WEBP.','error');
    if (scope==='organization' && !currentOrg()) return setMessage('Selecciona primero una organización.','error');
    status.textContent='Subiendo imagen…';
    try {
      const data=new FormData(); data.append('image',file); data.append('field',field);
      const token=await csrf(), result=await api(baseUrl()+'/upload',{method:'POST',headers:{'X-CSRF-Token':token},body:data});
      assets[field]=result.asset.url; renderPreview(); status.textContent='Imagen subida'; setMessage('La imagen se subió correctamente.');
    } catch(e) { status.textContent='No se pudo subir'; setMessage(e.message,'error'); }
  }
  async function removeAsset(field) {
    if (scope==='organization' && !currentOrg()) return;
    try {
      const token=await csrf();
      await api(baseUrl()+'/upload',{method:'DELETE',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({field})});
      assets[field]=''; renderPreview(); setMessage('Imagen quitada.');
    } catch(e) { setMessage(e.message,'error'); }
  }
  document.querySelectorAll('[data-scope]').forEach(button => button.addEventListener('click',async()=>{
    scope=button.dataset.scope;
    document.querySelectorAll('[data-scope]').forEach(b=>{const active=b===button;b.setAttribute('aria-selected',String(active));b.className=active?'btn btn-principal':'btn btn-secundario';});
    pickerWrap.hidden=scope!=='organization'; primaryField.hidden=false;
    if(scope==='organization'&&!organizationsLoaded) await loadOrganizations();
    await load();
  }));
  orgPicker.addEventListener('change',load);
  form.addEventListener('input',renderPreview);
  document.getElementById('logo-file').addEventListener('change',e=>upload('logoUrl',e.target.files[0]));
  document.getElementById('background-file').addEventListener('change',e=>upload('loginBackgroundUrl',e.target.files[0]));
  document.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>removeAsset(b.dataset.remove)));
  document.getElementById('branding-reload').addEventListener('click',load);
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(scope==='organization'&&!currentOrg()) return setMessage('Selecciona una organización antes de guardar.','error');
    const button=document.getElementById('branding-save');button.disabled=true;button.textContent='Guardando…';
    try {
      const token=await csrf(),payload={...readForm(),...assets};
      await api(baseUrl(),{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify(payload)});
      status.textContent='Cambios guardados';setMessage('La identidad visual se guardó correctamente.');
    } catch(e) { setMessage(e.message,'error'); }
    finally { button.disabled=false;button.textContent='Guardar identidad'; }
  });
  primaryField.hidden=false;load();
})();
