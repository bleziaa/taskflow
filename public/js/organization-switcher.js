(function () {
  'use strict';
  const API = '/api/auth/organizations';
  const nav = document.querySelector('.nav-main .nav-lista, #menu-principal .nav-lista');
  if (!nav) return;

  const item = document.createElement('li');
  item.className = 'organization-switcher';
  item.hidden = true;
  const label = document.createElement('label');
  label.className = 'organization-switcher__label';
  label.htmlFor = 'taskflow-organization-select';
  label.textContent = 'Espacio de trabajo';
  const select = document.createElement('select');
  select.id = 'taskflow-organization-select';
  select.className = 'organization-switcher__select';
  select.setAttribute('aria-label', 'Seleccionar organización activa');
  const status = document.createElement('span');
  status.className = 'organization-switcher__status';
  status.setAttribute('role', 'status');
  item.append(label, select, status);
  nav.append(item);

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || 'No se pudo consultar la organización.');
    return body.data || {};
  }
  async function csrf() {
    return (await request('/api/auth/csrf-token')).csrfToken;
  }
  function option(value, text) {
    const node = document.createElement('option');
    node.value = value;
    node.textContent = text;
    return node;
  }
  async function init() {
    try {
      const data = await request(API);
      const organizations = data.organizaciones || [];
      if (!organizations.length) return;
      item.hidden = false;
      select.replaceChildren(option('', 'Selecciona una organización'));
      organizations.forEach((org) => select.append(option(org.id, org.nombre + ' · ' + org.role)));
      const active = data.organizacionActiva;
      let adminLink = nav.querySelector('[data-institution-admin-link]');
      if (!adminLink) {
        const linkItem = document.createElement('li');
        linkItem.dataset.institutionAdminLink = 'true';
        const link = document.createElement('a');
        link.className = 'nav-link';
        link.href = 'institution-admin.html';
        link.textContent = 'Administración institucional';
        linkItem.append(link);
        nav.insertBefore(linkItem, item);
        adminLink = linkItem;
      }
      adminLink.hidden = !active || active.role !== 'administrador';
      if (active) select.value = active.id;
      else if (organizations.length === 1) {
        select.value = organizations[0].id;
        await setActive(organizations[0].id, true);
      } else {
        status.textContent = 'Selecciona tu institución para continuar.';
      }
    } catch (error) {
      status.textContent = error.message;
      item.hidden = false;
      select.disabled = true;
    }
  }
  async function setActive(id, reload = true) {
    if (!id) return;
    select.disabled = true;
    status.textContent = 'Cambiando espacio…';
    try {
      const token = await csrf();
      await request(API + '/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ organizationId: id })
      });
      status.textContent = 'Organización activa';
      if (reload) window.location.reload();
    } catch (error) {
      status.textContent = error.message;
      await init();
    } finally {
      select.disabled = false;
    }
  }
  select.addEventListener('change', () => setActive(select.value));
  init();
})();