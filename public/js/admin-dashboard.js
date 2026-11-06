(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const mensaje = $('admin-mensaje');

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) window.location.replace('/login.html');
      throw new Error(body?.error?.message || 'No se pudo consultar la plataforma.');
    }
    return body.data || {};
  }

  function setMetric(id, value) {
    const node = $(id);
    if (node) node.textContent = Number.isFinite(Number(value)) ? Number(value).toLocaleString('es-CO') : '—';
  }

  async function loadSummary() {
    const results = await Promise.allSettled([
      request('/api/admin/users'),
      request('/api/admin/organizations'),
      request('/api/admin/dashboard'),
    ]);

    let completed = 0;
    const [usersResult, organizationsResult, dashboardResult] = results;

    if (usersResult.status === 'fulfilled') {
      const users = usersResult.value.usuarios || [];
      setMetric('metric-cuentas', users.length);
      completed += 1;
    }
    if (organizationsResult.status === 'fulfilled') {
      const organizations = organizationsResult.value.organizaciones || [];
      setMetric('metric-organizaciones', organizations.length);
      completed += 1;
    }
    if (dashboardResult.status === 'fulfilled') {
      const summary = dashboardResult.value.resumen || {};
      setMetric('metric-estudiantes', summary.estudiantes);
      setMetric('metric-tutores', summary.tutores);
      setMetric('metric-empresas', (summary.empresas?.activas || 0) + (summary.empresas?.inactivas || 0));
      const practices = summary.practicas || {};
      setMetric('metric-practicas', Object.values(practices).reduce((total, value) => total + (Number(value) || 0), 0));
      completed += 1;
    }

    if (completed === 3) {
      $('estado-panel').textContent = 'Plataforma conectada';
      $('estado-panel').classList.add('is-connected');
      $('resumen-actualizado').textContent = 'Actualizado: ' + new Date().toLocaleString('es-CO');
    } else {
      $('estado-panel').textContent = 'Información parcial';
      $('resumen-actualizado').textContent = 'Algunos indicadores no pudieron consultarse.';
      const failed = results.filter((item) => item.status === 'rejected');
      if (mensaje && failed.length) {
        mensaje.textContent = failed.map((item) => item.reason?.message || 'Error de consulta').join(' ');
        mensaje.dataset.type = 'error';
      }
    }
  }

  async function init() {
    try {
      const data = await request('/api/auth/me');
      const user = data.usuario;
      if (user?.debeCambiarPassword) {
        window.location.replace('/cambiar-password.html');
        return;
      }
      if (!user || user.role !== 'administrador') {
        window.location.replace('/login.html');
        return;
      }
      $('admin-nombre').textContent = user.nombre;
      await loadSummary();
    } catch (error) {
      if (mensaje) mensaje.textContent = error.message;
    }
  }

  $('btn-logout').addEventListener('click', async function () {
    try {
      const csrf = await request('/api/auth/csrf-token');
      await request('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
        body: '{}',
      });
      window.location.replace('/login.html');
    } catch (error) {
      if (mensaje) mensaje.textContent = error.message;
    }
  });

  init();
})();