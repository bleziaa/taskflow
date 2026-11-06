(function () {
  'use strict';
  const message = document.getElementById('admin-mensaje');
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || 'No se pudo completar la solicitud.');
    return body.data || {};
  }
  async function init() {
    try {
      const data = await request('/api/auth/me');
      const user = data.usuario;
      if (user && user.debeCambiarPassword) { window.location.replace('/cambiar-password.html'); return; }
      if (!user || user.role !== 'administrador') {
        window.location.replace('/login.html');
        return;
      }
      const name = document.getElementById('admin-nombre');
      if (name) name.textContent = user.nombre;
    } catch (_) {
      window.location.replace('/login.html');
    }
  }
  const logout = document.getElementById('btn-logout');
  if (logout) logout.addEventListener('click', async function () {
    try {
      const csrf = await request('/api/auth/csrf-token');
      await request('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
        body: '{}'
      });
      window.location.replace('/login.html');
    } catch (error) {
      if (message) message.textContent = error.message;
    }
  });
  init();
})();