(function () {
  'use strict';

  async function csrf() {
    const response = await fetch('/api/auth/csrf-token', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo preparar la solicitud.');
    const data = await response.json();
    return data?.data?.csrfToken;
  }

  async function post(url, payload) {
    const token = await csrf();
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'No se pudo completar la solicitud.');
    return data;
  }

  const forgotLink = document.getElementById('recuperar-password');
  const forgotForm = document.getElementById('form-recuperar');
  const forgotNote = document.getElementById('nota-recuperar');

  if (forgotLink && forgotForm) {
    forgotLink.addEventListener('click', (event) => {
      event.preventDefault();
      const show = forgotForm.hidden || getComputedStyle(forgotForm).display === 'none';
      forgotForm.hidden = !show;
      forgotForm.style.display = show ? 'grid' : 'none';
      if (forgotNote) {
        forgotNote.hidden = !show;
        forgotNote.style.display = show ? 'block' : 'none';
      }
      forgotLink.setAttribute('aria-expanded', String(show));
      if (show) document.getElementById('email-recuperar')?.focus();
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = forgotForm.querySelector('button[type="submit"]');
      const message = document.getElementById('mensaje-recuperar');
      const email = document.getElementById('email-recuperar').value.trim();
      button.disabled = true;
      message.textContent = 'Enviando solicitud…';
      message.className = 'form-mensaje mostrar';
      try {
        const result = await post('/api/auth/forgot-password', { email });
        message.textContent = result?.data?.mensaje || 'Si existe una cuenta activa, recibirás instrucciones en tu correo.';
        message.classList.add('exito');
        forgotForm.reset();
      } catch (error) {
        message.textContent = error.message;
        message.classList.add('error');
      } finally {
        button.disabled = false;
      }
    });
  }

  const resetForm = document.getElementById('form-restablecer');
  if (resetForm) {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || '';
    const message = document.getElementById('mensaje-restablecer');
    if (!token) {
      message.textContent = 'El enlace está incompleto. Solicita uno nuevo desde el inicio de sesión.';
      message.classList.add('error');
      resetForm.hidden = true;
    }
    resetForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = document.getElementById('new-password').value;
      const confirm = document.getElementById('confirm-password').value;
      if (password.length < 12 || password.length > 128) {
        message.textContent = 'La contraseña debe tener entre 12 y 128 caracteres.';
        message.classList.add('error');
        return;
      }
      if (password !== confirm) {
        message.textContent = 'Las contraseñas no coinciden.';
        message.classList.add('error');
        return;
      }
      const button = resetForm.querySelector('button[type="submit"]');
      button.disabled = true;
      message.textContent = 'Actualizando contraseña…';
      message.className = 'form-mensaje mostrar';
      try {
        const result = await post('/api/auth/reset-password', { token, newPassword: password });
        message.textContent = result?.data?.mensaje || 'Contraseña actualizada correctamente.';
        message.classList.add('exito');
        resetForm.hidden = true;
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => window.location.assign('/login.html'), 1800);
      } catch (error) {
        message.textContent = error.message;
        message.classList.add('error');
      } finally {
        button.disabled = false;
      }
    });
  }
})();
