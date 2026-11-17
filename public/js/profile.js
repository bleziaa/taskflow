(async () => {
  const form = document.querySelector('#profile-form');
  const feedback = document.querySelector('#feedback');
  const input = document.querySelector('#name');
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (response.status === 401) { location.replace('/login.html'); return; }
    if (!response.ok) throw new Error('No se pudo cargar tu perfil.');
    const data = await response.json();
    input.value = data.data.usuario.nombre || '';
  } catch (error) { feedback.textContent = error.message; }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true; feedback.textContent = '';
    try {
      const tokenResponse = await fetch('/api/auth/csrf-token', { credentials: 'same-origin' });
      if (!tokenResponse.ok) throw new Error('No se pudo validar la sesión.');
      const token = (await tokenResponse.json()).data.csrfToken;
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ nombre: input.value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'No se pudo guardar el nombre.');
      feedback.textContent = 'Tu nombre se actualizó correctamente.';
      input.value = result.data.usuario.nombre;
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  });
})();