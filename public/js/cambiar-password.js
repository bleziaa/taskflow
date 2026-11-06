(function () {
  'use strict';
  const form = document.getElementById('form-cambiar-password');
  const message = document.getElementById('password-mensaje');
  const button = form.querySelector('button[type="submit"]');
  function show(text, error) { message.textContent = text; message.dataset.type = error ? 'error' : 'success'; }
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'No se pudo completar la solicitud.');
    return data.data || {};
  }
  (async () => {
    try {
      const session = await request('/api/auth/me');
      if (!session.usuario?.debeCambiarPassword) window.location.replace(session.usuario?.role === 'administrador' ? '/admin.html' : '/dashboard.html');
    } catch (_) { window.location.replace('/login.html'); }
  })();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = form.elements.newPassword.value;
    if (password.length < 12) return show('Usa al menos 12 caracteres.', true);
    if (password !== form.elements.confirmPassword.value) return show('Las contraseñas no coinciden.', true);
    button.disabled = true; button.textContent = 'Guardando…';
    try {
      const csrf = await request('/api/auth/csrf-token');
      const result = await request('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken }, body: JSON.stringify({ newPassword: password }) });
      show(result.mensaje || 'Contraseña actualizada.', false);
      window.location.replace(result.usuario?.role === 'administrador' ? '/admin.html' : '/dashboard.html');
    } catch (error) { show(error.message, true); }
    finally { button.disabled = false; button.textContent = 'Guardar contraseña y continuar'; }
  });
})();
